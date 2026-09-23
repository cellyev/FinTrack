import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { SavingsGoal } from '../domain/savings-goal';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';
import { Money } from '@/core/domain/money';
import * as Crypto from 'expo-crypto';

export interface CreateSavingsGoalInput {
  userId: string;
  name: string;
  targetAmountMinorUnits: number;
  currentAmountMinorUnits?: number;
  targetDate?: string | null;
}

export class CreateSavingsGoalUseCase {
  constructor(private readonly goalRepo: ISavingsGoalRepository) {}

  public async execute(input: CreateSavingsGoalInput): Promise<Result<SavingsGoal, DomainError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Nama target tabungan tidak boleh kosong.'));
    }
    if (input.targetAmountMinorUnits <= 0) {
      return err(new ValidationError('Target nominal harus lebih besar dari nol.'));
    }

    const currentMinor = input.currentAmountMinorUnits ?? 0;
    if (currentMinor < 0) {
      return err(new ValidationError('Nominal terkumpul tidak boleh negatif.'));
    }
    if (currentMinor > input.targetAmountMinorUnits) {
      return err(new ValidationError('Nominal terkumpul tidak boleh melebihi target nominal.'));
    }

    if (input.targetDate && input.targetDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(input.targetDate.trim())) {
        return err(new ValidationError('Format target tanggal harus YYYY-MM-DD.'));
      }
    }

    const rawUuid = typeof Crypto?.randomUUID === 'function' ? Crypto.randomUUID() : null;
    const id = rawUuid || `goal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    const goal = new SavingsGoal({
      id,
      userId: input.userId,
      name: input.name.trim(),
      targetAmount: Money.fromMinorUnits(input.targetAmountMinorUnits, 'IDR'),
      currentAmount: Money.fromMinorUnits(currentMinor, 'IDR'),
      targetDate: input.targetDate?.trim() || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      syncState: 'pending',
    });

    const createResult = await this.goalRepo.create(goal);
    if (!createResult.success) {
      return err(createResult.error);
    }

    return ok(goal);
  }
}
