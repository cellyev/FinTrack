import * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/database/sqlite';
import { SqliteOutboxRepository } from '../data/sqlite-outbox.repository';
import {
  SupabaseSyncAdapter,
  RemoteBudgetRow,
  RemoteSavingsGoalRow,
  RemoteDebtRow,
  RemoteRecurringTransactionRow,
} from '../data/supabase-sync.adapter';
import { SqliteConflictRepository } from '../data/sqlite-conflict.repository';
import { appEvents } from '@/core/events/app-events';

export interface PullSummary {
  accountsApplied: number;
  categoriesApplied: number;
  budgetsApplied: number;
  savingsGoalsApplied: number;
  debtsApplied: number;
  recurringTransactionsApplied: number;
  transactionsApplied: number;
  latestServerTimestamp: string | null;
  conflictsDetected: number;
}

export class PullSynchronizer {
  constructor(
    private readonly outboxRepo: SqliteOutboxRepository,
    private readonly syncAdapter: SupabaseSyncAdapter,
    private readonly conflictRepo: SqliteConflictRepository = new SqliteConflictRepository(),
    private readonly getDb: () => Promise<SQLite.SQLiteDatabase> = getDatabase
  ) {}

  public async pullChanges(userId: string): Promise<PullSummary> {
    const summary: PullSummary = {
      accountsApplied: 0,
      categoriesApplied: 0,
      budgetsApplied: 0,
      savingsGoalsApplied: 0,
      debtsApplied: 0,
      recurringTransactionsApplied: 0,
      transactionsApplied: 0,
      latestServerTimestamp: null,
      conflictsDetected: 0,
    };

    // 1. Fetch cursor timestamps from sync_metadata
    const [accMeta, catMeta, bgMeta, sgMeta, debtMeta, recMeta, txMeta] = await Promise.all([
      this.outboxRepo.getLastSyncMetadata(userId, 'accounts'),
      this.outboxRepo.getLastSyncMetadata(userId, 'categories'),
      this.outboxRepo.getLastSyncMetadata(userId, 'budgets'),
      this.outboxRepo.getLastSyncMetadata(userId, 'savings_goals'),
      this.outboxRepo.getLastSyncMetadata(userId, 'debts'),
      this.outboxRepo.getLastSyncMetadata(userId, 'recurring_transactions'),
      this.outboxRepo.getLastSyncMetadata(userId, 'transactions'),
    ]);

    // 2. Fetch delta changes from Supabase
    const [accDelta, catDelta, bgDelta, sgDelta, debtDelta, recDelta, txDelta] = await Promise.all([
      this.syncAdapter.pullAccountsDelta(userId, accMeta?.lastSyncedAt),
      this.syncAdapter.pullCategoriesDelta(userId, catMeta?.lastSyncedAt),
      this.syncAdapter.pullBudgetsDelta
        ? this.syncAdapter.pullBudgetsDelta(userId, bgMeta?.lastSyncedAt)
        : Promise.resolve<{ success: boolean; data?: RemoteBudgetRow[]; error?: string }>({ success: true, data: [] }),
      this.syncAdapter.pullSavingsGoalsDelta
        ? this.syncAdapter.pullSavingsGoalsDelta(userId, sgMeta?.lastSyncedAt)
        : Promise.resolve<{ success: boolean; data?: RemoteSavingsGoalRow[]; error?: string }>({ success: true, data: [] }),
      this.syncAdapter.pullDebtsDelta
        ? this.syncAdapter.pullDebtsDelta(userId, debtMeta?.lastSyncedAt)
        : Promise.resolve<{ success: boolean; data?: RemoteDebtRow[]; error?: string }>({ success: true, data: [] }),
      this.syncAdapter.pullRecurringTransactionsDelta
        ? this.syncAdapter.pullRecurringTransactionsDelta(userId, recMeta?.lastSyncedAt)
        : Promise.resolve<{ success: boolean; data?: RemoteRecurringTransactionRow[]; error?: string }>({ success: true, data: [] }),
      this.syncAdapter.pullTransactionsDelta(userId, txMeta?.lastSyncedAt),
    ]);

    if (
      !accDelta.success ||
      !catDelta.success ||
      !bgDelta.success ||
      !sgDelta.success ||
      !debtDelta.success ||
      !recDelta.success ||
      !txDelta.success
    ) {
      const err =
        accDelta.error ||
        catDelta.error ||
        bgDelta.error ||
        sgDelta.error ||
        debtDelta.error ||
        recDelta.error ||
        txDelta.error ||
        'Failed to pull cloud delta';
      throw new Error(err);
    }

    const accounts = accDelta.data ?? [];
    const categories = catDelta.data ?? [];
    const budgets = bgDelta.data ?? [];
    const savingsGoals = sgDelta.data ?? [];
    const debts = debtDelta.data ?? [];
    const recurring = recDelta.data ?? [];
    const transactions = txDelta.data ?? [];

    if (
      accounts.length === 0 &&
      categories.length === 0 &&
      budgets.length === 0 &&
      savingsGoals.length === 0 &&
      debts.length === 0 &&
      recurring.length === 0 &&
      transactions.length === 0
    ) {
      return summary;
    }

    // 3. Apply changes atomically into SQLite
    type ConflictParam = Parameters<typeof this.conflictRepo.createConflict>[0];
    const pendingConflicts: ConflictParam[] = [];

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      // A. Apply Accounts
      for (const acc of accounts) {
        // Check if local has pending mutation
        const localAcc = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM accounts WHERE id = ?;`, [acc.id]);

        if (localAcc && localAcc.sync_state === 'pending') {
          // Conflict: Local has pending mutation while remote has changed
          const conflictType =
            acc.deleted_at && !localAcc.deleted_at
              ? 'update_delete'
              : !acc.deleted_at && localAcc.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'accounts',
            entityId: acc.id,
            conflictType,
            localPayload: JSON.stringify(localAcc),
            remotePayload: JSON.stringify(acc),
            localUpdatedAt: localAcc.updated_at,
            remoteUpdatedAt: acc.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO accounts (
              id, user_id, name, type, currency_code, icon, color, is_active, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              currency_code = excluded.currency_code,
              icon = excluded.icon,
              color = excluded.color,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE accounts.sync_state != 'pending';`,
            [
              acc.id,
              acc.user_id,
              acc.name,
              acc.type,
              acc.currency_code,
              acc.icon,
              acc.color,
              acc.is_active ? 1 : 0,
              acc.created_at,
              acc.updated_at,
              acc.deleted_at,
              acc.updated_at,
            ]
          );
          summary.accountsApplied++;
        }

        if (!summary.latestServerTimestamp || acc.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = acc.updated_at;
        }
      }

      // B. Apply Categories
      for (const cat of categories) {
        const localCat = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM categories WHERE id = ?;`, [cat.id]);

        if (localCat && localCat.sync_state === 'pending') {
          const conflictType =
            cat.deleted_at && !localCat.deleted_at
              ? 'update_delete'
              : !cat.deleted_at && localCat.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'categories',
            entityId: cat.id,
            conflictType,
            localPayload: JSON.stringify(localCat),
            remotePayload: JSON.stringify(cat),
            localUpdatedAt: localCat.updated_at,
            remoteUpdatedAt: cat.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO categories (
              id, user_id, name, type, icon, color, is_system, is_active, sort_order, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              icon = excluded.icon,
              color = excluded.color,
              is_system = excluded.is_system,
              is_active = excluded.is_active,
              sort_order = excluded.sort_order,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE categories.sync_state != 'pending';`,
            [
              cat.id,
              cat.user_id,
              cat.name,
              cat.type,
              cat.icon,
              cat.color,
              cat.is_system ? 1 : 0,
              cat.is_active ? 1 : 0,
              cat.sort_order,
              cat.created_at,
              cat.updated_at,
              cat.deleted_at,
              cat.updated_at,
            ]
          );
          summary.categoriesApplied++;
        }

        if (!summary.latestServerTimestamp || cat.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = cat.updated_at;
        }
      }

      // C. Apply Budgets
      for (const bg of budgets) {
        const minorAmount = Math.round(bg.amount * 100);
        const localBg = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM budgets WHERE id = ?;`, [bg.id]);

        if (localBg && localBg.sync_state === 'pending') {
          const conflictType =
            bg.deleted_at && !localBg.deleted_at
              ? 'update_delete'
              : !bg.deleted_at && localBg.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'budgets',
            entityId: bg.id,
            conflictType,
            localPayload: JSON.stringify(localBg),
            remotePayload: JSON.stringify(bg),
            localUpdatedAt: localBg.updated_at,
            remoteUpdatedAt: bg.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO budgets (
              id, user_id, category_id, name, amount, period_type, start_date, end_date, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              name = excluded.name,
              amount = excluded.amount,
              period_type = excluded.period_type,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE budgets.sync_state != 'pending';`,
            [
              bg.id,
              bg.user_id,
              bg.category_id,
              bg.name,
              minorAmount,
              bg.period_type,
              bg.start_date,
              bg.end_date,
              bg.created_at,
              bg.updated_at,
              bg.deleted_at,
              bg.updated_at,
            ]
          );
          summary.budgetsApplied++;
        }

        if (!summary.latestServerTimestamp || bg.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = bg.updated_at;
        }
      }

      // D. Apply Savings Goals
      for (const sg of savingsGoals) {
        const targetMinor = Math.round(sg.target_amount * 100);
        const currentMinor = Math.round(Number(sg.current_amount ?? 0) * 100);

        const localSg = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM savings_goals WHERE id = ?;`, [sg.id]);

        if (localSg && localSg.sync_state === 'pending') {
          const conflictType =
            sg.deleted_at && !localSg.deleted_at
              ? 'update_delete'
              : !sg.deleted_at && localSg.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'savings_goals',
            entityId: sg.id,
            conflictType,
            localPayload: JSON.stringify(localSg),
            remotePayload: JSON.stringify(sg),
            localUpdatedAt: localSg.updated_at,
            remoteUpdatedAt: sg.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO savings_goals (
              id, user_id, name, target_amount, current_amount, target_date,
              created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              target_amount = excluded.target_amount,
              current_amount = excluded.current_amount,
              target_date = excluded.target_date,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE savings_goals.sync_state != 'pending';`,
            [
              sg.id,
              sg.user_id,
              sg.name,
              targetMinor,
              currentMinor,
              sg.target_date ?? null,
              sg.created_at,
              sg.updated_at,
              sg.deleted_at,
              sg.updated_at,
            ]
          );
          summary.savingsGoalsApplied++;
        }

        if (!summary.latestServerTimestamp || sg.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = sg.updated_at;
        }
      }

      // E. Apply Debts
      for (const debt of debts) {
        const origMinor = Math.round(debt.original_amount * 100);
        const remMinor = Math.round(debt.remaining_amount * 100);
        const localDebt = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM debts WHERE id = ?;`, [debt.id]);

        if (localDebt && localDebt.sync_state === 'pending') {
          const conflictType =
            debt.deleted_at && !localDebt.deleted_at
              ? 'update_delete'
              : !debt.deleted_at && localDebt.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'debts',
            entityId: debt.id,
            conflictType,
            localPayload: JSON.stringify(localDebt),
            remotePayload: JSON.stringify(debt),
            localUpdatedAt: localDebt.updated_at,
            remoteUpdatedAt: debt.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO debts (
              id, user_id, type, person_name, original_amount, remaining_amount,
              due_date, status, note, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              type = excluded.type,
              person_name = excluded.person_name,
              original_amount = excluded.original_amount,
              remaining_amount = excluded.remaining_amount,
              due_date = excluded.due_date,
              status = excluded.status,
              note = excluded.note,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE debts.sync_state != 'pending';`,
            [
              debt.id,
              debt.user_id,
              debt.type,
              debt.person_name,
              origMinor,
              remMinor,
              debt.due_date ?? null,
              debt.status,
              debt.note ?? null,
              debt.created_at,
              debt.updated_at,
              debt.deleted_at,
              debt.updated_at,
            ]
          );
          summary.debtsApplied++;
        }

        if (!summary.latestServerTimestamp || debt.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = debt.updated_at;
        }
      }

      // F. Apply Recurring Transactions
      for (const rec of recurring) {
        const minorAmount = Math.round(rec.amount * 100);
        const localRec = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM recurring_transactions WHERE id = ?;`, [rec.id]);

        if (localRec && localRec.sync_state === 'pending') {
          const conflictType =
            rec.deleted_at && !localRec.deleted_at
              ? 'update_delete'
              : !rec.deleted_at && localRec.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'recurring_transactions',
            entityId: rec.id,
            conflictType,
            localPayload: JSON.stringify(localRec),
            remotePayload: JSON.stringify(rec),
            localUpdatedAt: localRec.updated_at,
            remoteUpdatedAt: rec.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO recurring_transactions (
              id, user_id, type, amount, account_id, category_id,
              note, frequency, start_date, end_date, next_occurrence,
              is_active, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              type = excluded.type,
              amount = excluded.amount,
              account_id = excluded.account_id,
              category_id = excluded.category_id,
              note = excluded.note,
              frequency = excluded.frequency,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              next_occurrence = excluded.next_occurrence,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE recurring_transactions.sync_state != 'pending';`,
            [
              rec.id,
              rec.user_id,
              rec.type,
              minorAmount,
              rec.account_id,
              rec.category_id,
              rec.note ?? null,
              rec.frequency,
              rec.start_date,
              rec.end_date ?? null,
              rec.next_occurrence,
              rec.is_active ? 1 : 0,
              rec.created_at,
              rec.updated_at,
              rec.deleted_at,
              rec.updated_at,
            ]
          );
          summary.recurringTransactionsApplied++;
        }

        if (!summary.latestServerTimestamp || rec.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = rec.updated_at;
        }
      }

      // G. Apply Transactions & Transaction Items
      for (const tx of transactions) {
        const minorAmount = Math.round(tx.amount * 100);
        const localTx = await txn.getFirstAsync<{
          sync_state: string;
          updated_at: string;
          deleted_at: string | null;
        }>(`SELECT sync_state, updated_at, deleted_at FROM transactions WHERE id = ?;`, [tx.id]);

        if (localTx && localTx.sync_state === 'pending') {
          const conflictType =
            tx.deleted_at && !localTx.deleted_at
              ? 'update_delete'
              : !tx.deleted_at && localTx.deleted_at
              ? 'delete_update'
              : 'concurrent_update';

          pendingConflicts.push({
            userId,
            entityName: 'transactions',
            entityId: tx.id,
            conflictType,
            localPayload: JSON.stringify(localTx),
            remotePayload: JSON.stringify(tx),
            localUpdatedAt: localTx.updated_at,
            remoteUpdatedAt: tx.updated_at,
          });
          summary.conflictsDetected++;
        } else {
          await txn.runAsync(
            `INSERT INTO transactions (
              id, user_id, type, amount, source_account_id, destination_account_id, debt_id,
              recurring_transaction_id, occurrence_key, transaction_date, note, created_at, updated_at, deleted_at, sync_state, base_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
            ON CONFLICT(id) DO UPDATE SET
              type = excluded.type,
              amount = excluded.amount,
              source_account_id = excluded.source_account_id,
              destination_account_id = excluded.destination_account_id,
              debt_id = excluded.debt_id,
              recurring_transaction_id = excluded.recurring_transaction_id,
              occurrence_key = excluded.occurrence_key,
              transaction_date = excluded.transaction_date,
              note = excluded.note,
              updated_at = excluded.updated_at,
              deleted_at = excluded.deleted_at,
              sync_state = 'synced',
              base_updated_at = excluded.base_updated_at
            WHERE transactions.sync_state != 'pending';`,
            [
              tx.id,
              tx.user_id,
              tx.type,
              minorAmount,
              tx.source_account_id ?? null,
              tx.destination_account_id ?? null,
              tx.debt_id ?? null,
              tx.recurring_transaction_id ?? null,
              tx.occurrence_key ?? null,
              tx.transaction_date,
              tx.note ?? null,
              tx.created_at,
              tx.updated_at,
              tx.deleted_at,
              tx.updated_at,
            ]
          );

          if (Array.isArray(tx.transaction_items)) {
            for (const item of tx.transaction_items) {
              const itemMinor = Math.round(item.amount * 100);
              await txn.runAsync(
                `INSERT INTO transaction_items (
                  id, user_id, transaction_id, category_id, amount, note, created_at, updated_at, deleted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  category_id = excluded.category_id,
                  amount = excluded.amount,
                  note = excluded.note,
                  updated_at = excluded.updated_at,
                  deleted_at = excluded.deleted_at;`,
                [
                  item.id,
                  item.user_id,
                  item.transaction_id,
                  item.category_id,
                  itemMinor,
                  item.note ?? null,
                  item.created_at,
                  item.updated_at,
                  item.deleted_at,
                ]
              );
            }
          }

          summary.transactionsApplied++;
        }

        if (!summary.latestServerTimestamp || tx.updated_at > summary.latestServerTimestamp) {
          summary.latestServerTimestamp = tx.updated_at;
        }
      }
    });

    // 4. Save any detected conflicts outside the exclusive transaction
    for (const conf of pendingConflicts) {
      await this.conflictRepo.createConflict(conf);
    }

    // 5. Advance sync metadata cursors outside the exclusive transaction
    const nowIso = new Date().toISOString();
    if (accounts.length > 0) {
      const maxAccTs = accounts[accounts.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'accounts',
        lastSyncedAt: maxAccTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (categories.length > 0) {
      const maxCatTs = categories[categories.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'categories',
        lastSyncedAt: maxCatTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (budgets.length > 0) {
      const maxBgTs = budgets[budgets.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'budgets',
        lastSyncedAt: maxBgTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (savingsGoals.length > 0) {
      const maxSgTs = savingsGoals[savingsGoals.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'savings_goals',
        lastSyncedAt: maxSgTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (debts.length > 0) {
      const maxDebtTs = debts[debts.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'debts',
        lastSyncedAt: maxDebtTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (recurring.length > 0) {
      const maxRecTs = recurring[recurring.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'recurring_transactions',
        lastSyncedAt: maxRecTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    if (transactions.length > 0) {
      const maxTxTs = transactions[transactions.length - 1].updated_at;
      await this.outboxRepo.updateSyncMetadata({
        userId,
        entityName: 'transactions',
        lastSyncedAt: maxTxTs,
        lastSyncStatus: 'success',
        lastError: null,
        updatedAt: nowIso,
      });
    }

    const totalApplied =
      summary.accountsApplied +
      summary.categoriesApplied +
      summary.budgetsApplied +
      summary.savingsGoalsApplied +
      summary.debtsApplied +
      summary.recurringTransactionsApplied +
      summary.transactionsApplied;

    if (totalApplied > 0) {
      appEvents.emit('data_invalidated');
    }

    return summary;
  }
}
