import { calculateBudgetProgress } from '@/features/budgets/domain/budget-progress';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Money } from '@/core/domain/money';

describe('BudgetProgress Domain Calculation', () => {
  const period = new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly');
  const budget = new Budget({
    id: 'bg-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    amount: Money.fromMinorUnits(100000000n, 'IDR'), // Rp 1.000.000
    period,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  });

  it('should calculate zero spending correctly', () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(0n, 'IDR'),
    });

    expect(progress.actualSpending.minorUnits).toBe(0n);
    expect(progress.remainingAmount.minorUnits).toBe(100000000n);
    expect(progress.percentageUsed).toBe(0);
    expect(progress.isOverBudget).toBe(false);
  });

  it('should calculate partial spending correctly (25%)', () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(25000000n, 'IDR'), // Rp 250.000
    });

    expect(progress.actualSpending.minorUnits).toBe(25000000n);
    expect(progress.remainingAmount.minorUnits).toBe(75000000n);
    expect(progress.percentageUsed).toBe(25);
    expect(progress.isOverBudget).toBe(false);
  });

  it('should calculate exactly 100% spending', () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(100000000n, 'IDR'), // Rp 1.000.000
    });

    expect(progress.actualSpending.minorUnits).toBe(100000000n);
    expect(progress.remainingAmount.minorUnits).toBe(0n);
    expect(progress.percentageUsed).toBe(100);
    expect(progress.isOverBudget).toBe(false);
  });

  it('should calculate over budget spending (125%)', () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(125000000n, 'IDR'), // Rp 1.250.000
    });

    expect(progress.actualSpending.minorUnits).toBe(125000000n);
    expect(progress.remainingAmount.minorUnits).toBe(0n);
    expect(progress.percentageUsed).toBe(125);
    expect(progress.isOverBudget).toBe(true);
  });

  it('should calculate exact tenths percentage correctly without floating point rounding error (33.3%)', () => {
    // 100 / 300 = 33.3%
    const customBudget = new Budget({
      id: 'bg-tenths',
      userId: 'user-1',
      categoryId: 'cat-1',
      amount: Money.fromMinorUnits(300000000n, 'IDR'),
      period,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    const progress = calculateBudgetProgress({
      budget: customBudget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(100000000n, 'IDR'),
    });

    expect(progress.actualSpending.minorUnits).toBe(100000000n);
    expect(progress.remainingAmount.minorUnits).toBe(200000000n);
    expect(progress.percentageUsed).toBe(33.3);
    expect(progress.isOverBudget).toBe(false);
  });

  it('should handle extremely large BigInt monetary amounts without overflow or precision loss', () => {
    // Budget: 100 Trillion IDR = 10,000,000,000,000,000 minor units
    // Spending: 45 Trillion IDR = 4,500,000,000,000,000 minor units (45.0%)
    const largeBudget = new Budget({
      id: 'bg-large',
      userId: 'user-1',
      categoryId: 'cat-1',
      amount: Money.fromMinorUnits(10000000000000000n, 'IDR'),
      period,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    const progress = calculateBudgetProgress({
      budget: largeBudget,
      categoryName: 'Investasi Korporat',
      actualSpending: Money.fromMinorUnits(4500000000000000n, 'IDR'),
    });

    expect(progress.actualSpending.minorUnits).toBe(4500000000000000n);
    expect(progress.remainingAmount.minorUnits).toBe(5500000000000000n);
    expect(progress.percentageUsed).toBe(45.0);
    expect(progress.isOverBudget).toBe(false);
  });

  it('should safely handle zero actual spending on a valid budget without dividing by zero', () => {
    const minBudget = new Budget({
      id: 'bg-min',
      userId: 'user-1',
      categoryId: 'cat-1',
      amount: Money.fromMinorUnits(1n, 'IDR'),
      period,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    const progress = calculateBudgetProgress({
      budget: minBudget,
      categoryName: 'Misc',
      actualSpending: Money.fromMinorUnits(0n, 'IDR'),
    });

    expect(progress.actualSpending.minorUnits).toBe(0n);
    expect(progress.remainingAmount.minorUnits).toBe(1n);
    expect(progress.percentageUsed).toBe(0);
    expect(progress.isOverBudget).toBe(false);
  });
});
