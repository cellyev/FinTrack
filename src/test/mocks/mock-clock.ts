import { IClock } from '@/core/domain/clock.interface';

export class MockClock implements IClock {
  private currentTime: Date;

  constructor(initialDate: Date = new Date('2026-08-19T12:00:00Z')) {
    this.currentTime = initialDate;
  }

  public setTime(newTime: Date): void {
    this.currentTime = newTime;
  }

  public advanceDays(days: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + days * 24 * 60 * 60 * 1000);
  }

  public now(): Date {
    return new Date(this.currentTime.getTime());
  }

  public todayDateString(): string {
    const now = this.now();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
