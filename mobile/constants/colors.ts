/**
 * BUDIGO BRAND IDENTITY & COLOR SYSTEM
 * Primary Palette: Soft Ivory, Warm Terracotta, Deep Charcoal Purple
 */

export const Colors = {
  // Primary Brand Colors
  background: '#F8F5F7',      // Soft Ivory
  primary: '#D1956A',         // Warm Terracotta
  textPrimary: '#474459',     // Deep Charcoal Purple
  primaryDark: '#B87B52',
  primaryLight: '#EAC8B1',

  // Supporting Neutrals
  white: '#FFFFFF',
  lightGrey: '#EAE7EA',
  mutedText: '#817D87',
  border: '#E5DFE4',
  cardBackground: '#FFFFFF',

  // Semantic text aliases (used by discover, maps, and other screens)
  text: '#474459',           // alias for textPrimary
  textMuted: '#817D87',      // alias for mutedText
  textSecondary: '#9B97A0',  // lighter muted for secondary copy

  // Status Indicators
  success: '#3D9873',
  warning: '#D99A45',
  error: '#D65B61',
  info: '#4C78C9',

  // Deterministic 10-Color Palette for User Markers & Routes
  userPalette: [
    '#D1956A', // Terracotta
    '#4C78C9', // Blue
    '#419A77', // Green
    '#8B6BC1', // Purple
    '#E47776', // Coral
    '#329D9B', // Teal
    '#C39A43', // Mustard
    '#D36F9B', // Pink
    '#626DBA', // Indigo
    '#E58A47', // Orange
  ] as const,

  // Premium Gradient Theme Stops
  gradient: {
    start: '#F8F5F7',
    middle: '#D1956A',
    end: '#474459',
  },
};

export type UserMarkerColor = (typeof Colors.userPalette)[number];

