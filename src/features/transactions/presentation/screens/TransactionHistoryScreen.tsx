import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useScreenFocus } from '@/core/ui/hooks/use-screen-focus';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { TransactionListItem } from '../components/TransactionListItem';
import { TransactionFilterModal } from '../components/TransactionFilterModal';
import { ExportModal } from '../components/ExportModal';
import { useTransactionHistory } from '../use-transaction-history';
import { SyncStatusBadge } from '@/core/sync/presentation/components/SyncStatusBadge';
import { DateGroupedTransactions } from '../../application/transaction.usecases';
import { theme } from '@/core/ui/tokens/theme';

export function TransactionHistoryScreen() {
  const router = useRouter();
  const {
    grouped,
    items,
    accounts,
    categories,
    searchQuery,
    setSearchQuery,
    filter,
    activeFilterCount,
    isLoading,
    isRefreshing,
    error,
    isFilterModalVisible,
    openFilterModal,
    closeFilterModal,
    applyFilter,
    resetFilter,
    refresh,
    reloadLocal,
  } = useTransactionHistory();

  // Muat ulang data riwayat lokal saat tab riwayat dibuka/difokuskan
  useScreenFocus(() => {
    reloadLocal();
  }, [reloadLocal]);

  const [isExportModalVisible, setIsExportModalVisible] = React.useState<boolean>(false);

  const isFiltered = activeFilterCount > 0 || Boolean(searchQuery.trim());

  // Individual filter removal helpers
  const removeTypeFilter = () => applyFilter({ ...filter, type: undefined });
  const removeAccountFilter = () => applyFilter({ ...filter, accountId: undefined });
  const removeCategoryFilter = () => applyFilter({ ...filter, categoryId: undefined });
  const removeDateFilter = () => applyFilter({ ...filter, datePreset: 'all' });
  const removeMinAmountFilter = () => applyFilter({ ...filter, minAmount: undefined });
  const removeMaxAmountFilter = () => applyFilter({ ...filter, maxAmount: undefined });

  const activeAccount = accounts.find((a) => a.id === filter.accountId);
  const activeCategory = categories.find((c) => c.id === filter.categoryId);

  const renderDateGroup = ({ item }: { item: DateGroupedTransactions }) => (
    <View style={styles.groupContainer}>
      <AppText variant="caption" style={styles.dateHeader}>
        {item.dateHeader}
      </AppText>
      {item.transactions.map((tx) => (
        <TransactionListItem
          key={tx.id}
          item={tx}
          onPress={() => router.push({ pathname: '/transactions/[id]', params: { id: tx.id } })}
        />
      ))}
    </View>
  );

  return (
    <AppScreen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleWrap}>
            <AppText variant="titleLarge">Riwayat Transaksi</AppText>
            <AppText variant="bodyMuted" style={styles.subtitleText}>Pantau catatan finansial Anda.</AppText>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.exportHeaderBtn}
              onPress={() => setIsExportModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Ekspor data transaksi"
            >
              <Ionicons name="download-outline" size={20} color={theme.colors.neutral[500]} />
            </TouchableOpacity>
            <SyncStatusBadge variant="minimal" />
          </View>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchInputWrap}>
          <AppInput
            placeholder="Cari transaksi, akun, kategori..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Kolom pencarian transaksi"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Hapus kata kunci pencarian"
            >
              <AppText style={styles.clearSearchIcon}>✕</AppText>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={openFilterModal}
          accessibilityRole="button"
          accessibilityLabel={`Filter transaksi. ${activeFilterCount} filter aktif.`}
        >
          <AppText variant="body" style={styles.filterIcon}>
            ⚙️
          </AppText>
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <AppText variant="caption" style={styles.filterBadgeText}>
                {activeFilterCount}
              </AppText>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipsScroll}>
          <View style={styles.activeChipsRow}>
            {filter.type && (
              <TouchableOpacity style={styles.activeChip} onPress={removeTypeFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Tipe: {filter.type} ✕
                </AppText>
              </TouchableOpacity>
            )}
            {activeAccount && (
              <TouchableOpacity style={styles.activeChip} onPress={removeAccountFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Akun: {activeAccount.name} ✕
                </AppText>
              </TouchableOpacity>
            )}
            {activeCategory && (
              <TouchableOpacity style={styles.activeChip} onPress={removeCategoryFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Kategori: {activeCategory.name} ✕
                </AppText>
              </TouchableOpacity>
            )}
            {filter.datePreset !== 'all' && (
              <TouchableOpacity style={styles.activeChip} onPress={removeDateFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Waktu: {filter.datePreset} ✕
                </AppText>
              </TouchableOpacity>
            )}
            {filter.minAmount && (
              <TouchableOpacity style={styles.activeChip} onPress={removeMinAmountFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Min: {filter.minAmount.formatDisplay()} ✕
                </AppText>
              </TouchableOpacity>
            )}
            {filter.maxAmount && (
              <TouchableOpacity style={styles.activeChip} onPress={removeMaxAmountFilter}>
                <AppText variant="caption" style={styles.activeChipText}>
                  Maks: {filter.maxAmount.formatDisplay()} ✕
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Active Filter Summary Bar */}
      {isFiltered ? (
        <View style={styles.activeFilterRow}>
          <AppText variant="caption" style={styles.filterSummaryText}>
            Menampilkan {items.length} hasil
          </AppText>
          <TouchableOpacity onPress={resetFilter} accessibilityRole="button" accessibilityLabel="Hapus semua filter">
            <AppText variant="caption" style={styles.clearFilterText}>
              Reset Semua
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Content Feed */}
      {isLoading && !isRefreshing && items.length === 0 ? (
        <LoadingState message="Memuat riwayat transaksi..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title="Transaksi Tidak Ditemukan"
            description="Tidak ada transaksi yang cocok dengan kata kunci pencarian atau filter yang Anda gunakan."
            actionTitle="Reset Filter"
            onAction={resetFilter}
          />
        ) : (
          <EmptyState
            title="Belum Ada Transaksi"
            description="Mulai catat pemasukan, pengeluaran, atau transfer untuk melihat riwayat aktivitas di sini."
            actionTitle="+ Catat Transaksi"
            onAction={() => router.push('/transactions')}
          />
        )
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(group) => group.rawDate}
          renderItem={renderDateGroup}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={[theme.colors.primary[500]]}
            />
          }
        />
      )}

      {/* Filter Modal */}
      <TransactionFilterModal
        visible={isFilterModalVisible}
        onClose={closeFilterModal}
        accounts={accounts}
        categories={categories}
        currentFilter={filter}
        onApply={applyFilter}
        onReset={resetFilter}
      />

      {/* Export Modal */}
      <ExportModal
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
        filter={filter}
        searchQuery={searchQuery}
        totalFilteredCount={items.length}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    paddingVertical: theme.spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  subtitleText: {
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  exportHeaderBtn: {
    padding: theme.spacing.xxs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
  },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
    padding: 4,
  },
  clearSearchIcon: {
    color: theme.colors.neutral[400],
    fontSize: 14,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.surfaceSubtle,
  },
  filterIcon: {
    fontSize: 20,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary[600],
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 10,
  },
  activeChipsScroll: {
    marginVertical: theme.spacing.xxs,
  },
  activeChipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
  },
  activeChip: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[100],
    borderWidth: 1,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  activeChipText: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.medium,
  },
  activeFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxs,
    marginBottom: theme.spacing.xs,
  },
  filterSummaryText: {
    color: theme.colors.textMuted,
  },
  clearFilterText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  groupContainer: {
    marginBottom: theme.spacing.md,
  },
  dateHeader: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
});
