import { colors } from './colors';
import { spacing, radii } from './spacing';
import { typography } from './typography';

export const theme = {
  colors: {
    ...colors,
    background: colors.neutral[900],
    surface: colors.neutral[800],
    surfaceSubtle: colors.neutral[700],
    border: colors.neutral[700],
    text: colors.neutral[50],
    textMuted: colors.neutral[400],
    textInverse: colors.neutral[950],
  },
  spacing,
  radii,
  typography,
};

export type Theme = typeof theme;
