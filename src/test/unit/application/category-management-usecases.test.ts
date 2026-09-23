import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  ArchiveCategoryUseCase,
  EnsureDefaultCategoriesUseCase,
  GetCategoryUseCase,
} from '@/features/categories/application/category.usecases';
import { Category } from '@/features/categories/domain/category';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

describe('Category Management Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let categoryRepo: SqliteCategoryRepository;
  let uuidGen: IUuidGenerator;

  let createCategory: CreateCategoryUseCase;
  let updateCategory: UpdateCategoryUseCase;
  let archiveCategory: ArchiveCategoryUseCase;
  let getCategory: GetCategoryUseCase;
  let ensureDefaults: EnsureDefaultCategoriesUseCase;

  const userId = 'user-cat-mgmt-1';

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    categoryRepo = new SqliteCategoryRepository(async () => testDb.getDb());
    let idCounter = 0;
    uuidGen = {
      generate: () => `mock-cat-uuid-${++idCounter}`,
      isValid: (_id: string) => true,
    };

    createCategory = new CreateCategoryUseCase(categoryRepo, uuidGen);
    updateCategory = new UpdateCategoryUseCase(categoryRepo);
    archiveCategory = new ArchiveCategoryUseCase(categoryRepo);
    getCategory = new GetCategoryUseCase(categoryRepo);
    ensureDefaults = new EnsureDefaultCategoriesUseCase(categoryRepo, uuidGen);
  });

  describe('CreateCategoryUseCase', () => {
    it('should successfully create a custom category', async () => {
      const result = await createCategory.execute({
        userId,
        name: 'Kopi & Cafe',
        type: 'expense',
        icon: '☕',
        color: '#6F4E37',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Kopi & Cafe');
        expect(result.data.isSystem).toBe(false);
      }
    });

    it('should reject empty or whitespace-only category name', async () => {
      const result = await createCategory.execute({
        userId,
        name: '   ',
        type: 'expense',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Nama kategori wajib diisi');
      }
    });

    it('should reject duplicate category name for the same user and type', async () => {
      await createCategory.execute({
        userId,
        name: 'Makanan Hewan',
        type: 'expense',
      });

      // Try creating duplicate with different casing/whitespace
      const duplicateResult = await createCategory.execute({
        userId,
        name: '  makanan hewan  ',
        type: 'expense',
      });

      expect(duplicateResult.success).toBe(false);
      if (!duplicateResult.success) {
        expect(duplicateResult.error.message).toContain('sudah ada');
      }
    });

    it('should allow same category name across different types (Expense vs Income)', async () => {
      await createCategory.execute({
        userId,
        name: 'Investasi',
        type: 'expense',
      });

      const incomeResult = await createCategory.execute({
        userId,
        name: 'Investasi',
        type: 'income',
      });

      expect(incomeResult.success).toBe(true);
    });
  });

  describe('UpdateCategoryUseCase', () => {
    it('should update custom category name, icon, and color', async () => {
      const cat = new Category({
        id: 'cat-custom-edit',
        userId,
        name: 'Hobi Lama',
        type: 'expense',
        icon: '🎮',
        color: '#9C27B0',
        isSystem: false,
      });
      await categoryRepo.create(cat);

      const result = await updateCategory.execute({
        id: 'cat-custom-edit',
        userId,
        name: 'Hobi & Game Baru',
        icon: '🕹️',
        color: '#E91E63',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Hobi & Game Baru');
        expect(result.data.icon).toBe('🕹️');
        expect(result.data.color).toBe('#E91E63');
      }
    });

    it('should prevent updating system categories', async () => {
      const sysCat = new Category({
        id: 'cat-sys-edit',
        userId,
        name: 'Makanan & Minuman',
        type: 'expense',
        isSystem: true,
      });
      await categoryRepo.create(sysCat);

      const result = await updateCategory.execute({
        id: 'cat-sys-edit',
        userId,
        name: 'Makanan Baru',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Kategori sistem tidak dapat diubah');
      }
    });

    it('should reject renaming to an existing duplicate category name', async () => {
      await categoryRepo.create(new Category({ id: 'c1', userId, name: 'Belanja', type: 'expense' }));
      await categoryRepo.create(new Category({ id: 'c2', userId, name: 'Hiburan', type: 'expense' }));

      const renameResult = await updateCategory.execute({
        id: 'c2',
        userId,
        name: 'Belanja',
      });

      expect(renameResult.success).toBe(false);
      if (!renameResult.success) {
        expect(renameResult.error.message).toContain('sudah ada');
      }
    });
  });

  describe('GetCategoryUseCase', () => {
    it('should find category by ID for active user', async () => {
      await categoryRepo.create(new Category({ id: 'c-find', userId, name: 'Cari Saya', type: 'expense' }));
      const result = await getCategory.execute('c-find', userId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.name).toBe('Cari Saya');
      }
    });
  });

  describe('ArchiveCategoryUseCase', () => {
    it('should soft delete custom category', async () => {
      const cat = new Category({
        id: 'cat-to-archive',
        userId,
        name: 'Langganan Lama',
        type: 'expense',
        isSystem: false,
      });
      await categoryRepo.create(cat);

      const result = await archiveCategory.execute('cat-to-archive', userId);
      expect(result.success).toBe(true);

      const listResult = await categoryRepo.listByUser(userId, 'expense', false);
      if (listResult.success) {
        expect(listResult.data.some((c) => c.id === 'cat-to-archive')).toBe(false);
      }
    });

    it('should prevent archiving system categories', async () => {
      const sysCat = new Category({
        id: 'cat-sys-arch',
        userId,
        name: 'Transportasi',
        type: 'expense',
        isSystem: true,
      });
      await categoryRepo.create(sysCat);

      const result = await archiveCategory.execute('cat-sys-arch', userId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Kategori sistem tidak dapat diarsipkan');
      }
    });
  });

  describe('EnsureDefaultCategoriesUseCase', () => {
    it('should seed default categories if user has 0 categories, and return existing if already seeded', async () => {
      const firstRun = await ensureDefaults.execute(userId);
      expect(firstRun.success).toBe(true);
      if (firstRun.success) {
        expect(firstRun.data.length).toBe(13); // 8 expense + 5 income
      }

      // Second run should be idempotent and not create duplicates
      const secondRun = await ensureDefaults.execute(userId);
      expect(secondRun.success).toBe(true);
      if (secondRun.success) {
        expect(secondRun.data.length).toBe(13);
      }
    });
  });
});
