// xlsx library removed — replaced by lightweight inline OOXML builder (see generateExcel below)
import { Result, ok, err, DomainError, ValidationError } from '@/core/domain/result';
import { ITransactionRepository, TransactionFilter } from '../domain/transaction-repository.interface';
import { IAccountRepository } from '@/features/accounts/domain/account-repository.interface';
import { ICategoryRepository } from '@/features/categories/domain/category-repository.interface';
import { Transaction } from '../domain/transaction';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ExportTransactionsInput {
  userId: string;
  filter?: Omit<TransactionFilter, 'userId'>;
  format: ExportFormat;
}

export interface ExportTransactionsResult {
  fileName: string;
  mimeType: string;
  data: string;
  count: number;
  isPdfHtml?: boolean;
  isBase64?: boolean;
}

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight OOXML (.xlsx) builder — no external dependency.
// Produces a spec-compliant single-sheet workbook from an array-of-arrays.
// Numbers are stored as numeric cells; everything else is an inline string.
// ─────────────────────────────────────────────────────────────────────────────

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Encode a byte array to Base64 without Buffer (works in Hermes/RN). */
function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return result;
}

/** Convert a string to a UTF-8 Uint8Array (no TextEncoder dependency). */
function strToUtf8(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      // surrogate pair
      const lo = str.charCodeAt(++i);
      code = 0x10000 + ((code - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/** Write a 32-bit little-endian integer into buf at offset. */
function writeUint32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

/** Write a 16-bit little-endian integer into buf at offset. */
function writeUint16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

/** CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a minimal ZIP file containing the given files.
 * No compression (store method) — xlsx readers handle this fine.
 */
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; crc: number; localOffset: number }[] = [];
  let offset = 0;
  const parts: Uint8Array[] = [];

  for (const f of files) {
    const nameBytes = strToUtf8(f.name);
    const crc = crc32(f.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50); // local file signature
    writeUint16LE(localHeader, 4, 20);          // version needed: 2.0
    writeUint16LE(localHeader, 6, 0x0800);      // flags: UTF-8
    writeUint16LE(localHeader, 8, 0);           // method: store
    writeUint16LE(localHeader, 10, 0);          // last mod time
    writeUint16LE(localHeader, 12, 0);          // last mod date
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, f.data.length); // compressed size
    writeUint32LE(localHeader, 22, f.data.length); // uncompressed size
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0); // extra field length
    localHeader.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: f.data, crc, localOffset: offset });
    offset += localHeader.length + f.data.length;
    parts.push(localHeader, f.data);
  }

  // Central directory
  const cdParts: Uint8Array[] = [];
  let cdSize = 0;
  for (const e of entries) {
    const cdEntry = new Uint8Array(46 + e.name.length);
    writeUint32LE(cdEntry, 0, 0x02014b50); // central dir signature
    writeUint16LE(cdEntry, 4, 20);          // version made by
    writeUint16LE(cdEntry, 6, 20);          // version needed
    writeUint16LE(cdEntry, 8, 0x0800);      // flags: UTF-8
    writeUint16LE(cdEntry, 10, 0);          // method: store
    writeUint16LE(cdEntry, 12, 0);          // last mod time
    writeUint16LE(cdEntry, 14, 0);          // last mod date
    writeUint32LE(cdEntry, 16, e.crc);
    writeUint32LE(cdEntry, 20, e.data.length);
    writeUint32LE(cdEntry, 24, e.data.length);
    writeUint16LE(cdEntry, 28, e.name.length);
    writeUint16LE(cdEntry, 30, 0);  // extra
    writeUint16LE(cdEntry, 32, 0);  // comment
    writeUint16LE(cdEntry, 34, 0);  // disk number start
    writeUint16LE(cdEntry, 36, 0);  // internal attr
    writeUint32LE(cdEntry, 38, 0);  // external attr
    writeUint32LE(cdEntry, 42, e.localOffset);
    cdEntry.set(e.name, 46);
    cdParts.push(cdEntry);
    cdSize += cdEntry.length;
  }

  // End of central directory record
  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50); // EOCD signature
  writeUint16LE(eocd, 4, 0);           // disk number
  writeUint16LE(eocd, 6, 0);           // disk with cd start
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, cdSize);
  writeUint32LE(eocd, 16, offset);     // offset of cd
  writeUint16LE(eocd, 20, 0);          // comment length

  const allParts = [...parts, ...cdParts, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of allParts) { out.set(p, pos); pos += p.length; }
  return out;
}

/**
 * Build a valid .xlsx file from an array-of-arrays and return it as a Base64 string.
 * Numbers are stored as numeric cells; all other values are inline strings.
 */
function buildXlsxBase64(aoa: (string | number)[][]): string {
  // Build sheet XML
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  sheetXml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
  sheetXml += `<sheetData>`;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.length === 0) continue;
    sheetXml += `<row r="${r + 1}">`;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const colLetter = String.fromCharCode(65 + c); // A-J (10 cols max; extend if needed)
      const addr = `${colLetter}${r + 1}`;
      if (typeof cell === 'number') {
        sheetXml += `<c r="${addr}"><v>${cell}</v></c>`;
      } else if (cell !== null && cell !== undefined && String(cell).length > 0) {
        sheetXml += `<c r="${addr}" t="inlineStr"><is><t>${xmlEscape(String(cell))}</t></is></c>`;
      }
    }
    sheetXml += `</row>`;
  }

  sheetXml += `</sheetData></worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const relsWb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Transaksi" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const zipBytes = buildZip([
    { name: '[Content_Types].xml', data: strToUtf8(contentTypes) },
    { name: '_rels/.rels',         data: strToUtf8(relsRoot) },
    { name: 'xl/workbook.xml',     data: strToUtf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: strToUtf8(relsWb) },
    { name: 'xl/worksheets/sheet1.xml',   data: strToUtf8(sheetXml) },
  ]);

  return uint8ToBase64(zipBytes);
}

export class ExportTransactionsUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly categoryRepository: ICategoryRepository
  ) {}

  public async execute(
    input: ExportTransactionsInput
  ): Promise<Result<ExportTransactionsResult, DomainError>> {
    if (!input.userId || input.userId.trim().length === 0) {
      return err(new ValidationError('User ID is required for export'));
    }

    // 1. Fetch transactions, accounts, categories
    const filter: TransactionFilter = {
      userId: input.userId,
      ...input.filter,
      includeDeleted: false,
    };

    const [txResult, accResult, catResult] = await Promise.all([
      this.transactionRepository.list(filter),
      this.accountRepository.listByUser(input.userId),
      this.categoryRepository.listByUser(input.userId, undefined, true),
    ]);

    if (!txResult.success) return err(txResult.error);
    if (!accResult.success) return err(accResult.error);
    if (!catResult.success) return err(catResult.error);

    const transactions = txResult.data;
    const accountsMap = new Map(accResult.data.map((a) => [a.id, a.name]));
    const categoriesMap = new Map(catResult.data.map((c) => [c.id, c.name]));

    const dateStamp = new Date().toISOString().split('T')[0];

    // CSV format
    if (input.format === 'csv') {
      const csvData = '\uFEFF' + this.generateCsv(transactions, accountsMap, categoriesMap);
      return ok({
        fileName: `fintrack_transaksi_${dateStamp}.csv`,
        mimeType: 'text/csv;charset=utf-8;',
        data: csvData,
        count: transactions.length,
      });
    }

    // Excel spreadsheet format (.xlsx)
    if (input.format === 'excel') {
      const excelData = this.generateExcel(transactions, accountsMap, categoriesMap);
      return ok({
        fileName: `fintrack_transaksi_${dateStamp}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: excelData,
        count: transactions.length,
        isBase64: true,
      });
    }

    // PDF Printable Document format
    if (input.format === 'pdf') {
      const pdfHtml = this.generatePdfHtml(transactions, accountsMap, categoriesMap);
      return ok({
        fileName: `fintrack_laporan_${dateStamp}.pdf`,
        mimeType: 'application/pdf',
        data: pdfHtml,
        count: transactions.length,
        isPdfHtml: true,
      });
    }

    // JSON format
    if (input.format === 'json') {
      const jsonData = this.generateJson(transactions, accountsMap, categoriesMap);
      return ok({
        fileName: `fintrack_transaksi_${dateStamp}.json`,
        mimeType: 'application/json;charset=utf-8;',
        data: jsonData,
        count: transactions.length,
      });
    }

    return err(new ValidationError(`Unsupported export format: ${input.format}`));
  }

  private generateCsv(
    transactions: Transaction[],
    accountsMap: Map<string, string>,
    categoriesMap: Map<string, string>
  ): string {
    const headers = [
      'ID',
      'Tanggal',
      'Tipe',
      'Jumlah_IDR',
      'Akun_Sumber',
      'Akun_Tujuan',
      'Kategori',
      'Catatan',
    ];

    const rows = transactions.map((tx) => {
      const srcName = tx.sourceAccountId ? accountsMap.get(tx.sourceAccountId) ?? tx.sourceAccountId : '';
      const dstName = tx.destinationAccountId ? accountsMap.get(tx.destinationAccountId) ?? tx.destinationAccountId : '';

      let catString = '';
      if (tx.items.length === 1) {
        catString = categoriesMap.get(tx.items[0].categoryId) ?? tx.items[0].categoryId;
      } else if (tx.items.length > 1) {
        catString = tx.items
          .map((item) => {
            const name = categoriesMap.get(item.categoryId) ?? item.categoryId;
            return `${name} (${item.amount.toDecimal()})`;
          })
          .join('; ');
      }

      return [
        escapeCsvField(tx.id),
        escapeCsvField(tx.transactionDate),
        escapeCsvField(tx.type),
        escapeCsvField(tx.amount.toDecimal()),
        escapeCsvField(srcName),
        escapeCsvField(dstName),
        escapeCsvField(catString),
        escapeCsvField(tx.note ?? ''),
      ].join(',');
    });

    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }

  private generateExcel(
    transactions: Transaction[],
    accountsMap: Map<string, string>,
    categoriesMap: Map<string, string>
  ): string {
    const dateFormatted = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });

    // ── 1. Build data rows ───────────────────────────────────────────────────
    let totalIncome = 0;
    let totalExpense = 0;

    const dataRows: (string | number)[][] = transactions.map((tx, idx) => {
      const amountNum = tx.amount.toDecimal();
      const srcName = tx.sourceAccountId ? accountsMap.get(tx.sourceAccountId) ?? tx.sourceAccountId : '-';
      const dstName = tx.destinationAccountId ? accountsMap.get(tx.destinationAccountId) ?? tx.destinationAccountId : '-';

      let catString = '-';
      if (tx.items.length === 1) {
        catString = categoriesMap.get(tx.items[0].categoryId) ?? tx.items[0].categoryId;
      } else if (tx.items.length > 1) {
        catString = tx.items
          .map((item) => `${categoriesMap.get(item.categoryId) ?? item.categoryId} (${item.amount.toDecimal()})`)
          .join(', ');
      }

      let typeLabel: string = tx.type;
      let incomeVal = 0;
      let expenseVal = 0;

      if (tx.type === 'income') {
        typeLabel = 'Pemasukan';
        incomeVal = amountNum;
        totalIncome += amountNum;
      } else if (tx.type === 'expense') {
        typeLabel = 'Pengeluaran';
        expenseVal = amountNum;
        totalExpense += amountNum;
      } else if (tx.type === 'transfer') {
        typeLabel = 'Transfer';
      } else {
        typeLabel = 'Saldo Awal';
      }

      return [idx + 1, tx.id, tx.transactionDate, typeLabel, srcName, dstName, catString, incomeVal, expenseVal, tx.note ?? ''];
    });

    const netCashflow = totalIncome - totalExpense;

    // ── 2. Full AOA (array-of-arrays) including headers and summary ──────────
    const aoa: (string | number)[][] = [
      ['FINTRACK - LAPORAN TRANSAKSI KEUANGAN'],
      ['Tanggal Unduh:', dateFormatted],
      ['Total Data:', `${transactions.length} transaksi`],
      [],
      ['No', 'ID Transaksi', 'Tanggal', 'Tipe', 'Akun Sumber', 'Akun Tujuan', 'Kategori', 'Pemasukan (IDR)', 'Pengeluaran (IDR)', 'Catatan'],
      ...dataRows,
      [],
      ['RINGKASAN TOTAL', '', '', '', '', '', '', '', '', ''],
      ['Total Pemasukan (IDR)', '', '', '', '', '', '', totalIncome, '', ''],
      ['Total Pengeluaran (IDR)', '', '', '', '', '', '', '', totalExpense, ''],
      ['Arus Kas Bersih (IDR)', '', '', '', '', '', '', netCashflow, '', ''],
    ];

    // ── 3. Build minimal OOXML (.xlsx) without any external library ──────────
    return buildXlsxBase64(aoa);
  }

  private generatePdfHtml(
    transactions: Transaction[],
    accountsMap: Map<string, string>,
    categoriesMap: Map<string, string>
  ): string {
    let totalIncome = 0;
    let totalExpense = 0;

    const rowsHtml = transactions
      .map((tx, idx) => {
        const amountNum = tx.amount.toDecimal();
        const srcName = tx.sourceAccountId ? accountsMap.get(tx.sourceAccountId) ?? tx.sourceAccountId : '-';
        const dstName = tx.destinationAccountId ? accountsMap.get(tx.destinationAccountId) ?? tx.destinationAccountId : '-';

        let catString = '-';
        if (tx.items.length === 1) {
          catString = categoriesMap.get(tx.items[0].categoryId) ?? tx.items[0].categoryId;
        } else if (tx.items.length > 1) {
          catString = tx.items
            .map((item) => `${categoriesMap.get(item.categoryId) ?? item.categoryId}`)
            .join(', ');
        }

        let badgeBg = '#f3f4f6';
        let badgeColor = '#374151';
        let typeText: string = tx.type;
        let amountPrefix = '';
        let amountColor = '#1f2937';

        if (tx.type === 'income') {
          typeText = 'Pemasukan';
          badgeBg = '#dcfce7';
          badgeColor = '#15803d';
          amountPrefix = '+ ';
          amountColor = '#15803d';
          totalIncome += amountNum;
        } else if (tx.type === 'expense') {
          typeText = 'Pengeluaran';
          badgeBg = '#fee2e2';
          badgeColor = '#b91c1c';
          amountPrefix = '- ';
          amountColor = '#b91c1c';
          totalExpense += amountNum;
        } else if (tx.type === 'transfer') {
          typeText = 'Transfer';
          badgeBg = '#e0f2fe';
          badgeColor = '#0369a1';
          amountColor = '#0284c7';
        } else {
          typeText = 'Saldo Awal';
          badgeBg = '#f3f4f6';
          badgeColor = '#4b5563';
        }

        const accountDisplay =
          tx.type === 'transfer' ? `${escapeHtml(srcName)} &rarr; ${escapeHtml(dstName)}` : escapeHtml(srcName);

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';

        return `
          <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-size: 11px; color: #4b5563; text-align: center;">${escapeHtml(tx.transactionDate)}</td>
            <td style="padding: 10px 8px; text-align: center;">
              <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase;">
                ${escapeHtml(typeText)}
              </span>
            </td>
            <td style="padding: 10px 8px; font-size: 12px; font-weight: 600; color: #111827;">
              ${escapeHtml(catString)}
              ${tx.note ? `<div style="font-size: 10px; color: #6b7280; font-weight: normal; margin-top: 2px;">${escapeHtml(tx.note)}</div>` : ''}
            </td>
            <td style="padding: 10px 8px; font-size: 11px; color: #4b5563;">${accountDisplay}</td>
            <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; text-align: right; color: ${amountColor};">
              ${amountPrefix}${formatCurrency(amountNum)}
            </td>
          </tr>
        `;
      })
      .join('');

    const netCashflow = totalIncome - totalExpense;
    const netColor = netCashflow >= 0 ? '#15803d' : '#b91c1c';
    const dateFormatted = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FinTrack - Laporan Transaksi</title>
        <style>
          @page { size: A4; margin: 16mm 14mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #2563eb; margin-bottom: 20px; }
          .brand-title { font-size: 24px; font-weight: 800; color: #2563eb; margin: 0; }
          .brand-subtitle { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .doc-info { text-align: right; }
          .doc-title { font-size: 16px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase; }
          .doc-date { font-size: 11px; color: #4b5563; margin-top: 4px; }
          
          .summary-grid { display: flex; gap: 12px; margin-bottom: 24px; }
          .summary-card { flex: 1; border-radius: 8px; padding: 12px 14px; border: 1px solid #e5e7eb; background: #ffffff; }
          .summary-card.income { background-color: #f0fdf4; border-color: #bbf7d0; }
          .summary-card.expense { background-color: #fef2f2; border-color: #fecaca; }
          .summary-card.net { background-color: #eff6ff; border-color: #bfdbfe; }
          .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
          .summary-value { font-size: 16px; font-weight: 800; margin-top: 4px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background-color: #f3f4f6; color: #374151; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px; border-bottom: 2px solid #e5e7eb; }
          
          .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="brand-title">FinTrack</h1>
            <div class="brand-subtitle">Aplikasi Pencatat Keuangan Pribadi</div>
          </div>
          <div class="doc-info">
            <h2 class="doc-title">Laporan Riwayat Transaksi</h2>
            <div class="doc-date">Dicetak pada: ${escapeHtml(dateFormatted)}</div>
            <div class="doc-date" style="font-weight: 600;">Total: ${transactions.length} Catatan</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card income">
            <div class="summary-label" style="color: #15803d;">Total Pemasukan</div>
            <div class="summary-value" style="color: #15803d;">${formatCurrency(totalIncome)}</div>
          </div>
          <div class="summary-card expense">
            <div class="summary-label" style="color: #b91c1c;">Total Pengeluaran</div>
            <div class="summary-value" style="color: #b91c1c;">${formatCurrency(totalExpense)}</div>
          </div>
          <div class="summary-card net">
            <div class="summary-label" style="color: #1d4ed8;">Arus Kas Bersih (Net)</div>
            <div class="summary-value" style="color: ${netColor};">${formatCurrency(netCashflow)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%; text-align: center;">Tanggal</th>
              <th style="width: 14%; text-align: center;">Tipe</th>
              <th style="width: 33%; text-align: left;">Kategori & Keterangan</th>
              <th style="width: 18%; text-align: left;">Akun</th>
              <th style="width: 20%; text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>Dokumen resmi dicetak langsung dari FinTrack Mobile App.</div>
          <div>Halaman 1 dari 1</div>
        </div>
      </body>
      </html>
    `.trim();
  }

  private generateJson(
    transactions: Transaction[],
    accountsMap: Map<string, string>,
    categoriesMap: Map<string, string>
  ): string {
    const exportObjects = transactions.map((tx) => ({
      id: tx.id,
      transactionDate: tx.transactionDate,
      type: tx.type,
      amountDecimal: tx.amount.toDecimal(),
      amountMinorUnits: tx.amount.minorUnits.toString(),
      sourceAccountId: tx.sourceAccountId ?? null,
      sourceAccountName: tx.sourceAccountId ? accountsMap.get(tx.sourceAccountId) ?? null : null,
      destinationAccountId: tx.destinationAccountId ?? null,
      destinationAccountName: tx.destinationAccountId ? accountsMap.get(tx.destinationAccountId) ?? null : null,
      note: tx.note ?? null,
      debtId: tx.debtId ?? null,
      recurringTransactionId: tx.recurringTransactionId ?? null,
      items: tx.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        categoryName: categoriesMap.get(item.categoryId) ?? null,
        amountDecimal: item.amount.toDecimal(),
        amountMinorUnits: item.amount.minorUnits.toString(),
        note: item.note ?? null,
      })),
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    }));

    return JSON.stringify(exportObjects, null, 2);
  }
}
