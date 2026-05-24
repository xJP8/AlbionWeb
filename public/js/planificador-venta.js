/* ============================================================
   Planificador de Venta — Dragones de Plata
   ============================================================ */

const CITIES = [
  { id: "Caerleon",      label: "Caerleon",      cls: "city--caerleon"      },
  { id: "Bridgewatch",   label: "Bridgewatch",   cls: "city--bridgewatch"   },
  { id: "Martlock",      label: "Martlock",       cls: "city--martlock"      },
  { id: "Thetford",      label: "Thetford",       cls: "city--thetford"      },
  { id: "Fort Sterling", label: "Fort Sterling",  cls: "city--fortsterling"  },
  { id: "Lymhurst",      label: "Lymhurst",       cls: "city--lymhurst"      },
  { id: "Black Market",  label: "Mercado Negro",  cls: "city--blackmarket"   },
];

const DEFAULT_CITIES = new Set(["Bridgewatch", "Martlock", "Thetford", "Fort Sterling", "Lymhurst"]);
// ── State ────────────────────────────────────────────────
let itemList       = [];
let selectedCities = new Set(DEFAULT_CITIES);
let pendingItem    = null;
let searchTimer    = null;

// ── DOM refs ─────────────────────────────────────────────
const searchInput    = document.getElementById("item-search");
const searchDropdown = document.getElementById("search-dropdown");
const qtyInput       = document.getElementById("item-qty");
const qtyMinus       = document.getElementById("qty-minus");
const qtyPlus        = document.getElementById("qty-plus");
const addBtn         = document.getElementById("add-item-btn");
const itemListEl     = document.getElementById("item-list");
const citiesGrid     = document.getElementById("cities-grid");
const calcBtn        = document.getElementById("calc-btn");
const resultsEl      = document.getElementById("results");

// ── Helpers ──────────────────────────────────────────────
function itemImageUrl(id) {
  // Native format: T4_FIBER_LEVEL2@2 → T4_FIBER_LEVEL2@1.png
  const native = id.match(/^(.+_LEVEL\d)@\d$/);
  if (native) return `https://render.albiononline.com/v1/item/${native[1]}@1.png`;
  // Short format fallback: T4_FIBER@2 → T4_FIBER_LEVEL2@1.png
  const short = id.match(/^(.+)@(\d)$/);
  if (short) return `https://render.albiononline.com/v1/item/${short[1]}_LEVEL${short[2]}@1.png`;
  return `https://render.albiononline.com/v1/item/${id}.png`;
}

function enchantOverlayHtml(id) {
  const n = enchantNum(id);
  return n ? `<span class="enchant-overlay enchant-overlay--${n}">${n}</span>` : "";
}

function itemImgHtml(id, name, sizeClass) {
  return `
    <div class="item-img-wrap">
      <img class="item-img ${sizeClass}"
           src="${itemImageUrl(id)}"
           alt="${escapeAttr(name)}"
           loading="lazy"
           onerror="this.style.visibility='hidden'">
      ${enchantOverlayHtml(id)}
    </div>`;
}

function enchantNum(id) {
  const m = id.match(/@(\d)$/);
  return m ? m[1] : null;
}

function enchantBadgeHtml(id) {
  const n = enchantNum(id);
  return n
    ? `<span class="enchant-badge enchant-badge--${n}" title="Encantamiento ·${n}">·${n}</span>`
    : "";
}

function tierNum(id) {
  const m = id.match(/^T(\d)_/i);
  return m ? parseInt(m[1], 10) : null;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
function toRoman(n) { return ROMAN[n] || String(n); }

function itemMetaText(id) {
  const tier = tierNum(id);
  const enc  = enchantNum(id);
  const parts = [];
  if (tier) parts.push(`T${tier}`);
  if (enc)  parts.push(`Enc. ${enc}`);
  return parts.join(' · ');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(n) {
  return Number(n).toLocaleString("es-ES");
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  // AODP returns UTC timestamps without timezone suffix — force UTC parsing
  const utcStr = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return { text: "ahora",      cls: "age--fresh"  };
  if (mins < 60)  return { text: `${mins}m`,   cls: "age--fresh"  };
  if (hours < 24) return { text: `${hours}h`,  cls: "age--ok"     };
  return              { text: `${days}d`,       cls: "age--stale"  };
}

// ── City toggles ─────────────────────────────────────────
function initCities() {
  citiesGrid.innerHTML = CITIES.map((city) => `
    <label class="city-toggle ${city.cls} ${selectedCities.has(city.id) ? "city-toggle--active" : ""}">
      <input type="checkbox" value="${city.id}" ${selectedCities.has(city.id) ? "checked" : ""}>
      <span class="city-dot"></span>
      ${city.label}
    </label>
  `).join("");

  citiesGrid.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) selectedCities.add(cb.value);
      else selectedCities.delete(cb.value);
      cb.closest(".city-toggle").classList.toggle("city-toggle--active", cb.checked);
    });
  });
}

// ── Item search ──────────────────────────────────────────
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();

  if (q.length < 2) {
    hideDropdown();
    pendingItem = null;
    return;
  }

  showDropdownLoading();
  searchTimer = setTimeout(() => fetchSuggestions(q), 300);
});

searchInput.addEventListener("blur",    () => setTimeout(hideDropdown, 160));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { hideDropdown(); return; }
  if (e.key === "Enter") {
    const first = searchDropdown.querySelector(".dropdown-item");
    if (first) pickDropdownItem(first);
  }
});

async function fetchSuggestions(q) {
  try {
    const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error();
    renderDropdown(await res.json());
  } catch {
    hideDropdown();
  }
}

function showDropdownLoading() {
  searchDropdown.innerHTML = `<div class="dropdown-loading">Buscando…</div>`;
  searchDropdown.classList.add("search-dropdown--visible");
}

function renderDropdown(items) {
  if (!items.length) {
    searchDropdown.innerHTML = `<div class="dropdown-empty">Sin resultados</div>`;
  } else {
    searchDropdown.innerHTML = items.map((item) => `
      <div class="dropdown-item" data-id="${escapeAttr(item.id)}" data-name="${escapeAttr(item.name)}">
        ${itemImgHtml(item.id, "", "item-img--sm")}
        <div class="dropdown-item__text">
          <span class="dropdown-item__name">
            ${escapeHtml(item.name)}${enchantBadgeHtml(item.id)}
          </span>
          <span class="dropdown-item__id">${item.id}</span>
        </div>
      </div>
    `).join("");

    searchDropdown.querySelectorAll(".dropdown-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => { e.preventDefault(); pickDropdownItem(el); });
    });
  }
  searchDropdown.classList.add("search-dropdown--visible");
}

function pickDropdownItem(el) {
  pendingItem       = { id: el.dataset.id, name: el.dataset.name };
  searchInput.value = pendingItem.name + (enchantNum(pendingItem.id) ? ` ·${enchantNum(pendingItem.id)}` : "");
  hideDropdown();
  qtyInput.focus();
  qtyInput.select();
}

function hideDropdown() {
  searchDropdown.classList.remove("search-dropdown--visible");
}

// ── Qty stepper ──────────────────────────────────────────
qtyMinus.addEventListener("click", () => {
  const v = parseInt(qtyInput.value, 10) || 1;
  if (v > 1) qtyInput.value = v - 1;
});
qtyPlus.addEventListener("click", () => {
  const v = parseInt(qtyInput.value, 10) || 0;
  qtyInput.value = v + 1;
});

// ── Add item ─────────────────────────────────────────────
addBtn.addEventListener("click", addItem);
qtyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") addItem(); });

function addItem() {
  if (!pendingItem) { searchInput.focus(); return; }

  const qty = parseInt(qtyInput.value, 10);
  if (!qty || qty < 1) { qtyInput.focus(); return; }

  const existing = itemList.find((i) => i.id === pendingItem.id);
  if (existing) {
    existing.qty += qty;
  } else {
    itemList.push({ id: pendingItem.id, name: pendingItem.name, qty });
  }

  // Mantener el item seleccionado — solo resetear cantidad y enfocarla
  qtyInput.value = 1;
  qtyInput.focus();
  qtyInput.select();
  renderItemList();
}

// ── Item list ────────────────────────────────────────────
function renderItemList() {
  if (!itemList.length) {
    itemListEl.innerHTML = `<p class="item-list__empty">Ningún item añadido todavía.</p>`;
    return;
  }

  itemListEl.innerHTML = `
    <ul class="item-cards">
      ${itemList.map((item, i) => {
        const tier   = tierNum(item.id);
        const enc    = enchantNum(item.id);
        const encCls = enc ? `enchant-border--${enc}` : '';
        const meta   = itemMetaText(item.id);
        return `
        <li class="item-card">
          <div class="item-card__icon-wrap ${encCls}">
            <img class="item-card__img"
                 src="${itemImageUrl(item.id)}"
                 alt="${escapeAttr(item.name)}"
                 loading="lazy"
                 onerror="this.style.visibility='hidden'">
            ${tier ? `<span class="item-card__tier-badge">${toRoman(tier)}</span>` : ''}
          </div>
          <div class="item-card__body">
            <span class="item-card__name">${escapeHtml(item.name)}</span>
            ${meta ? `<span class="item-card__sub">${meta}</span>` : ''}
          </div>
          <div class="item-card__qty-wrap">
            <input type="number" class="item-card__qty-input"
                   value="${item.qty}" min="1" data-index="${i}">
          </div>
          <button class="item-card__remove" data-index="${i}"
                  aria-label="Eliminar ${escapeAttr(item.name)}">✕</button>
        </li>`;
      }).join('')}
    </ul>
  `;

  itemListEl.querySelectorAll('.item-card__remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      itemList.splice(Number(btn.dataset.index), 1);
      renderItemList();
    });
  });

  itemListEl.querySelectorAll('.item-card__qty-input').forEach((input) => {
    input.addEventListener('change', () => {
      const val = parseInt(input.value, 10);
      if (val > 0) itemList[Number(input.dataset.index)].qty = val;
    });
  });
}

// ── Calculate plan ───────────────────────────────────────
calcBtn.addEventListener("click", calculatePlan);

async function calculatePlan() {
  if (!itemList.length) {
    showResultsError("Añade al menos un item a la lista.");
    return;
  }
  if (selectedCities.size === 0) {
    showResultsError("Selecciona al menos una ciudad.");
    return;
  }

  calcBtn.disabled    = true;
  calcBtn.textContent = "Consultando…";
  resultsEl.innerHTML = `<div class="results__loading">Obteniendo datos del mercado…</div>`;

  try {
    const itemIds = itemList.map((i) => i.id).join(",");
    const cities  = [...selectedCities].join(",");
    const server  = "west";

    const res = await fetch(
      `/api/market/prices?items=${encodeURIComponent(itemIds)}&cities=${encodeURIComponent(cities)}&server=${server}`
    );
    if (!res.ok) throw new Error("HTTP " + res.status);

    renderResults(await res.json());
  } catch {
    showResultsError("Error al obtener precios. Inténtalo de nuevo.");
  } finally {
    calcBtn.disabled    = false;
    calcBtn.textContent = "▶ Calcular plan";
  }
}

// ── Render results ───────────────────────────────────────
function renderResults(priceData) {
  const priceMap = {};
  const sorted = [...priceData].sort((a, b) => a.quality - b.quality);
  sorted.forEach((entry) => {
    if (!priceMap[entry.item_id]) priceMap[entry.item_id] = {};
    const price = entry.sell_price_min ?? 0;
    if (!priceMap[entry.item_id][entry.city] && price > 0) {
      priceMap[entry.item_id][entry.city] = { price, date: entry.sell_price_min_date ?? null };
    }
  });

  let grandTotal = 0;
  const rows = itemList.map((item) => {
    const byCity  = priceMap[item.id] ?? {};
    let bestCity  = null;
    let bestPrice = 0;
    let bestDate  = null;
    for (const city of selectedCities) {
      const entry = byCity[city];
      const p = entry?.price ?? 0;
      if (p > bestPrice) { bestPrice = p; bestCity = city; bestDate = entry?.date ?? null; }
    }
    const rowTotal = bestPrice > 0 ? bestPrice * item.qty : 0;
    grandTotal += rowTotal;
    return { item, bestCity, bestPrice, bestDate, rowTotal };
  });

  const cityLabel = (id) => CITIES.find((c) => c.id === id)?.label ?? id;
  const cityCls   = (id) => CITIES.find((c) => c.id === id)?.cls   ?? "";
  const now       = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  // Agrupar filas por ciudad
  const groups = {};
  const ungrouped = [];
  rows.forEach((row) => {
    if (row.bestCity) {
      if (!groups[row.bestCity]) groups[row.bestCity] = { subtotal: 0, rows: [] };
      groups[row.bestCity].rows.push(row);
      groups[row.bestCity].subtotal += row.rowTotal;
    } else {
      ungrouped.push(row);
    }
  });

  const itemRowHtml = (row) => {
    const age = timeAgo(row.bestDate);
    return `
    <tr>
      <td>
        <div class="table-item-cell">
          ${itemImgHtml(row.item.id, row.item.name, "item-img--sm")}
          <div>
            <span class="table-item-name">${escapeHtml(row.item.name)}${enchantBadgeHtml(row.item.id)}</span>
            <span class="table-item-id">${row.item.id}</span>
          </div>
        </div>
      </td>
      <td class="text-center">${fmt(row.item.qty)}</td>
      <td class="text-center"><span class="price">${fmt(row.bestPrice)}</span></td>
      <td class="text-center"><span class="price">${fmt(row.rowTotal)}</span></td>
      <td class="text-center">${age ? `<span class="price-age ${age.cls}">${age.text}</span>` : `<span class="no-data">—</span>`}</td>
    </tr>`;
  };

  const groupHtml = ([cityId, { rows: groupRows, subtotal }]) => `
    <div class="city-group">
      <div class="city-group__header ${cityCls(cityId)}">
        <div class="city-group__title">
          <span class="city-dot"></span>
          ${cityLabel(cityId)}
        </div>
        <span class="city-group__subtotal">${fmt(subtotal)} <span class="price-unit">plata</span></span>
      </div>
      <table class="results__table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-center">Cantidad</th>
            <th class="text-center">Precio / ud.</th>
            <th class="text-center">Total</th>
            <th class="text-center">Actualizado</th>
          </tr>
        </thead>
        <tbody>${groupRows.map(itemRowHtml).join("")}</tbody>
      </table>
    </div>`;

  resultsEl.innerHTML = `
    <div class="results__table-wrap">
      <div class="results__header">
        <h2 class="results__title">Plan de venta</h2>
        <span class="results__meta">Actualizado ${now} · Servidor Europa</span>
      </div>

      ${Object.entries(groups).map(groupHtml).join("")}

      ${ungrouped.length > 0 ? `
        <div class="city-group city-group--nodata">
          <div class="city-group__header">
            <div class="city-group__title">Sin órdenes de venta</div>
          </div>
          <table class="results__table">
            <thead><tr><th>Item</th><th class="text-center">Cantidad</th><th class="text-center">Precio / ud.</th><th class="text-center">Total</th><th class="text-center">Actualizado</th></tr></thead>
            <tbody>${ungrouped.map(itemRowHtml).join("")}</tbody>
          </table>
        </div>` : ""}

      <div class="results__grand-total">
        <span class="results__grand-label">Total estimado</span>
        <div>
          <span class="price price--total">${fmt(grandTotal)}</span>
          <span class="price-unit"> plata</span>
        </div>
      </div>

      <p class="results__disclaimer">
        Precios mínimos de venta según
        <a href="https://www.albion-online-data.com" target="_blank" rel="noopener"
           style="color:var(--color-accent)">Albion Online Data Project</a>.
        Pueden no reflejar el mercado en tiempo real.
      </p>
    </div>
  `;
}

// ── Utils ────────────────────────────────────────────────
function showResultsError(msg) {
  resultsEl.innerHTML = `<div class="results__error">${msg}</div>`;
}

// ── Init ─────────────────────────────────────────────────
initCities();
renderItemList();
