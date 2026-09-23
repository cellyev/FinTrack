import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { useUserPreferences } from '@/core/preferences/preferences-store';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { theme } from '@/core/ui/tokens/theme';

const accountRepo = new SqliteAccountRepository();
const categoryRepo = new SqliteCategoryRepository();

export interface PreferencesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const {
    defaultAccountId,
    defaultCategoryId,
    currencyDisplay,
    hapticsEnabled,
    setDefaultAccountId,
    setDefaultCategoryId,
    setCurrencyDisplay,
    setHapticsEnabled,
  } = useUserPreferences();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (visible && user) {
      accountRepo.listByUser(user.id).then((res) => {
        if (res.success) setAccounts(res.data);
      });
      categoryRepo.listByUser(user.id, 'expense').then((res) => {
        if (res.success) setCategories(res.data);
      });
    }
  }, [visible, user]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <AppText variant="titleMedium" style={styles.title}>
                Preferensi Aplikasi
              </AppText>
              <AppText variant="caption" style={styles.subtitle}>
                Atur akun default, format angka & umpan balik
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup">
              <AppText style={styles.closeText}>✕</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Default Account */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                AKUN DEFAULT TRANSAKSI
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, !defaultAccountId && styles.chipActive]}
                    onPress={() => setDefaultAccountId(undefined)}
                  >
                    <AppText
                      variant="caption"
                      style={[styles.chipText, !defaultAccountId && styles.chipTextActive]}
                    >
                      Pilih Manual
                    </AppText>
                  </TouchableOpacity>
                  {accounts.map((acc) => {
                    const isSelected = defaultAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setDefaultAccountId(acc.id)}
                      >
                        <AppText
                          variant="caption"
                          style={[styles.chipText, isSelected && styles.chipTextActive]}
                        >
                          {acc.name}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Default Category */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                KATEGORI DEFAULT PENGELUARAN
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, !defaultCategoryId && styles.chipActive]}
                    onPress={() => setDefaultCategoryId(undefined)}
                  >
                    <AppText
                      variant="caption"
                      style={[styles.chipText, !defaultCategoryId && styles.chipTextActive]}
                    >
                      Pilih Manual
                    </AppText>
                  </TouchableOpacity>
                  {categories.map((cat) => {
                    const isSelected = defaultCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setDefaultCategoryId(cat.id)}
                      >
                        <AppText
                          variant="caption"
                          style={[styles.chipText, isSelected && styles.chipTextActive]}
                        >
                          {cat.name}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Currency Format */}
            <View style={styles.section}>
              <AppText variant="caption" style={styles.sectionLabel}>
                FORMAT TAMPILAN MATA UANG
              </AppText>
              <View style={styles.switchRow}>
                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    currencyDisplay === 'standard' && styles.formatOptionActive,
                  ]}
                  onPress={() => setCurrencyDisplay('standard')}
                >
                  <AppText
                    variant="body"
                    style={[
                      styles.formatOptionText,
                      currencyDisplay === 'standard' && styles.formatOptionTextActive,
                    ]}
                  >
                    Standar (Rp 50.000)
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.formatOption,
                    currencyDisplay === 'short' && styles.formatOptionActive,
                  ]}
                  onPress={() => setCurrencyDisplay('short')}
                >
                  <AppText
                    variant="body"
                    style={[
                      styles.formatOptionText,
                      currencyDisplay === 'short' && styles.formatOptionTextActive,
                    ]}
                  >
                    Ringkas (50rb)
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Haptic Feedback Switch */}
            <View style={styles.switchContainer}>
              <View style={styles.switchInfo}>
                <AppText variant="body" style={styles.switchTitle}>
                  Getaran Sentuhan (Haptic Feedback)
                </AppText>
                <AppText variant="caption" style={styles.switchDesc}>
                  Memberikan getaran halus saat menyimpan transaksi atau menekan tombol penting.
                </AppText>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary[500] }}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <AppButton
              title="Simpan & Tutup"
              variant="primary"
              onPress={onClose}
              style={styles.closeBtn}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '85%',
    paddingBottom: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
  },
  subtitle: {
    color: theme.colors.textMuted,
  },
  closeText: {
    fontSize: 18,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  chipScroll: {
    marginVertical: theme.spacing.xxs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  chipActive: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  chipText: {
    color: theme.colors.textMuted,
  },
  chipTextActive: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  switchRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  formatOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
  },
  formatOptionActive: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  formatOptionText: {
    color: theme.colors.textMuted,
  },
  formatOptionTextActive: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeights.bold,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  switchInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  switchTitle: {
    fontWeight: theme.typography.fontWeights.semibold,
  },
  switchDesc: {
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  closeBtn: {
    width: '100%',
  },
});
