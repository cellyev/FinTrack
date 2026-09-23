import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteTransactionRepository } from '../data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetTransactionDetailUseCase,
  TransactionDetailDTO,
} from '../application/transaction.usecases';

const txRepo = new SqliteTransactionRepository();
const accountRepo = new SqliteAccountRepository();
const categoryRepo = new SqliteCategoryRepository();
const getDetailUseCase = new GetTransactionDetailUseCase(txRepo, accountRepo, categoryRepo);

export function useTransactionDetail(transactionId?: string) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<TransactionDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!transactionId || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await getDetailUseCase.execute(transactionId, user.id);
    if (result.success) {
      setDetail(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [transactionId, user]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return {
    detail,
    isLoading,
    error,
    refresh: loadDetail,
  };
}
