import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { ResolveSyncConflictUseCase } from '@/core/sync/application/resolve-sync-conflict.usecase';
import { SupabaseSyncAdapter, RemoteBudgetRow } from '@/core/sync/data/supabase-sync.adapter';
import { insertOutboxRecord } from '@/core/sync/outbox';

describe('Budget Cloud Synchronization & Conflict Resolution Unit Tests', () => {
  let testDb: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockAdapter: jest.Mocked<SupabaseSyncAdapter>;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => testDb.getDb());
    conflictRepo = new SqliteConflictRepository(async () => testDb.getDb());

    mockAdapter = {
      pushMutation: jest.fn().mockResolvedValue({ success: true }),
      pullAccountsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullCategoriesDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullBudgetsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullTransactionsDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;
  });

  describe('OutboxWorker Budget Mutations', () => {
    it('should push CREATE_BUDGET mutation and mark completed', async () => {
      const db = testDb.getDb();
      await insertOutboxRecord(db, {
        userId: 'user-1',
        operationType: 'CREATE_BUDGET',
        entityName: 'budgets',
        entityId: 'bg-1',
        payload: {
          id: 'bg-1',
          category_id: 'cat-food',
          amount: 150000000,
          period_type: 'monthly',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
        },
      });

      const worker = new OutboxWorker(outboxRepo, mockAdapter, conflictRepo);
      const result = await worker.processOutbox('user-1');

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockAdapter.pushMutation).toHaveBeenCalledTimes(1);

      // Successfully processed mutations are pruned from outbox
      expect(testDb.outbox.length).toBe(0);
    });
  });

  describe('PullSynchronizer Budget Delta Pulling', () => {
    it('should pull and apply remote budgets delta into SQLite', async () => {
      const remoteBudgets: RemoteBudgetRow[] = [
        {
          id: 'bg-remote-1',
          user_id: 'user-1',
          category_id: 'cat-food',
          name: 'Belanja Cloud',
          amount: 2000000, // Rp 2.000.000 (decimal in Supabase)
          period_type: 'monthly',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-01T00:00:00.000Z',
          deleted_at: null,
        },
      ];

      mockAdapter.pullBudgetsDelta.mockResolvedValueOnce({
        success: true,
        data: remoteBudgets,
      });

      const synchronizer = new PullSynchronizer(
        outboxRepo,
        mockAdapter,
        conflictRepo,
        async () => testDb.getDb()
      );

      const summary = await synchronizer.pullChanges('user-1');
      expect(summary.budgetsApplied).toBe(1);

      const localBudgets = testDb.budgets;
      expect(localBudgets.length).toBe(1);
      expect(localBudgets[0].id).toBe('bg-remote-1');
      expect(localBudgets[0].amount).toBe(200000000); // Converted to minor units (200.000.000 cents)
    });

    it('should detect conflict when remote budget updated while local budget is pending', async () => {
      // Setup pending local budget
      testDb.tables.get('budgets')?.push({
        id: 'bg-1',
        user_id: 'user-1',
        category_id: 'cat-food',
        name: 'Lokal Edit',
        amount: 150000000,
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-05T10:00:00.000Z',
        deleted_at: null,
        sync_state: 'pending',
      });

      const remoteBudgets: RemoteBudgetRow[] = [
        {
          id: 'bg-1',
          user_id: 'user-1',
          category_id: 'cat-food',
          name: 'Remote Cloud Edit',
          amount: 2500000,
          period_type: 'monthly',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
          created_at: '2026-08-01T00:00:00.000Z',
          updated_at: '2026-08-05T11:00:00.000Z',
          deleted_at: null,
        },
      ];

      mockAdapter.pullBudgetsDelta.mockResolvedValueOnce({
        success: true,
        data: remoteBudgets,
      });

      const synchronizer = new PullSynchronizer(
        outboxRepo,
        mockAdapter,
        conflictRepo,
        async () => testDb.getDb()
      );

      const summary = await synchronizer.pullChanges('user-1');
      expect(summary.conflictsDetected).toBe(1);

      const conflicts = await conflictRepo.getUnresolvedConflicts('user-1');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].entityName).toBe('budgets');
      expect(conflicts[0].entityId).toBe('bg-1');
    });
  });

  describe('ResolveSyncConflictUseCase for Budgets', () => {
    it('should resolve budget conflict by applying remote state when use_remote chosen', async () => {
      // 1. Setup local pending budget and outbox
      testDb.tables.get('budgets')?.push({
        id: 'bg-1',
        user_id: 'user-1',
        category_id: 'cat-food',
        name: 'Lokal Versi',
        amount: 100000000,
        period_type: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-05T10:00:00.000Z',
        deleted_at: null,
        sync_state: 'pending',
      });

      testDb.tables.get('outbox')?.push({
        id: 'out-1',
        user_id: 'user-1',
        operation_type: 'UPDATE_BUDGET',
        entity_name: 'budgets',
        entity_id: 'bg-1',
        payload: JSON.stringify({ id: 'bg-1', name: 'Lokal Versi' }),
        created_at: '2026-08-05T10:00:00.000Z',
        status: 'dead_letter',
        retry_count: 0,
      });

      // 2. Create conflict record
      const conflict = await conflictRepo.createConflict({
        userId: 'user-1',
        entityName: 'budgets',
        entityId: 'bg-1',
        conflictType: 'concurrent_update',
        localPayload: JSON.stringify({ name: 'Lokal Versi' }),
        remotePayload: JSON.stringify({
          category_id: 'cat-food',
          name: 'Cloud Versi',
          amount: 2500000,
          period_type: 'monthly',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
          updated_at: '2026-08-05T11:00:00.000Z',
          deleted_at: null,
        }),
        localUpdatedAt: '2026-08-05T10:00:00.000Z',
        remoteUpdatedAt: '2026-08-05T11:00:00.000Z',
      });

      const resolveUseCase = new ResolveSyncConflictUseCase(
        conflictRepo,
        outboxRepo,
        async () => testDb.getDb()
      );

      const result = await resolveUseCase.execute({
        conflictId: conflict.id,
        resolution: 'use_remote',
      });

      expect(result.success).toBe(true);

      // Verify local budget was updated to remote
      const updatedBg = testDb.budgets.find((b) => b.id === 'bg-1');
      expect(updatedBg?.name).toBe('Cloud Versi');
      expect(updatedBg?.amount).toBe(250000000);
      expect(updatedBg?.sync_state).toBe('synced');

      // Verify outbox was marked completed
      const outboxRow = testDb.outbox.find((o) => o.id === 'out-1');
      expect(outboxRow?.status).toBe('completed');
    });
  });
});
