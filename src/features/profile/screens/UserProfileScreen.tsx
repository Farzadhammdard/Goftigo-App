import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';

const API = Config.API.BASE_URL;

interface UserProfileData {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  public_user_id: string;
  created_at: number;
  is_online: number;
  last_seen_at: number | null;
  postCount: number;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isFriend: boolean;
}

export function UserProfileScreen({route, navigation}: any) {
  const {userId} = route.params;
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState('none');
  const [actionLoading, setActionLoading] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
  const isMe = currentUser?.id === userId;

  useEffect(() => {
    loadProfile();
    if (!isMe) loadFriendStatus();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API}/api/users/${userId}`, {headers});
      const data = await res.json();
      if (data.success) setProfile(data.data);
    } catch (e) {
      console.error('Load profile error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendStatus = async () => {
    try {
      const res = await fetch(`${API}/api/friends/status/${userId}`, {headers});
      const data = await res.json();
      if (data.success) setFriendStatus(data.data.status);
    } catch {}
  };

  const toggleFollow = async () => {
    if (!profile) return;
    const method = profile.isFollowing ? 'DELETE' : 'POST';
    try {
      await fetch(`${API}/api/follows/${profile.id}/follow`, {method, headers});
      setProfile(p => p ? {...p, isFollowing: !p.isFollowing, followersCount: p.followersCount + (p.isFollowing ? -1 : 1)} : p);
    } catch {}
  };

  const sendFriendRequest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/friends/request`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({userId}),
      });
      const data = await res.json();
      if (data.success) setFriendStatus(data.data.status);
    } catch (e) {
      Alert.alert('Error', 'Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const startChat = async () => {
    try {
      const res = await fetch(`${API}/api/conversations`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({type: 'direct', participantIds: [userId]}),
      });
      const data = await res.json();
      if (data.success) {
        navigation.navigate('ChatsTab', {
          screen: 'Chat',
          params: {
            conversationId: data.data.conversationId,
            participantName: profile?.display_name || 'Chat',
            participantAvatar: profile?.avatar_url,
          },
        });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not start chat');
    }
  };

  const formatLastSeen = (ts: number | null) => {
    if (!ts) return 'Never seen';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Online now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#00E5D4" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      <View style={s.profileSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile.display_name?.[0] || '?'}</Text>
          {profile.is_online === 1 && <View style={s.onlineDot} />}
        </View>
        <Text style={s.name}>{profile.display_name}</Text>
        <Text style={s.username}>@{profile.username}</Text>
        <Text style={s.gftId}>{profile.public_user_id}</Text>
        {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        {!isMe && profile.is_online !== 1 && (
          <Text style={s.lastSeen}>Last seen: {formatLastSeen(profile.last_seen_at)}</Text>
        )}
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{profile.postCount || 0}</Text>
          <Text style={s.statLabel}>Posts</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{profile.followersCount || 0}</Text>
          <Text style={s.statLabel}>Followers</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{profile.followingCount || 0}</Text>
          <Text style={s.statLabel}>Following</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{profile.friendsCount || 0}</Text>
          <Text style={s.statLabel}>Friends</Text>
        </View>
      </View>

      {!isMe && (
        <View style={s.actions}>
          <TouchableOpacity style={s.chatBtn} onPress={startChat}>
            <Text style={s.chatBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={profile.isFollowing ? s.followingBtn : s.followBtn} onPress={toggleFollow}>
            <Text style={profile.isFollowing ? s.followingBtnText : s.followBtnText}>{profile.isFollowing ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
          {friendStatus === 'none' && (
            <TouchableOpacity style={s.friendBtn} onPress={sendFriendRequest} disabled={actionLoading}>
              <Text style={s.friendBtnText}>{actionLoading ? 'Sending...' : 'Add Friend'}</Text>
            </TouchableOpacity>
          )}
          {friendStatus === 'request_sent' && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingText}>Request Sent</Text>
            </View>
          )}
          {friendStatus === 'friends' && (
            <View style={s.friendsBadge}>
              <Text style={s.friendsText}>Friends</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  errorText: {fontSize: 16, color: '#999'},
  header: {backgroundColor: '#00B8AA', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'},
  backBtn: {padding: 8, marginRight: 8},
  backText: {color: '#fff', fontSize: 24},
  headerTitle: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  profileSection: {alignItems: 'center', padding: 24, backgroundColor: '#fff', marginBottom: 12},
  avatar: {width: 90, height: 90, borderRadius: 45, backgroundColor: '#00E5D4', alignItems: 'center', justifyContent: 'center'},
  avatarText: {color: '#fff', fontSize: 40, fontWeight: 'bold'},
  onlineDot: {position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#22c55e', borderWidth: 3, borderColor: '#fff'},
  name: {fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 12},
  username: {fontSize: 16, color: '#00B8AA', marginTop: 4},
  gftId: {fontSize: 13, color: '#999', marginTop: 2},
  bio: {fontSize: 14, color: '#555', marginTop: 8, textAlign: 'center', paddingHorizontal: 20},
  lastSeen: {fontSize: 12, color: '#999', marginTop: 6},
  statsRow: {flexDirection: 'row', backgroundColor: '#fff', marginBottom: 12, paddingVertical: 16, justifyContent: 'space-around'},
  stat: {flex: 1, alignItems: 'center'},
  statValue: {fontSize: 22, fontWeight: 'bold', color: '#333'},
  statLabel: {fontSize: 13, color: '#999', marginTop: 2},
  actions: {flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 24, flexWrap: 'wrap'},
  chatBtn: {backgroundColor: '#00E5D4', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center'},
  chatBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  followBtn: {backgroundColor: '#22c55e', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center'},
  followBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  followingBtn: {borderWidth: 1.5, borderColor: '#00E5D4', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center'},
  followingBtnText: {color: '#00B8AA', fontSize: 15, fontWeight: '600'},
  friendBtn: {backgroundColor: '#22c55e', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center'},
  friendBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  pendingBadge: {flex: 1, backgroundColor: '#fef3c7', paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  pendingText: {color: '#d97706', fontSize: 14, fontWeight: '600'},
  friendsBadge: {flex: 1, backgroundColor: '#dcfce7', paddingVertical: 12, borderRadius: 10, alignItems: 'center'},
  friendsText: {color: '#16a34a', fontSize: 14, fontWeight: '600'},
});
