'use strict';

/* ============================================================
   Admin Panel – Privat Barengan 2026
   ============================================================ */

// ── State ────────────────────────────────────────────────────
const state = {
  page:    1,
  limit:   15,
  search:  '',
  bulan:   '',
  kota:    '',
  durasi:  '',
  status:  '',
  currentId: null,
};

// ── Element Refs ─────────────────────────────────────────────
const sidebar       = document.getElementById('sidebar');
const hamburgerBtn  = document.getElementById('hamburgerBtn');
const refreshBtn    = document.getElementById('refreshBtn');
const pageTitle     = document.getElementById('pageTitle');
const searchInput   = document.getElementById('searchInput');
const filterBulan   = document.getElementById('filterBulan');
const filterKota    = document.getElementById('filterKota');
const filterStatus  = document.getElementById('filterStatus');
const resetFilters  = document.getElementById('resetFilters');
const exportBtn     = document.getElementById('exportBtn');
const tableBody     = document.getElementById('tableBody');
const tableCount    = document.getElementById('tableCount');
const pagination    = document.getElementById('pagination');
const toast         = document.getElementById('adminToast');

// Modal
const modalBackdrop    = document.getElementById('modalBackdrop');
const modalClose       = document.getElementById('modalClose');
const modalBody        = document.getElementById('modalBody');
const statusSelect     = document.getElementById('statusSelect');
const btnUpdateStatus  = document.getElementById('btnUpdateStatus');
const btnDelete        = document.getElementById('btnDelete');

// ── Navigation ────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const pageId = item.dataset.page;
    switchPage(pageId);
    sidebar.classList.remove('open');
  });
});

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.getElementById(`nav-${pageId}`)?.classList.add('active');

  const titles = { dashboard: 'Dashboard', registrations: 'Data Pendaftar' };
  pageTitle.textContent = titles[pageId] || '';

  if (pageId === 'dashboard') loadStats();
  if (pageId === 'registrations') loadRegistrations();
}

// Sidebar toggle (mobile)
hamburgerBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

// ── Stats / Dashboard ─────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch('/api/admin/stats');
    const data = await res.json();
    if (!data.success) throw new Error();

    const s = data.stats;

    document.getElementById('val-total').textContent    = s.total_registrasi.toLocaleString('id-ID');
    document.getElementById('val-peserta').textContent  = s.total_peserta.toLocaleString('id-ID');

    const confirmed = s.by_status.find(x => x.status_konfirmasi === 'Tiket Terkonfirmasi');
    const waiting   = s.by_status.find(x => x.status_konfirmasi === 'Menunggu Konfirmasi Tiket');
    document.getElementById('val-confirmed').textContent = confirmed ? confirmed.count : '0';
    document.getElementById('val-waiting').textContent   = waiting   ? waiting.count   : '0';

    renderBarChart('chart-kota',   s.by_kota,   'kota_keberangkatan');
    renderBarChart('chart-bulan',  s.by_bulan,  'bulan_keberangkatan');
    renderBarChart('chart-durasi', s.by_durasi, 'durasi_program');

  } catch {
    showToast('Gagal memuat statistik', 'error');
  }
}

function renderBarChart(containerId, rows, key) {
  const container = document.getElementById(containerId);
  if (!container || !rows.length) {
    container.innerHTML = '<p style="color:var(--text-300);font-size:0.8rem;padding:10px 0">Belum ada data</p>';
    return;
  }
  const max = Math.max(...rows.map(r => parseInt(r.count)));
  container.innerHTML = rows.map(r => {
    const pct = Math.round((parseInt(r.count) / max) * 100);
    return `
      <div class="bar-row">
        <span class="bar-label" title="${r[key]}">${r[key]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="bar-count">${r.count}</span>
      </div>`;
  }).join('');
}

// ── Registrations Table ───────────────────────────────────────
async function loadRegistrations() {
  tableBody.innerHTML = '<tr><td colspan="11" class="table-loading">🔄 Memuat data...</td></tr>';
  tableCount.textContent = 'Memuat...';

  const params = new URLSearchParams({
    page:   state.page,
    limit:  state.limit,
    ...(state.search && { search: state.search }),
    ...(state.bulan  && { bulan:  state.bulan }),
    ...(state.kota   && { kota:   state.kota }),
    ...(state.durasi && { durasi: state.durasi }),
    ...(state.status && { status: state.status }),
  });

  try {
    const res  = await fetch(`/api/admin/registrations?${params}`);
    const data = await res.json();
    if (!data.success) throw new Error();

    renderTable(data.data);
    renderPagination(data.pagination);
    tableCount.textContent = `Menampilkan ${data.data.length} dari ${data.pagination.total} pendaftar`;
  } catch {
    tableBody.innerHTML = '<tr><td colspan="11" class="table-loading">❌ Gagal memuat data</td></tr>';
    showToast('Gagal memuat data pendaftar', 'error');
  }
}

function renderTable(rows) {
  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="11" class="table-loading">Tidak ada data ditemukan</td></tr>';
    return;
  }

  tableBody.innerHTML = rows.map(r => {
    const badge = statusBadge(r.status_konfirmasi);
    const date  = new Date(r.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    return `
      <tr data-id="${r.id}">
        <td>#${r.id}</td>
        <td><strong style="color:var(--text-100)">${esc(r.nama_lengkap)}</strong></td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.nomor_wa)}</td>
        <td>${esc(r.bulan_keberangkatan)}</td>
        <td>${esc(r.durasi_program)}</td>
        <td>${esc(r.kota_keberangkatan)}</td>
        <td><strong style="color:var(--gold)">${r.jumlah_peserta}</strong></td>
        <td>${badge}</td>
        <td>${date}</td>
        <td>
          <button class="btn-detail" onclick="openModal(${r.id})">Detail</button>
        </td>
      </tr>`;
  }).join('');
}

function statusBadge(status) {
  if (status === 'Tiket Terkonfirmasi')      return `<span class="badge badge-confirmed">✔ Terkonfirmasi</span>`;
  if (status === 'Dibatalkan')               return `<span class="badge badge-cancelled">✕ Dibatalkan</span>`;
  return `<span class="badge badge-waiting">⏳ Menunggu</span>`;
}

function renderPagination({ total, page, limit, total_pages }) {
  if (total_pages <= 1) { pagination.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="gotoPage(${page - 1})">‹ Prev</button>`;

  const start = Math.max(1, page - 2);
  const end   = Math.min(total_pages, page + 2);

  if (start > 1) html += `<button class="page-btn" onclick="gotoPage(1)">1</button>${start > 2 ? '<span style="color:var(--text-300);padding:0 4px">…</span>' : ''}`;

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="gotoPage(${i})">${i}</button>`;
  }

  if (end < total_pages) html += `${end < total_pages - 1 ? '<span style="color:var(--text-300);padding:0 4px">…</span>' : ''}<button class="page-btn" onclick="gotoPage(${total_pages})">${total_pages}</button>`;

  html += `<button class="page-btn" ${page >= total_pages ? 'disabled' : ''} onclick="gotoPage(${page + 1})">Next ›</button>`;

  pagination.innerHTML = html;
}

function gotoPage(p) {
  state.page = p;
  loadRegistrations();
}

// ── Filters ───────────────────────────────────────────────────
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadRegistrations();
  }, 350);
});

filterBulan.addEventListener('change', () => { state.bulan  = filterBulan.value;  state.page = 1; loadRegistrations(); });
filterKota.addEventListener('change',  () => { state.kota   = filterKota.value;   state.page = 1; loadRegistrations(); });
filterStatus.addEventListener('change',() => { state.status = filterStatus.value; state.page = 1; loadRegistrations(); });

resetFilters.addEventListener('click', () => {
  searchInput.value   = '';
  filterBulan.value   = '';
  filterKota.value    = '';
  filterStatus.value  = '';
  Object.assign(state, { search:'', bulan:'', kota:'', durasi:'', status:'', page:1 });
  loadRegistrations();
});

// ── Modal ─────────────────────────────────────────────────────
let _allRows = [];

// Store rows when table renders
const _origRenderTable = renderTable;

async function openModal(id) {
  state.currentId = id;

  try {
    const res  = await fetch(`/api/admin/registrations?limit=1000`);
    const data = await res.json();
    const row  = data.data.find(r => r.id === id);
    if (!row) return showToast('Data tidak ditemukan', 'error');

    const date = new Date(row.created_at).toLocaleString('id-ID', {
      day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
    });

    modalBody.innerHTML = `
      <div class="detail-item"><span class="detail-key">ID</span><span class="detail-val">#${row.id}</span></div>
      <div class="detail-item"><span class="detail-key">Nama Lengkap</span><span class="detail-val">${esc(row.nama_lengkap)}</span></div>
      <div class="detail-item full"><span class="detail-key">Email</span><span class="detail-val">${esc(row.email)}</span></div>
      <div class="detail-item"><span class="detail-key">Nomor WA</span><span class="detail-val">${esc(row.nomor_wa)}</span></div>
      <div class="detail-item"><span class="detail-key">Jumlah Peserta</span><span class="detail-val">${row.jumlah_peserta} orang</span></div>
      <div class="detail-item"><span class="detail-key">Bulan Berangkat</span><span class="detail-val">${esc(row.bulan_keberangkatan)}</span></div>
      <div class="detail-item"><span class="detail-key">Durasi Program</span><span class="detail-val">${esc(row.durasi_program)}</span></div>
      <div class="detail-item full"><span class="detail-key">Kota Keberangkatan</span><span class="detail-val">${esc(row.kota_keberangkatan)}</span></div>
      <div class="detail-item full"><span class="detail-key">Status</span><span class="detail-val">${statusBadge(row.status_konfirmasi)}</span></div>
      <div class="detail-item full"><span class="detail-key">Tanggal Daftar</span><span class="detail-val">${date}</span></div>
    `;

    statusSelect.value = row.status_konfirmasi;
    modalBackdrop.hidden = false;
  } catch {
    showToast('Gagal membuka detail', 'error');
  }
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

function closeModal() {
  modalBackdrop.hidden = true;
  state.currentId = null;
}

// Update status
btnUpdateStatus.addEventListener('click', async () => {
  if (!state.currentId) return;
  try {
    const res  = await fetch(`/api/admin/registrations/${state.currentId}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: statusSelect.value }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.errors?.[0]);
    showToast('✅ Status berhasil diperbarui', 'success');
    closeModal();
    loadRegistrations();
  } catch (err) {
    showToast(err.message || 'Gagal update status', 'error');
  }
});

// Delete
btnDelete.addEventListener('click', async () => {
  if (!state.currentId) return;
  if (!confirm(`Yakin hapus pendaftaran #${state.currentId}? Tindakan ini tidak dapat dibatalkan.`)) return;
  try {
    const res  = await fetch(`/api/admin/registrations/${state.currentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.errors?.[0]);
    showToast('🗑 Pendaftaran berhasil dihapus', 'success');
    closeModal();
    loadRegistrations();
    loadStats();
  } catch (err) {
    showToast(err.message || 'Gagal menghapus', 'error');
  }
});

// ── Export CSV ────────────────────────────────────────────────
exportBtn.addEventListener('click', async () => {
  try {
    const res  = await fetch('/api/admin/registrations?limit=10000');
    const data = await res.json();
    if (!data.success) throw new Error();

    const headers = ['ID','Nama','Email','Nomor WA','Bulan Berangkat','Durasi','Kota','Peserta','Status','Tanggal Daftar'];
    const rows    = data.data.map(r => [
      r.id, r.nama_lengkap, r.email, r.nomor_wa,
      r.bulan_keberangkatan, r.durasi_program, r.kota_keberangkatan,
      r.jumlah_peserta, r.status_konfirmasi,
      new Date(r.created_at).toLocaleDateString('id-ID'),
    ]);

    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `pendaftaran-privat-barengan-${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ CSV berhasil diexport', 'success');
  } catch {
    showToast('Gagal export CSV', 'error');
  }
});

// ── Refresh ───────────────────────────────────────────────────
refreshBtn.addEventListener('click', () => {
  const active = document.querySelector('.page.active');
  if (active?.id === 'page-dashboard')     loadStats();
  if (active?.id === 'page-registrations') loadRegistrations();
  showToast('Data diperbarui', 'success');
});

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `admin-toast show ${type}`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Utils ─────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Expose global for inline onclick
window.openModal = openModal;
window.gotoPage  = gotoPage;

// ── Init ──────────────────────────────────────────────────────
loadStats();
