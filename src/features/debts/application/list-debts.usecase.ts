import { Result, err, DomainError, ValidationError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt, DebtType, DebtStatus } from '../domain/debt';

export interface ListDebtsFilter {
  userId: string;
  type?: DebtType;
  status?: DebtStatus;
}

export class ListDebtsUseCase {
  constructor(private readonly debtRepo: IDebtRepository) {}

  public async execute(filter: ListDebtsFilter): Promise<Result<Debt[], DomainError>> {
    if (!filter.userId || filter.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    return this.debtRepo.listActive(filter.userId, {
      type: filter.type,
      status: filter.status,
    });
  }
}
