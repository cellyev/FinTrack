import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { theme } from '../tokens/theme';
import { CreateDebtModal } from '@/features/debts/presentation/screens/CreateDebtModal';
import { useDebts } from '@/features/debts/presentation/use-debts';

export interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const { createDebt } = useDebts();
  const [debtModalVisible, setDebtModalVisible] = useState<boolean>(false);

  const handleAction = (route: string) => {
    onClose();
    router.push(route as unknown as never);
  };

  const handleOpenDebt = () => {
    onClose();
    setDebtModalVisible(true);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <View style={styles.indicator} />
              <AppText variant="titleMedium" style={styles.sheetTitle}>
                Tambah Transaksi Cepat
              </AppText>
              <AppText variant="caption" style={styles.sheetSubtitle}>
                Pilih jenis mutasi keuangan yang ingin Anda catat
              </AppText>
            </View>

            <View style={styles.actionGrid}>
              {/* 1. Pengeluaran */}
              <TouchableOpacity
                style={[styles.actionCard, styles.expenseBorder]}
                onPress={() => handleAction('/transactions/expense')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Catat Pengeluaran Baru"
              >
                <View style={[styles.iconCircle, styles.expenseBg]}>
                  <AppText style={styles.actionEmoji}>💸</AppText>
                </View>
                <View style={styles.actionTexts}>
                  <AppText variant="titleMedium" style={styles.actionTitle}>
                    Pengeluaran
                  </AppText>
                  <AppText variant="caption" style={styles.actionDesc}>
                    Belanja, tagihan, makanan & kebutuhan
                  </AppText>
                </View>
              </TouchableOpacity>

              {/* 2. Pemasukan */}
              <TouchableOpacity
                style={[styles.actionCard, styles.incomeBorder]}
                onPress={() => handleAction('/transactions/income')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Catat Pemasukan Baru"
              >
                <View style={[styles.iconCircle, styles.incomeBg]}>
                  <AppText style={styles.actionEmoji}>💰</AppText>
                </View>
                <View style={styles.actionTexts}>
                  <AppText variant="titleMedium" style={styles.actionTitle}>
                    Pemasukan
                  </AppText>
                  <AppText variant="caption" style={styles.actionDesc}>
                    Gaji, bonus, hasil usaha & transfer masuk
                  </AppText>
                </View>
              </TouchableOpacity>

              {/* 3. Transfer Antar-Akun */}
              <TouchableOpacity
                style={[styles.actionCard, styles.transferBorder]}
                onPress={() => handleAction('/transactions/transfer')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Transfer Antar-Akun"
              >
                <View style={[styles.iconCircle, styles.transferBg]}>
                  <AppText style={styles.actionEmoji}>🔄</AppText>
                </View>
                <View style={styles.actionTexts}>
                  <AppText variant="titleMedium" style={styles.actionTitle}>
                    Transfer Antar-Akun
                  </AppText>
                  <AppText variant="caption" style={styles.actionDesc}>
                    Pindah dana antar bank, e-wallet, atau tunai
                  </AppText>
                </View>
              </TouchableOpacity>

              {/* 4. Catat Hutang (Meminjam) */}
              <TouchableOpacity
                style={[styles.actionCard, styles.debtBorder]}
                onPress={handleOpenDebt}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Catat Hutang Saya"
              >
                <View style={[styles.iconCircle, styles.debtBg]}>
                  <AppText style={styles.actionEmoji}>📥</AppText>
                </View>
                <View style={styles.actionTexts}>
                  <AppText variant="titleMedium" style={styles.actionTitle}>
                    Hutang (Pinjam Uang)
                  </AppText>
                  <AppText variant="caption" style={styles.actionDesc}>
                    Kewajiban bayar ke orang lain
                  </AppText>
                </View>
              </TouchableOpacity>

              {/* 5. Catat Piutang (Meminjamkan) */}
              <TouchableOpacity
                style={[styles.actionCard, styles.receivableBorder]}
                onPress={handleOpenDebt}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Catat Piutang Saya"
              >
                <View style={[styles.iconCircle, styles.receivableBg]}>
                  <AppText style={styles.actionEmoji}>📤</AppText>
                </View>
                <View style={styles.actionTexts}>
                  <AppText variant="titleMedium" style={styles.actionTitle}>
                    Piutang (Pinjamkan Uang)
                  </AppText>
                  <AppText variant="caption" style={styles.actionDesc}>
                    Tagihan pinjaman ke orang lain
                  </AppText>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Tutup menu tambah cepat"
            >
              <AppText variant="body" style={styles.cancelText}>
                Tutup
              </AppText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Embedded CreateDebtModal for Hutang / Piutang quick entry */}
      <CreateDebtModal
        visible={debtModalVisible}
        onClose={() => setDebtModalVisible(false)}
        onSubmit={async (input) => {
          const res = await createDebt(input);
          return res.success;
        }}
      />
    </>
  );
};

export const QuickAddFab: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Tombol Tambah Cepat Transaksi"
    >
      <AppText style={styles.fabPlus}>＋</AppText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  indicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.neutral[300],
    marginBottom: theme.spacing.sm,
  },
  sheetTitle: {
    fontWeight: theme.typography.fontWeights.bold,
    marginBottom: theme.spacing.xxs,
  },
  sheetSubtitle: {
    color: theme.colors.neutral[500],
  },
  actionGrid: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  expenseBorder: {
    borderColor: `${theme.colors.danger[500]}44`,
  },
  incomeBorder: {
    borderColor: `${theme.colors.success[500]}44`,
  },
  transferBorder: {
    borderColor: `${theme.colors.primary[500]}44`,
  },
  debtBorder: {
    borderColor: `${theme.colors.warning[500]}44`,
  },
  receivableBorder: {
    borderColor: `${theme.colors.primary[600]}44`,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  expenseBg: {
    backgroundColor: `${theme.colors.danger[500]}18`,
  },
  incomeBg: {
    backgroundColor: `${theme.colors.success[500]}18`,
  },
  transferBg: {
    backgroundColor: `${theme.colors.primary[500]}18`,
  },
  debtBg: {
    backgroundColor: `${theme.colors.warning[500]}18`,
  },
  receivableBg: {
    backgroundColor: `${theme.colors.primary[600]}18`,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionTexts: {
    flex: 1,
  },
  actionTitle: {
    fontWeight: theme.typography.fontWeights.semibold,
    marginBottom: 2,
  },
  actionDesc: {
    color: theme.colors.neutral[500],
  },
  cancelBtn: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  cancelText: {
    color: theme.colors.neutral[600],
    fontWeight: theme.typography.fontWeights.medium,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 999,
  },
  fabPlus: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
  },
});
