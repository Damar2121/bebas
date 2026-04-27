'use strict';

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

// ─── App & Middleware ──────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Connection Pool ──────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'privat_barengan',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
  } else {
    release();
    console.log('✅ PostgreSQL connected successfully');
  }
});

// ─── Constants: Allowed Values ─────────────────────────────────────────────────
const VALID_BULAN = [
  'Juni 2026', 'Juli 2026', 'Agustus 2026', 'September 2026',
  'Oktober 2026', 'Nopember 2026', 'Desember 2026',
];

const VALID_DURASI = [
  '9 Hari', '12 Hari', '16 Hari', '12 hari Plus TURKI',
  '15 hari Plus TURKI Cappadocia', '30 Hari/SEBULAN',
];

const VALID_KOTA = [
  'Medan', 'Pekanbaru', 'Padang', 'Batam', 'Palembang',
  'Jakarta', 'Surabaya', 'Balikpapan', 'Banjarmasin',
  'Denpasar', 'Lombok', 'Pontianak', 'Makassar', 'Kuala Lumpur',
];

// ─── Server-Side Validation ────────────────────────────────────────────────────
function validateRegistration(data) {
  const errors = [];

  // email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errors.push('Email tidak valid.');
  }

  // nama_lengkap
  if (!data.nama_lengkap || data.nama_lengkap.trim().length < 2) {
    errors.push('Nama lengkap harus diisi (minimal 2 karakter).');
  }

  // nomor_wa — digits only, 9–15 chars
  const waRegex = /^\d{9,15}$/;
  if (!data.nomor_wa || !waRegex.test(data.nomor_wa.replace(/[\s\-+]/g, ''))) {
    errors.push('Nomor WA tidak valid (9-15 digit angka).');
  }

  // bulan_keberangkatan
  if (!data.bulan_keberangkatan || !VALID_BULAN.includes(data.bulan_keberangkatan)) {
    errors.push('Pilihan bulan keberangkatan tidak valid.');
  }

  // durasi_program
  if (!data.durasi_program || !VALID_DURASI.includes(data.durasi_program)) {
    errors.push('Pilihan durasi program tidak valid.');
  }

  // kota_keberangkatan
  if (!data.kota_keberangkatan || !VALID_KOTA.includes(data.kota_keberangkatan)) {
    errors.push('Pilihan kota keberangkatan tidak valid.');
  }

  // jumlah_peserta
  const peserta = parseInt(data.jumlah_peserta);
  if (isNaN(peserta) || peserta < 1) {
    errors.push('Jumlah peserta harus berupa angka positif (minimal 1).');
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
  const data = req.body;

  // Validate
  const errors = validateRegistration(data);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const nomor_wa_clean = data.nomor_wa.replace(/[\s\-]/g, '');

  try {
    const query = `
      INSERT INTO pendaftaran_privat_barengan
        (email, nama_lengkap, nomor_wa, bulan_keberangkatan, durasi_program, kota_keberangkatan, jumlah_peserta)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;

    const values = [
      data.email.trim(),
      data.nama_lengkap.trim(),
      nomor_wa_clean,
      data.bulan_keberangkatan,
      data.durasi_program,
      data.kota_keberangkatan,
      parseInt(data.jumlah_peserta),
    ];

    const result = await pool.query(query, values);
    const row = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil! Tim kami akan segera menghubungi Bapak/Ibu untuk konfirmasi tiket.',
      data: {
        id: row.id,
        nama: data.nama_lengkap.trim(),
        registered_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('Database error:', err);
    return res.status(500).json({
      success: false,
      errors: ['Terjadi kesalahan pada server. Silakan coba lagi.'],
    });
  }
});

// Fallback — serve index.html for any unmatched route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`🚀 Privat Barengan 2026 server running at http://localhost:${PORT}`);
});
