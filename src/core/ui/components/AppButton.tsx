import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { AppText } from './AppText';
import { theme } from '../tokens/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  variant = 'primary',
  isLoading = false,
  disabled,
  style,
  leftIcon,
  ...props
}) => {
  const isInteractionDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isInteractionDisabled, busy: isLoading }}
      disabled={isInteractionDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        styles[variant],
        isInteractionDisabled && styles.disabled,
        style as ViewStyle,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? theme.colors.text : theme.colors.white}
        />
      ) : (
        <>
          {leftIcon}
          <AppText
            style={[
              styles.text,
              variant === 'secondary' || variant === 'ghost' ? styles.textDark : styles.textLight,
            ]}
          >
            {title}
          </AppText>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  primary: {
    backgroundColor: theme.colors.primary[600],
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: {
    backgroundColor: theme.colors.danger[600],
  },
  ghost: {
    backgroundColor: theme.colors.transparent,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: theme.typography.fontWeights.semibold,
    fontSize: theme.typography.fontSizes.md,
  },
  textLight: {
    color: theme.colors.white,
  },
  textDark: {
    color: theme.colors.text,
  },
});
