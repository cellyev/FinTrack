import { Money } from '@/core/domain/money';
import { BudgetPeriod } from './budget-period';

export interface BudgetProps {
  id: string;
  userId: string;
  categoryId: string;
  name?: string | null;
  amount: Money;
  period: BudgetPeriod;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncState?: 'synced' | 'pending';
  baseUpdatedAt?: string | null;
}

export class Budget {
  public readonly id: string;
  public readonly userId: string;
  public readonly categoryId: string;
  public readonly name: string | null;
  public readonly amount: Money;
  public readonly period: BudgetPeriod;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly deletedAt: string | null;
  public readonly syncState: 'synced' | 'pending';
  public readonly baseUpdatedAt: string | null;

  constructor(props: BudgetProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Budget ID is required.');
    }
    if (!props.userId || props.userId.trim().length === 0) {
      throw new Error('User ID is required.');
    }
    if (!props.categoryId || props.categoryId.trim().length === 0) {
      throw new Error('Category ID is required.');
    }
    if (props.amount.minorUnits <= 0n) {
      throw new Error('Budget amount must be greater than zero.');
    }

    this.id = props.id;
    this.userId = props.userId;
    this.categoryId = props.categoryId;
    this.name = props.name ? props.name.trim() : null;
    this.amount = props.amount;
    this.period = props.period;
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
