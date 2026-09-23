import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';
import { TransactionType, isValidTransactionType } from './transaction-type';
import { TransactionItem } from './transaction-item';
import {
  TransactionSplitMismatchError,
  SplitsNotAllowedError,
  CategorySplitMissingError,
  InvalidTransactionAccountError,
  TransferSameAccountError,
} from './transaction-errors';

export interface TransactionProps {
  id: string;
  userId: string;
  type: TransactionType;
  amount: Money;
  transactionDate: string; // YYYY-MM-DD format
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
  items?: TransactionItem[];
  note?: string | null;
  debtId?: string | null;
  recurringTransactionId?: string | null;
  occurrenceKey?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Transaction {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _type: TransactionType;
  private readonly _amount: Money;
  private readonly _transactionDate: string;
  private readonly _sourceAccountId: string | null;
  private readonly _destinationAccountId: string | null;
  private readonly _items: readonly TransactionItem[];
  private readonly _note: string | null;
  private readonly _debtId: string | null;
  private readonly _recurringTransactionId: string | null;
  private readonly _occurrenceKey: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  constructor(props: TransactionProps) {
    Transaction.validateProps(props);

    this._id = props.id;
    this._userId = props.userId;
    this._type = props.type;
    this._amount = props.amount;
    this._transactionDate = props.transactionDate;
    this._sourceAccountId = props.sourceAccountId ?? null;
    this._destinationAccountId = props.destinationAccountId ?? null;
    this._items = Object.freeze([...(props.items ?? [])]);
    this._note = props.note ? props.note.trim() : null;
    this._debtId = props.debtId ?? null;
    this._recurringTransactionId = props.recurringTransactionId ?? null;
    this._occurrenceKey = props.occurrenceKey ?? null;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._deletedAt = props.deletedAt ?? null;
  }

  public static validateProps(props: TransactionProps): void {
    if (!props.id || typeof props.id !== 'string') {
      throw new ValidationError('Transaction ID is required');
    }
    if (!props.userId || typeof props.userId !== 'string') {
      throw new ValidationError('Transaction userId is required');
    }
    if (!props.type || !isValidTransactionType(props.type)) {
      throw new ValidationError(`Invalid transaction type: '${props.type}'`);
    }
    if (!props.amount || !(props.amount instanceof Money)) {
      throw new ValidationError('Transaction amount must be a valid Money instance');
    }
    if (props.amount.minorUnits <= 0n) {
      throw new ValidationError('Transaction amount must be strictly greater than zero');
    }
    if (!props.transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(props.transactionDate)) {
      throw new ValidationError("Transaction date is required in 'YYYY-MM-DD' format");
    }

    const items = props.items ?? [];

    switch (props.type) {
      case 'income': {
        if (!props.destinationAccountId) {
          throw new InvalidTransactionAccountError('Income transaction requires a destination account');
        }
        if (props.sourceAccountId) {
          throw new InvalidTransactionAccountError('Income transaction cannot have a source account');
        }
        if (items.length === 0) {
          throw new CategorySplitMissingError('income');
        }
        Transaction.assertSplitSumEqualsAmount(props.amount, items);
        break;
      }

      case 'expense': {
        if (!props.sourceAccountId) {
          throw new InvalidTransactionAccountError('Expense transaction requires a source account');
        }
        if (props.destinationAccountId) {
          throw new InvalidTransactionAccountError('Expense transaction cannot have a destination account');
        }
        if (items.length === 0) {
          throw new CategorySplitMissingError('expense');
        }
        Transaction.assertSplitSumEqualsAmount(props.amount, items);
        break;
      }

      case 'transfer': {
        if (!props.sourceAccountId) {
          throw new InvalidTransactionAccountError('Transfer transaction requires a source account');
        }
        if (!props.destinationAccountId) {
          throw new InvalidTransactionAccountError('Transfer transaction requires a destination account');
        }
        if (props.sourceAccountId === props.destinationAccountId) {
          throw new TransferSameAccountError();
        }
        if (items.length > 0) {
          throw new SplitsNotAllowedError('transfer');
        }
        break;
      }

      case 'opening_balance': {
        if (!props.destinationAccountId) {
          throw new InvalidTransactionAccountError('Opening balance requires a destination account');
        }
        if (props.sourceAccountId) {
          throw new InvalidTransactionAccountError('Opening balance cannot have a source account');
        }
        if (items.length > 0) {
          throw new SplitsNotAllowedError('opening_balance');
        }
        break;
      }
    }
  }

  private static assertSplitSumEqualsAmount(
    transactionAmount: Money,
    items: TransactionItem[]
  ): void {
    let sum = Money.zero(transactionAmount.currencyCode);
    for (const item of items) {
      sum = sum.add(item.amount);
    }

    if (!sum.equals(transactionAmount)) {
      throw new TransactionSplitMismatchError(
        transactionAmount.formatDisplay(),
        sum.formatDisplay()
      );
    }
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get type(): TransactionType {
    return this._type;
  }

  public get amount(): Money {
    return this._amount;
  }

  public get transactionDate(): string {
    return this._transactionDate;
  }

  public get sourceAccountId(): string | null {
    return this._sourceAccountId;
  }

  public get destinationAccountId(): string | null {
    return this._destinationAccountId;
  }

  public get items(): readonly TransactionItem[] {
    return this._items;
  }

  public get note(): string | null {
    return this._note;
  }

  public get debtId(): string | null {
    return this._debtId;
  }

  public get recurringTransactionId(): string | null {
    return this._recurringTransactionId;
  }

  public get occurrenceKey(): string | null {
    return this._occurrenceKey;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get deletedAt(): Date | null {
    return this._deletedAt;
  }

  public isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public markDeleted(deletedAt: Date = new Date()): void {
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
    for (const item of this._items) {
      item.markDeleted(deletedAt);
    }
  }
}
