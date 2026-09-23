import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/core/ui/components/AppScreen';
import { AppText } from '@/core/ui/components/AppText';
import { AppInput } from '@/core/ui/components/AppInput';
import { AppButton } from '@/core/ui/components/AppButton';
import { ErrorState } from '@/core/ui/components/ErrorState';
import { useAuth } from '../use-auth';
import { theme } from '@/core/ui/tokens/theme';

interface AuthScreenProps {
  mode?: 'sign-in' | 'sign-up';
  onToggleMode?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  mode: initialMode = 'sign-in',
}) => {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  const { signIn, signUp, isLoading, error, isAuthenticated, clearError } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  const validate = (): boolean => {
    const trimmedEmail = email.trim();
    const errors: { email?: string; password?: string; fullName?: string } = {};
    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi';
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      errors.email = 'Format email tidak valid';
    }

    if (!password) {
      errors.password = 'Password wajib diisi';
    } else if (password.length < 6) {
      errors.password = 'Password minimal 6 karakter';
    }

    if (mode === 'sign-up') {
      const trimmedName = fullName.trim();
      if (!trimmedName) {
        errors.fullName = 'Nama lengkap wajib diisi';
      } else if (trimmedName.length < 2) {
        errors.fullName = 'Nama lengkap minimal 2 karakter';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (mode === 'sign-in') {
      const res = await signIn({ email: email.trim(), password });
      if (res.success) {
        router.replace('/(tabs)');
      }
    } else {
      const res = await signUp({ email: email.trim(), password, fullName: fullName.trim() });
      if (res.success) {
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <AppText variant="display" style={styles.logoTitle}>FinTrack</AppText>
            <AppText variant="bodyMuted" style={styles.subtitle}>
              Pencatat keuangan offline-first yang aman dan presisi
            </AppText>
          </View>

          <View style={styles.card}>
            <AppText variant="titleLarge" style={styles.cardTitle}>
              {mode === 'sign-in' ? 'Masuk ke Akun' : 'Daftar Akun Baru'}
            </AppText>

            {error ? (
              <View style={styles.errorContainer}>
                <ErrorState message={error} />
              </View>
            ) : null}

            {mode === 'sign-up' ? (
              <AppInput
                label="Nama Lengkap"
                placeholder="Masukkan nama Anda"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (formErrors.fullName) setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                  if (error) clearError();
                }}
                error={formErrors.fullName}
                autoCapitalize="words"
              />
            ) : null}

            <AppInput
              label="Email"
              placeholder="nama@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                if (error) clearError();
              }}
              error={formErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <AppInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: undefined }));
                if (error) clearError();
              }}
              error={formErrors.password}
              isPassword
            />

            <AppButton
              title={mode === 'sign-in' ? 'Masuk' : 'Daftar'}
              isLoading={isLoading}
              onPress={handleSubmit}
              style={styles.submitButton}
            />

            <View style={styles.switchModeContainer}>
              <AppText variant="bodyMuted">
                {mode === 'sign-in' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
              </AppText>
              <AppButton
                title={mode === 'sign-in' ? 'Daftar' : 'Masuk'}
                variant="ghost"
                onPress={() => {
                  setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                  setFormErrors({});
                  clearError();
                }}
                style={styles.ghostButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoTitle: {
    color: theme.colors.primary[500],
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: {
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  errorContainer: {
    marginBottom: theme.spacing.md,
  },
  submitButton: {
    marginTop: theme.spacing.sm,
  },
  switchModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  ghostButton: {
    minHeight: 36,
    paddingVertical: 0,
    paddingHorizontal: theme.spacing.xs,
  },
});
