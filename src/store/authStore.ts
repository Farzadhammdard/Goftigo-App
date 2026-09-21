import {create} from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import type {User, AuthTokens} from '../core/types/models';
import {Config} from '../core/constants/config';

const AUTH_FILE = FileSystem.documentDirectory + 'auth.json';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  updateProfile: (updates: Partial<User>) => void;
  restoreSession: () => Promise<void>;
}

async function saveAuth(user: User, tokens: AuthTokens) {
  try {
    await FileSystem.writeAsStringAsync(AUTH_FILE, JSON.stringify({user, tokens}));
  } catch (e) {
    console.error('Failed to save auth:', e);
  }
}

async function clearAuth() {
  try {
    const info = await FileSystem.getInfoAsync(AUTH_FILE);
    if (info.exists) await FileSystem.deleteAsync(AUTH_FILE);
  } catch (e) {}
}

async function loadAuth(): Promise<{user: User; tokens: AuthTokens} | null> {
  try {
    const info = await FileSystem.getInfoAsync(AUTH_FILE);
    if (!info.exists) return null;
    const data = await FileSystem.readAsStringAsync(AUTH_FILE);
    const parsed = JSON.parse(data);
    if (parsed?.user && parsed?.tokens?.accessToken) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({user}),
  setTokens: (tokens) => set({tokens}),

  login: (user, tokens) => {
    saveAuth(user, tokens);
    set({user, tokens, isAuthenticated: true, isLoading: false});
  },

  logout: () => {
    const token = get().tokens?.accessToken;
    if (token) {
      fetch(`${Config.API.BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      }).catch(error => console.error('Logout request failed:', error));
    }
    clearAuth();
    set({user: null, tokens: null, isAuthenticated: false, isLoading: false});
  },

  setLoading: (isLoading) => set({isLoading}),
  setInitialized: (isInitialized) => set({isInitialized}),

  updateProfile: (updates) =>
    set((state) => {
      const newUser = state.user ? {...state.user, ...updates} : null;
      if (newUser && state.tokens) saveAuth(newUser, state.tokens);
      return {user: newUser};
    }),

  restoreSession: async () => {
    set({isLoading: true});
    const saved = await loadAuth();
    if (saved) {
      set({
        user: saved.user,
        tokens: saved.tokens,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } else {
      set({isInitialized: true, isLoading: false});
    }
  },
}));
