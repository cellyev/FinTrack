import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SqliteConflictRepository Unit Tests', () => {
  let db: InMemoryTestDb;
  let repository: SqliteConflictRepository;

  beforeEach(() => {
    db = new InMemoryTestDb();
    repository = new SqliteConflictRepository(async () => db.getDb());
  });

  it('should create an unresolved conflict record', async () => {
    const created = await repository.createConflict({
      userId: 'user-1',
      entityName: 'transactions',
      entityId: 'tx-100',
      conflictType: 'concurrent_update',
      localPayload: JSON.stringify({ amount: 50000 }),
      remotePayload: JSON.stringify({ amount: 75000 }),
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    expect(created.id).toBeTruthy();
    expect(created.userId).toBe('user-1');
    expect(created.conflictType).toBe('concurrent_update');
    expect(created.status).toBe('unresolved');
    expect(created.resolution).toBeNull();
  });

  it('should get all unresolved conflicts for a specific user', async () => {
    await repository.createConflict({
      userId: 'user-1',
      entityName: 'accounts',
      entityId: 'acc-1',
      conflictType: 'concurrent_update',
      localPayload: '{}',
      remotePayload: '{}',
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    await repository.createConflict({
      userId: 'user-2',
      entityName: 'categories',
      entityId: 'cat-2',
      conflictType: 'duplicate_category',
      localPayload: '{}',
      remotePayload: '{}',
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    const user1Conflicts = await repository.getUnresolvedConflicts('user-1');
    expect(user1Conflicts.length).toBe(1);
    expect(user1Conflicts[0].entityId).toBe('acc-1');

    const count = await repository.getUnresolvedCount('user-1');
    expect(count).toBe(1);
  });

  it('should resolve conflict record with chosen strategy', async () => {
    const created = await repository.createConflict({
      userId: 'user-1',
      entityName: 'transactions',
      entityId: 'tx-100',
      conflictType: 'concurrent_update',
      localPayload: '{}',
      remotePayload: '{}',
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    await repository.resolveConflict(created.id, 'use_remote');

    const updated = await repository.getConflictById(created.id);
    expect(updated?.status).toBe('resolved');
    expect(updated?.resolution).toBe('use_remote');
    expect(updated?.resolvedAt).toBeTruthy();
  });
});
