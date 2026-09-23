export type OutboxStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export type OutboxOperationType =
  | 'CREATE_ACCOUNT'
  | 'UPDATE_ACCOUNT'
  | 'DELETE_ACCOUNT'
  | 'CREATE_CATEGORY'
  | 'UPDATE_CATEGORY'
  | 'DELETE_CATEGORY'
  | 'CREATE_BUDGET'
  | 'UPDATE_BUDGET'
  | 'DELETE_BUDGET'
  | 'CREATE_SAVINGS_GOAL'
  | 'UPDATE_SAVINGS_GOAL'
  | 'DELETE_SAVINGS_GOAL'
  | 'CREATE_DEBT'
  | 'UPDATE_DEBT'
  | 'DELETE_DEBT'
  | 'CREATE_RECURRING_TRANSACTION'
  | 'UPDATE_RECURRING_TRANSACTION'
  | 'DELETE_RECURRING_TRANSACTION'
  | 'CREATE_TRANSACTION'
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION';

export interface OutboxRecord {
  id: string;
  userId: string;
  operationType: OutboxOperationType;
  entityName: string;
  entityId: string;
  payload: string; // JSON stringified payload
  createdAt: string; // ISO date
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt: string | null; // ISO date
  lastError: string | null;
  processedAt: string | null;
}

export type SyncState = 'synced' | 'pending' | 'syncing' | 'error' | 'offline' | 'conflict';

export type SyncTriggerReason =
  | 'startup'
  | 'foreground'
  | 'network_reconnect'
  | 'manual'
  | 'pull_to_refresh'
  | 'realtime';

export interface SyncProgress {
  state: SyncState;
  pendingCount: number;
  failedCount: number;
  deadLetterCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  isSyncing: boolean;
  lastReason?: SyncTriggerReason;
}

export interface SyncMetadataRecord {
  userId: string;
  entityName: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  updatedAt: string;
}
