import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RecurringTransactionCard } from '@/features/recurring-transactions/presentation/components/RecurringTransactionCard';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { Money } from '@/core/domain/money';

describe('Recurring Transactions Presentation Components', () => {
  it('renders RecurringTransactionCard correctly for monthly expense with due status', () => {
    const recurring = new RecurringTransaction({
      id: 'rec-card-1',
      userId: 'user-1',
      type: 'expense',
      amount: Money.fromMinorUnits(35000000n), // Rp 350.000
      accountId: 'acc-bca',
      categoryId: 'cat-bills',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-01-01', // Due in the past relative to today
      note: 'WiFi IndiHome',
    });

    const onProcessNow = jest.fn();
    const onToggleActive = jest.fn();

    const { getByText } = render(
      <RecurringTransactionCard
        recurring={recurring}
        accountName="BCA Tabungan"
        categoryName="Tagihan & Utilitas"
        onProcessNow={onProcessNow}
        onToggleActive={onToggleActive}
      />
    );

    expect(getByText('🔴 PENGELUARAN')).toBeTruthy();
    expect(getByText('🔄 Bulanan')).toBeTruthy();
    expect(getByText('AKTIF')).toBeTruthy();
    expect(getByText('WiFi IndiHome')).toBeTruthy();
    expect(getByText('🏦 BCA Tabungan • 🏷️ Tagihan & Utilitas')).toBeTruthy();

    const processBtn = getByText('⚡ Proses Sekarang');
    fireEvent.press(processBtn);
    expect(onProcessNow).toHaveBeenCalledTimes(1);

    const toggleBtn = getByText('⏸️ Jeda Rutinitas');
    fireEvent.press(toggleBtn);
    expect(onToggleActive).toHaveBeenCalledWith(false);
  });

  it('renders RecurringTransactionCard correctly for paused income', () => {
    const recurring = new RecurringTransaction({
      id: 'rec-card-2',
      userId: 'user-1',
      type: 'income',
      amount: Money.fromMinorUnits(1500000000n), // Rp 15.000.000
      accountId: 'acc-mandiri',
      categoryId: 'cat-salary',
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2099-01-01',
      isActive: false,
      note: 'Gaji Pokok',
    });

    const onToggleActive = jest.fn();

    const { getByText, queryByText } = render(
      <RecurringTransactionCard
        recurring={recurring}
        onToggleActive={onToggleActive}
      />
    );

    expect(getByText('🟢 PEMASUKAN')).toBeTruthy();
    expect(getByText('DIJEDA')).toBeTruthy();
    expect(getByText('Gaji Pokok')).toBeTruthy();

    // No process button when not due
    expect(queryByText('⚡ Proses Sekarang')).toBeNull();

    const resumeBtn = getByText('▶️ Aktifkan Kembali');
    fireEvent.press(resumeBtn);
    expect(onToggleActive).toHaveBeenCalledWith(true);
  });
});
