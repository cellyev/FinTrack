import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { BudgetProgress } from '../../domain/budget-progress';
import { BudgetPeriod, BudgetPeriodType } from '../../domain/budget-period';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface EditBudgetModalProps {
  visible: boolean;
  budgetProgress: BudgetProgress | null;
  onClose: () => void;
  onUpdate: (input: {
    id: string;
    name?: string | null;
    amountMinorUnits: number;
    periodType: BudgetPeriodType;
    startDate: string;
    endDate: string;
  }) => Promise<boolean>;
  onDelete: (budgetId: string) => Promise<boolean>;
}

export const EditBudgetModal: React.FC<EditBudgetModalProps> = ({
  visible,
  budgetProgress,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (budgetProgress) {
      setName(budgetProgress.budget.name || '');
      setAmountStr(String(Number(budgetProgress.budget.amount.minorUnits)));
      setPeriodType(budgetProgress.budget.period.periodType);
      setStartDate(budgetProgress.budget.period.startDate);
      setEndDate(budgetProgress.budget.period.endDate);
      setErrorMessage(null);
    }
  }, [budgetProgress]);

  if (!budgetProgress) return null;

  const handlePeriodChange = (type: BudgetPeriodType) => {
    setPeriodType(type);
    if (type === 'monthly') {
      const m = BudgetPeriod.currentMonth();
      setStartDate(m.startDate);
      setEndDate(m.endDate);
    }
  };

  const amountNumber = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const canSubmit = amountNumber > 0 && startDate && endDate && !isSubmitting;

  const handleUpdate = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    if (startDate > endDate) {
      setErrorMessage('Tanggal mulai tidak boleh lebih dari tanggal akhir.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onUpdate({
        id: budgetProgress.budget.id,
        name: name.trim().length > 0 ? name.trim() : null,
        amountMinorUnits: amountNumber,
        periodType,
        startDate,
        endDate,
      });

      if (success) {
        onClose();
      }
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Gagal memperbarui anggaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePress = () => {
    Alert.alert(
      'Hapus Anggaran',
      `Apakah Anda yakin ingin menghapus anggaran untuk ${budgetProgress.categoryName}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const success = await onDelete(budgetProgress.budget.id);
              if (success) {
                onClose();
              }
            } catch (e: unknown) {
              setErrorMessage(e instanceof Error ? e.message : 'Gagal menghapus anggaran');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.categoryRow}>
              {budgetProgress.categoryIcon ? (
                <AppText style={styles.categoryIcon}>{budgetProgress.categoryIcon}</AppText>
              ) : null}
              <AppText variant="titleMedium" style={styles.title}>
                Ubah Anggaran ({budgetProgress.categoryName})
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <AppText variant="body" style={styles.closeBtn}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {errorMessage ? (
              <View style={styles.errorCard}>
                <AppText variant="caption" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Spent info summary */}
            <View style={styles.summaryCard}>
              <AppText variant="caption" style={styles.summaryLabel}>
                Total Pengeluaran Saat Ini
              </AppText>
              <AppText variant="titleMedium" style={styles.summaryValue}>
                {budgetProgress.actualSpending.formatDisplay()} ({budgetProgress.percentageUsed}%)
              </AppText>
            </View>

            {/* Nominal Amount */}
            <AppText variant="body" style={styles.label}>
              Batas Anggaran (Rp)
            </AppText>
            <AppInput
              placeholder="Contoh: 1.000.000"
              keyboardType="numeric"
              value={amountStr ? parseInt(amountStr, 10).toLocaleString('id-ID') : ''}
              onChangeText={(text) => setAmountStr(text.replace(/[^0-9]/g, ''))}
            />

            {/* Custom Name */}
            <AppText variant="body" style={styles.label}>
              Nama Anggaran (Opsional)
            </AppText>
            <AppInput
              placeholder="Contoh: Belanja Bulanan"
              value={name}
              onChangeText={setName}
            />

            {/* Period Type */}
            <AppText variant="body" style={styles.label}>
              Periode
            </AppText>
            <View style={styles.periodRow}>
              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  periodType === 'monthly' && styles.periodBtnSelected,
                ]}
                onPress={() => handlePeriodChange('monthly')}
              >
                <AppText
                  variant="body"
                  style={[
                    styles.periodBtnText,
                    periodType === 'monthly' && styles.periodBtnTextSelected,
                  ]}
                >
                  Bulan Ini
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.periodBtn,
                  periodType === 'custom' && styles.periodBtnSelected,
                ]}
                onPress={() => handlePeriodChange('custom')}
              >
                <AppText
                  variant="body"
                  style={[
                    styles.periodBtnText,
                    periodType === 'custom' && styles.periodBtnTextSelected,
                  ]}
                >
                  Kustom
                </AppText>
              </TouchableOpacity>
            </View>

            {/* Custom Date Inputs if periodType === 'custom' */}
            {periodType === 'custom' ? (
              <View style={styles.customDateRow}>
                <View style={styles.dateInputContainer}>
                  <DatePickerInput
                    label="Mulai Tanggal"
                    value={startDate}
                    onChangeDate={setStartDate}
                  />
                </View>

                <View style={styles.dateInputContainer}>
                  <DatePickerInput
                    label="Sampai Tanggal"
                    value={endDate}
                    onChangeDate={setEndDate}
                    minDate={startDate}
                  />
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <AppButton
              title={isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              onPress={handleUpdate}
              disabled={!canSubmit}
            />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeletePress}
              disabled={isSubmitting}
            >
              <AppText variant="body" style={styles.deleteBtnText}>
                Hapus Anggaran Ini
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[900],
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '90%',
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[800],
    paddingBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
  },
  title: {
    color: colors.white,
    fontWeight: '700',
  },
  closeBtn: {
    color: colors.neutral[400],
    padding: spacing.xs,
  },
  body: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.neutral[800],
    padding: spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    color: colors.neutral[400],
  },
  summaryValue: {
    color: colors.white,
    fontWeight: '700',
    marginTop: 2,
  },
  label: {
    color: colors.neutral[300],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: colors.neutral[800],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[700],
  },
  periodBtnSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[500],
  },
  periodBtnText: {
    color: colors.neutral[300],
  },
  periodBtnTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  customDateRow: {
    flexDirection: 'column',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  dateInputContainer: {
    width: '100%',
  },
  dateLabel: {
    color: colors.neutral[400],
    marginBottom: 2,
  },
  footer: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteBtnText: {
    color: colors.danger[500],
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.danger[500],
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: theme.radii.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger[500],
  },
});
