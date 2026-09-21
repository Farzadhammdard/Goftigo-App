import {create} from 'zustand';
import {adminWs} from '../services/websocket';

export type EventLevel = 'info' | 'success' | 'warning' | 'danger';

export interface AdminEvent {
  id: string;
  kind: string;
  title: string;
  body: string;
  icon: string;
  level: EventLevel;
  link: string;
  at: number;
  data?: any;
  read: boolean;
}

interface RealtimeState {
  connected: boolean;
  initialized: boolean;
  toasts: AdminEvent[];
  notifications: AdminEvent[];
  unread: number;
  onlineUsers: Record<string, boolean>;
  /** Bumped on every admin:event so pages can refetch live. */
  eventVersion: number;
  /** Bumped on every presence change. */
  presenceVersion: number;
  lastEvent: AdminEvent | null;

  init: () => Promise<void>;
  teardown: () => void;
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const MAX_FEED = 60;
const TOAST_TTL = 6000;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getAdminUserToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/chat/admin-ws-token', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_access')}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    return data.data?.token || null;
  } catch {
    return null;
  }
}

export const useRealtimeStore = create<RealtimeState>((set, get) => {
  const pushToast = (event: AdminEvent) => {
    set(state => ({toasts: [...state.toasts, event].slice(-4)}));
    setTimeout(() => get().dismissToast(event.id), TOAST_TTL);
  };

  const onAdminEvent = (raw: any) => {
    const event: AdminEvent = {
      id: uid(),
      kind: raw.kind || 'generic',
      title: raw.title || 'Notification',
      body: raw.body || '',
      icon: raw.icon || '🔔',
      level: raw.level || 'info',
      link: raw.link || '',
      at: raw.at || Date.now(),
      data: raw.data,
      read: false,
    };
    set(state => ({
      notifications: [event, ...state.notifications].slice(0, MAX_FEED),
      unread: state.unread + 1,
      eventVersion: state.eventVersion + 1,
      lastEvent: event,
    }));
    pushToast(event);
  };

  const onUserStatus = (data: any) => {
    if (!data?.userId) return;
    set(state => ({
      onlineUsers: {...state.onlineUsers, [data.userId]: !!data.isOnline},
      presenceVersion: state.presenceVersion + 1,
    }));
  };

  const onConnected = () => set({connected: true});
  const onDisconnected = () => set({connected: false});

  return {
    connected: false,
    initialized: false,
    toasts: [],
    notifications: [],
    unread: 0,
    onlineUsers: {},
    eventVersion: 0,
    presenceVersion: 0,
    lastEvent: null,

    init: async () => {
      if (get().initialized) return;
      set({initialized: true});

      adminWs.on('connected', onConnected);
      adminWs.on('disconnected', onDisconnected);
      adminWs.on('admin:event', onAdminEvent);
      adminWs.on('user_status', onUserStatus);

      const token = await getAdminUserToken();
      if (token) adminWs.connect(token);
    },

    teardown: () => {
      adminWs.off('connected', onConnected);
      adminWs.off('disconnected', onDisconnected);
      adminWs.off('admin:event', onAdminEvent);
      adminWs.off('user_status', onUserStatus);
      adminWs.disconnect();
      set({initialized: false, connected: false});
    },

    dismissToast: id =>
      set(state => ({toasts: state.toasts.filter(t => t.id !== id)})),

    markRead: id =>
      set(state => {
        const target = state.notifications.find(n => n.id === id);
        if (!target || target.read) return state;
        return {
          notifications: state.notifications.map(n =>
            n.id === id ? {...n, read: true} : n,
          ),
          unread: Math.max(0, state.unread - 1),
        };
      }),

    markAllRead: () =>
      set(state => ({
        notifications: state.notifications.map(n => ({...n, read: true})),
        unread: 0,
      })),

    clearNotifications: () => set({notifications: [], unread: 0}),
  };
});
