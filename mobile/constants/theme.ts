// StudyMatch Design Tokens
export const Colors = {
  primary: '#cd4f75',       // Deep Pink/Rose
  primaryLight: '#e8748e',
  secondary: '#ffa9f9',     // Light Pink
  accent: '#93dcfc',        // Sky Blue
  yellow: '#ffe479',        // Yellow
  white: '#ffffff',
  black: '#000000',
  background: '#f8f4ff',
  cardBg: 'rgba(255,255,255,0.85)',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: 'rgba(205,79,117,0.2)',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gradient: {
    pink: ['#ffa9f9', '#cd4f75'],
    blue: ['#93dcfc', '#60b8e8'],
    sunset: ['#ffa9f9', '#ffe479', '#93dcfc'],
    hero: ['#fce4f3', '#e8f7ff', '#fffbe6'],
  },
};

export const Fonts = {
  regular: undefined,
  medium: undefined,
  semiBold: undefined,
  bold: undefined,
  extraBold: undefined,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const Shadow = {
  small: {
    shadowColor: '#cd4f75',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  medium: {
    shadowColor: '#cd4f75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  large: {
    shadowColor: '#cd4f75',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
  },
};
