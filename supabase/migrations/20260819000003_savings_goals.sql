-- Migration: 20260819000003_savings_goals.sql
-- Description: Consolidates savings_goals schema and removes obsolete savings_allocations table.

-- 1. Drop obsolete savings_allocations triggers and table
DROP TRIGGER IF EXISTS allocation_owner ON public.savings_allocations;
DROP TABLE IF EXISTS public.savings_allocations CASCADE;

-- 2. Ensure savings_goals table has current_amount column with proper constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'savings_goals' 
      AND column_name = 'current_amount'
  ) THEN
    ALTER TABLE public.savings_goals 
      ADD COLUMN current_amount numeric(18,2) NOT NULL DEFAULT 0.00;
  END IF;
END $$;

-- 3. Add / update check constraints on target_amount and current_amount
ALTER TABLE public.savings_goals DROP CONSTRAINT IF EXISTS savings_goals_target_amount_check;
ALTER TABLE public.savings_goals DROP CONSTRAINT IF EXISTS savings_goals_current_amount_check;

ALTER TABLE public.savings_goals ADD CONSTRAINT savings_goals_target_amount_check CHECK (target_amount > 0);
ALTER TABLE public.savings_goals ADD CONSTRAINT savings_goals_current_amount_check CHECK (current_amount >= 0 AND current_amount <= target_amount);

-- 4. Ensure RLS is enabled and policies exist
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goal_read_own ON public.savings_goals;
DROP POLICY IF EXISTS goal_write_own ON public.savings_goals;
DROP POLICY IF EXISTS goal_update_own ON public.savings_goals;

CREATE POLICY goal_read_own ON public.savings_goals 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY goal_write_own ON public.savings_goals 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY goal_update_own ON public.savings_goals 
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Create index for fast user active lookups
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_active_remote
  ON public.savings_goals(user_id, deleted_at, target_date);
