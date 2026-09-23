import { SavingsGoal } from './savings-goal';
import { Result, DomainError } from '@/core/domain/result';

export interface ISavingsGoalRepository {
  create(goal: SavingsGoal): Promise<Result<void, DomainError>>;
  update(goal: SavingsGoal): Promise<Result<void, DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
  getById(id: string, userId: string): Promise<Result<SavingsGoal | null, DomainError>>;
  listActive(userId: string): Promise<Result<SavingsGoal[], DomainError>>;
}
