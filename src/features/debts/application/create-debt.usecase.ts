import { Result, ok, err, ValidationError, DomainError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt, DebtType } from '../domain/debt';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';

export interface CreateDebtDTO {
  userId: string;
  type: DebtType;
  personName: string;
  amountMinorUnits: number;
  dueDate?: string | null;
  note?: string | null;
  initialAccountMovement?: {
    accountId: string;
    categoryId: string;
    transactionDate?: string;
    note?: string | null;
  };
}

export class CreateDebtUseCase {
  constructor(
    private readonly debtRepo: IDebtRepository,
    private readonly uuidGenerator: IUuidGenerator = new ExpoUuidGenerator()
  ) {}

  public async execute(dto: CreateDebtDTO): Promise<Result<Debt, DomainError>> {
    try {
      if (!dto.userId || dto.userId.trim().length === 0) {
        return err(new ValidationError('User ID is required.'));
      }
      if (dto.amountMinorUnits <= 0) {
        return err(new ValidationError('Amount must be strictly greater than zero.'));
      }

      const debtId = this.uuidGenerator.generate();
      const originalAmount = Money.fromMinorUnits(dto.amountMinorUnits, 'IDR');

      const debt = new Debt({
        id: debtId,
        userId: dto.userId,
        type: dto.type,
        personName: dto.personName,
        originalAmount,
        remainingAmount: originalAmount,
        dueDate: dto.dueDate,
        status: 'open',
        note: dto.note,
      });

      let initialTransaction: Transaction | undefined;

      if (dto.initialAccountMovement) {
        const { accountId, categoryId, transactionDate, note } = dto.initialAccountMovement;
        if (!accountId || accountId.trim().length === 0) {
          return err(new ValidationError('Account ID is required for initial cash movement.'));
        }
        if (!categoryId || categoryId.trim().length === 0) {
          return err(new ValidationError('Category ID is required for initial cash movement.'));
        }

        const txId = this.uuidGenerator.generate();
        const itemId = this.uuidGenerator.generate();
        const txDate = transactionDate ?? new Date().toISOString().split('T')[0];

        const item = new TransactionItem({
          id: itemId,
          transactionId: txId,
          categoryId,
          amount: originalAmount,
          note: note ?? (dto.type === 'borrowed' ? `Penerimaan pinjaman dari ${dto.personName}` : `Pemberian pinjaman kepada ${dto.personName}`),
        });

        if (dto.type === 'borrowed') {
          // Borrowed funds enter user's account -> Income transaction
          initialTransaction = new Transaction({
            id: txId,
            userId: dto.userId,
            type: 'income',
            amount: originalAmount,
            transactionDate: txDate,
            destinationAccountId: accountId,
            items: [item],
            note: note ?? `Pinjaman dari ${dto.personName}`,
            debtId,
          });
        } else {
          // Lent funds leave user's account -> Expense transaction
          initialTransaction = new Transaction({
            id: txId,
            userId: dto.userId,
            type: 'expense',
            amount: originalAmount,
            transactionDate: txDate,
            sourceAccountId: accountId,
            items: [item],
            note: note ?? `Pinjaman kepada ${dto.personName}`,
            debtId,
          });
        }
      }

      const createResult = await this.debtRepo.create(debt, initialTransaction);
      if (!createResult.success) {
        return err(createResult.error);
      }

      return ok(debt);
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
