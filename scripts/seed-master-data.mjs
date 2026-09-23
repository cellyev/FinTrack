#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

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

const DEFAULT_CATEGORIES = [
  // Pengeluaran
  { name: 'Makanan & Minuman', type: 'expense', icon: '🍽️', color: '#FF5722', sort_order: 1 },
  { name: 'Transportasi', type: 'expense', icon: '🚗', color: '#03A9F4', sort_order: 2 },
  { name: 'Belanja', type: 'expense', icon: '🛍️', color: '#E91E63', sort_order: 3 },
  { name: 'Tagihan & Utilitas', type: 'expense', icon: '🧾', color: '#FF9800', sort_order: 4 },
  { name: 'Hiburan & Hobi', type: 'expense', icon: '🎮', color: '#9C27B0', sort_order: 5 },
  { name: 'Kesehatan', type: 'expense', icon: '💊', color: '#4CAF50', sort_order: 6 },
  { name: 'Pendidikan', type: 'expense', icon: '📚', color: '#3F51B5', sort_order: 7 },
  { name: 'Lainnya', type: 'expense', icon: '📦', color: '#607D8B', sort_order: 8 },
  // Pemasukan
  { name: 'Gaji Bulanan', type: 'income', icon: '💵', color: '#2E7D32', sort_order: 1 },
  { name: 'Bonus & THR', type: 'income', icon: '🎁', color: '#F9A825', sort_order: 2 },
  { name: 'Investasi & Usaha', type: 'income', icon: '📈', color: '#00897B', sort_order: 3 },
  { name: 'Hadiah & Uang Saku', type: 'income', icon: '🎉', color: '#7B1FA2', sort_order: 4 },
  { name: 'Pemasukan Lainnya', type: 'income', icon: '💰', color: '#546E7A', sort_order: 5 },
];

const DEFAULT_ACCOUNTS = [
  { name: 'Dompet Tunai', type: 'cash', icon: 'cash', color: '#4CAF50' },
  { name: 'Rekening Bank', type: 'bank', icon: 'credit-card', color: '#2196F3' },
  { name: 'E-Wallet', type: 'ewallet', icon: 'smartphone', color: '#9C27B0' },
];

async function seedForUser(client, userId) {
  console.log(`\n🌱 Memasukkan data master untuk User ID: ${userId}...`);

  // 1. Profil
  process.stdout.write('- Menyiapkan profil pengguna... ');
  await client.from('profiles').upsert({
    id: userId,
    full_name: 'Pengguna FinTrack',
    currency_code: 'IDR',
    timezone: 'Asia/Jakarta',
  });
  console.log('✓');

  // 2. Kategori Master
  process.stdout.write('- Memasukkan 13 kategori master... ');
  for (const cat of DEFAULT_CATEGORIES) {
    await client.from('categories').upsert(
      {
        user_id: userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        is_system: true,
        is_active: true,
        sort_order: cat.sort_order,
      },
      { onConflict: 'user_id,type,name' }
    );
  }
  console.log('✓');

  // 3. Akun Keuangan Master
  process.stdout.write('- Memasukkan 3 akun keuangan master (Dompet, Bank, E-Wallet)... ');
  for (const acc of DEFAULT_ACCOUNTS) {
    await client.from('accounts').upsert(
      {
        user_id: userId,
        name: acc.name,
        type: acc.type,
        currency_code: 'IDR',
        icon: acc.icon,
        color: acc.color,
        is_active: true,
      },
      { onConflict: 'user_id,name' }
    );
  }
  console.log('✓');

  console.log('\n✨ Selesai! Data master berhasil dimasukkan.');
  console.log('📱 Saat Anda membuka aplikasi FinTrack di HP, data master ini akan otomatis disinkronkan ke SQLite lokal.');
}

async function main() {
  console.log('\n======================================================');
  console.log('      FinTrack Master Data Seeder (Development)       ');
  console.log('======================================================\n');

  if (!supabaseUrl) {
    console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL tidak ditemukan di .env');
    process.exit(1);
  }

  console.log('Metode Seeding:');
  console.log('1. Masuk menggunakan Email & Password akun pengujian');
  console.log('2. Menggunakan SUPABASE_SERVICE_ROLE_KEY (admin)');
  console.log('3. Lihat petunjuk SQL Editor Supabase\n');

  const choice = await askQuestion('Pilih metode (1/2/3) [default 1]: ');

  if (choice === '2') {
    if (!serviceRoleKey) {
      serviceRoleKey = await askQuestion('Masukkan SUPABASE_SERVICE_ROLE_KEY: ');
      serviceRoleKey = serviceRoleKey.trim();
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: users, error } = await adminClient.auth.admin.listUsers();
    if (error || !users.users.length) {
      console.error('❌ Tidak ada user di database. Silakan daftar dulu.');
      rl.close();
      return;
    }
    const targetUser = users.users[0];
    console.log(`Menggunakan user: ${targetUser.email} (${targetUser.id})`);
    await seedForUser(adminClient, targetUser.id);
  } else if (choice === '3') {
    console.log('\n💡 Jalankan file scripts/seed-master-data.sql di Supabase Dashboard -> SQL Editor.');
  } else {
    // Default: Email & Password login
    const email = await askQuestion('Email pengguna: ');
    const password = await askQuestion('Password pengguna: ');
    const client = createClient(supabaseUrl, anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      console.error(`❌ Gagal masuk: ${error?.message || 'Kredensial salah'}`);
      rl.close();
      return;
    }

    await seedForUser(client, data.user.id);
  }

  rl.close();
}

main().catch((err) => {
  console.error('❌ Terjadi kesalahan:', err);
  rl.close();
  process.exit(1);
});
