import { Result, err, DomainError, ValidationError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction';

export interface ListRecurringTransactionsDTO {
  userId: string;
}

export class ListRecurringTransactionsUseCase {
  constructor(private readonly recurringRepo: IRecurringTransactionRepository) {}

  public async execute(dto: ListRecurringTransactionsDTO): Promise<Result<RecurringTransaction[], DomainError>> {
    try {
      if (!dto.userId || dto.userId.trim().length === 0) {
        return err(new ValidationError('UserId cannot be empty.'));
      }
      return await this.recurringRepo.listActive(dto.userId);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
