import { SavingsGoal } from './savings-goal';
import { Money } from '@/core/domain/money';

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  targetAmount: Money;
  currentAmount: Money;
  remainingAmount: Money;
  percentageCompleted: number; // e.g. 20.0 for 20%
  isCompleted: boolean;
}

/**
 * Pure calculation function for Savings Goal progress.
 *
 * Money Invariant Guarantees:
 * - targetAmount and currentAmount remain integer minor units (BigInt).
 * - percentageCompleted is calculated using BigInt integer arithmetic to tenths precision:
 *   (currentMinor * 1000n) / targetMinor -> tenths of a percent (e.g. 200n for 20.0%, 999n for 99.9%).
 * - Converting only the final bounded integer tenths to number (/ 10) is exact and cannot corrupt money.
 * - percentageCompleted is purely a derived presentation metric, never persisted or used in ledger calculations.
 */
export function calculateSavingsGoalProgress(goal: SavingsGoal): SavingsGoalProgress {
  const targetMinor = goal.targetAmount.minorUnits;
  const currentMinor = goal.currentAmount.minorUnits;

  // remaining = target - current (clamped at 0)
  const remainingMinor = targetMinor > currentMinor ? targetMinor - currentMinor : 0n;
  const remainingAmount = Money.fromMinorUnits(remainingMinor, goal.targetAmount.currencyCode);

  let percentageCompleted = 0;
  if (targetMinor > 0n) {
    if (currentMinor >= targetMinor) {
      percentageCompleted = 100.0;
    } else if (currentMinor > 0n) {
      const tenths = (currentMinor * 1000n) / targetMinor;
      percentageCompleted = Number(tenths) / 10;
    }
  }

  const isCompleted = currentMinor >= targetMinor;

  return {
    goal,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remainingAmount,
    percentageCompleted,
    isCompleted,
  };
}
