import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { RecurringTransaction } from '../../domain/recurring-transaction';
import { Transaction } from '@/features/transactions/domain/transaction';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { theme } from '@/core/ui/tokens/theme';

const txRepo = new SqliteTransactionRepository();

export interface RecurringDetailModalProps {
  visible: boolean;
  recurring: RecurringTransaction | null;
  onClose: () => void;
  onEditPress: (recurring: RecurringTransaction) => void;
  onDeletePress: (recurringId: string) => void;
}

export const RecurringDetailModal: React.FC<RecurringDetailModalProps> = ({
  visible,
  recurring,
  onClose,
  onEditPress,
  onDeletePress,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [executionLogs, setExecutionLogs] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible && recurring && user) {
      setIsLoading(true);
      txRepo
        .list({
          userId: user.id,
          recurringTransactionId: recurring.id,
        })
        .then((res) => {
          setIsLoading(false);
          if (res.success) {
            setExecutionLogs(res.data);
          }
        })
        .catch(() => setIsLoading(false));
    }
  }, [visible, recurring, user]);

  if (!recurring) return null;

  const getFrequencyLabel = () => {
    switch (recurring.frequency) {
      case 'daily':
        return 'Harian';
      case 'weekly':
        return 'Mingguan';
      case 'monthly':
        return 'Bulanan';
      case 'yearly':
        return 'Tahunan';
      default:
        return recurring.frequency;
    }
  };

  const getTypeLabel = () => {
    switch (recurring.type) {
      case 'expense':
        return 'Pengeluaran';
      case 'income':
        return 'Pemasukan';
      default:
        return recurring.type;
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi Berulang',
      `Apakah Anda yakin ingin menghapus aturan berulang "${recurring.note ?? 'Transaksi Berulang'}"? Transaksi yang telah dihasilkan sebelumnya tidak akan dihapus.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDeletePress(recurring.id);
          },
        },
      ]
    );
  };

  const handleTransactionPress = (txId: string) => {
    onClose();
    router.push({ pathname: '/transactions/[id]', params: { id: txId } });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <AppText variant="titleMedium" style={styles.title}>
                {recurring.note ?? 'Transaksi Berulang'}
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                🔄 Transaksi Berulang • {getFrequencyLabel()}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Status & Type Badges */}
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  recurring.isActive ? styles.activeBadge : styles.inactiveBadge,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.statusBadgeText,
                    recurring.isActive ? styles.activeBadgeText : styles.inactiveBadgeText,
                  ]}
                >
                  {recurring.isActive ? '● AKTIF' : '○ NONAKTIF'}
                </AppText>
              </View>

              <View style={styles.typeBadge}>
                <AppText variant="caption" style={styles.typeBadgeText}>
                  {getTypeLabel().toUpperCase()}
                </AppText>
              </View>
            </View>

            {/* Overview Card */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.col}>
                  <AppText variant="caption" style={styles.label}>
                    Nominal Per Kejadian
                  </AppText>
                  <AppText variant="titleMedium" style={styles.amountValue}>
                    {recurring.amount.formatDisplay()}
                  </AppText>
                </View>
                <View style={styles.colRight}>
                  <AppText variant="caption" style={styles.label}>
                    Jadwal Berikutnya
                  </AppText>
                  <AppText variant="body" style={styles.nextDateValue}>
                    {recurring.nextOccurrence ?? '-'}
                  </AppText>
                </View>
              </View>

              <View style={styles.metaRow}>
                <AppText variant="caption" style={styles.metaLabel}>
                  Mulai: {recurring.startDate}
                </AppText>
                {recurring.endDate ? (
                  <AppText variant="caption" style={styles.metaLabel}>
                    • Berakhir: {recurring.endDate}
                  </AppText>
                ) : (
                  <AppText variant="caption" style={styles.metaLabel}>
                    • Tanpa batas akhir
                  </AppText>
                )}
              </View>
            </View>

            {/* Execution Log Timeline */}
            <View style={styles.logSection}>
              <AppText variant="caption" style={styles.sectionTitle}>
                LOG EKSEKUSI TRANSAKSI ({executionLogs.length})
              </AppText>

              {isLoading ? (
                <LoadingState message="Memuat riwayat transaksi berulang..." />
              ) : executionLogs.length === 0 ? (
                <View style={styles.emptyLogBox}>
                  <AppText variant="body" style={styles.emptyLogText}>
                    Belum ada transaksi yang dihasilkan oleh jadwal ini.
                  </AppText>
                </View>
              ) : (
                executionLogs.map((tx) => (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.timelineItem}
                    onPress={() => handleTransactionPress(tx.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Transaksi ${tx.amount.formatDisplay()} pada ${tx.transactionDate}`}
                  >
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <AppText variant="caption" style={styles.timelineDate}>
                          🗓️ {tx.transactionDate}
                        </AppText>
                        <AppText variant="body" style={styles.timelineAmount}>
                          {tx.amount.formatDisplay()}
                        </AppText>
                      </View>
                      {tx.occurrenceKey ? (
                        <AppText variant="caption" style={styles.timelineKey}>
                          ID Kejadian: {tx.occurrenceKey}
                        </AppText>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <AppButton
              title="✏️ Edit Jadwal"
              variant="secondary"
              onPress={() => {
                onClose();
                onEditPress(recurring);
              }}
              style={styles.actionBtn}
            />
            <AppButton
              title="🗑️ Hapus"
              variant="danger"
              onPress={handleDelete}
              style={styles.actionBtn}
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
    maxHeight: '90%',
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  activeBadge: {
    backgroundColor: theme.colors.success[50],
  },
  inactiveBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
  },
  statusBadgeText: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  activeBadgeText: {
    color: theme.colors.success[700],
  },
  inactiveBadgeText: {
    color: theme.colors.textMuted,
  },
  typeBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  typeBadgeText: {
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  card: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  col: {
    flex: 1,
  },
  colRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  amountValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  nextDateValue: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  metaLabel: {
    color: theme.colors.textMuted,
  },
  logSection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.5,
  },
  emptyLogBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  emptyLogText: {
    color: theme.colors.textMuted,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary[500],
    marginTop: 6,
    marginRight: theme.spacing.sm,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineDate: {
    color: theme.colors.textMuted,
  },
  timelineAmount: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  timelineKey: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionBtn: {
    flex: 1,
  },
});
