import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Push & Pull Conflict Detection Unit Tests', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;

  beforeEach(() => {
    db = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => db.getDb());
    conflictRepo = new SqliteConflictRepository(async () => db.getDb());
    mockSyncAdapter = {
      pushMutation: jest.fn(),
      pullAccountsDelta: jest.fn(),
      pullCategoriesDelta: jest.fn(),
      pullTransactionsDelta: jest.fn(),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;
  });

  describe('OutboxWorker Push Conflict Detection', () => {
    it('should detect 7-day correction window expiration conflict and record in sync_conflicts', async () => {
      const worker = new OutboxWorker(outboxRepo, mockSyncAdapter, conflictRepo);

      db.outbox.push({
        id: 'out-expired',
        user_id: 'user-1',
        operation_type: 'UPDATE_TRANSACTION',
        entity_name: 'transactions',
        entity_id: 'tx-old',
        payload: JSON.stringify({ id: 'tx-old', amount: 50000 }),
        created_at: '2026-08-19T10:00:00Z',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        processed_at: null,
      });

      mockSyncAdapter.pushMutation.mockResolvedValueOnce({
        success: false,
        error: 'transaction missing, changed, or outside seven-day correction window',
      });

      const result = await worker.processOutbox('user-1');

      expect(result.conflicts).toBe(1);

      // Verify outbox was marked as dead_letter
      const outboxRow = db.outbox.find((o) => o.id === 'out-expired');
      expect(outboxRow?.status).toBe('dead_letter');

      // Verify conflict was recorded
      const conflicts = await conflictRepo.getUnresolvedConflicts('user-1');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe('correction_window_expired');
      expect(conflicts[0].entityId).toBe('tx-old');
    });

    it('should detect duplicate category conflict on push', async () => {
      const worker = new OutboxWorker(outboxRepo, mockSyncAdapter, conflictRepo);

      db.outbox.push({
        id: 'out-cat-dup',
        user_id: 'user-1',
        operation_type: 'CREATE_CATEGORY',
        entity_name: 'categories',
        entity_id: 'cat-new',
        payload: JSON.stringify({ id: 'cat-new', name: 'Makan' }),
        created_at: '2026-08-19T10:00:00Z',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        processed_at: null,
      });

      mockSyncAdapter.pushMutation.mockResolvedValueOnce({
        success: false,
        error: 'duplicate key value violates unique constraint categories_user_name_type_unique',
      });

      const result = await worker.processOutbox('user-1');

      expect(result.conflicts).toBe(1);
      const conflicts = await conflictRepo.getUnresolvedConflicts('user-1');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe('duplicate_category');
    });
  });

  describe('PullSynchronizer Pull Conflict Detection', () => {
    it('should detect update_delete conflict when remote deleted an entity that has pending local update', async () => {
      const puller = new PullSynchronizer(outboxRepo, mockSyncAdapter, conflictRepo, async () => db.getDb());

      // 1. Local entity has pending update
      db.accounts.push({
        id: 'acc-1',
        user_id: 'user-1',
        name: 'Dompet Lokal Updated',
        type: 'cash',
        currency_code: 'IDR',
        icon: null,
        color: null,
        is_active: 1,
        created_at: '2026-08-19T10:00:00Z',
        updated_at: '2026-08-19T10:10:00Z',
        deleted_at: null,
        sync_state: 'pending',
        base_updated_at: '2026-08-19T10:00:00Z',
      });

      // 2. Remote delta reports it was deleted
      mockSyncAdapter.pullAccountsDelta.mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'acc-1',
            user_id: 'user-1',
            name: 'Dompet Server',
            type: 'cash',
            currency_code: 'IDR',
            icon: null,
            color: null,
            is_active: true,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:15:00Z',
            deleted_at: '2026-08-19T10:15:00Z',
          },
        ],
      });
      mockSyncAdapter.pullCategoriesDelta.mockResolvedValueOnce({ success: true, data: [] });
      mockSyncAdapter.pullTransactionsDelta.mockResolvedValueOnce({ success: true, data: [] });

      const summary = await puller.pullChanges('user-1');

      expect(summary.conflictsDetected).toBe(1);

      const conflicts = await conflictRepo.getUnresolvedConflicts('user-1');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe('update_delete');
      expect(conflicts[0].entityId).toBe('acc-1');
    });
  });
});
