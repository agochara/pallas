import { useColorScheme, StyleSheet, Platform } from 'react-native';

const fontSans = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'sans-serif',
});

// ---------------------------------------------------------------------------
// Typography scale  (Official M3 Expressive — 15 Baseline + 15 Emphasized)
//
// Baseline:
//   • Display / Headline / Body: Regular (400)
//   • Title / Label: Medium (500)
// Emphasized (M3 Expressive additions for focal points, CTAs & headers):
//   • Display: Bold (700)
//   • Headline / Title: SemiBold (600)
//   • Body: Medium (500)
//   • Label: Bold (700)
// ---------------------------------------------------------------------------

export const m3Type = StyleSheet.create({
  // Baseline Styles (15 styles)
  displayLarge:   { fontFamily: fontSans, fontSize: 57, lineHeight: 64, fontWeight: '400', letterSpacing: -0.25 },
  displayMedium:  { fontFamily: fontSans, fontSize: 45, lineHeight: 52, fontWeight: '400', letterSpacing: 0 },
  displaySmall:   { fontFamily: fontSans, fontSize: 36, lineHeight: 44, fontWeight: '400', letterSpacing: 0 },

  headlineLarge:  { fontFamily: fontSans, fontSize: 32, lineHeight: 40, fontWeight: '400', letterSpacing: 0 },
  headlineMedium: { fontFamily: fontSans, fontSize: 28, lineHeight: 36, fontWeight: '400', letterSpacing: 0 },
  headlineSmall:  { fontFamily: fontSans, fontSize: 24, lineHeight: 32, fontWeight: '400', letterSpacing: 0 },

  titleLarge:     { fontFamily: fontSans, fontSize: 22, lineHeight: 28, fontWeight: '400', letterSpacing: 0 },
  titleMedium:    { fontFamily: fontSans, fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  titleSmall:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },

  bodyLarge:      { fontFamily: fontSans, fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
  bodyMedium:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall:      { fontFamily: fontSans, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },

  labelLarge:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium:    { fontFamily: fontSans, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  labelSmall:     { fontFamily: fontSans, fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },

  // Emphasized Styles (15 styles — M3 Expressive)
  displayLargeEmphasized:   { fontFamily: fontSans, fontSize: 57, lineHeight: 64, fontWeight: '700', letterSpacing: -0.25 },
  displayMediumEmphasized:  { fontFamily: fontSans, fontSize: 45, lineHeight: 52, fontWeight: '700', letterSpacing: 0 },
  displaySmallEmphasized:   { fontFamily: fontSans, fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: 0 },

  headlineLargeEmphasized:  { fontFamily: fontSans, fontSize: 32, lineHeight: 40, fontWeight: '600', letterSpacing: 0 },
  headlineMediumEmphasized: { fontFamily: fontSans, fontSize: 28, lineHeight: 36, fontWeight: '600', letterSpacing: 0 },
  headlineSmallEmphasized:  { fontFamily: fontSans, fontSize: 24, lineHeight: 32, fontWeight: '600', letterSpacing: 0 },

  titleLargeEmphasized:     { fontFamily: fontSans, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: 0 },
  titleMediumEmphasized:    { fontFamily: fontSans, fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0.15 },
  titleSmallEmphasized:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: 0.1 },

  bodyLargeEmphasized:      { fontFamily: fontSans, fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.5 },
  bodyMediumEmphasized:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.25 },
  bodySmallEmphasized:      { fontFamily: fontSans, fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.4 },

  labelLargeEmphasized:     { fontFamily: fontSans, fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: 0.1 },
  labelMediumEmphasized:    { fontFamily: fontSans, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
  labelSmallEmphasized:     { fontFamily: fontSans, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 },
});
import {
  Hct,
  SchemeExpressive,
  MaterialDynamicColors,
  customColor,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

// ---------------------------------------------------------------------------
// M3Theme interface — full set of roles used across the app
// ---------------------------------------------------------------------------

export interface M3Theme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;

  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  outline: string;
  outlineVariant: string;
  scrim: string;

  // Harmonized custom roles
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  // Pallas brand blue accent (harmonized toward seed)
  pallasBlue: string;
  onPallasBlue: string;
}

// ---------------------------------------------------------------------------
// Shape scale  (M3 Expressive official 10-step scale)
// ---------------------------------------------------------------------------

export const m3Shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  largeIncreased: 20,
  extraLarge: 28,
  extraLargeIncreased: 32,
  full: 9999,
};

// ---------------------------------------------------------------------------
// Motion springs  (M3 Expressive physics-based presets)
// ---------------------------------------------------------------------------

export const motionSprings = {
  expressiveFast:    { damping: 20, stiffness: 300, mass: 0.6 },
  expressiveDefault: { damping: 18, stiffness: 180, mass: 0.8 },
  expressiveSlow:    { damping: 22, stiffness: 120, mass: 1.0 },
};


// ---------------------------------------------------------------------------
// M3 Expressive theme generator
// ---------------------------------------------------------------------------

const ROLE_KEYS = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface',
  'surfaceVariant', 'onSurfaceVariant',
  'inverseSurface', 'inverseOnSurface',
  'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'scrim',
] as const;

type StandardRoleKey = (typeof ROLE_KEYS)[number];

export function generateM3Theme(
  seedHex: string = '#63A002',
  successSeedHex: string = '#34A853',
  pallasBlueSeedHex: string = '#4A90D9',
): { light: M3Theme; dark: M3Theme } {
  const sourceArgb = argbFromHex(seedHex);
  const sourceHct  = Hct.fromInt(sourceArgb);

  const lightScheme = new SchemeExpressive(sourceHct, false, 0.0);
  const darkScheme  = new SchemeExpressive(sourceHct, true,  0.0);

  const successGroup = customColor(sourceArgb, {
    value: argbFromHex(successSeedHex),
    name: 'success',
    blend: true,
  });
  const blueGroup = customColor(sourceArgb, {
    value: argbFromHex(pallasBlueSeedHex),
    name: 'pallasBlue',
    blend: true,
  });

  function buildFrom(
    scheme: SchemeExpressive,
    successVariant: typeof successGroup.light,
    blueVariant: typeof blueGroup.light,
  ): M3Theme {
    const roles = {} as Record<StandardRoleKey, string>;
    for (const key of ROLE_KEYS) {
      const dc = (MaterialDynamicColors as any)[key] as
        | { getArgb: (s: SchemeExpressive) => number }
        | undefined;
      if (dc) {
        roles[key] = hexFromArgb(dc.getArgb(scheme));
      }
    }

    return {
      ...(roles as unknown as Pick<M3Theme, StandardRoleKey>),

      success:            hexFromArgb(successVariant.color),
      onSuccess:          hexFromArgb(successVariant.onColor),
      successContainer:   hexFromArgb(successVariant.colorContainer),
      onSuccessContainer: hexFromArgb(successVariant.onColorContainer),

      pallasBlue:   hexFromArgb(blueVariant.color),
      onPallasBlue: hexFromArgb(blueVariant.onColor),
    };
  }

  return {
    light: buildFrom(lightScheme, successGroup.light, blueGroup.light),
    dark:  buildFrom(darkScheme,  successGroup.dark,  blueGroup.dark),
  };
}

// ---------------------------------------------------------------------------
// Module-level singletons — computed once at startup, never per-render
// ---------------------------------------------------------------------------

export const { light: m3Light, dark: m3Dark } = generateM3Theme('#769CDF');

export function useM3Theme(): M3Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? m3Dark : m3Light;
}

