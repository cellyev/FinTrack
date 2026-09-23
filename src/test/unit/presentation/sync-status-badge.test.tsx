import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SyncStatusBadge } from '@/core/sync/presentation/components/SyncStatusBadge';
import { useSyncStatus } from '@/core/sync/presentation/use-sync-status';

jest.mock('@/core/sync/presentation/use-sync-status');
const mockedUseSyncStatus = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;

describe('SyncStatusBadge Presentation Component', () => {
  const mockSyncNow = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('should render "Tersinkron" when state is synced', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'synced',
      pendingCount: 0,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: '2026-08-19T10:00:00Z',
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('Tersinkron')).toBeTruthy();
  });

  it('should render "Menyinkronkan..." when isSyncing is true', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'syncing',
      pendingCount: 2,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: true,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('Menyinkronkan...')).toBeTruthy();
  });

  it('should render "Offline" when state is offline', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'offline',
      pendingCount: 1,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('Offline')).toBeTruthy();
  });

  it('should render pending count when state is pending', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'pending',
      pendingCount: 4,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('4 pending')).toBeTruthy();
  });

  it('should render conflict count when state is conflict', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'conflict',
      pendingCount: 0,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 1,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('1 konflik')).toBeTruthy();
  });

  it('should render dead letter count when deadLetterCount is greater than zero', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'error',
      pendingCount: 0,
      failedCount: 0,
      deadLetterCount: 2,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: 'Server error',
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByText } = render(<SyncStatusBadge />);
    expect(getByText('2 gagal')).toBeTruthy();
  });

  it('should trigger syncNow when tapped while synced', async () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'synced',
      pendingCount: 0,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByRole } = render(<SyncStatusBadge />);
    const button = getByRole('button');

    await act(async () => {
      fireEvent.press(button);
    });

    expect(mockSyncNow).toHaveBeenCalledTimes(1);
  });

  it('should show offline alert and not trigger syncNow when tapped while offline', () => {
    mockedUseSyncStatus.mockReturnValue({
      state: 'offline',
      pendingCount: 1,
      failedCount: 0,
      deadLetterCount: 0,
      conflictCount: 0,
      lastSyncedAt: null,
      lastError: null,
      isSyncing: false,
      syncNow: mockSyncNow,
    });

    const { getByRole } = render(<SyncStatusBadge />);
    const button = getByRole('button');
    fireEvent.press(button);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Mode Offline',
      expect.stringContaining('Perangkat tidak terhubung')
    );
    expect(mockSyncNow).not.toHaveBeenCalled();
  });
});
