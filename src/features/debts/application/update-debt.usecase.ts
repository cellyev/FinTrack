import { Result, ok, err, ValidationError, NotFoundError, DomainError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt } from '../domain/debt';
import { Money } from '@/core/domain/money';

export interface UpdateDebtDTO {
  id: string;
  userId: string;
  personName: string;
  originalAmountMinorUnits?: number;
  remainingAmountMinorUnits?: number;
  dueDate?: string | null;
  note?: string | null;
}

export class UpdateDebtUseCase {
  constructor(private readonly debtRepo: IDebtRepository) {}

  public async execute(dto: UpdateDebtDTO): Promise<Result<Debt, DomainError>> {
    try {
      if (!dto.id || dto.id.trim().length === 0) {
        return err(new ValidationError('Debt ID is required.'));
      }
      if (!dto.userId || dto.userId.trim().length === 0) {
        return err(new ValidationError('User ID is required.'));
      }

      const existingResult = await this.debtRepo.getById(dto.id, dto.userId);
      if (!existingResult.success) {
        return err(existingResult.error);
      }
      if (!existingResult.data) {
        return err(new NotFoundError(`Debt with ID ${dto.id} not found.`));
      }

      const existing = existingResult.data;
      const originalAmount = dto.originalAmountMinorUnits !== undefined
        ? Money.fromMinorUnits(dto.originalAmountMinorUnits, 'IDR')
        : existing.originalAmount;

      const remainingAmount = dto.remainingAmountMinorUnits !== undefined
        ? Money.fromMinorUnits(dto.remainingAmountMinorUnits, 'IDR')
        : existing.remainingAmount;

      const updatedDebt = new Debt({
        id: existing.id,
        userId: existing.userId,
        type: existing.type,
        personName: dto.personName ?? existing.personName,
        originalAmount,
        remainingAmount,
        dueDate: dto.dueDate !== undefined ? dto.dueDate : existing.dueDate,
        note: dto.note !== undefined ? dto.note : existing.note,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        deletedAt: existing.deletedAt,
        syncState: 'pending',
      });

      const updateResult = await this.debtRepo.update(updatedDebt);
      if (!updateResult.success) {
        return err(updateResult.error);
      }

      return ok(updatedDebt);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
