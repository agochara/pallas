import { useColorScheme, StyleSheet } from 'react-native';
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

  // Progressive Fasting scale (Harmonized HCT, high-contrast in both light and dark)
  fastingUnder12: string;
  fasting12to16: string;
  fasting16to24: string;
  fasting24plus: string;
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
// Typography scale  (M3 Expressive — 5 roles × 3 sizes = 15 styles)
// ---------------------------------------------------------------------------

export const m3Type = StyleSheet.create({
  displayLarge:   { fontSize: 57, lineHeight: 64, fontWeight: '400', letterSpacing: -0.25 },
  displayMedium:  { fontSize: 45, lineHeight: 52, fontWeight: '400', letterSpacing: 0 },
  displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '400', letterSpacing: 0 },

  headlineLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '400', letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '400', letterSpacing: 0 },
  headlineSmall:  { fontSize: 24, lineHeight: 32, fontWeight: '400', letterSpacing: 0 },

  titleLarge:     { fontSize: 22, lineHeight: 28, fontWeight: '500', letterSpacing: 0 },
  titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },

  bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
  bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  bodySmall:      { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },

  labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
  labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
  labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
});

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

  // Progressive Fasting Gradient Custom Colors (blend: false to preserve distinct hues)
  const fastingUnder12Group = customColor(sourceArgb, {
    value: argbFromHex('#78909C'), // Cool Slate Grey (Neutral)
    name: 'fastingUnder12',
    blend: false,
  });
  const fasting12to16Group = customColor(sourceArgb, {
    value: argbFromHex('#0284C7'), // Vivid Ocean Blue
    name: 'fasting12to16',
    blend: false,
  });
  const fasting16to24Group = customColor(sourceArgb, {
    value: argbFromHex('#10B981'), // Vivid Emerald Green
    name: 'fasting16to24',
    blend: false,
  });
  const fasting24plusGroup = customColor(sourceArgb, {
    value: argbFromHex('#F59E0B'), // Vivid Amber Gold
    name: 'fasting24plus',
    blend: false,
  });

  function buildFrom(
    scheme: SchemeExpressive,
    successVariant: typeof successGroup.light,
    blueVariant: typeof blueGroup.light,
    fUnder12: typeof fastingUnder12Group.light,
    f12to16: typeof fasting12to16Group.light,
    f16to24: typeof fasting16to24Group.light,
    f24plus: typeof fasting24plusGroup.light,
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

      fastingUnder12: hexFromArgb(fUnder12.color),
      fasting12to16:  hexFromArgb(f12to16.color),
      fasting16to24:  hexFromArgb(f16to24.color),
      fasting24plus:  hexFromArgb(f24plus.color),
    };
  }

  return {
    light: buildFrom(
      lightScheme,
      successGroup.light,
      blueGroup.light,
      fastingUnder12Group.light,
      fasting12to16Group.light,
      fasting16to24Group.light,
      fasting24plusGroup.light,
    ),
    dark:  buildFrom(
      darkScheme,
      successGroup.dark,
      blueGroup.dark,
      fastingUnder12Group.dark,
      fasting12to16Group.dark,
      fasting16to24Group.dark,
      fasting24plusGroup.dark,
    ),
  };
}

// ---------------------------------------------------------------------------
// Module-level singletons — computed once at startup, never per-render
// ---------------------------------------------------------------------------

export const { light: m3Light, dark: m3Dark } = generateM3Theme('#63A002');

export function useM3Theme(): M3Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? m3Dark : m3Light;
}

