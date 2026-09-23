import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Money } from '@/core/domain/money';

describe('Budget Domain Entity', () => {
  const period = new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly');

  it('should create a valid Budget entity', () => {
    const budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      name: 'Makan Bulanan',
      amount: Money.fromMinorUnits(150000000n, 'IDR'),
      period,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(budget.id).toBe('bg-1');
    expect(budget.userId).toBe('user-1');
    expect(budget.categoryId).toBe('cat-food');
    expect(budget.name).toBe('Makan Bulanan');
    expect(budget.amount.minorUnits).toBe(150000000n);
    expect(budget.period.startDate).toBe('2026-08-01');
    expect(budget.isDeleted).toBe(false);
    expect(budget.syncState).toBe('synced');
  });

  it('should throw error when id is empty', () => {
    expect(() => {
      new Budget({
        id: '',
        userId: 'user-1',
        categoryId: 'cat-food',
        amount: Money.fromMinorUnits(1000000n, 'IDR'),
        period,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    }).toThrow('Budget ID is required.');
  });

  it('should throw error when userId is empty', () => {
    expect(() => {
      new Budget({
        id: 'bg-1',
        userId: '   ',
        categoryId: 'cat-food',
        amount: Money.fromMinorUnits(1000000n, 'IDR'),
        period,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    }).toThrow('User ID is required.');
  });

  it('should throw error when categoryId is empty', () => {
    expect(() => {
      new Budget({
        id: 'bg-1',
        userId: 'user-1',
        categoryId: '',
        amount: Money.fromMinorUnits(1000000n, 'IDR'),
        period,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    }).toThrow('Category ID is required.');
  });

  it('should throw error when amount <= 0', () => {
    expect(() => {
      new Budget({
        id: 'bg-1',
        userId: 'user-1',
        categoryId: 'cat-food',
        amount: Money.fromMinorUnits(0n, 'IDR'),
        period,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    }).toThrow('Budget amount must be greater than zero.');
  });

  it('should identify soft-deleted budgets correctly', () => {
    const budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      amount: Money.fromMinorUnits(1000000n, 'IDR'),
      period,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      deletedAt: '2026-08-05T00:00:00.000Z',
    });

    expect(budget.isDeleted).toBe(true);
    expect(budget.deletedAt).toBe('2026-08-05T00:00:00.000Z');
  });
});
