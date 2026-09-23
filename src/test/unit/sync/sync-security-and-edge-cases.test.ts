import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Phase 5 — Sync Security & Edge-Case Resilience', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let worker: OutboxWorker;

  beforeEach(() => {
    db = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => db.getDb());
    conflictRepo = new SqliteConflictRepository(async () => db.getDb());

    mockSyncAdapter = {
      pushMutation: jest.fn(),
      pullAccountsDelta: jest.fn(),
      pullCategoriesDelta: jest.fn(),
      pullTransactionsDelta: jest.fn(),
      pullBudgetsDelta: jest.fn(),
      pullSavingsGoalsDelta: jest.fn(),
      pullDebtsDelta: jest.fn(),
      pullRecurringDelta: jest.fn(),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    worker = new OutboxWorker(outboxRepo, mockSyncAdapter, conflictRepo);
  });

  it('should immediately dead-letter unrecoverable 4xx client/validation errors without infinite retry loops', async () => {
    db.outbox.push({
      id: 'outbox-invalid-1',
      user_id: 'user-1',
      operation_type: 'CREATE_TRANSACTION',
      entity_name: 'transactions',
      entity_id: 'tx-1',
      payload: JSON.stringify({ id: 'tx-1', amount: 0 }),
      created_at: '2026-08-20T10:00:00Z',
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    mockSyncAdapter.pushMutation.mockResolvedValueOnce({
      success: false,
      error: 'violates foreign key constraint "fk_transactions_category"',
    });

    const result = await worker.processOutbox('user-1');

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const outboxRow = db.outbox.find((r) => r.id === 'outbox-invalid-1');
    expect(outboxRow?.status).toBe('dead_letter');
  });

  it('should mark for retry with exponential backoff on 5xx or network transport errors', async () => {
    db.outbox.push({
      id: 'outbox-retry-1',
      user_id: 'user-1',
      operation_type: 'CREATE_TRANSACTION',
      entity_name: 'transactions',
      entity_id: 'tx-2',
      payload: JSON.stringify({ id: 'tx-2' }),
      created_at: '2026-08-20T10:00:00Z',
      status: 'pending',
      retry_count: 1,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    mockSyncAdapter.pushMutation.mockResolvedValueOnce({
      success: false,
      error: '503 Service Unavailable: Database is restarting',
    });

    const result = await worker.processOutbox('user-1');

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const outboxRow = db.outbox.find((r) => r.id === 'outbox-retry-1');
    expect(outboxRow?.status).toBe('failed');
    expect(outboxRow?.retry_count).toBe(2);
    expect(outboxRow?.next_retry_at).not.toBeNull();
  });
});
