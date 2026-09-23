import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';
import { SqliteBudgetRepository } from '@/features/budgets/data/sqlite-budget.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { CreateBudgetUseCase } from '@/features/budgets/application/create-budget.usecase';
import { UpdateBudgetUseCase } from '@/features/budgets/application/update-budget.usecase';
import { SoftDeleteBudgetUseCase } from '@/features/budgets/application/soft-delete-budget.usecase';
import { GetBudgetProgressUseCase } from '@/features/budgets/application/get-budget-progress.usecase';
import { ListBudgetsWithProgressUseCase } from '@/features/budgets/application/list-budgets-with-progress.usecase';
import { IClock } from '@/core/domain/clock.interface';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

describe('Budget Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let budgetRepo: SqliteBudgetRepository;
  let categoryRepo: SqliteCategoryRepository;

  const mockClock: IClock = {
    now: () => new Date('2026-08-15T12:00:00.000Z'),
    todayDateString: () => '2026-08-15',
  };

  let uuidCounter = 1;
  const mockUuidGenerator: IUuidGenerator = {
    generate: () => `bg-${uuidCounter++}`,
    isValid: () => true,
  };

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    uuidCounter = 1;
    budgetRepo = new SqliteBudgetRepository(async () => testDb.getDb());
    categoryRepo = new SqliteCategoryRepository(async () => testDb.getDb());

    // Seed test expense category
    testDb.tables.get('categories')?.push({
      id: 'cat-food',
      user_id: 'user-1',
      name: 'Makanan',
      type: 'expense',
      icon: '🍔',
      color: '#EF4444',
      is_system: 0,
      is_active: 1,
      sort_order: 0,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
      deleted_at: null,
    });

    // Seed test income category
    testDb.tables.get('categories')?.push({
      id: 'cat-salary',
      user_id: 'user-1',
      name: 'Gaji',
      type: 'income',
      icon: '💵',
      color: '#10B981',
      is_system: 0,
      is_active: 1,
      sort_order: 0,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
      deleted_at: null,
    });
  });

  describe('CreateBudgetUseCase', () => {
    it('should create a budget successfully for an expense category', async () => {
      const useCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );

      const result = await useCase.execute({
        userId: 'user-1',
        categoryId: 'cat-food',
        name: 'Makan Agustus',
        amountMinorUnits: 150000000, // Rp 1.500.000
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('bg-1');
        expect(result.data.name).toBe('Makan Agustus');
        expect(result.data.amount.minorUnits).toBe(150000000n);
      }
    });

    it('should reject budget creation for an income category', async () => {
      const useCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );

      const result = await useCase.execute({
        userId: 'user-1',
        categoryId: 'cat-salary',
        amountMinorUnits: 150000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('expense categories');
      }
    });

    it('should reject budget creation for non-existent or deleted category', async () => {
      const useCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );

      const result = await useCase.execute({
        userId: 'user-1',
        categoryId: 'cat-nonexistent',
        amountMinorUnits: 150000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe('NotFoundError');
      }
    });

    it('should reject budget creation with invalid date range', async () => {
      const useCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );

      const result = await useCase.execute({
        userId: 'user-1',
        categoryId: 'cat-food',
        amountMinorUnits: 150000000,
        periodType: 'custom',
        startDate: '2026-08-31',
        endDate: '2026-08-01',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('cannot be after end date');
      }
    });
  });

  describe('UpdateBudgetUseCase', () => {
    it('should update existing budget successfully', async () => {
      const createUseCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );
      const created = await createUseCase.execute({
        userId: 'user-1',
        categoryId: 'cat-food',
        name: 'Makan Awal',
        amountMinorUnits: 100000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const updateUseCase = new UpdateBudgetUseCase(budgetRepo, mockClock);
      const updateResult = await updateUseCase.execute({
        id: created.data.id,
        userId: 'user-1',
        name: 'Makan Diubah',
        amountMinorUnits: 120000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.name).toBe('Makan Diubah');
        expect(updateResult.data.amount.minorUnits).toBe(120000000n);
      }
    });

    it('should return NotFoundError when updating non-existent budget', async () => {
      const updateUseCase = new UpdateBudgetUseCase(budgetRepo, mockClock);
      const result = await updateUseCase.execute({
        id: 'bg-nonexistent',
        userId: 'user-1',
        amountMinorUnits: 120000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe('NotFoundError');
      }
    });
  });

  describe('SoftDeleteBudgetUseCase', () => {
    it('should soft delete existing budget', async () => {
      const createUseCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );
      const created = await createUseCase.execute({
        userId: 'user-1',
        categoryId: 'cat-food',
        amountMinorUnits: 100000000,
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const deleteUseCase = new SoftDeleteBudgetUseCase(budgetRepo);
      const deleteResult = await deleteUseCase.execute({
        id: created.data.id,
        userId: 'user-1',
      });

      expect(deleteResult.success).toBe(true);

      const fetchResult = await budgetRepo.getById(created.data.id, 'user-1');
      expect(fetchResult.success).toBe(true);
      if (fetchResult.success) {
        expect(fetchResult.data).toBeNull();
      }
    });
  });

  describe('GetBudgetProgressUseCase & ListBudgetsWithProgressUseCase', () => {
    it('should calculate budget progress joining category and spending', async () => {
      const createUseCase = new CreateBudgetUseCase(
        budgetRepo,
        categoryRepo,
        mockUuidGenerator,
        mockClock
      );
      const created = await createUseCase.execute({
        userId: 'user-1',
        categoryId: 'cat-food',
        amountMinorUnits: 100000000, // Rp 1.000.000
        periodType: 'monthly',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      // Add spending transaction (Rp 400.000)
      testDb.tables.get('transactions')?.push({
        id: 'tx-1',
        user_id: 'user-1',
        type: 'expense',
        amount: 40000000,
        transaction_date: '2026-08-10',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-1',
        user_id: 'user-1',
        transaction_id: 'tx-1',
        category_id: 'cat-food',
        amount: 40000000,
        deleted_at: null,
      });

      const getProgressUseCase = new GetBudgetProgressUseCase(budgetRepo, categoryRepo);
      const progressResult = await getProgressUseCase.execute({
        budgetId: created.data.id,
        userId: 'user-1',
      });

      expect(progressResult.success).toBe(true);
      if (progressResult.success) {
        const progress = progressResult.data;
        expect(progress.categoryName).toBe('Makanan');
        expect(progress.categoryIcon).toBe('🍔');
        expect(progress.actualSpending.minorUnits).toBe(40000000n);
        expect(progress.remainingAmount.minorUnits).toBe(60000000n);
        expect(progress.percentageUsed).toBe(40);
        expect(progress.isOverBudget).toBe(false);
      }

      const listUseCase = new ListBudgetsWithProgressUseCase(budgetRepo, categoryRepo);
      const listResult = await listUseCase.execute({ userId: 'user-1' });

      expect(listResult.success).toBe(true);
      if (listResult.success) {
        expect(listResult.data.length).toBe(1);
        expect(listResult.data[0].categoryName).toBe('Makanan');
      }
    });
  });
});
