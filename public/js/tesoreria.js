/* ============================================================
   Tesorería — Dragones de Plata
   Datos guardados en localStorage. Sin servidor.
   ============================================================ */

const LS_KEY      = "dragones-tesoreria";
const LS_CATS_KEY = "dragones-tesoreria-cats";

const DEFAULT_CATEGORIES = {
  ingreso: ["Donación", "Territorio", "Mercado", "Penalización", "Otro"],
  gasto:   ["Equipamiento", "Fondo de guerra", "Territorio", "Evento", "Otro"],
};

// ── State ────────────────────────────────────────────────
let entries    = [];   // [{ id, type, category, amount, date, notes }]
let categories = {};   // { ingreso: [...], gasto: [...] }
let activeType = "ingreso";
let filterType = "";
let filterCategory = "";
let chart = null;

// ── Persistence ──────────────────────────────────────────
function saveEntries() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); } catch { /* cuota */ }
}

function saveCats() {
  try { localStorage.setItem(LS_CATS_KEY, JSON.stringify(categories)); } catch { /* cuota */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) entries = JSON.parse(raw);
  } catch { entries = []; }

  try {
    const rawCats = localStorage.getItem(LS_CATS_KEY);
    if (rawCats) {
      categories = JSON.parse(rawCats);
      // Ensure both keys exist
      if (!categories.ingreso) categories.ingreso = [...DEFAULT_CATEGORIES.ingreso];
      if (!categories.gasto)   categories.gasto   = [...DEFAULT_CATEGORIES.gasto];
    } else {
      categories = {
        ingreso: [...DEFAULT_CATEGORIES.ingreso],
        gasto:   [...DEFAULT_CATEGORIES.gasto],
      };
    }
  } catch {
    categories = {
      ingreso: [...DEFAULT_CATEGORIES.ingreso],
      gasto:   [...DEFAULT_CATEGORIES.gasto],
    };
  }
}

// ── DOM refs ─────────────────────────────────────────────
const statIngresos   = document.getElementById("stat-ingresos");
const statGastos     = document.getElementById("stat-gastos");
const statBalance    = document.getElementById("stat-balance");
const balanceCard    = document.getElementById("balance-card");
const chartEmpty     = document.getElementById("chart-empty");
const breakdownIngs  = document.getElementById("breakdown-ingresos");
const breakdownGsts  = document.getElementById("breakdown-gastos");

const fCategory    = document.getElementById("f-category");
const fAmount      = document.getElementById("f-amount");
const fDate        = document.getElementById("f-date");
const fNotes       = document.getElementById("f-notes");
const formError    = document.getElementById("form-error");
const entryForm    = document.getElementById("entry-form");

const catEditBtn   = document.getElementById("cat-edit-btn");
const catManager   = document.getElementById("cat-manager");
const catNewInput  = document.getElementById("cat-new-input");
const catAddBtn    = document.getElementById("cat-add-btn");
const catList      = document.getElementById("cat-list");

const filterTypeEl     = document.getElementById("filter-type");
const filterCategoryEl = document.getElementById("filter-category");
const clearFiltersBtn  = document.getElementById("clear-filters-btn");
const historyTbody     = document.getElementById("history-tbody");

const exportBtn   = document.getElementById("export-btn");
const importFile  = document.getElementById("import-file");

// ── Helpers ──────────────────────────────────────────────
function fmt(n) { return Number(n).toLocaleString("es-ES"); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Category select ──────────────────────────────────────
function populateCategorySelect(type) {
  const current = fCategory.value;
  fCategory.innerHTML = categories[type]
    .map((c) => `<option value="${escapeHtml(c)}" ${c === current ? "selected" : ""}>${escapeHtml(c)}</option>`)
    .join("");
}

// ── Category manager ─────────────────────────────────────
function renderCatManager() {
  catList.innerHTML = categories[activeType].map((c) => `
    <li class="cat-tag">
      <span>${escapeHtml(c)}</span>
      <button type="button" class="cat-tag__remove" data-cat="${escapeHtml(c)}" aria-label="Eliminar ${escapeHtml(c)}">✕</button>
    </li>
  `).join("");

  catList.querySelectorAll(".cat-tag__remove").forEach((btn) => {
    btn.addEventListener("click", () => removeCat(btn.dataset.cat));
  });
}

function addCat() {
  const val = catNewInput.value.trim();
  if (!val) return;
  if (categories[activeType].includes(val)) {
    catNewInput.value = "";
    return;
  }
  categories[activeType].push(val);
  saveCats();
  catNewInput.value = "";
  populateCategorySelect(activeType);
  renderCatManager();
  refreshCategoryFilterOptions();
}

function removeCat(cat) {
  categories[activeType] = categories[activeType].filter((c) => c !== cat);
  saveCats();
  populateCategorySelect(activeType);
  renderCatManager();
  refreshCategoryFilterOptions();
}

catEditBtn.addEventListener("click", () => {
  const open = !catManager.hidden;
  catManager.hidden = open;
  catEditBtn.classList.toggle("cat-edit-btn--active", !open);
  if (!open) {
    renderCatManager();
    catNewInput.focus();
  }
});

catAddBtn.addEventListener("click", addCat);

catNewInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addCat(); }
});

// ── Type toggle ──────────────────────────────────────────
document.querySelectorAll(".type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeType = btn.dataset.type;
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("type-btn--active"));
    btn.classList.add("type-btn--active");
    populateCategorySelect(activeType);
    if (!catManager.hidden) renderCatManager();
  });
});

// ── Form submit ──────────────────────────────────────────
entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  formError.textContent = "";

  const amount = parseFloat(fAmount.value);
  if (!fAmount.value || isNaN(amount) || amount <= 0) {
    formError.textContent = "Introduce una cantidad válida mayor que 0.";
    fAmount.focus();
    return;
  }

  entries.unshift({
    id:       uid(),
    type:     activeType,
    category: fCategory.value,
    amount,
    date:     fDate.value || todayISO(),
    notes:    fNotes.value.trim(),
  });

  saveEntries();
  refreshAll();

  fAmount.value = "";
  fNotes.value  = "";
  fAmount.focus();
});

// ── Delete entry ─────────────────────────────────────────
function deleteEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  refreshAll();
}

// ── Dashboard ────────────────────────────────────────────
function renderDashboard() {
  let totalIng = 0;
  let totalGst = 0;
  entries.forEach((e) => {
    if (e.type === "ingreso") totalIng += e.amount;
    else                      totalGst += e.amount;
  });

  const balance = totalIng - totalGst;
  statIngresos.textContent = fmt(totalIng);
  statGastos.textContent   = fmt(totalGst);
  statBalance.textContent  = fmt(Math.abs(balance));
  balanceCard.classList.toggle("balance--negative", balance < 0);

  renderBreakdown();
  renderChart();
}

function renderBreakdown() {
  renderBreakdownCol(breakdownIngs, "ingreso");
  renderBreakdownCol(breakdownGsts, "gasto");
}

function renderBreakdownCol(el, type) {
  const map = {};
  entries.filter((e) => e.type === type).forEach((e) => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    el.innerHTML = `<li class="breakdown-empty">Sin datos</li>`;
    return;
  }

  const cls = type === "ingreso" ? "breakdown-col--ingreso" : "breakdown-col--gasto";
  const max = sorted[0][1];
  el.innerHTML = sorted.map(([cat, amt]) => `
    <li class="breakdown-item ${cls}">
      <span class="breakdown-item__name">${escapeHtml(cat)}</span>
      <div class="breakdown-item__bar-wrap">
        <div class="breakdown-item__bar" style="width:${Math.round((amt / max) * 100)}%"></div>
      </div>
      <span class="breakdown-item__amount">${fmt(amt)}</span>
    </li>
  `).join("");
}

// ── Chart ────────────────────────────────────────────────
function renderChart() {
  const ctx = document.getElementById("balance-chart");
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  if (!sorted.length) {
    chartEmpty.classList.remove("chart-empty--hidden");
    if (chart) { chart.destroy(); chart = null; }
    return;
  }

  chartEmpty.classList.add("chart-empty--hidden");

  const pointMap = {};
  let running = 0;
  sorted.forEach((e) => {
    running += e.type === "ingreso" ? e.amount : -e.amount;
    pointMap[e.date] = running;
  });

  const labels = Object.keys(pointMap).map(formatDate);
  const data   = Object.values(pointMap);
  const gold   = "#c9a032";

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Balance",
        data,
        borderColor: gold,
        backgroundColor: "rgba(201,160,50,0.08)",
        borderWidth: 2,
        pointRadius: data.length <= 20 ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: gold,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181714",
          borderColor: "rgba(201,160,50,0.3)",
          borderWidth: 1,
          titleColor: "#9a8f7a",
          bodyColor: "#e8dfc8",
          callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.y)} plata` },
        },
      },
      scales: {
        x: {
          ticks: { color: "#7a6f5a", font: { size: 11 }, maxRotation: 0 },
          grid:  { color: "rgba(201,160,50,0.06)" },
        },
        y: {
          ticks: { color: "#7a6f5a", font: { size: 11 }, callback: (v) => fmt(v) },
          grid:  { color: "rgba(201,160,50,0.06)" },
        },
      },
    },
  });
}

// ── History table ────────────────────────────────────────
function renderHistory() {
  const visible = entries.filter((e) => {
    if (filterType     && e.type     !== filterType)     return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  });

  if (!visible.length) {
    historyTbody.innerHTML = `
      <tr class="history-empty-row">
        <td colspan="6">${entries.length ? "Ninguna entrada coincide con los filtros." : "Ninguna entrada todavía. Añade la primera arriba."}</td>
      </tr>`;
    return;
  }

  historyTbody.innerHTML = visible.map((e) => `
    <tr>
      <td>${escapeHtml(formatDate(e.date))}</td>
      <td><span class="type-badge type-badge--${e.type}">${e.type === "ingreso" ? "▲ Ingreso" : "▼ Gasto"}</span></td>
      <td>${escapeHtml(e.category)}</td>
      <td class="notes-cell" title="${escapeHtml(e.notes)}">${escapeHtml(e.notes || "—")}</td>
      <td class="amount-cell amount-cell--${e.type}">${e.type === "ingreso" ? "+" : "−"}${fmt(e.amount)}</td>
      <td>
        <button class="row-remove-btn" data-id="${escapeHtml(e.id)}" aria-label="Eliminar entrada">✕</button>
      </td>
    </tr>
  `).join("");

  historyTbody.querySelectorAll(".row-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
}

// ── Filter category options ──────────────────────────────
function refreshCategoryFilterOptions() {
  const used = [...new Set(entries.map((e) => e.category))].sort();
  const current = filterCategoryEl.value;
  filterCategoryEl.innerHTML = `<option value="">Todas las categorías</option>` +
    used.map((c) => `<option value="${escapeHtml(c)}" ${c === current ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
}

// ── Filters ──────────────────────────────────────────────
filterTypeEl.addEventListener("change", () => { filterType = filterTypeEl.value; renderHistory(); });
filterCategoryEl.addEventListener("change", () => { filterCategory = filterCategoryEl.value; renderHistory(); });
clearFiltersBtn.addEventListener("click", () => {
  filterType = ""; filterCategory = "";
  filterTypeEl.value = ""; filterCategoryEl.value = "";
  renderHistory();
});

// ── Refresh all ──────────────────────────────────────────
function refreshAll() {
  renderDashboard();
  refreshCategoryFilterOptions();
  renderHistory();
}

// ── Export ───────────────────────────────────────────────
exportBtn.addEventListener("click", () => {
  const data = JSON.stringify({ version: 1, categories, entries }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `tesoreria-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import ───────────────────────────────────────────────
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const imported = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
      if (!Array.isArray(imported)) throw new Error();

      // Merge categories if present
      if (parsed.categories) {
        if (Array.isArray(parsed.categories.ingreso)) {
          parsed.categories.ingreso.forEach((c) => {
            if (!categories.ingreso.includes(c)) categories.ingreso.push(c);
          });
        }
        if (Array.isArray(parsed.categories.gasto)) {
          parsed.categories.gasto.forEach((c) => {
            if (!categories.gasto.includes(c)) categories.gasto.push(c);
          });
        }
        saveCats();
      }

      // Merge entries without duplicates
      const existingIds = new Set(entries.map((e) => e.id));
      const newEntries  = imported.filter((e) => e.id && !existingIds.has(e.id));
      entries = [...newEntries, ...entries];
      saveEntries();

      populateCategorySelect(activeType);
      refreshAll();
      alert(`Importación completada. ${newEntries.length} entrada(s) nueva(s) añadida(s).`);
    } catch {
      alert("Error al leer el fichero. Asegúrate de que es un JSON de tesorería válido.");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
});

// ── Init ─────────────────────────────────────────────────
fDate.value = todayISO();
loadState();
populateCategorySelect(activeType);
refreshAll();
