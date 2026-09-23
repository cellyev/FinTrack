import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { MonthlyCashflowSummary } from '../../domain/analytics-types';
import { theme } from '@/core/ui/tokens/theme';

export interface MonthlyCashflowCardProps {
  cashflow: MonthlyCashflowSummary;
}

export const MonthlyCashflowCard: React.FC<MonthlyCashflowCardProps> = ({ cashflow }) => {
  const {
    income,
    expense,
    netCashflowFormatted,
    isNetPositive,
    savingsRatePercentage,
  } = cashflow;

  const totalFlowMinor = income.minorUnits + expense.minorUnits;
  let incomeRatio = 50;
  let expenseRatio = 50;
  if (totalFlowMinor > 0n) {
    incomeRatio = Math.round(Number((income.minorUnits * 100n) / totalFlowMinor));
    expenseRatio = 100 - incomeRatio;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="titleMedium" style={styles.title}>
          Arus Kas Bulanan
        </AppText>
        {income.minorUnits > 0n && (
          <View
            style={[
              styles.badge,
              isNetPositive ? styles.badgeSuccess : styles.badgeDanger,
            ]}
          >
            <AppText
              variant="caption"
              style={[
                styles.badgeText,
                isNetPositive ? styles.badgeTextSuccess : styles.badgeTextDanger,
              ]}
            >
              Tingkat Tabungan: {savingsRatePercentage.toFixed(1)}%
            </AppText>
          </View>
        )}
      </View>

      {/* 2-column metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <AppText variant="caption" style={styles.metricLabel}>
            Pemasukan
          </AppText>
          <AppText variant="titleMedium" style={styles.incomeValue}>
            {income.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <AppText variant="caption" style={styles.metricLabel}>
            Pengeluaran
          </AppText>
          <AppText variant="titleMedium" style={styles.expenseValue}>
            {expense.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* Visual Flow Ratio Bar */}
      {totalFlowMinor > 0n && (
        <View style={styles.flowBarContainer}>
          <View style={[styles.flowSegmentIncome, { flex: incomeRatio }]} />
          <View style={[styles.flowSegmentExpense, { flex: expenseRatio }]} />
        </View>
      )}

      {/* Net Cashflow Bottom Row */}
      <View style={styles.netCashflowRow}>
        <AppText variant="body" style={styles.netLabel}>
          Net Cashflow
        </AppText>
        <AppText
          variant="titleMedium"
          style={[
            styles.netValue,
            isNetPositive ? styles.netValuePositive : styles.netValueNegative,
          ]}
        >
          {netCashflowFormatted}
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
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.success[50],
  },
  badgeDanger: {
    backgroundColor: theme.colors.danger[50],
  },
  badgeText: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  badgeTextSuccess: {
    color: theme.colors.success[600],
  },
  badgeTextDanger: {
    color: theme.colors.danger[600],
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    color: theme.colors.neutral[500],
    marginBottom: 2,
  },
  incomeValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  expenseValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.danger[500],
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
  },
  flowBarContainer: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    marginVertical: theme.spacing.sm,
  },
  flowSegmentIncome: {
    backgroundColor: theme.colors.primary[500],
  },
  flowSegmentExpense: {
    backgroundColor: theme.colors.danger[500],
  },
  netCashflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[100],
    marginTop: theme.spacing.xs,
  },
  netLabel: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeights.medium,
  },
  netValue: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  netValuePositive: {
    color: theme.colors.success[600],
  },
  netValueNegative: {
    color: theme.colors.danger[600],
  },
});
