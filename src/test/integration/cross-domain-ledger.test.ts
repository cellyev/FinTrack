import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteBudgetRepository } from '@/features/budgets/data/sqlite-budget.repository';
import { SqliteDebtRepository } from '@/features/debts/data/sqlite-debt.repository';
import { SqliteRecurringTransactionRepository } from '@/features/recurring-transactions/data/sqlite-recurring.repository';

import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Debt } from '@/features/debts/domain/debt';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { LedgerBalanceCalculator } from '@/features/transactions/domain/services/balance-calculator';

import { GetBudgetProgressUseCase } from '@/features/budgets/application/get-budget-progress.usecase';
import { ProcessDueRecurringTransactionsUseCase } from '@/features/recurring-transactions/application/process-due-recurring.usecase';
import { RecordRepaymentUseCase } from '@/features/debts/application/record-repayment.usecase';
import {
  SoftDeleteTransactionUseCase,
  GetTransactionHistoryUseCase,
} from '@/features/transactions/application/transaction.usecases';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

describe('Cross-Domain Integration & Ledger Invariants', () => {
  let inMemoryDb: InMemoryTestDb;
  let accountRepo: SqliteAccountRepository;
  let categoryRepo: SqliteCategoryRepository;
  let txRepo: SqliteTransactionRepository;
  let budgetRepo: SqliteBudgetRepository;
  let debtRepo: SqliteDebtRepository;
  let recurringRepo: SqliteRecurringTransactionRepository;

  let getBudgetProgressUseCase: GetBudgetProgressUseCase;
  let processDueRecurringUseCase: ProcessDueRecurringTransactionsUseCase;
  let recordRepaymentUseCase: RecordRepaymentUseCase;
  let softDeleteTxUseCase: SoftDeleteTransactionUseCase;
  let getHistoryUseCase: GetTransactionHistoryUseCase;

  let idCounter = 100;
  const mockUuidGenerator: IUuidGenerator = {
    generate: () => `gen-uuid-${idCounter++}`,
    isValid: (_id: string) => true,
  };

  const nowIso = new Date().toISOString();

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    const dbProvider = async () => inMemoryDb.getDb();

    accountRepo = new SqliteAccountRepository(dbProvider);
    categoryRepo = new SqliteCategoryRepository(dbProvider);
    txRepo = new SqliteTransactionRepository(dbProvider);
    budgetRepo = new SqliteBudgetRepository(dbProvider);
    debtRepo = new SqliteDebtRepository(dbProvider);
    recurringRepo = new SqliteRecurringTransactionRepository(dbProvider);

    getBudgetProgressUseCase = new GetBudgetProgressUseCase(budgetRepo, categoryRepo);
    processDueRecurringUseCase = new ProcessDueRecurringTransactionsUseCase(recurringRepo, mockUuidGenerator);
    recordRepaymentUseCase = new RecordRepaymentUseCase(debtRepo, mockUuidGenerator);
    softDeleteTxUseCase = new SoftDeleteTransactionUseCase(txRepo, {
      isEligibleForCorrection: () => true,
      daysRemaining: () => 7,
    });
    getHistoryUseCase = new GetTransactionHistoryUseCase(txRepo, accountRepo, categoryRepo);
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  describe('Scenario A: Recurring Occurrence -> Budget & Account Ledger', () => {
    it('creates canonical transaction, increases budget actual spending, and preserves idempotency on re-run', async () => {
      const userId = 'user-test-1';

      // 1. Create Account with Opening Balance of Rp 1.000.000 (100.000.000 minor units)
      const account = new Account({
        id: 'acc-bca-1',
        userId,
        name: 'BCA Utama',
        type: 'bank',
        currencyCode: 'IDR',
      });
      await accountRepo.create(account);

      const openingTx = new Transaction({
        id: 'tx-open-1',
        userId,
        type: 'opening_balance',
        amount: Money.fromMinorUnits(100000000n, 'IDR'),
        destinationAccountId: account.id,
        transactionDate: '2026-06-01',
      });
      await txRepo.create(openingTx);

      // Verify initial balance
      const initialTxRes = await txRepo.getAllActiveTransactions(userId);
      const initialTxList = initialTxRes.success ? initialTxRes.data : [];
      const balanceBefore = LedgerBalanceCalculator.calculateAccountBalance(account.id, initialTxList);
      expect(balanceBefore.minorUnits).toBe(100000000n);

      // 2. Create Category "Tagihan & Utilitas"
      const category = new Category({
        id: 'cat-utilities-1',
        userId,
        name: 'Tagihan & Utilitas',
        type: 'expense',
        icon: 'wifi',
        color: '#3B82F6',
      });
      await categoryRepo.create(category);

      // 3. Create Budget for "Tagihan & Utilitas": Rp 500.000 (50.000.000 minor units) for June 2026
      const budget = new Budget({
        id: 'bg-utilities-jun26',
        userId,
        categoryId: category.id,
        name: 'Budget Tagihan Juni',
        amount: Money.fromMinorUnits(50000000n, 'IDR'),
        period: new BudgetPeriod('2026-06-01', '2026-06-30', 'monthly'),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      await budgetRepo.create(budget);

      // Verify budget actual before occurrence
      const progressBeforeRes = await getBudgetProgressUseCase.execute({
        budgetId: budget.id,
        userId,
      });
      expect(progressBeforeRes.success).toBe(true);
      if (progressBeforeRes.success) {
        expect(progressBeforeRes.data.actualSpending.minorUnits).toBe(0n);
        expect(progressBeforeRes.data.percentageUsed).toBe(0);
        expect(progressBeforeRes.data.isOverBudget).toBe(false);
      }

      // 4. Create Recurring Expense: Rp 150.000 (15.000.000 minor units), Monthly on 5th
      const recurring = new RecurringTransaction({
        id: 'rec-wifi-1',
        userId,
        type: 'expense',
        amount: Money.fromMinorUnits(15000000n, 'IDR'),
        accountId: account.id,
        categoryId: category.id,
        frequency: 'monthly',
        startDate: '2026-06-05',
        nextOccurrence: '2026-06-05',
        note: 'WiFi IndiHome',
      });
      await recurringRepo.create(recurring);

      // 5. Process due recurring occurrences as of 2026-06-10
      const processRes = await processDueRecurringUseCase.execute({
        userId,
        referenceDate: '2026-06-10',
        specificRecurringId: recurring.id,
      });

      expect(processRes.success).toBe(true);
      if (processRes.success) {
        expect(processRes.data.generatedTransactionsCount).toBe(1);
        expect(processRes.data.skippedDuplicateCount).toBe(0);
      }

      // 6. Assertions on Ledger & Domain Interactions
      // 6a. Transaction created with exact recurring linkage and occurrence key
      const activeTxRes = await txRepo.getAllActiveTransactions(userId);
      const activeTxs: Transaction[] = activeTxRes.success ? activeTxRes.data : [];
      expect(activeTxs.length).toBe(2); // opening balance + recurring occurrence
      const generatedTx = activeTxs.find((t) => t.recurringTransactionId === recurring.id);
      expect(generatedTx).toBeDefined();
      expect(generatedTx?.occurrenceKey).toBe(`${recurring.id}_2026-06-05`);
      expect(generatedTx?.amount.minorUnits).toBe(15000000n);
      expect(generatedTx?.sourceAccountId).toBe(account.id);
      expect(generatedTx?.items.length).toBe(1);
      expect(generatedTx?.items[0].categoryId).toBe(category.id);

      // 6b. Account balance decreases exactly once by Rp 150.000 -> Rp 850.000 (85.000.000 minor)
      const balanceAfter = LedgerBalanceCalculator.calculateAccountBalance(account.id, activeTxs);
      expect(balanceAfter.minorUnits).toBe(85000000n);

      // 6c. Budget actual spending increases exactly once by Rp 150.000 (30.0%)
      const progressAfterRes = await getBudgetProgressUseCase.execute({
        budgetId: budget.id,
        userId,
      });
      expect(progressAfterRes.success).toBe(true);
      if (progressAfterRes.success) {
        expect(progressAfterRes.data.actualSpending.minorUnits).toBe(15000000n);
        expect(progressAfterRes.data.remainingAmount.minorUnits).toBe(35000000n);
        expect(progressAfterRes.data.percentageUsed).toBe(30.0);
        expect(progressAfterRes.data.isOverBudget).toBe(false);
      }

      // 6d. Recurring schedule advances next_occurrence to 2026-07-05
      const updatedRecRes = await recurringRepo.getById(recurring.id, userId);
      expect(updatedRecRes.success).toBe(true);
      if (updatedRecRes.success && updatedRecRes.data) {
        expect(updatedRecRes.data.nextOccurrence).toBe('2026-07-05');
      }

      // 7. Test Idempotency: re-running process occurrence as of 2026-06-10 does NOT duplicate transaction
      const retryProcessRes = await processDueRecurringUseCase.execute({
        userId,
        referenceDate: '2026-06-10',
        specificRecurringId: recurring.id,
      });

      expect(retryProcessRes.success).toBe(true);
      if (retryProcessRes.success) {
        expect(retryProcessRes.data.generatedTransactionsCount).toBe(0); // Not due (next is 2026-07-05)
      }

      const postRetryTxRes = await txRepo.getAllActiveTransactions(userId);
      const postRetryTxs = postRetryTxRes.success ? postRetryTxRes.data : [];
      expect(postRetryTxs.length).toBe(2);

      const balanceAfterRetry = LedgerBalanceCalculator.calculateAccountBalance(account.id, postRetryTxs);
      expect(balanceAfterRetry.minorUnits).toBe(85000000n);

      const progressAfterRetryRes = await getBudgetProgressUseCase.execute({
        budgetId: budget.id,
        userId,
      });
      if (progressAfterRetryRes.success) {
        expect(progressAfterRetryRes.data.actualSpending.minorUnits).toBe(15000000n);
      }
    });
  });

  describe('Scenario B: Debt Repayment -> Transaction History & Balance', () => {
    it('records partial debt repayment, creates canonical transaction with debt_id, and appears in history', async () => {
      const userId = 'user-test-2';

      // 1. Account with balance Rp 2.000.000 (200.000.000 minor units)
      const account = new Account({
        id: 'acc-mandiri-1',
        userId,
        name: 'Mandiri Payroll',
        type: 'bank',
      });
      await accountRepo.create(account);

      const openTx = new Transaction({
        id: 'tx-open-2',
        userId,
        type: 'opening_balance',
        amount: Money.fromMinorUnits(200000000n, 'IDR'),
        destinationAccountId: account.id,
        transactionDate: '2026-06-01',
      });
      await txRepo.create(openTx);

      // 2. Category for repayment
      const repayCategory = new Category({
        id: 'cat-repay-1',
        userId,
        name: 'Cicilan & Hutang',
        type: 'expense',
      });
      await categoryRepo.create(repayCategory);

      // 3. Create Debt: Borrowed Rp 1.000.000 (100.000.000 minor) from "Pak Budi"
      const debt = new Debt({
        id: 'debt-budi-1',
        userId,
        type: 'borrowed',
        personName: 'Pak Budi',
        originalAmount: Money.fromMinorUnits(100000000n, 'IDR'),
        remainingAmount: Money.fromMinorUnits(100000000n, 'IDR'),
        dueDate: '2026-12-31',
        status: 'open',
      });
      await debtRepo.create(debt);

      // 4. Record Partial Repayment of Rp 400.000 (40.000.000 minor)
      const repaymentRes = await recordRepaymentUseCase.execute({
        debtId: debt.id,
        userId,
        paymentAmountMinorUnits: 40000000,
        accountId: account.id,
        categoryId: repayCategory.id,
        transactionDate: '2026-06-15',
        note: 'Cicilan 1',
      });

      expect(repaymentRes.success).toBe(true);
      if (repaymentRes.success) {
        expect(repaymentRes.data.remainingAmount.minorUnits).toBe(60000000n);
        expect(repaymentRes.data.status).toBe('open');
      }

      // 4. Assert canonical transaction created with debt_id
      const allTxRes = await txRepo.getAllActiveTransactions(userId);
      const allTxs: Transaction[] = allTxRes.success ? allTxRes.data : [];
      expect(allTxs.length).toBe(2);
      const repaymentTx = allTxs.find((t) => t.debtId === debt.id);
      expect(repaymentTx).toBeDefined();
      expect(repaymentTx?.type).toBe('expense');
      expect(repaymentTx?.sourceAccountId).toBe(account.id);
      expect(repaymentTx?.amount.minorUnits).toBe(40000000n);

      // 5. Assert Account Balance is updated to Rp 1.600.000 (160.000.000 minor)
      const balanceAfter = LedgerBalanceCalculator.calculateAccountBalance(account.id, allTxs);
      expect(balanceAfter.minorUnits).toBe(160000000n);

      // 6. Assert Transaction Repository filtered by debtId returns repayment transaction
      const debtFilteredTxsRes = await txRepo.list({
        userId,
        debtId: debt.id,
      });
      expect(debtFilteredTxsRes.success).toBe(true);
      if (debtFilteredTxsRes.success) {
        expect(debtFilteredTxsRes.data.length).toBe(1);
        expect(debtFilteredTxsRes.data[0].id).toBe(repaymentTx?.id);
        expect(debtFilteredTxsRes.data[0].debtId).toBe(debt.id);
      }

      // 7. Assert Transaction History UseCase returns repayment transaction in account history
      const historyRes = await getHistoryUseCase.execute({
        userId,
        accountId: account.id,
      });
      expect(historyRes.success).toBe(true);
      if (historyRes.success) {
        expect(historyRes.data.items.length).toBe(2);
        const item = historyRes.data.items.find((i) => i.id === repaymentTx?.id);
        expect(item).toBeDefined();
      }
    });
  });

  describe('Scenario C: Transaction Soft-Delete -> Budget Rollback & Ledger Restoration', () => {
    it('soft-deletes transaction, rolls back budget actual spending, and restores account balance', async () => {
      const userId = 'user-test-3';

      // 1. Create Account with balance Rp 5.000.000 (500.000.000 minor units)
      const account = new Account({
        id: 'acc-cash-1',
        userId,
        name: 'Dompet Tunai',
        type: 'cash',
      });
      await accountRepo.create(account);

      const openTx = new Transaction({
        id: 'tx-open-3',
        userId,
        type: 'opening_balance',
        amount: Money.fromMinorUnits(500000000n, 'IDR'),
        destinationAccountId: account.id,
        transactionDate: '2026-07-01',
      });
      await txRepo.create(openTx);

      // 2. Create Category "Makanan & Minuman"
      const category = new Category({
        id: 'cat-food-1',
        userId,
        name: 'Makanan & Minuman',
        type: 'expense',
      });
      await categoryRepo.create(category);

      // 3. Create Budget for July 2026: Rp 1.000.000 (100.000.000 minor)
      const budget = new Budget({
        id: 'bg-food-jul26',
        userId,
        categoryId: category.id,
        name: 'Budget Makan Juli',
        amount: Money.fromMinorUnits(100000000n, 'IDR'),
        period: new BudgetPeriod('2026-07-01', '2026-07-31', 'monthly'),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      await budgetRepo.create(budget);

      // 4. Create Expense Transaction: Rp 300.000 (30.000.000 minor) on 2026-07-10
      const expenseTx = new Transaction({
        id: 'tx-food-1',
        userId,
        type: 'expense',
        amount: Money.fromMinorUnits(30000000n, 'IDR'),
        sourceAccountId: account.id,
        transactionDate: '2026-07-10',
        items: [
          new TransactionItem({
            id: 'item-food-1',
            transactionId: 'tx-food-1',
            categoryId: category.id,
            amount: Money.fromMinorUnits(30000000n, 'IDR'),
          }),
        ],
      });
      await txRepo.create(expenseTx);

      // Verify before deletion:
      // - Account balance is Rp 4.700.000 (470.000.000 minor)
      // - Budget spending is Rp 300.000 (30.000.000 minor, 30.0%)
      const txsBeforeRes = await txRepo.getAllActiveTransactions(userId);
      const txsBefore = txsBeforeRes.success ? txsBeforeRes.data : [];
      expect(txsBefore.length).toBe(2);
      expect(LedgerBalanceCalculator.calculateAccountBalance(account.id, txsBefore).minorUnits).toBe(470000000n);

      const progressBeforeRes = await getBudgetProgressUseCase.execute({
        budgetId: budget.id,
        userId,
      });
      expect(progressBeforeRes.success).toBe(true);
      if (progressBeforeRes.success) {
        expect(progressBeforeRes.data.actualSpending.minorUnits).toBe(30000000n);
        expect(progressBeforeRes.data.percentageUsed).toBe(30.0);
      }

      // 5. Soft-Delete the expense transaction
      const deleteRes = await softDeleteTxUseCase.execute(expenseTx.id, userId);
      expect(deleteRes.success).toBe(true);

      // 6. Assertions after deletion:
      // 6a. Active transactions list excludes the deleted transaction
      const txsAfterRes = await txRepo.getAllActiveTransactions(userId);
      const txsAfter = txsAfterRes.success ? txsAfterRes.data : [];
      expect(txsAfter.length).toBe(1);
      expect(txsAfter[0].id).toBe(openTx.id);

      // 6b. Ledger balance restored to Rp 5.000.000 (500.000.000 minor)
      const balanceAfter = LedgerBalanceCalculator.calculateAccountBalance(account.id, txsAfter);
      expect(balanceAfter.minorUnits).toBe(500000000n);

      // 6c. Budget spending rolls back to Rp 0 (0.0%)
      const progressAfterRes = await getBudgetProgressUseCase.execute({
        budgetId: budget.id,
        userId,
      });
      expect(progressAfterRes.success).toBe(true);
      if (progressAfterRes.success) {
        expect(progressAfterRes.data.actualSpending.minorUnits).toBe(0n);
        expect(progressAfterRes.data.remainingAmount.minorUnits).toBe(100000000n);
        expect(progressAfterRes.data.percentageUsed).toBe(0.0);
      }

      // 6d. Physical record remains in DB with deleted_at set
      const rawTx = inMemoryDb.transactions.find((t) => t.id === expenseTx.id);
      expect(rawTx).toBeDefined();
      expect(rawTx?.deleted_at).not.toBeNull();
    });
  });
});
