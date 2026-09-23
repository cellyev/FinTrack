import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { CurrencyInput } from '@/core/ui/components/CurrencyInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { useTransactionCreation } from '../use-transaction-creation';
import { Money } from '@/core/domain/money';
import { theme } from '@/core/ui/tokens/theme';

export function AddTransferScreen() {
  const router = useRouter();
  const { accounts, isLoading, submitTransfer } = useTransactionCreation();

  const [amountStr, setAmountStr] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default source & destination accounts when accounts load
  useEffect(() => {
    if (accounts.length >= 2 && !sourceAccountId && !destinationAccountId) {
      setSourceAccountId(accounts[0].id);
      setDestinationAccountId(accounts[1].id);
    } else if (accounts.length === 1 && !sourceAccountId) {
      setSourceAccountId(accounts[0].id);
    }
  }, [accounts, sourceAccountId, destinationAccountId]);

  const amountNum = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const isSameAccount = Boolean(sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId);
  const canSubmit =
    amountNum > 0 &&
    Boolean(sourceAccountId) &&
    Boolean(destinationAccountId) &&
    !isSameAccount &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    const success = await submitTransfer({
      amount: Money.fromDecimal(amountNum, 'IDR'),
      sourceAccountId,
      destinationAccountId,
      transactionDate,
      note: note.trim() || null,
    });

    setIsSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Gagal', 'Terjadi kesalahan saat memproses transfer.');
    }
  };

  if (isLoading) {
    return (
      <AppScreen style={styles.container}>
        <LoadingState message="Memuat data akun..." />
      </AppScreen>
    );
  }

  if (accounts.length < 2) {
    return (
      <AppScreen style={styles.container}>
        <View style={styles.noAccountContainer}>
          <AppText variant="titleMedium" style={styles.noAccountTitle}>
            Minimal Perlu 2 Akun
          </AppText>
          <AppText variant="bodyMuted" style={styles.noAccountDesc}>
            Transfer memerlukan minimal dua akun berbeda (misalnya: dari Bank BCA ke GoPay).
          </AppText>
          <AppButton
            title="+ Tambah Akun Baru"
            onPress={() => router.push('/accounts/create')}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <AppText variant="titleLarge" style={styles.title}>
          Transfer Antar-Akun
        </AppText>
        <AppText variant="bodyMuted" style={styles.subtitle}>
          Pindahkan saldo dari satu akun ke akun lain tanpa mengubah total kekayaan bersih.
        </AppText>

        {/* Amount Input */}
        <CurrencyInput
          label="Nominal Transfer (Rp) *"
          placeholder="0"
          value={amountStr}
          onChangeValue={(rawStr) => setAmountStr(rawStr)}
        />

        {/* Source Account Selector */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            Dari Akun (Sumber) *
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountScroll}
          >
            {accounts.map((acc) => {
              const isSelected = sourceAccountId === acc.id;
              const typeLabel =
                acc.type === 'bank' ? 'Bank' : acc.type === 'ewallet' ? 'E-Wallet' : 'Tunai';
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountCard,
                    isSelected && styles.sourceSelected,
                  ]}
                  onPress={() => setSourceAccountId(acc.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Sumber ${acc.name}, ${typeLabel}`}
                >
                  <View style={styles.accountCardHeader}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: acc.color ?? theme.colors.primary[500] },
                      ]}
                    />
                    <AppText variant="caption" style={styles.accountTypeBadge}>
                      {typeLabel}
                    </AppText>
                  </View>
                  <AppText
                    variant="titleMedium"
                    style={[styles.accountName, isSelected && styles.sourceNameSelected]}
                    numberOfLines={1}
                  >
                    {acc.name}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Destination Account Selector */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            Ke Akun (Tujuan) *
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountScroll}
          >
            {accounts.map((acc) => {
              const isSelected = destinationAccountId === acc.id;
              const typeLabel =
                acc.type === 'bank' ? 'Bank' : acc.type === 'ewallet' ? 'E-Wallet' : 'Tunai';
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountCard,
                    isSelected && styles.destSelected,
                  ]}
                  onPress={() => setDestinationAccountId(acc.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Tujuan ${acc.name}, ${typeLabel}`}
                >
                  <View style={styles.accountCardHeader}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: acc.color ?? theme.colors.primary[500] },
                      ]}
                    />
                    <AppText variant="caption" style={styles.accountTypeBadge}>
                      {typeLabel}
                    </AppText>
                  </View>
                  <AppText
                    variant="titleMedium"
                    style={[styles.accountName, isSelected && styles.destNameSelected]}
                    numberOfLines={1}
                  >
                    {acc.name}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Same account warning */}
        {isSameAccount ? (
          <View style={styles.warningBox}>
            <AppText variant="caption" style={styles.warningText}>
              ⚠️ Akun sumber dan akun tujuan tidak boleh sama.
            </AppText>
          </View>
        ) : null}

        {/* Optional Details */}
        <View style={styles.section}>
          <DatePickerInput
            label="Tanggal Transfer"
            value={transactionDate}
            onChangeDate={setTransactionDate}
          />

          <AppInput
            label="Catatan (Opsional)"
            placeholder="Keterangan transfer..."
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>

        {/* Submit Actions */}
        <View style={styles.actionButtons}>
          <AppButton
            title={isSubmitting ? 'Memproses...' : 'Simpan Transfer'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel="Simpan transfer"
          />
          <AppButton
            title="Batal"
            variant="secondary"
            onPress={() => router.back()}
            disabled={isSubmitting}
            accessibilityLabel="Batal"
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
  title: {
    color: theme.colors.info[500],
    marginBottom: theme.spacing.xxs,
  },
  subtitle: {
    marginBottom: theme.spacing.md,
  },
  section: {
    marginVertical: theme.spacing.sm,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  accountScroll: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 130,
    minHeight: 64,
  },
  sourceSelected: {
    borderColor: theme.colors.warning[500],
    backgroundColor: theme.colors.surfaceSubtle,
  },
  destSelected: {
    borderColor: theme.colors.info[500],
    backgroundColor: theme.colors.surfaceSubtle,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xxs,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  accountTypeBadge: {
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  accountName: {
    color: theme.colors.text,
  },
  sourceNameSelected: {
    color: theme.colors.warning[500],
    fontWeight: '700',
  },
  destNameSelected: {
    color: theme.colors.info[500],
    fontWeight: '700',
  },
  warningBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.danger[500],
    marginVertical: theme.spacing.xs,
  },
  warningText: {
    color: theme.colors.danger[500],
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  noAccountContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  noAccountTitle: {
    marginBottom: theme.spacing.xs,
  },
  noAccountDesc: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
});
