import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { CategoryType } from '../../domain/category';
import { useCategoryManagement } from '../use-category-management';
import { theme } from '@/core/ui/tokens/theme';

export const CATEGORY_ICON_OPTIONS = [
  '🍽️', '☕', '🚗', '🛍️', '🧾', '🎮', '💊', '📚', '📦', '🏠',
  '✈️', '🛒', '💵', '🎁', '📈', '🎉', '💰', '💼', '💻', '💡',
  '🔧', '🐾', '⚽', '🎨',
];

export const CATEGORY_COLOR_OPTIONS = [
  '#FF5722', '#03A9F4', '#E91E63', '#FF9800', '#9C27B0',
  '#4CAF50', '#3F51B5', '#00897B', '#2E7D32', '#7B1FA2',
  '#F9A825', '#607D8B',
];

export function CreateCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType: CategoryType = params.type === 'income' ? 'income' : 'expense';

  const [type, setType] = useState<CategoryType>(initialType);
  const [name, setName] = useState<string>('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { createCategory } = useCategoryManagement();

  const handleSubmit = async () => {
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

    const result = await createCategory({
      name: trimmed,
      type,
      icon,
      color,
      isSystem: false,
    });

    setIsSubmitting(false);

    if (result.success) {
      router.back();
    } else {
      setErrorMessage(result.error ?? 'Gagal membuat kategori');
    }
  };

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <AppText variant="titleLarge">Tambah Kategori Baru</AppText>
          <AppText variant="bodyMuted">
            Kategori kustom akan langsung tersimpan di database lokal perangkat Anda.
          </AppText>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AppText variant="caption" style={styles.errorText}>
              ⚠️ {errorMessage}
            </AppText>
          </View>
        ) : null}

        {/* Category Type Selector */}
        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            TIPE KATEGORI
          </AppText>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'expense' && styles.typeButtonExpense]}
              onPress={() => setType('expense')}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === 'expense' }}
              accessibilityLabel="Pilih Tipe Pengeluaran"
            >
              <AppText
                variant="body"
                style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextSelected]}
              >
                💸 Pengeluaran
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, type === 'income' && styles.typeButtonIncome]}
              onPress={() => setType('income')}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === 'income' }}
              accessibilityLabel="Pilih Tipe Pemasukan"
            >
              <AppText
                variant="body"
                style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextSelected]}
              >
                💰 Pemasukan
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Name Input */}
        <View style={styles.section}>
          <AppInput
            label="Nama Kategori"
            placeholder="Contoh: Kopi Harian, Langganan Netflix..."
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errorMessage) setErrorMessage(null);
            }}
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
                  onPress={() => setIcon(ic)}
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
                  onPress={() => setColor(c)}
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

        {/* Submit Actions */}
        <View style={styles.actions}>
          <AppButton
            title="Simpan Kategori"
            variant="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || !name.trim()}
            accessibilityLabel="Simpan kategori baru"
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
  sectionLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  typeButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 48,
  },
  typeButtonExpense: {
    borderColor: theme.colors.danger[500],
    backgroundColor: `${theme.colors.danger[500]}22`,
  },
  typeButtonIncome: {
    borderColor: theme.colors.success[500],
    backgroundColor: `${theme.colors.success[500]}22`,
  },
  typeButtonText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  typeButtonTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
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
  cancelButton: {
    marginTop: theme.spacing.xs,
  },
});
