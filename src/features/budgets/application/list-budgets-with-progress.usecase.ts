import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { IBudgetRepository } from '../domain/budget-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { BudgetProgress, calculateBudgetProgress } from '../domain/budget-progress';
import { Category } from '@/features/categories/domain/category';
import { Money } from '@/core/domain/money';

export interface ListBudgetsWithProgressInput {
  userId: string;
}

export class ListBudgetsWithProgressUseCase {
  constructor(
    private readonly budgetRepo: IBudgetRepository,
    private readonly categoryRepo: ICategoryRepository
  ) {}

  public async execute(input: ListBudgetsWithProgressInput): Promise<Result<BudgetProgress[], DomainError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }

    const budgetsResult = await this.budgetRepo.listActive(input.userId);
    if (!budgetsResult.success) {
      return err(budgetsResult.error);
    }
    const budgets = budgetsResult.data;

    if (budgets.length === 0) {
      return ok([]);
    }

    const categoriesResult = await this.categoryRepo.listByUser(input.userId);
    const categoriesMap = new Map<string, Category>();
    if (categoriesResult.success) {
      for (const cat of categoriesResult.data) {
        categoriesMap.set(cat.id, cat);
      }
    }

    const progressList: BudgetProgress[] = [];

    for (const budget of budgets) {
      const category = categoriesMap.get(budget.categoryId);
      const spendingResult = await this.budgetRepo.getActualSpending(
        input.userId,
        budget.categoryId,
        budget.period.startDate,
        budget.period.endDate
      );

      const actualSpending = spendingResult.success
        ? spendingResult.data
        : Money.fromMinorUnits(0n, 'IDR');

      const progress = calculateBudgetProgress({
        budget,
        categoryName: category?.name ?? 'Kategori',
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        actualSpending,
      });

      progressList.push(progress);
    }

    return ok(progressList);
  }
}
