import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import {
  CreateAccountWithOpeningBalanceUseCase,
  GetAccountsWithBalancesUseCase,
  UpdateAccountUseCase,
  SoftDeleteAccountUseCase,
  GetAccountUseCase,
} from '@/features/accounts/application/account.usecases';
import { Money } from '@/core/domain/money';
import { MockUuidGenerator } from '../../mocks/mock-uuid-generator';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('Account Management Application Use Cases', () => {
  let testDb: InMemoryTestDb;
  let accountRepo: SqliteAccountRepository;
  let txRepo: SqliteTransactionRepository;
  let uuidGen: MockUuidGenerator;

  let createAccount: CreateAccountWithOpeningBalanceUseCase;
  let getAccountsWithBalances: GetAccountsWithBalancesUseCase;
  let updateAccount: UpdateAccountUseCase;
  let deleteAccount: SoftDeleteAccountUseCase;
  let getAccount: GetAccountUseCase;

  const userId = 'user-test-456';
  const otherUserId = 'user-other-789';

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    accountRepo = new SqliteAccountRepository(getDb);
    txRepo = new SqliteTransactionRepository(getDb);
    uuidGen = new MockUuidGenerator();

    createAccount = new CreateAccountWithOpeningBalanceUseCase(accountRepo, uuidGen);
    getAccountsWithBalances = new GetAccountsWithBalancesUseCase(accountRepo, txRepo);
    updateAccount = new UpdateAccountUseCase(accountRepo);
    deleteAccount = new SoftDeleteAccountUseCase(accountRepo);
    getAccount = new GetAccountUseCase(accountRepo);
  });

  it('should establish multiple accounts with opening balances and derive total Net Worth of Rp 5.550.000', async () => {
    // 1. Create BCA with Rp 5.000.000
    const bcaResult = await createAccount.execute({
      userId,
      name: 'BCA',
      type: 'bank',
      color: '#0055A5',
      openingBalance: Money.fromDecimal(5000000, 'IDR'),
    });
    expect(bcaResult.success).toBe(true);

    // 2. Create GoPay with Rp 350.000
    const gopayResult = await createAccount.execute({
      userId,
      name: 'GoPay',
      type: 'ewallet',
      color: '#008A00',
      openingBalance: Money.fromDecimal(350000, 'IDR'),
    });
    expect(gopayResult.success).toBe(true);

    // 3. Create Cash with Rp 200.000
    const cashResult = await createAccount.execute({
      userId,
      name: 'Cash',
      type: 'cash',
      color: '#4A5568',
      openingBalance: Money.fromDecimal(200000, 'IDR'),
    });
    expect(cashResult.success).toBe(true);

    // 4. Query accounts overview with derived balances
    const overviewResult = await getAccountsWithBalances.execute(userId);
    expect(overviewResult.success).toBe(true);
    if (!overviewResult.success) return;

    const { accounts, totalNetWorth } = overviewResult.data;
    expect(accounts.length).toBe(3);

    const bcaAcc = accounts.find((a) => a.account.name === 'BCA');
    expect(bcaAcc?.balance.toDecimal()).toBe(5000000);

    const gopayAcc = accounts.find((a) => a.account.name === 'GoPay');
    expect(gopayAcc?.balance.toDecimal()).toBe(350000);

    const cashAcc = accounts.find((a) => a.account.name === 'Cash');
    expect(cashAcc?.balance.toDecimal()).toBe(200000);

    // Total Net Worth = 5.000.000 + 350.000 + 200.000 = Rp 5.550.000
    expect(totalNetWorth.toDecimal()).toBe(5550000);
  });

  it('should support updating account metadata (name and color)', async () => {
    const accResult = await createAccount.execute({
      userId,
      name: 'Dompet Lama',
      type: 'cash',
      color: '#000000',
    });
    expect(accResult.success).toBe(true);
    if (!accResult.success) return;

    const accountId = accResult.data.id;

    // Update name
    const updateResult = await updateAccount.execute({
      id: accountId,
      userId,
      name: 'Dompet Kulit Utama',
      color: '#4A5568',
    });
    expect(updateResult.success).toBe(true);

    const findResult = await getAccount.execute(accountId, userId);
    expect(findResult.success).toBe(true);
    if (findResult.success && findResult.data) {
      expect(findResult.data.name).toBe('Dompet Kulit Utama');
    }
  });

  it('should soft delete account and exclude it from active list while preserving ledger records', async () => {
    const accResult = await createAccount.execute({
      userId,
      name: 'Rekening Tutup',
      type: 'bank',
      openingBalance: Money.fromDecimal(1000000, 'IDR'),
    });
    expect(accResult.success).toBe(true);
    if (!accResult.success) return;

    const accountId = accResult.data.id;

    // Soft delete account
    const deleteResult = await deleteAccount.execute(accountId, userId);
    expect(deleteResult.success).toBe(true);

    // Verify excluded from active accounts
    const overviewResult = await getAccountsWithBalances.execute(userId);
    if (overviewResult.success) {
      expect(overviewResult.data.accounts.find((a) => a.account.id === accountId)).toBeUndefined();
    }

    // Verify opening balance transaction remains stored in database
    const txTable = testDb.tables.get('transactions') ?? [];
    expect(txTable.some((t) => t.destination_account_id === accountId)).toBe(true);
  });

  it('should enforce user ownership and prevent cross-user mutations', async () => {
    const accResult = await createAccount.execute({
      userId,
      name: 'Akun Rahasia User A',
      type: 'bank',
    });
    expect(accResult.success).toBe(true);
    if (!accResult.success) return;

    const accountId = accResult.data.id;

    // User B attempts to view account
    const findOther = await getAccount.execute(accountId, otherUserId);
    expect(findOther.success).toBe(true);
    if (findOther.success) {
      expect(findOther.data).toBeNull();
    }

    // User B attempts to update account
    const updateOther = await updateAccount.execute({
      id: accountId,
      userId: otherUserId,
      name: 'Hacked',
    });
    expect(updateOther.success).toBe(false);

    // User B attempts to delete account
    const deleteOther = await deleteAccount.execute(accountId, otherUserId);
    expect(deleteOther.success).toBe(false);
  });
});
