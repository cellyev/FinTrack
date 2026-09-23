import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useScreenFocus } from '@/core/ui/hooks/use-screen-focus';
import { appEvents } from '@/core/events/app-events';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { TransactionListItem } from '@/features/transactions/presentation/components/TransactionListItem';
import { SyncStatusBadge } from '@/core/sync/presentation/components/SyncStatusBadge';
import { QuickAddModal, QuickAddFab } from '@/core/ui/components/QuickAddModal';
import { Feather } from '@expo/vector-icons';
import { useSyncStatus } from '@/core/sync/presentation/use-sync-status';
import { useAuthStore } from '@/features/auth/presentation/auth-store';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useBudgets } from '@/features/budgets/presentation/use-budgets';
import { BudgetProgressCard } from '@/features/budgets/presentation/components/BudgetProgressCard';
import { useSavingsGoals } from '@/features/savings-goals/presentation/use-savings-goals';
import { SavingsGoalProgressCard } from '@/features/savings-goals/presentation/components/SavingsGoalProgressCard';
import { useDebts } from '@/features/debts/presentation/use-debts';
import { DebtCard } from '@/features/debts/presentation/components/DebtCard';
import { useRecurringTransactions } from '@/features/recurring-transactions/presentation/use-recurring-transactions';
import { RecurringTransactionCard } from '@/features/recurring-transactions/presentation/components/RecurringTransactionCard';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import {
  GetRecentTransactionsUseCase,
  TransactionListItemDTO,
} from '@/features/transactions/application/transaction.usecases';
import { AnalyticsDashboardSection } from '@/features/analytics/presentation/components/AnalyticsDashboardSection';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

const txRepo = new SqliteTransactionRepository();
const accRepo = new SqliteAccountRepository();
const catRepo = new SqliteCategoryRepository();
const getRecentTxUseCase = new GetRecentTransactionsUseCase(txRepo, accRepo, catRepo);

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { accounts, totalNetWorth, fetchAccounts } = useAccounts();
  const { budgets, refresh: refreshBudgets } = useBudgets();
  const { goals, refresh: refreshGoals } = useSavingsGoals();
  const { debts, refresh: refreshDebts } = useDebts();
  const { recurringList, refresh: refreshRecurring, processDueOccurrences } = useRecurringTransactions();
  const { syncNow, isSyncing } = useSyncStatus();
  const [recentTransactions, setRecentTransactions] = useState<TransactionListItemDTO[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [quickAddVisible, setQuickAddVisible] = useState<boolean>(false);

  const userName = session?.user?.fullName || session?.user?.email?.split('@')[0] || 'Pengguna';

  const loadRecentTransactions = useCallback(async () => {
    if (!session?.user?.id) return;
    const result = await getRecentTxUseCase.execute(session.user.id, 5);
    if (result.success) {
      setRecentTransactions(result.data);
    }
  }, [session?.user?.id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncNow();
    await Promise.all([
      fetchAccounts(),
      loadRecentTransactions(),
      refreshBudgets(),
      refreshGoals(),
      refreshDebts(),
      refreshRecurring(),
    ]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchAccounts();
    loadRecentTransactions();

    // Otomatis refresh semua data di HomeScreen ketika ada data yang ditambah, diupdate, atau dihapus
    const unsubscribe = appEvents.subscribe(
      ['data_invalidated', 'transactions_changed', 'budgets_changed', 'accounts_changed'],
      () => {
        fetchAccounts();
        loadRecentTransactions();
        refreshBudgets();
        refreshGoals();
        refreshDebts();
        refreshRecurring();
      }
    );

    return unsubscribe;
  }, [
    fetchAccounts,
    loadRecentTransactions,
    refreshBudgets,
    refreshGoals,
    refreshDebts,
    refreshRecurring,
  ]);

  // Otomatis refresh saat user kembali ke tab Home
  useScreenFocus(() => {
    fetchAccounts();
    loadRecentTransactions();
  }, [fetchAccounts, loadRecentTransactions]);

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || isSyncing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerGreeting}>
            <AppText variant="titleLarge">Halo, {userName} 👋</AppText>
            <View style={styles.subtitleRow}>
              <AppText variant="bodyMuted" style={styles.subtitleText}>
                FinTrack siap mencatat keuanganmu.
              </AppText>
              <SyncStatusBadge variant="minimal" />
            </View>
          </View>
        </View>

        {/* Total Net Worth Card */}
        <View style={styles.card}>
          <AppText variant="caption">TOTAL KEKAYAAN BERSIH</AppText>
          <AppText variant="display" style={styles.balanceText}>
            {totalNetWorth.formatDisplay()}
          </AppText>
          <AppText variant="caption" style={styles.helperNotice}>
            Dihitung derivatif dari seluruh transaksi ledger aktif.
          </AppText>
        </View>

        {/* Quick Transaction Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.expenseAction]}
            onPress={() => router.push('/transactions/expense')}
            accessibilityRole="button"
            accessibilityLabel="Catat Pengeluaran Baru"
          >
            <View style={styles.quickActionIconWrap}>
              <Feather name="arrow-down-left" size={22} color={theme.colors.danger[500]} />
            </View>
            <AppText variant="caption" style={styles.expenseActionText}>
              Pengeluaran
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.incomeAction]}
            onPress={() => router.push('/transactions/income')}
            accessibilityRole="button"
            accessibilityLabel="Catat Pemasukan Baru"
          >
            <View style={styles.quickActionIconWrap}>
              <Feather name="arrow-up-right" size={22} color={theme.colors.success[500]} />
            </View>
            <AppText variant="caption" style={styles.incomeActionText}>
              Pemasukan
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.transferAction]}
            onPress={() => router.push('/transactions/transfer')}
            accessibilityRole="button"
            accessibilityLabel="Catat Transfer Antar-Akun"
          >
            <View style={styles.quickActionIconWrap}>
              <Feather name="repeat" size={22} color={theme.colors.info[500]} />
            </View>
            <AppText variant="caption" style={styles.transferActionText}>
              Transfer
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Phase 4B — Financial Insights & Visual Analytics Section */}
        <AnalyticsDashboardSection />

        {/* Accounts Summary Section */}
        <View style={styles.sectionHeader}>
          <AppText variant="titleMedium">Akun Saya ({accounts.length})</AppText>
          <TouchableOpacity
            onPress={() => router.push('/accounts')}
            accessibilityRole="button"
            accessibilityLabel="Lihat semua akun"
          >
            <AppText variant="body" style={styles.seeAllText}>
              Lihat Semua
            </AppText>
          </TouchableOpacity>
        </View>

        {accounts.length === 0 ? (
          <View style={styles.emptyAccountsCard}>
            <EmptyState
              title="Belum Ada Akun"
              description="Tambahkan akun pertama Anda (Tunai, Bank, atau E-Wallet) untuk mulai mencatat keuangan."
              actionTitle="+ Tambah Akun"
              onAction={() => router.push('/accounts/create')}
            />
          </View>
        ) : (
          <View style={styles.accountsGrid}>
            {accounts.slice(0, 3).map((item) => (
              <TouchableOpacity
                key={item.account.id}
                style={styles.accountCard}
                onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: item.account.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Akun ${item.account.name}, Saldo ${item.balance.formatDisplay()}`}
                activeOpacity={0.7}
              >
                <View style={styles.accountCardHeader}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: item.account.color ?? colors.primary[500] },
                    ]}
                  />
                  <AppText variant="caption" style={styles.accountTypeBadge}>
                    {item.account.type === 'bank' ? 'Bank' : item.account.type === 'ewallet' ? 'E-Wallet' : 'Tunai'}
                  </AppText>
                </View>
                <AppText variant="body" style={styles.accountCardName} numberOfLines={1}>
                  {item.account.name}
                </AppText>
                <AppText variant="titleMedium" style={styles.accountCardBalance}>
                  {item.balance.formatDisplay()}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Budget Overview Section */}
        {budgets.length > 0 ? (
          <View style={styles.budgetSection}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleMedium">Pantauan Anggaran</AppText>
              <TouchableOpacity
                onPress={() => router.push('/plan')}
                accessibilityRole="button"
                accessibilityLabel="Lihat rencana anggaran"
              >
                <AppText variant="body" style={styles.seeAllText}>
                  Lihat Semua
                </AppText>
              </TouchableOpacity>
            </View>
            <View style={styles.budgetListContainer}>
              {budgets.slice(0, 2).map((item) => (
                <BudgetProgressCard
                  key={item.budget.id}
                  progress={item}
                  onPress={() => router.push('/plan')}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Savings Goals Overview Section */}
        {goals.length > 0 ? (
          <View style={styles.budgetSection}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleMedium">Target Tabungan</AppText>
              <TouchableOpacity
                onPress={() => router.push('/plan')}
                accessibilityRole="button"
                accessibilityLabel="Lihat target tabungan"
              >
                <AppText variant="body" style={styles.seeAllText}>
                  Lihat Semua
                </AppText>
              </TouchableOpacity>
            </View>
            <View style={styles.budgetListContainer}>
              {goals.slice(0, 2).map((item) => (
                <SavingsGoalProgressCard
                  key={item.goal.id}
                  progress={item}
                  onPress={() => router.push('/plan')}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Debts & Receivables Overview Section */}
        {debts.filter((d) => !d.isSettled).length > 0 ? (
          <View style={styles.budgetSection}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleMedium">Hutang & Piutang</AppText>
              <TouchableOpacity
                onPress={() => router.push('/plan')}
                accessibilityRole="button"
                accessibilityLabel="Lihat hutang dan piutang"
              >
                <AppText variant="body" style={styles.seeAllText}>
                  Lihat Semua
                </AppText>
              </TouchableOpacity>
            </View>
            <View style={styles.budgetListContainer}>
              {debts
                .filter((d) => !d.isSettled)
                .slice(0, 2)
                .map((item) => (
                  <DebtCard
                    key={item.id}
                    debt={item}
                    onPress={() => router.push('/plan')}
                  />
                ))}
            </View>
          </View>
        ) : null}

        {/* Recurring & Scheduled Transactions Overview Section */}
        {recurringList.filter((r) => r.isActive).length > 0 ? (
          <View style={styles.budgetSection}>
            <View style={styles.sectionHeader}>
              <AppText variant="titleMedium">Jadwal & Tagihan Rutin</AppText>
              <TouchableOpacity
                onPress={() => router.push('/plan')}
                accessibilityRole="button"
                accessibilityLabel="Lihat jadwal transaksi rutin"
              >
                <AppText variant="body" style={styles.seeAllText}>
                  Lihat Semua
                </AppText>
              </TouchableOpacity>
            </View>
            <View style={styles.budgetListContainer}>
              {recurringList
                .filter((r) => r.isActive)
                .slice(0, 2)
                .map((item) => (
                  <RecurringTransactionCard
                    key={item.id}
                    recurring={item}
                    onPress={() => router.push('/plan')}
                    onProcessNow={async () => {
                      await processDueOccurrences(undefined, item.id);
                    }}
                  />
                ))}
            </View>
          </View>
        ) : null}

        {/* Recent Transactions Section */}
        <View style={styles.sectionHeader}>
          <AppText variant="titleMedium">Transaksi Terbaru</AppText>
          <TouchableOpacity
            onPress={() => router.push('/history')}
            accessibilityRole="button"
            accessibilityLabel="Lihat semua riwayat transaksi"
          >
            <AppText variant="body" style={styles.seeAllText}>
              Lihat Semua
            </AppText>
          </TouchableOpacity>
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.emptyRecentCard}>
            <AppText variant="bodyMuted" style={styles.emptyRecentText}>
              Belum ada transaksi terbaru yang dicatat.
            </AppText>
          </View>
        ) : (
          <View style={styles.recentListContainer}>
            {recentTransactions.map((tx) => (
              <TransactionListItem
                key={tx.id}
                item={tx}
                onPress={() => router.push({ pathname: '/transactions/[id]', params: { id: tx.id } })}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomCta}>
          <AppButton
            title="Kelola Semua Akun"
            variant="secondary"
            onPress={() => router.push('/accounts')}
          />
        </View>
      </ScrollView>

      {/* Floating Action Button for Quick-Add */}
      <QuickAddFab onPress={() => setQuickAddVisible(true)} />

      {/* Quick Add Modal */}
      <QuickAddModal
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    flexGrow: 1,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  headerGreeting: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  subtitleText: {
    flexShrink: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  balanceText: {
    color: theme.colors.primary[500],
    marginVertical: theme.spacing.xs,
  },
  helperNotice: {
    color: theme.colors.neutral[500],
    marginTop: theme.spacing.xs,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
  },
  quickActionIconWrap: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseAction: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.danger[500],
  },
  expenseActionText: {
    color: theme.colors.danger[500],
    fontWeight: '600',
  },
  incomeAction: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[500],
  },
  incomeActionText: {
    color: theme.colors.success[500],
    fontWeight: '600',
  },
  transferAction: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.info[500],
  },
  transferActionText: {
    color: theme.colors.info[500],
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  seeAllText: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  emptyAccountsCard: {
    backgroundColor: colors.neutral[900],
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[700],
    marginBottom: spacing.md,
  },
  accountsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  accountTypeBadge: {
    color: colors.neutral[400],
    textTransform: 'uppercase',
  },
  accountCardName: {
    color: colors.neutral[50],
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  accountCardBalance: {
    color: colors.primary[500],
  },
  emptyRecentCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyRecentText: {
    color: theme.colors.textMuted,
  },
  recentListContainer: {
    marginBottom: spacing.md,
  },
  budgetSection: {
    marginBottom: spacing.md,
  },
  budgetListContainer: {
    gap: spacing.xs,
  },
  bottomCta: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});
