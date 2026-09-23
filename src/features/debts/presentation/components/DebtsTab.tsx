import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { DebtCard } from './DebtCard';
import { CreateDebtModal } from '../screens/CreateDebtModal';
import { RecordRepaymentModal } from '../screens/RecordRepaymentModal';
import { EditDebtModal } from '../screens/EditDebtModal';
import { DebtDetailModal } from '../screens/DebtDetailModal';
import { Debt, DebtType } from '../../domain/debt';
import { useDebts } from '../use-debts';
import { theme } from '@/core/ui/tokens/theme';

export interface DebtsTabProps {
  isRefreshing?: boolean;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({ isRefreshing = false }) => {
  const {
    debts,
    summary: debtSummary,
    isLoading,
    error,
    refresh,
    createDebt,
    recordRepayment,
    updateDebt,
    deleteDebt,
  } = useDebts();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalDebt, setDetailModalDebt] = useState<Debt | null>(null);
  const [repayModalDebt, setRepayModalDebt] = useState<Debt | null>(null);
  const [editModalDebt, setEditModalDebt] = useState<Debt | null>(null);
  const [debtFilterType, setDebtFilterType] = useState<DebtType | 'all' | 'settled'>('all');

  const filteredDebts = debts.filter((d) => {
    if (debtFilterType === 'all') return !d.isSettled;
    if (debtFilterType === 'settled') return d.isSettled;
    return d.type === debtFilterType && !d.isSettled;
  });

  if (isLoading && !isRefreshing) {
    return <LoadingState message="Memuat catatan hutang & piutang..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (debts.length === 0) {
    return (
      <>
        <EmptyState
          title="Belum Ada Hutang / Piutang"
          description="Catat pinjaman yang perlu Anda bayar atau piutang yang perlu Anda tagih agar tidak terlewat."
          actionTitle="+ Catat Hutang / Piutang"
          onAction={() => setCreateModalVisible(true)}
        />
        <CreateDebtModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSubmit={async (input) => {
            const res = await createDebt(input);
            return res.success;
          }}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* Debts & Receivables Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Yang Harus Dibayar
          </AppText>
          <AppText variant="body" style={styles.spentValue}>
            {debtSummary.totalBorrowedRemaining.formatDisplay()}
          </AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Yang Akan Diterima
          </AppText>
          <AppText variant="body" style={styles.currentSavingsValue}>
            {debtSummary.totalLentRemaining.formatDisplay()}
          </AppText>
        </View>
        {debtSummary.overdueCount > 0 ? (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <AppText variant="caption" style={styles.summaryLabel}>
                Lewat Tempo
              </AppText>
              <AppText variant="body" style={styles.overdueCountValue}>
                {debtSummary.overdueCount} Tagihan
              </AppText>
            </View>
          </>
        ) : null}
      </View>

      {/* Sub Filter Chips */}
      <View style={styles.subFilterRow}>
        <TouchableOpacity
          style={[styles.subFilterChip, debtFilterType === 'all' && styles.subFilterChipActive]}
          onPress={() => setDebtFilterType('all')}
        >
          <AppText
            variant="caption"
            style={[styles.subFilterText, debtFilterType === 'all' && styles.subFilterTextActive]}
          >
            Aktif ({debts.filter((d) => !d.isSettled).length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subFilterChip, debtFilterType === 'borrowed' && styles.subFilterChipActive]}
          onPress={() => setDebtFilterType('borrowed')}
        >
          <AppText
            variant="caption"
            style={[styles.subFilterText, debtFilterType === 'borrowed' && styles.subFilterTextActive]}
          >
            Hutang Saya ({debts.filter((d) => d.isBorrowed && !d.isSettled).length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subFilterChip, debtFilterType === 'lent' && styles.subFilterChipActive]}
          onPress={() => setDebtFilterType('lent')}
        >
          <AppText
            variant="caption"
            style={[styles.subFilterText, debtFilterType === 'lent' && styles.subFilterTextActive]}
          >
            Piutang ({debts.filter((d) => d.isLent && !d.isSettled).length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subFilterChip, debtFilterType === 'settled' && styles.subFilterChipActive]}
          onPress={() => setDebtFilterType('settled')}
        >
          <AppText
            variant="caption"
            style={[styles.subFilterText, debtFilterType === 'settled' && styles.subFilterTextActive]}
          >
            Lunas ({debtSummary.settledCount})
          </AppText>
        </TouchableOpacity>
      </View>

      {/* List of Debts */}
      <View style={styles.listContainer}>
        {filteredDebts.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data"
            description="Tidak ada catatan yang sesuai dengan filter yang dipilih."
          />
        ) : (
          filteredDebts.map((item) => (
            <DebtCard
              key={item.id}
              debt={item}
              onPress={() => setDetailModalDebt(item)}
              onPayPress={!item.isSettled ? () => setRepayModalDebt(item) : undefined}
            />
          ))
        )}
      </View>

      {/* Modals */}
      <DebtDetailModal
        visible={Boolean(detailModalDebt)}
        debt={detailModalDebt}
        onClose={() => setDetailModalDebt(null)}
        onPayPress={(d) => setRepayModalDebt(d)}
        onEditPress={(d) => setEditModalDebt(d)}
        onDeletePress={async (id) => {
          await deleteDebt(id);
        }}
      />

      <CreateDebtModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={async (input) => {
          const res = await createDebt(input);
          return res.success;
        }}
      />

      <RecordRepaymentModal
        visible={Boolean(repayModalDebt)}
        debt={repayModalDebt}
        onClose={() => setRepayModalDebt(null)}
        onSubmit={async (input) => {
          const res = await recordRepayment(input);
          return res.success;
        }}
      />

      <EditDebtModal
        visible={Boolean(editModalDebt)}
        debt={editModalDebt}
        onClose={() => setEditModalDebt(null)}
        onSubmit={async (input) => {
          const res = await updateDebt(input);
          return res.success;
        }}
        onDelete={async (id) => {
          const res = await deleteDebt(id);
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
  spentValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.danger[500],
  },
  currentSavingsValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  overdueCountValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.danger[600],
  },
  subFilterRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  subFilterChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subFilterChipActive: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[500],
  },
  subFilterText: {
    color: theme.colors.neutral[600],
  },
  subFilterTextActive: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeights.semibold,
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
});
