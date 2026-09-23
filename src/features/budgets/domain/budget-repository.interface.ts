import { Result, DomainError } from '@/core/domain/result';
import { Budget } from './budget';
import { Money } from '@/core/domain/money';

export interface IBudgetRepository {
  create(budget: Budget): Promise<Result<void, DomainError>>;
  update(budget: Budget): Promise<Result<void, DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
  getById(id: string, userId: string): Promise<Result<Budget | null, DomainError>>;
  listActive(userId: string): Promise<Result<Budget[], DomainError>>;
  getActualSpending(
    userId: string,
    categoryId: string,
    startDate: string,
    endDate: string
  ): Promise<Result<Money, DomainError>>;
}
