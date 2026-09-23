import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QuickAddModal, QuickAddFab } from '@/core/ui/components/QuickAddModal';
import { useRouter } from 'expo-router';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/debts/presentation/use-debts', () => ({
  useDebts: () => ({
    createDebt: jest.fn().mockResolvedValue({ success: true }),
  }),
}));

describe('QuickAddModal & QuickAddFab Components', () => {
  const mockPush = jest.fn();
  const mockClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('should trigger onPress callback when QuickAddFab is pressed', () => {
    const handlePress = jest.fn();
    const { getByLabelText } = render(<QuickAddFab onPress={handlePress} />);

    fireEvent.press(getByLabelText('Tombol Tambah Cepat Transaksi'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('should render all 5 action options when visible', () => {
    const { getByText } = render(
      <QuickAddModal visible={true} onClose={mockClose} />
    );

    expect(getByText('Tambah Transaksi Cepat')).toBeTruthy();
    expect(getByText('Pengeluaran')).toBeTruthy();
    expect(getByText('Pemasukan')).toBeTruthy();
    expect(getByText('Transfer Antar-Akun')).toBeTruthy();
    expect(getByText('Hutang (Pinjam Uang)')).toBeTruthy();
    expect(getByText('Piutang (Pinjamkan Uang)')).toBeTruthy();
  });

  it('should navigate to /transactions/expense on Pengeluaran press', () => {
    const { getByLabelText } = render(
      <QuickAddModal visible={true} onClose={mockClose} />
    );

    fireEvent.press(getByLabelText('Catat Pengeluaran Baru'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/transactions/expense');
  });

  it('should navigate to /transactions/income on Pemasukan press', () => {
    const { getByLabelText } = render(
      <QuickAddModal visible={true} onClose={mockClose} />
    );

    fireEvent.press(getByLabelText('Catat Pemasukan Baru'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/transactions/income');
  });

  it('should navigate to /transactions/transfer on Transfer press', () => {
    const { getByLabelText } = render(
      <QuickAddModal visible={true} onClose={mockClose} />
    );

    fireEvent.press(getByLabelText('Transfer Antar-Akun'));
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/transactions/transfer');
  });

  it('should trigger onClose when Tutup button is pressed', () => {
    const { getByLabelText } = render(
      <QuickAddModal visible={true} onClose={mockClose} />
    );

    fireEvent.press(getByLabelText('Tutup menu tambah cepat'));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
