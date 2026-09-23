import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/auth-store';
import { LoadingState } from '@/core/ui/components/LoadingState';
import { theme } from '@/core/ui/tokens/theme';

export default function Index() {
  const { session, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (session?.user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/sign-in');
      }
    }
  }, [session, isLoading, router]);

  return (
    <View style={styles.container}>
      <LoadingState message="Memeriksa sesi..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
