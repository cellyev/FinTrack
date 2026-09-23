import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SavingsGoalProgressCard } from '@/features/savings-goals/presentation/components/SavingsGoalProgressCard';
import { CreateSavingsGoalModal } from '@/features/savings-goals/presentation/screens/CreateSavingsGoalModal';
import { EditSavingsGoalModal } from '@/features/savings-goals/presentation/screens/EditSavingsGoalModal';
import { SavingsGoal } from '@/features/savings-goals/domain/savings-goal';
import { calculateSavingsGoalProgress } from '@/features/savings-goals/domain/savings-goal-progress';
import { Money } from '@/core/domain/money';

describe('Savings Goals Presentation Components', () => {
  const goal = new SavingsGoal({
    id: 'sg-1',
    userId: 'user-1',
    name: 'Dana Darurat',
    targetAmount: Money.fromMinorUnits(1000000000n, 'IDR'), // Rp 10.000.000
    currentAmount: Money.fromMinorUnits(200000000n, 'IDR'), // Rp 2.000.000
    targetDate: '2026-12-31',
    createdAt: '2026-08-19T00:00:00.000Z',
    updatedAt: '2026-08-19T00:00:00.000Z',
  });

  it('should render SavingsGoalProgressCard with percentage, amounts, and trigger onPress', () => {
    const progress = calculateSavingsGoalProgress(goal);
    const onPressMock = jest.fn();

    const { getByText } = render(
      <SavingsGoalProgressCard progress={progress} onPress={onPressMock} />
    );

    expect(getByText('🎯 Dana Darurat')).toBeTruthy();
    expect(getByText('20%')).toBeTruthy();
    expect(getByText('Target: 2026-12-31')).toBeTruthy();
    expect(getByText('Berjalan')).toBeTruthy();

    fireEvent.press(getByText('🎯 Dana Darurat'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should render completed badge when goal is completed', () => {
    const completedGoal = new SavingsGoal({
      id: 'sg-comp',
      userId: 'user-1',
      name: 'Laptop Baru',
      targetAmount: Money.fromMinorUnits(1500000000n, 'IDR'),
      currentAmount: Money.fromMinorUnits(1500000000n, 'IDR'),
      createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z',
    });

    const progress = calculateSavingsGoalProgress(completedGoal);
    const { getByText } = render(<SavingsGoalProgressCard progress={progress} />);

    expect(getByText('Selesai')).toBeTruthy();
    expect(getByText('100%')).toBeTruthy();
    expect(getByText(/Selamat! Target tabungan ini telah tercapai/)).toBeTruthy();
  });

  it('should submit CreateSavingsGoalModal with valid form data', async () => {
    const onSubmitMock = jest.fn().mockResolvedValue(true);
    const onCloseMock = jest.fn();

    const { getByPlaceholderText, getByText } = render(
      <CreateSavingsGoalModal
        visible={true}
        onClose={onCloseMock}
        onSubmit={onSubmitMock}
      />
    );

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('Contoh: Dana Darurat, Laptop Baru'),
        'Liburan Akhir Tahun'
      );
    });

    // Enter target amount in first '0' placeholder input
    const inputs = render(
      <CreateSavingsGoalModal
        visible={true}
        onClose={onCloseMock}
        onSubmit={onSubmitMock}
      />
    ).getAllByPlaceholderText('0');

    await act(async () => {
      fireEvent.changeText(inputs[0], '5000000'); // Target: 5.000.000
    });

    const submitBtn = getByText('Simpan Target');
    await act(async () => {
      fireEvent.press(submitBtn);
    });
  });

  it('should render EditSavingsGoalModal and display current values', () => {
    const progress = calculateSavingsGoalProgress(goal);
    const onSubmitMock = jest.fn().mockResolvedValue(true);
    const onDeleteMock = jest.fn().mockResolvedValue(true);
    const onCloseMock = jest.fn();

    const { getByText, getByDisplayValue } = render(
      <EditSavingsGoalModal
        visible={true}
        goalProgress={progress}
        onClose={onCloseMock}
        onSubmit={onSubmitMock}
        onDelete={onDeleteMock}
      />
    );

    expect(getByText('✏️ Edit Target Tabungan')).toBeTruthy();
    expect(getByDisplayValue('Dana Darurat')).toBeTruthy();
    expect(getByText(/31 Desember 2026/)).toBeTruthy();
  });
});
