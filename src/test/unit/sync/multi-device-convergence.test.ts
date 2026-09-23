import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SupabaseSyncAdapter, RemoteAccountRow, RemoteTransactionRow } from '@/core/sync/data/supabase-sync.adapter';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Multi-Device Convergence Integration Tests', () => {
  let deviceADb: InMemoryTestDb;
  let deviceBDb: InMemoryTestDb;
  let cloudAccounts: RemoteAccountRow[];
  let cloudTransactions: RemoteTransactionRow[];

  let deviceAAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let deviceBAdapter: jest.Mocked<SupabaseSyncAdapter>;

  beforeEach(() => {
    deviceADb = new InMemoryTestDb();
    deviceBDb = new InMemoryTestDb();

    cloudAccounts = [];
    cloudTransactions = [];

    // Simulate shared Supabase cloud backend
    const createMockAdapter = () => ({
      pushMutation: jest.fn().mockImplementation(async (record) => {
        const payload = JSON.parse(record.payload);
        if (record.operationType === 'CREATE_ACCOUNT' || record.operationType === 'UPDATE_ACCOUNT') {
          const existingIdx = cloudAccounts.findIndex((a) => a.id === payload.id);
          const row: RemoteAccountRow = {
            id: payload.id,
            user_id: record.userId,
            name: payload.name,
            type: payload.type,
            currency_code: payload.currency_code ?? 'IDR',
            icon: payload.icon ?? null,
            color: payload.color ?? null,
            is_active: payload.is_active ?? true,
            created_at: payload.created_at ?? new Date().toISOString(),
            updated_at: payload.updated_at ?? new Date().toISOString(),
            deleted_at: payload.deleted_at ?? null,
          };
          if (existingIdx >= 0) {
            cloudAccounts[existingIdx] = row;
          } else {
            cloudAccounts.push(row);
          }
          return { success: true };
        }
        return { success: true };
      }),
      pullAccountsDelta: jest.fn().mockImplementation(async (_userId, since) => {
        const filtered = since ? cloudAccounts.filter((a) => a.updated_at > since) : cloudAccounts;
        return { success: true, data: filtered };
      }),
      pullCategoriesDelta: jest.fn().mockResolvedValue({ success: true, data: [] }),
      pullTransactionsDelta: jest.fn().mockImplementation(async (_userId, since) => {
        const filtered = since ? cloudTransactions.filter((t) => t.updated_at > since) : cloudTransactions;
        return { success: true, data: filtered };
      }),
    });

    deviceAAdapter = createMockAdapter() as unknown as jest.Mocked<SupabaseSyncAdapter>;
    deviceBAdapter = createMockAdapter() as unknown as jest.Mocked<SupabaseSyncAdapter>;
  });

  it('should converge state between Device A and Device B after offline mutations and sync', async () => {
    const userId = 'user-1';

    // 1. Device A creates an account while offline
    const accountId = 'acc-shared-1';
    deviceADb.accounts.push({
      id: accountId,
      user_id: userId,
      name: 'Rekening Bersama',
      type: 'bank',
      currency_code: 'IDR',
      icon: null,
      color: null,
      is_active: 1,
      created_at: '2026-08-19T10:00:00Z',
      updated_at: '2026-08-19T10:00:00Z',
      deleted_at: null,
      sync_state: 'pending',
      base_updated_at: null,
    });

    deviceADb.outbox.push({
      id: 'out-a-1',
      user_id: userId,
      operation_type: 'CREATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: accountId,
      payload: JSON.stringify({
        id: accountId,
        name: 'Rekening Bersama',
        type: 'bank',
        currency_code: 'IDR',
        is_active: true,
        created_at: '2026-08-19T10:00:00Z',
        updated_at: '2026-08-19T10:00:00Z',
      }),
      created_at: '2026-08-19T10:00:00Z',
      status: 'pending',
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
      processed_at: null,
    });

    // 2. Device A goes online and pushes mutation to Cloud
    const outboxRepoA = new SqliteOutboxRepository(async () => deviceADb.getDb());
    const conflictRepoA = new SqliteConflictRepository(async () => deviceADb.getDb());
    const workerA = new OutboxWorker(outboxRepoA, deviceAAdapter, conflictRepoA);
    await workerA.processOutbox(userId);

    expect(cloudAccounts.length).toBe(1);
    expect(cloudAccounts[0].name).toBe('Rekening Bersama');

    // 3. Device B goes online and pulls delta from Cloud
    const outboxRepoB = new SqliteOutboxRepository(async () => deviceBDb.getDb());
    const conflictRepoB = new SqliteConflictRepository(async () => deviceBDb.getDb());
    const pullerB = new PullSynchronizer(outboxRepoB, deviceBAdapter, conflictRepoB, async () => deviceBDb.getDb());
    const pullSummaryB = await pullerB.pullChanges(userId);

    expect(pullSummaryB.accountsApplied).toBe(1);

    // 4. Verify convergence: Device A state == Device B state == Cloud state
    const deviceBAccount = deviceBDb.accounts.find((a) => a.id === accountId);
    expect(deviceBAccount).toBeTruthy();
    expect(deviceBAccount?.name).toBe('Rekening Bersama');
    expect(deviceBAccount?.sync_state).toBe('synced');
  });
});
