export type SyncConflictType =
  | 'concurrent_update'
  | 'update_delete'
  | 'delete_update'
  | 'duplicate_category'
  | 'stale_version'
  | 'correction_window_expired';

export type ConflictResolutionStrategy = 'use_local' | 'use_remote' | 'manual';

export interface SyncConflictRecord {
  id: string;
  userId: string;
  entityName: 'accounts' | 'categories' | 'transactions' | 'budgets' | 'savings_goals' | 'debts' | 'recurring_transactions';
  entityId: string;
  conflictType: SyncConflictType;
  localPayload: string; // JSON string of local entity state
  remotePayload: string | null; // JSON string of remote entity state
  localUpdatedAt: string; // ISO date
  remoteUpdatedAt: string | null; // ISO date
  status: 'unresolved' | 'resolved';
  resolution: ConflictResolutionStrategy | null;
  resolvedAt: string | null;
  createdAt: string;
}
