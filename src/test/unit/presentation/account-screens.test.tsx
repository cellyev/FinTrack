import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AccountListScreen } from '@/features/accounts/presentation/screens/AccountListScreen';
import { CreateAccountScreen } from '@/features/accounts/presentation/screens/CreateAccountScreen';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { Account } from '@/features/accounts/domain/account';
import { Money } from '@/core/domain/money';

// Mock useAccounts hook
jest.mock('@/features/accounts/presentation/use-accounts');
const mockedUseAccounts = useAccounts as jest.MockedFunction<typeof useAccounts>;

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ id: 'acc-1' }),
}));

describe('Account Presentation Screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AccountListScreen', () => {
    it('should render loading state when accounts are loading initially', () => {
      mockedUseAccounts.mockReturnValue({
        accounts: [],
        totalNetWorth: Money.zero('IDR'),
        isLoading: true,
        error: null,
        fetchAccounts: jest.fn(),
        createAccount: jest.fn(),
        updateAccount: jest.fn(),
        deleteAccount: jest.fn(),
        getAccount: jest.fn(),
      });

      const { getByText } = render(<AccountListScreen />);
      expect(getByText('Memuat daftar akun...')).toBeTruthy();
    });

    it('should render empty state when user has no accounts', () => {
      mockedUseAccounts.mockReturnValue({
        accounts: [],
        totalNetWorth: Money.zero('IDR'),
        isLoading: false,
        error: null,
        fetchAccounts: jest.fn(),
        createAccount: jest.fn(),
        updateAccount: jest.fn(),
        deleteAccount: jest.fn(),
        getAccount: jest.fn(),
      });

      const { getByText } = render(<AccountListScreen />);
      expect(getByText('Belum Ada Akun')).toBeTruthy();
      expect(getByText('Tambah Akun')).toBeTruthy();

      fireEvent.press(getByText('Tambah Akun'));
      expect(mockPush).toHaveBeenCalledWith('/accounts/create');
    });

    it('should render populated account list with derived balances and Total Net Worth', () => {
      const bcaAccount = new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'BCA Utama',
        type: 'bank',
        color: '#0055A5',
      });

      const cashAccount = new Account({
        id: 'acc-2',
        userId: 'user-1',
        name: 'Dompet Cash',
        type: 'cash',
      });

      mockedUseAccounts.mockReturnValue({
        accounts: [
          { account: bcaAccount, balance: Money.fromDecimal(5000000, 'IDR') },
          { account: cashAccount, balance: Money.fromDecimal(200000, 'IDR') },
        ],
        totalNetWorth: Money.fromDecimal(5200000, 'IDR'),
        isLoading: false,
        error: null,
        fetchAccounts: jest.fn(),
        createAccount: jest.fn(),
        updateAccount: jest.fn(),
        deleteAccount: jest.fn(),
        getAccount: jest.fn(),
      });

      const { getByText } = render(<AccountListScreen />);
      expect(getByText('TOTAL KEKAYAAN BERSIH')).toBeTruthy();
      expect(getByText('Rp 5.200.000')).toBeTruthy();
      expect(getByText('BCA Utama')).toBeTruthy();
      expect(getByText('Rp 5.000.000')).toBeTruthy();
      expect(getByText('Dompet Cash')).toBeTruthy();
      expect(getByText('Rp 200.000')).toBeTruthy();
    });
  });

  describe('CreateAccountScreen', () => {
    it('should validate required account name on submit', async () => {
      mockedUseAccounts.mockReturnValue({
        accounts: [],
        totalNetWorth: Money.zero('IDR'),
        isLoading: false,
        error: null,
        fetchAccounts: jest.fn(),
        createAccount: jest.fn(),
        updateAccount: jest.fn(),
        deleteAccount: jest.fn(),
        getAccount: jest.fn(),
      });

      const { getByText, getByLabelText } = render(<CreateAccountScreen />);

      // Press submit without name
      fireEvent.press(getByLabelText('Simpan akun baru'));

      await waitFor(() => {
        expect(getByText('Nama akun wajib diisi')).toBeTruthy();
      });
    });

    it('should submit valid account creation with opening balance', async () => {
      const mockCreate = jest.fn().mockResolvedValue(true);
      mockedUseAccounts.mockReturnValue({
        accounts: [],
        totalNetWorth: Money.zero('IDR'),
        isLoading: false,
        error: null,
        fetchAccounts: jest.fn(),
        createAccount: mockCreate,
        updateAccount: jest.fn(),
        deleteAccount: jest.fn(),
        getAccount: jest.fn(),
      });

      const { getByPlaceholderText, getByLabelText } = render(<CreateAccountScreen />);

      fireEvent.changeText(
        getByPlaceholderText('Contoh: Dompet Utama, BCA, GoPay'),
        'GoPay Tabungan'
      );
      fireEvent.changeText(getByPlaceholderText('0'), '350000');
      fireEvent.press(getByLabelText('Tipe E-Wallet'));

      fireEvent.press(getByLabelText('Simpan akun baru'));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'GoPay Tabungan',
            type: 'ewallet',
          })
        );
      });
    });
  });
});
