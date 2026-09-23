import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { theme } from '@/core/ui/tokens/theme';

export function TransactionTypePickerScreen() {
  const router = useRouter();

  return (
    <AppScreen style={styles.container}>
      <View style={styles.content}>
        <AppText variant="titleLarge" style={styles.title}>
          Catat Transaksi
        </AppText>
        <AppText variant="bodyMuted" style={styles.subtitle}>
          Pilih jenis transaksi finansial yang ingin Anda catat:
        </AppText>

        <View style={styles.cardsContainer}>
          {/* Expense Card */}
          <TouchableOpacity
            style={[styles.card, styles.expenseCard]}
            onPress={() => router.push('/transactions/expense')}
            accessibilityRole="button"
            accessibilityLabel="Catat Pengeluaran. Uang keluar untuk belanja, makan, atau tagihan."
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, styles.expenseIcon]}>
                <AppText variant="titleMedium" style={styles.expenseSymbol}>
                  💸
                </AppText>
              </View>
              <View style={styles.cardInfo}>
                <AppText variant="titleMedium" style={styles.expenseTitle}>
                  Pengeluaran (Expense)
                </AppText>
                <AppText variant="caption">
                  Uang keluar dari akun untuk belanja, makanan, tagihan, dll.
                </AppText>
              </View>
            </View>
          </TouchableOpacity>

          {/* Income Card */}
          <TouchableOpacity
            style={[styles.card, styles.incomeCard]}
            onPress={() => router.push('/transactions/income')}
            accessibilityRole="button"
            accessibilityLabel="Catat Pemasukan. Uang masuk dari gaji, bonus, atau hasil usaha."
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, styles.incomeIcon]}>
                <AppText variant="titleMedium" style={styles.incomeSymbol}>
                  💰
                </AppText>
              </View>
              <View style={styles.cardInfo}>
                <AppText variant="titleMedium" style={styles.incomeTitle}>
                  Pemasukan (Income)
                </AppText>
                <AppText variant="caption">
                  Uang masuk ke akun dari gaji bulanan, bonus, atau hadiah.
                </AppText>
              </View>
            </View>
          </TouchableOpacity>

          {/* Transfer Card */}
          <TouchableOpacity
            style={[styles.card, styles.transferCard]}
            onPress={() => router.push('/transactions/transfer')}
            accessibilityRole="button"
            accessibilityLabel="Catat Transfer. Pindahkan uang antar-akun."
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, styles.transferIcon]}>
                <AppText variant="titleMedium" style={styles.transferSymbol}>
                  🔄
                </AppText>
              </View>
              <View style={styles.cardInfo}>
                <AppText variant="titleMedium" style={styles.transferTitle}>
                  Transfer Antar-Akun
                </AppText>
                <AppText variant="caption">
                  Pindahkan saldo antar-rekening/e-wallet tanpa mengubah total kekayaan.
                </AppText>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomAction}>
          <AppButton
            title="Tutup"
            variant="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Tutup modal pencatatan transaksi"
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: theme.spacing.xxs,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 76,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger[500],
  },
  expenseIcon: {
    backgroundColor: theme.colors.surfaceSubtle,
  },
  expenseSymbol: {
    fontSize: 22,
  },
  expenseTitle: {
    color: theme.colors.danger[500],
    marginBottom: 2,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success[500],
  },
  incomeIcon: {
    backgroundColor: theme.colors.surfaceSubtle,
  },
  incomeSymbol: {
    fontSize: 22,
  },
  incomeTitle: {
    color: theme.colors.success[500],
    marginBottom: 2,
  },
  transferCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info[500],
  },
  transferIcon: {
    backgroundColor: theme.colors.surfaceSubtle,
  },
  transferSymbol: {
    fontSize: 22,
  },
  transferTitle: {
    color: theme.colors.info[500],
    marginBottom: 2,
  },
  bottomAction: {
    marginTop: theme.spacing.md,
  },
});
