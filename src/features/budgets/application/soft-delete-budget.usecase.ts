import { Result, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { IBudgetRepository } from '../domain/budget-repository.interface';

export interface SoftDeleteBudgetInput {
  id: string;
  userId: string;
}

export class SoftDeleteBudgetUseCase {
  constructor(private readonly budgetRepo: IBudgetRepository) {}

  public async execute(input: SoftDeleteBudgetInput): Promise<Result<void, DomainError>> {
    if (!input.id || input.id.trim().length === 0) {
      return err(new ValidationError('Budget ID is required.'));
    }
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const existingResult = await this.budgetRepo.getById(input.id, input.userId);
    if (!existingResult.success) {
      return err(existingResult.error);
    }
    const existing = existingResult.data;
    if (!existing || existing.isDeleted) {
      return err(new NotFoundError('Budget not found or already deleted.'));
    }

    return this.budgetRepo.softDelete(input.id, input.userId);
  }
}
