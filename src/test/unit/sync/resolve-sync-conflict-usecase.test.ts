import { ResolveSyncConflictUseCase } from '@/core/sync/application/resolve-sync-conflict.usecase';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('ResolveSyncConflictUseCase Unit Tests', () => {
  let db: InMemoryTestDb;
  let conflictRepo: SqliteConflictRepository;
  let outboxRepo: SqliteOutboxRepository;
  let useCase: ResolveSyncConflictUseCase;

  beforeEach(() => {
    db = new InMemoryTestDb();
    conflictRepo = new SqliteConflictRepository(async () => db.getDb());
    outboxRepo = new SqliteOutboxRepository(async () => db.getDb());
    useCase = new ResolveSyncConflictUseCase(conflictRepo, outboxRepo, async () => db.getDb());
  });

  it('should resolve conflict by applying remote state and completing outbox record', async () => {
    // 1. Setup local entity in DB
    db.accounts.push({
      id: 'acc-1',
      user_id: 'user-1',
      name: 'Dompet Lokal',
      type: 'cash',
      currency_code: 'IDR',
      icon: null,
      color: null,
      is_active: 1,
      created_at: '2026-08-19T10:00:00Z',
      updated_at: '2026-08-19T10:00:00Z',
      deleted_at: null,
      sync_state: 'pending',
      base_updated_at: '2026-08-19T10:00:00Z',
    });

    // 2. Setup pending outbox record
    db.outbox.push({
      id: 'out-1',
      user_id: 'user-1',
      operation_type: 'UPDATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-1',
      payload: '{}',
      created_at: '2026-08-19T10:00:00Z',
      status: 'dead_letter',
      retry_count: 5,
      next_retry_at: null,
      last_error: 'Conflict: Stale version',
      processed_at: null,
    });

    // 3. Create conflict record
    const remoteAccount = {
      id: 'acc-1',
      user_id: 'user-1',
      name: 'Dompet Cloud',
      type: 'cash',
      currency_code: 'IDR',
      icon: null,
      color: null,
      is_active: true,
      created_at: '2026-08-19T10:00:00Z',
      updated_at: '2026-08-19T10:05:00Z',
      deleted_at: null,
    };

    const conflict = await conflictRepo.createConflict({
      userId: 'user-1',
      entityName: 'accounts',
      entityId: 'acc-1',
      conflictType: 'concurrent_update',
      localPayload: JSON.stringify(db.accounts[0]),
      remotePayload: JSON.stringify(remoteAccount),
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    // 4. Resolve conflict with 'use_remote'
    const result = await useCase.execute({
      conflictId: conflict.id,
      resolution: 'use_remote',
    });

    expect(result.success).toBe(true);

    // Verify local DB was updated to remote
    const updatedAcc = db.accounts.find((a) => a.id === 'acc-1');
    expect(updatedAcc?.name).toBe('Dompet Cloud');

    // Verify outbox was completed/discarded
    const outboxRow = db.outbox.find((o) => o.id === 'out-1');
    expect(outboxRow?.status).toBe('completed');
  });

  it('should resolve conflict by keeping local and re-queuing outbox mutation', async () => {
    db.outbox.push({
      id: 'out-2',
      user_id: 'user-1',
      operation_type: 'UPDATE_ACCOUNT',
      entity_name: 'accounts',
      entity_id: 'acc-2',
      payload: '{}',
      created_at: '2026-08-19T10:00:00Z',
      status: 'dead_letter',
      retry_count: 5,
      next_retry_at: null,
      last_error: 'Conflict: Stale version',
      processed_at: null,
    });

    const conflict = await conflictRepo.createConflict({
      userId: 'user-1',
      entityName: 'accounts',
      entityId: 'acc-2',
      conflictType: 'concurrent_update',
      localPayload: '{}',
      remotePayload: '{}',
      localUpdatedAt: '2026-08-19T10:00:00Z',
      remoteUpdatedAt: '2026-08-19T10:05:00Z',
    });

    const result = await useCase.execute({
      conflictId: conflict.id,
      resolution: 'use_local',
    });

    expect(result.success).toBe(true);

    const outboxRow = db.outbox.find((o) => o.id === 'out-2');
    expect(outboxRow?.status).toBe('pending');
    expect(outboxRow?.retry_count).toBe(0);
    expect(outboxRow?.last_error).toBeNull();
  });

  it('should soft-delete local entity when resolving remote deletion with use_remote across all 7 entity types', async () => {
    const entities: {
      type: 'accounts' | 'categories' | 'budgets' | 'savings_goals' | 'debts' | 'recurring_transactions' | 'transactions';
      id: string;
      setup: () => void;
      verify: () => void;
    }[] = [
      {
        type: 'accounts',
        id: 'acc-del-1',
        setup: () => {
          db.accounts.push({
            id: 'acc-del-1',
            user_id: 'user-1',
            name: 'Akun Hapus',
            type: 'bank',
            currency_code: 'IDR',
            icon: null,
            color: null,
            is_active: 1,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const acc = db.accounts.find((a) => a.id === 'acc-del-1');
          expect(acc?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'categories',
        id: 'cat-del-1',
        setup: () => {
          db.categories.push({
            id: 'cat-del-1',
            user_id: 'user-1',
            name: 'Kategori Hapus',
            type: 'expense',
            icon: null,
            color: null,
            is_system: 0,
            is_active: 1,
            sort_order: 0,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const cat = db.categories.find((c) => c.id === 'cat-del-1');
          expect(cat?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'budgets',
        id: 'bg-del-1',
        setup: () => {
          db.budgets.push({
            id: 'bg-del-1',
            user_id: 'user-1',
            category_id: 'cat-1',
            name: 'Budget Hapus',
            amount: 50000000,
            period_type: 'monthly',
            start_date: '2026-08-01',
            end_date: '2026-08-31',
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const bg = db.budgets.find((b) => b.id === 'bg-del-1');
          expect(bg?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'savings_goals',
        id: 'sg-del-1',
        setup: () => {
          db.savingsGoals.push({
            id: 'sg-del-1',
            user_id: 'user-1',
            name: 'Goal Hapus',
            target_amount: 100000000,
            current_amount: 0,
            target_date: null,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const sg = db.savingsGoals.find((s) => s.id === 'sg-del-1');
          expect(sg?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'debts',
        id: 'debt-del-1',
        setup: () => {
          db.debts.push({
            id: 'debt-del-1',
            user_id: 'user-1',
            type: 'borrowed',
            person_name: 'Pak Hapus',
            original_amount: 50000000,
            remaining_amount: 50000000,
            due_date: null,
            status: 'open',
            note: null,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const debt = db.debts.find((d) => d.id === 'debt-del-1');
          expect(debt?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'recurring_transactions',
        id: 'rec-del-1',
        setup: () => {
          db.recurringTransactions.push({
            id: 'rec-del-1',
            user_id: 'user-1',
            type: 'expense',
            amount: 15000000,
            account_id: 'acc-1',
            category_id: 'cat-1',
            note: null,
            frequency: 'monthly',
            start_date: '2026-08-01',
            end_date: null,
            next_occurrence: '2026-09-01',
            is_active: 1,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const rec = db.recurringTransactions.find((r) => r.id === 'rec-del-1');
          expect(rec?.deleted_at).not.toBeNull();
        },
      },
      {
        type: 'transactions',
        id: 'tx-del-1',
        setup: () => {
          db.transactions.push({
            id: 'tx-del-1',
            user_id: 'user-1',
            type: 'expense',
            amount: 25000000,
            source_account_id: 'acc-1',
            destination_account_id: null,
            debt_id: null,
            recurring_transaction_id: null,
            occurrence_key: null,
            transaction_date: '2026-08-19',
            note: null,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
          db.transactionItems.push({
            id: 'item-del-1',
            user_id: 'user-1',
            transaction_id: 'tx-del-1',
            category_id: 'cat-1',
            amount: 25000000,
            note: null,
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T10:00:00Z',
            deleted_at: null,
            sync_state: 'pending',
            base_updated_at: '2026-08-19T10:00:00Z',
          });
        },
        verify: () => {
          const tx = db.transactions.find((t) => t.id === 'tx-del-1');
          expect(tx?.deleted_at).not.toBeNull();
          const item = db.transactionItems.find((i) => i.id === 'item-del-1');
          expect(item?.deleted_at).not.toBeNull();
        },
      },
    ];

    for (const entity of entities) {
      entity.setup();

      const conflict = await conflictRepo.createConflict({
        userId: 'user-1',
        entityName: entity.type,
        entityId: entity.id,
        conflictType: 'delete_update',
        localPayload: '{}',
        remotePayload: null, // remote delete
        localUpdatedAt: '2026-08-19T10:00:00Z',
        remoteUpdatedAt: '2026-08-19T10:05:00Z',
      });

      const res = await useCase.execute({
        conflictId: conflict.id,
        resolution: 'use_remote',
      });

      expect(res.success).toBe(true);
      entity.verify();
    }
  });
});
