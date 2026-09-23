import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { Debt, DebtType, DebtStatus } from '../domain/debt';
import { DebtSummary, calculateDebtSummary } from '../domain/debt-summary';
import { SqliteDebtRepository } from '../data/sqlite-debt.repository';
import { ListDebtsUseCase } from '../application/list-debts.usecase';
import { CreateDebtUseCase, CreateDebtDTO } from '../application/create-debt.usecase';
import { RecordRepaymentUseCase, RecordRepaymentDTO } from '../application/record-repayment.usecase';
import { UpdateDebtUseCase, UpdateDebtDTO } from '../application/update-debt.usecase';
import { SoftDeleteDebtUseCase } from '../application/soft-delete-debt.usecase';
import { Result, DomainError } from '@/core/domain/result';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { Money } from '@/core/domain/money';
import { appEvents } from '@/core/events/app-events';

const debtRepo = new SqliteDebtRepository();
const listUseCase = new ListDebtsUseCase(debtRepo);
const createUseCase = new CreateDebtUseCase(debtRepo);
const recordRepaymentUseCase = new RecordRepaymentUseCase(debtRepo);
const updateUseCase = new UpdateDebtUseCase(debtRepo);
const deleteUseCase = new SoftDeleteDebtUseCase(debtRepo);
const syncCoordinator = SyncCoordinator.getInstance();

const emptySummary: DebtSummary = {
  totalBorrowedOriginal: Money.zero('IDR'),
  totalBorrowedRemaining: Money.zero('IDR'),
  totalBorrowedRepaid: Money.zero('IDR'),
  totalLentOriginal: Money.zero('IDR'),
  totalLentRemaining: Money.zero('IDR'),
  totalLentRepaid: Money.zero('IDR'),
  overdueCount: 0,
  openCount: 0,
  settledCount: 0,
};

export function useDebts(initialFilter?: { type?: DebtType; status?: DebtStatus }) {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState<DebtSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDebts = useCallback(async () => {
    if (!user) {
      setDebts([]);
      setSummary(emptySummary);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listUseCase.execute({
      userId: user.id,
      type: initialFilter?.type,
      status: initialFilter?.status,
    });

    if (result.success) {
      setDebts(result.data);
      setSummary(calculateDebtSummary(result.data));
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [user, initialFilter?.type, initialFilter?.status]);

  useEffect(() => {
    loadDebts();

    const unsubscribe = appEvents.subscribe(
      ['debts_changed', 'transactions_changed', 'data_invalidated'],
      () => {
        loadDebts();
      }
    );

    return unsubscribe;
  }, [loadDebts]);

  const createDebt = async (
    input: Omit<CreateDebtDTO, 'userId'>
  ): Promise<Result<Debt, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await createUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('debts_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const recordRepayment = async (
    input: Omit<RecordRepaymentDTO, 'userId'>
  ): Promise<Result<Debt, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await recordRepaymentUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('debts_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const updateDebt = async (
    input: Omit<UpdateDebtDTO, 'userId'>
  ): Promise<Result<Debt, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await updateUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('debts_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const deleteDebt = async (debtId: string): Promise<Result<void, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await deleteUseCase.execute({
      id: debtId,
      userId: user.id,
    });

    if (result.success) {
      appEvents.emit('debts_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  return {
    debts,
    summary,
    isLoading,
    error,
    refresh: loadDebts,
    createDebt,
    recordRepayment,
    updateDebt,
    deleteDebt,
  };
}
