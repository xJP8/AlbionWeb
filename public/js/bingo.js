/* ============================================================
   BINGO — Dragones de Plata
   ============================================================ */

const RENDER = id => `https://render.albiononline.com/v1/item/${id}.png`;

const MOUNTS = [
  // Caballos
  { id: 'T2_MOUNT_MULE',                           name: 'Mula T2' },
  { id: 'T3_MOUNT_HORSE',                          name: 'Caballo T3' },
  { id: 'T4_MOUNT_HORSE',                          name: 'Caballo T4' },
  { id: 'T5_MOUNT_HORSE',                          name: 'Caballo T5' },
  { id: 'T6_MOUNT_HORSE',                          name: 'Caballo T6' },
  { id: 'T7_MOUNT_HORSE',                          name: 'Caballo T7' },
  { id: 'T8_MOUNT_HORSE',                          name: 'Caballo T8' },
  { id: 'T5_MOUNT_ARMORED_HORSE',                  name: 'C. Blindado T5' },
  { id: 'T6_MOUNT_ARMORED_HORSE',                  name: 'C. Blindado T6' },
  { id: 'T7_MOUNT_ARMORED_HORSE',                  name: 'C. Blindado T7' },
  { id: 'T8_MOUNT_ARMORED_HORSE',                  name: 'C. Blindado T8' },
  { id: 'T5_MOUNT_ARMORED_HORSE_SKIN_01',          name: 'C. Guerra T5' },
  { id: 'T6_MOUNT_ARMORED_HORSE_SKIN_01',          name: 'C. Guerra T6' },
  { id: 'T7_MOUNT_ARMORED_HORSE_SKIN_01',          name: 'C. Guerra T7' },
  { id: 'T8_MOUNT_ARMORED_HORSE_SKIN_01',          name: 'C. Guerra T8' },
  { id: 'T8_MOUNT_HORSE_UNDEAD@1',                 name: 'C. Huesudo T8' },
  { id: 'T8_MOUNT_ARMORED_HORSE_MORGANA@1',        name: 'Pesadilla Morgana' },
  { id: 'UNIQUE_MOUNT_GIANT_HORSE_ADC',            name: 'C. Gallardo' },
  // Bueyes
  { id: 'T3_MOUNT_OX',                             name: 'Buey T3' },
  { id: 'T4_MOUNT_OX',                             name: 'Buey T4' },
  { id: 'T5_MOUNT_OX',                             name: 'Buey T5' },
  { id: 'T6_MOUNT_OX',                             name: 'Buey T6' },
  { id: 'T7_MOUNT_OX',                             name: 'Buey T7' },
  { id: 'T8_MOUNT_OX',                             name: 'Buey T8' },
  { id: 'UNIQUE_MOUNT_HERETIC_MULE_ADC',           name: 'Mula Hereje' },
  // Ciervos
  { id: 'T4_MOUNT_GIANTSTAG',                      name: 'Ciervo T4' },
  { id: 'T6_MOUNT_GIANTSTAG_MOOSE',                name: 'Alce T6' },
  // Lobos / Huargos
  { id: 'T6_MOUNT_DIREWOLF',                       name: 'Huargo T6' },
  { id: 'T5_MOUNT_GREYWOLF_FW_CAERLEON',           name: 'Lobo Gris T5' },
  { id: 'T8_MOUNT_GREYWOLF_FW_CAERLEON_ELITE',     name: 'Lobo Gris T8' },
  { id: 'T7_MOUNT_HUSKY_ADC',                      name: 'Husky T7' },
  // Jabalíes
  { id: 'T7_MOUNT_DIREBOAR',                       name: 'Jabalí T7' },
  { id: 'T5_MOUNT_DIREBOAR_FW_LYMHURST',           name: 'Jabalí T5' },
  { id: 'T8_MOUNT_DIREBOAR_FW_LYMHURST_ELITE',     name: 'Jabalí T8' },
  // Osos
  { id: 'T8_MOUNT_DIREBEAR',                       name: 'Oso Gigante T8' },
  { id: 'T5_MOUNT_DIREBEAR_FW_FORTSTERLING',       name: 'Oso Invierno T5' },
  { id: 'T8_MOUNT_DIREBEAR_FW_FORTSTERLING_ELITE', name: 'Oso Invierno T8' },
  { id: 'UNIQUE_MOUNT_BEAR_KEEPER_ADC',            name: 'Oso Grizzly' },
  // Carneros
  { id: 'T5_MOUNT_RAM_FW_MARTLOCK',                name: 'Carnero T5' },
  { id: 'T8_MOUNT_RAM_FW_MARTLOCK_ELITE',          name: 'Carnero T8' },
  { id: 'T6_MOUNT_FROSTRAM_ADC',                   name: 'Carnero Hielo' },
  { id: 'UNIQUE_MOUNT_RAM_TELLAFRIEND',            name: 'Carnero T3' },
  { id: 'UNIQUE_MOUNT_RAM_XMAS',                   name: 'Ariete Yule' },
  // Dragones / Salamandras / Basiliscos
  { id: 'T7_MOUNT_SWAMPDRAGON',                    name: 'Dragón T7' },
  { id: 'T5_MOUNT_SWAMPDRAGON_FW_THETFORD',        name: 'Salamandra T5' },
  { id: 'T8_MOUNT_SWAMPDRAGON_FW_THETFORD_ELITE',  name: 'Salamandra T8' },
  { id: 'T7_MOUNT_ARMORED_SWAMPDRAGON_BATTLE',     name: 'Basilisco Venenoso' },
  { id: 'T7_MOUNT_SWAMPDRAGON_AVALON_BASILISK',    name: 'Basilisco Avalon' },
  { id: 'T7_MOUNT_SWAMPDRAGON_BATTLE',             name: 'Basilisco Fuego' },
  // Aves
  { id: 'T5_MOUNT_MOABIRD_FW_BRIDGEWATCH',         name: 'Ave Moa T5' },
  { id: 'T8_MOUNT_MOABIRD_FW_BRIDGEWATCH_ELITE',   name: 'Ave Terror T8' },
  { id: 'UNIQUE_MOUNT_MOABIRD_TELLAFRIEND',        name: 'Ave Moa T6' },
  { id: 'T7_MOUNT_TERRORBIRD_ADC',                 name: 'Ave Terror T7' },
  { id: 'T5_MOUNT_OWL_FW_BRECILIEN',               name: 'Búho T5' },
  { id: 'T8_MOUNT_OWL_FW_BRECILIEN_ELITE',         name: 'Búho T8' },
  { id: 'UNIQUE_MOUNT_DIVINE_OWL_ADC',             name: 'Búho Divino' },
  // Mamuts
  { id: 'T8_MOUNT_MAMMOTH_BATTLE@1',               name: 'Mamut Comando' },
  { id: 'T8_MOUNT_MAMMOTH_TRANSPORT',              name: 'Mamut Transporte' },
  // Garra / Puma
  { id: 'T5_MOUNT_COUGAR_KEEPER@1',                name: 'Garrapresta T5' },
  { id: 'T8_MOUNT_COUGAR_KEEPER@1',                name: 'Garrafuria T8' },
  // Varios T7
  { id: 'T7_MOUNT_MONITORLIZARD_ADC',              name: 'Lagartija Plaga' },
  { id: 'T6_MOUNT_SIEGE_BALLISTA',                 name: 'Balista T6' },
  // Conejitos
  { id: 'T8_MOUNT_RABBIT_EASTER',                  name: 'Conejo T8' },
  { id: 'T8_MOUNT_RABBIT_EASTER_DARK@1',           name: 'Conejo Caerleon' },
  // UNIQUE — Murciélagos
  { id: 'UNIQUE_MOUNT_BAT_PERSONAL',               name: 'Murciélago T7' },
  { id: 'UNIQUE_MOUNT_BAT_TELLAFRIEND',            name: 'Murciélago T3' },
  // UNIQUE — Escarabajos
  { id: 'UNIQUE_MOUNT_BEETLE_CRYSTAL',             name: 'Escarabajo T8' },
  { id: 'UNIQUE_MOUNT_BEETLE_GOLD',                name: 'Escarabajo T7' },
  { id: 'UNIQUE_MOUNT_BEETLE_SILVER',              name: 'Escarabajo T6' },
  { id: 'UNIQUE_MOUNT_TANKBEETLE_CRYSTAL',         name: 'Falange T8' },
  { id: 'UNIQUE_MOUNT_TANKBEETLE_GOLD',            name: 'Falange T7' },
  { id: 'UNIQUE_MOUNT_TANKBEETLE_SILVER',          name: 'Falange T6' },
  // UNIQUE — Behemoths
  { id: 'UNIQUE_MOUNT_BEHEMOTH_CRYSTAL',           name: 'Behemoth T8' },
  { id: 'UNIQUE_MOUNT_BEHEMOTH_GOLD',              name: 'Behemoth T7' },
  { id: 'UNIQUE_MOUNT_BEHEMOTH_SILVER',            name: 'Behemoth T6' },
  // UNIQUE — Pantera
  { id: 'UNIQUE_MOUNT_BLACK_PANTHER_ADC',          name: 'Pantera Negra' },
  // UNIQUE — Águilas
  { id: 'UNIQUE_MOUNT_ARMORED_EAGLE_CRYSTAL',      name: 'Águila T8' },
  { id: 'UNIQUE_MOUNT_ARMORED_EAGLE_GOLD',         name: 'Águila T7' },
  { id: 'UNIQUE_MOUNT_ARMORED_EAGLE_SILVER',       name: 'Águila T6' },
  // UNIQUE — Bastiones
  { id: 'UNIQUE_MOUNT_BASTION_CRYSTAL',            name: 'Bastión T8' },
  { id: 'UNIQUE_MOUNT_BASTION_GOLD',               name: 'Bastión T7' },
  { id: 'UNIQUE_MOUNT_BASTION_SILVER',             name: 'Bastión T6' },
  // UNIQUE — Arañas
  { id: 'UNIQUE_MOUNT_BATTLESPIDER_CRYSTAL',       name: 'Góliath T8' },
  { id: 'UNIQUE_MOUNT_BATTLESPIDER_GOLD',          name: 'Góliath T7' },
  { id: 'UNIQUE_MOUNT_BATTLESPIDER_SILVER',        name: 'Góliath T6' },
  // UNIQUE — Ents
  { id: 'UNIQUE_MOUNT_ENT_CRYSTAL',                name: 'Ent T8' },
  { id: 'UNIQUE_MOUNT_ENT_GOLD',                   name: 'Ent T7' },
  { id: 'UNIQUE_MOUNT_ENT_SILVER',                 name: 'Ent T6' },
  // UNIQUE — Sapos
  { id: 'UNIQUE_MOUNT_GIANTTOAD_TELLAFRIEND',      name: 'Sapo T3' },
  { id: 'UNIQUE_MOUNT_GIANTTOAD_02_TELLAFRIEND',   name: 'Sapo Gigante T3' },
  // UNIQUE — Juggernaut
  { id: 'UNIQUE_MOUNT_JUGGERNAUT_CRYSTAL',         name: 'Juggernaut T8' },
  { id: 'UNIQUE_MOUNT_JUGGERNAUT_GOLD',            name: 'Juggernaut T7' },
  { id: 'UNIQUE_MOUNT_JUGGERNAUT_SILVER',          name: 'Juggernaut T6' },
  // UNIQUE — Varios
  { id: 'UNIQUE_MOUNT_MORGANA_RAVEN_ADC',          name: 'Cuervo Morgana' },
  { id: 'UNIQUE_MOUNT_RHINO_SEASON_BRONZE',        name: 'Rinoceronte T5' },
  { id: 'UNIQUE_MOUNT_RHINO_SEASON_SILVER',        name: 'Rinoceronte T6' },
  { id: 'UNIQUE_MOUNT_RHINO_SEASON_GOLD',          name: 'Rinoceronte T7' },
  { id: 'UNIQUE_MOUNT_RHINO_SEASON_CRYSTAL',       name: 'Rinoceronte T8' },
  { id: 'UNIQUE_MOUNT_TOWER_CHARIOT_CRYSTAL',      name: 'Torre Móvil T8' },
];

const MOUNT_MAP = Object.fromEntries(MOUNTS.map(m => [m.id, m]));

let adminPassword = null;
let pollTimer = null;
let selectedCards = new Set();
let _lastCards = [];
let _lastCalled = [];

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
  const raw = document.getElementById('cards-count').value.trim();
  const count = parseInt(raw, 10);
  if (!count || count < 1) { alert('Introduce un número válido de cartones (mínimo 1).'); return; }
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
    renderMountBoard(state.calledNumbers);
    renderAdminCards(state.cards, state.calledNumbers);
  } catch (err) {
    console.error(err);
  }
}

/* ── Tablero de monturas (admin) ─────────────────────────── */
function renderMountBoard(called) {
  const calledSet = new Set(called);
  const container = document.getElementById('number-board-cols');
  container.innerHTML = '';
  MOUNTS.forEach(mount => {
    const item = document.createElement('div');
    item.className = 'mount-item' + (calledSet.has(mount.id) ? ' mount-item--called' : '');
    item.title = mount.name + (calledSet.has(mount.id) ? ' — click para desmarcar' : ' — click para marcar');
    item.innerHTML = `
      <img src="${RENDER(mount.id)}" alt="${mount.name}" loading="lazy">
      <span class="mount-item__name">${mount.name}</span>
    `;
    item.addEventListener('click', () => toggleMount(mount.id));
    container.appendChild(item);
  });
}

async function toggleMount(id) {
  try {
    await apiFetch('/api/bingo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', password: adminPassword, number: id })
    });
    loadAdminState();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

/* ── Monturas llamadas (chips) ───────────────────────────── */
function renderAdminCalled(called) {
  const grid = document.getElementById('called-chips');
  const count = document.getElementById('called-count');
  count.textContent = `${called.length} / ${MOUNTS.length}`;
  grid.innerHTML = '';
  if (called.length === 0) {
    grid.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.85rem;">Ninguna montura llamada todavía.</span>';
    return;
  }
  called.forEach(id => {
    const mount = MOUNT_MAP[id] || { name: id };
    const chip = document.createElement('div');
    chip.className = 'called-chip';
    chip.title = mount.name + ' — click para desmarcar';
    chip.innerHTML = `<img src="${RENDER(id)}" alt="${mount.name}">`;
    chip.addEventListener('click', () => toggleMount(id));
    grid.appendChild(chip);
  });
}

/* ── Cartones (admin) ────────────────────────────────────── */
function renderAdminCards(cards, called) {
  const container = document.getElementById('admin-cards-grid');
  if (!cards || cards.length === 0) {
    container.innerHTML = '<div class="bingo-empty"><div class="bingo-empty__icon">🎲</div><p>No hay cartones generados. Pulsa "Generar cartones" para empezar.</p></div>';
    return;
  }
  container.innerHTML = '';
  const calledSet = new Set(called);
  cards.forEach((card, i) => container.appendChild(buildCard(card, calledSet, i + 1)));
}

/* ── Construir cartón DOM ────────────────────────────────── */
function buildCard(card, calledSet, num) {
  const el = document.createElement('div');
  const hasBingo = checkBingo(card, calledSet);
  el.className = 'bingo-card' + (hasBingo ? ' bingo-card--winner' : '');

  const rows = [0, 1, 2, 3, 4].map(row =>
    `<div class="bingo-card__row">${[0, 1, 2, 3, 4].map(ci => {
      const val = card[ci][row];
      const isFree = val === 'FREE';
      const isHit = isFree || calledSet.has(val);
      const cls = 'bingo-cell' + (isFree ? ' bingo-cell--free' : isHit ? ' bingo-cell--hit' : '');
      if (isFree) return `<div class="${cls}"><span>FREE</span></div>`;
      const name = (MOUNT_MAP[val] || { name: val }).name;
      return `<div class="${cls}" title="${name}"><img src="${RENDER(val)}" alt="${name}" loading="lazy">${isHit ? '<div class="bingo-cell__mark">✓</div>' : ''}</div>`;
    }).join('')}</div>`
  ).join('');

  el.innerHTML = `
    <div class="bingo-card__header">
      <span class="bingo-card__num">Cartón #${num}</span>
      <span class="bingo-card__bingo-badge">¡BINGO!</span>
    </div>
    <div class="bingo-card__grid">${rows}</div>
  `;
  return el;
}

/* ── Detectar BINGO ──────────────────────────────────────── */
function checkBingo(card, calledSet) {
  const hit = (ci, ri) => { const v = card[ci][ri]; return v === 'FREE' || calledSet.has(v); };
  for (let r = 0; r < 5; r++) if ([0,1,2,3,4].every(c => hit(c, r))) return true;
  for (let c = 0; c < 5; c++) if ([0,1,2,3,4].every(r => hit(c, r))) return true;
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
    el.innerHTML = '<div class="last-called"><div><div class="last-called__label">Última montura</div><div class="last-called__number" style="color:var(--color-text-muted)">—</div></div></div>';
    return;
  }
  const last = called[called.length - 1];
  const mount = MOUNT_MAP[last] || { name: last };
  el.innerHTML = `
    <div class="last-called">
      <img src="${RENDER(last)}" alt="${mount.name}" class="last-called__img">
      <div>
        <div class="last-called__label">Última montura llamada</div>
        <div class="last-called__mount-name">${mount.name}</div>
      </div>
      <div class="last-called__total">${called.length} llamada${called.length !== 1 ? 's' : ''}</div>
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
  const calledSet = new Set(_lastCalled);
  container.innerHTML = '';
  toShow.forEach(i => container.appendChild(buildCard(_lastCards[i], calledSet, i + 1)));
}

function startUserPoll() {
  loadUserState();
  stopUserPoll();
  pollTimer = setInterval(loadUserState, 4000);
}

function stopUserPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ── Init ─────────────────────────────────────────────────── */
startUserPoll();
