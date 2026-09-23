import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '@/core/supabase/client';
import { SyncCoordinator } from './sync-coordinator';

export class SupabaseRealtimeTrigger {
  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;

  constructor(
    private readonly client: SupabaseClient = defaultSupabase,
    private readonly coordinator: SyncCoordinator = SyncCoordinator.getInstance()
  ) {}

  public subscribe(userId: string): void {
    if (this.currentUserId === userId && this.channel) {
      return;
    }

    this.unsubscribe();
    this.currentUserId = userId;

    const channelName = `realtime-sync:${userId}`;

    this.channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_goals',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.coordinator.requestSync('realtime', 500);
        }
      )
      .subscribe();
  }

  public unsubscribe(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentUserId = null;
  }

  public getChannel(): RealtimeChannel | null {
    return this.channel;
  }
}

export const realtimeSyncTrigger = new SupabaseRealtimeTrigger();
