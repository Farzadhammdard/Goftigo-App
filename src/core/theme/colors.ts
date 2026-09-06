const LightColors = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  primarySurface: '#EEF2FF',
  secondary: '#10B981',
  secondaryLight: '#34D399',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F9F9F9',
  textPrimary: '#101828',
  textSecondary: '#667085',
  textTertiary: '#98A2B3',
  textInverse: '#FFFFFF',
  border: '#E4E7EC',
  borderLight: '#F2F4F7',
  online: '#22C55E',
  offline: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#6366F1',
  bubbleSent: '#6366F1',
  bubbleSentText: '#FFFFFF',
  bubbleReceived: '#F0F0F0',
  bubbleReceivedText: '#101828',
  badge: '#EF4444',
  badgeText: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabActive: '#6366F1',
  tabInactive: '#98A2B3',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#E2E8F0',
} as const;

const DarkColors = {
  primary: '#818CF8',
  primaryLight: '#A5B4FC',
  primaryDark: '#6366F1',
  primarySurface: '#1E1B4B',
  secondary: '#34D399',
  secondaryLight: '#6EE7B7',
  background: '#0F0A1A',
  surface: '#1A1325',
  surfaceSecondary: '#221B30',
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  textInverse: '#0F172A',
  border: '#334155',
  borderLight: '#1E293B',
  online: '#22C55E',
  offline: '#64748B',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#818CF8',
  bubbleSent: '#6366F1',
  bubbleSentText: '#FFFFFF',
  bubbleReceived: '#2A2340',
  bubbleReceivedText: '#F1F5F9',
  badge: '#EF4444',
  badgeText: '#FFFFFF',
  tabBar: '#1A1325',
  tabBarBorder: '#334155',
  tabActive: '#818CF8',
  tabInactive: '#64748B',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shimmer: '#334155',
} as const;

export type ThemeColorKeys = keyof typeof LightColors;

let _current: typeof LightColors = LightColors;

export const Colors = new Proxy(LightColors, {
  get(_target, prop: string) {
    return (_current as any)[prop];
  },
});

export function setThemeColors(isDark: boolean) {
  _current = isDark ? DarkColors : LightColors;
}
