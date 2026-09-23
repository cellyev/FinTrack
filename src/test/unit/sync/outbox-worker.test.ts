import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('OutboxWorker Application Unit Tests', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let worker: OutboxWorker;

  beforeEach(() => {
    db = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => db.getDb());
    mockSyncAdapter = {
      pushMutation: jest.fn(),
      pullAccountsDelta: jest.fn(),
      pullCategoriesDelta: jest.fn(),
      pullTransactionsDelta: jest.fn(),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    worker = new OutboxWorker(outboxRepo, mockSyncAdapter);
  });

  it('should process pending outbox mutations successfully and purge from queue', async () => {
    db.outbox.push({
      id: 'out-1',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: JSON.stringify({ id: 'acc-1', name: 'BCA Utama' }),
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    mockSyncAdapter.pushMutation.mockResolvedValue({ success: true });

    const summary = await worker.processOutbox('u1');
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);

    expect(mockSyncAdapter.pushMutation).toHaveBeenCalledTimes(1);
    expect(db.outbox).toHaveLength(0);
  });

  it('should mark transient failures as failed with exponential backoff', async () => {
    db.outbox.push({
      id: 'out-transient',
      user_id: 'u1',
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: JSON.stringify({ id: 'acc-1', name: 'BCA Utama' }),
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    mockSyncAdapter.pushMutation.mockResolvedValue({
      success: false,
      error: 'HTTP 503 Service Unavailable',
    });

    const summary = await worker.processOutbox('u1');
    expect(summary.processed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(1);

    const record = db.outbox.find((o) => o.id === 'out-transient');
    expect(record?.status).toBe('failed');
    expect(record?.retry_count).toBe(1);
    expect(record?.next_retry_at).toBeTruthy();
    expect(record?.last_error).toBe('HTTP 503 Service Unavailable');
  });

  it('should route permanent errors immediately to dead_letter', async () => {
    db.outbox.push({
      id: 'out-permanent',
      user_id: 'u1',
      operation_type: 'CREATE_TRANSACTION',
      entity_name: 'transactions',
      entity_id: 'tx-1',
      payload: JSON.stringify({ id: 'tx-1' }),
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    mockSyncAdapter.pushMutation.mockResolvedValue({
      success: false,
      error: 'invalid category split',
    });

    const summary = await worker.processOutbox('u1');
    expect(summary.failed).toBe(1);

    const record = db.outbox.find((o) => o.id === 'out-permanent');
    expect(record?.status).toBe('dead_letter');
    expect(record?.last_error).toBe('invalid category split');
  });

  it('should calculate exponential backoff delay within bounds', () => {
    const retry1 = worker.calculateNextRetryTime(1);
    const retry3 = worker.calculateNextRetryTime(3);
    const retry5 = worker.calculateNextRetryTime(5);

    expect(new Date(retry1).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(retry3).getTime()).toBeGreaterThan(new Date(retry1).getTime());
    expect(new Date(retry5).getTime()).toBeGreaterThan(new Date(retry3).getTime());
  });

  it('should process a high-volume batch of 56 mixed-rank operations maintaining topological sort invariants without starvation', async () => {
    const processedOps: string[] = [];
    mockSyncAdapter.pushMutation.mockImplementation(async (record) => {
      processedOps.push(record.operationType);
      return { success: true };
    });

    const opTypes: { type: string; entity: string; count: number }[] = [
      { type: 'CREATE_TRANSACTION', entity: 'transactions', count: 8 },         // Rank 4
      { type: 'CREATE_RECURRING_TRANSACTION', entity: 'recurring_transactions', count: 8 }, // Rank 3
      { type: 'CREATE_DEBT', entity: 'debts', count: 8 },                       // Rank 3
      { type: 'CREATE_SAVINGS_GOAL', entity: 'savings_goals', count: 8 },       // Rank 3
      { type: 'CREATE_BUDGET', entity: 'budgets', count: 8 },                   // Rank 3
      { type: 'CREATE_CATEGORY', entity: 'categories', count: 8 },               // Rank 2
      { type: 'CREATE_ACCOUNT', entity: 'accounts', count: 8 },                 // Rank 1
    ];

    let id = 1;
    for (const group of opTypes) {
      for (let i = 1; i <= group.count; i++) {
        db.outbox.push({
          id: `out-stress-${id}`,
          user_id: 'u-stress',
          operation_type: group.type,
          entity_name: group.entity,
          entity_id: `entity-${id}`,
          payload: JSON.stringify({ id: `entity-${id}` }),
          created_at: new Date(2026, 0, 1, 0, id).toISOString(),
          status: 'pending',
          retry_count: 0,
          next_retry_at: null,
          last_error: null,
          processed_at: null,
        });
        id++;
      }
    }

    expect(db.outbox.length).toBe(56);

    // Process outbox in batches of 20
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let hasMore = true;
    while (hasMore) {
      const batchResult = await worker.processOutbox('u-stress', 20);
      if (batchResult.processed === 0) {
        hasMore = false;
      } else {
        totalProcessed += batchResult.processed;
        totalSucceeded += batchResult.succeeded;
      }
    }

    expect(totalProcessed).toBe(56);
    expect(totalSucceeded).toBe(56);
    expect(db.outbox).toHaveLength(0);
    expect(processedOps).toHaveLength(56);

    // Verify Rank 1: First 8 operations are ACCOUNTS
    for (let i = 0; i < 8; i++) {
      expect(processedOps[i]).toBe('CREATE_ACCOUNT');
    }

    // Verify Rank 2: Next 8 operations are CATEGORIES
    for (let i = 8; i < 16; i++) {
      expect(processedOps[i]).toBe('CREATE_CATEGORY');
    }

    // Verify Rank 3: Next 32 operations are Budgets, Goals, Debts, Recurring
    const rank3Ops = processedOps.slice(16, 48);
    for (const op of rank3Ops) {
      expect([
        'CREATE_BUDGET',
        'CREATE_SAVINGS_GOAL',
        'CREATE_DEBT',
        'CREATE_RECURRING_TRANSACTION',
      ]).toContain(op);
    }

    // Verify Rank 4: Final 8 operations are TRANSACTIONS
    for (let i = 48; i < 56; i++) {
      expect(processedOps[i]).toBe('CREATE_TRANSACTION');
    }
  });
});
