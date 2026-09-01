import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator} from 'react-native';
import {Config} from '../../core/constants/config';
import {useAuthStore} from '../../store/authStore';
import {wsService} from '../../core/services/WebSocketService';
import {formatRelativeTime} from '../../core/utils/formatters';

const API = Config.API.BASE_URL;

function ChatsScreen({navigation}: any) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore(s => s.user);

  const load = useCallback(async () => {
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      if (!token) return;
      const r = await fetch(`${API}/api/conversations`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await r.json();
      setConversations(data.data?.conversations || []);
    } catch (e) {
      console.error('Load conversations error:', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for real-time events to update conversation list
  useEffect(() => {
    const onConversationUpdated = (data: any) => {
      if (!data.conversation) return;
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        const convData = data.conversation;
        if (idx === -1) {
          // New conversation — reload
          load();
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          last_message: convData.last_message,
          last_message_sender: convData.last_message_sender,
          last_message_at: convData.last_message_at,
        };
        // Move to top
        const moved = updated.splice(idx, 1)[0];
        updated.unshift(moved);
        return updated;
      });
    };

    const onNewMessage = (data: any) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        if (idx === -1) {
          load();
          return prev;
        }
        const updated = [...prev];
        const conv = {...updated[idx]};
        conv.last_message = data.message?.content || conv.last_message;
        conv.last_message_sender = data.message?.sender_id || conv.last_message_sender;
        conv.last_message_at = data.message?.created_at || conv.last_message_at;
        if (data.message?.sender_id && data.message.sender_id !== user?.id) {
          conv.unread_count = (conv.unread_count || 0) + 1;
        }
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
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
    return () => {
      wsService.off('conversation:updated', onConversationUpdated);
      wsService.off('new_message', onNewMessage);
      wsService.off('messages_read', onMessagesRead);
    };
  }, [user?.id, load]);

  const openChat = (conv: any) => {
    const participant = conv.participants?.find((p: any) => p.id !== user?.id);
    navigation.navigate('Chat', {
      conversationId: conv.id,
      participantName: conv.displayName || conv.name || participant?.display_name || 'Chat',
      participantAvatar: conv.displayAvatar || participant?.avatar_url,
    });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Chats</Text>
        <TouchableOpacity style={s.searchBtn} onPress={() => navigation.navigate('GlobalSearch')}>
          <Text style={s.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>
      {conversations.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyText}>No conversations yet</Text>
          <Text style={s.emptySub}>Start a chat from Nearby tab</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <TouchableOpacity style={s.chatItem} onPress={() => openChat(item)}>
              <View style={s.avatar}><Text style={s.avatarText}>{(item.displayName || item.name || '?')[0]}</Text></View>
              <View style={s.chatInfo}>
                <View style={s.chatNameRow}>
                  <Text style={s.chatName} numberOfLines={1}>{item.displayName || item.name || 'Group'}</Text>
                  {item.last_message_at && (
                    <Text style={s.chatTime}>{formatRelativeTime(item.last_message_at)}</Text>
                  )}
                </View>
                <View style={s.chatLastRow}>
                  <Text style={s.chatLast} numberOfLines={1}>{item.last_message || 'No messages yet'}</Text>
                  {(item.unread_count || 0) > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        />
      )}
    </View>
  );
}

function NearbyScreen() {
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>({received: [], sent: []} as any);
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const headers = token ? {Authorization: `Bearer ${token}`} : {};

  const load = useCallback(async () => {
    try {
      if (!token) return;
      const [fRes, rRes] = await Promise.all([
        fetch(`${API}/api/friends`, {headers}),
        fetch(`${API}/api/friends/requests`, {headers}),
      ]);
      const fData = await fRes.json();
      const rData = await rRes.json();
      setFriends(fData.data?.friends || []);
      setRequests(rData.data || {received: [], sent: []});
    } catch (e) {
      console.error('Load friends error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const acceptRequest = async (requestId: string) => {
    if (!token) return;
    await fetch(`${API}/api/friends/accept/${requestId}`, {method: 'POST', headers});
    load();
  };

  const rejectRequest = async (requestId: string) => {
    if (!token) return;
    await fetch(`${API}/api/friends/reject/${requestId}`, {method: 'POST', headers});
    load();
  };

  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>Nearby</Text></View>
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'friends' && s.tabBtnActive]} onPress={() => setTab('friends')}>
          <Text style={[s.tabText, tab === 'friends' && s.tabTextActive]}>Friends ({friends.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'requests' && s.tabBtnActive]} onPress={() => setTab('requests')}>
          <Text style={[s.tabText, tab === 'requests' && s.tabTextActive]}>
            Requests ({requests.received?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={s.empty}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : tab === 'friends' ? (
        friends.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>👥</Text>
            <Text style={s.emptyText}>No friends yet</Text>
            <Text style={s.emptySub}>Search users to add friends</Text>
          </View>
        ) : (
          <FlatList data={friends} keyExtractor={item => item.id} renderItem={({item}) => (
            <View style={s.chatItem}>
              <View style={s.avatar}><Text style={s.avatarText}>{(item.display_name || '?')[0]}</Text></View>
              <View style={s.chatInfo}>
                <Text style={s.chatName}>{item.display_name}</Text>
                <Text style={s.chatLast}>@{item.username}</Text>
              </View>
              {item.is_online === 1 && <View style={s.onlineDot}/>}
            </View>
          )} />
        )
      ) : (
        (requests.received?.length || 0) === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📩</Text>
            <Text style={s.emptyText}>No pending requests</Text>
          </View>
        ) : (
          <FlatList data={requests.received} keyExtractor={item => item.id} renderItem={({item}) => (
            <View style={s.chatItem}>
              <View style={s.avatar}><Text style={s.avatarText}>{(item.display_name || '?')[0]}</Text></View>
              <View style={s.chatInfo}>
                <Text style={s.chatName}>{item.display_name}</Text>
                <Text style={s.chatLast}>@{item.username}</Text>
              </View>
              <View style={s.requestActions}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(item.id)}>
                  <Text style={s.acceptBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn} onPress={() => rejectRequest(item.id)}>
                  <Text style={s.rejectBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )} />
        )
      )}
    </View>
  );
}

function SocialScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCaption, setNewCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);

  const load = useCallback(async () => {
    try {
      if (!token) return;
      const r = await fetch(`${API}/api/posts/feed`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await r.json();
      setPosts(data.data?.posts || []);
    } catch (e) {
      console.error('Load posts error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async (postId: string) => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await r.json();
      if (data.success) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: data.data.liked,
              like_count: data.data.liked ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
            };
          }
          return p;
        }));
      }
    } catch (e) {
      console.error('Like error:', e);
    }
  };

  const handlePost = async () => {
    if (!newCaption.trim() || !token || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/api/posts`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({caption: newCaption.trim()}),
      });
      const data = await r.json();
      if (data.success) {
        setNewCaption('');
        setShowCompose(false);
        load();
      }
    } catch (e) {
      console.error('Post error:', e);
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Social</Text>
        <TouchableOpacity style={s.searchBtn} onPress={() => setShowCompose(!showCompose)}>
          <Text style={s.searchBtnText}>✏️</Text>
        </TouchableOpacity>
      </View>
      {showCompose && (
        <View style={s.composeBox}>
          <View style={s.composeHeader}>
            <View style={[s.avatar, {width: 36, height: 36, borderRadius: 18, marginRight: 8}]}>
              <Text style={[s.avatarText, {fontSize: 14}]}>{(user?.displayName || '?')[0]}</Text>
            </View>
            <Text style={s.composeName}>{user?.displayName || 'You'}</Text>
          </View>
          <TextInput
            style={s.composeInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#999"
            multiline
            value={newCaption}
            onChangeText={setNewCaption}
          />
          <View style={s.composeActions}>
            <TouchableOpacity style={s.composeCancel} onPress={() => {setShowCompose(false); setNewCaption('');}}>
              <Text style={s.composeCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.composePostBtn, (!newCaption.trim() || posting) && s.composePostBtnDisabled]}
              onPress={handlePost}
              disabled={!newCaption.trim() || posting}>
              <Text style={s.composePostBtnText}>{posting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.composeNote}>Your post will be visible after admin approval</Text>
        </View>
      )}
      {loading ? (
        <View style={s.empty}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : posts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📰</Text>
          <Text style={s.emptyText}>No posts yet</Text>
          <Text style={s.emptySub}>Be the first to post something!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <View style={s.postCard}>
              <View style={s.postHeader}>
                <View style={s.postAvatar}><Text style={s.postAvatarText}>{(item.author_name || '?')[0]}</Text></View>
                <View>
                  <Text style={s.postAuthor}>{item.author_name || item.author_username}</Text>
                  <Text style={s.postTime}>{formatRelativeTime(item.created_at)}</Text>
                </View>
              </View>
              {item.caption ? <Text style={s.postCaption}>{item.caption}</Text> : null}
              <View style={s.postActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => toggleLike(item.id)}>
                  <Text style={[s.actionText, item.isLiked && s.actionTextActive]}>
                    {item.isLiked ? '❤️' : '🤍'} {item.like_count || 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn}>
                  <Text style={s.actionText}>💬 {item.comment_count || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function CallsScreen() {
  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>Calls</Text></View>
      <View style={s.empty}>
        <Text style={s.emptyIcon}>📞</Text>
        <Text style={s.emptyText}>No calls yet</Text>
        <Text style={s.emptySub}>Voice calls coming soon</Text>
      </View>
    </View>
  );
}

function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const state = useAuthStore.getState();
    setUser(state.user);
    setDisplayName(state.user?.displayName || '');
    setBio(state.user?.bio || '');
  }, []);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      const r = await fetch(`${API}/api/users/profile`, {
        method: 'PUT',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({displayName: displayName.trim(), bio: bio.trim()}),
      });
      const data = await r.json();
      if (data.success) {
        useAuthStore.setState((state: any) => ({
          user: {...state.user, displayName: data.data.displayName, bio: data.data.bio},
        }));
        setUser((prev: any) => ({...prev, displayName: data.data.displayName, bio: data.data.bio}));
        setEditing(false);
      }
    } catch (e) {
      console.error('Profile update error:', e);
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    useAuthStore.getState().logout();
  };

  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>Profile</Text></View>
      <View style={s.profileCard}>
        <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{user?.displayName?.[0] || '?'}</Text></View>
        {editing ? (
          <>
            <TextInput style={s.profileInput} value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor="#999" />
            <TextInput style={[s.profileInput, {height: 60}]} value={bio} onChangeText={setBio} placeholder="Bio (optional)" placeholderTextColor="#999" multiline />
            <View style={s.profileActions}>
              <TouchableOpacity style={s.profileCancelBtn} onPress={() => {setEditing(false); setDisplayName(user?.displayName || ''); setBio(user?.bio || '');}}>
                <Text style={s.profileCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.profileSaveBtn, saving && {opacity: 0.5}]} onPress={handleSave} disabled={saving}>
                <Text style={s.profileSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={s.profileName}>{user?.displayName || 'User'}</Text>
            <Text style={s.profileUsername}>@{user?.username || ''}</Text>
            {user?.bio ? <Text style={s.profileBio}>{user.bio}</Text> : null}
            <Text style={s.profilePhone}>{user?.phoneNumber || ''}</Text>
            <TouchableOpacity style={s.editProfileBtn} onPress={() => setEditing(true)}>
              <Text style={s.editProfileBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

export {ChatsScreen, NearbyScreen, SocialScreen, CallsScreen, ProfileScreen};

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#6366f1', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  searchBtn: {width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center'},
  searchBtnText: {fontSize: 18},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 18, fontWeight: '600', color: '#333'},
  emptySub: {fontSize: 14, color: '#999', marginTop: 4},
  chatItem: {flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'},
  avatar: {width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 12},
  avatarText: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  chatInfo: {flex: 1},
  chatNameRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  chatName: {fontSize: 16, fontWeight: '600', color: '#333', flex: 1},
  chatTime: {fontSize: 11, color: '#999', marginLeft: 8},
  chatLastRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2},
  chatLast: {fontSize: 13, color: '#999', flex: 1},
  badge: {backgroundColor: '#6366f1', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8},
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  postCard: {backgroundColor: '#fff', padding: 16, marginHorizontal: 12, marginTop: 12, borderRadius: 12},
  postHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  postAvatar: {width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  postAvatarText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  postAuthor: {fontSize: 14, fontWeight: '600', color: '#333'},
  postTime: {fontSize: 11, color: '#999', marginTop: 1},
  postCaption: {fontSize: 15, color: '#555', marginBottom: 10},
  postActions: {flexDirection: 'row', gap: 16},
  actionBtn: {padding: 4},
  actionText: {fontSize: 13, color: '#666'},
  actionTextActive: {color: '#ef4444'},
  // Compose box
  composeBox: {backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb'},
  composeHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  composeName: {fontSize: 14, fontWeight: '600', color: '#333'},
  composeInput: {fontSize: 15, color: '#333', minHeight: 60, textAlignVertical: 'top', padding: 0},
  composeActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10},
  composeCancel: {paddingVertical: 6, paddingHorizontal: 14},
  composeCancelText: {color: '#999', fontSize: 14},
  composePostBtn: {backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16},
  composePostBtnDisabled: {opacity: 0.5},
  composePostBtnText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  composeNote: {fontSize: 11, color: '#999', marginTop: 8, fontStyle: 'italic'},
  // Tab row (Nearby/Friends)
  tabRow: {flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'},
  tabBtn: {flex: 1, paddingVertical: 12, alignItems: 'center'},
  tabBtnActive: {borderBottomWidth: 2, borderBottomColor: '#6366f1'},
  tabText: {fontSize: 14, color: '#999', fontWeight: '500'},
  tabTextActive: {color: '#6366f1', fontWeight: '700'},
  onlineDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e'},
  requestActions: {flexDirection: 'row', gap: 6},
  acceptBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center'},
  acceptBtnText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  rejectBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center'},
  rejectBtnText: {color: '#fff', fontSize: 16, fontWeight: 'bold'},
  // Profile
  profileCard: {alignItems: 'center', padding: 24, marginTop: 20},
  profileAvatar: {width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center'},
  profileAvatarText: {color: '#fff', fontSize: 36, fontWeight: 'bold'},
  profileName: {fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 12},
  profileUsername: {fontSize: 16, color: '#666', marginTop: 4},
  profileBio: {fontSize: 14, color: '#555', marginTop: 6, fontStyle: 'italic'},
  profilePhone: {fontSize: 14, color: '#999', marginTop: 2},
  editProfileBtn: {marginTop: 16, paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20, backgroundColor: '#f0f0f0'},
  editProfileBtnText: {fontSize: 14, fontWeight: '600', color: '#333'},
  profileInput: {width: '100%', fontSize: 16, color: '#333', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 8, marginTop: 8},
  profileActions: {flexDirection: 'row', gap: 12, marginTop: 16},
  profileCancelBtn: {paddingVertical: 8, paddingHorizontal: 20},
  profileCancelText: {color: '#999', fontSize: 14},
  profileSaveBtn: {backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20},
  profileSaveText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  logoutBtn: {marginHorizontal: 40, marginTop: 30, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ff4444', alignItems: 'center'},
  logoutText: {color: '#ff4444', fontSize: 16, fontWeight: '600'},
});
