import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SqliteOutboxRepository Unit Tests', () => {
  let db: InMemoryTestDb;
  let repository: SqliteOutboxRepository;

  beforeEach(() => {
    db = new InMemoryTestDb();
    repository = new SqliteOutboxRepository(async () => db.getDb());
  });

  it('should fetch pending records ordered topologically by entity dependency', async () => {
    // Insert Account, Category, and Transaction records with different timestamps
    db.outbox.push(
      {
        id: 'out-tx-1',
        user_id: 'u1',
        operation_type: 'CREATE_TRANSACTION',
        entity_name: 'transactions',
        entity_id: 'tx-1',
        payload: JSON.stringify({ id: 'tx-1' }),
        created_at: '2026-08-19T10:00:00.000Z',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        processed_at: null,
      },
      {
        id: 'out-acc-1',
        user_id: 'u1',
        operation_type: 'CREATE_ACCOUNT',
        entity_name: 'accounts',
        entity_id: 'acc-1',
        payload: JSON.stringify({ id: 'acc-1' }),
        created_at: '2026-08-19T10:05:00.000Z',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        processed_at: null,
      },
      {
        id: 'out-cat-1',
        user_id: 'u1',
        operation_type: 'CREATE_CATEGORY',
        entity_name: 'categories',
        entity_id: 'cat-1',
        payload: JSON.stringify({ id: 'cat-1' }),
        created_at: '2026-08-19T10:02:00.000Z',
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        last_error: null,
        processed_at: null,
      }
    );

    const pending = await repository.fetchPendingBatch('u1', 10);
    expect(pending).toHaveLength(3);
    // Account should come first, then Category, then Transaction
    expect(pending[0].operationType).toBe('CREATE_ACCOUNT');
    expect(pending[1].operationType).toBe('CREATE_CATEGORY');
    expect(pending[2].operationType).toBe('CREATE_TRANSACTION');
  });

  it('should mark record as processing and purge when marked completed', async () => {
    db.outbox.push({
      id: 'out-1',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: '{}',
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    await repository.markProcessing('out-1');
    const updated = db.outbox.find((o) => o.id === 'out-1');
    expect(updated?.status).toBe('processing');
    expect(updated?.processed_at).toBeTruthy();

    await repository.markCompleted('out-1');
    const deleted = db.outbox.find((o) => o.id === 'out-1');
    expect(deleted).toBeUndefined();
  });

  it('should mark record as failed with next_retry_at and retry count incremented', async () => {
    db.outbox.push({
      id: 'out-fail-1',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: '{}',
      created_at: new Date().toISOString(),
      status: 'processing',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    const nextRetry = new Date(Date.now() + 5000).toISOString();
    await repository.markFailed('out-fail-1', 'Network timeout', nextRetry, 1);

    const row = db.outbox.find((o) => o.id === 'out-fail-1');
    expect(row?.status).toBe('failed');
    expect(row?.last_error).toBe('Network timeout');
    expect(row?.retry_count).toBe(1);
    expect(row?.next_retry_at).toBe(nextRetry);
  });

  it('should mark record as dead_letter for permanent errors', async () => {
    db.outbox.push({
      id: 'out-dead-1',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: '{}',
      created_at: new Date().toISOString(),
      status: 'processing',
      retry_count: 4,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    await repository.markDeadLetter('out-dead-1', 'Schema violation');
    const row = db.outbox.find((o) => o.id === 'out-dead-1');
    expect(row?.status).toBe('dead_letter');
    expect(row?.last_error).toBe('Schema violation');
  });

  it('should recover hanging processing records from crash', async () => {
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    db.outbox.push({
      id: 'out-hanging',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: '{}',
      created_at: oldDate,
      status: 'processing',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: oldDate,
    });

    const recovered = await repository.recoverHangingProcessingRecords('u1', 2);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const row = db.outbox.find((o) => o.id === 'out-hanging');
    expect(row?.status).toBe('pending');
  });

  it('should get and update sync metadata cursors', async () => {
    await repository.updateSyncMetadata({
      userId: 'u1',
      entityName: 'accounts',
      lastSyncedAt: '2026-08-19T12:00:00.000Z',
      lastSyncStatus: 'success',
      lastError: null,
      updatedAt: '2026-08-19T12:00:00.000Z',
    });

    const meta = await repository.getLastSyncMetadata('u1', 'accounts');
    expect(meta).not.toBeNull();
    expect(meta?.lastSyncedAt).toBe('2026-08-19T12:00:00.000Z');
    expect(meta?.lastSyncStatus).toBe('success');
  });
});
