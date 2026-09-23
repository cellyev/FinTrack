import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { Budget } from '../domain/budget';
import { BudgetPeriod, BudgetPeriodType } from '../domain/budget-period';
import { IBudgetRepository } from '../domain/budget-repository.interface';
import { Money } from '@/core/domain/money';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface BudgetSqliteRow {
  id: string;
  user_id: string;
  category_id: string;
  name: string | null;
  amount: number;
  period_type: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_state: string;
  base_updated_at: string | null;
}

export class SqliteBudgetRepository implements IBudgetRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(budget: Budget): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const minorAmount = Number(budget.amount.minorUnits);

        await txn.runAsync(
          `INSERT INTO budgets (
            id, user_id, category_id, name, amount, period_type,
            start_date, end_date, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            budget.id,
            budget.userId,
            budget.categoryId,
            budget.name,
            minorAmount,
            budget.period.periodType,
            budget.period.startDate,
            budget.period.endDate,
            budget.createdAt,
            budget.updatedAt,
            budget.deletedAt,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: budget.userId,
          operationType: 'CREATE_BUDGET',
          entityName: 'budgets',
          entityId: budget.id,
          payload: {
            id: budget.id,
            category_id: budget.categoryId,
            name: budget.name,
            amount: minorAmount,
            period_type: budget.period.periodType,
            start_date: budget.period.startDate,
            end_date: budget.period.endDate,
            created_at: budget.createdAt,
            updated_at: budget.updatedAt,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(new DatabaseError('Failed to create budget in SQLite', { error: String(error) }));
    }
  }

  public async update(budget: Budget): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const minorAmount = Number(budget.amount.minorUnits);
        const now = new Date().toISOString();

        await txn.runAsync(
          `UPDATE budgets
           SET name = ?, amount = ?, period_type = ?, start_date = ?, end_date = ?,
               updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            budget.name,
            minorAmount,
            budget.period.periodType,
            budget.period.startDate,
            budget.period.endDate,
            now,
            budget.id,
            budget.userId,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: budget.userId,
          operationType: 'UPDATE_BUDGET',
          entityName: 'budgets',
          entityId: budget.id,
          payload: {
            id: budget.id,
            category_id: budget.categoryId,
            name: budget.name,
            amount: minorAmount,
            period_type: budget.period.periodType,
            start_date: budget.period.startDate,
            end_date: budget.period.endDate,
            updated_at: now,
            expected_updated_at: budget.updatedAt,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(new DatabaseError('Failed to update budget in SQLite', { error: String(error) }));
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const now = new Date().toISOString();

        await txn.runAsync(
          `UPDATE budgets
           SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_BUDGET',
          entityName: 'budgets',
          entityId: id,
          payload: {
            id,
            deleted_at: now,
          },
        });
      });

      return ok(undefined);
    } catch (error) {
      return err(new DatabaseError('Failed to soft delete budget in SQLite', { error: String(error) }));
    }
  }

  public async getById(id: string, userId: string): Promise<Result<Budget | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<BudgetSqliteRow>(
        `SELECT * FROM budgets WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
        [id, userId]
      );

      if (!row) return ok(null);
      return ok(this.mapRowToDomain(row));
    } catch (error) {
      return err(new DatabaseError('Failed to query budget by ID in SQLite', { error: String(error) }));
    }
  }

  public async listActive(userId: string): Promise<Result<Budget[], DomainError>> {
    try {
      const db = await this.getDb();
      const rows = await db.getAllAsync<BudgetSqliteRow>(
        `SELECT * FROM budgets
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC;`,
        [userId]
      );

      return ok(rows.map(this.mapRowToDomain));
    } catch (error) {
      return err(new DatabaseError('Failed to list active budgets in SQLite', { error: String(error) }));
    }
  }

  public async getActualSpending(
    userId: string,
    categoryId: string,
    startDate: string,
    endDate: string
  ): Promise<Result<Money, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<{ total_spent: number }>(
        `SELECT COALESCE(SUM(ti.amount), 0) as total_spent
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.user_id = ?
           AND ti.category_id = ?
           AND t.type = 'expense'
           AND t.transaction_date >= ?
           AND t.transaction_date <= ?
           AND t.deleted_at IS NULL
           AND ti.deleted_at IS NULL;`,
        [userId, categoryId, startDate, endDate]
      );

      const totalSpentMinor = row?.total_spent ?? 0;
      return ok(Money.fromMinorUnits(totalSpentMinor, 'IDR'));
    } catch (error) {
      return err(new DatabaseError('Failed to aggregate actual spending for budget in SQLite', { error: String(error) }));
    }
  }

  private mapRowToDomain(row: BudgetSqliteRow): Budget {
    const period = new BudgetPeriod(
      row.start_date,
      row.end_date,
      row.period_type as BudgetPeriodType
    );

    return new Budget({
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      name: row.name,
      amount: Money.fromMinorUnits(row.amount, 'IDR'),
      period,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      syncState: row.sync_state as 'synced' | 'pending',
      baseUpdatedAt: row.base_updated_at,
    });
  }
}
