export const tokens = {
  color: {
    background: '#f3f0e8',
    surface: '#fbfaf6',
    text: '#18362f',
    textMuted: '#708079',
    action: '#245044',
    actionText: '#ffffff',
    border: '#dde2dc',
    focus: '#4f8f7b',
  },
  radius: { small: 8, medium: 12, large: 18, pill: 999 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
} as const;

export type ThemeTokens = typeof tokens;
