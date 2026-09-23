import * as SQLite from 'expo-sqlite';
import { Result, ok, err, DatabaseError, DomainError } from '@/core/domain/result';
import { Account, AccountType } from '../domain/account';
import { IAccountRepository } from '../domain/account-repository.interface';
import { Transaction } from '@/features/transactions/domain/transaction';
import { getDatabase } from '@/core/database/sqlite';
import { insertOutboxRecord } from '@/core/sync/outbox';

interface AccountSqliteRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency_code: string;
  icon: string | null;
  color: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class SqliteAccountRepository implements IAccountRepository {
  constructor(private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase) {}

  public async create(account: Account): Promise<Result<void, DomainError>> {
    return this.createWithOpeningBalance(account);
  }

  public async createWithOpeningBalance(
    account: Account,
    openingBalanceTransaction?: Transaction
  ): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Insert account record
        await txn.runAsync(
          `INSERT INTO accounts (
            id, user_id, name, type, currency_code, icon, color, is_active, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
          [
            account.id,
            account.userId,
            account.name,
            account.type,
            account.currencyCode,
            account.icon,
            account.color,
            account.isActive ? 1 : 0,
            account.createdAt.toISOString(),
            account.updatedAt.toISOString(),
            account.deletedAt ? account.deletedAt.toISOString() : null,
          ]
        );

        // 2. Insert outbox record for CREATE_ACCOUNT
        await insertOutboxRecord(txn, {
          userId: account.userId,
          operationType: 'CREATE_ACCOUNT',
          entityName: 'accounts',
          entityId: account.id,
          payload: {
            id: account.id,
            name: account.name,
            type: account.type,
            currency_code: account.currencyCode,
            icon: account.icon,
            color: account.color,
            is_active: account.isActive,
          },
        });

        // 3. If opening balance transaction exists (> 0), insert it atomically
        if (openingBalanceTransaction) {
          await txn.runAsync(
            `INSERT INTO transactions (
              id, user_id, type, amount, source_account_id, destination_account_id,
              debt_id, recurring_transaction_id, occurrence_key, transaction_date,
              note, created_at, updated_at, deleted_at, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending');`,
            [
              openingBalanceTransaction.id,
              openingBalanceTransaction.userId,
              openingBalanceTransaction.type,
              Number(openingBalanceTransaction.amount.minorUnits),
              openingBalanceTransaction.sourceAccountId,
              openingBalanceTransaction.destinationAccountId,
              openingBalanceTransaction.debtId,
              openingBalanceTransaction.recurringTransactionId,
              openingBalanceTransaction.occurrenceKey,
              openingBalanceTransaction.transactionDate,
              openingBalanceTransaction.note,
              openingBalanceTransaction.createdAt.toISOString(),
              openingBalanceTransaction.updatedAt.toISOString(),
              openingBalanceTransaction.deletedAt
                ? openingBalanceTransaction.deletedAt.toISOString()
                : null,
            ]
          );

          // 4. Insert outbox record for CREATE_TRANSACTION following the account creation
          await insertOutboxRecord(txn, {
            userId: openingBalanceTransaction.userId,
            operationType: 'CREATE_TRANSACTION',
            entityName: 'transactions',
            entityId: openingBalanceTransaction.id,
            payload: {
              id: openingBalanceTransaction.id,
              type: openingBalanceTransaction.type,
              amount: Number(openingBalanceTransaction.amount.minorUnits),
              source_account_id: openingBalanceTransaction.sourceAccountId,
              destination_account_id: openingBalanceTransaction.destinationAccountId,
              transaction_date: openingBalanceTransaction.transactionDate,
              note: openingBalanceTransaction.note,
              items: [],
            },
          });
        }
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to create account'));
    }
  }

  public async findById(id: string, userId: string): Promise<Result<Account | null, DomainError>> {
    try {
      const db = await this.getDb();
      const row = await db.getFirstAsync<AccountSqliteRow>(
        'SELECT * FROM accounts WHERE id = ? AND user_id = ?;',
        [id, userId]
      );

      if (!row) {
        return ok(null);
      }

      return ok(this.mapRowToDomain(row));
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to find account'));
    }
  }

  public async listByUser(userId: string, includeInactive: boolean = false): Promise<Result<Account[], DomainError>> {
    try {
      const db = await this.getDb();
      let query = 'SELECT * FROM accounts WHERE user_id = ? AND deleted_at IS NULL';
      const params: (string | number)[] = [userId];

      if (!includeInactive) {
        query += ' AND is_active = 1';
      }

      query += ' ORDER BY created_at ASC;';

      const rows = await db.getAllAsync<AccountSqliteRow>(query, params);
      const accounts = rows.map((r) => this.mapRowToDomain(r));
      return ok(accounts);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to list accounts'));
    }
  }

  public async update(account: Account): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE accounts SET
            name = ?, type = ?, currency_code = ?, icon = ?, color = ?, is_active = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [
            account.name,
            account.type,
            account.currencyCode,
            account.icon,
            account.color,
            account.isActive ? 1 : 0,
            account.updatedAt.toISOString(),
            account.id,
            account.userId,
          ]
        );

        await insertOutboxRecord(txn, {
          userId: account.userId,
          operationType: 'UPDATE_ACCOUNT',
          entityName: 'accounts',
          entityId: account.id,
          payload: {
            name: account.name,
            type: account.type,
            currency_code: account.currencyCode,
            icon: account.icon,
            color: account.color,
            is_active: account.isActive,
          },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to update account'));
    }
  }

  public async softDelete(id: string, userId: string): Promise<Result<void, DomainError>> {
    try {
      const db = await this.getDb();
      const now = new Date().toISOString();

      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync(
          `UPDATE accounts SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND user_id = ? AND deleted_at IS NULL;`,
          [now, now, id, userId]
        );

        await insertOutboxRecord(txn, {
          userId,
          operationType: 'DELETE_ACCOUNT',
          entityName: 'accounts',
          entityId: id,
          payload: { id, deleted_at: now },
        });
      });

      return ok(undefined);
    } catch (e: unknown) {
      return err(new DatabaseError((e as Error).message ?? 'Failed to soft delete account'));
    }
  }

  private mapRowToDomain(row: AccountSqliteRow): Account {
    return new Account({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type as AccountType,
      currencyCode: row.currency_code,
      icon: row.icon,
      color: row.color,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    });
  }
}
