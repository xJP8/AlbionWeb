/* ============================================================
   BINGO — Dragones de Plata
   ============================================================ */

const BINGO_COLS = ['B', 'I', 'N', 'G', 'O'];
const COL_RANGES = { B: [1,15], I: [16,30], N: [31,45], G: [46,60], O: [61,75] };

let adminPassword = null;
let pollTimer = null;
let selectedCards = new Set();

/* ── Utilidades ─────────────────────────────────────────── */
function colForNumber(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

/* ── API ─────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

/* ── Tabs ────────────────────────────────────────────────── */
document.querySelectorAll('.bingo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.bingo-tab').forEach(t => t.classList.remove('bingo-tab--active'));
    document.querySelectorAll('.bingo-panel').forEach(p => p.classList.remove('bingo-panel--active'));
    tab.classList.add('bingo-tab--active');
    document.getElementById(tab.dataset.panel).classList.add('bingo-panel--active');
    if (tab.dataset.panel === 'panel-user') startUserPoll();
    else stopUserPoll();
  });
});

/* ══════════════════════════════════════════════════════════
   PANEL ADMIN
══════════════════════════════════════════════════════════ */
const lockForm       = document.getElementById('lock-form');
const lockInput      = document.getElementById('lock-input');
const lockError      = document.getElementById('lock-error');
const adminDashboard = document.getElementById('admin-dashboard');
const lockSection    = document.getElementById('admin-lock');

lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = lockInput.value.trim();
  try {
    await apiFetch('/api/bingo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', password: pass })
    });
    adminPassword = pass;
    lockSection.style.display = 'none';
    adminDashboard.classList.add('admin-dashboard--visible');
    loadAdminState();
  } catch {
    lockError.textContent = 'Contraseña incorrecta.';
    lockInput.value = '';
  }
});

lockInput.addEventListener('input', () => { lockError.textContent = ''; });

/* ── Generar cartones ────────────────────────────────────── */
document.getElementById('btn-generate').addEventListener('click', async () => {
  const count = parseInt(document.getElementById('cards-count').value, 10);
  if (!confirm(`¿Generar ${count} cartones nuevos? Esto borrará el estado actual.`)) return;
  try {
    await apiFetch('/api/bingo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', password: adminPassword, count })
    });
    loadAdminState();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

/* ── Cargar estado admin ─────────────────────────────────── */
async function loadAdminState() {
  try {
    const state = await apiFetch('/api/bingo');
    renderAdminCalled(state.calledNumbers);
    renderNumberBoard(state.calledNumbers);
    renderAdminCards(state.cards, state.calledNumbers);
  } catch (err) {
    console.error(err);
  }
}

/* ── Tablero de números ──────────────────────────────────── */
function renderNumberBoard(called) {
  const calledSet = new Set(called);
  const container = document.getElementById('number-board-cols');
  container.innerHTML = '';

  BINGO_COLS.forEach(col => {
    const [min, max] = COL_RANGES[col];
    const colDiv = document.createElement('div');
    colDiv.className = 'nb-column';

    const label = document.createElement('div');
    label.className = 'nb-column__label';
    label.textContent = col;
    colDiv.appendChild(label);

    const nums = document.createElement('div');
    nums.className = 'nb-column__nums';

    for (let n = min; n <= max; n++) {
      const btn = document.createElement('button');
      btn.className = 'nb-btn' + (calledSet.has(n) ? ' nb-btn--called' : '');
      btn.textContent = n;
      btn.title = calledSet.has(n) ? 'Click para desmarcar' : 'Click para marcar';
      btn.addEventListener('click', () => toggleNumber(n));
      nums.appendChild(btn);
    }

    colDiv.appendChild(nums);
    container.appendChild(colDiv);
  });
}

async function toggleNumber(n) {
  try {
    await apiFetch('/api/bingo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', password: adminPassword, number: n })
    });
    loadAdminState();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

/* ── Números llamados (chips) ────────────────────────────── */
function renderAdminCalled(called) {
  const grid = document.getElementById('called-chips');
  const count = document.getElementById('called-count');
  count.textContent = `${called.length} / 75`;
  grid.innerHTML = '';
  [...called].sort((a, b) => a - b).forEach(n => {
    const chip = document.createElement('div');
    chip.className = 'called-chip';
    chip.textContent = n;
    chip.title = 'Click para desmarcar';
    chip.addEventListener('click', () => toggleNumber(n));
    grid.appendChild(chip);
  });
  if (called.length === 0) {
    grid.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.85rem;">Ningún número llamado todavía.</span>';
  }
}

/* ── Cartones (admin) ────────────────────────────────────── */
function renderAdminCards(cards, called) {
  const container = document.getElementById('admin-cards-grid');
  if (!cards || cards.length === 0) {
    container.innerHTML = '<div class="bingo-empty"><div class="bingo-empty__icon">🎲</div><p>No hay cartones generados. Pulsa "Generar cartones" para empezar.</p></div>';
    return;
  }
  container.innerHTML = '';
  cards.forEach((card, i) => {
    container.appendChild(buildCard(card, called, i + 1));
  });
}

/* ── Construir cartón DOM ────────────────────────────────── */
function buildCard(card, calledNums, num) {
  const calledSet = new Set(calledNums);
  const el = document.createElement('div');

  const hasBingo = checkBingo(card, calledSet);
  el.className = 'bingo-card' + (hasBingo ? ' bingo-card--winner' : '');

  el.innerHTML = `
    <div class="bingo-card__header">
      <span class="bingo-card__num">Cartón #${num}</span>
      <span class="bingo-card__bingo-badge">¡BINGO!</span>
    </div>
    <div class="bingo-card__grid">
      <div class="bingo-card__col-headers">
        ${BINGO_COLS.map(c => `<div class="bingo-card__col-label">${c}</div>`).join('')}
      </div>
      ${[0,1,2,3,4].map(row => `
        <div class="bingo-card__row">
          ${BINGO_COLS.map((col, ci) => {
            const val = card[ci][row];
            const isFree = val === 'FREE';
            const isHit = isFree || calledSet.has(val);
            let cls = 'bingo-cell';
            if (isFree) cls += ' bingo-cell--free';
            else if (isHit) cls += ' bingo-cell--hit';
            return `<div class="${cls}">${isFree ? 'FREE' : val}</div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `;
  return el;
}

/* ── Detectar BINGO ──────────────────────────────────────── */
function checkBingo(card, calledSet) {
  const hit = (ci, ri) => {
    const v = card[ci][ri];
    return v === 'FREE' || calledSet.has(v);
  };

  // Filas
  for (let r = 0; r < 5; r++) {
    if ([0,1,2,3,4].every(c => hit(c, r))) return true;
  }
  // Columnas
  for (let c = 0; c < 5; c++) {
    if ([0,1,2,3,4].every(r => hit(c, r))) return true;
  }
  // Diagonales
  if ([0,1,2,3,4].every(i => hit(i, i))) return true;
  if ([0,1,2,3,4].every(i => hit(i, 4 - i))) return true;

  return false;
}

/* ══════════════════════════════════════════════════════════
   PANEL USER
══════════════════════════════════════════════════════════ */
async function loadUserState() {
  try {
    const state = await apiFetch('/api/bingo');
    renderLastCalled(state.calledNumbers);
    renderUserCards(state.cards, state.calledNumbers);
    renderUserSelector(state.cards.length);
  } catch (err) {
    console.error(err);
  }
}

function renderLastCalled(called) {
  const el = document.getElementById('last-called-wrap');
  if (called.length === 0) {
    el.innerHTML = '<div class="last-called"><div class="last-called__label">Último número</div><div class="last-called__number" style="color:var(--color-text-muted)">—</div></div>';
    return;
  }
  const last = called[called.length - 1];
  const col = colForNumber(last);
  el.innerHTML = `
    <div class="last-called">
      <div>
        <div class="last-called__label">Último número</div>
        <div class="last-called__number">${last}</div>
        <div class="last-called__column">${col}</div>
      </div>
      <div class="last-called__total">${called.length} número${called.length !== 1 ? 's' : ''} llamado${called.length !== 1 ? 's' : ''}</div>
    </div>
  `;
}

function renderUserSelector(total) {
  const container = document.getElementById('user-card-btns');
  container.innerHTML = '';
  if (total === 0) return;
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'user-card-btn' + (selectedCards.has(i) ? ' user-card-btn--active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => {
      if (selectedCards.has(i)) selectedCards.delete(i);
      else selectedCards.add(i);
      btn.classList.toggle('user-card-btn--active');
      renderVisibleUserCards();
    });
    container.appendChild(btn);
  }
}

let _lastCards = [];
let _lastCalled = [];

function renderUserCards(cards, called) {
  _lastCards = cards;
  _lastCalled = called;
  renderVisibleUserCards();
}

function renderVisibleUserCards() {
  const container = document.getElementById('user-cards-grid');
  if (!_lastCards || _lastCards.length === 0) {
    container.innerHTML = '<div class="bingo-empty"><div class="bingo-empty__icon">🎱</div><p>El administrador aún no ha generado cartones.</p></div>';
    return;
  }

  const toShow = selectedCards.size === 0
    ? _lastCards.map((_, i) => i)
    : [...selectedCards].map(n => n - 1).filter(i => i >= 0 && i < _lastCards.length);

  if (toShow.length === 0) {
    container.innerHTML = '<div class="bingo-empty"><p>Selecciona al menos un cartón arriba.</p></div>';
    return;
  }

  container.innerHTML = '';
  toShow.forEach(i => {
    container.appendChild(buildCard(_lastCards[i], _lastCalled, i + 1));
  });
}

function startUserPoll() {
  loadUserState();
  stopUserPoll();
  pollTimer = setInterval(loadUserState, 4000);
}

function stopUserPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ── Init: arrancar en panel user ────────────────────────── */
startUserPoll();
