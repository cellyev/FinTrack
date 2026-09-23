import { DomainError } from '@/core/domain/result';

export class TransactionSplitMismatchError extends DomainError {
  public readonly code = 'TRANSACTION_SPLIT_MISMATCH';

  constructor(expectedAmount: string, actualSplitsSum: string) {
    super(
      `Transaction split total (${actualSplitsSum}) must exactly equal transaction amount (${expectedAmount})`
    );
  }
}

export class SplitsNotAllowedError extends DomainError {
  public readonly code = 'SPLITS_NOT_ALLOWED';

  constructor(transactionType: string) {
    super(`Category splits are forbidden for transaction type '${transactionType}'`);
  }
}

export class CategorySplitMissingError extends DomainError {
  public readonly code = 'CATEGORY_SPLIT_MISSING';

  constructor(transactionType: string) {
    super(`At least one category split is required for transaction type '${transactionType}'`);
  }
}

export class InvalidTransactionAccountError extends DomainError {
  public readonly code = 'INVALID_TRANSACTION_ACCOUNTS';
}

export class TransferSameAccountError extends DomainError {
  public readonly code = 'TRANSFER_SAME_ACCOUNT';

  constructor() {
    super('Source and destination accounts must be different for a transfer transaction');
  }
}

export class CorrectionWindowExpiredError extends DomainError {
  public readonly code = 'CORRECTION_WINDOW_EXPIRED';

  constructor(transactionDate: string, daysAllowed: number = 7) {
    super(
      `Transaction with date ${transactionDate} is outside the allowed ${daysAllowed}-day correction window`
    );
  }
}
