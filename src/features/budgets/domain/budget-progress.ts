import { Budget } from './budget';
import { Money } from '@/core/domain/money';

export interface BudgetProgress {
  budget: Budget;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgetAmount: Money;
  actualSpending: Money;
  remainingAmount: Money;
  percentageUsed: number; // e.g. 75.5 for 75.5%
  isOverBudget: boolean;
}

/**
 * Pure calculation function for Budget progress.
 *
 * Money Invariant Guarantees:
 * - budgetAmount and actualSpending remain integer minor units (BigInt).
 * - remainingAmount is computed using BigInt subtraction (clamped at 0n for display).
 * - percentageUsed is calculated using BigInt integer arithmetic to tenths precision:
 *   (spentMinor * 1000n) / budgetMinor -> tenths of a percent (e.g. 300n for 30.0%, 1500n for 150.0%).
 * - Converting only the final bounded integer tenths to number (/ 10) is exact and cannot corrupt money.
 * - percentageUsed is purely a derived presentation metric, never persisted or used in ledger calculations.
 */
export function calculateBudgetProgress(params: {
  budget: Budget;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  actualSpending: Money;
}): BudgetProgress {
  const { budget, categoryName, categoryIcon = null, categoryColor = null, actualSpending } = params;

  const budgetMinor = budget.amount.minorUnits;
  const spentMinor = actualSpending.minorUnits;

  // remaining = budget - actualSpending (clamped at 0n)
  const remainingMinor = budgetMinor > spentMinor ? budgetMinor - spentMinor : 0n;
  const remainingAmount = Money.fromMinorUnits(remainingMinor, budget.amount.currencyCode);

  let percentageUsed = 0;
  if (budgetMinor > 0n) {
    if (spentMinor > 0n) {
      const tenths = (spentMinor * 1000n) / budgetMinor;
      percentageUsed = Number(tenths) / 10;
    }
  }

  const isOverBudget = spentMinor > budgetMinor;

  return {
    budget,
    categoryName,
    categoryIcon,
    categoryColor,
    budgetAmount: budget.amount,
    actualSpending,
    remainingAmount,
    percentageUsed,
    isOverBudget,
  };
}
