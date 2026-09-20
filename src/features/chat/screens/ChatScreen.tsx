import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Share,
  ScrollView,
} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {wsService} from '../../../core/services/WebSocketService';
import {formatMessageTime} from '../../../core/utils/formatters';
import {Colors, Spacing, BorderRadius, Shadows, Typography} from '../../../core/theme';
import {useTheme} from '../../../shell/providers/ThemeProvider';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  metadata: string | null;
  reply_to: string | null;
  is_edited: number;
  is_deleted: number;
  status: string;
  created_at: number;
  updated_at: number;
  sender_username?: string;
  sender_name?: string;
  sender_avatar?: string;
  _localStatus?: 'sending' | 'failed';
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export function ChatScreen({route, navigation}: any) {
  const {conversationId, participantName, participantAvatar} = route.params;
  const {isDark} = useTheme();
  const styles = React.useMemo(() => createChatStyles(), [isDark]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionMenu, setActionMenu] = useState<{visible: boolean; message: Message | null}>({visible: false, message: null});
  const [showReactions, setShowReactions] = useState<{visible: boolean; messageId: string}>({visible: false, messageId: ''});
  const flatListRef = useRef<FlatList>(null);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const failedIds = useRef<Set<string>>(new Set());

  const formatTime = (ts: number) => formatMessageTime(ts);

  const loadMessages = useCallback(async (before?: number) => {
    if (!token) return;
    try {
      const url = `${Config.API.BASE_URL}/api/conversations/${conversationId}/messages?limit=50${before ? `&before=${before}` : ''}`;
      const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`}});
      const data = await res.json();
      if (data.success) {
        const newMsgs = data.data.messages;
        if (before) {
          setMessages(prev => [...newMsgs, ...prev]);
          setHasMore(newMsgs.length === 50);
        } else {
          setMessages(newMsgs);
          setHasMore(newMsgs.length === 50);
        }
      }
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  const syncMissedMessages = useCallback(async () => {
    if (!token) return;
    try {
      const lastSync = wsService.getLastSyncTime();
      const res = await fetch(`${Config.API.BASE_URL}/api/conversations/sync`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({since: lastSync}),
      });
      const data = await res.json();
      if (data.success) {
        for (const update of data.data.updates) {
          if (update.conversationId === conversationId && update.newMessages.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const unique = update.newMessages.filter((m: Message) => !existingIds.has(m.id));
              return unique.length > 0 ? [...prev, ...unique] : prev;
            });
          }
        }
      }
    } catch (e) {
      console.error('[Sync] Error:', e);
    }
  }, [conversationId, token]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    wsService.setReconnectSyncHandler(syncMissedMessages);
    return () => { wsService.setReconnectSyncHandler(() => Promise.resolve()); };
  }, [syncMissedMessages]);

  useEffect(() => {
    const onNewMessage = (data: any) => {
      if (data.conversationId === conversationId && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          const pendingIdx = prev.findIndex(
            m => m._localStatus === 'sending' &&
              m.sender_id === data.message.sender_id &&
              m.content === data.message.content
          );
          if (pendingIdx >= 0) {
            const updated = [...prev];
            updated[pendingIdx] = {...data.message, _localStatus: undefined};
            return updated;
          }
          return [...prev, data.message];
        });
        if (data.message.sender_id !== user?.id) {
          fetch(`${Config.API.BASE_URL}/api/messages/${data.message.id}/delivered`, {
            method: 'POST',
            headers: {Authorization: `Bearer ${token}`},
          }).catch(() => {});
        }
      }
    };

    const onMessageEdited = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.map(m => m.id === data.message.id ? {...data.message, _localStatus: m._localStatus} : m));
      }
    };

    const onMessageDeleted = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? {...m, is_deleted: 1, content: null} : m));
      }
    };

    const onMessageDelivered = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? {...m, status: 'delivered'} : m));
      }
    };

    const onTyping = (data: any) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setTyping(prev => ({...prev, [data.userId]: data.isTyping}));
        if (data.isTyping) {
          setTimeout(() => setTyping(prev => ({...prev, [data.userId]: false})), 3000);
        }
      }
    };

    const onMessagesRead = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.map(m =>
          m.sender_id === user?.id && m.status !== 'read' ? {...m, status: 'read'} : m
        ));
      }
    };

    wsService.on('new_message', onNewMessage);
    wsService.on('message_edited', onMessageEdited);
    wsService.on('message_deleted', onMessageDeleted);
    wsService.on('message_delivered', onMessageDelivered);
    wsService.on('typing', onTyping);
    wsService.on('messages_read', onMessagesRead);
    wsService.markRead(conversationId);

    return () => {
      wsService.off('new_message', onNewMessage);
      wsService.off('message_edited', onMessageEdited);
      wsService.off('message_deleted', onMessageDeleted);
      wsService.off('message_delivered', onMessageDelivered);
      wsService.off('typing', onTyping);
      wsService.off('messages_read', onMessagesRead);
    };
  }, [conversationId, user?.id, token]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !token) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user?.id || '',
      type: 'text',
      content: trimmed,
      metadata: null,
      reply_to: replyTo?.id || null,
      is_edited: 0,
      is_deleted: 0,
      status: 'sending',
      created_at: Date.now(),
      updated_at: Date.now(),
      sender_username: user?.username,
      sender_name: user?.displayName,
      _localStatus: 'sending',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setText('');
    setReplyTo(null);

    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({conversationId, type: 'text', content: trimmed, replyTo: replyTo?.id}),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? {...data.data.message, _localStatus: undefined} : m
        ));
      } else {
        failedIds.current.add(tempId);
        setMessages(prev => prev.map(m =>
          m.id === tempId ? {...m, status: 'failed', _localStatus: 'failed'} : m
        ));
      }
    } catch (error) {
      failedIds.current.add(tempId);
      setMessages(prev => prev.map(m =>
        m.id === tempId ? {...m, status: 'failed', _localStatus: 'failed'} : m
      ));
    }
  };

  const handleSendMedia = async (type: 'image' | 'video' | 'file', uri: string, name?: string, mimeType?: string) => {
    if (!token) return;
    setShowAttachMenu(false);
    setUploading(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {encoding: 'base64'});
      const uploadRes = await fetch(`${Config.API.BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({data: base64, mimeType: mimeType || 'application/octet-stream'}),
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        Alert.alert('Upload failed', 'Could not upload file');
        setUploading(false);
        return;
      }

      const fileUrl = uploadData.data.url;
      const metadata = JSON.stringify({url: fileUrl, fileName: name || 'file', mimeType: mimeType || 'application/octet-stream'});

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user?.id || '',
        type,
        content: null,
        metadata,
        reply_to: null,
        is_edited: 0,
        is_deleted: 0,
        status: 'sending',
        created_at: Date.now(),
        updated_at: Date.now(),
        sender_username: user?.username,
        sender_name: user?.displayName,
        _localStatus: 'sending',
      };
      setMessages(prev => [...prev, optimisticMsg]);

      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({conversationId, type, content: null, metadata}),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === tempId ? {...data.data.message, _localStatus: undefined} : m));
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? {...m, status: 'failed', _localStatus: 'failed'} : m));
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send media');
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: 'images', quality: 0.7});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia('image', asset.uri, asset.fileName || 'photo.jpg', 'image/jpeg');
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({quality: 0.7});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia('image', asset.uri, asset.fileName || 'photo.jpg', 'image/jpeg');
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: 'videos', quality: 0.7});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia('video', asset.uri, asset.fileName || 'video.mp4', 'video/mp4');
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({type: '*/*'});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia('file', asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
    }
  };

  const handleRetry = async (msg: Message) => {
    if (!token) return;
    failedIds.current.delete(msg.id);
    setMessages(prev => prev.map(m => m.id === msg.id ? {...m, _localStatus: 'sending', status: 'sending'} : m));

    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({conversationId, type: 'text', content: msg.content, replyTo: msg.reply_to}),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.map(m => m.id === msg.id ? {...data.data.message, _localStatus: undefined} : m));
      } else {
        setMessages(prev => prev.map(m => m.id === msg.id ? {...m, status: 'failed', _localStatus: 'failed'} : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? {...m, status: 'failed', _localStatus: 'failed'} : m));
    }
  };

  const handleDelete = (msg: Message) => {
    if (msg.sender_id !== user?.id) return;
    Alert.alert('Delete Message', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${Config.API.BASE_URL}/api/messages/${msg.id}`, {
              method: 'DELETE',
              headers: {Authorization: `Bearer ${token}`},
            });
          } catch {}
        }
      },
    ]);
  };

  const handleCopy = (msg: Message) => {
    if (msg.content) {
      const Clipboard = require('react-native').Clipboard;
      Clipboard.setString(msg.content);
    }
  };

  const handleForward = async (msg: Message) => {
    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/conversations`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Forward', 'Select a conversation to forward this message');
      }
    } catch {}
  };

  const handleShare = async (msg: Message) => {
    try {
      await Share.share({message: msg.content || ''});
    } catch {}
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!token) return;
    setShowReactions({visible: false, messageId: ''});
    try {
      await fetch(`${Config.API.BASE_URL}/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({emoji}),
      });
    } catch {}
  };

  const handleTyping = (value: string) => {
    setText(value);
    if (value.length > 0) {
      wsService.sendTyping(conversationId, true);
    }
  };

  const loadEarlier = () => {
    if (messages.length > 0 && hasMore && !loading) {
      loadMessages(messages[0].created_at);
    }
  };

  const openActionMenu = (msg: Message) => {
    if (msg.is_deleted) return;
    setActionMenu({visible: true, message: msg});
  };

  const renderMessage = ({item}: {item: Message}) => {
    const isMe = item.sender_id === user?.id;
    const isDeleted = item.is_deleted === 1;
    const isFailed = item._localStatus === 'failed';
    const isSending = item._localStatus === 'sending';

    let metadataParsed: any = null;
    try { if (item.metadata) metadataParsed = JSON.parse(item.metadata); } catch {}

    const replyContent = item.reply_to
      ? messages.find(m => m.id === item.reply_to)?.content
      : null;

    return (
      <TouchableOpacity
        style={[styles.bubble, isMe ? styles.bubbleSent : styles.bubbleReceived, isFailed && {opacity: 0.6}]}
        onLongPress={() => openActionMenu(item)}
        onPress={() => isFailed && handleRetry(item)}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender_name || item.sender_username}</Text>
        )}
        {item.reply_to && replyContent && (
          <View style={isMe ? styles.replyPreviewSent : styles.replyPreviewReceived}>
            <Text style={isMe ? styles.replyTextSent : styles.replyTextReceived} numberOfLines={1}>
              {replyContent}
            </Text>
          </View>
        )}

        {item.type === 'image' && metadataParsed?.url ? (
          <Image source={{uri: metadataParsed.url}} style={styles.messageImage} resizeMode="cover" />
        ) : item.type === 'video' && metadataParsed?.url ? (
          <View style={styles.videoContainer}>
            <Image source={{uri: metadataParsed.url}} style={styles.messageImage} resizeMode="cover" />
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={48} color="#fff" />
            </View>
          </View>
        ) : item.type === 'file' && metadataParsed ? (
          <View style={styles.fileContainer}>
            <Ionicons name="document-outline" size={32} color={isMe ? '#fff' : Colors.primary} />
            <Text style={[styles.fileName, isMe && {color: '#fff'}]} numberOfLines={1}>{metadataParsed.fileName || 'File'}</Text>
          </View>
        ) : (
          <Text style={[isMe ? styles.bubbleTextSent : styles.bubbleTextReceived, isDeleted && {fontStyle: 'italic', opacity: 0.6}]}>
            {isDeleted ? 'Message deleted' : item.content || ''}
          </Text>
        )}

        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, isMe ? styles.timeSent : styles.timeReceived]}>
            {formatTime(item.created_at)}
          </Text>
          {isMe && (
            <Ionicons
              name={isFailed ? 'alert-circle' : item.status === 'read' ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={isFailed ? '#FCA5A5' : item.status === 'read' ? '#93C5FD' : 'rgba(255,255,255,0.6)'}
            />
          )}
          {item.is_edited === 1 && <Text style={styles.editedBadge}>edited</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const typingUsers = Object.entries(typing).filter(([_, v]) => v).map(([k]) => k);
  const isOnline = typingUsers.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{participantName?.[0] || '?'}</Text>
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View>
            <Text style={styles.headerName}>{participantName}</Text>
            {typingUsers.length > 0 ? (
              <Text style={styles.typingText}>typing...</Text>
            ) : (
              <Text style={styles.headerStatus}>Online</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="search" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarLabel}>Replying to {replyTo.sender_name}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: false})}
          onScrollBeginDrag={() => wsService.markRead(conversationId)}
          ListHeaderComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMore} onPress={loadEarlier}>
                <Text style={styles.loadMoreText}>Load earlier messages</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Send a message to start the conversation</Text>
            </View>
          }
        />
      )}

      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      {showAttachMenu && (
        <View style={styles.attachMenu}>
          <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
            <View style={[styles.attachIcon, {backgroundColor: '#EEF2FF'}]}>
              <Ionicons name="image" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.attachLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
            <View style={[styles.attachIcon, {backgroundColor: '#FEF3C7'}]}>
              <Ionicons name="camera" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.attachLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={handlePickVideo}>
            <View style={[styles.attachIcon, {backgroundColor: '#DCFCE7'}]}>
              <Ionicons name="videocam" size={22} color="#22C55E" />
            </View>
            <Text style={styles.attachLabel}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={handlePickDocument}>
            <View style={[styles.attachIcon, {backgroundColor: '#FEE2E2'}]}>
              <Ionicons name="document" size={22} color="#EF4444" />
            </View>
            <Text style={styles.attachLabel}>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.inputBtn} onPress={() => setShowAttachMenu(!showAttachMenu)}>
          <Ionicons name={showAttachMenu ? "close-circle" : "add-circle"} size={28} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleTyping}
            placeholder="Message..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={4000}
          />
        </View>
        {text.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.voiceBtn}>
            <Ionicons name="mic" size={24} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={actionMenu.visible} transparent animationType="fade" onRequestClose={() => setActionMenu({visible: false, message: null})}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionMenu({visible: false, message: null})}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Message Actions</Text>

            {actionMenu.message && !actionMenu.message.is_deleted && (
              <View style={styles.reactionRow}>
                {REACTION_EMOJIS.map(emoji => (
                  <TouchableOpacity key={emoji} style={styles.reactionBtn} onPress={() => {
                    handleReact(actionMenu.message!.id, emoji);
                    setActionMenu({visible: false, message: null});
                  }}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.actionItem} onPress={() => {
              if (actionMenu.message) { setReplyTo(actionMenu.message); setActionMenu({visible: false, message: null}); }
            }}>
              <Ionicons name="arrow-undo" size={22} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={() => {
              if (actionMenu.message) { handleForward(actionMenu.message); setActionMenu({visible: false, message: null}); }
            }}>
              <Ionicons name="arrow-redo" size={22} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Forward</Text>
            </TouchableOpacity>

            {actionMenu.message?.content && (
              <TouchableOpacity style={styles.actionItem} onPress={() => {
                if (actionMenu.message) { handleCopy(actionMenu.message); setActionMenu({visible: false, message: null}); }
              }}>
                <Ionicons name="copy" size={22} color={Colors.textPrimary} />
                <Text style={styles.actionText}>Copy</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionItem} onPress={() => {
              if (actionMenu.message) { handleShare(actionMenu.message); setActionMenu({visible: false, message: null}); }
            }}>
              <Ionicons name="share-social" size={22} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            {actionMenu.message?.sender_id === user?.id && (
              <TouchableOpacity style={styles.actionItem} onPress={() => {
                if (actionMenu.message) { handleDelete(actionMenu.message); setActionMenu({visible: false, message: null}); }
              }}>
                <Ionicons name="trash" size={22} color="#EF4444" />
                <Text style={[styles.actionText, {color: '#EF4444'}]}>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionItem} onPress={() => setActionMenu({visible: false, message: null})}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
              <Text style={[styles.actionText, {color: Colors.textSecondary}]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function createChatStyles() {
  return StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {padding: 8, marginRight: 4},
  headerCenter: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm,
  },
  headerAvatarText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.online, borderWidth: 2, borderColor: Colors.surface,
  },
  headerName: {fontSize: 16, fontWeight: '600', color: Colors.textPrimary},
  headerStatus: {fontSize: 12, color: Colors.textSecondary},
  typingText: {fontSize: 12, color: Colors.primary},
  headerBtn: {padding: 8},
  messagesList: {paddingHorizontal: Spacing.md, paddingBottom: 8},
  bubble: {maxWidth: '78%', padding: Spacing.md, marginBottom: 4, borderRadius: BorderRadius.lg},
  bubbleSent: {backgroundColor: Colors.bubbleSent, alignSelf: 'flex-end', borderBottomRightRadius: BorderRadius.xs},
  bubbleReceived: {backgroundColor: Colors.bubbleReceived, alignSelf: 'flex-start', borderBottomLeftRadius: BorderRadius.xs, borderWidth: 1, borderColor: Colors.borderLight},
  bubbleTextSent: {color: '#fff', fontSize: 15, lineHeight: 20},
  bubbleTextReceived: {color: Colors.textPrimary, fontSize: 15, lineHeight: 20},
  bubbleFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4},
  bubbleTime: {fontSize: 11},
  timeSent: {color: 'rgba(255,255,255,0.6)'},
  timeReceived: {color: Colors.textTertiary},
  senderName: {fontSize: 11, fontWeight: '600', color: Colors.primary, marginBottom: 2},
  replyPreviewSent: {backgroundColor: 'rgba(255,255,255,0.15)', padding: 6, borderRadius: 6, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#fff'},
  replyTextSent: {fontSize: 12, color: 'rgba(255,255,255,0.8)'},
  replyPreviewReceived: {backgroundColor: Colors.surfaceSecondary, padding: 6, borderRadius: 6, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: Colors.primary},
  replyTextReceived: {fontSize: 12, color: Colors.textSecondary},
  editedBadge: {fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic'},
  emptyChat: {flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100},
  emptyText: {fontSize: 16, color: Colors.textSecondary, marginTop: 12},
  emptySub: {fontSize: 13, color: Colors.textTertiary, marginTop: 4},
  loadMore: {alignItems: 'center', padding: 10},
  loadMoreText: {color: Colors.primary, fontSize: 13},
  replyBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 14, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  replyBarContent: {flex: 1},
  replyBarLabel: {fontSize: 11, fontWeight: '600', color: Colors.primary},
  replyBarText: {fontSize: 12, color: Colors.textSecondary, marginTop: 2},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.sm,
  },
  inputBtn: {padding: 6, marginBottom: 4},
  inputContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: Colors.surfaceSecondary, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 40,
  },
  input: {flex: 1, fontSize: 15, color: Colors.textPrimary, paddingVertical: 8, maxHeight: 100, textAlignVertical: 'center'},
  cameraBtn: {padding: 4, marginBottom: 4},
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.sm,
  },
  voiceBtn: {padding: 6, marginLeft: Spacing.sm, marginBottom: 4},
  attachMenu: {
    flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  attachOption: {alignItems: 'center', gap: 4},
  attachIcon: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  attachLabel: {fontSize: 11, color: Colors.textSecondary},
  messageImage: {width: 220, height: 160, borderRadius: BorderRadius.md, marginBottom: 4},
  videoContainer: {position: 'relative'},
  videoOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center'},
  fileContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary, minWidth: 150,
  },
  fileName: {fontSize: 13, color: Colors.textPrimary, flex: 1},
  uploadOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  uploadText: {color: '#fff', marginTop: 8, fontSize: 14},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  actionSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 12,
  },
  actionSheetHandle: {width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12},
  actionSheetTitle: {fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12, textAlign: 'center'},
  reactionRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.borderLight, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  reactionBtn: {padding: 8, borderRadius: 20, backgroundColor: Colors.surfaceSecondary},
  reactionEmoji: {fontSize: 24},
  actionItem: {flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12},
  actionText: {fontSize: 15, color: Colors.textPrimary},
});
}
