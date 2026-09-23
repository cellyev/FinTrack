import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from './AppText';
import { theme } from '../tokens/theme';

export interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
  rightElement?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  rightElement,
  containerStyle,
  style,
  secureTextEntry,
  multiline,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const effectiveSecureTextEntry = isPassword ? !isPasswordVisible : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <AppText style={styles.label}>{label}</AppText>}
      <View
        style={[
          styles.inputWrapper,
          multiline ? styles.inputWrapperMultiline : null,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <TextInput
          placeholderTextColor={theme.colors.neutral[500]}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            style,
          ]}
          accessibilityLabel={label}
          aria-invalid={!!error}
          secureTextEntry={effectiveSecureTextEntry}
          multiline={multiline}
          autoCapitalize={props.autoCapitalize ?? (isPassword ? 'none' : undefined)}
          autoCorrect={props.autoCorrect ?? (isPassword ? false : undefined)}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Sembunyikan password' : 'Lihat password'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Feather
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={isPasswordVisible ? theme.colors.primary[500] : theme.colors.neutral[400]}
            />
          </TouchableOpacity>
        ) : rightElement ? (
          <View style={styles.rightElement}>{rightElement}</View>
        ) : null}
      </View>
      {error ? (
        <AppText variant="error" style={styles.errorText}>{error}</AppText>
      ) : helperText ? (
        <AppText variant="caption" style={styles.helperText}>{helperText}</AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSizes.sm,
    fontWeight: theme.typography.fontWeights.medium,
    marginBottom: theme.spacing.xs,
    color: theme.colors.neutral[300],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.xs,
  },
  inputWrapperError: {
    borderColor: theme.colors.danger[500],
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 0,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  eyeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightElement: {
    marginLeft: theme.spacing.xs,
  },
  errorText: {
    marginTop: theme.spacing.xxs,
  },
  helperText: {
    marginTop: theme.spacing.xxs,
  },
});
