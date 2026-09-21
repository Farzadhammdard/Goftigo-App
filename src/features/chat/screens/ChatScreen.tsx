import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {wsService} from '../../../core/services/WebSocketService';
import {
  formatMessageTime,
  formatRelativeTime,
} from '../../../core/utils/formatters';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
} from '../../../core/theme';
import {useTheme} from '../../../shell/providers/ThemeProvider';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
} from 'expo-audio';

interface Reaction {
  user_id: string;
  emoji: string;
}

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
  reactions?: Reaction[];
  _localStatus?: 'sending' | 'failed';
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (dayKey(ts) === dayKey(today.getTime())) return 'Today';
  if (dayKey(ts) === dayKey(yesterday.getTime())) return 'Yesterday';
  return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
}

function groupReactions(reactions?: Reaction[]): [string, number][] {
  const map: Record<string, number> = {};
  (reactions || []).forEach(r => {
    map[r.emoji] = (map[r.emoji] || 0) + 1;
  });
  return Object.entries(map);
}

export function ChatScreen({route, navigation}: any) {
  const {
    conversationId,
    participantName,
    participantAvatar,
    participantId,
    participantOnline,
  } = route.params;
  const {isDark} = useTheme();
  const styles = useMemo(() => createChatStyles(), [isDark]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [cachedMedia, setCachedMedia] = useState<Record<string, string>>({});
  const [openImageUri, setOpenImageUri] = useState<string | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceSound = useRef<AudioPlayer | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cachingMedia = useRef<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<{
    visible: boolean;
    message: Message | null;
  }>({visible: false, message: null});
  const [copyModal, setCopyModal] = useState<{visible: boolean; text: string}>({
    visible: false,
    text: '',
  });
  const [forwardPicker, setForwardPicker] = useState<{
    visible: boolean;
    message: Message | null;
  }>({visible: false, message: null});
  const [forwardList, setForwardList] = useState<any[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [otherOnline, setOtherOnline] = useState<boolean>(
    !!participantOnline,
  );
  const [otherLastSeen, setOtherLastSeen] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput>(null);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const failedIds = useRef<Set<string>>(new Set());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      voiceSound.current?.release();
    };
  }, []);

  const formatTime = (ts: number) => formatMessageTime(ts);

  const normalizeMediaUrl = (url: string) => {
    if (!url) return url;
    return url.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
      Config.API.BASE_URL,
    );
  };

  // The other participant's id — from route params, or derived from messages.
  const otherId =
    participantId ||
    messages.find(m => m.sender_id !== user?.id)?.sender_id ||
    null;

  useEffect(() => {
    for (const message of messages) {
      if (message.type !== 'image' && message.type !== 'video') continue;
      let metadata: any = null;
      try {
        metadata = message.metadata ? JSON.parse(message.metadata) : null;
      } catch {}
      const url = normalizeMediaUrl(metadata?.url || '');
      if (
        !url ||
        cachedMedia[message.id] ||
        cachingMedia.current.has(message.id)
      )
        continue;
      cachingMedia.current.add(message.id);
      const filename = `${FileSystem.documentDirectory}media-${message.id}.${message.type === 'image' ? 'jpg' : 'mp4'}`;
      FileSystem.downloadAsync(url, filename)
        .then(result =>
          setCachedMedia(prev => ({...prev, [message.id]: result.uri})),
        )
        .catch(error => console.warn('Media cache failed:', error?.message))
        .finally(() => cachingMedia.current.delete(message.id));
    }
  }, [messages, cachedMedia]);

  const loadMessages = useCallback(
    async (before?: number) => {
      if (!token) return;
      try {
        const url = `${Config.API.BASE_URL}/api/conversations/${conversationId}/messages?limit=50${before ? `&before=${before}` : ''}`;
        const res = await fetch(url, {
          headers: {Authorization: `Bearer ${token}`},
        });
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
    },
    [conversationId, token],
  );

  const syncMissedMessages = useCallback(async () => {
    if (!token) return;
    try {
      const lastSync = wsService.getLastSyncTime();
      const res = await fetch(`${Config.API.BASE_URL}/api/conversations/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({since: lastSync}),
      });
      const data = await res.json();
      if (data.success) {
        for (const update of data.data.updates) {
          if (
            update.conversationId === conversationId &&
            update.newMessages.length > 0
          ) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const unique = update.newMessages.filter(
                (m: Message) => !existingIds.has(m.id),
              );
              return unique.length > 0 ? [...prev, ...unique] : prev;
            });
          }
        }
      }
    } catch (e) {
      console.error('[Sync] Error:', e);
    }
  }, [conversationId, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    wsService.setReconnectSyncHandler(syncMissedMessages);
    return () => {
      wsService.setReconnectSyncHandler(() => Promise.resolve());
    };
  }, [syncMissedMessages]);

  useEffect(() => {
    const onNewMessage = (data: any) => {
      if (data.conversationId === conversationId && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          const pendingIdx = prev.findIndex(
            m =>
              m._localStatus === 'sending' &&
              m.sender_id === data.message.sender_id &&
              m.content === data.message.content,
          );
          if (pendingIdx >= 0) {
            const updated = [...prev];
            updated[pendingIdx] = {...data.message, _localStatus: undefined};
            return updated;
          }
          return [...prev, data.message];
        });
        if (data.message.sender_id !== user?.id) {
          fetch(
            `${Config.API.BASE_URL}/api/messages/${data.message.id}/delivered`,
            {
              method: 'POST',
              headers: {Authorization: `Bearer ${token}`},
            },
          ).catch(() => {});
        }
      }
    };

    const onMessageEdited = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.message.id
              ? {...data.message, _localStatus: m._localStatus}
              : m,
          ),
        );
      }
    };

    const onMessageDeleted = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.messageId ? {...m, is_deleted: 1, content: null} : m,
          ),
        );
      }
    };

    const onMessageDelivered = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.messageId ? {...m, status: 'delivered'} : m,
          ),
        );
      }
    };

    const onReaction = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.messageId ? {...m, reactions: data.reactions} : m,
          ),
        );
      }
    };

    const onTyping = (data: any) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setTyping(prev => ({...prev, [data.userId]: data.isTyping}));
        if (data.isTyping) {
          setTimeout(
            () => setTyping(prev => ({...prev, [data.userId]: false})),
            3000,
          );
        }
      }
    };

    const onMessagesRead = (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.sender_id === user?.id && m.status !== 'read'
              ? {...m, status: 'read'}
              : m,
          ),
        );
      }
    };

    const onUserStatus = (data: any) => {
      if (data.userId && data.userId === otherId) {
        setOtherOnline(!!data.isOnline);
        if (data.lastSeen) setOtherLastSeen(data.lastSeen);
      }
    };

    wsService.on('new_message', onNewMessage);
    wsService.on('message_edited', onMessageEdited);
    wsService.on('message_deleted', onMessageDeleted);
    wsService.on('message_delivered', onMessageDelivered);
    wsService.on('message_reaction', onReaction);
    wsService.on('typing', onTyping);
    wsService.on('messages_read', onMessagesRead);
    wsService.on('user_status', onUserStatus);
    wsService.markRead(conversationId);

    return () => {
      wsService.off('new_message', onNewMessage);
      wsService.off('message_edited', onMessageEdited);
      wsService.off('message_deleted', onMessageDeleted);
      wsService.off('message_delivered', onMessageDelivered);
      wsService.off('message_reaction', onReaction);
      wsService.off('typing', onTyping);
      wsService.off('messages_read', onMessagesRead);
      wsService.off('user_status', onUserStatus);
    };
  }, [conversationId, user?.id, token, otherId]);

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

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages(prev => [...prev, optimisticMsg]);
    setText('');
    wsService.sendTyping(conversationId, false);
    setReplyTo(null);

    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          type: 'text',
          content: trimmed,
          replyTo: replyTo?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? {...data.data.message, _localStatus: undefined}
              : m,
          ),
        );
      } else {
        failedIds.current.add(tempId);
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? {...m, status: 'failed', _localStatus: 'failed'}
              : m,
          ),
        );
      }
    } catch (error) {
      failedIds.current.add(tempId);
      setMessages(prev =>
        prev.map(m =>
          m.id === tempId
            ? {...m, status: 'failed', _localStatus: 'failed'}
            : m,
        ),
      );
    }
  };

  const handleSendMedia = async (
    type: 'image' | 'video' | 'file' | 'voice',
    uri: string,
    name?: string,
    mimeType?: string,
    durationSeconds?: number,
  ) => {
    if (!token) return;
    setShowAttachMenu(false);
    setUploading(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const uploadRes = await fetch(`${Config.API.BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: base64,
          mimeType: mimeType || 'application/octet-stream',
        }),
      });
      const uploadData = await uploadRes.json().catch(() => ({
        success: false,
        error: {message: `Upload failed (${uploadRes.status})`},
      }));

      if (!uploadData.success) {
        Alert.alert(
          'Upload failed',
          uploadData.error?.message || 'Could not upload file',
        );
        setUploading(false);
        return;
      }

      const fileUrl = normalizeMediaUrl(uploadData.data.url);
      const metadata = {
        url: fileUrl,
        fileName: name || 'file',
        mimeType: mimeType || 'application/octet-stream',
        ...(durationSeconds ? {durationSeconds} : {}),
      };

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user?.id || '',
        type,
        content: null,
        metadata: JSON.stringify(metadata),
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages(prev => [...prev, optimisticMsg]);

      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({conversationId, type, content: null, metadata}),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? {...data.data.message, _localStatus: undefined}
              : m,
          ),
        );
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? {...m, status: 'failed', _localStatus: 'failed'}
              : m,
          ),
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send media');
    } finally {
      setUploading(false);
    }
  };

  const handleVoicePress = async () => {
    if (isRecording) {
      const durationSeconds = Math.max(1, Math.round(recorder.currentTime));
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      recordingTimer.current = null;
      setRecordingSeconds(0);
      if (uri) {
        await handleSendMedia(
          'voice',
          uri,
          'voice.m4a',
          'audio/mp4',
          durationSeconds,
        );
      }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Microphone permission is required');
      return;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimer.current = setInterval(() => {
      setRecordingSeconds(seconds => seconds + 1);
    }, 1000);
  };

  const playVoice = async (messageId: string, url: string) => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (voiceSound.current) {
        voiceSound.current.pause();
        voiceSound.current.release();
        voiceSound.current = null;
      }
      if (playingVoiceId === messageId) {
        setPlayingVoiceId(null);
        return;
      }
      const player = createAudioPlayer({uri: url});
      voiceSound.current = player;
      setPlayingVoiceId(messageId);
      player.addListener('playbackStatusUpdate', status => {
        if (status.didJustFinish) {
          setPlayingVoiceId(null);
          player.release();
          if (voiceSound.current === player) {
            voiceSound.current = null;
          }
        }
      });
      player.play();
    } catch {
      Alert.alert('Playback failed', 'Could not play voice message');
    }
  };

  const downloadMedia = async (metadata: any, mediaType?: string) => {
    if (!metadata?.url) return;
    try {
      const safeName = String(metadata.fileName || 'download').replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );
      const target = `${FileSystem.documentDirectory}${Date.now()}-${safeName}`;
      const result = await FileSystem.downloadAsync(metadata.url, target);
      if (
        mediaType === 'image' ||
        mediaType === 'video' ||
        metadata.mimeType?.startsWith('image/') ||
        metadata.mimeType?.startsWith('video/')
      ) {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Permission needed',
            'Allow gallery access to save this media',
          );
          return;
        }
        await MediaLibrary.createAssetAsync(result.uri);
        Alert.alert('Downloaded', 'Media was saved to your gallery');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: metadata.mimeType || 'application/octet-stream',
          dialogTitle: metadata.fileName || 'Download media',
        });
      } else {
        Alert.alert('Downloaded', `Saved as ${safeName}`);
      }
    } catch (error: any) {
      console.error('Download media error:', error);
      Alert.alert(
        'Download failed',
        error?.message || 'Could not download this file',
      );
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia(
        'image',
        asset.uri,
        asset.fileName || 'photo.jpg',
        asset.mimeType || 'image/jpeg',
      );
    }
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Camera permission is required to take photos',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({quality: 0.7});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia(
        'image',
        asset.uri,
        asset.fileName || 'photo.jpg',
        asset.mimeType || 'image/jpeg',
      );
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos',
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia(
        'video',
        asset.uri,
        asset.fileName || 'video.mp4',
        'video/mp4',
      );
    }
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({type: '*/*'});
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      handleSendMedia(
        'file',
        asset.uri,
        asset.name,
        asset.mimeType || 'application/octet-stream',
      );
    }
  };

  const handleRetry = async (msg: Message) => {
    if (!token) return;
    failedIds.current.delete(msg.id);
    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? {...m, _localStatus: 'sending', status: 'sending'}
          : m,
      ),
    );

    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          type: 'text',
          content: msg.content,
          replyTo: msg.reply_to,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev =>
          prev.map(m =>
            m.id === msg.id
              ? {...data.data.message, _localStatus: undefined}
              : m,
          ),
        );
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === msg.id
              ? {...m, status: 'failed', _localStatus: 'failed'}
              : m,
          ),
        );
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? {...m, status: 'failed', _localStatus: 'failed'}
            : m,
        ),
      );
    }
  };

  const handleDelete = (msg: Message) => {
    if (msg.sender_id !== user?.id) return;
    Alert.alert('Delete Message', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${Config.API.BASE_URL}/api/messages/${msg.id}`, {
              method: 'DELETE',
              headers: {Authorization: `Bearer ${token}`},
            });
          } catch {}
        },
      },
    ]);
  };

  const handleCopy = async (msg: Message) => {
    if (!msg.content) return;
    try {
      await Clipboard.setStringAsync(msg.content);
      Alert.alert('Copied', 'Message copied to clipboard');
    } catch {
      // Fallback: selectable text sheet so the user can copy manually.
      setCopyModal({visible: true, text: msg.content});
    }
  };

  const openForwardPicker = async (msg: Message) => {
    setForwardPicker({visible: true, message: msg});
    setForwardLoading(true);
    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/conversations`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await res.json();
      if (data.success) {
        setForwardList(
          (data.data.conversations || []).filter(
            (c: any) => c.id !== conversationId,
          ),
        );
      }
    } catch {
    } finally {
      setForwardLoading(false);
    }
  };

  const forwardTo = async (conv: any) => {
    const msg = forwardPicker.message;
    if (!msg || !token) return;
    setForwardLoading(true);
    try {
      let metadata = null;
      try {
        metadata = msg.metadata ? JSON.parse(msg.metadata) : null;
      } catch {}
      const res = await fetch(`${Config.API.BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          type: msg.type,
          content: msg.type === 'text' ? msg.content : null,
          metadata,
        }),
      });
      const data = await res.json();
      setForwardPicker({visible: false, message: null});
      if (data.success) {
        Alert.alert('Forwarded', `Message sent to ${conv.displayName || conv.name || 'chat'}`);
      } else {
        Alert.alert('Error', 'Could not forward message');
      }
    } catch {
      Alert.alert('Error', 'Could not forward message');
    } finally {
      setForwardLoading(false);
    }
  };

  const handleShare = async (msg: Message) => {
    try {
      await Share.share({message: msg.content || ''});
    } catch {}
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!token) return;
    setActionMenu({visible: false, message: null});
    // Optimistic local toggle so the chip appears instantly.
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== messageId) return m;
        const existing = (m.reactions || []).find(
          r => r.user_id === user?.id && r.emoji === emoji,
        );
        const reactions = existing
          ? (m.reactions || []).filter(
              r => !(r.user_id === user?.id && r.emoji === emoji),
            )
          : [...(m.reactions || []), {user_id: user?.id || '', emoji}];
        return {...m, reactions};
      }),
    );
    try {
      const res = await fetch(
        `${Config.API.BASE_URL}/api/messages/${messageId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({emoji}),
        },
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data.reactions)) {
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? {...m, reactions: data.data.reactions} : m,
          ),
        );
      }
    } catch {}
  };

  const handleTyping = (value: string) => {
    setText(value);
    if (value.length > 0) {
      wsService.sendTyping(conversationId, true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(
        () => wsService.sendTyping(conversationId, false),
        1500,
      );
    } else {
      wsService.sendTyping(conversationId, false);
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

  const toggleSearch = () => {
    const next = !searchMode;
    setSearchMode(next);
    if (next) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  };

  const visibleMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searchMode || !q) return messages;
    return messages.filter(
      m => m.type === 'text' && (m.content || '').toLowerCase().includes(q),
    );
  }, [messages, searchMode, searchQuery]);

  const renderHighlighted = (content: string, baseStyle: any) => {
    const q = searchQuery.trim();
    if (!searchMode || !q) {
      return <Text style={baseStyle}>{content}</Text>;
    }
    const lower = content.toLowerCase();
    const needle = q.toLowerCase();
    const parts: React.ReactNode[] = [];
    let idx = 0;
    let key = 0;
    while (idx < content.length) {
      const found = lower.indexOf(needle, idx);
      if (found === -1) {
        parts.push(<Text key={key++}>{content.slice(idx)}</Text>);
        break;
      }
      if (found > idx) {
        parts.push(<Text key={key++}>{content.slice(idx, found)}</Text>);
      }
      parts.push(
        <Text key={key++} style={styles.highlight}>
          {content.slice(found, found + needle.length)}
        </Text>,
      );
      idx = found + needle.length;
    }
    return <Text style={baseStyle}>{parts}</Text>;
  };

  const renderMessage = ({item, index}: {item: Message; index: number}) => {
    const isMe = item.sender_id === user?.id;
    const isDeleted = item.is_deleted === 1;
    const isFailed = item._localStatus === 'failed';

    let metadataParsed: any = null;
    try {
      if (item.metadata) metadataParsed = JSON.parse(item.metadata);
    } catch {}

    const mediaUrl = metadataParsed?.url
      ? normalizeMediaUrl(metadataParsed.url)
      : '';
    const replyContent = item.reply_to
      ? messages.find(m => m.id === item.reply_to)?.content
      : null;

    const prev = visibleMessages[index - 1];
    const showDate = !prev || dayKey(prev.created_at) !== dayKey(item.created_at);
    const reactions = groupReactions(item.reactions);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorPill}>
              <Text style={styles.dateSeparatorText}>
                {dayLabel(item.created_at)}
              </Text>
            </View>
          </View>
        )}
        <View
          style={[
            styles.bubbleRow,
            isMe ? styles.bubbleRowSent : styles.bubbleRowReceived,
          ]}>
          {!isMe &&
            (item.sender_avatar ? (
              <Image
                source={{uri: item.sender_avatar}}
                style={styles.messageAvatar}
              />
            ) : (
              <View style={styles.messageAvatarPlaceholder} />
            ))}
          <View style={{maxWidth: '82%'}}>
            {!isMe && (
              <Text style={styles.senderName}>
                {item.sender_name || item.sender_username}
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.bubble,
                isMe ? styles.bubbleSent : styles.bubbleReceived,
                isFailed && {opacity: 0.6},
              ]}
              onLongPress={() => openActionMenu(item)}
              onPress={() => isFailed && handleRetry(item)}>
              {item.reply_to && replyContent && (
                <View
                  style={
                    isMe ? styles.replyPreviewSent : styles.replyPreviewReceived
                  }>
                  <Text
                    style={isMe ? styles.replyTextSent : styles.replyTextReceived}
                    numberOfLines={1}>
                    {replyContent}
                  </Text>
                </View>
              )}

              {item.type === 'image' && metadataParsed?.url ? (
                <TouchableOpacity
                  onPress={() =>
                    setOpenImageUri(cachedMedia[item.id] || mediaUrl)
                  }>
                  <Image
                    source={{uri: cachedMedia[item.id] || mediaUrl}}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                  <Ionicons
                    name="download"
                    size={20}
                    color="#fff"
                    style={styles.mediaDownloadIcon}
                    onPress={() =>
                      downloadMedia({...metadataParsed, url: mediaUrl}, item.type)
                    }
                  />
                </TouchableOpacity>
              ) : item.type === 'video' && metadataParsed?.url ? (
                <TouchableOpacity
                  style={styles.videoContainer}
                  onPress={() =>
                    downloadMedia({...metadataParsed, url: mediaUrl}, item.type)
                  }>
                  <Image
                    source={{uri: cachedMedia[item.id] || mediaUrl}}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                  <View style={styles.videoOverlay}>
                    <Ionicons name="play-circle" size={48} color="#fff" />
                  </View>
                  <Ionicons
                    name="download"
                    size={20}
                    color="#fff"
                    style={styles.mediaDownloadIcon}
                  />
                </TouchableOpacity>
              ) : item.type === 'file' && metadataParsed ? (
                <TouchableOpacity
                  style={styles.fileContainer}
                  onPress={() =>
                    downloadMedia({...metadataParsed, url: mediaUrl}, item.type)
                  }>
                  <Ionicons
                    name="document-outline"
                    size={32}
                    color={isMe ? '#fff' : Colors.primary}
                  />
                  <Text
                    style={[styles.fileName, isMe && {color: '#fff'}]}
                    numberOfLines={1}>
                    {metadataParsed.fileName || 'File'}
                  </Text>
                  <Ionicons
                    name="download-outline"
                    size={22}
                    color={isMe ? '#fff' : Colors.primary}
                  />
                </TouchableOpacity>
              ) : item.type === 'voice' && metadataParsed?.url ? (
                <TouchableOpacity
                  style={styles.fileContainer}
                  onPress={() => playVoice(item.id, mediaUrl)}>
                  <Ionicons
                    name={
                      playingVoiceId === item.id ? 'pause-circle' : 'play-circle'
                    }
                    size={28}
                    color={isMe ? '#fff' : Colors.primary}
                  />
                  <Text style={[styles.fileName, isMe && {color: '#fff'}]}>
                    Voice message{' '}
                    {metadataParsed.durationSeconds
                      ? `· ${Math.floor(metadataParsed.durationSeconds / 60)}:${String(metadataParsed.durationSeconds % 60).padStart(2, '0')}`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ) : (
                renderHighlighted(
                  isDeleted ? 'Message deleted' : item.content || '',
                  [
                    isMe ? styles.bubbleTextSent : styles.bubbleTextReceived,
                    isDeleted && {fontStyle: 'italic', opacity: 0.6},
                  ],
                )
              )}

              <View style={styles.bubbleFooter}>
                {item.is_edited === 1 && (
                  <Text
                    style={[
                      styles.editedBadge,
                      !isMe && {color: Colors.textTertiary},
                    ]}>
                    edited
                  </Text>
                )}
                <Text
                  style={[
                    styles.bubbleTime,
                    isMe ? styles.timeSent : styles.timeReceived,
                  ]}>
                  {formatTime(item.created_at)}
                </Text>
                {isMe && (
                  <Ionicons
                    name={
                      isFailed
                        ? 'alert-circle'
                        : item.status === 'read'
                          ? 'checkmark-done'
                          : 'checkmark'
                    }
                    size={14}
                    color={
                      isFailed
                        ? '#FCA5A5'
                        : item.status === 'read'
                          ? '#BBF7D0'
                          : 'rgba(255,255,255,0.6)'
                    }
                  />
                )}
              </View>
            </TouchableOpacity>

            {reactions.length > 0 && (
              <View
                style={[
                  styles.reactionsRow,
                  isMe ? styles.reactionsRowSent : styles.reactionsRowReceived,
                ]}>
                {reactions.map(([emoji, count]) => {
                  const mine = (item.reactions || []).some(
                    r => r.user_id === user?.id && r.emoji === emoji,
                  );
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.reactionChip, mine && styles.reactionChipMine]}
                      onPress={() => handleReact(item.id, emoji)}>
                      <Text style={styles.reactionEmojiSmall}>{emoji}</Text>
                      {count > 1 && (
                        <Text style={styles.reactionCount}>{count}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const typingUsers = Object.entries(typing)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  const headerStatus = () => {
    if (typingUsers.length > 0) return {text: 'typing...', color: Colors.primary};
    if (otherOnline) return {text: 'Online', color: Colors.online};
    if (otherLastSeen)
      return {
        text: `Last seen ${formatRelativeTime(otherLastSeen)}`,
        color: Colors.textSecondary,
      };
    return {text: 'Offline', color: Colors.textSecondary};
  };
  const status = headerStatus();

  const onScroll = (e: any) => {
    const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distanceFromBottom > 200);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            {participantAvatar ? (
              <Image
                source={{uri: participantAvatar}}
                style={styles.headerAvatarImage}
              />
            ) : (
              <Text style={styles.headerAvatarText}>
                {participantName?.[0] || '?'}
              </Text>
            )}
            {otherOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.headerName} numberOfLines={1}>
              {participantName}
            </Text>
            <Text style={[styles.headerStatus, {color: status.color}]}>
              {status.text}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={toggleSearch}>
          <Ionicons
            name={searchMode ? 'close' : 'search'}
            size={22}
            color={searchMode ? Colors.primary : Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {searchMode && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search in conversation"
            placeholderTextColor={Colors.textTertiary}
          />
          {searchQuery.trim().length > 0 && (
            <Text style={styles.searchCount}>
              {visibleMessages.length}
            </Text>
          )}
        </View>
      )}

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarLabel}>
              Replying to {replyTo.sender_name}
            </Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyTo.content}
            </Text>
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
        <View style={{flex: 1}}>
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              if (!searchMode)
                flatListRef.current?.scrollToEnd({animated: false});
            }}
            onScroll={onScroll}
            scrollEventThrottle={80}
            onScrollBeginDrag={() => wsService.markRead(conversationId)}
            ListHeaderComponent={
              hasMore && !searchMode ? (
                <TouchableOpacity style={styles.loadMore} onPress={loadEarlier}>
                  <Text style={styles.loadMoreText}>Load earlier messages</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons
                  name={searchMode ? 'search-outline' : 'chatbubbles-outline'}
                  size={48}
                  color={Colors.textTertiary}
                />
                <Text style={styles.emptyText}>
                  {searchMode ? 'No matches found' : 'No messages yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchMode
                    ? 'Try a different keyword'
                    : 'Send a message to start the conversation'}
                </Text>
              </View>
            }
          />
          {showScrollBtn && !searchMode && (
            <TouchableOpacity
              style={styles.scrollBtn}
              onPress={() => flatListRef.current?.scrollToEnd({animated: true})}>
              <Ionicons name="chevron-down" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      {showAttachMenu && (
        <View style={styles.attachMenu}>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={handlePickImage}>
            <View style={[styles.attachIcon, {backgroundColor: '#EEF2FF'}]}>
              <Ionicons name="image" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.attachLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={handleTakePhoto}>
            <View style={[styles.attachIcon, {backgroundColor: '#FEF3C7'}]}>
              <Ionicons name="camera" size={22} color="#F59E0B" />
            </View>
            <Text style={styles.attachLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={handlePickVideo}>
            <View style={[styles.attachIcon, {backgroundColor: '#DCFCE7'}]}>
              <Ionicons name="videocam" size={22} color="#22C55E" />
            </View>
            <Text style={styles.attachLabel}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={handlePickDocument}>
            <View style={[styles.attachIcon, {backgroundColor: '#FEE2E2'}]}>
              <Ionicons name="document" size={22} color="#EF4444" />
            </View>
            <Text style={styles.attachLabel}>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity
          style={styles.inputBtn}
          onPress={() => setShowAttachMenu(!showAttachMenu)}>
          <Ionicons
            name={showAttachMenu ? 'close-circle' : 'add-circle'}
            size={28}
            color={Colors.primary}
          />
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
          <TouchableOpacity style={styles.voiceBtn} onPress={handleVoicePress}>
            <Ionicons
              name={isRecording ? 'stop-circle' : 'mic'}
              size={24}
              color={isRecording ? '#EF4444' : Colors.primary}
            />
            {isRecording && (
              <Text style={styles.recordingTimer}>{recordingSeconds}s</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Message action sheet */}
      <Modal
        visible={actionMenu.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenu({visible: false, message: null})}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionMenu({visible: false, message: null})}>
          <View style={styles.actionSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Message Actions</Text>

            {actionMenu.message && !actionMenu.message.is_deleted && (
              <View style={styles.reactionRow}>
                {REACTION_EMOJIS.map(emoji => {
                  const active = (actionMenu.message?.reactions || []).some(
                    r => r.user_id === user?.id && r.emoji === emoji,
                  );
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.reactionBtn, active && styles.reactionBtnActive]}
                      onPress={() =>
                        handleReact(actionMenu.message!.id, emoji)
                      }>
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (actionMenu.message) {
                  setReplyTo(actionMenu.message);
                  setActionMenu({visible: false, message: null});
                }
              }}>
              <Ionicons
                name="arrow-undo"
                size={22}
                color={Colors.textPrimary}
              />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                if (actionMenu.message) {
                  openForwardPicker(actionMenu.message);
                  setActionMenu({visible: false, message: null});
                }
              }}>
              <Ionicons
                name="arrow-redo"
                size={22}
                color={Colors.textPrimary}
              />
              <Text style={styles.actionText}>Forward</Text>
            </TouchableOpacity>

            {actionMenu.message?.content && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  if (actionMenu.message) {
                    handleCopy(actionMenu.message);
                    setActionMenu({visible: false, message: null});
                  }
                }}>
                <Ionicons name="copy" size={22} color={Colors.textPrimary} />
                <Text style={styles.actionText}>Copy</Text>
              </TouchableOpacity>
            )}

            {actionMenu.message?.content && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  if (actionMenu.message) {
                    handleShare(actionMenu.message);
                    setActionMenu({visible: false, message: null});
                  }
                }}>
                <Ionicons
                  name="share-social"
                  size={22}
                  color={Colors.textPrimary}
                />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            )}

            {actionMenu.message?.sender_id === user?.id && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  if (actionMenu.message) {
                    handleDelete(actionMenu.message);
                    setActionMenu({visible: false, message: null});
                  }
                }}>
                <Ionicons name="trash" size={22} color="#EF4444" />
                <Text style={[styles.actionText, {color: '#EF4444'}]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setActionMenu({visible: false, message: null})}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
              <Text style={[styles.actionText, {color: Colors.textSecondary}]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward conversation picker */}
      <Modal
        visible={forwardPicker.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardPicker({visible: false, message: null})}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setForwardPicker({visible: false, message: null})}>
          <View style={styles.forwardSheet}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Forward to</Text>
            {forwardLoading ? (
              <View style={{padding: 30, alignItems: 'center'}}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : forwardList.length === 0 ? (
              <Text style={styles.emptySub}>No other conversations</Text>
            ) : (
              <FlatList
                data={forwardList}
                keyExtractor={c => c.id}
                style={{maxHeight: 380}}
                renderItem={({item}) => {
                  const name =
                    item.displayName || item.name || 'Conversation';
                  return (
                    <TouchableOpacity
                      style={styles.forwardItem}
                      onPress={() => forwardTo(item)}>
                      <View style={styles.forwardAvatar}>
                        {item.displayAvatar ? (
                          <Image
                            source={{uri: item.displayAvatar}}
                            style={styles.forwardAvatarImg}
                          />
                        ) : (
                          <Text style={styles.forwardAvatarText}>
                            {name[0]}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.forwardName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Ionicons
                        name="send"
                        size={18}
                        color={Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Copy helper sheet (dependency-free) */}
      <Modal
        visible={copyModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setCopyModal({visible: false, text: ''})}>
        <TouchableOpacity
          style={styles.centerOverlay}
          activeOpacity={1}
          onPress={() => setCopyModal({visible: false, text: ''})}>
          <View style={styles.copyCard}>
            <Text style={styles.copyTitle}>Copy message</Text>
            <Text style={styles.copyHint}>
              Tap and hold the text below, then choose Copy.
            </Text>
            <Text selectable style={styles.copyText}>
              {copyModal.text}
            </Text>
            <TouchableOpacity
              style={styles.copyClose}
              onPress={() => setCopyModal({visible: false, text: ''})}>
              <Text style={styles.copyCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen image viewer */}
      <Modal
        visible={!!openImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenImageUri(null)}>
        <View style={styles.imageViewer}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setOpenImageUri(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {openImageUri ? (
            <Image
              source={{uri: openImageUri}}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
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
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    headerAvatarText: {color: '#fff', fontSize: 16, fontWeight: '600'},
    headerAvatarImage: {width: 40, height: 40, borderRadius: 20},
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: Colors.online,
      borderWidth: 2,
      borderColor: Colors.surface,
    },
    headerName: {fontSize: 16, fontWeight: '600', color: Colors.textPrimary},
    headerStatus: {fontSize: 12, color: Colors.textSecondary},
    headerBtn: {padding: 8},
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.surface,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: Colors.textPrimary,
      paddingVertical: 4,
    },
    searchCount: {
      fontSize: 12,
      color: Colors.primary,
      fontWeight: '600',
      minWidth: 20,
      textAlign: 'right',
    },
    highlight: {backgroundColor: '#FDE68A', color: '#7C2D12'},
    messagesList: {paddingHorizontal: Spacing.sm, paddingBottom: 12, paddingTop: 8},
    dateSeparator: {alignItems: 'center', marginVertical: 12},
    dateSeparatorPill: {
      backgroundColor: Colors.surfaceSecondary,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    dateSeparatorText: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: '600',
    },
    bubbleRow: {flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6},
    bubbleRowSent: {justifyContent: 'flex-end'},
    bubbleRowReceived: {justifyContent: 'flex-start'},
    messageAvatar: {width: 26, height: 26, borderRadius: 13, marginRight: 6},
    messageAvatarPlaceholder: {width: 26, marginRight: 6},
    senderName: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.primary,
      marginBottom: 2,
      marginLeft: 4,
    },
    bubble: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 18,
      ...Shadows.sm,
    },
    bubbleSent: {
      backgroundColor: Colors.bubbleSent,
      borderBottomRightRadius: 6,
    },
    bubbleReceived: {
      backgroundColor: Colors.bubbleReceived,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    bubbleTextSent: {color: '#fff', fontSize: 15, lineHeight: 20},
    bubbleTextReceived: {
      color: Colors.textPrimary,
      fontSize: 15,
      lineHeight: 20,
    },
    bubbleFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 3,
      gap: 4,
    },
    bubbleTime: {fontSize: 10},
    timeSent: {color: 'rgba(255,255,255,0.65)'},
    timeReceived: {color: Colors.textTertiary},
    editedBadge: {
      fontSize: 9,
      color: 'rgba(255,255,255,0.5)',
      fontStyle: 'italic',
    },
    reactionsRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4},
    reactionsRowSent: {justifyContent: 'flex-end'},
    reactionsRowReceived: {justifyContent: 'flex-start'},
    reactionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    reactionChipMine: {borderColor: Colors.primary, backgroundColor: Colors.primarySurface},
    reactionEmojiSmall: {fontSize: 13},
    reactionCount: {fontSize: 11, color: Colors.textSecondary, fontWeight: '600'},
    replyPreviewSent: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      padding: 6,
      borderRadius: 6,
      marginBottom: 6,
      borderLeftWidth: 3,
      borderLeftColor: '#fff',
    },
    replyTextSent: {fontSize: 12, color: 'rgba(255,255,255,0.85)'},
    replyPreviewReceived: {
      backgroundColor: Colors.surfaceSecondary,
      padding: 6,
      borderRadius: 6,
      marginBottom: 6,
      borderLeftWidth: 3,
      borderLeftColor: Colors.primary,
    },
    replyTextReceived: {fontSize: 12, color: Colors.textSecondary},
    emptyChat: {
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 100,
    },
    emptyText: {fontSize: 16, color: Colors.textSecondary, marginTop: 12},
    emptySub: {
      fontSize: 13,
      color: Colors.textTertiary,
      marginTop: 4,
      textAlign: 'center',
    },
    loadMore: {alignItems: 'center', padding: 10},
    loadMoreText: {color: Colors.primary, fontSize: 13},
    scrollBtn: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.border,
      ...Shadows.md,
    },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surfaceSecondary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderLeftWidth: 3,
      borderLeftColor: Colors.primary,
    },
    replyBarContent: {flex: 1},
    replyBarLabel: {fontSize: 11, fontWeight: '600', color: Colors.primary},
    replyBarText: {fontSize: 12, color: Colors.textSecondary, marginTop: 2},
    loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
    inputArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      backgroundColor: Colors.surface,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
      paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.sm,
    },
    inputBtn: {padding: 6, marginBottom: 4},
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      minHeight: 40,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: Colors.textPrimary,
      paddingVertical: 8,
      maxHeight: 100,
      textAlignVertical: 'center',
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: Spacing.sm,
    },
    voiceBtn: {padding: 6, marginLeft: Spacing.sm, marginBottom: 4},
    recordingTimer: {fontSize: 10, color: '#EF4444', marginTop: -2},
    attachMenu: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.base,
      backgroundColor: Colors.surface,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
    },
    attachOption: {alignItems: 'center', gap: 4},
    attachIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachLabel: {fontSize: 11, color: Colors.textSecondary},
    messageImage: {
      width: 240,
      height: 180,
      borderRadius: BorderRadius.md,
      marginBottom: 4,
    },
    videoContainer: {
      position: 'relative',
      width: 240,
      height: 180,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
    },
    videoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mediaDownloadIcon: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      padding: 4,
    },
    fileContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: BorderRadius.md,
      backgroundColor: 'rgba(255,255,255,0.12)',
      minWidth: 220,
      minHeight: 60,
    },
    fileName: {
      fontSize: 13,
      color: Colors.textPrimary,
      flex: 1,
      fontWeight: '600',
    },
    uploadOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
    uploadText: {color: '#fff', marginTop: 8, fontSize: 14},
    imageViewer: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenImage: {width: '100%', height: '85%'},
    imageViewerClose: {
      position: 'absolute',
      top: 48,
      right: 20,
      zIndex: 2,
      padding: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    centerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    actionSheet: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      paddingTop: 12,
    },
    forwardSheet: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      paddingTop: 12,
    },
    forwardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    forwardAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    forwardAvatarImg: {width: 42, height: 42, borderRadius: 21},
    forwardAvatarText: {color: '#fff', fontSize: 16, fontWeight: '700'},
    forwardName: {flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '500'},
    actionSheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    actionSheetTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 12,
      textAlign: 'center',
    },
    reactionRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    reactionBtn: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: Colors.surfaceSecondary,
    },
    reactionBtnActive: {backgroundColor: Colors.primarySurface},
    reactionEmoji: {fontSize: 24},
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    actionText: {fontSize: 15, color: Colors.textPrimary},
    copyCard: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    copyTitle: {fontSize: 16, fontWeight: '700', color: Colors.textPrimary},
    copyHint: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 4,
      marginBottom: 12,
    },
    copyText: {
      fontSize: 15,
      color: Colors.textPrimary,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: 10,
      padding: 12,
      lineHeight: 22,
    },
    copyClose: {
      marginTop: 16,
      alignSelf: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.primarySurface,
    },
    copyCloseText: {color: Colors.primary, fontWeight: '600', fontSize: 14},
  });
}
