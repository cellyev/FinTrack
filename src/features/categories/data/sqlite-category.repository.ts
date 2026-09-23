import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { Category, CategoryType } from '../domain/category';
import { ICategoryRepository } from '../domain/category-repository.interface';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface CategorySqliteRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_system: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class SqliteCategoryRepository implements ICategoryRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(category: Category): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `INSERT INTO categories (
            id, user_id, name, type, icon, color, is_system, is_active, sort_order, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            category.id,
            category.userId,
            category.name,
            category.type,
            category.icon,
            category.color,
            category.isSystem ? 1 : 0,
            category.isActive ? 1 : 0,
            category.sortOrder,
            category.createdAt.toISOString(),
            category.updatedAt.toISOString(),
            category.deletedAt ? category.deletedAt.toISOString() : null,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: category.userId,
          operationType: 'CREATE_CATEGORY',
          entityName: 'categories',
          entityId: category.id,
          payload: {
            id: category.id,
            name: category.name,
            type: category.type,
            icon: category.icon,
            color: category.color,
            is_system: category.isSystem,
            is_active: category.isActive,
            sort_order: category.sortOrder,
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to create category'));
    }
  }

  public async findById(id: string, userId: string): Promise<Result<Category | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<CategorySqliteRow>(
        'SELECT * FROM categories WHERE id = ? AND user_id = ?;',
        [id, userId]
      );

      if (!row) {
        return ok(null);
      }

      return ok(this.mapRowToDomain(row));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to find category'));
    }
  }

  public async listByUser(
    userId: string,
    type?: CategoryType,
    includeInactive: boolean = false
  ): Promise<Result<Category[], DomainError>> {
    try {
      const db = await this.getDb();
      let query = 'SELECT * FROM categories WHERE user_id = ? AND deleted_at IS NULL';
      const params: (string | number)[] = [userId];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      if (!includeInactive) {
        query += ' AND is_active = 1';
      }

      query += ' ORDER BY sort_order ASC, name ASC;';

      const rows = await db.getAllAsync<CategorySqliteRow>(query, params);
      const categories = rows.map((r) => this.mapRowToDomain(r));
      return ok(categories);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to list categories'));
    }
  }

  public async update(category: Category): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE categories SET
            name = ?, icon = ?, color = ?, is_active = ?, sort_order = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND is_system = 0;`,
          [
            category.name,
            category.icon,
            category.color,
            category.isActive ? 1 : 0,
            category.sortOrder,
            category.updatedAt.toISOString(),
            category.id,
            category.userId,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: category.userId,
          operationType: 'UPDATE_CATEGORY',
          entityName: 'categories',
          entityId: category.id,
          payload: {
            name: category.name,
            icon: category.icon,
            color: category.color,
            is_active: category.isActive,
            sort_order: category.sortOrder,
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to update category'));
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE categories SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND is_system = 0 AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_CATEGORY',
          entityName: 'categories',
          entityId: id,
          payload: { id, deleted_at: now },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to delete category'));
    }
  }

  private mapRowToDomain(row: CategorySqliteRow): Category {
    return new Category({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type as CategoryType,
      icon: row.icon,
      color: row.color,
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1,
      sortOrder: row.sort_order,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }
}
