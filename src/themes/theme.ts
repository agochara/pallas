import { useColorScheme } from 'react-native';

export const lightColors = {
  background: '#F8F7F2',
  surface: '#F0EFEA',
  card: '#FFFFFF',

  text: '#171716',
  textSecondary: '#77766F',
  separator: '#DDDCD5',

  accent: '#334A5C',
  accentText: '#FFFFFF',

  danger: '#B33A32',
};

export const darkColors = {
  background: '#111210',
  surface: '#191A18',
  card: '#20211F',

  text: '#EAE8E0',
  textSecondary: '#96958D',
  separator: '#30312D',

  accent: '#8EA6B8',
  accentText: '#111210',

  danger: '#E06A60',
};

export type Colors = typeof lightColors;

export function useTheme(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
};

export const type = {
  largeTitle: { fontSize: 32, fontWeight: '700' as const },
  title: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  monoLarge: { fontSize: 44, fontWeight: '300' as const },
};
