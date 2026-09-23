import { SupabaseRealtimeTrigger } from '@/core/sync/application/supabase-realtime.trigger';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';

interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

interface MockSupabase {
  channel: jest.Mock;
  removeChannel: jest.Mock;
}

describe('SupabaseRealtimeTrigger Unit Tests', () => {
  let mockCoordinator: jest.Mocked<SyncCoordinator>;
  let mockChannel: MockChannel;
  let mockSupabase: MockSupabase;
  let trigger: SupabaseRealtimeTrigger;
  let eventCallbacks: { [table: string]: () => void } = {};

  beforeEach(() => {
    eventCallbacks = {};

    mockCoordinator = {
      requestSync: jest.fn(),
    } as unknown as jest.Mocked<SyncCoordinator>;

    mockChannel = {
      on: jest.fn().mockImplementation((_type: string, filterConfig: { table: string }, callback: () => void) => {
        eventCallbacks[filterConfig.table] = callback;
        return mockChannel;
      }),
      subscribe: jest.fn().mockImplementation(() => mockChannel),
    };

    mockSupabase = {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeChannel: jest.fn(),
    };

    trigger = new SupabaseRealtimeTrigger(mockSupabase as never, mockCoordinator);
  });

  it('should create user-scoped realtime channel and subscribe to postgres_changes', () => {
    trigger.subscribe('user-123');

    expect(mockSupabase.channel).toHaveBeenCalledWith('realtime-sync:user-123');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'accounts',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'categories',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'budgets',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'savings_goals',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'debts',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recurring_transactions',
        filter: 'user_id=eq.user-123',
      },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('should trigger debounced requestSync when accounts table changes in realtime', () => {
    trigger.subscribe('user-123');

    expect(eventCallbacks['accounts']).toBeDefined();
    eventCallbacks['accounts']();

    expect(mockCoordinator.requestSync).toHaveBeenCalledWith('realtime', 500);
  });

  it('should trigger debounced requestSync when transactions table changes in realtime', () => {
    trigger.subscribe('user-123');

    expect(eventCallbacks['transactions']).toBeDefined();
    eventCallbacks['transactions']();

    expect(mockCoordinator.requestSync).toHaveBeenCalledWith('realtime', 500);
  });

  it('should unsubscribe and remove channel cleanly', () => {
    trigger.subscribe('user-123');
    trigger.unsubscribe();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    expect(trigger.getChannel()).toBeNull();
  });

  it('should re-subscribe to new channel when user changes', () => {
    trigger.subscribe('user-123');
    trigger.subscribe('user-456');

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    expect(mockSupabase.channel).toHaveBeenCalledWith('realtime-sync:user-456');
  });
});
