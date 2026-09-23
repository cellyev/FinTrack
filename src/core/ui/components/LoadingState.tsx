import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../tokens/theme';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Memuat...' }) => {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      {message ? <AppText variant="bodyMuted" style={styles.message}>{message}</AppText> : null}
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
  message: {
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
});
