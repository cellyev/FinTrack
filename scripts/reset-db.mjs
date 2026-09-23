#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// 1. Baca konfigurasi dari .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        envVars[key] = val;
      }
    }
  }
  return envVars;
}

const env = loadEnv();
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Daftar tabel sesuai hierarki foreign key
const TABLES_TO_CLEAR = [
  'transaction_items',
  'transactions',
  'budget_categories',
  'budgets',
  'savings_allocations',
  'savings_goals',
  'debt_payments',
  'debts',
  'recurring_transactions',
  'categories',
  'accounts',
  'profiles',
];

async function main() {
  console.log('\n======================================================');
  console.log('       FinTrack Database Reset Tool (Development)     ');
  console.log('======================================================\n');

  if (!supabaseUrl) {
    console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL tidak ditemukan di file .env');
    process.exit(1);
  }

  console.log(`🔗 Supabase URL: ${supabaseUrl}`);

  // Cek argumen CLI
  const args = process.argv.slice(2);
  const serviceKeyArgIndex = args.indexOf('--service-key');
  if (serviceKeyArgIndex !== -1 && args[serviceKeyArgIndex + 1]) {
    serviceRoleKey = args[serviceKeyArgIndex + 1];
  }

  if (!serviceRoleKey) {
    console.log('\n⚠️  SUPABASE_SERVICE_ROLE_KEY belum terdeteksi.');
    console.log('   Pilihan:');
    console.log('   1. Masukkan service_role key sekarang (bisa disalin dari Supabase Dashboard -> Project Settings -> API)');
    console.log('   2. Masuk menggunakan Email & Password pengguna (menghapus data pengguna tersebut)');
    console.log('   3. Gunakan file SQL (jalankan scripts/reset-supabase.sql di Supabase SQL Editor)\n');

    const choice = await askQuestion('Pilih opsi (1/2/3) [default 3]: ');

    if (choice === '1') {
      serviceRoleKey = await askQuestion('Masukkan SUPABASE_SERVICE_ROLE_KEY: ');
      serviceRoleKey = serviceRoleKey.trim();
    } else if (choice === '2') {
      const email = await askQuestion('Email pengguna: ');
      const password = await askQuestion('Password pengguna: ');
      await resetUserData(email.trim(), password);
      rl.close();
      return;
    } else {
      console.log('\n💡 Cara paling praktis & cepat di Supabase:');
      console.log('   1. Buka Supabase Dashboard -> SQL Editor');
      console.log('   2. Jalankan isi file: scripts/reset-supabase.sql');
      console.log('   Semua tabel akan langsung dikosongkan dalam 1 detik!\n');
      rl.close();
      return;
    }
  }

  if (!serviceRoleKey) {
    console.error('❌ Service role key tidak boleh kosong.');
    rl.close();
    process.exit(1);
  }

  const confirm = await askQuestion(
    '\n⚠️  PERINGATAN: Ini akan MENGHAPUS SEMUA DATA di semua tabel database Supabase!\nKetik "RESET" untuk mengonfirmasi: '
  );

  if (confirm.trim() !== 'RESET') {
    console.log('Operasi dibatalkan.');
    rl.close();
    return;
  }

  console.log('\n🚀 Memulai proses pengosongan database Supabase...');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const table of TABLES_TO_CLEAR) {
    process.stdout.write(`- Mengosongkan tabel "${table}"... `);
    // Hapus seluruh baris (filter non-null id)
    const { error, count } = await supabaseAdmin
      .from(table)
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.log(`❌ Gagal: ${error.message}`);
    } else {
      console.log(`✓ Bersih (${count ?? 0} baris dihapus)`);
    }
  }

  const deleteUsers = await askQuestion('\nApakah Anda juga ingin menghapus semua akun pengguna di auth.users? (y/N): ');
  if (deleteUsers.toLowerCase() === 'y') {
    process.stdout.write('- Menghapus pengguna di auth.users... ');
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.log(`❌ Gagal membaca users: ${listErr.message}`);
    } else {
      let deleted = 0;
      for (const u of users.users) {
        await supabaseAdmin.auth.admin.deleteUser(u.id);
        deleted++;
      }
      console.log(`✓ Bersih (${deleted} pengguna dihapus)`);
    }
  }

  console.log('\n✨ Database Supabase berhasil dibersihkan!');
  console.log('💡 Tip: Di aplikasi HP, Anda juga bisa membersihkan database lokal SQLite melalui menu Diagnostik Sinkronisasi di tab Profil.\n');

  rl.close();
}

async function resetUserData(email, password) {
  console.log(`\n🔑 Masuk sebagai ${email}...`);
  const client = createClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    console.error(`❌ Gagal masuk: ${error?.message || 'Kredensial tidak valid'}`);
    return;
  }

  console.log(`✓ Berhasil login (User ID: ${data.user.id})`);
  console.log('Menghapus data milik pengguna...');

  for (const table of TABLES_TO_CLEAR) {
    process.stdout.write(`- Mengosongkan "${table}" milik user... `);
    const { error: delErr } = await client
      .from(table)
      .delete()
      .eq('user_id', data.user.id);

    if (delErr && table !== 'profiles') {
      console.log(`(dilewati / ${delErr.message})`);
    } else {
      console.log('✓');
    }
  }

  console.log('\n✨ Data pengguna berhasil dibersihkan!');
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan:', err);
  rl.close();
  process.exit(1);
});
