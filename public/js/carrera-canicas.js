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
    spinner:     { fill: '#9fb4c7' },
    hub:         { fill: '#0a0c11', stroke: '#5c6a80' },
    paddlePush:  { fill: '#c9a032' },
    paddleBrake: { fill: '#6a6252' },
    paddleProps: { fill: '#7ee081' },
    funnel:      { fill: '#b8863a', glow: '#ffe1a8' },
    chevron:     { fill: '#4a5468' },
    ring:        { fill: '#9fb4c7' },
    ringbump:    { fill: '#ff8fab', glow: '#ffd6e2' },
    gate:        { fill: '#b83030', glow: '#ff6b6b' },
    barrier:     { fill: '#4a5468' },
  };

  // ── Estado global ───────────────────────────────────────
  let engine, world;
  let racers = [];          // { name, color, body, finished, place, r }
  let actuators = [];       // obstáculos móviles con update(dt)
  let zones = [];           // fuerzas de zona (sesgo del zigzag)
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
    peloton: { cv: $('canicas-cam-peloton'), cx: VW / 2, cy: 0, zoom: 1, target: 0 },
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
    obstacleBodies = []; actuators = []; zones = [];
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
    const rows = 4, step = 96, arm = 150, thick = 12;   // brazos cortos: dejan hueco junto a los muros
    const top = y;
    for (let r = 0; r < rows; r++) {
      const yy = y + 30 + r * step;
      const peak = r % 2 === 0;               // ∧ arriba / ∨ abajo, alternado y simétrico
      const dy = peak ? 60 : -60;
      // dos brazos que forman la V, tocándose en el centro
      const b1 = Bodies.rectangle(VW / 4, yy + dy / 2, arm, thick,
        { isStatic: true, friction: 0.02, restitution: 0.2,
          angle: Math.atan2(dy, arm) });
      const b2 = Bodies.rectangle(VW * 3 / 4, yy + dy / 2, arm, thick,
        { isStatic: true, friction: 0.02, restitution: 0.2,
          angle: -Math.atan2(dy, arm) });
      Composite.add(world, [reg(b1, 'chevron'), reg(b2, 'chevron')]);
    }
    const bottom = y + 30 + rows * step;
    zones.push({ y0: top, y1: bottom, fx: dominant * 0.10 });
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
    reg(body, 'spinner', { spin, power, len });
    actuators.push({ body, update() { Body.setAngle(body, body.angle + spin); } });
    Composite.add(world, body);
    // buje central decorativo (no colisiona en la práctica: dentro del aspa)
    Composite.add(world, reg(Bodies.circle(x, y, 7, { isStatic: true }), 'hub'));
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
      const body = Bodies.rectangle(cxp, y + 70 + r * rowGap, w * 2, 15,
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

  // ════════════════════════════════════════════════════════
  //  ENSAMBLAJE DEL CIRCUITO (con sinergia de encadenado)
  // ════════════════════════════════════════════════════════
  const SECTIONS = {
    clavos: secClavos, zigzag: secZigzag, aspas: secAspas, paletas: secPaletas,
    embudo: secEmbudo, pinball: secPinball, anillo: secAnillo, compuertas: secCompuertas,
  };
  const BOTTLENECKS = ['embudo', 'anillo', 'compuertas'];
  const CHAOS = ['aspas', 'pinball', 'clavos'];

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
      }
    }
  }

  // ════════════════════════════════════════════════════════
  //  SIMULACIÓN
  // ════════════════════════════════════════════════════════
  const DT = 1000 / 60;
  function substep() {
    t++;
    for (const a of actuators) a.update(DT);
    // fuerzas de zona (sesgo del zigzag)
    for (const rc of racers) {
      if (rc.finished) continue;
      for (const z of zones)
        if (rc.body.position.y > z.y0 && rc.body.position.y < z.y1) addVel(rc.body, z.fx, 0);
    }
    Engine.update(engine, DT);
    // límites de velocidad + antiatasco + meta
    for (const rc of racers) {
      if (rc.finished) continue;
      const b = rc.body, v = b.velocity, sp = Math.hypot(v.x, v.y);
      if (sp > 24) Body.setVelocity(b, { x: v.x / sp * 24, y: v.y / sp * 24 });

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

    // Pelotón: centro del clúster más numeroso por proximidad en y.
    if (l.length) {
      const ys = l.map(r => r.body.position.y);
      let best = ys[0], bestN = -1;
      for (const c of ys) {
        const near = ys.filter(y => Math.abs(y - c) < 130);
        if (near.length > bestN) { bestN = near.length; best = near.reduce((a, b) => a + b, 0) / near.length; }
      }
      cams.peloton.target = best;
    } else cams.peloton.target = finishY;

    // General: encuadra a todas las canicas activas con zoom dinámico.
    if (l.length) {
      const ys = l.map(r => r.body.position.y);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      cams.general.cyTarget = (minY + maxY) / 2;
      cams.general.spanTarget = Math.max(maxY - minY, 260);
    } else { cams.general.cyTarget = finishY; cams.general.spanTarget = 400; }

    // Suavizado (lerp)
    for (const k of ['lider', 'peloton']) {
      const cam = cams[k];
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
  function drawBody(ctx, body) {
    const p = body.plugin || {}, s = STYLE[p.kind] || { fill: '#3a4150' };
    const glowing = p.glow && p.glow > t;
    ctx.fillStyle = glowing && s.glow ? s.glow : s.fill;
    if (body.circleRadius && body.parts.length === 1) {
      const r = body.circleRadius + (glowing ? 2 : 0);
      ctx.beginPath(); ctx.arc(body.position.x, body.position.y, r, 0, 6.2832); ctx.fill();
      if (s.ring) { ctx.strokeStyle = s.ring; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(body.position.x, body.position.y, r + 6, 0, 6.2832); ctx.stroke(); }
      if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = 2; ctx.stroke(); }
      return;
    }
    for (const part of polys(body)) {
      const v = part.vertices;
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

    // obstáculos visibles
    for (const b of obstacleBodies) {
      const by = b.position.y, ext = (b.plugin && b.plugin.R) ? b.plugin.R + 40 : 200;
      if (by + ext < top || by - ext > bot) continue;
      drawBody(ctx, b);
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
