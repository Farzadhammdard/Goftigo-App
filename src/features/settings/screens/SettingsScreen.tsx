import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert} from 'react-native';
import {useSettingsStore} from '../store/settingsStore';
import {useAuthStore} from '../../../store/authStore';
import {useThemeStore} from '../../../store/themeStore';
import {useTheme} from '../../../shell/providers/ThemeProvider';

const categories = [
  {key: 'account', icon: '👤', title: 'Account', subtitle: 'Phone, username, password'},
  {key: 'privacy', icon: '🔒', title: 'Privacy', subtitle: 'Who can see what'},
  {key: 'security', icon: '🛡️', title: 'Security', subtitle: 'Password, 2FA, sessions'},
  {key: 'notifications', icon: '🔔', title: 'Notifications', subtitle: 'What you get notified about'},
  {key: 'chat', icon: '💬', title: 'Chats', subtitle: 'Chat settings & preferences'},
  {key: 'media', icon: '📦', title: 'Media & Storage', subtitle: 'Auto-download, cache'},
  {key: 'data', icon: '📊', title: 'Data Usage', subtitle: 'Mobile & Wi-Fi usage'},
  {key: 'appearance', icon: '🎨', title: 'Appearance', subtitle: 'Theme, font size'},
  {key: 'language', icon: '🌐', title: 'Language', subtitle: 'English, فارسی, دری'},
  {key: 'nearby', icon: '📡', title: 'Nearby & Discovery', subtitle: 'Nearby visibility'},
  {key: 'devices', icon: '📱', title: 'Devices', subtitle: 'Linked devices & sessions'},
  {key: 'blocked', icon: '🚫', title: 'Blocked Users', subtitle: 'Manage blocked users'},
  {key: 'help', icon: '🆘', title: 'Help & Support', subtitle: 'FAQ, contact support'},
  {key: 'about', icon: 'ℹ️', title: 'About Goftegoo', subtitle: 'Version, terms, licenses'},
];

export function SettingsScreen({navigation}: any) {
  const {colors, isDark} = useTheme();
  const loadAll = useSettingsStore(s => s.loadAll);
  const appearance = useSettingsStore(s => s.settings.appearance);
  const setTheme = useThemeStore(s => s.setMode);

  useEffect(() => {
    loadAll();
  }, []);
  useEffect(() => {
    if (appearance?.theme) setTheme(appearance.theme);
  }, [appearance?.theme, setTheme]);

  const navigateTo = (key: string) => {
    navigation.navigate('SettingsDetail', {category: key});
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Logout', style: 'destructive', onPress: () => useAuthStore.getState().logout()},
    ]);
  };

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {backgroundColor: isDark ? colors.surfaceElevated : colors.primary}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {categories.map((cat) => (
        <TouchableOpacity key={cat.key} style={[styles.row, {backgroundColor: colors.surface, borderBottomColor: colors.border}]} onPress={() => navigateTo(cat.key)} activeOpacity={0.6}>
          <Text style={styles.icon}>{cat.icon}</Text>
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, {color: colors.text}]}>{cat.title}</Text>
            <Text style={[styles.rowSubtitle, {color: colors.textSecondary}]}>{cat.subtitle}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.logoutRow, {backgroundColor: colors.surface, borderColor: colors.error}]} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  header: {backgroundColor: '#00B8AA', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'},
  backBtn: {padding: 8, marginRight: 8},
  backText: {color: '#fff', fontSize: 24},
  headerTitle: {fontSize: 24, fontWeight: 'bold', color: '#fff'},
  row: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC'},
  icon: {fontSize: 22, width: 36, textAlign: 'center'},
  rowContent: {flex: 1, marginLeft: 4},
  rowTitle: {fontSize: 16, fontWeight: '500', color: '#101828'},
  rowSubtitle: {fontSize: 13, color: '#98A2B3', marginTop: 2},
  chevron: {fontSize: 22, color: '#c0c0c0', fontWeight: '300'},
  logoutRow: {marginTop: 20, marginHorizontal: 16, paddingVertical: 16, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca'},
  logoutText: {fontSize: 16, fontWeight: '600', color: '#EF4444'},
});
