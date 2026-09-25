import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
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
import { RecurringTransaction } from '../../domain/recurring-transaction';
import { RecurringFrequency } from '../../domain/recurring-frequency';

export interface EditRecurringTransactionModalProps {
  visible: boolean;
  recurring: RecurringTransaction | null;
  onClose: () => void;
  onUpdate: (data: {
    id: string;
    amountMinorUnits: number;
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string | null;
    nextOccurrence: string;
    note?: string | null;
  }) => Promise<boolean>;
  onToggleActive: (id: string, isActive: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export const EditRecurringTransactionModal: React.FC<EditRecurringTransactionModalProps> = ({
  visible,
  recurring,
  onClose,
  onUpdate,
  onToggleActive,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [amountStr, setAmountStr] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nextOccurrence, setNextOccurrence] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (recurring) {
      const major = Number(recurring.amount.minorUnits) / 100;
      setAmountStr(String(major));
      setFrequency(recurring.frequency);
      setStartDate(recurring.startDate);
      setEndDate(recurring.endDate || '');
      setNextOccurrence(recurring.nextOccurrence);
      setNote(recurring.note || '');
      setErrorMessage(null);
    }
  }, [recurring]);

  if (!recurring) return null;

  const amountNumber = parseInt(amountStr.replace(/[^0-9]/g, ''), 10) || 0;
  const canSubmit = Boolean(
    amountNumber > 0 &&
    startDate.trim().length > 0 &&
    nextOccurrence.trim().length > 0 &&
    !isSubmitting
  );

  const handleUpdate = async () => {
    if (!canSubmit) return;
    setErrorMessage(null);

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate.trim())) {
      setErrorMessage('Format tanggal mulai harus YYYY-MM-DD.');
      return;
    }
    if (!dateRegex.test(nextOccurrence.trim())) {
      setErrorMessage('Format tanggal jatuh tempo berikutnya harus YYYY-MM-DD.');
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
      const success = await onUpdate({
        id: recurring.id,
        amountMinorUnits: amountNumber * 100,
        frequency,
        startDate: startDate.trim(),
        endDate: endDate.trim().length > 0 ? endDate.trim() : null,
        nextOccurrence: nextOccurrence.trim(),
        note: note.trim().length > 0 ? note.trim() : null,
      });

      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal memperbarui transaksi berulang.');
      }
    } catch (e: unknown) {
      setErrorMessage((e as Error).message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async () => {
    setIsSubmitting(true);
    try {
      const success = await onToggleActive(recurring.id, !recurring.isActive);
      if (success) {
        onClose();
      } else {
        setErrorMessage('Gagal mengubah status aktif.');
      }
    } catch (e: unknown) {
      setErrorMessage((e as Error).message || 'Gagal mengubah status aktif.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi Berulang',
      'Apakah Anda yakin ingin menghapus jadwal berulang ini? Riwayat transaksi yang sudah ter-generate sebelumnya tidak akan terhapus.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const success = await onDelete(recurring.id);
              if (success) {
                onClose();
              } else {
                setErrorMessage('Gagal menghapus jadwal berulang.');
              }
            } catch (e: unknown) {
              setErrorMessage((e as Error).message || 'Gagal menghapus.');
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
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 32}
      >
        <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.header}>
            <AppText variant="titleLarge" style={styles.headerTitle}>
              ✏️ Edit Transaksi Berulang
            </AppText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
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
            {/* Nominal */}
            <AppText variant="body" style={styles.label}>
              Nominal per Siklus (Rp): *
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Nominal"
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

            {/* Next Occurrence Date */}
            <DatePickerInput
              label="Jatuh Tempo Berikutnya *"
              value={nextOccurrence}
              onChangeDate={setNextOccurrence}
            />

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
              placeholder="Catatan"
              placeholderTextColor={theme.colors.neutral[400]}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* Toggle Pause / Active & Delete */}
            <View style={styles.extraActionsRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, recurring.isActive ? styles.pauseBtn : styles.resumeBtn]}
                onPress={handleToggle}
              >
                <AppText variant="body" style={styles.toggleBtnText}>
                  {recurring.isActive ? '⏸️ Jeda Rutinitas' : '▶️ Aktifkan Kembali'}
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <AppText variant="body" style={styles.deleteBtnText}>
                  🗑️ Hapus
                </AppText>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              title={isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              variant="primary"
              disabled={!canSubmit}
              onPress={handleUpdate}
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
  extraActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  pauseBtn: {
    backgroundColor: theme.colors.neutral[100],
  },
  resumeBtn: {
    backgroundColor: colors.success[50],
  },
  toggleBtnText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  deleteBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: colors.danger[50],
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.danger[600],
    fontWeight: '600',
  },
  footer: {
    marginTop: spacing.xs,
  },
  loader: {
    marginTop: spacing.xs,
  },
});
