import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { CreateAccountUseCase } from '@/features/accounts/application/account.usecases';
import { CreateCategoryUseCase } from '@/features/categories/application/category.usecases';
import {
  CreateTransactionUseCase,
  GetAccountBalanceUseCase,
  GetTotalNetWorthUseCase,
  SoftDeleteTransactionUseCase,
} from '@/features/transactions/application/transaction.usecases';
import { SevenDayCorrectionPolicy } from '@/features/transactions/domain/policies/correction-window-policy';
import { Money } from '@/core/domain/money';
import { MockUuidGenerator } from '../../mocks/mock-uuid-generator';
import { MockClock } from '../../mocks/mock-clock';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('Ledger Application Use Cases Integration', () => {
  let testDb: InMemoryTestDb;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let txRepo: SqliteTransactionRepository;
  let uuidGen: MockUuidGenerator;
  let clock: MockClock;
  let correctionPolicy: SevenDayCorrectionPolicy;

  let createAccount: CreateAccountUseCase;
  let createCategory: CreateCategoryUseCase;
  let createTransaction: CreateTransactionUseCase;
  let getBalance: GetAccountBalanceUseCase;
  let getNetWorth: GetTotalNetWorthUseCase;
  let deleteTransaction: SoftDeleteTransactionUseCase;

  const userId = 'user-test-123';

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    accountRepo = new SqliteAccountRepository(getDb);
    categoryRepo = new SqliteCategoryRepository(getDb);
    txRepo = new SqliteTransactionRepository(getDb);
    uuidGen = new MockUuidGenerator();
    clock = new MockClock(new Date('2026-08-19T12:00:00.000Z'));
    correctionPolicy = new SevenDayCorrectionPolicy(clock, 'transaction_date');

    createAccount = new CreateAccountUseCase(accountRepo, uuidGen);
    createCategory = new CreateCategoryUseCase(categoryRepo, uuidGen);
    createTransaction = new CreateTransactionUseCase(txRepo, uuidGen);
    getBalance = new GetAccountBalanceUseCase(txRepo);
    getNetWorth = new GetTotalNetWorthUseCase(txRepo);
    deleteTransaction = new SoftDeleteTransactionUseCase(txRepo, correctionPolicy);
  });

  it('should execute end-to-end ledger workflow offline with derived balances', async () => {
    // 1. Create Accounts
    const accAResult = await createAccount.execute({
      userId,
      name: 'Rekening BCA',
      type: 'bank',
    });
    expect(accAResult.success).toBe(true);
    if (!accAResult.success) return;
    const accA = accAResult.data;

    const accBResult = await createAccount.execute({
      userId,
      name: 'Dompet Tunai',
      type: 'cash',
    });
    expect(accBResult.success).toBe(true);
    if (!accBResult.success) return;
    const accB = accBResult.data;

    // 2. Create Categories
    const catFoodResult = await createCategory.execute({
      userId,
      name: 'Makanan',
      type: 'expense',
    });
    expect(catFoodResult.success).toBe(true);
    if (!catFoodResult.success) return;
    const catFood = catFoodResult.data;

    const catSalaryResult = await createCategory.execute({
      userId,
      name: 'Gaji',
      type: 'income',
    });
    expect(catSalaryResult.success).toBe(true);
    if (!catSalaryResult.success) return;
    const catSalary = catSalaryResult.data;

    // 3. Opening Balance: Rp 1.000.000 into Account A
    const tx1 = await createTransaction.execute({
      userId,
      type: 'opening_balance',
      amount: Money.fromDecimal(1000000, 'IDR'),
      transactionDate: '2026-08-15',
      destinationAccountId: accA.id,
    });
    expect(tx1.success).toBe(true);

    // Initial Balance A: 1.000.000
    let balA = await getBalance.execute(accA.id, userId);
    expect(balA.success).toBe(true);
    if (balA.success) {
      expect(balA.data.toDecimal()).toBe(1000000);
    }

    // 4. Expense: Rp 100.000 from Account A
    const tx2 = await createTransaction.execute({
      userId,
      type: 'expense',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-16',
      sourceAccountId: accA.id,
      items: [
        {
          categoryId: catFood.id,
          amount: Money.fromDecimal(100000, 'IDR'),
        },
      ],
    });
    expect(tx2.success).toBe(true);

    // Balance A: 900.000
    balA = await getBalance.execute(accA.id, userId);
    expect(balA.success).toBe(true);
    if (balA.success) {
      expect(balA.data.toDecimal()).toBe(900000);
    }

    // 5. Income: Rp 500.000 into Account A
    const tx3 = await createTransaction.execute({
      userId,
      type: 'income',
      amount: Money.fromDecimal(500000, 'IDR'),
      transactionDate: '2026-08-17',
      destinationAccountId: accA.id,
      items: [
        {
          categoryId: catSalary.id,
          amount: Money.fromDecimal(500000, 'IDR'),
        },
      ],
    });
    expect(tx3.success).toBe(true);

    // Balance A: 1.400.000
    balA = await getBalance.execute(accA.id, userId);
    expect(balA.success).toBe(true);
    if (balA.success) {
      expect(balA.data.toDecimal()).toBe(1400000);
    }

    // 6. Transfer: Rp 200.000 from Account A to Account B
    const tx4 = await createTransaction.execute({
      userId,
      type: 'transfer',
      amount: Money.fromDecimal(200000, 'IDR'),
      transactionDate: '2026-08-18',
      sourceAccountId: accA.id,
      destinationAccountId: accB.id,
    });
    expect(tx4.success).toBe(true);

    // Balance A: 1.200.000
    balA = await getBalance.execute(accA.id, userId);
    expect(balA.success).toBe(true);
    if (balA.success) {
      expect(balA.data.toDecimal()).toBe(1200000);
    }

    // Balance B: 200.000
    const balB = await getBalance.execute(accB.id, userId);
    expect(balB.success).toBe(true);
    if (balB.success) {
      expect(balB.data.toDecimal()).toBe(200000);
    }

    // Total Net Worth: 1.400.000
    const netWorth = await getNetWorth.execute(userId);
    expect(netWorth.success).toBe(true);
    if (netWorth.success) {
      expect(netWorth.data.toDecimal()).toBe(1400000);
    }

    // 7. Soft Delete Expense (tx2) -> Balance A should increase back to 1.300.000
    if (tx2.success) {
      const tx2Id = tx2.data.id;
      const deleteResult = await deleteTransaction.execute(tx2Id, userId);
      expect(deleteResult.success).toBe(true);

      balA = await getBalance.execute(accA.id, userId);
      expect(balA.success).toBe(true);
      if (balA.success) {
        expect(balA.data.toDecimal()).toBe(1300000);
      }

      const netWorthAfterDelete = await getNetWorth.execute(userId);
      expect(netWorthAfterDelete.success).toBe(true);
      if (netWorthAfterDelete.success) {
        expect(netWorthAfterDelete.data.toDecimal()).toBe(1500000);
      }
    }
  });

  it('should reject deleting transaction outside seven-day correction window', async () => {
    // Transaction date is 2026-08-01 (18 days before clock date 2026-08-19)
    const oldTx = await createTransaction.execute({
      userId,
      type: 'opening_balance',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-01',
      destinationAccountId: 'acc-1',
    });

    expect(oldTx.success).toBe(true);
    if (!oldTx.success) return;

    const txId = oldTx.data.id;
    const deleteResult = await deleteTransaction.execute(txId, userId);

    expect(deleteResult.success).toBe(false);
    if (!deleteResult.success) {
      expect(deleteResult.error.code).toBe('CORRECTION_WINDOW_EXPIRED');
    }
  });
});
