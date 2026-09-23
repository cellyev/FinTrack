import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { Category } from '@/features/categories/domain/category';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteCategoryRepository', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteCategoryRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteCategoryRepository(async () => testDb.getDb());
  });

  it('should create custom category and insert outbox entry', async () => {
    const category = new Category({
      id: 'cat-1',
      userId: 'user-1',
      name: 'Kopi & Nongkrong',
      type: 'expense',
      icon: '☕',
      color: '#6F4E37',
    });

    const result = await repository.create(category);
    expect(result.success).toBe(true);

    const categoriesTable = testDb.tables.get('categories') ?? [];
    expect(categoriesTable.length).toBe(1);
    expect(categoriesTable[0].name).toBe('Kopi & Nongkrong');

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(1);
    expect(outboxTable[0].operation_type).toBe('CREATE_CATEGORY');
  });

  it('should list categories filtered by type and user', async () => {
    const cat1 = new Category({ id: 'c1', userId: 'user-1', name: 'Makanan', type: 'expense' });
    const cat2 = new Category({ id: 'c2', userId: 'user-1', name: 'Gaji', type: 'income' });
    const cat3 = new Category({ id: 'c3', userId: 'user-2', name: 'Other User Expense', type: 'expense' });

    await repository.create(cat1);
    await repository.create(cat2);
    await repository.create(cat3);

    const expenseResult = await repository.listByUser('user-1', 'expense');
    expect(expenseResult.success).toBe(true);
    if (expenseResult.success) {
      expect(expenseResult.data.length).toBe(1);
      expect(expenseResult.data[0].id).toBe('c1');
    }

    const incomeResult = await repository.listByUser('user-1', 'income');
    expect(incomeResult.success).toBe(true);
    if (incomeResult.success) {
      expect(incomeResult.data.length).toBe(1);
      expect(incomeResult.data[0].id).toBe('c2');
    }
  });

  it('should update custom category and record outbox event', async () => {
    const category = new Category({ id: 'c1', userId: 'user-1', name: 'Old Name', type: 'expense' });
    await repository.create(category);

    category.rename('New Name');
    const updateResult = await repository.update(category);
    expect(updateResult.success).toBe(true);

    const findResult = await repository.findById('c1', 'user-1');
    if (findResult.success) {
      expect(findResult.data?.name).toBe('New Name');
    }

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.some((o) => o.operation_type === 'UPDATE_CATEGORY')).toBe(true);
  });

  it('should soft delete custom category and record outbox tombstone', async () => {
    const category = new Category({ id: 'c1', userId: 'user-1', name: 'To Delete', type: 'expense' });
    await repository.create(category);

    const deleteResult = await repository.softDelete('c1', 'user-1');
    expect(deleteResult.success).toBe(true);

    const listResult = await repository.listByUser('user-1');
    if (listResult.success) {
      expect(listResult.data.length).toBe(0);
    }

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.some((o) => o.operation_type === 'DELETE_CATEGORY')).toBe(true);
  });

  it('should prevent soft deleting system categories in database', async () => {
    const sysCategory = new Category({
      id: 'cat-sys-bca',
      userId: 'user-1',
      name: 'Makanan Sistem',
      type: 'expense',
      isSystem: true,
    });
    await repository.create(sysCategory);

    const deleteResult = await repository.softDelete('cat-sys-bca', 'user-1');
    expect(deleteResult.success).toBe(true);

    // Should still be active because WHERE is_system = 0 prevented update
    const findResult = await repository.findById('cat-sys-bca', 'user-1');
    if (findResult.success) {
      expect(findResult.data?.deletedAt).toBeNull();
    }
  });

  it('should rollback category creation if outbox insertion fails', async () => {
    testDb.failNextRun = true;
    testDb.failNextRunMessage = 'Outbox disk full';

    const category = new Category({
      id: 'cat-fail',
      userId: 'user-1',
      name: 'Will Fail',
      type: 'expense',
    });

    const result = await repository.create(category);
    expect(result.success).toBe(false);

    const categoriesTable = testDb.tables.get('categories') ?? [];
    expect(categoriesTable.length).toBe(0);
  });
});
