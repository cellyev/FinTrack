import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { RecurringTransactionCard } from './RecurringTransactionCard';
import { CreateRecurringTransactionModal } from '../screens/CreateRecurringTransactionModal';
import { EditRecurringTransactionModal } from '../screens/EditRecurringTransactionModal';
import { RecurringDetailModal } from '../screens/RecurringDetailModal';
import { RecurringTransaction } from '../../domain/recurring-transaction';
import { useRecurringTransactions } from '../use-recurring-transactions';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { theme } from '@/core/ui/tokens/theme';

export interface RecurringTabProps {
  isRefreshing?: boolean;
}

export const RecurringTab: React.FC<RecurringTabProps> = ({ isRefreshing = false }) => {
  const {
    recurringList,
    summary: recurringSummary,
    isLoading,
    error,
    refresh,
    createRecurring,
    updateRecurring,
    toggleActive,
    deleteRecurring,
    processDueOccurrences,
  } = useRecurringTransactions();

  const { accounts } = useAccounts();
  const { categories } = useCategoryManagement();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailRecurring, setDetailRecurring] = useState<RecurringTransaction | null>(null);
  const [editRecurring, setEditRecurring] = useState<RecurringTransaction | null>(null);

  if (isLoading && !isRefreshing) {
    return <LoadingState message="Memuat jadwal transaksi berulang..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <View style={styles.container}>
      {/* Summary Card for Recurring */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Pengeluaran / bln
          </AppText>
          <AppText variant="titleMedium" style={styles.spentValue}>
            {recurringSummary.totalMonthlyExpenseCommitment.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Pemasukan / bln
          </AppText>
          <AppText variant="titleMedium" style={styles.incomeValue}>
            {recurringSummary.totalMonthlyIncomeCommitment.formatDisplay()}
          </AppText>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Jatuh Tempo
          </AppText>
          <AppText
            variant="titleMedium"
            style={recurringSummary.dueCount > 0 ? styles.overdueValue : styles.summaryValue}
          >
            {recurringSummary.dueCount}
          </AppText>
        </View>
      </View>

      {/* Batch Process Due Occurrences Banner */}
      {recurringSummary.dueCount > 0 && (
        <View style={styles.batchProcessBanner}>
          <View style={styles.batchBannerInfo}>
            <AppText variant="body" style={styles.batchBannerTitle}>
              ⚡ {recurringSummary.dueCount} Jadwal Siap Diproses
            </AppText>
            <AppText variant="caption" style={styles.batchBannerSubtitle}>
              Catat semua pengeluaran/pemasukan rutin yang jatuh tempo secara otomatis.
            </AppText>
          </View>
          <AppButton
            title="Proses Semua"
            variant="primary"
            onPress={async () => {
              await processDueOccurrences();
            }}
          />
        </View>
      )}

      {/* List of Recurring Transactions */}
      <View style={styles.listContainer}>
        {recurringList.length === 0 ? (
          <EmptyState
            title="Belum Ada Transaksi Berulang"
            description="Buat jadwal otomatis untuk sewa rumah, tagihan langganan WiFi, gaji bulanan, atau pengeluaran rutin lainnya."
            actionTitle="+ Buat Jadwal Baru"
            onAction={() => setCreateModalVisible(true)}
          />
        ) : (
          recurringList.map((item) => {
            const acc = accounts.find((a) => a.account.id === item.accountId)?.account;
            const cat = categories.find((c) => c.id === item.categoryId);
            return (
              <RecurringTransactionCard
                key={item.id}
                recurring={item}
                accountName={acc?.name}
                categoryName={cat?.name}
                onPress={() => setDetailRecurring(item)}
                onProcessNow={async () => {
                  await processDueOccurrences(undefined, item.id);
                }}
                onToggleActive={async (isActive) => {
                  await toggleActive(item.id, isActive);
                }}
              />
            );
          })
        )}
      </View>

      {/* Modals */}
      <RecurringDetailModal
        visible={Boolean(detailRecurring)}
        recurring={detailRecurring}
        onClose={() => setDetailRecurring(null)}
        onEditPress={(r) => setEditRecurring(r)}
        onDeletePress={async (id) => {
          await deleteRecurring(id);
        }}
      />

      <CreateRecurringTransactionModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={async (input) => {
          const res = await createRecurring(input);
          return res.success;
        }}
      />

      <EditRecurringTransactionModal
        visible={Boolean(editRecurring)}
        recurring={editRecurring}
        onClose={() => setEditRecurring(null)}
        onUpdate={async (data) => {
          const res = await updateRecurring(data);
          return res.success;
        }}
        onToggleActive={async (id, isActive) => {
          const res = await toggleActive(id, isActive);
          return res.success;
        }}
        onDelete={async (id) => {
          const res = await deleteRecurring(id);
          return res.success;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: '60%',
    backgroundColor: theme.colors.border,
  },
  summaryLabel: {
    color: theme.colors.neutral[500],
    marginBottom: theme.spacing.xxs,
  },
  summaryValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  spentValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.danger[500],
  },
  incomeValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  overdueValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.danger[600],
  },
  batchProcessBanner: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[100],
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  batchBannerInfo: {
    flex: 1,
  },
  batchBannerTitle: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
    marginBottom: theme.spacing.xxs,
  },
  batchBannerSubtitle: {
    color: theme.colors.primary[600],
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
});
