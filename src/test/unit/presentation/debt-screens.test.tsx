import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DebtCard } from '@/features/debts/presentation/components/DebtCard';
import { Debt } from '@/features/debts/domain/debt';
import { Money } from '@/core/domain/money';

describe('Debt Presentation Components', () => {
  it('renders DebtCard correctly for Hutang with progress', () => {
    const debt = new Debt({
      id: 'debt-p1',
      userId: 'user-1',
      type: 'borrowed',
      personName: 'Hendra Wijaya',
      originalAmount: Money.fromMinorUnits(100000000n), // Rp 1.000.000
      remainingAmount: Money.fromMinorUnits(50000000n), // Rp 500.000 (50% repaid)
      dueDate: '2026-12-31',
    });

    const onPayPress = jest.fn();
    const { getByText } = render(<DebtCard debt={debt} onPayPress={onPayPress} />);

    expect(getByText('👤 Hendra Wijaya')).toBeTruthy();
    expect(getByText('🔴 HUTANG (Saya Berhutang)')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
    expect(getByText('BELUM LUNAS')).toBeTruthy();

    const payBtn = getByText('💳 Bayar Cicilan / Lunas');
    fireEvent.press(payBtn);
    expect(onPayPress).toHaveBeenCalledTimes(1);
  });

  it('renders DebtCard correctly for Piutang and marks settled when remaining is 0', () => {
    const debt = new Debt({
      id: 'debt-p2',
      userId: 'user-1',
      type: 'lent',
      personName: 'Dewi Lestari',
      originalAmount: Money.fromMinorUnits(50000000n),
      remainingAmount: Money.zero('IDR'),
    });

    const { getByText, queryByText } = render(<DebtCard debt={debt} />);

    expect(getByText('👤 Dewi Lestari')).toBeTruthy();
    expect(getByText('🟢 PIUTANG (Dipinjamkan)')).toBeTruthy();
    expect(getByText('LUNAS')).toBeTruthy();
    expect(getByText('100%')).toBeTruthy();

    // No quick pay button when settled
    expect(queryByText('📥 Catat Penerimaan / Pelunasan')).toBeNull();
  });
});
