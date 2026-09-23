import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';
import {
  RecurringFrequency,
  isValidRecurringFrequency,
  parseDateParts,
  calculateNextOccurrence,
} from './recurring-frequency';

export type RecurringType = 'income' | 'expense';

export function isValidRecurringType(val: unknown): val is RecurringType {
  return val === 'income' || val === 'expense';
}

export interface RecurringTransactionProps {
  id: string;
  userId: string;
  type: RecurringType;
  amount: Money;
  accountId: string;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  nextOccurrence: string; // YYYY-MM-DD
  isActive?: boolean;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  syncState?: 'synced' | 'pending';
  baseUpdatedAt?: string | null;
  lastError?: string | null;
}

export class RecurringTransaction {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _type: RecurringType;
  private readonly _amount: Money;
  private readonly _accountId: string;
  private readonly _categoryId: string;
  private readonly _frequency: RecurringFrequency;
  private readonly _startDate: string;
  private readonly _endDate: string | null;
  private _nextOccurrence: string;
  private _isActive: boolean;
  private readonly _note: string | null;
  private readonly _createdAt: string;
  private _updatedAt: string;
  private _deletedAt: string | null;
  private _syncState: 'synced' | 'pending';
  private readonly _baseUpdatedAt: string | null;
  private readonly _lastError: string | null;

  constructor(props: RecurringTransactionProps) {
    RecurringTransaction.validateProps(props);

    this._id = props.id;
    this._userId = props.userId;
    this._type = props.type;
    this._amount = props.amount;
    this._accountId = props.accountId;
    this._categoryId = props.categoryId;
    this._frequency = props.frequency;
    this._startDate = props.startDate;
    this._endDate = props.endDate ?? null;
    this._nextOccurrence = props.nextOccurrence;
    this._isActive = props.isActive ?? true;
    this._note = props.note ? props.note.trim() : null;
    this._createdAt = props.createdAt ?? new Date().toISOString();
    this._updatedAt = props.updatedAt ?? this._createdAt;
    this._deletedAt = props.deletedAt ?? null;
    this._syncState = props.syncState ?? 'synced';
    this._baseUpdatedAt = props.baseUpdatedAt ?? null;
    this._lastError = props.lastError ?? null;
  }

  public static validateProps(props: RecurringTransactionProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new ValidationError('Recurring transaction id cannot be empty');
    }
    if (!props.userId || props.userId.trim().length === 0) {
      throw new ValidationError('Recurring transaction userId cannot be empty');
    }
    if (!isValidRecurringType(props.type)) {
      throw new ValidationError(`Invalid recurring type: ${props.type}`);
    }
    if (!props.amount || props.amount.minorUnits <= 0n) {
      throw new ValidationError('Recurring transaction amount must be greater than zero');
    }
    if (!props.accountId || props.accountId.trim().length === 0) {
      throw new ValidationError('Recurring transaction accountId cannot be empty');
    }
    if (!props.categoryId || props.categoryId.trim().length === 0) {
      throw new ValidationError('Recurring transaction categoryId cannot be empty');
    }
    if (!isValidRecurringFrequency(props.frequency)) {
      throw new ValidationError(`Invalid recurring frequency: ${props.frequency}`);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!props.startDate || !dateRegex.test(props.startDate)) {
      throw new ValidationError(`Invalid startDate format (expected YYYY-MM-DD): ${props.startDate}`);
    }
    if (props.endDate && !dateRegex.test(props.endDate)) {
      throw new ValidationError(`Invalid endDate format (expected YYYY-MM-DD): ${props.endDate}`);
    }
    if (props.endDate && props.endDate < props.startDate) {
      throw new ValidationError('endDate cannot be before startDate');
    }
    if (!props.nextOccurrence || !dateRegex.test(props.nextOccurrence)) {
      throw new ValidationError(`Invalid nextOccurrence format (expected YYYY-MM-DD): ${props.nextOccurrence}`);
    }
  }

  // Getters
  public get id(): string { return this._id; }
  public get userId(): string { return this._userId; }
  public get type(): RecurringType { return this._type; }
  public get isIncome(): boolean { return this._type === 'income'; }
  public get isExpense(): boolean { return this._type === 'expense'; }
  public get amount(): Money { return this._amount; }
  public get accountId(): string { return this._accountId; }
  public get categoryId(): string { return this._categoryId; }
  public get frequency(): RecurringFrequency { return this._frequency; }
  public get startDate(): string { return this._startDate; }
  public get endDate(): string | null { return this._endDate; }
  public get nextOccurrence(): string { return this._nextOccurrence; }
  public get isActive(): boolean { return this._isActive; }
  public get note(): string | null { return this._note; }
  public get createdAt(): string { return this._createdAt; }
  public get updatedAt(): string { return this._updatedAt; }
  public get deletedAt(): string | null { return this._deletedAt; }
  public get isDeleted(): boolean { return this._deletedAt !== null; }
  public get syncState(): 'synced' | 'pending' { return this._syncState; }
  public get baseUpdatedAt(): string | null { return this._baseUpdatedAt; }
  public get lastError(): string | null { return this._lastError; }

  public get anchorDay(): number {
    return parseDateParts(this._startDate).day;
  }

  public get anchorMonth(): number {
    return parseDateParts(this._startDate).month;
  }

  /**
   * Checks if this schedule is due for processing on or before referenceDate (YYYY-MM-DD).
   */
  public isDue(referenceDate: string): boolean {
    if (!this._isActive || this.isDeleted) return false;
    return this._nextOccurrence <= referenceDate;
  }

  /**
   * Computes the subsequent next occurrence date from current nextOccurrence.
   */
  public computeNextOccurrenceDate(): string {
    return calculateNextOccurrence(
      this._nextOccurrence,
      this._frequency,
      this.anchorDay,
      this.anchorMonth
    );
  }

  /**
   * Advances nextOccurrence to the subsequent date.
   * If new nextOccurrence exceeds endDate, isActive is marked false.
   */
  public advanceOccurrence(): void {
    const nextDate = this.computeNextOccurrenceDate();
    this._nextOccurrence = nextDate;
    if (this._endDate && nextDate > this._endDate) {
      this._isActive = false;
    }
    this._updatedAt = new Date().toISOString();
    this._syncState = 'pending';
  }

  /**
   * Toggles or sets active state.
   */
  public setActive(active: boolean): void {
    this._isActive = active;
    this._updatedAt = new Date().toISOString();
    this._syncState = 'pending';
  }
}
