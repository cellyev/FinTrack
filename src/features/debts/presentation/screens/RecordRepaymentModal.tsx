import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { Debt } from '../../domain/debt';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface RecordRepaymentModalProps {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onSubmit: (input: {
    debtId: string;
    paymentAmountMinorUnits: number;
    accountId: string;
    categoryId: string;
    transactionDate?: string;
    note?: string | null;
  }) => Promise<boolean>;
}

export const RecordRepaymentModal: React.FC<RecordRepaymentModalProps> = ({
  visible,
  debt,
  onClose,
  onSubmit,
}) => {
  const insets = useSafeAreaInsets();
  const { accounts, fetchAccounts } = useAccounts();
  const { categories, refresh: refreshCategories } = useCategoryManagement();

  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && debt) {
      setPaymentAmountStr(debt.remainingAmount.minorUnits.toString());
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setErrorMessage(null);
      setIsSubmitting(false);

      fetchAccounts?.();
      refreshCategories?.();
    }
  }, [visible, debt, fetchAccounts, refreshCategories]);

  // Categories filter:
  // Repaying Hutang (Borrowed) = Expense
  // Collecting Piutang (Lent) = Income
  const availableCategories = categories.filter((c) =>
    debt?.isBorrowed ? c.type === 'expense' : c.type === 'income'
  );

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].account.id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (availableCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(availableCategories[0].id);
    }
  }, [availableCategories, selectedCategoryId]);

  if (!debt) return null;

  const paymentNumber = parseInt(paymentAmountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const maxAllowedNumber = Number(debt.remainingAmount.minorUnits);

  const canSubmit = Boolean(
    paymentNumber > 0 &&
      paymentNumber <= maxAllowedNumber &&
      selectedAccountId &&
      selectedCategoryId &&
      !isSubmitting
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    if (paymentNumber > maxAllowedNumber) {
      setErrorMessage(`Nominal pembayaran tidak boleh melebihi sisa (${debt.remainingAmount.formatDisplay()}).`);
      return;
    }

    if (transactionDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(transactionDate.trim())) {
        setErrorMessage('Format tanggal harus YYYY-MM-DD.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        debtId: debt.id,
        paymentAmountMinorUnits: paymentNumber,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        transactionDate: transactionDate.trim().length > 0 ? transactionDate.trim() : undefined,
        note: note.trim().length > 0 ? note.trim() : null,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal mencatat pembayaran.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 32}
      >
        <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <AppText variant="titleLarge" style={styles.title}>
                {debt.isBorrowed ? '💳 Bayar Cicilan Hutang' : '📥 Catat Pelunasan Piutang'}
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Pihak terkait: <AppText style={styles.boldText}>{debt.personName}</AppText>
              </AppText>
              <AppText variant="caption" style={styles.remainingText}>
                Sisa saat ini: <AppText style={styles.boldAmount}>{debt.remainingAmount.formatDisplay()}</AppText>
              </AppText>
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AppText variant="caption" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Nominal Pembayaran */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Nominal Pembayaran (Rp) <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="0"
                keyboardType="numeric"
                value={paymentAmountStr}
                onChangeText={setPaymentAmountStr}
                autoFocus={true}
              />
              <View style={styles.quickButtonsRow}>
                <TouchableOpacity
                  style={styles.quickButton}
                  onPress={() => setPaymentAmountStr(debt.remainingAmount.minorUnits.toString())}
                >
                  <AppText variant="caption" style={styles.quickButtonText}>
                    Bayar Lunas ({debt.remainingAmount.formatDisplay()})
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Akun Sumber / Tujuan */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                {debt.isBorrowed ? 'Sumber Rekening / Akun' : 'Rekening / Akun Penerima'}{' '}
                <AppText style={styles.required}>*</AppText>
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.account.id}
                    style={[
                      styles.chip,
                      selectedAccountId === acc.account.id && styles.chipActive,
                    ]}
                    onPress={() => setSelectedAccountId(acc.account.id)}
                  >
                    <AppText
                      variant="caption"
                      style={[
                        styles.chipText,
                        selectedAccountId === acc.account.id && styles.chipTextActive,
                      ]}
                    >
                      {acc.account.name}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Kategori Transaksi */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Kategori Transaksi <AppText style={styles.required}>*</AppText>
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                {availableCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      selectedCategoryId === cat.id && styles.chipActive,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <AppText
                      variant="caption"
                      style={[
                        styles.chipText,
                        selectedCategoryId === cat.id && styles.chipTextActive,
                      ]}
                    >
                      {cat.name}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Tanggal Transaksi */}
            <View style={styles.formGroup}>
              <DatePickerInput
                label="Tanggal Transaksi"
                value={transactionDate}
                onChangeDate={setTransactionDate}
              />
            </View>

            {/* Catatan (Opsional) */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Catatan (Opsional)
              </AppText>
              <AppInput
                placeholder="Keterangan pembayaran..."
                value={note}
                onChangeText={setNote}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <AppButton
                title="Batal"
                variant="secondary"
                onPress={onClose}
                disabled={isSubmitting}
                style={styles.cancelButton}
              />
              <AppButton
                title={isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                variant="primary"
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={styles.submitButton}
              />
            </View>
          </ScrollView>
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
    maxHeight: '90%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.neutral[600],
    marginTop: 4,
  },
  remainingText: {
    color: theme.colors.neutral[600],
    marginTop: 2,
  },
  boldText: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  boldAmount: {
    fontWeight: '700',
    color: colors.danger[600],
  },
  errorContainer: {
    backgroundColor: colors.danger[50],
    padding: spacing.sm,
    borderRadius: theme.radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  errorText: {
    color: colors.danger[700],
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.danger[500],
  },
  quickButtonsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  quickButton: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radii.sm,
  },
  quickButtonText: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  horizontalChips: {
    flexDirection: 'row',
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipText: {
    color: theme.colors.neutral[600],
  },
  chipTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
