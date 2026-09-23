import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { CurrencyInput } from '@/core/ui/components/CurrencyInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { CategorySplitBuilder, SplitItem } from '../components/CategorySplitBuilder';
import { Money } from '@/core/domain/money';
import { useEditTransaction } from '../use-edit-transaction';
import { theme } from '@/core/ui/tokens/theme';

export function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    detail,
    accounts,
    categories,
    isLoading,
    error: errorMessage,
    submitUpdate,
  } = useEditTransaction(id);

  // Form states
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState('');
  const [note, setNote] = useState('');
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Prepopulate form when detail loads
  useEffect(() => {
    if (detail) {
      const amountVal = Number(detail.amount.minorUnits / 100n);
      setTotalAmountStr(amountVal.toString());
      setSourceAccountId(detail.sourceAccount?.id ?? '');
      setDestinationAccountId(detail.destinationAccount?.id ?? '');
      setTransactionDate(detail.transactionDate);
      setNote(detail.note ?? '');

      if (detail.type === 'expense' || detail.type === 'income') {
        setSplits(
          detail.items.map((item, idx) => ({
            id: item.id || `split-${idx}`,
            categoryId: item.categoryId,
            amountStr: Number(item.amount.minorUnits / 100n).toString(),
            note: item.note ?? '',
          }))
        );
      }
    }
  }, [detail]);

  const totalAmountNum = parseInt(totalAmountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const handleTotalAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setTotalAmountStr(cleaned);

    if (splits.length === 1) {
      setSplits([{ ...splits[0], amountStr: cleaned }]);
    }
  };

  const allocatedSum = splits.reduce((sum, item) => {
    const num = parseInt(item.amountStr.replace(/[^0-9]/g, ''), 10);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const isExpense = detail?.type === 'expense';
  const isIncome = detail?.type === 'income';
  const isTransfer = detail?.type === 'transfer';

  const isSplitValid =
    isTransfer || (totalAmountNum > 0 && allocatedSum === totalAmountNum && splits.length > 0);

  const isAccountValid = isTransfer
    ? sourceAccountId && destinationAccountId && sourceAccountId !== destinationAccountId
    : isExpense
    ? Boolean(sourceAccountId)
    : Boolean(destinationAccountId);

  const canSubmit = totalAmountNum > 0 && isAccountValid && isSplitValid && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !detail) return;

    setIsSubmitting(true);

    const splitItems = (isExpense || isIncome)
      ? splits.map((s) => ({
          id: s.id.startsWith('initial-') || s.id.startsWith('split-') ? undefined : s.id,
          categoryId: s.categoryId,
          amount: Money.fromDecimal(parseInt(s.amountStr || '0', 10), 'IDR'),
          note: s.note?.trim() || null,
        }))
      : [];

    const result = await submitUpdate({
      id: detail.id,
      amount: Money.fromDecimal(totalAmountNum, 'IDR'),
      transactionDate,
      sourceAccountId: isExpense || isTransfer ? sourceAccountId : null,
      destinationAccountId: isIncome || isTransfer ? destinationAccountId : null,
      items: splitItems,
      note: note.trim() || null,
    });

    setIsSubmitting(false);

    if (result.success) {
      router.back();
    } else {
      Alert.alert('Gagal Mengubah Transaksi', result.error);
    }
  };

  if (isLoading) {
    return (
      <AppScreen style={styles.container}>
        <LoadingState message="Memuat form edit transaksi..." />
      </AppScreen>
    );
  }

  if (errorMessage || !detail) {
    return (
      <AppScreen style={styles.container}>
        <ErrorState
          title="Tidak Dapat Mengedit Transaksi"
          message={errorMessage ?? 'Transaksi tidak ditemukan.'}
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AppText variant="titleLarge">
            Ubah {isExpense ? 'Pengeluaran' : isIncome ? 'Pemasukan' : 'Transfer'}
          </AppText>
          <AppText variant="bodyMuted">
            Koreksi data transaksi dalam batas waktu 7 hari.
          </AppText>
        </View>

        {/* Amount Input */}
        <CurrencyInput
          label="Total Nominal (Rp) *"
          placeholder="0"
          value={totalAmountStr}
          onChangeValue={handleTotalAmountChange}
        />

        {/* Expense: Source Account */}
        {isExpense ? (
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>
              Sumber Dana (Akun) *
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
                    style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                    onPress={() => setSourceAccountId(acc.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${acc.name}, ${typeLabel}`}
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
                      style={[styles.accountName, isSelected && styles.accountNameSelected]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Income: Destination Account */}
        {isIncome ? (
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionLabel}>
              Rekening / Dompet Tujuan *
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
                    style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                    onPress={() => setDestinationAccountId(acc.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${acc.name}, ${typeLabel}`}
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
                      style={[styles.accountName, isSelected && styles.accountNameSelected]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Transfer: Source & Destination Accounts */}
        {isTransfer ? (
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
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                    onPress={() => setSourceAccountId(acc.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <AppText
                      variant="titleMedium"
                      style={[styles.accountName, isSelected && styles.accountNameSelected]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <AppText variant="caption" style={[styles.sectionLabel, { marginTop: theme.spacing.sm }]}>
              Ke Akun (Tujuan) *
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountScroll}
            >
              {accounts.map((acc) => {
                const isSelected = destinationAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.accountCard, isSelected && styles.accountCardSelected]}
                    onPress={() => setDestinationAccountId(acc.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <AppText
                      variant="titleMedium"
                      style={[styles.accountName, isSelected && styles.accountNameSelected]}
                      numberOfLines={1}
                    >
                      {acc.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Category Split Builder for Expense / Income */}
        {(isExpense || isIncome) && categories.length > 0 ? (
          <CategorySplitBuilder
            totalAmount={totalAmountNum}
            categories={categories}
            splits={splits}
            onChangeSplits={setSplits}
          />
        ) : null}

        {/* Date and Notes */}
        <View style={styles.section}>
          <DatePickerInput
            label="Tanggal Transaksi"
            value={transactionDate}
            onChangeDate={setTransactionDate}
          />

          <AppInput
            label="Catatan (Opsional)"
            placeholder="Keterangan transaksi..."
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>

        {/* Submit Actions */}
        <View style={styles.actionButtons}>
          <AppButton
            title="Simpan Perubahan Transaksi"
            variant="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            disabled={!canSubmit}
            accessibilityLabel="Simpan perubahan transaksi"
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
  header: {
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
  accountCardSelected: {
    borderColor: theme.colors.primary[500],
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
  accountNameSelected: {
    color: theme.colors.primary[500],
    fontWeight: '700',
  },
  actionButtons: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
});
