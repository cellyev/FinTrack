/**
 * Base Repository Interface (Domain Layer)
 */
export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
}
