import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  CreateExpenseUseCase,
  CreateIncomeUseCase,
  CreateTransferUseCase,
  GetAccountBalanceUseCase,
  GetTotalNetWorthUseCase,
} from '@/features/transactions/application/transaction.usecases';
import { EnsureDefaultCategoriesUseCase } from '@/features/categories/application/category.usecases';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Transaction } from '@/features/transactions/domain/transaction';
import { Money } from '@/core/domain/money';
import { MockUuidGenerator } from '../../mocks/mock-uuid-generator';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('Phase 1D — Transaction Creation Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let uuidGen: MockUuidGenerator;

  let createExpense: CreateExpenseUseCase;
  let createIncome: CreateIncomeUseCase;
  let createTransfer: CreateTransferUseCase;
  let getBalance: GetAccountBalanceUseCase;
  let getNetWorth: GetTotalNetWorthUseCase;
  let ensureCategories: EnsureDefaultCategoriesUseCase;

  const userId = 'user-fin-101';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    txRepo = new SqliteTransactionRepository(getDb);
    accountRepo = new SqliteAccountRepository(getDb);
    categoryRepo = new SqliteCategoryRepository(getDb);
    uuidGen = new MockUuidGenerator();

    createExpense = new CreateExpenseUseCase(txRepo, uuidGen);
    createIncome = new CreateIncomeUseCase(txRepo, uuidGen);
    createTransfer = new CreateTransferUseCase(txRepo, uuidGen);
    getBalance = new GetAccountBalanceUseCase(txRepo);
    getNetWorth = new GetTotalNetWorthUseCase(txRepo);
    ensureCategories = new EnsureDefaultCategoriesUseCase(categoryRepo, uuidGen);

    // Setup initial accounts
    await accountRepo.create(
      new Account({ id: 'acc-bca', userId, name: 'BCA', type: 'bank' })
    );
    await accountRepo.create(
      new Account({ id: 'acc-gopay', userId, name: 'GoPay', type: 'ewallet' })
    );

    // Setup initial opening balances
    // BCA: Rp 5.000.000, GoPay: Rp 500.000
    await txRepo.create(
      new Transaction({
        id: 'tx-op-bca',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(5000000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: 'acc-bca',
        sourceAccountId: null,
        items: [],
        note: 'Opening balance BCA',
      })
    );

    await txRepo.create(
      new Transaction({
        id: 'tx-op-gopay',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(500000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: 'acc-gopay',
        sourceAccountId: null,
        items: [],
        note: 'Opening balance GoPay',
      })
    );
  });

  describe('EnsureDefaultCategoriesUseCase', () => {
    it('should seed standard default categories when categories are empty', async () => {
      const seedResult = await ensureCategories.execute(userId);
      expect(seedResult.success).toBe(true);
      if (!seedResult.success) return;

      expect(seedResult.data.length).toBeGreaterThan(0);

      // Verify category repository contains seeded categories
      const list = await categoryRepo.listByUser(userId);
      expect(list.success).toBe(true);
      if (list.success) {
        expect(list.data.length).toBe(seedResult.data.length);
        expect(list.data.some((c) => c.name === 'Makanan & Minuman')).toBe(true);
        expect(list.data.some((c) => c.name === 'Gaji Bulanan')).toBe(true);
      }
    });

    it('should be idempotent and not duplicate categories on repeated execution', async () => {
      await ensureCategories.execute(userId);
      const secondRun = await ensureCategories.execute(userId);
      expect(secondRun.success).toBe(true);

      const list = await categoryRepo.listByUser(userId);
      if (list.success) {
        const foodCats = list.data.filter((c) => c.name === 'Makanan & Minuman');
        expect(foodCats.length).toBe(1);
      }
    });
  });

  describe('CreateExpenseUseCase', () => {
    it('should record an expense with multiple category splits and reduce derived account balance', async () => {
      // Create categories
      const foodCat = new Category({ id: 'cat-food', userId, name: 'Makanan', type: 'expense' });
      const transCat = new Category({ id: 'cat-trans', userId, name: 'Transport', type: 'expense' });
      await categoryRepo.create(foodCat);
      await categoryRepo.create(transCat);

      // Initial GoPay balance: Rp 500.000
      const initialBal = await getBalance.execute('acc-gopay', userId);
      expect(initialBal.success && initialBal.data.toDecimal()).toBe(500000);

      // Record Expense: Rp 150.000 (Food: Rp 100.000, Transport: Rp 50.000)
      const expenseResult = await createExpense.execute({
        userId,
        amount: Money.fromDecimal(150000, 'IDR'),
        sourceAccountId: 'acc-gopay',
        transactionDate: '2026-08-19',
        items: [
          { categoryId: 'cat-food', amount: Money.fromDecimal(100000, 'IDR') },
          { categoryId: 'cat-trans', amount: Money.fromDecimal(50000, 'IDR') },
        ],
        note: 'Makan siang & ojek',
      });

      expect(expenseResult.success).toBe(true);

      // Verify GoPay balance decreased: 500.000 - 150.000 = Rp 350.000
      const updatedBal = await getBalance.execute('acc-gopay', userId);
      expect(updatedBal.success && updatedBal.data.toDecimal()).toBe(350000);

      // Verify Total Net Worth decreased: 5.500.000 - 150.000 = Rp 5.350.000
      const netWorth = await getNetWorth.execute(userId);
      expect(netWorth.success && netWorth.data.toDecimal()).toBe(5350000);

      // Verify outbox entry created
      const outboxTable = testDb.tables.get('outbox') ?? [];
      expect(outboxTable.some((o) => o.operation_type === 'CREATE_TRANSACTION')).toBe(true);
    });

    it('should reject expense when sum of category splits does not equal total transaction amount', async () => {
      const foodCat = new Category({ id: 'cat-food', userId, name: 'Makanan', type: 'expense' });
      await categoryRepo.create(foodCat);

      // Total is Rp 100.000 but split is only Rp 80.000
      const invalidResult = await createExpense.execute({
        userId,
        amount: Money.fromDecimal(100000, 'IDR'),
        sourceAccountId: 'acc-gopay',
        items: [{ categoryId: 'cat-food', amount: Money.fromDecimal(80000, 'IDR') }],
      });

      expect(invalidResult.success).toBe(false);
    });
  });

  describe('CreateIncomeUseCase', () => {
    it('should record income and increase derived destination account balance and Net Worth', async () => {
      const salaryCat = new Category({ id: 'cat-sal', userId, name: 'Gaji', type: 'income' });
      await categoryRepo.create(salaryCat);

      // Initial BCA balance: Rp 5.000.000
      const incomeResult = await createIncome.execute({
        userId,
        amount: Money.fromDecimal(3000000, 'IDR'),
        destinationAccountId: 'acc-bca',
        transactionDate: '2026-08-19',
        items: [{ categoryId: 'cat-sal', amount: Money.fromDecimal(3000000, 'IDR') }],
        note: 'Gaji freelance',
      });

      expect(incomeResult.success).toBe(true);

      // Verify BCA balance increased: 5.000.000 + 3.000.000 = Rp 8.000.000
      const updatedBal = await getBalance.execute('acc-bca', userId);
      expect(updatedBal.success && updatedBal.data.toDecimal()).toBe(8000000);

      // Verify Net Worth increased: 5.500.000 + 3.000.000 = Rp 8.500.000
      const netWorth = await getNetWorth.execute(userId);
      expect(netWorth.success && netWorth.data.toDecimal()).toBe(8500000);
    });
  });

  describe('CreateTransferUseCase', () => {
    it('should transfer Rp 500.000 from BCA to GoPay, updating individual balances while keeping Net Worth neutral', async () => {
      // Pre-transfer: BCA = 5.000.000, GoPay = 500.000, Net Worth = 5.500.000
      const transferResult = await createTransfer.execute({
        userId,
        amount: Money.fromDecimal(500000, 'IDR'),
        sourceAccountId: 'acc-bca',
        destinationAccountId: 'acc-gopay',
        transactionDate: '2026-08-19',
        note: 'Topup GoPay dari BCA',
      });

      expect(transferResult.success).toBe(true);

      // BCA: 5.000.000 - 500.000 = Rp 4.500.000
      const bcaBal = await getBalance.execute('acc-bca', userId);
      expect(bcaBal.success && bcaBal.data.toDecimal()).toBe(4500000);

      // GoPay: 500.000 + 500.000 = Rp 1.000.000
      const gopayBal = await getBalance.execute('acc-gopay', userId);
      expect(gopayBal.success && gopayBal.data.toDecimal()).toBe(1000000);

      // Net Worth: 4.500.000 + 1.000.000 = Rp 5.500.000 (Exactly Unchanged)
      const netWorth = await getNetWorth.execute(userId);
      expect(netWorth.success && netWorth.data.toDecimal()).toBe(5500000);
    });

    it('should reject transfer when source and destination accounts are identical', async () => {
      const sameAccResult = await createTransfer.execute({
        userId,
        amount: Money.fromDecimal(100000, 'IDR'),
        sourceAccountId: 'acc-bca',
        destinationAccountId: 'acc-bca',
      });

      expect(sameAccResult.success).toBe(false);
    });
  });

  describe('Rollback Atomicity & Offline Persistence', () => {
    it('should rollback cleanly if database failure occurs during transaction persistence', async () => {
      const foodCat = new Category({ id: 'cat-food', userId, name: 'Makanan', type: 'expense' });
      await categoryRepo.create(foodCat);

      testDb.failNextRun = true;
      testDb.failNextRunMessage = 'Simulated disk I/O error';

      const result = await createExpense.execute({
        userId,
        amount: Money.fromDecimal(100000, 'IDR'),
        sourceAccountId: 'acc-gopay',
        items: [{ categoryId: 'cat-food', amount: Money.fromDecimal(100000, 'IDR') }],
      });

      expect(result.success).toBe(false);

      // Verify no orphan transaction items or corrupt outbox rows
      const itemsTable = testDb.tables.get('transaction_items') ?? [];
      expect(itemsTable.length).toBe(0);
    });
  });
});
