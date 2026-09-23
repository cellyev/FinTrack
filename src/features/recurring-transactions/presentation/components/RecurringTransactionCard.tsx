import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { RecurringTransaction } from '../../domain/recurring-transaction';
import { getFrequencyLabel } from '../../domain/recurring-frequency';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface RecurringTransactionCardProps {
  recurring: RecurringTransaction;
  accountName?: string;
  categoryName?: string;
  onPress?: () => void;
  onProcessNow?: () => void;
  onToggleActive?: (isActive: boolean) => void;
}

export const RecurringTransactionCard: React.FC<RecurringTransactionCardProps> = ({
  recurring,
  accountName,
  categoryName,
  onPress,
  onProcessNow,
  onToggleActive,
}) => {
  const isIncome = recurring.isIncome;
  const isDue = recurring.isDue(new Date().toISOString().slice(0, 10));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.card,
        !recurring.isActive && styles.pausedCard,
        isDue && recurring.isActive && styles.dueCardBorder,
      ]}
    >
      {/* Header Row: Frequency Badge, Type Badge, Active Status */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.badge, isIncome ? styles.incomeBadge : styles.expenseBadge]}>
            <AppText
              variant="caption"
              style={[styles.badgeText, isIncome ? styles.incomeBadgeText : styles.expenseBadgeText]}
            >
              {isIncome ? '🟢 PEMASUKAN' : '🔴 PENGELUARAN'}
            </AppText>
          </View>
          <View style={[styles.badge, styles.frequencyBadge]}>
            <AppText variant="caption" style={styles.frequencyBadgeText}>
              🔄 {getFrequencyLabel(recurring.frequency)}
            </AppText>
          </View>
        </View>

        <View style={[styles.badge, recurring.isActive ? styles.activeBadge : styles.pausedBadge]}>
          <AppText
            variant="caption"
            style={[styles.badgeText, recurring.isActive ? styles.activeBadgeText : styles.pausedBadgeText]}
          >
            {recurring.isActive ? 'AKTIF' : 'DIJEDA'}
          </AppText>
        </View>
      </View>

      {/* Main Info: Note / Title and Amount */}
      <View style={styles.mainInfoRow}>
        <View style={styles.titleCol}>
          <AppText variant="titleMedium" style={styles.titleText} numberOfLines={1}>
            {recurring.note || (isIncome ? 'Pemasukan Rutin' : 'Pengeluaran Rutin')}
          </AppText>
          <AppText variant="caption" style={styles.metaSubtitle}>
            {accountName ? `🏦 ${accountName}` : ''}
            {accountName && categoryName ? ' • ' : ''}
            {categoryName ? `🏷️ ${categoryName}` : ''}
          </AppText>
        </View>

        <AppText
          variant="titleMedium"
          style={[styles.amountText, isIncome ? styles.incomeAmountText : styles.expenseAmountText]}
        >
          {isIncome ? '+' : '-'} {recurring.amount.formatDisplay()}
        </AppText>
      </View>

      {/* Schedule Info & Next Occurrence */}
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleLeft}>
          <AppText variant="caption" style={styles.scheduleLabel}>
            Jatuh Tempo Berikutnya:
          </AppText>
          <AppText
            variant="body"
            style={[styles.occurrenceDateText, isDue && recurring.isActive && styles.dueDateWarning]}
          >
            📅 {recurring.nextOccurrence}
            {isDue && recurring.isActive ? ' (Jatuh Tempo Hari Ini/Lewat)' : ''}
          </AppText>
        </View>

        {recurring.endDate && (
          <View style={styles.endDateCol}>
            <AppText variant="caption" style={styles.scheduleLabel}>
              Sampai:
            </AppText>
            <AppText variant="caption" style={styles.endDateText}>
              {recurring.endDate}
            </AppText>
          </View>
        )}
      </View>

      {/* Action Footer */}
      <View style={styles.actionRow}>
        {recurring.isActive && isDue && onProcessNow && (
          <View style={styles.processBtnContainer}>
            <AppButton
              title="⚡ Proses Sekarang"
              variant="primary"
              onPress={onProcessNow}
            />
          </View>
        )}

        {onToggleActive && (
          <TouchableOpacity
            style={styles.toggleTextBtn}
            onPress={() => onToggleActive(!recurring.isActive)}
          >
            <AppText variant="caption" style={styles.toggleBtnText}>
              {recurring.isActive ? '⏸️ Jeda Rutinitas' : '▶️ Aktifkan Kembali'}
            </AppText>
          </TouchableOpacity>
        )}
      </View>
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
    marginBottom: spacing.sm,
  },
  pausedCard: {
    opacity: 0.75,
    backgroundColor: theme.colors.neutral[50],
  },
  dueCardBorder: {
    borderColor: colors.warning[500],
    borderWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  incomeBadge: {
    backgroundColor: colors.success[50],
  },
  incomeBadgeText: {
    color: colors.success[700],
  },
  expenseBadge: {
    backgroundColor: colors.danger[50],
  },
  expenseBadgeText: {
    color: colors.danger[700],
  },
  frequencyBadge: {
    backgroundColor: colors.primary[50],
  },
  frequencyBadgeText: {
    color: colors.primary[700],
    fontSize: 10,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: colors.success[50],
  },
  activeBadgeText: {
    color: colors.success[700],
  },
  pausedBadge: {
    backgroundColor: theme.colors.neutral[200],
  },
  pausedBadgeText: {
    color: theme.colors.neutral[600],
  },
  mainInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleText: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  metaSubtitle: {
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  amountText: {
    fontWeight: '800',
  },
  incomeAmountText: {
    color: colors.success[600],
  },
  expenseAmountText: {
    color: colors.danger[600],
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  scheduleLeft: {
    flex: 1,
  },
  scheduleLabel: {
    color: theme.colors.neutral[500],
    fontSize: 11,
  },
  occurrenceDateText: {
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 1,
  },
  dueDateWarning: {
    color: colors.warning[700],
    fontWeight: '700',
  },
  endDateCol: {
    alignItems: 'flex-end',
  },
  endDateText: {
    color: theme.colors.neutral[700],
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  processBtnContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleTextBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  toggleBtnText: {
    color: colors.primary[700],
    fontWeight: '600',
  },
});
