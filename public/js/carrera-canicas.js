/* ============================================================
   CARRERA DE CANICAS — Dragones de Plata
   Motor de física real sobre Matter.js. Un único mundo se
   simula una vez por frame y se dibuja tres veces con cámaras
   distintas (líder, pelotón y general), estilo retransmisión.
   ============================================================ */
(function () {
  const { Engine, Bodies, Body, Composite, Events } = Matter;

  // ── Constantes del mundo ────────────────────────────────
  const VW = 440;                 // ancho del circuito (unidades de mundo)
  const WALL = 26;                // grosor de los muros laterales
  const PAL = ['#ff5c38', '#4dd0a7', '#f2c14e', '#6aa9ff', '#c77dff', '#ff8fab',
    '#7ee081', '#e8e6df', '#ff9f1c', '#5bc0eb', '#d4a373', '#a0e7e5'];

  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── Estilos de dibujo por tipo de obstáculo ─────────────
  const STYLE = {
    wall:        { fill: '#15171e' },
    peg:         { fill: '#5c6a80' },
    bumper:      { fill: '#ff5c38', glow: '#ffd8c8', ring: 'rgba(255,92,56,0.35)' },
    spinner:     { fill: '#9db9d6', glow: '#dbe8f7' },
    hub:         { fill: '#0a0c11', stroke: '#5c6a80' },
    paddlePush:  { fill: '#c9a032' },
    paddleBrake: { fill: '#6a6252' },
    paddleProps: { fill: '#7ee081' },
    funnel:      { fill: '#c79542', glow: '#ffe1a8' },
    chevron:     { fill: '#5b6b84' },
    ring:        { fill: '#9db9d6' },
    ringbump:    { fill: '#ff8fab', glow: '#ffd6e2' },
    gate:        { fill: '#b83030', glow: '#ff6b6b' },
    barrier:     { fill: '#4a5468' },
    conveyor:    { fill: '#3aa6a0' },
    tramp:       { fill: '#3ad67a', glow: '#b8ffd0' },
    cannon:      { fill: '#d0662a' },
  };

  // ── Estado global ───────────────────────────────────────
  let engine, world;
  let racers = [];          // { name, color, body, finished, place, r }
  let actuators = [];       // obstáculos móviles con update(dt)
  let zones = [];           // fuerzas de zona (sesgo del zigzag, viento)
  let cannons = [];         // zonas-cañón que disparan la canica al entrar
  let obstacleBodies = [];  // para dibujar (todo lo estático/cinemático)
  let worldH = 0, finishY = 0;
  let running = false, t = 0;

  // Config de longitud / velocidad (sliders)
  const speedEl = $('canicas-speed'), lenEl = $('canicas-len');
  speedEl.oninput = () => $('canicas-speedv').textContent = (+speedEl.value).toFixed(1) + 'x';
  lenEl.oninput = () => { $('canicas-lenv').textContent = lenEl.value; buildTrack(); };

  // ── Canvas de las tres cámaras ──────────────────────────
  const cams = {
    lider:   { cv: $('canicas-cam-lider'),   cx: VW / 2, cy: 0, zoom: 1, target: 0 },
    general: { cv: $('canicas-cam-general'), cx: VW / 2, cy: 0, zoom: 0.5, target: 0 },
  };
  for (const k in cams) cams[k].ctx = cams[k].cv.getContext('2d');

  // ════════════════════════════════════════════════════════
  //  CONSTRUCCIÓN DE CUERPOS
  // ════════════════════════════════════════════════════════
  function reg(body, kind, extra) {
    body.plugin = Object.assign({ kind, glow: 0 }, extra);
    obstacleBodies.push(body);
    return body;
  }
  const STATIC = { isStatic: true, friction: 0.02, restitution: 0.25 };

  function makeWorld() {
    if (engine) { Composite.clear(world, false); Engine.clear(engine); }
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1;
    obstacleBodies = []; actuators = []; zones = []; cannons = [];
    Events.on(engine, 'collisionStart', onCollisionStart);
    Events.on(engine, 'collisionActive', onCollisionActive);
  }

  // Muros laterales
  function addWalls() {
    const h = worldH + 400;
    Composite.add(world, [
      reg(Bodies.rectangle(-WALL / 2 + 2, h / 2, WALL, h, STATIC), 'wall'),
      reg(Bodies.rectangle(VW + WALL / 2 - 2, h / 2, WALL, h, STATIC), 'wall'),
    ]);
  }

  // ── Clavos ──────────────────────────────────────────────
  function secClavos(y) {
    const rows = 4, gap = 56;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 30 : 0;
      for (let x = 40 + off; x < VW - 30; x += 60) {
        // algún clavo se convierte en tope-pinball suave para dar chispa
        if (Math.random() < 0.10) {
          Composite.add(world, reg(Bodies.circle(x, y + r * gap, 12, STATIC),
            'bumper', { power: 9 }));
        } else {
          Composite.add(world, reg(Bodies.circle(x, y + r * gap, 6, STATIC), 'peg'));
        }
      }
    }
    return y + rows * gap + 40;
  }

  // ── Zigzag simétrico (espina de pez) ────────────────────
  // La forma es siempre simétrica; lo que cambia por circuito es
  // el lado "dominante": una fuerza de zona suave empuja a las
  // canicas hacia un lado u otro, distinto en cada carrera.
  function secZigzag(y, dominant) {
    // Rampas alternas que SÍ llegan al muro: cada fila arranca hundida en
    // un muro y baja hasta dejar un hueco junto al muro opuesto, por donde
    // la canica cae a la siguiente. El lado del hueco alterna → zigzag.
    const rows = 5, step = 84, thick = 14, opening = 100;
    for (let r = 0; r < rows; r++) {
      const yy = y + 40 + r * step;
      const ltr = r % 2 === 0;
      const x1 = ltr ? -14 : VW + 14;          // extremo hundido en el muro
      const x2 = ltr ? VW - opening : opening;  // extremo con el hueco de caída
      const y1 = yy, y2 = yy + 46;
      Composite.add(world, reg(Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2,
        Math.hypot(x2 - x1, y2 - y1), thick,
        { isStatic: true, friction: 0.02, restitution: 0.18, angle: Math.atan2(y2 - y1, x2 - x1) }),
        'chevron'));
    }
    const bottom = y + 40 + rows * step;
    zones.push({ y0: y, y1: bottom, fx: dominant * 0.07 });
    return bottom + 30;
  }

  // ── Aspas giratorias ────────────────────────────────────
  // Nº de aspas y fuerza de rebote aleatorios por instancia.
  function makeSpinner(x, y, blades, len, power) {
    const thick = 13, parts = [];
    for (let i = 0; i < blades; i++) {
      parts.push(Bodies.rectangle(x, y, len * 2, thick,
        { angle: (Math.PI / blades) * i }));
    }
    const body = Body.create({ parts, isStatic: true, friction: 0.02 });
    Body.setPosition(body, { x, y });
    const spin = (Math.random() < 0.5 ? -1 : 1) * rnd(0.03, 0.055);
    reg(body, 'spinner', { spin, power, len, blades });
    actuators.push({ body, update() { Body.setAngle(body, body.angle + spin); } });
    Composite.add(world, body);
    return body;
  }
  function secAspas(y) {
    const rowGap = 175, blades = rndInt(2, 3), power = rnd(1.1, 1.9);
    for (let r = 0; r < 2; r++) {
      makeSpinner(VW * (r % 2 ? 0.64 : 0.36), y + 90 + r * rowGap,
        blades, rnd(74, 92), power);
    }
    return y + 90 + 2 * rowGap + 20;
  }

  // ── Paletas oscilantes: empuja / frena / propulsa ───────
  function secPaletas(y) {
    const rowGap = 150;
    for (let r = 0; r < 2; r++) {
      const mode = pick(['paddlePush', 'paddleBrake', 'paddleProps']);
      const w = 82, cxp = VW / 2, amp = 108, ph0 = rnd(0, 6.28), spd = rnd(0.02, 0.032);
      const body = Bodies.rectangle(cxp, y + 70 + r * rowGap, w * 2, 18,
        { isStatic: true, friction: mode === 'paddleBrake' ? 0.5 : 0.05, restitution: 0.2 });
      const st = { ph: ph0, prevX: cxp };
      reg(body, mode, { vx: 0 });
      actuators.push({
        body, update() {
          st.ph += spd;
          const nx = cxp + Math.sin(st.ph) * amp;
          body.plugin.vx = nx - st.prevX;
          st.prevX = nx;
          Body.setPosition(body, { x: nx, y: body.position.y });
        }
      });
      Composite.add(world, body);
    }
    return y + 70 + 2 * rowGap + 20;
  }

  // ── Embudo con paredes que empujan hacia el centro ──────
  function secEmbudo(y) {
    const mouthY = y, throatY = y + 150, throat = 46;
    const lw = Bodies.rectangle(0, 0, 1, 1, { isStatic: true });
    // paredes inclinadas (rectángulos largos)
    const len = Math.hypot(VW / 2 - throat, throatY - mouthY);
    const angL = Math.atan2(throatY - mouthY, VW / 2 - throat);
    const left = Bodies.rectangle((0 + (VW / 2 - throat)) / 2, (mouthY + throatY) / 2,
      len, 12, { isStatic: true, friction: 0.02, restitution: 0.15, angle: angL });
    const right = Bodies.rectangle((VW + (VW / 2 + throat)) / 2, (mouthY + throatY) / 2,
      len, 12, { isStatic: true, friction: 0.02, restitution: 0.15, angle: -angL });
    Composite.add(world, [reg(left, 'funnel', { side: 1 }), reg(right, 'funnel', { side: -1 })]);
    // tras la garganta, tres topes que reparten
    for (let r = 0; r < 3; r++) {
      Composite.add(world, reg(Bodies.circle(VW / 2 + (r % 2 ? 40 : -40), throatY + 55 + r * 55,
        12, STATIC), 'bumper', { power: 8 }));
    }
    return throatY + 55 + 3 * 55 + 20;
  }

  // ── Pinball: topes que azotan hacia arriba ──────────────
  function secPinball(y) {
    const cx = VW / 2;
    for (let i = 0; i < 3; i++) {
      const fy = y + 60 + i * 165;
      // embudos-trampolín que devuelven al centro
      const len = 150, ang = Math.atan2(120, cx - 60);
      Composite.add(world, reg(Bodies.rectangle((10 + cx - 60) / 2, fy + 60, len, 12,
        { isStatic: true, restitution: 0.5, angle: ang }), 'chevron'));
      Composite.add(world, reg(Bodies.rectangle((VW - 10 + cx + 60) / 2, fy + 60, len, 12,
        { isStatic: true, restitution: 0.5, angle: -ang }), 'chevron'));
      // tope central: azote fuerte hacia ARRIBA (rebote dramático)
      Composite.add(world, reg(Bodies.circle(cx, fy + 150, 15, STATIC),
        'bumper', { power: 13, slap: true }));
    }
    return y + 60 + 3 * 165 + 30;
  }

  // ── Anillo giratorio con hueco + topes internos ─────────
  function secAnillo(y) {
    const cx = VW / 2, cy = y + 190, R = 150, thick = 14;
    const gapArc = 1.6;                       // ~92° de abertura
    const gapCenter = rnd(0, Math.PI * 2);
    const parts = [];
    const segs = 26;
    for (let i = 0; i < segs; i++) {
      const th = (i / segs) * Math.PI * 2;
      let d = Math.abs(((th - gapCenter + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (d < gapArc / 2) continue;           // hueco
      const seglen = (Math.PI * 2 * R) / segs + 6;
      parts.push(Bodies.rectangle(cx + Math.cos(th) * R, cy + Math.sin(th) * R,
        seglen, thick, { angle: th + Math.PI / 2 }));
    }
    const ring = Body.create({ parts, isStatic: true, friction: 0.02, restitution: 0.3 });
    Body.setPosition(ring, { x: cx, y: cy });
    const spin = (Math.random() < 0.5 ? -1 : 1) * rnd(0.006, 0.012);
    reg(ring, 'ring', { spin, R });
    actuators.push({ body: ring, update() { Body.setAngle(ring, ring.angle + spin); } });
    Composite.add(world, ring);
    // topes internos fijos que hacen rebotar dentro
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      Composite.add(world, reg(Bodies.circle(cx + Math.cos(a) * R * 0.42,
        cy + Math.sin(a) * R * 0.42, 11, STATIC), 'ringbump', { power: 8 }));
    }
    return cy + R + 30;
  }

  // ── Compuertas alternas que empujan cuando están cerradas ─
  function secCompuertas(y) {
    const barY = y + 60, gapW = 92, seg = 12;
    const leftGapX = VW * 0.30, rightGapX = VW * 0.70;
    // barrera fija: tres tramos sólidos dejando dos huecos
    const solids = [
      [0, leftGapX - gapW / 2],
      [leftGapX + gapW / 2, rightGapX - gapW / 2],
      [rightGapX + gapW / 2, VW],
    ];
    for (const [x0, x1] of solids) {
      if (x1 - x0 < 4) continue;
      Composite.add(world, reg(Bodies.rectangle((x0 + x1) / 2, barY, x1 - x0, seg, STATIC), 'barrier'));
    }
    // dos compuertas que tapan cada hueco alternándose
    const period = 130;
    const makeGate = (gx, phase) => {
      const gate = Bodies.rectangle(gx, barY, gapW, seg,
        { isStatic: true, friction: 0.02, restitution: 0.2 });
      reg(gate, 'gate', { closed: true });
      const openY = barY - 260;               // retirada fuera de vista al abrir
      actuators.push({
        body: gate, update() {
          const closed = (Math.floor(t / period) + phase) % 2 === 0;
          gate.plugin.closed = closed;
          const ty = closed ? barY : openY;
          if (Math.abs(gate.position.y - ty) > 0.5)
            Body.setPosition(gate, { x: gx, y: gate.position.y + (ty - gate.position.y) * 0.25 });
        }
      });
      Composite.add(world, gate);
    };
    makeGate(leftGapX, 0);
    makeGate(rightGapX, 1);                    // fase opuesta: siempre uno abierto
    return barY + 90;
  }

  // ── Cinta transportadora: arrastra con fuerza hacia un lado ─
  function secCinta(y) {
    const dir0 = Math.random() < 0.5 ? 1 : -1;
    for (let r = 0; r < 2; r++) {
      const d = r % 2 === 0 ? dir0 : -dir0;
      const yy = y + 70 + r * 150;
      const x1 = d > 0 ? -14 : VW + 14;         // arranca en un muro
      const x2 = d > 0 ? VW - 96 : 96;          // baja suave hasta el hueco opuesto
      const y1 = yy, y2 = yy + 26;
      Composite.add(world, reg(Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2,
        Math.hypot(x2 - x1, y2 - y1), 16,
        { isStatic: true, friction: 0.05, restitution: 0.1, angle: Math.atan2(y2 - y1, x2 - x1) }),
        'conveyor', { drag: d * 1.1 }));
    }
    return y + 70 + 2 * 150 + 20;
  }

  // ── Trampolín: pads muy rebotones que lanzan la canica ──────
  function secTrampolin(y) {
    for (let r = 0; r < 3; r++) {
      const yy = y + 80 + r * 130;
      const left = r % 2 === 0;
      const px = left ? VW * 0.34 : VW * 0.66;
      const ang = left ? -0.32 : 0.32;
      Composite.add(world, reg(Bodies.rectangle(px, yy, 150, 16,
        { isStatic: true, friction: 0.02, restitution: 0.9, angle: ang }),
        'tramp', { power: 7 }));
    }
    return y + 80 + 3 * 130 + 30;
  }

  // ── Zona de viento: empuje lateral constante en un área ─────
  function secViento(y) {
    const dir = Math.random() < 0.5 ? 1 : -1, h = 320;
    // clavos dispersos para que se note cómo el viento las desvía
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? 42 : 0;
      for (let x = 60 + off; x < VW - 50; x += 84)
        Composite.add(world, reg(Bodies.circle(x, y + 45 + r * 68, 6, STATIC), 'peg'));
    }
    zones.push({ y0: y, y1: y + h, fx: dir * 0.13, wind: dir });
    return y + h + 20;
  }

  // ── Cañón: recoge la canica y la dispara hacia un lado ──────
  function secCanon(y) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const mouthX = dir > 0 ? VW * 0.26 : VW * 0.74, cy = y + 120;
    const backX = mouthX - dir * 52;
    // cuchara en L abierta hacia el lado de disparo
    Composite.add(world, reg(Bodies.rectangle(backX, cy, 14, 108, { isStatic: true }), 'cannon'));
    Composite.add(world, reg(Bodies.rectangle(mouthX, cy + 54, 118, 14, { isStatic: true }), 'cannon'));
    cannons.push({
      x0: Math.min(backX, mouthX + dir * 60), x1: Math.max(backX, mouthX + dir * 60),
      y0: cy + 20, y1: cy + 54, vx: dir * 16, vy: -5, x: mouthX, y: cy, dir, glow: 0,
    });
    return cy + 130;
  }

  // ════════════════════════════════════════════════════════
  //  ENSAMBLAJE DEL CIRCUITO (con sinergia de encadenado)
  // ════════════════════════════════════════════════════════
  const SECTIONS = {
    clavos: secClavos, zigzag: secZigzag, aspas: secAspas, paletas: secPaletas,
    embudo: secEmbudo, pinball: secPinball, anillo: secAnillo, compuertas: secCompuertas,
    cinta: secCinta, tramp: secTrampolin, viento: secViento, canon: secCanon,
  };
  const BOTTLENECKS = ['embudo', 'anillo', 'compuertas', 'canon'];
  const CHAOS = ['aspas', 'pinball', 'clavos', 'tramp'];

  function buildTrack() {
    makeWorld();
    const n = +lenEl.value;
    const dominant = Math.random() < 0.5 ? -1 : 1;   // sesgo global del zigzag
    const seq = [];
    const all = Object.keys(SECTIONS);
    for (let i = 0; i < n; i++) {
      if (i === 0) { seq.push('clavos'); continue; }
      const prev = seq[i - 1];
      // sinergia: tras un cuello de botella, mete una sección caótica
      // (igual de dura para todas) que rompe la ventaja del líder.
      if (BOTTLENECKS.includes(prev)) { seq.push(pick(CHAOS)); continue; }
      let k; do { k = pick(all); } while (k === prev);
      seq.push(k);
    }

    let y = 200;
    for (const k of seq) {
      y = (k === 'zigzag') ? secZigzag(y, dominant) : SECTIONS[k](y);
    }
    finishY = y + 40;
    worldH = finishY + 120;
    addWalls();

    // Reposiciona la meta como sensor para detectar el cruce
    t = 0;
    if (!running) { spawnMarbles(readNames() || []); resetCams(); draw(); }
  }

  // ════════════════════════════════════════════════════════
  //  CANICAS
  // ════════════════════════════════════════════════════════
  function readNames() {
    return $('canicas-names').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12);
  }

  function spawnMarbles(names) {
    // limpia canicas previas
    for (const rc of racers) if (rc.body) Composite.remove(world, rc.body);
    racers = [];
    const rad = Math.max(8, 13 - names.length * 0.28);
    // huecos de salida barajados: quién arranca en cada posición es al azar,
    // así ninguna canica queda favorecida por un micro-sesgo de borde.
    const slots = names.map((_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) { const j = rndInt(0, i);[slots[i], slots[j]] = [slots[j], slots[i]]; }
    names.forEach((name, i) => {
      const slot = slots[i];
      const x = 40 + (slot + 0.5) * ((VW - 80) / names.length) + rnd(-4, 4);
      const body = Bodies.circle(x, 40 + rnd(0, 30), rad, {
        restitution: 0.36, friction: 0.01, frictionStatic: 0.1,
        frictionAir: 0.006, density: 0.0016,
      });
      body.plugin = { kind: 'marble', racer: null };
      const rc = { name, color: PAL[i % PAL.length], body, finished: false, place: 0, r: rad, stall: 0, anchorY: 0 };
      body.plugin.racer = rc;
      racers.push(rc);
      Composite.add(world, body);
    });
  }

  // ════════════════════════════════════════════════════════
  //  COLISIONES → EFECTOS
  // ════════════════════════════════════════════════════════
  function classify(pair) {
    const a = pair.bodyA.plugin, b = pair.bodyB.plugin;
    if (a && a.kind === 'marble' && b) return { m: pair.bodyA, o: pair.bodyB, mp: a, op: b };
    if (b && b.kind === 'marble' && a) return { m: pair.bodyB, o: pair.bodyA, mp: b, op: a };
    return null;
  }
  const addVel = (body, dx, dy) =>
    Body.setVelocity(body, { x: body.velocity.x + dx, y: body.velocity.y + dy });

  function onCollisionStart(ev) {
    for (const pair of ev.pairs) {
      const c = classify(pair); if (!c) continue;
      const { m, o, op } = c;
      const nx = m.position.x - o.position.x, ny = m.position.y - o.position.y;
      const d = Math.hypot(nx, ny) || 1;
      if (op.kind === 'bumper') {
        op.glow = t + 12;
        if (op.slap) {                          // pinball: azote hacia arriba
          addVel(m, (nx / d) * op.power * 0.4 + rnd(-2, 2), -Math.abs(op.power));
        } else {
          addVel(m, (nx / d) * op.power, (ny / d) * op.power);
        }
      } else if (op.kind === 'ringbump') {
        op.glow = t + 12;
        addVel(m, (nx / d) * op.power, (ny / d) * op.power * 0.5);
      } else if (op.kind === 'paddleProps') {   // flipper: propulsa hacia abajo-lado
        addVel(m, o.plugin.vx * 2.2, 3.5);
      } else if (op.kind === 'gate' && op.closed) {
        op.glow = t + 12;
        addVel(m, rnd(-2, 2), -5.5);            // compuerta cerrada empuja hacia arriba
      } else if (op.kind === 'tramp') {         // trampolín: rebote grande extra
        op.glow = t + 12;
        addVel(m, (nx / d) * op.power, (ny / d) * op.power);
      }
    }
  }

  function onCollisionActive(ev) {
    for (const pair of ev.pairs) {
      const c = classify(pair); if (!c) continue;
      const { m, o, op } = c;
      if (op.kind === 'spinner') {              // empuje tangencial del aspa
        const rx = m.position.x - o.position.x, ry = m.position.y - o.position.y;
        addVel(m, -op.spin * ry * op.power, op.spin * rx * op.power);
      } else if (op.kind === 'paddlePush') {    // arrastre lateral
        addVel(m, op.vx * 0.35, 0);
      } else if (op.kind === 'paddleBrake') {   // frena
        Body.setVelocity(m, { x: m.velocity.x * 0.86, y: m.velocity.y * 0.9 });
      } else if (op.kind === 'funnel') {        // empuja hacia el centro-abajo
        addVel(m, op.side * 0.25, 0.12);
      } else if (op.kind === 'conveyor') {      // cinta: arrastra fuerte de lado
        addVel(m, op.drag, 0);
      }
    }
  }

  // ════════════════════════════════════════════════════════
  //  SIMULACIÓN
  // ════════════════════════════════════════════════════════
  const DT = 1000 / 60;
  const SUB = 3;   // subpasos de física: evita que las canicas rápidas
                   // atraviesen barras finas (paletas, embudos, compuertas)
  function substep() {
    t++;
    for (const a of actuators) a.update(DT);
    // fuerzas de zona (sesgo del zigzag)
    for (const rc of racers) {
      if (rc.finished) continue;
      for (const z of zones)
        if (rc.body.position.y > z.y0 && rc.body.position.y < z.y1) addVel(rc.body, z.fx, 0);
    }
    // cañones: si una canica está en la cuchara, la disparan
    for (const cn of cannons) {
      for (const rc of racers) {
        if (rc.finished) continue;
        const p = rc.body.position;
        if (p.x > cn.x0 && p.x < cn.x1 && p.y > cn.y0 && p.y < cn.y1) {
          Body.setVelocity(rc.body, { x: cn.vx, y: cn.vy });
          cn.glow = t + 10;
        }
      }
    }
    for (let s = 0; s < SUB; s++) Engine.update(engine, DT / SUB);
    // límites de velocidad + antiatasco + meta
    for (const rc of racers) {
      if (rc.finished) continue;
      const b = rc.body, v = b.velocity, sp = Math.hypot(v.x, v.y);
      if (sp > 19) Body.setVelocity(b, { x: v.x / sp * 19, y: v.y / sp * 19 });

      // Antiatasco por falta de PROGRESO sostenido (≥12px hacia abajo): sirve
      // igual para una canica encajada contra un muro (parada) que para una
      // atrapada girando dentro del anillo (rápida pero sin avanzar). Los
      // empujones son siempre hacia el CENTRO y ABAJO, nunca arriba, para no
      // lanzarla fuera; y como último recurso la reubica físicamente hacia
      // abajo con un salto que crece hasta atravesar cualquier obstáculo.
      if (b.position.y > rc.anchorY + 12) { rc.anchorY = b.position.y; rc.stall = 0; }
      else {
        rc.stall++;
        const toCenter = Math.sign(VW / 2 - b.position.x) || 1;
        if (rc.stall > 45 && rc.stall % 14 === 0) {
          const k = Math.min(4 + rc.stall * 0.03, 9), ang = rnd(-0.6, 0.6);
          Body.setVelocity(b, { x: toCenter * k * Math.cos(ang), y: Math.abs(k) * (0.4 + Math.abs(Math.sin(ang))) });
        }
        if (rc.stall > 200 && rc.stall % 24 === 0) {
          const drop = Math.min(8 + (rc.stall - 200) * 0.08, 40);
          Body.setPosition(b, { x: clamp(b.position.x + toCenter * 5, 24, VW - 24), y: b.position.y + drop });
          Body.setVelocity(b, { x: toCenter * 2, y: 5 });
        }
      }

      // Red de seguridad: si algo la lanzó por encima del inicio, corta la
      // subida para que vuelva a caer en vez de escapar hacia el infinito.
      if (b.position.y < -40 && b.velocity.y < 0) Body.setVelocity(b, { x: b.velocity.x, y: 1 });

      if (b.position.y > finishY) {
        rc.finished = true; rc.place = racers.filter(r => r.finished).length;
        Composite.remove(world, b);
      }
    }
  }

  function stepFrame() {
    let acc = +speedEl.value;
    while (acc >= 1) { substep(); acc--; }
    if (Math.random() < acc) substep();
  }

  // ════════════════════════════════════════════════════════
  //  CÁMARAS
  // ════════════════════════════════════════════════════════
  function live() { return racers.filter(r => !r.finished); }

  function updateCams() {
    const l = live();
    // Líder: la canica más avanzada (mayor y). Si todas acabaron, la meta.
    let lead = finishY;
    if (l.length) lead = Math.max(...l.map(r => r.body.position.y));
    cams.lider.target = lead;

    // General: encuadra a todas las canicas activas con zoom dinámico.
    if (l.length) {
      const ys = l.map(r => r.body.position.y);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      cams.general.cyTarget = (minY + maxY) / 2;
      cams.general.spanTarget = Math.max(maxY - minY, 260);
    } else { cams.general.cyTarget = finishY; cams.general.spanTarget = 400; }

    // Suavizado (lerp) — Cam 1º puesto sigue al líder a ancho completo
    {
      const cam = cams.lider;
      cam.cy += (clamp(cam.target, viewTop(cam), worldH) - cam.cy) * 0.12;
      cam.zoom = cam.cv.width / VW;             // ancho completo siempre
    }
    const g = cams.general;
    if (g.cyTarget === undefined) { g.cyTarget = finishY; g.spanTarget = 400; }
    g.cy = g.cy + (g.cyTarget - g.cy) * 0.1;
    const zByH = g.cv.height / (g.spanTarget + 160);
    const zByW = g.cv.width / VW;
    const zt = clamp(Math.min(zByH, zByW), 0.16, zByW);
    g.zoom += (zt - g.zoom) * 0.1;
  }
  function viewTop() { return 0; }
  function resetCams() {
    for (const k in cams) { cams[k].cy = 200; }
    cams.general.cy = 400; cams.general.cyTarget = 400; cams.general.spanTarget = 500;
    cams.general.zoom = cams.general.cv.height / 800;
  }

  // ════════════════════════════════════════════════════════
  //  DIBUJO
  // ════════════════════════════════════════════════════════
  function polys(body) {
    return body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  }
  // Dibuja un rectángulo (una "part") como barra de extremos redondeados.
  function drawBar(ctx, part, color) {
    const v = part.vertices;
    const e0 = Math.hypot(v[1].x - v[0].x, v[1].y - v[0].y);
    const e1 = Math.hypot(v[2].x - v[1].x, v[2].y - v[1].y);
    let a, b, w;
    if (e0 <= e1) {
      a = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
      b = { x: (v[2].x + v[3].x) / 2, y: (v[2].y + v[3].y) / 2 }; w = e0;
    } else {
      a = { x: (v[1].x + v[2].x) / 2, y: (v[1].y + v[2].y) / 2 };
      b = { x: (v[3].x + v[0].x) / 2, y: (v[3].y + v[0].y) / 2 }; w = e1;
    }
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // Aspa: palas redondeadas que salen de un buje central bien visible.
  function drawSpinner(ctx, body, s, glowing) {
    const cx = body.position.x, cy = body.position.y;
    const len = body.plugin.len || 82, bl = body.plugin.blades || 2;
    ctx.strokeStyle = glowing ? s.glow : s.fill; ctx.lineWidth = 14; ctx.lineCap = 'round';
    for (let i = 0; i < bl; i++) {
      const a = body.angle + (Math.PI / bl) * i, c = Math.cos(a), sn = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx - c * len, cy - sn * len);
      ctx.lineTo(cx + c * len, cy + sn * len);
      ctx.stroke();
    }
    ctx.fillStyle = '#12151c';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#c9a032'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 6.2832); ctx.stroke();
  }

  function drawBody(ctx, body) {
    const p = body.plugin || {}, s = STYLE[p.kind] || { fill: '#3a4150' };
    const glowing = p.glow && p.glow > t;
    if (p.kind === 'spinner') { drawSpinner(ctx, body, s, glowing); return; }

    const col = glowing && s.glow ? s.glow : s.fill;
    if (body.circleRadius && body.parts.length === 1) {
      const r = body.circleRadius + (glowing ? 2 : 0);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(body.position.x, body.position.y, r, 0, 6.2832); ctx.fill();
      if (s.ring) { ctx.strokeStyle = s.ring; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(body.position.x, body.position.y, r + 6, 0, 6.2832); ctx.stroke(); }
      if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = 2; ctx.stroke(); }
      return;
    }
    for (const part of polys(body)) {
      if (part.vertices.length === 4) { drawBar(ctx, part, col); continue; }
      const v = part.vertices;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath(); ctx.fill();
    }
  }

  function renderCam(cam) {
    const { ctx, cv } = cam, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0c11'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    const halfH = (H / 2) / cam.zoom, top = cam.cy - halfH - 60, bot = cam.cy + halfH + 60;

    // rejilla de fondo
    ctx.strokeStyle = '#141821'; ctx.lineWidth = 1 / cam.zoom;
    for (let gy = Math.floor(top / 60) * 60; gy < bot; gy += 60) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(VW, gy); ctx.stroke();
    }

    // zonas de viento: banda translúcida con flechas en su dirección
    for (const z of zones) {
      if (!z.wind || z.y1 < top || z.y0 > bot) continue;
      ctx.fillStyle = 'rgba(120,180,225,0.05)';
      ctx.fillRect(0, z.y0, VW, z.y1 - z.y0);
      ctx.strokeStyle = 'rgba(150,205,240,0.28)'; ctx.lineWidth = 2;
      for (let ay = z.y0 + 34; ay < z.y1; ay += 60) {
        const x0 = z.wind > 0 ? 40 : VW - 40, x1 = z.wind > 0 ? VW - 40 : 40, hx = z.wind > 0 ? -10 : 10;
        ctx.beginPath(); ctx.moveTo(x0, ay); ctx.lineTo(x1, ay);
        ctx.moveTo(x1, ay); ctx.lineTo(x1 + hx, ay - 6);
        ctx.moveTo(x1, ay); ctx.lineTo(x1 + hx, ay + 6); ctx.stroke();
      }
    }

    // obstáculos visibles
    for (const b of obstacleBodies) {
      const by = b.position.y, ext = (b.plugin && b.plugin.R) ? b.plugin.R + 40 : 200;
      if (by + ext < top || by - ext > bot) continue;
      drawBody(ctx, b);
    }

    // destello de disparo de los cañones
    for (const cn of cannons) {
      if (cn.glow <= t || cn.y < top || cn.y > bot) continue;
      ctx.fillStyle = 'rgba(255,180,90,0.5)';
      ctx.beginPath(); ctx.arc(cn.x, cn.y + 30, 16, 0, 6.2832); ctx.fill();
    }

    // meta
    if (finishY > top - 40 && finishY < bot + 40) {
      ctx.fillStyle = '#ff5c38';
      for (let x = 0; x < VW; x += 26) ctx.fillRect(x + (Math.floor(x / 26) % 2 ? 13 : 0), finishY, 13, 9);
      ctx.fillStyle = '#e8e6df'; ctx.font = `700 ${12 / cam.zoom * cam.zoom}px ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText('META', VW / 2, finishY + 26);
    }

    // canicas
    for (const rc of racers) {
      if (rc.finished) continue;
      const b = rc.body, by = b.position.y;
      if (by < top || by > bot) continue;
      ctx.fillStyle = rc.color;
      ctx.beginPath(); ctx.arc(b.position.x, by, rc.r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(b.position.x - rc.r * 0.3, by - rc.r * 0.3, rc.r * 0.3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#e8e6df'; ctx.textAlign = 'center';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillText(rc.name, b.position.x, by - rc.r - 5);
    }
    ctx.restore();
  }

  function draw() { for (const k in cams) renderCam(cams[k]); }

  // ════════════════════════════════════════════════════════
  //  CLASIFICACIÓN
  // ════════════════════════════════════════════════════════
  function board() {
    const ul = $('canicas-board'); ul.innerHTML = '';
    const order = [...racers].sort((a, b) =>
      (a.finished && b.finished) ? a.place - b.place
        : a.finished ? -1 : b.finished ? 1 : b.body.position.y - a.body.position.y);
    order.forEach((m, i) => {
      const li = document.createElement('li');
      li.className = 'canicas__board-item' + (m.finished ? ' canicas__board-item--done' : '');
      li.innerHTML = '<span class="canicas__board-pos">' + (i + 1) + '</span>' +
        '<span class="canicas__board-dot" style="background:' + m.color + '"></span>' +
        '<span class="canicas__board-name"></span>';
      li.querySelector('.canicas__board-name').textContent = m.name;
      ul.appendChild(li);
    });
  }

  // ════════════════════════════════════════════════════════
  //  BUCLE PRINCIPAL
  // ════════════════════════════════════════════════════════
  function loop() {
    if (running) stepFrame();
    else for (const a of actuators) a.update(DT);   // obstáculos vivos en reposo
    updateCams();
    draw();
    if (t % 6 === 0) board();

    if (running && racers.length && racers.every(r => r.finished)) {
      running = false;
      $('canicas-start').disabled = false;
      const win = racers.find(r => r.place === 1);
      $('canicas-verdict').innerHTML = '<b>Gana</b>&nbsp;&nbsp;<span></span>';
      $('canicas-verdict').querySelector('span').textContent = win ? win.name : '';
      board();
    }
    requestAnimationFrame(loop);
  }

  // ════════════════════════════════════════════════════════
  //  CONTROLES
  // ════════════════════════════════════════════════════════
  function start() {
    const names = readNames();
    if (names.length < 2) { $('canicas-verdict').textContent = 'Necesitas al menos dos participantes.'; return; }
    buildTrack();
    spawnMarbles(names);
    resetCams();
    running = true; t = 0;
    $('canicas-start').disabled = true;
    $('canicas-verdict').textContent = 'Carrera en marcha — ' + names.length + ' canicas.';
    board();
  }

  $('canicas-start').onclick = start;
  $('canicas-track').onclick = () => { running = false; $('canicas-start').disabled = false; buildTrack(); };

  buildTrack();
  loop();
})();
