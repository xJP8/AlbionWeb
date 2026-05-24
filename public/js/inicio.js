async function loadNews() {
  const grid = document.getElementById("noticias__grid");
  try {
    const res = await fetch("/api/news");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const { news } = await res.json();

    grid.innerHTML = news
      .map(
        (item) => `
      <article class="noticia-card${item.featured ? " noticia-card--featured" : ""}" role="listitem">
        <span class="noticia-card__tag tag--${item.tag}">${item.tagLabel}</span>
        <h3 class="noticia-card__title">${item.title}</h3>
        <p class="noticia-card__excerpt">${item.excerpt}</p>
        <div class="noticia-card__meta">
          <span>${item.dateLabel}</span>
          <a href="${item.link}" class="noticia-card__link">Leer más →</a>
        </div>
      </article>`
      )
      .join("");
  } catch (err) {
    grid.innerHTML =
      '<p class="noticias__error">No se pudieron cargar las noticias.</p>';
    console.error("loadNews:", err);
  }
}

async function loadEvents() {
  const list = document.getElementById("eventos__list");
  try {
    const res = await fetch("/api/events");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const { events } = await res.json();

    list.innerHTML = events
      .map(
        (item) => `
      <li class="evento-item" role="listitem">
        <div class="evento-item__date">
          <div class="evento-item__day">${item.day}</div>
          <div class="evento-item__month">${item.month}</div>
        </div>
        <div>
          <div class="evento-item__name">${item.name}</div>
          <div class="evento-item__detail">${item.detail}</div>
        </div>
        <span class="evento-item__badge badge--${item.badge}">${item.badgeLabel}</span>
      </li>`
      )
      .join("");
  } catch (err) {
    list.innerHTML =
      '<li class="eventos__error">No se pudieron cargar los eventos.</li>';
    console.error("loadEvents:", err);
  }
}

loadNews();
loadEvents();
