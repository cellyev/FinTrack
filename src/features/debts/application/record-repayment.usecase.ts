import { Result, err, ValidationError, NotFoundError, DomainError } from '@/core/domain/result';
import { IDebtRepository } from '../domain/debt-repository.interface';
import { Debt } from '../domain/debt';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';

export interface RecordRepaymentDTO {
  debtId: string;
  userId: string;
  paymentAmountMinorUnits: number;
  accountId?: string;
  categoryId?: string;
  transactionDate?: string;
  note?: string | null;
}

export class RecordRepaymentUseCase {
  constructor(
    private readonly debtRepo: IDebtRepository,
    private readonly uuidGenerator: IUuidGenerator = new ExpoUuidGenerator()
  ) {}

  public async execute(dto: RecordRepaymentDTO): Promise<Result<Debt, DomainError>> {
    try {
      if (!dto.debtId || dto.debtId.trim().length === 0) {
        return err(new ValidationError('Debt ID is required.'));
      }
      if (!dto.userId || dto.userId.trim().length === 0) {
        return err(new ValidationError('User ID is required.'));
      }
      if (dto.paymentAmountMinorUnits <= 0) {
        return err(new ValidationError('Repayment amount must be strictly greater than zero.'));
      }

      // Fetch debt to inspect existing state
      const debtResult = await this.debtRepo.getById(dto.debtId, dto.userId);
      if (!debtResult.success) {
        return err(debtResult.error);
      }
      if (!debtResult.data) {
        return err(new NotFoundError(`Debt with ID ${dto.debtId} not found.`));
      }

      const debt = debtResult.data;
      const paymentAmount = Money.fromMinorUnits(dto.paymentAmountMinorUnits, 'IDR');

      if (paymentAmount.minorUnits > debt.remainingAmount.minorUnits) {
        return err(
          new ValidationError(
            `Pembayaran (${paymentAmount.formatDisplay()}) tidak boleh melebihi sisa (${debt.remainingAmount.formatDisplay()}).`
          )
        );
      }

      let repaymentTransaction: Transaction | undefined;

      if (dto.accountId) {
        if (!dto.categoryId) {
          return err(new ValidationError('Kategori transaksi wajib dipilih untuk pembayaran/pelunasan kas.'));
        }

        const txId = this.uuidGenerator.generate();
        const itemId = this.uuidGenerator.generate();
        const txDate = dto.transactionDate ?? new Date().toISOString().split('T')[0];

        const item = new TransactionItem({
          id: itemId,
          transactionId: txId,
          categoryId: dto.categoryId,
          amount: paymentAmount,
          note: dto.note ?? (debt.isBorrowed ? `Cicilan/pelunasan hutang ke ${debt.personName}` : `Penerimaan cicilan/pelunasan piutang dari ${debt.personName}`),
        });

        if (debt.isBorrowed) {
          // Paying borrowed debt -> Expense transaction from source account
          repaymentTransaction = new Transaction({
            id: txId,
            userId: dto.userId,
            type: 'expense',
            amount: paymentAmount,
            transactionDate: txDate,
            sourceAccountId: dto.accountId,
            items: [item],
            note: dto.note ?? `Bayar hutang ke ${debt.personName}`,
            debtId: debt.id,
          });
        } else {
          // Collecting lent debt -> Income transaction to destination account
          repaymentTransaction = new Transaction({
            id: txId,
            userId: dto.userId,
            type: 'income',
            amount: paymentAmount,
            transactionDate: txDate,
            destinationAccountId: dto.accountId,
            items: [item],
            note: dto.note ?? `Terima piutang dari ${debt.personName}`,
            debtId: debt.id,
          });
        }
      }

      return this.debtRepo.recordRepayment({
        debtId: dto.debtId,
        userId: dto.userId,
        paymentAmount,
        repaymentTransaction,
      });
    } catch (e: unknown) {
      if (e instanceof DomainError) return err(e);
      return err(new ValidationError((e as Error).message));
    }
  }
}
