import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { BudgetProgressCard } from './BudgetProgressCard';
import { CreateBudgetModal } from '../screens/CreateBudgetScreen';
import { EditBudgetModal } from '../screens/EditBudgetScreen';
import { BudgetProgress } from '../../domain/budget-progress';
import { useBudgets } from '../use-budgets';
import { Money } from '@/core/domain/money';
import { theme } from '@/core/ui/tokens/theme';

export interface BudgetsTabProps {
  isRefreshing?: boolean;
  onOpenCreate?: () => void;
}

export const BudgetsTab: React.FC<BudgetsTabProps> = ({ isRefreshing = false }) => {
  const {
    budgets,
    isLoading,
    error,
    refresh,
    createBudget,
    updateBudget,
    deleteBudget,
  } = useBudgets();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetProgress | null>(null);

  const totalBudgetMinor = budgets.reduce(
    (sum, b) => sum + Number(b.budgetAmount.minorUnits),
    0
  );
  const totalSpentMinor = budgets.reduce(
    (sum, b) => sum + Number(b.actualSpending.minorUnits),
    0
  );
  const totalRemainingBudgetMinor = Math.max(0, totalBudgetMinor - totalSpentMinor);

  const totalBudgetMoney = Money.fromMinorUnits(totalBudgetMinor, 'IDR');
  const totalSpentMoney = Money.fromMinorUnits(totalSpentMinor, 'IDR');
  const totalRemainingBudgetMoney = Money.fromMinorUnits(totalRemainingBudgetMinor, 'IDR');

  if (isLoading && !isRefreshing) {
    return <LoadingState message="Memuat rencana anggaran..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (budgets.length === 0) {
    return (
      <>
        <EmptyState
          title="Belum Ada Anggaran"
          description="Buat batas pengeluaran untuk kategori belanja bulanan Anda agar keuangan tetap terkendali."
          actionTitle="+ Buat Anggaran Baru"
          onAction={() => setCreateModalVisible(true)}
        />
        <CreateBudgetModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSubmit={async (input) => {
            const res = await createBudget(input);
            return res.success;
          }}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* Budget Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Total Budget
          </AppText>
          <AppText variant="body" style={styles.summaryValue}>
            {totalBudgetMoney.formatDisplay()}
          </AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Terpakai
          </AppText>
          <AppText variant="body" style={styles.spentValue}>
            {totalSpentMoney.formatDisplay()}
          </AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Sisa
          </AppText>
          <AppText variant="body" style={styles.remainingValue}>
            {totalRemainingBudgetMoney.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* List of Budgets */}
      <View style={styles.listContainer}>
        {budgets.map((item) => (
          <BudgetProgressCard
            key={item.budget.id}
            progress={item}
            onPress={() => setSelectedBudget(item)}
          />
        ))}
      </View>

      {/* Modals */}
      <CreateBudgetModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={async (input) => {
          const res = await createBudget(input);
          return res.success;
        }}
      />

      <EditBudgetModal
        visible={Boolean(selectedBudget)}
        budgetProgress={selectedBudget}
        onClose={() => setSelectedBudget(null)}
        onUpdate={async (input) => {
          const res = await updateBudget(input);
          return res.success;
        }}
        onDelete={async (id) => {
          const res = await deleteBudget(id);
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
  remainingValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
});
