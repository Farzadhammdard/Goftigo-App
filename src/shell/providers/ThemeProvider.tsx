import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {Colors, type ThemeColors} from '../../core/constants/colors';
import {useThemeStore, type ThemeMode} from '../../store/themeStore';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: Colors.light as ThemeColors,
  isDark: false,
  mode: 'system',
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemColorScheme = useColorScheme();
  const {mode, setMode, toggleTheme} = useThemeStore();

  const isDark = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  const colors = useMemo(
    () => (isDark ? Colors.dark : Colors.light) as ThemeColors,
    [isDark],
  );

  const value = useMemo(
    () => ({
      colors,
      isDark,
      mode,
      setMode,
      toggleTheme,
    }),
    [colors, isDark, mode, setMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
