import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { Transaction } from '../domain/transaction';
import { TransactionItem } from '../domain/transaction-item';
import { TransactionType } from '../domain/transaction-type';
import { ITransactionRepository, TransactionFilter } from '../domain/transaction-repository.interface';
import { Money } from '@/core/domain/money';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface TransactionSqliteRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  debt_id: string | null;
  recurring_transaction_id: string | null;
  occurrence_key: string | null;
  transaction_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TransactionItemSqliteRow {
  id: string;
  user_id: string;
  transaction_id: string;
  category_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class SqliteTransactionRepository implements ITransactionRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(transaction: Transaction): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Insert transaction header
        await txn.runAsync(
          `INSERT INTO transactions (
            id, user_id, type, amount, source_account_id, destination_account_id,
            debt_id, recurring_transaction_id, occurrence_key, transaction_date,
            note, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            transaction.id,
            transaction.userId,
            transaction.type,
            Number(transaction.amount.minorUnits),
            transaction.sourceAccountId,
            transaction.destinationAccountId,
            transaction.debtId,
            transaction.recurringTransactionId,
            transaction.occurrenceKey,
            transaction.transactionDate,
            transaction.note,
            transaction.createdAt.toISOString(),
            transaction.updatedAt.toISOString(),
            transaction.deletedAt ? transaction.deletedAt.toISOString() : null,
          ]
        );

        // 2. Insert transaction items / splits
        for (const item of transaction.items) {
          await txn.runAsync(
            `INSERT INTO transaction_items (
              id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
            [
              item.id,
              transaction.userId,
              transaction.id,
              item.categoryId,
              Number(item.amount.minorUnits),
              item.note,
              item.createdAt.toISOString(),
              item.updatedAt.toISOString(),
              item.deletedAt ? item.deletedAt.toISOString() : null,
            ]
          );
        }

        // 3. Insert outbox record
        await insertOutboxRecord(txn, {
          userId: transaction.userId,
          operationType: 'CREATE_TRANSACTION',
          entityName: 'transactions',
          entityId: transaction.id,
          payload: {
            id: transaction.id,
            type: transaction.type,
            amount: Number(transaction.amount.minorUnits),
            source_account_id: transaction.sourceAccountId,
            destination_account_id: transaction.destinationAccountId,
            transaction_date: transaction.transactionDate,
            note: transaction.note,
            debt_id: transaction.debtId,
            recurring_transaction_id: transaction.recurringTransactionId,
            occurrence_key: transaction.occurrenceKey,
            items: transaction.items.map((i) => ({
              id: i.id,
              category_id: i.categoryId,
              amount: Number(i.amount.minorUnits),
              note: i.note,
            })),
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to create transaction'));
    }
  }

  public async findById(id: string, userId: string): Promise<Result<Transaction | null, DomainError>> {
    try {
      const db = await this.getDb();
      const txRow = await db.getFirstAsync<TransactionSqliteRow>(
        'SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL;',
        [id, userId]
      );

      if (!txRow) {
        return ok(null);
      }

      const itemRows = await db.getAllAsync<TransactionItemSqliteRow>(
        'SELECT * FROM transaction_items WHERE transaction_id = ? AND user_id = ? AND deleted_at IS NULL;',
        [id, userId]
      );

      const items = itemRows.map((r) => this.mapItemRowToDomain(r));
      return ok(this.mapTxRowToDomain(txRow, items));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to find transaction'));
    }
  }

  public async update(transaction: Transaction): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Update transaction header
        await txn.runAsync(
          `UPDATE transactions SET
            type = ?,
            amount = ?,
            source_account_id = ?,
            destination_account_id = ?,
            debt_id = ?,
            recurring_transaction_id = ?,
            occurrence_key = ?,
            transaction_date = ?,
            note = ?,
            updated_at = ?,
            sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            transaction.type,
            Number(transaction.amount.minorUnits),
            transaction.sourceAccountId,
            transaction.destinationAccountId,
            transaction.debtId,
            transaction.recurringTransactionId,
            transaction.occurrenceKey,
            transaction.transactionDate,
            transaction.note,
            transaction.updatedAt.toISOString(),
            transaction.id,
            transaction.userId,
          ]
        );

        // 2. Replace transaction items / splits
        await txn.runAsync(
          `DELETE FROM transaction_items WHERE transaction_id = ? AND user_id = ?;`,
          [transaction.id, transaction.userId]
        );

        for (const item of transaction.items) {
          await txn.runAsync(
            `INSERT INTO transaction_items (
              id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
            [
              item.id,
              transaction.userId,
              transaction.id,
              item.categoryId,
              Number(item.amount.minorUnits),
              item.note,
              item.createdAt.toISOString(),
              item.updatedAt.toISOString(),
              item.deletedAt ? item.deletedAt.toISOString() : null,
            ]
          );
        }

        // 3. Insert outbox record
        await insertOutboxRecord(txn, {
          userId: transaction.userId,
          operationType: 'UPDATE_TRANSACTION',
          entityName: 'transactions',
          entityId: transaction.id,
          payload: {
            id: transaction.id,
            type: transaction.type,
            amount: Number(transaction.amount.minorUnits),
            source_account_id: transaction.sourceAccountId,
            destination_account_id: transaction.destinationAccountId,
            transaction_date: transaction.transactionDate,
            note: transaction.note,
            updated_at: transaction.updatedAt.toISOString(),
            items: transaction.items.map((i) => ({
              id: i.id,
              category_id: i.categoryId,
              amount: Number(i.amount.minorUnits),
              note: i.note,
            })),
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to update transaction'));
    }
  }

  public async list(filter: TransactionFilter): Promise<Result<Transaction[], DomainError>> {
    try {
      const db = await this.getDb();
      let query = `
        SELECT DISTINCT t.*
        FROM transactions t
        LEFT JOIN accounts src ON t.source_account_id = src.id
        LEFT JOIN accounts dst ON t.destination_account_id = dst.id
        LEFT JOIN transaction_items ti ON t.id = ti.transaction_id AND ti.deleted_at IS NULL
        LEFT JOIN categories c ON ti.category_id = c.id
        WHERE t.user_id = ?
      `;
      const params: (string | number)[] = [filter.userId];

      if (!filter.includeDeleted) {
        query += ' AND t.deleted_at IS NULL';
      }

      if (filter.accountId) {
        query += ' AND (t.source_account_id = ? OR t.destination_account_id = ?)';
        params.push(filter.accountId, filter.accountId);
      }

      if (filter.type) {
        query += ' AND t.type = ?';
        params.push(filter.type);
      }

      if (filter.categoryId) {
        query += ' AND ti.category_id = ?';
        params.push(filter.categoryId);
      }

      if (filter.debtId) {
        query += ' AND t.debt_id = ?';
        params.push(filter.debtId);
      }

      if (filter.recurringTransactionId) {
        query += ' AND t.recurring_transaction_id = ?';
        params.push(filter.recurringTransactionId);
      }

      if (filter.startDate) {
        query += ' AND t.transaction_date >= ?';
        params.push(filter.startDate);
      }

      if (filter.endDate) {
        query += ' AND t.transaction_date <= ?';
        params.push(filter.endDate);
      }

      if (filter.minAmount) {
        query += ' AND t.amount >= ?';
        params.push(Number(filter.minAmount.minorUnits));
      }

      if (filter.maxAmount) {
        query += ' AND t.amount <= ?';
        params.push(Number(filter.maxAmount.minorUnits));
      }

      if (filter.search && filter.search.trim().length > 0) {
        const searchPattern = `%${filter.search.trim()}%`;
        query += ` AND (
          t.note LIKE ? OR
          ti.note LIKE ? OR
          src.name LIKE ? OR
          dst.name LIKE ? OR
          c.name LIKE ?
        )`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ' ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC';

      if (filter.limit !== undefined) {
        query += ' LIMIT ?';
        params.push(filter.limit);
        if (filter.offset !== undefined) {
          query += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      const txRows = await db.getAllAsync<TransactionSqliteRow>(query, params);
      if (txRows.length === 0) {
        return ok([]);
      }

      // Fetch items for all retrieved transactions in 1 batch query
      const txIds = txRows.map((r) => r.id);
      const placeholders = txIds.map(() => '?').join(',');
      const itemRows = await db.getAllAsync<TransactionItemSqliteRow>(
        `SELECT * FROM transaction_items WHERE transaction_id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL;`,
        [...txIds, filter.userId]
      );

      const itemsByTxId = new Map<string, TransactionItem[]>();
      for (const itemRow of itemRows) {
        const list = itemsByTxId.get(itemRow.transaction_id) ?? [];
        list.push(this.mapItemRowToDomain(itemRow));
        itemsByTxId.set(itemRow.transaction_id, list);
      }

      const transactions = txRows.map((txRow) =>
        this.mapTxRowToDomain(txRow, itemsByTxId.get(txRow.id) ?? [])
      );

      return ok(transactions);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to list transactions'));
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE transactions SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await txn.runAsync(
          `UPDATE transaction_items SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
          WHERE transaction_id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_TRANSACTION',
          entityName: 'transactions',
          entityId: id,
          payload: { id, deleted_at: now },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to soft delete transaction'));
    }
  }

  public async getAllActiveTransactions(userId: string): Promise<Result<Transaction[], DomainError>> {
    return this.list({ userId, includeDeleted: false });
  }

  public async getAccountLedgerTransactions(accountId: string, userId: string): Promise<Result<Transaction[], DomainError>> {
    return this.list({ userId, accountId, includeDeleted: false });
  }

  private mapTxRowToDomain(row: TransactionSqliteRow, items: TransactionItem[]): Transaction {
    return new Transaction({
      id: row.id,
      userId: row.user_id,
      type: row.type as TransactionType,
      amount: Money.fromMinorUnits(BigInt(row.amount), 'IDR'),
      transactionDate: row.transaction_date,
      sourceAccountId: row.source_account_id,
      destinationAccountId: row.destination_account_id,
      items,
      note: row.note,
      debtId: row.debt_id,
      recurringTransactionId: row.recurring_transaction_id,
      occurrenceKey: row.occurrence_key,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }

  private mapItemRowToDomain(row: TransactionItemSqliteRow): TransactionItem {
    return new TransactionItem({
      id: row.id,
      transactionId: row.transaction_id,
      categoryId: row.category_id,
      amount: Money.fromMinorUnits(BigInt(row.amount), 'IDR'),
      note: row.note,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }
}
