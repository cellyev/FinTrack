import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, NotFoundError, ValidationError, DomainError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt, DebtType, DebtStatus } from '../domain/debt';
import { Transaction } from '@/features/transactions/domain/transaction';
import { Money } from '@/core/domain/money';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface DebtSqliteRow {
  id: string;
  user_id: string;
  type: string;
  person_name: string;
  original_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_state: string;
  base_updated_at: string | null;
  last_error: string | null;
}

export class SqliteDebtRepository implements IDebtRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(debt: Debt, initialTransaction?: Transaction): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Insert debt record
        await txn.runAsync(
          `INSERT INTO debts (
            id, user_id, type, person_name, original_amount, remaining_amount,
            due_date, status, note, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            debt.id,
            debt.userId,
            debt.type,
            debt.personName,
            Number(debt.originalAmount.minorUnits),
            Number(debt.remainingAmount.minorUnits),
            debt.dueDate,
            debt.status,
            debt.note,
            debt.createdAt,
            debt.updatedAt,
            debt.deletedAt,
          ]
        );

        // 2. Insert outbox record for debt creation
        await insertOutboxRecord(txn, {
          userId: debt.userId,
          operationType: 'CREATE_DEBT',
          entityName: 'debts',
          entityId: debt.id,
          payload: {
            id: debt.id,
            type: debt.type,
            person_name: debt.personName,
            original_amount: Number(debt.originalAmount.minorUnits),
            remaining_amount: Number(debt.remainingAmount.minorUnits),
            due_date: debt.dueDate,
            status: debt.status,
            note: debt.note,
            created_at: debt.createdAt,
            updated_at: debt.updatedAt,
          },
        });

        // 3. If initial ledger transaction is provided, persist it atomically
        if (initialTransaction) {
          await txn.runAsync(
            `INSERT INTO transactions (
              id, user_id, type, amount, source_account_id, destination_account_id,
              debt_id, recurring_transaction_id, occurrence_key, transaction_date,
              note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
            [
              initialTransaction.id,
              initialTransaction.userId,
              initialTransaction.type,
              Number(initialTransaction.amount.minorUnits),
              initialTransaction.sourceAccountId,
              initialTransaction.destinationAccountId,
              initialTransaction.debtId ?? debt.id,
              initialTransaction.recurringTransactionId,
              initialTransaction.occurrenceKey,
              initialTransaction.transactionDate,
              initialTransaction.note,
              initialTransaction.createdAt.toISOString(),
              initialTransaction.updatedAt.toISOString(),
              initialTransaction.deletedAt ? initialTransaction.deletedAt.toISOString() : null,
            ]
          );

          for (const item of initialTransaction.items) {
            await txn.runAsync(
              `INSERT INTO transaction_items (
                id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at, sync_state
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
              [
                item.id,
                initialTransaction.userId,
                initialTransaction.id,
                item.categoryId,
                Number(item.amount.minorUnits),
                item.note,
                item.createdAt.toISOString(),
                item.updatedAt.toISOString(),
                item.deletedAt ? item.deletedAt.toISOString() : null,
              ]
            );
          }

          await insertOutboxRecord(txn, {
            userId: initialTransaction.userId,
            operationType: 'CREATE_TRANSACTION',
            entityName: 'transactions',
            entityId: initialTransaction.id,
            payload: {
              id: initialTransaction.id,
              type: initialTransaction.type,
              amount: Number(initialTransaction.amount.minorUnits),
              source_account_id: initialTransaction.sourceAccountId,
              destination_account_id: initialTransaction.destinationAccountId,
              debt_id: initialTransaction.debtId ?? debt.id,
              transaction_date: initialTransaction.transactionDate,
              note: initialTransaction.note,
              items: initialTransaction.items.map((it) => ({
                id: it.id,
                category_id: it.categoryId,
                amount: Number(it.amount.minorUnits),
                note: it.note,
              })),
              created_at: initialTransaction.createdAt.toISOString(),
              updated_at: initialTransaction.updatedAt.toISOString(),
            },
          });
        }
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async recordRepayment(params: {
    debtId: string;
    userId: string;
    paymentAmount: Money;
    repaymentTransaction?: Transaction;
  }): Promise<Result<Debt, DomainError>> {
    try {
      const db = await this.getDb();
      let updatedDebt: Debt | null = null;

      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Fetch current debt
        const row = await txn.getFirstAsync<DebtSqliteRow>(
          `SELECT * FROM debts WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [params.debtId, params.userId]
        );

        if (!row) {
          throw new NotFoundError(`Debt with ID ${params.debtId} not found.`);
        }

        const existingDebt = this.mapRowToEntity(row);

        if (params.paymentAmount.minorUnits <= 0n) {
          throw new ValidationError('Repayment amount must be greater than zero.');
        }

        if (params.paymentAmount.minorUnits > existingDebt.remainingAmount.minorUnits) {
          throw new ValidationError(
            `Repayment amount (${params.paymentAmount.formatDisplay()}) cannot exceed remaining amount (${existingDebt.remainingAmount.formatDisplay()}).`
          );
        }

        const newRemaining = existingDebt.remainingAmount.subtract(params.paymentAmount);
        const newStatus: DebtStatus = newRemaining.minorUnits === 0n ? 'settled' : 'open';
        const nowIso = new Date().toISOString();

        // 2. Update debts table
        await txn.runAsync(
          `UPDATE debts
           SET remaining_amount = ?, status = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [Number(newRemaining.minorUnits), newStatus, nowIso, params.debtId, params.userId]
        );

        // 3. Outbox mutation for debt update
        await insertOutboxRecord(txn, {
          userId: params.userId,
          operationType: 'UPDATE_DEBT',
          entityName: 'debts',
          entityId: params.debtId,
          payload: {
            id: params.debtId,
            person_name: existingDebt.personName,
            remaining_amount: Number(newRemaining.minorUnits),
            due_date: existingDebt.dueDate,
            status: newStatus,
            note: existingDebt.note,
            updated_at: nowIso,
          },
        });

        // 4. If repayment ledger transaction is provided, persist it atomically
        if (params.repaymentTransaction) {
          await txn.runAsync(
            `INSERT INTO transactions (
              id, user_id, type, amount, source_account_id, destination_account_id,
              debt_id, recurring_transaction_id, occurrence_key, transaction_date,
              note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
            [
              params.repaymentTransaction.id,
              params.repaymentTransaction.userId,
              params.repaymentTransaction.type,
              Number(params.repaymentTransaction.amount.minorUnits),
              params.repaymentTransaction.sourceAccountId,
              params.repaymentTransaction.destinationAccountId,
              params.debtId,
              params.repaymentTransaction.recurringTransactionId,
              params.repaymentTransaction.occurrenceKey,
              params.repaymentTransaction.transactionDate,
              params.repaymentTransaction.note,
              params.repaymentTransaction.createdAt.toISOString(),
              params.repaymentTransaction.updatedAt.toISOString(),
              params.repaymentTransaction.deletedAt
                ? params.repaymentTransaction.deletedAt.toISOString()
                : null,
            ]
          );

          for (const item of params.repaymentTransaction.items) {
            await txn.runAsync(
              `INSERT INTO transaction_items (
                id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at, sync_state
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
              [
                item.id,
                params.repaymentTransaction.userId,
                params.repaymentTransaction.id,
                item.categoryId,
                Number(item.amount.minorUnits),
                item.note,
                item.createdAt.toISOString(),
                item.updatedAt.toISOString(),
                item.deletedAt ? item.deletedAt.toISOString() : null,
              ]
            );
          }

          await insertOutboxRecord(txn, {
            userId: params.repaymentTransaction.userId,
            operationType: 'CREATE_TRANSACTION',
            entityName: 'transactions',
            entityId: params.repaymentTransaction.id,
            payload: {
              id: params.repaymentTransaction.id,
              type: params.repaymentTransaction.type,
              amount: Number(params.repaymentTransaction.amount.minorUnits),
              source_account_id: params.repaymentTransaction.sourceAccountId,
              destination_account_id: params.repaymentTransaction.destinationAccountId,
              debt_id: params.debtId,
              transaction_date: params.repaymentTransaction.transactionDate,
              note: params.repaymentTransaction.note,
              items: params.repaymentTransaction.items.map((it) => ({
                id: it.id,
                category_id: it.categoryId,
                amount: Number(it.amount.minorUnits),
                note: it.note,
              })),
              created_at: params.repaymentTransaction.createdAt.toISOString(),
              updated_at: params.repaymentTransaction.updatedAt.toISOString(),
            },
          });
        }

        updatedDebt = new Debt({
          id: existingDebt.id,
          userId: existingDebt.userId,
          type: existingDebt.type,
          personName: existingDebt.personName,
          originalAmount: existingDebt.originalAmount,
          remainingAmount: newRemaining,
          dueDate: existingDebt.dueDate,
          status: newStatus,
          note: existingDebt.note,
          createdAt: existingDebt.createdAt,
          updatedAt: nowIso,
          deletedAt: existingDebt.deletedAt,
          syncState: 'pending',
        });
      });

      if (!updatedDebt) {
        return err(new DatabaseError('Failed to record repayment'));
      }

      return ok(updatedDebt);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async update(debt: Debt): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const nowIso = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        const result = await txn.runAsync(
          `UPDATE debts
           SET person_name = ?, original_amount = ?, remaining_amount = ?,
               due_date = ?, status = ?, note = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            debt.personName,
            Number(debt.originalAmount.minorUnits),
            Number(debt.remainingAmount.minorUnits),
            debt.dueDate,
            debt.status,
            debt.note,
            nowIso,
            debt.id,
            debt.userId,
          ]
        );

        if (result.changes === 0) {
          throw new NotFoundError(`Debt with ID ${debt.id} not found or deleted.`);
        }

        await insertOutboxRecord(txn, {
          userId: debt.userId,
          operationType: 'UPDATE_DEBT',
          entityName: 'debts',
          entityId: debt.id,
          payload: {
            id: debt.id,
            person_name: debt.personName,
            original_amount: Number(debt.originalAmount.minorUnits),
            remaining_amount: Number(debt.remainingAmount.minorUnits),
            due_date: debt.dueDate,
            status: debt.status,
            note: debt.note,
            updated_at: nowIso,
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async softDelete(debtId: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const nowIso = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        const result = await txn.runAsync(
          `UPDATE debts
           SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [nowIso, nowIso, debtId, userId]
        );

        if (result.changes === 0) {
          throw new NotFoundError(`Debt with ID ${debtId} not found or already deleted.`);
        }

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_DEBT',
          entityName: 'debts',
          entityId: debtId,
          payload: {
            id: debtId,
            deleted_at: nowIso,
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async getById(debtId: string, userId: string): Promise<Result<Debt | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<DebtSqliteRow>(
        `SELECT * FROM debts WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
        [debtId, userId]
      );

      if (!row) {
        return ok(null);
      }

      return ok(this.mapRowToEntity(row));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  public async listActive(
    userId: string,
    filter?: { type?: DebtType; status?: DebtStatus }
  ): Promise<Result<Debt[], DomainError>> {
    try {
      const db = await this.getDb();
      const params: (string | number | null)[] = [userId];
      let sql = `SELECT * FROM debts WHERE user_id = ? AND deleted_at IS NULL`;

      if (filter?.type) {
        sql += ` AND type = ?`;
        params.push(filter.type);
      }

      if (filter?.status) {
        sql += ` AND status = ?`;
        params.push(filter.status);
      }

      sql += ` ORDER BY 
        CASE WHEN status = 'open' THEN 1 ELSE 2 END ASC,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
        due_date ASC,
        created_at DESC;`;

      const rows = await db.getAllAsync<DebtSqliteRow>(sql, params);
      return ok(rows.map((r) => this.mapRowToEntity(r)));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message));
    }
  }

  private mapRowToEntity(row: DebtSqliteRow): Debt {
    return new Debt({
      id: row.id,
      userId: row.user_id,
      type: row.type as DebtType,
      personName: row.person_name,
      originalAmount: Money.fromMinorUnits(BigInt(row.original_amount), 'IDR'),
      remainingAmount: Money.fromMinorUnits(BigInt(row.remaining_amount), 'IDR'),
      dueDate: row.due_date,
      status: row.status as DebtStatus,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      syncState: row.sync_state === 'pending' ? 'pending' : 'synced',
      baseUpdatedAt: row.base_updated_at,
      lastError: row.last_error,
    });
  }
}
