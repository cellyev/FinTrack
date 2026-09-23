import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { RecurringTransaction } from '../domain/recurring-transaction';
import { RecurringSummary, calculateRecurringSummary } from '../domain/recurring-summary';
import { SqliteRecurringTransactionRepository } from '../data/sqlite-recurring.repository';
import { ListRecurringTransactionsUseCase } from '../application/list-recurring-transactions.usecase';
import { CreateRecurringTransactionUseCase, CreateRecurringTransactionDTO } from '../application/create-recurring-transaction.usecase';
import { ProcessDueRecurringTransactionsUseCase, ProcessDueRecurringSummary } from '../application/process-due-recurring.usecase';
import { ToggleRecurringActiveUseCase } from '../application/toggle-recurring-active.usecase';
import { UpdateRecurringTransactionUseCase, UpdateRecurringTransactionDTO } from '../application/update-recurring-transaction.usecase';
import { SoftDeleteRecurringTransactionUseCase } from '../application/soft-delete-recurring.usecase';
import { Result, err, DomainError, ValidationError } from '@/core/domain/result';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { Money } from '@/core/domain/money';
import { appEvents } from '@/core/events/app-events';

const recurringRepo = new SqliteRecurringTransactionRepository();
const listUseCase = new ListRecurringTransactionsUseCase(recurringRepo);
const createUseCase = new CreateRecurringTransactionUseCase(recurringRepo);
const processDueUseCase = new ProcessDueRecurringTransactionsUseCase(recurringRepo);
const toggleActiveUseCase = new ToggleRecurringActiveUseCase(recurringRepo);
const updateUseCase = new UpdateRecurringTransactionUseCase(recurringRepo);
const deleteUseCase = new SoftDeleteRecurringTransactionUseCase(recurringRepo);
const syncCoordinator = SyncCoordinator.getInstance();

const emptySummary: RecurringSummary = {
  totalActiveCount: 0,
  totalPausedCount: 0,
  totalMonthlyExpenseCommitment: Money.zero('IDR'),
  totalMonthlyIncomeCommitment: Money.zero('IDR'),
  dueCount: 0,
};

export function useRecurringTransactions() {
  const { user } = useAuth();
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [summary, setSummary] = useState<RecurringSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecurring = useCallback(async () => {
    if (!user) {
      setRecurringList([]);
      setSummary(emptySummary);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listUseCase.execute({ userId: user.id });

    if (result.success) {
      setRecurringList(result.data);
      setSummary(calculateRecurringSummary(result.data));
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadRecurring();

    const unsubscribe = appEvents.subscribe(
      ['recurring_changed', 'transactions_changed', 'data_invalidated'],
      () => {
        loadRecurring();
      }
    );

    return unsubscribe;
  }, [loadRecurring]);

  const createRecurring = async (
    dto: Omit<CreateRecurringTransactionDTO, 'userId'>
  ): Promise<Result<RecurringTransaction, DomainError>> => {
    if (!user) {
      return err(new ValidationError('User not authenticated'));
    }
    const result = await createUseCase.execute({ ...dto, userId: user.id });
    if (result.success) {
      appEvents.emit('recurring_changed');
      syncCoordinator.requestSync('manual');
    }
    return result;
  };

  const updateRecurring = async (
    dto: Omit<UpdateRecurringTransactionDTO, 'userId'>
  ): Promise<Result<RecurringTransaction, DomainError>> => {
    if (!user) {
      return err(new ValidationError('User not authenticated'));
    }
    const result = await updateUseCase.execute({ ...dto, userId: user.id });
    if (result.success) {
      appEvents.emit('recurring_changed');
      syncCoordinator.requestSync('manual');
    }
    return result;
  };

  const toggleActive = async (
    id: string,
    isActive: boolean
  ): Promise<Result<RecurringTransaction, DomainError>> => {
    if (!user) {
      return err(new ValidationError('User not authenticated'));
    }
    const result = await toggleActiveUseCase.execute({ id, userId: user.id, isActive });
    if (result.success) {
      appEvents.emit('recurring_changed');
      syncCoordinator.requestSync('manual');
    }
    return result;
  };

  const deleteRecurring = async (id: string): Promise<Result<void, DomainError>> => {
    if (!user) {
      return err(new ValidationError('User not authenticated'));
    }
    const result = await deleteUseCase.execute({ id, userId: user.id });
    if (result.success) {
      appEvents.emit('recurring_changed');
      syncCoordinator.requestSync('manual');
    }
    return result;
  };

  const processDueOccurrences = async (
    referenceDate?: string,
    specificRecurringId?: string
  ): Promise<Result<ProcessDueRecurringSummary, DomainError>> => {
    if (!user) {
      return err(new ValidationError('User not authenticated'));
    }
    const result = await processDueUseCase.execute({
      userId: user.id,
      referenceDate,
      specificRecurringId,
    });
    if (result.success) {
      appEvents.emit('transactions_changed'); // New transactions were created!
      syncCoordinator.requestSync('manual');
    }
    return result;
  };

  return {
    recurringList,
    summary,
    isLoading,
    error,
    refresh: loadRecurring,
    createRecurring,
    updateRecurring,
    toggleActive,
    deleteRecurring,
    processDueOccurrences,
  };
}
