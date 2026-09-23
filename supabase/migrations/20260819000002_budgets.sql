-- Migration: 20260819000002_budgets.sql
-- Description: Consolidates budgets table to single-category budget model and removes obsolete budget_categories table.

-- 1. Drop obsolete budget_categories table and triggers if any
DROP TRIGGER IF EXISTS budget_categories_owner ON public.budget_categories;
DROP TABLE IF EXISTS public.budget_categories CASCADE;

-- 2. Consolidate budgets table columns
DO $$
BEGIN
  -- Add category_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'budgets' 
      AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.budgets ADD COLUMN category_id uuid REFERENCES public.categories(id);
  END IF;

  -- Add amount if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'budgets' 
      AND column_name = 'amount'
  ) THEN
    ALTER TABLE public.budgets ADD COLUMN amount numeric(18,2);
    -- Migrate total_amount to amount if total_amount exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'budgets' 
        AND column_name = 'total_amount'
    ) THEN
      UPDATE public.budgets SET amount = total_amount WHERE amount IS NULL;
    END IF;
  END IF;

  -- Add period_type if not present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'budgets' 
      AND column_name = 'period_type'
  ) THEN
    ALTER TABLE public.budgets ADD COLUMN period_type public.budget_period NOT NULL DEFAULT 'monthly';
  END IF;
END $$;

-- 3. Update constraints on amount and period_type
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_total_amount_check;
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_amount_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_amount_check CHECK (amount > 0);

-- 4. Ensure Row Level Security (RLS) is enabled
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_read_own ON public.budgets;
DROP POLICY IF EXISTS budget_write_own ON public.budgets;
DROP POLICY IF EXISTS budget_update_own ON public.budgets;

CREATE POLICY budget_read_own ON public.budgets 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY budget_write_own ON public.budgets 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY budget_update_own ON public.budgets 
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Create indices for fast user active lookups and delta synchronization
CREATE INDEX IF NOT EXISTS idx_budgets_user_active_remote
  ON public.budgets(user_id, deleted_at, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_budgets_category_remote
  ON public.budgets(user_id, category_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_budgets_user_updated_remote
  ON public.budgets(user_id, updated_at);
