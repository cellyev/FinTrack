import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { TransactionListItem } from '@/features/transactions/presentation/components/TransactionListItem';
import { useAccounts } from '../use-accounts';
import { useAccountTransactions } from '../use-account-transactions';
import { theme } from '@/core/ui/tokens/theme';

const PRESET_COLORS = [
  '#0055A5',
  '#E60012',
  '#008A00',
  '#F58220',
  '#7A3E9D',
  '#118EEA',
  '#4A5568',
];

export function AccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, updateAccount, deleteAccount } = useAccounts();
  const {
    transactions,
    isLoading: isTxLoading,
    error: txError,
  } = useAccountTransactions(id);

  const accountItem = accounts.find((a) => a.account.id === id);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (accountItem) {
      setName(accountItem.account.name);
      if (accountItem.account.color) {
        setSelectedColor(accountItem.account.color);
      }
    }
  }, [accountItem]);

  if (!accountItem) {
    return (
      <AppScreen style={styles.container}>
        <ErrorState
          title="Akun Tidak Ditemukan"
          message="Akun tidak ditemukan atau telah dihapus."
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank':
        return 'Rekening Bank';
      case 'ewallet':
        return 'E-Wallet';
      case 'cash':
      default:
        return 'Dompet Tunai';
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      setNameError('Nama akun wajib diisi');
      return;
    }

    setIsSubmitting(true);
    const success = await updateAccount({
      id: accountItem.account.id,
      name: name.trim(),
      color: selectedColor,
    });
    setIsSubmitting(false);

    if (success) {
      Alert.alert('Sukses', 'Perubahan akun berhasil disimpan.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memperbarui akun.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus / Arsipkan Akun',
      `Apakah Anda yakin ingin menghapus akun "${accountItem.account.name}"? Riwayat transaksi lama akan tetap tersimpan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            const success = await deleteAccount(accountItem.account.id);
            setIsSubmitting(false);

            if (success) {
              router.back();
            } else {
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus akun.');
            }
          },
        },
      ]
    );
  };

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Account Info Header */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: accountItem.account.color ?? theme.colors.primary[500] },
              ]}
            />
            <AppText variant="caption" style={styles.typeBadge}>
              {getAccountTypeLabel(accountItem.account.type)}
            </AppText>
          </View>
          <AppText variant="display" style={styles.headerBalance}>
            {accountItem.balance.formatDisplay()}
          </AppText>
          <AppText variant="caption" style={styles.balanceExplainer}>
            Saldo terhitung otomatis dari ledger transaksi dan tidak dapat diedit secara manual.
          </AppText>
        </View>

        {/* Account Transactions Stream */}
        <View style={styles.section}>
          <AppText variant="titleMedium" style={styles.sectionTitle}>
            Riwayat Transaksi Akun
          </AppText>

          {isTxLoading ? (
            <LoadingState message="Memuat transaksi akun..." />
          ) : txError ? (
            <ErrorState message={txError} />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="Belum Ada Transaksi"
              description="Belum ada catatan mutasi uang pada akun ini."
            />
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <TransactionListItem
                  key={tx.id}
                  item={tx}
                  onPress={() => router.push(`/transactions/${tx.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Edit Metadata Section */}
        <View style={styles.section}>
          <AppText variant="titleMedium" style={styles.sectionTitle}>
            Ubah Informasi Akun
          </AppText>

          <AppInput
            label="Nama Akun"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(undefined);
            }}
            error={nameError}
            maxLength={80}
          />

          <View style={styles.colorSection}>
            <AppText variant="caption" style={styles.label}>
              Warna Indikator
            </AppText>
            <View style={styles.colorPalette}>
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      isSelected && styles.colorCircleSelected,
                    ]}
                    onPress={() => setSelectedColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Warna ${c}`}
                  />
                );
              })}
            </View>
          </View>

          <AppButton
            title={isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            onPress={handleUpdate}
            disabled={isSubmitting}
            style={styles.saveButton}
          />
        </View>

        {/* Danger Zone: Archive / Soft Delete */}
        <View style={styles.dangerSection}>
          <AppText variant="titleMedium" style={styles.dangerTitle}>
            Zona Bahaya
          </AppText>
          <AppText variant="bodyMuted" style={styles.dangerDescription}>
            Menghapus akun akan menyembunyikannya dari daftar akun aktif. Transaksi masa lalu tidak akan hilang dari riwayat.
          </AppText>
          <AppButton
            title="Hapus / Arsipkan Akun"
            variant="danger"
            onPress={handleDelete}
            disabled={isSubmitting}
          />
        </View>
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
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.xs,
  },
  typeBadge: {
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerBalance: {
    color: theme.colors.primary[500],
    marginVertical: theme.spacing.xxs,
  },
  balanceExplainer: {
    color: theme.colors.neutral[400],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  txList: {
    gap: theme.spacing.xs,
  },
  colorSection: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: theme.colors.text,
    transform: [{ scale: 1.15 }],
  },
  saveButton: {
    marginTop: theme.spacing.xs,
  },
  dangerSection: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dangerTitle: {
    color: theme.colors.danger[500],
    marginBottom: theme.spacing.xxs,
  },
  dangerDescription: {
    marginBottom: theme.spacing.md,
  },
});
