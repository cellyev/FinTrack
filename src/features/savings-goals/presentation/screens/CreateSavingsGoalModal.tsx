import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { DatePickerInput } from '@/core/ui/components/DatePickerInput';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface CreateSavingsGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    targetAmountMinorUnits: number;
    currentAmountMinorUnits: number;
    targetDate?: string | null;
  }) => Promise<boolean>;
}

export const CreateSavingsGoalModal: React.FC<CreateSavingsGoalModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [targetAmountStr, setTargetAmountStr] = useState('');
  const [currentAmountStr, setCurrentAmountStr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setTargetAmountStr('');
      setCurrentAmountStr('');
      setTargetDate('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [visible]);

  const targetAmountNumber = parseInt(targetAmountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const currentAmountNumber = parseInt(currentAmountStr.replace(/[^0-9]/g, ''), 10) || 0;

  const canSubmit = Boolean(name.trim().length > 0 && targetAmountNumber > 0 && !isSubmitting);

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
        name: name.trim(),
        targetAmountMinorUnits: targetAmountNumber,
        currentAmountMinorUnits: currentAmountNumber,
        targetDate: targetDate.trim().length > 0 ? targetDate.trim() : null,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal menyimpan target tabungan.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
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
                🎯 Target Tabungan Baru
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Buat rencana target tabungan untuk impian finansial Anda.
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
                placeholder="Contoh: Dana Darurat, Laptop Baru"
                value={name}
                onChangeText={setName}
                autoFocus={true}
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
                * Nominal tabungan yang sudah Anda kumpulkan (perencanaan mandiri).
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
                disabled={isSubmitting}
                style={styles.cancelButton}
              />
              <AppButton
                title={isSubmitting ? 'Menyimpan...' : 'Simpan Target'}
                variant="primary"
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={styles.submitButton}
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
});
