-- ==============================================================================
-- FinTrack Database Reset Script (Development Environment Only)
-- ==============================================================================
-- Perhatian: Script ini akan MENGHAPUS SEMUA DATA transaksi, anggaran, tabungan,
-- hutang, kategori, akun, dan profil di Supabase.
--
-- Cara menjalankan di Supabase Web:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih project FinTrack Anda
-- 3. Buka menu "SQL Editor" di bilah samping kiri (ikon terminal/SQL)
-- 4. Buat query baru, tempel (paste) script di bawah ini, lalu klik "Run"
-- ==============================================================================

-- 1. Kosongkan semua tabel aplikasi (CASCADE menangani relasi foreign key secara otomatis)
TRUNCATE TABLE 
  public.transaction_items,
  public.transactions,
  public.budget_categories,
  public.budgets,
  public.savings_allocations,
  public.savings_goals,
  public.debt_payments,
  public.debts,
  public.recurring_transactions,
  public.categories,
  public.accounts,
  public.profiles
CASCADE;

-- 2. (OPSIONAL) Hapus seluruh user otentikasi jika Anda ingin mendaftar ulang dengan email yang sama.
-- Hapus tanda komentar (-- ) pada baris di bawah jika Anda ingin mengosongkan user login:
-- DELETE FROM auth.users;

-- Tampilkan konfirmasi bahwa reset berhasil
SELECT 'Database FinTrack berhasil di-reset menjadi bersih!' AS status;
