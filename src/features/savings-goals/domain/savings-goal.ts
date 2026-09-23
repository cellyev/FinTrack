import { Money } from '@/core/domain/money';

export interface SavingsGoalProps {
  id: string;
  userId: string;
  name: string;
  targetAmount: Money;
  currentAmount?: Money;
  targetDate?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncState?: 'synced' | 'pending';
  baseUpdatedAt?: string | null;
}

export class SavingsGoal {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly targetAmount: Money;
  public readonly currentAmount: Money;
  public readonly targetDate: string | null;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly deletedAt: string | null;
  public readonly syncState: 'synced' | 'pending';
  public readonly baseUpdatedAt: string | null;

  constructor(props: SavingsGoalProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Savings Goal ID is required.');
    }
    if (!props.userId || props.userId.trim().length === 0) {
      throw new Error('User ID is required.');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Savings Goal name must not be empty.');
    }
    if (props.targetAmount.minorUnits <= 0n) {
      throw new Error('Target amount must be greater than zero.');
    }

    const current = props.currentAmount ?? Money.zero(props.targetAmount.currencyCode);
    if (current.minorUnits < 0n) {
      throw new Error('Current amount must be greater than or equal to zero.');
    }
    if (current.minorUnits > props.targetAmount.minorUnits) {
      throw new Error('Current amount cannot exceed target amount.');
    }

    if (props.targetDate && props.targetDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(props.targetDate.trim())) {
        throw new Error('Target date must be in YYYY-MM-DD format.');
      }
    }

    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name.trim();
    this.targetAmount = props.targetAmount;
    this.currentAmount = current;
    this.targetDate = props.targetDate ? props.targetDate.trim() : null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
    this.syncState = props.syncState ?? 'synced';
    this.baseUpdatedAt = props.baseUpdatedAt ?? null;
  }

  public get isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
