import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteAccountRepository } from '../data/sqlite-account.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';
import {
  CreateAccountWithOpeningBalanceUseCase,
  GetAccountsWithBalancesUseCase,
  UpdateAccountUseCase,
  SoftDeleteAccountUseCase,
  GetAccountUseCase,
  AccountWithBalanceDTO,
} from '../application/account.usecases';
import { AccountType, Account } from '../domain/account';
import { Money } from '@/core/domain/money';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

// Initialize singleton adapters
const accountRepository = new SqliteAccountRepository();
const transactionRepository = new SqliteTransactionRepository();
const uuidGenerator = new ExpoUuidGenerator();
const syncCoordinator = SyncCoordinator.getInstance();

const createAccountUseCase = new CreateAccountWithOpeningBalanceUseCase(
  accountRepository,
  uuidGenerator
);
const getAccountsWithBalancesUseCase = new GetAccountsWithBalancesUseCase(
  accountRepository,
  transactionRepository
);
const updateAccountUseCase = new UpdateAccountUseCase(accountRepository);
const softDeleteAccountUseCase = new SoftDeleteAccountUseCase(accountRepository);
const getAccountUseCase = new GetAccountUseCase(accountRepository);

export function useAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithBalanceDTO[]>([]);
  const [totalNetWorth, setTotalNetWorth] = useState<Money>(Money.zero('IDR'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setTotalNetWorth(Money.zero('IDR'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await getAccountsWithBalancesUseCase.execute(user.id);
    if (result.success) {
      setAccounts(result.data.accounts);
      setTotalNetWorth(result.data.totalNetWorth);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAccounts();

    const unsubscribe = appEvents.subscribe(
      ['accounts_changed', 'transactions_changed', 'data_invalidated'],
      () => {
        fetchAccounts();
      }
    );

    return unsubscribe;
  }, [fetchAccounts]);

  const createAccount = useCallback(
    async (params: {
      name: string;
      type: AccountType;
      color?: string | null;
      icon?: string | null;
      openingBalance?: Money;
    }): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await createAccountUseCase.execute({
        userId: user.id,
        name: params.name,
        type: params.type,
        color: params.color,
        icon: params.icon,
        openingBalance: params.openingBalance,
      });

      if (result.success) {
        appEvents.emit('accounts_changed');
        syncCoordinator.requestSync('manual');
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  const updateAccount = useCallback(
    async (params: { id: string; name: string; icon?: string | null; color?: string | null }): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await updateAccountUseCase.execute({
        id: params.id,
        userId: user.id,
        name: params.name,
        icon: params.icon,
        color: params.color,
      });

      if (result.success) {
        appEvents.emit('accounts_changed');
        syncCoordinator.requestSync('manual');
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  const deleteAccount = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) {
        setError('Pengguna tidak terautentikasi');
        return false;
      }

      setError(null);
      const result = await softDeleteAccountUseCase.execute(id, user.id);
      if (result.success) {
        appEvents.emit('accounts_changed');
        syncCoordinator.requestSync('manual');
        return true;
      } else {
        setError(result.error.message);
        return false;
      }
    },
    [user]
  );

  const getAccount = useCallback(
    async (id: string): Promise<Account | null> => {
      if (!user) return null;
      const result = await getAccountUseCase.execute(id, user.id);
      return result.success ? result.data : null;
    },
    [user]
  );

  return {
    accounts,
    totalNetWorth,
    isLoading,
    error,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccount,
  };
}
