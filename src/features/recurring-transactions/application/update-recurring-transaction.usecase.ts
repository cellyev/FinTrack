import { Result, ok, err, NotFoundError, ValidationError, DomainError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringTransaction, RecurringType } from '../domain/recurring-transaction';
import { RecurringFrequency } from '../domain/recurring-frequency';
import { Money } from '@/core/domain/money';

export interface UpdateRecurringTransactionDTO {
  id: string;
  userId: string;
  type?: RecurringType;
  amountMinorUnits?: number;
  accountId?: string;
  categoryId?: string;
  frequency?: RecurringFrequency;
  startDate?: string;
  endDate?: string | null;
  nextOccurrence?: string;
  isActive?: boolean;
  note?: string | null;
}

export class UpdateRecurringTransactionUseCase {
  constructor(private readonly recurringRepo: IRecurringTransactionRepository) {}

  public async execute(dto: UpdateRecurringTransactionDTO): Promise<Result<RecurringTransaction, DomainError>> {
    try {
      const getRes = await this.recurringRepo.getById(dto.id, dto.userId);
      if (!getRes.success) return err(getRes.error);
      if (!getRes.data) {
        return err(new NotFoundError(`Recurring transaction ${dto.id} not found.`));
      }

      const existing = getRes.data;
      const amount = dto.amountMinorUnits !== undefined
        ? Money.fromMinorUnits(BigInt(dto.amountMinorUnits))
        : existing.amount;

      if (amount.minorUnits <= 0n) {
        return err(new ValidationError('Nominal transaksi berulang harus lebih dari 0.'));
      }

      const updated = new RecurringTransaction({
        id: existing.id,
        userId: existing.userId,
        type: dto.type ?? existing.type,
        amount,
        accountId: dto.accountId ?? existing.accountId,
        categoryId: dto.categoryId ?? existing.categoryId,
        frequency: dto.frequency ?? existing.frequency,
        startDate: dto.startDate ?? existing.startDate,
        endDate: dto.endDate !== undefined ? dto.endDate : existing.endDate,
        nextOccurrence: dto.nextOccurrence ?? existing.nextOccurrence,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        note: dto.note !== undefined ? dto.note : existing.note,
        createdAt: existing.createdAt,
        syncState: 'pending',
      });

      const updateRes = await this.recurringRepo.update(updated);
      if (!updateRes.success) return err(updateRes.error);

      return ok(updateRes.data);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
