import { Result, ok, err, NotFoundError, DomainError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';

export interface SoftDeleteRecurringDTO {
  id: string;
  userId: string;
}

export class SoftDeleteRecurringTransactionUseCase {
  constructor(private readonly recurringRepo: IRecurringTransactionRepository) {}

  public async execute(dto: SoftDeleteRecurringDTO): Promise<Result<void, DomainError>> {
    try {
      const getRes = await this.recurringRepo.getById(dto.id, dto.userId);
      if (!getRes.success) return err(getRes.error);
      if (!getRes.data) {
        return err(new NotFoundError(`Recurring transaction ${dto.id} not found.`));
      }

      const delRes = await this.recurringRepo.softDelete(dto.id, dto.userId);
      if (!delRes.success) return err(delRes.error);

      return ok(undefined);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new NotFoundError((e as Error).message));
    }
  }
}
