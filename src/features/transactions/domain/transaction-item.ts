import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';

export interface TransactionItemProps {
  id: string;
  transactionId: string;
  categoryId: string;
  amount: Money;
  note?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class TransactionItem {
  private readonly _id: string;
  private readonly _transactionId: string;
  private readonly _categoryId: string;
  private readonly _amount: Money;
  private readonly _note: string | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private _deletedAt: Date | null;

  constructor(props: TransactionItemProps) {
    TransactionItem.validateProps(props);

    this._id = props.id;
    this._transactionId = props.transactionId;
    this._categoryId = props.categoryId;
    this._amount = props.amount;
    this._note = props.note ? props.note.trim() : null;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._deletedAt = props.deletedAt ?? null;
  }

  public static validateProps(props: TransactionItemProps): void {
    if (!props.id || typeof props.id !== 'string') {
      throw new ValidationError('TransactionItem ID is required and must be a string');
    }
    if (!props.transactionId || typeof props.transactionId !== 'string') {
      throw new ValidationError('TransactionItem transactionId is required');
    }
    if (!props.categoryId || typeof props.categoryId !== 'string') {
      throw new ValidationError('TransactionItem categoryId is required');
    }
    if (!props.amount || !(props.amount instanceof Money)) {
      throw new ValidationError('TransactionItem amount must be a valid Money instance');
    }
    if (props.amount.minorUnits <= 0n) {
      throw new ValidationError('TransactionItem split amount must be strictly greater than zero');
    }
  }

  public get id(): string {
    return this._id;
  }

  public get transactionId(): string {
    return this._transactionId;
  }

  public get categoryId(): string {
    return this._categoryId;
  }

  public get amount(): Money {
    return this._amount;
  }

  public get note(): string | null {
    return this._note;
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
  }
}
