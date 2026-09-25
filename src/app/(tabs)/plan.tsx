import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useScreenFocus } from '@/core/ui/hooks/use-screen-focus';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { BudgetsTab } from '@/features/budgets/presentation/components/BudgetsTab';
import { SavingsGoalsTab } from '@/features/savings-goals/presentation/components/SavingsGoalsTab';
import { DebtsTab } from '@/features/debts/presentation/components/DebtsTab';
import { RecurringTab } from '@/features/recurring-transactions/presentation/components/RecurringTab';
import { useBudgets } from '@/features/budgets/presentation/use-budgets';
import { useSavingsGoals } from '@/features/savings-goals/presentation/use-savings-goals';
import { useDebts } from '@/features/debts/presentation/use-debts';
import { useRecurringTransactions } from '@/features/recurring-transactions/presentation/use-recurring-transactions';
import { theme } from '@/core/ui/tokens/theme';

type PlanTab = 'budgets' | 'savings_goals' | 'debts' | 'recurring';

export default function PlanScreen() {
  const [activeTab, setActiveTab] = useState<PlanTab>('budgets');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const { refresh: refreshBudgets } = useBudgets();
  const { refresh: refreshGoals } = useSavingsGoals();
  const { refresh: refreshDebts } = useDebts();
  const { refresh: refreshRecurring } = useRecurringTransactions();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshBudgets(),
      refreshGoals(),
      refreshDebts(),
      refreshRecurring(),
    ]);
    setIsRefreshing(false);
  };

  // Otomatis refresh saat user membuka tab Rencana Finansial
  useScreenFocus(() => {
    refreshBudgets();
    refreshGoals();
    refreshDebts();
    refreshRecurring();
  }, [refreshBudgets, refreshGoals, refreshDebts, refreshRecurring]);

  return (
    <AppScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <AppText variant="titleLarge" style={styles.headerTitle}>
              Perencanaan Keuangan
            </AppText>
            <AppText variant="caption" style={styles.headerSubtitle}>
              {activeTab === 'budgets'
                ? 'Kelola alokasi batas belanja per kategori'
                : activeTab === 'savings_goals'
                ? 'Capai target impian & tabungan masa depan'
                : activeTab === 'debts'
                ? 'Kelola kewajiban hutang & piutang'
                : 'Otomatisasi pengeluaran & tagihan rutin'}
            </AppText>
          </View>
        </View>

        {/* 4-Way Segmented Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'budgets' && styles.tabButtonActive]}
            onPress={() => setActiveTab('budgets')}
            activeOpacity={0.7}
          >
            <AppText
              variant="caption"
              style={[
                styles.tabButtonText,
                activeTab === 'budgets' && styles.tabButtonTextActive,
              ]}
            >
              📊 Anggaran
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'savings_goals' && styles.tabButtonActive]}
            onPress={() => setActiveTab('savings_goals')}
            activeOpacity={0.7}
          >
            <AppText
              variant="caption"
              style={[
                styles.tabButtonText,
                activeTab === 'savings_goals' && styles.tabButtonTextActive,
              ]}
            >
              🎯 Tabungan
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'debts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('debts')}
            activeOpacity={0.7}
          >
            <AppText
              variant="caption"
              style={[
                styles.tabButtonText,
                activeTab === 'debts' && styles.tabButtonTextActive,
              ]}
            >
              🤝 Hutang
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'recurring' && styles.tabButtonActive]}
            onPress={() => setActiveTab('recurring')}
            activeOpacity={0.7}
          >
            <AppText
              variant="caption"
              style={[
                styles.tabButtonText,
                activeTab === 'recurring' && styles.tabButtonTextActive,
              ]}
            >
              🔄 Berulang
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeTab === 'budgets' && <BudgetsTab isRefreshing={isRefreshing} />}
        {activeTab === 'savings_goals' && <SavingsGoalsTab isRefreshing={isRefreshing} />}
        {activeTab === 'debts' && <DebtsTab isRefreshing={isRefreshing} />}
        {activeTab === 'recurring' && <RecurringTab isRefreshing={isRefreshing} />}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  headerRow: {
    marginBottom: theme.spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    marginBottom: theme.spacing.xxs,
  },
  headerSubtitle: {
    color: theme.colors.neutral[500],
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.xxs,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButtonText: {
    color: theme.colors.neutral[500],
    fontWeight: theme.typography.fontWeights.medium,
  },
  tabButtonTextActive: {
    color: theme.colors.primary[500],
    fontWeight: theme.typography.fontWeights.bold,
  },
});
