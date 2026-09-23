import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { SavingsGoalProgressCard } from './SavingsGoalProgressCard';
import { CreateSavingsGoalModal } from '../screens/CreateSavingsGoalModal';
import { EditSavingsGoalModal } from '../screens/EditSavingsGoalModal';
import { SavingsGoalDetailModal } from '../screens/SavingsGoalDetailModal';
import { SavingsGoalProgress } from '../../domain/savings-goal-progress';
import { useSavingsGoals } from '../use-savings-goals';
import { Money } from '@/core/domain/money';
import { theme } from '@/core/ui/tokens/theme';

export interface SavingsGoalsTabProps {
  isRefreshing?: boolean;
}

export const SavingsGoalsTab: React.FC<SavingsGoalsTabProps> = ({ isRefreshing = false }) => {
  const {
    goals,
    isLoading,
    error,
    refresh,
    createGoal,
    updateGoal,
    deleteGoal,
  } = useSavingsGoals();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailGoal, setDetailGoal] = useState<SavingsGoalProgress | null>(null);
  const [editGoal, setEditGoal] = useState<SavingsGoalProgress | null>(null);

  const totalGoalTargetMinor = goals.reduce(
    (sum, g) => sum + Number(g.targetAmount.minorUnits),
    0
  );
  const totalGoalCurrentMinor = goals.reduce(
    (sum, g) => sum + Number(g.currentAmount.minorUnits),
    0
  );
  const totalGoalRemainingMinor = Math.max(0, totalGoalTargetMinor - totalGoalCurrentMinor);

  const totalGoalTargetMoney = Money.fromMinorUnits(totalGoalTargetMinor, 'IDR');
  const totalGoalCurrentMoney = Money.fromMinorUnits(totalGoalCurrentMinor, 'IDR');
  const totalGoalRemainingMoney = Money.fromMinorUnits(totalGoalRemainingMinor, 'IDR');

  if (isLoading && !isRefreshing) {
    return <LoadingState message="Memuat target tabungan..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  if (goals.length === 0) {
    return (
      <>
        <EmptyState
          title="Belum Ada Target Tabungan"
          description="Tentukan tujuan tabungan seperti Dana Darurat, Gadget Baru, atau Liburan untuk memantau progres finansial."
          actionTitle="+ Buat Target Tabungan"
          onAction={() => setCreateModalVisible(true)}
        />
        <CreateSavingsGoalModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSubmit={async (input) => {
            const res = await createGoal(input);
            return res.success;
          }}
        />
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* Savings Goals Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Total Target
          </AppText>
          <AppText variant="body" style={styles.summaryValue}>
            {totalGoalTargetMoney.formatDisplay()}
          </AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Terkumpul
          </AppText>
          <AppText variant="body" style={styles.currentSavingsValue}>
            {totalGoalCurrentMoney.formatDisplay()}
          </AppText>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <AppText variant="caption" style={styles.summaryLabel}>
            Kurang
          </AppText>
          <AppText variant="body" style={styles.remainingValue}>
            {totalGoalRemainingMoney.formatDisplay()}
          </AppText>
        </View>
      </View>

      {/* List of Savings Goals */}
      <View style={styles.listContainer}>
        {goals.map((item) => (
          <SavingsGoalProgressCard
            key={item.goal.id}
            progress={item}
            onPress={() => setDetailGoal(item)}
          />
        ))}
      </View>

      {/* Modals */}
      <SavingsGoalDetailModal
        visible={Boolean(detailGoal)}
        goalProgress={detailGoal}
        onClose={() => setDetailGoal(null)}
        onEditPress={(g) => setEditGoal(g)}
        onDeletePress={async (id) => {
          await deleteGoal(id);
        }}
      />

      <CreateSavingsGoalModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={async (input) => {
          const res = await createGoal(input);
          return res.success;
        }}
      />

      <EditSavingsGoalModal
        visible={Boolean(editGoal)}
        goalProgress={editGoal}
        onClose={() => setEditGoal(null)}
        onSubmit={async (input) => {
          const res = await updateGoal(input);
          return res.success;
        }}
        onDelete={async (id) => {
          const res = await deleteGoal(id);
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
  currentSavingsValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.primary[600],
  },
  remainingValue: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.neutral[700],
  },
  listContainer: {
    gap: theme.spacing.sm,
  },
});
