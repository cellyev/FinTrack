import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SavingsGoalProgress } from '../domain/savings-goal-progress';
import { SavingsGoal } from '../domain/savings-goal';
import { SqliteSavingsGoalRepository } from '../data/sqlite-savings-goal.repository';
import { ListSavingsGoalsUseCase } from '../application/list-savings-goals.usecase';
import { CreateSavingsGoalUseCase } from '../application/create-savings-goal.usecase';
import { UpdateSavingsGoalUseCase } from '../application/update-savings-goal.usecase';
import { SoftDeleteSavingsGoalUseCase } from '../application/soft-delete-savings-goal.usecase';
import { Result, DomainError } from '@/core/domain/result';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

const savingsGoalRepo = new SqliteSavingsGoalRepository();
const listUseCase = new ListSavingsGoalsUseCase(savingsGoalRepo);
const createUseCase = new CreateSavingsGoalUseCase(savingsGoalRepo);
const updateUseCase = new UpdateSavingsGoalUseCase(savingsGoalRepo);
const deleteUseCase = new SoftDeleteSavingsGoalUseCase(savingsGoalRepo);
const syncCoordinator = SyncCoordinator.getInstance();

export function useSavingsGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    if (!user) {
      setGoals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await listUseCase.execute({ userId: user.id });
    if (result.success) {
      setGoals(result.data);
    } else {
      setError(result.error.message);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadGoals();

    const unsubscribe = appEvents.subscribe(
      ['savings_goals_changed', 'transactions_changed', 'accounts_changed', 'data_invalidated'],
      () => {
        loadGoals();
      }
    );

    return unsubscribe;
  }, [loadGoals]);

  const createGoal = async (input: {
    name: string;
    targetAmountMinorUnits: number;
    currentAmountMinorUnits?: number;
    targetDate?: string | null;
  }): Promise<Result<SavingsGoal, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await createUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('savings_goals_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const updateGoal = async (input: {
    id: string;
    name: string;
    targetAmountMinorUnits: number;
    currentAmountMinorUnits: number;
    targetDate?: string | null;
  }): Promise<Result<SavingsGoal, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await updateUseCase.execute({
      userId: user.id,
      ...input,
    });

    if (result.success) {
      appEvents.emit('savings_goals_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  const deleteGoal = async (goalId: string): Promise<Result<void, DomainError>> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await deleteUseCase.execute({
      id: goalId,
      userId: user.id,
    });

    if (result.success) {
      appEvents.emit('savings_goals_changed');
      syncCoordinator.requestSync('manual');
    }

    return result;
  };

  return {
    goals,
    isLoading,
    error,
    refresh: loadGoals,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
