const BASE_URL = "/api";

async function fetchGuildData() {
  const [guildRes, dataRes, membersRes] = await Promise.all([
    fetch(`${BASE_URL}/guild`),
    fetch(`${BASE_URL}/guild/data`),
    fetch(`${BASE_URL}/guild/members`)
  ]);

  if (!guildRes.ok || !dataRes.ok || !membersRes.ok) {
    throw new Error("Error en la API del guild");
  }

  return {
    guild: await guildRes.json(),
    data: await dataRes.json(),
    members: await membersRes.json()
  };
}

function updateUI(guild, data, members) {
  // 👥 miembros reales
  document.getElementById("members-count").textContent =
    members?.length ?? 0;

  // 📅 años activos (si no hay fecha real, fallback seguro)
  document.getElementById("years-active").textContent =
    data?.Founded
      ? calculateYears(data.Founded)
      : "3";

  // ⚔️ estadística (fallback seguro)
  document.getElementById("gvg-wins").textContent =
    data?.LifetimeStatistics?.PvPKills ?? 0;

  // 🏆 ranking (no existe en API, placeholder controlado)
  document.getElementById("ranking").textContent =
    guild?.Name ? "Top Guild" : "Desconocido";
}

function calculateYears(dateString) {
  const founded = new Date(dateString);
  const now = new Date();

  const years = Math.floor(
    (now - founded) / (1000 * 60 * 60 * 24 * 365)
  );

  return isNaN(years) ? "3" : years;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { guild, data, members } = await fetchGuildData();
    updateUI(guild, data, members);
  } catch (err) {
    console.error("❌ Error cargando guild:", err);
  }
});