import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { BudgetPeriod, BudgetPeriodType } from '../../domain/budget-period';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface CreateBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: {
    categoryId: string;
    name?: string | null;
    amountMinorUnits: number;
    periodType: BudgetPeriodType;
    startDate: string;
    endDate: string;
  }) => Promise<boolean>;
}

export const CreateBudgetModal: React.FC<CreateBudgetModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { categories, refresh: refreshCategories } = useCategoryManagement();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('monthly');

  const currentMonth = BudgetPeriod.currentMonth();
  const [startDate, setStartDate] = useState(currentMonth.startDate);
  const [endDate, setEndDate] = useState(currentMonth.endDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter only expense categories
  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isDeleted());

  useEffect(() => {
    if (visible) {
      refreshCategories?.();
      setErrorMessage(null);
    }
  }, [visible, refreshCategories]);

  useEffect(() => {
    if (expenseCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories, selectedCategoryId]);

  const handlePeriodChange = (type: BudgetPeriodType) => {
    setPeriodType(type);
    if (type === 'monthly') {
      const m = BudgetPeriod.currentMonth();
      setStartDate(m.startDate);
      setEndDate(m.endDate);
    }
  };

  const categoryIdToUse = selectedCategoryId || (expenseCategories.length > 0 ? expenseCategories[0].id : '');
  const amountNumber = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const canSubmit = Boolean(categoryIdToUse && amountNumber > 0 && startDate && endDate && !isSubmitting);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    if (startDate > endDate) {
      setErrorMessage('Tanggal mulai tidak boleh lebih dari tanggal akhir.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        categoryId: categoryIdToUse,
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
      setErrorMessage(e instanceof Error ? e.message : 'Gagal membuat anggaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="titleMedium" style={styles.title}>
              Buat Anggaran Baru
            </AppText>
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

            {/* Category Selector */}
            <AppText variant="body" style={styles.label}>
              Pilih Kategori Pengeluaran
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              {expenseCategories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <AppText style={styles.categoryChipIcon}>
                      {cat.icon || '🏷️'}
                    </AppText>
                    <AppText
                      variant="caption"
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

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
                  Bulan Ini ({currentMonth.startDate.slice(0, 7)})
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

          {/* Footer Submit */}
          <View style={styles.footer}>
            <AppButton
              title={isSubmitting ? 'Menyimpan...' : 'Simpan Anggaran'}
              onPress={handleSubmit}
              disabled={!canSubmit}
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
  label: {
    color: colors.neutral[300],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.full,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[700],
  },
  categoryChipSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[500],
  },
  categoryChipIcon: {
    marginRight: spacing.xs,
    fontSize: 16,
  },
  categoryChipText: {
    color: colors.neutral[300],
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
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
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    color: colors.neutral[400],
    marginBottom: 2,
  },
  footer: {
    marginTop: spacing.xs,
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
