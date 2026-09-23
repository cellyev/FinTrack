import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { theme } from '../tokens/theme';

interface AppScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

export const AppScreen: React.FC<AppScreenProps> = ({
  children,
  style,
  edges = ['top', 'left', 'right'],
}) => {
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={[styles.content, style]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});
