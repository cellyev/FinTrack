import { SqliteDebtRepository } from '@/features/debts/data/sqlite-debt.repository';
import { Debt } from '@/features/debts/domain/debt';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SqliteDebtRepository', () => {
  let inMemoryDb: InMemoryTestDb;
  let repo: SqliteDebtRepository;

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    repo = new SqliteDebtRepository(async () => inMemoryDb.getDb());
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('creates standalone debt and writes CREATE_DEBT outbox record', async () => {
    const debt = new Debt({
      id: 'debt-101',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Kawan Lama',
      originalAmount: Money.fromMinorUnits(50000000n), // Rp 500.000
      dueDate: '2026-12-31',
      note: 'Pinjam tanpa transfer',
    });

    const result = await repo.create(debt);
    expect(result.success).toBe(true);

    // Verify debts table
    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.debts[0].id).toBe('debt-101');
    expect(inMemoryDb.debts[0].remaining_amount).toBe(50000000);
    expect(inMemoryDb.debts[0].status).toBe('open');

    // Verify outbox
    expect(inMemoryDb.outbox.length).toBe(1);
    expect(inMemoryDb.outbox[0].operation_type).toBe('CREATE_DEBT');
    expect(inMemoryDb.outbox[0].entity_id).toBe('debt-101');

    // Verify no transactions created
    expect(inMemoryDb.transactions.length).toBe(0);
  });

  it('creates debt with initial cash transaction atomically', async () => {
    const debt = new Debt({
      id: 'debt-102',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Bank Mandiri',
      originalAmount: Money.fromMinorUnits(100000000n), // Rp 1.000.000
    });

    const txItem = new TransactionItem({
      id: 'item-1',
      transactionId: 'tx-1',
      categoryId: 'cat-loan',
      amount: Money.fromMinorUnits(100000000n),
    });

    const initialTx = new Transaction({
      id: 'tx-1',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromMinorUnits(100000000n),
      destinationAccountId: 'acc-bca',
      transactionDate: '2026-06-01',
      items: [txItem],
      debtId: 'debt-102',
    });

    const result = await repo.create(debt, initialTx);
    expect(result.success).toBe(true);

    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.transactions.length).toBe(1);
    expect(inMemoryDb.transactions[0].debt_id).toBe('debt-102');
    expect(inMemoryDb.transactionItems.length).toBe(1);

    // 2 outbox records: CREATE_DEBT and CREATE_TRANSACTION
    expect(inMemoryDb.outbox.length).toBe(2);
    expect(inMemoryDb.outbox.map((o) => o.operation_type)).toEqual([
      'CREATE_DEBT',
      'CREATE_TRANSACTION',
    ]);
  });

  it('records partial repayment and creates ledger transaction atomically', async () => {
    const debt = new Debt({
      id: 'debt-103',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Rudi',
      originalAmount: Money.fromMinorUnits(100000000n), // Rp 1.000.000
    });
    await repo.create(debt);

    const paymentAmount = Money.fromMinorUnits(40000000n); // Rp 400.000

    const txItem = new TransactionItem({
      id: 'item-rep-1',
      transactionId: 'tx-rep-1',
      categoryId: 'cat-debt-repay',
      amount: paymentAmount,
    });

    const repTx = new Transaction({
      id: 'tx-rep-1',
      userId: 'user-1',
      type: 'expense',
      amount: paymentAmount,
      sourceAccountId: 'acc-cash',
      transactionDate: '2026-06-15',
      items: [txItem],
      debtId: 'debt-103',
    });

    const repResult = await repo.recordRepayment({
      debtId: 'debt-103',
      userId: 'user-1',
      paymentAmount,
      repaymentTransaction: repTx,
    });

    expect(repResult.success).toBe(true);
    if (repResult.success) {
      expect(repResult.data.remainingAmount.minorUnits).toBe(60000000n);
      expect(repResult.data.status).toBe('open');
      expect(repResult.data.percentageRepaid).toBe(40.0);
    }

    expect(inMemoryDb.debts[0].remaining_amount).toBe(60000000);
    expect(inMemoryDb.debts[0].status).toBe('open');
    expect(inMemoryDb.transactions.length).toBe(1);
    expect(inMemoryDb.transactions[0].debt_id).toBe('debt-103');

    // Total outbox: CREATE_DEBT, UPDATE_DEBT, CREATE_TRANSACTION
    expect(inMemoryDb.outbox.length).toBe(3);
    expect(inMemoryDb.outbox[1].operation_type).toBe('UPDATE_DEBT');
    expect(inMemoryDb.outbox[2].operation_type).toBe('CREATE_TRANSACTION');
  });

  it('records full settlement and marks status settled', async () => {
    const debt = new Debt({
      id: 'debt-104',
      userId: 'user-1',
      type: 'lent',
      personName: 'Siti',
      originalAmount: Money.fromMinorUnits(30000000n), // Rp 300.000
    });
    await repo.create(debt);

    const paymentAmount = Money.fromMinorUnits(30000000n);
    const repResult = await repo.recordRepayment({
      debtId: 'debt-104',
      userId: 'user-1',
      paymentAmount,
    });

    expect(repResult.success).toBe(true);
    if (repResult.success) {
      expect(repResult.data.remainingAmount.minorUnits).toBe(0n);
      expect(repResult.data.status).toBe('settled');
      expect(repResult.data.isSettled).toBe(true);
      expect(repResult.data.percentageRepaid).toBe(100.0);
    }
  });

  it('rejects overpayment beyond remaining amount', async () => {
    const debt = new Debt({
      id: 'debt-105',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Toko Elektronik',
      originalAmount: Money.fromMinorUnits(50000000n), // Rp 500.000
    });
    await repo.create(debt);

    const overpayment = Money.fromMinorUnits(60000000n); // Rp 600.000
    const repResult = await repo.recordRepayment({
      debtId: 'debt-105',
      userId: 'user-1',
      paymentAmount: overpayment,
    });

    expect(repResult.success).toBe(false);
    if (!repResult.success) {
      expect(repResult.error.message).toContain('cannot exceed remaining amount');
    }
    expect(inMemoryDb.debts[0].remaining_amount).toBe(50000000);
  });

  it('updates debt details and creates UPDATE_DEBT outbox record', async () => {
    const debt = new Debt({
      id: 'debt-106',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Original Name',
      originalAmount: Money.fromMinorUnits(10000000n),
    });
    await repo.create(debt);

    const updated = new Debt({
      id: 'debt-106',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Updated Name',
      originalAmount: Money.fromMinorUnits(10000000n),
      dueDate: '2026-11-30',
      note: 'Updated note',
    });

    const result = await repo.update(updated);
    expect(result.success).toBe(true);

    expect(inMemoryDb.debts[0].person_name).toBe('Updated Name');
    expect(inMemoryDb.debts[0].due_date).toBe('2026-11-30');
    expect(inMemoryDb.outbox[1].operation_type).toBe('UPDATE_DEBT');
  });

  it('soft deletes debt and creates DELETE_DEBT outbox record', async () => {
    const debt = new Debt({
      id: 'debt-107',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'To Delete',
      originalAmount: Money.fromMinorUnits(10000000n),
    });
    await repo.create(debt);

    const delResult = await repo.softDelete('debt-107', 'user-1');
    expect(delResult.success).toBe(true);

    expect(inMemoryDb.debts[0].deleted_at).not.toBeNull();
    expect(inMemoryDb.outbox[1].operation_type).toBe('DELETE_DEBT');

    // Not returned in listActive
    const list = await repo.listActive('user-1');
    expect(list.success).toBe(true);
    if (list.success) {
      expect(list.data.length).toBe(0);
    }
  });

  it('enforces user isolation in queries and mutations', async () => {
    const debtUser1 = new Debt({
      id: 'debt-u1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'User 1 Debt',
      originalAmount: Money.fromMinorUnits(10000000n),
    });
    await repo.create(debtUser1);

    // User 2 cannot see or modify User 1 debt
    const getU2 = await repo.getById('debt-u1', 'user-2');
    expect(getU2.success).toBe(true);
    if (getU2.success) {
      expect(getU2.data).toBeNull();
    }

    const repU2 = await repo.recordRepayment({
      debtId: 'debt-u1',
      userId: 'user-2',
      paymentAmount: Money.fromMinorUnits(5000000n),
    });
    expect(repU2.success).toBe(false);
  });
});
