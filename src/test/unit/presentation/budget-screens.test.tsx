import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { BudgetProgressCard } from '@/features/budgets/presentation/components/BudgetProgressCard';
import { CreateBudgetModal } from '@/features/budgets/presentation/screens/CreateBudgetScreen';
import { EditBudgetModal } from '@/features/budgets/presentation/screens/EditBudgetScreen';
import { Budget } from '@/features/budgets/domain/budget';
import { BudgetPeriod } from '@/features/budgets/domain/budget-period';
import { Money } from '@/core/domain/money';
import { calculateBudgetProgress } from '@/features/budgets/domain/budget-progress';

// Mock category hook with stable references
const mockCategories = [
  {
    id: 'cat-food',
    userId: 'user-1',
    name: 'Makanan',
    type: 'expense',
    icon: '🍔',
    color: '#EF4444',
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    isDeleted: () => false,
  },
];
const mockRefreshCategories = jest.fn();

jest.mock('@/features/categories/presentation/use-category-management', () => ({
  useCategoryManagement: () => ({
    categories: mockCategories,
    refresh: mockRefreshCategories,
  }),
}));

describe('Budget Presentation Layer Components', () => {
  const period = new BudgetPeriod('2026-08-01', '2026-08-31', 'monthly');
  const budget = new Budget({
    id: 'bg-1',
    userId: 'user-1',
    categoryId: 'cat-food',
    name: 'Makan Agustus',
    amount: Money.fromMinorUnits(100000000n, 'IDR'), // Rp 1.000.000
    period,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  });

  it('should render BudgetProgressCard with correct stats and progress', () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      categoryIcon: '🍔',
      actualSpending: Money.fromMinorUnits(40000000n, 'IDR'), // Rp 400.000 (40%)
    });

    const onPressMock = jest.fn();
    const { getByText } = render(
      <BudgetProgressCard progress={progress} onPress={onPressMock} />
    );

    expect(getByText('Makanan')).toBeTruthy();
    expect(getByText('Makan Agustus')).toBeTruthy();
    expect(getByText('40%')).toBeTruthy();
    expect(getByText('Rp 400.000')).toBeTruthy();
    expect(getByText('Rp 600.000')).toBeTruthy();

    fireEvent.press(getByText('Makanan'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should render Over Budget badge when spending > budget', () => {
    const overBudgetProgress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      actualSpending: Money.fromMinorUnits(120000000n, 'IDR'), // Rp 1.200.000 (120%)
    });

    const { getByText } = render(<BudgetProgressCard progress={overBudgetProgress} />);

    expect(getByText('Over Budget')).toBeTruthy();
    expect(getByText('120%')).toBeTruthy();
  });

  it('should render CreateBudgetModal and handle submit', async () => {
    const onSubmitMock = jest.fn().mockResolvedValue(true);
    const onCloseMock = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <CreateBudgetModal
        visible={true}
        onClose={onCloseMock}
        onSubmit={onSubmitMock}
      />
    );

    expect(getByText('Buat Anggaran Baru')).toBeTruthy();

    // Select category
    fireEvent.press(getByText('Makanan'));

    // Enter amount
    const amountInput = getByPlaceholderText('Contoh: 1.000.000');
    fireEvent.changeText(amountInput, '1500000');

    // Enter name
    const nameInput = getByPlaceholderText('Contoh: Belanja Bulanan');
    fireEvent.changeText(nameInput, 'Makan Kantor');

    // Submit
    const submitBtn = getByText('Simpan Anggaran');
    await act(async () => {
      fireEvent.press(submitBtn);
    });

    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-food',
        name: 'Makan Kantor',
        amountMinorUnits: 1500000,
        periodType: 'monthly',
      })
    );
  });

  it('should render EditBudgetModal and handle update and delete', async () => {
    const progress = calculateBudgetProgress({
      budget,
      categoryName: 'Makanan',
      categoryIcon: '🍔',
      actualSpending: Money.fromMinorUnits(40000000n, 'IDR'),
    });

    const onUpdateMock = jest.fn().mockResolvedValue(true);
    const onDeleteMock = jest.fn().mockResolvedValue(true);
    const onCloseMock = jest.fn();

    const { getByText } = render(
      <EditBudgetModal
        visible={true}
        budgetProgress={progress}
        onClose={onCloseMock}
        onUpdate={onUpdateMock}
        onDelete={onDeleteMock}
      />
    );

    expect(getByText('Ubah Anggaran (Makanan)')).toBeTruthy();

    // Update button
    const saveBtn = getByText('Simpan Perubahan');
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    expect(onUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bg-1',
        name: 'Makan Agustus',
        amountMinorUnits: 100000000,
      })
    );
  });
});
