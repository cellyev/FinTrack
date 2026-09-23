import { CreateRecurringTransactionUseCase } from '@/features/recurring-transactions/application/create-recurring-transaction.usecase';
import { ProcessDueRecurringTransactionsUseCase } from '@/features/recurring-transactions/application/process-due-recurring.usecase';
import { ToggleRecurringActiveUseCase } from '@/features/recurring-transactions/application/toggle-recurring-active.usecase';
import { UpdateRecurringTransactionUseCase } from '@/features/recurring-transactions/application/update-recurring-transaction.usecase';
import { SoftDeleteRecurringTransactionUseCase } from '@/features/recurring-transactions/application/soft-delete-recurring.usecase';
import { ListRecurringTransactionsUseCase } from '@/features/recurring-transactions/application/list-recurring-transactions.usecase';
import { GetRecurringSummaryUseCase } from '@/features/recurring-transactions/application/get-recurring-summary.usecase';
import { SqliteRecurringTransactionRepository } from '@/features/recurring-transactions/data/sqlite-recurring.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Recurring Transactions Application Use Cases', () => {
  let inMemoryDb: InMemoryTestDb;
  let repo: SqliteRecurringTransactionRepository;
  let createUseCase: CreateRecurringTransactionUseCase;
  let processDueUseCase: ProcessDueRecurringTransactionsUseCase;
  let toggleActiveUseCase: ToggleRecurringActiveUseCase;
  let updateUseCase: UpdateRecurringTransactionUseCase;
  let deleteUseCase: SoftDeleteRecurringTransactionUseCase;
  let listUseCase: ListRecurringTransactionsUseCase;
  let summaryUseCase: GetRecurringSummaryUseCase;

  let idCounter = 1;
  const mockUuidGenerator = {
    generate: () => `mock-uuid-${idCounter++}`,
    isValid: (_id: string) => true,
  };

  beforeEach(() => {
    inMemoryDb = new InMemoryTestDb();
    repo = new SqliteRecurringTransactionRepository(async () => inMemoryDb.getDb());
    createUseCase = new CreateRecurringTransactionUseCase(repo, mockUuidGenerator);
    processDueUseCase = new ProcessDueRecurringTransactionsUseCase(repo, mockUuidGenerator);
    toggleActiveUseCase = new ToggleRecurringActiveUseCase(repo);
    updateUseCase = new UpdateRecurringTransactionUseCase(repo);
    deleteUseCase = new SoftDeleteRecurringTransactionUseCase(repo);
    listUseCase = new ListRecurringTransactionsUseCase(repo);
    summaryUseCase = new GetRecurringSummaryUseCase(repo);
  });

  afterEach(() => {
    inMemoryDb.reset();
  });

  it('creates recurring transaction successfully', async () => {
    const res = await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 50000000, // Rp 500.000
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-06-01',
      note: 'Spotify Family Plan',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBeDefined();
      expect(res.data.amount.minorUnits).toBe(50000000n);
      expect(res.data.nextOccurrence).toBe('2026-06-01');
      expect(res.data.isActive).toBe(true);
    }
  });

  it('processes multiple overdue occurrences sequentially up to referenceDate', async () => {
    // Schedule started 2026-05-01 (monthly), referenceDate is 2026-08-19
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 15000000, // Rp 150.000
      accountId: 'acc-bca',
      categoryId: 'cat-subs',
      frequency: 'monthly',
      startDate: '2026-05-01',
      note: 'Gym Membership',
    });
    expect(createRes.success).toBe(true);

    const procRes = await processDueUseCase.execute({
      userId: 'user-1',
      referenceDate: '2026-08-19',
    });

    expect(procRes.success).toBe(true);
    if (procRes.success) {
      expect(procRes.data.generatedTransactionsCount).toBe(4);
      expect(procRes.data.generatedTransactions.map((t) => t.transactionDate)).toEqual([
        '2026-05-01',
        '2026-06-01',
        '2026-07-01',
        '2026-08-01',
      ]);
    }

    // Next occurrence should now be 2026-09-01
    const listRes = await listUseCase.execute({ userId: 'user-1' });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data[0].nextOccurrence).toBe('2026-09-01');
    }
  });

  it('correctly maps sourceAccountId for expense and destinationAccountId for income', async () => {
    // 1. Expense recurring
    const expRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 25000000,
      accountId: 'acc-source',
      categoryId: 'cat-util',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });
    expect(expRes.success).toBe(true);

    // 2. Income recurring
    const incRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'income',
      amountMinorUnits: 1000000000,
      accountId: 'acc-dest',
      categoryId: 'cat-salary',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });
    expect(incRes.success).toBe(true);

    const procRes = await processDueUseCase.execute({
      userId: 'user-1',
      referenceDate: '2026-06-01',
    });

    expect(procRes.success).toBe(true);
    if (procRes.success) {
      expect(procRes.data.generatedTransactionsCount).toBe(2);

      const expTx = procRes.data.generatedTransactions.find((t) => t.type === 'expense');
      expect(expTx?.sourceAccountId).toBe('acc-source');
      expect(expTx?.destinationAccountId).toBeNull();

      const incTx = procRes.data.generatedTransactions.find((t) => t.type === 'income');
      expect(incTx?.sourceAccountId).toBeNull();
      expect(incTx?.destinationAccountId).toBe('acc-dest');
    }
  });

  it('toggles active/paused state', async () => {
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 50000000,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const recId = createRes.data.id;

    // Pause
    const pauseRes = await toggleActiveUseCase.execute({
      id: recId,
      userId: 'user-1',
      isActive: false,
    });
    expect(pauseRes.success).toBe(true);
    if (pauseRes.success) {
      expect(pauseRes.data.isActive).toBe(false);
    }

    // Resume
    const resumeRes = await toggleActiveUseCase.execute({
      id: recId,
      userId: 'user-1',
      isActive: true,
    });
    expect(resumeRes.success).toBe(true);
    if (resumeRes.success) {
      expect(resumeRes.data.isActive).toBe(true);
    }
  });

  it('updates and deletes recurring transaction', async () => {
    const createRes = await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 50000000,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const recId = createRes.data.id;

    const updateRes = await updateUseCase.execute({
      id: recId,
      userId: 'user-1',
      amountMinorUnits: 65000000,
      note: 'Updated plan',
    });
    expect(updateRes.success).toBe(true);
    if (updateRes.success) {
      expect(updateRes.data.amount.minorUnits).toBe(65000000n);
      expect(updateRes.data.note).toBe('Updated plan');
    }

    const delRes = await deleteUseCase.execute({ id: recId, userId: 'user-1' });
    expect(delRes.success).toBe(true);

    const listRes = await listUseCase.execute({ userId: 'user-1' });
    expect(listRes.success).toBe(true);
    if (listRes.success) {
      expect(listRes.data.length).toBe(0);
    }
  });

  it('computes recurring summary correctly via GetRecurringSummaryUseCase', async () => {
    await createUseCase.execute({
      userId: 'user-1',
      type: 'expense',
      amountMinorUnits: 100000000, // Rp 1.000.000 / bln
      accountId: 'acc-1',
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });

    await createUseCase.execute({
      userId: 'user-1',
      type: 'income',
      amountMinorUnits: 500000000, // Rp 5.000.000 / bln
      accountId: 'acc-1',
      categoryId: 'cat-2',
      frequency: 'monthly',
      startDate: '2026-06-01',
    });

    const summaryRes = await summaryUseCase.execute({
      userId: 'user-1',
      referenceDate: '2026-06-01',
    });

    expect(summaryRes.success).toBe(true);
    if (summaryRes.success) {
      expect(summaryRes.data.totalActiveCount).toBe(2);
      expect(summaryRes.data.dueCount).toBe(2);
      expect(summaryRes.data.totalMonthlyExpenseCommitment.minorUnits).toBe(100000000n);
      expect(summaryRes.data.totalMonthlyIncomeCommitment.minorUnits).toBe(500000000n);
    }
  });
});
