import { SqliteRecurringTransactionRepository } from '@/features/recurring-transactions/data/sqlite-recurring.repository';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SqliteRecurringTransactionRepository', () => {
  let inMemoryDb: InMemoryTestDb;
  let repo: SqliteRecurringTransactionRepository;

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    repo = new SqliteRecurringTransactionRepository(async () => inMemoryDb.getDb());
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('creates recurring transaction and writes CREATE_RECURRING_TRANSACTION outbox record', async () => {
    const recurring = new RecurringTransaction({
      id: 'rec-101',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(35000000n), // Rp 350.000
      accountId: 'acc-bca',
      categoryId: 'cat-internet',
      frequency: 'monthly',
      startDate: '2026-06-01',
      nextOccurrence: '2026-06-01',
      note: 'IndiHome 50Mbps',
    });

    const result = await repo.create(recurring);
    expect(result.success).toBe(true);

    expect(inMemoryDb.recurringTransactions.length).toBe(1);
    expect(inMemoryDb.recurringTransactions[0].id).toBe('rec-101');
    expect(inMemoryDb.recurringTransactions[0].amount).toBe(35000000);
    expect(inMemoryDb.recurringTransactions[0].is_active).toBe(1);

    expect(inMemoryDb.outbox.length).toBe(1);
    expect(inMemoryDb.outbox[0].operation_type).toBe('CREATE_RECURRING_TRANSACTION');
    expect(inMemoryDb.outbox[0].entity_id).toBe('rec-101');
  });

  it('updates recurring transaction details and writes UPDATE_RECURRING_TRANSACTION outbox record', async () => {
    const recurring = new RecurringTransaction({
      id: 'rec-102',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(35000000n),
      accountId: 'acc-bca',
      categoryId: 'cat-internet',
      frequency: 'monthly',
      startDate: '2026-06-01',
      nextOccurrence: '2026-06-01',
    });
    await repo.create(recurring);

    const updated = new RecurringTransaction({
      id: 'rec-102',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(40000000n), // Rp 400.000 (upgrade speed)
      accountId: 'acc-bca',
      categoryId: 'cat-internet',
      frequency: 'monthly',
      startDate: '2026-06-01',
      nextOccurrence: '2026-07-01',
      note: 'Upgrade ke 100Mbps',
    });

    const result = await repo.update(updated);
    expect(result.success).toBe(true);

    expect(inMemoryDb.recurringTransactions[0].amount).toBe(40000000);
    expect(inMemoryDb.recurringTransactions[0].note).toBe('Upgrade ke 100Mbps');
    expect(inMemoryDb.outbox[1].operation_type).toBe('UPDATE_RECURRING_TRANSACTION');
  });

  it('processes occurrence atomically and advances next occurrence', async () => {
    const recurring = new RecurringTransaction({
      id: 'rec-103',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(200000000n), // Rp 2.000.000
      accountId: 'acc-bca',
      categoryId: 'cat-rent',
      frequency: 'monthly',
      startDate: '2026-05-01',
      nextOccurrence: '2026-05-01',
      note: 'Sewa Kost Bulanan',
    });
    await repo.create(recurring);

    const occurrenceDate = '2026-05-01';
    const txItem = new TransactionItem({
      id: 'item-tx-1',
      transactionId: 'tx-spawn-1',
      categoryId: 'cat-rent',
      amount: recurring.amount,
    });

    const genTx = new Transaction({
      id: 'tx-spawn-1',
      userId: 'user-1',
      type: 'expense',
      amount: recurring.amount,
      sourceAccountId: 'acc-bca',
      transactionDate: occurrenceDate,
      items: [txItem],
      recurringTransactionId: recurring.id,
      occurrenceKey: `${recurring.id}_${occurrenceDate}`,
    });

    const procRes = await repo.processOccurrence({
      recurring,
      occurrenceDate,
      generatedTransaction: genTx,
    });

    expect(procRes.success).toBe(true);
    if (procRes.success) {
      expect(procRes.data.createdTransaction).not.toBeNull();
      expect(procRes.data.recurring.nextOccurrence).toBe('2026-06-01');
    }

    // Ledger transaction created
    expect(inMemoryDb.transactions.length).toBe(1);
    expect(inMemoryDb.transactions[0].id).toBe('tx-spawn-1');
    expect(inMemoryDb.transactions[0].occurrence_key).toBe('rec-103_2026-05-01');
    expect(inMemoryDb.transactions[0].recurring_transaction_id).toBe('rec-103');

    // Recurring record advanced
    expect(inMemoryDb.recurringTransactions[0].next_occurrence).toBe('2026-06-01');

    // Outbox has CREATE_RECURRING, CREATE_TRANSACTION, UPDATE_RECURRING
    expect(inMemoryDb.outbox.length).toBe(3);
    expect(inMemoryDb.outbox[1].operation_type).toBe('CREATE_TRANSACTION');
    expect(inMemoryDb.outbox[2].operation_type).toBe('UPDATE_RECURRING_TRANSACTION');
  });

  it('guarantees idempotency when occurrence is reprocessed', async () => {
    const recurring = new RecurringTransaction({
      id: 'rec-104',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(5000000n),
      accountId: 'acc-cash',
      categoryId: 'cat-misc',
      frequency: 'daily',
      startDate: '2026-06-01',
      nextOccurrence: '2026-06-01',
    });
    await repo.create(recurring);

    const occurrenceDate = '2026-06-01';
    const txItem = new TransactionItem({
      id: 'item-idem-1',
      transactionId: 'tx-idem-1',
      categoryId: 'cat-misc',
      amount: recurring.amount,
    });

    const genTx = new Transaction({
      id: 'tx-idem-1',
      userId: 'user-1',
      type: 'expense',
      amount: recurring.amount,
      sourceAccountId: 'acc-cash',
      transactionDate: occurrenceDate,
      items: [txItem],
      recurringTransactionId: recurring.id,
      occurrenceKey: `${recurring.id}_${occurrenceDate}`,
    });

    // First process
    const res1 = await repo.processOccurrence({
      recurring,
      occurrenceDate,
      generatedTransaction: genTx,
    });
    expect(res1.success).toBe(true);

    // Second process with same occurrenceKey
    const res2 = await repo.processOccurrence({
      recurring,
      occurrenceDate,
      generatedTransaction: genTx,
    });

    expect(res2.success).toBe(true);
    if (res2.success) {
      // Skipped duplicate creation
      expect(res2.data.createdTransaction).toBeNull();
    }

    // Still only 1 transaction in DB
    expect(inMemoryDb.transactions.length).toBe(1);
  });

  it('soft deletes recurring transaction and writes DELETE_RECURRING_TRANSACTION outbox record', async () => {
    const recurring = new RecurringTransaction({
      id: 'rec-105',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(10000000n),
      accountId: 'acc-bca',
      categoryId: 'cat-bills',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
    });
    await repo.create(recurring);

    const delRes = await repo.softDelete('rec-105', 'user-1');
    expect(delRes.success).toBe(true);

    expect(inMemoryDb.recurringTransactions[0].deleted_at).not.toBeNull();
    expect(inMemoryDb.outbox[1].operation_type).toBe('DELETE_RECURRING_TRANSACTION');

    const list = await repo.listActive('user-1');
    expect(list.success).toBe(true);
    if (list.success) {
      expect(list.data.length).toBe(0);
    }
  });

  it('enforces user isolation in queries and mutations', async () => {
    const recurringUser1 = new RecurringTransaction({
      id: 'rec-u1',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromMinorUnits(100000000n),
      accountId: 'acc-u1',
      categoryId: 'cat-u1',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01',
    });
    await repo.create(recurringUser1);

    const getU2 = await repo.getById('rec-u1', 'user-2');
    expect(getU2.success).toBe(true);
    if (getU2.success) {
      expect(getU2.data).toBeNull();
    }
  });
});
