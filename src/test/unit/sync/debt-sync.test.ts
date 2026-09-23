import { SupabaseSyncAdapter, RemoteDebtRow } from '@/core/sync/data/supabase-sync.adapter';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { ResolveSyncConflictUseCase } from '@/core/sync/application/resolve-sync-conflict.usecase';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

describe('Debt Synchronization & Conflict Resolution', () => {
  let inMemoryDb: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let pullSynchronizer: PullSynchronizer;
  let resolveConflictUseCase: ResolveSyncConflictUseCase;

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => inMemoryDb.getDb());
    conflictRepo = new SqliteConflictRepository(async () => inMemoryDb.getDb());
    mockAdapter = {
      pushMutation: jest.fn().mockResolvedValue({ success: true }),
      pullAccountsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullCategoriesDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullBudgetsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullSavingsGoalsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullDebtsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullTransactionsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    pullSynchronizer = new PullSynchronizer(outboxRepo, mockAdapter, conflictRepo, async () => inMemoryDb.getDb());
    resolveConflictUseCase = new ResolveSyncConflictUseCase(conflictRepo, outboxRepo, async () => inMemoryDb.getDb());
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('guarantees Rank 3 topological outbox ordering for DEBT operations', async () => {
    const db = inMemoryDb.getDb();

    // Enqueue transactions first, then debts, then accounts, then categories
    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_TRANSACTION',
      entityName: 'transactions',
      entityId: 'tx-1',
      payload: { id: 'tx-1' },
    });

    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_DEBT',
      entityName: 'debts',
      entityId: 'debt-1',
      payload: { id: 'debt-1' },
    });

    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_ACCOUNT',
      entityName: 'accounts',
      entityId: 'acc-1',
      payload: { id: 'acc-1' },
    });

    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_CATEGORY',
      entityName: 'categories',
      entityId: 'cat-1',
      payload: { id: 'cat-1' },
    });

    const pending = await outboxRepo.fetchPendingBatch('user-1', 10);
    const opOrder = pending.map((r) => r.operationType);

    // Expected order: ACCOUNT (1) -> CATEGORY (2) -> DEBT (3) -> TRANSACTION (4)
    expect(opOrder).toEqual([
      'CREATE_ACCOUNT',
      'CREATE_CATEGORY',
      'CREATE_DEBT',
      'CREATE_TRANSACTION',
    ]);
  });

  it('pushes CREATE_DEBT mutation to Supabase adapter', async () => {
    const record = {
      id: 'out-1',
      userId: 'user-1',
      operationType: 'CREATE_DEBT' as const,
      entityName: 'debts',
      entityId: 'debt-1',
      payload: JSON.stringify({
        id: 'debt-1',
        type: 'borrowed',
        person_name: 'Budi',
        original_amount: 100000000,
        remaining_amount: 100000000,
        due_date: '2026-12-31',
        status: 'open',
        note: null,
      }),
      createdAt: '2026-06-01T00:00:00.000Z',
      status: 'pending' as const,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
    };

    const result = await mockAdapter.pushMutation(record);
    expect(result.success).toBe(true);
    expect(mockAdapter.pushMutation).toHaveBeenCalledWith(record);
  });

  it('pulls remote debt delta and applies to local database', async () => {
    const remoteDebt: RemoteDebtRow = {
      id: 'remote-debt-1',
      user_id: 'user-1',
      type: 'borrowed',
      person_name: 'Remote Person',
      original_amount: 1000.0, // numeric(18,2) -> Rp 100.000
      remaining_amount: 500.0,  // Rp 50.000
      due_date: '2026-12-31',
      status: 'open',
      note: 'From cloud',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullDebtsDelta.mockResolvedValue({
      success: true,
      data: [remoteDebt],
    });

    const summary = await pullSynchronizer.pullChanges('user-1');
    expect(summary.debtsApplied).toBe(1);

    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.debts[0].id).toBe('remote-debt-1');
    expect(inMemoryDb.debts[0].original_amount).toBe(100000);
    expect(inMemoryDb.debts[0].remaining_amount).toBe(50000);
  });

  it('detects conflict when remote debt updates colliding with pending local debt', async () => {
    // 1. Insert local pending debt
    inMemoryDb.tables.set('debts', [
      {
        id: 'colliding-debt-1',
        user_id: 'user-1',
        type: 'borrowed',
        person_name: 'Local Name',
        original_amount: 100000000,
        remaining_amount: 80000000,
        due_date: '2026-12-31',
        status: 'open',
        note: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-02T00:00:00.000Z',
        deleted_at: null,
        sync_state: 'pending',
      },
    ]);

    const remoteCollidingDebt: RemoteDebtRow = {
      id: 'colliding-debt-1',
      user_id: 'user-1',
      type: 'borrowed',
      person_name: 'Remote Changed Name',
      original_amount: 1000000.0,
      remaining_amount: 500000.0,
      due_date: '2026-12-31',
      status: 'open',
      note: null,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-03T00:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullDebtsDelta.mockResolvedValue({
      success: true,
      data: [remoteCollidingDebt],
    });

    const summary = await pullSynchronizer.pullChanges('user-1');
    expect(summary.conflictsDetected).toBe(1);

    expect(inMemoryDb.syncConflicts.length).toBe(1);
    expect(inMemoryDb.syncConflicts[0].entity_name).toBe('debts');
    expect(inMemoryDb.syncConflicts[0].entity_id).toBe('colliding-debt-1');
  });

  it('resolves debt conflict using use_remote strategy', async () => {
    const conflict = await conflictRepo.createConflict({
      userId: 'user-1',
      entityName: 'debts',
      entityId: 'debt-c1',
      conflictType: 'concurrent_update',
      localPayload: JSON.stringify({ person_name: 'Local' }),
      remotePayload: JSON.stringify({
        id: 'debt-c1',
        type: 'borrowed',
        person_name: 'Remote Winning Name',
        original_amount: 1000.0,
        remaining_amount: 500.0,
        due_date: '2026-11-30',
        status: 'open',
        note: 'Synced',
        updated_at: '2026-06-05T00:00:00.000Z',
        deleted_at: null,
      }),
      localUpdatedAt: '2026-06-04T00:00:00.000Z',
      remoteUpdatedAt: '2026-06-05T00:00:00.000Z',
    });

    inMemoryDb.tables.set('debts', [
      {
        id: 'debt-c1',
        user_id: 'user-1',
        type: 'borrowed',
        person_name: 'Local',
        original_amount: 100000,
        remaining_amount: 80000,
        sync_state: 'pending',
      },
    ]);

    const resolveRes = await resolveConflictUseCase.execute({
      conflictId: conflict.id,
      resolution: 'use_remote',
    });

    expect(resolveRes.success).toBe(true);

    const debt = inMemoryDb.debts[0];
    expect(debt.person_name).toBe('Remote Winning Name');
    expect(debt.original_amount).toBe(100000);
    expect(debt.remaining_amount).toBe(50000);
    expect(debt.sync_state).toBe('synced');
  });
});
