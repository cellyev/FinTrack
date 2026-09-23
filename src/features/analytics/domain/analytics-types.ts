import { Money } from '@/core/domain/money';

export interface MonthlyCashflowSummary {
  period: string; // YYYY-MM
  income: Money;
  expense: Money;
  netCashflow: Money; // Absolute amount
  isNetPositive: boolean; // true if income >= expense
  netCashflowFormatted: string; // "+Rp 2.500.000" or "-Rp 500.000" or "Rp 0"
  savingsRatePercentage: number; // e.g. 31.3 for 31.3%, 0 if income is 0 or net is negative
}

export interface CategorySpendingItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  amount: Money;
  percentage: number; // e.g. 40.5 for 40.5%
}

export interface BudgetHealthOverview {
  totalBudget: Money;
  totalSpent: Money;
  totalRemaining: Money;
  utilizationPercentage: number; // e.g. 72.0 for 72%
  budgetCount: number;
  overBudgetCount: number;
}

export interface MonthlyComparison {
  currentPeriod: string; // YYYY-MM
  previousPeriod: string; // YYYY-MM
  currentExpense: Money;
  previousExpense: Money;
  expenseDelta: Money; // Absolute diff
  isExpenseIncreased: boolean; // true if current > previous
  expenseDeltaPercentage: number; // e.g. 37.5 for +37.5%, 0 if previous is 0
  currentIncome: Money;
  previousIncome: Money;
  incomeDelta: Money; // Absolute diff
  isIncomeIncreased: boolean;
  incomeDeltaPercentage: number;
  currentNetCashflow: Money;
  currentNetIsPositive: boolean;
  previousNetCashflow: Money;
  previousNetIsPositive: boolean;
}

export interface MonthlyAnalyticsDTO {
  period: string; // YYYY-MM
  periodDisplay: string; // e.g. "Agustus 2026"
  cashflow: MonthlyCashflowSummary;
  categories: CategorySpendingItem[];
  budgetHealth: BudgetHealthOverview;
  comparison: MonthlyComparison;
}
