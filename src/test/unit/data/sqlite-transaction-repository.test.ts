import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteTransactionRepository', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteTransactionRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteTransactionRepository(async () => testDb.getDb());
  });

  it('should create expense with category splits atomically and insert outbox record', async () => {
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(150000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-1',
          categoryId: 'cat-food',
          amount: Money.fromDecimal(100000, 'IDR'),
        }),
        new TransactionItem({
          id: 'item-2',
          transactionId: 'tx-1',
          categoryId: 'cat-transport',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    const result = await repository.create(tx);
    expect(result.success).toBe(true);

    const txTable = testDb.tables.get('transactions') ?? [];
    expect(txTable.length).toBe(1);
    expect(txTable[0].id).toBe('tx-1');
    expect(txTable[0].amount).toBe(15000000); // minor units: 150000.00 -> 15000000

    const itemsTable = testDb.tables.get('transaction_items') ?? [];
    expect(itemsTable.length).toBe(2);
    expect(itemsTable[0].amount).toBe(10000000);
    expect(itemsTable[1].amount).toBe(5000000);

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(1);
    expect(outboxTable[0].operation_type).toBe('CREATE_TRANSACTION');
  });

  it('should rollback transaction and outbox insertion completely if a step fails', async () => {
    const tx = new Transaction({
      id: 'tx-fail',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        new TransactionItem({
          id: 'item-fail',
          transactionId: 'tx-fail',
          categoryId: 'cat-food',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    // Make database fail during execution
    testDb.failNextRun = true;
    testDb.failNextRunMessage = 'Disk error during split insertion';

    const result = await repository.create(tx);

    expect(result.success).toBe(false);

    // Verify complete rollback: zero rows left
    const txTable = testDb.tables.get('transactions') ?? [];
    expect(txTable.length).toBe(0);

    const itemsTable = testDb.tables.get('transaction_items') ?? [];
    expect(itemsTable.length).toBe(0);

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(0);
  });

  it('should preserve exact money values across SQLite round-trip without floating point error', async () => {
    const testAmounts = [
      Money.fromDecimal(1, 'IDR'),              // Rp 1
      Money.fromDecimal(999, 'IDR'),            // Rp 999
      Money.fromDecimal(1000, 'IDR'),           // Rp 1.000
      Money.fromDecimal(1000000, 'IDR'),        // Rp 1.000.000
      Money.fromDecimal(50000000000, 'IDR'),    // Rp 50.000.000.000 (50 Billion)
    ];

    for (let i = 0; i < testAmounts.length; i++) {
      const amount = testAmounts[i];
      const txId = `tx-money-${i}`;
      const tx = new Transaction({
        id: txId,
        userId: 'user-1',
        type: 'opening_balance',
        amount,
        transactionDate: '2026-08-19',
        destinationAccountId: 'acc-1',
      });

      await repository.create(tx);

      const findResult = await repository.findById(txId, 'user-1');
      expect(findResult.success).toBe(true);
      if (findResult.success && findResult.data) {
        expect(findResult.data.amount.equals(amount)).toBe(true);
        expect(findResult.data.amount.toDecimal()).toBe(amount.toDecimal());
      }
    }
  });

  it('should soft delete transaction and related split items atomically', async () => {
    const tx = new Transaction({
      id: 'tx-del-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-1',
      items: [
        new TransactionItem({
          id: 'item-del-1',
          transactionId: 'tx-del-1',
          categoryId: 'cat-1',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    await repository.create(tx);

    const deleteResult = await repository.softDelete('tx-del-1', 'user-1');
    expect(deleteResult.success).toBe(true);

    const listResult = await repository.list({ userId: 'user-1' });
    if (listResult.success) {
      expect(listResult.data.length).toBe(0); // Excluded by default
    }

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.some((o) => o.operation_type === 'DELETE_TRANSACTION')).toBe(true);
  });

  it('should filter transactions by account, type, and date range', async () => {
    const tx1 = new Transaction({
      id: 't1',
      userId: 'user-1',
      type: 'opening_balance',
      amount: Money.fromDecimal(1000000, 'IDR'),
      transactionDate: '2026-08-01',
      destinationAccountId: 'acc-A',
    });

    const tx2 = new Transaction({
      id: 't2',
      userId: 'user-1',
      type: 'transfer',
      amount: Money.fromDecimal(200000, 'IDR'),
      transactionDate: '2026-08-10',
      sourceAccountId: 'acc-A',
      destinationAccountId: 'acc-B',
    });

    const tx3 = new Transaction({
      id: 't3',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromDecimal(500000, 'IDR'),
      transactionDate: '2026-08-20',
      destinationAccountId: 'acc-B',
      items: [
        new TransactionItem({
          id: 'i3',
          transactionId: 't3',
          categoryId: 'c-sal',
          amount: Money.fromDecimal(500000, 'IDR'),
        }),
      ],
    });

    await repository.create(tx1);
    await repository.create(tx2);
    await repository.create(tx3);

    // Filter by Account B
    const accBResult = await repository.list({ userId: 'user-1', accountId: 'acc-B' });
    if (accBResult.success) {
      expect(accBResult.data.length).toBe(2); // tx2 and tx3
    }

    // Filter by Date Range: 2026-08-05 to 2026-08-15
    const dateResult = await repository.list({
      userId: 'user-1',
      startDate: '2026-08-05',
      endDate: '2026-08-15',
    });
    if (dateResult.success) {
      expect(dateResult.data.length).toBe(1);
      expect(dateResult.data[0].id).toBe('t2');
    }
  });
});
