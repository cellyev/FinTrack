import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { GetTransactionHistoryUseCase } from '@/features/transactions/application/transaction.usecases';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Account & Category Transaction Streams Use Case & Data Integrity', () => {
  let inMemoryDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accRepo: SqliteAccountRepository;
  let catRepo: SqliteCategoryRepository;
  let getTxHistoryUseCase: GetTransactionHistoryUseCase;

  const testUserId = 'test-user-streams-1';

  beforeEach(async () => {
    inMemoryDb = new InMemoryTestDb();
    const getDb = async () => inMemoryDb.getDb();
    txRepo = new SqliteTransactionRepository(getDb);
    accRepo = new SqliteAccountRepository(getDb);
    catRepo = new SqliteCategoryRepository(getDb);

    getTxHistoryUseCase = new GetTransactionHistoryUseCase(txRepo, accRepo, catRepo);

    // Setup 2 accounts: Bank & Cash
    await accRepo.create(
      new Account({
        id: 'acc-bank-1',
        userId: testUserId,
        name: 'BCA Rekening',
        type: 'bank',
        color: '#0055A5',
      })
    );
    await accRepo.create(
      new Account({
        id: 'acc-cash-1',
        userId: testUserId,
        name: 'Dompet Tunai',
        type: 'cash',
        color: '#008A00',
      })
    );

    // Setup 2 categories: Makanan & Transportasi
    await catRepo.create(
      new Category({
        id: 'cat-food-1',
        userId: testUserId,
        name: 'Makanan & Minuman',
        type: 'expense',
        icon: '🍔',
        color: '#E60012',
      })
    );
    await catRepo.create(
      new Category({
        id: 'cat-transport-1',
        userId: testUserId,
        name: 'Transportasi',
        type: 'expense',
        icon: '🚗',
        color: '#118EEA',
      })
    );
  });

  describe('Account Transaction Stream', () => {
    it('should return empty list when account has no transactions', async () => {
      const result = await getTxHistoryUseCase.execute({
        userId: testUserId,
        accountId: 'acc-bank-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(0);
      }
    });

    it('should include transactions where account is source or destination', async () => {
      // 1. Expense from Bank
      await txRepo.create(
        new Transaction({
          id: 'tx-exp-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-bank-1',
          items: [
            new TransactionItem({
              id: 'ti-1',
              transactionId: 'tx-exp-1',
              categoryId: 'cat-food-1',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        })
      );

      // 2. Transfer from Bank to Cash
      await txRepo.create(
        new Transaction({
          id: 'tx-trf-1',
          userId: testUserId,
          type: 'transfer',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-bank-1',
          destinationAccountId: 'acc-cash-1',
          items: [],
        })
      );

      // Query Bank account stream (should have both)
      const bankResult = await getTxHistoryUseCase.execute({
        userId: testUserId,
        accountId: 'acc-bank-1',
      });

      expect(bankResult.success).toBe(true);
      if (bankResult.success) {
        expect(bankResult.data.items).toHaveLength(2);
      }

      // Query Cash account stream (should have only the transfer destination)
      const cashResult = await getTxHistoryUseCase.execute({
        userId: testUserId,
        accountId: 'acc-cash-1',
      });

      expect(cashResult.success).toBe(true);
      if (cashResult.success) {
        expect(cashResult.data.items).toHaveLength(1);
        expect(cashResult.data.items[0].id).toBe('tx-trf-1');
      }
    });

    it('should exclude soft-deleted transactions from account stream', async () => {
      const tx = new Transaction({
        id: 'tx-del-1',
        userId: testUserId,
        type: 'expense',
        amount: Money.fromDecimal(20000, 'IDR'),
        transactionDate: '2026-08-20',
        sourceAccountId: 'acc-bank-1',
        items: [
          new TransactionItem({
            id: 'ti-del-1',
            transactionId: 'tx-del-1',
            categoryId: 'cat-food-1',
            amount: Money.fromDecimal(20000, 'IDR'),
          }),
        ],
      });
      await txRepo.create(tx);

      // Soft delete
      await txRepo.softDelete('tx-del-1', testUserId);

      const result = await getTxHistoryUseCase.execute({
        userId: testUserId,
        accountId: 'acc-bank-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(0);
      }
    });
  });

  describe('Category Transaction Stream (including Splits)', () => {
    it('should find transactions by direct category and by multi-split category allocation', async () => {
      // 1. Single category transaction (Makanan)
      await txRepo.create(
        new Transaction({
          id: 'tx-single-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(30000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-bank-1',
          items: [
            new TransactionItem({
              id: 'ti-single-1',
              transactionId: 'tx-single-1',
              categoryId: 'cat-food-1',
              amount: Money.fromDecimal(30000, 'IDR'),
            }),
          ],
        })
      );

      // 2. Split transaction (Makanan 50.000 + Transportasi 25.000)
      await txRepo.create(
        new Transaction({
          id: 'tx-split-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(75000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-cash-1',
          items: [
            new TransactionItem({
              id: 'ti-split-food',
              transactionId: 'tx-split-1',
              categoryId: 'cat-food-1',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
            new TransactionItem({
              id: 'ti-split-trans',
              transactionId: 'tx-split-1',
              categoryId: 'cat-transport-1',
              amount: Money.fromDecimal(25000, 'IDR'),
            }),
          ],
        })
      );

      // Query Makanan category stream (should return BOTH tx-single-1 and tx-split-1)
      const foodResult = await getTxHistoryUseCase.execute({
        userId: testUserId,
        categoryId: 'cat-food-1',
      });

      expect(foodResult.success).toBe(true);
      if (foodResult.success) {
        expect(foodResult.data.items).toHaveLength(2);
      }

      // Query Transportasi category stream (should return only tx-split-1)
      const transResult = await getTxHistoryUseCase.execute({
        userId: testUserId,
        categoryId: 'cat-transport-1',
      });

      expect(transResult.success).toBe(true);
      if (transResult.success) {
        expect(transResult.data.items).toHaveLength(1);
        expect(transResult.data.items[0].id).toBe('tx-split-1');
      }
    });

    it('should exclude soft-deleted transactions from category stream', async () => {
      const tx = new Transaction({
        id: 'tx-food-del',
        userId: testUserId,
        type: 'expense',
        amount: Money.fromDecimal(15000, 'IDR'),
        transactionDate: '2026-08-20',
        sourceAccountId: 'acc-bank-1',
        items: [
          new TransactionItem({
            id: 'ti-food-del',
            transactionId: 'tx-food-del',
            categoryId: 'cat-food-1',
            amount: Money.fromDecimal(15000, 'IDR'),
          }),
        ],
      });
      await txRepo.create(tx);
      await txRepo.softDelete('tx-food-del', testUserId);

      const result = await getTxHistoryUseCase.execute({
        userId: testUserId,
        categoryId: 'cat-food-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(0);
      }
    });
  });
});
