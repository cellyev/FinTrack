import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetTransactionHistoryUseCase,
  TransactionListItemDTO,
} from '@/features/transactions/application/transaction.usecases';

const txRepo = new SqliteTransactionRepository();
const accRepo = new SqliteAccountRepository();
const catRepo = new SqliteCategoryRepository();
const getTxHistoryUseCase = new GetTransactionHistoryUseCase(txRepo, accRepo, catRepo);

export function useCategoryTransactions(categoryId?: string) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionListItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user || !categoryId) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await getTxHistoryUseCase.execute({
      userId: user.id,
      categoryId,
      limit: 50,
    });

    if (result.success) {
      setTransactions(result.data.items);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, [user, categoryId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refresh: fetchTransactions,
  };
}
