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
import { Debt } from '../../domain/debt';
import { GetDebtDetailUseCase, DebtDetailDTO } from '../../application/get-debt-detail.usecase';
import { SqliteDebtRepository } from '../../data/sqlite-debt.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { theme } from '@/core/ui/tokens/theme';

const debtRepo = new SqliteDebtRepository();
const txRepo = new SqliteTransactionRepository();
const getDebtDetailUseCase = new GetDebtDetailUseCase(debtRepo, txRepo);

export interface DebtDetailModalProps {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onPayPress: (debt: Debt) => void;
  onEditPress: (debt: Debt) => void;
  onDeletePress: (debtId: string) => void;
}

export const DebtDetailModal: React.FC<DebtDetailModalProps> = ({
  visible,
  debt,
  onClose,
  onPayPress,
  onEditPress,
  onDeletePress,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [detailData, setDetailData] = useState<DebtDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible && debt && user) {
      setIsLoading(true);
      getDebtDetailUseCase
        .execute({ id: debt.id, userId: user.id })
        .then((res) => {
          setIsLoading(false);
          if (res.success) {
            setDetailData(res.data);
          }
        })
        .catch(() => setIsLoading(false));
    }
  }, [visible, debt, user]);

  if (!debt) return null;

  const currentDebt = detailData?.debt ?? debt;
  const isBorrowed = currentDebt.isBorrowed;
  const isSettled = currentDebt.isSettled;
  const isOverdue = currentDebt.isOverdue();
  const transactions = detailData?.transactions ?? [];

  const handleDelete = () => {
    Alert.alert(
      'Hapus Catatan',
      `Apakah Anda yakin ingin menghapus catatan ${isBorrowed ? 'hutang' : 'piutang'} ${currentDebt.personName}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: () => {
            onClose();
            onDeletePress(currentDebt.id);
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
                Detail {isBorrowed ? 'Hutang' : 'Piutang'}
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                👤 {currentDebt.personName}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Type & Status Badges */}
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.typeBadge,
                  isBorrowed ? styles.borrowedBadge : styles.lentBadge,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.typeBadgeText,
                    isBorrowed ? styles.borrowedBadgeText : styles.lentBadgeText,
                  ]}
                >
                  {isBorrowed ? '🔴 HUTANG (Saya Berhutang)' : '🟢 PIUTANG (Dipinjamkan)'}
                </AppText>
              </View>

              {isSettled ? (
                <View style={styles.settledBadge}>
                  <AppText variant="caption" style={styles.settledText}>
                    LUNAS
                  </AppText>
                </View>
              ) : isOverdue ? (
                <View style={styles.overdueBadge}>
                  <AppText variant="caption" style={styles.overdueText}>
                    TERLAMBAT
                  </AppText>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <AppText variant="caption" style={styles.activeText}>
                    BELUM LUNAS
                  </AppText>
                </View>
              )}
            </View>

            {/* Financial Overview Card */}
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.col}>
                  <AppText variant="caption" style={styles.label}>
                    Total Awal
                  </AppText>
                  <AppText variant="titleMedium" style={styles.value}>
                    {currentDebt.originalAmount.formatDisplay()}
                  </AppText>
                </View>
                <View style={styles.colRight}>
                  <AppText variant="caption" style={styles.label}>
                    Sisa Saldo
                  </AppText>
                  <AppText
                    variant="titleMedium"
                    style={[
                      styles.value,
                      isBorrowed ? styles.borrowedText : styles.lentText,
                    ]}
                  >
                    {currentDebt.remainingAmount.formatDisplay()}
                  </AppText>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, currentDebt.percentageRepaid))}%`,
                      backgroundColor: isSettled
                        ? theme.colors.success[500]
                        : isBorrowed
                        ? theme.colors.danger[500]
                        : theme.colors.primary[500],
                    },
                  ]}
                />
              </View>
              <AppText variant="caption" style={styles.progressText}>
                Sudah dibayar {currentDebt.percentageRepaid.toFixed(1)}%
              </AppText>

              {currentDebt.dueDate ? (
                <View style={styles.metaRow}>
                  <AppText variant="caption" style={styles.metaLabel}>
                    🗓️ Jatuh Tempo:
                  </AppText>
                  <AppText
                    variant="caption"
                    style={[styles.metaValue, isOverdue && styles.overdueValue]}
                  >
                    {currentDebt.dueDate}
                  </AppText>
                </View>
              ) : null}

              {currentDebt.note ? (
                <View style={styles.notesBox}>
                  <AppText variant="caption" style={styles.notesLabel}>
                    Catatan:
                  </AppText>
                  <AppText variant="body" style={styles.notesText}>
                    {currentDebt.note}
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Repayment History Timeline */}
            <View style={styles.historySection}>
              <AppText variant="caption" style={styles.sectionTitle}>
                RIWAYAT PEMBAYARAN ({transactions.length})
              </AppText>

              {isLoading ? (
                <LoadingState message="Memuat riwayat transaksi..." />
              ) : transactions.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <AppText variant="body" style={styles.emptyHistoryText}>
                    Belum ada riwayat pembayaran yang tercatat.
                  </AppText>
                </View>
              ) : (
                transactions.map((tx) => (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.timelineItem}
                    onPress={() => handleTransactionPress(tx.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Pembayaran ${tx.amount.formatDisplay()} pada ${tx.transactionDate}`}
                  >
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <AppText variant="caption" style={styles.timelineDate}>
                          {tx.transactionDate}
                        </AppText>
                        <AppText variant="body" style={styles.timelineAmount}>
                          {tx.amount.formatDisplay()}
                        </AppText>
                      </View>
                      {tx.note ? (
                        <AppText variant="caption" style={styles.timelineNote}>
                          {tx.note}
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
            {!isSettled ? (
              <AppButton
                title="💳 Bayar / Angsur"
                variant="primary"
                onPress={() => {
                  onClose();
                  onPayPress(currentDebt);
                }}
                style={styles.actionBtn}
              />
            ) : null}
            <AppButton
              title="✏️ Edit"
              variant="secondary"
              onPress={() => {
                onClose();
                onEditPress(currentDebt);
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
  typeBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  borrowedBadge: {
    backgroundColor: theme.colors.danger[50],
  },
  lentBadge: {
    backgroundColor: theme.colors.success[50],
  },
  typeBadgeText: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  borrowedBadgeText: {
    color: theme.colors.danger[700],
  },
  lentBadgeText: {
    color: theme.colors.success[700],
  },
  settledBadge: {
    backgroundColor: theme.colors.success[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  settledText: {
    color: theme.colors.success[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  overdueBadge: {
    backgroundColor: theme.colors.danger[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  overdueText: {
    color: theme.colors.danger[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  activeBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  activeText: {
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.bold,
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
  value: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  borrowedText: {
    color: theme.colors.danger[600],
  },
  lentText: {
    color: theme.colors.primary[600],
  },
  progressBarBg: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: theme.spacing.xs,
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  metaLabel: {
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  overdueValue: {
    color: theme.colors.danger[600],
  },
  notesBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  notesLabel: {
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  notesText: {
    color: theme.colors.text,
  },
  historySection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    letterSpacing: 0.5,
  },
  emptyHistoryBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  emptyHistoryText: {
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
  timelineNote: {
    color: theme.colors.textMuted,
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
