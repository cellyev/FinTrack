import { FileSaverService } from '@/features/transactions/application/file-saver.service';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock/cache/',
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('FileSaverService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
  });

  describe('PDF Export via printToFileAsync', () => {
    it('should generate PDF with base64: true and write base64 directly to cacheDirectory', async () => {
      (Print.printToFileAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///data/user/0/host.exp.exponent/cache/Print/test.pdf',
        numberOfPages: 1,
        base64: 'JVBERi0xLjQKJcfs...',
      });

      const result = await FileSaverService.saveAndShare({
        fileName: 'fintrack_laporan.pdf',
        data: '<html><body>Laporan FinTrack</body></html>',
        mimeType: 'application/pdf',
        isPdfHtml: true,
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('file:///mock/cache/fintrack_laporan.pdf');

      // Verify printToFileAsync was called with base64: true
      expect(Print.printToFileAsync).toHaveBeenCalledWith({
        html: '<html><body>Laporan FinTrack</body></html>',
        base64: true,
      });

      // Verify written directly to cache without calling copyAsync on unreadable spool path
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/cache/fintrack_laporan.pdf',
        'JVBERi0xLjQKJcfs...',
        { encoding: 'base64' }
      );
      expect(FileSystem.copyAsync).not.toHaveBeenCalled();

      // Verify sharing invoked with targetUri
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///mock/cache/fintrack_laporan.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        })
      );
    });

    it('should fallback to copyAsync if base64 is missing in printResult', async () => {
      (Print.printToFileAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///temp/print/test.pdf',
        numberOfPages: 1,
      });

      const result = await FileSaverService.saveAndShare({
        fileName: 'laporan',
        data: '<html><body>Test</body></html>',
        mimeType: 'application/pdf',
        isPdfHtml: true,
      });

      expect(result.success).toBe(true);
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({
        from: 'file:///temp/print/test.pdf',
        to: 'file:///mock/cache/laporan.pdf',
      });
    });

    it('should delete existing file before saving if it exists in cache', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
      (Print.printToFileAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///temp/test.pdf',
        base64: 'base64data',
      });

      await FileSaverService.saveAndShare({
        fileName: 'test.pdf',
        data: '<html></html>',
        mimeType: 'application/pdf',
        isPdfHtml: true,
      });

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///mock/cache/test.pdf',
        { idempotent: true }
      );
    });
  });

  describe('Non-PDF Export (Excel, CSV, JSON)', () => {
    it('should save base64 binary files (such as .xlsx) using Base64 encoding', async () => {
      const result = await FileSaverService.saveAndShare({
        fileName: 'transaksi.xlsx',
        data: 'UEsDBBQAAAA...',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        isBase64: true,
      });

      expect(result.success).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/cache/transaksi.xlsx',
        'UEsDBBQAAAA...',
        { encoding: 'base64' }
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///mock/cache/transaksi.xlsx',
        expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );
    });

    it('should save text files (such as CSV or JSON) using UTF-8 encoding', async () => {
      const result = await FileSaverService.saveAndShare({
        fileName: 'transaksi.csv',
        data: 'ID,Tanggal,Jumlah\n1,2026-08-20,50000',
        mimeType: 'text/csv;charset=utf-8;',
      });

      expect(result.success).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///mock/cache/transaksi.csv',
        'ID,Tanggal,Jumlah\n1,2026-08-20,50000',
        { encoding: 'utf8' }
      );
    });
  });

  describe('Error handling', () => {
    it('should return error message when printToFileAsync throws an error', async () => {
      (Print.printToFileAsync as jest.Mock).mockRejectedValue(new Error('Print service failure'));

      const result = await FileSaverService.saveAndShare({
        fileName: 'laporan.pdf',
        data: '<html></html>',
        mimeType: 'application/pdf',
        isPdfHtml: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Print service failure');
    });
  });
});
