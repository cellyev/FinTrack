import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppButton } from '@/core/ui/components/AppButton';
import { PreferencesModal } from '@/features/profile/presentation/screens/PreferencesModal';
import { SyncDiagnosticsModal } from '@/core/sync/presentation/screens/SyncDiagnosticsModal';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { theme } from '@/core/ui/tokens/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isLoading } = useAuth();
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="titleLarge" style={styles.header}>Profil & Pengaturan</AppText>

        <View style={styles.card}>
          <AppText variant="caption">EMAIL PENGGUNA</AppText>
          <AppText variant="titleMedium" style={styles.userInfo}>
            {user?.email || 'Belum masuk'}
          </AppText>

          {user?.fullName ? (
            <>
              <AppText variant="caption" style={styles.labelMargin}>NAMA LENGKAP</AppText>
              <AppText variant="body" style={styles.userInfo}>{user.fullName}</AppText>
            </>
          ) : null}

          <AppText variant="caption" style={styles.labelMargin}>MATA UANG DEFAULT</AppText>
          <AppText variant="body" style={styles.userInfo}>IDR (Indonesian Rupiah)</AppText>

          <AppText variant="caption" style={styles.labelMargin}>ZONA WAKTU</AppText>
          <AppText variant="body" style={styles.userInfo}>Asia/Jakarta</AppText>
        </View>

        <AppButton
          title="⚙️ Preferensi Aplikasi & Tampilan"
          variant="secondary"
          onPress={() => setPreferencesVisible(true)}
          style={styles.menuButton}
          accessibilityLabel="Buka pengaturan preferensi aplikasi"
        />

        <AppButton
          title="🔄 Diagnostik Sinkronisasi & Offline"
          variant="secondary"
          onPress={() => setDiagnosticsVisible(true)}
          style={styles.menuButton}
          accessibilityLabel="Buka diagnostik sinkronisasi dan offline"
        />

        <AppButton
          title="Kelola Akun Keuangan"
          variant="secondary"
          onPress={() => router.push('/accounts')}
          style={styles.menuButton}
          accessibilityLabel="Buka kelola akun keuangan"
        />

        <AppButton
          title="Kelola Kategori Transaksi"
          variant="secondary"
          onPress={() => router.push('/categories')}
          style={styles.menuButton}
          accessibilityLabel="Buka kelola kategori transaksi"
        />

        <AppButton
          title="Keluar dari Akun"
          variant="danger"
          isLoading={isLoading}
          onPress={handleSignOut}
          style={styles.signOutButton}
        />

        {/* Modals */}
        <PreferencesModal
          visible={preferencesVisible}
          onClose={() => setPreferencesVisible(false)}
        />

        <SyncDiagnosticsModal
          visible={diagnosticsVisible}
          onClose={() => setDiagnosticsVisible(false)}
        />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  userInfo: {
    marginTop: theme.spacing.xxs,
    marginBottom: theme.spacing.sm,
  },
  labelMargin: {
    marginTop: theme.spacing.sm,
  },
  menuButton: {
    marginBottom: theme.spacing.lg,
  },
  signOutButton: {
    marginTop: 'auto',
  },
});
