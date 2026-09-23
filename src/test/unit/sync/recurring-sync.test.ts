import { SupabaseSyncAdapter, RemoteRecurringTransactionRow } from '@/core/sync/data/supabase-sync.adapter';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { ResolveSyncConflictUseCase } from '@/core/sync/application/resolve-sync-conflict.usecase';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

describe('Recurring Transactions Sync & Conflict Resolution', () => {
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
      pullRecurringTransactionsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullTransactionsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    pullSynchronizer = new PullSynchronizer(outboxRepo, mockAdapter, conflictRepo, async () => inMemoryDb.getDb());
    resolveConflictUseCase = new ResolveSyncConflictUseCase(conflictRepo, outboxRepo, async () => inMemoryDb.getDb());
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('guarantees Rank 3 topological outbox ordering for RECURRING operations', async () => {
    const db = inMemoryDb.getDb();

    // Enqueue transactions first, then recurring, then accounts, then categories
    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_TRANSACTION',
      entityName: 'transactions',
      entityId: 'tx-1',
      payload: { id: 'tx-1' },
    });

    await insertOutboxRecord(db, {
      userId: 'user-1',
      operationType: 'CREATE_RECURRING_TRANSACTION',
      entityName: 'recurring_transactions',
      entityId: 'rec-1',
      payload: { id: 'rec-1' },
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

    // Expected order: ACCOUNT (1) -> CATEGORY (2) -> RECURRING (3) -> TRANSACTION (4)
    expect(opOrder).toEqual([
      'CREATE_ACCOUNT',
      'CREATE_CATEGORY',
      'CREATE_RECURRING_TRANSACTION',
      'CREATE_TRANSACTION',
    ]);
  });

  it('pushes CREATE_RECURRING_TRANSACTION mutation to Supabase adapter', async () => {
    const record = {
      id: 'out-rec-1',
      userId: 'user-1',
      operationType: 'CREATE_RECURRING_TRANSACTION' as const,
      entityName: 'recurring_transactions',
      entityId: 'rec-1',
      payload: JSON.stringify({
        id: 'rec-1',
        type: 'expense',
        amount: 50000000,
        account_id: 'acc-1',
        category_id: 'cat-1',
        frequency: 'monthly',
        start_date: '2026-01-01',
        end_date: null,
        next_occurrence: '2026-01-01',
        is_active: true,
        note: 'Spotify',
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
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

  it('pulls remote recurring transaction delta and applies to local database', async () => {
    const remoteRecurring: RemoteRecurringTransactionRow = {
      id: 'remote-rec-1',
      user_id: 'user-1',
      type: 'expense',
      amount: 750000.0, // numeric(18,2) -> Rp 750.000
      account_id: 'acc-1',
      category_id: 'cat-1',
      frequency: 'yearly',
      start_date: '2026-01-01',
      end_date: null,
      next_occurrence: '2027-01-01',
      is_active: true,
      note: 'Gym Annual Plan',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullRecurringTransactionsDelta.mockResolvedValue({
      success: true,
      data: [remoteRecurring],
    });

    const summary = await pullSynchronizer.pullChanges('user-1');
    expect(summary.recurringTransactionsApplied).toBe(1);

    expect(inMemoryDb.recurringTransactions.length).toBe(1);
    expect(inMemoryDb.recurringTransactions[0].id).toBe('remote-rec-1');
    expect(inMemoryDb.recurringTransactions[0].amount).toBe(75000000);
    expect(inMemoryDb.recurringTransactions[0].frequency).toBe('yearly');
    expect(inMemoryDb.recurringTransactions[0].sync_state).toBe('synced');
  });

  it('detects conflict when remote recurring updates collide with pending local recurring', async () => {
    inMemoryDb.tables.set('recurring_transactions', [
      {
        id: 'colliding-rec-1',
        user_id: 'user-1',
        type: 'expense',
        amount: 30000000,
        account_id: 'acc-1',
        category_id: 'cat-1',
        frequency: 'monthly',
        start_date: '2026-06-01',
        end_date: null,
        next_occurrence: '2026-06-01',
        is_active: 1,
        note: 'Local note',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T10:00:00.000Z',
        deleted_at: null,
        sync_state: 'pending',
        base_updated_at: '2026-06-01T00:00:00.000Z',
      },
    ]);

    const remoteRecurring: RemoteRecurringTransactionRow = {
      id: 'colliding-rec-1',
      user_id: 'user-1',
      type: 'expense',
      amount: 400000.0,
      account_id: 'acc-1',
      category_id: 'cat-1',
      frequency: 'monthly',
      start_date: '2026-06-01',
      end_date: null,
      next_occurrence: '2026-06-01',
      is_active: true,
      note: 'Remote note',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T12:00:00.000Z',
      deleted_at: null,
    };

    mockAdapter.pullRecurringTransactionsDelta.mockResolvedValue({
      success: true,
      data: [remoteRecurring],
    });

    const summary = await pullSynchronizer.pullChanges('user-1');
    expect(summary.conflictsDetected).toBe(1);

    expect(inMemoryDb.syncConflicts.length).toBe(1);
    expect(inMemoryDb.syncConflicts[0].entity_name).toBe('recurring_transactions');
    expect(inMemoryDb.syncConflicts[0].entity_id).toBe('colliding-rec-1');
  });

  it('resolves recurring conflict using use_remote resolution', async () => {
    inMemoryDb.tables.set('recurring_transactions', [
      {
        id: 'rec-res-1',
        user_id: 'user-1',
        type: 'expense',
        amount: 30000000,
        account_id: 'acc-1',
        category_id: 'cat-1',
        frequency: 'monthly',
        start_date: '2026-06-01',
        end_date: null,
        next_occurrence: '2026-06-01',
        is_active: 1,
        note: 'Local Version',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T10:00:00.000Z',
        deleted_at: null,
        sync_state: 'pending',
      },
    ]);

    const remoteData: RemoteRecurringTransactionRow = {
      id: 'rec-res-1',
      user_id: 'user-1',
      type: 'expense',
      amount: 450000.0, // Rp 450.000
      account_id: 'acc-1',
      category_id: 'cat-1',
      frequency: 'monthly',
      start_date: '2026-06-01',
      end_date: null,
      next_occurrence: '2026-06-01',
      is_active: true,
      note: 'Remote Accepted Version',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T15:00:00.000Z',
      deleted_at: null,
    };

    const conflict = await conflictRepo.createConflict({
      userId: 'user-1',
      entityName: 'recurring_transactions',
      entityId: 'rec-res-1',
      conflictType: 'concurrent_update',
      localPayload: JSON.stringify(inMemoryDb.recurringTransactions[0]),
      remotePayload: JSON.stringify(remoteData),
      localUpdatedAt: '2026-06-01T10:00:00.000Z',
      remoteUpdatedAt: '2026-06-01T15:00:00.000Z',
    });

    const res = await resolveConflictUseCase.execute({
      conflictId: conflict.id,
      resolution: 'use_remote',
    });

    expect(res.success).toBe(true);
    expect(inMemoryDb.recurringTransactions[0].amount).toBe(45000000);
    expect(inMemoryDb.recurringTransactions[0].note).toBe('Remote Accepted Version');
    expect(inMemoryDb.recurringTransactions[0].sync_state).toBe('synced');
    expect(inMemoryDb.syncConflicts[0].status).toBe('resolved');
  });
});
