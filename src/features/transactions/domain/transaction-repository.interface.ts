import { Result, DomainError } from '@/core/domain/result';
import { Transaction } from './transaction';
import { TransactionType } from './transaction-type';
import { Money } from '@/core/domain/money';

export interface TransactionFilter {
  userId: string;
  search?: string;
  accountId?: string;
  categoryId?: string;
  debtId?: string;
  recurringTransactionId?: string;
  type?: TransactionType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  minAmount?: Money;
  maxAmount?: Money;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface ITransactionRepository {
  create(transaction: Transaction): Promise<Result<void, DomainError>>;
  findById(id: string, userId: string): Promise<Result<Transaction | null, DomainError>>;
  update(transaction: Transaction): Promise<Result<void, DomainError>>;
  list(filter: TransactionFilter): Promise<Result<Transaction[], DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
  getAllActiveTransactions(userId: string): Promise<Result<Transaction[], DomainError>>;
  getAccountLedgerTransactions(accountId: string, userId: string): Promise<Result<Transaction[], DomainError>>;
}
