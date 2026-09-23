import { SqliteSavingsGoalRepository } from '@/features/savings-goals/data/sqlite-savings-goal.repository';
import { CreateSavingsGoalUseCase } from '@/features/savings-goals/application/create-savings-goal.usecase';
import { UpdateSavingsGoalUseCase } from '@/features/savings-goals/application/update-savings-goal.usecase';
import { SoftDeleteSavingsGoalUseCase } from '@/features/savings-goals/application/soft-delete-savings-goal.usecase';
import { GetSavingsGoalProgressUseCase } from '@/features/savings-goals/application/get-savings-goal-progress.usecase';
import { ListSavingsGoalsUseCase } from '@/features/savings-goals/application/list-savings-goals.usecase';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('Savings Goal Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let repo: SqliteSavingsGoalRepository;
  let createUseCase: CreateSavingsGoalUseCase;
  let updateUseCase: UpdateSavingsGoalUseCase;
  let deleteUseCase: SoftDeleteSavingsGoalUseCase;
  let getProgressUseCase: GetSavingsGoalProgressUseCase;
  let listUseCase: ListSavingsGoalsUseCase;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repo = new SqliteSavingsGoalRepository(async () => testDb.getDb());
    createUseCase = new CreateSavingsGoalUseCase(repo);
    updateUseCase = new UpdateSavingsGoalUseCase(repo);
    deleteUseCase = new SoftDeleteSavingsGoalUseCase(repo);
    getProgressUseCase = new GetSavingsGoalProgressUseCase(repo);
    listUseCase = new ListSavingsGoalsUseCase(repo);
  });

  it('should create a savings goal with valid inputs', async () => {
    const result = await createUseCase.execute({
      userId: 'user-1',
      name: 'Dana Darurat',
      targetAmountMinorUnits: 1000000000,
      currentAmountMinorUnits: 200000000,
      targetDate: '2026-12-31',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Dana Darurat');
    expect(result.data.targetAmount.minorUnits).toBe(1000000000n);
    expect(result.data.currentAmount.minorUnits).toBe(200000000n);
  });

  it('should validate inputs on creation', async () => {
    // Empty name
    const res1 = await createUseCase.execute({
      userId: 'user-1',
      name: '',
      targetAmountMinorUnits: 1000000,
    });
    expect(res1.success).toBe(false);

    // Negative target
    const res2 = await createUseCase.execute({
      userId: 'user-1',
      name: 'Test',
      targetAmountMinorUnits: 0,
    });
    expect(res2.success).toBe(false);

    // Current > Target
    const res3 = await createUseCase.execute({
      userId: 'user-1',
      name: 'Test',
      targetAmountMinorUnits: 1000000,
      currentAmountMinorUnits: 2000000,
    });
    expect(res3.success).toBe(false);

    // Invalid date
    const res4 = await createUseCase.execute({
      userId: 'user-1',
      name: 'Test',
      targetAmountMinorUnits: 1000000,
      targetDate: 'invalid-date',
    });
    expect(res4.success).toBe(false);
  });

  it('should update an existing goal', async () => {
    const created = await createUseCase.execute({
      userId: 'user-1',
      name: 'Laptop Baru',
      targetAmountMinorUnits: 1500000000,
      currentAmountMinorUnits: 500000000,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = await updateUseCase.execute({
      id: created.data.id,
      userId: 'user-1',
      name: 'Laptop Gaming Baru',
      targetAmountMinorUnits: 2000000000,
      currentAmountMinorUnits: 1000000000,
      targetDate: '2026-11-30',
    });

    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.name).toBe('Laptop Gaming Baru');
    expect(updated.data.targetAmount.minorUnits).toBe(2000000000n);
    expect(updated.data.currentAmount.minorUnits).toBe(1000000000n);
  });

  it('should fetch progress metrics for a goal', async () => {
    const created = await createUseCase.execute({
      userId: 'user-1',
      name: 'Liburan',
      targetAmountMinorUnits: 1000000000,
      currentAmountMinorUnits: 200000000,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const progressResult = await getProgressUseCase.execute({
      id: created.data.id,
      userId: 'user-1',
    });

    expect(progressResult.success).toBe(true);
    if (!progressResult.success) return;
    expect(progressResult.data.percentageCompleted).toBe(20.0);
    expect(progressResult.data.remainingAmount.minorUnits).toBe(800000000n);
    expect(progressResult.data.isCompleted).toBe(false);
  });

  it('should soft-delete a savings goal', async () => {
    const created = await createUseCase.execute({
      userId: 'user-1',
      name: 'Target Batal',
      targetAmountMinorUnits: 500000000,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const delRes = await deleteUseCase.execute({
      id: created.data.id,
      userId: 'user-1',
    });
    expect(delRes.success).toBe(true);

    const listRes = await listUseCase.execute({ userId: 'user-1' });
    expect(listRes.success).toBe(true);
    if (!listRes.success || !listRes.data) return;
    expect(listRes.data.length).toBe(0);
  });
});
