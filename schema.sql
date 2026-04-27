-- ============================================================
-- Privat Barengan 2026 – Database Schema
-- Run this script once to set up the database:
--   psql -U postgres -d privat_barengan -f schema.sql
-- ============================================================

-- Step 1: Create ENUM types for standardized choices
CREATE TYPE bulan_berangkat_enum AS ENUM (
    'Juni 2026',
    'Juli 2026',
    'Agustus 2026',
    'September 2026',
    'Oktober 2026',
    'Nopember 2026',
    'Desember 2026'
);

CREATE TYPE durasi_program_enum AS ENUM (
    '9 Hari',
    '12 Hari',
    '16 Hari',
    '12 hari Plus TURKI',
    '15 hari Plus TURKI Cappadocia',
    '30 Hari/SEBULAN'
);

-- Step 2: Create the main registration table
CREATE TABLE IF NOT EXISTS pendaftaran_privat_barengan (
    id                   SERIAL PRIMARY KEY,
    email                VARCHAR(255)           NOT NULL,
    nama_lengkap         VARCHAR(255)           NOT NULL,
    nomor_wa             VARCHAR(50)            NOT NULL,

    -- Choice fields using ENUMs
    bulan_keberangkatan  bulan_berangkat_enum   NOT NULL,
    durasi_program       durasi_program_enum    NOT NULL,
    kota_keberangkatan   VARCHAR(100)           NOT NULL,

    -- Number field with positive constraint
    jumlah_peserta       INTEGER                NOT NULL CHECK (jumlah_peserta > 0),

    -- Operational fields
    status_konfirmasi    VARCHAR(50)            DEFAULT 'Menunggu Konfirmasi Tiket',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_nomor_wa
    ON pendaftaran_privat_barengan(nomor_wa);

CREATE INDEX IF NOT EXISTS idx_kota_keberangkatan
    ON pendaftaran_privat_barengan(kota_keberangkatan);

-- Step 4: Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_updated_at
    BEFORE UPDATE ON pendaftaran_privat_barengan
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
