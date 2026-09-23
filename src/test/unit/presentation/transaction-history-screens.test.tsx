import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransactionListItem } from '@/features/transactions/presentation/components/TransactionListItem';
import { TransactionFilterModal } from '@/features/transactions/presentation/components/TransactionFilterModal';
import { TransactionHistoryScreen } from '@/features/transactions/presentation/screens/TransactionHistoryScreen';
import { useTransactionHistory } from '@/features/transactions/presentation/use-transaction-history';
import { Money } from '@/core/domain/money';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';

// Mock useTransactionHistory
jest.mock('@/features/transactions/presentation/use-transaction-history');
const mockedUseTxHistory = useTransactionHistory as jest.MockedFunction<typeof useTransactionHistory>;

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ id: 'tx-123' }),
}));

describe('Transaction History Presentation Components & Screens', () => {
  const dummyAccount = new Account({ id: 'acc-bca', userId: 'u1', name: 'BCA Utama', type: 'bank' });
  const dummyCategory = new Category({ id: 'cat-food', userId: 'u1', name: 'Makanan & Minuman', type: 'expense' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TransactionListItem Component', () => {
    it('should render expense transaction with minus prefix and red text', () => {
      const mockPress = jest.fn();
      const { getByText } = render(
        <TransactionListItem
          item={{
            id: 'tx-1',
            type: 'expense',
            amount: Money.fromDecimal(50000, 'IDR'),
            transactionDate: '2026-08-19',
            createdAt: new Date(),
            sourceAccount: { id: 'acc-1', name: 'BCA', type: 'bank' },
            categorySummary: 'Makanan & Minuman',
            categoryCount: 1,
            note: 'Makan siang',
          }}
          onPress={mockPress}
        />
      );

      expect(getByText('Makanan & Minuman')).toBeTruthy();
      expect(getByText('BCA')).toBeTruthy();
      expect(getByText('- Rp 50.000')).toBeTruthy();

      fireEvent.press(getByText('Makanan & Minuman'));
      expect(mockPress).toHaveBeenCalled();
    });

    it('should render transfer transaction with arrow indicator and neutral sign', () => {
      const { getByText } = render(
        <TransactionListItem
          item={{
            id: 'tx-2',
            type: 'transfer',
            amount: Money.fromDecimal(200000, 'IDR'),
            transactionDate: '2026-08-19',
            createdAt: new Date(),
            sourceAccount: { id: 'acc-1', name: 'BCA', type: 'bank' },
            destinationAccount: { id: 'acc-2', name: 'GoPay', type: 'ewallet' },
            categorySummary: 'Transfer Antar-Akun',
            categoryCount: 0,
          }}
          onPress={jest.fn()}
        />
      );

      expect(getByText('Transfer Antar-Akun')).toBeTruthy();
      expect(getByText('BCA → GoPay')).toBeTruthy();
      expect(getByText('Rp 200.000')).toBeTruthy();
    });
  });

  describe('TransactionFilterModal Component', () => {
    it('should select filter options and trigger onApply', () => {
      const mockApply = jest.fn();
      const mockReset = jest.fn();
      const mockClose = jest.fn();

      const { getByText, getByLabelText } = render(
        <TransactionFilterModal
          visible={true}
          onClose={mockClose}
          accounts={[dummyAccount]}
          categories={[dummyCategory]}
          currentFilter={{ datePreset: 'all' }}
          onApply={mockApply}
          onReset={mockReset}
        />
      );

      expect(getByText('Filter Transaksi')).toBeTruthy();

      // Click Pengeluaran
      fireEvent.press(getByLabelText('Tipe Pengeluaran'));

      // Click Terapkan Filter
      fireEvent.press(getByLabelText('Terapkan filter'));

      expect(mockApply).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
        })
      );
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('TransactionHistoryScreen', () => {
    it('should render empty state when user has no transactions recorded', () => {
      mockedUseTxHistory.mockReturnValue({
        items: [],
        grouped: [],
        accounts: [],
        categories: [],
        searchQuery: '',
        setSearchQuery: jest.fn(),
        filter: { datePreset: 'all' },
        activeFilterCount: 0,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isFilterModalVisible: false,
        openFilterModal: jest.fn(),
        closeFilterModal: jest.fn(),
        applyFilter: jest.fn(),
        resetFilter: jest.fn(),
        refresh: jest.fn(),
        reloadLocal: jest.fn(),
      });

      const { getByText } = render(<TransactionHistoryScreen />);
      expect(getByText('Belum Ada Transaksi')).toBeTruthy();
    });

    it('should render grouped transactions with date headers', () => {
      mockedUseTxHistory.mockReturnValue({
        items: [
          {
            id: 'tx-1',
            type: 'expense',
            amount: Money.fromDecimal(50000, 'IDR'),
            transactionDate: '2026-08-19',
            createdAt: new Date(),
            sourceAccount: { id: 'acc-1', name: 'BCA', type: 'bank' },
            categorySummary: 'Makanan & Minuman',
            categoryCount: 1,
          },
        ],
        grouped: [
          {
            dateHeader: 'Hari ini',
            rawDate: '2026-08-19',
            transactions: [
              {
                id: 'tx-1',
                type: 'expense',
                amount: Money.fromDecimal(50000, 'IDR'),
                transactionDate: '2026-08-19',
                createdAt: new Date(),
                sourceAccount: { id: 'acc-1', name: 'BCA', type: 'bank' },
                categorySummary: 'Makanan & Minuman',
                categoryCount: 1,
              },
            ],
          },
        ],
        accounts: [],
        categories: [],
        searchQuery: '',
        setSearchQuery: jest.fn(),
        filter: { datePreset: 'all' },
        activeFilterCount: 0,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isFilterModalVisible: false,
        openFilterModal: jest.fn(),
        closeFilterModal: jest.fn(),
        applyFilter: jest.fn(),
        resetFilter: jest.fn(),
        refresh: jest.fn(),
        reloadLocal: jest.fn(),
      });

      const { getByText, getByLabelText } = render(<TransactionHistoryScreen />);
      expect(getByText('Hari ini')).toBeTruthy();
      expect(getByText('Makanan & Minuman')).toBeTruthy();
      expect(getByText('- Rp 50.000')).toBeTruthy();
      expect(getByLabelText('Ekspor data transaksi')).toBeTruthy();
    });

    it('should render active filter chips and allow removing a single filter', () => {
      const applyFilterMock = jest.fn();
      mockedUseTxHistory.mockReturnValue({
        items: [],
        grouped: [],
        accounts: [
          new Account({ id: 'acc-bca', userId: 'user-1', name: 'BCA Utama', type: 'bank' }),
        ],
        categories: [],
        searchQuery: '',
        setSearchQuery: jest.fn(),
        filter: { datePreset: 'all', type: 'expense', accountId: 'acc-bca' },
        activeFilterCount: 2,
        isLoading: false,
        isRefreshing: false,
        error: null,
        isFilterModalVisible: false,
        openFilterModal: jest.fn(),
        closeFilterModal: jest.fn(),
        applyFilter: applyFilterMock,
        resetFilter: jest.fn(),
        refresh: jest.fn(),
        reloadLocal: jest.fn(),
      });

      const { getByText } = render(<TransactionHistoryScreen />);
      expect(getByText('Tipe: expense ✕')).toBeTruthy();
      expect(getByText('Akun: BCA Utama ✕')).toBeTruthy();

      // Click on chip to remove type filter
      fireEvent.press(getByText('Tipe: expense ✕'));
      expect(applyFilterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: undefined,
          accountId: 'acc-bca',
        })
      );
    });
  });
});
