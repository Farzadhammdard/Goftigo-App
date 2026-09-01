import {create} from 'zustand';
import {api} from '../api/client';

interface AuthState {
  admin: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const result = await api.login(email, password);
    api.setTokens(result.accessToken, result.refreshToken);
    set({admin: result.admin, isAuthenticated: true});
  },

  logout: () => {
    api.clearTokens();
    set({admin: null, isAuthenticated: false});
  },

  loadSession: async () => {
    api.loadTokens();
    if (!localStorage.getItem('admin_access')) {
      set({isLoading: false});
      return;
    }
    try {
      const admin = await api.getMe();
      set({admin, isAuthenticated: true, isLoading: false});
    } catch {
      api.clearTokens();
      set({isLoading: false});
    }
  },
}));
