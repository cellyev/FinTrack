import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';
import { SqliteBudgetRepository } from '@/features/budgets/data/sqlite-budget.repository';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Money } from '@/core/domain/money';

describe('SqliteBudgetRepository Unit Tests', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteBudgetRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteBudgetRepository(async () => testDb.getDb());
  });

  const samplePeriod = new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly');

  it('should create a budget and record CREATE_BUDGET in outbox', async () => {
    const budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      name: 'Makan',
      amount: Money.fromMinorUnits(100000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    const result = await repository.create(budget);
    expect(result.success).toBe(true);

    // Verify row in SQLite
    expect(testDb.budgets.length).toBe(1);
    expect(testDb.budgets[0].id).toBe('bg-1');
    expect(testDb.budgets[0].user_id).toBe('user-1');
    expect(testDb.budgets[0].amount).toBe(100000000);
    expect(testDb.budgets[0].sync_state).toBe('pending');

    // Verify outbox
    expect(testDb.outbox.length).toBe(1);
    expect(testDb.outbox[0].operation_type).toBe('CREATE_BUDGET');
    expect(testDb.outbox[0].entity_id).toBe('bg-1');
  });

  it('should update a budget and record UPDATE_BUDGET in outbox', async () => {
    const budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      name: 'Makan',
      amount: Money.fromMinorUnits(100000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    await repository.create(budget);

    const updatedBudget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      name: 'Makan Diubah',
      amount: Money.fromMinorUnits(150000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    });

    const updateResult = await repository.update(updatedBudget);
    expect(updateResult.success).toBe(true);

    expect(testDb.budgets[0].name).toBe('Makan Diubah');
    expect(testDb.budgets[0].amount).toBe(150000000);

    // Verify outbox has 2 operations
    expect(testDb.outbox.length).toBe(2);
    expect(testDb.outbox[1].operation_type).toBe('UPDATE_BUDGET');
  });

  it('should soft delete a budget and record DELETE_BUDGET in outbox', async () => {
    const budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      amount: Money.fromMinorUnits(100000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    await repository.create(budget);

    const deleteResult = await repository.softDelete('bg-1', 'user-1');
    expect(deleteResult.success).toBe(true);

    expect(testDb.budgets[0].deleted_at).toBeTruthy();

    expect(testDb.outbox.length).toBe(2);
    expect(testDb.outbox[1].operation_type).toBe('DELETE_BUDGET');

    // listActive should not return soft deleted budget
    const active = await repository.listActive('user-1');
    expect(active.success).toBe(true);
    if (active.success) {
      expect(active.data.length).toBe(0);
    }
  });

  it('should enforce user isolation on queries', async () => {
    const user1Budget = new Budget({
      id: 'bg-1',
      userId: 'user-1',
      categoryId: 'cat-food',
      amount: Money.fromMinorUnits(100000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const user2Budget = new Budget({
      id: 'bg-2',
      userId: 'user-2',
      categoryId: 'cat-food',
      amount: Money.fromMinorUnits(200000000n, 'IDR'),
      period: samplePeriod,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });

    await repository.create(user1Budget);
    await repository.create(user2Budget);

    const user1List = await repository.listActive('user-1');
    expect(user1List.success).toBe(true);
    if (user1List.success) {
      expect(user1List.data.length).toBe(1);
      expect(user1List.data[0].id).toBe('bg-1');
    }

    const user2List = await repository.listActive('user-2');
    expect(user2List.success).toBe(true);
    if (user2List.success) {
      expect(user2List.data.length).toBe(1);
      expect(user2List.data[0].id).toBe('bg-2');
    }
  });

  describe('getActualSpending calculation', () => {
    it('should aggregate only valid expense transactions in period for matching category and user', async () => {
      // 1. Matching expense transaction (Rp 200.000)
      testDb.tables.get('transactions')?.push({
        id: 'tx-1',
        user_id: 'user-1',
        type: 'expense',
        amount: 20000000,
        transaction_date: '2026-08-15',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-1',
        user_id: 'user-1',
        transaction_id: 'tx-1',
        category_id: 'cat-food',
        amount: 20000000,
        deleted_at: null,
      });

      // 2. Second matching expense transaction (Rp 300.000)
      testDb.tables.get('transactions')?.push({
        id: 'tx-2',
        user_id: 'user-1',
        type: 'expense',
        amount: 30000000,
        transaction_date: '2026-08-20',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-2',
        user_id: 'user-1',
        transaction_id: 'tx-2',
        category_id: 'cat-food',
        amount: 30000000,
        deleted_at: null,
      });

      // 3. Income transaction (Rp 5.000.000) -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-inc',
        user_id: 'user-1',
        type: 'income',
        amount: 500000000,
        transaction_date: '2026-08-10',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-inc',
        user_id: 'user-1',
        transaction_id: 'tx-inc',
        category_id: 'cat-food',
        amount: 500000000,
        deleted_at: null,
      });

      // 4. Transfer transaction -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-trf',
        user_id: 'user-1',
        type: 'transfer',
        amount: 100000000,
        transaction_date: '2026-08-12',
        deleted_at: null,
      });

      // 5. Expense transaction outside date period -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-out',
        user_id: 'user-1',
        type: 'expense',
        amount: 150000000,
        transaction_date: '2026-07-25',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-out',
        user_id: 'user-1',
        transaction_id: 'tx-out',
        category_id: 'cat-food',
        amount: 150000000,
        deleted_at: null,
      });

      // 6. Deleted expense transaction -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-del',
        user_id: 'user-1',
        type: 'expense',
        amount: 80000000,
        transaction_date: '2026-08-16',
        deleted_at: '2026-08-17T00:00:00.000Z',
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-del',
        user_id: 'user-1',
        transaction_id: 'tx-del',
        category_id: 'cat-food',
        amount: 80000000,
        deleted_at: null,
      });

      // 7. Different category expense -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-other-cat',
        user_id: 'user-1',
        type: 'expense',
        amount: 50000000,
        transaction_date: '2026-08-18',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-other-cat',
        user_id: 'user-1',
        transaction_id: 'tx-other-cat',
        category_id: 'cat-transport',
        amount: 50000000,
        deleted_at: null,
      });

      // 8. Different user expense -> MUST BE EXCLUDED
      testDb.tables.get('transactions')?.push({
        id: 'tx-user2',
        user_id: 'user-2',
        type: 'expense',
        amount: 40000000,
        transaction_date: '2026-08-19',
        deleted_at: null,
      });
      testDb.tables.get('transaction_items')?.push({
        id: 'ti-user2',
        user_id: 'user-2',
        transaction_id: 'tx-user2',
        category_id: 'cat-food',
        amount: 40000000,
        deleted_at: null,
      });

      const spending = await repository.getActualSpending(
        'user-1',
        'cat-food',
        '2026-08-01',
        '2026-08-31'
      );

      expect(spending.success).toBe(true);
      if (spending.success) {
        // Total should only be 200.000 + 300.000 = 500.000 (50.000.000 minor units)
        expect(spending.data.minorUnits).toBe(50000000n);
      }
    });
  });
});
