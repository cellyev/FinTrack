import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { LedgerBalanceCalculator } from '@/features/transactions/domain/services/balance-calculator';
import { Money } from '@/core/domain/money';

describe('LedgerBalanceCalculator Domain Service', () => {
  const userId = 'user-1';
  const accA = 'acc-A';
  const accB = 'acc-B';
  const catSalary = 'cat-salary';
  const catFood = 'cat-food';

  it('should accurately calculate ledger scenario from specifications', () => {
    // 1. Opening Balance: Rp 1.000.000 into Account A
    const tx1 = new Transaction({
      id: 'tx-1',
      userId,
      type: 'opening_balance',
      amount: Money.fromDecimal(1000000, 'IDR'),
      transactionDate: '2026-08-01',
      destinationAccountId: accA,
    });

    // 2. Expense: Rp 100.000 from Account A
    const tx2 = new Transaction({
      id: 'tx-2',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-05',
      sourceAccountId: accA,
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-2',
          categoryId: catFood,
          amount: Money.fromDecimal(100000, 'IDR'),
        }),
      ],
    });

    // 3. Income: Rp 500.000 into Account A
    const tx3 = new Transaction({
      id: 'tx-3',
      userId,
      type: 'income',
      amount: Money.fromDecimal(500000, 'IDR'),
      transactionDate: '2026-08-10',
      destinationAccountId: accA,
      items: [
        new TransactionItem({
          id: 'item-2',
          transactionId: 'tx-3',
          categoryId: catSalary,
          amount: Money.fromDecimal(500000, 'IDR'),
        }),
      ],
    });

    // 4. Transfer: Rp 200.000 from Account A to Account B
    const tx4 = new Transaction({
      id: 'tx-4',
      userId,
      type: 'transfer',
      amount: Money.fromDecimal(200000, 'IDR'),
      transactionDate: '2026-08-15',
      sourceAccountId: accA,
      destinationAccountId: accB,
    });

    const transactions = [tx1, tx2, tx3, tx4];

    // Calculate individual balances
    const balanceA = LedgerBalanceCalculator.calculateAccountBalance(accA, transactions, 'IDR');
    const balanceB = LedgerBalanceCalculator.calculateAccountBalance(accB, transactions, 'IDR');
    const allBalances = LedgerBalanceCalculator.calculateAllAccountBalances(transactions, [accA, accB], 'IDR');
    const netWorth = LedgerBalanceCalculator.calculateTotalNetWorth(transactions, 'IDR');

    // Account A = 1.000.000 - 100.000 + 500.000 - 200.000 = Rp 1.200.000
    expect(balanceA.toDecimal()).toBe(1200000);
    expect(allBalances.get(accA)?.toDecimal()).toBe(1200000);

    // Account B = + 200.000 = Rp 200.000
    expect(balanceB.toDecimal()).toBe(200000);
    expect(allBalances.get(accB)?.toDecimal()).toBe(200000);

    // Total Net Worth = Rp 1.400.000
    expect(netWorth.toDecimal()).toBe(1400000);
  });

  it('should verify net worth effects for all transaction types', () => {
    // Initial opening balance: net worth increases by 500.000
    const tx1 = new Transaction({
      id: 'tx-1',
      userId,
      type: 'opening_balance',
      amount: Money.fromDecimal(500000, 'IDR'),
      transactionDate: '2026-08-01',
      destinationAccountId: accA,
    });
    expect(LedgerBalanceCalculator.calculateTotalNetWorth([tx1]).toDecimal()).toBe(500000);

    // Income: net worth increases by 300.000 (total 800.000)
    const tx2 = new Transaction({
      id: 'tx-2',
      userId,
      type: 'income',
      amount: Money.fromDecimal(300000, 'IDR'),
      transactionDate: '2026-08-02',
      destinationAccountId: accA,
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-2',
          categoryId: catSalary,
          amount: Money.fromDecimal(300000, 'IDR'),
        }),
      ],
    });
    expect(LedgerBalanceCalculator.calculateTotalNetWorth([tx1, tx2]).toDecimal()).toBe(800000);

    // Expense: net worth decreases by 100.000 (total 700.000)
    const tx3 = new Transaction({
      id: 'tx-3',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-03',
      sourceAccountId: accA,
      items: [
        new TransactionItem({
          id: 'item-2',
          transactionId: 'tx-3',
          categoryId: catFood,
          amount: Money.fromDecimal(100000, 'IDR'),
        }),
      ],
    });
    expect(LedgerBalanceCalculator.calculateTotalNetWorth([tx1, tx2, tx3]).toDecimal()).toBe(700000);

    // Transfer: net worth remains completely unchanged (total 700.000)
    const tx4 = new Transaction({
      id: 'tx-4',
      userId,
      type: 'transfer',
      amount: Money.fromDecimal(400000, 'IDR'),
      transactionDate: '2026-08-04',
      sourceAccountId: accA,
      destinationAccountId: accB,
    });
    expect(LedgerBalanceCalculator.calculateTotalNetWorth([tx1, tx2, tx3, tx4]).toDecimal()).toBe(700000);
  });

  it('should exclude soft-deleted transactions from active balance calculations', () => {
    const tx1 = new Transaction({
      id: 'tx-1',
      userId,
      type: 'opening_balance',
      amount: Money.fromDecimal(1000000, 'IDR'),
      transactionDate: '2026-08-01',
      destinationAccountId: accA,
    });

    const tx2 = new Transaction({
      id: 'tx-2',
      userId,
      type: 'expense',
      amount: Money.fromDecimal(400000, 'IDR'),
      transactionDate: '2026-08-02',
      sourceAccountId: accA,
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-2',
          categoryId: catFood,
          amount: Money.fromDecimal(400000, 'IDR'),
        }),
      ],
    });

    // Before deletion: balance is 600.000
    expect(LedgerBalanceCalculator.calculateAccountBalance(accA, [tx1, tx2]).toDecimal()).toBe(600000);

    // Soft delete expense transaction
    tx2.markDeleted();
    expect(tx2.isDeleted()).toBe(true);

    // After deletion: balance reverts to 1.000.000
    expect(LedgerBalanceCalculator.calculateAccountBalance(accA, [tx1, tx2]).toDecimal()).toBe(1000000);
    expect(LedgerBalanceCalculator.calculateTotalNetWorth([tx1, tx2]).toDecimal()).toBe(1000000);
  });
});
