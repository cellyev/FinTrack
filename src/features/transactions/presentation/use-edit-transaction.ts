import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteTransactionRepository } from '../data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetTransactionDetailUseCase,
  UpdateTransactionUseCase,
  TransactionDetailDTO,
  UpdateTransactionDTO,
} from '../application/transaction.usecases';
import { ListAccountsUseCase } from '@/features/accounts/application/account.usecases';
import { ListCategoriesUseCase } from '@/features/categories/application/category.usecases';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

const txRepo = new SqliteTransactionRepository();
const accountRepo = new SqliteAccountRepository();
const categoryRepo = new SqliteCategoryRepository();
const syncCoordinator = SyncCoordinator.getInstance();

const getDetailUseCase = new GetTransactionDetailUseCase(txRepo, accountRepo, categoryRepo);
const updateTxUseCase = new UpdateTransactionUseCase(txRepo, accountRepo, categoryRepo);
const listAccountsUseCase = new ListAccountsUseCase(accountRepo);
const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);

export function useEditTransaction(transactionId?: string) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<TransactionDetailDTO | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!transactionId || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const detailRes = await getDetailUseCase.execute(transactionId, user.id);
    if (!detailRes.success) {
      setError(detailRes.error.message);
      setIsLoading(false);
      return;
    }

    const txDetail = detailRes.data;
    if (!txDetail.isEditable) {
      setError(
        txDetail.type === 'opening_balance'
          ? 'Transaksi Saldo Awal tidak dapat diubah dari riwayat transaksi.'
          : 'Transaksi ini tidak dapat diedit karena sudah melewati batas koreksi 7 hari.'
      );
      setIsLoading(false);
      return;
    }

    setDetail(txDetail);

    const [accRes, catRes] = await Promise.all([
      listAccountsUseCase.execute(user.id, false),
      txDetail.type === 'expense' || txDetail.type === 'income'
        ? listCategoriesUseCase.execute(user.id, txDetail.type, false)
        : Promise.resolve({ success: true as const, data: [] }),
    ]);

    if (accRes.success) {
      setAccounts(accRes.data);
    }
    if (catRes.success) {
      setCategories(catRes.data);
    }

    setIsLoading(false);
  }, [transactionId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitUpdate = async (dto: Omit<UpdateTransactionDTO, 'userId'>) => {
    if (!user) return { success: false, error: 'User tidak ditemukan' };
    const result = await updateTxUseCase.execute({
      ...dto,
      userId: user.id,
    });

    if (result.success) {
      appEvents.emit('transactions_changed');
      syncCoordinator.requestSync('manual', 300);
      return { success: true };
    }
    return { success: false, error: result.error.message };
  };

  return {
    detail,
    accounts,
    categories,
    isLoading,
    error,
    refresh: loadData,
    submitUpdate,
  };
}
