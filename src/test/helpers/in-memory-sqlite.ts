import * as SQLite from 'expo-sqlite';

export class InMemoryTestDb {
  public tables: Map<string, Record<string, unknown>[]> = new Map();
  public inTransaction = false;
  private transactionSnapshot: Map<string, string> | null = null;
  public failNextRun = false;
  public failNextRunMessage = 'Simulated database failure';

  constructor() {
    this.tables.set('schema_version', []);
    this.tables.set('accounts', []);
    this.tables.set('categories', []);
    this.tables.set('transactions', []);
    this.tables.set('transaction_items', []);
    this.tables.set('outbox', []);
    this.tables.set('sync_metadata', []);
    this.tables.set('sync_conflicts', []);
    this.tables.set('budgets', []);
    this.tables.set('savings_goals', []);
    this.tables.set('debts', []);
    this.tables.set('recurring_transactions', []);
  }

  public get accounts(): Record<string, unknown>[] {
    return this.tables.get('accounts') ?? [];
  }

  public get categories(): Record<string, unknown>[] {
    return this.tables.get('categories') ?? [];
  }

  public get budgets(): Record<string, unknown>[] {
    return this.tables.get('budgets') ?? [];
  }

  public get savingsGoals(): Record<string, unknown>[] {
    return this.tables.get('savings_goals') ?? [];
  }

  public get debts(): Record<string, unknown>[] {
    return this.tables.get('debts') ?? [];
  }

  public get recurringTransactions(): Record<string, unknown>[] {
    return this.tables.get('recurring_transactions') ?? [];
  }

  public get transactions(): Record<string, unknown>[] {
    return this.tables.get('transactions') ?? [];
  }

  public get transactionItems(): Record<string, unknown>[] {
    return this.tables.get('transaction_items') ?? [];
  }

  public get outbox(): Record<string, unknown>[] {
    return this.tables.get('outbox') ?? [];
  }

  public get syncMetadata(): Record<string, unknown>[] {
    return this.tables.get('sync_metadata') ?? [];
  }

  public get syncConflicts(): Record<string, unknown>[] {
    return this.tables.get('sync_conflicts') ?? [];
  }

  public reset(): void {
    for (const key of this.tables.keys()) {
      this.tables.set(key, []);
    }
    this.inTransaction = false;
    this.transactionSnapshot = null;
    this.failNextRun = false;
  }

  public getDb(): SQLite.SQLiteDatabase {
    return {
      execAsync: jest.fn().mockImplementation(async (_sql: string) => {
        return;
      }),

      runAsync: jest.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (this.failNextRun) {
          this.failNextRun = false;
          throw new Error(this.failNextRunMessage);
        }
        return this.handleRun(sql, params);
      }),

      getFirstAsync: jest.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
        const rows = this.handleQuery(sql, params);
        return rows.length > 0 ? rows[0] : null;
      }),

      getAllAsync: jest.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
        return this.handleQuery(sql, params);
      }),

      withExclusiveTransactionAsync: jest.fn().mockImplementation(
        async <T>(callback: (txn: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
          this.inTransaction = true;
          // Snapshot current tables state for rollback support
          this.transactionSnapshot = new Map();
          for (const [tName, tRows] of this.tables.entries()) {
            this.transactionSnapshot.set(tName, JSON.stringify(tRows));
          }

          try {
            const result = await callback(this.getDb());
            this.inTransaction = false;
            this.transactionSnapshot = null;
            return result;
          } catch (err) {
            // Rollback snapshot
            if (this.transactionSnapshot) {
              for (const [tName, jsonStr] of this.transactionSnapshot.entries()) {
                this.tables.set(tName, JSON.parse(jsonStr));
              }
            }
            this.inTransaction = false;
            this.transactionSnapshot = null;
            throw err;
          }
        }
      ),
    } as unknown as SQLite.SQLiteDatabase;
  }

  private handleRun(sql: string, params: unknown[]): { lastInsertRowId: number; changes: number } {
    const trimmed = sql.trim();

    if (trimmed.startsWith('INSERT INTO sync_conflicts')) {
      const [
        id,
        userId,
        entityName,
        entityId,
        conflictType,
        localPayload,
        remotePayload,
        localUpdatedAt,
        remoteUpdatedAt,
        createdAt,
      ] = params;
      const list = this.tables.get('sync_conflicts') ?? [];
      list.push({
        id,
        user_id: userId,
        entity_name: entityName,
        entity_id: entityId,
        conflict_type: conflictType,
        local_payload: localPayload,
        remote_payload: remotePayload,
        local_updated_at: localUpdatedAt,
        remote_updated_at: remoteUpdatedAt,
        status: 'unresolved',
        resolution: null,
        resolved_at: null,
        created_at: createdAt,
      });
      this.tables.set('sync_conflicts', list);
      return { lastInsertRowId: list.length, changes: 1 };
    }

    if (trimmed.startsWith('DELETE FROM transaction_items')) {
      const list = this.tables.get('transaction_items') ?? [];
      const [txId, userId] = params;
      const remaining = list.filter((r) => !(r.transaction_id === txId && r.user_id === userId));
      const changes = list.length - remaining.length;
      this.tables.set('transaction_items', remaining);
      return { lastInsertRowId: 0, changes };
    }

    if (trimmed.startsWith('DELETE FROM outbox')) {
      const list = this.tables.get('outbox') ?? [];
      const [id] = params;
      const remaining = list.filter((r) => r.id !== id);
      const changes = list.length - remaining.length;
      this.tables.set('outbox', remaining);
      return { lastInsertRowId: 0, changes };
    }

    if (trimmed.includes('INSERT INTO sync_metadata')) {
      const list = this.tables.get('sync_metadata') ?? [];
      const [userId, entityName, lastSyncedAt, lastSyncStatus, lastError, updatedAt] = params;
      const existingIdx = list.findIndex((r) => r.user_id === userId && r.entity_name === entityName);
      const newRow = {
        user_id: userId,
        entity_name: entityName,
        last_synced_at: lastSyncedAt,
        last_sync_status: lastSyncStatus,
        last_error: lastError,
        updated_at: updatedAt,
      };
      if (existingIdx >= 0) {
        list[existingIdx] = newRow;
      } else {
        list.push(newRow);
      }
      this.tables.set('sync_metadata', list);
      return { lastInsertRowId: list.length, changes: 1 };
    }

    if (trimmed.startsWith('INSERT INTO')) {
      const match = trimmed.match(/INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1];
        const columns = match[2].split(',').map((c) => c.trim().toLowerCase());
        const row: Record<string, unknown> = {};

        if (tableName === 'outbox') {
          let paramIdx = 0;
          columns.forEach((col) => {
            if (col === 'status') {
              row[col] = 'pending';
            } else if (col === 'retry_count') {
              row[col] = 0;
            } else if (col === 'next_retry_at' || col === 'last_error' || col === 'processed_at') {
              row[col] = null;
            } else {
              row[col] = params[paramIdx++];
            }
          });
        } else if (trimmed.includes("'synced'") || trimmed.includes("'pending'")) {
          const literalState = trimmed.includes("'synced'") ? 'synced' : 'pending';
          let paramIdx = 0;
          columns.forEach((col) => {
            if (col === 'sync_state') {
              row[col] = literalState;
            } else {
              row[col] = params[paramIdx++];
            }
          });
        } else {
          columns.forEach((col, idx) => {
            row[col] = params[idx];
          });
        }

        const list = this.tables.get(tableName) ?? [];
        if (row.id) {
          const existingIdx = list.findIndex((r) => r.id === row.id);
          if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...row };
          } else {
            list.push(row);
          }
        } else {
          list.push(row);
        }
        this.tables.set(tableName, list);
        return { lastInsertRowId: list.length, changes: 1 };
      }
    }

    if (trimmed.startsWith('UPDATE')) {
      const normalized = trimmed.replace(/\s+/g, ' ');
      if (normalized.includes('UPDATE sync_conflicts')) {
        const list = this.tables.get('sync_conflicts') ?? [];
        const [resolution, resolvedAt, id] = params;
        let changes = 0;
        for (const row of list) {
          if (row.id === id) {
            row.status = 'resolved';
            row.resolution = resolution;
            row.resolved_at = resolvedAt;
            changes++;
          }
        }
        return { lastInsertRowId: 0, changes };
      }
      if (normalized.includes('UPDATE outbox')) {
        const list = this.tables.get('outbox') ?? [];
        let changes = 0;
        if (normalized.includes("SET status = 'processing'")) {
          const [processedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.status = 'processing';
              row.processed_at = processedAt;
              changes++;
            }
          }
        } else if (normalized.includes("SET status = 'completed' WHERE entity_id = ?")) {
          const [entityId, userId] = params;
          for (const row of list) {
            if (row.entity_id === entityId && row.user_id === userId) {
              row.status = 'completed';
              changes++;
            }
          }
        } else if (normalized.includes("SET status = 'pending', retry_count = 0")) {
          const [entityId, userId] = params;
          for (const row of list) {
            if (row.entity_id === entityId && row.user_id === userId) {
              row.status = 'pending';
              row.retry_count = 0;
              row.next_retry_at = null;
              row.last_error = null;
              changes++;
            }
          }
        } else if (normalized.includes("SET status = 'pending'")) {
          const [userId, thresholdDate] = params;
          for (const row of list) {
            if (row.user_id === userId && row.status === 'processing' && (!row.processed_at || String(row.processed_at) <= String(thresholdDate))) {
              row.status = 'pending';
              changes++;
            }
          }
        } else if (normalized.includes("SET status = 'dead_letter'")) {
          const [errorMessage, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.status = 'dead_letter';
              row.last_error = errorMessage;
              changes++;
            }
          }
        } else if (normalized.includes("SET status = 'failed'")) {
          const [errorMessage, nextRetryAt, newRetryCount, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.status = 'failed';
              row.last_error = errorMessage;
              row.next_retry_at = nextRetryAt;
              row.retry_count = newRetryCount;
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes("sync_state = 'synced'") && params.length === 1) {
        const [targetId] = params;
        let changes = 0;
        for (const [, rows] of this.tables.entries()) {
          for (const row of rows) {
            if (row.id === targetId || row.transaction_id === targetId) {
              row.sync_state = 'synced';
              row.base_updated_at = row.updated_at;
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('accounts')) {
        const list = this.tables.get('accounts') ?? [];
        let changes = 0;
        if (params.length === 10) {
          // Resolve conflict update
          const [name, type, currencyCode, icon, color, isActive, updatedAt, deletedAt, baseUpdatedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.name = name;
              row.type = type;
              row.currency_code = currencyCode;
              row.icon = icon;
              row.color = color;
              row.is_active = isActive;
              row.updated_at = updatedAt;
              row.deleted_at = deletedAt;
              row.base_updated_at = baseUpdatedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && (!userId || row.user_id === userId) && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          const [name, type, currencyCode, icon, color, isActive, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && (!userId || row.user_id === userId)) {
              row.name = name;
              row.type = type;
              row.currency_code = currencyCode;
              row.icon = icon;
              row.color = color;
              row.is_active = isActive;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('categories')) {
        const list = this.tables.get('categories') ?? [];
        let changes = 0;
        if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.is_system && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          const [name, icon, color, isActive, sortOrder, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.is_system) {
              row.name = name;
              row.icon = icon;
              row.color = color;
              row.is_active = isActive;
              row.sort_order = sortOrder;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('budgets')) {
        const list = this.tables.get('budgets') ?? [];
        let changes = 0;
        if (params.length === 10) {
          // Conflict resolution update
          const [categoryId, name, amount, periodType, startDate, endDate, updatedAt, deletedAt, baseUpdatedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.category_id = categoryId;
              row.name = name;
              row.amount = amount;
              row.period_type = periodType;
              row.start_date = startDate;
              row.end_date = endDate;
              row.updated_at = updatedAt;
              row.deleted_at = deletedAt;
              row.base_updated_at = baseUpdatedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          const [name, amount, periodType, startDate, endDate, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.name = name;
              row.amount = amount;
              row.period_type = periodType;
              row.start_date = startDate;
              row.end_date = endDate;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('savings_goals')) {
        const list = this.tables.get('savings_goals') ?? [];
        let changes = 0;
        if (params.length === 8) {
          // Conflict resolution update
          const [name, targetAmount, currentAmount, targetDate, updatedAt, deletedAt, baseUpdatedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.name = name;
              row.target_amount = targetAmount;
              row.current_amount = currentAmount;
              row.target_date = targetDate;
              row.updated_at = updatedAt;
              row.deleted_at = deletedAt;
              row.base_updated_at = baseUpdatedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          const [name, targetAmount, currentAmount, targetDate, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.name = name;
              row.target_amount = targetAmount;
              row.current_amount = currentAmount;
              row.target_date = targetDate;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('debts')) {
        const list = this.tables.get('debts') ?? [];
        let changes = 0;
        if (params.length === 11) {
          // Conflict resolution update
          const [type, personName, originalAmount, remainingAmount, dueDate, status, note, updatedAt, deletedAt, baseUpdatedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.type = type;
              row.person_name = personName;
              row.original_amount = originalAmount;
              row.remaining_amount = remainingAmount;
              row.due_date = dueDate;
              row.status = status;
              row.note = note;
              row.updated_at = updatedAt;
              row.deleted_at = deletedAt;
              row.base_updated_at = baseUpdatedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else if (trimmed.includes('remaining_amount = ?') && params.length === 5) {
          // Repayment update: [remaining_amount, status, updated_at, debtId, userId]
          const [remainingAmount, status, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.remaining_amount = remainingAmount;
              row.status = status;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          // General edit update: [person_name, original_amount, remaining_amount, due_date, status, note, updated_at, id, userId]
          const [personName, originalAmount, remainingAmount, dueDate, status, note, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.person_name = personName;
              row.original_amount = originalAmount;
              row.remaining_amount = remainingAmount;
              row.due_date = dueDate;
              row.status = status;
              row.note = note;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('recurring_transactions')) {
        const list = this.tables.get('recurring_transactions') ?? [];
        let changes = 0;
        if (params.length === 14) {
          // Conflict resolution update
          const [type, amount, accountId, categoryId, note, frequency, startDate, endDate, nextOccurrence, isActive, updatedAt, deletedAt, baseUpdatedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.type = type;
              row.amount = amount;
              row.account_id = accountId;
              row.category_id = categoryId;
              row.note = note;
              row.frequency = frequency;
              row.start_date = startDate;
              row.end_date = endDate;
              row.next_occurrence = nextOccurrence;
              row.is_active = isActive;
              row.updated_at = updatedAt;
              row.deleted_at = deletedAt;
              row.base_updated_at = baseUpdatedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else if (trimmed.includes('next_occurrence = ?') && params.length === 5) {
          // Occurrence advancement: [next_occurrence, is_active, updated_at, id, userId]
          const [nextOccurrence, isActive, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.next_occurrence = nextOccurrence;
              row.is_active = isActive;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          // General edit update: [amount, account_id, category_id, note, frequency, start_date, end_date, next_occurrence, is_active, updated_at, id, userId]
          const [amount, accountId, categoryId, note, frequency, startDate, endDate, nextOccurrence, isActive, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.amount = amount;
              row.account_id = accountId;
              row.category_id = categoryId;
              row.note = note;
              row.frequency = frequency;
              row.start_date = startDate;
              row.end_date = endDate;
              row.next_occurrence = nextOccurrence;
              row.is_active = isActive;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('transactions')) {
        const list = this.tables.get('transactions') ?? [];
        let changes = 0;
        if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, id] = params;
          for (const row of list) {
            if (row.id === id) {
              row.deleted_at = deletedAt;
              row.sync_state = 'synced';
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, id, userId] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        } else {
          const [
            type,
            amount,
            sourceAccountId,
            destinationAccountId,
            debtId,
            recurringTransactionId,
            occurrenceKey,
            transactionDate,
            note,
            updatedAt,
            id,
            userId,
          ] = params;
          for (const row of list) {
            if (row.id === id && row.user_id === userId && !row.deleted_at) {
              row.type = type;
              row.amount = amount;
              row.source_account_id = sourceAccountId;
              row.destination_account_id = destinationAccountId;
              row.debt_id = debtId;
              row.recurring_transaction_id = recurringTransactionId;
              row.occurrence_key = occurrenceKey;
              row.transaction_date = transactionDate;
              row.note = note;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }

      if (trimmed.includes('transaction_items')) {
        const list = this.tables.get('transaction_items') ?? [];
        let changes = 0;
        if (trimmed.includes('deleted_at = ?') && params.length === 2) {
          const [deletedAt, txId] = params;
          for (const row of list) {
            if (row.transaction_id === txId) {
              row.deleted_at = deletedAt;
              changes++;
            }
          }
        } else if (trimmed.includes('deleted_at =')) {
          const [deletedAt, updatedAt, txId, userId] = params;
          for (const row of list) {
            if (row.transaction_id === txId && row.user_id === userId && !row.deleted_at) {
              row.deleted_at = deletedAt;
              row.updated_at = updatedAt;
              row.sync_state = 'pending';
              changes++;
            }
          }
        }
        return { lastInsertRowId: 0, changes };
      }
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  private handleQuery(sql: string, params: unknown[]): Record<string, unknown>[] {
    const trimmed = sql.trim();

    if (trimmed.includes('FROM accounts')) {
      const list = this.tables.get('accounts') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId] = params;
        let filtered = list.filter((r) => r.user_id === userId && !r.deleted_at);
        if (trimmed.includes('is_active = 1')) {
          filtered = filtered.filter((r) => r.is_active === 1);
        }
        return filtered;
      }
    }

    if (trimmed.includes('FROM categories')) {
      const list = this.tables.get('categories') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId, type] = params;
        let filtered = list.filter((r) => r.user_id === userId && !r.deleted_at);
        if (type) {
          filtered = filtered.filter((r) => r.type === type);
        }
        if (trimmed.includes('is_active = 1')) {
          filtered = filtered.filter((r) => r.is_active === 1);
        }
        return filtered;
      }
    }

    if (trimmed.includes('FROM transactions')) {
      const list = this.tables.get('transactions') ?? [];
      const accountsList = this.tables.get('accounts') ?? [];
      const itemsList = this.tables.get('transaction_items') ?? [];
      const categoriesList = this.tables.get('categories') ?? [];

      if (trimmed.includes('WHERE occurrence_key = ? AND user_id = ?')) {
        const [occurrenceKey, userId] = params;
        return list.filter((r) => r.occurrence_key === occurrenceKey && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ? AND user_id = ?') || trimmed.includes('WHERE t.id = ? AND t.user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }

      if (trimmed.includes('WHERE user_id = ?') || trimmed.includes('WHERE t.user_id = ?')) {
        let paramIdx = 0;
        const userId = params[paramIdx++];
        let filtered = list.filter((r) => r.user_id === userId);

        if (trimmed.includes('deleted_at IS NULL') || trimmed.includes('t.deleted_at IS NULL')) {
          filtered = filtered.filter((r) => !r.deleted_at);
        }

        if (trimmed.includes('(source_account_id = ? OR destination_account_id = ?)') ||
            trimmed.includes('(t.source_account_id = ? OR t.destination_account_id = ?)')) {
          const acc1 = params[paramIdx++];
          const acc2 = params[paramIdx++];
          filtered = filtered.filter((r) => r.source_account_id === acc1 || r.destination_account_id === acc2);
        }

        if (trimmed.includes('type = ?') || trimmed.includes('t.type = ?')) {
          const tType = params[paramIdx++];
          filtered = filtered.filter((r) => r.type === tType);
        }

        if (trimmed.includes('ti.category_id = ?')) {
          const catId = params[paramIdx++];
          filtered = filtered.filter((r) => {
            const txItems = itemsList.filter((item) => item.transaction_id === r.id && !item.deleted_at);
            return txItems.some((item) => item.category_id === catId);
          });
        }

        if (trimmed.includes('t.debt_id = ?') || trimmed.includes('debt_id = ?')) {
          const debtId = params[paramIdx++];
          filtered = filtered.filter((r) => r.debt_id === debtId);
        }

        if (trimmed.includes('t.recurring_transaction_id = ?') || trimmed.includes('recurring_transaction_id = ?')) {
          const recId = params[paramIdx++];
          filtered = filtered.filter((r) => r.recurring_transaction_id === recId);
        }

        if (trimmed.includes('transaction_date >= ?') || trimmed.includes('t.transaction_date >= ?')) {
          const sDate = params[paramIdx++];
          filtered = filtered.filter((r) => String(r.transaction_date ?? '') >= String(sDate));
        }

        if (trimmed.includes('transaction_date <= ?') || trimmed.includes('t.transaction_date <= ?')) {
          const eDate = params[paramIdx++];
          filtered = filtered.filter((r) => String(r.transaction_date ?? '') <= String(eDate));
        }

        if (trimmed.includes('amount >= ?') || trimmed.includes('t.amount >= ?')) {
          const minAmt = Number(params[paramIdx++]);
          filtered = filtered.filter((r) => Number(r.amount ?? 0) >= minAmt);
        }

        if (trimmed.includes('amount <= ?') || trimmed.includes('t.amount <= ?')) {
          const maxAmt = Number(params[paramIdx++]);
          filtered = filtered.filter((r) => Number(r.amount ?? 0) <= maxAmt);
        }

        if (trimmed.includes('t.note LIKE ? OR') || trimmed.includes('note LIKE ?')) {
          const sPattern = String(params[paramIdx++] ?? '').replace(/%/g, '').toLowerCase();
          paramIdx += 4; // Consume remaining 4 LIKE parameters
          filtered = filtered.filter((r) => {
            const noteMatch = String(r.note ?? '').toLowerCase().includes(sPattern);
            const srcAcc = accountsList.find((a) => a.id === r.source_account_id);
            const srcMatch = srcAcc ? String(srcAcc.name ?? '').toLowerCase().includes(sPattern) : false;
            const dstAcc = accountsList.find((a) => a.id === r.destination_account_id);
            const dstMatch = dstAcc ? String(dstAcc.name ?? '').toLowerCase().includes(sPattern) : false;
            const txItems = itemsList.filter((item) => item.transaction_id === r.id && !item.deleted_at);
            const itemNoteMatch = txItems.some((item) => String(item.note ?? '').toLowerCase().includes(sPattern));
            const catMatch = txItems.some((item) => {
              const cat = categoriesList.find((c) => c.id === item.category_id);
              return cat ? String(cat.name ?? '').toLowerCase().includes(sPattern) : false;
            });
            return noteMatch || itemNoteMatch || srcMatch || dstMatch || catMatch;
          });
        }

        // Sorting: transaction_date DESC, created_at DESC, id DESC
        filtered.sort((a, b) => {
          const dateDiff = String(b.transaction_date ?? '').localeCompare(String(a.transaction_date ?? ''));
          if (dateDiff !== 0) return dateDiff;
          const createdDiff = String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
          if (createdDiff !== 0) return createdDiff;
          return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        });

        if (trimmed.includes('LIMIT ?')) {
          const limit = Number(params[paramIdx++]);
          let offset = 0;
          if (trimmed.includes('OFFSET ?')) {
            offset = Number(params[paramIdx++]);
          }
          filtered = filtered.slice(offset, offset + limit);
        }

        return filtered;
      }
    }

    if (trimmed.includes('FROM transaction_items')) {
      const list = this.tables.get('transaction_items') ?? [];
      if (trimmed.includes('WHERE transaction_id = ? AND user_id = ?')) {
        const [txId, userId] = params;
        return list.filter((r) => r.transaction_id === txId && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE transaction_id IN')) {
        const userId = params[params.length - 1];
        const txIds = params.slice(0, params.length - 1);
        return list.filter((r) => txIds.includes(r.transaction_id as string) && r.user_id === userId && !r.deleted_at);
      }
    }

    if (trimmed.includes('SELECT COALESCE(SUM(ti.amount), 0) as total_spent')) {
      const [userId, categoryId, startDate, endDate] = params;
      const txList = this.tables.get('transactions') ?? [];
      const itemsList = this.tables.get('transaction_items') ?? [];

      let totalSpent = 0;
      for (const item of itemsList) {
        if (item.category_id !== categoryId || item.deleted_at) continue;
        const tx = txList.find((t) => t.id === item.transaction_id);
        if (!tx) continue;
        if (
          tx.user_id === userId &&
          tx.type === 'expense' &&
          !tx.deleted_at &&
          String(tx.transaction_date ?? '') >= String(startDate) &&
          String(tx.transaction_date ?? '') <= String(endDate)
        ) {
          totalSpent += Number(item.amount ?? 0);
        }
      }
      return [{ total_spent: totalSpent }];
    }

    if (trimmed.includes('FROM budgets')) {
      const list = this.tables.get('budgets') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId] = params;
        let filtered = list.filter((r) => r.user_id === userId);
        if (trimmed.includes('deleted_at IS NULL')) {
          filtered = filtered.filter((r) => !r.deleted_at);
        }
        if (trimmed.includes('ORDER BY created_at DESC')) {
          filtered.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
        }
        return filtered;
      }
      return list;
    }

    if (trimmed.includes('FROM savings_goals')) {
      const list = this.tables.get('savings_goals') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId] = params;
        let filtered = list.filter((r) => r.user_id === userId);
        if (trimmed.includes('deleted_at IS NULL')) {
          filtered = filtered.filter((r) => !r.deleted_at);
        }
        filtered.sort((a, b) => {
          if (!a.target_date && b.target_date) return 1;
          if (a.target_date && !b.target_date) return -1;
          if (a.target_date && b.target_date) {
            const dateComp = String(a.target_date).localeCompare(String(b.target_date));
            if (dateComp !== 0) return dateComp;
          }
          return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
        });
        return filtered;
      }
      return list;
    }

    if (trimmed.includes('FROM debts')) {
      const list = this.tables.get('debts') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        let paramIdx = 0;
        const userId = params[paramIdx++];
        let filtered = list.filter((r) => r.user_id === userId);
        if (trimmed.includes('deleted_at IS NULL')) {
          filtered = filtered.filter((r) => !r.deleted_at);
        }
        if (trimmed.includes('AND type = ?')) {
          const type = params[paramIdx++];
          filtered = filtered.filter((r) => r.type === type);
        }
        if (trimmed.includes('AND status = ?')) {
          const status = params[paramIdx++];
          filtered = filtered.filter((r) => r.status === status);
        }

        // Sorting: status 'open' first, then due_date ASC (nulls last), then created_at DESC
        filtered.sort((a, b) => {
          const statusRankA = a.status === 'open' ? 1 : 2;
          const statusRankB = b.status === 'open' ? 1 : 2;
          if (statusRankA !== statusRankB) return statusRankA - statusRankB;

          if (!a.due_date && b.due_date) return 1;
          if (a.due_date && !b.due_date) return -1;
          if (a.due_date && b.due_date) {
            const dateDiff = String(a.due_date).localeCompare(String(b.due_date));
            if (dateDiff !== 0) return dateDiff;
          }
          return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
        });

        return filtered;
      }
      return list;
    }

    if (trimmed.includes('FROM recurring_transactions')) {
      const list = this.tables.get('recurring_transactions') ?? [];
      if (trimmed.includes('WHERE id = ? AND user_id = ?')) {
        const [id, userId] = params;
        return list.filter((r) => r.id === id && r.user_id === userId && !r.deleted_at);
      }
      if (trimmed.includes('WHERE id = ?')) {
        const [id] = params;
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ? AND is_active = 1 AND next_occurrence <= ?')) {
        const [userId, referenceDate] = params;
        return list
          .filter(
            (r) =>
              r.user_id === userId &&
              (r.is_active === 1 || r.is_active === true) &&
              String(r.next_occurrence) <= String(referenceDate) &&
              !r.deleted_at
          )
          .sort((a, b) => String(a.next_occurrence).localeCompare(String(b.next_occurrence)));
      }
      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId] = params;
        let filtered = list.filter((r) => r.user_id === userId);
        if (trimmed.includes('deleted_at IS NULL')) {
          filtered = filtered.filter((r) => !r.deleted_at);
        }
        filtered.sort((a, b) => {
          const activeRankA = a.is_active ? 1 : 2;
          const activeRankB = b.is_active ? 1 : 2;
          if (activeRankA !== activeRankB) return activeRankA - activeRankB;

          const dateDiff = String(a.next_occurrence).localeCompare(String(b.next_occurrence));
          if (dateDiff !== 0) return dateDiff;

          return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
        });
        return filtered;
      }
      return list;
    }

    if (trimmed.includes('FROM outbox')) {
      const list = this.tables.get('outbox') ?? [];
      if (trimmed.includes('COUNT(*) as count')) {
        const userId = params[0];
        if (trimmed.includes("status = 'dead_letter'")) {
          const count = list.filter((r) => r.user_id === userId && r.status === 'dead_letter').length;
          return [{ count }];
        }
        if (trimmed.includes("status = 'failed'")) {
          const count = list.filter((r) => r.user_id === userId && r.status === 'failed').length;
          return [{ count }];
        }
        const count = list.filter((r) => r.user_id === userId && (r.status === 'pending' || r.status === 'processing' || r.status === 'failed')).length;
        return [{ count }];
      }

      if (trimmed.includes('WHERE user_id = ?')) {
        const [userId, nowIso, limit] = params;
        let filtered = list.filter((r) => {
          if (r.user_id !== userId) return false;
          if (r.status === 'pending') return true;
          if (r.status === 'failed' && (!r.next_retry_at || String(r.next_retry_at) <= String(nowIso))) return true;
          return false;
        });

        // Topological ordering: Accounts (1) -> Categories (2) -> Budgets & Savings Goals & Debts & Recurring (3) -> Transactions (4)
        filtered.sort((a, b) => {
          const getRank = (op: string) => {
            if (op.includes('ACCOUNT')) return 1;
            if (op.includes('CATEGORY')) return 2;
            if (op.includes('BUDGET') || op.includes('SAVINGS_GOAL') || op.includes('DEBT') || op.includes('RECURRING')) return 3;
            if (op.includes('TRANSACTION')) return 4;
            return 5;
          };
          const rankA = getRank(String(a.operation_type));
          const rankB = getRank(String(b.operation_type));
          if (rankA !== rankB) return rankA - rankB;
          return String(a.created_at).localeCompare(String(b.created_at));
        });

        if (limit) {
          filtered = filtered.slice(0, Number(limit));
        }
        return filtered;
      }
    }

    if (trimmed.includes('FROM sync_conflicts')) {
      const list = this.tables.get('sync_conflicts') ?? [];
      if (trimmed.includes('COUNT(*) as count')) {
        const userId = params[0];
        const count = list.filter((r) => r.user_id === userId && r.status === 'unresolved').length;
        return [{ count }];
      }
      if (trimmed.includes('WHERE id = ?')) {
        const id = params[0];
        return list.filter((r) => r.id === id);
      }
      if (trimmed.includes('WHERE user_id = ? AND status = ?') || trimmed.includes("status = 'unresolved'")) {
        const userId = params[0];
        return list.filter((r) => r.user_id === userId && r.status === 'unresolved');
      }
      return list;
    }

    if (trimmed.includes('FROM sync_metadata')) {
      const list = this.tables.get('sync_metadata') ?? [];
      if (trimmed.includes('WHERE user_id = ? AND entity_name = ?')) {
        const [userId, entityName] = params;
        return list.filter((r) => r.user_id === userId && r.entity_name === entityName);
      }
    }

    return [];
  }
}
