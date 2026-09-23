import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { BudgetHealthOverview } from '../../domain/analytics-types';
import { theme } from '@/core/ui/tokens/theme';
import { Feather } from '@expo/vector-icons';

export interface BudgetHealthCardProps {
  budgetHealth: BudgetHealthOverview;
}

export const BudgetHealthCard: React.FC<BudgetHealthCardProps> = ({ budgetHealth }) => {
  const {
    totalBudget,
    totalSpent,
    totalRemaining,
    utilizationPercentage,
    budgetCount,
    overBudgetCount,
  } = budgetHealth;

  if (budgetCount === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <AppText variant="titleMedium" style={styles.title}>
            Kesehatan Anggaran
          </AppText>
        </View>
        <View style={styles.emptyContainer}>
          <Feather 
            name="target" 
            size={40} 
            color={theme.colors.neutral[300]} 
            style={styles.emptyIcon}
          />
          <AppText variant="body" style={styles.emptyText}>
            Belum ada anggaran aktif di bulan ini
          </AppText>
        </View>
      </View>
    );
  }

  let progressColor = theme.colors.success[500];
  if (utilizationPercentage > 100) {
    progressColor = theme.colors.danger[500];
  } else if (utilizationPercentage > 80) {
    progressColor = theme.colors.warning[500];
  }

  const clampedProgress = Math.min(100, Math.max(0, utilizationPercentage));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="titleMedium" style={styles.title}>
          Kesehatan Anggaran
        </AppText>
        {overBudgetCount > 0 ? (
          <View style={styles.overBudgetBadge}>
            <AppText variant="caption" style={styles.overBudgetText}>
              {overBudgetCount} Melebihi Batas
            </AppText>
          </View>
        ) : (
          <View style={styles.safeBadge}>
            <AppText variant="caption" style={styles.safeText}>
              {budgetCount} Anggaran Aktif
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.amountRow}>
        <View>
          <AppText variant="caption" style={styles.label}>
            Terpakai
          </AppText>
          <AppText variant="titleMedium" style={styles.spentValue}>
            {totalSpent.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.rightAmount}>
          <AppText variant="caption" style={styles.label}>
            Total Batas
          </AppText>
          <AppText variant="titleMedium" style={styles.budgetValue}>
            {totalBudget.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <AppText variant="caption" style={styles.footerText}>
          Sisa:{' '}
          <AppText variant="caption" style={styles.remainingBold}>
            {totalRemaining.formatDisplay()}
          </AppText>
        </AppText>
        <AppText variant="caption" style={[styles.percentageBold, { color: progressColor }]}>
          {utilizationPercentage.toFixed(1)}% Terpakai
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  overBudgetBadge: {
    backgroundColor: theme.colors.danger[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  overBudgetText: {
    color: theme.colors.danger[600],
    fontWeight: theme.typography.fontWeights.semibold,
  },
  safeBadge: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  safeText: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeights.medium,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  rightAmount: {
    alignItems: 'flex-end',
  },
  label: {
    color: theme.colors.neutral[500],
    marginBottom: 2,
  },
  spentValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  budgetValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.neutral[600],
  },
  barContainer: {
    height: 8,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: theme.spacing.xs,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  footerText: {
    color: theme.colors.neutral[600],
  },
  remainingBold: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.success[600],
  },
  percentageBold: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  emptyIcon: {
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.neutral[500],
  },
});
