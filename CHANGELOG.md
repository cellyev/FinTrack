# Changelog

All notable design and implementation changes are recorded here.

## [Unreleased]

### Added

- Initial implementation-ready architecture and product documentation.
- Supabase PostgreSQL schema, RLS, and financial RPC specification.
- Offline-first SQLite sync, security, and HCI guidance.
- Phase 0 Foundation: React Native + Expo TypeScript setup with strict typing, pnpm package management, and Jest (`jest-expo`) testing framework.
- Core layer primitives: Decimal-safe `Money` integer minor units value object, `Result<T, E>` and domain errors, `IUuidGenerator` domain port with Expo Crypto implementation, `IClock` port with System Clock implementation, and runtime Zod environment validation.
- Database foundation: Expo SQLite connection lifecycle with versioned migration runner (`schema_version`, local mirror tables, outbox, and performance indices).
- Security & Cloud: Supabase client with Expo SecureStore session persistence adapter, and baseline PostgreSQL migration prepared at `supabase/migrations/20260819000000_baseline_schema.sql`.
- Auth feature shell: Domain `AuthUser`/`IAuthRepository`, Application use cases (`SignIn`, `SignUp`, `SignOut`, `GetSession`), Supabase gateway implementation, and Zustand state store.
- Design tokens & Accessible UI baseline: Theme colors (WCAG AA), typography, spacing, atomic components (`AppScreen`, `AppText`, `AppButton`, `AppInput`, `LoadingState`, `EmptyState`, `ErrorState`, `OfflineBanner`), and application bottom tabs routing shell (`Home`, `History`, `Plan`, `Profile`).
- Phase 1A Ledger Domain Core:
  - Account domain model (`Account`, `AccountType`: cash, bank, ewallet) with validation and soft deletion.
  - Category domain model (`Category`, `CategoryType`: income, expense) with system category protection.
  - Transaction Aggregate Root (`Transaction`, `TransactionItem`) strictly enforcing rules for `income`, `expense`, `transfer`, and `opening_balance`.
  - Invariants: exact category split sum match for income/expense, split prohibition on transfer and opening balance, different source/destination on transfer.
  - Ledger Balance Calculator domain service (`LedgerBalanceCalculator`) calculating account balances and Net Worth dynamically from active non-deleted ledger transactions (`account_balance = SUM(dest) - SUM(src)`).
  - Seven-day correction policy domain contract (`SevenDayCorrectionPolicy`, `ITransactionCorrectionPolicy`).
- Phase 1B Local Ledger Persistence:
  - Repository interfaces in domain layer: `IAccountRepository`, `ICategoryRepository`, `ITransactionRepository`.
  - Concrete SQLite repositories in infrastructure layer: `SqliteAccountRepository`, `SqliteCategoryRepository`, `SqliteTransactionRepository`.
  - Atomic database transactions with rollback guarantee: creation and soft-deletion of transaction header, category splits, and outbox queue entries are strictly atomic.
  - Outbox offline-first queue foundation: automatic creation of outbox events (`CREATE_ACCOUNT`, `UPDATE_ACCOUNT`, `DELETE_ACCOUNT`, `CREATE_CATEGORY`, `UPDATE_CATEGORY`, `DELETE_CATEGORY`, `CREATE_TRANSACTION`, `DELETE_TRANSACTION`).
  - Integer minor units precision guarantee for Money values (Rp 1 to Rp 50.000.000.000).
  - Application use cases: `CreateAccountUseCase`, `ListAccountsUseCase`, `GetAccountUseCase`, `CreateCategoryUseCase`, `ListCategoriesUseCase`, `CreateTransactionUseCase`, `ListTransactionsUseCase`, `GetTransactionUseCase`, `SoftDeleteTransactionUseCase`, `GetAccountBalanceUseCase`, `GetTotalNetWorthUseCase`.
- Phase 1C Account Management:
  - Atomic account and opening balance creation: `createWithOpeningBalance` in `SqliteAccountRepository` and `CreateAccountWithOpeningBalanceUseCase`.
  - Dependency-ordered outbox events (`CREATE_ACCOUNT` precedes `CREATE_TRANSACTION` opening balance).
  - Derived balance and Net Worth overview use case: `GetAccountsWithBalancesUseCase` aggregating derived account balances and Net Worth without stored balance fields.
  - Account lifecycle: `UpdateAccountUseCase` and `SoftDeleteAccountUseCase` enforcing tombstone deletion (`deleted_at = now()`) and user isolation.
  - Accessible presentation layer: `AccountListScreen`, `CreateAccountScreen`, `AccountDetailScreen`, `useAccounts` hook, and navigation routing integration (`/accounts`, `/accounts/create`, `/accounts/[id]`, Home, Profile).
- Phase 1D Transaction Creation:
  - Fast financial entry workflows: `CreateExpenseUseCase`, `CreateIncomeUseCase`, and `CreateTransferUseCase`.
  - Master category seeding and isolation: `EnsureDefaultCategoriesUseCase` seeding default system categories dynamically.
  - Multi-category split UX: `CategorySplitBuilder` offering real-time Total, Allocated, and Remaining feedback cards and error prevention.
  - Transfer integrity: Enforcement of distinct source and destination accounts without category splits.
  - Atomic persistence & Outbox: Transaction header, splits, and `CREATE_TRANSACTION` outbox mutations commit together in 1 SQLite exclusive transaction.
  - Instant offline derived balance recalculation: Immediate updates to source/destination accounts and Total Net Worth.
  - Presentation & Routing: `AddExpenseScreen`, `AddIncomeScreen`, `AddTransferScreen`, `TransactionTypePickerScreen`, Home screen Quick Action buttons, and `/transactions/*` routes.
- Phase 1E Transaction History & Transaction Detail:
  - Database indexing migration v2: `002_history_query_indices` for optimal B-Tree index lookup on history/search queries.
  - Local SQLite search & filter query: Filter by transaction type, account, category, and date presets ("Hari ini", "Minggu ini", "Bulan ini") with parameterized search against notes, account names, and category names.
  - Application use cases & DTOs: `GetTransactionHistoryUseCase`, `GetTransactionDetailUseCase`, and `GetRecentTransactionsUseCase` with deterministic `groupTransactionsByDate` pure helper.
  - Presentation components: `TransactionListItem` with redundant visual encoding (icons, signs `+/-`, labels, IDR format), `TransactionFilterModal`, and `useTransactionHistory` hook with 300ms search debounce.
  - Screens & Routing: `TransactionHistoryScreen` on `/history`, `TransactionDetailScreen` on `/transactions/[id]`, and live Recent Transactions section on Home screen (`/(tabs)/index.tsx`).
- Phase 1F Category Management:
  - Domain invariants: Protection of system categories (`isSystem = true`) against renaming, modification, and deletion.
  - Master data & idempotency: Idempotent seeding of 13 system default categories (8 expense, 5 income) via `EnsureDefaultCategoriesUseCase`.
  - Application use cases: `CreateCategoryUseCase`, `UpdateCategoryUseCase`, `ArchiveCategoryUseCase`, and `GetCategoryUseCase` with case-insensitive and whitespace-trimmed duplicate name validation per (userId, type).
  - Persistence & Outbox: Atomic category mutations with `CREATE_CATEGORY`, `UPDATE_CATEGORY`, and `DELETE_CATEGORY` outbox records in SQLite exclusive transactions.
  - Presentation & Routing: `CategoryListScreen` with segmented expense/income tabs and system/custom sections, `CreateCategoryScreen` with emoji icon and color palette pickers, `EditCategoryScreen`, `useCategoryManagement` hook, `/categories/*` routes, and entry point from Profile tab.
- Phase 1G Transaction Correction & Editing Window:
  - Domain & Policy: Seven-day correction policy enforcement (`SevenDayCorrectionPolicy` using `IClock`) prohibiting edits past the 7-day correction window. Explicit restriction preventing modification of opening balance ledger transactions.
  - Repository & Atomicity: `update` contract on `ITransactionRepository` and `SqliteTransactionRepository` executing atomic updates of transaction header and replacement of split items in a single SQLite transaction with `UPDATE_TRANSACTION` outbox event recording.
  - Application & Derived Balance: `UpdateTransactionUseCase` validating user isolation, active non-archived accounts, active matching-type categories, and aggregate domain invariants (amount > 0, split sum match, transfer source != destination). Derived balances recalculate automatically from the immutable ledger formula.
  - Presentation & Routing: `EditTransactionScreen` with preloaded values and validation, `useEditTransaction` & `useTransactionDetail` presentation hooks, `/transactions/edit/[id]` route, dynamic "Ubah Transaksi" action button in `TransactionDetailScreen` when eligible, and a 7-day expiration warning notice when the window has elapsed.
- Phase 2A Cloud Synchronization Foundation:
  - SQLite Migration v3: Added `003_sync_engine_metadata` migration creating the `sync_metadata` table for per-entity delta cursors and adding state machine columns (`status`, `next_retry_at`, `processed_at`) with composite indices to the `outbox` table.
  - Domain & Outbox Repository: `SqliteOutboxRepository` for atomic state transitions (`pending` -> `processing` -> `completed` / `failed` / `dead_letter`), automatic crash recovery for hanging in-flight operations, and per-entity cursor tracking.
  - Network Observer: `INetworkMonitor` and `NetInfoNetworkMonitor` using `@react-native-community/netinfo` for event-driven online/offline detection.
  - Cloud Sync Adapter: `SupabaseSyncAdapter` mapping local outbox mutations to Supabase REST endpoints (`accounts`, `categories`) and financial RPC functions (`create_transaction`, `update_transaction`, `soft_delete_transaction`) with idempotency key injection (`p_operation_id`), and delta pull query methods.
  - Push Outbox Worker: `OutboxWorker` processing pending mutations in causal topological order (Accounts -> Categories -> Transactions) with exponential backoff and jitter for transient errors and routing permanent errors to `dead_letter`.
  - Pull Synchronizer: `PullSynchronizer` applying remote account, category, and transaction deltas atomically in a single SQLite transaction while preserving soft-delete tombstones.
  - Sync Coordinator & Hook: `SyncCoordinator` singleton managing synchronization mutex locks, network/auth event listeners, and `useSyncStatus` presentation hook.
- Phase 2B Sync UI Integration & Live Realtime Optimization:
  - Sync Status UI & Badges: Created reusable `SyncStatusBadge` component (`✓ Tersinkron`, `↻ Menyinkronkan...`, `⚡ Offline`, `⚠ Gagal`, `● X pending`) with modal feedback and tap-to-sync triggers.
  - Dashboard & History Integration: Integrated `SyncStatusBadge` into the HomeScreen and TransactionHistoryScreen headers, wiring native `RefreshControl` pull-to-refresh directly with `SyncCoordinator.syncNow()` followed by local SQLite state query updates.
  - Supabase Realtime Trigger: Implemented `SupabaseRealtimeTrigger` subscribing to user-scoped postgres changes on `accounts`, `categories`, and `transactions` via Supabase Realtime Channels, debouncing rapid mutations (500ms) to trigger `PullSynchronizer` without violating offline-first local SQLite authority.
  - App Lifecycle Observer: Implemented `AppLifecycleObserver` watching React Native `AppState` changes to seamlessly trigger synchronizations upon app foregrounding.
  - Coordinator Mutex & Queued Execution: Upgraded `SyncCoordinator` with `requestSync` debouncing, queued follow-up execution when triggers arrive during active sync passes, and comprehensive `deadLetterCount` observability.
- Phase 2C Conflict Resolution & Multi-Device Consistency:
  - SQLite Migration v4: Added `004_sync_conflicts_table` creating the `sync_conflicts` table and indices for tracking unresolved and resolved synchronization conflicts per user.
  - Conflict Domain & Types: Created `SyncConflictRecord`, `SyncConflictType` (`concurrent_update`, `update_delete`, `delete_update`, `duplicate_category`, `stale_version`, `correction_window_expired`), and `ConflictResolutionStrategy` (`use_local`, `use_remote`, `manual`).
  - Persistence & Repository: Implemented `SqliteConflictRepository` with methods for recording conflicts, querying unresolved conflicts per user, count queries, and marking conflicts resolved.
  - Push Conflict Detection & Mitigation: Enhanced `OutboxWorker` to classify Supabase error responses (stale versions, 7-day correction window expired, duplicate unique constraints), automatically log them to `sync_conflicts`, and move conflicting mutations to `dead_letter` without endless retry loops.
  - Pull Reconciliation & Conflict Detection: Upgraded `PullSynchronizer` to detect concurrent remote updates or remote deletions colliding with local pending mutations, recording explicit conflicts in SQLite.
  - Conflict Resolution Use Case: Implemented `ResolveSyncConflictUseCase` executing atomic resolution: 'use_remote' applies the remote entity and split items while completing the local outbox mutation; 'use_local' re-queues the outbox mutation for push synchronization.
  - Conflict UI & Badge: Created `SyncConflictModal` with human-friendly Indonesian wording ("Gunakan Versi Perangkat" vs "Gunakan Versi Cloud"), updated `SyncStatusBadge` to display `⚠ X konflik`, and added `useSyncConflicts` hook.
  - Multi-Device Convergence & Comprehensive Testing: Verified deterministic multi-device convergence across two offline-first devices and cloud backend with 38 test suites and 188 unit/integration tests passing.
- Phase 3A Budgeting Domain Foundation:
  - SQLite Migration v5: Added `005_budgets_table` migration creating the `budgets` table with composite indices on `(user_id, deleted_at, start_date, end_date)` and `(user_id, category_id, deleted_at)`.
  - Domain Model & Invariants: Implemented `BudgetPeriod` value object (monthly and custom dates), `Budget` aggregate entity with user isolation and soft delete, and `calculateBudgetProgress` pure domain function computing derived spending, remaining amounts, percentage used, and over-budget states dynamically from local non-deleted expense ledger transactions.
  - Local Repository: Implemented `SqliteBudgetRepository` executing atomic SQLite transactions with outbox event queuing (`CREATE_BUDGET`, `UPDATE_BUDGET`, `DELETE_BUDGET`), and dynamic SQL aggregations for actual spending (`COALESCE(SUM(ti.amount), 0)` filtering `t.type = 'expense'`).
  - Application Layer Use Cases: Implemented `CreateBudgetUseCase`, `UpdateBudgetUseCase`, `SoftDeleteBudgetUseCase`, `GetBudgetProgressUseCase`, and `ListBudgetsWithProgressUseCase`.
  - Cloud Sync & Conflict Engine Integration: Updated `SupabaseSyncAdapter`, `OutboxWorker`, `PullSynchronizer`, `SqliteConflictRepository`, and `ResolveSyncConflictUseCase` with topological causal ordering (Accounts -> Categories -> Budgets -> Transactions) and conflict resolution.
  - Presentation Layer: Created `useBudgets` presentation hook, `BudgetProgressCard` with visual badges and progress bars, `CreateBudgetModal` (`CreateBudgetScreen`), and `EditBudgetModal` (`EditBudgetScreen`).
  - Screen Integration: Upgraded `PlanScreen` (`/(tabs)/plan.tsx`) with comprehensive budget totals and active budget management, and integrated a live "Pantauan Anggaran" section into the HomeScreen (`/(tabs)/index.tsx`).
  - Quality Gate Verification: Passed `pnpm typecheck`, `pnpm lint`, and 45 test suites (225 tests) with 0 errors and 0 warnings.

## [0.1.0] — 2026-08-19

### Defined

- Finance domain decisions: multi-account ledger, transaction splits, virtual savings allocations, debt/receivable, recurring templates, and seven-day correction window.

