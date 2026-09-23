import { renderHook, act } from '@testing-library/react-native';
import { useMonthlyAnalytics } from '@/features/analytics/presentation/use-monthly-analytics';
import { appEvents } from '@/core/events/app-events';
import { useAuth } from '@/features/auth/presentation/use-auth';

const mockExecute = jest.fn();

jest.mock('@/features/auth/presentation/use-auth');
jest.mock('@/features/analytics/application/get-monthly-analytics.usecase', () => ({
  getMonthDateRange: jest.fn().mockReturnValue({ previousPeriod: '2026-07' }),
  GetMonthlyAnalyticsUseCase: jest.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mockExecute(...args),
  })),
}));

describe('useMonthlyAnalytics hook reactivity', () => {
  const mockUser = { id: 'u-1', email: 'test@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        period: '2026-08',
        periodDisplay: 'Agustus 2026',
        cashflow: {
          period: '2026-08',
          income: { formatDisplay: () => 'Rp 5.000.000' },
          expense: { formatDisplay: () => 'Rp 3.000.000' },
          netCashflow: { formatDisplay: () => 'Rp 2.000.000' },
          isNetPositive: true,
          netCashflowFormatted: '+Rp 2.000.000',
          savingsRatePercentage: 40,
        },
        categories: [],
        budgetHealth: {
          totalBudget: { formatDisplay: () => 'Rp 0' },
          totalSpent: { formatDisplay: () => 'Rp 0' },
          totalRemaining: { formatDisplay: () => 'Rp 0' },
          utilizationPercentage: 0,
          budgetCount: 0,
          overBudgetCount: 0,
        },
        comparison: {
          currentPeriod: '2026-08',
          previousPeriod: '2026-07',
          currentExpense: { formatDisplay: () => 'Rp 3.000.000' },
          previousExpense: { formatDisplay: () => 'Rp 0' },
          expenseDelta: { formatDisplay: () => 'Rp 3.000.000' },
          isExpenseIncreased: true,
          expenseDeltaPercentage: 0,
          currentIncome: { formatDisplay: () => 'Rp 5.000.000' },
          previousIncome: { formatDisplay: () => 'Rp 0' },
          incomeDelta: { formatDisplay: () => 'Rp 5.000.000' },
          isIncomeIncreased: true,
          incomeDeltaPercentage: 0,
          currentNetCashflow: { formatDisplay: () => 'Rp 2.000.000' },
          currentNetIsPositive: true,
          previousNetCashflow: { formatDisplay: () => 'Rp 0' },
          previousNetIsPositive: true,
        },
      },
    });
  });

  it('should automatically reload analytics when transactions_changed is emitted', async () => {
    const { result } = renderHook(() => useMonthlyAnalytics('2026-08'));

    // Wait for initial load
    await act(async () => {});
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result.current.analytics?.cashflow.netCashflowFormatted).toBe('+Rp 2.000.000');

    // Emit transactions_changed
    await act(async () => {
      appEvents.emit('transactions_changed');
    });

    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('should automatically reload analytics when budgets_changed or data_invalidated is emitted', async () => {
    renderHook(() => useMonthlyAnalytics('2026-08'));

    await act(async () => {});
    expect(mockExecute).toHaveBeenCalledTimes(1);

    await act(async () => {
      appEvents.emit('budgets_changed');
    });
    expect(mockExecute).toHaveBeenCalledTimes(2);

    await act(async () => {
      appEvents.emit('data_invalidated');
    });
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});
