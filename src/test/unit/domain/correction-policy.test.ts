import { SevenDayCorrectionPolicy } from '@/features/transactions/domain/policies/correction-window-policy';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { MockClock } from '../../mocks/mock-clock';

describe('SevenDayCorrectionPolicy Domain Contract', () => {
  let mockClock: MockClock;

  beforeEach(() => {
    // Reference time: 2026-08-19T12:00:00Z
    mockClock = new MockClock(new Date('2026-08-19T12:00:00.000Z'));
  });

  it('should allow correction for transaction created today (0 days old)', () => {
    const policy = new SevenDayCorrectionPolicy(mockClock, 'transaction_date');
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-19',
      sourceAccountId: 'acc-1',
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-1',
          categoryId: 'cat-1',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    expect(policy.isEligibleForCorrection(tx)).toBe(true);
    expect(policy.daysRemaining(tx)).toBe(7);
  });

  it('should allow correction for transaction 6 days old', () => {
    const policy = new SevenDayCorrectionPolicy(mockClock, 'transaction_date');
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-13', // 6 days before Aug 19
      sourceAccountId: 'acc-1',
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-1',
          categoryId: 'cat-1',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    expect(policy.isEligibleForCorrection(tx)).toBe(true);
    expect(policy.daysRemaining(tx)).toBe(1);
  });

  it('should reject correction for transaction 8 days old', () => {
    const policy = new SevenDayCorrectionPolicy(mockClock, 'transaction_date');
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromDecimal(50000, 'IDR'),
      transactionDate: '2026-08-11', // 8 days before Aug 19
      sourceAccountId: 'acc-1',
      items: [
        new TransactionItem({
          id: 'item-1',
          transactionId: 'tx-1',
          categoryId: 'cat-1',
          amount: Money.fromDecimal(50000, 'IDR'),
        }),
      ],
    });

    expect(policy.isEligibleForCorrection(tx)).toBe(false);
    expect(policy.daysRemaining(tx)).toBe(0);
  });

  it('should reject correction for soft-deleted transaction', () => {
    const policy = new SevenDayCorrectionPolicy(mockClock, 'transaction_date');
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'opening_balance',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-19',
      destinationAccountId: 'acc-1',
    });

    tx.markDeleted();
    expect(policy.isEligibleForCorrection(tx)).toBe(false);
    expect(policy.daysRemaining(tx)).toBe(0);
  });

  it('should evaluate correctly when created_at anchor is selected', () => {
    const policy = new SevenDayCorrectionPolicy(mockClock, 'created_at');
    const tx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'opening_balance',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-01', // Date is old
      destinationAccountId: 'acc-1',
      createdAt: new Date('2026-08-18T10:00:00.000Z'), // but created yesterday
    });

    expect(policy.isEligibleForCorrection(tx)).toBe(true);
  });
});
