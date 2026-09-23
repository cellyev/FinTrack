import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  CurrencyInput,
  formatRupiahDisplay,
  parseRupiahRaw,
} from '@/core/ui/components/CurrencyInput';

describe('CurrencyInput Component & Formatting Utilities', () => {
  describe('formatRupiahDisplay', () => {
    it('should format empty or null values as empty string', () => {
      expect(formatRupiahDisplay('')).toBe('');
      expect(formatRupiahDisplay(null as unknown as string)).toBe('');
    });

    it('should format zero correctly', () => {
      expect(formatRupiahDisplay('0')).toBe('0');
      expect(formatRupiahDisplay(0)).toBe('0');
    });

    it('should format small amounts (< 1000) without dots', () => {
      expect(formatRupiahDisplay('50')).toBe('50');
      expect(formatRupiahDisplay('999')).toBe('999');
    });

    it('should format thousands correctly (1.000, 150.000)', () => {
      expect(formatRupiahDisplay('1000')).toBe('1.000');
      expect(formatRupiahDisplay('150000')).toBe('150.000');
    });

    it('should format millions and billions correctly', () => {
      expect(formatRupiahDisplay('1000000')).toBe('1.000.000');
      expect(formatRupiahDisplay('25000000')).toBe('25.000.000');
      expect(formatRupiahDisplay('1500000000')).toBe('1.500.000.000');
    });

    it('should strip leading zeros when typing new digits', () => {
      expect(formatRupiahDisplay('050000')).toBe('50.000');
      expect(formatRupiahDisplay('00123')).toBe('123');
    });

    it('should handle large BigInt amounts without overflow', () => {
      expect(formatRupiahDisplay(100000000000000n)).toBe('100.000.000.000.000');
    });
  });

  describe('parseRupiahRaw', () => {
    it('should extract only numeric digits from formatted string', () => {
      expect(parseRupiahRaw('Rp 150.000')).toBe('150000');
      expect(parseRupiahRaw('1.500.000,00')).toBe('150000000');
      expect(parseRupiahRaw('abc 500 def')).toBe('500');
    });

    it('should return empty string for empty or non-numeric input', () => {
      expect(parseRupiahRaw('')).toBe('');
      expect(parseRupiahRaw('abc')).toBe('');
    });
  });

  describe('CurrencyInput Component Rendering & Interactions', () => {
    it('should render label, prefix, and formatted value', () => {
      const handleChange = jest.fn();
      const { getByText, getByTestId } = render(
        <CurrencyInput
          label="Nominal Pengeluaran"
          value="150000"
          onChangeValue={handleChange}
          testID="currency-input"
        />
      );

      expect(getByText('Nominal Pengeluaran')).toBeTruthy();
      expect(getByText('Rp')).toBeTruthy();
      const input = getByTestId('currency-input');
      expect(input.props.value).toBe('150.000');
    });

    it('should trigger onChangeValue with raw string and numeric integer when typed', () => {
      const handleChange = jest.fn();
      const { getByTestId } = render(
        <CurrencyInput value="" onChangeValue={handleChange} testID="currency-input" />
      );

      const input = getByTestId('currency-input');
      fireEvent.changeText(input, '250000');

      expect(handleChange).toHaveBeenCalledWith('250000', 250000);
    });

    it('should strip non-numeric characters and trigger callback', () => {
      const handleChange = jest.fn();
      const { getByTestId } = render(
        <CurrencyInput value="" onChangeValue={handleChange} testID="currency-input" />
      );

      const input = getByTestId('currency-input');
      fireEvent.changeText(input, 'Rp 1.000.000');

      expect(handleChange).toHaveBeenCalledWith('1000000', 1000000);
    });

    it('should display error message when error prop is provided', () => {
      const { getByText } = render(
        <CurrencyInput
          value="0"
          onChangeValue={jest.fn()}
          error="Nominal harus lebih dari 0"
        />
      );

      expect(getByText('Nominal harus lebih dari 0')).toBeTruthy();
    });
  });
});
