import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';

export type DebtType = 'borrowed' | 'lent'; // 'borrowed' = Hutang, 'lent' = Piutang
export type DebtStatus = 'open' | 'settled';

export interface DebtProps {
  id: string;
  userId: string;
  type: DebtType;
  personName: string;
  originalAmount: Money;
  remainingAmount?: Money;
  dueDate?: string | null; // YYYY-MM-DD
  status?: DebtStatus;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  syncState?: 'synced' | 'pending';
  baseUpdatedAt?: string | null;
  lastError?: string | null;
}

export class Debt {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _type: DebtType;
  private readonly _personName: string;
  private readonly _originalAmount: Money;
  private readonly _remainingAmount: Money;
  private readonly _dueDate: string | null;
  private readonly _status: DebtStatus;
  private readonly _note: string | null;
  private readonly _createdAt: string;
  private readonly _updatedAt: string;
  private readonly _deletedAt: string | null;
  private readonly _syncState: 'synced' | 'pending';
  private readonly _baseUpdatedAt: string | null;
  private readonly _lastError: string | null;

  constructor(props: DebtProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new ValidationError('Debt ID is required.');
    }
    if (!props.userId || props.userId.trim().length === 0) {
      throw new ValidationError('User ID is required.');
    }
    if (props.type !== 'borrowed' && props.type !== 'lent') {
      throw new ValidationError("Debt type must be either 'borrowed' or 'lent'.");
    }
    if (!props.personName || props.personName.trim().length === 0) {
      throw new ValidationError('Counterparty person name is required.');
    }
    if (props.personName.trim().length > 100) {
      throw new ValidationError('Counterparty person name must not exceed 100 characters.');
    }
    if (!props.originalAmount || props.originalAmount.minorUnits <= 0n) {
      throw new ValidationError('Original amount must be greater than zero.');
    }

    const remaining = props.remainingAmount ?? props.originalAmount;
    if (remaining.minorUnits < 0n) {
      throw new ValidationError('Remaining amount cannot be negative.');
    }
    if (remaining.minorUnits > props.originalAmount.minorUnits) {
      throw new ValidationError('Remaining amount cannot exceed original amount.');
    }

    if (props.dueDate && props.dueDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(props.dueDate.trim())) {
        throw new ValidationError('Due date must be in YYYY-MM-DD format.');
      }
    }

    const derivedStatus: DebtStatus = remaining.minorUnits === 0n ? 'settled' : 'open';

    this._id = props.id.trim();
    this._userId = props.userId.trim();
    this._type = props.type;
    this._personName = props.personName.trim();
    this._originalAmount = props.originalAmount;
    this._remainingAmount = remaining;
    this._dueDate = props.dueDate ? props.dueDate.trim() : null;
    this._status = props.status ?? derivedStatus;
    this._note = props.note ? props.note.trim() : null;
    this._createdAt = props.createdAt ?? new Date().toISOString();
    this._updatedAt = props.updatedAt ?? this._createdAt;
    this._deletedAt = props.deletedAt ?? null;
    this._syncState = props.syncState ?? 'synced';
    this._baseUpdatedAt = props.baseUpdatedAt ?? null;
    this._lastError = props.lastError ?? null;
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get type(): DebtType {
    return this._type;
  }

  public get isBorrowed(): boolean {
    return this._type === 'borrowed';
  }

  public get isLent(): boolean {
    return this._type === 'lent';
  }

  public get personName(): string {
    return this._personName;
  }

  public get originalAmount(): Money {
    return this._originalAmount;
  }

  public get remainingAmount(): Money {
    return this._remainingAmount;
  }

  public get repaidAmount(): Money {
    return this._originalAmount.subtract(this._remainingAmount);
  }

  public get dueDate(): string | null {
    return this._dueDate;
  }

  public get status(): DebtStatus {
    return this._status;
  }

  public get isSettled(): boolean {
    return this._status === 'settled' || this._remainingAmount.minorUnits === 0n;
  }

  public get note(): string | null {
    return this._note;
  }

  public get createdAt(): string {
    return this._createdAt;
  }

  public get updatedAt(): string {
    return this._updatedAt;
  }

  public get deletedAt(): string | null {
    return this._deletedAt;
  }

  public isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  public get syncState(): 'synced' | 'pending' {
    return this._syncState;
  }

  public get baseUpdatedAt(): string | null {
    return this._baseUpdatedAt;
  }

  public get lastError(): string | null {
    return this._lastError;
  }

  /**
   * Calculates the percentage of the debt that has been repaid / collected.
   * Uses BigInt rational integer arithmetic to avoid float precision loss.
   */
  public get percentageRepaid(): number {
    const originalMinor = this._originalAmount.minorUnits;
    const remainingMinor = this._remainingAmount.minorUnits;
    if (originalMinor <= 0n) return 0;
    if (remainingMinor <= 0n) return 100.0;

    const repaidMinor = originalMinor - remainingMinor;
    if (repaidMinor <= 0n) return 0.0;

    const tenths = (repaidMinor * 1000n) / originalMinor;
    return Number(tenths) / 10;
  }

  /**
   * Checks if the debt is overdue based on dueDate and current reference date (YYYY-MM-DD).
   */
  public isOverdue(referenceDate?: string): boolean {
    if (!this._dueDate || this.isSettled) return false;
    const ref = referenceDate ?? new Date().toISOString().split('T')[0];
    return this._dueDate < ref;
  }
}
