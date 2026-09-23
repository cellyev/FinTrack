import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { useSyncConflicts } from '../use-sync-conflicts';
import { SyncConflictRecord, ConflictResolutionStrategy } from '../../domain/conflict-types';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface SyncConflictModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ visible, onClose }) => {
  const { conflicts, isLoading, resolveConflict, refresh, resolveAllStale } = useSyncConflicts();
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible, refresh]);

  const handleDone = async () => {
    await resolveAllStale();
    onClose();
  };

  const handleResolve = async (conflictId: string, resolution: ConflictResolutionStrategy) => {
    setResolvingId(conflictId);
    await resolveConflict(conflictId, resolution);
    setResolvingId(null);
  };

  const handleResolveAll = async (resolution: ConflictResolutionStrategy) => {
    setResolvingId('all');
    for (const conf of conflicts) {
      await resolveConflict(conf.id, resolution);
    }
    setResolvingId(null);
  };

  const getEntityTitle = (conflict: SyncConflictRecord) => {
    if (conflict.entityName === 'accounts') return 'Akun Keuangan';
    if (conflict.entityName === 'categories') return 'Kategori Transaksi';
    return 'Catatan Transaksi';
  };

  const getConflictExplanation = (conflict: SyncConflictRecord) => {
    if (conflict.conflictType === 'correction_window_expired') {
      return 'Perubahan transaksi ditolak karena telah melewati batas jendela koreksi 7 hari.';
    }
    if (conflict.conflictType === 'duplicate_category') {
      return 'Nama kategori sama dengan kategori yang sudah ada di cloud.';
    }
    if (conflict.conflictType === 'update_delete') {
      return 'Data telah dihapus di cloud sementara perangkat ini mencoba mengubahnya.';
    }
    if (conflict.conflictType === 'delete_update') {
      return 'Data telah diperbarui di cloud sementara perangkat ini mencoba menghapusnya.';
    }
    return 'Data telah diubah di perangkat lain (cloud) saat perangkat ini offline.';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <AppText variant="titleMedium">Perhatian Sinkronisasi</AppText>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText variant="body" style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <AppText variant="bodyMuted" style={styles.subtitle}>
            Terdapat perbedaan antara data di perangkat ini dan data di cloud. Pilih versi yang ingin digunakan.
          </AppText>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary[500]} />
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppText variant="body">Semua data telah tersinkron tanpa konflik. ✓</AppText>
              <AppButton title="Selesai" variant="secondary" onPress={handleDone} style={styles.doneBtn} />
            </View>
          ) : (
            <>
              {conflicts.length > 1 ? (
                <View style={styles.bulkActionRow}>
                  <AppButton
                    title="✓ Selesaikan Semua (Gunakan Cloud)"
                    variant="primary"
                    isLoading={resolvingId === 'all'}
                    onPress={() => handleResolveAll('use_remote')}
                    style={styles.bulkBtn}
                  />
                </View>
              ) : null}

              <ScrollView style={styles.conflictList} contentContainerStyle={styles.conflictListContent}>
                {conflicts.map((conflict) => {
                  const isCurrentResolving = resolvingId === conflict.id || resolvingId === 'all';

                return (
                  <View key={conflict.id} style={styles.conflictCard}>
                    <View style={styles.cardBadgeRow}>
                      <AppText variant="caption" style={styles.entityBadge}>
                        {getEntityTitle(conflict)}
                      </AppText>
                      <AppText variant="caption" style={styles.dateText}>
                        {new Date(conflict.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </AppText>
                    </View>

                    <AppText variant="body" style={styles.explanationText}>
                      {getConflictExplanation(conflict)}
                    </AppText>

                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.localBtn]}
                        disabled={isCurrentResolving}
                        onPress={() => handleResolve(conflict.id, 'use_local')}
                        accessibilityRole="button"
                        accessibilityLabel="Gunakan versi perangkat ini"
                      >
                        <AppText variant="caption" style={styles.localBtnText}>
                          Gunakan Versi Perangkat
                        </AppText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.remoteBtn]}
                        disabled={isCurrentResolving}
                        onPress={() => handleResolve(conflict.id, 'use_remote')}
                        accessibilityRole="button"
                        accessibilityLabel="Gunakan versi cloud"
                      >
                        <AppText variant="caption" style={styles.remoteBtnText}>
                          Gunakan Versi Cloud
                        </AppText>
                      </TouchableOpacity>
                    </View>

                    {isCurrentResolving && (
                      <ActivityIndicator size="small" color={colors.primary[500]} style={styles.resolvingSpinner} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  </Modal>
);
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  bulkActionRow: {
    marginBottom: spacing.sm,
  },
  bulkBtn: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: spacing.lg,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  closeText: {
    color: colors.neutral[400],
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  doneBtn: {
    marginTop: spacing.md,
  },
  conflictList: {
    flexGrow: 0,
  },
  conflictListContent: {
    gap: spacing.sm,
  },
  conflictCard: {
    backgroundColor: colors.neutral[900],
    borderRadius: theme.radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[700],
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entityBadge: {
    color: colors.warning[500],
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    color: colors.neutral[400],
  },
  explanationText: {
    color: colors.neutral[200],
    marginBottom: spacing.md,
    fontSize: theme.typography.fontSizes.sm,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  localBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: colors.info[500],
  },
  localBtnText: {
    color: colors.info[500],
    fontWeight: '600',
    textAlign: 'center',
  },
  remoteBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: colors.success[500],
  },
  remoteBtnText: {
    color: colors.success[500],
    fontWeight: '600',
    textAlign: 'center',
  },
  resolvingSpinner: {
    marginTop: spacing.xs,
  },
});
