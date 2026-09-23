import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringSummary, calculateRecurringSummary } from '../domain/recurring-summary';

export interface GetRecurringSummaryDTO {
  userId: string;
  referenceDate?: string;
}

export class GetRecurringSummaryUseCase {
  constructor(private readonly recurringRepo: IRecurringTransactionRepository) {}

  public async execute(dto: GetRecurringSummaryDTO): Promise<Result<RecurringSummary, DomainError>> {
    try {
      if (!dto.userId || dto.userId.trim().length === 0) {
        return err(new ValidationError('UserId cannot be empty.'));
      }

      const listRes = await this.recurringRepo.listActive(dto.userId);
      if (!listRes.success) return err(listRes.error);

      const referenceDate = dto.referenceDate ?? new Date().toISOString().slice(0, 10);
      const summary = calculateRecurringSummary(listRes.data, referenceDate);

      return ok(summary);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
