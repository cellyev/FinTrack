import { Result, ok, err, DomainError, DatabaseError } from '@/core/domain/result';
import { Money } from '@/core/domain/money';
import { ITransactionRepository } from '@/features/transactions/domain/transaction-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { IBudgetRepository } from '@/features/budgets/domain/budget-repository.interface';
import { ListBudgetsWithProgressUseCase } from '@/features/budgets/application/list-budgets-with-progress.usecase';
import {
  MonthlyAnalyticsDTO,
  MonthlyCashflowSummary,
  CategorySpendingItem,
  BudgetHealthOverview,
  MonthlyComparison,
} from '../domain/analytics-types';

export function getMonthDateRange(period: string): {
  startDate: string;
  endDate: string;
  previousPeriod: string;
  periodDisplay: string;
} {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const startDate = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

  // Previous month calculation
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const previousPeriod = `${prevYear}-${pad(prevMonth)}`;

  // Indonesian display name e.g. "Agustus 2026"
  const dateObj = new Date(year, month - 1, 1);
  const periodDisplay = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(dateObj);

  return {
    startDate,
    endDate,
    previousPeriod,
    periodDisplay,
  };
}

export class GetMonthlyAnalyticsUseCase {
  private readonly listBudgetsUseCase: ListBudgetsWithProgressUseCase;

  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly budgetRepository: IBudgetRepository
  ) {
    this.listBudgetsUseCase = new ListBudgetsWithProgressUseCase(
      this.budgetRepository,
      this.categoryRepository
    );
  }

  public async execute(
    userId: string,
    period: string // YYYY-MM
  ): Promise<Result<MonthlyAnalyticsDTO, DomainError>> {
    try {
      const { startDate, endDate, previousPeriod, periodDisplay } = getMonthDateRange(period);
      const prevRange = getMonthDateRange(previousPeriod);

      // 1. Fetch current month transactions, previous month transactions, categories, and budgets concurrently
      const [currTxResult, prevTxResult, categoriesResult, budgetsResult] = await Promise.all([
        this.transactionRepository.list({
          userId,
          startDate,
          endDate,
          includeDeleted: false,
        }),
        this.transactionRepository.list({
          userId,
          startDate: prevRange.startDate,
          endDate: prevRange.endDate,
          includeDeleted: false,
        }),
        this.categoryRepository.listByUser(userId, undefined, true),
        this.listBudgetsUseCase.execute({ userId }),
      ]);

      if (!currTxResult.success) return err(currTxResult.error);
      if (!prevTxResult.success) return err(prevTxResult.error);
      if (!categoriesResult.success) return err(categoriesResult.error);
      if (!budgetsResult.success) return err(budgetsResult.error);

      const currentTransactions = currTxResult.data;
      const previousTransactions = prevTxResult.data;
      const categories = categoriesResult.data;
      const budgetProgressList = budgetsResult.data;

      // Category lookup map
      const categoryMap = new Map(categories.map((c) => [c.id, c]));

      // 2. Compute Current Month Cashflow
      let currentIncomeMinor = 0n;
      let currentExpenseMinor = 0n;

      // Map for category spending breakdown: categoryId -> minorUnits
      const catSpendingMap = new Map<string, bigint>();

      for (const tx of currentTransactions) {
        if (tx.type === 'income') {
          currentIncomeMinor += tx.amount.minorUnits;
        } else if (tx.type === 'expense') {
          currentExpenseMinor += tx.amount.minorUnits;

          // Process categories (handling multi-split items)
          if (tx.items.length > 0) {
            for (const item of tx.items) {
              const prevCatSum = catSpendingMap.get(item.categoryId) ?? 0n;
              catSpendingMap.set(item.categoryId, prevCatSum + item.amount.minorUnits);
            }
          }
        }
        // Transfers are intentionally excluded from income and expenses
      }

      const currentIncome = Money.fromMinorUnits(currentIncomeMinor, 'IDR');
      const currentExpense = Money.fromMinorUnits(currentExpenseMinor, 'IDR');

      const isNetPositive = currentIncomeMinor >= currentExpenseMinor;
      const netCashflowMinor = isNetPositive
        ? currentIncomeMinor - currentExpenseMinor
        : currentExpenseMinor - currentIncomeMinor;
      const netCashflow = Money.fromMinorUnits(netCashflowMinor, 'IDR');

      let netCashflowFormatted = 'Rp 0';
      if (netCashflowMinor > 0n) {
        netCashflowFormatted = `${isNetPositive ? '+' : '-'}${netCashflow.formatDisplay()}`;
      }

      // Savings rate: (net / income) * 100 with tenths precision
      let savingsRatePercentage = 0;
      if (currentIncomeMinor > 0n && isNetPositive) {
        const rateTenths = Number((netCashflowMinor * 1000n) / currentIncomeMinor);
        savingsRatePercentage = rateTenths / 10;
      }

      const cashflow: MonthlyCashflowSummary = {
        period,
        income: currentIncome,
        expense: currentExpense,
        netCashflow,
        isNetPositive,
        netCashflowFormatted,
        savingsRatePercentage,
      };

      // 3. Compute Category Spending Breakdown
      const categorySpendingItems: CategorySpendingItem[] = [];

      for (const [catId, amountMinor] of catSpendingMap.entries()) {
        const cat = categoryMap.get(catId);
        const catAmount = Money.fromMinorUnits(amountMinor, 'IDR');

        let percentage = 0;
        if (currentExpenseMinor > 0n) {
          const pctTenths = Number((amountMinor * 1000n) / currentExpenseMinor);
          percentage = pctTenths / 10;
        }

        categorySpendingItems.push({
          categoryId: catId,
          categoryName: cat?.name ?? 'Kategori Lain',
          categoryColor: cat?.color ?? '#888888',
          categoryIcon: cat?.icon ?? '🏷️',
          amount: catAmount,
          percentage,
        });
      }

      // Sort category spending by amount descending
      categorySpendingItems.sort((a, b) => (b.amount.minorUnits > a.amount.minorUnits ? 1 : -1));

      // 4. Compute Budget Health Overview
      let totalBudgetMinor = 0n;
      let totalBudgetSpentMinor = 0n;
      let overBudgetCount = 0;

      for (const bp of budgetProgressList) {
        totalBudgetMinor += bp.budgetAmount.minorUnits;
        totalBudgetSpentMinor += bp.actualSpending.minorUnits;
        if (bp.isOverBudget) {
          overBudgetCount++;
        }
      }

      const totalBudgetMoney = Money.fromMinorUnits(totalBudgetMinor, 'IDR');
      const totalBudgetSpentMoney = Money.fromMinorUnits(totalBudgetSpentMinor, 'IDR');
      const totalBudgetRemainingMinor =
        totalBudgetMinor > totalBudgetSpentMinor ? totalBudgetMinor - totalBudgetSpentMinor : 0n;
      const totalBudgetRemainingMoney = Money.fromMinorUnits(totalBudgetRemainingMinor, 'IDR');

      let utilizationPercentage = 0;
      if (totalBudgetMinor > 0n) {
        const utilTenths = Number((totalBudgetSpentMinor * 1000n) / totalBudgetMinor);
        utilizationPercentage = utilTenths / 10;
      }

      const budgetHealth: BudgetHealthOverview = {
        totalBudget: totalBudgetMoney,
        totalSpent: totalBudgetSpentMoney,
        totalRemaining: totalBudgetRemainingMoney,
        utilizationPercentage,
        budgetCount: budgetProgressList.length,
        overBudgetCount,
      };

      // 5. Compute Month-over-Month Comparison
      let prevIncomeMinor = 0n;
      let prevExpenseMinor = 0n;

      for (const tx of previousTransactions) {
        if (tx.type === 'income') {
          prevIncomeMinor += tx.amount.minorUnits;
        } else if (tx.type === 'expense') {
          prevExpenseMinor += tx.amount.minorUnits;
        }
      }

      const previousIncome = Money.fromMinorUnits(prevIncomeMinor, 'IDR');
      const previousExpense = Money.fromMinorUnits(prevExpenseMinor, 'IDR');

      // Expense comparison
      const isExpenseIncreased = currentExpenseMinor >= prevExpenseMinor;
      const expenseDeltaMinor = isExpenseIncreased
        ? currentExpenseMinor - prevExpenseMinor
        : prevExpenseMinor - currentExpenseMinor;
      const expenseDelta = Money.fromMinorUnits(expenseDeltaMinor, 'IDR');

      let expenseDeltaPercentage = 0;
      if (prevExpenseMinor > 0n) {
        const expDeltaTenths = Number((expenseDeltaMinor * 1000n) / prevExpenseMinor);
        expenseDeltaPercentage = expDeltaTenths / 10;
      }

      // Income comparison
      const isIncomeIncreased = currentIncomeMinor >= prevIncomeMinor;
      const incomeDeltaMinor = isIncomeIncreased
        ? currentIncomeMinor - prevIncomeMinor
        : prevIncomeMinor - currentIncomeMinor;
      const incomeDelta = Money.fromMinorUnits(incomeDeltaMinor, 'IDR');

      let incomeDeltaPercentage = 0;
      if (prevIncomeMinor > 0n) {
        const incDeltaTenths = Number((incomeDeltaMinor * 1000n) / prevIncomeMinor);
        incomeDeltaPercentage = incDeltaTenths / 10;
      }

      const prevNetIsPositive = prevIncomeMinor >= prevExpenseMinor;
      const prevNetCashflowMinor = prevNetIsPositive
        ? prevIncomeMinor - prevExpenseMinor
        : prevExpenseMinor - prevIncomeMinor;
      const previousNetCashflow = Money.fromMinorUnits(prevNetCashflowMinor, 'IDR');

      const comparison: MonthlyComparison = {
        currentPeriod: period,
        previousPeriod,
        currentExpense,
        previousExpense,
        expenseDelta,
        isExpenseIncreased,
        expenseDeltaPercentage,
        currentIncome,
        previousIncome,
        incomeDelta,
        isIncomeIncreased,
        incomeDeltaPercentage,
        currentNetCashflow: netCashflow,
        currentNetIsPositive: isNetPositive,
        previousNetCashflow,
        previousNetIsPositive: prevNetIsPositive,
      };

      return ok({
        period,
        periodDisplay,
        cashflow,
        categories: categorySpendingItems,
        budgetHealth,
        comparison,
      });
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to compute monthly analytics'));
    }
  }
}
