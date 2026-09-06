import {create} from 'zustand';
import {apiClient} from '../../../core/services/apiClient';

// Default settings
const defaultSettings: Record<string, any> = {
  privacy: {
    whoCanSeePhone: 'friends',
    whoCanFindByPhone: 'everyone',
    whoCanMessage: 'everyone',
    whoCanSendFriendRequest: 'everyone',
    whoCanSeeProfile: 'everyone',
    whoCanSeeProfilePhoto: 'everyone',
    whoCanSeeBio: 'everyone',
    whoCanSeeOnlineStatus: 'everyone',
    whoCanSeeLastSeen: 'everyone',
    readReceipts: true,
    typingIndicator: true,
  },
  notifications: {
    messages: true,
    friendRequests: true,
    friendRequestAccepted: true,
    likes: true,
    comments: true,
    followers: true,
    mentions: true,
    adminMessages: true,
    postApproval: true,
    postRejection: true,
    systemNotifications: true,
    sound: true,
    vibration: true,
    notificationPreview: true,
    badgeCount: true,
  },
  chat: {
    enterKeySends: false,
    messagePreview: true,
    readReceipts: true,
    typingIndicator: true,
    fontSize: 'medium',
    autoDownloadMedia: true,
  },
  media: {
    autoDownloadPhotos: 'wifi',
    autoDownloadVideos: 'wifi',
    autoDownloadFiles: 'wifi',
    autoDownloadVoice: 'wifi',
    dataSaver: false,
  },
  appearance: {
    theme: 'system',
    fontSize: 'medium',
  },
  language: {
    code: 'en',
  },
  nearby: {
    discoveryEnabled: true,
    whoCanDiscover: 'everyone',
  },
  security: {
    loginAlerts: true,
    twoFactorEnabled: false,
  },
};

interface SettingsState {
  settings: Record<string, any>;
  blockedUsers: any[];
  sessions: any[];
  loading: boolean;

  // Actions
  loadAll: () => Promise<void>;
  loadCategory: (category: string) => Promise<void>;
  updateCategory: (category: string, updates: Record<string, any>) => Promise<boolean>;
  resetCategory: (category: string) => Promise<void>;

  // Blocked users
  loadBlocked: () => Promise<void>;
  blockUser: (userId: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<void>;

  // Sessions
  loadSessions: () => Promise<void>;
  logoutSession: (sessionId: string) => Promise<void>;
  logoutAllSessions: () => Promise<void>;

  // Getters with defaults
  getPrivacy: () => Record<string, any>;
  getNotifications: () => Record<string, any>;
  getChat: () => Record<string, any>;
  getMedia: () => Record<string, any>;
  getAppearance: () => Record<string, any>;
  getLanguage: () => Record<string, any>;
  getNearby: () => Record<string, any>;
  getSecurity: () => Record<string, any>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  blockedUsers: [],
  sessions: [],
  loading: false,

  loadAll: async () => {
    set({loading: true});
    try {
      const d = await apiClient.get('/api/settings');
      if (d.success) set({settings: d.data});
    } catch (e) { console.error('Load settings error:', e); }
    finally { set({loading: false}); }
  },

  loadCategory: async (category) => {
    try {
      const d = await apiClient.get(`/api/settings/${category}`);
      if (d.success) set(s => ({settings: {...s.settings, [category]: d.data}}));
    } catch {}
  },

  updateCategory: async (category, updates) => {
    // Optimistic update
    set(s => ({
      settings: {...s.settings, [category]: {...(s.settings[category] || {}), ...updates}},
    }));
    try {
      const d = await apiClient.put(`/api/settings/${category}`, updates);
      if (d.success) {
        set(s => ({settings: {...s.settings, [category]: d.data}}));
        return true;
      }
    } catch {}
    return false;
  },

  resetCategory: async (category) => {
    try {
      await apiClient.delete(`/api/settings/${category}`);
      if (defaultSettings[category]) {
        set(s => ({settings: {...s.settings, [category]: {...defaultSettings[category]}}}));
      }
    } catch {}
  },

  loadBlocked: async () => {
    try {
      const d = await apiClient.get('/api/settings/blocked');
      if (d.success) set({blockedUsers: d.data.blocked || []});
    } catch {}
  },

  blockUser: async (userId) => {
    try {
      const d = await apiClient.post('/api/settings/blocked', {userId});
      if (d.success) { get().loadBlocked(); return true; }
    } catch {}
    return false;
  },

  unblockUser: async (userId) => {
    try {
      await apiClient.delete(`/api/settings/blocked/${userId}`);
      set(s => ({blockedUsers: s.blockedUsers.filter(b => b.blocked_id !== userId)}));
    } catch {}
  },

  loadSessions: async () => {
    try {
      const d = await apiClient.get('/api/settings/sessions');
      if (d.success) set({sessions: d.data.sessions || []});
    } catch {}
  },

  logoutSession: async (sessionId) => {
    try {
      await apiClient.delete(`/api/settings/sessions/${sessionId}`);
      set(s => ({sessions: s.sessions.filter(sess => sess.id !== sessionId)}));
    } catch {}
  },

  logoutAllSessions: async () => {
    try {
      await apiClient.delete('/api/settings/sessions/all');
      get().loadSessions();
    } catch {}
  },

  getPrivacy: () => get().settings.privacy || defaultSettings.privacy,
  getNotifications: () => get().settings.notifications || defaultSettings.notifications,
  getChat: () => get().settings.chat || defaultSettings.chat,
  getMedia: () => get().settings.media || defaultSettings.media,
  getAppearance: () => get().settings.appearance || defaultSettings.appearance,
  getLanguage: () => get().settings.language || defaultSettings.language,
  getNearby: () => get().settings.nearby || defaultSettings.nearby,
  getSecurity: () => get().settings.security || defaultSettings.security,
}));
