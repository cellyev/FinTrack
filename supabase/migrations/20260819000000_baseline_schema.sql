-- FinTrack baseline schema for Supabase PostgreSQL.
-- Prepared for Supabase CLI migrations. Review open decisions before production.
create extension if not exists pgcrypto;

create type public.account_type as enum ('cash', 'bank', 'ewallet');
create type public.transaction_type as enum ('income', 'expense', 'transfer', 'opening_balance');
create type public.category_type as enum ('income', 'expense');
create type public.budget_period as enum ('custom', 'monthly');
create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.debt_type as enum ('lent', 'borrowed');
create type public.debt_status as enum ('open', 'settled', 'cancelled');
create type public.recurring_frequency as enum ('weekly', 'monthly');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  currency_code char(3) not null default 'IDR' check (currency_code ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  type public.account_type not null,
  currency_code char(3) not null default 'IDR' check (currency_code ~ '^[A-Z]{3}$'),
  icon text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  type public.category_type not null,
  icon text,
  color text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, type, name)
);

create table public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  period public.budget_period not null default 'custom',
  start_date date not null,
  end_date date not null,
  total_amount numeric(18,2) check (total_amount is null or total_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date >= start_date)
);

create table public.budget_categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (budget_id, category_id)
);

create table public.savings_goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  target_amount numeric(18,2) not null check (target_amount > 0),
  target_date date,
  icon text,
  color text,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.savings_allocations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  savings_goal_id uuid not null references public.savings_goals(id),
  account_id uuid not null references public.accounts(id),
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.debts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.debt_type not null,
  person_name text not null check (char_length(trim(person_name)) between 1 and 100),
  original_amount numeric(18,2) not null check (original_amount > 0),
  remaining_amount numeric(18,2) not null check (remaining_amount >= 0),
  due_date date,
  status public.debt_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (remaining_amount <= original_amount)
);

create table public.recurring_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null check (type in ('income', 'expense')),
  amount numeric(18,2) not null check (amount > 0),
  account_id uuid not null references public.accounts(id),
  category_id uuid not null references public.categories(id),
  note text,
  frequency public.recurring_frequency not null,
  start_date date not null,
  end_date date,
  next_occurrence date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date is null or end_date >= start_date)
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(18,2) not null check (amount > 0),
  source_account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  debt_id uuid references public.debts(id),
  recurring_transaction_id uuid references public.recurring_transactions(id),
  occurrence_key uuid unique,
  transaction_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (type = 'income' and source_account_id is null and destination_account_id is not null)
    or (type = 'expense' and source_account_id is not null and destination_account_id is null)
    or (type = 'transfer' and source_account_id is not null and destination_account_id is not null and source_account_id <> destination_account_id)
    or (type = 'opening_balance' and source_account_id is null and destination_account_id is not null)
  )
);

create table public.transaction_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount numeric(18,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  storage_path text not null unique check (storage_path like user_id::text || '/%'),
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 2097152),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Operation log makes retried financial RPC calls idempotent.
create table public.financial_operations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  result_transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);

create index accounts_user_active_idx on public.accounts (user_id, is_active) where deleted_at is null;
create index categories_user_type_idx on public.categories (user_id, type, sort_order) where deleted_at is null;
create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc) where deleted_at is null;
create index transactions_source_idx on public.transactions (user_id, source_account_id) where deleted_at is null;
create index transactions_destination_idx on public.transactions (user_id, destination_account_id) where deleted_at is null;
create index transactions_debt_idx on public.transactions (user_id, debt_id) where deleted_at is null;
create index transaction_items_transaction_idx on public.transaction_items (transaction_id) where deleted_at is null;
create index transaction_items_category_idx on public.transaction_items (user_id, category_id) where deleted_at is null;
create index budgets_user_range_idx on public.budgets (user_id, start_date, end_date) where deleted_at is null;
create index allocations_goal_idx on public.savings_allocations (user_id, savings_goal_id) where deleted_at is null;
create index debts_user_status_due_idx on public.debts (user_id, status, due_date) where deleted_at is null;
create index recurring_user_next_idx on public.recurring_transactions (user_id, next_occurrence) where is_active and deleted_at is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.apply_updated_at()
returns void language plpgsql as $$
declare t text;
begin
  foreach t in array array['profiles','accounts','categories','budgets','budget_categories','savings_goals','savings_allocations','debts','recurring_transactions','transactions','transaction_items','attachments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
select public.apply_updated_at();
drop function public.apply_updated_at();

-- Relational ownership remains valid even for allowed direct writes to planning tables.
create or replace function public.assert_related_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'budget_categories' and (
    not exists (select 1 from public.budgets where id=new.budget_id and user_id=new.user_id and deleted_at is null)
    or not exists (select 1 from public.categories where id=new.category_id and user_id=new.user_id and deleted_at is null)
  ) then raise exception 'budget and category must belong to user'; end if;
  if tg_table_name = 'savings_allocations' and (
    not exists (select 1 from public.savings_goals where id=new.savings_goal_id and user_id=new.user_id and deleted_at is null)
    or not exists (select 1 from public.accounts where id=new.account_id and user_id=new.user_id and deleted_at is null)
  ) then raise exception 'goal and account must belong to user'; end if;
  if tg_table_name = 'recurring_transactions' and (
    not exists (select 1 from public.accounts where id=new.account_id and user_id=new.user_id and deleted_at is null and is_active)
    or not exists (select 1 from public.categories where id=new.category_id and user_id=new.user_id and deleted_at is null
      and type = case when new.type='income' then 'income'::public.category_type else 'expense'::public.category_type end)
  ) then raise exception 'recurring account/category must belong to user and match type'; end if;
  return new;
end $$;
create trigger budget_category_owner before insert or update on public.budget_categories for each row execute function public.assert_related_owner();
create trigger allocation_owner before insert or update on public.savings_allocations for each row execute function public.assert_related_owner();
create trigger recurring_owner before insert or update on public.recurring_transactions for each row execute function public.assert_related_owner();

create or replace function public.protect_system_category()
returns trigger language plpgsql as $$
begin
  if old.is_system and (new.name is distinct from old.name or new.type is distinct from old.type or new.deleted_at is not null) then
    raise exception 'system categories cannot be renamed, retyped, or deleted';
  end if;
  return new;
end $$;
create trigger protect_system_category before update on public.categories for each row execute function public.protect_system_category();

-- Validates ownership, type-specific category rules, and exact split sum.
create or replace function public.assert_transaction_payload(
  p_type public.transaction_type, p_amount numeric, p_source uuid, p_destination uuid, p_items jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_sum numeric; v_count integer; v_bad integer;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_type in ('income','expense') then
    select coalesce(sum((x->>'amount')::numeric), 0), count(*) into v_sum, v_count
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;
    if v_count = 0 or v_sum <> p_amount then raise exception 'split total must equal transaction amount'; end if;
    select count(*) into v_bad
    from jsonb_array_elements(p_items) x
    left join public.categories c on c.id = (x->>'category_id')::uuid
    where c.id is null or c.user_id <> auth.uid() or c.deleted_at is not null
       or c.type <> case when p_type = 'income' then 'income'::public.category_type else 'expense'::public.category_type end;
    if v_bad > 0 then raise exception 'invalid category split'; end if;
  elsif jsonb_array_length(coalesce(p_items, '[]'::jsonb)) <> 0 then
    raise exception 'transfer and opening balance cannot have category splits';
  end if;
end $$;

create or replace function public.create_transaction(
  p_operation_id uuid, p_transaction_id uuid, p_type public.transaction_type, p_amount numeric,
  p_source_account_id uuid, p_destination_account_id uuid, p_transaction_date date,
  p_note text default null, p_items jsonb default '[]'::jsonb, p_debt_id uuid default null,
  p_recurring_transaction_id uuid default null, p_occurrence_key uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing uuid; v_account_count integer; x jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select result_transaction_id into v_existing from public.financial_operations where id=p_operation_id and user_id=auth.uid();
  if found then return v_existing; end if;
  perform public.assert_transaction_payload(p_type,p_amount,p_source_account_id,p_destination_account_id,p_items);
  select count(*) into v_account_count from public.accounts
   where id in (p_source_account_id,p_destination_account_id) and user_id=auth.uid() and deleted_at is null and is_active;
  if v_account_count <> (case when p_source_account_id is null or p_destination_account_id is null then 1 else 2 end) then
    raise exception 'account does not belong to user';
  end if;
  if p_debt_id is not null and not exists (select 1 from public.debts where id=p_debt_id and user_id=auth.uid() and deleted_at is null) then
    raise exception 'debt does not belong to user';
  end if;
  if p_recurring_transaction_id is not null and not exists (select 1 from public.recurring_transactions where id=p_recurring_transaction_id and user_id=auth.uid() and deleted_at is null) then
    raise exception 'recurring template does not belong to user';
  end if;
  insert into public.transactions (id,user_id,type,amount,source_account_id,destination_account_id,transaction_date,note,debt_id,recurring_transaction_id,occurrence_key)
  values (p_transaction_id,auth.uid(),p_type,p_amount,p_source_account_id,p_destination_account_id,p_transaction_date,p_note,p_debt_id,p_recurring_transaction_id,p_occurrence_key);
  for x in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.transaction_items (id,user_id,transaction_id,category_id,amount,note)
    values (coalesce((x->>'id')::uuid, gen_random_uuid()),auth.uid(),p_transaction_id,(x->>'category_id')::uuid,(x->>'amount')::numeric,x->>'note');
  end loop;
  insert into public.financial_operations(id,user_id,result_transaction_id) values (p_operation_id,auth.uid(),p_transaction_id);
  return p_transaction_id;
end $$;

create or replace function public.update_transaction(
  p_id uuid, p_expected_updated_at timestamptz, p_type public.transaction_type, p_amount numeric,
  p_source_account_id uuid, p_destination_account_id uuid, p_transaction_date date,
  p_note text default null, p_items jsonb default '[]'::jsonb
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_account_count integer; x jsonb; v_updated timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.assert_transaction_payload(p_type,p_amount,p_source_account_id,p_destination_account_id,p_items);
  select count(*) into v_account_count from public.accounts
   where id in (p_source_account_id,p_destination_account_id) and user_id=auth.uid() and deleted_at is null and is_active;
  if v_account_count <> (case when p_source_account_id is null or p_destination_account_id is null then 1 else 2 end) then
    raise exception 'account does not belong to user or is inactive';
  end if;
  update public.transactions
  set type=p_type, amount=p_amount, source_account_id=p_source_account_id, destination_account_id=p_destination_account_id,
      transaction_date=p_transaction_date, note=p_note
  where id=p_id and user_id=auth.uid() and deleted_at is null and updated_at=p_expected_updated_at
    and current_date <= transaction_date + 7
  returning updated_at into v_updated;
  if not found then raise exception 'transaction missing, changed, or outside seven-day correction window'; end if;
  update public.transaction_items set deleted_at=now() where transaction_id=p_id and user_id=auth.uid() and deleted_at is null;
  for x in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    insert into public.transaction_items (id,user_id,transaction_id,category_id,amount,note)
    values (coalesce((x->>'id')::uuid, gen_random_uuid()),auth.uid(),p_id,(x->>'category_id')::uuid,(x->>'amount')::numeric,x->>'note');
  end loop;
  return v_updated;
end $$;

create or replace function public.soft_delete_transaction(p_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.transactions
  set deleted_at=now()
  where id=p_id and user_id=auth.uid() and deleted_at is null
    and updated_at=p_expected_updated_at
    and current_date <= transaction_date + 7;
  if not found then raise exception 'transaction missing, changed, or outside seven-day correction window'; end if;
  update public.transaction_items set deleted_at=now() where transaction_id=p_id and user_id=auth.uid() and deleted_at is null;
  update public.attachments set deleted_at=now() where transaction_id=p_id and user_id=auth.uid() and deleted_at is null;
end $$;

-- RLS: all business records are isolated by owner. Financial write RPCs retain server validation.
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_allocations enable row level security;
alter table public.debts enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.attachments enable row level security;
alter table public.financial_operations enable row level security;

create or replace function public.create_owner_policy(p_table text) returns void language plpgsql as $$
begin
 execute format('create policy read_own on public.%I for select using (auth.uid() = user_id)', p_table);
end $$;
select public.create_owner_policy(t) from unnest(array['accounts','categories','budgets','budget_categories','savings_goals','savings_allocations','debts','recurring_transactions','transactions','transaction_items','attachments','financial_operations']) t;
drop function public.create_owner_policy(text);

create policy profile_own on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);
-- Direct mutations are permitted only for non-financial master/planning records. Add stricter policies as individual flows mature.
create policy account_write_own on public.accounts for insert with check (auth.uid()=user_id);
create policy account_update_own on public.accounts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy category_write_own on public.categories for insert with check (auth.uid()=user_id);
create policy category_update_own on public.categories for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy budget_write_own on public.budgets for insert with check (auth.uid()=user_id);
create policy budget_update_own on public.budgets for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy budget_category_write_own on public.budget_categories for insert with check (auth.uid()=user_id);
create policy budget_category_update_own on public.budget_categories for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy goal_write_own on public.savings_goals for insert with check (auth.uid()=user_id);
create policy goal_update_own on public.savings_goals for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy allocation_write_own on public.savings_allocations for insert with check (auth.uid()=user_id);
create policy allocation_update_own on public.savings_allocations for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy debt_write_own on public.debts for insert with check (auth.uid()=user_id);
create policy debt_update_own on public.debts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy recurring_write_own on public.recurring_transactions for insert with check (auth.uid()=user_id);
create policy recurring_update_own on public.recurring_transactions for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

revoke insert, update, delete on public.transactions, public.transaction_items, public.attachments, public.financial_operations from anon, authenticated;
grant execute on function public.create_transaction(uuid,uuid,public.transaction_type,numeric,uuid,uuid,date,text,jsonb,uuid,uuid,uuid) to authenticated;
grant execute on function public.update_transaction(uuid,timestamptz,public.transaction_type,numeric,uuid,uuid,date,text,jsonb) to authenticated;
grant execute on function public.soft_delete_transaction(uuid,timestamptz) to authenticated;

-- Create a private storage bucket in the dashboard or via this insert if Storage is installed.
insert into storage.buckets (id, name, public) values ('receipts','receipts',false) on conflict (id) do nothing;
create policy receipts_read_own on storage.objects for select using (
  bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy receipts_insert_own on storage.objects for insert with check (
  bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy receipts_delete_own on storage.objects for delete using (
  bucket_id='receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
