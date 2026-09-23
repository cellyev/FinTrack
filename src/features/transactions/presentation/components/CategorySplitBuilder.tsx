import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { CurrencyInput } from '@/core/ui/components/CurrencyInput';
import { Category } from '@/features/categories/domain/category';
import { theme } from '@/core/ui/tokens/theme';

export interface SplitItem {
  id: string;
  categoryId: string;
  amountStr: string;
  note?: string;
}

interface CategorySplitBuilderProps {
  totalAmount: number;
  categories: Category[];
  splits: SplitItem[];
  onChangeSplits: (splits: SplitItem[]) => void;
}

export const CategorySplitBuilder: React.FC<CategorySplitBuilderProps> = ({
  totalAmount,
  categories,
  splits,
  onChangeSplits,
}) => {
  // Calculate allocated sum in Rupiah
  const allocatedSum = splits.reduce((sum, item) => {
    const num = parseInt(item.amountStr.replace(/[^0-9]/g, ''), 10);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const remaining = totalAmount - allocatedSum;
  const isBalanced = totalAmount > 0 && remaining === 0;
  const isOverAllocated = remaining < 0;

  const handleCategorySelect = (splitId: string, categoryId: string) => {
    const updated = splits.map((s) => (s.id === splitId ? { ...s, categoryId } : s));
    onChangeSplits(updated);
  };

  const handleAmountChange = (splitId: string, text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const updated = splits.map((s) => (s.id === splitId ? { ...s, amountStr: cleaned } : s));
    onChangeSplits(updated);
  };

  const handleQuickFillRemaining = (splitId: string) => {
    if (remaining > 0) {
      const current = splits.find((s) => s.id === splitId);
      const currentAmount = parseInt((current?.amountStr || '0').replace(/[^0-9]/g, ''), 10) || 0;
      const newAmount = currentAmount + remaining;
      handleAmountChange(splitId, newAmount.toString());
    }
  };

  const handleAddSplit = () => {
    const newId = `split-${Date.now()}-${Math.random()}`;
    const defaultCatId = categories.length > 0 ? categories[0].id : '';
    const autoAmount = remaining > 0 ? remaining.toString() : '';
    onChangeSplits([...splits, { id: newId, categoryId: defaultCatId, amountStr: autoAmount }]);
  };

  const handleRemoveSplit = (splitId: string) => {
    if (splits.length <= 1) return;
    const updated = splits.filter((s) => s.id !== splitId);
    onChangeSplits(updated);
  };

  const formatIDR = (num: number) => `Rp ${Math.abs(num).toLocaleString('id-ID')}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="titleMedium">Alokasi Kategori (Split)</AppText>
        <AppText variant="caption">Total harus sama dengan nominal transaksi</AppText>
      </View>

      {/* Allocation Status Card */}
      <View
        style={[
          styles.statusCard,
          isBalanced ? styles.statusBalanced : isOverAllocated ? styles.statusOver : styles.statusUnder,
        ]}
      >
        <View style={styles.statusRow}>
          <View>
            <AppText variant="caption" style={styles.statusLabel}>
              TERALOKASI
            </AppText>
            <AppText variant="titleMedium" style={styles.statusValue}>
              {formatIDR(allocatedSum)}
            </AppText>
          </View>
          <View style={styles.statusRight}>
            <AppText variant="caption" style={styles.statusLabel}>
              SISA
            </AppText>
            <AppText
              variant="titleMedium"
              style={[
                styles.statusValue,
                isBalanced
                  ? styles.textSuccess
                  : isOverAllocated
                  ? styles.textDanger
                  : styles.textWarning,
              ]}
            >
              {remaining === 0
                ? 'Rp 0 (Pas)'
                : isOverAllocated
                ? `- ${formatIDR(remaining)} (Lebih)`
                : formatIDR(remaining)}
            </AppText>
          </View>
        </View>

        {!isBalanced && totalAmount > 0 ? (
          <AppText
            variant="caption"
            style={[styles.feedbackText, isOverAllocated ? styles.textDanger : styles.textWarning]}
          >
            {isOverAllocated
              ? `⚠️ Alokasi melebihi total sebesar ${formatIDR(Math.abs(remaining))}.`
              : `ℹ️ ${formatIDR(remaining)} belum dialokasikan ke kategori.`}
          </AppText>
        ) : null}
      </View>

      {/* Splits List */}
      {splits.map((split, index) => {
        return (
          <View key={split.id} style={styles.splitCard}>
            <View style={styles.splitHeader}>
              <AppText variant="caption" style={styles.splitIndex}>
                KATEGORI #{index + 1}
              </AppText>
              {splits.length > 1 ? (
                <TouchableOpacity
                  onPress={() => handleRemoveSplit(split.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus split kategori ${index + 1}`}
                >
                  <AppText variant="caption" style={styles.deleteButton}>
                    Hapus
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category Selector Chips */}
            <AppText variant="caption" style={styles.label}>
              Pilih Kategori:
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {categories.map((cat) => {
                const isSelected = split.categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      isSelected && {
                        borderColor: cat.color ?? theme.colors.primary[500],
                        backgroundColor: theme.colors.surfaceSubtle,
                      },
                    ]}
                    onPress={() => handleCategorySelect(split.id, cat.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={cat.name}
                  >
                    <View
                      style={[
                        styles.catDot,
                        { backgroundColor: cat.color ?? theme.colors.primary[500] },
                      ]}
                    />
                    <AppText
                      variant="caption"
                      style={[styles.catName, isSelected && styles.catNameSelected]}
                    >
                      {cat.name}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.amountInputRow}>
              <View style={styles.amountInputWrap}>
                <CurrencyInput
                  label="Nominal Alokasi (Rp)"
                  placeholder="0"
                  value={split.amountStr}
                  onChangeValue={(rawStr) => handleAmountChange(split.id, rawStr)}
                />
              </View>
              {remaining > 0 ? (
                <TouchableOpacity
                  style={styles.quickFillButton}
                  onPress={() => handleQuickFillRemaining(split.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Isi sisa nominal otomatis"
                >
                  <AppText variant="caption" style={styles.quickFillText}>
                    + Isi Sisa
                  </AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* Add Split Button */}
      <TouchableOpacity
        style={styles.addSplitButton}
        onPress={handleAddSplit}
        accessibilityRole="button"
        accessibilityLabel="Tambah kategori split baru"
      >
        <AppText variant="body" style={styles.addSplitText}>
          + Tambah Split Kategori
        </AppText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.sm,
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  statusBalanced: {
    borderColor: theme.colors.success[500],
  },
  statusOver: {
    borderColor: theme.colors.danger[500],
  },
  statusUnder: {
    borderColor: theme.colors.warning[500],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  statusValue: {
    color: theme.colors.text,
  },
  textSuccess: {
    color: theme.colors.success[500],
  },
  textDanger: {
    color: theme.colors.danger[500],
  },
  textWarning: {
    color: theme.colors.warning[500],
  },
  feedbackText: {
    marginTop: theme.spacing.xs,
    fontWeight: '500',
  },
  splitCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  splitIndex: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  deleteButton: {
    color: theme.colors.danger[500],
    fontWeight: '600',
  },
  label: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  categoryScroll: {
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: 36,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  catName: {
    color: theme.colors.textMuted,
  },
  catNameSelected: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  amountInputWrap: {
    flex: 1,
  },
  quickFillButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.surfaceSubtle,
    marginBottom: 4,
    height: 48,
    justifyContent: 'center',
  },
  quickFillText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  addSplitButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  addSplitText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
});
