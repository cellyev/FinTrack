import { Result, ok, err, DomainError, NotFoundError } from '@/core/domain/result';
import { IRecurringTransactionRepository } from '../domain/recurring-repository.interface';
import { RecurringTransaction } from '../domain/recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';

export interface ProcessDueRecurringDTO {
  userId: string;
  referenceDate?: string; // YYYY-MM-DD (defaults to today)
  specificRecurringId?: string; // Optional: process only one specific recurring schedule
}

export interface ProcessDueRecurringSummary {
  processedSchedulesCount: number;
  generatedTransactionsCount: number;
  skippedDuplicateCount: number;
  generatedTransactions: Transaction[];
}

export class ProcessDueRecurringTransactionsUseCase {
  constructor(
    private readonly recurringRepo: IRecurringTransactionRepository,
    private readonly uuidGenerator: IUuidGenerator = new ExpoUuidGenerator()
  ) {}

  public async execute(dto: ProcessDueRecurringDTO): Promise<Result<ProcessDueRecurringSummary, DomainError>> {
    try {
      const referenceDate = dto.referenceDate ?? new Date().toISOString().slice(0, 10);
      let schedulesToProcess: RecurringTransaction[] = [];

      if (dto.specificRecurringId) {
        const getRes = await this.recurringRepo.getById(dto.specificRecurringId, dto.userId);
        if (!getRes.success) return err(getRes.error);
        if (!getRes.data) {
          return err(new NotFoundError(`Recurring transaction ${dto.specificRecurringId} not found.`));
        }
        if (getRes.data.isDue(referenceDate)) {
          schedulesToProcess.push(getRes.data);
        }
      } else {
        const listRes = await this.recurringRepo.listDue(dto.userId, referenceDate);
        if (!listRes.success) return err(listRes.error);
        schedulesToProcess = listRes.data;
      }

      const summary: ProcessDueRecurringSummary = {
        processedSchedulesCount: schedulesToProcess.length,
        generatedTransactionsCount: 0,
        skippedDuplicateCount: 0,
        generatedTransactions: [],
      };

      for (const recurring of schedulesToProcess) {
        // Sequentially process all due occurrences up to referenceDate
        // Max iteration guard (e.g. 500) to prevent infinite loops in bad configs
        let iteration = 0;
        const maxIterations = 500;

        while (recurring.isDue(referenceDate) && iteration < maxIterations) {
          iteration++;
          const occurrenceDate = recurring.nextOccurrence;
          const occurrenceKey = `${recurring.id}_${occurrenceDate}`;

          // Create canonical Transaction entity
          const txId = this.uuidGenerator.generate();
          const itemId = this.uuidGenerator.generate();

          const item = new TransactionItem({
            id: itemId,
            transactionId: txId,
            categoryId: recurring.categoryId,
            amount: recurring.amount,
            note: recurring.note,
          });

          const isIncome = recurring.isIncome;
          const generatedTx = new Transaction({
            id: txId,
            userId: recurring.userId,
            type: recurring.type,
            amount: recurring.amount,
            sourceAccountId: isIncome ? null : recurring.accountId,
            destinationAccountId: isIncome ? recurring.accountId : null,
            transactionDate: occurrenceDate,
            items: [item],
            note: recurring.note ? `[Rutin] ${recurring.note}` : `[Rutin] Transaksi Berulang`,
            recurringTransactionId: recurring.id,
            occurrenceKey,
          });

          const processRes = await this.recurringRepo.processOccurrence({
            recurring,
            occurrenceDate,
            generatedTransaction: generatedTx,
          });

          if (!processRes.success) {
            return err(processRes.error);
          }

          if (processRes.data.createdTransaction) {
            summary.generatedTransactionsCount++;
            summary.generatedTransactions.push(processRes.data.createdTransaction);
          } else {
            summary.skippedDuplicateCount++;
          }
        }
      }

      return ok(summary);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new NotFoundError((e as Error).message));
    }
  }
}
