import { useState, useEffect, useCallback } from 'react';
import { SyncCoordinator } from '../application/sync-coordinator';
import { realtimeSyncTrigger } from '../application/supabase-realtime.trigger';
import { appLifecycleObserver } from '@/core/lifecycle/app-lifecycle.observer';
import { SyncProgress } from '../domain/sync-types';
import { useAuth } from '@/features/auth/presentation/use-auth';

const coordinator = SyncCoordinator.getInstance();

export function useSyncStatus() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<SyncProgress>({
    state: 'synced',
    pendingCount: 0,
    failedCount: 0,
    deadLetterCount: 0,
    conflictCount: 0,
    lastSyncedAt: null,
    lastError: null,
    isSyncing: false,
  });

  const userId = user?.id;

  useEffect(() => {
    appLifecycleObserver.initialize();

    if (userId) {
      coordinator.initialize(userId);
      realtimeSyncTrigger.subscribe(userId);
    } else {
      realtimeSyncTrigger.unsubscribe();
      coordinator.cleanup();
    }

    const unsubscribe = coordinator.subscribe((updatedProgress) => {
      setProgress(updatedProgress);
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    return await coordinator.syncNow();
  }, []);

  return {
    ...progress,
    syncNow,
  };
}
