import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '@/core/supabase/client';
import { OutboxRecord } from '../domain/sync-types';

export interface RemoteAccountRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency_code: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteCategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteBudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  name: string | null;
  amount: number;
  period_type: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteSavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteDebtRow {
  id: string;
  user_id: string;
  type: 'borrowed' | 'lent';
  person_name: string;
  original_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: 'open' | 'settled' | 'cancelled';
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteRecurringTransactionRow {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  account_id: string;
  category_id: string;
  note: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteTransactionItemRow {
  id: string;
  user_id: string;
  transaction_id: string;
  category_id: string;
  amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteTransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  debt_id: string | null;
  recurring_transaction_id: string | null;
  occurrence_key: string | null;
  transaction_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  transaction_items?: RemoteTransactionItemRow[];
}

export class SupabaseSyncAdapter {
  constructor(private readonly client: SupabaseClient = defaultSupabase) {}

  public async pushMutation(record: OutboxRecord): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = JSON.parse(record.payload);

      switch (record.operationType) {
        case 'CREATE_ACCOUNT': {
          const { error } = await this.client.from('accounts').upsert({
            id: payload.id,
            user_id: record.userId,
            name: payload.name,
            type: payload.type,
            currency_code: payload.currency_code ?? 'IDR',
            icon: payload.icon ?? null,
            color: payload.color ?? null,
            is_active: Boolean(payload.is_active ?? true),
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_ACCOUNT': {
          const { error } = await this.client
            .from('accounts')
            .update({
              name: payload.name,
              type: payload.type,
              currency_code: payload.currency_code ?? 'IDR',
              icon: payload.icon ?? null,
              color: payload.color ?? null,
              is_active: Boolean(payload.is_active ?? true),
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_ACCOUNT': {
          const { error } = await this.client
            .from('accounts')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_CATEGORY': {
          const { error } = await this.client.from('categories').upsert({
            id: payload.id,
            user_id: record.userId,
            name: payload.name,
            type: payload.type,
            icon: payload.icon ?? null,
            color: payload.color ?? null,
            is_system: Boolean(payload.is_system ?? false),
            is_active: Boolean(payload.is_active ?? true),
            sort_order: payload.sort_order ?? 0,
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_CATEGORY': {
          const { error } = await this.client
            .from('categories')
            .update({
              name: payload.name,
              icon: payload.icon ?? null,
              color: payload.color ?? null,
              is_active: Boolean(payload.is_active ?? true),
              sort_order: payload.sort_order ?? 0,
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_CATEGORY': {
          const { error } = await this.client
            .from('categories')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_BUDGET': {
          const { error } = await this.client.from('budgets').upsert({
            id: payload.id,
            user_id: record.userId,
            category_id: payload.category_id,
            name: payload.name ?? null,
            amount: payload.amount / 100,
            period_type: payload.period_type,
            start_date: payload.start_date,
            end_date: payload.end_date,
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_BUDGET': {
          const { error } = await this.client
            .from('budgets')
            .update({
              name: payload.name ?? null,
              amount: payload.amount / 100,
              period_type: payload.period_type,
              start_date: payload.start_date,
              end_date: payload.end_date,
              updated_at: payload.updated_at ?? new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_BUDGET': {
          const { error } = await this.client
            .from('budgets')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_SAVINGS_GOAL': {
          const { error } = await this.client.from('savings_goals').upsert({
            id: payload.id,
            user_id: record.userId,
            name: payload.name,
            target_amount: payload.target_amount / 100,
            current_amount: (payload.current_amount ?? 0) / 100,
            target_date: payload.target_date ?? null,
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_SAVINGS_GOAL': {
          const { error } = await this.client
            .from('savings_goals')
            .update({
              name: payload.name,
              target_amount: payload.target_amount / 100,
              current_amount: (payload.current_amount ?? 0) / 100,
              target_date: payload.target_date ?? null,
              updated_at: payload.updated_at ?? new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_SAVINGS_GOAL': {
          const { error } = await this.client
            .from('savings_goals')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_DEBT': {
          const { error } = await this.client.from('debts').upsert({
            id: payload.id,
            user_id: record.userId,
            type: payload.type,
            person_name: payload.person_name,
            original_amount: payload.original_amount / 100,
            remaining_amount: payload.remaining_amount / 100,
            due_date: payload.due_date ?? null,
            status: payload.status ?? 'open',
            note: payload.note ?? null,
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_DEBT': {
          const { error } = await this.client
            .from('debts')
            .update({
              person_name: payload.person_name,
              original_amount: payload.original_amount !== undefined ? payload.original_amount / 100 : undefined,
              remaining_amount: payload.remaining_amount / 100,
              due_date: payload.due_date ?? null,
              status: payload.status ?? (payload.remaining_amount === 0 ? 'settled' : 'open'),
              note: payload.note ?? null,
              updated_at: payload.updated_at ?? new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_DEBT': {
          const { error } = await this.client
            .from('debts')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_RECURRING_TRANSACTION': {
          const { error } = await this.client.from('recurring_transactions').upsert({
            id: payload.id,
            user_id: record.userId,
            type: payload.type,
            amount: payload.amount / 100,
            account_id: payload.account_id,
            category_id: payload.category_id,
            note: payload.note ?? null,
            frequency: payload.frequency,
            start_date: payload.start_date,
            end_date: payload.end_date ?? null,
            next_occurrence: payload.next_occurrence,
            is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
          });
          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_RECURRING_TRANSACTION': {
          const { error } = await this.client
            .from('recurring_transactions')
            .update({
              amount: payload.amount !== undefined ? payload.amount / 100 : undefined,
              account_id: payload.account_id,
              category_id: payload.category_id,
              note: payload.note !== undefined ? payload.note : undefined,
              frequency: payload.frequency,
              start_date: payload.start_date,
              end_date: payload.end_date !== undefined ? payload.end_date : undefined,
              next_occurrence: payload.next_occurrence,
              is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : undefined,
              updated_at: payload.updated_at ?? new Date().toISOString(),
            })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_RECURRING_TRANSACTION': {
          const { error } = await this.client
            .from('recurring_transactions')
            .update({ deleted_at: payload.deleted_at ?? new Date().toISOString() })
            .eq('id', payload.id)
            .eq('user_id', record.userId);
          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'CREATE_TRANSACTION': {
          // Convert minor units to decimal for Supabase numeric(18,2)
          const decimalAmount = payload.amount / 100;
          const rawItems = (payload.items ?? []) as Array<{ id?: string; category_id: string; amount: number; note?: string | null }>;
          const itemsPayload = rawItems.map((item) => ({
            id: item.id,
            category_id: item.category_id,
            amount: item.amount / 100,
            note: item.note ?? null,
          }));

          const { error } = await this.client.rpc('create_transaction', {
            p_operation_id: record.id,
            p_transaction_id: payload.id,
            p_type: payload.type,
            p_amount: decimalAmount,
            p_source_account_id: payload.source_account_id ?? null,
            p_destination_account_id: payload.destination_account_id ?? null,
            p_transaction_date: payload.transaction_date,
            p_note: payload.note ?? null,
            p_items: itemsPayload,
            p_debt_id: payload.debt_id ?? null,
            p_recurring_transaction_id: payload.recurring_transaction_id ?? null,
            p_occurrence_key: payload.occurrence_key ?? null,
          });

          if (error) {
            if (this.isDuplicateEntityError(error.message)) return { success: true };
            return { success: false, error: error.message };
          }
          return { success: true };
        }

        case 'UPDATE_TRANSACTION': {
          const decimalAmount = payload.amount / 100;
          const rawItems = (payload.items ?? []) as Array<{ id?: string; category_id: string; amount: number; note?: string | null }>;
          const itemsPayload = rawItems.map((item) => ({
            id: item.id,
            category_id: item.category_id,
            amount: item.amount / 100,
            note: item.note ?? null,
          }));

          const { error } = await this.client.rpc('update_transaction', {
            p_id: payload.id,
            p_expected_updated_at: payload.updated_at ?? new Date().toISOString(),
            p_type: payload.type,
            p_amount: decimalAmount,
            p_source_account_id: payload.source_account_id ?? null,
            p_destination_account_id: payload.destination_account_id ?? null,
            p_transaction_date: payload.transaction_date,
            p_note: payload.note ?? null,
            p_items: itemsPayload,
          });

          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        case 'DELETE_TRANSACTION': {
          const { error } = await this.client.rpc('soft_delete_transaction', {
            p_id: payload.id,
            p_expected_updated_at: payload.updated_at ?? new Date().toISOString(),
          });

          if (error) return { success: false, error: error.message };
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown operation type: ${String(record.operationType)}` };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown adapter push error';
      return { success: false, error: msg };
    }
  }

  public async pullAccountsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteAccountRow[]; error?: string }> {
    let query = this.client.from('accounts').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteAccountRow[] };
  }

  public async pullCategoriesDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteCategoryRow[]; error?: string }> {
    let query = this.client.from('categories').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteCategoryRow[] };
  }

  public async pullBudgetsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteBudgetRow[]; error?: string }> {
    let query = this.client.from('budgets').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteBudgetRow[] };
  }

  public async pullSavingsGoalsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteSavingsGoalRow[]; error?: string }> {
    let query = this.client.from('savings_goals').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteSavingsGoalRow[] };
  }

  public async pullDebtsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteDebtRow[]; error?: string }> {
    let query = this.client.from('debts').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteDebtRow[] };
  }

  public async pullRecurringTransactionsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteRecurringTransactionRow[]; error?: string }> {
    let query = this.client.from('recurring_transactions').select('*').eq('user_id', userId);
    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteRecurringTransactionRow[] };
  }

  public async pullTransactionsDelta(
    userId: string,
    since?: string | null
  ): Promise<{ success: boolean; data?: RemoteTransactionRow[]; error?: string }> {
    let query = this.client
      .from('transactions')
      .select('*, transaction_items(*)')
      .eq('user_id', userId);

    if (since) {
      query = query.gt('updated_at', since);
    }
    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as RemoteTransactionRow[] };
  }

  private isDuplicateEntityError(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();
    return (
      lower.includes('duplicate key') ||
      lower.includes('unique constraint') ||
      lower.includes('already exists') ||
      lower.includes('23505')
    );
  }
}
