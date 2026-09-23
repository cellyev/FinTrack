import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const DB_NAME = 'fintrack.db';

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    // Enable WAL mode, foreign keys, and busy timeout for concurrent safety
    await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
    await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
    await dbInstance.execAsync('PRAGMA busy_timeout = 5000;');
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/**
 * Mengosongkan semua data lokal SQLite (Berguna untuk fase development & pengujian)
 */
export async function clearAllLocalData(db?: SQLite.SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.execAsync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM transaction_items;
    DELETE FROM transactions;
    DELETE FROM budget_categories;
    DELETE FROM budgets;
    DELETE FROM savings_allocations;
    DELETE FROM savings_goals;
    DELETE FROM debt_payments;
    DELETE FROM debts;
    DELETE FROM recurring_transactions;
    DELETE FROM categories;
    DELETE FROM accounts;
    DELETE FROM outbox;
    DELETE FROM sync_metadata;
    DELETE FROM sync_conflicts;
    PRAGMA foreign_keys = ON;
  `);
}
