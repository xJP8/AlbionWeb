import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

const GUILD_ID = "Bq7m4jXMSXOnuMqoajFqmA";

app.use(cors());
app.use(express.static(join(__dirname, "../public"), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
}));

// 🔥 Endpoints proxy

app.get("/api/guild", async (req, res) => {
  try {
    const response = await fetch(
      `https://gameinfo-ams.albiononline.com/api/gameinfo/guilds/${GUILD_ID}`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error guild" });
  }
});

app.get("/api/guild/data", async (req, res) => {
  try {
    const response = await fetch(
      `https://gameinfo-ams.albiononline.com/api/gameinfo/guilds/${GUILD_ID}/data`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error data" });
  }
});

app.get("/api/guild/members", async (req, res) => {
  try {
    const response = await fetch(
      `https://gameinfo-ams.albiononline.com/api/gameinfo/guilds/${GUILD_ID}/members`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error members" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const raw = await readFile(join(__dirname, "../data/news.json"), "utf-8");
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: "Error reading news" });
  }
});

// ── Bingo ────────────────────────────────────────────────
const BINGO_PASS = "dragones2026";
const BINGO_FILE = join(__dirname, "../data/bingo.json");

const MOUNTS = [
  'T4_MOUNT_HORSE', 'T6_MOUNT_HORSE', 'T8_MOUNT_HORSE',
  'T5_MOUNT_ARMORED_HORSE', 'T7_MOUNT_ARMORED_HORSE', 'T8_MOUNT_ARMORED_HORSE',
  'T2_MOUNT_MULE',
  'T6_MOUNT_DIREWOLF',
  'T5_MOUNT_GREYWOLF_FW_CAERLEON', 'T8_MOUNT_GREYWOLF_FW_CAERLEON_ELITE',
  'T7_MOUNT_DIREBOAR',
  'T5_MOUNT_DIREBOAR_FW_LYMHURST', 'T8_MOUNT_DIREBOAR_FW_LYMHURST_ELITE',
  'UNIQUE_MOUNT_UNDEAD_DIREBOAR_ADC',
  'T7_MOUNT_SWAMPDRAGON',
  'T5_MOUNT_SWAMPDRAGON_FW_THETFORD', 'T8_MOUNT_SWAMPDRAGON_FW_THETFORD_ELITE',
  'T7_MOUNT_ARMORED_SWAMPDRAGON_BATTLE',
  'T7_MOUNT_SWAMPDRAGON_AVALON_BASILISK',
  'T5_MOUNT_MOABIRD_FW_BRIDGEWATCH', 'T8_MOUNT_MOABIRD_FW_BRIDGEWATCH_ELITE',
  'UNIQUE_MOUNT_MOABIRD_TELLAFRIEND',
  'T4_MOUNT_GIANTSTAG', 'T6_MOUNT_GIANTSTAG_MOOSE',
  'UNIQUE_MOUNT_GIANTSTAG_FOUNDER_EPIC',
  'T8_MOUNT_DIREBEAR',
  'T5_MOUNT_DIREBEAR_FW_FORTSTERLING', 'T8_MOUNT_DIREBEAR_FW_FORTSTERLING_ELITE',
  'UNIQUE_MOUNT_BEAR_KEEPER_ADC',
  'T5_MOUNT_RAM_FW_MARTLOCK', 'T8_MOUNT_RAM_FW_MARTLOCK_ELITE',
  'UNIQUE_MOUNT_RAM_TELLAFRIEND', 'T6_MOUNT_FROSTRAM_ADC',
  'T7_MOUNT_TERRORBIRD_ADC',
  'UNIQUE_MOUNT_BEETLE_CRYSTAL', 'UNIQUE_MOUNT_BEETLE_GOLD', 'UNIQUE_MOUNT_BEETLE_SILVER',
  'UNIQUE_MOUNT_BAT_PERSONAL',
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateCard() {
  const picks = shuffle([...MOUNTS]).slice(0, 24);
  const card = [];
  let idx = 0;
  for (let c = 0; c < 5; c++) {
    const col = [];
    for (let r = 0; r < 5; r++) {
      col.push(c === 2 && r === 2 ? 'FREE' : picks[idx++]);
    }
    card.push(col);
  }
  return card;
}

async function readBingo() {
  try {
    const raw = await readFile(BINGO_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { cards: [], calledNumbers: [] };
  }
}

async function writeBingo(data) {
  await writeFile(BINGO_FILE, JSON.stringify(data, null, 2), "utf-8");
}

app.get("/api/bingo", async (req, res) => {
  try {
    res.json(await readBingo());
  } catch (err) {
    res.status(500).json({ error: "Error reading bingo" });
  }
});

app.post("/api/bingo", express.json(), async (req, res) => {
  const { action, password, count, number } = req.body || {};
  if (password !== BINGO_PASS) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (action === "verify") return res.json({ ok: true });

    const state = await readBingo();

    if (action === "reset") {
      const n = Math.min(Math.max(parseInt(count) || 10, 1), 100);
      state.cards = Array.from({ length: n }, generateCard);
      state.calledNumbers = [];
      await writeBingo(state);
      return res.json(state);
    }

    if (action === "toggle") {
      const n = parseInt(number);
      if (!n || n < 1 || n > 75) return res.status(400).json({ error: "Invalid number" });
      const idx = state.calledNumbers.indexOf(n);
      if (idx === -1) state.calledNumbers.push(n);
      else state.calledNumbers.splice(idx, 1);
      await writeBingo(state);
      return res.json(state);
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: "Bingo error" });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const raw = await readFile(join(__dirname, "../data/events.json"), "utf-8");
    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: "Error reading events" });
  }
});

// ── Items catalog cache ──────────────────────────────────
let itemsCache = null;
let itemIdSet   = null;
let itemsCachePromise = null;

function loadItems() {
  if (itemsCache !== null) return Promise.resolve(itemsCache);
  if (itemsCachePromise) return itemsCachePromise;

  itemsCachePromise = fetch(
    "https://raw.githubusercontent.com/broderickhyman/ao-bin-dumps/master/formatted/items.json"
  )
    .then((r) => r.json())
    .then((data) => {
      // Full ID set (including enchanted variants) for existence checks
      itemIdSet = new Set(data.map((i) => i.UniqueName));

      itemsCache = data.filter(
        (item) =>
          item.LocalizedNames &&
          (item.LocalizedNames["ES-ES"] || item.LocalizedNames["EN-US"])
      );
      console.log(`📦 Items loaded: ${itemsCache.length}`);
      return itemsCache;
    })
    .catch((err) => {
      console.error("Failed to load items cache:", err.message);
      itemsCache = [];
      itemIdSet  = new Set();
      itemsCachePromise = null;
      return [];
    });

  return itemsCachePromise;
}

// Warm up the cache on startup
loadItems();

app.get("/api/items/search", async (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (q.length < 2) return res.json([]);

  try {
    const items = await loadItems();

    // Solo items base (sin @N) que coincidan con la búsqueda, ordenados por relevancia
    const baseMatches = items
      .filter((item) => !item.UniqueName.includes("@"))
      .reduce((acc, item) => {
        const name = (
          item.LocalizedNames["ES-ES"] ||
          item.LocalizedNames["EN-US"] ||
          ""
        ).toLowerCase();
        const uid = item.UniqueName.toLowerCase();
        if (name === q || uid === q)              acc.push({ item, score: 0 }); // exacto
        else if (name.startsWith(q))              acc.push({ item, score: 1 }); // empieza por
        else if (uid.startsWith(q))               acc.push({ item, score: 2 });
        else if (name.includes(q))                acc.push({ item, score: 3 }); // contiene
        else if (uid.includes(q))                 acc.push({ item, score: 4 });
        return acc;
      }, [])
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map(({ item }) => item);

    // Por cada item base, añadir solo las variantes encantadas que existen en el catálogo
    const results = [];
    for (const item of baseMatches) {
      const name =
        item.LocalizedNames["ES-ES"] ||
        item.LocalizedNames["EN-US"] ||
        item.UniqueName;
      results.push({ id: item.UniqueName, name });
      for (let e = 1; e <= 4; e++) {
        const nativeId = `${item.UniqueName}_LEVEL${e}@${e}`;
        if (itemIdSet && itemIdSet.has(nativeId)) {
          results.push({ id: nativeId, name });
        }
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Error searching items" });
  }
});

app.get("/api/market/prices", async (req, res) => {
  const { items, cities } = req.query;
  if (!items || !cities)
    return res.status(400).json({ error: "Missing params: items, cities" });

  try {
    // Cities may contain spaces (e.g. "Fort Sterling") — encode them but keep commas
    const encodedCities = cities
      .split(",")
      .map((c) => encodeURIComponent(c.trim()))
      .join(",");

    const base =
      req.query.server === "east"   ? "https://east.albion-online-data.com/api/v2/stats/prices"
    : req.query.server === "west"   ? "https://www.albion-online-data.com/api/v2/stats/prices"
    :                                 "https://europe.albion-online-data.com/api/v2/stats/prices";

    const url = `${base}/${items}?locations=${encodedCities}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`AODP ${response.status}`);
    const data = await response.json();
    res.set("Cache-Control", "no-store");
    res.json(data);
  } catch (err) {
    console.error("Market prices error:", err.message);
    res.status(500).json({ error: "Error fetching market prices" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});