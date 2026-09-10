import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {apiClient} from '../../../core/services/apiClient';
import {formatRelativeTime} from '../../../core/utils/formatters';
import {
  Colors,
  Spacing,
  BorderRadius,
  Shadows,
  Typography,
} from '../../../core/theme';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '../../../shell/providers/ThemeProvider';
import {ThemeToggle} from '../../../components/ThemeToggle';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const API = Config.API.BASE_URL;

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  public_user_id: string;
  is_online: number;
  last_seen_at: number | null;
  created_at: number;
  postCount: number;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isFriend: boolean;
}

// ============ MAIN PROFILE SCREEN ============
export function ProfileScreen({navigation, route}: any) {
  const {userId} = route?.params || {};
  const currentUser = useAuthStore(s => s.user);
  const isMe = !userId || userId === currentUser?.id;
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'saved'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [showEdit, setShowEdit] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      if (isMe) {
        const [meData, statsData] = await Promise.all([
          apiClient.get('/api/auth/me'),
          apiClient.get(`/api/users/${currentUser?.id}`),
        ]);
        if (meData.success && statsData.success) {
          setProfile({
            id: meData.data.id,
            username: meData.data.username,
            display_name: meData.data.displayName,
            avatar_url: meData.data.avatarUrl,
            bio: meData.data.bio,
            public_user_id: meData.data.publicUserId,
            is_online: 1,
            last_seen_at: null,
            created_at: 0,
            postCount: statsData.data.postCount,
            friendsCount: statsData.data.friendsCount,
            followersCount: statsData.data.followersCount,
            followingCount: statsData.data.followingCount,
            isFollowing: false,
            isFriend: true,
          });
        }
      } else {
        const data = await apiClient.get(`/api/users/${userId}`);
        if (data.success) setProfile(data.data);
      }
    } catch (e) {
      console.error('Profile error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, isMe]);

  const loadPosts = useCallback(async () => {
    try {
      const targetId = isMe ? currentUser?.id : userId;
      const data = await apiClient.get(
        `/api/posts/user/${targetId}?pageSize=50`,
      );
      if (data.success) setPosts(data.data.posts || []);
    } catch {}
  }, [userId, isMe]);

  const loadSaved = useCallback(async () => {
    if (!isMe) return;
    try {
      const data = await apiClient.get('/api/posts/saved');
      if (data.success) setSavedPosts(data.data.posts || []);
    } catch {}
  }, [isMe]);

  useEffect(() => {
    loadProfile();
    loadPosts();
    if (isMe) loadSaved();
  }, [loadProfile, loadPosts, loadSaved]);

  const toggleFollow = async () => {
    if (!profile) return;
    try {
      if (profile.isFollowing) {
        await apiClient.delete(`/api/follows/${profile.id}/follow`);
      } else {
        await apiClient.post(`/api/follows/${profile.id}/follow`);
      }
      setProfile(p =>
        p
          ? {
              ...p,
              isFollowing: !p.isFollowing,
              followersCount: p.followersCount + (p.isFollowing ? -1 : 1),
            }
          : p,
      );
    } catch {}
  };

  const handleSaveProfile = async (updates: any) => {
    try {
      const data = await apiClient.put('/api/users/profile', updates);
      if (data.success) {
        useAuthStore.getState().updateProfile({
          displayName: data.data.displayName,
          bio: data.data.bio,
          username: data.data.username,
          avatarUrl: data.data.avatarUrl,
        });
        setProfile(p =>
          p
            ? {
                ...p,
                display_name: data.data.displayName,
                bio: data.data.bio,
                username: data.data.username,
                avatar_url: data.data.avatarUrl,
              }
            : p,
        );
        setShowEdit(false);
        return true;
      } else if (data.error?.code === 'USERNAME_TAKEN') {
        Alert.alert('Error', 'Username is already taken');
        return false;
      }
    } catch (e: any) {
      if (e?.error?.code === 'USERNAME_TAKEN') {
        Alert.alert('Error', 'Username is already taken');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    }
    return false;
  };

  const copyGftId = () => {
    if (!profile) return;
    Alert.alert('Copied', 'Goftegoo ID copied');
  };

  const startChat = () => {
    if (!profile) return;
    navigation.navigate('ChatsTab', {
      screen: 'Chat',
      params: {conversationId: 'new', participantName: profile.display_name},
    });
  };

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  if (!profile)
    return (
      <View style={s.center}>
        <Text style={{color: Colors.textTertiary}}>Profile not found</Text>
      </View>
    );

  return (
    <View style={s.container}>
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{paddingBottom: 40}}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              setLoading(true);
              loadProfile();
              loadPosts();
              if (isMe) loadSaved();
            }}
          />
        }>
        {/* Header */}
        <View style={[s.header, {paddingTop: insets.top + 12}]}>
          <Text style={s.headerTitle}>Profile</Text>
          {isMe && (
            <View style={s.headerActions}>
              <ThemeToggle />
              <TouchableOpacity
                style={s.headerBtn}
                onPress={() => navigation.navigate('Settings')}>
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.headerBtn}
                onPress={() => setShowEdit(true)}>
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.headerBtn}
                onPress={() => navigation.navigate('QrCode')}>
                <Ionicons
                  name="qr-code-outline"
                  size={22}
                  color={Colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{uri: profile.avatar_url}} style={s.avatarImage} />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {profile.display_name?.[0] || '?'}
                </Text>
              </View>
            )}
            {profile.is_online === 1 && <View style={s.onlineIndicator} />}
          </View>
          <Text style={s.displayName}>{profile.display_name}</Text>
          <Text style={s.username}>@{profile.username}</Text>
          <TouchableOpacity onPress={copyGftId}>
            <Text style={s.gftId}>{profile.public_user_id}</Text>
          </TouchableOpacity>
          {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        </View>

        {/* Stats Card */}
        <View style={s.statsCard}>
          {[
            {label: 'Posts', value: profile.postCount, route: 'PostsGrid'},
            {
              label: 'Followers',
              value: profile.followersCount,
              route: 'FollowersList',
            },
            {
              label: 'Following',
              value: profile.followingCount,
              route: 'FollowingList',
            },
            {
              label: 'Friends',
              value: profile.friendsCount,
              action: () =>
                navigation.navigate('FriendsList', {
                  userId: profile.id,
                  userName: profile.display_name,
                }),
            },
          ].map(stat => (
            <TouchableOpacity
              key={stat.label}
              style={s.statItem}
              onPress={() =>
                stat.route
                  ? navigation.navigate(stat.route, {
                      userId: profile.id,
                      userName: profile.display_name,
                    })
                  : stat.action?.()
              }>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        {!isMe && (
          <View style={s.actionRow}>
            <TouchableOpacity style={s.primaryAction} onPress={startChat}>
              <Ionicons name="chatbubble" size={18} color="#fff" />
              <Text style={s.primaryActionText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={profile.isFollowing ? s.outlineAction : s.followAction}
              onPress={toggleFollow}>
              <Ionicons
                name={profile.isFollowing ? 'checkmark' : 'person-add'}
                size={18}
                color={profile.isFollowing ? Colors.primary : '#fff'}
              />
              <Text
                style={
                  profile.isFollowing ? s.outlineActionText : s.followActionText
                }>
                {profile.isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'posts' && s.tabBtnActive]}
            onPress={() => setTab('posts')}>
            <Text style={[s.tabText, tab === 'posts' && s.tabTextActive]}>
              Posts ({profile.postCount})
            </Text>
          </TouchableOpacity>
          {isMe && (
            <TouchableOpacity
              style={[s.tabBtn, tab === 'saved' && s.tabBtnActive]}
              onPress={() => setTab('saved')}>
              <Text style={[s.tabText, tab === 'saved' && s.tabTextActive]}>
                Saved
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Posts Grid */}
        {tab === 'posts' ? (
          posts.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No posts yet</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {posts.map(post => (
                <TouchableOpacity
                  key={post.id}
                  style={s.gridItem}
                  onPress={() => {}}>
                  {post.image_url ? (
                    <Image
                      source={{uri: post.image_url}}
                      style={s.gridImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={s.gridTextItem}>
                      <Text style={s.gridCaption} numberOfLines={4}>
                        {post.caption}
                      </Text>
                    </View>
                  )}
                  <View style={s.gridOverlay}>
                    <Text style={s.gridLikes}>❤️ {post.like_count || 0}</Text>
                    <Text style={s.gridComments}>
                      💬 {post.comment_count || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : savedPosts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No saved posts</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {savedPosts.map(post => (
              <TouchableOpacity
                key={post.id}
                style={s.gridItem}
                onPress={() => {}}>
                {post.image_url ? (
                  <Image
                    source={{uri: post.image_url}}
                    style={s.gridImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={s.gridTextItem}>
                    <Text style={s.gridCaption} numberOfLines={4}>
                      {post.caption}
                    </Text>
                  </View>
                )}
                <View style={s.gridOverlay}>
                  <Text style={s.gridLikes}>❤️ {post.like_count || 0}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEdit}
        profile={profile}
        onClose={() => setShowEdit(false)}
        onSave={handleSaveProfile}
      />
    </View>
  );
}

export function QrCodeScreen({navigation}: any) {
  const user = useAuthStore(s => s.user);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  const value = user?.publicUserId || user?.id || '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(value)}`;
  return (
    <View style={s.container}>
      <View style={s.listHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.modalCancel}>Back</Text>
        </TouchableOpacity>
        <Text style={s.listTitle}>My QR Code</Text>
      </View>
      <View style={s.qrContainer}>
        <Image source={{uri: qrUrl}} style={s.qrImage} />
        <Text style={s.displayName}>{user?.displayName}</Text>
        <Text style={s.gftId}>{value}</Text>
        <Text style={s.emptyText}>Scan this code to find me on Goftegoo</Text>
      </View>
    </View>
  );
}

// ============ EDIT PROFILE MODAL ============
function EditProfileModal({
  visible,
  profile,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (u: any) => Promise<boolean | undefined>;
}) {
  const [name, setName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || '');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);

  useEffect(() => {
    if (visible) {
      setName(profile.display_name);
      setUsername(profile.username);
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [visible]);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'Allow photo access to change your avatar.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const upload = await apiClient.post('/api/media/upload', {
        data: base64,
        mimeType: asset.mimeType || 'image/jpeg',
        filename: 'avatar.jpg',
      });
      if (!upload.success || !upload.data?.url)
        throw new Error('Upload failed');
      setAvatarUrl(upload.data.url);
    } catch {
      Alert.alert('Error', 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    const ok = await onSave({
      displayName: name.trim(),
      username: username.trim(),
      bio: bio.trim(),
      avatarUrl: avatarUrl || null,
    });
    setSaving(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[s.modalSave, saving && {opacity: 0.5}]}>
                {saving ? '...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <TouchableOpacity
              onPress={chooseAvatar}
              disabled={uploadingAvatar}
              style={s.avatarPicker}>
              {avatarUrl ? (
                <Image source={{uri: avatarUrl}} style={s.avatarPreview} />
              ) : (
                <Text style={s.avatarPickerText}>Add photo</Text>
              )}
              {uploadingAvatar && <ActivityIndicator color={Colors.primary} />}
            </TouchableOpacity>
            <Text style={s.label}>Display Name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={s.label}>Username</Text>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
            <Text style={s.label}>Bio</Text>
            <TextInput
              style={[s.input, {height: 80}]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell about yourself"
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ============ POSTS GRID SCREEN ============
export function PostsGridScreen({route}: any) {
  const {userId, userName} = route.params;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  useEffect(() => {
    apiClient
      .get(`/api/posts/user/${userId}`)
      .then(d => {
        if (d.success) setPosts(d.data.posts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  return (
    <View style={s.container}>
      <View style={s.listHeader}>
        <Text style={s.listTitle}>{userName}'s Posts</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{marginTop: 40}}
        />
      ) : posts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No posts</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          numColumns={3}
          keyExtractor={i => i.id}
          contentContainerStyle={s.grid}
          renderItem={({item}) => (
            <TouchableOpacity style={s.gridItem}>
              {item.image_url ? (
                <View style={s.gridImg}>
                  <Text style={s.gridImgText}>📷</Text>
                </View>
              ) : (
                <View style={s.gridTextItem}>
                  <Text style={s.gridCaption} numberOfLines={4}>
                    {item.caption}
                  </Text>
                </View>
              )}
              <View style={s.gridOverlay}>
                <Text style={s.gridLikes}>❤️ {item.like_count || 0}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ============ FOLLOWERS LIST ============
export function FollowersListScreen({route}: any) {
  const {userId, userName} = route.params;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  useEffect(() => {
    apiClient
      .get(`/api/follows/${userId}/followers`)
      .then(d => {
        if (d.success) setUsers(d.data.followers || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  const toggleFollow = async (u: any) => {
    if (u.isFollowing) {
      await apiClient.delete(`/api/follows/${u.id}/follow`);
    } else {
      await apiClient.post(`/api/follows/${u.id}/follow`);
    }
    setUsers(prev =>
      prev.map(x => (x.id === u.id ? {...x, isFollowing: !x.isFollowing} : x)),
    );
  };
  return (
    <View style={s.container}>
      <View style={s.listHeader}>
        <Text style={s.listTitle}>{userName}'s Followers</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{marginTop: 40}}
        />
      ) : users.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No followers yet</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={i => i.id}
          renderItem={({item}) => (
            <View style={s.userRow}>
              <View style={s.userAvatar}>
                <Text style={s.userAvatarText}>
                  {item.display_name?.[0] || '?'}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{item.display_name}</Text>
                <Text style={s.userUsername}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                style={item.isFollowing ? s.outlineBtnSmall : s.followBtnSmall}
                onPress={() => toggleFollow(item)}>
                <Text
                  style={
                    item.isFollowing
                      ? s.outlineBtnTextSmall
                      : s.followBtnTextSmall
                  }>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ============ FOLLOWING LIST ============
export function FollowingListScreen({route}: any) {
  const {userId, userName} = route.params;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  useEffect(() => {
    apiClient
      .get(`/api/follows/${userId}/following`)
      .then(d => {
        if (d.success) setUsers(d.data.following || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  const toggleFollow = async (u: any) => {
    if (u.isFollowing) {
      await apiClient.delete(`/api/follows/${u.id}/follow`);
    } else {
      await apiClient.post(`/api/follows/${u.id}/follow`);
    }
    setUsers(prev =>
      prev.map(x => (x.id === u.id ? {...x, isFollowing: !x.isFollowing} : x)),
    );
  };
  return (
    <View style={s.container}>
      <View style={s.listHeader}>
        <Text style={s.listTitle}>{userName}'s Following</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{marginTop: 40}}
        />
      ) : users.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>Not following anyone</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={i => i.id}
          renderItem={({item}) => (
            <View style={s.userRow}>
              <View style={s.userAvatar}>
                <Text style={s.userAvatarText}>
                  {item.display_name?.[0] || '?'}
                </Text>
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{item.display_name}</Text>
                <Text style={s.userUsername}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                style={item.isFollowing ? s.outlineBtnSmall : s.followBtnSmall}
                onPress={() => toggleFollow(item)}>
                <Text
                  style={
                    item.isFollowing
                      ? s.outlineBtnTextSmall
                      : s.followBtnTextSmall
                  }>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ============ FRIENDS LIST ============
export function FriendsListScreen({route}: any) {
  const {userId, userName} = route.params;
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const {isDark} = useTheme();
  const s = React.useMemo(() => createProfileStyles(), [isDark]);
  useEffect(() => {
    apiClient
      .get('/api/friends')
      .then(d => {
        if (d.success) setFriends(d.data.friends || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  return (
    <View style={s.container}>
      <View style={s.listHeader}>
        <Text style={s.listTitle}>{userName}'s Friends</Text>
      </View>
      {loading ? (
        <ActivityIndicator
          size="large"
          color={Colors.primary}
          style={{marginTop: 40}}
        />
      ) : friends.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No friends yet</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={i => i.id}
          renderItem={({item}) => (
            <View style={s.userRow}>
              <View style={s.userAvatar}>
                <Text style={s.userAvatarText}>
                  {item.display_name?.[0] || '?'}
                </Text>
                {item.is_online === 1 && <View style={s.onlineSmall} />}
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{item.display_name}</Text>
                <Text style={s.userUsername}>@{item.username}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ============ STYLES ============
function createProfileStyles() {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: Colors.background},
    center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
    header: {
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
    headerTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: Colors.textPrimary,
      letterSpacing: -0.5,
    },
    headerActions: {flexDirection: 'row', gap: 4},
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileCard: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    avatarContainer: {position: 'relative'},
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: Colors.surfaceSecondary,
    },
    avatarText: {color: '#fff', fontSize: 40, fontWeight: '700'},
    onlineIndicator: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: Colors.online,
      borderWidth: 3,
      borderColor: Colors.surface,
    },
    displayName: {
      fontSize: 22,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: Spacing.md,
    },
    username: {fontSize: 15, color: Colors.primary, marginTop: 2},
    gftId: {fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.xs},
    bio: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
      textAlign: 'center',
      paddingHorizontal: Spacing.xxxl,
      lineHeight: 20,
    },
    statsCard: {
      flexDirection: 'row',
      backgroundColor: Colors.surface,
      marginHorizontal: Spacing.base,
      marginTop: Spacing.md,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.base,
      ...Shadows.sm,
    },
    statItem: {flex: 1, alignItems: 'center'},
    statValue: {fontSize: 20, fontWeight: '700', color: Colors.textPrimary},
    statLabel: {fontSize: 12, color: Colors.textTertiary, marginTop: 2},
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      paddingHorizontal: Spacing.base,
      marginTop: Spacing.base,
    },
    primaryAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    primaryActionText: {color: '#fff', fontSize: 15, fontWeight: '600'},
    followAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: Colors.secondary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    followActionText: {color: '#fff', fontSize: 15, fontWeight: '600'},
    outlineAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: Colors.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    outlineActionText: {color: Colors.primary, fontSize: 15, fontWeight: '600'},
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
    grid: {padding: 2},
    gridItem: {width: '33.33%', aspectRatio: 1, padding: 1},
    gridImg: {
      flex: 1,
      backgroundColor: Colors.surfaceSecondary,
      borderRadius: BorderRadius.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridImgText: {fontSize: 28},
    gridImage: {
      flex: 1,
      width: '100%',
      height: '100%',
      borderRadius: BorderRadius.xs,
      backgroundColor: Colors.surfaceSecondary,
    },
    gridTextItem: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xs,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.borderLight,
    },
    gridCaption: {fontSize: 12, color: Colors.textPrimary},
    gridOverlay: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      flexDirection: 'row',
      gap: 8,
    },
    gridLikes: {
      fontSize: 11,
      color: '#fff',
      fontWeight: '600',
      textShadowColor: '#000',
      textShadowRadius: 2,
    },
    gridComments: {
      fontSize: 11,
      color: '#fff',
      fontWeight: '600',
      textShadowColor: '#000',
      textShadowRadius: 2,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyText: {fontSize: 16, color: Colors.textTertiary},
    modalOverlay: {
      flex: 1,
      backgroundColor: Colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: Colors.surface,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    modalTitle: {fontSize: 18, fontWeight: '700', color: Colors.textPrimary},
    modalCancel: {fontSize: 15, color: Colors.textTertiary},
    modalSave: {fontSize: 15, color: Colors.primary, fontWeight: '700'},
    modalBody: {padding: Spacing.base},
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.base,
    },
    input: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.base,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: Colors.textPrimary,
      backgroundColor: Colors.surfaceSecondary,
    },
    avatarPicker: {
      alignSelf: 'center',
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: Colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: Spacing.sm,
    },
    avatarPreview: {width: 92, height: 92},
    avatarPickerText: {fontSize: 13, color: Colors.primary, fontWeight: '600'},
    qrContainer: {
      alignItems: 'center',
      padding: Spacing.xl,
      backgroundColor: Colors.surface,
      margin: Spacing.base,
      borderRadius: BorderRadius.xl,
    },
    qrImage: {width: 280, height: 280, marginBottom: Spacing.base},
    listHeader: {
      backgroundColor: Colors.surface,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: 16,
      paddingHorizontal: Spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    listTitle: {fontSize: 22, fontWeight: '700', color: Colors.textPrimary},
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      backgroundColor: Colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: Colors.borderLight,
    },
    userAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    userAvatarText: {color: '#fff', fontSize: 18, fontWeight: '700'},
    onlineSmall: {
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
    userInfo: {flex: 1},
    userName: {fontSize: 15, fontWeight: '600', color: Colors.textPrimary},
    userUsername: {fontSize: 13, color: Colors.textTertiary},
    followBtnSmall: {
      backgroundColor: Colors.primary,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.base,
      borderRadius: BorderRadius.sm,
    },
    followBtnTextSmall: {color: '#fff', fontSize: 12, fontWeight: '600'},
    outlineBtnSmall: {
      borderWidth: 1,
      borderColor: Colors.primary,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.base,
      borderRadius: BorderRadius.sm,
    },
    outlineBtnTextSmall: {
      color: Colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
