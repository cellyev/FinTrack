/**
 * UUID Generator Port Interface (Domain Layer)
 * Isolates UUID generation logic from specific native/runtime libraries.
 */
export type Uuid = string;

export interface IUuidGenerator {
  generate(): Uuid;
  isValid(id: string): boolean;
}
