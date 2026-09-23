import { SqliteSavingsGoalRepository } from '@/features/savings-goals/data/sqlite-savings-goal.repository';
import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SqliteSavingsGoalRepository', () => {
  let testDb: InMemoryTestDb;
  let repo: SqliteSavingsGoalRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repo = new SqliteSavingsGoalRepository(async () => testDb.getDb());
  });

  const createSampleGoal = (id: string, userId: string = 'user-1') =>
    new SavingsGoal({
      id,
      userId,
      name: 'Dana Darurat',
      targetAmount: Money.fromMinorUnits(1000000000n, 'IDR'),
      currentAmount: Money.fromMinorUnits(200000000n, 'IDR'),
      targetDate: '2026-12-31',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    });

  it('should create a savings goal and enqueue CREATE_SAVINGS_GOAL outbox mutation atomically', async () => {
    const goal = createSampleGoal('goal-1');
    const result = await repo.create(goal);

    expect(result.success).toBe(true);

    // Verify row in savings_goals
    expect(testDb.savingsGoals.length).toBe(1);
    expect(testDb.savingsGoals[0].id).toBe('goal-1');
    expect(testDb.savingsGoals[0].name).toBe('Dana Darurat');
    expect(testDb.savingsGoals[0].target_amount).toBe(1000000000);
    expect(testDb.savingsGoals[0].current_amount).toBe(200000000);
    expect(testDb.savingsGoals[0].sync_state).toBe('pending');

    // Verify outbox record enqueued
    expect(testDb.outbox.length).toBe(1);
    expect(testDb.outbox[0].operation_type).toBe('CREATE_SAVINGS_GOAL');
    expect(testDb.outbox[0].entity_name).toBe('savings_goals');
    expect(testDb.outbox[0].entity_id).toBe('goal-1');
  });

  it('should update a savings goal and enqueue UPDATE_SAVINGS_GOAL outbox mutation atomically', async () => {
    const goal = createSampleGoal('goal-1');
    await repo.create(goal);

    const updatedGoal = new SavingsGoal({
      id: 'goal-1',
      userId: 'user-1',
      name: 'Dana Darurat 6 Bulan',
      targetAmount: Money.fromMinorUnits(1200000000n, 'IDR'),
      currentAmount: Money.fromMinorUnits(500000000n, 'IDR'),
      targetDate: '2027-06-30',
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T01:00:00.000Z',
    });

    const updateResult = await repo.update(updatedGoal);
    expect(updateResult.success).toBe(true);

    const fetched = await repo.getById('goal-1', 'user-1');
    expect(fetched.success).toBe(true);
    if (!fetched.success || !fetched.data) {
      throw new Error('Expected fetched goal to exist');
    }
    expect(fetched.data.name).toBe('Dana Darurat 6 Bulan');
    expect(fetched.data.targetAmount.minorUnits).toBe(1200000000n);
    expect(fetched.data.currentAmount.minorUnits).toBe(500000000n);

    expect(testDb.outbox.length).toBe(2);
    expect(testDb.outbox[1].operation_type).toBe('UPDATE_SAVINGS_GOAL');
  });

  it('should soft-delete a savings goal and enqueue DELETE_SAVINGS_GOAL outbox mutation', async () => {
    const goal = createSampleGoal('goal-1');
    await repo.create(goal);

    const deleteResult = await repo.softDelete('goal-1', 'user-1');
    expect(deleteResult.success).toBe(true);

    // List active should exclude soft-deleted goal
    const listResult = await repo.listActive('user-1');
    expect(listResult.success).toBe(true);
    if (!listResult.success || !listResult.data) {
      throw new Error('Expected listResult to succeed');
    }
    expect(listResult.data.length).toBe(0);

    expect(testDb.outbox.length).toBe(2);
    expect(testDb.outbox[1].operation_type).toBe('DELETE_SAVINGS_GOAL');
  });

  it('should enforce user isolation across all operations', async () => {
    const goalUser1 = createSampleGoal('goal-1', 'user-1');
    const goalUser2 = createSampleGoal('goal-2', 'user-2');

    await repo.create(goalUser1);
    await repo.create(goalUser2);

    const listUser1 = await repo.listActive('user-1');
    expect(listUser1.success).toBe(true);
    if (!listUser1.success || !listUser1.data) {
      throw new Error('Expected listUser1 to succeed');
    }
    expect(listUser1.data.length).toBe(1);
    expect(listUser1.data[0].id).toBe('goal-1');

    const getOtherUser = await repo.getById('goal-1', 'user-2');
    expect(getOtherUser.success).toBe(true);
    if (!getOtherUser.success) {
      throw new Error('Expected getOtherUser to succeed');
    }
    expect(getOtherUser.data).toBeNull();
  });
});
