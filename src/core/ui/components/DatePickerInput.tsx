import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { theme } from '../tokens/theme';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

export interface DatePickerInputProps {
  value: string; // YYYY-MM-DD
  onChangeDate: (date: string) => void;
  label?: string;
  error?: string;
  minDate?: string;
  maxDate?: string;
  optional?: boolean;
  testID?: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * Formats YYYY-MM-DD into friendly Indonesian format, e.g. "Kamis, 20 Agustus 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr || 'Pilih Tanggal';
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Returns today's date in local YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Returns yesterday's date in local YYYY-MM-DD format
 */
export function getYesterdayDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Offsets a YYYY-MM-DD date string by a number of days
 */
export function offsetDateString(dateStr: string, days: number): string {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayDateString();
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChangeDate,
  label,
  error,
  minDate,
  maxDate,
  optional = false,
  testID = 'date-picker-input',
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const initialDateStr = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayDateString();
  const [initialYear, initialMonth] = initialDateStr.split('-').map(Number);

  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth - 1); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(initialDateStr);

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  const isToday = value === todayStr;
  const isYesterday = value === yesterdayStr;

  const handleOpenModal = () => {
    const activeDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayDateString();
    const [y, m] = activeDate.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedDate(activeDate);
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handlePrevYear = () => setViewYear((prev) => prev - 1);
  const handleNextYear = () => setViewYear((prev) => prev + 1);

  const handleSelectDay = (dayNumber: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const newDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNumber)}`;

    if (minDate && newDateStr < minDate) return;
    if (maxDate && newDateStr > maxDate) return;

    setSelectedDate(newDateStr);
  };

  const handleConfirm = () => {
    onChangeDate(selectedDate);
    setModalVisible(false);
  };

  const handleClearDate = () => {
    onChangeDate('');
    setModalVisible(false);
  };

  // Compute calendar days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate(); // 28 - 31

  const calendarCells: Array<{ day: number | null; dateStr: string | null; isDisabled: boolean }> = [];

  // Empty leading padding cells
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push({ day: null, dateStr: null, isDisabled: true });
  }

  // Active days of month
  const pad = (n: number) => n.toString().padStart(2, '0');
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
    const isDisabled = Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate));
    calendarCells.push({ day: d, dateStr, isDisabled });
  }

  return (
    <View style={styles.container}>
      {label ? <AppText variant="caption" style={styles.label}>{label}</AppText> : null}

      {/* Main interactive date card */}
      <TouchableOpacity
        testID={testID}
        onPress={handleOpenModal}
        style={[styles.dateButton, error ? styles.dateButtonError : null]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Pilih tanggal: ${formatDisplayDate(value)}`}
      >
        <View style={styles.dateInfoRow}>
          <AppText variant="titleMedium" style={styles.dateText}>
            📅 {value ? formatDisplayDate(value) : 'Pilih Tanggal (Sentuh)'}
          </AppText>
          <AppText variant="caption" style={styles.changeAction}>
            Ubah
          </AppText>
        </View>
      </TouchableOpacity>

      {/* Quick presets row */}
      <View style={styles.presetsRow}>
        <TouchableOpacity
          style={[styles.presetChip, isToday ? styles.presetChipActive : null]}
          onPress={() => onChangeDate(todayStr)}
        >
          <AppText variant="caption" style={[styles.presetText, isToday ? styles.presetTextActive : null]}>
            Hari Ini
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, isYesterday ? styles.presetChipActive : null]}
          onPress={() => onChangeDate(yesterdayStr)}
        >
          <AppText variant="caption" style={[styles.presetText, isYesterday ? styles.presetTextActive : null]}>
            Kemarin
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => onChangeDate(offsetDateString(value, -1))}
          accessibilityLabel="Kurangi satu hari"
        >
          <AppText variant="caption" style={styles.presetText}>
            -1 Hari
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.presetChip}
          onPress={() => onChangeDate(offsetDateString(value, 1))}
          accessibilityLabel="Tambah satu hari"
        >
          <AppText variant="caption" style={styles.presetText}>
            +1 Hari
          </AppText>
        </TouchableOpacity>
      </View>

      {error ? (
        <AppText variant="caption" style={styles.errorText}>
          {error}
        </AppText>
      ) : null}

      {/* Touch-First Calendar Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <AppText variant="titleMedium" style={styles.modalTitle}>
                  Pilih Tanggal
                </AppText>
                <AppText variant="caption" style={styles.modalSubtitle}>
                  {formatDisplayDate(selectedDate)}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Tutup">
                <AppText style={styles.closeText}>✕</AppText>
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Row */}
            <View style={styles.navRow}>
              <View style={styles.navGroup}>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handlePrevYear}
                  accessibilityRole="button"
                  accessibilityLabel="Tahun Sebelumnya"
                >
                  <AppText style={styles.navButtonText}>«</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handlePrevMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Bulan Sebelumnya"
                >
                  <AppText style={styles.navButtonText}>‹</AppText>
                </TouchableOpacity>
              </View>

              <AppText variant="titleMedium" style={styles.monthYearTitle}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </AppText>

              <View style={styles.navGroup}>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handleNextMonth}
                  accessibilityRole="button"
                  accessibilityLabel="Bulan Berikutnya"
                >
                  <AppText style={styles.navButtonText}>›</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handleNextYear}
                  accessibilityRole="button"
                  accessibilityLabel="Tahun Berikutnya"
                >
                  <AppText style={styles.navButtonText}>»</AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Day of Week Labels */}
            <View style={styles.weekDaysRow}>
              {DAY_NAMES.map((name, idx) => (
                <AppText
                  key={name}
                  variant="caption"
                  style={[
                    styles.weekDayText,
                    idx === 0 && styles.sundayText,
                    idx === 6 && styles.saturdayText,
                  ]}
                >
                  {name}
                </AppText>
              ))}
            </View>

            {/* Calendar Grid (Days) */}
            <View style={styles.calendarGrid}>
              {calendarCells.map((cell, index) => {
                if (cell.day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                }

                const isCellSelected = cell.dateStr === selectedDate;
                const isCellToday = cell.dateStr === todayStr;

                return (
                  <TouchableOpacity
                    key={cell.dateStr}
                    style={[
                      styles.dayCell,
                      isCellToday && styles.dayCellToday,
                      isCellSelected && styles.dayCellSelected,
                      cell.isDisabled && styles.dayCellDisabled,
                    ]}
                    disabled={cell.isDisabled}
                    onPress={() => handleSelectDay(cell.day as number)}
                    accessibilityRole="button"
                    accessibilityLabel={formatDisplayDate(cell.dateStr as string)}
                  >
                    <AppText
                      style={[
                        styles.dayNumberText,
                        isCellToday && styles.dayNumberTextToday,
                        isCellSelected && styles.dayNumberTextSelected,
                        cell.isDisabled && styles.dayNumberTextDisabled,
                      ]}
                    >
                      {cell.day}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              {optional ? (
                <AppButton
                  title="Kosongkan"
                  variant="ghost"
                  onPress={handleClearDate}
                  style={styles.modalButton}
                />
              ) : (
                <AppButton
                  title="Batal"
                  variant="ghost"
                  onPress={() => setModalVisible(false)}
                  style={styles.modalButton}
                />
              )}
              <AppButton
                title="Pilih Tanggal Ini"
                variant="primary"
                onPress={handleConfirm}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    marginBottom: spacing.xxs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeights.medium,
  },
  dateButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateButtonError: {
    borderColor: colors.danger[500],
  },
  dateInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.text,
  },
  changeAction: {
    color: colors.primary[500],
    fontWeight: theme.typography.fontWeights.bold,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  presetChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: colors.primary[500],
  },
  presetText: {
    color: theme.colors.textMuted,
  },
  presetTextActive: {
    color: colors.primary[500],
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger[500],
    marginTop: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  modalSubtitle: {
    color: colors.primary[500],
    fontWeight: '600',
    marginTop: 2,
  },
  closeText: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
    padding: spacing.xxs,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  navGroup: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthYearTitle: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xs,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weekDayText: {
    width: '14.28%',
    textAlign: 'center',
    fontWeight: '700',
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  sundayText: {
    color: colors.danger[500],
  },
  saturdayText: {
    color: colors.info[500],
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: theme.radii.full,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 40,
    marginVertical: 2,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  dayCellSelected: {
    backgroundColor: colors.primary[500],
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayNumberText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  dayNumberTextToday: {
    color: colors.primary[500],
    fontWeight: '700',
  },
  dayNumberTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dayNumberTextDisabled: {
    color: theme.colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalButton: {
    flex: 1,
  },
});
