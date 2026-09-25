import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { AppInput } from '@/core/ui/components/AppInput';
import { Debt } from '../../domain/debt';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface EditDebtModalProps {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onSubmit: (input: {
    id: string;
    personName: string;
    dueDate?: string | null;
    note?: string | null;
  }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export const EditDebtModal: React.FC<EditDebtModalProps> = ({
  visible,
  debt,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [personName, setPersonName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && debt) {
      setPersonName(debt.personName);
      setDueDate(debt.dueDate ?? '');
      setNote(debt.note ?? '');
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsDeleting(false);
    }
  }, [visible, debt]);

  if (!debt) return null;

  const canSubmit = Boolean(personName.trim().length > 0 && !isSubmitting && !isDeleting);

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

    setIsSubmitting(true);
    try {
      const success = await onSubmit({
        id: debt.id,
        personName: personName.trim(),
        dueDate: dueDate.trim().length > 0 ? dueDate.trim() : null,
        note: note.trim().length > 0 ? note.trim() : null,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal memperbarui data.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      debt.isBorrowed ? 'Hapus Catatan Hutang' : 'Hapus Catatan Piutang',
      `Apakah Anda yakin ingin menghapus catatan dengan "${debt.personName}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const success = await onDelete(debt.id);
              if (success) {
                onClose();
              } else {
                setErrorMessage('Gagal menghapus data.');
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
                ✏️ Edit {debt.isBorrowed ? 'Hutang' : 'Piutang'}
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Perbarui detail informasi pihak terkait atau tanggal jatuh tempo.
              </AppText>
            </View>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <AppText variant="caption" style={styles.errorText}>
                  {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Nama Pihak */}
            <View style={styles.formGroup}>
              <AppText variant="body" style={styles.label}>
                Nama Pihak Terkait <AppText style={styles.required}>*</AppText>
              </AppText>
              <AppInput
                placeholder="Nama pihak"
                value={personName}
                onChangeText={setPersonName}
              />
            </View>

            {/* Info Nominal (Read only summary) */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <AppText variant="caption" style={styles.infoLabel}>Total Awal:</AppText>
                <AppText variant="body" style={styles.infoValue}>{debt.originalAmount.formatDisplay()}</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" style={styles.infoLabel}>Sisa Belum Lunas:</AppText>
                <AppText variant="body" style={styles.infoValueDanger}>{debt.remainingAmount.formatDisplay()}</AppText>
              </View>
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
                placeholder="Keterangan..."
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
                title={isDeleting ? 'Menghapus...' : 'Hapus Catatan'}
                variant="danger"
                onPress={handleDelete}
                disabled={isSubmitting || isDeleting}
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
  infoCard: {
    backgroundColor: theme.colors.neutral[50],
    padding: spacing.md,
    borderRadius: theme.radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  infoLabel: {
    color: theme.colors.neutral[600],
  },
  infoValue: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  infoValueDanger: {
    fontWeight: '700',
    color: colors.danger[600],
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
