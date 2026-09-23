import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { theme } from '../tokens/theme';

export type TextVariant = 'display' | 'titleLarge' | 'titleMedium' | 'body' | 'bodyMuted' | 'caption' | 'error';

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  children: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({ variant = 'body', style, children, ...props }) => {
  return (
    <Text style={[styles.base, styles[variant], style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
  },
  display: {
    fontSize: theme.typography.fontSizes.display,
    lineHeight: theme.typography.lineHeights.display,
    fontWeight: theme.typography.fontWeights.bold,
  },
  titleLarge: {
    fontSize: theme.typography.fontSizes.xxl,
    lineHeight: theme.typography.lineHeights.xxl,
    fontWeight: theme.typography.fontWeights.bold,
  },
  titleMedium: {
    fontSize: theme.typography.fontSizes.lg,
    lineHeight: theme.typography.lineHeights.lg,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  body: {
    fontSize: theme.typography.fontSizes.md,
    lineHeight: theme.typography.lineHeights.md,
    fontWeight: theme.typography.fontWeights.regular,
  },
  bodyMuted: {
    fontSize: theme.typography.fontSizes.md,
    lineHeight: theme.typography.lineHeights.md,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.regular,
  },
  caption: {
    fontSize: theme.typography.fontSizes.xs,
    lineHeight: theme.typography.lineHeights.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.regular,
  },
  error: {
    fontSize: theme.typography.fontSizes.sm,
    lineHeight: theme.typography.lineHeights.sm,
    color: theme.colors.danger[500],
    fontWeight: theme.typography.fontWeights.medium,
  },
});
