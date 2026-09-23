import { Money } from '@/core/domain/money';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Account } from '@/features/accounts/domain/account';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Debt } from '@/features/debts/domain/debt';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { LedgerBalanceCalculator } from '@/features/transactions/domain/services/balance-calculator';
import { ValidationError } from '@/core/domain/result';

describe('Phase 5 — Financial Integrity & Stress Testing', () => {
  describe('BigInt Money Arithmetic & Boundary Stress', () => {
    it('should accurately handle extreme BigInt minor units without float loss or overflow', () => {
      // 1 Trillion Rupiah = 1,000,000,000,000 IDR = 100,000,000,000,000 minor units
      const oneTrillion = Money.fromDecimal(1_000_000_000_000, 'IDR');
      const twoTrillion = Money.fromDecimal(2_000_000_000_000, 'IDR');

      const sum = oneTrillion.add(twoTrillion);
      expect(sum.minorUnits).toBe(300_000_000_000_000n);
      expect(sum.formatDisplay()).toBe('Rp 3.000.000.000.000');

      const diff = sum.subtract(oneTrillion);
      expect(diff.minorUnits).toBe(200_000_000_000_000n);
      expect(diff.formatDisplay()).toBe('Rp 2.000.000.000.000');
    });

    it('should strictly prohibit negative transaction amounts across domain constructors', () => {
      expect(() => {
        new Transaction({
          id: 'tx-neg-1',
          userId: 'user-1',
          type: 'expense',
          amount: Money.fromMinorUnits(-50000n, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-neg-1',
              categoryId: 'cat-1',
              amount: Money.fromMinorUnits(-50000n, 'IDR'),
            }),
          ],
        });
      }).toThrow('Money amount must be a positive integer or zero');
    });

    it('should strictly prohibit zero amount for transactions, budgets, debts, and recurring schedules', () => {
      // Transaction
      expect(() => {
        new Transaction({
          id: 'tx-zero-1',
          userId: 'user-1',
          type: 'income',
          amount: Money.zero('IDR'),
          transactionDate: '2026-08-20',
          destinationAccountId: 'acc-1',
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-zero-1',
              categoryId: 'cat-1',
              amount: Money.zero('IDR'),
            }),
          ],
        });
      }).toThrow(ValidationError);

      // Budget
      expect(() => {
        new Budget({
          id: 'b-1',
          userId: 'user-1',
          categoryId: 'cat-1',
          amount: Money.zero('IDR'),
          period: BudgetPeriod.currentMonth(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }).toThrow();

      // Debt
      expect(() => {
        new Debt({
          id: 'd-1',
          userId: 'user-1',
          type: 'borrowed',
          personName: 'Rudi',
          originalAmount: Money.zero('IDR'),
        });
      }).toThrow(ValidationError);

      // Recurring Transaction
      expect(() => {
        new RecurringTransaction({
          id: 'rec-1',
          userId: 'user-1',
          type: 'expense',
          amount: Money.zero('IDR'),
          accountId: 'acc-1',
          categoryId: 'cat-1',
          frequency: 'monthly',
          startDate: '2026-08-01',
          nextOccurrence: '2026-09-01',
        });
      }).toThrow(ValidationError);
    });
  });

  describe('Dynamic Ledger Calculation Under Complex Chains', () => {
    it('should maintain exact dynamic balances under multiple accounts, transfers, and split expenses', () => {
      const accCash = new Account({ id: 'acc-cash', userId: 'u-1', name: 'Dompet Tunai', type: 'cash' });
      const accBank = new Account({ id: 'acc-bank', userId: 'u-1', name: 'Rekening Bank', type: 'bank' });

      const txOpeningBank = new Transaction({
        id: 'tx-1',
        userId: 'u-1',
        type: 'opening_balance',
        amount: Money.fromDecimal(5000000, 'IDR'), // +5.000.000 in bank
        transactionDate: '2026-08-01',
        destinationAccountId: accBank.id,
        items: [],
      });

      const txOpeningCash = new Transaction({
        id: 'tx-2',
        userId: 'u-1',
        type: 'opening_balance',
        amount: Money.fromDecimal(1000000, 'IDR'), // +1.000.000 in cash
        transactionDate: '2026-08-01',
        destinationAccountId: accCash.id,
        items: [],
      });

      const txTransfer = new Transaction({
        id: 'tx-3',
        userId: 'u-1',
        type: 'transfer',
        amount: Money.fromDecimal(500000, 'IDR'), // -500.000 bank, +500.000 cash
        transactionDate: '2026-08-05',
        sourceAccountId: accBank.id,
        destinationAccountId: accCash.id,
        items: [],
      });

      const txSplitExpense = new Transaction({
        id: 'tx-4',
        userId: 'u-1',
        type: 'expense',
        amount: Money.fromDecimal(300000, 'IDR'), // -300.000 cash
        transactionDate: '2026-08-10',
        sourceAccountId: accCash.id,
        items: [
          new TransactionItem({ id: 'item-1', transactionId: 'tx-4', categoryId: 'cat-groceries', amount: Money.fromDecimal(200000, 'IDR') }),
          new TransactionItem({ id: 'item-2', transactionId: 'tx-4', categoryId: 'cat-transport', amount: Money.fromDecimal(100000, 'IDR') }),
        ],
      });

      const txDeletedExpense = new Transaction({
        id: 'tx-5',
        userId: 'u-1',
        type: 'expense',
        amount: Money.fromDecimal(999999, 'IDR'),
        transactionDate: '2026-08-12',
        sourceAccountId: accCash.id,
        items: [new TransactionItem({ id: 'item-3', transactionId: 'tx-5', categoryId: 'cat-groceries', amount: Money.fromDecimal(999999, 'IDR') })],
        deletedAt: new Date('2026-08-12T10:00:00Z'), // Soft-deleted, MUST be excluded from balance
      });

      const balances = LedgerBalanceCalculator.calculateAllAccountBalances(
        [txOpeningBank, txOpeningCash, txTransfer, txSplitExpense, txDeletedExpense],
        [accCash.id, accBank.id]
      );

      // Bank: 5.000.000 - 500.000 = 4.500.000
      expect(balances.get('acc-bank')?.formatDisplay()).toBe('Rp 4.500.000');

      // Cash: 1.000.000 + 500.000 - 300.000 = 1.200.000
      expect(balances.get('acc-cash')?.formatDisplay()).toBe('Rp 1.200.000');
    });
  });
});
