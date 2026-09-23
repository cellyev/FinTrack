import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteTransactionRepository - History, Search & Filter Queries', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;

  const userId = 'user-history-1';
  const otherUserId = 'user-history-2';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    txRepo = new SqliteTransactionRepository(getDb);
    accountRepo = new SqliteAccountRepository(getDb);
    categoryRepo = new SqliteCategoryRepository(getDb);

    // Setup accounts
    await accountRepo.create(new Account({ id: 'acc-bca', userId, name: 'BCA Utama', type: 'bank' }));
    await accountRepo.create(new Account({ id: 'acc-gopay', userId, name: 'GoPay Saldo', type: 'ewallet' }));
    await accountRepo.create(new Account({ id: 'acc-cash', userId, name: 'Dompet Tunai', type: 'cash' }));

    // Setup categories
    await categoryRepo.create(new Category({ id: 'cat-food', userId, name: 'Makanan & Resto', type: 'expense' }));
    await categoryRepo.create(new Category({ id: 'cat-trans', userId, name: 'Transportasi Online', type: 'expense' }));
    await categoryRepo.create(new Category({ id: 'cat-sal', userId, name: 'Gaji Bulanan', type: 'income' }));

    // Setup sample transactions
    // 1. Expense Makanan Rp 50.000 from BCA on 2026-08-19
    await txRepo.create(
      new Transaction({
        id: 'tx-1',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(50000, 'IDR'),
        sourceAccountId: 'acc-bca',
        transactionDate: '2026-08-19',
        note: 'Makan Padang Siang',
        items: [
          new TransactionItem({
            id: 'item-1',
            transactionId: 'tx-1',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(50000, 'IDR'),
            note: 'Nasi Rendang',
          }),
        ],
      })
    );

    // 2. Expense Multi-split Rp 150.000 from GoPay on 2026-08-18
    await txRepo.create(
      new Transaction({
        id: 'tx-2',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(150000, 'IDR'),
        sourceAccountId: 'acc-gopay',
        transactionDate: '2026-08-18',
        note: 'Supermarket dan Ojek',
        items: [
          new TransactionItem({
            id: 'item-2a',
            transactionId: 'tx-2',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(100000, 'IDR'),
          }),
          new TransactionItem({
            id: 'item-2b',
            transactionId: 'tx-2',
            categoryId: 'cat-trans',
            amount: Money.fromDecimal(50000, 'IDR'),
          }),
        ],
      })
    );

    // 3. Income Gaji Rp 5.000.000 to BCA on 2026-08-15
    await txRepo.create(
      new Transaction({
        id: 'tx-3',
        userId,
        type: 'income',
        amount: Money.fromDecimal(5000000, 'IDR'),
        destinationAccountId: 'acc-bca',
        transactionDate: '2026-08-15',
        note: 'Gaji Pokok',
        items: [
          new TransactionItem({
            id: 'item-3',
            transactionId: 'tx-3',
            categoryId: 'cat-sal',
            amount: Money.fromDecimal(5000000, 'IDR'),
          }),
        ],
      })
    );

    // 4. Transfer BCA to GoPay Rp 200.000 on 2026-08-17
    await txRepo.create(
      new Transaction({
        id: 'tx-4',
        userId,
        type: 'transfer',
        amount: Money.fromDecimal(200000, 'IDR'),
        sourceAccountId: 'acc-bca',
        destinationAccountId: 'acc-gopay',
        transactionDate: '2026-08-17',
        note: 'Top up GoPay mingguan',
      })
    );

    // 5. Opening balance BCA on 2026-08-01
    await txRepo.create(
      new Transaction({
        id: 'tx-5',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(10000000, 'IDR'),
        destinationAccountId: 'acc-bca',
        transactionDate: '2026-08-01',
      })
    );

    // 6. Another user's transaction for isolation testing
    await txRepo.create(
      new Transaction({
        id: 'tx-other',
        userId: otherUserId,
        type: 'expense',
        amount: Money.fromDecimal(99999, 'IDR'),
        sourceAccountId: 'acc-bca',
        transactionDate: '2026-08-19',
        note: 'Makan Padang Intruksi',
        items: [
          new TransactionItem({
            id: 'item-other',
            transactionId: 'tx-other',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(99999, 'IDR'),
          }),
        ],
      })
    );
  });

  it('should search transactions by note text', async () => {
    const res = await txRepo.list({ userId, search: 'Rendang' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('tx-1');
  });

  it('should search transactions by account name', async () => {
    const res = await txRepo.list({ userId, search: 'GoPay' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    // tx-2 (source GoPay) and tx-4 (destination GoPay)
    expect(res.data.length).toBe(2);
    expect(res.data.map((t) => t.id)).toContain('tx-2');
    expect(res.data.map((t) => t.id)).toContain('tx-4');
  });

  it('should search transactions by category name', async () => {
    const res = await txRepo.list({ userId, search: 'Transportasi' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('tx-2');
  });

  it('should filter transactions by transaction type', async () => {
    const res = await txRepo.list({ userId, type: 'transfer' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('tx-4');
    expect(res.data[0].type).toBe('transfer');
  });

  it('should filter transactions by specific category ID', async () => {
    const res = await txRepo.list({ userId, categoryId: 'cat-food' });
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(2);
    expect(res.data.map((t) => t.id)).toContain('tx-1');
    expect(res.data.map((t) => t.id)).toContain('tx-2');
  });

  it('should filter transactions by date range', async () => {
    const res = await txRepo.list({
      userId,
      startDate: '2026-08-16',
      endDate: '2026-08-18',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;

    // Should include tx-2 (2026-08-18) and tx-4 (2026-08-17)
    expect(res.data.length).toBe(2);
    expect(res.data[0].id).toBe('tx-2');
    expect(res.data[1].id).toBe('tx-4');
  });

  it('should apply limit and offset pagination deterministically', async () => {
    const page1 = await txRepo.list({ userId, limit: 2, offset: 0 });
    const page2 = await txRepo.list({ userId, limit: 2, offset: 2 });

    expect(page1.success && page1.data.length).toBe(2);
    expect(page2.success && page2.data.length).toBe(2);

    if (page1.success && page2.success) {
      // Must not have overlapping IDs between pages
      const page1Ids = page1.data.map((t) => t.id);
      const page2Ids = page2.data.map((t) => t.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    }
  });

  it('should enforce user isolation and exclude other users transactions', async () => {
    const res = await txRepo.list({ userId });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.some((t) => t.id === 'tx-other')).toBe(false);
    }
  });

  it('should exclude soft-deleted transactions from list', async () => {
    await txRepo.softDelete('tx-1', userId);

    const res = await txRepo.list({ userId });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.some((t) => t.id === 'tx-1')).toBe(false);
    }
  });
});
