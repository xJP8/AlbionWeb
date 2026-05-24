import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { readFile } from "fs/promises";
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

    // Solo items base (sin @N) que coincidan con la búsqueda
    const baseMatches = items
      .filter((item) => !item.UniqueName.includes("@"))
      .filter((item) => {
        const name = (
          item.LocalizedNames["ES-ES"] ||
          item.LocalizedNames["EN-US"] ||
          ""
        ).toLowerCase();
        return name.includes(q) || item.UniqueName.toLowerCase().includes(q);
      })
      .slice(0, 7); // 7 base × 5 variantes = 35 resultados máx.

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
      req.query.server === "east"
        ? "https://east.albion-online-data.com/api/v2/stats/prices"
        : "https://www.albion-online-data.com/api/v2/stats/prices";

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