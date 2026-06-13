/* ============================================================
   Calculadora de Craft — Dragones de Plata
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
const LS_KEY = "dragones-craft";

// ── State ────────────────────────────────────────────────
let craftItem      = null;   // { id, name }
let matList        = [];     // [{ id, name, qty }]
let selectedCities = new Set(DEFAULT_CITIES);
let pendingCraft   = null;
let pendingMat     = null;
let craftTimer     = null;
let matTimer       = null;

// ── Persistence ──────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      craftItem, matList, cities: [...selectedCities],
    }));
  } catch { /* cuota */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const { craftItem: ci, matList: ml, cities } = JSON.parse(raw);
    if (ci)               { craftItem = ci; renderCraftBadge(); }
    if (Array.isArray(ml)) matList = ml;
    if (Array.isArray(cities)) selectedCities = new Set(cities);
  } catch { /* datos corruptos */ }
}

// ── DOM refs ─────────────────────────────────────────────
const craftSearch    = document.getElementById("craft-search");
const craftDropdown  = document.getElementById("craft-dropdown");
const craftQty       = document.getElementById("craft-qty");
const craftQtyMinus  = document.getElementById("craft-qty-minus");
const craftQtyPlus   = document.getElementById("craft-qty-plus");
const returnRateEl   = document.getElementById("return-rate");
const craftBadge     = document.getElementById("craft-item-selected");

const matSearch      = document.getElementById("mat-search");
const matDropdown    = document.getElementById("mat-dropdown");
const matQty         = document.getElementById("mat-qty");
const matQtyMinus    = document.getElementById("mat-qty-minus");
const matQtyPlus     = document.getElementById("mat-qty-plus");
const matAddBtn      = document.getElementById("mat-add-btn");
const matListEl      = document.getElementById("mat-list");

const citiesGrid     = document.getElementById("cities-grid");
const calcBtn        = document.getElementById("calc-btn");
const resultsEl      = document.getElementById("results");

// ── Helpers ──────────────────────────────────────────────
function fmt(n)      { return Number(n).toLocaleString("es-ES"); }
function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function itemImageUrl(id) {
  const native = id.match(/^(.+_LEVEL\d)@\d$/);
  if (native) return `https://render.albiononline.com/v1/item/${native[1]}@1.png`;
  const short = id.match(/^(.+)@(\d)$/);
  if (short) return `https://render.albiononline.com/v1/item/${short[1]}_LEVEL${short[2]}@1.png`;
  return `https://render.albiononline.com/v1/item/${id}.png`;
}

function enchantNum(id)  { const m = id.match(/@(\d)$/); return m ? m[1] : null; }
function tierNum(id)     { const m = id.match(/^T(\d)_/i); return m ? parseInt(m[1], 10) : null; }

const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII'];
function toRoman(n) { return ROMAN[n] || String(n); }

function itemMetaText(id) {
  const parts = [];
  const t = tierNum(id);   if (t) parts.push(`T${t}`);
  const e = enchantNum(id); if (e) parts.push(`Enc. ${e}`);
  return parts.join(' · ');
}

function enchantBadgeHtml(id) {
  const n = enchantNum(id);
  return n ? `<span class="enchant-badge enchant-badge--${n}" title="Encantamiento ·${n}">·${n}</span>` : "";
}

function itemImgHtml(id, name) {
  const t = tierNum(id);
  return `
    <div class="item-img-wrap">
      <img class="item-img item-img--sm" src="${itemImageUrl(id)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.style.visibility='hidden'">
    </div>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const utcStr = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1)  return { text: "ahora",    cls: "age--fresh" };
  if (mins  < 60)  return { text: `${mins}m`, cls: "age--fresh" };
  if (hours <  6)  return { text: `${hours}h`,cls: "age--ok"    };
  if (hours < 24)  return { text: `${hours}h`,cls: "age--warn"  };
  return               { text: `${days}d`,  cls: "age--stale" };
}

// ── Generic search ───────────────────────────────────────
function makeSearch({ inputEl, dropdownEl, timerRef, onPick }) {
  let timer = null;

  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    const q = inputEl.value.trim();
    if (q.length < 2) { hideDropdown(dropdownEl); return; }
    dropdownEl.innerHTML = `<div class="dropdown-loading">Buscando…</div>`;
    dropdownEl.classList.add("search-dropdown--visible");
    timer = setTimeout(() => fetchSuggestions(q, dropdownEl, onPick), 300);
  });

  inputEl.addEventListener("blur", () => setTimeout(() => hideDropdown(dropdownEl), 160));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideDropdown(dropdownEl);
    if (e.key === "Enter") {
      const first = dropdownEl.querySelector(".dropdown-item");
      if (first) pickItem(first, inputEl, dropdownEl, onPick);
    }
  });
}

async function fetchSuggestions(q, dropdownEl, onPick) {
  try {
    const res = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`);
    const items = await res.json();
    renderDropdown(items, dropdownEl, onPick);
  } catch { hideDropdown(dropdownEl); }
}

function renderDropdown(items, dropdownEl, onPick) {
  if (!items.length) {
    dropdownEl.innerHTML = `<div class="dropdown-empty">Sin resultados</div>`;
  } else {
    dropdownEl.innerHTML = items.map((item) => `
      <div class="dropdown-item" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">
        ${itemImgHtml(item.id, item.name)}
        <div class="dropdown-item__text">
          <span class="dropdown-item__name">${escapeHtml(item.name)}${enchantBadgeHtml(item.id)}</span>
          <span class="dropdown-item__id">${item.id}</span>
        </div>
      </div>
    `).join("");
    dropdownEl.querySelectorAll(".dropdown-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => { e.preventDefault(); onPick({ id: el.dataset.id, name: el.dataset.name }); hideDropdown(dropdownEl); });
    });
  }
  dropdownEl.classList.add("search-dropdown--visible");
}

function pickItem(el, inputEl, dropdownEl, onPick) {
  onPick({ id: el.dataset.id, name: el.dataset.name });
  hideDropdown(dropdownEl);
}

function hideDropdown(el) { el.classList.remove("search-dropdown--visible"); }

// ── Craft item search ────────────────────────────────────
makeSearch({
  inputEl: craftSearch,
  dropdownEl: craftDropdown,
  onPick: (item) => {
    craftItem = item;
    craftSearch.value = item.name + (enchantNum(item.id) ? ` ·${enchantNum(item.id)}` : "");
    renderCraftBadge();
    saveState();
  },
});

function renderCraftBadge() {
  if (!craftItem) { craftBadge.hidden = true; return; }
  const t = tierNum(craftItem.id);
  craftBadge.hidden = false;
  craftBadge.innerHTML = `
    <div class="item-img-wrap">
      <img class="item-img item-img--sm" src="${itemImageUrl(craftItem.id)}" alt="${escapeHtml(craftItem.name)}" onerror="this.style.visibility='hidden'">
    </div>
    <span class="craft-item-badge__name">${escapeHtml(craftItem.name)}${enchantBadgeHtml(craftItem.id)}</span>
    ${t ? `<span style="font-size:0.75rem;color:var(--color-text-muted)">T${t}</span>` : ""}
    <button class="craft-item-badge__clear" id="craft-clear-btn" aria-label="Quitar item">✕</button>
  `;
  document.getElementById("craft-clear-btn").addEventListener("click", () => {
    craftItem = null;
    craftSearch.value = "";
    craftBadge.hidden = true;
    saveState();
  });
}

// ── Craft qty stepper ────────────────────────────────────
craftQtyMinus.addEventListener("click", () => {
  const v = parseInt(craftQty.value, 10) || 1;
  if (v > 1) craftQty.value = v - 1;
});
craftQtyPlus.addEventListener("click", () => {
  craftQty.value = (parseInt(craftQty.value, 10) || 0) + 1;
});

// ── Material search ──────────────────────────────────────
makeSearch({
  inputEl: matSearch,
  dropdownEl: matDropdown,
  onPick: (item) => {
    pendingMat = item;
    matSearch.value = item.name + (enchantNum(item.id) ? ` ·${enchantNum(item.id)}` : "");
    matQty.focus();
    matQty.select();
  },
});

matQtyMinus.addEventListener("click", () => {
  const v = parseInt(matQty.value, 10) || 1;
  if (v > 1) matQty.value = v - 1;
});
matQtyPlus.addEventListener("click", () => {
  matQty.value = (parseInt(matQty.value, 10) || 0) + 1;
});

matAddBtn.addEventListener("click", addMaterial);
matQty.addEventListener("keydown", (e) => { if (e.key === "Enter") addMaterial(); });

function addMaterial() {
  if (!pendingMat) { matSearch.focus(); return; }
  const qty = parseInt(matQty.value, 10);
  if (!qty || qty < 1) { matQty.focus(); return; }

  const existing = matList.find((m) => m.id === pendingMat.id);
  if (existing) {
    existing.qty += qty;
  } else {
    matList.push({ id: pendingMat.id, name: pendingMat.name, qty });
  }

  matQty.value = 1;
  matQty.focus();
  matQty.select();
  renderMatList();
}

function renderMatList() {
  if (!matList.length) {
    matListEl.innerHTML = `<p class="mat-list__empty">Ningún material añadido todavía.</p>`;
    saveState();
    return;
  }

  matListEl.innerHTML = `
    <ul class="mat-cards">
      ${matList.map((mat, i) => {
        const t   = tierNum(mat.id);
        const meta = itemMetaText(mat.id);
        return `
        <li class="mat-card">
          <div class="mat-card__icon-wrap">
            <img class="mat-card__img" src="${itemImageUrl(mat.id)}" alt="${escapeHtml(mat.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
            ${t ? `<span class="mat-card__tier-badge">${toRoman(t)}</span>` : ""}
          </div>
          <div class="mat-card__body">
            <span class="mat-card__name">${escapeHtml(mat.name)}${enchantBadgeHtml(mat.id)}</span>
            ${meta ? `<span class="mat-card__sub">${meta}</span>` : ""}
          </div>
          <input type="number" class="mat-card__qty-input" value="${mat.qty}" min="1" data-index="${i}">
          <button class="mat-card__remove" data-index="${i}" aria-label="Eliminar">✕</button>
        </li>`;
      }).join("")}
    </ul>
  `;

  matListEl.querySelectorAll(".mat-card__remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      matList.splice(Number(btn.dataset.index), 1);
      renderMatList();
    });
  });

  matListEl.querySelectorAll(".mat-card__qty-input").forEach((input) => {
    input.addEventListener("change", () => {
      const val = parseInt(input.value, 10);
      if (val > 0) { matList[Number(input.dataset.index)].qty = val; saveState(); }
    });
  });

  saveState();
}

// ── Cities ───────────────────────────────────────────────
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
      saveState();
    });
  });
}

// ── Calculate ────────────────────────────────────────────
calcBtn.addEventListener("click", calculate);

async function calculate() {
  if (!craftItem)       { showError("Selecciona el item que quieres craftear."); return; }
  if (!matList.length)  { showError("Añade al menos un material."); return; }
  if (!selectedCities.size) { showError("Selecciona al menos una ciudad."); return; }

  calcBtn.disabled    = true;
  calcBtn.textContent = "Consultando…";
  resultsEl.innerHTML = `<div class="results__loading">Obteniendo datos del mercado…</div>`;

  try {
    const allIds  = [craftItem.id, ...matList.map((m) => m.id)].join(",");
    const cities  = [...selectedCities].join(",");

    const res = await fetch(
      `/api/market/prices?items=${encodeURIComponent(allIds)}&cities=${encodeURIComponent(cities)}&server=europe`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    renderResults(await res.json());
  } catch {
    showError("Error al obtener precios. Inténtalo de nuevo.");
  } finally {
    calcBtn.disabled    = false;
    calcBtn.textContent = "▶ Calcular";
  }
}

// ── Render results ───────────────────────────────────────
function renderResults(priceData) {
  // Build price map: { itemId: { cityId: { price, date } } }
  const priceMap = {};
  const sorted = [...priceData].sort((a, b) => a.quality - b.quality);
  sorted.forEach((entry) => {
    if (!priceMap[entry.item_id]) priceMap[entry.item_id] = {};
    const p = entry.sell_price_min ?? 0;
    if (!priceMap[entry.item_id][entry.city] && p > 0) {
      priceMap[entry.item_id][entry.city] = { price: p, date: entry.sell_price_min_date ?? null };
    }
  });

  const returnRate  = Math.max(0, Math.min(100, parseFloat(returnRateEl.value) || 0));
  const craftQtyVal = Math.max(1, parseInt(craftQty.value, 10) || 1);
  const cityLabel   = (id) => CITIES.find((c) => c.id === id)?.label ?? id;
  const cityCls     = (id) => CITIES.find((c) => c.id === id)?.cls   ?? "";
  const now         = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  // ── Materials: find cheapest BUY city for each ───────────
  let totalCost = 0;
  const matRows = matList.map((mat) => {
    const byCity = priceMap[mat.id] ?? {};
    let cheapCity  = null;
    let cheapPrice = Infinity;
    let cheapDate  = null;

    for (const city of selectedCities) {
      const entry = byCity[city];
      const p = entry?.price ?? 0;
      if (p > 0 && p < cheapPrice) { cheapPrice = p; cheapCity = city; cheapDate = entry?.date ?? null; }
    }

    const effectiveQty = mat.qty * craftQtyVal;
    const netCost = cheapPrice < Infinity
      ? Math.round(cheapPrice * effectiveQty * (1 - returnRate / 100))
      : 0;

    totalCost += netCost;
    return { mat, effectiveQty, cheapCity, cheapPrice: cheapPrice < Infinity ? cheapPrice : 0, cheapDate, netCost };
  });

  // ── Crafted item: find best SELL city ────────────────────
  const sellByCity = priceMap[craftItem.id] ?? {};
  let bestSellCity  = null;
  let bestSellPrice = 0;
  let bestSellDate  = null;
  for (const city of selectedCities) {
    const entry = sellByCity[city];
    const p = entry?.price ?? 0;
    if (p > bestSellPrice) { bestSellPrice = p; bestSellCity = city; bestSellDate = entry?.date ?? null; }
  }

  const grossIncome = bestSellPrice > 0 ? bestSellPrice * craftQtyVal : 0;
  const profit      = grossIncome - totalCost;
  const margin      = grossIncome > 0 ? ((profit / grossIncome) * 100).toFixed(1) : null;

  // ── HTML ─────────────────────────────────────────────────
  const matRowsHtml = matRows.map((row) => {
    const age  = timeAgo(row.cheapDate);
    const meta = itemMetaText(row.mat.id);
    const t    = tierNum(row.mat.id);
    return `
      <tr>
        <td>
          <div class="table-item-cell">
            <div class="table-item-img-wrap">
              <img class="item-img item-img--sm" src="${itemImageUrl(row.mat.id)}" alt="${escapeHtml(row.mat.name)}" loading="lazy" onerror="this.style.visibility='hidden'">
              ${t ? `<span class="table-tier-badge">${toRoman(t)}</span>` : ""}
            </div>
            <div>
              <span class="table-item-name">${escapeHtml(row.mat.name)}${enchantBadgeHtml(row.mat.id)}</span>
              ${meta ? `<span class="table-item-meta">${meta}</span>` : ""}
            </div>
          </div>
        </td>
        <td class="text-right">${fmt(row.effectiveQty)}</td>
        <td>
          ${row.cheapCity
            ? `<div class="city-badge-inline ${cityCls(row.cheapCity)}"><span class="city-dot"></span>${cityLabel(row.cheapCity)}</div>`
            : `<span class="no-data">Sin datos</span>`}
        </td>
        <td class="text-right">
          ${row.cheapPrice ? `<span class="price">${fmt(row.cheapPrice)}</span>` : `<span class="no-data">—</span>`}
        </td>
        <td class="text-right">
          ${row.netCost ? `<span class="price">${fmt(row.netCost)}</span>` : `<span class="no-data">—</span>`}
        </td>
        <td class="text-right">
          ${age ? `<span class="price-age ${age.cls}">${age.text}</span>` : `<span class="no-data">—</span>`}
        </td>
      </tr>`;
  }).join("");

  const sellAge = timeAgo(bestSellDate);
  const sellHtml = bestSellCity
    ? `<div class="city-badge-inline ${cityCls(bestSellCity)}"><span class="city-dot"></span>${cityLabel(bestSellCity)}</div>
       <span class="sell-row__arrow">→</span>
       <span class="price">${fmt(bestSellPrice)}</span> <span class="price-unit">plata/ud</span>
       <span style="color:var(--color-text-muted);font-size:0.82rem">× ${craftQtyVal} =</span>
       <span class="price">${fmt(grossIncome)}</span> <span class="price-unit">plata</span>
       ${sellAge ? `<span class="price-age ${sellAge.cls}" style="margin-left:auto">${sellAge.text}</span>` : ""}`
    : `<span class="sell-row__nodata">Sin datos de venta para las ciudades seleccionadas.</span>`;

  const summaryHtml = `
    <div class="summary-box">
      <div class="summary-cell summary-cell--cost">
        <span class="summary-cell__label">Coste materiales</span>
        <span class="summary-cell__value">${totalCost ? fmt(totalCost) : "—"}</span>
        <span class="summary-cell__unit">plata</span>
      </div>
      <div class="summary-cell summary-cell--income">
        <span class="summary-cell__label">Ingresos venta</span>
        <span class="summary-cell__value">${grossIncome ? fmt(grossIncome) : "—"}</span>
        <span class="summary-cell__unit">plata</span>
      </div>
      <div class="summary-cell summary-cell--profit ${profit < 0 ? "is-loss" : ""}">
        <span class="summary-cell__label">Beneficio bruto</span>
        <span class="summary-cell__value">${(totalCost && grossIncome) ? (profit >= 0 ? "+" : "") + fmt(profit) : "—"}</span>
        <span class="summary-cell__unit">plata</span>
      </div>
      <div class="summary-cell summary-cell--margin">
        <span class="summary-cell__label">Margen</span>
        <span class="summary-cell__value">${margin !== null ? margin + "%" : "—"}</span>
        <span class="summary-cell__unit">${returnRate > 0 ? `retorno ${returnRate}%` : "sin retorno"}</span>
      </div>
    </div>`;

  resultsEl.innerHTML = `
    <div class="results__header">
      <span class="results__title">Resultado del craft</span>
      <div style="display:flex;align-items:center;gap:0.6rem">
        <span class="results__meta">Actualizado ${now} · Servidor Europa</span>
        <button class="btn-refresh" id="refresh-btn" title="Actualizar precios">↻</button>
      </div>
    </div>

    <div class="results__block">
      <div class="results__block-title">Materiales — dónde comprar más barato</div>
      <div style="overflow-x:auto">
        <table class="results__table">
          <thead>
            <tr>
              <th>Material</th>
              <th class="text-right">Cantidad</th>
              <th>Comprar en</th>
              <th class="text-right">Precio/ud.</th>
              <th class="text-right">Subtotal</th>
              <th class="text-right">Actualizado</th>
            </tr>
          </thead>
          <tbody>${matRowsHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="results__block">
      <div class="results__block-title">Venta — mejor ciudad para vender</div>
      <div class="sell-row">${sellHtml}</div>
    </div>

    <div class="results__block">
      <div class="results__block-title">Resumen</div>
      ${summaryHtml}
    </div>

    <p class="results__disclaimer">
      Precios mínimos de venta según
      <a href="https://www.albion-online-data.com" target="_blank" rel="noopener" style="color:var(--color-accent)">Albion Online Data Project</a>.
      Pueden no reflejar el mercado en tiempo real. El beneficio no incluye impuestos de uso.
    </p>
  `;

  resultsEl.querySelector("#refresh-btn").addEventListener("click", () => {
    const btn = resultsEl.querySelector("#refresh-btn");
    btn.classList.add("btn-refresh--spinning");
    btn.addEventListener("animationend", () => btn.classList.remove("btn-refresh--spinning"), { once: true });
    calculate();
  });
}

function showError(msg) {
  resultsEl.innerHTML = `<div class="results__error">${escapeHtml(msg)}</div>`;
}

// ── Init ─────────────────────────────────────────────────
loadState();
initCities();
renderCraftBadge();
renderMatList();
