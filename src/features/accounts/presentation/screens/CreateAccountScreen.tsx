import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { useAccounts } from '../use-accounts';
import { AccountType } from '../../domain/account';
import { Money } from '@/core/domain/money';
import { theme } from '@/core/ui/tokens/theme';

const PRESET_COLORS = [
  '#0055A5', // BCA Blue
  '#E60012', // Red
  '#008A00', // Green / GoPay
  '#F58220', // Orange
  '#7A3E9D', // Purple / OVO
  '#118EEA', // DANA Blue
  '#4A5568', // Slate / Cash
];

export function CreateAccountScreen() {
  const router = useRouter();
  const { createAccount } = useAccounts();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [openingBalanceStr, setOpeningBalanceStr] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [balanceError, setBalanceError] = useState<string | undefined>();

  const handleOpeningBalanceChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setOpeningBalanceStr(cleaned);
    if (balanceError) setBalanceError(undefined);
  };

  const formatBalanceInput = (raw: string) => {
    if (!raw) return '';
    const num = parseInt(raw, 10);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const handleSubmit = async () => {
    let hasError = false;

    if (!name.trim()) {
      setNameError('Nama akun wajib diisi');
      hasError = true;
    } else if (name.trim().length > 80) {
      setNameError('Nama akun maksimal 80 karakter');
      hasError = true;
    } else {
      setNameError(undefined);
    }

    let openingBalance: Money | undefined;
    if (openingBalanceStr) {
      const num = parseInt(openingBalanceStr, 10);
      if (num < 0) {
        setBalanceError('Saldo awal tidak boleh bernilai negatif');
        hasError = true;
      } else if (num > 0) {
        openingBalance = Money.fromDecimal(num, 'IDR');
      }
    }

    if (hasError) return;

    setIsSubmitting(true);
    const success = await createAccount({
      name: name.trim(),
      type,
      color: selectedColor,
      openingBalance,
    });

    setIsSubmitting(false);

    if (success) {
      router.back();
    } else {
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuat akun. Silakan coba lagi.');
    }
  };

  return (
    <AppScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AppText variant="titleLarge" style={styles.title}>
          Tambah Akun Baru
        </AppText>
        <AppText variant="bodyMuted" style={styles.subtitle}>
          Tetapkan tempat uang Anda berada (Dompet tunai, rekening bank, atau e-wallet).
        </AppText>

        <AppInput
          label="Nama Akun *"
          placeholder="Contoh: Dompet Utama, BCA, GoPay"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(undefined);
          }}
          error={nameError}
          maxLength={80}
        />

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            Tipe Akun *
          </AppText>
          <View style={styles.typeSelector}>
            {(['cash', 'bank', 'ewallet'] as AccountType[]).map((t) => {
              const label = t === 'cash' ? 'Tunai' : t === 'bank' ? 'Bank' : 'E-Wallet';
              const isSelected = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                  onPress={() => setType(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Tipe ${label}`}
                >
                  <AppText
                    variant="body"
                    style={[styles.typeText, isSelected && styles.typeTextSelected]}
                  >
                    {label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <AppInput
          label="Saldo Awal (Opsional)"
          placeholder="0"
          value={formatBalanceInput(openingBalanceStr)}
          onChangeText={handleOpeningBalanceChange}
          keyboardType="numeric"
          error={balanceError}
          helperText="Saldo uang yang sudah ada saat ini. Boleh dikosongkan jika 0."
        />

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionLabel}>
            Warna Indikator
          </AppText>
          <View style={styles.colorPalette}>
            {PRESET_COLORS.map((c) => {
              const isSelected = selectedColor === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    isSelected && styles.colorCircleSelected,
                  ]}
                  onPress={() => setSelectedColor(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Warna ${c}`}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <AppButton
            title={isSubmitting ? 'Menyimpan...' : 'Simpan Akun'}
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={styles.submitButton}
            accessibilityLabel="Simpan akun baru"
          />
          <AppButton
            title="Batal"
            variant="secondary"
            onPress={() => router.back()}
            disabled={isSubmitting}
            accessibilityLabel="Batal"
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  title: {
    marginBottom: theme.spacing.xxs,
  },
  subtitle: {
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  typeOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    minHeight: 44,
  },
  typeOptionSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.surfaceSubtle,
  },
  typeText: {
    color: theme.colors.textMuted,
  },
  typeTextSelected: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  colorPalette: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: theme.colors.text,
    transform: [{ scale: 1.15 }],
  },
  actionButtons: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  submitButton: {
    marginTop: theme.spacing.xs,
  },
});
