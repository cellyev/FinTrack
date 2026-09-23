import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { useTransactionDetail } from '../use-transaction-detail';
import { theme } from '@/core/ui/tokens/theme';

export function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, isLoading, error } = useTransactionDetail(id);

  if (isLoading) {
    return (
      <AppScreen style={styles.container}>
        <LoadingState message="Memuat detail transaksi..." />
      </AppScreen>
    );
  }

  if (error || !detail) {
    return (
      <AppScreen style={styles.container}>
        <ErrorState
          title="Transaksi Tidak Ditemukan"
          message={error ?? 'Transaksi tidak ditemukan atau telah dihapus.'}
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  }

  const isExpense = detail.type === 'expense';
  const isIncome = detail.type === 'income';
  const isTransfer = detail.type === 'transfer';

  const getTypeLabel = () => {
    if (isExpense) return 'Pengeluaran';
    if (isIncome) return 'Pemasukan';
    if (isTransfer) return 'Transfer Antar-Akun';
    return 'Saldo Awal';
  };

  const getAmountPrefix = () => {
    if (isExpense) return '- ';
    if (isIncome) return '+ ';
    return '';
  };

  const getAmountColor = () => {
    if (isExpense) return theme.colors.danger[500];
    if (isIncome) return theme.colors.success[500];
    if (isTransfer) return theme.colors.info[500];
    return theme.colors.primary[500];
  };

  const formatFullDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  };

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isExpense
                  ? `${theme.colors.danger[500]}22`
                  : isIncome
                  ? `${theme.colors.success[500]}22`
                  : `${theme.colors.info[500]}22`,
              },
            ]}
          >
            <AppText
              variant="caption"
              style={[styles.typeBadgeText, { color: getAmountColor() }]}
            >
              {getTypeLabel().toUpperCase()}
            </AppText>
          </View>

          <AppText
            variant="display"
            style={[styles.amountDisplay, { color: getAmountColor() }]}
          >
            {getAmountPrefix()}
            {detail.amount.formatDisplay()}
          </AppText>

          <AppText variant="bodyMuted" style={styles.dateText}>
            {formatFullDate(detail.transactionDate)}
          </AppText>
        </View>

        {/* Account Details Section */}
        <View style={styles.sectionCard}>
          <AppText variant="caption" style={styles.sectionHeaderTitle}>
            INFORMASI AKUN
          </AppText>

          {isTransfer ? (
            <View style={styles.transferAccountsRow}>
              <View style={styles.accountCol}>
                <AppText variant="caption" style={styles.fieldLabel}>
                  DARI AKUN
                </AppText>
                <AppText variant="titleMedium" style={styles.fieldValue}>
                  {detail.sourceAccount?.name ?? 'Akun Sumber'}
                </AppText>
                <AppText variant="caption" style={styles.typeSmall}>
                  {detail.sourceAccount?.type === 'bank' ? 'Bank' : detail.sourceAccount?.type === 'ewallet' ? 'E-Wallet' : 'Tunai'}
                </AppText>
              </View>

              <AppText variant="titleMedium" style={styles.arrowIcon}>
                ➔
              </AppText>

              <View style={styles.accountCol}>
                <AppText variant="caption" style={styles.fieldLabel}>
                  KE AKUN
                </AppText>
                <AppText variant="titleMedium" style={styles.fieldValue}>
                  {detail.destinationAccount?.name ?? 'Akun Tujuan'}
                </AppText>
                <AppText variant="caption" style={styles.typeSmall}>
                  {detail.destinationAccount?.type === 'bank' ? 'Bank' : detail.destinationAccount?.type === 'ewallet' ? 'E-Wallet' : 'Tunai'}
                </AppText>
              </View>
            </View>
          ) : isExpense ? (
            <View style={styles.infoRow}>
              <AppText variant="body" style={styles.fieldLabel}>
                Sumber Dana:
              </AppText>
              <AppText variant="titleMedium" style={styles.fieldValue}>
                {detail.sourceAccount?.name ?? 'Akun'}
              </AppText>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <AppText variant="body" style={styles.fieldLabel}>
                Rekening / Dompet Tujuan:
              </AppText>
              <AppText variant="titleMedium" style={styles.fieldValue}>
                {detail.destinationAccount?.name ?? 'Akun'}
              </AppText>
            </View>
          )}
        </View>

        {/* Multi-Category Splits Section (for Expense / Income) */}
        {detail.items.length > 0 ? (
          <View style={styles.sectionCard}>
            <View style={styles.splitsHeaderRow}>
              <AppText variant="caption" style={styles.sectionHeaderTitle}>
                RINCIAN KATEGORI ({detail.items.length})
              </AppText>
              <AppText variant="caption" style={styles.totalSplitText}>
                Total: {detail.totalSplitAmount.formatDisplay()}
              </AppText>
            </View>

            {detail.items.map((split) => (
              <View key={split.id} style={styles.splitRow}>
                <View style={styles.splitLeft}>
                  <View
                    style={[
                      styles.catDot,
                      { backgroundColor: split.categoryColor ?? theme.colors.primary[500] },
                    ]}
                  />
                  <View>
                    <AppText variant="body" style={styles.splitCatName}>
                      {split.categoryName}
                    </AppText>
                    {split.note ? (
                      <AppText variant="caption" style={styles.splitNote}>
                        {split.note}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <AppText variant="body" style={styles.splitAmount}>
                  {split.amount.formatDisplay()}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Notes Section */}
        {detail.note ? (
          <View style={styles.sectionCard}>
            <AppText variant="caption" style={styles.sectionHeaderTitle}>
              CATATAN
            </AppText>
            <AppText variant="body" style={styles.noteContent}>
              {detail.note}
            </AppText>
          </View>
        ) : null}

        {/* Linked Entity Sections (Cross-Domain Navigation) */}
        {detail.debtId ? (
          <TouchableOpacity
            style={styles.linkedEntityCard}
            onPress={() => router.push('/(tabs)/plans')}
            accessibilityRole="button"
            accessibilityLabel="Lihat Detail Hutang / Piutang Terkait"
          >
            <View style={styles.linkedEntityIconBox}>
              <AppText style={styles.linkedEntityIcon}>🤝</AppText>
            </View>
            <View style={styles.linkedEntityContent}>
              <AppText variant="caption" style={styles.linkedEntityLabel}>
                TERKAIT HUTANG / PIUTANG
              </AppText>
              <AppText variant="body" style={styles.linkedEntityTitle}>
                Lihat di Tab Rencana Finansial ➔
              </AppText>
            </View>
          </TouchableOpacity>
        ) : null}

        {detail.recurringTransactionId ? (
          <TouchableOpacity
            style={styles.linkedEntityCard}
            onPress={() => router.push('/(tabs)/plans')}
            accessibilityRole="button"
            accessibilityLabel="Lihat Jadwal Transaksi Berulang Terkait"
          >
            <View style={styles.linkedEntityIconBox}>
              <AppText style={styles.linkedEntityIcon}>🔄</AppText>
            </View>
            <View style={styles.linkedEntityContent}>
              <AppText variant="caption" style={styles.linkedEntityLabel}>
                DIHASILKAN DARI JADWAL RUTIN
              </AppText>
              <AppText variant="body" style={styles.linkedEntityTitle}>
                Lihat Pengaturan Transaksi Berulang ➔
              </AppText>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Offline Security Status */}
        <View style={styles.offlineStatusCard}>
          <AppText variant="caption" style={styles.offlineStatusText}>
            🔒 Tersimpan secara aman di database lokal perangkat Anda.
          </AppText>
        </View>

        {/* Correction Window Status & Actions */}
        {detail.isEditable ? (
          <View style={styles.actionButtons}>
            <AppButton
              title="Ubah Transaksi"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: '/transactions/edit/[id]',
                  params: { id: detail.id },
                })
              }
              style={styles.editButton}
              accessibilityLabel="Ubah transaksi ini"
            />
            <AppButton
              title="Kembali"
              variant="secondary"
              onPress={() => router.back()}
              accessibilityLabel="Kembali ke riwayat transaksi"
            />
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <View style={styles.expiredNoticeCard}>
              <AppText variant="caption" style={styles.expiredNoticeText}>
                ⏳{' '}
                {detail.type === 'opening_balance'
                  ? 'Transaksi Saldo Awal tidak dapat diedit dari riwayat transaksi.'
                  : 'Transaksi ini tidak dapat diedit karena sudah melewati batas koreksi 7 hari.'}
              </AppText>
            </View>
            <AppButton
              title="Kembali"
              variant="secondary"
              onPress={() => router.back()}
              accessibilityLabel="Kembali ke riwayat transaksi"
            />
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  headerCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  typeBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.full,
    marginBottom: theme.spacing.xs,
  },
  typeBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  amountDisplay: {
    marginVertical: theme.spacing.xxs,
  },
  dateText: {
    marginTop: theme.spacing.xxs,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  sectionHeaderTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  transferAccountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountCol: {
    flex: 1,
  },
  arrowIcon: {
    color: theme.colors.info[500],
    paddingHorizontal: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    color: theme.colors.textMuted,
  },
  fieldValue: {
    color: theme.colors.text,
    marginTop: 2,
  },
  typeSmall: {
    color: theme.colors.neutral[400],
    textTransform: 'uppercase',
    marginTop: 2,
  },
  splitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  totalSplitText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  splitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  splitCatName: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  splitNote: {
    color: theme.colors.textMuted,
  },
  splitAmount: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  noteContent: {
    color: theme.colors.text,
    lineHeight: 22,
  },
  linkedEntityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary[100],
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  linkedEntityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedEntityIcon: {
    fontSize: 20,
  },
  linkedEntityContent: {
    flex: 1,
  },
  linkedEntityLabel: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  linkedEntityTitle: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeights.medium,
    marginTop: 2,
  },
  offlineStatusCard: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  offlineStatusText: {
    color: theme.colors.neutral[300],
    textAlign: 'center',
  },
  actionButtons: {
    marginBottom: theme.spacing.xl,
  },
  editButton: {
    marginBottom: theme.spacing.sm,
  },
  expiredNoticeCard: {
    backgroundColor: `${theme.colors.warning[500]}18`,
    borderWidth: 1,
    borderColor: `${theme.colors.warning[500]}44`,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  expiredNoticeText: {
    color: theme.colors.warning[500],
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
});
