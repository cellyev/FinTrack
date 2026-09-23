import { Result, ok, err, ValidationError, NotFoundError, DomainError } from '@/core/domain/result';
import { Account, AccountType } from '../domain/account';
import { IAccountRepository } from '../domain/account-repository.interface';
import { ITransactionRepository } from '@/features/transactions/domain/transaction-repository.interface';
import { Transaction } from '@/features/transactions/domain/transaction';
import { LedgerBalanceCalculator } from '@/features/transactions/domain/services/balance-calculator';
import { Money } from '@/core/domain/money';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

export interface CreateAccountWithOpeningBalanceDTO {
  userId: string;
  name: string;
  type: AccountType;
  currencyCode?: string;
  icon?: string | null;
  color?: string | null;
  openingBalance?: Money;
  transactionDate?: string; // YYYY-MM-DD for opening balance (defaults to today)
}

export class CreateAccountWithOpeningBalanceUseCase {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly uuidGenerator: IUuidGenerator
  ) {}

  public async execute(dto: CreateAccountWithOpeningBalanceDTO): Promise<Result<Account, DomainError>> {
    try {
      const accountId = this.uuidGenerator.generate();
      const account = new Account({
        id: accountId,
        userId: dto.userId,
        name: dto.name,
        type: dto.type,
        currencyCode: dto.currencyCode,
        icon: dto.icon,
        color: dto.color,
      });

      let openingBalanceTx: Transaction | undefined;
      if (dto.openingBalance && dto.openingBalance.minorUnits > 0n) {
        const txId = this.uuidGenerator.generate();
        const dateStr = dto.transactionDate ?? new Date().toISOString().split('T')[0];

        openingBalanceTx = new Transaction({
          id: txId,
          userId: dto.userId,
          type: 'opening_balance',
          amount: dto.openingBalance,
          transactionDate: dateStr,
          destinationAccountId: accountId,
          sourceAccountId: null,
          items: [],
        });
      }

      const result = await this.accountRepository.createWithOpeningBalance(account, openingBalanceTx);
      if (!result.success) {
        return err(result.error);
      }

      return ok(account);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

// Backward-compatible alias for creating account without opening balance
export class CreateAccountUseCase {
  private readonly withOpeningBalanceUseCase: CreateAccountWithOpeningBalanceUseCase;

  constructor(
    accountRepository: IAccountRepository,
    uuidGenerator: IUuidGenerator
  ) {
    this.withOpeningBalanceUseCase = new CreateAccountWithOpeningBalanceUseCase(
      accountRepository,
      uuidGenerator
    );
  }

  public async execute(dto: CreateAccountWithOpeningBalanceDTO): Promise<Result<Account, DomainError>> {
    return this.withOpeningBalanceUseCase.execute(dto);
  }
}

export interface AccountWithBalanceDTO {
  account: Account;
  balance: Money;
}

export interface AccountsOverviewDTO {
  accounts: AccountWithBalanceDTO[];
  totalNetWorth: Money;
}

export class GetAccountsWithBalancesUseCase {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly transactionRepository: ITransactionRepository
  ) {}

  public async execute(
    userId: string,
    currencyCode: string = 'IDR'
  ): Promise<Result<AccountsOverviewDTO, DomainError>> {
    // 1. Fetch user's active accounts (deleted_at IS NULL)
    const accountsResult = await this.accountRepository.listByUser(userId, false);
    if (!accountsResult.success) {
      return err(accountsResult.error);
    }

    // 2. Fetch user's active ledger transactions
    const txResult = await this.transactionRepository.getAllActiveTransactions(userId);
    if (!txResult.success) {
      return err(txResult.error);
    }

    const accounts = accountsResult.data;
    const transactions = txResult.data;

    // 3. Calculate derived balances for each account and total net worth
    const accountIds = accounts.map((a) => a.id);
    const balanceMap = LedgerBalanceCalculator.calculateAllAccountBalances(
      transactions,
      accountIds,
      currencyCode
    );

    const accountsWithBalances: AccountWithBalanceDTO[] = accounts.map((account) => ({
      account,
      balance: balanceMap.get(account.id) ?? Money.zero(currencyCode),
    }));

    const totalNetWorth = LedgerBalanceCalculator.calculateTotalNetWorth(transactions, currencyCode);

    return ok({
      accounts: accountsWithBalances,
      totalNetWorth,
    });
  }
}

export class ListAccountsUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  public async execute(userId: string, includeInactive: boolean = false): Promise<Result<Account[], DomainError>> {
    return this.accountRepository.listByUser(userId, includeInactive);
  }
}

export class GetAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  public async execute(id: string, userId: string): Promise<Result<Account | null, DomainError>> {
    return this.accountRepository.findById(id, userId);
  }
}

export interface UpdateAccountDTO {
  id: string;
  userId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export class UpdateAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  public async execute(dto: UpdateAccountDTO): Promise<Result<Account, DomainError>> {
    try {
      const findResult = await this.accountRepository.findById(dto.id, dto.userId);
      if (!findResult.success) {
        return err(findResult.error);
      }

      const account = findResult.data;
      if (!account) {
        return err(new NotFoundError(`Account with ID ${dto.id} not found`));
      }

      account.rename(dto.name);
      if (dto.icon !== undefined) {
        // preserve icon update
      }

      const updateResult = await this.accountRepository.update(account);
      if (!updateResult.success) {
        return err(updateResult.error);
      }

      return ok(account);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

export class SoftDeleteAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  public async execute(id: string, userId: string): Promise<Result<void, DomainError>> {
    const findResult = await this.accountRepository.findById(id, userId);
    if (!findResult.success) {
      return err(findResult.error);
    }

    if (!findResult.data) {
      return err(new NotFoundError(`Account with ID ${id} not found`));
    }

    return this.accountRepository.softDelete(id, userId);
  }
}
