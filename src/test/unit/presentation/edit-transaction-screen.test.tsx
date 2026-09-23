import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TransactionDetailScreen } from '@/features/transactions/presentation/screens/TransactionDetailScreen';
import { EditTransactionScreen } from '@/features/transactions/presentation/screens/EditTransactionScreen';
import { Money } from '@/core/domain/money';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { useTransactionDetail } from '@/features/transactions/presentation/use-transaction-detail';
import { useEditTransaction } from '@/features/transactions/presentation/use-edit-transaction';

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ id: 'tx-edit-test-1' }),
}));

// Mock presentation hooks
jest.mock('@/features/transactions/presentation/use-transaction-detail');
jest.mock('@/features/transactions/presentation/use-edit-transaction');

const mockedUseTransactionDetail = useTransactionDetail as jest.MockedFunction<typeof useTransactionDetail>;
const mockedUseEditTransaction = useEditTransaction as jest.MockedFunction<typeof useEditTransaction>;

describe('Edit Transaction & Correction Window Presentation Screens', () => {
  const dummyAccount = new Account({
    id: 'acc-1',
    userId: 'u-edit-1',
    name: 'BCA Utama',
    type: 'bank',
    currencyCode: 'IDR',
  });

  const dummyCategory = new Category({
    id: 'cat-1',
    userId: 'u-edit-1',
    name: 'Makanan & Minuman',
    type: 'expense',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TransactionDetailScreen Correction Window States', () => {
    it('should display "Ubah Transaksi" button when transaction is eligible for correction', () => {
      mockedUseTransactionDetail.mockReturnValue({
        detail: {
          id: 'tx-1',
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-19',
          createdAt: new Date(),
          updatedAt: new Date(),
          note: 'Makan siang',
          sourceAccount: { id: 'acc-1', name: 'Dompet Tunai', type: 'cash' },
          destinationAccount: null,
          items: [
            {
              id: 'it-1',
              categoryId: 'cat-1',
              categoryName: 'Makanan & Minuman',
              amount: Money.fromDecimal(50000, 'IDR'),
            },
          ],
          totalSplitAmount: Money.fromDecimal(50000, 'IDR'),
          isFullyAllocated: true,
          isEditable: true,
          correctionDaysRemaining: 7,
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TransactionDetailScreen />);

      expect(getByText('Ubah Transaksi')).toBeTruthy();

      fireEvent.press(getByText('Ubah Transaksi'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/transactions/edit/[id]',
        params: { id: 'tx-1' },
      });
    });

    it('should display 7-day expiration notice when transaction is past correction window', () => {
      mockedUseTransactionDetail.mockReturnValue({
        detail: {
          id: 'tx-old-1',
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2020-01-01',
          createdAt: new Date(),
          updatedAt: new Date(),
          note: 'Makan lama',
          sourceAccount: { id: 'acc-1', name: 'Dompet Tunai', type: 'cash' },
          destinationAccount: null,
          items: [],
          totalSplitAmount: Money.fromDecimal(50000, 'IDR'),
          isFullyAllocated: true,
          isEditable: false,
          correctionDaysRemaining: 0,
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText, queryByText } = render(<TransactionDetailScreen />);

      expect(queryByText('Ubah Transaksi')).toBeNull();
      expect(
        getByText(/Transaksi ini tidak dapat diedit karena sudah melewati batas koreksi 7 hari/)
      ).toBeTruthy();
    });
  });

  describe('EditTransactionScreen Preloading and Submit', () => {
    it('should render preloaded data for editable expense transaction and submit update', async () => {
      const mockSubmit = jest.fn().mockResolvedValue({ success: true });

      mockedUseEditTransaction.mockReturnValue({
        detail: {
          id: 'tx-edit-test-1',
          type: 'expense',
          amount: Money.fromDecimal(75000, 'IDR'),
          transactionDate: '2026-08-19',
          createdAt: new Date(),
          updatedAt: new Date(),
          note: 'Makan siang berdua',
          sourceAccount: { id: 'acc-1', name: 'BCA Utama', type: 'bank' },
          destinationAccount: null,
          items: [
            {
              id: 'it-1',
              categoryId: 'cat-1',
              categoryName: 'Makanan & Minuman',
              amount: Money.fromDecimal(75000, 'IDR'),
            },
          ],
          totalSplitAmount: Money.fromDecimal(75000, 'IDR'),
          isFullyAllocated: true,
          isEditable: true,
          correctionDaysRemaining: 7,
        },
        accounts: [dummyAccount],
        categories: [dummyCategory],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        submitUpdate: mockSubmit,
      });

      const { getByText, getByDisplayValue } = render(<EditTransactionScreen />);

      expect(getByText('Ubah Pengeluaran')).toBeTruthy();
      expect(getByDisplayValue('Makan siang berdua')).toBeTruthy();
      expect(getByText('Simpan Perubahan Transaksi')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('Simpan Perubahan Transaksi'));
      });

      expect(mockSubmit).toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
