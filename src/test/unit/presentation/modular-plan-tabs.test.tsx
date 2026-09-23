import React from 'react';
import { render } from '@testing-library/react-native';
import { BudgetsTab } from '@/features/budgets/presentation/components/BudgetsTab';
import { SavingsGoalsTab } from '@/features/savings-goals/presentation/components/SavingsGoalsTab';
import { DebtsTab } from '@/features/debts/presentation/components/DebtsTab';
import { RecurringTab } from '@/features/recurring-transactions/presentation/components/RecurringTab';
import { useBudgets } from '@/features/budgets/presentation/use-budgets';
import { useSavingsGoals } from '@/features/savings-goals/presentation/use-savings-goals';
import { useDebts } from '@/features/debts/presentation/use-debts';
import { useRecurringTransactions } from '@/features/recurring-transactions/presentation/use-recurring-transactions';
import { useAccounts } from '@/features/accounts/presentation/use-accounts';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { Money } from '@/core/domain/money';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));
jest.mock('@/features/budgets/presentation/use-budgets');
jest.mock('@/features/savings-goals/presentation/use-savings-goals');
jest.mock('@/features/debts/presentation/use-debts');
jest.mock('@/features/recurring-transactions/presentation/use-recurring-transactions');
jest.mock('@/features/accounts/presentation/use-accounts');
jest.mock('@/features/categories/presentation/use-category-management');

describe('Modular Plan Screen Tabs Presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAccounts as jest.Mock).mockReturnValue({ accounts: [] });
    (useCategoryManagement as jest.Mock).mockReturnValue({ categories: [] });
  });

  describe('BudgetsTab', () => {
    it('should render empty state when no budgets exist', () => {
      (useBudgets as jest.Mock).mockReturnValue({
        budgets: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createBudget: jest.fn(),
        updateBudget: jest.fn(),
        deleteBudget: jest.fn(),
      });

      const { getByText } = render(<BudgetsTab />);
      expect(getByText('Belum Ada Anggaran')).toBeTruthy();
      expect(getByText('+ Buat Anggaran Baru')).toBeTruthy();
    });

    it('should render summary and budget card when budgets exist', () => {
      (useBudgets as jest.Mock).mockReturnValue({
        budgets: [
          {
            budget: {
              id: 'b-1',
              categoryId: 'cat-1',
              period: { periodType: 'monthly', startDate: '2026-08-01' },
            },
            categoryName: 'Makanan',
            categoryIcon: '🍔',
            budgetAmount: Money.fromDecimal(1000000, 'IDR'),
            actualSpending: Money.fromDecimal(400000, 'IDR'),
            remainingAmount: Money.fromDecimal(600000, 'IDR'),
            spentPercentage: 40,
            isOverBudget: false,
          },
        ],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createBudget: jest.fn(),
        updateBudget: jest.fn(),
        deleteBudget: jest.fn(),
      });

      const { getByText } = render(<BudgetsTab />);
      expect(getByText('Total Budget')).toBeTruthy();
      expect(getByText('Makanan')).toBeTruthy();
    });
  });

  describe('SavingsGoalsTab', () => {
    it('should render empty state when no goals exist', () => {
      (useSavingsGoals as jest.Mock).mockReturnValue({
        goals: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createGoal: jest.fn(),
        updateGoal: jest.fn(),
        deleteGoal: jest.fn(),
      });

      const { getByText } = render(<SavingsGoalsTab />);
      expect(getByText('Belum Ada Target Tabungan')).toBeTruthy();
    });
  });

  describe('DebtsTab', () => {
    it('should render empty state when no debts exist', () => {
      (useDebts as jest.Mock).mockReturnValue({
        debts: [],
        summary: {
          totalBorrowedRemaining: Money.fromDecimal(0, 'IDR'),
          totalLentRemaining: Money.fromDecimal(0, 'IDR'),
          overdueCount: 0,
          settledCount: 0,
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createDebt: jest.fn(),
        recordRepayment: jest.fn(),
        updateDebt: jest.fn(),
        deleteDebt: jest.fn(),
      });

      const { getByText } = render(<DebtsTab />);
      expect(getByText('Belum Ada Hutang / Piutang')).toBeTruthy();
    });
  });

  describe('RecurringTab', () => {
    it('should render empty state when no recurring transactions exist', () => {
      (useRecurringTransactions as jest.Mock).mockReturnValue({
        recurringList: [],
        summary: {
          totalMonthlyExpenseCommitment: Money.fromDecimal(0, 'IDR'),
          totalMonthlyIncomeCommitment: Money.fromDecimal(0, 'IDR'),
          dueCount: 0,
        },
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createRecurring: jest.fn(),
        updateRecurring: jest.fn(),
        toggleActive: jest.fn(),
        deleteRecurring: jest.fn(),
        processDueOccurrences: jest.fn(),
      });

      const { getByText } = render(<RecurringTab />);
      expect(getByText('Belum Ada Transaksi Berulang')).toBeTruthy();
    });
  });
});
