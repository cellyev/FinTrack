import { SqliteOutboxRepository } from '../data/sqlite-outbox.repository';
import { SupabaseSyncAdapter } from '../data/supabase-sync.adapter';
import { SqliteConflictRepository } from '../data/sqlite-conflict.repository';
import { SyncConflictType } from '../domain/conflict-types';

export interface OutboxWorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
}

export class OutboxWorker {
  public static readonly MAX_RETRIES = 5;
  public static readonly BASE_BACKOFF_SECONDS = 2;
  public static readonly MAX_BACKOFF_SECONDS = 120;

  constructor(
    private readonly outboxRepo: SqliteOutboxRepository,
    private readonly syncAdapter: SupabaseSyncAdapter,
    private readonly conflictRepo: SqliteConflictRepository = new SqliteConflictRepository()
  ) {}

  public async processOutbox(userId: string, batchSize: number = 10): Promise<OutboxWorkerResult> {
    const result: OutboxWorkerResult = { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };

    // 1. Crash recovery: reset hanging 'processing' records
    await this.outboxRepo.recoverHangingProcessingRecords(userId, 2);

    // 2. Fetch pending / eligible failed records (ordered topologically)
    const batch = await this.outboxRepo.fetchPendingBatch(userId, batchSize);
    if (batch.length === 0) {
      return result;
    }

    for (const record of batch) {
      result.processed++;
      await this.outboxRepo.markProcessing(record.id);

      const pushResult = await this.syncAdapter.pushMutation(record);

      if (pushResult.success) {
        await this.outboxRepo.markCompleted(record.id, record.entityName, record.entityId);
        result.succeeded++;
      } else {
        result.failed++;
        const errorMessage = pushResult.error ?? 'Unknown synchronization error';
        const nextRetryCount = record.retryCount + 1;

        if (this.isConflictError(errorMessage)) {
          // Record conflict and stop retrying mutation
          result.conflicts++;
          const conflictType = this.resolveConflictType(errorMessage, record.operationType);
          await this.conflictRepo.createConflict({
            userId: record.userId,
            entityName: record.entityName as 'accounts' | 'categories' | 'transactions',
            entityId: record.entityId,
            conflictType,
            localPayload: record.payload,
            remotePayload: null,
            localUpdatedAt: record.createdAt,
            remoteUpdatedAt: null,
          });
          await this.outboxRepo.markDeadLetter(record.id, `Conflict: ${errorMessage}`);
        } else if (nextRetryCount >= OutboxWorker.MAX_RETRIES || this.isPermanentError(errorMessage)) {
          await this.outboxRepo.markDeadLetter(record.id, errorMessage);
        } else {
          const nextRetryAt = this.calculateNextRetryTime(nextRetryCount);
          await this.outboxRepo.markFailed(record.id, errorMessage, nextRetryAt, nextRetryCount);
        }
      }
    }

    return result;
  }

  public calculateNextRetryTime(retryCount: number): string {
    const exponentialDelay =
      OutboxWorker.BASE_BACKOFF_SECONDS * Math.pow(2, Math.max(0, retryCount - 1));
    const cappedDelay = Math.min(exponentialDelay, OutboxWorker.MAX_BACKOFF_SECONDS);
    const jitter = Math.random() * 2; // 0 to 2 seconds jitter
    const totalDelayMs = (cappedDelay + jitter) * 1000;

    return new Date(Date.now() + totalDelayMs).toISOString();
  }

  private isConflictError(error: string): boolean {
    const lower = error.toLowerCase();
    return (
      lower.includes('missing, changed, or outside seven-day correction window') ||
      lower.includes('stale') ||
      lower.includes('conflict') ||
      lower.includes('duplicate key') ||
      lower.includes('unique constraint')
    );
  }

  private resolveConflictType(error: string, operationType: string): SyncConflictType {
    const lower = error.toLowerCase();
    if (lower.includes('outside seven-day')) {
      return 'correction_window_expired';
    }
    if (lower.includes('duplicate') || lower.includes('unique')) {
      return 'duplicate_category';
    }
    if (operationType.includes('DELETE')) {
      return 'delete_update';
    }
    return 'concurrent_update';
  }

  private isPermanentError(error: string): boolean {
    const lower = error.toLowerCase();
    return (
      lower.includes('violates foreign key') ||
      lower.includes('invalid category split') ||
      lower.includes('cannot be renamed, retyped, or deleted') ||
      lower.includes('schema violation')
    );
  }
}
