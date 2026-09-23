import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { Account } from '@/features/accounts/domain/account';
import { Transaction } from '@/features/transactions/domain/transaction';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '../../helpers/in-memory-sqlite';

describe('SqliteAccountRepository - Atomic Account & Opening Balance Creation', () => {
  let testDb: InMemoryTestDb;
  let repository: SqliteAccountRepository;

  beforeEach(() => {
    testDb = new InMemoryTestDb();
    repository = new SqliteAccountRepository(async () => testDb.getDb());
  });

  it('should create account with opening balance transaction atomically and order outbox events properly', async () => {
    const account = new Account({
      id: 'acc-bca',
      userId: 'user-1',
      name: 'BCA Utama',
      type: 'bank',
      color: '#0055A5',
    });

    const openingBalanceTx = new Transaction({
      id: 'tx-op-bca',
      userId: 'user-1',
      type: 'opening_balance',
      amount: Money.fromDecimal(5000000, 'IDR'),
      transactionDate: '2026-08-19',
      destinationAccountId: 'acc-bca',
      sourceAccountId: null,
      items: [],
    });

    const result = await repository.createWithOpeningBalance(account, openingBalanceTx);
    expect(result.success).toBe(true);

    // Verify account row
    const accountsTable = testDb.tables.get('accounts') ?? [];
    expect(accountsTable.length).toBe(1);
    expect(accountsTable[0].id).toBe('acc-bca');
    expect(accountsTable[0].name).toBe('BCA Utama');

    // Verify opening balance transaction row
    const transactionsTable = testDb.tables.get('transactions') ?? [];
    expect(transactionsTable.length).toBe(1);
    expect(transactionsTable[0].id).toBe('tx-op-bca');
    expect(transactionsTable[0].type).toBe('opening_balance');
    expect(transactionsTable[0].destination_account_id).toBe('acc-bca');
    expect(transactionsTable[0].amount).toBe(500000000); // minor units: 5.000.000,00 -> 500000000

    // Verify outbox entries & dependency order
    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(2);

    // 1st outbox: CREATE_ACCOUNT
    expect(outboxTable[0].operation_type).toBe('CREATE_ACCOUNT');
    expect(outboxTable[0].entity_id).toBe('acc-bca');

    // 2nd outbox: CREATE_TRANSACTION (linked to the account)
    expect(outboxTable[1].operation_type).toBe('CREATE_TRANSACTION');
    expect(outboxTable[1].entity_id).toBe('tx-op-bca');
  });

  it('should create account without opening balance transaction when opening balance is omitted', async () => {
    const account = new Account({
      id: 'acc-cash',
      userId: 'user-1',
      name: 'Dompet Kosong',
      type: 'cash',
    });

    const result = await repository.createWithOpeningBalance(account);
    expect(result.success).toBe(true);

    // Account created
    const accountsTable = testDb.tables.get('accounts') ?? [];
    expect(accountsTable.length).toBe(1);

    // Zero transactions created
    const transactionsTable = testDb.tables.get('transactions') ?? [];
    expect(transactionsTable.length).toBe(0);

    // Only 1 outbox event for account creation
    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(1);
    expect(outboxTable[0].operation_type).toBe('CREATE_ACCOUNT');
  });

  it('should rollback account, transaction, and outbox entries completely if transaction insertion fails', async () => {
    const account = new Account({
      id: 'acc-fail',
      userId: 'user-1',
      name: 'Gagal Simpan',
      type: 'ewallet',
    });

    const openingBalanceTx = new Transaction({
      id: 'tx-fail',
      userId: 'user-1',
      type: 'opening_balance',
      amount: Money.fromDecimal(100000, 'IDR'),
      transactionDate: '2026-08-19',
      destinationAccountId: 'acc-fail',
    });

    // Make database fail on run
    testDb.failNextRun = true;
    testDb.failNextRunMessage = 'Database disk failure during atomic batch';

    const result = await repository.createWithOpeningBalance(account, openingBalanceTx);
    expect(result.success).toBe(false);

    // Verify 100% rollback (zero records left)
    const accountsTable = testDb.tables.get('accounts') ?? [];
    expect(accountsTable.length).toBe(0);

    const transactionsTable = testDb.tables.get('transactions') ?? [];
    expect(transactionsTable.length).toBe(0);

    const outboxTable = testDb.tables.get('outbox') ?? [];
    expect(outboxTable.length).toBe(0);
  });
});
