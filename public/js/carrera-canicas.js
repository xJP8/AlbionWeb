(function () {
  const cv = document.getElementById('canicas-canvas'), ctx = cv.getContext('2d');
  const VW = 420, VH = 660;
  const PAL = ['#ff5c38','#4dd0a7','#f2c14e','#6aa9ff','#c77dff','#ff8fab','#7ee081','#e8e6df','#ff9f1c','#5bc0eb','#d4a373','#a0e7e5'];
  const $ = id => document.getElementById(id);
  const speedEl = $('canicas-speed'), lenEl = $('canicas-len');
  speedEl.oninput = () => $('canicas-speedv').textContent = (+speedEl.value).toFixed(1) + 'x';
  lenEl.oninput = () => { $('canicas-lenv').textContent = lenEl.value; buildTrack(); };

  let pegs = [], bumpers = [], bars = [], rotors = [], paddles = [], apexes = [], trampolines = [];
  let worldH = 0, marbles = [], finished = [], running = false, cam = 0, t = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);

  function buildTrack() {
    pegs = []; bumpers = []; bars = []; rotors = []; paddles = []; apexes = []; trampolines = [];
    const sections = +lenEl.value;
    let y = 230;
    const kinds = [];
    for (let s = 0; s < sections; s++) kinds.push(s === 0 ? 0 : Math.floor(rnd(0, 7)));

    for (const k of kinds) {
      if (k === 0) {                       // bosque de clavos con algún tope
        for (let r = 0; r < 4; r++) {
          const off = r % 2 ? 30 : 0;
          for (let x = 30 + off; x < VW - 20; x += 60) {
            if (Math.random() < 0.12) bumpers.push({ x, y: y + r * 54, r: 11, glow: 0 });
            else pegs.push({ x, y: y + r * 54, r: 6 });
          }
        }
        y += 4 * 54 + 60;
      } else if (k === 1) {                // rampas en zigzag
        for (let r = 0; r < 3; r++) {
          const left = r % 2 === 0;
          bars.push(left
            ? { x1: 0, y1: y + r * 92, x2: VW - 95, y2: y + r * 92 + 66 }
            : { x1: VW, y1: y + r * 92, x2: 95, y2: y + r * 92 + 66 });
        }
        y += 3 * 92 + 70;
      } else if (k === 2) {                // bifurcación: cuña + dos canales
        const cx = VW / 2;
        // en la punta de la cuña las dos rampas se tocan en un único punto:
        // una canica que cae justo en el centro puede quedar balanceándose
        // sin decidirse por ningún lado. El apex la manda a un canal al
        // azar (50/50), sin importar por dónde llegue.
        apexes.push({ x: cx, y, r: 10, glow: 0 });
        bars.push({ x1: cx, y1: y, x2: cx - 105, y2: y + 130 });
        bars.push({ x1: cx, y1: y, x2: cx + 105, y2: y + 130 });
        bars.push({ x1: cx - 105, y1: y + 130, x2: cx - 105, y2: y + 300 });
        bars.push({ x1: cx + 105, y1: y + 130, x2: cx + 105, y2: y + 300 });
        // canal izquierdo: clavos apretados (lento pero seguro)
        // el borde derecho de los clavos se mantiene alejado del muro
        // (cx - 105): si se solapan, la canica queda encajada en la
        // rendija entre el clavo y el muro y no cae nunca.
        {
          const leftWallX = cx - 105;
          const pegGapToWall = 25;
          for (let r = 0; r < 4; r++) {
            const off = r % 2 ? 20 : 0;
            for (let x = 40; x + off + 6 <= leftWallX - pegGapToWall; x += 40) {
              pegs.push({ x: x + off, y: y + 160 + r * 40, r: 6 });
            }
          }
        }
        // canal derecho: caída libre con un tope al final (rápido pero caótico)
        bumpers.push({ x: cx + 160, y: y + 270, r: 13, glow: 0 });
        bars.push({ x1: cx - 105, y1: y + 300, x2: cx - 30, y2: y + 370 });
        bars.push({ x1: cx + 105, y1: y + 300, x2: cx + 30, y2: y + 370 });
        y += 430;
      } else if (k === 3) {                // aspas giratorias
        for (let r = 0; r < 2; r++) {
          rotors.push({ x: VW * (r % 2 ? 0.66 : 0.34), y: y + r * 150, len: 82, ang: rnd(0, 6.28), spd: (Math.random() < 0.5 ? -1 : 1) * rnd(0.018, 0.032) });
        }
        y += 320;
      } else if (k === 4) {                // paletas oscilantes
        for (let r = 0; r < 2; r++) {
          paddles.push({ cx: VW / 2, y: y + r * 130, w: 78, amp: 105, ph: rnd(0, 6.28), spd: rnd(0.016, 0.026) });
        }
        y += 290;
      } else if (k === 5) {                // embudo con topes
        bars.push({ x1: 0, y1: y, x2: VW / 2 - 40, y2: y + 135 });
        bars.push({ x1: VW, y1: y, x2: VW / 2 + 40, y2: y + 135 });
        for (let r = 0; r < 3; r++) bumpers.push({ x: VW / 2 + (r % 2 ? 34 : -34), y: y + 180 + r * 52, r: 12, glow: 0 });
        y += 350;
      } else {                             // pinball: embudos anchos que rebotan + un tope central
        // la boca es ancha (garganta de 110px) y solo hay un tope centrado
        // con espacio de sobra a cada lado: si la canica rebota en una
        // pared, tiene sitio para cruzar de largo en vez de quedar
        // rebotando en bucle entre pared y tope.
        const cx6 = VW / 2;
        for (let i = 0; i < 3; i++) {
          const fy = y + i * 190;
          trampolines.push({ x1: 10, y1: fy, x2: cx6 - 55, y2: fy + 120 });
          trampolines.push({ x1: VW - 10, y1: fy, x2: cx6 + 55, y2: fy + 120 });
          // tope suave y con empujón lateral: si le diera fuerte hacia
          // arriba (como los topes normales) la pared rebotando justo
          // encima la devolvería una y otra vez sin dejarla avanzar.
          bumpers.push({ x: cx6, y: fy + 165, r: 14, glow: 0, power: 0.8, kick: 6 });
        }
        y += 3 * 190 + 60;
      }
      y += 30;
    }
    worldH = y + 130;
    if (!running) { cam = 0; draw(); }
  }

  function makeMarbles(names) {
    return names.map((name, i) => ({
      name,
      x: 40 + (i + 0.5) * ((VW - 80) / names.length) + rnd(-3, 3),
      y: 55 + Math.random() * 25,
      vx: rnd(-0.7, 0.7), vy: 0,
      r: Math.max(8, 13 - names.length * 0.25),
      color: PAL[i % PAL.length],
      done: false, place: 0,
      bestY: 0, stallFrames: 0, phase: 0,
      _apexRef: null, _apexSide: 0
    }));
  }

  // colisión genérica contra un segmento con velocidad de superficie
  function hitSeg(m, x1, y1, x2, y2, th, svx, svy, e, fric) {
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    let u = L ? ((m.x - x1) * dx + (m.y - y1) * dy) / L : 0;
    u = Math.max(0, Math.min(1, u));
    const px = x1 + u * dx, py = y1 + u * dy;
    let nx = m.x - px, ny = m.y - py;
    let d = Math.hypot(nx, ny);
    if (d >= m.r + th) return false;
    if (d < 0.001) { nx = 0; ny = -1; d = 0.001; }
    nx /= d; ny /= d;
    m.x += nx * (m.r + th - d);
    m.y += ny * (m.r + th - d);
    let rvx = m.vx - svx, rvy = m.vy - svy;
    const dot = rvx * nx + rvy * ny;
    if (dot < 0) {
      const tvx = rvx - dot * nx, tvy = rvy - dot * ny;
      rvx = tvx * fric - dot * nx * e;
      rvy = tvy * fric - dot * ny * e;
    }
    m.vx = rvx + svx; m.vy = rvy + svy;
    return true;
  }

  function step() {
    t++;
    for (const r of rotors) r.ang += r.spd;
    for (const p of paddles) p.ph += p.spd;
    for (const b of bumpers) if (b.glow > 0) b.glow--;
    for (const p of apexes) if (p.glow > 0) p.glow--;

    const G = 0.31;
    for (const m of marbles) {
      if (m.done) continue;
      m.vy = Math.min(m.vy + G, 12.5);
      m.x += m.vx; m.y += m.vy;

      if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx) * 0.42 + 0.2; }
      if (m.x > VW - m.r) { m.x = VW - m.r; m.vx = -Math.abs(m.vx) * 0.42 - 0.2; }

      // anti-atasco: si lleva mucho sin avanzar (p. ej. balanceándose sobre
      // una paleta en resonancia), se ignoran los obstáculos unos frames
      // para forzar la caída y romper el bucle.
      if (m.phase > 0) m.phase--;
      const skipObstacles = m.phase > 0;

      if (!skipObstacles) for (const p of pegs) {
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
        if (d < m.r + p.r && d > 0) {
          const nx = dx / d, ny = dy / d;
          m.x = p.x + nx * (m.r + p.r); m.y = p.y + ny * (m.r + p.r);
          const dot = m.vx * nx + m.vy * ny;
          m.vx = (m.vx - 2 * dot * nx) * 0.42 + rnd(-0.3, 0.3);
          m.vy = (m.vy - 2 * dot * ny) * 0.42;
        }
      }

      if (!skipObstacles) for (const p of bumpers) {              // topes: devuelven MÁS energía
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
        if (d < m.r + p.r && d > 0) {
          const nx = dx / d, ny = dy / d;
          m.x = p.x + nx * (m.r + p.r); m.y = p.y + ny * (m.r + p.r);
          const dot = m.vx * nx + m.vy * ny;
          const power = p.power !== undefined ? p.power : 4.2;
          m.vx = (m.vx - 2 * dot * nx) * 0.75 + nx * power + (p.kick ? rnd(-p.kick, p.kick) : 0);
          m.vy = (m.vy - 2 * dot * ny) * 0.75 + ny * power;
          p.glow = 14;
        }
      }

      if (!skipObstacles) for (const b of bars) {
        if (hitSeg(m, b.x1, b.y1, b.x2, b.y2, 5, 0, 0, 0.18, 0.965)) {
          const bl = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
          const dirx = (b.x2 - b.x1) / bl, diry = (b.y2 - b.y1) / bl;
          const sg = diry >= 0 ? 1 : -1;
          m.vx += dirx * sg * 0.26;
          m.vy += Math.abs(diry) * 0.16;
        }
      }

      if (!skipObstacles) for (const p of apexes) {   // punta de bifurcación: reparte al azar
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
        if (d < m.r + p.r) {
          if (m._apexRef !== p) { m._apexRef = p; m._apexSide = Math.random() < 0.5 ? -1 : 1; }
          const nx = m._apexSide, ny = 1, len = Math.hypot(nx, ny);
          m.x = p.x + (nx / len) * (m.r + p.r);
          m.y = p.y + (ny / len) * (m.r + p.r);
          m.vx += m._apexSide * 3.2;
          m.vy = Math.max(m.vy, 1.5);
          p.glow = 14;
        }
      }

      if (!skipObstacles) for (const b of trampolines) {   // superficies que rebotan (menos que un tope, para no sumarse a su empujón)
        hitSeg(m, b.x1, b.y1, b.x2, b.y2, 6, 0, 0, 0.3, 0.94);
      }

      if (!skipObstacles) for (const r of rotors) {               // aspas: empujan de verdad
        const c = Math.cos(r.ang), s = Math.sin(r.ang);
        const x1 = r.x - c * r.len, y1 = r.y - s * r.len;
        const x2 = r.x + c * r.len, y2 = r.y + s * r.len;
        const rx = m.x - r.x, ry = m.y - r.y;
        if (hitSeg(m, x1, y1, x2, y2, 6, -r.spd * ry * 1.6, r.spd * rx * 1.6, 0.5, 0.9)) {
          m.vx += -r.spd * ry * 0.9;
          m.vy += r.spd * rx * 0.9;
        }
      }

      if (!skipObstacles) for (const p of paddles) {              // paletas: barren de lado a lado
        const px = p.cx + Math.sin(p.ph) * p.amp;
        const svx = Math.cos(p.ph) * p.spd * p.amp;
        hitSeg(m, px - p.w, p.y, px + p.w, p.y, 6, svx * 1.4, 0, 0.35, 0.95);
      }

      m.vx *= 0.995;
      if (Math.abs(m.vx) < 0.02) m.vx += rnd(-0.15, 0.15);
      m.vx = Math.max(-9, Math.min(9, m.vx));

      if (m.y > m.bestY + 0.05) { m.bestY = m.y; m.stallFrames = 0; }
      else if (m.phase <= 0 && ++m.stallFrames > 90) { m.phase = 40; m.stallFrames = 0; }

      if (m.y > worldH) { m.done = true; finished.push(m); m.place = finished.length; }
    }

    for (let i = 0; i < marbles.length; i++) {
      for (let j = i + 1; j < marbles.length; j++) {
        const a = marbles[i], c = marbles[j];
        if (a.done || c.done) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        if (d < a.r + c.r) {
          const nx = dx / d, ny = dy / d, ov = (a.r + c.r - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
          const p = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
          if (p > 0) { a.vx -= p * nx * 0.7; a.vy -= p * ny * 0.7; c.vx += p * nx * 0.7; c.vy += p * ny * 0.7; }
        }
      }
    }

    const live = marbles.filter(m => !m.done);
    const lead = live.length ? Math.max(...live.map(m => m.y)) : worldH;
    const target = Math.max(0, Math.min(lead - VH * 0.55, worldH + 60 - VH));
    cam += (target - cam) * 0.12;
  }

  function vis(y) { return y > cam - 120 && y < cam + VH + 120; }

  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(0, -cam);

    ctx.strokeStyle = '#161a24'; ctx.lineWidth = 1;
    for (let y = Math.floor(cam / 60) * 60; y < cam + VH + 60; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
    }

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a5468'; ctx.lineWidth = 10;
    for (const b of bars) {
      if (!vis(Math.min(b.y1, b.y2)) && !vis(Math.max(b.y1, b.y2))) continue;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }

    ctx.strokeStyle = '#7ee081'; ctx.lineWidth = 10;
    for (const b of trampolines) {
      if (!vis(Math.min(b.y1, b.y2)) && !vis(Math.max(b.y1, b.y2))) continue;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }

    for (const p of apexes) {
      if (!vis(p.y)) continue;
      ctx.fillStyle = p.glow > 0 ? '#ffe9a8' : '#c9a032';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,160,50,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = '#5c6a80';
    for (const p of pegs) {
      if (!vis(p.y)) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }

    for (const p of bumpers) {
      if (!vis(p.y)) continue;
      ctx.fillStyle = p.glow > 0 ? '#ffd0c2' : '#ff5c38';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (p.glow > 0 ? 2 : 0), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,92,56,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); ctx.stroke();
    }

    for (const r of rotors) {
      if (!vis(r.y)) continue;
      const c = Math.cos(r.ang), s = Math.sin(r.ang);
      ctx.strokeStyle = '#9fb4c7'; ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(r.x - c * r.len, r.y - s * r.len);
      ctx.lineTo(r.x + c * r.len, r.y + s * r.len);
      ctx.stroke();
      ctx.fillStyle = '#0a0c11';
      ctx.beginPath(); ctx.arc(r.x, r.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5c6a80'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, 6, 0, Math.PI * 2); ctx.stroke();
    }

    for (const p of paddles) {
      if (!vis(p.y)) continue;
      const px = p.cx + Math.sin(p.ph) * p.amp;
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(px - p.w, p.y); ctx.lineTo(px + p.w, p.y); ctx.stroke();
    }

    ctx.fillStyle = '#ff5c38';
    for (let x = 0; x < VW; x += 24) ctx.fillRect(x + (Math.floor(x / 24) % 2 ? 12 : 0), worldH, 12, 8);
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('META', VW / 2, worldH + 26);

    for (const m of marbles) {
      if (m.done) continue;
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e6df';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillText(m.name, m.x, m.y - m.r - 6);
    }
    ctx.restore();
  }

  function board() {
    const ul = $('canicas-board');
    ul.innerHTML = '';
    const order = [...marbles].sort((a, b) =>
      (a.done && b.done) ? a.place - b.place : a.done ? -1 : b.done ? 1 : b.y - a.y);
    order.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'canicas__board-item' + (m.done ? ' canicas__board-item--done' : '');
      li.innerHTML = '<span class="canicas__board-pos">' + (i + 1) + '</span>' +
        '<span class="canicas__board-dot" style="background:' + m.color + '"></span><span class="canicas__board-name"></span>';
      li.querySelector('.canicas__board-name').textContent = m.name;
      ul.appendChild(li);
    });
  }

  function loop() {
    let acc = +speedEl.value;
    while (acc >= 1) { if (running) step(); acc--; }
    if (running && Math.random() < acc) step();
    else if (!running) { for (const r of rotors) r.ang += r.spd * 0.3; for (const p of paddles) p.ph += p.spd * 0.3; }
    draw();
    if (t % 8 === 0) board();

    if (running && marbles.every(m => m.done)) {
      running = false;
      $('canicas-start').disabled = false;
      $('canicas-verdict').innerHTML = '<b>Gana</b>&nbsp;&nbsp;<span id="canicas-winner"></span>';
      $('canicas-winner').textContent = finished[0].name;
      board();
    }
    requestAnimationFrame(loop);
  }

  function start() {
    const names = $('canicas-names').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
    if (names.length < 2) { $('canicas-verdict').textContent = 'Necesitas al menos dos participantes.'; return; }
    marbles = makeMarbles(names);
    finished = []; cam = 0; running = true;
    $('canicas-start').disabled = true;
    $('canicas-verdict').textContent = 'Carrera en marcha — ' + names.length + ' canicas.';
    board();
  }

  $('canicas-start').onclick = start;
  $('canicas-track').onclick = () => { running = false; $('canicas-start').disabled = false; buildTrack(); };
  buildTrack();
  loop();
})();
