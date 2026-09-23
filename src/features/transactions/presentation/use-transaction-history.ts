import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteTransactionRepository } from '../data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetTransactionHistoryUseCase,
  TransactionListItemDTO,
  DateGroupedTransactions,
} from '../application/transaction.usecases';
import { ListAccountsUseCase } from '@/features/accounts/application/account.usecases';
import { ListCategoriesUseCase } from '@/features/categories/application/category.usecases';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { FilterState, DateFilterPreset } from './components/TransactionFilterModal';
import { appEvents } from '@/core/events/app-events';

// Singleton adapters
const txRepo = new SqliteTransactionRepository();
const accountRepo = new SqliteAccountRepository();
const categoryRepo = new SqliteCategoryRepository();

const getHistoryUseCase = new GetTransactionHistoryUseCase(txRepo, accountRepo, categoryRepo);
const listAccountsUseCase = new ListAccountsUseCase(accountRepo);
const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);

export function useTransactionHistory() {
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionListItemDTO[]>([]);
  const [grouped, setGrouped] = useState<DateGroupedTransactions[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const [filter, setFilter] = useState<FilterState>({
    datePreset: 'all',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState<boolean>(false);

  // Debounce search query (300ms)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
  };

  // Convert date preset to YYYY-MM-DD range using local device time
  const resolveDateRange = (preset: DateFilterPreset): { startDate?: string; endDate?: string } => {
    if (preset === 'all') return {};

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const todayStr = toDateStr(now);

    if (preset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }

    if (preset === 'week') {
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday...
      const startOfWeek = new Date(now);
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);
      return { startDate: toDateStr(startOfWeek), endDate: todayStr };
    }

    if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toDateStr(startOfMonth), endDate: todayStr };
    }

    return {};
  };

  // Compute active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.type) count++;
    if (filter.accountId) count++;
    if (filter.categoryId) count++;
    if (filter.datePreset !== 'all') count++;
    if (filter.minAmount) count++;
    if (filter.maxAmount) count++;
    return count;
  }, [filter]);

  const hasLoadedRef = useRef(false);

  const userId = user?.id;

  const loadData = useCallback(
    async (options?: { isPullToRefresh?: boolean; silent?: boolean }) => {
      const isPullToRefresh = options?.isPullToRefresh ?? false;
      const silent = options?.silent ?? false;

      if (!userId) {
        setItems([]);
        setGrouped([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (isPullToRefresh) {
        setIsRefreshing(true);
        // Trigger pull-to-refresh synchronization
        try {
          await SyncCoordinator.getInstance().requestSync('pull_to_refresh');
        } catch {
          // Gracefully continue with local data if sync fails
        }
      } else if (!silent && !hasLoadedRef.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        // 1. Load active accounts & categories for filter options
        const [accRes, catRes] = await Promise.all([
          listAccountsUseCase.execute(userId, false),
          listCategoriesUseCase.execute(userId, undefined, false),
        ]);

        if (accRes.success) setAccounts(accRes.data);
        if (catRes.success) setCategories(catRes.data);

        // 2. Resolve date range from preset
        const { startDate, endDate } = resolveDateRange(filter.datePreset);

        // 3. Execute history query
        const historyResult = await getHistoryUseCase.execute({
          userId,
          search: debouncedSearch.trim() || undefined,
          type: filter.type,
          accountId: filter.accountId,
          categoryId: filter.categoryId,
          startDate,
          endDate,
          minAmount: filter.minAmount,
          maxAmount: filter.maxAmount,
        });

        if (historyResult.success) {
          setItems(historyResult.data.items);
          setGrouped(historyResult.data.grouped);
        } else {
          setError(historyResult.error.message);
        }
      } finally {
        hasLoadedRef.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId, debouncedSearch, filter]
  );

  useEffect(() => {
    loadData();

    // Otomatis refresh riwayat transaksi secara silent saat ada data baru, diupdate, atau dihapus
    const unsubscribe = appEvents.subscribe(['transactions_changed', 'data_invalidated'], () => {
      loadData({ silent: true });
    });

    return unsubscribe;
  }, [loadData]);

  const applyFilter = (newFilter: FilterState) => {
    setFilter(newFilter);
  };

  const resetFilter = () => {
    setFilter({ datePreset: 'all' });
  };

  const refresh = useCallback(() => loadData({ isPullToRefresh: true }), [loadData]);
  const reloadLocal = useCallback(() => loadData({ silent: true }), [loadData]);

  return {
    items,
    grouped,
    accounts,
    categories,
    searchQuery,
    setSearchQuery: handleSearchChange,
    filter,
    activeFilterCount,
    isLoading,
    isRefreshing,
    error,
    isFilterModalVisible,
    openFilterModal: () => setIsFilterModalVisible(true),
    closeFilterModal: () => setIsFilterModalVisible(false),
    applyFilter,
    resetFilter,
    refresh,
    reloadLocal,
  };
}
