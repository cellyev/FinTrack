import { ValidationError } from '@/core/domain/result';

export type CategoryType = 'income' | 'expense';

export interface CategoryProps {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class Category {
  private readonly _id: string;
  private readonly _userId: string;
  private _name: string;
  private readonly _type: CategoryType;
  private _icon: string | null;
  private _color: string | null;
  private readonly _isSystem: boolean;
  private _isActive: boolean;
  private _sortOrder: number;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | null;

  constructor(props: CategoryProps) {
    Category.validateProps(props);

    this._id = props.id;
    this._userId = props.userId;
    this._name = props.name.trim();
    this._type = props.type;
    this._icon = props.icon ?? null;
    this._color = props.color ?? null;
    this._isSystem = props.isSystem ?? false;
    this._isActive = props.isActive ?? true;
    this._sortOrder = props.sortOrder ?? 0;
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._deletedAt = props.deletedAt ?? null;
  }

  public static validateProps(props: CategoryProps): void {
    if (!props.id || typeof props.id !== 'string') {
      throw new ValidationError('Category ID is required and must be a string');
    }
    if (!props.userId || typeof props.userId !== 'string') {
      throw new ValidationError('Category userId is required');
    }
    const trimmedName = props.name ? props.name.trim() : '';
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      throw new ValidationError('Category name must be between 1 and 60 characters');
    }
    if (props.type !== 'income' && props.type !== 'expense') {
      throw new ValidationError("Category type must be either 'income' or 'expense'");
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

  public get type(): CategoryType {
    return this._type;
  }

  public get icon(): string | null {
    return this._icon;
  }

  public get color(): string | null {
    return this._color;
  }

  public get isSystem(): boolean {
    return this._isSystem;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get sortOrder(): number {
    return this._sortOrder;
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

  public update(props: { name?: string; icon?: string | null; color?: string | null }): void {
    if (this._isSystem) {
      throw new ValidationError('System categories cannot be modified');
    }
    if (props.name !== undefined) {
      const trimmed = props.name ? props.name.trim() : '';
      if (trimmed.length < 1 || trimmed.length > 60) {
        throw new ValidationError('Category name must be between 1 and 60 characters');
      }
      this._name = trimmed;
    }
    if (props.icon !== undefined) {
      this._icon = props.icon;
    }
    if (props.color !== undefined) {
      this._color = props.color;
    }
    this._updatedAt = new Date();
  }

  public rename(newName: string): void {
    this.update({ name: newName });
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
    if (this._isSystem) {
      throw new ValidationError('System categories cannot be deleted');
    }
    this._deletedAt = deletedAt;
    this._updatedAt = deletedAt;
  }
}
