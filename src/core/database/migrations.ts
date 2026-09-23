import * as SQLite from 'expo-sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_baseline_local_schema',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        -- Schema version tracking
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        -- Local outbox for resilient offline synchronization
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT
        );

        -- Local mirror tables with device-only sync metadata columns
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          full_name TEXT,
          currency_code TEXT NOT NULL DEFAULT 'IDR',
          timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL DEFAULT 'IDR',
          icon TEXT,
          color TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          icon TEXT,
          color TEXT,
          is_system INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          period TEXT NOT NULL DEFAULT 'custom',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          total_amount INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS budget_categories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          budget_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        CREATE TABLE IF NOT EXISTS savings_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          target_amount INTEGER NOT NULL,
          target_date TEXT,
          icon TEXT,
          color TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS savings_allocations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          savings_goal_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (savings_goal_id) REFERENCES savings_goals (id),
          FOREIGN KEY (account_id) REFERENCES accounts (id)
        );

        CREATE TABLE IF NOT EXISTS debts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          person_name TEXT NOT NULL,
          original_amount INTEGER NOT NULL,
          remaining_amount INTEGER NOT NULL,
          due_date TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS recurring_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          account_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          note TEXT,
          frequency TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          next_occurrence TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (account_id) REFERENCES accounts (id),
          FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount INTEGER NOT NULL,
          source_account_id TEXT,
          destination_account_id TEXT,
          debt_id TEXT,
          recurring_transaction_id TEXT,
          occurrence_key TEXT UNIQUE,
          transaction_date TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (source_account_id) REFERENCES accounts (id),
          FOREIGN KEY (destination_account_id) REFERENCES accounts (id),
          FOREIGN KEY (debt_id) REFERENCES debts (id),
          FOREIGN KEY (recurring_transaction_id) REFERENCES recurring_transactions (id)
        );

        CREATE TABLE IF NOT EXISTS transaction_items (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_id TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          local_uri TEXT,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          width INTEGER,
          height INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          base_updated_at TEXT,
          last_error TEXT,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
        );

        -- Local query performance indices
        CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
        CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
        CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON transaction_items(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(retry_count, created_at);
      `);
    },
  },
  {
    version: 2,
    name: '002_history_query_indices',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        -- Dedicated indices for transaction history feed, search, and filtering
        CREATE INDEX IF NOT EXISTS idx_transactions_history
          ON transactions(user_id, deleted_at, transaction_date DESC, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_transactions_type_user
          ON transactions(user_id, type, deleted_at);

        CREATE INDEX IF NOT EXISTS idx_transactions_accounts_user
          ON transactions(user_id, source_account_id, destination_account_id, deleted_at);

        CREATE INDEX IF NOT EXISTS idx_transaction_items_cat_user
          ON transaction_items(user_id, category_id, deleted_at);
      `);
    },
  },
  {
    version: 3,
    name: '003_sync_engine_metadata',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        -- Sync metadata tracking table per entity and user
        CREATE TABLE IF NOT EXISTS sync_metadata (
          user_id TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          last_synced_at TEXT,
          last_sync_status TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, entity_name)
        );

        -- Add state machine columns to outbox if they don't exist
        -- (SQLite executes safely when using versioned migration)
        CREATE INDEX IF NOT EXISTS idx_outbox_user_status ON outbox(user_id, retry_count, created_at);
      `);

      // Add columns to existing outbox tables safely
      try {
        await db.execAsync(`ALTER TABLE outbox ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';`);
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(`ALTER TABLE outbox ADD COLUMN next_retry_at TEXT;`);
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(`ALTER TABLE outbox ADD COLUMN processed_at TEXT;`);
      } catch {
        // Column may already exist
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_outbox_queue ON outbox(user_id, status, next_retry_at, created_at);
      `);
    },
  },
  {
    version: 4,
    name: '004_sync_conflicts_table',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          conflict_type TEXT NOT NULL,
          local_payload TEXT NOT NULL,
          remote_payload TEXT,
          local_updated_at TEXT NOT NULL,
          remote_updated_at TEXT,
          status TEXT NOT NULL DEFAULT 'unresolved',
          resolution TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_status ON sync_conflicts(user_id, status);
      `);
    },
  },
  {
    version: 5,
    name: '005_budgets_table',
    up: async (db) => {
      // 1. Inspect existing budgets table schema
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(budgets);');
      const columnNames = new Set(tableInfo.map((col) => col.name));

      const hasCategoryId = columnNames.has('category_id');
      const hasAmount = columnNames.has('amount');
      const hasPeriodType = columnNames.has('period_type');

      if (tableInfo.length > 0 && (!hasCategoryId || !hasAmount || !hasPeriodType)) {
        // Table exists with old v1 schema (missing category_id / amount / period_type).
        // Apply standard SQLite table migration pattern:
        // a. Create new table budgets_new
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS budgets_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            name TEXT,
            amount INTEGER NOT NULL CHECK (amount > 0),
            period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'custom')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id)
          );
        `);

        // b. If old budget_categories table exists with data, migrate joined records
        try {
          const hasBudgetCategories = await db.getFirstAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='budget_categories';"
          );

          if (hasBudgetCategories) {
            await db.execAsync(`
              INSERT OR IGNORE INTO budgets_new (
                id, user_id, category_id, name, amount, period_type,
                start_date, end_date, created_at, updated_at, deleted_at, sync_state, base_updated_at
              )
              SELECT
                b.id,
                b.user_id,
                bc.category_id,
                b.name,
                COALESCE(bc.amount, b.total_amount, 1),
                CASE WHEN b.period = 'monthly' THEN 'monthly' ELSE 'custom' END,
                b.start_date,
                b.end_date,
                b.created_at,
                b.updated_at,
                b.deleted_at,
                b.sync_state,
                b.base_updated_at
              FROM budgets b
              JOIN budget_categories bc ON bc.budget_id = b.id;
            `);
          }
        } catch {
          // Proceed safely if table does not exist or has no joinable rows
        }

        // c. Drop obsolete budget_categories table and old budgets table, then rename budgets_new -> budgets
        await db.execAsync(`
          DROP TABLE IF EXISTS budget_categories;
          DROP TABLE IF EXISTS budgets;
          ALTER TABLE budgets_new RENAME TO budgets;
        `);
      } else if (tableInfo.length === 0) {
        // Fresh creation (if budgets table did not exist at all)
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            name TEXT,
            amount INTEGER NOT NULL CHECK (amount > 0),
            period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'custom')),
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT,
            FOREIGN KEY (category_id) REFERENCES categories(id)
          );
        `);
      }

      // d. Ensure obsolete budget_categories table is removed and create required indices
      await db.execAsync(`
        DROP TABLE IF EXISTS budget_categories;
        CREATE INDEX IF NOT EXISTS idx_budgets_user_active ON budgets(user_id, deleted_at, start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(user_id, category_id, deleted_at);
      `);
    },
  },
  {
    version: 6,
    name: '006_savings_goals_table',
    up: async (db) => {
      // 1. Inspect existing savings_goals table schema
      const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(savings_goals);');
      const columnNames = new Set(tableInfo.map((col) => col.name));

      const hasCurrentAmount = columnNames.has('current_amount');

      if (tableInfo.length > 0 && !hasCurrentAmount) {
        // Old v1 schema exists: apply SQLite table migration pattern
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS savings_goals_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            target_amount INTEGER NOT NULL CHECK (target_amount > 0),
            current_amount INTEGER NOT NULL DEFAULT 0 CHECK (current_amount >= 0 AND current_amount <= target_amount),
            target_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT
          );
        `);

        // Check if legacy savings_allocations table exists
        const hasAllocationsTable = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='savings_allocations';"
        );

        if (hasAllocationsTable) {
          // Aggregate legacy allocations and normalize: MIN(total_allocated, target_amount)
          await db.execAsync(`
            INSERT INTO savings_goals_new (
              id, user_id, name, target_amount, current_amount,
              target_date, created_at, updated_at, deleted_at, sync_state, base_updated_at
            )
            SELECT
              g.id,
              g.user_id,
              g.name,
              g.target_amount,
              CASE
                WHEN alloc.total_allocated IS NOT NULL
                THEN MAX(0, MIN(alloc.total_allocated, g.target_amount))
                ELSE 0
              END,
              g.target_date,
              g.created_at,
              g.updated_at,
              g.deleted_at,
              g.sync_state,
              g.base_updated_at
            FROM savings_goals g
            LEFT JOIN (
              SELECT savings_goal_id, SUM(amount) AS total_allocated
              FROM savings_allocations
              WHERE deleted_at IS NULL
              GROUP BY savings_goal_id
            ) alloc ON alloc.savings_goal_id = g.id;
          `);
        } else {
          // Direct migration without allocations table
          await db.execAsync(`
            INSERT INTO savings_goals_new (
              id, user_id, name, target_amount, current_amount,
              target_date, created_at, updated_at, deleted_at, sync_state, base_updated_at
            )
            SELECT
              id, user_id, name, target_amount, 0,
              target_date, created_at, updated_at, deleted_at, sync_state, base_updated_at
            FROM savings_goals;
          `);
        }

        // Drop obsolete tables and rename
        await db.execAsync(`
          DROP TABLE IF EXISTS savings_allocations;
          DROP TABLE IF EXISTS savings_goals;
          ALTER TABLE savings_goals_new RENAME TO savings_goals;
        `);
      } else if (tableInfo.length === 0) {
        // Fresh creation
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS savings_goals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            target_amount INTEGER NOT NULL CHECK (target_amount > 0),
            current_amount INTEGER NOT NULL DEFAULT 0 CHECK (current_amount >= 0 AND current_amount <= target_amount),
            target_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT
          );
        `);
      }

      // Ensure obsolete allocations table is removed and create indices
      await db.execAsync(`
        DROP TABLE IF EXISTS savings_allocations;
        CREATE INDEX IF NOT EXISTS idx_savings_goals_user_active
          ON savings_goals(user_id, deleted_at, target_date);
      `);
    },
  },
  {
    version: 7,
    name: '007_debts_indices_and_consistency',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Ensure canonical debts table exists
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(debts);');
      if (columns.length === 0) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS debts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            person_name TEXT NOT NULL,
            original_amount INTEGER NOT NULL CHECK (original_amount > 0),
            remaining_amount INTEGER NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= original_amount),
            due_date TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            note TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT
          );
        `);
      }

      // 2. Create indices for debts and transaction debt foreign key lookup
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_debts_user_status_due
          ON debts (user_id, status, due_date);
        CREATE INDEX IF NOT EXISTS idx_debts_user_active
          ON debts (user_id, deleted_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_debt
          ON transactions (user_id, debt_id);
      `);
    },
  },
  {
    version: 8,
    name: '008_recurring_transactions_indices_and_consistency',
    up: async (db: SQLite.SQLiteDatabase) => {
      // 1. Ensure canonical recurring_transactions table exists
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(recurring_transactions);');
      if (columns.length === 0) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS recurring_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL CHECK (amount > 0),
            account_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            note TEXT,
            frequency TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            next_occurrence TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            sync_state TEXT NOT NULL DEFAULT 'synced',
            base_updated_at TEXT
          );
        `);
      }

      // 2. Create indices for recurring transactions and transactions occurrence key lookup
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_recurring_user_active_next
          ON recurring_transactions (user_id, is_active, next_occurrence);
        CREATE INDEX IF NOT EXISTS idx_recurring_user_active
          ON recurring_transactions (user_id, deleted_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_recurring
          ON transactions (user_id, recurring_transaction_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_occurrence_key
          ON transactions (occurrence_key);
      `);
    },
  },
];

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Ensure schema_version table exists first
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`[Migrations] Applying migration v${migration.version}: ${migration.name}`);
      await migration.up(db);
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?);',
        [migration.version, migration.name, now]
      );
      console.log(`[Migrations] Successfully applied migration v${migration.version}`);
    }
  }
}
