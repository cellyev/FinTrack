import { Result, DomainError } from '@/core/domain/result';
import { RecurringTransaction } from './recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';

export interface ProcessOccurrenceParams {
  recurring: RecurringTransaction;
  occurrenceDate: string; // YYYY-MM-DD
  generatedTransaction: Transaction;
}

export interface ProcessOccurrenceResult {
  recurring: RecurringTransaction;
  createdTransaction: Transaction | null; // null if occurrence already existed (idempotent skip)
}

export interface IRecurringTransactionRepository {
  create(recurring: RecurringTransaction): Promise<Result<RecurringTransaction, DomainError>>;
  update(recurring: RecurringTransaction): Promise<Result<RecurringTransaction, DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
  getById(id: string, userId: string): Promise<Result<RecurringTransaction | null, DomainError>>;
  listActive(userId: string): Promise<Result<RecurringTransaction[], DomainError>>;
  listDue(userId: string, referenceDate: string): Promise<Result<RecurringTransaction[], DomainError>>;
  processOccurrence(params: ProcessOccurrenceParams): Promise<Result<ProcessOccurrenceResult, DomainError>>;
}
