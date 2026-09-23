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
import { CategorySplitBuilder, SplitItem } from '../components/CategorySplitBuilder';
import { useTransactionCreation } from '../use-transaction-creation';
import { Money } from '@/core/domain/money';
import { theme } from '@/core/ui/tokens/theme';

export function AddIncomeScreen() {
  const router = useRouter();
  const { accounts, categories, isLoading, submitIncome } = useTransactionCreation('income');

  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize initial split when categories load
  useEffect(() => {
    if (categories.length > 0 && splits.length === 0) {
      setSplits([
        {
          id: 'initial-income-split-1',
          categoryId: categories[0].id,
          amountStr: totalAmountStr,
        },
      ]);
    }
  }, [categories, splits.length, totalAmountStr]);

  // Set default account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const totalAmountNum = parseInt(totalAmountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const handleTotalAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setTotalAmountStr(cleaned);

    // If only 1 split exists, auto-sync its amount
    if (splits.length === 1) {
      setSplits([{ ...splits[0], amountStr: cleaned }]);
    }
  };

  const allocatedSum = splits.reduce((sum, item) => {
    const num = parseInt(item.amountStr.replace(/[^0-9]/g, ''), 10);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const isSplitValid = totalAmountNum > 0 && allocatedSum === totalAmountNum;
  const canSubmit = totalAmountNum > 0 && selectedAccountId && isSplitValid && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    const splitItems = splits.map((s) => ({
      categoryId: s.categoryId,
      amount: Money.fromDecimal(parseInt(s.amountStr || '0', 10), 'IDR'),
      note: s.note,
    }));

    const success = await submitIncome({
      amount: Money.fromDecimal(totalAmountNum, 'IDR'),
      destinationAccountId: selectedAccountId,
      transactionDate,
      items: splitItems,
      note: note.trim() || null,
    });

    setIsSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Gagal', 'Terjadi kesalahan saat mencatat pemasukan.');
    }
  };

  if (isLoading) {
    return (
      <AppScreen style={styles.container}>
        <LoadingState message="Memuat data akun dan kategori..." />
      </AppScreen>
    );
  }

  if (accounts.length === 0) {
    return (
      <AppScreen style={styles.container}>
        <View style={styles.noAccountContainer}>
          <AppText variant="titleMedium" style={styles.noAccountTitle}>
            Belum Ada Akun Aktif
          </AppText>
          <AppText variant="bodyMuted" style={styles.noAccountDesc}>
            Anda harus membuat akun terlebih dahulu untuk menerima pemasukan uang.
          </AppText>
          <AppButton
            title="+ Buat Akun Baru"
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
          Catat Pemasukan
        </AppText>
        <AppText variant="bodyMuted" style={styles.subtitle}>
          Uang masuk ke akun Anda (Gaji, bonus, hasil usaha, atau hadiah).
        </AppText>

        {/* Amount Input */}
        <CurrencyInput
          label="Total Nominal Pemasukan (Rp) *"
          placeholder="0"
          value={totalAmountStr}
          onChangeValue={handleTotalAmountChange}
        />

        {/* Destination Account Selector */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            Rekening / Dompet Tujuan (Akun) *
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountScroll}
          >
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const typeLabel =
                acc.type === 'bank' ? 'Bank' : acc.type === 'ewallet' ? 'E-Wallet' : 'Tunai';
              return (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountCard,
                    isSelected && styles.accountCardSelected,
                  ]}
                  onPress={() => setSelectedAccountId(acc.id)}
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

        {/* Category Split Builder */}
        <CategorySplitBuilder
          totalAmount={totalAmountNum}
          categories={categories}
          splits={splits}
          onChangeSplits={setSplits}
        />

        {/* Optional Details */}
        <View style={styles.section}>
          <DatePickerInput
            label="Tanggal Transaksi"
            value={transactionDate}
            onChangeDate={setTransactionDate}
          />

          <AppInput
            label="Catatan (Opsional)"
            placeholder="Keterangan pemasukan..."
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>

        {/* Submit Actions */}
        <View style={styles.actionButtons}>
          <AppButton
            title={isSubmitting ? 'Menyimpan...' : 'Simpan Pemasukan'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityLabel="Simpan pemasukan"
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
    color: theme.colors.success[500],
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
  accountCardSelected: {
    borderColor: theme.colors.success[500],
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
    color: theme.colors.success[500],
    fontWeight: '700',
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
