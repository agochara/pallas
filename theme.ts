import { useColorScheme } from 'react-native';

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F7F7F8',
  card: '#FFFFFF',
  text: '#0C0C0D',
  textSecondary: '#8A8A8E',
  separator: '#E5E5E7',
  accent: '#0C0C0D',
  accentText: '#FFFFFF',
  danger: '#C0392B',
};

export const darkColors = {
  background: '#000000',
  surface: '#161616',
  card: '#1C1C1E',
  text: '#F5F5F5',
  textSecondary: '#8E8E93',
  separator: '#2C2C2E',
  accent: '#F5F5F5',
  accentText: '#000000',
  danger: '#FF6B60',
};

export type Colors = typeof lightColors;

export function useTheme(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 8, md: 14, lg: 20 };

export const type = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const },
  title: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  monoLarge: { fontSize: 44, fontWeight: '300' as const },
};
