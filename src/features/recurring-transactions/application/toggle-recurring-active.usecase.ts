import { Result, ok, err, NotFoundError, DomainError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction';

export interface ToggleRecurringActiveDTO {
  id: string;
  userId: string;
  isActive: boolean;
}

export class ToggleRecurringActiveUseCase {
  constructor(private readonly recurringRepo: IRecurringTransactionRepository) {}

  public async execute(dto: ToggleRecurringActiveDTO): Promise<Result<RecurringTransaction, DomainError>> {
    try {
      const getRes = await this.recurringRepo.getById(dto.id, dto.userId);
      if (!getRes.success) return err(getRes.error);
      if (!getRes.data) {
        return err(new NotFoundError(`Recurring transaction ${dto.id} not found.`));
      }

      const recurring = getRes.data;
      recurring.setActive(dto.isActive);

      const updateRes = await this.recurringRepo.update(recurring);
      if (!updateRes.success) return err(updateRes.error);

      return ok(updateRes.data);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new NotFoundError((e as Error).message));
    }
  }
}
