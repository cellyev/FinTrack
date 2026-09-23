import { appEvents } from '@/core/events/app-events';

describe('AppEventBus Reactive Invalidation', () => {
  it('should notify subscriber when specific event is emitted', () => {
    const callback = jest.fn();
    const unsubscribe = appEvents.subscribe('transactions_changed', callback);

    appEvents.emit('transactions_changed', { id: 'tx-123' });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ id: 'tx-123' });

    unsubscribe();
    appEvents.emit('transactions_changed');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should automatically notify data_invalidated subscribers on any specific data event', () => {
    const globalCallback = jest.fn();
    const unsubscribe = appEvents.subscribe('data_invalidated', globalCallback);

    appEvents.emit('accounts_changed');
    expect(globalCallback).toHaveBeenCalledTimes(1);

    appEvents.emit('budgets_changed');
    expect(globalCallback).toHaveBeenCalledTimes(2);

    appEvents.emit('savings_goals_changed');
    expect(globalCallback).toHaveBeenCalledTimes(3);

    unsubscribe();
    appEvents.emit('categories_changed');
    expect(globalCallback).toHaveBeenCalledTimes(3);
  });

  it('should support subscribing to multiple events at once', () => {
    const callback = jest.fn();
    const unsubscribe = appEvents.subscribe(['accounts_changed', 'categories_changed'], callback);

    appEvents.emit('accounts_changed');
    expect(callback).toHaveBeenCalledTimes(1);

    appEvents.emit('categories_changed');
    expect(callback).toHaveBeenCalledTimes(2);

    appEvents.emit('debts_changed');
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
