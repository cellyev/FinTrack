import { Transaction } from '../transaction';
import { IClock } from '@/core/domain/clock.interface';

/**
 * Open Decision: Seven-day window anchor
 * Options: 'transaction_date' (recommended) vs 'created_at'.
 * Unresolved in docs/11-open-decisions.md.
 */
export type CorrectionWindowAnchor = 'transaction_date' | 'created_at';

export interface ITransactionCorrectionPolicy {
  isEligibleForCorrection(transaction: Transaction, referenceTime?: Date): boolean;
  daysRemaining(transaction: Transaction, referenceTime?: Date): number;
}

export class SevenDayCorrectionPolicy implements ITransactionCorrectionPolicy {
  public static readonly ALLOWED_WINDOW_DAYS = 7;

  constructor(
    private readonly clock: IClock,
    private readonly anchor: CorrectionWindowAnchor = 'transaction_date'
  ) {}

  public isEligibleForCorrection(transaction: Transaction, referenceTime?: Date): boolean {
    if (transaction.isDeleted()) {
      return false;
    }

    const now = referenceTime ?? this.clock.now();
    const anchorDate = this.getAnchorDate(transaction);

    // Difference in milliseconds
    const diffMs = now.getTime() - anchorDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Eligible if within 7 calendar days (and not implausibly future if anchor is transaction_date)
    return diffDays >= 0 && diffDays <= SevenDayCorrectionPolicy.ALLOWED_WINDOW_DAYS;
  }

  public daysRemaining(transaction: Transaction, referenceTime?: Date): number {
    if (transaction.isDeleted()) {
      return 0;
    }

    const now = referenceTime ?? this.clock.now();
    const anchorDate = this.getAnchorDate(transaction);

    const diffMs = now.getTime() - anchorDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const remaining = SevenDayCorrectionPolicy.ALLOWED_WINDOW_DAYS - diffDays;

    return Math.max(0, Math.ceil(remaining));
  }

  private getAnchorDate(transaction: Transaction): Date {
    if (this.anchor === 'created_at') {
      return transaction.createdAt;
    }
    // Anchor: transaction_date (YYYY-MM-DD start of day UTC/local)
    return new Date(`${transaction.transactionDate}T00:00:00.000Z`);
  }
}
