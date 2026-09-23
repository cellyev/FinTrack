import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DebtType } from '../../domain/debt';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface CreateDebtModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: DebtType;
    personName: string;
    amountMinorUnits: number;
    dueDate?: string | null;
    note?: string | null;
    initialAccountMovement?: {
      accountId: string;
      categoryId: string;
      transactionDate?: string;
      note?: string | null;
    };
  }) => Promise<boolean>;
}

export const CreateDebtModal: React.FC<CreateDebtModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { accounts, fetchAccounts } = useAccounts();
  const { categories, refresh: refreshCategories } = useCategoryManagement();

  const [type, setType] = useState<DebtType>('borrowed');
  const [personName, setPersonName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  // Optional cash movement
  const [withCashMovement, setWithCashMovement] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setType('borrowed');
      setPersonName('');
      setAmountStr('');
      setDueDate('');
      setNote('');
      setWithCashMovement(false);
      setSelectedAccountId('');
      setSelectedCategoryId('');
      setErrorMessage(null);
      setIsSubmitting(false);

      fetchAccounts?.();
      refreshCategories?.();
    }
  }, [visible, fetchAccounts, refreshCategories]);

  // Filter categories based on transaction direction
  // Borrowed + cash = Income (uang pinjaman masuk)
  // Lent + cash = Expense (uang dipinjamkan keluar)
  const availableCategories = categories.filter((c) =>
    type === 'borrowed' ? c.type === 'income' : c.type === 'expense'
  );

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
  const canSubmit = Boolean(personName.trim().length > 0 && amountNumber > 0 && !isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    if (dueDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate.trim())) {
        setErrorMessage('Format jatuh tempo harus YYYY-MM-DD.');
        return;
      }
    }

    if (withCashMovement && (!selectedAccountId || !selectedCategoryId)) {
      setErrorMessage('Pilih akun dan kategori untuk pencatatan mutasi kas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        type,
        personName: personName.trim(),
        amountMinorUnits: amountNumber,
        dueDate: dueDate.trim().length > 0 ? dueDate.trim() : null,
        note: note.trim().length > 0 ? note.trim() : null,
        initialAccountMovement: withCashMovement
          ? {
              accountId: selectedAccountId,
              categoryId: selectedCategoryId,
              note: note.trim().length > 0 ? note.trim() : null,
            }
          : undefined,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal menyimpan data.');
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
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <AppText variant="titleLarge" style={styles.title}>
                🤝 Catat Hutang / Piutang
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Kelola kewajiban pembayaran atau tagihan pinjaman secara terstruktur.
              </AppText>
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AppText variant="caption" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Type Selector: Hutang vs Piutang */}
            <View style={styles.typeToggleContainer}>
              <TouchableOpacity
                style={[styles.typeOption, type === 'borrowed' && styles.typeOptionActiveBorrowed]}
                onPress={() => setType('borrowed')}
                activeOpacity={0.7}
              >
                <AppText
                  variant="body"
                  style={[styles.typeOptionText, type === 'borrowed' && styles.typeOptionTextActive]}
                >
                  🔴 Hutang (Saya Pinjam)
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, type === 'lent' && styles.typeOptionActiveLent]}
                onPress={() => setType('lent')}
                activeOpacity={0.7}
              >
                <AppText
                  variant="body"
                  style={[styles.typeOptionText, type === 'lent' && styles.typeOptionTextActive]}
                >
                  🟢 Piutang (Saya Pinjamkan)
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Nama Pihak / Counterparty */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                {type === 'borrowed' ? 'Nama Pemberi Pinjaman' : 'Nama Peminjam'}{' '}
                <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="Contoh: Budi Santoso, Toko Makmur"
                value={personName}
                onChangeText={setPersonName}
                autoFocus={true}
              />
            </View>

            {/* Nominal */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Nominal (Rp) <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="0"
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
              />
            </View>

            {/* Jatuh Tempo (Opsional) */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Jatuh Tempo (Opsional, YYYY-MM-DD)
              </AppText>
              <AppInput
                placeholder="Contoh: 2026-12-31"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>

            {/* Catatan (Opsional) */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Catatan (Opsional)
              </AppText>
              <AppInput
                placeholder="Keterangan pinjaman..."
                value={note}
                onChangeText={setNote}
              />
            </View>

            {/* Toggle Mutasi Kas Awal */}
            <View style={styles.cashMovementSection}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <AppText variant="body" style={styles.switchLabel}>
                    Catat Mutasi Kas Langsung
                  </AppText>
                  <AppText variant="caption" style={styles.switchSubLabel}>
                    {type === 'borrowed'
                      ? 'Otomatis tambah saldo akun (Uang pinjaman masuk)'
                      : 'Otomatis potong saldo akun (Uang dipinjamkan keluar)'}
                  </AppText>
                </View>
                <Switch
                  value={withCashMovement}
                  onValueChange={setWithCashMovement}
                  trackColor={{ false: theme.colors.neutral[300], true: colors.primary[500] }}
                />
              </View>

              {withCashMovement ? (
                <View style={styles.cashMovementDetails}>
                  {/* Account Selector */}
                  <View style={styles.pickerGroup}>
                    <AppText variant="caption" style={styles.pickerLabel}>
                      Pilih Akun:
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

                  {/* Category Selector */}
                  <View style={styles.pickerGroup}>
                    <AppText variant="caption" style={styles.pickerLabel}>
                      Pilih Kategori:
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
                </View>
              ) : null}
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
                title={isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
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
    color: theme.colors.neutral[500],
    marginTop: 4,
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
  typeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radii.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  typeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radii.md,
  },
  typeOptionActiveBorrowed: {
    backgroundColor: colors.danger[50],
  },
  typeOptionActiveLent: {
    backgroundColor: colors.primary[50],
  },
  typeOptionText: {
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
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
  cashMovementSection: {
    backgroundColor: theme.colors.neutral[50],
    padding: spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  switchLabel: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  switchSubLabel: {
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  cashMovementDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  pickerGroup: {
    marginBottom: spacing.sm,
  },
  pickerLabel: {
    color: theme.colors.neutral[600],
    marginBottom: 4,
    fontWeight: '600',
  },
  horizontalChips: {
    flexDirection: 'row',
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
