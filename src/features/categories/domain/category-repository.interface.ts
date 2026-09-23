import { Result, DomainError } from '@/core/domain/result';
import { Category, CategoryType } from './category';

export interface ICategoryRepository {
  create(category: Category): Promise<Result<void, DomainError>>;
  findById(id: string, userId: string): Promise<Result<Category | null, DomainError>>;
  listByUser(userId: string, type?: CategoryType, includeInactive?: boolean): Promise<Result<Category[], DomainError>>;
  update(category: Category): Promise<Result<void, DomainError>>;
  softDelete(id: string, userId: string): Promise<Result<void, DomainError>>;
}
