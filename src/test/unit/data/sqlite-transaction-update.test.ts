import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteTransactionRepository - Atomic Update', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteTransactionRepository;
  const userId = 'user-test-update-1';

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteTransactionRepository(async () => testDb.getDb());
  });

  it('should update expense transaction and replace splits atomically with outbox record', async () => {
    // 1. Initial Expense Transaction
    const originalItem = new TransactionItem({
      id: 'item-orig-1',
      transactionId: 'tx-exp-1',
      categoryId: 'cat-food',
      amount: Money.fromDecimal(50000, 'IDR'),
      note: 'Makan Siang',
    });

    const originalTx = new Transaction({
      id: 'tx-exp-1',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-18',
      sourceAccountId: 'acc-cash',
      items: [originalItem],
      note: 'Makan siang kemarin',
    });

    await repository.create(originalTx);

    // 2. Updated Transaction (Amount increased to 75.000 with 2 splits)
    const updatedItem1 = new TransactionItem({
      id: 'item-upd-1',
      transactionId: 'tx-exp-1',
      categoryId: 'cat-food',
      amount: Money.fromDecimal(50000, 'IDR'),
      note: 'Makan Siang',
    });
    const updatedItem2 = new TransactionItem({
      id: 'item-upd-2',
      transactionId: 'tx-exp-1',
      categoryId: 'cat-transport',
      amount: Money.fromDecimal(25000, 'IDR'),
      note: 'Ongkos Ojol',
    });

    const updatedTx = new Transaction({
      id: 'tx-exp-1',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(75000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-bank',
      items: [updatedItem1, updatedItem2],
      note: 'Makan siang dan ojol terupdate',
      updatedAt: new Date('2026-08-19T14:00:00.000Z'),
    });

    const updateRes = await repository.update(updatedTx);
    expect(updateRes.success).toBe(true);

    // 3. Verify SQLite Transactions table
    const txsTable = testDb.tables.get('transactions') ?? [];
    const updatedRow = txsTable.find((r) => r.id === 'tx-exp-1');
    expect(updatedRow).toBeDefined();
    expect(updatedRow?.amount).toBe(7500000); // minor units
    expect(updatedRow?.source_account_id).toBe('acc-bank');
    expect(updatedRow?.transaction_date).toBe('2026-08-19');
    expect(updatedRow?.note).toBe('Makan siang dan ojol terupdate');

    // 4. Verify SQLite Transaction Items table (old split replaced by 2 new splits)
    const itemsTable = testDb.tables.get('transaction_items') ?? [];
    const txItems = itemsTable.filter((r) => r.transaction_id === 'tx-exp-1');
    expect(txItems.length).toBe(2);
    expect(txItems.some((i) => i.id === 'item-orig-1')).toBe(false);
    expect(txItems.some((i) => i.id === 'item-upd-1')).toBe(true);
    expect(txItems.some((i) => i.id === 'item-upd-2')).toBe(true);

    // 5. Verify Outbox Table
    const outboxTable = testDb.tables.get('outbox') ?? [];
    const updateEvent = outboxTable.find((o) => o.operation_type === 'UPDATE_TRANSACTION');
    expect(updateEvent).toBeDefined();
    expect(updateEvent?.entity_id).toBe('tx-exp-1');
  });

  it('should update transfer transaction atomically', async () => {
    const originalTx = new Transaction({
      id: 'tx-trf-1',
      userId,
      type: 'transfer',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-18',
      sourceAccountId: 'acc-bank',
      destinationAccountId: 'acc-wallet',
      note: 'Transfer Dana',
    });

    await repository.create(originalTx);

    const updatedTx = new Transaction({
      id: 'tx-trf-1',
      userId,
      type: 'transfer',
      amount: Money.fromDecimal(150000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-bank',
      destinationAccountId: 'acc-cash',
      note: 'Tarik Tunai Bank',
    });

    const updateRes = await repository.update(updatedTx);
    expect(updateRes.success).toBe(true);

    const txsTable = testDb.tables.get('transactions') ?? [];
    const updatedRow = txsTable.find((r) => r.id === 'tx-trf-1');
    expect(updatedRow).toBeDefined();
    expect(updatedRow?.amount).toBe(15000000);
    expect(updatedRow?.destination_account_id).toBe('acc-cash');
    expect(updatedRow?.note).toBe('Tarik Tunai Bank');
  });

  it('should rollback transaction update if outbox insertion fails', async () => {
    const originalTx = new Transaction({
      id: 'tx-fail-1',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(20000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        new TransactionItem({
          id: 'it-1',
          transactionId: 'tx-fail-1',
          categoryId: 'cat-food',
          amount: Money.fromDecimal(20000, 'IDR'),
        }),
      ],
    });
    await repository.create(originalTx);

    // Simulate disk failure during next run
    testDb.failNextRun = true;
    testDb.failNextRunMessage = 'Outbox write failure';

    const updatedTx = new Transaction({
      id: 'tx-fail-1',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        new TransactionItem({
          id: 'it-2',
          transactionId: 'tx-fail-1',
          categoryId: 'cat-food',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    const updateRes = await repository.update(updatedTx);
    expect(updateRes.success).toBe(false);
  });
});
