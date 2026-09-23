import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { MonthlyAnalyticsDTO } from '../domain/analytics-types';
import { GetMonthlyAnalyticsUseCase, getMonthDateRange } from '../application/get-monthly-analytics.usecase';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SqliteBudgetRepository } from '@/features/budgets/data/sqlite-budget.repository';
import { appEvents } from '@/core/events/app-events';

const txRepo = new SqliteTransactionRepository();
const catRepo = new SqliteCategoryRepository();
const budgetRepo = new SqliteBudgetRepository();
const getMonthlyAnalyticsUseCase = new GetMonthlyAnalyticsUseCase(txRepo, catRepo, budgetRepo);

export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function useMonthlyAnalytics(initialPeriod?: string) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>(initialPeriod ?? getCurrentPeriod());
  const [analytics, setAnalytics] = useState<MonthlyAnalyticsDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const lastPeriodRef = useRef(period);

  const userId = user?.id;

  const loadAnalytics = useCallback(
    async (silent: boolean = false) => {
      if (!userId) {
        setAnalytics(null);
        setIsLoading(false);
        return;
      }

      const isPeriodChange = lastPeriodRef.current !== period;
      if (!silent && (!hasLoadedRef.current || isPeriodChange)) {
        setIsLoading(true);
      }
      lastPeriodRef.current = period;
      setError(null);

      try {
        const result = await getMonthlyAnalyticsUseCase.execute(userId, period);
        if (result.success) {
          setAnalytics(result.data);
        } else {
          setError(result.error.message);
        }
      } finally {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    },
    [userId, period]
  );

  useEffect(() => {
    loadAnalytics();

    // Otomatis refresh analitik saat data transaksi, anggaran, atau kategori berubah
    const unsubscribe = appEvents.subscribe(
      ['transactions_changed', 'budgets_changed', 'categories_changed', 'data_invalidated'],
      () => {
        loadAnalytics(true);
      }
    );

    return unsubscribe;
  }, [loadAnalytics]);

  const goToPreviousMonth = useCallback(() => {
    const { previousPeriod } = getMonthDateRange(period);
    setPeriod(previousPeriod);
  }, [period]);

  const goToNextMonth = useCallback(() => {
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const nextDate = new Date(year, month, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    setPeriod(`${nextYear}-${nextMonth}`);
  }, [period]);

  const refresh = useCallback(
    (silent?: boolean | unknown) => {
      const isSilent = typeof silent === 'boolean' ? silent : false;
      return loadAnalytics(isSilent);
    },
    [loadAnalytics]
  );

  return {
    period,
    setPeriod,
    analytics,
    isLoading,
    error,
    refresh,
    goToPreviousMonth,
    goToNextMonth,
  };
}
