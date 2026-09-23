import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt } from '../domain/debt';
import { ITransactionRepository } from '@/features/transactions/domain/transaction-repository.interface';
import { Transaction } from '@/features/transactions/domain/transaction';

export interface DebtDetailDTO {
  debt: Debt;
  transactions: Transaction[];
}

export class GetDebtDetailUseCase {
  constructor(
    private readonly debtRepo: IDebtRepository,
    private readonly transactionRepo: ITransactionRepository
  ) {}

  public async execute(params: { id: string; userId: string }): Promise<Result<DebtDetailDTO, DomainError>> {
    const { id, userId } = params;

    if (!id || id.trim().length === 0) {
      return err(new ValidationError('Debt ID is required.'));
    }
    if (!userId || userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const debtResult = await this.debtRepo.getById(id, userId);
    if (!debtResult.success) {
      return err(debtResult.error);
    }
    if (!debtResult.data) {
      return err(new NotFoundError(`Debt with ID ${id} not found.`));
    }

    const txListResult = await this.transactionRepo.list({
      userId,
      debtId: id,
    });

    const transactions = txListResult.success ? txListResult.data : [];

    return ok({
      debt: debtResult.data,
      transactions,
    });
  }
}
