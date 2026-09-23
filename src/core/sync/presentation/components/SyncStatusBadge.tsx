import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, View } from 'react-native';
import { AppText } from '@/core/ui/components/AppText';
import { useSyncStatus } from '../use-sync-status';
import { SyncConflictModal } from './SyncConflictModal';
import { SyncDiagnosticsModal } from '../screens/SyncDiagnosticsModal';
import { theme } from '@/core/ui/tokens/theme';
import { colors } from '@/core/ui/tokens/colors';
import { spacing } from '@/core/ui/tokens/spacing';

export interface SyncStatusBadgeProps {
  showLabel?: boolean;
  variant?: 'badge' | 'minimal';
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ showLabel = true, variant = 'badge' }) => {
  const { state, pendingCount, deadLetterCount, conflictCount, isSyncing, lastError, syncNow } = useSyncStatus();
  const [isConflictModalVisible, setIsConflictModalVisible] = useState<boolean>(false);
  const [isDiagnosticsModalVisible, setIsDiagnosticsModalVisible] = useState<boolean>(false);

  const handlePress = async () => {
    if (state === 'conflict' || (conflictCount && conflictCount > 0)) {
      setIsConflictModalVisible(true);
      return;
    }

    if (state === 'offline') {
      Alert.alert(
        'Mode Offline',
        'Perangkat tidak terhubung ke internet. Semua perubahan tersimpan aman di perangkat dan akan disinkronkan otomatis saat online.'
      );
      return;
    }

    if (state === 'error' || deadLetterCount > 0) {
      Alert.alert(
        'Status Sinkronisasi',
        lastError || `Terdapat ${deadLetterCount} mutasi data yang terhenti. Buka detail diagnostik atau sinkronkan ulang sekarang?`,
        [
          { text: 'Tutup', style: 'cancel' },
          { text: 'Detail Diagnostik', onPress: () => setIsDiagnosticsModalVisible(true) },
          { text: 'Sync Ulang', onPress: () => syncNow() },
        ]
      );
      return;
    }

    if (isSyncing) {
      return;
    }

    await syncNow();
  };

  const isMinimal = variant === 'minimal';
  let badgeColor = isMinimal ? colors.neutral[500] : colors.success[500];
  let badgeBg = isMinimal ? 'transparent' : 'rgba(34, 197, 94, 0.12)';
  let icon = isMinimal ? '☁' : '✓';
  let labelText = 'Tersinkron';

  if (state === 'conflict' || (conflictCount && conflictCount > 0)) {
    badgeColor = colors.warning[500];
    badgeBg = isMinimal ? 'transparent' : 'rgba(245, 158, 11, 0.15)';
    icon = isMinimal ? '☁ ⚠' : '⚠';
    labelText = conflictCount && conflictCount > 0 ? `${conflictCount} konflik` : 'Konflik';
  } else if (state === 'offline') {
    badgeColor = colors.neutral[500];
    badgeBg = isMinimal ? 'transparent' : 'rgba(234, 179, 8, 0.12)';
    icon = isMinimal ? '☁ ⚡' : '⚡';
    labelText = 'Offline';
  } else if (isSyncing || state === 'syncing') {
    badgeColor = colors.primary[500];
    badgeBg = isMinimal ? 'transparent' : 'rgba(14, 165, 233, 0.12)';
    icon = isMinimal ? '☁' : '↻';
    labelText = 'Menyinkronkan...';
  } else if (state === 'error' || deadLetterCount > 0) {
    badgeColor = colors.danger[500];
    badgeBg = isMinimal ? 'transparent' : 'rgba(239, 68, 68, 0.12)';
    icon = isMinimal ? '☁ ⚠' : '⚠';
    labelText = deadLetterCount > 0 ? `${deadLetterCount} gagal` : 'Gagal';
  } else if (pendingCount > 0) {
    badgeColor = colors.info[500];
    badgeBg = isMinimal ? 'transparent' : 'rgba(59, 130, 246, 0.12)';
    icon = isMinimal ? '☁' : '●';
    labelText = `${pendingCount} pending`;
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          isMinimal ? styles.minimalContainer : styles.badgeContainer,
          { backgroundColor: badgeBg, borderColor: isMinimal ? 'transparent' : badgeColor }
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Status sinkronisasi: ${labelText}. Tekan untuk info atau sinkronisasi.`}
      >
        {isSyncing ? (
          <View style={styles.syncingContainer}>
            {isMinimal && <AppText style={[styles.minimalIcon, { color: badgeColor, marginRight: 4 }]}>☁</AppText>}
            <ActivityIndicator size="small" color={badgeColor} style={isMinimal ? styles.minimalSpinner : styles.spinner} />
          </View>
        ) : (
          <AppText style={[isMinimal ? styles.minimalIcon : styles.icon, { color: badgeColor }]}>{icon}</AppText>
        )}
        {showLabel && !isMinimal && (
          <AppText style={[styles.label, { color: badgeColor }]} numberOfLines={1}>
            {labelText}
          </AppText>
        )}
      </TouchableOpacity>

      <SyncConflictModal
        visible={isConflictModalVisible}
        onClose={() => setIsConflictModalVisible(false)}
      />

      <SyncDiagnosticsModal
        visible={isDiagnosticsModalVisible}
        onClose={() => setIsDiagnosticsModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  badgeContainer: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: theme.radii.full,
    borderWidth: 1,
  },
  minimalContainer: {
    padding: 0,
    borderWidth: 0,
    justifyContent: 'center',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    transform: [{ scale: 0.7 }],
  },
  minimalSpinner: {
    transform: [{ scale: 0.6 }],
  },
  icon: {
    fontSize: 11,
    fontWeight: '700',
  },
  minimalIcon: {
    fontSize: 14,
    opacity: 0.8,
  },
  label: {
    fontSize: theme.typography.fontSizes.xs,
    fontWeight: theme.typography.fontWeights.medium,
  },
});
