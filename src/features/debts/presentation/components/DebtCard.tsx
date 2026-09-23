import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { Debt } from '../../domain/debt';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface DebtCardProps {
  debt: Debt;
  onPress?: () => void;
  onPayPress?: () => void;
}

export const DebtCard: React.FC<DebtCardProps> = ({ debt, onPress, onPayPress }) => {
  const isOverdue = debt.isOverdue();
  const isSettled = debt.isSettled;
  const isBorrowed = debt.isBorrowed;

  // Progress percentage (repaid / original)
  const progressClamped = Math.min(100, Math.max(0, debt.percentageRepaid));

  let progressColor = isBorrowed ? colors.danger[500] : colors.primary[500];
  if (isSettled) {
    progressColor = colors.success[500];
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isBorrowed ? 'Hutang' : 'Piutang'} ${debt.personName}, sisa ${debt.remainingAmount.formatDisplay()}`}
    >
      {/* Header Row: Type Badge, Person Name, and Status Badges */}
      <View style={styles.headerRow}>
        <View style={styles.personInfo}>
          <View style={styles.typeBadgeRow}>
            <View
              style={[
                styles.typeBadge,
                isBorrowed ? styles.borrowedBadge : styles.lentBadge,
              ]}
            >
              <AppText
                variant="caption"
                style={[
                  styles.typeBadgeText,
                  isBorrowed ? styles.borrowedBadgeText : styles.lentBadgeText,
                ]}
              >
                {isBorrowed ? '🔴 HUTANG (Saya Berhutang)' : '🟢 PIUTANG (Dipinjamkan)'}
              </AppText>
            </View>
          </View>

          <AppText variant="titleMedium" style={styles.personName}>
            👤 {debt.personName}
          </AppText>

          {debt.dueDate ? (
            <View style={styles.dateRow}>
              <AppText variant="caption" style={isOverdue ? styles.overdueDateText : styles.dueDateText}>
                {isOverdue ? '⚠️ Lewat Tempo: ' : '🗓️ Jatuh Tempo: '}
                {debt.dueDate}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.statusBadgesCol}>
          {isSettled ? (
            <View style={styles.settledBadge}>
              <AppText variant="caption" style={styles.settledText}>
                LUNAS
              </AppText>
            </View>
          ) : isOverdue ? (
            <View style={styles.overdueBadge}>
              <AppText variant="caption" style={styles.overdueText}>
                TERLAMBAT
              </AppText>
            </View>
          ) : (
            <View style={styles.activeBadge}>
              <AppText variant="caption" style={styles.activeText}>
                BELUM LUNAS
              </AppText>
            </View>
          )}
        </View>
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
        <View style={styles.statCol}>
          <AppText variant="caption" style={styles.statLabel}>
            {isBorrowed ? 'Sisa Hutang' : 'Sisa Piutang'}
          </AppText>
          <AppText
            variant="body"
            style={[styles.remainingValue, isBorrowed ? styles.borrowedValue : styles.lentValue]}
          >
            {debt.remainingAmount.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.centerStatCol}>
          <AppText variant="caption" style={styles.statLabel}>
            {isBorrowed ? 'Terbayar' : 'Diterima'}
          </AppText>
          <AppText variant="caption" style={styles.percentText}>
            {debt.percentageRepaid}%
          </AppText>
        </View>

        <View style={styles.rightStatCol}>
          <AppText variant="caption" style={styles.statLabel}>
            Total Awal
          </AppText>
          <AppText variant="body" style={styles.originalValue}>
            {debt.originalAmount.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* Quick Pay Action Button if not fully settled */}
      {!isSettled && onPayPress ? (
        <View style={styles.actionFooter}>
          <TouchableOpacity
            style={[styles.payButton, isBorrowed ? styles.payButtonBorrowed : styles.payButtonLent]}
            onPress={onPayPress}
            activeOpacity={0.7}
          >
            <AppText variant="caption" style={styles.payButtonText}>
              {isBorrowed ? '💳 Bayar Cicilan / Lunas' : '📥 Catat Penerimaan / Pelunasan'}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}
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
  personInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  typeBadgeRow: {
    marginBottom: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  borrowedBadge: {
    backgroundColor: colors.danger[50],
  },
  borrowedBadgeText: {
    color: colors.danger[700],
    fontWeight: '700',
    fontSize: 11,
  },
  lentBadge: {
    backgroundColor: colors.primary[50],
  },
  lentBadgeText: {
    color: colors.primary[700],
    fontWeight: '700',
    fontSize: 11,
  },
  personName: {
    color: theme.colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  dateRow: {
    marginTop: 4,
  },
  dueDateText: {
    color: theme.colors.neutral[500],
  },
  overdueDateText: {
    color: colors.danger[600],
    fontWeight: '600',
  },
  statusBadgesCol: {
    alignItems: 'flex-end',
  },
  settledBadge: {
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  settledText: {
    color: colors.success[700],
    fontWeight: '700',
  },
  overdueBadge: {
    backgroundColor: colors.danger[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  overdueText: {
    color: colors.danger[700],
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: theme.colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  activeText: {
    color: theme.colors.neutral[600],
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
  statCol: {
    flex: 1,
  },
  centerStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  rightStatCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statLabel: {
    color: theme.colors.neutral[500],
    marginBottom: 2,
  },
  remainingValue: {
    fontWeight: '700',
  },
  borrowedValue: {
    color: colors.danger[600],
  },
  lentValue: {
    color: colors.primary[600],
  },
  percentText: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  originalValue: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  actionFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[100],
  },
  payButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radii.md,
  },
  payButtonBorrowed: {
    backgroundColor: colors.danger[50],
  },
  payButtonLent: {
    backgroundColor: colors.primary[50],
  },
  payButtonText: {
    fontWeight: '700',
    color: theme.colors.text,
  },
});
