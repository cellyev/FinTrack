import { Money } from '@/core/domain/money';
import { Debt } from './debt';

export interface DebtSummary {
  totalBorrowedOriginal: Money;
  totalBorrowedRemaining: Money; // Total Hutang
  totalBorrowedRepaid: Money;
  totalLentOriginal: Money;
  totalLentRemaining: Money; // Total Piutang
  totalLentRepaid: Money;
  overdueCount: number;
  openCount: number;
  settledCount: number;
}

export function calculateDebtSummary(debts: Debt[], referenceDate?: string): DebtSummary {
  let borrowedOrigMinor = 0n;
  let borrowedRemMinor = 0n;
  let lentOrigMinor = 0n;
  let lentRemMinor = 0n;
  let overdue = 0;
  let open = 0;
  let settled = 0;

  for (const debt of debts) {
    if (debt.isDeleted()) continue;

    if (debt.isSettled) {
      settled++;
    } else {
      open++;
      if (debt.isOverdue(referenceDate)) {
        overdue++;
      }
    }

    if (debt.isBorrowed) {
      borrowedOrigMinor += debt.originalAmount.minorUnits;
      borrowedRemMinor += debt.remainingAmount.minorUnits;
    } else {
      lentOrigMinor += debt.originalAmount.minorUnits;
      lentRemMinor += debt.remainingAmount.minorUnits;
    }
  }

  const borrowedRepMinor = borrowedOrigMinor >= borrowedRemMinor ? borrowedOrigMinor - borrowedRemMinor : 0n;
  const lentRepMinor = lentOrigMinor >= lentRemMinor ? lentOrigMinor - lentRemMinor : 0n;

  return {
    totalBorrowedOriginal: Money.fromMinorUnits(borrowedOrigMinor, 'IDR'),
    totalBorrowedRemaining: Money.fromMinorUnits(borrowedRemMinor, 'IDR'),
    totalBorrowedRepaid: Money.fromMinorUnits(borrowedRepMinor, 'IDR'),
    totalLentOriginal: Money.fromMinorUnits(lentOrigMinor, 'IDR'),
    totalLentRemaining: Money.fromMinorUnits(lentRemMinor, 'IDR'),
    totalLentRepaid: Money.fromMinorUnits(lentRepMinor, 'IDR'),
    overdueCount: overdue,
    openCount: open,
    settledCount: settled,
  };
}
