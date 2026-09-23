import { Result, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';

export class SoftDeleteSavingsGoalUseCase {
  constructor(private readonly goalRepo: ISavingsGoalRepository) {}

  public async execute(params: { id: string; userId: string }): Promise<Result<void, DomainError>> {
    const { id, userId } = params;

    if (!id || id.trim().length === 0) {
      return err(new ValidationError('Savings Goal ID is required.'));
    }
    if (!userId || userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const existingResult = await this.goalRepo.getById(id, userId);
    if (!existingResult.success) {
      return err(existingResult.error);
    }
    if (!existingResult.data || existingResult.data.isDeleted) {
      return err(new NotFoundError('Target tabungan tidak ditemukan atau telah dihapus.'));
    }

    return this.goalRepo.softDelete(id, userId);
  }
}
