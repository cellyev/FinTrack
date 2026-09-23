import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { SavingsGoal } from '../domain/savings-goal';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';
import { Money } from '@/core/domain/money';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface SavingsGoalSqliteRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_state: string;
  base_updated_at: string | null;
}

export class SqliteSavingsGoalRepository implements ISavingsGoalRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(goal: SavingsGoal): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const targetMinor = Number(goal.targetAmount.minorUnits);
        const currentMinor = Number(goal.currentAmount.minorUnits);

        await txn.runAsync(
          `INSERT INTO savings_goals (
            id, user_id, name, target_amount, current_amount,
            target_date, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            goal.id,
            goal.userId,
            goal.name,
            targetMinor,
            currentMinor,
            goal.targetDate,
            goal.createdAt,
            goal.updatedAt,
            goal.deletedAt,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: goal.userId,
          operationType: 'CREATE_SAVINGS_GOAL',
          entityName: 'savings_goals',
          entityId: goal.id,
          payload: {
            id: goal.id,
            name: goal.name,
            target_amount: targetMinor,
            current_amount: currentMinor,
            target_date: goal.targetDate,
            created_at: goal.createdAt,
            updated_at: goal.updatedAt,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new DatabaseError(
          `Failed to create savings goal: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  public async update(goal: SavingsGoal): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const targetMinor = Number(goal.targetAmount.minorUnits);
        const currentMinor = Number(goal.currentAmount.minorUnits);

        await txn.runAsync(
          `UPDATE savings_goals
           SET name = ?, target_amount = ?, current_amount = ?, target_date = ?,
               updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            goal.name,
            targetMinor,
            currentMinor,
            goal.targetDate,
            goal.updatedAt,
            goal.id,
            goal.userId,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: goal.userId,
          operationType: 'UPDATE_SAVINGS_GOAL',
          entityName: 'savings_goals',
          entityId: goal.id,
          payload: {
            id: goal.id,
            name: goal.name,
            target_amount: targetMinor,
            current_amount: currentMinor,
            target_date: goal.targetDate,
            updated_at: goal.updatedAt,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new DatabaseError(
          `Failed to update savings goal: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const nowIso = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE savings_goals
           SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [nowIso, nowIso, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_SAVINGS_GOAL',
          entityName: 'savings_goals',
          entityId: id,
          payload: {
            id,
            deleted_at: nowIso,
            updated_at: nowIso,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new DatabaseError(
          `Failed to soft-delete savings goal: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  public async getById(id: string, userId: string): Promise<Result<SavingsGoal | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<SavingsGoalSqliteRow>(
        `SELECT * FROM savings_goals WHERE id = ? AND user_id = ?;`,
        [id, userId]
      );

      if (!row) {
        return ok(null);
      }

      return ok(this.mapRowToEntity(row));
    } catch (error) {
      return err(
        new DatabaseError(
          `Failed to fetch savings goal: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  public async listActive(userId: string): Promise<Result<SavingsGoal[], DomainError>> {
    try {
      const db = await this.getDb();
      const rows = await db.getAllAsync<SavingsGoalSqliteRow>(
        `SELECT * FROM savings_goals
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY
           CASE WHEN target_date IS NULL THEN 1 ELSE 0 END ASC,
           target_date ASC,
           created_at DESC;`,
        [userId]
      );

      const goals = rows.map((r) => this.mapRowToEntity(r));
      return ok(goals);
    } catch (error) {
      return err(
        new DatabaseError(
          `Failed to list active savings goals: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private mapRowToEntity(row: SavingsGoalSqliteRow): SavingsGoal {
    return new SavingsGoal({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      targetAmount: Money.fromMinorUnits(row.target_amount, 'IDR'),
      currentAmount: Money.fromMinorUnits(row.current_amount ?? 0, 'IDR'),
      targetDate: row.target_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      syncState: row.sync_state === 'pending' ? 'pending' : 'synced',
      baseUpdatedAt: row.base_updated_at,
    });
  }
}
