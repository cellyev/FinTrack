import { GetMonthlyAnalyticsUseCase, getMonthDateRange } from '@/features/analytics/application/get-monthly-analytics.usecase';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SqliteBudgetRepository } from '@/features/budgets/data/sqlite-budget.repository';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Category } from '@/features/categories/domain/category';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('GetMonthlyAnalyticsUseCase & Analytics Calculations', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let catRepo: SqliteCategoryRepository;
  let budgetRepo: SqliteBudgetRepository;
  let useCase: GetMonthlyAnalyticsUseCase;

  const testUserId = 'test-user-analytics-1';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    txRepo = new SqliteTransactionRepository(getDb);
    catRepo = new SqliteCategoryRepository(getDb);
    budgetRepo = new SqliteBudgetRepository(getDb);

    useCase = new GetMonthlyAnalyticsUseCase(txRepo, catRepo, budgetRepo);

    // Create Categories
    await catRepo.create(
      new Category({
        id: 'cat-food',
        userId: testUserId,
        name: 'Makanan & Minuman',
        type: 'expense',
        icon: '🍔',
        color: '#E60012',
      })
    );
    await catRepo.create(
      new Category({
        id: 'cat-transport',
        userId: testUserId,
        name: 'Transportasi',
        type: 'expense',
        icon: '🚗',
        color: '#118EEA',
      })
    );
    await catRepo.create(
      new Category({
        id: 'cat-salary',
        userId: testUserId,
        name: 'Gaji Bulanan',
        type: 'income',
        icon: '💼',
        color: '#008A00',
      })
    );
  });

  describe('getMonthDateRange utility', () => {
    it('should compute start and end dates correctly for 31-day month', () => {
      const range = getMonthDateRange('2026-08');
      expect(range.startDate).toBe('2026-08-01');
      expect(range.endDate).toBe('2026-08-31');
      expect(range.previousPeriod).toBe('2026-07');
      expect(range.periodDisplay).toContain('Agustus');
      expect(range.periodDisplay).toContain('2026');
    });

    it('should handle leap year February (2024)', () => {
      const range = getMonthDateRange('2024-02');
      expect(range.startDate).toBe('2024-02-01');
      expect(range.endDate).toBe('2024-02-29');
      expect(range.previousPeriod).toBe('2024-01');
    });

    it('should handle non-leap year February (2026)', () => {
      const range = getMonthDateRange('2026-02');
      expect(range.startDate).toBe('2026-02-01');
      expect(range.endDate).toBe('2026-02-28');
    });

    it('should cross January to December boundary for previous month', () => {
      const range = getMonthDateRange('2026-01');
      expect(range.startDate).toBe('2026-01-01');
      expect(range.endDate).toBe('2026-01-31');
      expect(range.previousPeriod).toBe('2025-12');
    });
  });

  describe('Monthly Cashflow & Savings Rate', () => {
    it('should handle zero transactions safely without error', async () => {
      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cashflow.income.minorUnits).toBe(0n);
        expect(result.data.cashflow.expense.minorUnits).toBe(0n);
        expect(result.data.cashflow.netCashflow.minorUnits).toBe(0n);
        expect(result.data.cashflow.isNetPositive).toBe(true);
        expect(result.data.cashflow.savingsRatePercentage).toBe(0);
        expect(result.data.categories).toHaveLength(0);
      }
    });

    it('should calculate income, expenses, net cashflow, and savings rate', async () => {
      // Income: Rp 8.000.000 (800000000 minor units)
      await txRepo.create(
        new Transaction({
          id: 'tx-inc-1',
          userId: testUserId,
          type: 'income',
          amount: Money.fromDecimal(8000000, 'IDR'),
          transactionDate: '2026-08-05',
          destinationAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-inc-1',
              transactionId: 'tx-inc-1',
              categoryId: 'cat-salary',
              amount: Money.fromDecimal(8000000, 'IDR'),
            }),
          ],
        })
      );

      // Expense: Rp 5.500.000 (550000000 minor units)
      await txRepo.create(
        new Transaction({
          id: 'tx-exp-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(5500000, 'IDR'),
          transactionDate: '2026-08-10',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-1',
              transactionId: 'tx-exp-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(5500000, 'IDR'),
            }),
          ],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cashflow.income.toDecimal()).toBe(8000000);
        expect(result.data.cashflow.expense.toDecimal()).toBe(5500000);
        expect(result.data.cashflow.netCashflow.toDecimal()).toBe(2500000);
        expect(result.data.cashflow.isNetPositive).toBe(true);
        // (2.500.000 / 8.000.000) * 100 = 31.25% -> 31.2% or 31.3% (integer math: 250000000 * 1000 / 800000000 = 312 / 10 = 31.2)
        expect(result.data.cashflow.savingsRatePercentage).toBeCloseTo(31.2, 1);
        expect(result.data.cashflow.netCashflowFormatted).toContain('+');
      }
    });

    it('should strictly exclude transfers from income and expenses', async () => {
      // Transfer: Rp 1.000.000
      await txRepo.create(
        new Transaction({
          id: 'tx-trf-1',
          userId: testUserId,
          type: 'transfer',
          amount: Money.fromDecimal(1000000, 'IDR'),
          transactionDate: '2026-08-12',
          sourceAccountId: 'acc-1',
          destinationAccountId: 'acc-2',
          items: [],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cashflow.income.minorUnits).toBe(0n);
        expect(result.data.cashflow.expense.minorUnits).toBe(0n);
        expect(result.data.cashflow.netCashflow.minorUnits).toBe(0n);
      }
    });

    it('should handle deficit (expense > income) with negative indicator and 0 savings rate', async () => {
      // Expense: Rp 300.000, Income: Rp 100.000
      await txRepo.create(
        new Transaction({
          id: 'tx-inc-deficit',
          userId: testUserId,
          type: 'income',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-01',
          destinationAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-inc-def',
              transactionId: 'tx-inc-deficit',
              categoryId: 'cat-salary',
              amount: Money.fromDecimal(100000, 'IDR'),
            }),
          ],
        })
      );

      await txRepo.create(
        new Transaction({
          id: 'tx-exp-deficit',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(300000, 'IDR'),
          transactionDate: '2026-08-02',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-def-1',
              transactionId: 'tx-exp-deficit',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(300000, 'IDR'),
            }),
          ],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cashflow.isNetPositive).toBe(false);
        expect(result.data.cashflow.netCashflow.toDecimal()).toBe(200000);
        expect(result.data.cashflow.netCashflowFormatted).toContain('-');
        expect(result.data.cashflow.savingsRatePercentage).toBe(0);
      }
    });
  });

  describe('Category Spending Breakdown & Split Transactions', () => {
    it('should aggregate split transaction items into respective categories and compute percentages', async () => {
      // Single transaction of Rp 100.000 with 2 splits: Food Rp 60.000 (60%) & Transport Rp 40.000 (40%)
      await txRepo.create(
        new Transaction({
          id: 'tx-split-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-15',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-split-1',
              transactionId: 'tx-split-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(60000, 'IDR'),
            }),
            new TransactionItem({
              id: 'ti-split-2',
              transactionId: 'tx-split-1',
              categoryId: 'cat-transport',
              amount: Money.fromDecimal(40000, 'IDR'),
            }),
          ],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories).toHaveLength(2);
        // Sorted descending: Food (60.000) first, then Transport (40.000)
        expect(result.data.categories[0].categoryId).toBe('cat-food');
        expect(result.data.categories[0].amount.toDecimal()).toBe(60000);
        expect(result.data.categories[0].percentage).toBe(60);

        expect(result.data.categories[1].categoryId).toBe('cat-transport');
        expect(result.data.categories[1].amount.toDecimal()).toBe(40000);
        expect(result.data.categories[1].percentage).toBe(40);
      }
    });

    it('should exclude soft-deleted transactions from category spending', async () => {
      const tx = new Transaction({
        id: 'tx-deleted-cat',
        userId: testUserId,
        type: 'expense',
        amount: Money.fromDecimal(50000, 'IDR'),
        transactionDate: '2026-08-15',
        sourceAccountId: 'acc-1',
        items: [
          new TransactionItem({
            id: 'ti-del',
            transactionId: 'tx-deleted-cat',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(50000, 'IDR'),
          }),
        ],
      });
      await txRepo.create(tx);
      await txRepo.softDelete('tx-deleted-cat', testUserId);

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories).toHaveLength(0);
      }
    });
  });

  describe('Budget Health Overview', () => {
    it('should aggregate budget health metrics across active budgets', async () => {
      // 1. Budget Food: Rp 500.000
      await budgetRepo.create(
        new Budget({
          id: 'b-food',
          userId: testUserId,
          categoryId: 'cat-food',
          amount: Money.fromDecimal(500000, 'IDR'),
          period: new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly'),
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        })
      );

      // 2. Budget Transport: Rp 200.000
      await budgetRepo.create(
        new Budget({
          id: 'b-transport',
          userId: testUserId,
          categoryId: 'cat-transport',
          amount: Money.fromDecimal(200000, 'IDR'),
          period: new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly'),
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        })
      );

      // Spend Rp 350.000 on Food (utilization 70%)
      await txRepo.create(
        new Transaction({
          id: 'tx-b-spend',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(350000, 'IDR'),
          transactionDate: '2026-08-10',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-b-spend',
              transactionId: 'tx-b-spend',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(350000, 'IDR'),
            }),
          ],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budgetHealth.totalBudget.toDecimal()).toBe(700000);
        expect(result.data.budgetHealth.totalSpent.toDecimal()).toBe(350000);
        expect(result.data.budgetHealth.totalRemaining.toDecimal()).toBe(350000);
        expect(result.data.budgetHealth.utilizationPercentage).toBe(50);
        expect(result.data.budgetHealth.budgetCount).toBe(2);
        expect(result.data.budgetHealth.overBudgetCount).toBe(0);
      }
    });
  });

  describe('Month-over-Month Comparison', () => {
    it('should compute deltas and percentage changes against previous month', async () => {
      // Previous Month (July 2026): Expense Rp 4.000.000
      await txRepo.create(
        new Transaction({
          id: 'tx-jul-exp',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(4000000, 'IDR'),
          transactionDate: '2026-07-15',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-jul',
              transactionId: 'tx-jul-exp',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(4000000, 'IDR'),
            }),
          ],
        })
      );

      // Current Month (August 2026): Expense Rp 5.500.000
      await txRepo.create(
        new Transaction({
          id: 'tx-aug-exp',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(5500000, 'IDR'),
          transactionDate: '2026-08-15',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'ti-aug',
              transactionId: 'tx-aug-exp',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(5500000, 'IDR'),
            }),
          ],
        })
      );

      const result = await useCase.execute(testUserId, '2026-08');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comparison.currentExpense.toDecimal()).toBe(5500000);
        expect(result.data.comparison.previousExpense.toDecimal()).toBe(4000000);
        expect(result.data.comparison.expenseDelta.toDecimal()).toBe(1500000);
        expect(result.data.comparison.isExpenseIncreased).toBe(true);
        // (1.500.000 / 4.000.000) * 100 = 37.5%
        expect(result.data.comparison.expenseDeltaPercentage).toBe(37.5);
      }
    });
  });
});
