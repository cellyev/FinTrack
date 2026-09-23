import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useScreenFocus } from '@/core/ui/hooks/use-screen-focus';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { useCategoryManagement } from '../use-category-management';
import { theme } from '@/core/ui/tokens/theme';

export function CategoryListScreen() {
  const router = useRouter();
  const {
    activeTab,
    setActiveTab,
    systemCategories,
    customCategories,
    isLoading,
    error,
    refresh,
    archiveCategory,
  } = useCategoryManagement();

  useScreenFocus(() => {
    refresh();
  }, [refresh]);

  const handleArchive = (id: string, name: string) => {
    Alert.alert(
      'Arsipkan Kategori?',
      `Kategori "${name}" tidak akan muncul lagi pada transaksi baru. Transaksi lama yang menggunakan kategori ini tetap aman.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Arsipkan',
          style: 'destructive',
          onPress: async () => {
            const res = await archiveCategory(id);
            if (!res.success) {
              Alert.alert('Gagal Mengarsipkan', res.error);
            }
          },
        },
      ]
    );
  };

  return (
    <AppScreen style={styles.container}>
      <View style={styles.header}>
        <AppText variant="titleLarge">Kelola Kategori</AppText>
        <AppText variant="bodyMuted">
          Atur kategori pemasukan dan pengeluaran transaksi Anda.
        </AppText>
      </View>

      {/* Segmented Tab */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expense' && styles.tabButtonActive]}
          onPress={() => setActiveTab('expense')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'expense' }}
          accessibilityLabel="Tab Kategori Pengeluaran"
        >
          <AppText
            variant="body"
            style={[styles.tabText, activeTab === 'expense' && styles.tabTextActive]}
          >
            💸 Pengeluaran
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'income' && styles.tabButtonActive]}
          onPress={() => setActiveTab('income')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'income' }}
          accessibilityLabel="Tab Kategori Pemasukan"
        >
          <AppText
            variant="body"
            style={[styles.tabText, activeTab === 'income' && styles.tabTextActive]}
          >
            💰 Pemasukan
          </AppText>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <LoadingState message="Memuat daftar kategori..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Custom Categories Section */}
          <View style={styles.sectionHeaderRow}>
            <AppText variant="caption" style={styles.sectionTitle}>
              KATEGORI SAYA ({customCategories.length})
            </AppText>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/categories/create', params: { type: activeTab } })}
              accessibilityRole="button"
              accessibilityLabel="Tambah Kategori Kustom Baru"
            >
              <AppText variant="caption" style={styles.addTextCta}>
                + Tambah Kategori
              </AppText>
            </TouchableOpacity>
          </View>

          {customCategories.length === 0 ? (
            <View style={styles.emptyCustomBox}>
              <AppText variant="bodyMuted" style={styles.emptyCustomText}>
                Belum ada kategori kustom. Anda dapat menambahkan kategori baru untuk kebutuhan spesifik.
              </AppText>
              <AppButton
                title="+ Tambah Kategori Kustom"
                variant="secondary"
                onPress={() => router.push({ pathname: '/categories/create', params: { type: activeTab } })}
                style={styles.emptyAddButton}
              />
            </View>
          ) : (
            <View style={styles.listContainer}>
              {customCategories.map((cat) => (
                <View key={cat.id} style={styles.categoryCard}>
                  <View style={styles.cardLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: cat.color ? `${cat.color}22` : theme.colors.surfaceSubtle },
                      ]}
                    >
                      <AppText variant="titleMedium">{cat.icon ?? '🏷️'}</AppText>
                    </View>
                    <AppText variant="body" style={styles.catName}>
                      {cat.name}
                    </AppText>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() =>
                        router.push({
                          pathname: '/categories/[id]',
                          params: { id: cat.id },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Ubah kategori ${cat.name}`}
                    >
                      <AppText variant="caption" style={styles.editActionText}>
                        Ubah
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconButton}
                      onPress={() => handleArchive(cat.id, cat.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Arsipkan kategori ${cat.name}`}
                    >
                      <AppText variant="caption" style={styles.archiveActionText}>
                        Arsipkan
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* System Default Categories Section */}
          <View style={styles.sectionHeaderRow}>
            <AppText variant="caption" style={styles.sectionTitle}>
              KATEGORI SISTEM ({systemCategories.length})
            </AppText>
          </View>

          <View style={styles.listContainer}>
            {systemCategories.map((cat) => (
              <View key={cat.id} style={styles.systemCategoryCard}>
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: cat.color ? `${cat.color}22` : theme.colors.surfaceSubtle },
                    ]}
                  >
                    <AppText variant="titleMedium">{cat.icon ?? '🏷️'}</AppText>
                  </View>
                  <AppText variant="body" style={styles.catName}>
                    {cat.name}
                  </AppText>
                </View>
                <View style={styles.systemBadge}>
                  <AppText variant="caption" style={styles.systemBadgeText}>
                    Sistem
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Bottom Sticky Create CTA */}
      <View style={styles.bottomCta}>
        <AppButton
          title={`+ Tambah Kategori ${activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}`}
          variant="primary"
          onPress={() => router.push({ pathname: '/categories/create', params: { type: activeTab } })}
          accessibilityLabel="Buat kategori baru"
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    paddingVertical: theme.spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    minHeight: 44,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary[600],
  },
  tabText: {
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl + 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  addTextCta: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  listContainer: {
    gap: theme.spacing.xs,
  },
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56,
  },
  systemCategoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  catName: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  actionIconButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionText: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  archiveActionText: {
    color: theme.colors.danger[500],
    fontWeight: '600',
  },
  systemBadge: {
    backgroundColor: theme.colors.neutral[800],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
  },
  systemBadgeText: {
    color: theme.colors.neutral[400],
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  emptyCustomBox: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyCustomText: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyAddButton: {
    marginTop: theme.spacing.xs,
  },
  bottomCta: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
  },
});
