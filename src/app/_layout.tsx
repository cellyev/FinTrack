import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '@/core/database/sqlite';
import { runMigrations } from '@/core/database/migrations';
import { authRepository } from '@/features/auth/data/supabase-auth.repository';
import { useAuthStore } from '@/features/auth/presentation/auth-store';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { OfflineBanner } from '@/core/ui/components/OfflineBanner';
import { theme } from '@/core/ui/tokens/theme';

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const { setSession, setLoading } = useAuthStore();

  useEffect(() => {
    async function initializeApp() {
      try {
        // 1. Initialize SQLite and run migrations
        const db = await getDatabase();
        await runMigrations(db);
        setIsDbReady(true);
      } catch (err: unknown) {
        console.error('[RootLayout] DB Initialization error:', err);
        setDbError((err as Error).message ?? 'Gagal menginisialisasi database');
      }

      try {
        // 2. Restore Supabase auth session
        const sessionResult = await authRepository.getSession();
        if (sessionResult.success) {
          setSession(sessionResult.data);
        } else {
          setSession(null);
        }
      } catch (err: unknown) {
        console.warn('[RootLayout] Auth restore warning:', err);
        setSession(null);
      } finally {
        setLoading(false);
      }
    }

    initializeApp();

    // 3. Listen to auth state changes
    const unsubscribe = authRepository.onAuthStateChange((session) => {
      setSession(session);
    });

    return () => {
      unsubscribe();
    };
  }, [setSession, setLoading]);

  if (!isDbReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <LoadingState message={dbError ? `Error: ${dbError}` : 'Menyiapkan database lokal...'} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.rootContainer}>
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/sign-in" />
          <Stack.Screen name="(auth)/sign-up" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
