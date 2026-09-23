-- Phase 3D: Recurring & Scheduled Transactions Cloud Policies & Indices
-- Safe extension of recurring_frequency enum to support daily and yearly
ALTER TYPE public.recurring_frequency ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE public.recurring_frequency ADD VALUE IF NOT EXISTS 'yearly';

-- Enable Row Level Security (RLS) on recurring_transactions
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for recurring_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'recurring_transactions' 
      AND policyname = 'Users can select own recurring transactions'
  ) THEN
    CREATE POLICY "Users can select own recurring transactions"
      ON public.recurring_transactions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'recurring_transactions' 
      AND policyname = 'Users can insert own recurring transactions'
  ) THEN
    CREATE POLICY "Users can insert own recurring transactions"
      ON public.recurring_transactions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'recurring_transactions' 
      AND policyname = 'Users can update own recurring transactions'
  ) THEN
    CREATE POLICY "Users can update own recurring transactions"
      ON public.recurring_transactions
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indices for delta sync and recurring scheduling queries
CREATE INDEX IF NOT EXISTS recurring_transactions_user_active_idx
  ON public.recurring_transactions (user_id, is_active, next_occurrence)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS recurring_transactions_user_updated_idx
  ON public.recurring_transactions (user_id, updated_at);

CREATE INDEX IF NOT EXISTS transactions_user_recurring_idx
  ON public.transactions (user_id, recurring_transaction_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS transactions_occurrence_key_idx
  ON public.transactions (occurrence_key);
