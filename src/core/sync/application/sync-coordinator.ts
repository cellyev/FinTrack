import { INetworkMonitor, NetworkStatus } from '@/core/network/network-monitor.interface';
import { networkMonitor } from '@/core/network/netinfo-network-monitor';
import { SqliteOutboxRepository } from '../data/sqlite-outbox.repository';
import { SupabaseSyncAdapter } from '../data/supabase-sync.adapter';
import { SqliteConflictRepository } from '../data/sqlite-conflict.repository';
import { OutboxWorker } from './outbox-worker';
import { PullSynchronizer } from './pull-synchronizer';
import { SyncProgress, SyncTriggerReason } from '../domain/sync-types';

export type SyncStateListener = (progress: SyncProgress) => void;

export class SyncCoordinator {
  private static instance: SyncCoordinator | null = null;

  private isSyncRunning: boolean = false;
  private hasPendingQueuedSync: boolean = false;
  private queuedReason: SyncTriggerReason | null = null;
  private currentUserId: string | null = null;
  private listeners: Set<SyncStateListener> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private lastSyncTimestamp: string | null = null;
  private lastError: string | null = null;
  private lastReason: SyncTriggerReason | undefined = undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly outboxRepo: SqliteOutboxRepository = new SqliteOutboxRepository(),
    private readonly syncAdapter: SupabaseSyncAdapter = new SupabaseSyncAdapter(),
    private readonly conflictRepo: SqliteConflictRepository = new SqliteConflictRepository(),
    private readonly outboxWorker: OutboxWorker = new OutboxWorker(outboxRepo, syncAdapter, conflictRepo),
    private readonly pullSynchronizer: PullSynchronizer = new PullSynchronizer(outboxRepo, syncAdapter, conflictRepo),
    private readonly network: INetworkMonitor = networkMonitor
  ) {}

  public static getInstance(): SyncCoordinator {
    if (!SyncCoordinator.instance) {
      SyncCoordinator.instance = new SyncCoordinator();
    }
    return SyncCoordinator.instance;
  }

  public initialize(userId: string): Promise<boolean> {
    this.currentUserId = userId;

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }

    this.networkUnsubscribe = this.network.addListener((status: NetworkStatus) => {
      if (status.isConnected && status.isInternetReachable !== false) {
        this.requestSync('network_reconnect', 300);
      } else {
        this.notifyListeners();
      }
    });

    // Run initial sync on startup
    return this.triggerSync('startup');
  }

  public cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.currentUserId = null;
    this.listeners.clear();
    this.isSyncRunning = false;
    this.hasPendingQueuedSync = false;
    this.queuedReason = null;
  }

  public requestSync(
    reason: SyncTriggerReason = 'manual',
    debounceMs: number = 0
  ): Promise<boolean> {
    if (debounceMs > 0) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      return new Promise<boolean>((resolve) => {
        this.debounceTimer = setTimeout(async () => {
          this.debounceTimer = null;
          const result = await this.triggerSync(reason);
          resolve(result);
        }, debounceMs);
      });
    }

    return this.triggerSync(reason);
  }

  public async syncNow(): Promise<boolean> {
    return this.requestSync('manual', 0);
  }

  public async triggerSync(reason: SyncTriggerReason = 'manual'): Promise<boolean> {
    if (!this.currentUserId) {
      return false;
    }

    if (this.isSyncRunning) {
      // Concurrency guard: Queue a single follow-up sync to run once current completes
      this.hasPendingQueuedSync = true;
      this.queuedReason = reason;
      return false;
    }

    this.isSyncRunning = true;
    this.lastError = null;
    this.lastReason = reason;

    try {
      const netStatus = await this.network.getStatus();
      if (!netStatus.isConnected || netStatus.isInternetReachable === false) {
        this.notifyListeners();
        return false;
      }

      this.notifyListeners();

      // If user manually requested sync, reset any dead letters so they can be retried
      if (reason === 'manual') {
        await this.outboxRepo.retryDeadLetters(this.currentUserId);
      }

      // 1. Push Phase: Process local outbox mutations
      await this.outboxWorker.processOutbox(this.currentUserId);

      // 2. Pull Phase: Fetch remote deltas and reconcile
      await this.pullSynchronizer.pullChanges(this.currentUserId);

      this.lastSyncTimestamp = new Date().toISOString();
      return true;
    } catch (e: unknown) {
      this.lastError = e instanceof Error ? e.message : 'Synchronization failed';
      return false;
    } finally {
      this.isSyncRunning = false;
      this.notifyListeners();

      // Check if a queued sync request arrived while running
      if (this.hasPendingQueuedSync && this.currentUserId) {
        const nextReason = this.queuedReason ?? 'realtime';
        this.hasPendingQueuedSync = false;
        this.queuedReason = null;
        // Schedule next execution asynchronously
        setTimeout(() => {
          this.triggerSync(nextReason);
        }, 50);
      }
    }
  }

  public async getProgress(): Promise<SyncProgress> {
    if (!this.currentUserId) {
      return {
        state: 'offline',
        pendingCount: 0,
        failedCount: 0,
        deadLetterCount: 0,
        conflictCount: 0,
        lastSyncedAt: this.lastSyncTimestamp,
        lastError: null,
        isSyncing: false,
        lastReason: this.lastReason,
      };
    }

    const netStatus = await this.network.getStatus();
    const pendingCount = await this.outboxRepo.getPendingCount(this.currentUserId);
    const failedCount = await this.outboxRepo.getFailedCount(this.currentUserId);
    const deadLetterCount = await this.outboxRepo.getDeadLetterCount(this.currentUserId);
    const conflictCount = await this.conflictRepo.getUnresolvedCount(this.currentUserId);

    let state: SyncProgress['state'] = 'synced';
    if (!netStatus.isConnected || netStatus.isInternetReachable === false) {
      state = 'offline';
    } else if (this.isSyncRunning) {
      state = 'syncing';
    } else if (conflictCount > 0) {
      state = 'conflict';
    } else if (this.lastError || deadLetterCount > 0) {
      state = 'error';
    } else if (pendingCount > 0) {
      state = 'pending';
    }

    return {
      state,
      pendingCount,
      failedCount,
      deadLetterCount,
      conflictCount,
      lastSyncedAt: this.lastSyncTimestamp,
      lastError: this.lastError,
      isSyncing: this.isSyncRunning,
      lastReason: this.lastReason,
    };
  }

  public subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    this.getProgress().then((progress) => {
      if (this.listeners.has(listener)) {
        listener(progress);
      }
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(): Promise<void> {
    const progress = await this.getProgress();
    for (const listener of this.listeners) {
      listener(progress);
    }
  }
}
