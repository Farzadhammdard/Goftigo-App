import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {formatRelativeTime} from '../../../core/utils/formatters';

const API = Config.API.BASE_URL;

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  is_read: number;
  created_at: number;
}

const NOTIF_ICONS: Record<string, string> = {
  friend_request: '👤',
  friend_accepted: '✅',
  new_message: '💬',
  message_delivered: '📨',
  post_approved: '📰',
  post_rejected: '🚫',
  like: '❤️',
  comment: '💬',
  admin_reply: '👨‍💼',
};

export function NotificationsScreen({navigation}: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const token = useAuthStore(s => s.tokens?.accessToken);
  const headers = token ? {Authorization: `Bearer ${token}`} : {};

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications`, {headers});
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications || []);
        setUnread(data.data.unread || 0);
      }
    } catch (e) {
      console.error('Load notifications error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      await fetch(`${API}/api/notifications/read-all`, {method: 'POST', headers});
      setNotifications(prev => prev.map(n => ({...n, is_read: 1})));
      setUnread(0);
    } catch {}
  };

  const handlePress = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await fetch(`${API}/api/notifications/${notif.id}/read`, {method: 'POST', headers});
        setNotifications(prev => prev.map(n => n.id === notif.id ? {...n, is_read: 1} : n));
        setUnread(prev => Math.max(0, prev - 1));
      } catch {}
    }
    // Navigate based on notification type
    const data = notif.data ? JSON.parse(notif.data) : null;
    if (notif.type === 'friend_request' || notif.type === 'friend_accepted') {
      if (data?.fromUserId) {
        navigation.navigate('ProfileTab', {screen: 'NearbyTab'});
      }
    } else if (notif.type === 'new_message' || notif.type === 'admin_reply') {
      if (data?.conversationId) {
        navigation.navigate('ChatsTab', {screen: 'Chat', params: {conversationId: data.conversationId}});
      }
    }
  };

  const renderNotif = ({item}: {item: Notification}) => (
    <TouchableOpacity
      style={[s.notifItem, !item.is_read && s.notifUnread]}
      onPress={() => handlePress(item)}>
      <Text style={s.notifIcon}>{NOTIF_ICONS[item.type] || '🔔'}</Text>
      <View style={s.notifContent}>
        <Text style={[s.notifTitle, !item.is_read && s.notifTitleBold]}>{item.title}</Text>
        {item.body ? <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={s.notifTime}>{formatRelativeTime(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={s.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : notifications.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderNotif}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); load();}} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {backgroundColor: '#6366f1', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  markAllText: {color: '#fff', fontSize: 14, opacity: 0.9},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 18, fontWeight: '600', color: '#999'},
  notifItem: {flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee'},
  notifUnread: {backgroundColor: '#f0f0ff'},
  notifIcon: {fontSize: 28, marginRight: 12, width: 36, textAlign: 'center'},
  notifContent: {flex: 1},
  notifTitle: {fontSize: 14, color: '#333'},
  notifTitleBold: {fontWeight: '700'},
  notifBody: {fontSize: 13, color: '#666', marginTop: 2},
  notifTime: {fontSize: 11, color: '#999', marginTop: 4},
  unreadDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1', marginLeft: 8},
});
