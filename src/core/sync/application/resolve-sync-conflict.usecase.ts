import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/database/sqlite';
import { SqliteConflictRepository } from '../data/sqlite-conflict.repository';
import { SqliteOutboxRepository } from '../data/sqlite-outbox.repository';
import { ConflictResolutionStrategy } from '../domain/conflict-types';

export class ResolveSyncConflictUseCase {
  constructor(
    private readonly conflictRepo: SqliteConflictRepository = new SqliteConflictRepository(),
    private readonly outboxRepo: SqliteOutboxRepository = new SqliteOutboxRepository(),
    private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase
  ) {}

  public async execute(params: {
    conflictId: string;
    resolution: ConflictResolutionStrategy;
  }): Promise<{ success: boolean; error?: string }> {
    const conflict = await this.conflictRepo.getConflictById(params.conflictId);
    if (!conflict) {
      return { success: false, error: 'Conflict record not found' };
    }

    if (conflict.status === 'resolved') {
      return { success: true };
    }

    const db = await this.getDb();

    if (params.resolution === 'use_remote') {
      // 1. Apply remote state to local SQLite
      if (!conflict.remotePayload) {
        // Remote was deleted -> soft-delete local entity
        const now = new Date().toISOString();
        if (conflict.entityName === 'accounts') {
          await db.runAsync(
            `UPDATE accounts SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'categories') {
          await db.runAsync(
            `UPDATE categories SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'budgets') {
          await db.runAsync(
            `UPDATE budgets SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'savings_goals') {
          await db.runAsync(
            `UPDATE savings_goals SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'debts') {
          await db.runAsync(
            `UPDATE debts SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'recurring_transactions') {
          await db.runAsync(
            `UPDATE recurring_transactions SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
        } else if (conflict.entityName === 'transactions') {
          await db.runAsync(
            `UPDATE transactions SET deleted_at = ?, sync_state = 'synced' WHERE id = ?;`,
            [now, conflict.entityId]
          );
          await db.runAsync(
            `UPDATE transaction_items SET deleted_at = ? WHERE transaction_id = ?;`,
            [now, conflict.entityId]
          );
        }
      } else {
        // Remote entity payload exists -> update local entity to match remote
        const remote = JSON.parse(conflict.remotePayload);

        if (conflict.entityName === 'accounts') {
          await db.runAsync(
            `UPDATE accounts
             SET name = ?, type = ?, currency_code = ?, icon = ?, color = ?,
                 is_active = ?, updated_at = ?, deleted_at = ?, sync_state = 'synced',
                 base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.name,
              remote.type,
              remote.currency_code ?? 'IDR',
              remote.icon ?? null,
              remote.color ?? null,
              remote.is_active ? 1 : 0,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'categories') {
          await db.runAsync(
            `UPDATE categories
             SET name = ?, type = ?, icon = ?, color = ?, is_system = ?,
                 is_active = ?, sort_order = ?, updated_at = ?, deleted_at = ?,
                 sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.name,
              remote.type,
              remote.icon ?? null,
              remote.color ?? null,
              remote.is_system ? 1 : 0,
              remote.is_active ? 1 : 0,
              remote.sort_order ?? 0,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'budgets') {
          const minorAmount = Math.round(Number(remote.amount) * 100);
          await db.runAsync(
            `UPDATE budgets
             SET category_id = ?, name = ?, amount = ?, period_type = ?,
                 start_date = ?, end_date = ?, updated_at = ?, deleted_at = ?,
                 sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.category_id,
              remote.name ?? null,
              minorAmount,
              remote.period_type,
              remote.start_date,
              remote.end_date,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'savings_goals') {
          const targetMinor = Math.round(Number(remote.target_amount) * 100);
          const currentMinor = Math.round(Number(remote.current_amount ?? 0) * 100);
          await db.runAsync(
            `UPDATE savings_goals
             SET name = ?, target_amount = ?, current_amount = ?, target_date = ?,
                 updated_at = ?, deleted_at = ?, sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.name,
              targetMinor,
              currentMinor,
              remote.target_date ?? null,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'debts') {
          const origMinor = Math.round(Number(remote.original_amount) * 100);
          const remMinor = Math.round(Number(remote.remaining_amount) * 100);
          await db.runAsync(
            `UPDATE debts
             SET type = ?, person_name = ?, original_amount = ?, remaining_amount = ?,
                 due_date = ?, status = ?, note = ?, updated_at = ?, deleted_at = ?,
                 sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.type,
              remote.person_name,
              origMinor,
              remMinor,
              remote.due_date ?? null,
              remote.status,
              remote.note ?? null,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'recurring_transactions') {
          const minorAmount = Math.round(Number(remote.amount) * 100);
          await db.runAsync(
            `UPDATE recurring_transactions
             SET type = ?, amount = ?, account_id = ?, category_id = ?,
                 note = ?, frequency = ?, start_date = ?, end_date = ?, next_occurrence = ?,
                 is_active = ?, updated_at = ?, deleted_at = ?,
                 sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.type,
              minorAmount,
              remote.account_id,
              remote.category_id,
              remote.note ?? null,
              remote.frequency,
              remote.start_date,
              remote.end_date ?? null,
              remote.next_occurrence,
              remote.is_active ? 1 : 0,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );
        } else if (conflict.entityName === 'transactions') {
          const minorAmount = Math.round(Number(remote.amount) * 100);
          await db.runAsync(
            `UPDATE transactions
             SET type = ?, amount = ?, source_account_id = ?, destination_account_id = ?,
                 transaction_date = ?, note = ?, updated_at = ?, deleted_at = ?,
                 sync_state = 'synced', base_updated_at = ?
             WHERE id = ?;`,
            [
              remote.type,
              minorAmount,
              remote.source_account_id ?? null,
              remote.destination_account_id ?? null,
              remote.transaction_date,
              remote.note ?? null,
              remote.updated_at,
              remote.deleted_at ?? null,
              remote.updated_at,
              conflict.entityId,
            ]
          );

          if (Array.isArray(remote.items)) {
            await db.runAsync(
              `UPDATE transaction_items SET deleted_at = ? WHERE transaction_id = ?;`,
              [remote.updated_at, conflict.entityId]
            );
            for (const item of remote.items) {
              const itemAmount = Math.round(Number(item.amount) * 100);
              await db.runAsync(
                `INSERT INTO transaction_items (id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
                 ON CONFLICT(id) DO UPDATE SET
                   category_id = excluded.category_id,
                   amount = excluded.amount,
                   note = excluded.note,
                   deleted_at = NULL;`,
                [
                  item.id,
                  conflict.userId,
                  conflict.entityId,
                  item.category_id,
                  itemAmount,
                  item.note ?? null,
                  remote.created_at,
                  remote.updated_at,
                ]
              );
            }
          }
        }
      }

      // 2. Discard local outbox record
      await db.runAsync(
        `UPDATE outbox SET status = 'completed' WHERE entity_id = ? AND user_id = ?;`,
        [conflict.entityId, conflict.userId]
      );
    } else if (params.resolution === 'use_local') {
      // Re-queue local mutation for synchronization
      await db.runAsync(
        `UPDATE outbox SET status = 'pending', retry_count = 0, next_retry_at = NULL, last_error = NULL
         WHERE entity_id = ? AND user_id = ?;`,
        [conflict.entityId, conflict.userId]
      );
    }

    // 3. Mark conflict record as resolved
    await this.conflictRepo.resolveConflict(params.conflictId, params.resolution);
    return { success: true };
  }
}
