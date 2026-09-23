import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { CategorySpendingItem } from '../../domain/analytics-types';
import { theme } from '@/core/ui/tokens/theme';
import { Feather } from '@expo/vector-icons';

export interface CategorySpendingCardProps {
  categories: CategorySpendingItem[];
}

export const CategorySpendingCard: React.FC<CategorySpendingCardProps> = ({ categories }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AppText variant="titleMedium" style={styles.title}>
          Distribusi Pengeluaran
        </AppText>
        <AppText variant="caption" style={styles.countText}>
          {categories.length} Kategori
        </AppText>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather 
            name="pie-chart" 
            size={40} 
            color={theme.colors.neutral[300]} 
            style={styles.emptyIcon}
          />
          <AppText variant="body" style={styles.emptyText}>
            Belum ada pengeluaran di bulan ini
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {categories.map((item) => {
            const barWidth = Math.min(100, Math.max(2, item.percentage));
            const barColor = item.categoryColor || theme.colors.primary[500];

            return (
              <View key={item.categoryId} style={styles.itemRow}>
                <View style={styles.itemHeader}>
                  <View style={styles.categoryInfo}>
                    <AppText style={styles.categoryIcon}>{item.categoryIcon || '🏷️'}</AppText>
                    <AppText variant="body" style={styles.categoryName} numberOfLines={1}>
                      {item.categoryName}
                    </AppText>
                  </View>

                  <View style={styles.amountInfo}>
                    <AppText variant="body" style={styles.amountText}>
                      {item.amount.formatDisplay()}
                    </AppText>
                    <AppText variant="caption" style={styles.percentageText}>
                      {item.percentage.toFixed(1)}%
                    </AppText>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.barBackground}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontWeight: theme.typography.fontWeights.bold,
    color: theme.colors.text,
  },
  countText: {
    color: theme.colors.neutral[500],
  },
  list: {
    gap: theme.spacing.md,
  },
  itemRow: {
    gap: theme.spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  categoryName: {
    fontWeight: theme.typography.fontWeights.medium,
    color: theme.colors.text,
    flex: 1,
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontWeight: theme.typography.fontWeights.semibold,
    color: theme.colors.text,
  },
  percentageText: {
    color: theme.colors.neutral[500],
  },
  barBackground: {
    height: 6,
    backgroundColor: theme.colors.neutral[100],
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  emptyIcon: {
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.neutral[500],
  },
});
