import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { TransactionType } from '../../domain/transaction-type';
import { theme } from '@/core/ui/tokens/theme';

import { CurrencyInput } from '@/core/ui/components/CurrencyInput';
import { Money } from '@/core/domain/money';

export type DateFilterPreset = 'all' | 'today' | 'week' | 'month';

export interface FilterState {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  datePreset: DateFilterPreset;
  minAmount?: Money;
  maxAmount?: Money;
}

interface TransactionFilterModalProps {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  currentFilter: FilterState;
  onApply: (filter: FilterState) => void;
  onReset: () => void;
}

export const TransactionFilterModal: React.FC<TransactionFilterModalProps> = ({
  visible,
  onClose,
  accounts,
  categories,
  currentFilter,
  onApply,
  onReset,
}) => {
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(currentFilter.type);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(currentFilter.accountId);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(currentFilter.categoryId);
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateFilterPreset>(currentFilter.datePreset);
  const [minAmountStr, setMinAmountStr] = useState<string>(
    currentFilter.minAmount ? currentFilter.minAmount.toDecimal().toString() : ''
  );
  const [maxAmountStr, setMaxAmountStr] = useState<string>(
    currentFilter.maxAmount ? currentFilter.maxAmount.toDecimal().toString() : ''
  );

  const handleApply = () => {
    const minVal = minAmountStr.trim() ? parseInt(minAmountStr.replace(/\D/g, ''), 10) : undefined;
    const maxVal = maxAmountStr.trim() ? parseInt(maxAmountStr.replace(/\D/g, ''), 10) : undefined;

    onApply({
      type: selectedType,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      datePreset: selectedDatePreset,
      minAmount: minVal && minVal > 0 ? Money.fromDecimal(minVal, 'IDR') : undefined,
      maxAmount: maxVal && maxVal > 0 ? Money.fromDecimal(maxVal, 'IDR') : undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedType(undefined);
    setSelectedAccountId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedDatePreset('all');
    setMinAmountStr('');
    setMaxAmountStr('');
    onReset();
    onClose();
  };

  const typeOptions: { label: string; value?: TransactionType }[] = [
    { label: 'Semua', value: undefined },
    { label: 'Pengeluaran', value: 'expense' },
    { label: 'Pemasukan', value: 'income' },
    { label: 'Transfer', value: 'transfer' },
    { label: 'Saldo Awal', value: 'opening_balance' },
  ];

  const dateOptions: { label: string; value: DateFilterPreset }[] = [
    { label: 'Semua Waktu', value: 'all' },
    { label: 'Hari Ini', value: 'today' },
    { label: 'Minggu Ini', value: 'week' },
    { label: 'Bulan Ini', value: 'month' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <AppText variant="titleMedium">Filter Transaksi</AppText>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup modal filter">
              <AppText variant="body" style={styles.closeText}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Transaction Type Filter */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                TIPE TRANSAKSI
              </AppText>
              <View style={styles.chipRow}>
                {typeOptions.map((opt) => {
                  const isSelected = selectedType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedType(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Tipe ${opt.label}`}
                    >
                      <AppText
                        variant="caption"
                        style={[styles.chipText, isSelected && styles.chipTextSelected]}
                      >
                        {opt.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Date Range Preset Filter */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                RENTANG WAKTU
              </AppText>
              <View style={styles.chipRow}>
                {dateOptions.map((opt) => {
                  const isSelected = selectedDatePreset === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedDatePreset(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Waktu ${opt.label}`}
                    >
                      <AppText
                        variant="caption"
                        style={[styles.chipText, isSelected && styles.chipTextSelected]}
                      >
                        {opt.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Account Filter */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                AKUN
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedAccountId && styles.chipSelected]}
                  onPress={() => setSelectedAccountId(undefined)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !selectedAccountId }}
                  accessibilityLabel="Semua Akun"
                >
                  <AppText variant="caption" style={[styles.chipText, !selectedAccountId && styles.chipTextSelected]}>
                    Semua Akun
                  </AppText>
                </TouchableOpacity>
                {accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedAccountId(acc.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Akun ${acc.name}`}
                    >
                      <AppText variant="caption" style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {acc.name}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Category Filter */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                KATEGORI
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedCategoryId && styles.chipSelected]}
                  onPress={() => setSelectedCategoryId(undefined)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !selectedCategoryId }}
                  accessibilityLabel="Semua Kategori"
                >
                  <AppText variant="caption" style={[styles.chipText, !selectedCategoryId && styles.chipTextSelected]}>
                    Semua Kategori
                  </AppText>
                </TouchableOpacity>
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Kategori ${cat.name}`}
                    >
                      <AppText variant="caption" style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {cat.name}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Amount Range Filter */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                RENTANG NOMINAL
              </AppText>
              <View style={styles.amountInputsRow}>
                <View style={styles.amountInputCol}>
                  <CurrencyInput
                    label="Minimum"
                    value={minAmountStr}
                    onChangeValue={(raw) => setMinAmountStr(raw)}
                    placeholder="Rp 0"
                  />
                </View>
                <View style={styles.amountInputCol}>
                  <CurrencyInput
                    label="Maksimum"
                    value={maxAmountStr}
                    onChangeValue={(raw) => setMaxAmountStr(raw)}
                    placeholder="Rp 0"
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <AppButton
              title="Reset"
              variant="secondary"
              onPress={handleReset}
              style={styles.resetButton}
              accessibilityLabel="Reset semua filter"
            />
            <AppButton
              title="Terapkan Filter"
              variant="primary"
              onPress={handleApply}
              style={styles.applyButton}
              accessibilityLabel="Terapkan filter"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '80%',
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeText: {
    color: theme.colors.textMuted,
    fontSize: 18,
    paddingHorizontal: theme.spacing.xs,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  scrollChipRow: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[600],
  },
  chipText: {
    color: theme.colors.textMuted,
  },
  chipTextSelected: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  resetButton: {
    flex: 1,
  },
  applyButton: {
    flex: 2,
  },
  amountInputsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  amountInputCol: {
    flex: 1,
  },
});
