import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { Budget } from '../domain/budget';
import { BudgetPeriod, BudgetPeriodType } from '../domain/budget-period';
import { IBudgetRepository } from '../domain/budget-repository.interface';
import { Money } from '@/core/domain/money';
import { IClock } from '@/core/domain/clock.interface';
import { SystemClock } from '@/core/infrastructure/clock/system-clock';

export interface UpdateBudgetInput {
  id: string;
  userId: string;
  name?: string | null;
  amountMinorUnits: number;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
}

export class UpdateBudgetUseCase {
  constructor(
    private readonly budgetRepo: IBudgetRepository,
    private readonly clock: IClock = new SystemClock()
  ) {}

  public async execute(input: UpdateBudgetInput): Promise<Result<Budget, DomainError>> {
    if (!input.id || input.id.trim().length === 0) {
      return err(new ValidationError('Budget ID is required.'));
    }
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }
    if (input.amountMinorUnits <= 0) {
      return err(new ValidationError('Budget amount must be greater than zero.'));
    }

    // 1. Fetch existing budget
    const existingResult = await this.budgetRepo.getById(input.id, input.userId);
    if (!existingResult.success) {
      return err(existingResult.error);
    }
    const existing = existingResult.data;
    if (!existing || existing.isDeleted) {
      return err(new NotFoundError('Budget not found or has been deleted.'));
    }

    // 2. Validate period
    let period: BudgetPeriod;
    try {
      period = new BudgetPeriod(input.startDate, input.endDate, input.periodType);
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    const now = this.clock.now().toISOString();
    const amount = Money.fromMinorUnits(input.amountMinorUnits, 'IDR');

    const updatedBudget = new Budget({
      id: existing.id,
      userId: existing.userId,
      categoryId: existing.categoryId,
      name: input.name !== undefined ? input.name : existing.name,
      amount,
      period,
      createdAt: existing.createdAt,
      updatedAt: now,
      deletedAt: null,
      syncState: 'pending',
      baseUpdatedAt: existing.updatedAt,
    });

    const updateResult = await this.budgetRepo.update(updatedBudget);
    if (!updateResult.success) {
      return err(updateResult.error);
    }

    return ok(updatedBudget);
  }
}
