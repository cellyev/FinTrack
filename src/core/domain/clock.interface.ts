/**
 * Clock Port Interface (Domain Layer)
 * Allows deterministic time manipulation for testing policies (like 7-day correction window).
 */
export interface IClock {
  now(): Date;
  todayDateString(): string; // YYYY-MM-DD
}
