import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { BudgetProgress } from '../../domain/budget-progress';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface BudgetProgressCardProps {
  progress: BudgetProgress;
  onPress?: () => void;
}

export const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({ progress, onPress }) => {
  const {
    budget,
    categoryName,
    categoryIcon,
    budgetAmount,
    actualSpending,
    remainingAmount,
    percentageUsed,
    isOverBudget,
  } = progress;

  // Determine progress bar color
  let progressColor = colors.success[500];
  if (percentageUsed > 100) {
    progressColor = colors.danger[500];
  } else if (percentageUsed > 80) {
    progressColor = colors.warning[500];
  }

  const progressClamped = Math.min(100, Math.max(0, percentageUsed));

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {/* Header: Category & Period/OverBudget badge */}
      <View style={styles.headerRow}>
        <View style={styles.categoryInfo}>
          {categoryIcon ? (
            <AppText style={styles.categoryIcon}>{categoryIcon}</AppText>
          ) : null}
          <View>
            <AppText variant="titleMedium" style={styles.categoryName}>
              {categoryName}
            </AppText>
            {budget.name ? (
              <AppText variant="caption" style={styles.budgetName}>
                {budget.name}
              </AppText>
            ) : null}
          </View>
        </View>

        {isOverBudget ? (
          <View style={styles.overBudgetBadge}>
            <AppText variant="caption" style={styles.overBudgetText}>
              Over Budget
            </AppText>
          </View>
        ) : (
          <View style={styles.periodBadge}>
            <AppText variant="caption" style={styles.periodText}>
              {budget.period.periodType === 'monthly' ? 'Bulanan' : 'Kustom'}
            </AppText>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progressClamped}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View>
          <AppText variant="caption" style={styles.statsLabel}>
            Terpakai
          </AppText>
          <AppText variant="body" style={styles.spentValue}>
            {actualSpending.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.centerStat}>
          <AppText variant="body" style={[styles.percentValue, { color: progressColor }]}>
            {percentageUsed}%
          </AppText>
        </View>

        <View style={styles.rightStat}>
          <AppText variant="caption" style={styles.statsLabel}>
            {isOverBudget ? 'Melebihi' : 'Sisa'}
          </AppText>
          <AppText variant="body" style={styles.remainingValue}>
            {isOverBudget
              ? `+${actualSpending.subtract(budgetAmount).formatDisplay()}`
              : remainingAmount.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* Budget Total Limit */}
      <View style={styles.limitRow}>
        <AppText variant="caption" style={styles.limitText}>
          Batas: {budgetAmount.formatDisplay()} ({budget.period.startDate} s/d {budget.period.endDate})
        </AppText>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[900],
    borderRadius: theme.radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[800],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryName: {
    color: colors.white,
    fontWeight: '600',
  },
  budgetName: {
    color: colors.neutral[400],
  },
  periodBadge: {
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  periodText: {
    color: colors.neutral[300],
  },
  overBudgetBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: colors.danger[500],
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  overBudgetText: {
    color: colors.danger[500],
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.neutral[800],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  statsLabel: {
    color: colors.neutral[400],
  },
  spentValue: {
    color: colors.white,
    fontWeight: '600',
  },
  centerStat: {
    alignItems: 'center',
  },
  percentValue: {
    fontWeight: '700',
  },
  rightStat: {
    alignItems: 'flex-end',
  },
  remainingValue: {
    color: colors.neutral[200],
    fontWeight: '600',
  },
  limitRow: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[800],
    paddingTop: spacing.xs,
  },
  limitText: {
    color: colors.neutral[400],
    fontSize: theme.typography.fontSizes.xs,
  },
});
