import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DebtDetailModal } from '@/features/debts/presentation/screens/DebtDetailModal';
import { SavingsGoalDetailModal } from '@/features/savings-goals/presentation/screens/SavingsGoalDetailModal';
import { RecurringDetailModal } from '@/features/recurring-transactions/presentation/screens/RecurringDetailModal';
import { PreferencesModal } from '@/features/profile/presentation/screens/PreferencesModal';
import { SyncDiagnosticsModal } from '@/core/sync/presentation/screens/SyncDiagnosticsModal';
import { useUserPreferences } from '@/core/preferences/preferences-store';
import { Debt } from '@/features/debts/domain/debt';
import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { calculateSavingsGoalProgress } from '@/features/savings-goals/domain/savings-goal-progress';
import { RecurringTransaction } from '@/features/recurring-transactions/domain/recurring-transaction';
import { Money } from '@/core/domain/money';

// Mock useAuth
jest.mock('@/features/auth/presentation/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-test-1', email: 'test@example.com', fullName: 'Test User' },
    signOut: jest.fn(),
    isLoading: false,
  }),
}));

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}));

jest.mock('@/features/transactions/data/sqlite-transaction.repository', () => {
  return {
    SqliteTransactionRepository: jest.fn().mockImplementation(() => ({
      list: jest.fn().mockReturnValue(new Promise(() => {})),
    })),
  };
});

jest.mock('@/features/debts/application/get-debt-detail.usecase', () => {
  return {
    GetDebtDetailUseCase: jest.fn().mockImplementation(() => ({
      execute: jest.fn().mockReturnValue(new Promise(() => {})),
    })),
  };
});

describe('Rich Timelines, Workflow Integrations & Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DebtDetailModal', () => {
    const mockDebt = new Debt({
      id: 'debt-1',
      userId: 'user-test-1',
      personName: 'Budi Santoso',
      type: 'borrowed',
      originalAmount: Money.fromDecimal(1000000, 'IDR'),
      remainingAmount: Money.fromDecimal(500000, 'IDR'),
      dueDate: '2026-09-01',
      note: 'Pinjaman modal usaha',
    });

    it('should render debt detail information and triggers callbacks', () => {
      const onPay = jest.fn();
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const onClose = jest.fn();

      const { getByText } = render(
        <DebtDetailModal
          visible={true}
          debt={mockDebt}
          onClose={onClose}
          onPayPress={onPay}
          onEditPress={onEdit}
          onDeletePress={onDelete}
        />
      );

      expect(getByText('Detail Hutang')).toBeTruthy();
      expect(getByText('👤 Budi Santoso')).toBeTruthy();
      expect(getByText('Rp 1.000.000')).toBeTruthy();
      expect(getByText('Rp 500.000')).toBeTruthy();
      expect(getByText('Pinjaman modal usaha')).toBeTruthy();

      fireEvent.press(getByText('💳 Bayar / Angsur'));
      expect(onPay).toHaveBeenCalledWith(mockDebt);

      fireEvent.press(getByText('✏️ Edit'));
      expect(onEdit).toHaveBeenCalledWith(mockDebt);
    });
  });

  describe('SavingsGoalDetailModal', () => {
    const mockGoal = new SavingsGoal({
      id: 'goal-1',
      userId: 'user-test-1',
      name: 'Dana Darurat',
      targetAmount: Money.fromDecimal(10000000, 'IDR'),
      currentAmount: Money.fromDecimal(6000000, 'IDR'),
      targetDate: '2026-12-31',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const mockProgress = calculateSavingsGoalProgress(mockGoal);

    it('should render savings goal metrics and milestones timeline', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const onClose = jest.fn();

      const { getByText } = render(
        <SavingsGoalDetailModal
          visible={true}
          goalProgress={mockProgress}
          onClose={onClose}
          onEditPress={onEdit}
          onDeletePress={onDelete}
        />
      );

      expect(getByText('Dana Darurat')).toBeTruthy();
      expect(getByText('Rp 6.000.000')).toBeTruthy();
      expect(getByText('Rp 10.000.000')).toBeTruthy();
      expect(getByText('50% - Setengah Jalan')).toBeTruthy();

      fireEvent.press(getByText('✏️ Edit Target'));
      expect(onEdit).toHaveBeenCalledWith(mockProgress);
    });
  });

  describe('RecurringDetailModal', () => {
    const mockRecurring = new RecurringTransaction({
      id: 'rec-1',
      userId: 'user-test-1',
      note: 'Langganan Internet',
      type: 'expense',
      amount: Money.fromDecimal(450000, 'IDR'),
      frequency: 'monthly',
      startDate: '2026-01-01',
      nextOccurrence: '2026-02-01',
      isActive: true,
      accountId: 'acc-1',
      categoryId: 'cat-1',
    });

    it('should render recurring schedule details and execution log section', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();
      const onClose = jest.fn();

      const { getByText } = render(
        <RecurringDetailModal
          visible={true}
          recurring={mockRecurring}
          onClose={onClose}
          onEditPress={onEdit}
          onDeletePress={onDelete}
        />
      );

      expect(getByText('Langganan Internet')).toBeTruthy();
      expect(getByText('Rp 450.000')).toBeTruthy();
      expect(getByText('● AKTIF')).toBeTruthy();

      fireEvent.press(getByText('✏️ Edit Jadwal'));
      expect(onEdit).toHaveBeenCalledWith(mockRecurring);
    });
  });

  describe('PreferencesStore & PreferencesModal', () => {
    it('should update user preferences correctly', () => {
      const { setCurrencyDisplay, setHapticsEnabled } = useUserPreferences.getState();

      setCurrencyDisplay('short');
      expect(useUserPreferences.getState().currencyDisplay).toBe('short');

      setHapticsEnabled(false);
      expect(useUserPreferences.getState().hapticsEnabled).toBe(false);

      // Restore defaults
      setCurrencyDisplay('standard');
      setHapticsEnabled(true);
    });

    it('should render preferences modal options', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <PreferencesModal visible={true} onClose={onClose} />
      );

      expect(getByText('Preferensi Aplikasi')).toBeTruthy();
      expect(getByText('AKUN DEFAULT TRANSAKSI')).toBeTruthy();
      expect(getByText('FORMAT TAMPILAN MATA UANG')).toBeTruthy();
      expect(getByText('Getaran Sentuhan (Haptic Feedback)')).toBeTruthy();

      fireEvent.press(getByText('Simpan & Tutup'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('SyncDiagnosticsModal', () => {
    it('should render sync diagnostic metrics and manual sync action', async () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <SyncDiagnosticsModal visible={true} onClose={onClose} />
      );

      expect(getByText('Diagnostik Sinkronisasi & Offline')).toBeTruthy();
      expect(getByText('ANTREAN OUTBOX')).toBeTruthy();
      expect(getByText('KONFLIK TERTUNDA')).toBeTruthy();
      expect(getByText('INFORMASI ENGINE SINKRONISASI')).toBeTruthy();
    });
  });
});
