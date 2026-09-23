export type BudgetPeriodType = 'monthly' | 'custom';

export class BudgetPeriod {
  public readonly startDate: string; // YYYY-MM-DD
  public readonly endDate: string; // YYYY-MM-DD
  public readonly periodType: BudgetPeriodType;

  constructor(startDate: string, endDate: string, periodType: BudgetPeriodType = 'custom') {
    if (!BudgetPeriod.isValidDateFormat(startDate)) {
      throw new Error(`Invalid start date format: ${startDate}. Expected YYYY-MM-DD.`);
    }
    if (!BudgetPeriod.isValidDateFormat(endDate)) {
      throw new Error(`Invalid end date format: ${endDate}. Expected YYYY-MM-DD.`);
    }
    if (startDate > endDate) {
      throw new Error(`Start date (${startDate}) cannot be after end date (${endDate}).`);
    }

    this.startDate = startDate;
    this.endDate = endDate;
    this.periodType = periodType;
  }

  public static isValidDateFormat(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  public static currentMonth(referenceDate: Date = new Date()): BudgetPeriod {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month

    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return new BudgetPeriod(format(start), format(end), 'monthly');
  }

  public isDateWithin(dateStr: string): boolean {
    return dateStr >= this.startDate && dateStr <= this.endDate;
  }
}
