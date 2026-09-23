import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { Money } from '@/core/domain/money';

describe('SavingsGoal Domain Entity', () => {
  const validProps = {
    id: 'goal-1',
    userId: 'user-1',
    name: 'Dana Darurat',
    targetAmount: Money.fromMinorUnits(1000000000n, 'IDR'), // Rp 10.000.000 (with 2 decimal minor units: 10_000_000_00)
    currentAmount: Money.fromMinorUnits(200000000n, 'IDR'), // Rp 2.000.000
    targetDate: '2026-12-31',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  };

  it('should create a valid SavingsGoal instance', () => {
    const goal = new SavingsGoal(validProps);
    expect(goal.id).toBe('goal-1');
    expect(goal.userId).toBe('user-1');
    expect(goal.name).toBe('Dana Darurat');
    expect(goal.targetAmount.minorUnits).toBe(1000000000n);
    expect(goal.currentAmount.minorUnits).toBe(200000000n);
    expect(goal.targetDate).toBe('2026-12-31');
    expect(goal.isDeleted).toBe(false);
    expect(goal.syncState).toBe('synced');
  });

  it('should default currentAmount to zero if not provided', () => {
    const goal = new SavingsGoal({
      ...validProps,
      currentAmount: undefined,
    });
    expect(goal.currentAmount.minorUnits).toBe(0n);
  });

  it('should reject empty ID', () => {
    expect(() => new SavingsGoal({ ...validProps, id: '' })).toThrow('Savings Goal ID is required.');
  });

  it('should reject empty User ID', () => {
    expect(() => new SavingsGoal({ ...validProps, userId: '  ' })).toThrow('User ID is required.');
  });

  it('should reject empty name', () => {
    expect(() => new SavingsGoal({ ...validProps, name: '   ' })).toThrow('Savings Goal name must not be empty.');
  });

  it('should reject targetAmount <= 0', () => {
    expect(
      () =>
        new SavingsGoal({
          ...validProps,
          targetAmount: Money.zero('IDR'),
        })
    ).toThrow('Target amount must be greater than zero.');
  });

  it('should reject currentAmount > targetAmount', () => {
    expect(
      () =>
        new SavingsGoal({
          ...validProps,
          currentAmount: Money.fromMinorUnits(2000000000n, 'IDR'), // Rp 20.000.000 > Rp 10.000.000
        })
    ).toThrow('Current amount cannot exceed target amount.');
  });

  it('should reject invalid targetDate format', () => {
    expect(
      () =>
        new SavingsGoal({
          ...validProps,
          targetDate: '31-12-2026', // wrong format
        })
    ).toThrow('Target date must be in YYYY-MM-DD format.');
  });

  it('should correctly report isDeleted when deletedAt is set', () => {
    const goal = new SavingsGoal({
      ...validProps,
      deletedAt: '2026-08-19T10:00:00.000Z',
    });
    expect(goal.isDeleted).toBe(true);
  });
});
