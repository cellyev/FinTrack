import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { Account } from '@/features/accounts/domain/account';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteAccountRepository', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteAccountRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteAccountRepository(async () => testDb.getDb());
  });

  it('should create account and insert outbox entry', async () => {
    const account = new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Dompet Cash',
      type: 'cash',
      currencyCode: 'IDR',
    });

    const result = await repository.create(account);
    expect(result.success).toBe(true);

    const accountsTable = testDb.tables.get('accounts') ?? [];
    expect(accountsTable.length).toBe(1);
    expect(accountsTable[0].id).toBe('acc-1');
    expect(accountsTable[0].name).toBe('Dompet Cash');

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(1);
    expect(outboxTable[0].operation_type).toBe('CREATE_ACCOUNT');
    expect(outboxTable[0].entity_id).toBe('acc-1');
  });

  it('should find account by id and enforce user isolation', async () => {
    const account = new Account({
      id: 'acc-2',
      userId: 'user-1',
      name: 'BCA Utama',
      type: 'bank',
    });
    await repository.create(account);

    const findSuccess = await repository.findById('acc-2', 'user-1');
    expect(findSuccess.success).toBe(true);
    if (findSuccess.success) {
      expect(findSuccess.data?.name).toBe('BCA Utama');
    }

    // Different user cannot access
    const findOther = await repository.findById('acc-2', 'user-other');
    expect(findOther.success).toBe(true);
    if (findOther.success) {
      expect(findOther.data).toBeNull();
    }
  });

  it('should list active accounts by user', async () => {
    const acc1 = new Account({ id: 'a1', userId: 'user-1', name: 'Cash', type: 'cash' });
    const acc2 = new Account({ id: 'a2', userId: 'user-1', name: 'BCA', type: 'bank' });
    const acc3 = new Account({ id: 'a3', userId: 'user-2', name: 'Other Cash', type: 'cash' });

    await repository.create(acc1);
    await repository.create(acc2);
    await repository.create(acc3);

    const result = await repository.listByUser('user-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(2);
      expect(result.data.map((a) => a.id)).toEqual(['a1', 'a2']);
    }
  });

  it('should update account and record outbox event', async () => {
    const account = new Account({ id: 'a1', userId: 'user-1', name: 'Old Name', type: 'cash' });
    await repository.create(account);

    account.rename('New Name');
    const updateResult = await repository.update(account);
    expect(updateResult.success).toBe(true);

    const findResult = await repository.findById('a1', 'user-1');
    if (findResult.success) {
      expect(findResult.data?.name).toBe('New Name');
    }

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.some((o) => o.operation_type === 'UPDATE_ACCOUNT')).toBe(true);
  });

  it('should soft delete account and record outbox tombstone', async () => {
    const account = new Account({ id: 'a1', userId: 'user-1', name: 'To Delete', type: 'cash' });
    await repository.create(account);

    const deleteResult = await repository.softDelete('a1', 'user-1');
    expect(deleteResult.success).toBe(true);

    const listResult = await repository.listByUser('user-1');
    if (listResult.success) {
      expect(listResult.data.length).toBe(0); // Excluded by default
    }

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.some((o) => o.operation_type === 'DELETE_ACCOUNT')).toBe(true);
  });
});
