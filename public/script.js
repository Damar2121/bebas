'use strict';

/* ============================================================
   Privat Barengan 2026 – Client-Side Logic
   ============================================================ */

// ── Element References ──────────────────────────────────────
const form          = document.getElementById('registrationForm');
const submitBtn     = document.getElementById('submitBtn');
const successPanel  = document.getElementById('successPanel');
const successMsg    = document.getElementById('successMessage');
const successInfo   = document.getElementById('successInfo');
const registerAgain = document.getElementById('registerAgainBtn');
const toast         = document.getElementById('toast');
const btnDecrement  = document.getElementById('btn-decrement');
const btnIncrement  = document.getElementById('btn-increment');
const pesertaInput  = document.getElementById('jumlah_peserta');

// ── Allowed Values (mirrors server) ────────────────────────
const VALID_BULAN = [
  'Juni 2026','Juli 2026','Agustus 2026','September 2026',
  'Oktober 2026','Nopember 2026','Desember 2026',
];

const VALID_DURASI = [
  '9 Hari','12 Hari','16 Hari','12 hari Plus TURKI',
  '15 hari Plus TURKI Cappadocia','30 Hari/SEBULAN',
];

const VALID_KOTA = [
  'Medan','Pekanbaru','Padang','Batam','Palembang','Jakarta',
  'Surabaya','Balikpapan','Banjarmasin','Denpasar','Lombok',
  'Pontianak','Makassar','Kuala Lumpur',
];

// ── Validation Rules ────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WA_REGEX    = /^\d{9,15}$/;

function getFieldValue(name) {
  const el = form.elements[name];
  if (!el) return '';
  // For radio groups, NodeList
  if (el instanceof RadioNodeList || el instanceof NodeList) {
    return el.value || '';
  }
  return el.value || '';
}

function validateField(name) {
  let value = getFieldValue(name);
  let error = '';

  switch (name) {
    case 'email':
      if (!value.trim()) error = 'Email wajib diisi.';
      else if (!EMAIL_REGEX.test(value.trim())) error = 'Format email tidak valid.';
      break;

    case 'nama_lengkap':
      if (!value.trim()) error = 'Nama lengkap wajib diisi.';
      else if (value.trim().length < 2) error = 'Nama minimal 2 karakter.';
      break;

    case 'nomor_wa': {
      const clean = value.replace(/[\s\-+]/g, '');
      if (!value.trim()) error = 'Nomor WA wajib diisi.';
      else if (!WA_REGEX.test(clean)) error = 'Nomor WA harus 9–15 digit angka.';
      break;
    }

    case 'bulan_keberangkatan':
      if (!value || !VALID_BULAN.includes(value)) error = 'Pilih bulan keberangkatan.';
      break;

    case 'durasi_program':
      if (!value || !VALID_DURASI.includes(value)) error = 'Pilih durasi program.';
      break;

    case 'kota_keberangkatan':
      if (!value || !VALID_KOTA.includes(value)) error = 'Pilih kota keberangkatan.';
      break;

    case 'jumlah_peserta': {
      const num = parseInt(value);
      if (!value) error = 'Jumlah peserta wajib diisi.';
      else if (isNaN(num) || num < 1) error = 'Jumlah peserta minimal 1 orang.';
      break;
    }
  }

  setFieldError(name, error);
  return error === '';
}

// ── Show / clear field errors ───────────────────────────────
function setFieldError(name, message) {
  const errorEl  = document.getElementById(`error-${name}`);
  const groupEl  = document.getElementById(`group-${name}`);

  // Find the actual input or select
  const inputEl  = form.elements[name];
  const isRadio  = inputEl instanceof RadioNodeList;

  if (errorEl) errorEl.textContent = message;

  if (groupEl) {
    groupEl.classList.toggle('error-group', !!message);
  }

  if (!isRadio && inputEl) {
    const el = inputEl instanceof NodeList ? inputEl[0] : inputEl;
    if (el) {
      el.classList.toggle('is-invalid', !!message);
      el.classList.toggle('is-valid',   !message && el.value !== '');
    }
  }
}

// ── Real-time validation on blur ────────────────────────────
['email','nama_lengkap','nomor_wa','kota_keberangkatan','jumlah_peserta'].forEach(name => {
  const el = form.elements[name];
  if (!el) return;
  const target = el instanceof NodeList ? el[0] : el;
  if (target) {
    target.addEventListener('blur', () => validateField(name));
    target.addEventListener('input', () => {
      // Clear error on edit
      if (document.getElementById(`error-${name}`)?.textContent) {
        setFieldError(name, '');
      }
    });
  }
});

// Real-time for radio groups
['bulan_keberangkatan','durasi_program'].forEach(name => {
  const radios = form.querySelectorAll(`input[name="${name}"]`);
  radios.forEach(r => r.addEventListener('change', () => validateField(name)));
});

// ── Number Stepper ──────────────────────────────────────────
btnDecrement.addEventListener('click', () => {
  const current = parseInt(pesertaInput.value) || 1;
  if (current > 1) {
    pesertaInput.value = current - 1;
    validateField('jumlah_peserta');
  }
});

btnIncrement.addEventListener('click', () => {
  const current = parseInt(pesertaInput.value) || 0;
  if (current < 100) {
    pesertaInput.value = current + 1;
    validateField('jumlah_peserta');
  }
});

pesertaInput.addEventListener('input', () => validateField('jumlah_peserta'));

// ── Form Submit ─────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validate all fields
  const fields = [
    'email','nama_lengkap','nomor_wa',
    'bulan_keberangkatan','durasi_program',
    'kota_keberangkatan','jumlah_peserta',
  ];
  const allValid = fields.map(f => validateField(f)).every(Boolean);

  if (!allValid) {
    showToast('❌ Harap lengkapi semua kolom yang wajib diisi.', 'error');
    // Scroll to first error
    const firstError = form.querySelector('.is-invalid, .error-group');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Build payload
  const payload = {
    email:               getFieldValue('email').trim(),
    nama_lengkap:        getFieldValue('nama_lengkap').trim(),
    nomor_wa:            getFieldValue('nomor_wa').trim(),
    bulan_keberangkatan: getFieldValue('bulan_keberangkatan'),
    durasi_program:      getFieldValue('durasi_program'),
    kota_keberangkatan:  getFieldValue('kota_keberangkatan'),
    jumlah_peserta:      parseInt(getFieldValue('jumlah_peserta')),
  };

  // Loading state
  setLoading(true);

  try {
    const res = await fetch('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showSuccess(data);
    } else {
      const errMsg = data.errors?.join('\n') || 'Terjadi kesalahan. Silakan coba lagi.';
      showToast(`❌ ${errMsg}`, 'error');
    }
  } catch (err) {
    console.error('Network error:', err);
    showToast('❌ Tidak dapat terhubung ke server. Periksa koneksi Anda.', 'error');
  } finally {
    setLoading(false);
  }
});

// ── Loading State ───────────────────────────────────────────
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('loading', isLoading);
}

// ── Success State ───────────────────────────────────────────
function showSuccess(data) {
  const registeredAt = data.data?.registered_at
    ? new Date(data.data.registered_at).toLocaleString('id-ID', {
        day:    '2-digit',
        month:  'long',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : '-';

  successMsg.textContent = data.message;

  successInfo.innerHTML = `
    <span>📋 ID Pendaftaran: <strong>#${data.data?.id ?? '-'}</strong></span>
    <span>👤 Nama: <strong>${escapeHtml(data.data?.nama ?? '-')}</strong></span>
    <span>🕐 Waktu Daftar: <strong>${registeredAt}</strong></span>
  `;

  form.parentElement.hidden = true;
  form.closest('.form-card').hidden = true;
  successPanel.hidden = false;
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Register Again ──────────────────────────────────────────
registerAgain.addEventListener('click', () => {
  form.reset();
  successPanel.hidden = true;
  form.closest('.form-card').hidden = false;
  form.closest('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Clear all validation states
  form.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
    el.classList.remove('is-invalid','is-valid');
  });
  form.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
  form.querySelectorAll('.error-group').forEach(el => el.classList.remove('error-group'));
});

// ── Toast Notification ──────────────────────────────────────
let toastTimer = null;

function showToast(message, type = 'info') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show toast-${type}`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ── Utility ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
