import { Result, ok, err, ValidationError, NotFoundError, DomainError } from '@/core/domain/result';
import { Transaction } from '../domain/transaction';
import { TransactionItem } from '../domain/transaction-item';
import { TransactionType } from '../domain/transaction-type';
import { ITransactionRepository, TransactionFilter } from '../domain/transaction-repository.interface';
import { IAccountRepository } from '@/features/accounts/domain/account-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { LedgerBalanceCalculator } from '../domain/services/balance-calculator';
import {
  ITransactionCorrectionPolicy,
  SevenDayCorrectionPolicy,
} from '../domain/policies/correction-window-policy';
import { CorrectionWindowExpiredError } from '../domain/transaction-errors';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';
import { SystemClock } from '@/core/infrastructure/clock/system-clock';

export interface CreateTransactionItemDTO {
  categoryId: string;
  amount: Money;
  note?: string | null;
}

export interface CreateTransactionDTO {
  userId: string;
  type: TransactionType;
  amount: Money;
  transactionDate: string; // YYYY-MM-DD
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
  items?: CreateTransactionItemDTO[];
  note?: string | null;
  debtId?: string | null;
  recurringTransactionId?: string | null;
  occurrenceKey?: string | null;
}

export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly uuidGenerator: IUuidGenerator
  ) {}

  public async execute(dto: CreateTransactionDTO): Promise<Result<Transaction, DomainError>> {
    try {
      const transactionId = this.uuidGenerator.generate();

      const items = (dto.items ?? []).map(
        (itemDto) =>
          new TransactionItem({
            id: this.uuidGenerator.generate(),
            transactionId,
            categoryId: itemDto.categoryId,
            amount: itemDto.amount,
            note: itemDto.note,
          })
      );

      const transaction = new Transaction({
        id: transactionId,
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        transactionDate: dto.transactionDate,
        sourceAccountId: dto.sourceAccountId,
        destinationAccountId: dto.destinationAccountId,
        items,
        note: dto.note,
        debtId: dto.debtId,
        recurringTransactionId: dto.recurringTransactionId,
        occurrenceKey: dto.occurrenceKey,
      });

      const result = await this.transactionRepository.create(transaction);
      if (!result.success) {
        return err(result.error);
      }

      return ok(transaction);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

// Specialized Use Case for Expense
export interface CreateExpenseDTO {
  userId: string;
  amount: Money;
  sourceAccountId: string;
  transactionDate?: string; // YYYY-MM-DD (defaults to today)
  items: {
    categoryId: string;
    amount: Money;
    note?: string | null;
  }[];
  note?: string | null;
}

export class CreateExpenseUseCase {
  private readonly createTxUseCase: CreateTransactionUseCase;

  constructor(
    transactionRepository: ITransactionRepository,
    uuidGenerator: IUuidGenerator
  ) {
    this.createTxUseCase = new CreateTransactionUseCase(transactionRepository, uuidGenerator);
  }

  public async execute(dto: CreateExpenseDTO): Promise<Result<Transaction, DomainError>> {
    const dateStr = dto.transactionDate ?? new Date().toISOString().split('T')[0];
    return this.createTxUseCase.execute({
      userId: dto.userId,
      type: 'expense',
      amount: dto.amount,
      transactionDate: dateStr,
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: null,
      items: dto.items,
      note: dto.note,
    });
  }
}

// Specialized Use Case for Income
export interface CreateIncomeDTO {
  userId: string;
  amount: Money;
  destinationAccountId: string;
  transactionDate?: string; // YYYY-MM-DD (defaults to today)
  items: {
    categoryId: string;
    amount: Money;
    note?: string | null;
  }[];
  note?: string | null;
}

export class CreateIncomeUseCase {
  private readonly createTxUseCase: CreateTransactionUseCase;

  constructor(
    transactionRepository: ITransactionRepository,
    uuidGenerator: IUuidGenerator
  ) {
    this.createTxUseCase = new CreateTransactionUseCase(transactionRepository, uuidGenerator);
  }

  public async execute(dto: CreateIncomeDTO): Promise<Result<Transaction, DomainError>> {
    const dateStr = dto.transactionDate ?? new Date().toISOString().split('T')[0];
    return this.createTxUseCase.execute({
      userId: dto.userId,
      type: 'income',
      amount: dto.amount,
      transactionDate: dateStr,
      sourceAccountId: null,
      destinationAccountId: dto.destinationAccountId,
      items: dto.items,
      note: dto.note,
    });
  }
}

// Specialized Use Case for Transfer
export interface CreateTransferDTO {
  userId: string;
  amount: Money;
  sourceAccountId: string;
  destinationAccountId: string;
  transactionDate?: string; // YYYY-MM-DD (defaults to today)
  note?: string | null;
}

export class CreateTransferUseCase {
  private readonly createTxUseCase: CreateTransactionUseCase;

  constructor(
    transactionRepository: ITransactionRepository,
    uuidGenerator: IUuidGenerator
  ) {
    this.createTxUseCase = new CreateTransactionUseCase(transactionRepository, uuidGenerator);
  }

  public async execute(dto: CreateTransferDTO): Promise<Result<Transaction, DomainError>> {
    const dateStr = dto.transactionDate ?? new Date().toISOString().split('T')[0];
    return this.createTxUseCase.execute({
      userId: dto.userId,
      type: 'transfer',
      amount: dto.amount,
      transactionDate: dateStr,
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: dto.destinationAccountId,
      items: [],
      note: dto.note,
    });
  }
}

export class ListTransactionsUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  public async execute(filter: TransactionFilter): Promise<Result<Transaction[], DomainError>> {
    return this.transactionRepository.list(filter);
  }
}

export class GetTransactionUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  public async execute(id: string, userId: string): Promise<Result<Transaction | null, DomainError>> {
    return this.transactionRepository.findById(id, userId);
  }
}

// -------------------------------------------------------------
// Phase 1G: Update / Correct Transaction Use Case & DTOs
// -------------------------------------------------------------

export interface UpdateTransactionSplitItemDTO {
  id?: string;
  categoryId: string;
  amount: Money;
  note?: string | null;
}

export interface UpdateTransactionDTO {
  id: string;
  userId: string;
  amount: Money;
  transactionDate: string; // YYYY-MM-DD
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
  items?: UpdateTransactionSplitItemDTO[];
  note?: string | null;
}

export class UpdateTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly correctionPolicy: ITransactionCorrectionPolicy = new SevenDayCorrectionPolicy(
      new SystemClock()
    ),
    private readonly uuidGenerator: IUuidGenerator = {
      generate: () => 'uuid-' + Math.random().toString(36).substring(2, 9),
      isValid: (_id: string) => true,
    }
  ) {}

  public async execute(dto: UpdateTransactionDTO): Promise<Result<Transaction, DomainError>> {
    try {
      // 1. Fetch existing transaction with user isolation
      const findResult = await this.transactionRepository.findById(dto.id, dto.userId);
      if (!findResult.success) {
        return err(findResult.error);
      }

      const existingTx = findResult.data;
      if (!existingTx || existingTx.isDeleted()) {
        return err(new NotFoundError(`Transaksi dengan ID ${dto.id} tidak ditemukan`));
      }

      // 2. Reject editing opening_balance transactions
      if (existingTx.type === 'opening_balance') {
        return err(
          new ValidationError(
            'Transaksi Saldo Awal tidak dapat diubah dari riwayat transaksi. Saldo awal dikonfigurasi saat pembuatan akun.'
          )
        );
      }

      // 3. Verify Seven-Day Correction Window Policy
      if (!this.correctionPolicy.isEligibleForCorrection(existingTx)) {
        return err(new CorrectionWindowExpiredError(existingTx.transactionDate));
      }

      // 4. Validate accounts existence and active status
      if (dto.sourceAccountId) {
        const srcAccRes = await this.accountRepository.findById(dto.sourceAccountId, dto.userId);
        if (!srcAccRes.success || !srcAccRes.data || srcAccRes.data.isDeleted()) {
          return err(new ValidationError('Akun sumber tidak valid atau sudah dihapus'));
        }
      }

      if (dto.destinationAccountId) {
        const dstAccRes = await this.accountRepository.findById(dto.destinationAccountId, dto.userId);
        if (!dstAccRes.success || !dstAccRes.data || dstAccRes.data.isDeleted()) {
          return err(new ValidationError('Akun tujuan tidak valid atau sudah dihapus'));
        }
      }

      // 5. Validate categories for Expense / Income
      if (existingTx.type === 'expense' || existingTx.type === 'income') {
        const items = dto.items ?? [];
        if (items.length === 0) {
          return err(new ValidationError(`Transaksi ${existingTx.type} harus memiliki minimal 1 kategori`));
        }

        for (const item of items) {
          const catRes = await this.categoryRepository.findById(item.categoryId, dto.userId);
          if (!catRes.success || !catRes.data || catRes.data.isDeleted()) {
            return err(new ValidationError('Kategori tidak valid atau sudah diarsipkan'));
          }

          if (catRes.data.type !== existingTx.type) {
            return err(
              new ValidationError(
                `Kategori "${catRes.data.name}" bertipe ${catRes.data.type}, tidak cocok untuk transaksi ${existingTx.type}`
              )
            );
          }
        }
      }

      // 6. Construct new TransactionItem instances
      const updatedItems = (dto.items ?? []).map(
        (i) =>
          new TransactionItem({
            id: i.id || this.uuidGenerator.generate(),
            transactionId: existingTx.id,
            categoryId: i.categoryId,
            amount: i.amount,
            note: i.note,
          })
      );

      // 7. Construct updated Transaction aggregate (validates all invariants)
      const updatedTransaction = new Transaction({
        id: existingTx.id,
        userId: existingTx.userId,
        type: existingTx.type,
        amount: dto.amount,
        transactionDate: dto.transactionDate,
        sourceAccountId: dto.sourceAccountId ?? null,
        destinationAccountId: dto.destinationAccountId ?? null,
        items: updatedItems,
        note: dto.note ?? null,
        debtId: existingTx.debtId,
        recurringTransactionId: existingTx.recurringTransactionId,
        occurrenceKey: existingTx.occurrenceKey,
        createdAt: existingTx.createdAt,
        updatedAt: new Date(),
        deletedAt: null,
      });

      // 8. Persist atomically to repository + outbox
      const updateResult = await this.transactionRepository.update(updatedTransaction);
      if (!updateResult.success) {
        return err(updateResult.error);
      }

      return ok(updatedTransaction);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

export class SoftDeleteTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly correctionPolicy: ITransactionCorrectionPolicy
  ) {}

  public async execute(id: string, userId: string): Promise<Result<void, DomainError>> {
    const findResult = await this.transactionRepository.findById(id, userId);
    if (!findResult.success) {
      return err(findResult.error);
    }

    const transaction = findResult.data;
    if (!transaction) {
      return err(new NotFoundError(`Transaction with ID ${id} not found`));
    }

    if (!this.correctionPolicy.isEligibleForCorrection(transaction)) {
      return err(new CorrectionWindowExpiredError(transaction.transactionDate));
    }

    return this.transactionRepository.softDelete(id, userId);
  }
}

export class GetAccountBalanceUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  public async execute(
    accountId: string,
    userId: string,
    currencyCode: string = 'IDR'
  ): Promise<Result<Money, DomainError>> {
    const result = await this.transactionRepository.getAccountLedgerTransactions(accountId, userId);
    if (!result.success) {
      return err(result.error);
    }

    const balance = LedgerBalanceCalculator.calculateAccountBalance(
      accountId,
      result.data,
      currencyCode
    );

    return ok(balance);
  }
}

export class GetTotalNetWorthUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  public async execute(
    userId: string,
    currencyCode: string = 'IDR'
  ): Promise<Result<Money, DomainError>> {
    const result = await this.transactionRepository.getAllActiveTransactions(userId);
    if (!result.success) {
      return err(result.error);
    }

    const netWorth = LedgerBalanceCalculator.calculateTotalNetWorth(result.data, currencyCode);
    return ok(netWorth);
  }
}

// -------------------------------------------------------------
// Phase 1E: Transaction History & Detail DTOs & Use Cases
// -------------------------------------------------------------

export interface AccountSummaryDTO {
  id: string;
  name: string;
  type: string;
  color?: string | null;
}

export interface CategorySummaryDTO {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
}

export interface TransactionListItemDTO {
  id: string;
  type: TransactionType;
  amount: Money;
  transactionDate: string; // YYYY-MM-DD
  createdAt: Date;
  note?: string | null;
  sourceAccount?: AccountSummaryDTO | null;
  destinationAccount?: AccountSummaryDTO | null;
  categorySummary: string;
  categoryCount: number;
  categoryIcon?: string | null;
  categoryColor?: string | null;
}

export interface TransactionDetailSplitItemDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon?: string | null;
  categoryColor?: string | null;
  amount: Money;
  note?: string | null;
}

export interface TransactionDetailDTO {
  id: string;
  type: TransactionType;
  amount: Money;
  transactionDate: string;
  createdAt: Date;
  updatedAt: Date;
  note?: string | null;
  debtId?: string | null;
  recurringTransactionId?: string | null;
  sourceAccount?: AccountSummaryDTO | null;
  destinationAccount?: AccountSummaryDTO | null;
  items: TransactionDetailSplitItemDTO[];
  totalSplitAmount: Money;
  isFullyAllocated: boolean;
  isEditable: boolean;
  correctionDaysRemaining: number;
}

export interface DateGroupedTransactions {
  dateHeader: string;
  rawDate: string; // YYYY-MM-DD
  transactions: TransactionListItemDTO[];
}

/**
 * Pure date grouping helper for human-readable Activity Feeds.
 * Accepts an injectable `now` date for deterministic unit testing.
 */
export function groupTransactionsByDate(
  transactions: TransactionListItemDTO[],
  now: Date = new Date()
): DateGroupedTransactions[] {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const nowYear = now.getFullYear();
  const todayStr = `${nowYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  const groupsMap = new Map<string, TransactionListItemDTO[]>();

  for (const tx of transactions) {
    const list = groupsMap.get(tx.transactionDate) ?? [];
    list.push(tx);
    groupsMap.set(tx.transactionDate, list);
  }

  const result: DateGroupedTransactions[] = [];

  for (const [dateStr, txList] of groupsMap.entries()) {
    let dateHeader: string;

    if (dateStr === todayStr) {
      dateHeader = 'Hari ini';
    } else if (dateStr === yesterdayStr) {
      dateHeader = 'Kemarin';
    } else {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);

      if (y === nowYear) {
        // e.g. "Rabu, 19 Agustus"
        dateHeader = new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(dateObj);
      } else {
        // e.g. "19 Agustus 2025"
        dateHeader = new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(dateObj);
      }
    }

    result.push({
      dateHeader,
      rawDate: dateStr,
      transactions: txList,
    });
  }

  return result;
}

export interface GetTransactionHistoryQuery {
  userId: string;
  search?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: Money;
  maxAmount?: Money;
  limit?: number;
  offset?: number;
}

export class GetTransactionHistoryUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  public async execute(
    query: GetTransactionHistoryQuery
  ): Promise<Result<{ items: TransactionListItemDTO[]; grouped: DateGroupedTransactions[] }, DomainError>> {
    // 1. Fetch transactions via repository with query filters
    const txResult = await this.transactionRepository.list({
      userId: query.userId,
      search: query.search,
      type: query.type,
      accountId: query.accountId,
      categoryId: query.categoryId,
      startDate: query.startDate,
      endDate: query.endDate,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      limit: query.limit,
      offset: query.offset,
      includeDeleted: false,
    });

    if (!txResult.success) {
      return err(txResult.error);
    }

    const transactions = txResult.data;
    if (transactions.length === 0) {
      return ok({ items: [], grouped: [] });
    }

    // 2. Fetch active accounts and categories for lookup
    const [accountsResult, categoriesResult] = await Promise.all([
      this.accountRepository.listByUser(query.userId, true),
      this.categoryRepository.listByUser(query.userId, undefined, true),
    ]);

    const accountMap = new Map<string, AccountSummaryDTO>();
    if (accountsResult.success) {
      for (const acc of accountsResult.data) {
        accountMap.set(acc.id, {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          color: acc.color,
        });
      }
    }

    const categoryMap = new Map<string, CategorySummaryDTO>();
    if (categoriesResult.success) {
      for (const cat of categoriesResult.data) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
        });
      }
    }

    // 3. Map to TransactionListItemDTO
    const items: TransactionListItemDTO[] = transactions.map((tx) => {
      const srcAcc = tx.sourceAccountId ? accountMap.get(tx.sourceAccountId) ?? null : null;
      const dstAcc = tx.destinationAccountId ? accountMap.get(tx.destinationAccountId) ?? null : null;

      let categorySummary = 'Tanpa Kategori';
      let categoryIcon: string | null = null;
      let categoryColor: string | null = null;
      const categoryCount = tx.items.length;

      if (tx.type === 'transfer') {
        categorySummary = 'Transfer Antar-Akun';
      } else if (tx.type === 'opening_balance') {
        categorySummary = 'Saldo Awal';
      } else if (tx.items.length === 1) {
        const cat = categoryMap.get(tx.items[0].categoryId);
        categorySummary = cat?.name ?? 'Kategori';
        categoryIcon = cat?.icon ?? null;
        categoryColor = cat?.color ?? null;
      } else if (tx.items.length > 1) {
        const firstCat = categoryMap.get(tx.items[0].categoryId);
        const extraCount = tx.items.length - 1;
        categorySummary = `${firstCat?.name ?? 'Kategori'} (+${extraCount})`;
        categoryIcon = firstCat?.icon ?? null;
        categoryColor = firstCat?.color ?? null;
      }

      return {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        transactionDate: tx.transactionDate,
        createdAt: tx.createdAt,
        note: tx.note,
        sourceAccount: srcAcc,
        destinationAccount: dstAcc,
        categorySummary,
        categoryCount,
        categoryIcon,
        categoryColor,
      };
    });

    // 4. Group by Date
    const grouped = groupTransactionsByDate(items);

    return ok({ items, grouped });
  }
}

export class GetTransactionDetailUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly correctionPolicy: ITransactionCorrectionPolicy = new SevenDayCorrectionPolicy(
      new SystemClock()
    )
  ) {}

  public async execute(
    transactionId: string,
    userId: string
  ): Promise<Result<TransactionDetailDTO, DomainError>> {
    const txResult = await this.transactionRepository.findById(transactionId, userId);
    if (!txResult.success) {
      return err(txResult.error);
    }

    const tx = txResult.data;
    if (!tx) {
      return err(new NotFoundError(`Transaction with ID ${transactionId} not found`));
    }

    const [accountsResult, categoriesResult] = await Promise.all([
      this.accountRepository.listByUser(userId, true),
      this.categoryRepository.listByUser(userId, undefined, true),
    ]);

    const accountMap = new Map<string, AccountSummaryDTO>();
    if (accountsResult.success) {
      for (const acc of accountsResult.data) {
        accountMap.set(acc.id, {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          color: acc.color,
        });
      }
    }

    const categoryMap = new Map<string, CategorySummaryDTO>();
    if (categoriesResult.success) {
      for (const cat of categoriesResult.data) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
        });
      }
    }

    const srcAcc = tx.sourceAccountId ? accountMap.get(tx.sourceAccountId) ?? null : null;
    const dstAcc = tx.destinationAccountId ? accountMap.get(tx.destinationAccountId) ?? null : null;

    let totalSplitMinor = 0n;
    const splitItems: TransactionDetailSplitItemDTO[] = tx.items.map((item) => {
      const cat = categoryMap.get(item.categoryId);
      totalSplitMinor += item.amount.minorUnits;
      return {
        id: item.id,
        categoryId: item.categoryId,
        categoryName: cat?.name ?? 'Kategori',
        categoryIcon: cat?.icon ?? null,
        categoryColor: cat?.color ?? null,
        amount: item.amount,
        note: item.note,
      };
    });

    const totalSplitAmount = Money.fromMinorUnits(totalSplitMinor, tx.amount.currencyCode);
    const isFullyAllocated =
      tx.type === 'transfer' || tx.type === 'opening_balance'
        ? true
        : totalSplitAmount.equals(tx.amount);

    const isEditable =
      tx.type !== 'opening_balance' && this.correctionPolicy.isEligibleForCorrection(tx);
    const correctionDaysRemaining = this.correctionPolicy.daysRemaining(tx);

    return ok({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      transactionDate: tx.transactionDate,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      note: tx.note,
      debtId: tx.debtId,
      recurringTransactionId: tx.recurringTransactionId,
      sourceAccount: srcAcc,
      destinationAccount: dstAcc,
      items: splitItems,
      totalSplitAmount,
      isFullyAllocated,
      isEditable,
      correctionDaysRemaining,
    });
  }
}

export class GetRecentTransactionsUseCase {
  private readonly historyUseCase: GetTransactionHistoryUseCase;

  constructor(
    transactionRepository: ITransactionRepository,
    accountRepository: IAccountRepository,
    categoryRepository: ICategoryRepository
  ) {
    this.historyUseCase = new GetTransactionHistoryUseCase(
      transactionRepository,
      accountRepository,
      categoryRepository
    );
  }

  public async execute(
    userId: string,
    limit: number = 5
  ): Promise<Result<TransactionListItemDTO[], DomainError>> {
    const result = await this.historyUseCase.execute({
      userId,
      limit,
    });

    if (!result.success) {
      return err(result.error);
    }

    return ok(result.data.items);
  }
}
