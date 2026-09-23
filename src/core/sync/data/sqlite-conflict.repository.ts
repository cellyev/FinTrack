import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/database/sqlite';
import { SyncConflictRecord, ConflictResolutionStrategy, SyncConflictType } from '../domain/conflict-types';
import * as Crypto from 'expo-crypto';

interface ConflictSqliteRow {
  id: string;
  user_id: string;
  entity_name: string;
  entity_id: string;
  conflict_type: string;
  local_payload: string;
  remote_payload: string | null;
  local_updated_at: string;
  remote_updated_at: string | null;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export class SqliteConflictRepository {
  constructor(private readonly dbProvider: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    return this.dbProvider();
  }

  public async createConflict(params: {
    userId: string;
    entityName: 'accounts' | 'categories' | 'transactions' | 'budgets' | 'savings_goals' | 'debts' | 'recurring_transactions';
    entityId: string;
    conflictType: SyncConflictType;
    localPayload: string;
    remotePayload: string | null;
    localUpdatedAt: string;
    remoteUpdatedAt: string | null;
  }): Promise<SyncConflictRecord> {
    const db = await this.getDb();
    const rawUuid = typeof Crypto?.randomUUID === 'function' ? Crypto.randomUUID() : null;
    const id = rawUuid || `conf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_conflicts (
        id, user_id, entity_name, entity_id, conflict_type,
        local_payload, remote_payload, local_updated_at, remote_updated_at,
        status, resolution, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', NULL, NULL, ?);`,
      [
        id,
        params.userId,
        params.entityName,
        params.entityId,
        params.conflictType,
        params.localPayload,
        params.remotePayload,
        params.localUpdatedAt,
        params.remoteUpdatedAt,
        now,
      ]
    );

    return {
      id,
      userId: params.userId,
      entityName: params.entityName,
      entityId: params.entityId,
      conflictType: params.conflictType,
      localPayload: params.localPayload,
      remotePayload: params.remotePayload,
      localUpdatedAt: params.localUpdatedAt,
      remoteUpdatedAt: params.remoteUpdatedAt,
      status: 'unresolved',
      resolution: null,
      resolvedAt: null,
      createdAt: now,
    };
  }

  public async getUnresolvedConflicts(userId: string): Promise<SyncConflictRecord[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ConflictSqliteRow>(
      `SELECT * FROM sync_conflicts
       WHERE user_id = ? AND status = 'unresolved'
       ORDER BY created_at DESC;`,
      [userId]
    );

    return rows.map(this.mapRowToDomain);
  }

  public async getUnresolvedCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_conflicts
       WHERE user_id = ? AND status = 'unresolved';`,
      [userId]
    );
    return row?.count ?? 0;
  }

  public async getConflictById(id: string): Promise<SyncConflictRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ConflictSqliteRow>(
      `SELECT * FROM sync_conflicts WHERE id = ?;`,
      [id]
    );
    if (!row) return null;
    return this.mapRowToDomain(row);
  }

  public async resolveConflict(
    id: string,
    resolution: ConflictResolutionStrategy
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sync_conflicts
       SET status = 'resolved',
           resolution = ?,
           resolved_at = ?
       WHERE id = ?;`,
      [resolution, now, id]
    );
  }

  public async resolveAllForUser(
    userId: string,
    resolution: ConflictResolutionStrategy = 'use_remote'
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sync_conflicts
       SET status = 'resolved',
           resolution = ?,
           resolved_at = ?
       WHERE user_id = ? AND status = 'unresolved';`,
      [resolution, now, userId]
    );
  }

  private mapRowToDomain(row: ConflictSqliteRow): SyncConflictRecord {
    return {
      id: row.id,
      userId: row.user_id,
      entityName: row.entity_name as 'accounts' | 'categories' | 'transactions',
      entityId: row.entity_id,
      conflictType: row.conflict_type as SyncConflictType,
      localPayload: row.local_payload,
      remotePayload: row.remote_payload,
      localUpdatedAt: row.local_updated_at,
      remoteUpdatedAt: row.remote_updated_at,
      status: row.status as 'unresolved' | 'resolved',
      resolution: row.resolution as ConflictResolutionStrategy | null,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }
}
