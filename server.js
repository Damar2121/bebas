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

// ─── Admin API Routes ──────────────────────────────────────────────────────────

// GET /api/admin/stats
app.get('/api/admin/stats', async (_req, res) => {
  try {
    const [totalRes, pesertaRes, bulanRes, kotaRes, durasiRes, statusRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM pendaftaran_privat_barengan'),
      pool.query('SELECT COALESCE(SUM(jumlah_peserta), 0) AS total_peserta FROM pendaftaran_privat_barengan'),
      pool.query('SELECT bulan_keberangkatan, COUNT(*) AS count FROM pendaftaran_privat_barengan GROUP BY bulan_keberangkatan ORDER BY count DESC'),
      pool.query('SELECT kota_keberangkatan, COUNT(*) AS count FROM pendaftaran_privat_barengan GROUP BY kota_keberangkatan ORDER BY count DESC'),
      pool.query('SELECT durasi_program, COUNT(*) AS count FROM pendaftaran_privat_barengan GROUP BY durasi_program ORDER BY count DESC'),
      pool.query('SELECT status_konfirmasi, COUNT(*) AS count FROM pendaftaran_privat_barengan GROUP BY status_konfirmasi'),
    ]);
    return res.json({
      success: true,
      stats: {
        total_registrasi: parseInt(totalRes.rows[0].total),
        total_peserta:    parseInt(pesertaRes.rows[0].total_peserta),
        by_bulan:  bulanRes.rows,
        by_kota:   kotaRes.rows,
        by_durasi: durasiRes.rows,
        by_status: statusRes.rows,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, errors: ['Server error'] });
  }
});

// GET /api/admin/registrations
app.get('/api/admin/registrations', async (req, res) => {
  const { search, bulan, kota, durasi, status, page = 1, limit = 15 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(nama_lengkap ILIKE $${values.length} OR email ILIKE $${values.length} OR nomor_wa ILIKE $${values.length})`);
  }
  if (bulan)  { values.push(bulan);  conditions.push(`bulan_keberangkatan = $${values.length}`); }
  if (kota)   { values.push(kota);   conditions.push(`kota_keberangkatan = $${values.length}`); }
  if (durasi) { values.push(durasi); conditions.push(`durasi_program = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`status_konfirmasi = $${values.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countRes = await pool.query(`SELECT COUNT(*) FROM pendaftaran_privat_barengan ${where}`, values);
    const total    = parseInt(countRes.rows[0].count);

    values.push(parseInt(limit), offset);
    const dataRes = await pool.query(
      `SELECT * FROM pendaftaran_privat_barengan ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page:        parseInt(page),
        limit:       parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Admin list error:', err);
    return res.status(500).json({ success: false, errors: ['Server error'] });
  }
});

// PATCH /api/admin/registrations/:id/status
app.patch('/api/admin/registrations/:id/status', async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;
  const VALID_STATUS = ['Menunggu Konfirmasi Tiket', 'Tiket Terkonfirmasi', 'Dibatalkan'];
  if (!status || !VALID_STATUS.includes(status)) {
    return res.status(400).json({ success: false, errors: ['Status tidak valid'] });
  }
  try {
    const result = await pool.query(
      'UPDATE pendaftaran_privat_barengan SET status_konfirmasi = $1 WHERE id = $2 RETURNING *',
      [status, parseInt(id)]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, errors: ['Data tidak ditemukan'] });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, errors: ['Server error'] });
  }
});

// DELETE /api/admin/registrations/:id
app.delete('/api/admin/registrations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM pendaftaran_privat_barengan WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, errors: ['Data tidak ditemukan'] });
    return res.json({ success: true, message: `Pendaftaran #${id} berhasil dihapus` });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ success: false, errors: ['Server error'] });
  }
});

// Admin panel route
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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
