import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { SavingsGoalProgress } from '../../domain/savings-goal-progress';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface EditSavingsGoalModalProps {
  visible: boolean;
  goalProgress: SavingsGoalProgress | null;
  onClose: () => void;
  onSubmit: (input: {
    id: string;
    name: string;
    targetAmountMinorUnits: number;
    currentAmountMinorUnits: number;
    targetDate?: string | null;
  }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export const EditSavingsGoalModal: React.FC<EditSavingsGoalModalProps> = ({
  visible,
  goalProgress,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && goalProgress) {
      setName(goalProgress.goal.name);
      setTargetAmountStr(goalProgress.goal.targetAmount.minorUnits.toString());
      setCurrentAmountStr(goalProgress.goal.currentAmount.minorUnits.toString());
      setTargetDate(goalProgress.goal.targetDate ?? '');
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsDeleting(false);
    }
  }, [visible, goalProgress]);

  if (!goalProgress) return null;

  const targetAmountNumber = parseInt(targetAmountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const currentAmountNumber = parseInt(currentAmountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const canSubmit = Boolean(name.trim().length > 0 && targetAmountNumber > 0 && !isSubmitting && !isDeleting);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    if (currentAmountNumber > targetAmountNumber) {
      setErrorMessage('Nominal terkumpul tidak boleh melebihi target nominal.');
      return;
    }

    if (targetDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(targetDate.trim())) {
        setErrorMessage('Format target tanggal harus YYYY-MM-DD.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        id: goalProgress.goal.id,
        name: name.trim(),
        targetAmountMinorUnits: targetAmountNumber,
        currentAmountMinorUnits: currentAmountNumber,
        targetDate: targetDate.trim().length > 0 ? targetDate.trim() : null,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal memperbarui target tabungan.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Target Tabungan',
      `Apakah Anda yakin ingin menghapus target "${goalProgress.goal.name}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const success = await onDelete(goalProgress.goal.id);
              if (success) {
                onClose();
              } else {
                setErrorMessage('Gagal menghapus target tabungan.');
              }
            } catch (err) {
              setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <AppText variant="titleLarge" style={styles.title}>
                ✏️ Edit Target Tabungan
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Perbarui kemajuan atau detail target tabungan Anda.
              </AppText>
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AppText variant="caption" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Nama Target */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Nama Target <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="Nama target"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Target Nominal */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Target Nominal (Rp) <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="0"
                keyboardType="numeric"
                value={targetAmountStr}
                onChangeText={setTargetAmountStr}
              />
            </View>

            {/* Terkumpul Saat Ini */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Terkumpul Saat Ini (Rp)
              </AppText>
              <AppInput
                placeholder="0"
                keyboardType="numeric"
                value={currentAmountStr}
                onChangeText={setCurrentAmountStr}
              />
              <AppText variant="caption" style={styles.helperText}>
                * Perbarui nominal yang telah terkumpul secara berkala.
              </AppText>
            </View>

            {/* Target Tanggal (Opsional) */}
            <View style={styles.formGroup}>
              <DatePickerInput
                label="Target Tanggal (Opsional)"
                value={targetDate}
                onChangeDate={setTargetDate}
                optional={true}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <AppButton
                title="Batal"
                variant="secondary"
                onPress={onClose}
                disabled={isSubmitting || isDeleting}
                style={styles.cancelButton}
              />
              <AppButton
                title={isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                variant="primary"
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={styles.submitButton}
              />
            </View>

            {/* Delete Button */}
            <View style={styles.deleteSection}>
              <AppButton
                title={isDeleting ? 'Menghapus...' : 'Hapus Target Tabungan'}
                variant="danger"
                onPress={handleDelete}
                disabled={isSubmitting || isDeleting}
              />
            </View>
          </ScrollView>
        </View>
      </View>
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
  helperText: {
    color: theme.colors.neutral[500],
    marginTop: 4,
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
  deleteSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
