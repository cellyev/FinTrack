import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';
import { RecurringType } from '../../domain/recurring-transaction';
import { RecurringFrequency } from '../../domain/recurring-frequency';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { Category } from '@/features/categories/domain/category';

export interface CreateRecurringTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: RecurringType;
    amountMinorUnits: number;
    accountId: string;
    categoryId: string;
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string | null;
    note?: string | null;
  }) => Promise<boolean>;
}

export const CreateRecurringTransactionModal: React.FC<CreateRecurringTransactionModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const insets = useSafeAreaInsets();
  const { accounts } = useAccounts();
  const { categories, refresh: refreshCategories } = useCategoryManagement();

  const [type, setType] = useState<RecurringType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableCategories = categories.filter((c: Category) => c.type === type && !c.isDeleted());

  useEffect(() => {
    if (visible) {
      refreshCategories?.();
      setErrorMessage(null);
    }
  }, [visible, refreshCategories]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].account.id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (availableCategories.length > 0) {
      setSelectedCategoryId(availableCategories[0].id);
    } else {
      setSelectedCategoryId('');
    }
  }, [availableCategories]);

  const amountNumber = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const canSubmit = Boolean(
    amountNumber > 0 &&
    selectedAccountId &&
    selectedCategoryId &&
    startDate.trim().length > 0 &&
    !isSubmitting
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate.trim())) {
      setErrorMessage('Format tanggal mulai harus YYYY-MM-DD.');
      return;
    }

    if (endDate.trim().length > 0) {
      if (!dateRegex.test(endDate.trim())) {
        setErrorMessage('Format tanggal selesai harus YYYY-MM-DD.');
        return;
      }
      if (endDate.trim() < startDate.trim()) {
        setErrorMessage('Tanggal selesai tidak boleh sebelum tanggal mulai.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        type,
        amountMinorUnits: amountNumber * 100, // minor units (cents)
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        frequency,
        startDate: startDate.trim(),
        endDate: endDate.trim().length > 0 ? endDate.trim() : null,
        note: note.trim().length > 0 ? note.trim() : null,
      });

      if (success) {
        handleReset();
        onClose();
      } else {
        setErrorMessage('Gagal menyimpan transaksi berulang.');
      }
    } catch (e: unknown) {
      setErrorMessage((e as Error).message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setType('expense');
    setAmountStr('');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setNote('');
    setErrorMessage(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 32}
      >
        <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="titleLarge" style={styles.headerTitle}>
              🔄 Tambah Transaksi Berulang
            </AppText>
            <TouchableOpacity
              onPress={() => {
                handleReset();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <AppText variant="body" style={styles.closeText}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <AppText variant="caption" style={styles.errorText}>
                ⚠️ {errorMessage}
              </AppText>
            </View>
          )}

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Type Selector */}
            <AppText variant="body" style={styles.label}>
              Tipe Transaksi:
            </AppText>
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === 'expense' && styles.expenseActiveOption,
                ]}
                onPress={() => setType('expense')}
              >
                <AppText
                  variant="body"
                  style={[styles.typeOptionText, type === 'expense' && styles.activeTypeText]}
                >
                  🔴 Pengeluaran
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  type === 'income' && styles.incomeActiveOption,
                ]}
                onPress={() => setType('income')}
              >
                <AppText
                  variant="body"
                  style={[styles.typeOptionText, type === 'income' && styles.activeTypeText]}
                >
                  🟢 Pemasukan
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Nominal */}
            <AppText variant="body" style={styles.label}>
              Nominal per Siklus (Rp): *
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Contoh: 500000"
              placeholderTextColor={theme.colors.neutral[400]}
              keyboardType="number-pad"
              value={amountStr}
              onChangeText={setAmountStr}
            />

            {/* Frequency Selector */}
            <AppText variant="body" style={styles.label}>
              Frekuensi Pengulangan: *
            </AppText>
            <View style={styles.freqRow}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                  onPress={() => setFrequency(f)}
                >
                  <AppText
                    variant="caption"
                    style={[styles.freqChipText, frequency === f && styles.freqChipTextActive]}
                  >
                    {f === 'daily'
                      ? 'Harian'
                      : f === 'weekly'
                      ? 'Mingguan'
                      : f === 'monthly'
                      ? 'Bulanan'
                      : 'Tahunan'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Account Selector */}
            <AppText variant="body" style={styles.label}>
              {type === 'expense' ? 'Akun Sumber (Dipotong dari): *' : 'Akun Tujuan (Masuk ke): *'}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {accounts.map(({ account }) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.chip,
                    selectedAccountId === account.id && styles.chipActive,
                  ]}
                  onPress={() => setSelectedAccountId(account.id)}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.chipText,
                      selectedAccountId === account.id && styles.chipTextActive,
                    ]}
                  >
                    🏦 {account.name}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Category Selector */}
            <AppText variant="body" style={styles.label}>
              Kategori: *
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {availableCategories.map((c: Category) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chip,
                    selectedCategoryId === c.id && styles.chipActive,
                  ]}
                  onPress={() => setSelectedCategoryId(c.id)}
                >
                  <AppText
                    variant="caption"
                    style={[
                      styles.chipText,
                      selectedCategoryId === c.id && styles.chipTextActive,
                    ]}
                  >
                    🏷️ {c.name}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Start Date */}
            <DatePickerInput
              label="Mulai Tanggal *"
              value={startDate}
              onChangeDate={setStartDate}
            />

            {/* Optional End Date */}
            <DatePickerInput
              label="Selesai Tanggal (Opsional)"
              value={endDate}
              onChangeDate={setEndDate}
              minDate={startDate}
              optional={true}
            />

            {/* Note */}
            <AppText variant="body" style={styles.label}>
              Catatan / Deskripsi:
            </AppText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Contoh: Langganan WiFi, Sewa Kost, Gaji Bulanan"
              placeholderTextColor={theme.colors.neutral[400]}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.footer}>
            <AppButton
              title={isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi Berulang'}
              variant="primary"
              disabled={!canSubmit}
              onPress={handleSubmit}
            />
            {isSubmitting && <ActivityIndicator style={styles.loader} color={colors.primary[600]} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: spacing.md,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeText: {
    color: theme.colors.neutral[500],
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: colors.danger[50],
    padding: spacing.sm,
    borderRadius: theme.radii.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger[700],
  },
  scrollBody: {
    marginBottom: spacing.md,
  },
  label: {
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[50],
  },
  expenseActiveOption: {
    backgroundColor: colors.danger[50],
    borderColor: colors.danger[500],
  },
  incomeActiveOption: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[500],
  },
  typeOptionText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  activeTypeText: {
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  freqRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  freqChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[50],
  },
  freqChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  freqChipText: {
    fontWeight: '600',
    color: theme.colors.neutral[600],
  },
  freqChipTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: spacing.xs,
    backgroundColor: theme.colors.neutral[50],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  chipText: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.xs,
  },
  loader: {
    marginTop: spacing.xs,
  },
});
