import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { BudgetProgress } from '../domain/budget-progress';
import { Budget } from '../domain/budget';
import { BudgetPeriodType } from '../domain/budget-period';
import { SqliteBudgetRepository } from '../data/sqlite-budget.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { ListBudgetsWithProgressUseCase } from '../application/list-budgets-with-progress.usecase';
import { CreateBudgetUseCase } from '../application/create-budget.usecase';
import { UpdateBudgetUseCase } from '../application/update-budget.usecase';
import { SoftDeleteBudgetUseCase } from '../application/soft-delete-budget.usecase';
import { Result, DomainError } from '@/core/domain/result';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

const budgetRepo = new SqliteBudgetRepository();
const categoryRepo = new SqliteCategoryRepository();
const listUseCase = new ListBudgetsWithProgressUseCase(budgetRepo, categoryRepo);
const createUseCase = new CreateBudgetUseCase(budgetRepo, categoryRepo);
const updateUseCase = new UpdateBudgetUseCase(budgetRepo);
const deleteUseCase = new SoftDeleteBudgetUseCase(budgetRepo);
const syncCoordinator = SyncCoordinator.getInstance();

export function useBudgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    if (!user) {
      setBudgets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listUseCase.execute({ userId: user.id });
    if (result.success) {
      setBudgets(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadBudgets();

    const unsubscribe = appEvents.subscribe(
      ['budgets_changed', 'transactions_changed', 'categories_changed', 'data_invalidated'],
      () => {
        loadBudgets();
      }
    );

    return unsubscribe;
  }, [loadBudgets]);

  const createBudget = async (input: {
    categoryId: string;
    name?: string | null;
    amountMinorUnits: number;
    periodType: BudgetPeriodType;
    startDate: string;
    endDate: string;
  }): Promise<Result<Budget, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await createUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('budgets_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const updateBudget = async (input: {
    id: string;
    name?: string | null;
    amountMinorUnits: number;
    periodType: BudgetPeriodType;
    startDate: string;
    endDate: string;
  }): Promise<Result<Budget, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await updateUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('budgets_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const deleteBudget = async (budgetId: string): Promise<Result<void, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await deleteUseCase.execute({
      id: budgetId,
      userId: user.id,
    });

    if (result.success) {
      appEvents.emit('budgets_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  return {
    budgets,
    isLoading,
    error,
    refresh: loadBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
  };
}
