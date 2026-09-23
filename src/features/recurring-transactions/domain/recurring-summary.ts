import { Money } from '@/core/domain/money';
import { RecurringTransaction } from './recurring-transaction';

export interface RecurringSummary {
  totalActiveCount: number;
  totalPausedCount: number;
  totalMonthlyExpenseCommitment: Money;
  totalMonthlyIncomeCommitment: Money;
  dueCount: number;
}

export function calculateRecurringSummary(
  items: RecurringTransaction[],
  referenceDate: string = new Date().toISOString().slice(0, 10),
  currency: string = 'IDR'
): RecurringSummary {
  let activeCount = 0;
  let pausedCount = 0;
  let dueCount = 0;
  let totalMonthlyExpenseMinor = 0n;
  let totalMonthlyIncomeMinor = 0n;

  for (const item of items) {
    if (item.isDeleted) continue;

    if (item.isActive) {
      activeCount++;
      if (item.isDue(referenceDate)) {
        dueCount++;
      }

      // Calculate approximate monthly commitment for forecasting
      let monthlyMultiplier = 1n;
      let monthlyDivisor = 1n;

      switch (item.frequency) {
        case 'daily':
          monthlyMultiplier = 30n;
          break;
        case 'weekly':
          monthlyMultiplier = 4n;
          break;
        case 'monthly':
          monthlyMultiplier = 1n;
          break;
        case 'yearly':
          monthlyDivisor = 12n;
          break;
      }

      const estimatedMonthlyMinor =
        (item.amount.minorUnits * monthlyMultiplier) / monthlyDivisor;

      if (item.isExpense) {
        totalMonthlyExpenseMinor += estimatedMonthlyMinor;
      } else {
        totalMonthlyIncomeMinor += estimatedMonthlyMinor;
      }
    } else {
      pausedCount++;
    }
  }

  return {
    totalActiveCount: activeCount,
    totalPausedCount: pausedCount,
    totalMonthlyExpenseCommitment: Money.fromMinorUnits(totalMonthlyExpenseMinor, currency),
    totalMonthlyIncomeCommitment: Money.fromMinorUnits(totalMonthlyIncomeMinor, currency),
    dueCount,
  };
}
