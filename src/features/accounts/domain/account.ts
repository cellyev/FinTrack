import { ValidationError } from '@/core/domain/result';

export type AccountType = 'cash' | 'bank' | 'ewallet';

export interface AccountProps {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currencyCode?: string;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Account {
  private readonly _id: string;
  private readonly _userId: string;
  private _name: string;
  private _type: AccountType;
  private readonly _currencyCode: string;
  private _icon: string | null;
  private _color: string | null;
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  constructor(props: AccountProps) {
    Account.validateProps(props);

    this._id = props.id;
    this._userId = props.userId;
    this._name = props.name.trim();
    this._type = props.type;
    this._currencyCode = (props.currencyCode ?? 'IDR').toUpperCase();
    this._icon = props.icon ?? null;
    this._color = props.color ?? null;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._deletedAt = props.deletedAt ?? null;
  }

  public static validateProps(props: AccountProps): void {
    if (!props.id || typeof props.id !== 'string') {
      throw new ValidationError('Account ID is required and must be a valid string');
    }
    if (!props.userId || typeof props.userId !== 'string') {
      throw new ValidationError('Account userId is required');
    }
    const trimmedName = props.name ? props.name.trim() : '';
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      throw new ValidationError('Account name must be between 1 and 80 characters');
    }
    const validTypes: AccountType[] = ['cash', 'bank', 'ewallet'];
    if (!validTypes.includes(props.type)) {
      throw new ValidationError(`Account type must be one of: ${validTypes.join(', ')}`);
    }
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get name(): string {
    return this._name;
  }

  public get type(): AccountType {
    return this._type;
  }

  public get currencyCode(): string {
    return this._currencyCode;
  }

  public get icon(): string | null {
    return this._icon;
  }

  public get color(): string | null {
    return this._color;
  }

  public get isActive(): boolean {
    return this._isActive;
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

  public rename(newName: string): void {
    const trimmed = newName ? newName.trim() : '';
    if (trimmed.length < 1 || trimmed.length > 80) {
      throw new ValidationError('Account name must be between 1 and 80 characters');
    }
    this._name = trimmed;
    this._updatedAt = new Date();
  }

  public deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  public activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  public markDeleted(deletedAt: Date = new Date()): void {
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
  }
}
