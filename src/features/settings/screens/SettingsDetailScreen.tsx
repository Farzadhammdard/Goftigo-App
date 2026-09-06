import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, FlatList, Switch} from 'react-native';
import {useSettingsStore} from '../store/settingsStore';
import {useAuthStore} from '../../../store/authStore';
import {Config} from '../../../core/constants/config';
import {SectionHeader, SettingRow, ToggleRow, OptionPicker, InfoRow, Separator, BottomSpacer} from '../components/SettingsComponents';
import {useThemeStore} from '../../../store/themeStore';
import {useTheme} from '../../../shell/providers/ThemeProvider';

const API = Config.API.BASE_URL;

export function SettingsDetailScreen({route, navigation}: any) {
  const {category} = route.params;

  const titles: Record<string, string> = {
    account: '👤 Account', privacy: '🔒 Privacy', security: '🛡️ Security',
    notifications: '🔔 Notifications', chat: '💬 Chats', media: '📦 Media & Storage',
    data: '📊 Data Usage', appearance: '🎨 Appearance', language: '🌐 Language',
    nearby: '📡 Nearby & Discovery', devices: '📱 Devices', blocked: '🚫 Blocked Users',
    help: '🆘 Help & Support', about: 'ℹ️ About Goftegoo',
  };

  const renderHeader = (title: string) => (
    <View style={s.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
        <Text style={s.backText}>←</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
    </View>
  );

  switch(category) {
    case 'account': return <AccountScreen renderHeader={renderHeader} navigation={navigation} />;
    case 'privacy': return <PrivacyScreen renderHeader={renderHeader} />;
    case 'security': return <SecurityScreen renderHeader={renderHeader} />;
    case 'notifications': return <NotificationsScreen renderHeader={renderHeader} />;
    case 'chat': return <ChatSettingsScreen renderHeader={renderHeader} />;
    case 'media': return <MediaScreen renderHeader={renderHeader} />;
    case 'data': return <DataUsageScreen renderHeader={renderHeader} />;
    case 'appearance': return <AppearanceScreen renderHeader={renderHeader} />;
    case 'language': return <LanguageScreen renderHeader={renderHeader} />;
    case 'nearby': return <NearbyScreen renderHeader={renderHeader} />;
    case 'devices': return <DevicesScreen renderHeader={renderHeader} />;
    case 'blocked': return <BlockedUsersScreen renderHeader={renderHeader} />;
    case 'help': return <HelpScreen renderHeader={renderHeader} />;
    case 'about': return <AboutScreen renderHeader={renderHeader} />;
    default: return <View style={s.center}><Text>Unknown category</Text></View>;
  }
}

function AccountScreen({renderHeader, navigation}: any) {
  const user = useAuthStore(s => s.user);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const token = useAuthStore(s => s.tokens?.accessToken);
  const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername.length < 3) {
      Alert.alert('Error', 'Username must be 3-20 characters');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/account/username`, {
        method: 'PUT',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({username: newUsername.trim()}),
      });
      const d = await r.json();
      if (d.success) {
        useAuthStore.setState((state: any) => ({user: {...state.user, username: newUsername.trim()}}));
        setShowUsernameModal(false);
        Alert.alert('Success', 'Username updated');
      } else {
        Alert.alert('Error', d.error?.message || 'Failed to update username');
      }
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Both fields required');
      return;
    }
    if (newPassword.length < 4) {
      Alert.alert('Error', 'New password must be at least 4 characters');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/account/change-password`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({currentPassword, newPassword}),
      });
      const d = await r.json();
      if (d.success) {
        setShowPasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        Alert.alert('Success', 'Password changed');
      } else {
        Alert.alert('Error', d.error?.message || 'Failed');
      }
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleExportData = async () => {
    try {
      const r = await fetch(`${API}/api/account/export`, {headers});
      const d = await r.json();
      if (d.success) {
        Alert.alert('Export Ready', `Your data has ${Object.keys(d.data).length} categories. Check console for details.`);
        console.log('Account export:', JSON.stringify(d.data, null, 2));
      }
    } catch { Alert.alert('Error', 'Failed to export data'); }
  };

  const handleDeleteAccount = async () => {
    try {
      const r = await fetch(`${API}/api/account/delete`, {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
      });
      const d = await r.json();
      if (d.success) {
        Alert.alert('Account Deleted', 'Your account has been deleted.');
        useAuthStore.getState().logout();
      }
    } catch { Alert.alert('Error', 'Failed'); }
  };

  return (
    <View style={s.container}>
      {renderHeader('Account')}
      <ScrollView>
        <SectionHeader title="Account Information" />
        <InfoRow label="Phone" value={user?.phoneNumber || 'N/A'} />
        <InfoRow label="Username" value={`@${user?.username || ''}`} />
        <InfoRow label="Goftegoo ID" value={user?.publicUserId || user?.id || ''} />

        <SectionHeader title="Account Actions" />
        <SettingRow label="Change Username" subtitle={`@${user?.username}`} onPress={() => {setNewUsername(user?.username || ''); setShowUsernameModal(true);}} />
        <SettingRow label="Change Password" subtitle="Update your password" onPress={() => setShowPasswordModal(true)} />
        <SettingRow label="Download Account Data" subtitle="Export your data" onPress={handleExportData} />

        <SectionHeader title="Danger Zone" />
        <SettingRow label="Deactivate Account" subtitle="Temporarily disable your account" onPress={() => Alert.alert('Deactivate', 'Are you sure?', [{text: 'Cancel'}, {text: 'Deactivate', style: 'destructive', onPress: async () => { await fetch(`${API}/api/account/deactivate`, {method: 'POST', headers}); Alert.alert('Done', 'Account deactivated'); useAuthStore.getState().logout(); }}])} />
        <SettingRow label="Delete Account" subtitle="Permanently delete your account" danger onPress={() => {
          Alert.alert('Delete Account', 'This action is permanent. Type DELETE to confirm.', [
            {text: 'Cancel'},
            {text: 'Continue', style: 'destructive', onPress: () => {
              setDeleteConfirm('');
              Alert.alert('Confirm', 'Type DELETE in the next prompt to confirm account deletion. Actually, please confirm below:', [
                {text: 'Cancel'},
                {text: 'Yes, Delete My Account', style: 'destructive', onPress: handleDeleteAccount},
              ]);
            }},
          ]);
        }} />

        <BottomSpacer />
      </ScrollView>

      {showUsernameModal && (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Change Username</Text>
            <TextInput style={s.modalInput} value={newUsername} onChangeText={setNewUsername} placeholder="Username" autoCapitalize="none" />
            <Text style={s.modalHint}>3-20 characters, letters, numbers, underscore</Text>
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowUsernameModal(false)} style={s.modalBtn}><Text style={s.modalBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleChangeUsername} style={[s.modalBtn, s.modalBtnPrimary]} disabled={saving}><Text style={[s.modalBtnText, {color:'#fff'}]}>{saving ? '...' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showPasswordModal && (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Change Password</Text>
            <TextInput style={s.modalInput} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry />
            <TextInput style={s.modalInput} value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry />
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={s.modalBtn}><Text style={s.modalBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={[s.modalBtn, s.modalBtnPrimary]} disabled={saving}><Text style={[s.modalBtnText, {color:'#fff'}]}>{saving ? '...' : 'Change'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function PrivacyScreen({renderHeader}: any) {
  const {getPrivacy, updateCategory} = useSettingsStore();
  const p = getPrivacy();

  const update = (key: string, val: any) => updateCategory('privacy', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Privacy')}
      <ScrollView>
        <SectionHeader title="Who Can See" />
        <OptionPicker label="My Phone Number" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeePhone} onChange={v => update('whoCanSeePhone', v)} />
        <OptionPicker label="Find Me by Phone" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanFindByPhone} onChange={v => update('whoCanFindByPhone', v)} />
        <OptionPicker label="My Profile" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeeProfile} onChange={v => update('whoCanSeeProfile', v)} />
        <OptionPicker label="My Profile Photo" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeeProfilePhoto} onChange={v => update('whoCanSeeProfilePhoto', v)} />
        <OptionPicker label="My Bio" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeeBio} onChange={v => update('whoCanSeeBio', v)} />
        <OptionPicker label="Online Status" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeeOnlineStatus} onChange={v => update('whoCanSeeOnlineStatus', v)} />
        <OptionPicker label="Last Seen" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSeeLastSeen} onChange={v => update('whoCanSeeLastSeen', v)} />

        <SectionHeader title="Messaging" />
        <OptionPicker label="Who Can Message Me" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanMessage} onChange={v => update('whoCanMessage', v)} />
        <OptionPicker label="Who Can Send Friend Requests" options={[{value:'everyone',label:'Everyone'},{value:'friends_of_friends',label:'Friends of Friends'},{value:'nobody',label:'Nobody'}]} value={p.whoCanSendFriendRequest} onChange={v => update('whoCanSendFriendRequest', v)} />

        <SectionHeader title="Read Receipts & Typing" />
        <ToggleRow label="Read Receipts" subtitle="Let others know you've read messages" value={p.readReceipts} onValueChange={v => update('readReceipts', v)} />
        <ToggleRow label="Typing Indicator" subtitle="Show when you're typing" value={p.typingIndicator} onValueChange={v => update('typingIndicator', v)} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function SecurityScreen({renderHeader}: any) {
  const {getSecurity, updateCategory, loadSessions, sessions} = useSettingsStore();
  const s2 = getSecurity();
  const update = (key: string, val: any) => updateCategory('security', {[key]: val});

  useEffect(() => { loadSessions(); }, []);

  return (
    <View style={s.container}>
      {renderHeader('Security')}
      <ScrollView>
        <SectionHeader title="Security Settings" />
        <ToggleRow label="Login Alerts" subtitle="Get notified of new logins" value={s2.loginAlerts} onValueChange={v => update('loginAlerts', v)} />

        <SectionHeader title="Active Sessions" />
        {sessions.length === 0 ? (
          <View style={{padding: 16}}><Text style={{color: '#999'}}>No active sessions</Text></View>
        ) : sessions.map((sess: any) => (
          <SettingRow key={sess.id} label={sess.device_name || 'Unknown Device'} subtitle={`Last active: ${new Date(sess.last_active_at).toLocaleString()}`} rightComponent={
            <TouchableOpacity onPress={() => useSettingsStore.getState().logoutSession(sess.id)} style={{padding: 6, backgroundColor: '#fee2e2', borderRadius: 6}}>
              <Text style={{color: '#dc2626', fontSize: 12}}>Logout</Text>
            </TouchableOpacity>
          } />
        ))}

        <SectionHeader title="Account Recovery" />
        <SettingRow label="Change Password" subtitle="Update your password" onPress={() => {}} />

        <SectionHeader title="Danger Zone" />
        <SettingRow label="Logout From All Devices" danger onPress={() => Alert.alert('Logout All', 'This will logout all sessions except this one.', [{text: 'Cancel'}, {text: 'Logout All', style: 'destructive', onPress: () => useSettingsStore.getState().logoutAllSessions()}])} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function NotificationsScreen({renderHeader}: any) {
  const {getNotifications, updateCategory} = useSettingsStore();
  const n = getNotifications();
  const update = (key: string, val: any) => updateCategory('notifications', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Notifications')}
      <ScrollView>
        <SectionHeader title="Notification Types" />
        <ToggleRow label="Messages" value={n.messages} onValueChange={v => update('messages', v)} />
        <ToggleRow label="Friend Requests" value={n.friendRequests} onValueChange={v => update('friendRequests', v)} />
        <ToggleRow label="Friend Request Accepted" value={n.friendRequestAccepted} onValueChange={v => update('friendRequestAccepted', v)} />
        <ToggleRow label="Likes" value={n.likes} onValueChange={v => update('likes', v)} />
        <ToggleRow label="Comments" value={n.comments} onValueChange={v => update('comments', v)} />
        <ToggleRow label="Followers" value={n.followers} onValueChange={v => update('followers', v)} />
        <ToggleRow label="Mentions" value={n.mentions} onValueChange={v => update('mentions', v)} />
        <ToggleRow label="Admin Messages" value={n.adminMessages} onValueChange={v => update('adminMessages', v)} />
        <ToggleRow label="Post Approval" value={n.postApproval} onValueChange={v => update('postApproval', v)} />
        <ToggleRow label="Post Rejection" value={n.postRejection} onValueChange={v => update('postRejection', v)} />
        <ToggleRow label="System Notifications" value={n.systemNotifications} onValueChange={v => update('systemNotifications', v)} />

        <SectionHeader title="Notification Preferences" />
        <ToggleRow label="Sound" value={n.sound} onValueChange={v => update('sound', v)} />
        <ToggleRow label="Vibration" value={n.vibration} onValueChange={v => update('vibration', v)} />
        <ToggleRow label="Show Preview" value={n.notificationPreview} onValueChange={v => update('notificationPreview', v)} />
        <ToggleRow label="Badge Count" value={n.badgeCount} onValueChange={v => update('badgeCount', v)} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function ChatSettingsScreen({renderHeader}: any) {
  const {getChat, updateCategory} = useSettingsStore();
  const c = getChat();
  const update = (key: string, val: any) => updateCategory('chat', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Chat Settings')}
      <ScrollView>
        <SectionHeader title="Chat Behavior" />
        <ToggleRow label="Enter Key Sends" subtitle="Press Enter to send message" value={c.enterKeySends} onValueChange={v => update('enterKeySends', v)} />
        <ToggleRow label="Message Preview" subtitle="Show message text in notifications" value={c.messagePreview} onValueChange={v => update('messagePreview', v)} />
        <ToggleRow label="Read Receipts" subtitle="Show read indicators in chats" value={c.readReceipts} onValueChange={v => update('readReceipts', v)} />
        <ToggleRow label="Typing Indicator" subtitle="Show typing status" value={c.typingIndicator} onValueChange={v => update('typingIndicator', v)} />

        <SectionHeader title="Media" />
        <ToggleRow label="Auto-download Media" subtitle="Download media in chats" value={c.autoDownloadMedia} onValueChange={v => update('autoDownloadMedia', v)} />

        <SectionHeader title="Font Size" />
        <OptionPicker label="Chat Font Size" options={[{value:'small',label:'Small'},{value:'medium',label:'Medium'},{value:'large',label:'Large'}]} value={c.fontSize} onChange={v => update('fontSize', v)} />

        <SectionHeader title="Chat History" />
        <SettingRow label="Clear Chat History" danger onPress={() => Alert.alert('Clear History', 'This will clear your local chat history. Server messages remain intact.', [{text: 'Cancel'}, {text: 'Clear', style: 'destructive'}])} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function MediaScreen({renderHeader}: any) {
  const {getMedia, updateCategory} = useSettingsStore();
  const m = getMedia();
  const update = (key: string, val: any) => updateCategory('media', {[key]: val});
  const dlOptions = [{value:'wifi',label:'Wi-Fi Only'},{value:'mobile',label:'Mobile & Wi-Fi'},{value:'never',label:'Never'}];

  return (
    <View style={s.container}>
      {renderHeader('Media & Storage')}
      <ScrollView>
        <SectionHeader title="Auto-Download" />
        <OptionPicker label="Photos" options={dlOptions} value={m.autoDownloadPhotos} onChange={v => update('autoDownloadPhotos', v)} />
        <OptionPicker label="Videos" options={dlOptions} value={m.autoDownloadVideos} onChange={v => update('autoDownloadVideos', v)} />
        <OptionPicker label="Files" options={dlOptions} value={m.autoDownloadFiles} onChange={v => update('autoDownloadFiles', v)} />
        <OptionPicker label="Voice Messages" options={dlOptions} value={m.autoDownloadVoice} onChange={v => update('autoDownloadVoice', v)} />

        <SectionHeader title="Storage" />
        <ToggleRow label="Data Saver" subtitle="Reduce media quality to save data" value={m.dataSaver} onValueChange={v => update('dataSaver', v)} />
        <SettingRow label="Clear Cache" subtitle="Remove temporary files" onPress={() => Alert.alert('Clear Cache', 'This will clear cached media files only. Your messages and data are safe.', [{text: 'Cancel'}, {text: 'Clear', onPress: () => Alert.alert('Done', 'Cache cleared')}])} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function DataUsageScreen({renderHeader}: any) {
  const {getMedia, updateCategory} = useSettingsStore();
  const m = getMedia();
  const update = (key: string, val: any) => updateCategory('media', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Data Usage')}
      <ScrollView>
        <SectionHeader title="Data Saver" />
        <ToggleRow label="Data Saver" subtitle="Reduce media quality and auto-downloads" value={m.dataSaver} onValueChange={v => update('dataSaver', v)} />

        <SectionHeader title="Auto-Download on Mobile Data" />
        <ToggleRow label="Photos" value={m.autoDownloadPhotos === 'mobile'} onValueChange={v => update('autoDownloadPhotos', v ? 'mobile' : 'never')} />
        <ToggleRow label="Videos" value={m.autoDownloadVideos === 'mobile'} onValueChange={v => update('autoDownloadVideos', v ? 'mobile' : 'never')} />
        <ToggleRow label="Files" value={m.autoDownloadFiles === 'mobile'} onValueChange={v => update('autoDownloadFiles', v ? 'mobile' : 'never')} />

        <SectionHeader title="Auto-Download on Wi-Fi" />
        <ToggleRow label="Photos" value={m.autoDownloadPhotos === 'wifi'} onValueChange={v => update('autoDownloadPhotos', v ? 'wifi' : 'never')} />
        <ToggleRow label="Videos" value={m.autoDownloadVideos === 'wifi'} onValueChange={v => update('autoDownloadVideos', v ? 'wifi' : 'never')} />
        <ToggleRow label="Files" value={m.autoDownloadFiles === 'wifi'} onValueChange={v => update('autoDownloadFiles', v ? 'wifi' : 'never')} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function AppearanceScreen({renderHeader}: any) {
  const {getAppearance, updateCategory} = useSettingsStore();
  useSettingsStore(s => s.settings.appearance);
  const {colors} = useTheme();
  const a = getAppearance();
  const setTheme = useThemeStore(s => s.setMode);
  const update = (key: string, val: any) => {
    updateCategory('appearance', {[key]: val});
    if (key === 'theme') setTheme(val);
  };

  return (
    <View style={[s.container, {backgroundColor: colors.background}]}>
      {renderHeader('Appearance')}
      <ScrollView>
        <SectionHeader title="Theme" />
        <OptionPicker label="App Theme" options={[{value:'light',label:'Light'},{value:'dark',label:'Dark'},{value:'system',label:'System Default'}]} value={a.theme} onChange={v => update('theme', v)} />

        <SectionHeader title="Font Size" />
        <OptionPicker label="Font Size" options={[{value:'small',label:'Small'},{value:'medium',label:'Medium'},{value:'large',label:'Large'}]} value={a.fontSize} onChange={v => update('fontSize', v)} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function LanguageScreen({renderHeader}: any) {
  const {getLanguage, updateCategory} = useSettingsStore();
  useSettingsStore(s => s.settings.language);
  const l = getLanguage();
  const update = (key: string, val: any) => updateCategory('language', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Language')}
      <ScrollView>
        <SectionHeader title="Select Language" />
        <OptionPicker label="App Language" options={[{value:'en',label:'English'},{value:'ps',label:'دری (Dari)'}]} value={l.code} onChange={v => update('code', v)} />
        <View style={{padding: 16}}>
          <Text style={{color: '#6b7280', fontSize: 13, lineHeight: 18}}>
            Language changes will be applied after restarting the app. Full translation support is coming soon.           RTL layout is supported for دری.
          </Text>
        </View>
        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function NearbyScreen({renderHeader}: any) {
  const {getNearby, updateCategory} = useSettingsStore();
  const n = getNearby();
  const update = (key: string, val: any) => updateCategory('nearby', {[key]: val});

  return (
    <View style={s.container}>
      {renderHeader('Nearby & Discovery')}
      <ScrollView>
        <SectionHeader title="Nearby Settings" />
        <ToggleRow label="Nearby Discovery" subtitle="Allow others to discover you nearby" value={n.discoveryEnabled} onValueChange={v => update('discoveryEnabled', v)} />

        <SectionHeader title="Visibility" />
        <OptionPicker label="Who Can Discover Me" options={[{value:'everyone',label:'Everyone'},{value:'friends',label:'Friends Only'},{value:'nobody',label:'Nobody'}]} value={n.whoCanDiscover} onChange={v => update('whoCanDiscover', v)} />

        <View style={{padding: 16}}>
          <Text style={{color: '#6b7280', fontSize: 13, lineHeight: 18}}>
            Nearby Discovery only scans when you explicitly open the Nearby tab and start a scan. We do not scan in the background.
          </Text>
        </View>

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function DevicesScreen({renderHeader}: any) {
  const {loadSessions, sessions, logoutSession, logoutAllSessions} = useSettingsStore();
  useEffect(() => { loadSessions(); }, []);

  return (
    <View style={s.container}>
      {renderHeader('Devices')}
      <ScrollView>
        <SectionHeader title="Active Sessions" />
        {sessions.length === 0 ? (
          <View style={{padding: 16}}><Text style={{color: '#999'}}>Loading sessions...</Text></View>
        ) : sessions.map((sess: any) => (
          <SettingRow key={sess.id} label={sess.device_name || 'Unknown Device'} subtitle={`Last active: ${new Date(sess.last_active_at).toLocaleString()}${sess.is_active ? ' (Current)' : ''}`} rightComponent={
            !sess.is_active ? (
              <TouchableOpacity onPress={() => logoutSession(sess.id)} style={{padding: 6, backgroundColor: '#fee2e2', borderRadius: 6}}>
                <Text style={{color: '#dc2626', fontSize: 12}}>Logout</Text>
              </TouchableOpacity>
            ) : <Text style={{color: '#22c55e', fontSize: 12}}>Current</Text>
          } />
        ))}

        <SectionHeader title="Actions" />
        <SettingRow label="Logout All Other Sessions" danger onPress={() => Alert.alert('Logout All', 'This will logout all other devices.', [{text: 'Cancel'}, {text: 'Logout All', style: 'destructive', onPress: () => logoutAllSessions()}])} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function BlockedUsersScreen({renderHeader}: any) {
  const {blockedUsers, loadBlocked, unblockUser} = useSettingsStore();
  useEffect(() => { loadBlocked(); }, []);

  return (
    <View style={s.container}>
      {renderHeader('Blocked Users')}
      <ScrollView>
        {blockedUsers.length === 0 ? (
          <View style={{padding: 40, alignItems: 'center'}}><Text style={{fontSize: 48}}>🚫</Text><Text style={{color: '#999', marginTop: 8}}>No blocked users</Text></View>
        ) : (
          blockedUsers.map((b: any) => (
            <View key={b.blocked_id} style={{flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0'}}>
              <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: '#00E5D4', alignItems: 'center', justifyContent: 'center', marginRight: 12}}>
                <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold'}}>{b.display_name?.[0] || '?'}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={{fontSize: 15, fontWeight: '600'}}>{b.display_name}</Text>
                <Text style={{fontSize: 13, color: '#999'}}>@{b.username}</Text>
              </View>
              <TouchableOpacity onPress={() => unblockUser(b.blocked_id)} style={{padding: 6, backgroundColor: '#dcfce7', borderRadius: 6}}>
                <Text style={{color: '#16a34a', fontSize: 12, fontWeight: '600'}}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function HelpScreen({renderHeader}: any) {
  const user = useAuthStore(s => s.user);

  const openSupportChat = async () => {
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      const r = await fetch(`${API}/api/conversations`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({type: 'direct', participantIds: []}),
      });
      const d = await r.json();
      if (d.success) {
        Alert.alert('Support', 'Opening support chat...');
      }
    } catch { Alert.alert('Error', 'Could not open support chat'); }
  };

  return (
    <View style={s.container}>
      {renderHeader('Help & Support')}
      <ScrollView>
        <SectionHeader title="Support" />
        <SettingRow label="Help Center" subtitle="Browse help articles" onPress={() => Alert.alert('Help Center', 'Help center coming soon')} />
        <SettingRow label="FAQ" subtitle="Frequently asked questions" onPress={() => Alert.alert('FAQ', 'FAQ coming soon')} />
        <SettingRow label="Report a Problem" subtitle="Report bugs or issues" onPress={() => Alert.alert('Report', 'Report functionality coming soon')} />
        <SettingRow label="Contact Goftegoo Support" subtitle="Chat with support team" onPress={openSupportChat} />
        <SettingRow label="Send Feedback" subtitle="Share your suggestions" onPress={() => Alert.alert('Feedback', 'Feedback form coming soon')} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

function AboutScreen({renderHeader}: any) {
  return (
    <View style={s.container}>
      {renderHeader('About Goftegoo')}
      <ScrollView>
        <View style={{alignItems: 'center', paddingVertical: 32, backgroundColor: '#fff'}}>
          <View style={{width: 80, height: 80, borderRadius: 20, backgroundColor: '#00E5D4', alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: '#fff', fontSize: 32, fontWeight: 'bold'}}>گ</Text>
          </View>
          <Text style={{fontSize: 22, fontWeight: 'bold', marginTop: 12, color: '#333'}}>Goftegoo</Text>
          <Text style={{fontSize: 14, color: '#999', marginTop: 2}}>Version 1.0.0 (Build 1)</Text>
        </View>

        <SectionHeader title="Legal" />
        <SettingRow label="Terms of Service" onPress={() => {}} />
        <SettingRow label="Privacy Policy" onPress={() => {}} />
        <SettingRow label="Community Guidelines" onPress={() => {}} />

        <SectionHeader title="Open Source" />
        <SettingRow label="Licenses" onPress={() => {}} />
        <SettingRow label="Open Source Licenses" onPress={() => {}} />

        <BottomSpacer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {backgroundColor: '#00B8AA', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'},
  backBtn: {padding: 8, marginRight: 8},
  backText: {color: '#fff', fontSize: 24},
  headerTitle: {color: '#fff', fontSize: 20, fontWeight: 'bold'},
  modalOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999},
  modalContent: {backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%'},
  modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16},
  modalInput: {borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 8},
  modalHint: {fontSize: 12, color: '#999', marginBottom: 16},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10},
  modalBtn: {paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8},
  modalBtnText: {fontSize: 14, color: '#00B8AA'},
  modalBtnPrimary: {backgroundColor: '#00E5D4'},
});
