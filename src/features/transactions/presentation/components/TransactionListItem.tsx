import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { TransactionListItemDTO } from '../../application/transaction.usecases';
import { theme } from '@/core/ui/tokens/theme';

interface TransactionListItemProps {
  item: TransactionListItemDTO;
  onPress: () => void;
}

export const TransactionListItem: React.FC<TransactionListItemProps> = ({ item, onPress }) => {
  const isExpense = item.type === 'expense';
  const isIncome = item.type === 'income';
  const isTransfer = item.type === 'transfer';
  const isOpeningBalance = item.type === 'opening_balance';

  // Redundant visual encoding: Icon, Sign, Color, Label
  const getIcon = () => {
    if (isExpense) return '💸';
    if (isIncome) return '💰';
    if (isTransfer) return '🔄';
    return '🏦';
  };

  const getAmountPrefix = () => {
    if (isExpense) return '- ';
    if (isIncome) return '+ ';
    return '';
  };

  const getAmountColor = () => {
    if (isExpense) return theme.colors.danger[500];
    if (isIncome) return theme.colors.success[500];
    if (isTransfer) return theme.colors.info[500];
    return theme.colors.primary[500];
  };

  const getAccountDescription = () => {
    if (isTransfer) {
      const src = item.sourceAccount?.name ?? 'Akun';
      const dst = item.destinationAccount?.name ?? 'Akun';
      return `${src} → ${dst}`;
    }
    if (isExpense) {
      return item.sourceAccount?.name ?? 'Akun Sumber';
    }
    if (isIncome || isOpeningBalance) {
      return item.destinationAccount?.name ?? 'Akun Tujuan';
    }
    return '';
  };

  const getTitle = () => {
    if (isTransfer) return 'Transfer Antar-Akun';
    if (isOpeningBalance) return 'Saldo Awal';
    return item.categorySummary;
  };

  const amountDisplay = `${getAmountPrefix()}${item.amount.formatDisplay()}`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${getTitle()}, ${getAccountDescription()}, ${amountDisplay}`}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: item.categoryColor
                ? `${item.categoryColor}22`
                : theme.colors.surfaceSubtle,
            },
          ]}
        >
          <AppText variant="titleMedium" style={styles.iconText}>
            {getIcon()}
          </AppText>
        </View>
        <View style={styles.infoCol}>
          <AppText variant="body" style={styles.title} numberOfLines={1}>
            {getTitle()}
          </AppText>
          <View style={styles.subRow}>
            <AppText variant="caption" style={styles.accountText} numberOfLines={1}>
              {getAccountDescription()}
            </AppText>
            {item.note ? (
              <AppText variant="caption" style={styles.noteText} numberOfLines={1}>
                • {item.note}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.rightSection}>
        <AppText
          variant="titleMedium"
          style={[styles.amountText, { color: getAmountColor() }]}
          numberOfLines={1}
        >
          {amountDisplay}
        </AppText>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
    minHeight: 64,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  iconText: {
    fontSize: 18,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  accountText: {
    color: theme.colors.textMuted,
  },
  noteText: {
    color: theme.colors.neutral[400],
    marginLeft: 4,
    flexShrink: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontWeight: '700',
  },
});
