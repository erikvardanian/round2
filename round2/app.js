/* =========================================================
   CYBER QUEST · THREAT MATRIX — game logic
   Vanilla JS, no dependencies, no backend.

   Structure
   1. Data (questions)
   2. Jigsaw geometry (shared-edge Bezier tiling)
   3. Board rendering
   4. State + LocalStorage
   5. Question modal + timer
   6. Animations (fall, reveal, particles)
   7. Controls (fullscreen, reset, reveal)
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     1. DATA
     --------------------------------------------------------- */
  const QUESTIONS = [
    { q: 'Ընկերությունը մասնագետին թույլ է տալիս ստուգել իր կայքի անվտանգությունը։ Ի՞նչ տեսակի ցանցահեն է նա։', a: 'Սպիտակ ցանցահեն (White Hat)։' },
    { q: 'Ի՞նչ է փոստաղբը։', a: 'Զանգվածաբար ուղարկվող անցանկալի էլեկտրոնային հաղորդագրություններ, հիմնականում՝ գովազդային բնույթի։' },
    { q: 'Ո՞ր վստահելի հարթակներից է խորհուրդ տրվում ներբեռնել բջջային հավելվածները վնասակար ծրագրերից խուսափելու համար։', a: 'App Store և Google Play։' },
    { q: 'Օգտատերը մուտքագրում է բանկի ճիշտ հասցեն, սակայն հայտնվում է կեղծ կայքում։ Ի՞նչ է կոչվում այս հարձակումը։', a: 'Դեղարար (Pharming)։' },
    { q: 'Ի՞նչ է նշանակում HTTPS արձանագրության վերջին՝ «S» տառը։', a: 'Secure (ապահով)։' },
    { q: 'Ո՞ր վնասակար ծրագիրն է կցվում այլ ֆայլերին և կարողանում ինքնավերարտադրվել։', a: 'Համակարգչային վիրուս (Computer Virus)։' },
    { q: 'Ի՞նչ են կոչվում այն ցանցահենները, որոնք ներխուժում են համակարգեր՝ գումար կամ տվյալներ գողանալու նպատակով։', a: 'Սև ցանցահեններ (Black Hat)։' },
    { q: 'Ի՞նչ է սոցիալական ինժեներիան։', a: 'Մարդկանց հոգեբանական մանիպուլյացիայի և խաբեության միջոցով գաղտնի տեղեկություններ ստանալու մեթոդ։' },
    { q: 'Ո՞ր տեսակի Wi-Fi ցանցերից օգտվելիս է հատկապես պետք զգուշանալ տվյալների գաղտնալսումից։', a: 'Հանրային կամ անապահով Wi-Fi ցանցեր։' },
    { q: 'Ո՞ր երկրում է առաջին անգամ հայտնվել «hacker» եզրույթը։', a: 'ԱՄՆ։' },
    { q: 'Օգտատերը բանկի անունից նամակ է ստանում, որտեղ հղումով պահանջում են մուտքագրել գաղտնաբառը։ Ի՞նչ է կոչվում այս հարձակումը։', a: 'Որսիչ (Phishing)։' },
    { q: 'Ի՞նչ է կոչվում անվտանգության մեթոդը, երբ գաղտնաբառից բացի պահանջվում է նաև երկրորդ հաստատման գործոն։', a: 'Երկգործոն նույնականացում (2FA)։' },
    { q: 'Ինչի՞ միջոցով են համակարգչային որդերը հիմնականում տարածվում։', a: 'Համակարգչային ցանցերի միջոցով։' },
    { q: 'Նշե՛ք առնվազն երկու հակավիրուսային ծրագիր։', a: 'Kaspersky, Avast, Norton, McAfee, Dr.Web։' },
    { q: 'Ցանցահենն առանց թույլտվության հայտնաբերում է կայքի խոցելիությունը, բայց չի օգտագործում այն վնաս պատճառելու համար։ Ի՞նչ տեսակի ցանցահեն է նա։', a: 'Մոխրագույն ցանցահեն (Grey Hat)։' }
  ];

  const W = 1500, H = 900, COLS = 5, ROWS = 3;      // board size in SVG user units
  const CW = W / COLS, CH = H / ROWS;               // nominal cell size
  const COUNT = COLS * ROWS;                        // 15
  const TIME = 20;                                  // seconds
  const SEED = 23770;                               // fixed seed → same puzzle every run (chosen: no tab collisions)
  const STORAGE_KEY = 'cyberquest.threatmatrix.v1';
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  const $ = (s) => document.querySelector(s);

  /** Small deterministic PRNG so the board is identical on every load. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svgEl(name, attrs = {}, parent = null) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------------------------------------------------------
     2. JIGSAW GEOMETRY
     ---------------------------------------------------------
     A grid of (ROWS+1)×(COLS+1) vertices is slightly jittered. Every
     interior edge between two vertices becomes ONE curve (a 10-point
     Bezier chain with a tab). The two pieces that share an edge both use
     that same point list — one forwards, one reversed — so neighbouring
     boundaries are identical by construction: no gaps, no overlaps.
     Outer edges are straight lines, so the board stays a clean rectangle.
     --------------------------------------------------------- */
  const fmt = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;

  /** Build a tabbed edge from A to B as 10 control points. */
  function tabEdge(A, B, rand) {
    const r = () => rand() * 2 - 1;
    const a = 0.04 * r(), b = 0.04 * r(), c = 0.04 * r(), d = 0.04 * r(), e = 0.04 * r();
    const t = 0.095 + rand() * 0.02;                // tab size varies per edge
    const dir = rand() < 0.5 ? -1 : 1;              // tab or socket (relative to the edge normal)
    const ux = B.x - A.x, uy = B.y - A.y;
    const L = Math.hypot(ux, uy);
    const nx = -uy / L, ny = ux / L;
    const uv = [
      [0, 0], [0.2, a], [0.5 + b + d, -t + c], [0.5 - t + b, t + c],
      [0.5 - 2 * t + b - d, 3 * t + c], [0.5 + 2 * t + b - d, 3 * t + c],
      [0.5 + t + b, t + c], [0.5 + b + d, -t + c], [0.8, e], [1, 0]
    ];
    const pts = uv.map(([u, v]) => ({
      x: A.x + ux * u + nx * v * L * dir,
      y: A.y + uy * u + ny * v * L * dir
    }));
    pts[0] = A; pts[9] = B;                          // endpoints are exactly the shared vertices
    return pts;
  }

  /** Path fragment (without the leading M) for an edge point list. */
  function segPath(pts) {
    if (pts.length === 2) return `L${fmt(pts[1])}`;
    return `C${fmt(pts[1])} ${fmt(pts[2])} ${fmt(pts[3])}` +
           `C${fmt(pts[4])} ${fmt(pts[5])} ${fmt(pts[6])}` +
           `C${fmt(pts[7])} ${fmt(pts[8])} ${fmt(pts[9])}`;
  }
  const rev = (pts) => pts.slice().reverse();

  /** Point inside the piece that is farthest from its outline (room for the number badge). */
  function roomiestPoint(d) {
    const pe = svgEl('path', { d }, board);
    const len = pe.getTotalLength();
    const edge = [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let s = 0; s < len; s += 5) {
      const q = pe.getPointAtLength(s);
      edge.push(q.x, q.y);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    pe.remove();
    const ctx = document.createElement('canvas').getContext('2d');
    const path = new Path2D(d);
    let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, bestD = -1;
    for (let y = y0; y <= y1; y += 6) {
      for (let x = x0; x <= x1; x += 6) {
        if (!ctx.isPointInPath(path, x, y)) continue;
        let m = 1e9;
        for (let k = 0; k < edge.length; k += 2) {
          const dx = edge[k] - x, dy = edge[k + 1] - y;
          const dd = dx * dx + dy * dy;
          if (dd < m) m = dd;
        }
        if (m > bestD) { bestD = m; best = { x, y }; }
      }
    }
    return best;
  }

  /** Returns [{ d, r, c, cx, cy }] for all 15 pieces. */
  function buildGeometry(seed = SEED) {
    const rand = mulberry32(seed);
    // Vertices on an UNEVEN grid: columns and rows have different base widths/heights,
    // and every grid line is split slightly differently, so pieces vary a lot in size and shape.
    const colBase = [1.28, 0.80, 1.15, 0.86, 0.96];   // relative column widths
    const rowBase = [0.84, 1.26, 0.92];               // relative row heights
    const split = (base) => {                          // cumulative fractions 0…1
      const w = base.map((b) => b * (0.88 + rand() * 0.24));
      const sum = w.reduce((a, b) => a + b, 0);
      let acc = 0;
      return [0, ...w.map((x) => (acc += x) / sum)];
    };
    const xs = [], ys = [];
    for (let r = 0; r <= ROWS; r++) xs[r] = split(colBase);   // x-positions for each horizontal grid line
    for (let c = 0; c <= COLS; c++) ys[c] = split(rowBase);   // y-positions for each vertical grid line
    const V = [];
    for (let r = 0; r <= ROWS; r++) {
      const row = [];
      for (let c = 0; c <= COLS; c++) row.push({ x: xs[r][c] * W, y: ys[c][r] * H });  // borders stay on the border
      V.push(row);
    }

    // horizontal edges h[r][c]: V[r][c] → V[r][c+1];  vertical edges v[r][c]: V[r][c] → V[r+1][c]
    const h = [], v = [];
    for (let r = 0; r <= ROWS; r++) {
      h[r] = [];
      for (let c = 0; c < COLS; c++) {
        const A = V[r][c], B = V[r][c + 1];
        h[r][c] = (r === 0 || r === ROWS) ? [A, B] : tabEdge(A, B, rand);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      v[r] = [];
      for (let c = 0; c <= COLS; c++) {
        const A = V[r][c], B = V[r + 1][c];
        v[r][c] = (c === 0 || c === COLS) ? [A, B] : tabEdge(A, B, rand);
      }
    }

    const pieces = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = `M${fmt(V[r][c])}` +
          segPath(h[r][c]) +              // top, left→right
          segPath(v[r][c + 1]) +          // right, top→bottom
          segPath(rev(h[r + 1][c])) +     // bottom, right→left
          segPath(rev(v[r][c])) +         // left, bottom→top
          'Z';
        const spot = roomiestPoint(d);
        pieces.push({ d, r, c, cx: spot.x, cy: spot.y });
      }
    }
    return pieces;
  }

  /* ---------------------------------------------------------
     3. BOARD RENDERING
     --------------------------------------------------------- */
  const board = $('#board');
  const piecesLayer = $('#pieces');
  const fxLayer = $('#fx');
  const maskPaths = $('#maskPaths');
  const clipDefs = $('#clipDefs');
  const imageLayer = $('#imageLayer');

  const GEOM = buildGeometry();
  let pieceEls = [];          // piece <g> elements by index (null once removed)
  let generation = 0;         // bumps on reset so stale animation callbacks are ignored

  /** Decorative, restrained pattern: curves, dots, a circuit trace and two soft glows. */
  function decorate(parent, p, i) {
    const rnd = mulberry32(SEED + 101 * (i + 1));
    const x0 = p.cx - CW * 0.75, y0 = p.cy - CH * 0.75, w = CW * 1.5, hh = CH * 1.5;
    const rx = () => x0 + rnd() * w, ry = () => y0 + rnd() * hh;

    // soft glows
    svgEl('circle', { cx: p.cx + (rnd() - .5) * 160, cy: p.cy + (rnd() - .5) * 140, r: 190, fill: 'url(#hl)' }, parent);
    svgEl('circle', { cx: p.cx + (rnd() - .5) * 200, cy: p.cy + (rnd() - .5) * 160, r: 170, fill: 'url(#hlp)' }, parent);

    // fine curved lines
    for (let k = 0; k < 3; k++) {
      const sx = x0 + rnd() * w * .3, sy = ry();
      svgEl('path', {
        d: `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${rx().toFixed(1)} ${ry().toFixed(1)} ${(x0 + w * (.7 + rnd() * .3)).toFixed(1)} ${ry().toFixed(1)}`,
        fill: 'none', stroke: '#8FD8FF', 'stroke-opacity': (0.10 + rnd() * 0.08).toFixed(2), 'stroke-width': 1.2
      }, parent);
    }
    // concentric arc fragment
    const ax = rx(), ay = ry();
    svgEl('circle', { cx: ax.toFixed(1), cy: ay.toFixed(1), r: 60 + rnd() * 50, fill: 'none', stroke: '#7255D9', 'stroke-opacity': .22, 'stroke-width': 1.2, 'stroke-dasharray': '3 7' }, parent);

    // tiny dots
    for (let k = 0; k < 9; k++) {
      svgEl('circle', { cx: rx().toFixed(1), cy: ry().toFixed(1), r: (1 + rnd() * 1.4).toFixed(1), fill: '#BFE6FF', 'fill-opacity': (0.16 + rnd() * 0.18).toFixed(2) }, parent);
    }
    // circuit-like trace
    const tx = rx(), ty = ry(), s1 = 26 + rnd() * 30, s2 = 18 + rnd() * 24, s3 = 22 + rnd() * 26;
    svgEl('path', { d: `M${tx.toFixed(1)} ${ty.toFixed(1)} h${s1.toFixed(1)} v${s2.toFixed(1)} h${s3.toFixed(1)}`, fill: 'none', stroke: '#45D9FF', 'stroke-opacity': .20, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, parent);
    svgEl('circle', { cx: (tx + s1 + s3).toFixed(1), cy: (ty + s2).toFixed(1), r: 3, fill: 'none', stroke: '#45D9FF', 'stroke-opacity': .35, 'stroke-width': 1.2 }, parent);
    // small geometric mark (diamond)
    const gx = rx(), gy = ry(), gs = 7;
    svgEl('path', { d: `M${gx} ${gy - gs} L${gx + gs} ${gy} L${gx} ${gy + gs} L${gx - gs} ${gy}Z`, fill: 'none', stroke: '#8FD8FF', 'stroke-opacity': .20, 'stroke-width': 1.1 }, parent);
  }

  /** (Re)create all 15 pieces, their clip paths, and clear the reveal mask. */
  function buildBoard(withEntrance) {
    piecesLayer.textContent = '';
    clipDefs.textContent = '';
    maskPaths.textContent = '';
    fxLayer.textContent = '';
    pieceEls = [];

    GEOM.forEach((p, i) => {
      const clip = svgEl('clipPath', { id: `clip-${i}` }, clipDefs);
      svgEl('path', { d: p.d }, clip);

      const g = svgEl('g', { class: 'piece' + (withEntrance ? ' enter' : ''), 'data-i': i, tabindex: 0, role: 'button', 'aria-label': `Հարց ${i + 1}` }, piecesLayer);
      if (withEntrance) {
        g.style.setProperty('--d', `${(p.c * 0.07 + p.r * 0.09 + 0.2).toFixed(2)}s`);
        g.addEventListener('animationend', () => g.classList.remove('enter'), { once: true });
      }

      // 1) opaque base fill — NEVER transparent
      svgEl('path', { class: 'p-fill', d: p.d, fill: 'url(#boardGrad)' }, g);
      // 2) decoration, clipped to the piece
      const deco = svgEl('g', { 'clip-path': `url(#clip-${i})` }, g);
      decorate(deco, p, i);
      // 3) state overlays
      svgEl('path', { class: 'p-hl', d: p.d }, g);
      svgEl('path', { class: 'p-lock', d: p.d }, g);
      const hatch = svgEl('g', { class: 'p-hatch', 'clip-path': `url(#clip-${i})` }, g);
      for (let k = -8; k < 12; k++) {
        const x = p.cx - CW * .8 + k * 34;
        svgEl('path', { d: `M${x} ${p.cy + CH * .8} L${x + CH * 1.6} ${p.cy - CH * .8}`, stroke: '#7E96BE', 'stroke-opacity': .10, 'stroke-width': 3, fill: 'none' }, hatch);
      }
      // 4) borders
      svgEl('path', { class: 'p-glowline', d: p.d }, g);
      svgEl('path', { class: 'p-edge', d: p.d }, g);
      // 5) number badge (+ padlock shown when locked)
      const badge = svgEl('g', { class: 'badge', transform: `translate(${p.cx.toFixed(1)} ${p.cy.toFixed(1)})` }, g);
      svgEl('circle', { r: 29 }, badge);
      const txt = svgEl('text', { dy: '.36em' }, badge);
      txt.textContent = String(i + 1);
      const lock = svgEl('g', { class: 'lock-icon', transform: 'translate(27 -27) scale(1.35)' }, badge);
      svgEl('circle', { r: 11 }, lock);
      svgEl('rect', { x: -5, y: -1, width: 10, height: 8, rx: 1.6, fill: '#EAF4FF', 'stroke-width': 0 }, lock);
      svgEl('path', { d: 'M-3 -1 v-2.5 a3 3 0 0 1 6 0 v2.5', fill: 'none', 'stroke-width': 1.6 }, lock);

      pieceEls[i] = g;
    });
    imageLayer.setAttribute('mask', 'url(#revealMask)');
  }

  /** Add a piece's shape to the mask so the picture shows through exactly there. */
  function addToMask(i) {
    if ($(`#m-${i}`)) return;
    svgEl('path', { id: `m-${i}`, d: GEOM[i].d }, maskPaths);
  }

  /* ---------------------------------------------------------
     4. STATE + LOCALSTORAGE
     --------------------------------------------------------- */
  const freshState = () => ({ v: 1, pieces: Array(COUNT).fill('open'), revealed: false });
  let state = loadState();

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.pieces) && s.pieces.length === COUNT &&
          s.pieces.every((x) => x === 'open' || x === 'correct' || x === 'wrong')) {
        return { v: 1, pieces: s.pieces, revealed: !!s.revealed };
      }
    } catch (e) { /* ignore */ }
    return freshState();
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  /** Apply saved state to a freshly built board (no animation). */
  function applyState() {
    state.pieces.forEach((st, i) => {
      if (state.revealed || st === 'correct') {
        addToMask(i);
        pieceEls[i].remove();
        pieceEls[i] = null;
      } else if (st === 'wrong') {
        pieceEls[i].classList.add('locked');
        pieceEls[i].setAttribute('aria-disabled', 'true');
      }
    });
    if (state.revealed) imageLayer.removeAttribute('mask');
    updateRevealButton();
  }

  /* ---------------------------------------------------------
     5. QUESTION MODAL + TIMER
     --------------------------------------------------------- */
  const modal = $('#modal');
  const qNo = $('#qNo'), qText = $('#qText'), qAnswer = $('#qAnswer');
  const btnStart = $('#btnStart'), btnCorrect = $('#btnCorrect'), btnWrong = $('#btnWrong');
  const timerBox = $('#timer'), timerNum = $('#timerNum'), ring = $('#ring'), timeUp = $('#timeUp');
  const RING_LEN = 2 * Math.PI * 94;

  let active = null;          // index of the open question, or null
  let timerId = null;         // the ONE interval handle (never more than one)
  let endAt = 0;
  let busy = false;           // true while the full reveal plays
  let audioCtx = null;

  function openQuestion(i) {
    if (busy || active !== null || state.revealed || state.pieces[i] !== 'open' || !pieceEls[i]) return;
    stopTimer();
    active = i;
    const g = pieceEls[i];
    piecesLayer.appendChild(g);                  // bring to front so the glow is not clipped by neighbours
    g.classList.add('selected');

    qNo.textContent = String(i + 1);
    qText.textContent = QUESTIONS[i].q;
    qAnswer.textContent = 'Պատասխան՝ ' + QUESTIONS[i].a;
    qAnswer.hidden = true;                       // teacher can peek with the "A" key
    resetTimerUI();
    modal.hidden = false;
    btnStart.focus({ preventScroll: true });
  }

  function resetTimerUI() {
    timerNum.textContent = String(TIME);
    ring.style.strokeDasharray = RING_LEN;
    ring.style.strokeDashoffset = 0;
    setTimerColor(TIME);
    timerBox.classList.remove('urgent');
    timeUp.hidden = true;
    btnStart.disabled = false;
  }

  function setTimerColor(shown) {
    timerBox.classList.remove('cyan', 'amber', 'red');
    timerBox.classList.add(shown > 10 ? 'cyan' : shown > 5 ? 'amber' : 'red');
    timerBox.classList.toggle('urgent', shown <= 5 && shown > 0);
  }

  function stopTimer() {
    if (timerId !== null) { clearInterval(timerId); timerId = null; }
  }

  function startTimer() {
    if (active === null || timerId !== null || btnStart.disabled) return;
    ensureAudio();
    btnStart.disabled = true;
    endAt = performance.now() + TIME * 1000;
    tick();
    timerId = setInterval(tick, 50);
  }

  function tick() {
    const remaining = Math.max(0, (endAt - performance.now()) / 1000);
    const shown = Math.ceil(remaining - 1e-6);
    timerNum.textContent = String(shown);
    ring.style.strokeDashoffset = String(RING_LEN * (1 - remaining / TIME));   // ring shrinks smoothly
    setTimerColor(shown);
    if (remaining <= 0) {
      stopTimer();
      timerNum.textContent = '0';
      timerBox.classList.remove('urgent');
      timeUp.hidden = false;
      beep();
      // NOTE: the answer is NOT marked automatically — the teacher decides.
    }
  }

  /** Close the modal without answering (Esc). */
  function closeQuestion() {
    if (active === null) return;
    stopTimer();
    pieceEls[active] && pieceEls[active].classList.remove('selected');
    active = null;
    modal.hidden = true;
  }

  function answer(correct) {
    if (active === null) return;
    const i = active;
    stopTimer();
    active = null;                               // guard against double clicks
    modal.hidden = true;
    const g = pieceEls[i];
    if (g) g.classList.remove('selected');

    if (correct) {
      state.pieces[i] = 'correct';
      saveState();
      removePiece(i, { delay: 0, duration: 1100 });
    } else {
      state.pieces[i] = 'wrong';
      saveState();
      if (g) { g.classList.add('locked'); g.setAttribute('aria-disabled', 'true'); }
    }
    updateRevealButton();
  }

  /* ---- sound (WebAudio, no files needed) ---- */
  function ensureAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* no audio */ }
  }
  function beep() {
    try {
      ensureAudio();
      const t0 = audioCtx.currentTime;
      [[880, 0], [880, .22], [587, .44]].forEach(([f, dt]) => {
        const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        gn.gain.setValueAtTime(0.0001, t0 + dt);
        gn.gain.exponentialRampToValueAtTime(0.28, t0 + dt + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
        o.connect(gn).connect(audioCtx.destination);
        o.start(t0 + dt); o.stop(t0 + dt + 0.2);
      });
    } catch (e) { /* no audio */ }
  }

  /* ---------------------------------------------------------
     6. ANIMATIONS
     --------------------------------------------------------- */
  /**
   * Make piece i fall off the board. The picture is revealed under it right away
   * (via the mask) so the area underneath is clean as the piece drops away.
   * Returns a promise that resolves when the piece is gone.
   */
  function removePiece(i, { delay = 0, duration = 1100 } = {}) {
    const g = pieceEls[i];
    if (!g) return Promise.resolve();
    pieceEls[i] = null;
    g.style.pointerEvents = 'none';
    g.classList.remove('selected', 'enter');
    addToMask(i);

    const p = GEOM[i];
    const rnd = Math.random;
    const spin = (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 42);
    const dx = (rnd() - 0.5) * 220;
    const fall = H - p.cy + 320;                          // far enough to leave the board
    const frames = (alpha) => [
      { transform: 'translate(0px,0px) rotate(0deg)', opacity: alpha, filter: 'blur(0px)', offset: 0, easing: 'ease-out' },
      { transform: `translate(${dx * 0.04}px,-22px) rotate(${-spin * 0.12}deg)`, opacity: alpha, filter: 'blur(0px)', offset: 0.14, easing: 'cubic-bezier(.5,0,.9,.55)' },
      { transform: `translate(${dx * 0.9}px,${fall}px) rotate(${spin}deg)`, opacity: alpha, filter: 'blur(3px)', offset: 0.82, easing: 'linear' },
      { transform: `translate(${dx}px,${fall + 140}px) rotate(${spin * 1.1}deg)`, opacity: 0, filter: 'blur(4px)', offset: 1 }
    ];
    const opts = (extra = 0) => ({ duration, delay: delay + extra, fill: 'both' });

    // short motion-blur trail: two faint ghosts following slightly behind
    const ghosts = [[0.22, 45], [0.12, 90]].map(([alpha, lag]) => {
      const gh = g.cloneNode(true);
      gh.removeAttribute('tabindex'); gh.removeAttribute('role'); gh.removeAttribute('aria-label');
      gh.style.pointerEvents = 'none';
      piecesLayer.insertBefore(gh, g);
      return { el: gh, anim: gh.animate(frames(alpha), opts(lag)) };
    });
    const main = g.animate(frames(1), opts());

    spawnParticles(p.cx, p.cy, delay + 60, 7);

    const cleanup = () => { g.remove(); ghosts.forEach((x) => x.el.remove()); };
    return Promise.all([main.finished, ...ghosts.map((x) => x.anim.finished)])
      .then(cleanup)
      .catch(cleanup);
  }

  /** Little glowing fragments that scatter and fall. */
  function spawnParticles(cx, cy, delay, n) {
    const colors = ['#45D9FF', '#149DFF', '#7255D9', '#EAF4FF'];
    for (let k = 0; k < n; k++) {
      const c = svgEl('circle', { cx, cy, r: (1.8 + Math.random() * 3).toFixed(1), fill: colors[k % colors.length], opacity: 0 }, fxLayer);
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 110;
      const tx = Math.cos(ang) * dist, ty = Math.sin(ang) * dist * 0.6;
      const a = c.animate([
        { transform: 'translate(0,0)', opacity: 0 },
        { transform: `translate(${tx * 0.5}px,${ty * 0.5 - 10}px)`, opacity: 0.95, offset: 0.2 },
        { transform: `translate(${tx}px,${ty + 260}px)`, opacity: 0 }
      ], { duration: 900 + Math.random() * 500, delay: delay + Math.random() * 120, easing: 'cubic-bezier(.3,.1,.8,.6)', fill: 'both' });
      a.finished.then(() => c.remove()).catch(() => c.remove());
    }
  }

  /** Expanding ring of light at the board centre for the full reveal. */
  function flash() {
    const c = svgEl('circle', { cx: W / 2, cy: H / 2, r: 40, fill: 'none', stroke: '#45D9FF', 'stroke-width': 3, opacity: 0 }, fxLayer);
    const a = c.animate([
      { r: 40, opacity: 0.8, strokeWidth: 6 },
      { r: 900, opacity: 0, strokeWidth: 1 }
    ], { duration: 1600, easing: 'ease-out', fill: 'both' });
    a.finished.then(() => c.remove()).catch(() => c.remove());
  }

  /** Cascade ALL remaining pieces off the board. */
  function revealAll() {
    if (busy || state.revealed) return;
    closeQuestion();
    stopTimer();
    busy = true;
    state.revealed = true;                         // saved immediately: a refresh mid-animation shows the finished picture
    saveState();
    updateRevealButton();
    flash();

    const gen = generation;
    const jobs = [];
    pieceEls.forEach((g, i) => {
      if (!g) return;
      const p = GEOM[i];
      const delay = p.c * 110 + p.r * 90 + Math.random() * 320;     // staggered cascade
      const duration = 1000 + Math.random() * 500;                   // different speeds
      jobs.push(removePiece(i, { delay, duration }));
    });
    Promise.all(jobs).then(() => {
      if (gen !== generation) return;
      imageLayer.removeAttribute('mask');          // picture fully clean, nothing left on top
      busy = false;
      updateRevealButton();
    });
  }

  /* ---------------------------------------------------------
     7. CONTROLS
     --------------------------------------------------------- */
  const btnReveal = $('#btnReveal');
  function updateRevealButton() {
    btnReveal.disabled = state.revealed;
  }

  // piece clicks / keyboard (event delegation)
  board.addEventListener('click', (e) => {
    const g = e.target.closest('.piece');
    if (g) openQuestion(Number(g.dataset.i));
  });
  board.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('.piece');
    if (g) { e.preventDefault(); openQuestion(Number(g.dataset.i)); }
  });

  btnStart.addEventListener('click', startTimer);
  btnCorrect.addEventListener('click', () => answer(true));
  btnWrong.addEventListener('click', () => answer(false));
  btnReveal.addEventListener('click', revealAll);

  // keyboard: Esc closes a question (no result recorded); A peeks at the answer (teacher only)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#confirm').hidden) { $('#confirm').hidden = true; return; }
      closeQuestion();
    } else if ((e.key === 'a' || e.key === 'A') && active !== null) {
      qAnswer.hidden = !qAnswer.hidden;
    }
  });

  // fullscreen
  $('#btnFullscreen').addEventListener('click', () => {
    const d = document, root = d.documentElement;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    if (isFs) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  });

  // reset with confirmation
  const confirmBox = $('#confirm');
  $('#btnReset').addEventListener('click', () => {
    if (busy) return;
    confirmBox.hidden = false;
    $('#confirmNo').focus();
  });
  $('#confirmNo').addEventListener('click', () => { confirmBox.hidden = true; });
  $('#confirmYes').addEventListener('click', () => {
    confirmBox.hidden = true;
    resetGame();
  });

  function resetGame() {
    stopTimer();
    generation++;
    active = null;
    busy = false;
    modal.hidden = true;
    state = freshState();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    buildBoard(true);
    applyState();
  }

  /* ---------------------------------------------------------
     INIT
     --------------------------------------------------------- */
  buildBoard(!state.revealed);
  applyState();

  // tiny hook for automated testing / debugging (does not affect gameplay)
  window.__cq = { get state() { return state; }, GEOM, COUNT, build: buildGeometry };
})();
