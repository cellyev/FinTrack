import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import {
  ExportTransactionsUseCase,
  ExportFormat,
} from '../../application/export-transactions.usecase';
import { FileSaverService } from '../../application/file-saver.service';
import { SqliteTransactionRepository } from '../../data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { FilterState } from './TransactionFilterModal';
import { theme } from '@/core/ui/tokens/theme';

const txRepo = new SqliteTransactionRepository();
const accRepo = new SqliteAccountRepository();
const catRepo = new SqliteCategoryRepository();
const exportUseCase = new ExportTransactionsUseCase(txRepo, accRepo, catRepo);

export interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  filter: FilterState;
  searchQuery?: string;
  totalFilteredCount: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onClose,
  filter,
  searchQuery,
  totalFilteredCount,
}) => {
  const { user } = useAuth();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      // 1. Generate export data according to selected format
      const result = await exportUseCase.execute({
        userId: user.id,
        format: selectedFormat,
        filter: {
          type: filter.type,
          accountId: filter.accountId,
          categoryId: filter.categoryId,
          search: searchQuery?.trim() ? searchQuery.trim() : undefined,
          minAmount: filter.minAmount,
          maxAmount: filter.maxAmount,
        },
      });

      if (!result.success) {
        setIsExporting(false);
        Alert.alert('Gagal Ekspor', result.error.message);
        return;
      }

      const { fileName, mimeType, data, isPdfHtml, isBase64 } = result.data;

      // 2. Save file and open native download/share dialog
      const saveResult = await FileSaverService.saveAndShare({
        fileName,
        mimeType,
        data,
        isPdfHtml,
        isBase64,
      });

      setIsExporting(false);

      if (saveResult.success) {
        onClose();
      } else {
        Alert.alert('Gagal Mengunduh', saveResult.error ?? 'Terjadi kesalahan saat menyimpan file.');
      }
    } catch (err) {
      setIsExporting(false);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan tidak terduga';
      Alert.alert('Gagal Ekspor', message);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <AppText variant="titleMedium" style={styles.title}>
              Ekspor & Unduh Transaksi
            </AppText>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <AppText variant="body" style={styles.description}>
            Ekspor {totalFilteredCount} transaksi yang sesuai dengan filter riwayat saat ini.
          </AppText>

          {/* Format selector: 2x2 Grid */}
          <View style={styles.formatGrid}>
            <TouchableOpacity
              style={[styles.formatOption, selectedFormat === 'excel' && styles.formatOptionActive]}
              onPress={() => setSelectedFormat('excel')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFormat === 'excel' }}
              accessibilityLabel="Format Excel spreadsheet"
            >
              <AppText style={styles.formatEmoji}>📊</AppText>
              <AppText
                variant="body"
                style={[styles.formatText, selectedFormat === 'excel' && styles.formatTextActive]}
              >
                Excel (.xlsx)
              </AppText>
              <AppText variant="caption" style={styles.formatSubtext}>
                Spreadsheet
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, selectedFormat === 'pdf' && styles.formatOptionActive]}
              onPress={() => setSelectedFormat('pdf')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFormat === 'pdf' }}
              accessibilityLabel="Format Dokumen PDF"
            >
              <AppText style={styles.formatEmoji}>📑</AppText>
              <AppText
                variant="body"
                style={[styles.formatText, selectedFormat === 'pdf' && styles.formatTextActive]}
              >
                PDF Laporan
              </AppText>
              <AppText variant="caption" style={styles.formatSubtext}>
                Siap cetak
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, selectedFormat === 'csv' && styles.formatOptionActive]}
              onPress={() => setSelectedFormat('csv')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFormat === 'csv' }}
              accessibilityLabel="Format CSV text"
            >
              <AppText style={styles.formatEmoji}>📄</AppText>
              <AppText
                variant="body"
                style={[styles.formatText, selectedFormat === 'csv' && styles.formatTextActive]}
              >
                CSV
              </AppText>
              <AppText variant="caption" style={styles.formatSubtext}>
                Pemisah koma
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, selectedFormat === 'json' && styles.formatOptionActive]}
              onPress={() => setSelectedFormat('json')}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedFormat === 'json' }}
              accessibilityLabel="Format data JSON"
            >
              <AppText style={styles.formatEmoji}>📦</AppText>
              <AppText
                variant="body"
                style={[styles.formatText, selectedFormat === 'json' && styles.formatTextActive]}
              >
                JSON
              </AppText>
              <AppText variant="caption" style={styles.formatSubtext}>
                Cadangan data
              </AppText>
            </TouchableOpacity>
          </View>

          {isExporting ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={theme.colors.primary[500]} />
              <AppText variant="caption" style={styles.loadingText}>
                Memproses dan menyiapkan dokumen...
              </AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              title="Batal"
              variant="secondary"
              onPress={onClose}
              disabled={isExporting}
              style={styles.cancelBtn}
            />
            <AppButton
              title={isExporting ? 'Memproses...' : 'Unduh & Simpan'}
              variant="primary"
              onPress={handleExport}
              disabled={isExporting}
              style={styles.exportBtn}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  closeText: {
    fontSize: 18,
    color: theme.colors.neutral[500],
    padding: theme.spacing.xs,
  },
  description: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing.md,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  formatOption: {
    width: '48%',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  formatOptionActive: {
    borderColor: theme.colors.primary[600],
    backgroundColor: theme.colors.primary[50],
  },
  formatEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  formatText: {
    color: theme.colors.text,
    fontWeight: theme.typography.fontWeights.semibold,
    fontSize: 13,
  },
  formatTextActive: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  formatSubtext: {
    color: theme.colors.neutral[400],
    fontSize: 11,
    marginTop: 2,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  loadingText: {
    color: theme.colors.primary[600],
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cancelBtn: {
    flex: 1,
  },
  exportBtn: {
    flex: 1,
  },
});
