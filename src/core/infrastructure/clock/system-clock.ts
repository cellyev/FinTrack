import { IClock } from '@/core/domain/clock.interface';

export class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }

  public todayDateString(): string {
    const now = this.now();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const systemClock: IClock = new SystemClock();
