import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ExportModal } from '@/features/transactions/presentation/components/ExportModal';
import { FileSaverService } from '@/features/transactions/application/file-saver.service';
import { useAuth } from '@/features/auth/presentation/use-auth';

const mockExecute = jest.fn();

jest.mock('@/features/auth/presentation/use-auth');
jest.mock('@/features/transactions/application/export-transactions.usecase', () => ({
  ExportTransactionsUseCase: jest.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mockExecute(...args),
  })),
}));
jest.mock('@/features/transactions/application/file-saver.service');

describe('ExportModal Component', () => {
  const mockUser = { id: 'u-1', email: 'test@example.com' };
  const mockClose = jest.fn();
  let mockSaveAndShare: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        fileName: 'fintrack_transaksi_2026-08-20.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: 'UEsDBBQAAAA...',
        count: 5,
        isBase64: true,
      },
    });

    mockSaveAndShare = jest.fn().mockResolvedValue({
      success: true,
      filePath: 'file:///cache/fintrack_transaksi_2026-08-20.xlsx',
    });
    FileSaverService.saveAndShare = mockSaveAndShare;
  });

  it('should render all 4 export formats (Excel, PDF, CSV, JSON)', () => {
    const { getByText } = render(
      <ExportModal
        visible={true}
        onClose={mockClose}
        filter={{ datePreset: 'all' }}
        totalFilteredCount={10}
      />
    );

    expect(getByText('Ekspor & Unduh Transaksi')).toBeTruthy();
    expect(getByText('Ekspor 10 transaksi yang sesuai dengan filter riwayat saat ini.')).toBeTruthy();
    expect(getByText('Excel (.xlsx)')).toBeTruthy();
    expect(getByText('PDF Laporan')).toBeTruthy();
    expect(getByText('CSV')).toBeTruthy();
    expect(getByText('JSON')).toBeTruthy();
  });

  it('should export Excel by default and trigger FileSaverService on submit', async () => {
    const { getByText } = render(
      <ExportModal
        visible={true}
        onClose={mockClose}
        filter={{ datePreset: 'all' }}
        totalFilteredCount={5}
      />
    );

    fireEvent.press(getByText('Unduh & Simpan'));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-1',
          format: 'excel',
        })
      );
      expect(mockSaveAndShare).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'fintrack_transaksi_2026-08-20.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          isBase64: true,
        })
      );
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should allow switching format to PDF and execute export with pdf format', async () => {
    mockExecute.mockResolvedValueOnce({
      success: true,
      data: {
        fileName: 'fintrack_laporan_2026-08-20.pdf',
        mimeType: 'application/pdf',
        data: '<html>...</html>',
        count: 5,
        isPdfHtml: true,
      },
    });

    const { getByText } = render(
      <ExportModal
        visible={true}
        onClose={mockClose}
        filter={{ datePreset: 'all' }}
        totalFilteredCount={5}
      />
    );

    // Select PDF
    fireEvent.press(getByText('PDF Laporan'));
    fireEvent.press(getByText('Unduh & Simpan'));

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'pdf',
        })
      );
      expect(mockSaveAndShare).toHaveBeenCalledWith(
        expect.objectContaining({
          isPdfHtml: true,
        })
      );
    });
  });
});
