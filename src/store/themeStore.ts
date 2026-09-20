import {create} from 'zustand';
import {Colors, type ThemeColors} from '../core/constants/colors';
import * as FileSystem from 'expo-file-system/legacy';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  hydrate: () => Promise<void>;
}

const THEME_FILE = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}theme.json` : null;

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  colors: Colors.light as ThemeColors,
  isDark: false,
  hydrate: async () => {
    if (!THEME_FILE) return;
    try {
      const info = await FileSystem.getInfoAsync(THEME_FILE);
      if (info.exists) {
        const saved = JSON.parse(await FileSystem.readAsStringAsync(THEME_FILE));
        if (saved.mode === 'light' || saved.mode === 'dark' || saved.mode === 'system') {
          set({mode: saved.mode, isDark: saved.mode === 'dark', colors: (saved.mode === 'dark' ? Colors.dark : Colors.light) as ThemeColors});
        }
      }
    } catch (error) { console.error('Load theme error:', error); }
  },
  setMode: (mode) => {
    const isDark = mode === 'dark';
    set({
      mode,
      isDark,
      colors: (isDark ? Colors.dark : Colors.light) as ThemeColors,
    });
    if (THEME_FILE) FileSystem.writeAsStringAsync(THEME_FILE, JSON.stringify({mode})).catch(error => console.error('Save theme error:', error));
  },
  toggleTheme: () => {
    let nextMode: ThemeMode = 'light';
    set((state) => {
      const newDark = !state.isDark;
      nextMode = newDark ? 'dark' : 'light';
      return {
        isDark: newDark,
        colors: (newDark ? Colors.dark : Colors.light) as ThemeColors,
        mode: (newDark ? 'dark' : 'light') as ThemeMode,
      };
    });
    if (THEME_FILE) FileSystem.writeAsStringAsync(THEME_FILE, JSON.stringify({mode: nextMode})).catch(error => console.error('Save theme error:', error));
  },
}));
