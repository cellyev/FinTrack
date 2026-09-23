-- Migration: 20260819000004_debts_policies.sql
-- Description: Ensures debts table indices, constraints, and RLS policies are up to date for Phase 3C.

-- 1. Ensure RLS is enabled on debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- 2. Clean up & re-create owner RLS policies for debts
DROP POLICY IF EXISTS debt_read_own ON public.debts;
DROP POLICY IF EXISTS debt_write_own ON public.debts;
DROP POLICY IF EXISTS debt_update_own ON public.debts;

CREATE POLICY debt_read_own ON public.debts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY debt_write_own ON public.debts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY debt_update_own ON public.debts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Create indices for delta sync and query performance
CREATE INDEX IF NOT EXISTS idx_debts_user_status_due_remote
  ON public.debts (user_id, status, due_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_debts_user_updated_remote
  ON public.debts (user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_transactions_debt_remote
  ON public.transactions (user_id, debt_id) WHERE deleted_at IS NULL;
