import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { SyncCoordinator } from '../../application/sync-coordinator';
import { SqliteOutboxRepository } from '../../data/sqlite-outbox.repository';
import { SqliteConflictRepository } from '../../data/sqlite-conflict.repository';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { clearAllLocalData } from '@/core/database/sqlite';
import { theme } from '@/core/ui/tokens/theme';

const outboxRepo = new SqliteOutboxRepository();
const conflictRepo = new SqliteConflictRepository();

export interface SyncDiagnosticsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SyncDiagnosticsModal: React.FC<SyncDiagnosticsModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const [pendingOutboxCount, setPendingOutboxCount] = useState<number>(0);
  const [deadLetterCount, setDeadLetterCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Belum ada');
  const [failedErrors, setFailedErrors] = useState<string[]>([]);

  const loadDiagnostics = useCallback(async () => {
    if (!user) return;

    try {
      const outboxList = await outboxRepo.fetchPendingBatch(user.id, 1000);
      setPendingOutboxCount(outboxList.length);

      const deadCount = await outboxRepo.getDeadLetterCount(user.id);
      setDeadLetterCount(deadCount);

      const deadRecords = await outboxRepo.getDeadLetterRecords(user.id);
      const uniqueErrors = Array.from(
        new Set(deadRecords.map((r) => r.lastError).filter((e): e is string => Boolean(e)))
      );
      setFailedErrors(uniqueErrors);

      const conflicts = await conflictRepo.getUnresolvedCount(user.id);
      setConflictCount(conflicts);

      const coordinator = SyncCoordinator.getInstance();
      const progress = await coordinator.getProgress();
      if (progress.lastSyncedAt) {
        setLastSyncTime(new Date(progress.lastSyncedAt).toLocaleTimeString('id-ID'));
      } else {
        setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      }
    } catch {
      // Gracefully continue
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      loadDiagnostics();
    }
  }, [visible, user, loadDiagnostics]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await SyncCoordinator.getInstance().requestSync('manual');
      await loadDiagnostics();
      Alert.alert('Sinkronisasi Selesai', 'Data lokal Anda telah dicoba untuk disinkronkan.');
    } catch (e: unknown) {
      Alert.alert('Sinkronisasi Gagal', (e as Error).message ?? 'Terjadi kesalahan saat sinkronisasi.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearLocalData = () => {
    Alert.alert(
      'Reset Data Lokal (Dev)',
      'Apakah Anda yakin ingin mengosongkan seluruh data lokal di perangkat ini? Semua transaksi lokal, akun, kategori, dan outbox akan dihapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Kosongkan',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllLocalData();
              await loadDiagnostics();
              Alert.alert('Sukses', 'Seluruh data lokal berhasil dikosongkan.');
            } catch (err: unknown) {
              Alert.alert('Gagal', (err as Error).message ?? 'Gagal mengosongkan data lokal');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <AppText variant="titleMedium" style={styles.title}>
                Diagnostik Sinkronisasi & Offline
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Status outbox, konflik, dan replikasi data
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Status overview cards */}
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <AppText variant="caption" style={styles.metricLabel}>
                  ANTREAN OUTBOX
                </AppText>
                <AppText variant="display" style={styles.metricValue}>
                  {pendingOutboxCount}
                </AppText>
                <AppText variant="caption" style={styles.metricDesc}>
                  {pendingOutboxCount === 0 ? 'Semua operasi tersinkron' : 'Perubahan menunggu push'}
                </AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText variant="caption" style={styles.metricLabel}>
                  GAGAL / TERHENTI
                </AppText>
                <AppText
                  variant="display"
                  style={[
                    styles.metricValue,
                    deadLetterCount > 0 ? styles.metricDanger : styles.metricSuccess,
                  ]}
                >
                  {deadLetterCount}
                </AppText>
                <AppText variant="caption" style={styles.metricDesc}>
                  {deadLetterCount === 0 ? 'Tidak ada antrean gagal' : 'Perlu sinkronisasi ulang'}
                </AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText variant="caption" style={styles.metricLabel}>
                  KONFLIK TERTUNDA
                </AppText>
                <AppText
                  variant="display"
                  style={[
                    styles.metricValue,
                    conflictCount > 0 ? styles.metricDanger : styles.metricSuccess,
                  ]}
                >
                  {conflictCount}
                </AppText>
                <AppText variant="caption" style={styles.metricDesc}>
                  {conflictCount === 0 ? 'Tidak ada konflik' : 'Perlu penyelesaian'}
                </AppText>
              </View>
            </View>

            {/* Error Details if any */}
            {failedErrors.length > 0 ? (
              <View style={styles.errorBox}>
                <AppText variant="caption" style={styles.errorTitle}>
                  ⚠️ PESAN ERROR DARI SERVER
                </AppText>
                {failedErrors.map((err, idx) => (
                  <AppText key={idx} variant="caption" style={styles.errorText}>
                    • {err}
                  </AppText>
                ))}
              </View>
            ) : null}

            {/* Architecture Details Card */}
            <View style={styles.detailsCard}>
              <AppText variant="caption" style={styles.sectionHeaderTitle}>
                INFORMASI ENGINE SINKRONISASI
              </AppText>

              <View style={styles.infoRow}>
                <AppText variant="body" style={styles.infoLabel}>
                  Mode Database:
                </AppText>
                <AppText variant="body" style={styles.infoValue}>
                  SQLite Lokal (Offline-First)
                </AppText>
              </View>

              <View style={styles.infoRow}>
                <AppText variant="body" style={styles.infoLabel}>
                  Causal Ordering:
                </AppText>
                <AppText variant="body" style={styles.infoValue}>
                  Topological (Rank 1-4)
                </AppText>
              </View>

              <View style={styles.infoRow}>
                <AppText variant="body" style={styles.infoLabel}>
                  Resolusi Konflik:
                </AppText>
                <AppText variant="body" style={styles.infoValue}>
                  3-Way Merge (Field-Level)
                </AppText>
              </View>

              <View style={styles.infoRow}>
                <AppText variant="body" style={styles.infoLabel}>
                  Pemeriksaan Terakhir:
                </AppText>
                <AppText variant="body" style={styles.infoValue}>
                  {lastSyncTime}
                </AppText>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <AppButton
              title={isSyncing ? 'Menyinkronkan...' : '🔄 Sinkronkan Sekarang'}
              variant="primary"
              onPress={handleManualSync}
              disabled={isSyncing}
              style={styles.syncBtn}
            />
            <AppButton
              title="🗑️ Kosongkan Data Lokal (Dev)"
              variant="ghost"
              onPress={handleClearLocalData}
              disabled={isSyncing}
              style={styles.clearBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '85%',
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  subtitle: {
    color: theme.colors.textMuted,
  },
  closeText: {
    fontSize: 18,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    marginBottom: theme.spacing.xxs,
  },
  metricValue: {
    fontWeight: theme.typography.fontWeights.bold,
    marginVertical: theme.spacing.xxs,
  },
  metricSuccess: {
    color: theme.colors.success[600],
  },
  metricDanger: {
    color: theme.colors.danger[600],
  },
  metricDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: `${theme.colors.danger[500]}15`,
    borderColor: `${theme.colors.danger[500]}30`,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorTitle: {
    color: theme.colors.danger[600],
    fontWeight: theme.typography.fontWeights.bold,
    marginBottom: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger[700],
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    color: theme.colors.textMuted,
  },
  infoValue: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  syncBtn: {
    width: '100%',
  },
  clearBtn: {
    width: '100%',
    marginTop: theme.spacing.xs,
  },
});
