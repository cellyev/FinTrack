import * as XLSX from 'xlsx';
import { ExportTransactionsUseCase, escapeCsvField } from '@/features/transactions/application/export-transactions.usecase';
import { SqliteTransactionRepository } from '@/features/transactions/data/sqlite-transaction.repository';
import { SqliteAccountRepository } from '@/features/accounts/data/sqlite-account.repository';
import { SqliteCategoryRepository } from '@/features/categories/data/sqlite-category.repository';
import { Transaction } from '@/features/transactions/domain/transaction';
import { TransactionItem } from '@/features/transactions/domain/transaction-item';
import { Account } from '@/features/accounts/domain/account';
import { Category } from '@/features/categories/domain/category';
import { Money } from '@/core/domain/money';
import { InMemoryTestDb } from '@/test/helpers/in-memory-sqlite';

describe('ExportTransactionsUseCase & CSV/Excel/PDF Serializers', () => {
  let testDb: InMemoryTestDb;
  let txRepo: SqliteTransactionRepository;
  let accRepo: SqliteAccountRepository;
  let catRepo: SqliteCategoryRepository;
  let exportUseCase: ExportTransactionsUseCase;

  const testUserId = 'test-user-export-1';

  beforeEach(async () => {
    testDb = new InMemoryTestDb();
    const getDb = async () => testDb.getDb();

    txRepo = new SqliteTransactionRepository(getDb);
    accRepo = new SqliteAccountRepository(getDb);
    catRepo = new SqliteCategoryRepository(getDb);

    exportUseCase = new ExportTransactionsUseCase(txRepo, accRepo, catRepo);

    // Setup accounts
    await accRepo.create(
      new Account({
        id: 'acc-bca',
        userId: testUserId,
        name: 'BCA Utama',
        type: 'bank',
      })
    );
    await accRepo.create(
      new Account({
        id: 'acc-cash',
        userId: testUserId,
        name: 'Dompet Tunai',
        type: 'cash',
      })
    );

    // Setup categories
    await catRepo.create(
      new Category({
        id: 'cat-food',
        userId: testUserId,
        name: 'Makanan, Minuman & Snack',
        type: 'expense',
        icon: '🍔',
        color: '#ff0000',
      })
    );
    await catRepo.create(
      new Category({
        id: 'cat-trans',
        userId: testUserId,
        name: 'Transportasi "Online"',
        type: 'expense',
        icon: '🚗',
        color: '#0055ff',
      })
    );
  });

  describe('escapeCsvField', () => {
    it('should leave simple strings untouched', () => {
      expect(escapeCsvField('Halo')).toBe('Halo');
      expect(escapeCsvField(12345)).toBe('12345');
    });

    it('should escape strings containing commas, quotes, and newlines', () => {
      expect(escapeCsvField('Makanan, Minuman')).toBe('"Makanan, Minuman"');
      expect(escapeCsvField('Ojek "Online"')).toBe('"Ojek ""Online"""');
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    });

    it('should return empty string for null/undefined', () => {
      expect(escapeCsvField(null)).toBe('');
      expect(escapeCsvField(undefined)).toBe('');
    });
  });

  describe('CSV Export Execution', () => {
    it('should export empty list with headers only and UTF-8 BOM', async () => {
      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'csv',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(0);
        expect(result.data.mimeType).toContain('text/csv');
        expect(result.data.data.startsWith('\uFEFF')).toBe(true);
        expect(result.data.data).toContain('ID,Tanggal,Tipe,Jumlah_IDR,Akun_Sumber,Akun_Tujuan,Kategori,Catatan');
      }
    });

    it('should correctly format and escape transaction data into CSV', async () => {
      // 1. Single category expense
      await txRepo.create(
        new Transaction({
          id: 'tx-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(50000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-bca',
          note: 'Makan siang, "Nasi Padang"',
          items: [
            new TransactionItem({
              id: 'ti-1',
              transactionId: 'tx-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
          ],
        })
      );

      // 2. Split transaction
      await txRepo.create(
        new Transaction({
          id: 'tx-2',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(75000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-cash',
          note: 'Belanja & Ongkir',
          items: [
            new TransactionItem({
              id: 'ti-2a',
              transactionId: 'tx-2',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(50000, 'IDR'),
            }),
            new TransactionItem({
              id: 'ti-2b',
              transactionId: 'tx-2',
              categoryId: 'cat-trans',
              amount: Money.fromDecimal(25000, 'IDR'),
            }),
          ],
        })
      );

      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'csv',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(2);
        const lines = result.data.data.split('\r\n');
        expect(lines).toHaveLength(3); // 1 Header + 2 Rows

        const row1 = lines.find((l) => l.startsWith('tx-1'));
        const row2 = lines.find((l) => l.startsWith('tx-2'));

        expect(row1).toBeDefined();
        expect(row2).toBeDefined();

        // Check escaping on tx-1 note: "Makan siang, ""Nasi Padang"""
        expect(row1).toContain('"Makan siang, ""Nasi Padang"""');
        expect(row1).toContain('BCA Utama');

        // Check multi-split category breakdown on tx-2
        expect(row2).toContain('Dompet Tunai');
      }
    });

    it('should exclude soft-deleted records from CSV export', async () => {
      const tx = new Transaction({
        id: 'tx-del-exp',
        userId: testUserId,
        type: 'expense',
        amount: Money.fromDecimal(10000, 'IDR'),
        transactionDate: '2026-08-20',
        sourceAccountId: 'acc-bca',
        items: [
          new TransactionItem({
            id: 'ti-del-exp',
            transactionId: 'tx-del-exp',
            categoryId: 'cat-food',
            amount: Money.fromDecimal(10000, 'IDR'),
          }),
        ],
      });
      await txRepo.create(tx);
      await txRepo.softDelete('tx-del-exp', testUserId);

      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'csv',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(0);
      }
    });
  });

  describe('Excel (.xlsx) Export Execution', () => {
    it('should export structured OpenXML XLSX spreadsheet with headers and sum totals', async () => {
      await txRepo.create(
        new Transaction({
          id: 'tx-xls-1',
          userId: testUserId,
          type: 'income',
          amount: Money.fromDecimal(5000000, 'IDR'),
          transactionDate: '2026-08-21',
          destinationAccountId: 'acc-bca',
          note: 'Gaji Bulanan',
          items: [
            new TransactionItem({
              id: 'ti-xls-1',
              transactionId: 'tx-xls-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(5000000, 'IDR'),
            }),
          ],
        })
      );

      await txRepo.create(
        new Transaction({
          id: 'tx-xls-2',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(150000, 'IDR'),
          transactionDate: '2026-08-21',
          sourceAccountId: 'acc-bca',
          note: 'Makan Malam',
          items: [
            new TransactionItem({
              id: 'ti-xls-2',
              transactionId: 'tx-xls-2',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(150000, 'IDR'),
            }),
          ],
        })
      );

      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'excel',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName.endsWith('.xlsx')).toBe(true);
        expect(result.data.mimeType).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        expect(result.data.isBase64).toBe(true);
        expect(result.data.count).toBe(2);

        // Read and verify that the base64 string is a valid, parseable Excel workbook
        const wb = XLSX.read(result.data.data, { type: 'base64' });
        expect(wb.SheetNames).toContain('Transaksi');

        const sheet = wb.Sheets['Transaksi'];
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });

        // Find row with Gaji Bulanan
        const salaryRow = rows.find((r) => r.includes('Gaji Bulanan'));
        expect(salaryRow).toBeDefined();
        expect(salaryRow).toContain(5000000);

        // Find row with Makan Malam
        const dinnerRow = rows.find((r) => r.includes('Makan Malam'));
        expect(dinnerRow).toBeDefined();
        expect(dinnerRow).toContain(150000);

        // Find summary row
        const incomeSummary = rows.find((r) => r.includes('Total Pemasukan (IDR)'));
        expect(incomeSummary).toBeDefined();
        expect(incomeSummary).toContain(5000000);

        const expenseSummary = rows.find((r) => r.includes('Total Pengeluaran (IDR)'));
        expect(expenseSummary).toBeDefined();
        expect(expenseSummary).toContain(150000);
      }
    });
  });

  describe('PDF Export Execution', () => {
    it('should export printable HTML document layout with summary cards and styled table', async () => {
      await txRepo.create(
        new Transaction({
          id: 'tx-pdf-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(200000, 'IDR'),
          transactionDate: '2026-08-22',
          sourceAccountId: 'acc-bca',
          note: 'Belanja Mingguan',
          items: [
            new TransactionItem({
              id: 'ti-pdf-1',
              transactionId: 'tx-pdf-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(200000, 'IDR'),
            }),
          ],
        })
      );

      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'pdf',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName.endsWith('.pdf')).toBe(true);
        expect(result.data.mimeType).toBe('application/pdf');
        expect(result.data.isPdfHtml).toBe(true);
        expect(result.data.count).toBe(1);

        const html = result.data.data;
        expect(html).toContain('FinTrack');
        expect(html).toContain('Laporan Riwayat Transaksi');
        expect(html).toContain('Total Pemasukan');
        expect(html).toContain('Total Pengeluaran');
        expect(html).toContain('Arus Kas Bersih (Net)');
        expect(html).toContain('Belanja Mingguan');
      }
    });
  });

  describe('JSON Export Execution', () => {
    it('should generate structured, valid JSON with item splits and decimal amounts', async () => {
      await txRepo.create(
        new Transaction({
          id: 'tx-json-1',
          userId: testUserId,
          type: 'expense',
          amount: Money.fromDecimal(35000, 'IDR'),
          transactionDate: '2026-08-20',
          sourceAccountId: 'acc-bca',
          note: 'Kopi & Roti',
          items: [
            new TransactionItem({
              id: 'ti-json-1',
              transactionId: 'tx-json-1',
              categoryId: 'cat-food',
              amount: Money.fromDecimal(35000, 'IDR'),
            }),
          ],
        })
      );

      const result = await exportUseCase.execute({
        userId: testUserId,
        format: 'json',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(1);
        expect(result.data.mimeType).toContain('application/json');

        const parsed = JSON.parse(result.data.data);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe('tx-json-1');
        expect(parsed[0].amountDecimal).toBe(35000);
        expect(parsed[0].sourceAccountName).toBe('BCA Utama');
        expect(parsed[0].items[0].categoryName).toBe('Makanan, Minuman & Snack');
      }
    });
  });
});
