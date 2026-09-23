import React from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { MonthSelector } from './MonthSelector';
import { MonthlyCashflowCard } from './MonthlyCashflowCard';
import { CategorySpendingCard } from './CategorySpendingCard';
import { BudgetHealthCard } from './BudgetHealthCard';
import { MonthlyComparisonCard } from './MonthlyComparisonCard';
import { useMonthlyAnalytics } from '../use-monthly-analytics';
import { theme } from '@/core/ui/tokens/theme';

export const AnalyticsDashboardSection: React.FC = () => {
  const {
    analytics,
    isLoading,
    error,
    refresh,
    goToPreviousMonth,
    goToNextMonth,
  } = useMonthlyAnalytics();

  if (isLoading && !analytics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary[500]} />
        <AppText variant="caption" style={styles.loadingText}>
          Memuat ringkasan keuangan...
        </AppText>
      </View>
    );
  }

  if (error && !analytics) {
    return (
      <View style={styles.errorContainer}>
        <AppText variant="body" style={styles.errorText}>
          Gagal memuat analitik: {error}
        </AppText>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { refresh(); }} activeOpacity={0.7}>
          <AppText variant="caption" style={styles.retryText}>
            Coba Lagi
          </AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (!analytics) return null;

  return (
    <View style={styles.container}>
      <MonthSelector
        periodDisplay={analytics.periodDisplay}
        onPrevious={goToPreviousMonth}
        onNext={goToNextMonth}
      />

      <MonthlyCashflowCard cashflow={analytics.cashflow} />

      <CategorySpendingCard categories={analytics.categories} />

      <BudgetHealthCard budgetHealth={analytics.budgetHealth} />

      <MonthlyComparisonCard comparison={analytics.comparison} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  loadingText: {
    color: theme.colors.neutral[500],
  },
  errorContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.danger[50],
    borderRadius: theme.radii.md,
    marginVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.danger[600],
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.danger[600],
    borderRadius: theme.radii.sm,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: theme.typography.fontWeights.semibold,
  },
});
