import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { Budget } from '../domain/budget';
import { BudgetPeriod, BudgetPeriodType } from '../domain/budget-period';
import { IBudgetRepository } from '../domain/budget-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { IClock } from '@/core/domain/clock.interface';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';
import { SystemClock } from '@/core/infrastructure/clock/system-clock';

export interface CreateBudgetInput {
  userId: string;
  categoryId: string;
  name?: string | null;
  amountMinorUnits: number;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
}

export class CreateBudgetUseCase {
  constructor(
    private readonly budgetRepo: IBudgetRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly uuidGenerator: IUuidGenerator = new ExpoUuidGenerator(),
    private readonly clock: IClock = new SystemClock()
  ) {}

  public async execute(input: CreateBudgetInput): Promise<Result<Budget, DomainError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    if (input.amountMinorUnits <= 0) {
      return err(new ValidationError('Budget amount must be greater than zero.'));
    }

    // 1. Verify category exists and belongs to user (or is system) and is active
    const categoryResult = await this.categoryRepo.findById(input.categoryId, input.userId);
    if (!categoryResult.success) {
      return err(categoryResult.error);
    }
    const category = categoryResult.data;
    if (!category || category.isDeleted()) {
      return err(new NotFoundError('Category not found or has been deleted.'));
    }

    // Budgets are strictly for expense categories
    if (category.type !== 'expense') {
      return err(new ValidationError('Budgets can only be set for expense categories.'));
    }

    // 2. Validate period
    let period: BudgetPeriod;
    try {
      period = new BudgetPeriod(input.startDate, input.endDate, input.periodType);
    } catch (e) {
      return err(new ValidationError((e as Error).message));
    }

    const now = this.clock.now().toISOString();
    const id = this.uuidGenerator.generate();
    const amount = Money.fromMinorUnits(input.amountMinorUnits, 'IDR');

    const budget = new Budget({
      id,
      userId: input.userId,
      categoryId: input.categoryId,
      name: input.name,
      amount,
      period,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncState: 'pending',
      baseUpdatedAt: null,
    });

    const createResult = await this.budgetRepo.create(budget);
    if (!createResult.success) {
      return err(createResult.error);
    }

    return ok(budget);
  }
}
