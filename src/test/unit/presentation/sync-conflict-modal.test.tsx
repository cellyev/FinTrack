import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SyncConflictModal } from '@/core/sync/presentation/components/SyncConflictModal';
import { useSyncConflicts } from '@/core/sync/presentation/use-sync-conflicts';

jest.mock('@/core/sync/presentation/use-sync-conflicts');
const mockedUseSyncConflicts = useSyncConflicts as jest.MockedFunction<typeof useSyncConflicts>;

describe('SyncConflictModal Presentation Component', () => {
  const mockResolve = jest.fn().mockResolvedValue(undefined);
  const mockClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty state when there are no unresolved conflicts', () => {
    mockedUseSyncConflicts.mockReturnValue({
      conflicts: [],
      isLoading: false,
      resolveConflict: mockResolve,
      resolveAllStale: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText } = render(<SyncConflictModal visible={true} onClose={mockClose} />);
    expect(getByText('Semua data telah tersinkron tanpa konflik. ✓')).toBeTruthy();
  });

  it('should trigger use_local resolution when Gunakan Versi Perangkat is pressed', async () => {
    mockedUseSyncConflicts.mockReturnValue({
      conflicts: [
        {
          id: 'conf-1',
          userId: 'user-1',
          entityName: 'transactions',
          entityId: 'tx-1',
          conflictType: 'correction_window_expired',
          localPayload: '{}',
          remotePayload: '{}',
          localUpdatedAt: '2026-08-19T10:00:00Z',
          remoteUpdatedAt: '2026-08-19T10:05:00Z',
          status: 'unresolved',
          resolution: null,
          resolvedAt: null,
          createdAt: '2026-08-19T10:05:00Z',
        },
      ],
      isLoading: false,
      resolveConflict: mockResolve,
      resolveAllStale: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText } = render(<SyncConflictModal visible={true} onClose={mockClose} />);

    expect(getByText('Catatan Transaksi')).toBeTruthy();
    expect(
      getByText('Perubahan transaksi ditolak karena telah melewati batas jendela koreksi 7 hari.')
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Gunakan Versi Perangkat'));
    });
    expect(mockResolve).toHaveBeenCalledWith('conf-1', 'use_local');
  });

  it('should trigger use_remote resolution when Gunakan Versi Cloud is pressed', async () => {
    mockedUseSyncConflicts.mockReturnValue({
      conflicts: [
        {
          id: 'conf-2',
          userId: 'user-1',
          entityName: 'categories',
          entityId: 'cat-1',
          conflictType: 'duplicate_category',
          localPayload: '{}',
          remotePayload: '{}',
          localUpdatedAt: '2026-08-19T10:00:00Z',
          remoteUpdatedAt: '2026-08-19T10:05:00Z',
          status: 'unresolved',
          resolution: null,
          resolvedAt: null,
          createdAt: '2026-08-19T10:05:00Z',
        },
      ],
      isLoading: false,
      resolveConflict: mockResolve,
      resolveAllStale: jest.fn(),
      refresh: jest.fn(),
    });

    const { getByText } = render(<SyncConflictModal visible={true} onClose={mockClose} />);

    await act(async () => {
      fireEvent.press(getByText('Gunakan Versi Cloud'));
    });
    expect(mockResolve).toHaveBeenCalledWith('conf-2', 'use_remote');
  });
});
