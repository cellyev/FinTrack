import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('PullSynchronizer Application Unit Tests', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let pullSynchronizer: PullSynchronizer;

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

    pullSynchronizer = new PullSynchronizer(outboxRepo, mockSyncAdapter, conflictRepo, async () => db.getDb());
  });

  it('should pull delta accounts, categories, and transactions and apply them atomically to SQLite', async () => {
    mockSyncAdapter.pullAccountsDelta.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'acc-remote-1',
          user_id: 'u1',
          name: 'Mandiri Savings',
          type: 'bank',
          currency_code: 'IDR',
          icon: null,
          color: '#0055A5',
          is_active: true,
          created_at: '2026-08-19T10:00:00.000Z',
          updated_at: '2026-08-19T10:00:00.000Z',
          deleted_at: null,
        },
      ],
    });

    mockSyncAdapter.pullCategoriesDelta.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'cat-remote-1',
          user_id: 'u1',
          name: 'Belanja Bulanan',
          type: 'expense',
          icon: '🛒',
          color: '#FF5722',
          is_system: false,
          is_active: true,
          sort_order: 1,
          created_at: '2026-08-19T10:00:00.000Z',
          updated_at: '2026-08-19T10:00:00.000Z',
          deleted_at: null,
        },
      ],
    });

    mockSyncAdapter.pullTransactionsDelta.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'tx-remote-1',
          user_id: 'u1',
          type: 'expense',
          amount: 50000, // 50000.00 in decimal -> 5000000 minor units
          source_account_id: 'acc-remote-1',
          destination_account_id: null,
          debt_id: null,
          recurring_transaction_id: null,
          occurrence_key: null,
          transaction_date: '2026-08-19',
          note: 'Supermarket',
          created_at: '2026-08-19T10:00:00.000Z',
          updated_at: '2026-08-19T10:00:00.000Z',
          deleted_at: null,
          transaction_items: [
            {
              id: 'item-remote-1',
              user_id: 'u1',
              transaction_id: 'tx-remote-1',
              category_id: 'cat-remote-1',
              amount: 50000,
              note: null,
              created_at: '2026-08-19T10:00:00.000Z',
              updated_at: '2026-08-19T10:00:00.000Z',
              deleted_at: null,
            },
          ],
        },
      ],
    });

    const summary = await pullSynchronizer.pullChanges('u1');
    expect(summary.accountsApplied).toBe(1);
    expect(summary.categoriesApplied).toBe(1);
    expect(summary.transactionsApplied).toBe(1);

    const accounts = db.tables.get('accounts') ?? [];
    expect(accounts.find((a) => a.id === 'acc-remote-1')).toBeTruthy();

    const categories = db.tables.get('categories') ?? [];
    expect(categories.find((c) => c.id === 'cat-remote-1')).toBeTruthy();

    const transactions = db.tables.get('transactions') ?? [];
    expect(transactions.find((t) => t.id === 'tx-remote-1')).toBeTruthy();

    const metadata = db.tables.get('sync_metadata') ?? [];
    expect(metadata).toHaveLength(3);
  });

  it('should rollback transaction and throw error if pull delta fails', async () => {
    mockSyncAdapter.pullAccountsDelta.mockResolvedValue({
      success: false,
      error: 'Network connection lost',
    });
    mockSyncAdapter.pullCategoriesDelta.mockResolvedValue({ success: true, data: [] });
    mockSyncAdapter.pullTransactionsDelta.mockResolvedValue({ success: true, data: [] });

    await expect(pullSynchronizer.pullChanges('u1')).rejects.toThrow('Network connection lost');
  });
});
