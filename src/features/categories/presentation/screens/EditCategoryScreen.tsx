import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { EmptyState } from '@/core/ui/components/EmptyState';
import { TransactionListItem } from '@/features/transactions/presentation/components/TransactionListItem';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteCategoryRepository } from '../../data/sqlite-category.repository';
import { GetCategoryUseCase } from '../../application/category.usecases';
import { useCategoryManagement } from '../use-category-management';
import { useCategoryTransactions } from '../use-category-transactions';
import { CATEGORY_ICON_OPTIONS, CATEGORY_COLOR_OPTIONS } from './CreateCategoryScreen';
import { theme } from '@/core/ui/tokens/theme';

const categoryRepo = new SqliteCategoryRepository();
const getCategoryUseCase = new GetCategoryUseCase(categoryRepo);

export function EditCategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [name, setName] = useState<string>('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);
  const [isSystem, setIsSystem] = useState<boolean>(false);
  const [type, setType] = useState<string>('expense');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { updateCategory, archiveCategory } = useCategoryManagement();
  const {
    transactions,
    isLoading: isTxLoading,
    error: txError,
  } = useCategoryTransactions(id);

  const loadCategory = useCallback(async () => {
    if (!id || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await getCategoryUseCase.execute(id, user.id);
    if (result.success && result.data) {
      const cat = result.data;
      setName(cat.name);
      setIcon(cat.icon ?? CATEGORY_ICON_OPTIONS[0]);
      setColor(cat.color ?? CATEGORY_COLOR_OPTIONS[0]);
      setIsSystem(cat.isSystem);
      setType(cat.type);
    } else {
      setErrorMessage(result.success ? 'Kategori tidak ditemukan' : result.error.message);
    }
    setIsLoading(false);
  }, [id, user]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  const handleSave = async () => {
    if (isSystem) {
      Alert.alert('Proteksi Sistem', 'Kategori sistem tidak dapat diubah.');
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Nama kategori wajib diisi');
      return;
    }

    if (trimmed.length > 50) {
      setErrorMessage('Nama kategori maksimal 50 karakter');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const result = await updateCategory({
      id: id!,
      name: trimmed,
      icon,
      color,
    });

    setIsSubmitting(false);

    if (result.success) {
      router.back();
    } else {
      setErrorMessage(result.error ?? 'Gagal mengubah kategori');
    }
  };

  const handleArchive = () => {
    if (isSystem) {
      Alert.alert('Proteksi Sistem', 'Kategori sistem tidak dapat diarsipkan.');
      return;
    }

    Alert.alert(
      'Arsipkan Kategori?',
      `Kategori "${name}" tidak akan muncul lagi pada transaksi baru. Transaksi lama yang menggunakan kategori ini tetap aman tersimpan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Arsipkan',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            const res = await archiveCategory(id!);
            setIsSubmitting(false);
            if (res.success) {
              router.back();
            } else {
              setErrorMessage(res.error ?? 'Gagal mengarsipkan kategori');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <AppScreen style={styles.container}>
        <LoadingState message="Memuat kategori..." />
      </AppScreen>
    );
  }

  if (errorMessage && !name) {
    return (
      <AppScreen style={styles.container}>
        <ErrorState
          title="Kategori Tidak Ditemukan"
          message={errorMessage}
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <AppText variant="titleLarge">Ubah Kategori</AppText>
          <AppText variant="bodyMuted">
            Tipe: {type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
          </AppText>
        </View>

        {isSystem ? (
          <View style={styles.systemNoticeBox}>
            <AppText variant="caption" style={styles.systemNoticeText}>
              🔒 Kategori ini adalah kategori default sistem dan tidak dapat diubah atau dihapus.
            </AppText>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AppText variant="caption" style={styles.errorText}>
              ⚠️ {errorMessage}
            </AppText>
          </View>
        ) : null}

        {/* Category Name Input */}
        <View style={styles.section}>
          <AppInput
            label="Nama Kategori"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errorMessage) setErrorMessage(null);
            }}
            editable={!isSystem}
            accessibilityLabel="Kolom nama kategori"
          />
        </View>

        {/* Icon Picker Grid */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            PILIH IKON
          </AppText>
          <View style={styles.iconGrid}>
            {CATEGORY_ICON_OPTIONS.map((ic) => {
              const isSelected = icon === ic;
              return (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBox, isSelected && styles.iconBoxSelected]}
                  onPress={() => !isSystem && setIcon(ic)}
                  disabled={isSystem}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Pilih ikon ${ic}`}
                >
                  <AppText style={styles.iconEmoji}>{ic}</AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Color Palette Grid */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            PILIH WARNA
          </AppText>
          <View style={styles.colorGrid}>
            {CATEGORY_COLOR_OPTIONS.map((c) => {
              const isSelected = color === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorBox,
                    { backgroundColor: c },
                    isSelected && styles.colorBoxSelected,
                  ]}
                  onPress={() => !isSystem && setColor(c)}
                  disabled={isSystem}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Pilih warna ${c}`}
                >
                  {isSelected ? (
                    <AppText style={styles.colorCheckmark}>✓</AppText>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Category Transactions Stream */}
        <View style={styles.section}>
          <AppText variant="titleMedium" style={styles.sectionTitle}>
            Riwayat Transaksi Kategori
          </AppText>

          {isTxLoading ? (
            <LoadingState message="Memuat transaksi kategori..." />
          ) : txError ? (
            <ErrorState message={txError} />
          ) : transactions.length === 0 ? (
            <EmptyState
              title="Belum Ada Transaksi"
              description="Belum ada transaksi yang menggunakan kategori ini."
            />
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx) => (
                <TransactionListItem
                  key={tx.id}
                  item={tx}
                  onPress={() => router.push(`/transactions/${tx.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        {!isSystem ? (
          <View style={styles.actions}>
            <AppButton
              title="Simpan Perubahan"
              variant="primary"
              onPress={handleSave}
              isLoading={isSubmitting}
              disabled={isSubmitting || !name.trim()}
              accessibilityLabel="Simpan perubahan kategori"
            />
            <AppButton
              title="Arsipkan Kategori"
              variant="danger"
              onPress={handleArchive}
              disabled={isSubmitting}
              style={styles.archiveButton}
              accessibilityLabel="Arsipkan kategori ini"
            />
            <AppButton
              title="Batal"
              variant="secondary"
              onPress={() => router.back()}
              disabled={isSubmitting}
              style={styles.cancelButton}
              accessibilityLabel="Batal dan kembali"
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <AppButton
              title="Kembali"
              variant="secondary"
              onPress={() => router.back()}
              accessibilityLabel="Kembali"
            />
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  scrollContent: {
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  systemNoticeBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  systemNoticeText: {
    color: theme.colors.neutral[300],
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: `${theme.colors.danger[500]}22`,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.danger[500],
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger[500],
    fontWeight: '600',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  txList: {
    gap: theme.spacing.xs,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: `${theme.colors.primary[500]}33`,
  },
  iconEmoji: {
    fontSize: 22,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  colorBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBoxSelected: {
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  colorCheckmark: {
    color: theme.colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
  actions: {
    marginTop: theme.spacing.md,
  },
  archiveButton: {
    marginTop: theme.spacing.sm,
  },
  cancelButton: {
    marginTop: theme.spacing.xs,
  },
});
