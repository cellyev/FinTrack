import React from 'react';
import { View, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../tokens/theme';

export interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeValue: (rawValue: string, numericValue: number) => void;
  label?: string;
  error?: string;
  currencyPrefix?: string;
  testID?: string;
}

/**
 * Formats a raw numeric string/number into Indonesian Rupiah format with thousand separators (dots).
 * e.g. "150000" -> "150.000", 0 -> "0", "" -> ""
 */
export function formatRupiahDisplay(value: string | number | bigint): string {
  const strVal = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  const digitsOnly = strVal.replace(/[^0-9]/g, '');

  if (!digitsOnly) return '';

  // Remove leading zeros unless it's just '0'
  const normalized = digitsOnly.replace(/^0+(?=\d)/, '');

  // Add thousand separators with regex
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses any formatted string into clean integer numeric digits string.
 * e.g. "Rp 150.000" -> "150000", "0" -> "0", "" -> ""
 */
export function parseRupiahRaw(formattedValue: string): string {
  const digitsOnly = formattedValue.replace(/[^0-9]/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.replace(/^0+(?=\d)/, '');
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChangeValue,
  label,
  error,
  currencyPrefix = 'Rp',
  placeholder = '0',
  editable = true,
  testID,
  style,
  ...rest
}) => {
  const rawDigits = parseRupiahRaw(value);
  const formattedDisplay = formatRupiahDisplay(rawDigits);

  const handleChangeText = (text: string) => {
    const nextRaw = parseRupiahRaw(text);
    const numeric = nextRaw ? parseInt(nextRaw, 10) : 0;
    onChangeValue(nextRaw, isNaN(numeric) ? 0 : numeric);
  };

  return (
    <View style={styles.container}>
      {label ? <AppText variant="caption" style={styles.label}>{label}</AppText> : null}

      <View
        style={[
          styles.inputContainer,
          error ? styles.inputError : null,
          !editable ? styles.inputDisabled : null,
        ]}
      >
        <AppText variant="titleMedium" style={styles.prefix}>
          {currencyPrefix}
        </AppText>
        <TextInput
          {...rest}
          testID={testID}
          value={formattedDisplay}
          onChangeText={handleChangeText}
          keyboardType="numeric"
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.neutral[400]}
          style={[styles.input, style]}
          accessibilityLabel={label || 'Input Nominal'}
        />
      </View>

      {error ? (
        <AppText variant="caption" style={styles.errorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.xxs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  inputError: {
    borderColor: theme.colors.danger[500],
  },
  inputDisabled: {
    backgroundColor: theme.colors.neutral[100],
    opacity: 0.7,
  },
  prefix: {
    color: theme.colors.primary[500],
    fontWeight: theme.typography.fontWeights.bold,
    marginRight: theme.spacing.xs,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.fontSizes.lg,
    fontWeight: theme.typography.fontWeights.semibold,
    paddingVertical: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.danger[500],
    marginTop: theme.spacing.xxs,
  },
});
