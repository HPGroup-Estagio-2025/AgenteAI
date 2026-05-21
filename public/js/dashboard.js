'use strict';

// ── Auth guard ────────────────────────────────────────────────────────────────
const token = sessionStorage.getItem('auth_token');
const expiry = parseInt(sessionStorage.getItem('token_expiry') || '0', 10);

if (!token || Date.now() > expiry) {
  sessionStorage.clear();
  window.location.replace('/');
}

function authHeaders() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Sector map ────────────────────────────────────────────────────────────────
const SECTOR_MAP = {
  'maritimo':      { label: 'Marítimo',      cls: 'badge-sector-maritimo' },
  'defesa-militar':{ label: 'Defesa Militar', cls: 'badge-sector-defesa' },
  'aeroespacial':  { label: 'Aeroespacial',   cls: 'badge-sector-aeroespacial' },
  'ferroviario':   { label: 'Ferroviário',    cls: 'badge-sector-ferroviario' },
};

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  news: [],
  counts: { pending: 0, published: 0, rejected: 0 },
  sectorCounts: {},
  currentPage: 1,
  totalPages: 1,
  total: 0,
  filterStatus: '',
  filterSector: '',
  searchQuery: '',
  loading: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const newsList = document.getElementById('newsList');
const emptyState = document.getElementById('emptyState');
const countPending = document.getElementById('countPending');
const countPublished = document.getElementById('countPublished');
const countRejected = document.getElementById('countRejected');
const lastRefresh = document.getElementById('lastRefresh');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const usernameDisplay = document.getElementById('usernameDisplay');
const filterTabs = document.querySelectorAll('.filter-tab');
const sectorTabs = document.querySelectorAll('.sector-tab');
const searchInput = document.getElementById('searchInput');
const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

const modal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const rejectReasonGroup = document.getElementById('rejectReasonGroup');
const rejectReason = document.getElementById('rejectReason');
const toast = document.getElementById('toast');

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const res = await fetch('/api/verify', { headers: authHeaders() });
    if (!res.ok) { sessionStorage.clear(); window.location.replace('/'); return; }
    const data = await res.json();
    usernameDisplay.textContent = data.username || 'admin';
  } catch {
    sessionStorage.clear();
    window.location.replace('/');
    return;
  }
  fetchNews();
})();

// Auto-refresh de 30 em 30 segundos
setInterval(fetchNews, 30000);

// ── Fetch news ────────────────────────────────────────────────────────────────
async function fetchNews() {
  if (state.loading) return;
  state.loading = true;
  refreshBtn.disabled = true;

  const params = new URLSearchParams({
    page: state.currentPage,
    limit: 20,
  });
  if (state.filterStatus) params.set('status', state.filterStatus);
  if (state.filterSector) params.set('sector', state.filterSector);
  if (state.searchQuery) params.set('search', state.searchQuery);

  try {
    const res = await fetch(`/api/news?${params}`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      sessionStorage.clear();
      window.location.replace('/');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.news = data.news;
    state.counts = data.counts;
    state.sectorCounts = data.sectorCounts || {};
    state.totalPages = data.totalPages;
    state.total = data.total;

    updateStats();
    updateSectorCounts();
    renderNews();
    updatePagination();
    lastRefresh.textContent = 'Atualizado ' + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error('Erro ao carregar notícias:', err);
    showToast('Erro ao carregar notícias', 'error');
  } finally {
    state.loading = false;
    refreshBtn.disabled = false;
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function updateStats() {
  countPending.textContent = state.counts.pending;
  countPublished.textContent = state.counts.published;
  countRejected.textContent = state.counts.rejected;
}

function updateSectorCounts() {
  Object.entries(state.sectorCounts).forEach(([key, count]) => {
    const el = document.getElementById(`countSector-${key}`);
    if (el) el.textContent = count;
  });
}

function renderNews() {
  // Remove cards existentes (mantém emptyState)
  [...newsList.querySelectorAll('.news-card')].forEach(el => el.remove());

  if (state.news.length === 0) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  state.news.forEach(item => {
    newsList.appendChild(createCard(item));
  });
}

function sectorBadge(category) {
  if (!category) return '';
  const sector = SECTOR_MAP[category.toLowerCase()];
  if (sector) return `<span class="badge ${sector.cls}">${sector.label}</span>`;
  return `<span class="badge badge-category">${escHtml(category)}</span>`;
}

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.dataset.id = item.id;
  if (item.imageUrl) card.classList.add('has-image');

  const isPending = item.status === 'pending';

  const publishedDate = formatDate(item.publishedAt);
  const receivedDate = formatDate(item.receivedAt);

  const actionsHtml = isPending
    ? `<button class="btn btn-success btn-publish" data-id="${escHtml(item.id)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Publicar
      </button>
      <button class="btn btn-danger btn-reject" data-id="${escHtml(item.id)}">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        Rejeitar
      </button>`
    : `<span class="badge badge-${escHtml(item.status)}">${item.status === 'published' ? 'Publicada' : 'Rejeitada'}</span>`;

  const processedInfo = !isPending && item.processedAt
    ? `<div class="news-processed-info">
        ${item.status === 'published' ? 'Publicada' : 'Rejeitada'} em ${formatDate(item.processedAt)}
        ${item.rejectReason ? `· Motivo: ${escHtml(item.rejectReason)}` : ''}
       </div>`
    : '';

  const imageHtml = item.imageUrl
    ? `<div class="news-card-image"><img src="${escHtml(item.imageUrl)}" alt="" loading="lazy"></div>`
    : '';

  card.innerHTML = `
    ${imageHtml}
    <div class="news-card-content">
      <div class="news-card-meta">
        <span class="badge badge-${escHtml(item.status)}">${statusLabel(item.status)}</span>
        ${sectorBadge(item.category)}
        ${item.source ? `<span class="news-meta-text">Fonte: ${escHtml(item.source)}</span>` : ''}
      </div>
      <h2 class="news-card-title">${escHtml(item.title)}</h2>
      <p class="news-card-body">${escHtml(item.content)}</p>
      <div class="news-card-footer">
        ${publishedDate ? `<span>Publicado em: ${publishedDate}</span>` : ''}
        <span>Recebido em: ${receivedDate}</span>
      </div>
      ${processedInfo}
    </div>
    <div class="news-card-actions">
      ${actionsHtml}
    </div>
  `;

  // Tratar erro de carregamento da imagem sem inline handlers (respeita CSP)
  if (item.imageUrl) {
    const img = card.querySelector('.news-card-image img');
    if (img) {
      img.addEventListener('error', () => {
        const imgDiv = card.querySelector('.news-card-image');
        if (imgDiv) imgDiv.style.display = 'none';
        card.classList.remove('has-image');
      });
    }
  }

  // Event listeners nos botões
  const publishBtn = card.querySelector('.btn-publish');
  const rejectBtn = card.querySelector('.btn-reject');
  if (publishBtn) publishBtn.addEventListener('click', () => openPublishModal(item));
  if (rejectBtn) rejectBtn.addEventListener('click', () => openRejectModal(item));

  return card;
}

function statusLabel(status) {
  return { pending: 'Pendente', published: 'Publicada', rejected: 'Rejeitada' }[status] || status;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Pagination ────────────────────────────────────────────────────────────────
function updatePagination() {
  if (state.totalPages <= 1) {
    pagination.style.display = 'none';
    return;
  }
  pagination.style.display = '';
  pageInfo.textContent = `Página ${state.currentPage} de ${state.totalPages} (${state.total} notícias)`;
  prevPageBtn.disabled = state.currentPage <= 1;
  nextPageBtn.disabled = state.currentPage >= state.totalPages;
}

prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 1) { state.currentPage--; fetchNews(); }
});
nextPageBtn.addEventListener('click', () => {
  if (state.currentPage < state.totalPages) { state.currentPage++; fetchNews(); }
});

// ── Filters ───────────────────────────────────────────────────────────────────
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.filterStatus = tab.dataset.status;
    state.currentPage = 1;
    fetchNews();
  });
});

sectorTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    sectorTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.filterSector = tab.dataset.sector;
    state.currentPage = 1;
    fetchNews();
  });
});

let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.searchQuery = searchInput.value.trim();
    state.currentPage = 1;
    fetchNews();
  }, 350);
});

// ── Actions ───────────────────────────────────────────────────────────────────
let pendingAction = null;

function openPublishModal(item) {
  modalTitle.textContent = 'Publicar notícia';
  modalMessage.textContent = `Tens a certeza que queres publicar "${item.title}"?`;
  rejectReasonGroup.style.display = 'none';
  rejectReason.value = '';
  modalConfirm.className = 'btn btn-success';
  modalConfirm.textContent = 'Publicar';
  pendingAction = { type: 'publish', item };
  modal.style.display = '';
  modalConfirm.focus();
}

function openRejectModal(item) {
  modalTitle.textContent = 'Rejeitar notícia';
  modalMessage.textContent = `Tens a certeza que queres rejeitar "${item.title}"?`;
  rejectReasonGroup.style.display = '';
  rejectReason.value = '';
  modalConfirm.className = 'btn btn-danger';
  modalConfirm.textContent = 'Rejeitar';
  pendingAction = { type: 'reject', item };
  modal.style.display = '';
  rejectReason.focus();
}

function closeModal() {
  modal.style.display = 'none';
  pendingAction = null;
  rejectReason.value = '';
}

modalCancel.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

modalConfirm.addEventListener('click', async () => {
  if (!pendingAction) return;
  const { type, item } = pendingAction;
  closeModal();
  await performAction(type, item);
});

async function performAction(type, item) {
  const endpoint = `/api/news/${encodeURIComponent(item.id)}/${type}`;
  const body = type === 'reject' ? { reason: rejectReason.value.trim() || null } : {};

  // Desabilita os botões do card imediatamente
  const card = newsList.querySelector(`[data-id="${item.id}"]`);
  if (card) {
    card.querySelectorAll('button').forEach(b => { b.disabled = true; });
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.clear();
      window.location.replace('/');
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro ao processar a ação', 'error');
      if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; });
      return;
    }

    const label = type === 'publish' ? 'publicada' : 'rejeitada';
    showToast(`Notícia ${label} com sucesso!`, 'success');
    fetchNews();

  } catch {
    showToast('Erro de ligação. Tenta novamente.', 'error');
    if (card) card.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}

// ── Refresh & Logout ──────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', fetchNews);

logoutBtn.addEventListener('click', () => {
  sessionStorage.clear();
  window.location.replace('/');
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.style.display = '';
  toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 4000);
}
