import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteConflictRepository } from '../data/sqlite-conflict.repository';
import { ResolveSyncConflictUseCase } from '../application/resolve-sync-conflict.usecase';
import { SyncConflictRecord, ConflictResolutionStrategy } from '../domain/conflict-types';
import { SyncCoordinator } from '../application/sync-coordinator';

const conflictRepo = new SqliteConflictRepository();
const resolveConflictUseCase = new ResolveSyncConflictUseCase(conflictRepo);

export function useSyncConflicts() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchConflicts = useCallback(async () => {
    if (!user) {
      setConflicts([]);
      return;
    }
    setIsLoading(true);
    const list = await conflictRepo.getUnresolvedConflicts(user.id);
    setConflicts(list);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const resolve = async (conflictId: string, resolution: ConflictResolutionStrategy) => {
    const result = await resolveConflictUseCase.execute({
      conflictId,
      resolution,
    });
    if (result.success) {
      await fetchConflicts();
      // Trigger sync if user chooses use_local to re-sync the re-queued mutation
      await SyncCoordinator.getInstance().syncNow();
    }
    return result;
  };

  const resolveAllStale = async () => {
    if (!user) return;
    await conflictRepo.resolveAllForUser(user.id);
    await fetchConflicts();
    await SyncCoordinator.getInstance().syncNow();
  };

  return {
    conflicts,
    isLoading,
    resolveConflict: resolve,
    resolveAllStale,
    refresh: fetchConflicts,
  };
}
