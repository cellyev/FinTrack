import { Result, ok, err, ValidationError, DomainError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringTransaction, RecurringType } from '../domain/recurring-transaction';
import { RecurringFrequency } from '../domain/recurring-frequency';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';

export interface CreateRecurringTransactionDTO {
  userId: string;
  type: RecurringType;
  amountMinorUnits: number;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  note?: string | null;
}

export class CreateRecurringTransactionUseCase {
  constructor(
    private readonly recurringRepo: IRecurringTransactionRepository,
    private readonly uuidGenerator: IUuidGenerator = new ExpoUuidGenerator()
  ) {}

  public async execute(dto: CreateRecurringTransactionDTO): Promise<Result<RecurringTransaction, DomainError>> {
    try {
      if (dto.amountMinorUnits <= 0) {
        return err(new ValidationError('Jumlah nominal transaksi berulang harus lebih dari 0.'));
      }

      const id = this.uuidGenerator.generate();
      const amount = Money.fromMinorUnits(BigInt(dto.amountMinorUnits));

      const recurring = new RecurringTransaction({
        id,
        userId: dto.userId,
        type: dto.type,
        amount,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        frequency: dto.frequency,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        nextOccurrence: dto.startDate, // Starts at startDate
        isActive: true,
        note: dto.note ?? null,
        syncState: 'pending',
      });

      const result = await this.recurringRepo.create(recurring);
      if (!result.success) {
        return err(result.error);
      }

      return ok(result.data);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
