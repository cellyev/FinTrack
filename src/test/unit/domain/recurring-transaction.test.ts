import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import {
  calculateNextOccurrence,
  getDaysInMonth,
  RecurringFrequency,
} from '@/features/recurring-transactions/domain/recurring-frequency';
import { calculateRecurringSummary } from '@/features/recurring-transactions/domain/recurring-summary';
import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';

describe('Recurring Frequency & Date Arithmetic Engine', () => {
  it('calculates days in month accurately including leap years', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 2)).toBe(28); // non-leap year
    expect(getDaysInMonth(2028, 2)).toBe(29); // leap year
    expect(getDaysInMonth(2026, 4)).toBe(30);
  });

  it('calculates daily advancement correctly across month boundaries', () => {
    expect(calculateNextOccurrence('2026-01-31', 'daily')).toBe('2026-02-01');
    expect(calculateNextOccurrence('2026-02-28', 'daily')).toBe('2026-03-01');
    expect(calculateNextOccurrence('2028-02-28', 'daily')).toBe('2028-02-29');
    expect(calculateNextOccurrence('2026-12-31', 'daily')).toBe('2027-01-01');
  });

  it('calculates weekly advancement correctly (+7 days)', () => {
    expect(calculateNextOccurrence('2026-01-01', 'weekly')).toBe('2026-01-08');
    expect(calculateNextOccurrence('2026-01-28', 'weekly')).toBe('2026-02-04');
  });

  it('preserves month-end anchor day and clamps to shorter months without drifting', () => {
    // Starting on Jan 31 with anchor day 31
    const anchorDay = 31;
    const anchorMonth = 1;

    const feb = calculateNextOccurrence('2026-01-31', 'monthly', anchorDay, anchorMonth);
    expect(feb).toBe('2026-02-28'); // Clamped to 28 in Feb

    const mar = calculateNextOccurrence(feb, 'monthly', anchorDay, anchorMonth);
    expect(mar).toBe('2026-03-31'); // Restored to 31 in Mar!

    const apr = calculateNextOccurrence(mar, 'monthly', anchorDay, anchorMonth);
    expect(apr).toBe('2026-04-30'); // Clamped to 30 in Apr

    const may = calculateNextOccurrence(apr, 'monthly', anchorDay, anchorMonth);
    expect(may).toBe('2026-05-31'); // Restored to 31 in May!
  });

  it('handles yearly advancement and leap year anchor (Feb 29)', () => {
    const anchorDay = 29;
    const anchorMonth = 2;

    const y2029 = calculateNextOccurrence('2028-02-29', 'yearly', anchorDay, anchorMonth);
    expect(y2029).toBe('2029-02-28'); // Clamped to 28 in non-leap 2029

    const y2030 = calculateNextOccurrence(y2029, 'yearly', anchorDay, anchorMonth);
    expect(y2030).toBe('2030-02-28');

    const y2031 = calculateNextOccurrence(y2030, 'yearly', anchorDay, anchorMonth);
    expect(y2031).toBe('2031-02-28');

    const y2032 = calculateNextOccurrence(y2031, 'yearly', anchorDay, anchorMonth);
    expect(y2032).toBe('2032-02-29'); // Restored to 29 in leap year 2032!
  });
});

describe('RecurringTransaction Aggregate Entity', () => {
  it('creates valid recurring expense transaction schedule', () => {
    const recurring = new RecurringTransaction({
      id: 'rec-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(50000000n, 'IDR'), // Rp 500.000
      accountId: 'acc-bca',
      categoryId: 'cat-bills',
      frequency: 'monthly',
      startDate: '2026-01-31',
      endDate: '2026-12-31',
      nextOccurrence: '2026-01-31',
      note: 'Langganan Internet',
    });

    expect(recurring.id).toBe('rec-1');
    expect(recurring.isExpense).toBe(true);
    expect(recurring.isIncome).toBe(false);
    expect(recurring.amount.minorUnits).toBe(50000000n);
    expect(recurring.frequency).toBe('monthly');
    expect(recurring.startDate).toBe('2026-01-31');
    expect(recurring.nextOccurrence).toBe('2026-01-31');
    expect(recurring.isActive).toBe(true);
    expect(recurring.anchorDay).toBe(31);

    expect(recurring.isDue('2026-01-30')).toBe(false);
    expect(recurring.isDue('2026-01-31')).toBe(true);
    expect(recurring.isDue('2026-02-15')).toBe(true);
  });

  it('advances occurrence and deactivates if next occurrence exceeds endDate', () => {
    const recurring = new RecurringTransaction({
      id: 'rec-2',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromMinorUnits(1000000000n, 'IDR'), // Rp 10.000.000
      accountId: 'acc-mandiri',
      categoryId: 'cat-salary',
      frequency: 'monthly',
      startDate: '2026-05-01',
      endDate: '2026-06-01',
      nextOccurrence: '2026-05-01',
    });

    expect(recurring.isActive).toBe(true);

    // Advance 1: from 2026-05-01 -> 2026-06-01
    recurring.advanceOccurrence();
    expect(recurring.nextOccurrence).toBe('2026-06-01');
    expect(recurring.isActive).toBe(true);

    // Advance 2: from 2026-06-01 -> 2026-07-01 (exceeds endDate 2026-06-01)
    recurring.advanceOccurrence();
    expect(recurring.nextOccurrence).toBe('2026-07-01');
    expect(recurring.isActive).toBe(false); // Inactivated!
  });

  it('validates invalid inputs with ValidationError', () => {
    expect(() => new RecurringTransaction({
      id: '',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(100000n),
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
    })).toThrow(ValidationError);

    expect(() => new RecurringTransaction({
      id: 'rec-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.zero('IDR'),
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
    })).toThrow(ValidationError);

    expect(() => new RecurringTransaction({
      id: 'rec-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(100000n),
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'invalid' as unknown as RecurringFrequency,
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
    })).toThrow(ValidationError);

    expect(() => new RecurringTransaction({
      id: 'rec-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(100000n),
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-06-01',
      endDate: '2026-05-01', // endDate before startDate
      nextOccurrence: '2026-06-01',
    })).toThrow(ValidationError);
  });
});

describe('calculateRecurringSummary', () => {
  it('correctly aggregates active, paused, and due monthly estimates', () => {
    const r1 = new RecurringTransaction({
      id: 'r1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(100000000n), // Rp 1.000.000 / month
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-05-01',
      nextOccurrence: '2026-05-01', // Due relative to 2026-06-01
    });

    const r2 = new RecurringTransaction({
      id: 'r2',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromMinorUnits(500000000n), // Rp 5.000.000 / month
      accountId: 'acc-1',
      categoryId: 'cat-2',
      frequency: 'monthly',
      startDate: '2026-07-01',
      nextOccurrence: '2026-07-01', // Not due relative to 2026-06-01
    });

    const r3 = new RecurringTransaction({
      id: 'r3',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(20000000n),
      accountId: 'acc-1',
      categoryId: 'cat-3',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
      isActive: false, // Paused
    });

    const summary = calculateRecurringSummary([r1, r2, r3], '2026-06-01');

    expect(summary.totalActiveCount).toBe(2);
    expect(summary.totalPausedCount).toBe(1);
    expect(summary.dueCount).toBe(1);
    expect(summary.totalMonthlyExpenseCommitment.minorUnits).toBe(100000000n);
    expect(summary.totalMonthlyIncomeCommitment.minorUnits).toBe(500000000n);
  });
});
