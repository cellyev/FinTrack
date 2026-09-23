/**
 * Functional Result Pattern & Standard Domain Errors
 * Avoids throwing uncaught runtime exceptions across architectural boundaries.
 */

export type Result<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  public readonly code = 'VALIDATION_ERROR';
}

export class ConflictError extends DomainError {
  public readonly code = 'CONFLICT_ERROR';
}

export class UnauthorizedError extends DomainError {
  public readonly code = 'UNAUTHORIZED_ERROR';
}

export class NotFoundError extends DomainError {
  public readonly code = 'NOT_FOUND_ERROR';
}

export class SyncError extends DomainError {
  public readonly code = 'SYNC_ERROR';
}

export class DatabaseError extends DomainError {
  public readonly code = 'DATABASE_ERROR';
}
