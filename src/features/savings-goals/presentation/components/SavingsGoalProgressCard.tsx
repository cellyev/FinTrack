import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { SavingsGoalProgress } from '../../domain/savings-goal-progress';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface SavingsGoalProgressCardProps {
  progress: SavingsGoalProgress;
  onPress?: () => void;
}

export const SavingsGoalProgressCard: React.FC<SavingsGoalProgressCardProps> = ({
  progress,
  onPress,
}) => {
  const {
    goal,
    targetAmount,
    currentAmount,
    remainingAmount,
    percentageCompleted,
    isCompleted,
  } = progress;

  // Determine progress bar color
  let progressColor = colors.primary[500];
  if (isCompleted) {
    progressColor = colors.success[500];
  } else if (percentageCompleted >= 80) {
    progressColor = colors.primary[600];
  }

  const progressClamped = Math.min(100, Math.max(0, percentageCompleted));

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Target tabungan ${goal.name}, ${percentageCompleted}% tercapai`}
    >
      {/* Header Row: Goal Name & Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.titleInfo}>
          <AppText variant="titleMedium" style={styles.goalName}>
            🎯 {goal.name}
          </AppText>
          {goal.targetDate ? (
            <AppText variant="caption" style={styles.targetDateText}>
              Target: {goal.targetDate}
            </AppText>
          ) : null}
        </View>

        {isCompleted ? (
          <View style={styles.completedBadge}>
            <AppText variant="caption" style={styles.completedText}>
              Selesai
            </AppText>
          </View>
        ) : (
          <View style={styles.activeBadge}>
            <AppText variant="caption" style={styles.activeText}>
              Berjalan
            </AppText>
          </View>
        )}
      </View>

      {/* Progress Bar */}
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
            Terkumpul
          </AppText>
          <AppText variant="body" style={styles.currentValue}>
            {currentAmount.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.centerStat}>
          <AppText variant="body" style={[styles.percentValue, { color: progressColor }]}>
            {percentageCompleted}%
          </AppText>
        </View>

        <View style={styles.rightStat}>
          <AppText variant="caption" style={styles.statsLabel}>
            Target
          </AppText>
          <AppText variant="body" style={styles.targetValue}>
            {targetAmount.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* Remaining Amount Helper */}
      {!isCompleted ? (
        <View style={styles.remainingFooter}>
          <AppText variant="caption" style={styles.remainingText}>
            Kurang {remainingAmount.formatDisplay()} lagi untuk mencapai target
          </AppText>
        </View>
      ) : (
        <View style={styles.completedFooter}>
          <AppText variant="caption" style={styles.congratsText}>
            🎉 Selamat! Target tabungan ini telah tercapai.
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  goalName: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  targetDateText: {
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  completedText: {
    color: colors.success[700],
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  activeText: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radii.full,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: theme.radii.full,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statsLabel: {
    color: theme.colors.neutral[500],
  },
  currentValue: {
    color: theme.colors.text,
    fontWeight: '700',
    marginTop: 2,
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
  targetValue: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
    marginTop: 2,
  },
  remainingFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[100],
  },
  remainingText: {
    color: theme.colors.neutral[600],
    fontStyle: 'italic',
  },
  completedFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[100],
  },
  congratsText: {
    color: colors.success[700],
    fontWeight: '600',
  },
});
