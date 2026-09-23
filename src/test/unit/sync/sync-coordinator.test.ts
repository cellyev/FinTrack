import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { SqliteOutboxRepository } from '@/core/sync/data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '@/core/sync/data/sqlite-conflict.repository';
import { SupabaseSyncAdapter } from '@/core/sync/data/supabase-sync.adapter';
import { OutboxWorker } from '@/core/sync/application/outbox-worker';
import { PullSynchronizer } from '@/core/sync/application/pull-synchronizer';
import { INetworkMonitor, NetworkStatus } from '@/core/network/network-monitor.interface';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('SyncCoordinator Application Unit Tests', () => {
  let db: InMemoryTestDb;
  let outboxRepo: SqliteOutboxRepository;
  let mockSyncAdapter: jest.Mocked<SupabaseSyncAdapter>;
  let mockWorker: jest.Mocked<OutboxWorker>;
  let mockPuller: jest.Mocked<PullSynchronizer>;
  let mockNetwork: jest.Mocked<INetworkMonitor>;
  let networkListener: ((status: NetworkStatus) => void) | null = null;
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
      addListener: jest.fn().mockImplementation((listener) => {
        networkListener = listener;
        return () => {
          networkListener = null;
        };
      }),
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

  it('should initialize and trigger sync when user is set and network is connected', async () => {
    await coordinator.initialize('u1');

    expect(mockNetwork.addListener).toHaveBeenCalled();
    expect(mockWorker.processOutbox).toHaveBeenCalledWith('u1');
    expect(mockPuller.pullChanges).toHaveBeenCalledWith('u1');
  });

  it('should prevent concurrent sync execution via mutex lock', async () => {
    // Make first run hang on slow promise
    let slowResolve: () => void;
    const slowPromise = new Promise<{ processed: number; succeeded: number; failed: number; conflicts: number }>(
      (resolve) => {
        slowResolve = () => resolve({ processed: 1, succeeded: 1, failed: 0, conflicts: 0 });
      }
    );
    mockWorker.processOutbox.mockReturnValueOnce(slowPromise);

    const firstRunPromise = coordinator.initialize('u1');
    const secondRun = await coordinator.triggerSync('manual');

    expect(secondRun).toBe(false); // Second attempt should be rejected by mutex lock

    slowResolve!();
    await firstRunPromise;
  });

  it('should trigger sync on network reconnection event', async () => {
    await coordinator.initialize('u1');
    jest.clearAllMocks();

    expect(networkListener).toBeTruthy();

    if (networkListener) {
      networkListener({ isConnected: true, isInternetReachable: true });
    }

    // Wait for network reconnection debounce timer (300ms)
    await new Promise((r) => setTimeout(r, 350));

    expect(mockWorker.processOutbox).toHaveBeenCalledWith('u1');
    expect(mockPuller.pullChanges).toHaveBeenCalledWith('u1');
  });

  it('should report progress correctly to subscribers', async () => {
    const subscriber = jest.fn();
    await coordinator.initialize('u1');
    const unsubscribe = coordinator.subscribe(subscriber);

    await new Promise((r) => setTimeout(r, 10));
    expect(subscriber).toHaveBeenCalled();
    unsubscribe();
  });
});
