import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/database/sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { Money } from '@/core/domain/money';
import { insertOutboxRecord } from '@/core/sync/outbox';
import {
  RecurringTransaction,
  RecurringType,
} from '../domain/recurring-transaction';
import { RecurringFrequency } from '../domain/recurring-frequency';
import {
  IRecurringTransactionRepository,
  ProcessOccurrenceParams,
  ProcessOccurrenceResult,
} from '../domain/recurring-repository.interface';

interface RecurringSqliteRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  account_id: string;
  category_id: string;
  note: string | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_state: string;
  base_updated_at: string | null;
  last_error: string | null;
}

export class SqliteRecurringTransactionRepository implements IRecurringTransactionRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(recurring: RecurringTransaction): Promise<Result<RecurringTransaction, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `INSERT INTO recurring_transactions (
            id, user_id, type, amount, account_id, category_id,
            note, frequency, start_date, end_date, next_occurrence,
            is_active, created_at, updated_at, deleted_at, sync_state, base_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?);`,
          [
            recurring.id,
            recurring.userId,
            recurring.type,
            Number(recurring.amount.minorUnits),
            recurring.accountId,
            recurring.categoryId,
            recurring.note,
            recurring.frequency,
            recurring.startDate,
            recurring.endDate,
            recurring.nextOccurrence,
            recurring.isActive ? 1 : 0,
            recurring.createdAt,
            recurring.updatedAt,
            recurring.baseUpdatedAt,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: recurring.userId,
          operationType: 'CREATE_RECURRING_TRANSACTION',
          entityName: 'recurring_transactions',
          entityId: recurring.id,
          payload: {
            id: recurring.id,
            type: recurring.type,
            amount: Number(recurring.amount.minorUnits),
            account_id: recurring.accountId,
            category_id: recurring.categoryId,
            note: recurring.note,
            frequency: recurring.frequency,
            start_date: recurring.startDate,
            end_date: recurring.endDate,
            next_occurrence: recurring.nextOccurrence,
            is_active: recurring.isActive,
            created_at: recurring.createdAt,
            updated_at: recurring.updatedAt,
          },
        });
      });

      return ok(recurring);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async update(recurring: RecurringTransaction): Promise<Result<RecurringTransaction, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const now = new Date().toISOString();
        await txn.runAsync(
          `UPDATE recurring_transactions
           SET amount = ?, account_id = ?, category_id = ?, note = ?,
               frequency = ?, start_date = ?, end_date = ?, next_occurrence = ?,
               is_active = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            Number(recurring.amount.minorUnits),
            recurring.accountId,
            recurring.categoryId,
            recurring.note,
            recurring.frequency,
            recurring.startDate,
            recurring.endDate,
            recurring.nextOccurrence,
            recurring.isActive ? 1 : 0,
            now,
            recurring.id,
            recurring.userId,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: recurring.userId,
          operationType: 'UPDATE_RECURRING_TRANSACTION',
          entityName: 'recurring_transactions',
          entityId: recurring.id,
          payload: {
            id: recurring.id,
            type: recurring.type,
            amount: Number(recurring.amount.minorUnits),
            account_id: recurring.accountId,
            category_id: recurring.categoryId,
            note: recurring.note,
            frequency: recurring.frequency,
            start_date: recurring.startDate,
            end_date: recurring.endDate,
            next_occurrence: recurring.nextOccurrence,
            is_active: recurring.isActive,
            updated_at: now,
          },
        });
      });

      return ok(recurring);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        const now = new Date().toISOString();
        await txn.runAsync(
          `UPDATE recurring_transactions
           SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_RECURRING_TRANSACTION',
          entityName: 'recurring_transactions',
          entityId: id,
          payload: { id, deleted_at: now },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async getById(id: string, userId: string): Promise<Result<RecurringTransaction | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<RecurringSqliteRow>(
        `SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
        [id, userId]
      );
      if (!row) return ok(null);
      return ok(this.mapRowToEntity(row));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async listActive(userId: string): Promise<Result<RecurringTransaction[], DomainError>> {
    try {
      const db = await this.getDb();
      const rows = await db.getAllAsync<RecurringSqliteRow>(
        `SELECT * FROM recurring_transactions
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY is_active DESC, next_occurrence ASC, created_at DESC;`,
        [userId]
      );
      return ok(rows.map((r) => this.mapRowToEntity(r)));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async listDue(userId: string, referenceDate: string): Promise<Result<RecurringTransaction[], DomainError>> {
    try {
      const db = await this.getDb();
      const rows = await db.getAllAsync<RecurringSqliteRow>(
        `SELECT * FROM recurring_transactions
         WHERE user_id = ? AND is_active = 1 AND next_occurrence <= ? AND deleted_at IS NULL
         ORDER BY next_occurrence ASC;`,
        [userId, referenceDate]
      );
      return ok(rows.map((r) => this.mapRowToEntity(r)));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async processOccurrence(
    params: ProcessOccurrenceParams
  ): Promise<Result<ProcessOccurrenceResult, DomainError>> {
    try {
      const db = await this.getDb();
      let createdTxResult: ProcessOccurrenceResult | null = null;

      await db.withExclusiveTransactionAsync(async (txn) => {
        const { recurring, occurrenceDate, generatedTransaction } = params;

        // 1. Idempotency Check via occurrence_key
        const occurrenceKey = generatedTransaction.occurrenceKey || `${recurring.id}_${occurrenceDate}`;
        const existingTx = await txn.getFirstAsync<{ id: string }>(
          `SELECT id FROM transactions WHERE occurrence_key = ? AND user_id = ? AND deleted_at IS NULL;`,
          [occurrenceKey, recurring.userId]
        );

        if (existingTx) {
          // Already generated previously, skip duplicate creation idempotently
          createdTxResult = { recurring, createdTransaction: null };
          return;
        }

        // 2. Insert canonical Transaction
        await txn.runAsync(
          `INSERT INTO transactions (
            id, user_id, type, amount, source_account_id, destination_account_id,
            debt_id, recurring_transaction_id, occurrence_key, transaction_date,
            note, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending');`,
          [
            generatedTransaction.id,
            generatedTransaction.userId,
            generatedTransaction.type,
            Number(generatedTransaction.amount.minorUnits),
            generatedTransaction.sourceAccountId,
            generatedTransaction.destinationAccountId,
            generatedTransaction.debtId,
            recurring.id,
            occurrenceKey,
            generatedTransaction.transactionDate,
            generatedTransaction.note,
            generatedTransaction.createdAt.toISOString(),
            generatedTransaction.updatedAt.toISOString(),
          ]
        );

        // 3. Insert Transaction Items / Splits
        for (const item of generatedTransaction.items) {
          await txn.runAsync(
            `INSERT INTO transaction_items (
              id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending');`,
            [
              item.id,
              generatedTransaction.userId,
              generatedTransaction.id,
              item.categoryId,
              Number(item.amount.minorUnits),
              item.note,
              item.createdAt.toISOString(),
              item.updatedAt.toISOString(),
            ]
          );
        }

        // 4. Insert outbox record for canonical Transaction
        await insertOutboxRecord(txn, {
          userId: generatedTransaction.userId,
          operationType: 'CREATE_TRANSACTION',
          entityName: 'transactions',
          entityId: generatedTransaction.id,
          payload: {
            id: generatedTransaction.id,
            type: generatedTransaction.type,
            amount: Number(generatedTransaction.amount.minorUnits),
            source_account_id: generatedTransaction.sourceAccountId,
            destination_account_id: generatedTransaction.destinationAccountId,
            debt_id: generatedTransaction.debtId,
            recurring_transaction_id: recurring.id,
            occurrence_key: occurrenceKey,
            transaction_date: generatedTransaction.transactionDate,
            note: generatedTransaction.note,
            created_at: generatedTransaction.createdAt.toISOString(),
            updated_at: generatedTransaction.updatedAt.toISOString(),
            items: generatedTransaction.items.map((i) => ({
              id: i.id,
              category_id: i.categoryId,
              amount: Number(i.amount.minorUnits),
              note: i.note,
            })),
          },
        });

        // 5. Advance recurring schedule
        recurring.advanceOccurrence();

        // 6. Update recurring_transactions record
        await txn.runAsync(
          `UPDATE recurring_transactions
           SET next_occurrence = ?, is_active = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            recurring.nextOccurrence,
            recurring.isActive ? 1 : 0,
            recurring.updatedAt,
            recurring.id,
            recurring.userId,
          ]
        );

        // 7. Insert outbox record for Recurring Schedule update
        await insertOutboxRecord(txn, {
          userId: recurring.userId,
          operationType: 'UPDATE_RECURRING_TRANSACTION',
          entityName: 'recurring_transactions',
          entityId: recurring.id,
          payload: {
            id: recurring.id,
            type: recurring.type,
            amount: Number(recurring.amount.minorUnits),
            account_id: recurring.accountId,
            category_id: recurring.categoryId,
            note: recurring.note,
            frequency: recurring.frequency,
            start_date: recurring.startDate,
            end_date: recurring.endDate,
            next_occurrence: recurring.nextOccurrence,
            is_active: recurring.isActive,
            updated_at: recurring.updatedAt,
          },
        });

        createdTxResult = { recurring, createdTransaction: generatedTransaction };
      });

      if (!createdTxResult) {
        return err(new DatabaseError('Failed to complete occurrence processing transaction'));
      }

      return ok(createdTxResult);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  private mapRowToEntity(row: RecurringSqliteRow): RecurringTransaction {
    return new RecurringTransaction({
      id: row.id,
      userId: row.user_id,
      type: row.type as RecurringType,
      amount: Money.fromMinorUnits(BigInt(row.amount)),
      accountId: row.account_id,
      categoryId: row.category_id,
      frequency: row.frequency as RecurringFrequency,
      startDate: row.start_date,
      endDate: row.end_date,
      nextOccurrence: row.next_occurrence,
      isActive: row.is_active === 1,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      syncState: row.sync_state as 'synced' | 'pending',
      baseUpdatedAt: row.base_updated_at,
      lastError: row.last_error,
    });
  }
}
