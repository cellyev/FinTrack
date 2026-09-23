import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MonthSelector } from '@/features/analytics/presentation/components/MonthSelector';
import { MonthlyCashflowCard } from '@/features/analytics/presentation/components/MonthlyCashflowCard';
import { CategorySpendingCard } from '@/features/analytics/presentation/components/CategorySpendingCard';
import { BudgetHealthCard } from '@/features/analytics/presentation/components/BudgetHealthCard';
import { MonthlyComparisonCard } from '@/features/analytics/presentation/components/MonthlyComparisonCard';
import { AnalyticsDashboardSection } from '@/features/analytics/presentation/components/AnalyticsDashboardSection';
import { useMonthlyAnalytics } from '@/features/analytics/presentation/use-monthly-analytics';
import { Money } from '@/core/domain/money';
import {
  MonthlyCashflowSummary,
  CategorySpendingItem,
  BudgetHealthOverview,
  MonthlyComparison,
  MonthlyAnalyticsDTO,
} from '@/features/analytics/domain/analytics-types';

jest.mock('@/features/analytics/presentation/use-monthly-analytics');

describe('Analytics Presentation Components', () => {
  describe('MonthSelector', () => {
    it('should render month name and trigger navigation callbacks', () => {
      const onPrev = jest.fn();
      const onNext = jest.fn();

      const { getByText, getByLabelText } = render(
        <MonthSelector
          periodDisplay="Agustus 2026"
          onPrevious={onPrev}
          onNext={onNext}
        />
      );

      expect(getByText('Agustus 2026')).toBeTruthy();

      fireEvent.press(getByLabelText('Bulan Sebelumnya'));
      expect(onPrev).toHaveBeenCalledTimes(1);

      fireEvent.press(getByLabelText('Bulan Berikutnya'));
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('MonthlyCashflowCard', () => {
    it('should render income, expense, positive net cashflow, and savings rate', () => {
      const mockCashflow: MonthlyCashflowSummary = {
        period: '2026-08',
        income: Money.fromDecimal(8000000, 'IDR'),
        expense: Money.fromDecimal(5500000, 'IDR'),
        netCashflow: Money.fromDecimal(2500000, 'IDR'),
        isNetPositive: true,
        netCashflowFormatted: '+Rp 2.500.000',
        savingsRatePercentage: 31.3,
      };

      const { getByText } = render(<MonthlyCashflowCard cashflow={mockCashflow} />);

      expect(getByText('Arus Kas Bulanan')).toBeTruthy();
      expect(getByText('Pemasukan')).toBeTruthy();
      expect(getByText('Pengeluaran')).toBeTruthy();
      expect(getByText('Net Cashflow')).toBeTruthy();
      expect(getByText('+Rp 2.500.000')).toBeTruthy();
      expect(getByText('Tingkat Tabungan: 31.3%')).toBeTruthy();
    });

    it('should render negative net cashflow properly when in deficit', () => {
      const mockCashflow: MonthlyCashflowSummary = {
        period: '2026-08',
        income: Money.fromDecimal(1000000, 'IDR'),
        expense: Money.fromDecimal(3000000, 'IDR'),
        netCashflow: Money.fromDecimal(2000000, 'IDR'),
        isNetPositive: false,
        netCashflowFormatted: '-Rp 2.000.000',
        savingsRatePercentage: 0,
      };

      const { getByText } = render(<MonthlyCashflowCard cashflow={mockCashflow} />);
      expect(getByText('-Rp 2.000.000')).toBeTruthy();
    });
  });

  describe('CategorySpendingCard', () => {
    it('should render empty state when no categories have spending', () => {
      const { getByText } = render(<CategorySpendingCard categories={[]} />);
      expect(getByText('Belum ada pengeluaran di bulan ini')).toBeTruthy();
    });

    it('should render list of categories with amounts and percentages', () => {
      const mockCategories: CategorySpendingItem[] = [
        {
          categoryId: 'cat-food',
          categoryName: 'Makanan & Minuman',
          categoryColor: '#E60012',
          categoryIcon: '🍔',
          amount: Money.fromDecimal(2000000, 'IDR'),
          percentage: 50.0,
        },
        {
          categoryId: 'cat-trans',
          categoryName: 'Transportasi',
          categoryColor: '#118EEA',
          categoryIcon: '🚗',
          amount: Money.fromDecimal(1000000, 'IDR'),
          percentage: 25.0,
        },
      ];

      const { getByText } = render(<CategorySpendingCard categories={mockCategories} />);

      expect(getByText('Distribusi Pengeluaran')).toBeTruthy();
      expect(getByText('Makanan & Minuman')).toBeTruthy();
      expect(getByText('50.0%')).toBeTruthy();
      expect(getByText('Transportasi')).toBeTruthy();
      expect(getByText('25.0%')).toBeTruthy();
    });
  });

  describe('BudgetHealthCard', () => {
    it('should render empty state when no active budgets exist', () => {
      const mockHealth: BudgetHealthOverview = {
        totalBudget: Money.fromDecimal(0, 'IDR'),
        totalSpent: Money.fromDecimal(0, 'IDR'),
        totalRemaining: Money.fromDecimal(0, 'IDR'),
        utilizationPercentage: 0,
        budgetCount: 0,
        overBudgetCount: 0,
      };

      const { getByText } = render(<BudgetHealthCard budgetHealth={mockHealth} />);
      expect(getByText('Belum ada anggaran aktif di bulan ini')).toBeTruthy();
    });

    it('should render budget health metrics and over-budget badge', () => {
      const mockHealth: BudgetHealthOverview = {
        totalBudget: Money.fromDecimal(10000000, 'IDR'),
        totalSpent: Money.fromDecimal(7200000, 'IDR'),
        totalRemaining: Money.fromDecimal(2800000, 'IDR'),
        utilizationPercentage: 72.0,
        budgetCount: 4,
        overBudgetCount: 1,
      };

      const { getByText } = render(<BudgetHealthCard budgetHealth={mockHealth} />);
      expect(getByText('Kesehatan Anggaran')).toBeTruthy();
      expect(getByText('1 Melebihi Batas')).toBeTruthy();
      expect(getByText('72.0% Terpakai')).toBeTruthy();
    });
  });

  describe('MonthlyComparisonCard', () => {
    it('should render comparison deltas and percentage changes', () => {
      const mockComparison: MonthlyComparison = {
        currentPeriod: '2026-08',
        previousPeriod: '2026-07',
        currentExpense: Money.fromDecimal(5500000, 'IDR'),
        previousExpense: Money.fromDecimal(4000000, 'IDR'),
        expenseDelta: Money.fromDecimal(1500000, 'IDR'),
        isExpenseIncreased: true,
        expenseDeltaPercentage: 37.5,
        currentIncome: Money.fromDecimal(8000000, 'IDR'),
        previousIncome: Money.fromDecimal(7000000, 'IDR'),
        incomeDelta: Money.fromDecimal(1000000, 'IDR'),
        isIncomeIncreased: true,
        incomeDeltaPercentage: 14.3,
        currentNetCashflow: Money.fromDecimal(2500000, 'IDR'),
        currentNetIsPositive: true,
        previousNetCashflow: Money.fromDecimal(3000000, 'IDR'),
        previousNetIsPositive: true,
      };

      const { getByText } = render(<MonthlyComparisonCard comparison={mockComparison} />);

      expect(getByText('Perbandingan vs Bulan Lalu')).toBeTruthy();
      expect(getByText('▲ +37.5%')).toBeTruthy();
      expect(getByText('+Rp 1.500.000')).toBeTruthy();
      expect(getByText('▲ +14.3%')).toBeTruthy();
      expect(getByText('+Rp 1.000.000')).toBeTruthy();
    });
  });

  describe('AnalyticsDashboardSection', () => {
    it('should render loading indicator when loading without data', () => {
      (useMonthlyAnalytics as jest.Mock).mockReturnValue({
        analytics: null,
        isLoading: true,
        error: null,
        refresh: jest.fn(),
        goToPreviousMonth: jest.fn(),
        goToNextMonth: jest.fn(),
      });

      const { getByText } = render(<AnalyticsDashboardSection />);
      expect(getByText('Memuat ringkasan keuangan...')).toBeTruthy();
    });

    it('should render error state with retry button', () => {
      const refreshMock = jest.fn();
      (useMonthlyAnalytics as jest.Mock).mockReturnValue({
        analytics: null,
        isLoading: false,
        error: 'Network timeout',
        refresh: refreshMock,
        goToPreviousMonth: jest.fn(),
        goToNextMonth: jest.fn(),
      });

      const { getByText } = render(<AnalyticsDashboardSection />);
      expect(getByText('Gagal memuat analitik: Network timeout')).toBeTruthy();

      fireEvent.press(getByText('Coba Lagi'));
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('should render full analytics cards when data is loaded', () => {
      const mockAnalytics: MonthlyAnalyticsDTO = {
        period: '2026-08',
        periodDisplay: 'Agustus 2026',
        cashflow: {
          period: '2026-08',
          income: Money.fromDecimal(5000000, 'IDR'),
          expense: Money.fromDecimal(3000000, 'IDR'),
          netCashflow: Money.fromDecimal(2000000, 'IDR'),
          isNetPositive: true,
          netCashflowFormatted: '+Rp 2.000.000',
          savingsRatePercentage: 40.0,
        },
        categories: [],
        budgetHealth: {
          totalBudget: Money.fromDecimal(0, 'IDR'),
          totalSpent: Money.fromDecimal(0, 'IDR'),
          totalRemaining: Money.fromDecimal(0, 'IDR'),
          utilizationPercentage: 0,
          budgetCount: 0,
          overBudgetCount: 0,
        },
        comparison: {
          currentPeriod: '2026-08',
          previousPeriod: '2026-07',
          currentExpense: Money.fromDecimal(3000000, 'IDR'),
          previousExpense: Money.fromDecimal(0, 'IDR'),
          expenseDelta: Money.fromDecimal(3000000, 'IDR'),
          isExpenseIncreased: true,
          expenseDeltaPercentage: 0,
          currentIncome: Money.fromDecimal(5000000, 'IDR'),
          previousIncome: Money.fromDecimal(0, 'IDR'),
          incomeDelta: Money.fromDecimal(5000000, 'IDR'),
          isIncomeIncreased: true,
          incomeDeltaPercentage: 0,
          currentNetCashflow: Money.fromDecimal(2000000, 'IDR'),
          currentNetIsPositive: true,
          previousNetCashflow: Money.fromDecimal(0, 'IDR'),
          previousNetIsPositive: true,
        },
      };

      (useMonthlyAnalytics as jest.Mock).mockReturnValue({
        analytics: mockAnalytics,
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        goToPreviousMonth: jest.fn(),
        goToNextMonth: jest.fn(),
      });

      const { getByText } = render(<AnalyticsDashboardSection />);
      expect(getByText('Agustus 2026')).toBeTruthy();
      expect(getByText('Arus Kas Bulanan')).toBeTruthy();
      expect(getByText('Distribusi Pengeluaran')).toBeTruthy();
      expect(getByText('Kesehatan Anggaran')).toBeTruthy();
      expect(getByText('Perbandingan vs Bulan Lalu')).toBeTruthy();
    });
  });
});
