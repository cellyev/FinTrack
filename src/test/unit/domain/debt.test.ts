import { Debt } from '@/features/debts/domain/debt';
import { calculateDebtSummary } from '@/features/debts/domain/debt-summary';
import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';

describe('Debt Aggregate Entity', () => {
  it('creates valid borrowed debt (Hutang)', () => {
    const debt = new Debt({
      id: 'debt-1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Budi Santoso',
      originalAmount: Money.fromMinorUnits(100000000n, 'IDR'), // Rp 1.000.000
      dueDate: '2026-12-31',
      note: 'Pinjaman modal usaha',
    });

    expect(debt.id).toBe('debt-1');
    expect(debt.userId).toBe('user-1');
    expect(debt.isBorrowed).toBe(true);
    expect(debt.isLent).toBe(false);
    expect(debt.personName).toBe('Budi Santoso');
    expect(debt.originalAmount.minorUnits).toBe(100000000n);
    expect(debt.remainingAmount.minorUnits).toBe(100000000n);
    expect(debt.repaidAmount.minorUnits).toBe(0n);
    expect(debt.percentageRepaid).toBe(0);
    expect(debt.status).toBe('open');
    expect(debt.isSettled).toBe(false);
    expect(debt.dueDate).toBe('2026-12-31');
    expect(debt.isOverdue('2026-06-01')).toBe(false);
    expect(debt.isOverdue('2027-01-01')).toBe(true);
  });

  it('creates valid lent debt (Piutang)', () => {
    const debt = new Debt({
      id: 'debt-2',
      userId: 'user-1',
      type: 'lent',
      personName: 'Andi Pratama',
      originalAmount: Money.fromMinorUnits(50000000n, 'IDR'), // Rp 500.000
      remainingAmount: Money.fromMinorUnits(25000000n, 'IDR'), // Rp 250.000 (50% repaid)
      dueDate: '2026-10-15',
    });

    expect(debt.isLent).toBe(true);
    expect(debt.isBorrowed).toBe(false);
    expect(debt.repaidAmount.minorUnits).toBe(25000000n);
    expect(debt.percentageRepaid).toBe(50.0);
    expect(debt.isSettled).toBe(false);
  });

  it('derives settled status when remaining amount is zero', () => {
    const debt = new Debt({
      id: 'debt-3',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Bank ABC',
      originalAmount: Money.fromMinorUnits(100000000n, 'IDR'),
      remainingAmount: Money.zero('IDR'),
    });

    expect(debt.isSettled).toBe(true);
    expect(debt.status).toBe('settled');
    expect(debt.percentageRepaid).toBe(100.0);
  });

  it('calculates rational BigInt percentage precision correctly', () => {
    // Rp 1.000.000 original, Rp 666.667 remaining => 333.333 repaid (33.3%)
    const debt = new Debt({
      id: 'debt-4',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Vendor X',
      originalAmount: Money.fromMinorUnits(100000000n, 'IDR'),
      remainingAmount: Money.fromMinorUnits(66666700n, 'IDR'),
    });

    expect(debt.percentageRepaid).toBe(33.3);
  });

  it('rejects invalid inputs with ValidationError', () => {
    expect(() => new Debt({
      id: '',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Test',
      originalAmount: Money.fromMinorUnits(100000n),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: '',
      type: 'borrowed',
      personName: 'Test',
      originalAmount: Money.fromMinorUnits(100000n),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'invalid' as unknown as 'borrowed',
      personName: 'Test',
      originalAmount: Money.fromMinorUnits(100000n),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: '',
      originalAmount: Money.fromMinorUnits(100000n),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'A'.repeat(101),
      originalAmount: Money.fromMinorUnits(100000n),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Test',
      originalAmount: Money.zero('IDR'),
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Test',
      originalAmount: Money.fromMinorUnits(100000n),
      remainingAmount: Money.fromMinorUnits(200000n), // remaining > original
    })).toThrow(ValidationError);

    expect(() => new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Test',
      originalAmount: Money.fromMinorUnits(100000n),
      dueDate: '31-12-2026', // invalid date format
    })).toThrow(ValidationError);
  });
});

describe('calculateDebtSummary', () => {
  it('correctly aggregates Hutang and Piutang totals and overdue counts', () => {
    const d1 = new Debt({
      id: 'd1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Hutang 1',
      originalAmount: Money.fromMinorUnits(100000000n), // Rp 1.000.000
      remainingAmount: Money.fromMinorUnits(40000000n), // Rp 400.000
      dueDate: '2026-05-01', // Overdue relative to 2026-06-01
    });

    const d2 = new Debt({
      id: 'd2',
      userId: 'user-1',
      type: 'lent',
      personName: 'Piutang 1',
      originalAmount: Money.fromMinorUnits(50000000n), // Rp 500.000
      remainingAmount: Money.fromMinorUnits(50000000n), // Rp 500.000
      dueDate: '2026-08-01', // Not overdue relative to 2026-06-01
    });

    const d3 = new Debt({
      id: 'd3',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Hutang Lunas',
      originalAmount: Money.fromMinorUnits(20000000n),
      remainingAmount: Money.zero('IDR'),
    });

    const summary = calculateDebtSummary([d1, d2, d3], '2026-06-01');

    expect(summary.totalBorrowedOriginal.minorUnits).toBe(120000000n);
    expect(summary.totalBorrowedRemaining.minorUnits).toBe(40000000n);
    expect(summary.totalBorrowedRepaid.minorUnits).toBe(80000000n);

    expect(summary.totalLentOriginal.minorUnits).toBe(50000000n);
    expect(summary.totalLentRemaining.minorUnits).toBe(50000000n);
    expect(summary.totalLentRepaid.minorUnits).toBe(0n);

    expect(summary.openCount).toBe(2);
    expect(summary.settledCount).toBe(1);
    expect(summary.overdueCount).toBe(1);
  });
});
