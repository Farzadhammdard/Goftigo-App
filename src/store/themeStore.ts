import {create} from 'zustand';
import {Colors, type ThemeColors} from '../core/constants/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  colors: Colors.light as ThemeColors,
  isDark: false,
  setMode: (mode) => {
    const isDark = mode === 'dark';
    set({
      mode,
      isDark,
      colors: (isDark ? Colors.dark : Colors.light) as ThemeColors,
    });
  },
  toggleTheme: () => {
    set((state) => {
      const newDark = !state.isDark;
      return {
        isDark: newDark,
        colors: (newDark ? Colors.dark : Colors.light) as ThemeColors,
        mode: (newDark ? 'dark' : 'light') as ThemeMode,
      };
    });
  },
}));
