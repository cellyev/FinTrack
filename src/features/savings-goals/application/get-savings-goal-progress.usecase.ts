import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';
import { SavingsGoalProgress, calculateSavingsGoalProgress } from '../domain/savings-goal-progress';

export class GetSavingsGoalProgressUseCase {
  constructor(private readonly goalRepo: ISavingsGoalRepository) {}

  public async execute(params: {
    id: string;
    userId: string;
  }): Promise<Result<SavingsGoalProgress, DomainError>> {
    const { id, userId } = params;

    if (!id || id.trim().length === 0) {
      return err(new ValidationError('Savings Goal ID is required.'));
    }
    if (!userId || userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const goalResult = await this.goalRepo.getById(id, userId);
    if (!goalResult.success) {
      return err(goalResult.error);
    }
    if (!goalResult.data || goalResult.data.isDeleted) {
      return err(new NotFoundError('Target tabungan tidak ditemukan atau telah dihapus.'));
    }

    const progress = calculateSavingsGoalProgress(goalResult.data);
    return ok(progress);
  }
}
