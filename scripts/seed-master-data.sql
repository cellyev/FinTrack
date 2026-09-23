-- ==============================================================================
-- FinTrack Master Data Seeding Script (Development & Initial Setup)
-- ==============================================================================
-- Script ini meng-insert Data Master dasar ke Supabase:
-- 1. Profil Pengguna (Default IDR & Asia/Jakarta)
-- 2. 13 Kategori Master Bawaan (8 Pengeluaran + 5 Pemasukan)
-- 3. 3 Akun Keuangan Master (Dompet Tunai, Rekening Bank, E-Wallet)
--
-- Cara menjalankan di Supabase Web:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Buka menu "SQL Editor"
-- 3. Tempel script ini dan klik "Run"
-- ==============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_email text := ''; -- (Opsional) Tulis email spesifik di sini jika ingin target user tertentu, misal: 'admin@fintrack.com'
BEGIN
  -- 1. Cari user_id dari auth.users
  IF v_email <> '' THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  ELSE
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Tidak ditemukan user di auth.users. Silakan daftar akun terlebih dahulu di aplikasi FinTrack atau lewat menu Supabase Auth > Users!';
  END IF;

  -- 2. Insert Profil Default
  INSERT INTO public.profiles (id, full_name, currency_code, timezone, created_at, updated_at)
  VALUES (v_user_id, 'Pengguna FinTrack', 'IDR', 'Asia/Jakarta', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 3. Insert Kategori Master Pengeluaran & Pemasukan (is_system = true)
  INSERT INTO public.categories (id, user_id, name, type, icon, color, is_system, is_active, sort_order, created_at, updated_at)
  VALUES
    -- Pengeluaran
    (gen_random_uuid(), v_user_id, 'Makanan & Minuman', 'expense', '🍽️', '#FF5722', true, true, 1, now(), now()),
    (gen_random_uuid(), v_user_id, 'Transportasi', 'expense', '🚗', '#03A9F4', true, true, 2, now(), now()),
    (gen_random_uuid(), v_user_id, 'Belanja', 'expense', '🛍️', '#E91E63', true, true, 3, now(), now()),
    (gen_random_uuid(), v_user_id, 'Tagihan & Utilitas', 'expense', '🧾', '#FF9800', true, true, 4, now(), now()),
    (gen_random_uuid(), v_user_id, 'Hiburan & Hobi', 'expense', '🎮', '#9C27B0', true, true, 5, now(), now()),
    (gen_random_uuid(), v_user_id, 'Kesehatan', 'expense', '💊', '#4CAF50', true, true, 6, now(), now()),
    (gen_random_uuid(), v_user_id, 'Pendidikan', 'expense', '📚', '#3F51B5', true, true, 7, now(), now()),
    (gen_random_uuid(), v_user_id, 'Lainnya', 'expense', '📦', '#607D8B', true, true, 8, now(), now()),
    -- Pemasukan
    (gen_random_uuid(), v_user_id, 'Gaji Bulanan', 'income', '💵', '#2E7D32', true, true, 1, now(), now()),
    (gen_random_uuid(), v_user_id, 'Bonus & THR', 'income', '🎁', '#F9A825', true, true, 2, now(), now()),
    (gen_random_uuid(), v_user_id, 'Investasi & Usaha', 'income', '📈', '#00897B', true, true, 3, now(), now()),
    (gen_random_uuid(), v_user_id, 'Hadiah & Uang Saku', 'income', '🎉', '#7B1FA2', true, true, 4, now(), now()),
    (gen_random_uuid(), v_user_id, 'Pemasukan Lainnya', 'income', '💰', '#546E7A', true, true, 5, now(), now())
  ON CONFLICT (user_id, type, name) DO NOTHING;

  -- 4. Insert Akun Keuangan Master Awal
  INSERT INTO public.accounts (id, user_id, name, type, currency_code, icon, color, is_active, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_user_id, 'Dompet Tunai', 'cash', 'IDR', 'cash', '#4CAF50', true, now(), now()),
    (gen_random_uuid(), v_user_id, 'Rekening Bank', 'bank', 'IDR', 'credit-card', '#2196F3', true, now(), now()),
    (gen_random_uuid(), v_user_id, 'E-Wallet', 'ewallet', 'IDR', 'smartphone', '#9C27B0', true, now(), now())
  ON CONFLICT (user_id, name) DO NOTHING;

  RAISE NOTICE '✅ Master data FinTrack berhasil di-insert untuk User ID: %', v_user_id;
END $$;
