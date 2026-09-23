import { Debt, DebtType, DebtStatus } from './debt';
import { Transaction } from '@/features/transactions/domain/transaction';
import { Result, DomainError } from '@/core/domain/result';
import { Money } from '@/core/domain/money';

export interface IDebtRepository {
  create(debt: Debt, initialTransaction?: Transaction): Promise<Result<void, DomainError>>;
  recordRepayment(params: {
    debtId: string;
    userId: string;
    paymentAmount: Money;
    repaymentTransaction?: Transaction;
  }): Promise<Result<Debt, DomainError>>;
  update(debt: Debt): Promise<Result<void, DomainError>>;
  softDelete(debtId: string, userId: string): Promise<Result<void, DomainError>>;
  getById(debtId: string, userId: string): Promise<Result<Debt | null, DomainError>>;
  listActive(userId: string, filter?: { type?: DebtType; status?: DebtStatus }): Promise<Result<Debt[], DomainError>>;
}
