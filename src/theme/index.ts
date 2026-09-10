import { useColorScheme } from 'react-native';
import { useAppStore } from '@/store/useAppStore';

export interface Palette {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  income: string;
  expense: string;
  warn: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
}

export const light: Palette = {
  bg: '#F7F6F3',
  card: '#FFFFFF',
  cardAlt: '#F1EFEA',
  text: '#1F1F1D',
  muted: '#6F6E6A',
  faint: '#A7A5A0',
  border: '#E6E4DF',
  accent: '#3D6B5E',
  accentSoft: '#E3EEEA',
  onAccent: '#FFFFFF',
  income: '#3D6B5E',
  expense: '#1F1F1D',
  warn: '#8C6D3F',
  danger: '#A35B4F',
  dangerSoft: '#F3E4E1',
  overlay: 'rgba(31,31,29,0.35)',
};

export const dark: Palette = {
  bg: '#141412',
  card: '#1F1F1C',
  cardAlt: '#262623',
  text: '#EDEBE6',
  muted: '#9A988F',
  faint: '#6B6A64',
  border: '#2C2C28',
  accent: '#7FB3A2',
  accentSoft: '#23342E',
  onAccent: '#101512',
  income: '#7FB3A2',
  expense: '#EDEBE6',
  warn: '#C9A46B',
  danger: '#D08A7E',
  dangerSoft: '#3A2724',
  overlay: 'rgba(0,0,0,0.55)',
};

export function useTheme(): { colors: Palette; isDark: boolean } {
  const system = useColorScheme();
  const setting = useAppStore((s) => s.settings?.theme ?? 'system');
  const isDark = setting === 'dark' || (setting === 'system' && system === 'dark');
  return { colors: isDark ? dark : light, isDark };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
