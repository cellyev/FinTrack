import { Result, DomainError } from '@/core/domain/result';
import { Account } from './account';
import { Transaction } from '@/features/transactions/domain/transaction';

export interface IAccountRepository {
  create(account: Account): Promise<Result<void, DomainError>>;
  createWithOpeningBalance(
    account: Account,
    openingBalanceTransaction?: Transaction
  ): Promise<Result<void, DomainError>>;
  findById(id: string, userId: string): Promise<Result<Account | null, DomainError>>;
  listByUser(userId: string, includeInactive?: boolean): Promise<Result<Account[], DomainError>>;
  update(account: Account): Promise<Result<void, DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
}
