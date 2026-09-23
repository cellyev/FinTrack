import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { MonthlyComparison } from '../../domain/analytics-types';
import { theme } from '@/core/ui/tokens/theme';

export interface MonthlyComparisonCardProps {
  comparison: MonthlyComparison;
}

export const MonthlyComparisonCard: React.FC<MonthlyComparisonCardProps> = ({ comparison }) => {
  const {
    currentExpense,
    previousExpense,
    expenseDelta,
    isExpenseIncreased,
    expenseDeltaPercentage,
    currentIncome,
    previousIncome,
    incomeDelta,
    isIncomeIncreased,
    incomeDeltaPercentage,
  } = comparison;

  const expenseHasHistory = previousExpense.minorUnits > 0n || currentExpense.minorUnits > 0n;
  const incomeHasHistory = previousIncome.minorUnits > 0n || currentIncome.minorUnits > 0n;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="titleMedium" style={styles.title}>
          Perbandingan vs Bulan Lalu
        </AppText>
      </View>

      <View style={styles.comparisonList}>
        {/* 1. Pengeluaran */}
        <View style={styles.comparisonItem}>
          <View style={styles.comparisonHeader}>
            <AppText variant="body" style={styles.itemTitle}>
              Pengeluaran
            </AppText>
            {expenseHasHistory && (
              <View
                style={[
                  styles.deltaBadge,
                  isExpenseIncreased ? styles.deltaBadgeDanger : styles.deltaBadgeSuccess,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.deltaText,
                    isExpenseIncreased ? styles.deltaTextDanger : styles.deltaTextSuccess,
                  ]}
                >
                  {isExpenseIncreased ? '▲ +' : '▼ -'}
                  {expenseDeltaPercentage.toFixed(1)}%
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.detailRow}>
            <View>
              <AppText variant="caption" style={styles.subLabel}>
                Bulan Ini
              </AppText>
              <AppText variant="body" style={styles.mainValue}>
                {currentExpense.formatDisplay()}
              </AppText>
            </View>
            <View style={styles.rightDetail}>
              <AppText variant="caption" style={styles.subLabel}>
                Bulan Lalu ({previousExpense.formatDisplay()})
              </AppText>
              <AppText
                variant="body"
                style={[
                  styles.deltaAmount,
                  isExpenseIncreased ? styles.deltaTextDanger : styles.deltaTextSuccess,
                ]}
              >
                {isExpenseIncreased ? '+' : '-'}
                {expenseDelta.formatDisplay()}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.itemDivider} />

        {/* 2. Pemasukan */}
        <View style={styles.comparisonItem}>
          <View style={styles.comparisonHeader}>
            <AppText variant="body" style={styles.itemTitle}>
              Pemasukan
            </AppText>
            {incomeHasHistory && (
              <View
                style={[
                  styles.deltaBadge,
                  isIncomeIncreased ? styles.deltaBadgeSuccess : styles.deltaBadgeDanger,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.deltaText,
                    isIncomeIncreased ? styles.deltaTextSuccess : styles.deltaTextDanger,
                  ]}
                >
                  {isIncomeIncreased ? '▲ +' : '▼ -'}
                  {incomeDeltaPercentage.toFixed(1)}%
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.detailRow}>
            <View>
              <AppText variant="caption" style={styles.subLabel}>
                Bulan Ini
              </AppText>
              <AppText variant="body" style={styles.mainValue}>
                {currentIncome.formatDisplay()}
              </AppText>
            </View>
            <View style={styles.rightDetail}>
              <AppText variant="caption" style={styles.subLabel}>
                Bulan Lalu ({previousIncome.formatDisplay()})
              </AppText>
              <AppText
                variant="body"
                style={[
                  styles.deltaAmount,
                  isIncomeIncreased ? styles.deltaTextSuccess : styles.deltaTextDanger,
                ]}
              >
                {isIncomeIncreased ? '+' : '-'}
                {incomeDelta.formatDisplay()}
              </AppText>
            </View>
          </View>
        </View>
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
  comparisonList: {
    gap: theme.spacing.sm,
  },
  comparisonItem: {
    gap: theme.spacing.xs,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.text,
  },
  deltaBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  deltaBadgeSuccess: {
    backgroundColor: theme.colors.success[50],
  },
  deltaBadgeDanger: {
    backgroundColor: theme.colors.danger[50],
  },
  deltaText: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  deltaTextSuccess: {
    color: theme.colors.success[600],
  },
  deltaTextDanger: {
    color: theme.colors.danger[600],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightDetail: {
    alignItems: 'flex-end',
  },
  subLabel: {
    color: theme.colors.neutral[500],
    marginBottom: 2,
  },
  mainValue: {
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.text,
  },
  deltaAmount: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  itemDivider: {
    height: 1,
    backgroundColor: theme.colors.neutral[100],
    marginVertical: theme.spacing.xs,
  },
});
