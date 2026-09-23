import { runMigrations, MIGRATIONS } from '@/core/database/migrations';
import * as SQLite from 'expo-sqlite';

/**
 * Realistic In-Memory Schema Simulator for SQLite Migrations
 * Faithfully mimics SQLite behavior regarding:
 * - Table definitions & column tracking (PRAGMA table_info)
 * - CREATE TABLE IF NOT EXISTS (does not alter columns if table already exists)
 * - Index creation (throws if indexed column does not exist on table)
 * - ALTER TABLE (ADD COLUMN, RENAME TO)
 * - DROP TABLE
 * - sqlite_master table queries
 */
class SqliteSchemaSimulator {
  public tables: Map<string, { columns: string[]; rows: Record<string, unknown>[] }> = new Map();
  public indices: Map<string, { tableName: string; columns: string[] }> = new Map();
  public schemaVersions: { version: number; name: string; applied_at: string }[] = [];

  public getDb(): SQLite.SQLiteDatabase {
    return {
      execAsync: async (sql: string) => {
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          this.executeStatement(stmt);
        }
      },
      getAllAsync: async <T>(query: string, _params: unknown[] = []): Promise<T[]> => {
        const trimmed = query.trim();

        if (trimmed.startsWith('PRAGMA table_info(')) {
          const match = trimmed.match(/PRAGMA table_info\(([^)]+)\)/i);
          if (match) {
            const tableName = match[1].trim();
            const table = this.tables.get(tableName);
            if (!table) return [] as T[];
            return table.columns.map((col, idx) => ({
              cid: idx,
              name: col,
              type: 'TEXT',
              notnull: 0,
              dflt_value: null,
              pk: idx === 0 ? 1 : 0,
            })) as T[];
          }
        }

        if (trimmed.includes('SELECT version FROM schema_version')) {
          return this.schemaVersions.map((v) => ({ version: v.version })) as T[];
        }

        if (trimmed.includes('SELECT') && trimmed.includes('FROM schema_version')) {
          return this.schemaVersions as unknown as T[];
        }

        return [] as T[];
      },
      getFirstAsync: async <T>(query: string, _params: unknown[] = []): Promise<T | null> => {
        const trimmed = query.trim();
        if (trimmed.includes('sqlite_master')) {
          const match = trimmed.match(/name='([^']+)'/i);
          if (match) {
            const tableName = match[1];
            if (this.tables.has(tableName)) {
              return { name: tableName } as T;
            }
          }
          return null;
        }
        return null;
      },
      runAsync: async (sql: string, params: unknown[] = []) => {
        const trimmed = sql.trim();
        if (trimmed.startsWith('INSERT INTO schema_version')) {
          const [version, name, appliedAt] = params;
          this.schemaVersions.push({
            version: Number(version),
            name: String(name),
            applied_at: String(appliedAt),
          });
          return { lastInsertRowId: this.schemaVersions.length, changes: 1 };
        }
        return { lastInsertRowId: 0, changes: 0 };
      },
    } as unknown as SQLite.SQLiteDatabase;
  }

  private executeStatement(sql: string): void {
    const trimmed = sql.trim();

    // 1. CREATE TABLE
    const createTableMatch = trimmed.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-zA-Z0-9_]+)\s*\(([\s\S]+)\)/i);
    if (createTableMatch) {
      const tableName = createTableMatch[1];
      const body = createTableMatch[2];

      if (this.tables.has(tableName) && trimmed.toUpperCase().includes('IF NOT EXISTS')) {
        // SQLite does NOT modify existing table schema when IF NOT EXISTS is used
        return;
      }

      // Parse column names
      const columns: string[] = [];
      const lines = body.split(',').map((l) => l.trim());
      for (const line of lines) {
        if (
          line.toUpperCase().startsWith('FOREIGN KEY') ||
          line.toUpperCase().startsWith('PRIMARY KEY') ||
          line.toUpperCase().startsWith('CHECK') ||
          line.toUpperCase().startsWith('UNIQUE') ||
          line.length === 0
        ) {
          continue;
        }
        const colName = line.split(/\s+/)[0];
        if (colName && !columns.includes(colName)) {
          columns.push(colName);
        }
      }

      this.tables.set(tableName, { columns, rows: [] });
      return;
    }

    // 2. CREATE INDEX
    const createIndexMatch = trimmed.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/i);
    if (createIndexMatch) {
      const indexName = createIndexMatch[1];
      const tableName = createIndexMatch[2];
      const colDefs = createIndexMatch[3].split(',').map((c) => c.trim().split(/\s+/)[0]);

      const table = this.tables.get(tableName);
      if (!table) {
        throw new Error(`no such table: ${tableName}`);
      }

      // STRICT VALIDATION: Check each indexed column exists on table (just like real SQLite)
      for (const col of colDefs) {
        if (!table.columns.includes(col)) {
          throw new Error(`no such column: ${col}`);
        }
      }

      this.indices.set(indexName, { tableName, columns: colDefs });
      return;
    }

    // 3. ALTER TABLE RENAME TO
    const renameMatch = trimmed.match(/ALTER TABLE\s+([a-zA-Z0-9_]+)\s+RENAME TO\s+([a-zA-Z0-9_]+)/i);
    if (renameMatch) {
      const oldName = renameMatch[1];
      const newName = renameMatch[2];
      const tableData = this.tables.get(oldName);
      if (tableData) {
        this.tables.delete(oldName);
        this.tables.set(newName, tableData);
      }
      return;
    }

    // 4. ALTER TABLE ADD COLUMN
    const addColMatch = trimmed.match(/ALTER TABLE\s+([a-zA-Z0-9_]+)\s+ADD COLUMN\s+([a-zA-Z0-9_]+)/i);
    if (addColMatch) {
      const tableName = addColMatch[1];
      const colName = addColMatch[2];
      const tableData = this.tables.get(tableName);
      if (tableData && !tableData.columns.includes(colName)) {
        tableData.columns.push(colName);
      }
      return;
    }

    // 5. DROP TABLE
    const dropTableMatch = trimmed.match(/DROP TABLE\s+(?:IF EXISTS\s+)?([a-zA-Z0-9_]+)/i);
    if (dropTableMatch) {
      const tableName = dropTableMatch[1];
      this.tables.delete(tableName);
      return;
    }

    // 6. INSERT INTO (data migration simulation)
    if (trimmed.startsWith('INSERT INTO')) {
      return;
    }
  }
}

describe('SQLite Migration Runner & Schema Evolution Integration Tests', () => {
  let simulator: SqliteSchemaSimulator;

  beforeEach(() => {
    simulator = new SqliteSchemaSimulator();
  });

  it('should execute full migration chain (v1 -> v2 -> v3 -> v4 -> v5 -> v6) on a fresh database without errors', async () => {
    const db = simulator.getDb();

    // Must execute all 8 migrations cleanly
    await expect(runMigrations(db)).resolves.not.toThrow();

    // Verify all 8 migrations were applied
    expect(simulator.schemaVersions.length).toBe(MIGRATIONS.length);
    expect(simulator.schemaVersions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // Verify savings_goals table exists with Phase 3B canonical schema
    const savingsGoalsTable = simulator.tables.get('savings_goals');
    expect(savingsGoalsTable).toBeDefined();
    expect(savingsGoalsTable?.columns).toContain('id');
    expect(savingsGoalsTable?.columns).toContain('user_id');
    expect(savingsGoalsTable?.columns).toContain('name');
    expect(savingsGoalsTable?.columns).toContain('target_amount');
    expect(savingsGoalsTable?.columns).toContain('current_amount');
    expect(savingsGoalsTable?.columns).toContain('target_date');
    expect(savingsGoalsTable?.columns).toContain('created_at');
    expect(savingsGoalsTable?.columns).toContain('updated_at');
    expect(savingsGoalsTable?.columns).toContain('deleted_at');
    expect(savingsGoalsTable?.columns).toContain('sync_state');

    // Verify legacy savings_allocations table was dropped
    expect(simulator.tables.get('savings_allocations')).toBeUndefined();

    // Verify debts table exists with Phase 3C schema
    const debtsTable = simulator.tables.get('debts');
    expect(debtsTable).toBeDefined();
    expect(debtsTable?.columns).toContain('id');
    expect(debtsTable?.columns).toContain('user_id');
    expect(debtsTable?.columns).toContain('type');
    expect(debtsTable?.columns).toContain('person_name');
    expect(debtsTable?.columns).toContain('original_amount');
    expect(debtsTable?.columns).toContain('remaining_amount');
    expect(debtsTable?.columns).toContain('due_date');
    expect(debtsTable?.columns).toContain('status');

    // Verify recurring_transactions table exists with Phase 3D schema
    const recurringTable = simulator.tables.get('recurring_transactions');
    expect(recurringTable).toBeDefined();
    expect(recurringTable?.columns).toContain('id');
    expect(recurringTable?.columns).toContain('user_id');
    expect(recurringTable?.columns).toContain('type');
    expect(recurringTable?.columns).toContain('amount');
    expect(recurringTable?.columns).toContain('account_id');
    expect(recurringTable?.columns).toContain('category_id');
    expect(recurringTable?.columns).toContain('frequency');
    expect(recurringTable?.columns).toContain('start_date');
    expect(recurringTable?.columns).toContain('next_occurrence');
    expect(recurringTable?.columns).toContain('is_active');

    // Verify indices exist
    expect(simulator.indices.get('idx_savings_goals_user_active')).toBeDefined();
    expect(simulator.indices.get('idx_debts_user_status_due')).toBeDefined();
    expect(simulator.indices.get('idx_debts_user_active')).toBeDefined();
    expect(simulator.indices.get('idx_transactions_debt')).toBeDefined();
    expect(simulator.indices.get('idx_recurring_user_active_next')).toBeDefined();
    expect(simulator.indices.get('idx_recurring_user_active')).toBeDefined();
    expect(simulator.indices.get('idx_transactions_recurring')).toBeDefined();
    expect(simulator.indices.get('idx_transactions_occurrence_key')).toBeDefined();
  });

  it('should successfully upgrade an existing database with migrations v1-v7 already applied to v8', async () => {
    const db = simulator.getDb();

    // 1. Simulate an existing database where v1-v7 ran
    for (let i = 0; i < 7; i++) {
      const m = MIGRATIONS[i];
      await m.up(db);
      simulator.schemaVersions.push({
        version: m.version,
        name: m.name,
        applied_at: '2026-08-19T00:00:00.000Z',
      });
    }

    // Seed data into accounts, categories, budgets, savings_goals, transactions, debts, recurring
    simulator.tables.get('accounts')?.rows.push({ id: 'acc-1', user_id: 'user-1', name: 'BCA' });
    simulator.tables.get('categories')?.rows.push({ id: 'cat-1', user_id: 'user-1', name: 'Makanan' });
    simulator.tables.get('budgets')?.rows.push({ id: 'bg-1', user_id: 'user-1', amount: 1000000 });
    simulator.tables.get('savings_goals')?.rows.push({ id: 'sg-1', user_id: 'user-1', name: 'Dana Darurat', target_amount: 10000000, current_amount: 2000000 });
    simulator.tables.get('debts')?.rows.push({ id: 'debt-1', user_id: 'user-1', type: 'borrowed', person_name: 'Budi', original_amount: 5000000, remaining_amount: 5000000 });
    simulator.tables.get('recurring_transactions')?.rows.push({ id: 'rec-1', user_id: 'user-1', type: 'expense', amount: 500000, frequency: 'monthly' });
    simulator.tables.get('transactions')?.rows.push({ id: 'tx-1', user_id: 'user-1', amount: 50000, debt_id: 'debt-1', recurring_transaction_id: 'rec-1' });

    // 2. Run runMigrations (should apply v8)
    await expect(runMigrations(db)).resolves.not.toThrow();

    // Verify migration v8 was recorded
    expect(simulator.schemaVersions.length).toBe(8);
    expect(simulator.schemaVersions[7].version).toBe(8);

    // Verify existing tables & rows remain intact
    expect(simulator.tables.get('accounts')?.rows.length).toBe(1);
    expect(simulator.tables.get('categories')?.rows.length).toBe(1);
    expect(simulator.tables.get('budgets')?.rows.length).toBe(1);
    expect(simulator.tables.get('savings_goals')?.rows.length).toBe(1);
    expect(simulator.tables.get('debts')?.rows.length).toBe(1);
    expect(simulator.tables.get('recurring_transactions')?.rows.length).toBe(1);
    expect(simulator.tables.get('transactions')?.rows.length).toBe(1);

    // Verify recurring indices are created
    expect(simulator.indices.get('idx_recurring_user_active_next')).toBeDefined();
    expect(simulator.indices.get('idx_recurring_user_active')).toBeDefined();
    expect(simulator.indices.get('idx_transactions_recurring')).toBeDefined();
    expect(simulator.indices.get('idx_transactions_occurrence_key')).toBeDefined();
  });

  it('should be idempotent and not re-run any migration when all versions are up-to-date', async () => {
    const db = simulator.getDb();

    // Run migrations first time
    await runMigrations(db);
    expect(simulator.schemaVersions.length).toBe(8);

    // Run migrations second time
    await expect(runMigrations(db)).resolves.not.toThrow();
    expect(simulator.schemaVersions.length).toBe(8);
  });
});
