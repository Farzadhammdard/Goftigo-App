import {create} from 'zustand';
import type {User} from '../core/types/models';

interface UserState {
  currentUser: User | null;
  cachedUsers: Record<string, User>;
  searchResults: User[];
  isLoading: boolean;

  setCurrentUser: (user: User) => void;
  cacheUser: (user: User) => void;
  cacheUsers: (users: User[]) => void;
  getCachedUser: (id: string) => User | undefined;
  updateCachedUser: (id: string, updates: Partial<User>) => void;
  setSearchResults: (results: User[]) => void;
  clearSearchResults: () => void;
  setLoading: (loading: boolean) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  currentUser: null,
  cachedUsers: {},
  searchResults: [],
  isLoading: false,

  setCurrentUser: (user) => set({currentUser: user}),

  cacheUser: (user) =>
    set((state) => ({
      cachedUsers: {...state.cachedUsers, [user.id]: user},
    })),

  cacheUsers: (users) =>
    set((state) => {
      const newCache = {...state.cachedUsers};
      for (const user of users) {
        newCache[user.id] = user;
      }
      return {cachedUsers: newCache};
    }),

  getCachedUser: (id) => get().cachedUsers[id],

  updateCachedUser: (id, updates) =>
    set((state) => {
      const existing = state.cachedUsers[id];
      if (!existing) return state;
      return {
        cachedUsers: {
          ...state.cachedUsers,
          [id]: {...existing, ...updates},
        },
      };
    }),

  setSearchResults: (searchResults) => set({searchResults}),
  clearSearchResults: () => set({searchResults: []}),
  setLoading: (isLoading) => set({isLoading}),
}));
