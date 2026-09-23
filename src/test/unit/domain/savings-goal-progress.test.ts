import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { calculateSavingsGoalProgress } from '@/features/savings-goals/domain/savings-goal-progress';
import { Money } from '@/core/domain/money';

describe('calculateSavingsGoalProgress', () => {
  const createGoal = (targetMinor: bigint, currentMinor: bigint) =>
    new SavingsGoal({
      id: 'goal-1',
      userId: 'user-1',
      name: 'Dana Darurat',
      targetAmount: Money.fromMinorUnits(targetMinor, 'IDR'),
      currentAmount: Money.fromMinorUnits(currentMinor, 'IDR'),
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    });

  it('should calculate 0% progress when currentAmount is zero', () => {
    const goal = createGoal(1000000000n, 0n);
    const progress = calculateSavingsGoalProgress(goal);

    expect(progress.percentageCompleted).toBe(0);
    expect(progress.remainingAmount.minorUnits).toBe(1000000000n);
    expect(progress.isCompleted).toBe(false);
  });

  it('should calculate 20.0% progress correctly using BigInt integer arithmetic', () => {
    const goal = createGoal(1000000000n, 200000000n); // 2.000.000 / 10.000.000
    const progress = calculateSavingsGoalProgress(goal);

    expect(progress.percentageCompleted).toBe(20.0);
    expect(progress.remainingAmount.minorUnits).toBe(800000000n);
    expect(progress.isCompleted).toBe(false);
  });

  it('should calculate 99.9% boundary progress correctly without precision corruption', () => {
    const goal = createGoal(1000000000n, 999000000n); // 99.9%
    const progress = calculateSavingsGoalProgress(goal);

    expect(progress.percentageCompleted).toBe(99.9);
    expect(progress.remainingAmount.minorUnits).toBe(1000000n);
    expect(progress.isCompleted).toBe(false);
  });

  it('should calculate 100% progress and mark isCompleted when current equals target', () => {
    const goal = createGoal(1000000000n, 1000000000n);
    const progress = calculateSavingsGoalProgress(goal);

    expect(progress.percentageCompleted).toBe(100.0);
    expect(progress.remainingAmount.minorUnits).toBe(0n);
    expect(progress.isCompleted).toBe(true);
  });

  it('should handle large BigInt monetary values without integer overflow', () => {
    const targetMinor = 50000000000000n; // Rp 500.000.000.000
    const currentMinor = 25000000000000n; // Rp 250.000.000.000
    const goal = createGoal(targetMinor, currentMinor);
    const progress = calculateSavingsGoalProgress(goal);

    expect(progress.percentageCompleted).toBe(50.0);
    expect(progress.remainingAmount.minorUnits).toBe(25000000000000n);
    expect(progress.isCompleted).toBe(false);
  });
});
