import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useScreenFocus } from '@/core/ui/hooks/use-screen-focus';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { useAccounts } from '../use-accounts';
import { AccountWithBalanceDTO } from '../../application/account.usecases';
import { theme } from '@/core/ui/tokens/theme';

export function AccountListScreen() {
  const router = useRouter();
  const { accounts, totalNetWorth, isLoading, error, fetchAccounts } = useAccounts();

  useScreenFocus(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank':
        return 'Bank';
      case 'ewallet':
        return 'E-Wallet';
      case 'cash':
      default:
        return 'Tunai';
    }
  };

  const renderItem = ({ item }: { item: AccountWithBalanceDTO }) => (
    <TouchableOpacity
      style={styles.accountCard}
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: item.account.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Akun ${item.account.name}, Tipe ${getAccountTypeLabel(item.account.type)}, Saldo ${item.balance.formatDisplay()}`}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <View
            style={[
              styles.colorDot,
              { backgroundColor: item.account.color ?? theme.colors.primary[500] },
            ]}
          />
          <View style={styles.cardInfoText}>
            <AppText variant="titleMedium" style={styles.accountName} numberOfLines={1}>
              {item.account.name}
            </AppText>
            <View style={styles.typeBadge}>
              <AppText variant="caption" style={styles.typeBadgeText}>
                {getAccountTypeLabel(item.account.type)}
              </AppText>
            </View>
          </View>
        </View>
        <AppText 
          variant="titleMedium" 
          style={styles.accountBalance}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {item.balance.formatDisplay()}
        </AppText>
      </View>
    </TouchableOpacity>
  );

  return (
    <AppScreen style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppText variant="caption" style={styles.subtitle}>
            TOTAL KEKAYAAN BERSIH
          </AppText>
          <AppText
            variant="display"
            style={styles.totalBalance}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {totalNetWorth.formatDisplay()}
          </AppText>
        </View>
        <AppButton
          title="+ Tambah"
          variant="primary"
          onPress={() => router.push('/accounts/create')}
          accessibilityLabel="Tambah akun baru"
        />
      </View>

      {isLoading && accounts.length === 0 ? (
        <LoadingState message="Memuat daftar akun..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAccounts} />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="Belum Ada Akun"
          description="Tambahkan akun pertama Anda (Tunai, Bank, atau E-Wallet) untuk mulai mencatat keuangan."
          actionTitle="Tambah Akun"
          onAction={() => router.push('/accounts/create')}
        />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.account.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchAccounts}
              colors={[theme.colors.primary[500]]}
            />
          }
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xxs,
  },
  totalBalance: {
    color: theme.colors.primary[500],
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  cardInfoText: {
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  accountName: {
    color: theme.colors.text,
  },
  typeBadge: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.xs,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: theme.colors.textMuted,
  },
  accountBalance: {
    color: theme.colors.primary[500],
    maxWidth: '50%',
    textAlign: 'right',
  },
});
