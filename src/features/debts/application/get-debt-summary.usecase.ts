import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { DebtSummary, calculateDebtSummary } from '../domain/debt-summary';

export class GetDebtSummaryUseCase {
  constructor(private readonly debtRepo: IDebtRepository) {}

  public async execute(params: { userId: string; referenceDate?: string }): Promise<Result<DebtSummary, DomainError>> {
    if (!params.userId || params.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const listResult = await this.debtRepo.listActive(params.userId);
    if (!listResult.success) {
      return err(listResult.error);
    }

    const summary = calculateDebtSummary(listResult.data, params.referenceDate);
    return ok(summary);
  }
}
