// Core Theme Colors (Dark Theme Only)
export const DARK = {
  background: '#020617',
  cardBg: 'rgba(15, 23, 42, 0.65)', // Transparent Slate for glass effect
  inputBg: 'rgba(30, 41, 59, 0.5)',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  border: 'rgba(255, 255, 255, 0.08)',
  tabBar: 'rgba(2, 6, 23, 0.9)',
  tabActive: '#38BDF8',
  tabInactive: '#475569',
};

// We keep the export but make it identical to DARK for backward compatibility
export const LIGHT = DARK;

export const SHARED_COLORS = {
  // Glassmorphism effects
  glass: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',

  // Brand
  brand: '#0EA5E9',
  purpleBubble: 'rgba(124, 58, 237, 0.15)', // Atmospheric Purple
  cyanBubble: 'rgba(14, 165, 233, 0.1)',
  brandLight: '#38BDF8',
  brandDark: '#0284C7',

  // Gradients (Midnight Ocean)
  primaryGradient: ['#0EA5E9', '#2DD4BF'],
  secondaryGradient: ['#6366F1', '#A855F7'],
  actionGradient: ['#10B981', '#34D399'],

  // Semantic
  violet: '#0EA5E9',
  indigo: '#38BDF8',
  cyan: '#06B6D4',
  teal: '#14B8A6',

  // Status
  green: '#10B981',
  greenLight: '#34D399',
  red: '#F43F5E',
  orange: '#F59E0B',
  yellow: '#EAB308',

  // Avatar colors
  avatarM: '#0EA5E9',
  avatarV: '#10B981',
  avatarS: '#F43F5E',
  avatarA: '#F59E0B',
};

// Default for backward compatibility
export const COLORS = {
  ...DARK,
  ...SHARED_COLORS,
  // Mapping old names
  purpleMid: '#0EA5E9',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};
