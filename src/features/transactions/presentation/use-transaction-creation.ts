import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteTransactionRepository } from '../data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';
import {
  CreateExpenseUseCase,
  CreateIncomeUseCase,
  CreateTransferUseCase,
} from '../application/transaction.usecases';
import { ListAccountsUseCase } from '@/features/accounts/application/account.usecases';
import {
  ListCategoriesUseCase,
  EnsureDefaultCategoriesUseCase,
} from '@/features/categories/application/category.usecases';
import { Account } from '@/features/accounts/domain/account';
import { Category, CategoryType } from '@/features/categories/domain/category';
import { Money } from '@/core/domain/money';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

// Initialize singleton adapters
const transactionRepo = new SqliteTransactionRepository();
const accountRepo = new SqliteAccountRepository();
const categoryRepo = new SqliteCategoryRepository();
const uuidGen = new ExpoUuidGenerator();
const syncCoordinator = SyncCoordinator.getInstance();

const createExpenseUseCase = new CreateExpenseUseCase(transactionRepo, uuidGen);
const createIncomeUseCase = new CreateIncomeUseCase(transactionRepo, uuidGen);
const createTransferUseCase = new CreateTransferUseCase(transactionRepo, uuidGen);
const listAccountsUseCase = new ListAccountsUseCase(accountRepo);
const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);
const ensureDefaultCategoriesUseCase = new EnsureDefaultCategoriesUseCase(categoryRepo, uuidGen);

export interface SplitItemState {
  categoryId: string;
  amountStr: string;
  note?: string;
}

export function useTransactionCreation(categoryType?: CategoryType) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. Ensure master categories exist
    await ensureDefaultCategoriesUseCase.execute(user.id);

    // 2. Load active accounts
    const accResult = await listAccountsUseCase.execute(user.id, false);
    if (accResult.success) {
      setAccounts(accResult.data);
    }

    // 3. Load categories filtered by type
    const catResult = await listCategoriesUseCase.execute(user.id, categoryType, false);
    if (catResult.success) {
      setCategories(catResult.data);
    }

    setIsLoading(false);
  }, [user, categoryType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitExpense = useCallback(
    async (params: {
      amount: Money;
      sourceAccountId: string;
      transactionDate?: string;
      items: { categoryId: string; amount: Money; note?: string | null }[];
      note?: string | null;
    }): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await createExpenseUseCase.execute({
        userId: user.id,
        amount: params.amount,
        sourceAccountId: params.sourceAccountId,
        transactionDate: params.transactionDate,
        items: params.items,
        note: params.note,
      });

      if (result.success) {
        appEvents.emit('transactions_changed');
        syncCoordinator.requestSync('manual', 300);
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  const submitIncome = useCallback(
    async (params: {
      amount: Money;
      destinationAccountId: string;
      transactionDate?: string;
      items: { categoryId: string; amount: Money; note?: string | null }[];
      note?: string | null;
    }): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await createIncomeUseCase.execute({
        userId: user.id,
        amount: params.amount,
        destinationAccountId: params.destinationAccountId,
        transactionDate: params.transactionDate,
        items: params.items,
        note: params.note,
      });

      if (result.success) {
        appEvents.emit('transactions_changed');
        syncCoordinator.requestSync('manual', 300);
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  const submitTransfer = useCallback(
    async (params: {
      amount: Money;
      sourceAccountId: string;
      destinationAccountId: string;
      transactionDate?: string;
      note?: string | null;
    }): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await createTransferUseCase.execute({
        userId: user.id,
        amount: params.amount,
        sourceAccountId: params.sourceAccountId,
        destinationAccountId: params.destinationAccountId,
        transactionDate: params.transactionDate,
        note: params.note,
      });

      if (result.success) {
        appEvents.emit('transactions_changed');
        syncCoordinator.requestSync('manual', 300);
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  return {
    accounts,
    categories,
    isLoading,
    error,
    reload: loadData,
    submitExpense,
    submitIncome,
    submitTransfer,
  };
}
