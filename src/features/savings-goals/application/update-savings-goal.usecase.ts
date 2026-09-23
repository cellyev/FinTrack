import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/domain/result';
import { SavingsGoal } from '../domain/savings-goal';
import { ISavingsGoalRepository } from '../domain/savings-goal-repository.interface';
import { Money } from '@/core/domain/money';

export interface UpdateSavingsGoalInput {
  id: string;
  userId: string;
  name: string;
  targetAmountMinorUnits: number;
  currentAmountMinorUnits: number;
  targetDate?: string | null;
}

export class UpdateSavingsGoalUseCase {
  constructor(private readonly goalRepo: ISavingsGoalRepository) {}

  public async execute(input: UpdateSavingsGoalInput): Promise<Result<SavingsGoal, DomainError>> {
    if (!input.id || input.id.trim().length === 0) {
      return err(new ValidationError('Savings Goal ID is required.'));
    }
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required.'));
    }
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Nama target tabungan tidak boleh kosong.'));
    }
    if (input.targetAmountMinorUnits <= 0) {
      return err(new ValidationError('Target nominal harus lebih besar dari nol.'));
    }
    if (input.currentAmountMinorUnits < 0) {
      return err(new ValidationError('Nominal terkumpul tidak boleh negatif.'));
    }
    if (input.currentAmountMinorUnits > input.targetAmountMinorUnits) {
      return err(new ValidationError('Nominal terkumpul tidak boleh melebihi target nominal.'));
    }

    if (input.targetDate && input.targetDate.trim().length > 0) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(input.targetDate.trim())) {
        return err(new ValidationError('Format target tanggal harus YYYY-MM-DD.'));
      }
    }

    const existingResult = await this.goalRepo.getById(input.id, input.userId);
    if (!existingResult.success) {
      return err(existingResult.error);
    }
    if (!existingResult.data || existingResult.data.isDeleted) {
      return err(new NotFoundError('Target tabungan tidak ditemukan atau telah dihapus.'));
    }

    const existing = existingResult.data;
    const nowIso = new Date().toISOString();

    const updatedGoal = new SavingsGoal({
      id: existing.id,
      userId: existing.userId,
      name: input.name.trim(),
      targetAmount: Money.fromMinorUnits(input.targetAmountMinorUnits, 'IDR'),
      currentAmount: Money.fromMinorUnits(input.currentAmountMinorUnits, 'IDR'),
      targetDate: input.targetDate?.trim() || null,
      createdAt: existing.createdAt,
      updatedAt: nowIso,
      deletedAt: null,
      syncState: 'pending',
      baseUpdatedAt: existing.baseUpdatedAt ?? existing.updatedAt,
    });

    const updateResult = await this.goalRepo.update(updatedGoal);
    if (!updateResult.success) {
      return err(updateResult.error);
    }

    return ok(updatedGoal);
  }
}
