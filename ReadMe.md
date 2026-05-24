# Dragones de Plata — Web del Gremio

Web oficial del gremio **Dragones de Plata** de Albion Online.  
Construida con Node.js + Express (backend) y HTML/CSS/JS (frontend), servida por nginx.

---

## Añadir noticias

Archivo: `data/news.json`

### Estructura de una noticia

```json
{
  "id": 4,
  "featured": false,
  "tag": "logro",
  "tagLabel": "🏆 Logro",
  "title": "Título de la noticia",
  "excerpt": "Resumen breve que aparece en la tarjeta (2-3 frases máximo).",
  "date": "2026-06-01",
  "dateLabel": "1 junio, 2026",
  "link": "#"
}
```

### Campos

| Campo       | Tipo    | Descripción                                                         |
|-------------|---------|---------------------------------------------------------------------|
| `id`        | número  | ID único. Usa el siguiente número disponible.                       |
| `featured`  | boolean | `true` = tarjeta grande (ocupa 2 columnas). **Solo una a la vez.**  |
| `tag`       | texto   | Clave del tipo de noticia. Ver tabla de tags más abajo.             |
| `tagLabel`  | texto   | Texto visible del tag, con emoji. Ver tabla de tags.                |
| `title`     | texto   | Título de la noticia.                                               |
| `excerpt`   | texto   | Resumen corto visible en la tarjeta.                                |
| `date`      | texto   | Fecha en formato `AAAA-MM-DD` (para ordenar).                       |
| `dateLabel` | texto   | Fecha en formato legible, ej: `"15 mayo, 2026"`.                    |
| `link`      | texto   | URL de la noticia completa. Usa `"#"` si aún no hay página.         |

### Tags disponibles

| `tag`    | `tagLabel`    | Color     |
|----------|---------------|-----------|
| `guerra` | `⚔️ Guerra`   | Rojo      |
| `evento` | `📅 Evento`   | Dorado    |
| `logro`  | `🏆 Logro`    | Dorado    |

> Si usas un `tag` que no está en esta lista, la tarjeta se mostrará sin color de fondo. Para añadir un tag nuevo hay que declararlo también en `public/css/inicio.css` (busca `.tag--guerra`).

### Reglas

- Solo puede haber **una noticia con `"featured": true`** a la vez. Si pones más de una, todas aparecerán en grande y el diseño se rompe.
- El orden en el JSON es el orden en que aparecen en la web. Pon las más recientes primero.
- La noticia destacada debería ser siempre la primera del array.

### Ejemplo completo de `news.json`

```json
{
  "news": [
    {
      "id": 1,
      "featured": true,
      "tag": "guerra",
      "tagLabel": "⚔️ Guerra",
      "title": "Victoria en el sector norte de Caerleon",
      "excerpt": "Expulsamos a la alianza rival y aseguramos tres territorios estratégicos.",
      "date": "2026-05-15",
      "dateLabel": "15 mayo, 2026",
      "link": "#"
    },
    {
      "id": 2,
      "featured": false,
      "tag": "evento",
      "tagLabel": "📅 Evento",
      "title": "Torneo interno de arenas este sábado",
      "excerpt": "Competición 5v5 entre grupos del gremio. Premios en plata y equipo T6.",
      "date": "2026-05-12",
      "dateLabel": "12 mayo, 2026",
      "link": "#"
    }
  ]
}
```

---

## Añadir eventos

Archivo: `data/events.json`

### Estructura de un evento

```json
{
  "id": 5,
  "date": "2026-06-14",
  "day": "14",
  "month": "Jun",
  "name": "Nombre del evento",
  "detail": "20:00 CET · Detalle adicional",
  "badge": "raid",
  "badgeLabel": "Raid"
}
```

### Campos

| Campo        | Tipo   | Descripción                                                        |
|--------------|--------|--------------------------------------------------------------------|
| `id`         | número | ID único. Usa el siguiente número disponible.                      |
| `date`       | texto  | Fecha en formato `AAAA-MM-DD` (para ordenar).                      |
| `day`        | texto  | Día del mes, ej: `"07"`. Usa dos dígitos para días del 1 al 9.     |
| `month`      | texto  | Mes abreviado en español, ej: `"Mayo"`, `"Jun"`, `"Jul"`.          |
| `name`       | texto  | Nombre del evento.                                                 |
| `detail`     | texto  | Hora, equipo requerido, canal, etc.                                |
| `badge`      | texto  | Clave del tipo de evento. Ver tabla de badges más abajo.           |
| `badgeLabel` | texto  | Texto visible del badge.                                           |

### Badges disponibles

| `badge`    | `badgeLabel` | Color  | Cuándo usarlo                              |
|------------|--------------|--------|--------------------------------------------|
| `gvg`      | `GvG`        | Rojo   | Guild vs Guild, batallas de territorio.    |
| `raid`     | `Raid`       | Dorado | Mazmorras, raids grupales.                 |
| `mercado`  | `Mercado`    | Verde  | Intercambio de recursos, economía.         |
| `social`   | `Reunión`    | Dorado | Reuniones, votaciones, eventos de Discord. |

> Para añadir un badge nuevo hay que declararlo en `public/css/inicio.css` (busca `.badge--gvg`).

### Reglas

- El orden en el JSON es el orden en que aparecen en la web. Ordena los eventos **de más próximo a más lejano** (ascendente por fecha).
- El campo `month` es solo visual, no tiene que coincidir con `date` técnicamente, pero deberían ser coherentes.
- Cuando un evento ya haya pasado, bórralo del JSON para que no ocupe espacio en la portada.

### Meses abreviados de referencia

| Mes        | Valor sugerido |
|------------|----------------|
| Enero      | `"Ene"`        |
| Febrero    | `"Feb"`        |
| Marzo      | `"Mar"`        |
| Abril      | `"Abr"`        |
| Mayo       | `"Mayo"`       |
| Junio      | `"Jun"`        |
| Julio      | `"Jul"`        |
| Agosto     | `"Ago"`        |
| Septiembre | `"Sep"`        |
| Octubre    | `"Oct"`        |
| Noviembre  | `"Nov"`        |
| Diciembre  | `"Dic"`        |

---

## Estructura del proyecto

```
├── data/
│   ├── news.json          ← Noticias de la portada
│   └── events.json        ← Eventos de la portada
├── public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── inicio.js      ← Carga y renderiza noticias y eventos
│   │   ├── guild.js       ← Carga stats del gremio desde la API de Albion
│   │   └── nav.js
│   └── pages/
└── server/
    └── index.js           ← Servidor Express (API proxy + endpoints /api/news y /api/events)
```

## Arrancar el servidor

```bash
node server/index.js
```

El servidor escucha en el puerto **3000**. nginx se encarga de servir los archivos estáticos de `public/` y de redirigir las peticiones `/api/*` al servidor Node.
