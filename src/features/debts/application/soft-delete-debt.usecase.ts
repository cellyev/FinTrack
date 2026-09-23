import { Result, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';

export class SoftDeleteDebtUseCase {
  constructor(private readonly debtRepo: IDebtRepository) {}

  public async execute(params: { id: string; userId: string }): Promise<Result<void, DomainError>> {
    const { id, userId } = params;

    if (!id || id.trim().length === 0) {
      return err(new ValidationError('Debt ID is required.'));
    }

    if (!userId || userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const existing = await this.debtRepo.getById(id, userId);
    if (!existing.success) {
      return err(existing.error);
    }
    if (!existing.data) {
      return err(new NotFoundError(`Debt with ID ${id} not found.`));
    }

    return this.debtRepo.softDelete(id, userId);
  }
}
