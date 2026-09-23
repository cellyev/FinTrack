export type AppEventType =
  | 'transactions_changed'
  | 'accounts_changed'
  | 'categories_changed'
  | 'budgets_changed'
  | 'savings_goals_changed'
  | 'debts_changed'
  | 'recurring_changed'
  | 'sync_completed'
  | 'data_invalidated';

export type AppEventListener = (payload?: unknown) => void;

class AppEventBus {
  private listeners: Map<AppEventType, Set<AppEventListener>> = new Map();

  /**
   * Subscribe to one or multiple event types. Returns an unsubscribe function.
   */
  public subscribe(eventType: AppEventType | AppEventType[], listener: AppEventListener): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    for (const t of types) {
      if (!this.listeners.has(t)) {
        this.listeners.set(t, new Set());
      }
      this.listeners.get(t)!.add(listener);
    }

    return () => {
      for (const t of types) {
        this.listeners.get(t)?.delete(listener);
      }
    };
  }

  /**
   * Emit an event. Automatically triggers 'data_invalidated' subscribers
   * so all screens and hooks that watch general data changes will refresh.
   */
  public emit(eventType: AppEventType, payload?: unknown): void {
    const notified = new Set<AppEventListener>();

    // 1. Notify specific listeners
    this.listeners.get(eventType)?.forEach((listener) => {
      try {
        notified.add(listener);
        listener(payload);
      } catch (err) {
        console.warn(`[AppEventBus] Error in listener for "${eventType}":`, err);
      }
    });

    // 2. Also notify global 'data_invalidated' listeners without duplicate invocations
    if (eventType !== 'data_invalidated') {
      this.listeners.get('data_invalidated')?.forEach((listener) => {
        if (!notified.has(listener)) {
          try {
            notified.add(listener);
            listener(payload);
          } catch (err) {
            console.warn(`[AppEventBus] Error in global data_invalidated listener:`, err);
          }
        }
      });
    }
  }

  /**
   * Shorthand to trigger global refresh across the entire app
   */
  public notifyDataChanged(): void {
    this.emit('data_invalidated');
  }
}

export const appEvents = new AppEventBus();
