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
} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {wsService} from '../../../core/services/WebSocketService';
import {formatMessageTime} from '../../../core/utils/formatters';

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

export function ChatScreen({route, navigation}: any) {
  const {conversationId, participantName, participantAvatar} = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const failedIds = useRef<Set<string>>(new Set());

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

  // Register reconnection sync handler
  useEffect(() => {
    wsService.setReconnectSyncHandler(syncMissedMessages);
    return () => { wsService.setReconnectSyncHandler(() => Promise.resolve()); };
  }, [syncMissedMessages]);

  // Listen for real-time events
  useEffect(() => {
    const onNewMessage = (data: any) => {
      if (data.conversationId === conversationId && data.message) {
        setMessages(prev => {
          // Deduplicate: check if message already exists or is our pending message
          if (prev.some(m => m.id === data.message.id)) return prev;
          // Replace optimistic message if server confirms same content
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
        // Mark as delivered
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

    // Optimistic: show message immediately
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
        // Replace optimistic message with server response
        setMessages(prev => prev.map(m =>
          m.id === tempId ? {...data.data.message, _localStatus: undefined} : m
        ));
      } else {
        // Mark as failed
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

  const renderMessage = ({item}: {item: Message}) => {
    const isMe = item.sender_id === user?.id;
    const isDeleted = item.is_deleted === 1;
    const isFailed = item._localStatus === 'failed';
    const isSending = item._localStatus === 'sending';

    return (
      <TouchableOpacity
        style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, isFailed && styles.failedMessage]}
        onLongPress={() => {
          if (isMe && !isDeleted) {
            Alert.alert('Message', 'Choose action', [
              {text: 'Copy', onPress: () => handleCopy(item)},
              {text: 'Reply', onPress: () => setReplyTo(item)},
              {text: 'Delete', style: 'destructive', onPress: () => handleDelete(item)},
              {text: 'Cancel', style: 'cancel'},
            ]);
          } else if (!isMe && !isDeleted) {
            Alert.alert('Message', 'Choose action', [
              {text: 'Copy', onPress: () => handleCopy(item)},
              {text: 'Reply', onPress: () => setReplyTo(item)},
              {text: 'Cancel', style: 'cancel'},
            ]);
          }
        }}
        onPress={() => isFailed && handleRetry(item)}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender_name || item.sender_username}</Text>
        )}
        {item.reply_to && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText} numberOfLines={1}>Replying to message</Text>
          </View>
        )}
        <Text style={[styles.messageText, isDeleted && styles.deletedText]}>
          {isDeleted ? 'Message deleted' : item.content || ''}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {formatMessageTime(item.created_at)}
          </Text>
          {isMe && (
            <Text style={[styles.messageStatus, isFailed && styles.failedStatus]}>
              {isFailed ? '✕ Failed' : isSending ? '◷ Sending...' : item.status === 'read' ? '✓✓ Read' : item.status === 'delivered' ? '✓✓' : '✓ Sent'}
            </Text>
          )}
          {item.is_edited === 1 && <Text style={styles.editedBadge}>edited</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const typingUsers = Object.entries(typing).filter(([_, v]) => v).map(([k]) => k);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>{participantName?.[0] || '?'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{participantName}</Text>
          {typingUsers.length > 0 ? (
            <Text style={styles.typingText}>typing...</Text>
          ) : (
            <Text style={styles.statusText}>Online</Text>
          )}
        </View>
      </View>

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarLabel}>Replying to {replyTo.sender_name}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={styles.replyBarClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
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
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Send a message to start the conversation</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={handleTyping}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim()) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingTop: 48,
    backgroundColor: '#6366f1',
  },
  backBtn: {padding: 8, marginRight: 4},
  backText: {color: '#fff', fontSize: 24},
  avatarSmall: {width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  avatarSmallText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  headerInfo: {flex: 1},
  headerName: {color: '#fff', fontSize: 16, fontWeight: '600'},
  typingText: {color: '#d4d4ff', fontSize: 12, marginTop: 1},
  statusText: {color: '#a5b4fc', fontSize: 11, marginTop: 1},
  replyBar: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 14, paddingVertical: 8, borderLeftWidth: 3, borderLeftColor: '#6366f1'},
  replyBarContent: {flex: 1},
  replyBarLabel: {fontSize: 11, fontWeight: '600', color: '#6366f1'},
  replyBarText: {fontSize: 12, color: '#666', marginTop: 2},
  replyBarClose: {fontSize: 18, color: '#666', padding: 4},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  messageList: {padding: 12, paddingBottom: 8},
  loadMore: {alignItems: 'center', padding: 10},
  loadMoreText: {color: '#6366f1', fontSize: 13},
  messageBubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {alignSelf: 'flex-end', backgroundColor: '#6366f1'},
  theirMessage: {alignSelf: 'flex-start', backgroundColor: '#e5e7eb'},
  failedMessage: {opacity: 0.6, borderWidth: 1, borderColor: '#ef4444'},
  senderName: {fontSize: 11, fontWeight: '600', color: '#6366f1', marginBottom: 2},
  replyIndicator: {backgroundColor: 'rgba(0,0,0,0.05)', padding: 4, borderRadius: 4, marginBottom: 4, borderLeftWidth: 2, borderLeftColor: '#6366f1'},
  replyText: {fontSize: 10, color: '#666', fontStyle: 'italic'},
  messageText: {fontSize: 15, lineHeight: 20, color: '#fff'},
  deletedText: {fontStyle: 'italic', color: 'rgba(255,255,255,0.5)'},
  messageFooter: {flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: 4},
  messageTime: {fontSize: 10, color: 'rgba(255,255,255,0.5)'},
  myMessageTime: {color: 'rgba(255,255,255,0.6)'},
  messageStatus: {fontSize: 10, color: 'rgba(255,255,255,0.6)'},
  failedStatus: {color: '#fca5a5'},
  editedBadge: {fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic'},
  emptyChat: {flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100},
  emptyText: {fontSize: 16, color: '#666'},
  emptySub: {fontSize: 13, color: '#999', marginTop: 4},
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {opacity: 0.4},
  sendText: {color: '#fff', fontSize: 18},
});
