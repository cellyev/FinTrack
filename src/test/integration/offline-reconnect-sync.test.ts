import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SqliteRecurringTransactionRepository } from '@/features/recurring-transactions/data/sqlite-recurring.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';

import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';
import { Money } from '@/core/domain/money';
import { ProcessDueRecurringTransactionsUseCase } from '@/features/recurring-transactions/application/process-due-recurring.usecase';
import { OutboxRecord } from '@/core/sync/domain/sync-types';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

describe('Offline Occurrence Generation -> Reconnect -> Sync Integration', () => {
  let inMemoryDb: InMemoryTestDb;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let recurringRepo: SqliteRecurringTransactionRepository;
  let txRepo: SqliteTransactionRepository;
  let outboxRepo: SqliteOutboxRepository;
  let conflictRepo: SqliteConflictRepository;
  let outboxWorker: OutboxWorker;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;

  let processDueRecurringUseCase: ProcessDueRecurringTransactionsUseCase;

  let idCounter = 200;
  const mockUuidGenerator: IUuidGenerator = {
    generate: () => `offline-uuid-${idCounter++}`,
    isValid: (_id: string) => true,
  };

  const pushedRecords: OutboxRecord[] = [];

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    const dbProvider = async () => inMemoryDb.getDb();

    accountRepo = new SqliteAccountRepository(dbProvider);
    categoryRepo = new SqliteCategoryRepository(dbProvider);
    recurringRepo = new SqliteRecurringTransactionRepository(dbProvider);
    txRepo = new SqliteTransactionRepository(dbProvider);
    outboxRepo = new SqliteOutboxRepository(dbProvider);
    conflictRepo = new SqliteConflictRepository(dbProvider);

    pushedRecords.length = 0;
    mockSyncAdapter = {
      pushMutation: jest.fn().mockImplementation(async (record) => {
        pushedRecords.push({ ...record });
        return { success: true };
      }),
    } as unknown as jest.Mocked<SupabaseSyncAdapter>;

    outboxWorker = new OutboxWorker(outboxRepo, mockSyncAdapter, conflictRepo);
    processDueRecurringUseCase = new ProcessDueRecurringTransactionsUseCase(recurringRepo, mockUuidGenerator);
  });

  afterEach(() => {
    inMemoryDb.reset();
    jest.clearAllMocks();
  });

  it('processes 3 overdue occurrences offline and pushes to Supabase in strict topological rank order upon reconnect', async () => {
    const userId = 'user-offline-1';

    // 1. OFFLINE SETUP: Create Account and Category
    const account = new Account({
      id: 'acc-offline-1',
      userId,
      name: 'Bank Mandiri',
      type: 'bank',
    });
    await accountRepo.create(account);

    const category = new Category({
      id: 'cat-subscription-1',
      userId,
      name: 'Langganan & Streaming',
      type: 'expense',
    });
    await categoryRepo.create(category);

    // 2. OFFLINE: Create Monthly Recurring Expense with start date 2026-01-01
    const recurring = new RecurringTransaction({
      id: 'rec-netflix-1',
      userId,
      type: 'expense',
      amount: Money.fromMinorUnits(18600000n, 'IDR'), // Rp 186.000 / bln
      accountId: account.id,
      categoryId: category.id,
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
      note: 'Netflix Premium',
    });
    await recurringRepo.create(recurring);

    // 3. OFFLINE: Simulate device opening after 3 months (reference date: 2026-03-15)
    // Three occurrences are due: 2026-01-01, 2026-02-01, 2026-03-01
    const processResult = await processDueRecurringUseCase.execute({
      userId,
      referenceDate: '2026-03-15',
      specificRecurringId: recurring.id,
    });

    expect(processResult.success).toBe(true);
    if (processResult.success) {
      expect(processResult.data.generatedTransactionsCount).toBe(3);
      expect(processResult.data.skippedDuplicateCount).toBe(0);
    }

    // 4. VERIFY LOCAL OFFLINE STATE
    // 4a. 3 Transactions created locally with unique occurrence keys
    const txRes = await txRepo.getAllActiveTransactions(userId);
    const localTxs: Transaction[] = txRes.success ? txRes.data : [];
    expect(localTxs.length).toBe(3);

    const dates = localTxs.map((t: Transaction) => t.transactionDate).sort();
    expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);

    const occurrenceKeys = localTxs.map((t: Transaction) => t.occurrenceKey).sort();
    expect(occurrenceKeys).toEqual([
      `${recurring.id}_2026-01-01`,
      `${recurring.id}_2026-02-01`,
      `${recurring.id}_2026-03-01`,
    ]);

    // 4b. Recurring schedule advanced next_occurrence to 2026-04-01
    const recRes = await recurringRepo.getById(recurring.id, userId);
    const recAfter = recRes.success ? recRes.data : null;
    expect(recAfter?.nextOccurrence).toBe('2026-04-01');

    // 4c. Verify outbox contains all mutations (9 total)
    const pendingBeforeSync = await outboxRepo.fetchPendingBatch(userId, 50);
    expect(pendingBeforeSync.length).toBe(9);
    // Expected operations:
    // - 1 x CREATE_ACCOUNT (Rank 1)
    // - 1 x CREATE_CATEGORY (Rank 2)
    // - 1 x CREATE_RECURRING_TRANSACTION (Rank 3)
    // - 3 x UPDATE_RECURRING_TRANSACTION (Rank 3, schedule advancements)
    // - 3 x CREATE_TRANSACTION (Rank 4, occurrence ledger transactions)

    const opOrder = pendingBeforeSync.map((o) => o.operationType);
    expect(opOrder).toEqual([
      'CREATE_ACCOUNT',
      'CREATE_CATEGORY',
      'CREATE_RECURRING_TRANSACTION',
      'UPDATE_RECURRING_TRANSACTION',
      'UPDATE_RECURRING_TRANSACTION',
      'UPDATE_RECURRING_TRANSACTION',
      'CREATE_TRANSACTION',
      'CREATE_TRANSACTION',
      'CREATE_TRANSACTION',
    ]);

    // 5. SIMULATE RECONNECT: Drain outbox via OutboxWorker
    const workerResult = await outboxWorker.processOutbox(userId, 50);
    expect(workerResult.processed).toBe(9);
    expect(workerResult.succeeded).toBe(9);
    expect(workerResult.failed).toBe(0);

    // 6. VERIFY PUSH ORDER & PAYLOAD INTEGRITY
    expect(pushedRecords.length).toBe(9);

    // Rank 1: Account
    expect(pushedRecords[0].operationType).toBe('CREATE_ACCOUNT');
    expect(pushedRecords[0].entityId).toBe(account.id);

    // Rank 2: Category
    expect(pushedRecords[1].operationType).toBe('CREATE_CATEGORY');
    expect(pushedRecords[1].entityId).toBe(category.id);

    // Rank 3: Recurring Transaction (Creation & Advancements)
    expect(pushedRecords[2].operationType).toBe('CREATE_RECURRING_TRANSACTION');
    expect(pushedRecords[2].entityId).toBe(recurring.id);
    expect(pushedRecords[3].operationType).toBe('UPDATE_RECURRING_TRANSACTION');
    expect(pushedRecords[4].operationType).toBe('UPDATE_RECURRING_TRANSACTION');
    expect(pushedRecords[5].operationType).toBe('UPDATE_RECURRING_TRANSACTION');

    // Rank 4: Transactions (Occurrences)
    expect(pushedRecords[6].operationType).toBe('CREATE_TRANSACTION');
    expect(pushedRecords[7].operationType).toBe('CREATE_TRANSACTION');
    expect(pushedRecords[8].operationType).toBe('CREATE_TRANSACTION');

    // 7. VERIFY OUTBOX DRAIN IDEMPOTENCY: Re-running drain finds 0 pending items
    const secondDrainResult = await outboxWorker.processOutbox(userId, 50);
    expect(secondDrainResult.processed).toBe(0);
    expect(secondDrainResult.succeeded).toBe(0);

    // Local DB transactions remain exactly 3
    const finalTxRes = await txRepo.getAllActiveTransactions(userId);
    const finalTxs = finalTxRes.success ? finalTxRes.data : [];
    expect(finalTxs.length).toBe(3);
  });
});
