import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Image,
  Animated,
  Modal,
} from 'react-native';
import {useAuthStore} from '../../store/authStore';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {wsService} from '../../core/services/WebSocketService';
import {formatRelativeTime} from '../../core/utils/formatters';
import {ProfileScreen} from '../profile/screens/ProfileScreen';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
} from '../../core/theme';
import {Ionicons} from '@expo/vector-icons';
import {apiClient} from '../../core/services/apiClient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {useTheme} from '../../shell/providers/ThemeProvider';
import {ThemeToggle} from '../../components/ThemeToggle';

function ChatsScreen({navigation}: any) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [typingConversations, setTypingConversations] = useState<
    Record<string, boolean>
  >({});
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore(s => s.user);
  const {isDark} = useTheme();
  const styles = React.useMemo(() => createStyles(), [isDark]);
  const insets = useSafeAreaInsets();
  const openSavedMessages = async () => {
    try {
      const data = await apiClient.post('/api/conversations/saved');
      if (data.success)
        navigation.navigate('Chat', {
          conversationId: data.data.conversationId,
          participantName: 'Saved Messages',
        });
    } catch (error) {
      Alert.alert('Error', 'Failed to open saved messages');
    }
  };

  const load = useCallback(async (silent = false) => {
    try {
      const data = await apiClient.get('/api/conversations');
      setConversations(data.data?.conversations || []);
    } catch (e) {
      if (!silent) Alert.alert('Error', 'Failed to load conversations');
      console.error('Load conversations error:', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const onConversationUpdated = (data: any) => {
      if (!data.conversation) return;
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        const convData = data.conversation;
        if (idx === -1) {
          load(true);
          return prev;
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          last_message: convData.last_message,
          last_message_sender: convData.last_message_sender,
          last_message_at: convData.last_message_at,
        };
        const moved = updated.splice(idx, 1)[0];
        updated.unshift(moved);
        return updated;
      });
    };

    const onNewMessage = (data: any) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        if (idx === -1) {
          load(true);
          return prev;
        }
        const updated = [...prev];
        const conv = {...updated[idx]};
        conv.last_message = data.message?.content || conv.last_message;
        conv.last_message_sender =
          data.message?.sender_id || conv.last_message_sender;
        conv.last_message_at = data.message?.created_at || conv.last_message_at;
        if (data.message?.sender_id && data.message.sender_id !== user?.id) {
          conv.unread_count = (conv.unread_count || 0) + 1;
        }
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
    };

    const onTyping = (data: any) => {
      if (!data.conversationId || data.userId === user?.id) return;
      setTypingConversations(prev => ({
        ...prev,
        [data.conversationId]: data.isTyping,
      }));
      if (data.isTyping) {
        setTimeout(
          () =>
            setTypingConversations(prev => ({
              ...prev,
              [data.conversationId]: false,
            })),
          3000,
        );
      }
    };

    const onMessagesRead = (data: any) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {...updated[idx], unread_count: 0};
        return updated;
      });
    };

    wsService.on('conversation:updated', onConversationUpdated);
    wsService.on('new_message', onNewMessage);
    wsService.on('messages_read', onMessagesRead);
    wsService.on('typing', onTyping);
    return () => {
      wsService.off('conversation:updated', onConversationUpdated);
      wsService.off('new_message', onNewMessage);
      wsService.off('messages_read', onMessagesRead);
      wsService.off('typing', onTyping);
    };
  }, [user?.id, load]);

  const openChat = (conv: any) => {
    const participant = conv.participants?.find((p: any) => p.id !== user?.id);
    navigation.navigate('Chat', {
      conversationId: conv.id,
      participantName:
        conv.displayName || conv.name || participant?.display_name || 'Chat',
      participantAvatar: conv.displayAvatar || participant?.avatar_url,
      participantId: participant?.id,
      participantOnline: !!participant?.is_online,
    });
  };

  const deleteChat = (conv: any) => {
    Alert.alert('Delete chat', 'Remove this conversation from your chats?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/conversations/${conv.id}`);
            setConversations(prev => prev.filter(item => item.id !== conv.id));
          } catch {
            Alert.alert('Error', 'Could not delete chat');
          }
        },
      },
    ]);
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return formatRelativeTime(timestamp);
  };

  return (
    <View style={[styles.container, {backgroundColor: Colors.background}]}>
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="menu" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('GlobalSearch')}>
              <Ionicons name="search" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('QuickAdd')}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={openSavedMessages}>
              <Ionicons
                name="bookmark-outline"
                size={22}
                color={Colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.storiesContainer}>
        <View style={styles.storyItem}>
          <View style={styles.storyAvatar}>
            {user?.avatarUrl ? (
              <Image
                source={{uri: user.avatarUrl}}
                style={styles.storyAvatarImage}
              />
            ) : (
              <Text style={styles.storyAvatarText}>
                {user?.displayName?.[0] || '?'}
              </Text>
            )}
            <View style={styles.storyAddIcon}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.storyName} numberOfLines={1}>
            Your Story
          </Text>
        </View>
      </ScrollView>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="chatbubbles-outline"
              size={40}
              color={Colors.primary}
            />
          </View>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Start a chat from Nearby tab</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => openChat(item)}
              onLongPress={() => deleteChat(item)}
              activeOpacity={0.7}>
              <View style={styles.chatAvatarContainer}>
                <View style={styles.chatAvatar}>
                  {item.displayAvatar ||
                  item.participantAvatar ||
                  item.participants?.find((p: any) => p.id !== user?.id)
                    ?.avatar_url ? (
                    <Image
                      source={{
                        uri:
                          item.displayAvatar ||
                          item.participantAvatar ||
                          item.participants?.find((p: any) => p.id !== user?.id)
                            ?.avatar_url,
                      }}
                      style={styles.chatAvatarImage}
                    />
                  ) : (
                    <Text style={styles.chatAvatarText}>
                      {item.displayName?.[0] || '?'}
                    </Text>
                  )}
                </View>
                {item.is_online === 1 && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatTopRow}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {item.displayName || 'Unknown'}
                  </Text>
                  <Text style={styles.chatTime}>
                    {formatTime(item.last_message_at)}
                  </Text>
                </View>
                <View style={styles.chatBottomRow}>
                  <Text style={styles.chatLastMessage} numberOfLines={1}>
                    {typingConversations[item.id]
                      ? 'Typing...'
                      : item.last_message || 'No messages yet'}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>
                        {item.unread_count > 99 ? '99+' : item.unread_count}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        />
      )}
    </View>
  );
}

function NearbyScreen({navigation}: any) {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<{received: any[]; sent: any[]}>({
    received: [],
    sent: [],
  });
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createS(), [isDark]);
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(false);
  const [nearbyResults, setNearbyResults] = useState<any[]>([]);
  const user = useAuthStore(s => s.user);

  const load = useCallback(async () => {
    try {
      const [fData, rData] = await Promise.all([
        apiClient.get('/api/friends'),
        apiClient.get('/api/friends/requests'),
      ]);
      setFriends(fData.data?.friends || []);
      setRequests(rData.data || {received: [], sent: []});
    } catch (e) {
      Alert.alert('Error', 'Failed to load friends');
      console.error('Load friends error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleFriendUpdate = (event: any) => {
      const type = event?.notification?.type;
      if (type === 'friend_request' || type === 'friend_accepted') load();
    };
    wsService.on('notification', handleFriendUpdate);
    return () => wsService.off('notification', handleFriendUpdate);
  }, [load]);

  const acceptRequest = async (requestId: string) => {
    try {
      await apiClient.post(`/api/friends/accept/${requestId}`);
      load();
    } catch (e) {
      Alert.alert('Error', 'Failed to accept request');
      console.error('Accept request error:', e);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await apiClient.post(`/api/friends/reject/${requestId}`);
      load();
    } catch (e) {
      Alert.alert('Error', 'Failed to reject request');
      console.error('Reject request error:', e);
    }
  };

  const startChat = async (friend: any) => {
    try {
      const data = await apiClient.post('/api/conversations', {
        type: 'direct',
        participantIds: [friend.id],
      });
      if (data.success) {
        navigation.navigate('ChatsTab', {
          screen: 'Chat',
          params: {
            conversationId: data.data.conversationId,
            participantName: friend.display_name,
            participantAvatar: friend.avatar_url,
            participantId: friend.id,
            participantOnline: !!friend.is_online,
          },
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to start chat');
      console.error('Start chat error:', e);
    }
  };

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const data = await apiClient.post('/api/nearby/scan');
      if (data.success) {
        setNearbyResults(data.data?.users || []);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to scan nearby users');
      console.error('Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  const addFriend = async (target: any) => {
    try {
      await apiClient.post('/api/friends/request', {userId: target.id});
    } catch (e) {
      Alert.alert('Error', 'Failed to send friend request');
      console.error('Add friend error:', e);
    }
  };

  const messageUser = async (target: any) => {
    try {
      const data = await apiClient.post('/api/conversations', {
        type: 'direct',
        participantIds: [target.id],
      });
      if (data.success) {
        navigation.navigate('ChatsTab', {
          screen: 'Chat',
          params: {
            conversationId: data.data.conversationId,
            participantName: target.display_name,
            participantAvatar: target.avatar_url,
            participantId: target.id,
            participantOnline: !!target.is_online,
          },
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to start conversation');
      console.error('Message user error:', e);
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.nearbyHeader, {paddingTop: insets.top + 12}]}>
        <Text style={s.nearbyHeaderTitle}>Nearby</Text>
      </View>

      <View style={s.scanContainer}>
        <View style={s.scanIconContainer}>
          <Ionicons name="locate" size={48} color={Colors.primary} />
        </View>
        <Text style={s.scanTitle}>Find People Nearby</Text>
        <Text style={s.scanSubtitle}>Discover Goftegoo users around you</Text>
        <TouchableOpacity
          style={[s.scanButton, scanning && s.scanButtonActive]}
          onPress={startScan}
          disabled={scanning}>
          <Ionicons
            name={scanning ? 'radio' : 'locate'}
            size={20}
            color="#fff"
          />
          <Text style={s.scanButtonText}>
            {scanning ? 'Scanning...' : 'Start Nearby Scan'}
          </Text>
        </TouchableOpacity>
        <Text style={s.scanNote}>
          Scanning only happens when you tap the button
        </Text>
      </View>

      {nearbyResults.length > 0 && (
        <View>
          {nearbyResults.map((user: any) => (
            <View key={user.id} style={s.nearbyItem}>
              <View style={s.nearbyAvatar}>
                <Text style={s.nearbyAvatarText}>
                  {user.display_name?.[0] || '?'}
                </Text>
              </View>
              <View style={s.nearbyInfo}>
                <Text style={s.nearbyName}>{user.display_name}</Text>
                <Text style={s.nearbyUsername}>@{user.username}</Text>
              </View>
              <TouchableOpacity
                style={s.nearbyAddBtn}
                onPress={() => addFriend(user)}>
                <Ionicons name="person-add" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.nearbyMsgBtn}
                onPress={() => messageUser(user)}>
                <Ionicons name="chatbubble" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'friends' && s.tabBtnActive]}
          onPress={() => setTab('friends')}>
          <Text style={[s.tabText, tab === 'friends' && s.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'requests' && s.tabBtnActive]}
          onPress={() => setTab('requests')}>
          <Text style={[s.tabText, tab === 'requests' && s.tabTextActive]}>
            Requests ({requests.received?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : tab === 'friends' ? (
        friends.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconContainer}>
              <Ionicons
                name="people-outline"
                size={40}
                color={Colors.primary}
              />
            </View>
            <Text style={s.emptyTitle}>No friends yet</Text>
            <Text style={s.emptySubtitle}>Search users to add friends</Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <TouchableOpacity
                style={s.chatItem}
                onPress={() => startChat(item)}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {(item.display_name || '?')[0]}
                  </Text>
                </View>
                <View style={s.chatInfo}>
                  <Text style={s.chatName}>{item.display_name}</Text>
                  <Text style={s.chatLast}>@{item.username}</Text>
                </View>
                <View
                  style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                  {item.is_online === 1 && <View style={s.onlineDot} />}
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            )}
          />
        )
      ) : (requests.received?.length || 0) === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconContainer}>
            <Ionicons
              name="mail-open-outline"
              size={40}
              color={Colors.primary}
            />
          </View>
          <Text style={s.emptyTitle}>No pending requests</Text>
        </View>
      ) : (
        <FlatList
          data={requests.received}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <View style={s.chatItem}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(item.display_name || '?')[0]}
                </Text>
              </View>
              <View style={s.chatInfo}>
                <Text style={s.chatName}>{item.display_name}</Text>
                <Text style={s.chatLast}>@{item.username}</Text>
              </View>
              <View style={s.requestActions}>
                <TouchableOpacity
                  style={s.acceptBtn}
                  onPress={() => acceptRequest(item.id)}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.rejectBtn}
                  onPress={() => rejectRequest(item.id)}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function SocialScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const {isDark} = useTheme();
  const styles = React.useMemo(() => createStyles(), [isDark]);
  const [showCompose, setShowCompose] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [socialTab, setSocialTab] = useState<'feed' | 'my'>('feed');
  const [commentModalPost, setCommentModalPost] = useState<any>(null);
  const [editModalPost, setEditModalPost] = useState<any>(null);
  const [editCaption, setEditCaption] = useState('');
  const user = useAuthStore(s => s.user);
  const likeAnims = useRef<
    Record<string, {scale: Animated.Value; opacity: Animated.Value}>
  >({}).current;
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const [feedData, myData] = await Promise.all([
        apiClient.get('/api/posts/feed'),
        apiClient.get('/api/posts/my'),
      ]);
      setPosts(feedData.data?.posts || []);
      setMyPosts(myData.data?.posts || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to load posts');
      console.error('Load posts error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handlePostUpdate = (event: any) => {
      if (event?.type === 'post_updated') load();
    };
    wsService.on('post_updated', handlePostUpdate);
    return () => wsService.off('post_updated', handlePostUpdate);
  }, [load]);

  const getLikeAnim = (id: string) => {
    if (!likeAnims[id])
      likeAnims[id] = {
        scale: new Animated.Value(1),
        opacity: new Animated.Value(1),
      };
    return likeAnims[id];
  };

  const animateLike = (id: string) => {
    const anim = getLikeAnim(id);
    anim.scale.setValue(1.4);
    anim.opacity.setValue(1);
    Animated.parallel([
      Animated.spring(anim.scale, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(anim.opacity, {
          toValue: 0.5,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const toggleLike = async (post: any) => {
    animateLike(post.id);
    try {
      const data = await apiClient.post(`/api/posts/${post.id}/like`);
      if (data.success) {
        const updater = (p: any) => {
          if (p.id === post.id) {
            return {
              ...p,
              isLiked: data.data.liked,
              like_count: data.data.liked
                ? (p.like_count || 0) + 1
                : Math.max(0, (p.like_count || 0) - 1),
            };
          }
          return p;
        };
        setPosts(prev => prev.map(updater));
        setMyPosts(prev => prev.map(updater));
      }
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const deletePost = async (post: any) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const data = await apiClient.delete(`/api/posts/${post.id}`);
            if (data.success) load();
          } catch (e) {
            console.error('Delete error:', e);
          }
        },
      },
    ]);
  };

  const hidePost = async (post: any) => {
    try {
      const data = await apiClient.put(`/api/posts/${post.id}`, {
        status: 'hidden',
      });
      if (data.success) load();
    } catch (e) {
      console.error('Hide error:', e);
    }
  };

  const sharePost = (post: any) => {
    Alert.alert('Share', `Share "${post.caption || 'this post'}"`, [
      {
        text: 'Copy Link',
        onPress: () => Alert.alert('Copied', 'Link copied to clipboard'),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const openEditPost = (post: any) => {
    setEditCaption(post.caption || '');
    setEditModalPost(post);
  };

  const saveEditPost = async () => {
    if (!editModalPost) return;
    try {
      const data = await apiClient.put(`/api/posts/${editModalPost.id}`, {
        caption: editCaption.trim() || null,
      });
      if (data.success) {
        setEditModalPost(null);
        load();
      }
    } catch (e) {
      console.error('Edit error:', e);
    }
  };

  const toggleSave = async (post: any) => {
    try {
      const data = await apiClient.post(`/api/posts/${post.id}/save`);
      if (data.success) {
        setPosts(prev =>
          prev.map(p => {
            if (p.id === post.id) {
              return {...p, is_saved: data.data.saved};
            }
            return p;
          }),
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save post');
      console.error('Save error:', e);
    }
  };

  const handlePost = async () => {
    if ((!newCaption.trim() && !postImage) || posting) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (postImage) {
        const base64 = await FileSystem.readAsStringAsync(postImage, {
          encoding: 'base64',
        });
        const upload = await apiClient.post('/api/media/upload', {
          data: base64,
          mimeType: 'image/jpeg',
          filename: 'post.jpg',
        });
        imageUrl = upload.data?.url;
      }
      const data = await apiClient.post('/api/posts', {
        caption: newCaption.trim() || undefined,
        imageUrl,
      });
      if (data.success) {
        Alert.alert(
          'Post Submitted',
          'Your post has been submitted for admin approval. It will appear in the feed once approved.',
        );
        setNewCaption('');
        setPostImage(null);
        setShowCompose(false);
        load();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create post');
      console.error('Post error:', e);
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = async (post: any) => {
    setCommentModalPost(post);
    if (!postComments[post.id]) {
      try {
        const data = await apiClient.get(`/api/posts/${post.id}`);
        if (data.success) {
          setPostComments(prev => ({
            ...prev,
            [post.id]: data.data.comments || [],
          }));
        }
      } catch (e) {
        console.error('Load comments error:', e);
      }
    }
  };

  const submitComment = async (post: any) => {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const data = await apiClient.post(`/api/posts/${post.id}/comments`, {
        content: commentText.trim(),
      });
      if (data.success) {
        setPostComments(prev => ({
          ...prev,
          [post.id]: [...(prev[post.id] || []), data.data.comment],
        }));
        setCommentText('');
        setPosts(prev =>
          prev.map(p =>
            p.id === post.id
              ? {...p, comment_count: (p.comment_count || 0) + 1}
              : p,
          ),
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to submit comment');
      console.error('Comment error:', e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const renderPost = (item: any) => {
    const isOwner = item.author_id === user?.id;
    const anim = getLikeAnim(item.id);
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.postAuthorRow}>
            <View style={styles.postAvatar}>
              <Text style={styles.postAvatarText}>
                {item.author_name?.[0] || '?'}
              </Text>
            </View>
            <View style={styles.postAuthorInfo}>
              <Text style={styles.postAuthorName}>
                {item.author_name || 'Unknown'}
              </Text>
              <Text style={styles.postTime}>
                {formatRelativeTime(item.created_at)}
              </Text>
            </View>
          </View>
          {item.status && item.status !== 'active' && socialTab === 'my' && (
            <View
              style={[
                styles.statusBadge,
                item.status === 'pending'
                  ? styles.badgePending
                  : item.status === 'rejected'
                    ? styles.badgeRejected
                    : styles.badgeHidden,
              ]}>
              <Text style={styles.statusBadgeText}>
                {item.status === 'pending'
                  ? '⏳ Pending'
                  : item.status === 'rejected'
                    ? '❌ Rejected'
                    : '👁 Hidden'}
              </Text>
            </View>
          )}
          {isOwner ? (
            <TouchableOpacity
              style={styles.postMoreBtn}
              onPress={() => {
                Alert.alert('Post Options', 'Choose an action', [
                  {text: 'Edit', onPress: () => openEditPost(item)},
                  {text: 'Hide', onPress: () => hidePost(item)},
                  {text: 'Share', onPress: () => sharePost(item)},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deletePost(item),
                  },
                  {text: 'Cancel', style: 'cancel'},
                ]);
              }}>
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.postMoreBtn}
              onPress={() => sharePost(item)}>
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {item.image_url && (
          <View style={styles.postImageContainer}>
            <Image
              source={{uri: item.image_url}}
              style={styles.postImage}
              resizeMode="cover"
            />
          </View>
        )}

        {item.caption ? (
          <Text style={styles.postCaption}>{item.caption}</Text>
        ) : null}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => toggleLike(item)}>
            <Animated.View style={{transform: [{scale: anim.scale}]}}>
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={item.isLiked ? Colors.error : Colors.textSecondary}
              />
            </Animated.View>
            <Text
              style={[
                styles.postActionText,
                item.isLiked && {color: Colors.error},
              ]}>
              {item.like_count || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => toggleComments(item)}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={Colors.textSecondary}
            />
            <Text style={styles.postActionText}>{item.comment_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postAction}
            onPress={() => sharePost(item)}>
            <Ionicons
              name="arrow-redo-outline"
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.postAction, {marginLeft: 'auto'}]}
            onPress={() => toggleSave(item)}>
            <Ionicons
              name={item.is_saved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={item.is_saved ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.socialHeader, {paddingTop: insets.top + 12}]}>
        <Text style={styles.socialHeaderTitle}>Social</Text>
        <TouchableOpacity
          style={styles.composeBtn}
          onPress={() => setShowCompose(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {showCompose && (
        <View style={styles.composeBox}>
          <View style={styles.composeHeader}>
            <View style={styles.postAvatar}>
              <Text style={styles.postAvatarText}>
                {(user?.displayName || '?')[0]}
              </Text>
            </View>
            <Text style={styles.composeName}>{user?.displayName || 'You'}</Text>
          </View>
          <TextInput
            style={styles.composeInput}
            placeholder="What's on your mind?"
            placeholderTextColor={Colors.textTertiary}
            multiline
            value={newCaption}
            onChangeText={setNewCaption}
          />
          <TouchableOpacity
            style={styles.imagePickerBtn}
            onPress={async () => {
              const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert(
                  'Permission required',
                  'Allow photo access to attach an image.',
                );
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 0.85,
              });
              if (!result.canceled) setPostImage(result.assets[0].uri);
            }}>
            <Ionicons name="image-outline" size={20} color={Colors.primary} />
            <Text style={styles.imagePickerText}>
              {postImage ? 'Change image' : 'Add image'}
            </Text>
          </TouchableOpacity>
          {postImage && (
            <Image
              source={{uri: postImage}}
              style={styles.composeImagePreview}
            />
          )}
          <View style={styles.composeActions}>
            <TouchableOpacity
              style={styles.composeCancel}
              onPress={() => {
                setShowCompose(false);
                setNewCaption('');
                setPostImage(null);
              }}>
              <Text style={styles.composeCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.composePostBtn,
                ((!newCaption.trim() && !postImage) || posting) &&
                  styles.composePostBtnDisabled,
              ]}
              onPress={handlePost}
              disabled={(!newCaption.trim() && !postImage) || posting}>
              <Text style={styles.composePostBtnText}>
                {posting ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.composeNote}>
            Your post will be visible after admin approval
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, socialTab === 'feed' && styles.tabBtnActive]}
          onPress={() => setSocialTab('feed')}>
          <Text
            style={[
              styles.tabText,
              socialTab === 'feed' && styles.tabTextActive,
            ]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, socialTab === 'my' && styles.tabBtnActive]}
          onPress={() => setSocialTab('my')}>
          <Text
            style={[
              styles.tabText,
              socialTab === 'my' && styles.tabTextActive,
            ]}>
            My Posts ({myPosts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : socialTab === 'feed' ? (
        posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="newspaper-outline"
                size={40}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to post something!
            </Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({item}) => renderPost(item)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await load();
                  setRefreshing(false);
                }}
              />
            }
          />
        )
      ) : myPosts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="document-text-outline"
              size={40}
              color={Colors.primary}
            />
          </View>
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>Create your first post!</Text>
        </View>
      ) : (
        <FlatList
          data={myPosts}
          keyExtractor={item => item.id}
          renderItem={({item}) => renderPost(item)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        />
      )}

      {/* Comments Bottom Sheet Modal */}
      <Modal visible={!!commentModalPost} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '70%',
              paddingBottom: Platform.OS === 'ios' ? 34 : 16,
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: Colors.borderLight,
              }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: Colors.textPrimary,
                }}>
                Comments
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCommentModalPost(null);
                  setCommentText('');
                }}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={
                commentModalPost ? postComments[commentModalPost.id] || [] : []
              }
              keyExtractor={(c: any) => c.id}
              style={{maxHeight: 350, paddingHorizontal: 16}}
              renderItem={({item: c}: any) => (
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 10,
                    gap: 10,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: Colors.borderLight,
                  }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: Colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>
                      {(c.author_name || '?')[0]}
                    </Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: Colors.textPrimary,
                      }}>
                      {c.author_name || c.author_username}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: Colors.textPrimary,
                        marginTop: 2,
                      }}>
                      {c.content}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: 'center',
                    color: Colors.textTertiary,
                    paddingVertical: 24,
                  }}>
                  No comments yet
                </Text>
              }
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: Colors.borderLight,
                gap: 8,
              }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  fontSize: 14,
                  color: Colors.textPrimary,
                  backgroundColor: Colors.surfaceSecondary,
                }}
                placeholder="Write a comment..."
                placeholderTextColor={Colors.textTertiary}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: commentText.trim()
                    ? Colors.primary
                    : Colors.disabled,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={async () => {
                  if (!commentText.trim() || !commentModalPost) return;
                  setSubmittingComment(true);
                  try {
                    const data = await apiClient.post(
                      `/api/posts/${commentModalPost.id}/comments`,
                      {content: commentText.trim()},
                    );
                    if (data.success) {
                      setPostComments(prev => ({
                        ...prev,
                        [commentModalPost.id]: [
                          ...(prev[commentModalPost.id] || []),
                          data.data.comment,
                        ],
                      }));
                      setCommentText('');
                      setPosts(prev =>
                        prev.map(p =>
                          p.id === commentModalPost.id
                            ? {...p, comment_count: (p.comment_count || 0) + 1}
                            : p,
                        ),
                      );
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setSubmittingComment(false);
                  }
                }}
                disabled={!commentText.trim() || submittingComment}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Post Modal */}
      <Modal visible={!!editModalPost} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}>
          <View
            style={{
              backgroundColor: Colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: Platform.OS === 'ios' ? 34 : 16,
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: Colors.borderLight,
              }}>
              <TouchableOpacity onPress={() => setEditModalPost(null)}>
                <Text style={{color: Colors.textTertiary, fontSize: 15}}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: Colors.textPrimary,
                }}>
                Edit Post
              </Text>
              <TouchableOpacity onPress={saveEditPost}>
                <Text
                  style={{
                    color: Colors.primary,
                    fontSize: 15,
                    fontWeight: '700',
                  }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={{
                margin: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 12,
                padding: 12,
                fontSize: 15,
                color: Colors.textPrimary,
                backgroundColor: Colors.surfaceSecondary,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.textTertiary}
              multiline
              value={editCaption}
              onChangeText={setEditCaption}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QuickAddScreen({navigation}: any) {
  const {isDark} = useTheme();
  const s = React.useMemo(() => createS(), [isDark]);
  const actions = [
    {
      label: 'Add Post',
      icon: 'create-outline',
      onPress: () => navigation.navigate('SocialTab'),
    },
    {
      label: 'Add Friend',
      icon: 'person-add-outline',
      onPress: () => navigation.navigate('ChatsTab', {screen: 'GlobalSearch'}),
    },
    {
      label: 'Scan Nearby Users',
      icon: 'scan-outline',
      onPress: () => navigation.navigate('FriendsTab'),
    },
    {
      label: 'Show Me to Nearby',
      icon: 'radio-outline',
      onPress: () => navigation.navigate('NearbyTab'),
    },
    {
      label: 'My QR Code',
      icon: 'qr-code-outline',
      onPress: () => navigation.navigate('ProfileTab', {screen: 'QrCode'}),
    },
  ] as const;
  return (
    <View style={s.quickAddContainer}>
      <Text style={s.nearbyHeaderTitle}>Quick Add</Text>
      <Text style={s.scanSubtitle}>Choose an action</Text>
      {actions.map(action => (
        <TouchableOpacity
          key={action.label}
          style={s.quickAction}
          onPress={action.onPress}>
          <Ionicons
            name={action.icon as any}
            size={24}
            color={Colors.primary}
          />
          <Text style={s.quickActionText}>{action.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export {ChatsScreen, NearbyScreen, SocialScreen, QuickAddScreen, ProfileScreen};

function createS() {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: Colors.background},
    quickAddContainer: {
      flex: 1,
      backgroundColor: Colors.background,
      padding: Spacing.base,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.base,
      marginTop: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    quickActionText: {
      flex: 1,
      color: Colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    nearbyHeader: {
      backgroundColor: Colors.surface,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: 12,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    nearbyHeaderTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: Colors.textPrimary,
      letterSpacing: -0.5,
    },
    scanContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.xxxl,
      paddingHorizontal: Spacing.xl,
    },
    scanIconContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.base,
    },
    scanTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    scanSubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginBottom: Spacing.xl,
      textAlign: 'center',
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.md,
      ...Shadows.md,
    },
    scanButtonActive: {backgroundColor: Colors.primaryDark},
    scanButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
    scanNote: {
      fontSize: 12,
      color: Colors.textTertiary,
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    nearbyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.borderLight,
    },
    nearbyAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    nearbyAvatarText: {color: '#fff', fontSize: 18, fontWeight: '600'},
    nearbyInfo: {flex: 1},
    nearbyName: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
    nearbyUsername: {fontSize: 13, color: Colors.textTertiary},
    nearbyAddBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    nearbyMsgBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.borderLight,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    avatarText: {color: '#fff', fontSize: 20, fontWeight: '700'},
    chatInfo: {flex: 1},
    chatName: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    chatLast: {fontSize: 13, color: Colors.textTertiary, flex: 1},
    onlineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.online,
    },
    requestActions: {flexDirection: 'row', gap: 6},
    acceptBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rejectBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 100,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.base,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 48,
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    tabBtn: {flex: 1, paddingVertical: Spacing.md, alignItems: 'center'},
    tabBtnActive: {borderBottomWidth: 2, borderBottomColor: Colors.primary},
    tabText: {fontSize: 14, color: Colors.textTertiary, fontWeight: '500'},
    tabTextActive: {color: Colors.primary, fontWeight: '700'},
  });
}

function createStyles() {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: Colors.background},
    header: {
      backgroundColor: Colors.surface,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: 12,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: Colors.textPrimary,
      letterSpacing: -0.5,
    },
    headerActions: {flexDirection: 'row', gap: 4},
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storiesContainer: {
      maxHeight: 100,
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    storyItem: {alignItems: 'center', marginRight: Spacing.md, width: 64},
    storyAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.surfaceSecondary,
    },
    storyAvatarText: {fontSize: 20, fontWeight: '600', color: Colors.primary},
    storyAvatarImage: {width: 52, height: 52, borderRadius: 26},
    storyAddIcon: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Colors.surface,
    },
    storyName: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      backgroundColor: Colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.borderLight,
    },
    chatAvatarContainer: {position: 'relative', marginRight: Spacing.md},
    chatAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatAvatarText: {color: '#fff', fontSize: 20, fontWeight: '600'},
    chatAvatarImage: {width: 52, height: 52, borderRadius: 26},
    onlineIndicator: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: Colors.online,
      borderWidth: 2.5,
      borderColor: Colors.surface,
    },
    chatContent: {flex: 1, minWidth: 0},
    chatTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    chatName: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    chatTime: {fontSize: 12, color: Colors.textTertiary},
    chatBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chatLastMessage: {
      fontSize: 14,
      color: Colors.textSecondary,
      flex: 1,
      marginRight: 8,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Colors.badge,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadText: {color: '#fff', fontSize: 12, fontWeight: '700'},
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 100,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.base,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginBottom: 4,
    },
    emptySubtext: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 48,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 100,
    },
    socialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: Colors.surface,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: 12,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    socialHeaderTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: Colors.textPrimary,
      letterSpacing: -0.5,
    },
    composeBtn: {padding: 4},
    postCard: {
      backgroundColor: Colors.surface,
      marginBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
    },
    postAuthorRow: {flexDirection: 'row', alignItems: 'center', flex: 1},
    postAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    postAvatarText: {color: '#fff', fontSize: 17, fontWeight: '600'},
    postAuthorInfo: {flex: 1},
    postAuthorName: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    postTime: {fontSize: 12, color: Colors.textTertiary, marginTop: 1},
    postMoreBtn: {padding: 8},
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      marginLeft: 4,
    },
    badgePending: {backgroundColor: '#FEF3C7'},
    badgeRejected: {backgroundColor: '#FEE2E2'},
    badgeHidden: {backgroundColor: '#E5E7EB'},
    statusBadgeText: {fontSize: 10, fontWeight: '600', color: '#374151'},
    postImageContainer: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: Colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    postImage: {width: '100%', height: '100%'},
    postImagePlaceholder: {fontSize: 48},
    postCaption: {
      fontSize: 15,
      color: Colors.textPrimary,
      lineHeight: 22,
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    postActions: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.sm,
      gap: Spacing.lg,
    },
    postAction: {flexDirection: 'row', alignItems: 'center', gap: 4},
    postActionText: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    commentSection: {
      borderTopWidth: 1,
      borderTopColor: Colors.borderLight,
      paddingHorizontal: Spacing.base,
      paddingTop: Spacing.sm,
    },
    commentItem: {flexDirection: 'row', marginBottom: 6, gap: 6},
    commentAuthor: {fontSize: 13, fontWeight: '700', color: Colors.textPrimary},
    commentContent: {fontSize: 13, color: Colors.textSecondary, flex: 1},
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 13,
      backgroundColor: Colors.surfaceSecondary,
    },
    commentSubmitBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composeBox: {
      backgroundColor: Colors.surface,
      margin: Spacing.base,
      borderRadius: BorderRadius.lg,
      padding: Spacing.base,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    composeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    composeName: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
    composeInput: {
      fontSize: 15,
      color: Colors.textPrimary,
      minHeight: 60,
      textAlignVertical: 'top',
      padding: 0,
    },
    composeActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    imagePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    imagePickerText: {color: Colors.primary, fontWeight: '600'},
    composeImagePreview: {
      width: 100,
      height: 100,
      borderRadius: BorderRadius.sm,
      marginTop: Spacing.sm,
    },
    composeCancel: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.base,
    },
    composeCancelText: {color: Colors.textTertiary, fontSize: 14},
    composePostBtn: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.base,
    },
    composePostBtnDisabled: {opacity: 0.5},
    composePostBtnText: {color: '#fff', fontSize: 14, fontWeight: '600'},
    composeNote: {
      fontSize: 11,
      color: Colors.textTertiary,
      marginTop: Spacing.md,
      fontStyle: 'italic',
    },
    tabRow: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    tabBtn: {flex: 1, paddingVertical: Spacing.md, alignItems: 'center'},
    tabBtnActive: {borderBottomWidth: 2, borderBottomColor: Colors.primary},
    tabText: {fontSize: 14, color: Colors.textTertiary, fontWeight: '500'},
    tabTextActive: {color: Colors.primary, fontWeight: '700'},
  });
}
