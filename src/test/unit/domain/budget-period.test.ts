import { BudgetPeriod } from '@/features/budgets/domain/budget-period';

describe('BudgetPeriod Value Object', () => {
  it('should create valid BudgetPeriod with custom and monthly types', () => {
    const customPeriod = new BudgetPeriod('2026-08-10', '2026-08-25', 'custom');
    expect(customPeriod.startDate).toBe('2026-08-10');
    expect(customPeriod.endDate).toBe('2026-08-25');
    expect(customPeriod.periodType).toBe('custom');

    const monthlyPeriod = new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly');
    expect(monthlyPeriod.periodType).toBe('monthly');
  });

  it('should generate currentMonth correctly for a reference date', () => {
    const refDate = new Date(2026, 1, 15); // February 2026 (non-leap: 28 days)
    const period = BudgetPeriod.currentMonth(refDate);

    expect(period.startDate).toBe('2026-02-01');
    expect(period.endDate).toBe('2026-02-28');
    expect(period.periodType).toBe('monthly');
  });

  it('should throw error for invalid start date format', () => {
    expect(() => new BudgetPeriod('2026/08/01', '2026-08-31')).toThrow(
      'Invalid start date format'
    );
    expect(() => new BudgetPeriod('invalid', '2026-08-31')).toThrow(
      'Invalid start date format'
    );
  });

  it('should throw error for invalid end date format', () => {
    expect(() => new BudgetPeriod('2026-08-01', '31-08-2026')).toThrow(
      'Invalid end date format'
    );
  });

  it('should throw error when startDate > endDate', () => {
    expect(() => new BudgetPeriod('2026-08-31', '2026-08-01')).toThrow(
      'Start date (2026-08-31) cannot be after end date (2026-08-01).'
    );
  });

  it('should check if date is within period correctly', () => {
    const period = new BudgetPeriod('2026-08-01', '2026-08-31');

    expect(period.isDateWithin('2026-08-01')).toBe(true);
    expect(period.isDateWithin('2026-08-15')).toBe(true);
    expect(period.isDateWithin('2026-08-31')).toBe(true);
    expect(period.isDateWithin('2026-07-31')).toBe(false);
    expect(period.isDateWithin('2026-09-01')).toBe(false);
  });
});
