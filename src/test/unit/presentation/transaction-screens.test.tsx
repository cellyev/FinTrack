import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CategorySplitBuilder } from '@/features/transactions/presentation/components/CategorySplitBuilder';
import { AddExpenseScreen } from '@/features/transactions/presentation/screens/AddExpenseScreen';
import { AddIncomeScreen } from '@/features/transactions/presentation/screens/AddIncomeScreen';
import { AddTransferScreen } from '@/features/transactions/presentation/screens/AddTransferScreen';
import { TransactionTypePickerScreen } from '@/features/transactions/presentation/screens/TransactionTypePickerScreen';
import { useTransactionCreation } from '@/features/transactions/presentation/use-transaction-creation';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';

// Mock useTransactionCreation hook
jest.mock('@/features/transactions/presentation/use-transaction-creation');
const mockedUseTxCreation = useTransactionCreation as jest.MockedFunction<typeof useTransactionCreation>;

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

describe('Transaction Presentation Screens & Components', () => {
  const dummyAccounts = [
    new Account({ id: 'acc-bca', userId: 'u1', name: 'BCA Utama', type: 'bank', color: '#0055A5' }),
    new Account({ id: 'acc-gopay', userId: 'u1', name: 'GoPay', type: 'ewallet', color: '#008A00' }),
  ];

  const dummyExpenseCategories = [
    new Category({ id: 'cat-food', userId: 'u1', name: 'Makanan & Minuman', type: 'expense', color: '#FF5722' }),
    new Category({ id: 'cat-trans', userId: 'u1', name: 'Transportasi', type: 'expense', color: '#03A9F4' }),
  ];

  const dummyIncomeCategories = [
    new Category({ id: 'cat-sal', userId: 'u1', name: 'Gaji Bulanan', type: 'income', color: '#2E7D32' }),
    new Category({ id: 'cat-bon', userId: 'u1', name: 'Bonus & THR', type: 'income', color: '#F9A825' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CategorySplitBuilder Component', () => {
    it('should calculate allocated sum and show unallocated remaining warning', () => {
      const mockChangeSplits = jest.fn();
      const { getByText } = render(
        <CategorySplitBuilder
          totalAmount={100000}
          categories={dummyExpenseCategories}
          splits={[
            { id: 's1', categoryId: 'cat-food', amountStr: '60000' },
          ]}
          onChangeSplits={mockChangeSplits}
        />
      );

      expect(getByText('Rp 60.000')).toBeTruthy();
      expect(getByText('Rp 40.000')).toBeTruthy(); // Remaining
      expect(getByText('ℹ️ Rp 40.000 belum dialokasikan ke kategori.')).toBeTruthy();
    });

    it('should show balanced status when allocated equals total amount', () => {
      const { getByText } = render(
        <CategorySplitBuilder
          totalAmount={100000}
          categories={dummyExpenseCategories}
          splits={[
            { id: 's1', categoryId: 'cat-food', amountStr: '100000' },
          ]}
          onChangeSplits={jest.fn()}
        />
      );

      expect(getByText('Rp 0 (Pas)')).toBeTruthy();
    });
  });

  describe('AddExpenseScreen', () => {
    it('should submit valid expense when split sum equals total', async () => {
      const mockSubmitExpense = jest.fn().mockResolvedValue(true);
      mockedUseTxCreation.mockReturnValue({
        accounts: dummyAccounts,
        categories: dummyExpenseCategories,
        isLoading: false,
        error: null,
        reload: jest.fn(),
        submitExpense: mockSubmitExpense,
        submitIncome: jest.fn(),
        submitTransfer: jest.fn(),
      });

      const { getAllByPlaceholderText, getByLabelText } = render(<AddExpenseScreen />);

      // Enter total amount: Rp 100.000 (auto-syncs with split)
      const inputs = getAllByPlaceholderText('0');
      fireEvent.changeText(inputs[0], '100000');

      // Submit
      fireEvent.press(getByLabelText('Simpan pengeluaran'));

      await waitFor(() => {
        expect(mockSubmitExpense).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceAccountId: 'acc-bca',
          })
        );
      });
    });
  });

  describe('AddIncomeScreen', () => {
    it('should submit valid income to destination account', async () => {
      const mockSubmitIncome = jest.fn().mockResolvedValue(true);
      mockedUseTxCreation.mockReturnValue({
        accounts: dummyAccounts,
        categories: dummyIncomeCategories,
        isLoading: false,
        error: null,
        reload: jest.fn(),
        submitExpense: jest.fn(),
        submitIncome: mockSubmitIncome,
        submitTransfer: jest.fn(),
      });

      const { getAllByPlaceholderText, getByLabelText } = render(<AddIncomeScreen />);

      const inputs = getAllByPlaceholderText('0');
      fireEvent.changeText(inputs[0], '5000000');
      fireEvent.press(getByLabelText('Simpan pemasukan'));

      await waitFor(() => {
        expect(mockSubmitIncome).toHaveBeenCalledWith(
          expect.objectContaining({
            destinationAccountId: 'acc-bca',
          })
        );
      });
    });
  });

  describe('AddTransferScreen', () => {
    it('should submit valid transfer between two distinct accounts', async () => {
      const mockSubmitTransfer = jest.fn().mockResolvedValue(true);
      mockedUseTxCreation.mockReturnValue({
        accounts: dummyAccounts,
        categories: [],
        isLoading: false,
        error: null,
        reload: jest.fn(),
        submitExpense: jest.fn(),
        submitIncome: jest.fn(),
        submitTransfer: mockSubmitTransfer,
      });

      const { getByPlaceholderText, getByLabelText } = render(<AddTransferScreen />);

      fireEvent.changeText(getByPlaceholderText('0'), '500000');
      fireEvent.press(getByLabelText('Simpan transfer'));

      await waitFor(() => {
        expect(mockSubmitTransfer).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceAccountId: 'acc-bca',
            destinationAccountId: 'acc-gopay',
          })
        );
      });
    });
  });

  describe('TransactionTypePickerScreen', () => {
    it('should render all three transaction type selection cards', () => {
      const { getByText } = render(<TransactionTypePickerScreen />);

      expect(getByText('Pengeluaran (Expense)')).toBeTruthy();
      expect(getByText('Pemasukan (Income)')).toBeTruthy();
      expect(getByText('Transfer Antar-Akun')).toBeTruthy();
    });
  });
});
