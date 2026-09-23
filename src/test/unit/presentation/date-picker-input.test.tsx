import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  DatePickerInput,
  formatDisplayDate,
  getTodayDateString,
  getYesterdayDateString,
  offsetDateString,
} from '@/core/ui/components/DatePickerInput';

describe('DatePickerInput Component & Date Formatting Utilities', () => {
  describe('formatDisplayDate', () => {
    it('should format ISO YYYY-MM-DD date to Indonesian date string', () => {
      const formatted = formatDisplayDate('2026-08-19');
      expect(formatted).toContain('Agustus');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('19');
    });

    it('should handle empty or invalid date gracefully', () => {
      expect(formatDisplayDate('')).toBe('Pilih Tanggal');
      expect(formatDisplayDate('invalid')).toBe('invalid');
    });
  });

  describe('Date offset and preset helpers', () => {
    it('should return valid YYYY-MM-DD for today and yesterday', () => {
      expect(getTodayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(getYesterdayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should calculate offset dates correctly across days and months', () => {
      expect(offsetDateString('2026-08-20', -1)).toBe('2026-08-19');
      expect(offsetDateString('2026-08-20', 1)).toBe('2026-08-21');
      expect(offsetDateString('2026-08-01', -1)).toBe('2026-07-31');
    });
  });

  describe('DatePickerInput Rendering & User Interactions', () => {
    it('should render label and current date display', () => {
      const { getByText } = render(
        <DatePickerInput
          label="Tanggal Transaksi"
          value="2026-08-20"
          onChangeDate={jest.fn()}
        />
      );

      expect(getByText('Tanggal Transaksi')).toBeTruthy();
      expect(getByText(/20 Agustus 2026/)).toBeTruthy();
      expect(getByText('Hari Ini')).toBeTruthy();
      expect(getByText('Kemarin')).toBeTruthy();
    });

    it('should trigger onChangeDate when Hari Ini preset is pressed', () => {
      const handleChange = jest.fn();
      const { getByText } = render(
        <DatePickerInput value="2026-08-01" onChangeDate={handleChange} />
      );

      fireEvent.press(getByText('Hari Ini'));
      expect(handleChange).toHaveBeenCalledWith(getTodayDateString());
    });

    it('should trigger onChangeDate when Kemarin preset is pressed', () => {
      const handleChange = jest.fn();
      const { getByText } = render(
        <DatePickerInput value="2026-08-20" onChangeDate={handleChange} />
      );

      fireEvent.press(getByText('Kemarin'));
      expect(handleChange).toHaveBeenCalledWith(getYesterdayDateString());
    });

    it('should trigger onChangeDate with -1 Hari and +1 Hari', () => {
      const handleChange = jest.fn();
      const { getByText } = render(
        <DatePickerInput value="2026-08-20" onChangeDate={handleChange} />
      );

      fireEvent.press(getByText('-1 Hari'));
      expect(handleChange).toHaveBeenCalledWith('2026-08-19');

      fireEvent.press(getByText('+1 Hari'));
      expect(handleChange).toHaveBeenCalledWith('2026-08-21');
    });

    it('should open touch calendar modal, allow selecting day cell, and confirm date', () => {
      const handleChange = jest.fn();
      const { getByTestId, getByText, getByLabelText, getAllByText } = render(
        <DatePickerInput
          value="2026-08-20"
          onChangeDate={handleChange}
          testID="open-date-picker"
        />
      );

      // Open visual calendar modal
      fireEvent.press(getByTestId('open-date-picker'));

      // Check month header is displayed
      expect(getAllByText(/Agustus 2026/).length).toBeGreaterThan(0);

      // Tap day 15 in the calendar
      fireEvent.press(getByLabelText(/15 Agustus 2026/));

      // Tap confirm button
      fireEvent.press(getByText('Pilih Tanggal Ini'));
      expect(handleChange).toHaveBeenCalledWith('2026-08-15');
    });

    it('should allow navigating to previous and next months via touch buttons', () => {
      const handleChange = jest.fn();
      const { getByTestId, getByText, getByLabelText, getAllByText } = render(
        <DatePickerInput
          value="2026-08-20"
          onChangeDate={handleChange}
          testID="open-date-picker"
        />
      );

      fireEvent.press(getByTestId('open-date-picker'));

      // Go to next month (September 2026)
      fireEvent.press(getByLabelText('Bulan Berikutnya'));
      expect(getByText('September 2026')).toBeTruthy();

      // Go to previous month (back to August 2026)
      fireEvent.press(getByLabelText('Bulan Sebelumnya'));
      expect(getAllByText(/Agustus 2026/).length).toBeGreaterThan(0);
    });

    it('should allow clearing date when optional is true', () => {
      const handleChange = jest.fn();
      const { getByTestId, getByText } = render(
        <DatePickerInput
          value="2026-08-20"
          onChangeDate={handleChange}
          optional={true}
          testID="open-date-picker"
        />
      );

      fireEvent.press(getByTestId('open-date-picker'));
      fireEvent.press(getByText('Kosongkan'));
      expect(handleChange).toHaveBeenCalledWith('');
    });
  });
});
