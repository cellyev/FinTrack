import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { theme } from '../tokens/theme';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Terjadi Kesalahan',
  message,
  onRetry,
}) => {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AppText variant="titleMedium" style={styles.title}>{title}</AppText>
      <AppText variant="bodyMuted" style={styles.message}>{message}</AppText>
      {onRetry ? (
        <AppButton
          title="Coba Lagi"
          variant="secondary"
          onPress={onRetry}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    color: theme.colors.danger[500],
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    maxWidth: 280,
  },
  retryButton: {
    minWidth: 140,
  },
});
