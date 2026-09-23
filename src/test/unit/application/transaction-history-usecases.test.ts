import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetTransactionHistoryUseCase,
  GetTransactionDetailUseCase,
  GetRecentTransactionsUseCase,
  groupTransactionsByDate,
  TransactionListItemDTO,
} from '@/features/transactions/application/transaction.usecases';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('Transaction History & Detail Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;

  let getHistory: GetTransactionHistoryUseCase;
  let getDetail: GetTransactionDetailUseCase;
  let getRecent: GetRecentTransactionsUseCase;

  const userId = 'user-hist-usecase-1';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    txRepo = new SqliteTransactionRepository(getDb);
    accountRepo = new SqliteAccountRepository(getDb);
    categoryRepo = new SqliteCategoryRepository(getDb);

    getHistory = new GetTransactionHistoryUseCase(txRepo, accountRepo, categoryRepo);
    getDetail = new GetTransactionDetailUseCase(txRepo, accountRepo, categoryRepo);
    getRecent = new GetRecentTransactionsUseCase(txRepo, accountRepo, categoryRepo);

    // Seed master accounts
    await accountRepo.create(new Account({ id: 'acc-bca', userId, name: 'BCA Utama', type: 'bank', color: '#0055A5' }));
    await accountRepo.create(new Account({ id: 'acc-gopay', userId, name: 'GoPay', type: 'ewallet', color: '#008A00' }));

    // Seed master categories
    await categoryRepo.create(new Category({ id: 'cat-food', userId, name: 'Makanan & Minuman', type: 'expense', color: '#FF5722' }));
    await categoryRepo.create(new Category({ id: 'cat-trans', userId, name: 'Transportasi', type: 'expense', color: '#03A9F4' }));
    await categoryRepo.create(new Category({ id: 'cat-sal', userId, name: 'Gaji Bulanan', type: 'income', color: '#2E7D32' }));
  });

  describe('groupTransactionsByDate Pure Function', () => {
    it('should format date headers into "Hari ini", "Kemarin", and standard Indonesian day formats', () => {
      const mockNow = new Date(2026, 7, 19); // 19 August 2026

      const sampleItems: TransactionListItemDTO[] = [
        {
          id: '1',
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          createdAt: new Date(),
          categorySummary: 'Makanan & Minuman',
          categoryCount: 1,
        },
        {
          id: '2',
          type: 'income',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-18',
          createdAt: new Date(),
          categorySummary: 'Gaji Bulanan',
          categoryCount: 1,
        },
        {
          id: '3',
          type: 'transfer',
          amount: Money.fromDecimal(200000, 'IDR'),
          transactionDate: '2026-08-15',
          createdAt: new Date(),
          categorySummary: 'Transfer Antar-Akun',
          categoryCount: 0,
        },
        {
          id: '4',
          type: 'expense',
          amount: Money.fromDecimal(30000, 'IDR'),
          transactionDate: '2025-12-25',
          createdAt: new Date(),
          categorySummary: 'Makanan & Minuman',
          categoryCount: 1,
        },
      ];

      const groups = groupTransactionsByDate(sampleItems, mockNow);
      expect(groups.length).toBe(4);

      expect(groups[0].dateHeader).toBe('Hari ini');
      expect(groups[0].rawDate).toBe('2026-08-19');

      expect(groups[1].dateHeader).toBe('Kemarin');
      expect(groups[1].rawDate).toBe('2026-08-18');

      // Same year (2026) -> e.g. "Sabtu, 15 Agustus"
      expect(groups[2].dateHeader.toLowerCase()).toContain('agustus');
      expect(groups[2].rawDate).toBe('2026-08-15');

      // Different year (2025) -> "25 Desember 2025"
      expect(groups[3].dateHeader).toContain('2025');
    });
  });

  describe('GetTransactionHistoryUseCase', () => {
    it('should map single category and multi-category splits correctly in history DTOs', async () => {
      // 1. Single split expense
      await txRepo.create(
        new Transaction({
          id: 'tx-single',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          sourceAccountId: 'acc-bca',
          transactionDate: '2026-08-19',
          items: [
            new TransactionItem({
              id: 'i-1',
              transactionId: 'tx-single',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        })
      );

      // 2. Multi-split expense (2 categories)
      await txRepo.create(
        new Transaction({
          id: 'tx-multi',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(150000, 'IDR'),
          sourceAccountId: 'acc-gopay',
          transactionDate: '2026-08-19',
          items: [
            new TransactionItem({
              id: 'i-2a',
              transactionId: 'tx-multi',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(100000, 'IDR'),
            }),
            new TransactionItem({
              id: 'i-2b',
              transactionId: 'tx-multi',
              categoryId: 'cat-trans',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        })
      );

      const historyResult = await getHistory.execute({ userId });
      expect(historyResult.success).toBe(true);
      if (!historyResult.success) return;

      const singleDto = historyResult.data.items.find((i) => i.id === 'tx-single');
      expect(singleDto?.categorySummary).toBe('Makanan & Minuman');
      expect(singleDto?.categoryCount).toBe(1);

      const multiDto = historyResult.data.items.find((i) => i.id === 'tx-multi');
      expect(multiDto?.categorySummary).toBe('Makanan & Minuman (+1)');
      expect(multiDto?.categoryCount).toBe(2);
    });
  });

  describe('GetTransactionDetailUseCase', () => {
    it('should return full transaction details including all splits and account details', async () => {
      await txRepo.create(
        new Transaction({
          id: 'tx-detail-test',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(150000, 'IDR'),
          sourceAccountId: 'acc-bca',
          transactionDate: '2026-08-19',
          note: 'Belanja bulanan',
          items: [
            new TransactionItem({
              id: 'item-d1',
              transactionId: 'tx-detail-test',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(100000, 'IDR'),
              note: 'Sayur & buah',
            }),
            new TransactionItem({
              id: 'item-d2',
              transactionId: 'tx-detail-test',
              categoryId: 'cat-trans',
              amount: Money.fromDecimal(50000, 'IDR'),
              note: 'Ongkir grab',
            }),
          ],
        })
      );

      const detailResult = await getDetail.execute('tx-detail-test', userId);
      expect(detailResult.success).toBe(true);
      if (!detailResult.success) return;

      const detail = detailResult.data;
      expect(detail.id).toBe('tx-detail-test');
      expect(detail.sourceAccount?.name).toBe('BCA Utama');
      expect(detail.items.length).toBe(2);
      expect(detail.items[0].categoryName).toBe('Makanan & Minuman');
      expect(detail.items[0].note).toBe('Sayur & buah');
      expect(detail.items[1].categoryName).toBe('Transportasi');
      expect(detail.totalSplitAmount.toDecimal()).toBe(150000);
      expect(detail.isFullyAllocated).toBe(true);
    });
  });

  describe('GetRecentTransactionsUseCase', () => {
    it('should return at most 5 recent transactions', async () => {
      // Create 8 transactions
      for (let i = 1; i <= 8; i++) {
        await txRepo.create(
          new Transaction({
            id: `tx-recent-${i}`,
            userId,
            type: 'expense',
            amount: Money.fromDecimal(10000 * i, 'IDR'),
            sourceAccountId: 'acc-bca',
            transactionDate: `2026-08-${10 + i}`,
            items: [
              new TransactionItem({
                id: `item-${i}`,
                transactionId: `tx-recent-${i}`,
                categoryId: 'cat-food',
                amount: Money.fromDecimal(10000 * i, 'IDR'),
              }),
            ],
          })
        );
      }

      const recentResult = await getRecent.execute(userId, 5);
      expect(recentResult.success).toBe(true);
      if (recentResult.success) {
        expect(recentResult.data.length).toBe(5);
        // Most recent first: 2026-08-18 -> tx-recent-8
        expect(recentResult.data[0].id).toBe('tx-recent-8');
      }
    });
  });
});
