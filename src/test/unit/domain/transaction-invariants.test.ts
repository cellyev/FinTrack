import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { ValidationError } from '@/core/domain/result';
import {
  TransactionSplitMismatchError,
  CategorySplitMissingError,
  SplitsNotAllowedError,
  InvalidTransactionAccountError,
  TransferSameAccountError,
} from '@/features/transactions/domain/transaction-errors';

describe('Transaction Domain Invariants', () => {
  const userId = 'user-test-123';
  const accCash = 'acc-cash';
  const accBank = 'acc-bank';
  const catFood = 'cat-food';
  const catTransport = 'cat-transport';
  const catSalary = 'cat-salary';

  describe('Income Invariants', () => {
    it('should create valid income transaction with 1 split', () => {
      const tx = new Transaction({
        id: 'tx-inc-1',
        userId,
        type: 'income',
        amount: Money.fromDecimal(500000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: accBank,
        items: [
          new TransactionItem({
            id: 'item-1',
            transactionId: 'tx-inc-1',
            categoryId: catSalary,
            amount: Money.fromDecimal(500000, 'IDR'),
          }),
        ],
      });

      expect(tx.id).toBe('tx-inc-1');
      expect(tx.type).toBe('income');
      expect(tx.amount.toDecimal()).toBe(500000);
      expect(tx.destinationAccountId).toBe(accBank);
      expect(tx.sourceAccountId).toBeNull();
      expect(tx.items.length).toBe(1);
    });

    it('should create valid income with multiple splits whose sum matches amount', () => {
      const tx = new Transaction({
        id: 'tx-inc-2',
        userId,
        type: 'income',
        amount: Money.fromDecimal(750000, 'IDR'),
        transactionDate: '2026-08-19',
        destinationAccountId: accBank,
        items: [
          new TransactionItem({
            id: 'item-1',
            transactionId: 'tx-inc-2',
            categoryId: catSalary,
            amount: Money.fromDecimal(500000, 'IDR'),
          }),
          new TransactionItem({
            id: 'item-2',
            transactionId: 'tx-inc-2',
            categoryId: 'cat-bonus',
            amount: Money.fromDecimal(250000, 'IDR'),
          }),
        ],
      });

      expect(tx.items.length).toBe(2);
    });

    it('should reject income with missing destination account', () => {
      expect(() => {
        new Transaction({
          id: 'tx-inc-err-1',
          userId,
          type: 'income',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-19',
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-inc-err-1',
              categoryId: catSalary,
              amount: Money.fromDecimal(100000, 'IDR'),
            }),
          ],
        });
      }).toThrow(InvalidTransactionAccountError);
    });

    it('should reject income with source account provided', () => {
      expect(() => {
        new Transaction({
          id: 'tx-inc-err-2',
          userId,
          type: 'income',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-19',
          sourceAccountId: accCash,
          destinationAccountId: accBank,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-inc-err-2',
              categoryId: catSalary,
              amount: Money.fromDecimal(100000, 'IDR'),
            }),
          ],
        });
      }).toThrow(InvalidTransactionAccountError);
    });

    it('should reject income with missing category splits', () => {
      expect(() => {
        new Transaction({
          id: 'tx-inc-err-3',
          userId,
          type: 'income',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-19',
          destinationAccountId: accBank,
          items: [],
        });
      }).toThrow(CategorySplitMissingError);
    });

    it('should reject income when split total does not equal transaction amount', () => {
      expect(() => {
        new Transaction({
          id: 'tx-inc-err-4',
          userId,
          type: 'income',
          amount: Money.fromDecimal(500000, 'IDR'),
          transactionDate: '2026-08-19',
          destinationAccountId: accBank,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-inc-err-4',
              categoryId: catSalary,
              amount: Money.fromDecimal(450000, 'IDR'), // 50k short
            }),
          ],
        });
      }).toThrow(TransactionSplitMismatchError);
    });
  });

  describe('Expense Invariants', () => {
    it('should create valid expense with multiple splits matching total', () => {
      // Example from spec: Rp 150.000 -> Food 100.000 + Transport 50.000
      const tx = new Transaction({
        id: 'tx-exp-1',
        userId,
        type: 'expense',
        amount: Money.fromDecimal(150000, 'IDR'),
        transactionDate: '2026-08-19',
        sourceAccountId: accCash,
        items: [
          new TransactionItem({
            id: 'item-1',
            transactionId: 'tx-exp-1',
            categoryId: catFood,
            amount: Money.fromDecimal(100000, 'IDR'),
          }),
          new TransactionItem({
            id: 'item-2',
            transactionId: 'tx-exp-1',
            categoryId: catTransport,
            amount: Money.fromDecimal(50000, 'IDR'),
          }),
        ],
      });

      expect(tx.type).toBe('expense');
      expect(tx.sourceAccountId).toBe(accCash);
      expect(tx.destinationAccountId).toBeNull();
      expect(tx.amount.toDecimal()).toBe(150000);
      expect(tx.items.length).toBe(2);
    });

    it('should reject expense missing source account', () => {
      expect(() => {
        new Transaction({
          id: 'tx-exp-err-1',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-exp-err-1',
              categoryId: catFood,
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        });
      }).toThrow(InvalidTransactionAccountError);
    });

    it('should reject expense with destination account provided', () => {
      expect(() => {
        new Transaction({
          id: 'tx-exp-err-2',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          sourceAccountId: accCash,
          destinationAccountId: accBank,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-exp-err-2',
              categoryId: catFood,
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        });
      }).toThrow(InvalidTransactionAccountError);
    });

    it('should reject expense when split sum is greater than amount', () => {
      expect(() => {
        new Transaction({
          id: 'tx-exp-err-3',
          userId,
          type: 'expense',
          amount: Money.fromDecimal(100000, 'IDR'),
          transactionDate: '2026-08-19',
          sourceAccountId: accCash,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-exp-err-3',
              categoryId: catFood,
              amount: Money.fromDecimal(120000, 'IDR'),
            }),
          ],
        });
      }).toThrow(TransactionSplitMismatchError);
    });
  });

  describe('Transfer Invariants', () => {
    it('should create valid transfer between two different accounts without splits', () => {
      const tx = new Transaction({
        id: 'tx-trf-1',
        userId,
        type: 'transfer',
        amount: Money.fromDecimal(200000, 'IDR'),
        transactionDate: '2026-08-19',
        sourceAccountId: accCash,
        destinationAccountId: accBank,
        items: [],
      });

      expect(tx.type).toBe('transfer');
      expect(tx.sourceAccountId).toBe(accCash);
      expect(tx.destinationAccountId).toBe(accBank);
      expect(tx.items.length).toBe(0);
    });

    it('should reject transfer when source and destination are the same account', () => {
      expect(() => {
        new Transaction({
          id: 'tx-trf-err-1',
          userId,
          type: 'transfer',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          sourceAccountId: accCash,
          destinationAccountId: accCash,
        });
      }).toThrow(TransferSameAccountError);
    });

    it('should reject transfer with category splits', () => {
      expect(() => {
        new Transaction({
          id: 'tx-trf-err-2',
          userId,
          type: 'transfer',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          sourceAccountId: accCash,
          destinationAccountId: accBank,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-trf-err-2',
              categoryId: catTransport,
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        });
      }).toThrow(SplitsNotAllowedError);
    });
  });

  describe('Opening Balance Invariants', () => {
    it('should create valid opening balance with destination account and no splits', () => {
      const tx = new Transaction({
        id: 'tx-op-1',
        userId,
        type: 'opening_balance',
        amount: Money.fromDecimal(1000000, 'IDR'),
        transactionDate: '2026-08-01',
        destinationAccountId: accBank,
        items: [],
      });

      expect(tx.type).toBe('opening_balance');
      expect(tx.destinationAccountId).toBe(accBank);
      expect(tx.sourceAccountId).toBeNull();
      expect(tx.items.length).toBe(0);
    });

    it('should reject opening balance with category splits', () => {
      expect(() => {
        new Transaction({
          id: 'tx-op-err-1',
          userId,
          type: 'opening_balance',
          amount: Money.fromDecimal(1000000, 'IDR'),
          transactionDate: '2026-08-01',
          destinationAccountId: accBank,
          items: [
            new TransactionItem({
              id: 'item-1',
              transactionId: 'tx-op-err-1',
              categoryId: catSalary,
              amount: Money.fromDecimal(1000000, 'IDR'),
            }),
          ],
        });
      }).toThrow(SplitsNotAllowedError);
    });

    it('should reject opening balance with source account', () => {
      expect(() => {
        new Transaction({
          id: 'tx-op-err-2',
          userId,
          type: 'opening_balance',
          amount: Money.fromDecimal(1000000, 'IDR'),
          transactionDate: '2026-08-01',
          sourceAccountId: accCash,
          destinationAccountId: accBank,
        });
      }).toThrow(InvalidTransactionAccountError);
    });
  });

  describe('General Invariants', () => {
    it('should reject non-positive amount (zero or negative)', () => {
      expect(() => {
        new Transaction({
          id: 'tx-err-zero',
          userId,
          type: 'opening_balance',
          amount: Money.zero('IDR'),
          transactionDate: '2026-08-19',
          destinationAccountId: accBank,
        });
      }).toThrow(ValidationError);
    });

    it('should reject invalid date string format', () => {
      expect(() => {
        new Transaction({
          id: 'tx-err-date',
          userId,
          type: 'opening_balance',
          amount: Money.fromDecimal(10000, 'IDR'),
          transactionDate: '19/08/2026', // invalid format (must be YYYY-MM-DD)
          destinationAccountId: accBank,
        });
      }).toThrow(ValidationError);
    });
  });
});
