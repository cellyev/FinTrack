import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { INetworkMonitor } from '@/core/network/network-monitor.interface';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SyncCoordinator Phase 2B Advanced Unit Tests', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let mockWorker: jest.Mocked<OutboxWorker>;
  let mockPuller: jest.Mocked<PullSynchronizer>;
  let mockNetwork: jest.Mocked<INetworkMonitor>;
  let coordinator: SyncCoordinator;

  beforeEach(() => {
    db = new InMemoryTestDb();
    outboxRepo = new SqliteOutboxRepository(async () => db.getDb());
    mockSyncAdapter = {} as unknown as jest.Mocked<SupabaseSyncAdapter>;
    const conflictRepo = new SqliteConflictRepository(async () => db.getDb());

    mockWorker = {
      processOutbox: jest.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0, conflicts: 0 }),
    } as unknown as jest.Mocked<OutboxWorker>;

    mockPuller = {
      pullChanges: jest.fn().mockResolvedValue({
        accountsApplied: 0,
        categoriesApplied: 0,
        transactionsApplied: 0,
        latestServerTimestamp: null,
        conflictsDetected: 0,
      }),
    } as unknown as jest.Mocked<PullSynchronizer>;

    mockNetwork = {
      getStatus: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
      addListener: jest.fn().mockReturnValue(() => {}),
    };

    coordinator = new SyncCoordinator(
      outboxRepo,
      mockSyncAdapter,
      conflictRepo,
      mockWorker,
      mockPuller,
      mockNetwork
    );
  });

  afterEach(() => {
    coordinator.cleanup();
  });

  it('should debounce multiple rapid requestSync triggers into a single execution', async () => {
    await coordinator.initialize('user-1');
    jest.clearAllMocks();

    coordinator.requestSync('realtime', 100);
    coordinator.requestSync('realtime', 100);
    coordinator.requestSync('realtime', 100);

    // Should not have executed immediately due to debounce
    expect(mockWorker.processOutbox).not.toHaveBeenCalled();

    // Wait past debounce window
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockWorker.processOutbox).toHaveBeenCalledTimes(1);
    expect(mockPuller.pullChanges).toHaveBeenCalledTimes(1);
  });

  it('should queue and execute follow-up sync when requestSync arrives during active sync', async () => {
    let slowResolve: () => void;
    const slowPromise = new Promise<{ processed: number; succeeded: number; failed: number; conflicts: number }>(
      (resolve) => {
        slowResolve = () => resolve({ processed: 1, succeeded: 1, failed: 0, conflicts: 0 });
      }
    );

    mockWorker.processOutbox.mockReturnValueOnce(slowPromise);

    const firstRunPromise = coordinator.initialize('user-1');

    // Trigger second request during active first run
    const queuedRequest = coordinator.requestSync('realtime', 0);
    expect(await queuedRequest).toBe(false); // Rejected by mutex lock and marked as queued

    // Release first run
    slowResolve!();
    await firstRunPromise;

    // Wait for the queued sync timeout (50ms in coordinator)
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Total executions should now be 2
    expect(mockWorker.processOutbox).toHaveBeenCalledTimes(2);
  });

  it('should report deadLetterCount and error state when dead letter records exist', async () => {
    await coordinator.initialize('user-1');

    db.outbox.push({
      id: 'out-dead',
      user_id: 'user-1',
      operation_type: 'CREATE_TRANSACTION',
      entity_name: 'transactions',
      entity_id: 'tx-1',
      payload: '{}',
      created_at: new Date().toISOString(),
      status: 'dead_letter',
      retry_count: 5,
      next_retry_at: null,
      last_error: 'Invalid foreign key',
      processed_at: null,
    });

    const progress = await coordinator.getProgress();
    expect(progress.deadLetterCount).toBe(1);
    expect(progress.state).toBe('error');
  });

  it('should execute manual sync immediately when syncNow is called', async () => {
    await coordinator.initialize('user-1');
    jest.clearAllMocks();

    const success = await coordinator.syncNow();
    expect(success).toBe(true);
    expect(mockWorker.processOutbox).toHaveBeenCalledWith('user-1');
    expect(mockPuller.pullChanges).toHaveBeenCalledWith('user-1');
  });
});
