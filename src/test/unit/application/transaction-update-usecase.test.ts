import {
  UpdateTransactionUseCase,
  GetAccountBalanceUseCase,
} from '@/features/transactions/application/transaction.usecases';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SevenDayCorrectionPolicy } from '@/features/transactions/domain/policies/correction-window-policy';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';
import { MockClock } from '../../mocks/mock-clock';

describe('UpdateTransactionUseCase Application Tests', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let mockClock: MockClock;
  let policy: SevenDayCorrectionPolicy;
  let updateUseCase: UpdateTransactionUseCase;
  let getBalanceUseCase: GetAccountBalanceUseCase;

  const userId = 'user-app-update-1';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    txRepo = new SqliteTransactionRepository(async () => testDb.getDb());
    accountRepo = new SqliteAccountRepository(async () => testDb.getDb());
    categoryRepo = new SqliteCategoryRepository(async () => testDb.getDb());

    // Reference time: 2026-08-19T12:00:00Z
    mockClock = new MockClock(new Date('2026-08-19T12:00:00.000Z'));
    policy = new SevenDayCorrectionPolicy(mockClock, 'transaction_date');

    updateUseCase = new UpdateTransactionUseCase(
      txRepo,
      accountRepo,
      categoryRepo,
      policy,
      { generate: () => 'item-uuid-1', isValid: () => true }
    );
    getBalanceUseCase = new GetAccountBalanceUseCase(txRepo);

    // Seed master accounts and categories
    await accountRepo.create(
      new Account({ id: 'acc-cash', userId, name: 'Tunai', type: 'cash', currencyCode: 'IDR' })
    );
    await accountRepo.create(
      new Account({ id: 'acc-bank', userId, name: 'BCA', type: 'bank', currencyCode: 'IDR' })
    );
    await categoryRepo.create(
      new Category({ id: 'cat-food', userId, name: 'Makanan', type: 'expense' })
    );
    await categoryRepo.create(
      new Category({ id: 'cat-salary', userId, name: 'Gaji', type: 'income' })
    );
  });

  it('should update expense amount and automatically update derived account balance', async () => {
    // 1. Initial Opening Balance Rp 100.000
    await txRepo.create(
      new Transaction({
        id: 'tx-ob-1',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(100000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: 'acc-cash',
      })
    );

    // 2. Initial Expense Rp 30.000 (Balance becomes Rp 70.000)
    await txRepo.create(
      new Transaction({
        id: 'tx-exp-1',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(30000, 'IDR'),
        transactionDate: '2026-08-19',
        sourceAccountId: 'acc-cash',
        items: [
          new TransactionItem({
            id: 'it-1',
            transactionId: 'tx-exp-1',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(30000, 'IDR'),
          }),
        ],
      })
    );

    const initialBalRes = await getBalanceUseCase.execute('acc-cash', userId);
    expect(initialBalRes.success).toBe(true);
    if (initialBalRes.success) {
      expect(initialBalRes.data.minorUnits).toBe(7000000n);
    }

    // 3. Update Expense to Rp 50.000 (Balance should automatically become Rp 50.000)
    const updateRes = await updateUseCase.execute({
      id: 'tx-exp-1',
      userId,
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        {
          categoryId: 'cat-food',
          amount: Money.fromDecimal(50000, 'IDR'),
          note: 'Makan Siang Jumbo',
        },
      ],
      note: 'Update porsi makan',
    });

    expect(updateRes.success).toBe(true);

    const newBalRes = await getBalanceUseCase.execute('acc-cash', userId);
    expect(newBalRes.success).toBe(true);
    if (newBalRes.success) {
      expect(newBalRes.data.minorUnits).toBe(5000000n);
    }
  });

  it('should reject editing opening balance transaction', async () => {
    await txRepo.create(
      new Transaction({
        id: 'tx-ob-lock',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(500000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: 'acc-cash',
      })
    );

    const result = await updateUseCase.execute({
      id: 'tx-ob-lock',
      userId,
      amount: Money.fromDecimal(600000, 'IDR'),
      transactionDate: '2026-08-19',
      destinationAccountId: 'acc-cash',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Saldo Awal');
    }
  });

  it('should reject editing transaction older than 7 days', async () => {
    await txRepo.create(
      new Transaction({
        id: 'tx-old-1',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(20000, 'IDR'),
        transactionDate: '2026-08-10', // 9 days before reference time Aug 19
        sourceAccountId: 'acc-cash',
        items: [
          new TransactionItem({
            id: 'it-old-1',
            transactionId: 'tx-old-1',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(20000, 'IDR'),
          }),
        ],
      })
    );

    const result = await updateUseCase.execute({
      id: 'tx-old-1',
      userId,
      amount: Money.fromDecimal(25000, 'IDR'),
      transactionDate: '2026-08-10',
      sourceAccountId: 'acc-cash',
      items: [
        {
          categoryId: 'cat-food',
          amount: Money.fromDecimal(25000, 'IDR'),
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.name).toBe('CorrectionWindowExpiredError');
    }
  });

  it('should reject editing with category type mismatch (e.g. Income category on Expense transaction)', async () => {
    await txRepo.create(
      new Transaction({
        id: 'tx-exp-cat-test',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(50000, 'IDR'),
        transactionDate: '2026-08-19',
        sourceAccountId: 'acc-cash',
        items: [
          new TransactionItem({
            id: 'it-cat-1',
            transactionId: 'tx-exp-cat-test',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(50000, 'IDR'),
          }),
        ],
      })
    );

    const result = await updateUseCase.execute({
      id: 'tx-exp-cat-test',
      userId,
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [
        {
          categoryId: 'cat-salary', // Income category on Expense transaction
          amount: Money.fromDecimal(50000, 'IDR'),
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('tidak cocok untuk transaksi expense');
    }
  });

  it('should reject editing transaction belonging to another user', async () => {
    await txRepo.create(
      new Transaction({
        id: 'tx-user2',
        userId: 'other-user',
        type: 'expense',
        amount: Money.fromDecimal(10000, 'IDR'),
        transactionDate: '2026-08-19',
        sourceAccountId: 'acc-cash',
        items: [
          new TransactionItem({
            id: 'it-u2',
            transactionId: 'tx-user2',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(10000, 'IDR'),
          }),
        ],
      })
    );

    const result = await updateUseCase.execute({
      id: 'tx-user2',
      userId, // different user
      amount: Money.fromDecimal(15000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-cash',
      items: [{ categoryId: 'cat-food', amount: Money.fromDecimal(15000, 'IDR') }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.name).toBe('NotFoundError');
    }
  });
});
