import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { theme } from '@/core/ui/tokens/theme';

export interface MonthSelectorProps {
  periodDisplay: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  periodDisplay,
  onPrevious,
  onNext,
  canGoNext = true,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={onPrevious}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Bulan Sebelumnya"
      >
        <AppText variant="titleMedium" style={styles.navIcon}>
          ‹
        </AppText>
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <AppText variant="titleMedium" style={styles.periodTitle}>
          {periodDisplay}
        </AppText>
      </View>

      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.disabledButton]}
        onPress={onNext}
        disabled={!canGoNext}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Bulan Berikutnya"
      >
        <AppText
          variant="titleMedium"
          style={[styles.navIcon, !canGoNext && styles.disabledNavIcon]}
        >
          ›
        </AppText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  periodTitle: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  navButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.3,
  },
  navIcon: {
    fontSize: 24,
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeights.bold,
  },
  disabledNavIcon: {
    color: theme.colors.neutral[400],
  },
});
