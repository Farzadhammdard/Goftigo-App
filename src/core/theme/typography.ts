import {Platform, StyleSheet} from 'react-native';

const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: '#0F172A',
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: '#0F172A',
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#0F172A',
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: '#0F172A',
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: '#64748B',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: '#94A3B8',
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
} as const;
