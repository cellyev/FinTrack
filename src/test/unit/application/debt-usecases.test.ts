import { CreateDebtUseCase } from '@/features/debts/application/create-debt.usecase';
import { RecordRepaymentUseCase } from '@/features/debts/application/record-repayment.usecase';
import { UpdateDebtUseCase } from '@/features/debts/application/update-debt.usecase';
import { SoftDeleteDebtUseCase } from '@/features/debts/application/soft-delete-debt.usecase';
import { ListDebtsUseCase } from '@/features/debts/application/list-debts.usecase';
import { GetDebtSummaryUseCase } from '@/features/debts/application/get-debt-summary.usecase';
import { GetDebtDetailUseCase } from '@/features/debts/application/get-debt-detail.usecase';
import { SqliteDebtRepository } from '@/features/debts/data/sqlite-debt.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

class MockUuidGenerator implements IUuidGenerator {
  private count = 0;
  generate(): string {
    return `mock-uuid-${++this.count}`;
  }
  isValid(_id: string): boolean {
    return true;
  }
}

describe('Debt Use Cases', () => {
  let inMemoryDb: InMemoryTestDb;
  let debtRepo: SqliteDebtRepository;
  let txRepo: SqliteTransactionRepository;
  let uuidGen: IUuidGenerator;

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    debtRepo = new SqliteDebtRepository(async () => inMemoryDb.getDb());
    txRepo = new SqliteTransactionRepository(async () => inMemoryDb.getDb());
    uuidGen = new MockUuidGenerator();
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('CreateDebtUseCase creates standalone debt without ledger transaction', async () => {
    const useCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const result = await useCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Rina',
      amountMinorUnits: 200000000, // Rp 2.000.000
      dueDate: '2026-12-31',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personName).toBe('Rina');
      expect(result.data.originalAmount.minorUnits).toBe(200000000n);
      expect(result.data.remainingAmount.minorUnits).toBe(200000000n);
      expect(result.data.status).toBe('open');
    }

    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.transactions.length).toBe(0);
  });

  it('CreateDebtUseCase creates borrowed debt with initial cash received (income transaction)', async () => {
    const useCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const result = await useCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Koperasi Karyawan',
      amountMinorUnits: 500000000, // Rp 5.000.000
      dueDate: '2027-01-01',
      initialAccountMovement: {
        accountId: 'acc-bca',
        categoryId: 'cat-loan-in',
        transactionDate: '2026-06-01',
        note: 'Pencairan pinjaman koperasi',
      },
    });

    expect(result.success).toBe(true);
    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.transactions.length).toBe(1);

    const tx = inMemoryDb.transactions[0];
    expect(tx.type).toBe('income');
    expect(tx.destination_account_id).toBe('acc-bca');
    expect(tx.amount).toBe(500000000);
    if (result.success) {
      expect(tx.debt_id).toBe(result.data.id);
    }
  });

  it('CreateDebtUseCase creates lent debt with cash disbursed (expense transaction)', async () => {
    const useCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const result = await useCase.execute({
      userId: 'user-1',
      type: 'lent',
      personName: 'Adik Kandung',
      amountMinorUnits: 150000000, // Rp 1.500.000
      dueDate: '2026-09-01',
      initialAccountMovement: {
        accountId: 'acc-wallet',
        categoryId: 'cat-lent-out',
      },
    });

    expect(result.success).toBe(true);
    expect(inMemoryDb.debts.length).toBe(1);
    expect(inMemoryDb.transactions.length).toBe(1);

    const tx = inMemoryDb.transactions[0];
    expect(tx.type).toBe('expense');
    expect(tx.source_account_id).toBe('acc-wallet');
    expect(tx.amount).toBe(150000000);
    if (result.success) {
      expect(tx.debt_id).toBe(result.data.id);
    }
  });

  it('RecordRepaymentUseCase processes payment and links transaction', async () => {
    const createUseCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Om Agus',
      amountMinorUnits: 100000000, // Rp 1.000.000
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const debtId = createRes.data.id;

    const repUseCase = new RecordRepaymentUseCase(debtRepo, uuidGen);
    const repRes = await repUseCase.execute({
      debtId,
      userId: 'user-1',
      paymentAmountMinorUnits: 40000000, // Rp 400.000
      accountId: 'acc-bca',
      categoryId: 'cat-repay',
      transactionDate: '2026-06-10',
      note: 'Cicilan 1',
    });

    expect(repRes.success).toBe(true);
    if (repRes.success) {
      expect(repRes.data.remainingAmount.minorUnits).toBe(60000000n);
      expect(repRes.data.status).toBe('open');
    }

    expect(inMemoryDb.transactions.length).toBe(1);
    const tx = inMemoryDb.transactions[0];
    expect(tx.type).toBe('expense');
    expect(tx.debt_id).toBe(debtId);
    expect(tx.amount).toBe(40000000);
  });

  it('GetDebtDetailUseCase fetches debt and its linked transaction history', async () => {
    const createUseCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Teman Kantor',
      amountMinorUnits: 100000000,
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const debtId = createRes.data.id;

    const repUseCase = new RecordRepaymentUseCase(debtRepo, uuidGen);
    await repUseCase.execute({
      debtId,
      userId: 'user-1',
      paymentAmountMinorUnits: 30000000,
      accountId: 'acc-cash',
      categoryId: 'cat-repay',
    });

    await repUseCase.execute({
      debtId,
      userId: 'user-1',
      paymentAmountMinorUnits: 70000000,
      accountId: 'acc-cash',
      categoryId: 'cat-repay',
    });

    const detailUseCase = new GetDebtDetailUseCase(debtRepo, txRepo);
    const detailRes = await detailUseCase.execute({
      id: debtId,
      userId: 'user-1',
    });

    expect(detailRes.success).toBe(true);
    if (detailRes.success) {
      expect(detailRes.data.debt.isSettled).toBe(true);
      expect(detailRes.data.transactions.length).toBe(2);
    }
  });

  it('GetDebtSummaryUseCase computes aggregate totals', async () => {
    const createUseCase = new CreateDebtUseCase(debtRepo, uuidGen);
    await createUseCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Hutang A',
      amountMinorUnits: 100000000,
    });
    await createUseCase.execute({
      userId: 'user-1',
      type: 'lent',
      personName: 'Piutang B',
      amountMinorUnits: 50000000,
    });

    const summaryUseCase = new GetDebtSummaryUseCase(debtRepo);
    const summaryRes = await summaryUseCase.execute({ userId: 'user-1' });

    expect(summaryRes.success).toBe(true);
    if (summaryRes.success) {
      expect(summaryRes.data.totalBorrowedRemaining.minorUnits).toBe(100000000n);
      expect(summaryRes.data.totalLentRemaining.minorUnits).toBe(50000000n);
      expect(summaryRes.data.openCount).toBe(2);
    }
  });

  it('UpdateDebtUseCase, ListDebtsUseCase, and SoftDeleteDebtUseCase work correctly', async () => {
    const createUseCase = new CreateDebtUseCase(debtRepo, uuidGen);
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Hutang Awal',
      amountMinorUnits: 100000000,
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const debtId = createRes.data.id;

    // Update
    const updateUseCase = new UpdateDebtUseCase(debtRepo);
    const updateRes = await updateUseCase.execute({
      id: debtId,
      userId: 'user-1',
      personName: 'Hutang Diperbarui',
      dueDate: '2026-12-31',
    });
    expect(updateRes.success).toBe(true);

    // List
    const listUseCase = new ListDebtsUseCase(debtRepo);
    const listRes = await listUseCase.execute({ userId: 'user-1' });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(1);
      expect(listRes.data[0].personName).toBe('Hutang Diperbarui');
    }

    // Soft Delete
    const deleteUseCase = new SoftDeleteDebtUseCase(debtRepo);
    const delRes = await deleteUseCase.execute({ id: debtId, userId: 'user-1' });
    expect(delRes.success).toBe(true);

    const listAfterDel = await listUseCase.execute({ userId: 'user-1' });
    expect(listAfterDel.success).toBe(true);
    if (listAfterDel.success) {
      expect(listAfterDel.data.length).toBe(0);
    }
  });
});
