import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { ResolveSyncConflictUseCase } from '@/core/sync/application/resolve-sync-conflict.usecase';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SupabaseSyncAdapter, RemoteSavingsGoalRow } from '@/core/sync/data/supabase-sync.adapter';
import { SqliteSavingsGoalRepository } from '@/features/savings-goals/data/sqlite-savings-goal.repository';
import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Savings Goals Cloud Synchronization & Conflict Resolution', () => {
  let testDb: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let outboxWorker: OutboxWorker;
  let pullSynchronizer: PullSynchronizer;
  let resolveConflictUseCase: ResolveSyncConflictUseCase;
  let savingsGoalRepo: SqliteSavingsGoalRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => testDb.getDb());
    conflictRepo = new SqliteConflictRepository(async () => testDb.getDb());
    mockAdapter = {
      pushMutation: jest.fn().mockResolvedValue({ success: true }),
      pullAccountsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullCategoriesDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullBudgetsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullSavingsGoalsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullTransactionsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    outboxWorker = new OutboxWorker(outboxRepo, mockAdapter, conflictRepo);
    pullSynchronizer = new PullSynchronizer(outboxRepo, mockAdapter, conflictRepo, async () => testDb.getDb());
    resolveConflictUseCase = new ResolveSyncConflictUseCase(conflictRepo, outboxRepo, async () => testDb.getDb());
    savingsGoalRepo = new SqliteSavingsGoalRepository(async () => testDb.getDb());
  });

  it('should push local CREATE_SAVINGS_GOAL outbox mutation to Supabase and prune outbox', async () => {
    const goal = new SavingsGoal({
      id: 'sg-1',
      userId: 'user-1',
      name: 'Dana Darurat',
      targetAmount: Money.fromMinorUnits(1000000000n, 'IDR'),
      currentAmount: Money.fromMinorUnits(200000000n, 'IDR'),
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    });

    await savingsGoalRepo.create(goal);
    expect(testDb.outbox.length).toBe(1);

    const result = await outboxWorker.processOutbox('user-1');
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(mockAdapter.pushMutation).toHaveBeenCalledTimes(1);

    // Completed mutations are deleted/pruned from outbox table
    expect(testDb.outbox.length).toBe(0);
  });

  it('should pull savings_goals deltas from Supabase and apply them into local SQLite', async () => {
    const remoteGoal: RemoteSavingsGoalRow = {
      id: 'sg-remote-1',
      user_id: 'user-1',
      name: 'Liburan Jepang',
      target_amount: 25000000.0, // Rp 25.000.000
      current_amount: 5000000.0, // Rp 5.000.000
      target_date: '2027-04-15',
      created_at: '2026-08-19T02:00:00.000Z',
      updated_at: '2026-08-19T02:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullSavingsGoalsDelta.mockResolvedValue({ success: true, data: [remoteGoal] });

    const pullSummary = await pullSynchronizer.pullChanges('user-1');
    expect(pullSummary.savingsGoalsApplied).toBe(1);

    expect(testDb.savingsGoals.length).toBe(1);
    expect(testDb.savingsGoals[0].id).toBe('sg-remote-1');
    expect(testDb.savingsGoals[0].name).toBe('Liburan Jepang');
    expect(testDb.savingsGoals[0].target_amount).toBe(2500000000);
    expect(testDb.savingsGoals[0].current_amount).toBe(500000000);
  });

  it('should detect concurrent conflict and resolve it with use_remote strategy', async () => {
    // Local goal with pending mutation
    testDb.tables.get('savings_goals')?.push({
      id: 'sg-conflict-1',
      user_id: 'user-1',
      name: 'Dana Darurat Local',
      target_amount: 1000000000,
      current_amount: 100000000,
      sync_state: 'pending',
      updated_at: '2026-08-19T01:00:00.000Z',
    });

    const remoteGoal: RemoteSavingsGoalRow = {
      id: 'sg-conflict-1',
      user_id: 'user-1',
      name: 'Dana Darurat Remote',
      target_amount: 15000000.0,
      current_amount: 3000000.0,
      target_date: null,
      created_at: '2026-08-19T00:00:00.000Z',
      updated_at: '2026-08-19T02:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullSavingsGoalsDelta.mockResolvedValue({ success: true, data: [remoteGoal] });

    const pullSummary = await pullSynchronizer.pullChanges('user-1');
    expect(pullSummary.conflictsDetected).toBe(1);
    expect(testDb.syncConflicts.length).toBe(1);

    const conflict = testDb.syncConflicts[0];
    expect(conflict.entity_name).toBe('savings_goals');
    expect(conflict.entity_id).toBe('sg-conflict-1');

    // Resolve conflict with use_remote
    const resolveResult = await resolveConflictUseCase.execute({
      conflictId: String(conflict.id),
      resolution: 'use_remote',
    });

    expect(resolveResult.success).toBe(true);

    const localGoal = testDb.savingsGoals.find((g) => g.id === 'sg-conflict-1');
    expect(localGoal?.name).toBe('Dana Darurat Remote');
    expect(localGoal?.target_amount).toBe(1500000000);
    expect(localGoal?.current_amount).toBe(300000000);
    expect(localGoal?.sync_state).toBe('synced');
  });
});
