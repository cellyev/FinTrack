import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/database/sqlite';
import { OutboxRecord, OutboxStatus, SyncMetadataRecord } from '../domain/sync-types';

interface OutboxSqliteRow {
  id: string;
  user_id: string;
  operation_type: string;
  entity_name: string;
  entity_id: string;
  payload: string;
  created_at: string;
  status: string;
  retry_count: number;
  next_retry_at: string | null;
  last_error: string | null;
  processed_at: string | null;
}

interface SyncMetadataSqliteRow {
  user_id: string;
  entity_name: string;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
  updated_at: string;
}

export class SqliteOutboxRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async fetchPendingBatch(userId: string, limit: number = 10): Promise<OutboxRecord[]> {
    const db = await this.getDb();
    const nowIso = new Date().toISOString();

    const rows = await db.getAllAsync<OutboxSqliteRow>(
      `SELECT * FROM outbox
       WHERE user_id = ?
         AND (status = 'pending' OR (status = 'failed' AND (next_retry_at IS NULL OR next_retry_at <= ?)))
       ORDER BY
          CASE
            WHEN operation_type LIKE '%ACCOUNT%' THEN 1
            WHEN operation_type LIKE '%CATEGORY%' THEN 2
            WHEN operation_type LIKE '%BUDGET%' THEN 3
            WHEN operation_type LIKE '%SAVINGS_GOAL%' THEN 3
            WHEN operation_type LIKE '%DEBT%' THEN 3
            WHEN operation_type LIKE '%RECURRING%' THEN 3
            WHEN operation_type LIKE '%TRANSACTION%' THEN 4
            ELSE 5
          END ASC,
         created_at ASC
       LIMIT ?;`,
      [userId, nowIso, limit]
    );

    return rows.map((r) => this.mapRowToRecord(r));
  }

  public async markProcessing(id: string): Promise<void> {
    const db = await this.getDb();
    const nowIso = new Date().toISOString();
    await db.runAsync(
      `UPDATE outbox SET status = 'processing', processed_at = ? WHERE id = ?;`,
      [nowIso, id]
    );
  }

  public async markCompleted(id: string, entityName?: string, entityId?: string): Promise<void> {
    const db = await this.getDb();
    // Successfully synced records are purged from outbox to keep table lightweight
    await db.runAsync(`DELETE FROM outbox WHERE id = ?;`, [id]);

    if (entityName && entityId) {
      const allowedTables = [
        'accounts',
        'categories',
        'budgets',
        'savings_goals',
        'debts',
        'recurring_transactions',
        'transactions',
      ];
      if (allowedTables.includes(entityName)) {
        await db.runAsync(
          `UPDATE ${entityName} SET sync_state = 'synced', base_updated_at = updated_at WHERE id = ? AND sync_state = 'pending';`,
          [entityId]
        );

        if (entityName === 'transactions') {
          await db.runAsync(
            `UPDATE transaction_items SET sync_state = 'synced' WHERE transaction_id = ? AND sync_state = 'pending';`,
            [entityId]
          );
        }
      }
    }
  }

  public async hasPendingMutationForEntity(
    userId: string,
    entityName: string,
    entityId: string
  ): Promise<boolean> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox
       WHERE user_id = ? AND entity_name = ? AND entity_id = ? AND status IN ('pending', 'processing');`,
      [userId, entityName, entityId]
    );
    return (row?.count ?? 0) > 0;
  }

  public async markFailed(
    id: string,
    errorMessage: string,
    nextRetryAt: string,
    newRetryCount: number
  ): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE outbox SET
         status = 'failed',
         last_error = ?,
         next_retry_at = ?,
         retry_count = ?
       WHERE id = ?;`,
      [errorMessage, nextRetryAt, newRetryCount, id]
    );
  }

  public async markDeadLetter(id: string, errorMessage: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE outbox SET status = 'dead_letter', last_error = ? WHERE id = ?;`,
      [errorMessage, id]
    );
  }

  public async retryDeadLetters(userId: string): Promise<number> {
    const db = await this.getDb();
    const result = await db.runAsync(
      `UPDATE outbox SET status = 'pending', retry_count = 0, next_retry_at = NULL, last_error = NULL
       WHERE user_id = ? AND status = 'dead_letter';`,
      [userId]
    );
    return result.changes;
  }

  public async getDeadLetterRecords(userId: string): Promise<OutboxRecord[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OutboxSqliteRow>(
      `SELECT * FROM outbox WHERE user_id = ? AND status = 'dead_letter' ORDER BY created_at DESC;`,
      [userId]
    );
    return rows.map((r) => this.mapRowToRecord(r));
  }

  public async recoverHangingProcessingRecords(
    userId: string,
    olderThanMinutes: number = 2
  ): Promise<number> {
    const db = await this.getDb();
    const thresholdDate = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

    const result = await db.runAsync(
      `UPDATE outbox SET status = 'pending'
       WHERE user_id = ?
         AND status = 'processing'
         AND (processed_at IS NULL OR processed_at <= ?);`,
      [userId, thresholdDate]
    );

    return result.changes;
  }

  public async getPendingCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox
       WHERE user_id = ? AND status IN ('pending', 'processing', 'failed');`,
      [userId]
    );
    return row?.count ?? 0;
  }

  public async getFailedCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox
       WHERE user_id = ? AND status = 'failed';`,
      [userId]
    );
    return row?.count ?? 0;
  }

  public async getDeadLetterCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox
       WHERE user_id = ? AND status = 'dead_letter';`,
      [userId]
    );
    return row?.count ?? 0;
  }

  public async getLastSyncMetadata(
    userId: string,
    entityName: string
  ): Promise<SyncMetadataRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<SyncMetadataSqliteRow>(
      `SELECT * FROM sync_metadata WHERE user_id = ? AND entity_name = ?;`,
      [userId, entityName]
    );

    if (!row) return null;

    return {
      userId: row.user_id,
      entityName: row.entity_name,
      lastSyncedAt: row.last_synced_at,
      lastSyncStatus: row.last_sync_status,
      lastError: row.last_error,
      updatedAt: row.updated_at,
    };
  }

  public async updateSyncMetadata(record: SyncMetadataRecord): Promise<void> {
    const db = await this.getDb();
    const nowIso = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_metadata (user_id, entity_name, last_synced_at, last_sync_status, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, entity_name) DO UPDATE SET
         last_synced_at = excluded.last_synced_at,
         last_sync_status = excluded.last_sync_status,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at;`,
      [
        record.userId,
        record.entityName,
        record.lastSyncedAt,
        record.lastSyncStatus,
        record.lastError,
        nowIso,
      ]
    );
  }

  private mapRowToRecord(row: OutboxSqliteRow): OutboxRecord {
    return {
      id: row.id,
      userId: row.user_id,
      operationType: row.operation_type as OutboxRecord['operationType'],
      entityName: row.entity_name,
      entityId: row.entity_id,
      payload: row.payload,
      createdAt: row.created_at,
      status: (row.status ?? 'pending') as OutboxStatus,
      retryCount: row.retry_count ?? 0,
      nextRetryAt: row.next_retry_at,
      lastError: row.last_error,
      processedAt: row.processed_at,
    };
  }
}
