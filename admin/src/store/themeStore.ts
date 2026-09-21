import {create} from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

const initial = ((): Theme => {
  const saved = localStorage.getItem('admin_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
})();

applyTheme(initial);

export const useThemeStore = create<ThemeState>(set => ({
  theme: initial,
  toggle: () =>
    set(state => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('admin_theme', next);
      applyTheme(next);
      return {theme: next};
    }),
  setTheme: t => {
    localStorage.setItem('admin_theme', t);
    applyTheme(t);
    set({theme: t});
  },
}));
