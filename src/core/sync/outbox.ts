import * as SQLite from 'expo-sqlite';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';
import { OutboxOperationType, OutboxRecord, OutboxStatus } from './domain/sync-types';

export { OutboxOperationType, OutboxRecord, OutboxStatus };

export interface OutboxEntry {
  id: string;
  userId: string;
  operationType: OutboxOperationType;
  entityName: string;
  entityId: string;
  payload: string; // JSON stringified
  createdAt: string;
  status?: OutboxStatus;
  retryCount: number;
  nextRetryAt?: string | null;
  lastError: string | null;
  processedAt?: string | null;
}

const uuidGen = new ExpoUuidGenerator();

export async function insertOutboxRecord(
  db: SQLite.SQLiteDatabase,
  entry: {
    userId: string;
    operationType: OutboxOperationType;
    entityName: string;
    entityId: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const id = uuidGen.generate();
  const now = new Date().toISOString();
  const payloadStr = JSON.stringify(entry.payload);

  await db.runAsync(
    `INSERT INTO outbox (
      id, user_id, operation_type, entity_name, entity_id, payload, created_at, status, retry_count, next_retry_at, last_error, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL);`,
    [
      id,
      entry.userId,
      entry.operationType,
      entry.entityName,
      entry.entityId,
      payloadStr,
      now,
    ]
  );
}
