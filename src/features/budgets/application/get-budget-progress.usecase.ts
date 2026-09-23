import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { IBudgetRepository } from '../domain/budget-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { BudgetProgress, calculateBudgetProgress } from '../domain/budget-progress';

export interface GetBudgetProgressInput {
  budgetId: string;
  userId: string;
}

export class GetBudgetProgressUseCase {
  constructor(
    private readonly budgetRepo: IBudgetRepository,
    private readonly categoryRepo: ICategoryRepository
  ) {}

  public async execute(input: GetBudgetProgressInput): Promise<Result<BudgetProgress, DomainError>> {
    if (!input.budgetId || input.budgetId.trim().length === 0) {
      return err(new ValidationError('Budget ID is required.'));
    }
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const budgetResult = await this.budgetRepo.getById(input.budgetId, input.userId);
    if (!budgetResult.success) {
      return err(budgetResult.error);
    }
    const budget = budgetResult.data;
    if (!budget || budget.isDeleted) {
      return err(new NotFoundError('Budget not found or has been deleted.'));
    }

    // Fetch category
    const categoryResult = await this.categoryRepo.findById(budget.categoryId, input.userId);
    const category = categoryResult.success ? categoryResult.data : null;

    // Fetch actual spending
    const spendingResult = await this.budgetRepo.getActualSpending(
      input.userId,
      budget.categoryId,
      budget.period.startDate,
      budget.period.endDate
    );
    if (!spendingResult.success) {
      return err(spendingResult.error);
    }
    const actualSpending = spendingResult.data;

    const progress = calculateBudgetProgress({
      budget,
      categoryName: category?.name ?? 'Kategori',
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? null,
      actualSpending,
    });

    return ok(progress);
  }
}
