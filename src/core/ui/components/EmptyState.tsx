import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { theme } from '../tokens/theme';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionTitle,
  onAction,
  icon,
}) => {
  return (
    <View style={styles.container} accessibilityRole="summary">
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <AppText variant="titleMedium" style={styles.title}>{title}</AppText>
      {description ? (
        <AppText variant="bodyMuted" style={styles.description}>{description}</AppText>
      ) : null}
      {actionTitle && onAction ? (
        <AppButton
          title={actionTitle}
          onPress={onAction}
          style={styles.actionButton}
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
  iconContainer: {
    marginBottom: theme.spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  description: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    maxWidth: 280,
  },
  actionButton: {
    minWidth: 160,
  },
});
