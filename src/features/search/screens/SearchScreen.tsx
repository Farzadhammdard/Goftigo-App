import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';

interface SearchResult {
  id: string;
  public_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_online: number;
}

export function SearchScreen({navigation}: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.tokens?.accessToken);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !token) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `${Config.API.BASE_URL}/api/users/search?q=${encodeURIComponent(q.trim())}`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      const data = await res.json();
      if (data.success) {
        setResults(data.data.users || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const startChat = async (otherUser: SearchResult) => {
    if (!token) return;
    try {
      const res = await fetch(`${Config.API.BASE_URL}/api/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({type: 'direct', participantIds: [otherUser.id]}),
      });
      const data = await res.json();
      if (data.success) {
        navigation.navigate('ChatsTab', {
          screen: 'Chat',
          params: {
            conversationId: data.data.conversationId,
            participantName: otherUser.display_name,
            participantAvatar: otherUser.avatar_url,
          },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not start chat');
    }
  };

  const viewProfile = (userId: string) => {
    // TODO: Navigate to user profile screen
    Alert.alert('Profile', `User ID: ${userId}`);
  };

  const renderResult = ({item}: {item: SearchResult}) => {
    const isMe = item.id === user?.id;
    return (
      <View style={styles.resultItem}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.display_name?.[0] || '?'}</Text>
          {item.is_online === 1 && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.resultInfo}>
          <Text style={styles.resultName}>{item.display_name}</Text>
          <Text style={styles.resultUsername}>@{item.username}</Text>
          <Text style={styles.resultId}>{item.public_user_id}</Text>
          {item.bio ? <Text style={styles.resultBio} numberOfLines={1}>{item.bio}</Text> : null}
        </View>
        {!isMe && (
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.msgBtn} onPress={() => startChat(item)}>
              <Text style={styles.msgBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileBtn} onPress={() => viewProfile(item.id)}>
              <Text style={styles.profileBtnText}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, username, phone, or ID..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderResult}
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No users found</Text>
                <Text style={styles.emptySub}>Try a different search term</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyText}>Search for users</Text>
                <Text style={styles.emptySub}>Find people by name, username, phone, or Goftegoo ID</Text>
              </View>
            )
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingTop: 48,
    backgroundColor: '#6366f1',
    gap: 8,
  },
  backBtn: {padding: 8},
  backText: {color: '#fff', fontSize: 24},
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  clearBtn: {color: '#fff', fontSize: 18, padding: 8},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  resultInfo: {flex: 1},
  resultName: {fontSize: 16, fontWeight: '600', color: '#333'},
  resultUsername: {fontSize: 13, color: '#6366f1', marginTop: 1},
  resultId: {fontSize: 11, color: '#999', marginTop: 1},
  resultBio: {fontSize: 12, color: '#666', marginTop: 2},
  resultActions: {gap: 6},
  msgBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  msgBtnText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  profileBtn: {
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileBtnText: {color: '#6366f1', fontSize: 13, fontWeight: '600'},
  emptyContainer: {flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 18, fontWeight: '600', color: '#333'},
  emptySub: {fontSize: 13, color: '#999', marginTop: 4, textAlign: 'center'},
});
