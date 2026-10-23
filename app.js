(() => {
'use strict';

/* ---------- menu ---------- */
const burger = document.querySelector('.burger');
const panel = document.getElementById('panel');
burger.addEventListener('click', () => {
  const o = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!o));
  panel.hidden = o;
});
panel.addEventListener('click', e => { if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); panel.hidden = true; } });

/* ---------- dolny pasek po przewinieciu ---------- */
const mob = document.getElementById('mob');
const heroCta = document.getElementById('heroCta');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => {
    mob.classList.toggle('widac', !e.isIntersecting && e.boundingClientRect.top < 0);
  }).observe(heroCta);
}

/* ---------- lightbox ---------- */
const lb = document.getElementById('lb');
document.getElementById('gal').addEventListener('click', e => {
  const f = e.target.closest('figure'); if (!f || !lb.showModal) return;
  const im = f.querySelector('img');
  lb.querySelector('img').src = im.currentSrc || im.src;
  lb.querySelector('img').alt = im.alt;
  lb.showModal();
});
lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'BUTTON') lb.close(); });

/* =========================================================
   KALKULATOR DACHU
   ========================================================= */
const $ = id => document.getElementById(id);
const svg = $('dom');
const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const fmt = (v, d = 1) => v.toLocaleString('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = v => Math.round(v).toLocaleString('pl-PL');

const TYPY = {
  dwu:     { nazwa: 'dwuspadowy',          kat: 40, hint: 'Typowo 35-45° dla domu z poddaszem.' },
  cztero:  { nazwa: 'czterospadowy',       kat: 30, hint: 'Typowo 25-35° dla dachu czterospadowego.' },
  lukarny: { nazwa: 'dwuspadowy z lukarnami', kat: 42, hint: 'Lukarny wymagają zwykle kąta 38-45°.' },
  jedno:   { nazwa: 'jednospadowy',        kat: 12, hint: 'Typowo 8-20° dla garażu, wiaty, budynku gospodarczego.' },
  plaski:  { nazwa: 'płaski',              kat: 3,  hint: 'Dach płaski ma zwykle 2-5° spadku.' }
};
const MAT = {
  blacho: { nazwa: 'blachodachówka',       c: [59, 64, 70],  kursy: 0.35, szwy: 0,    kg: '5-7' },
  rabek:  { nazwa: 'blacha na rąbek',      c: [48, 54, 60],  kursy: 0,    szwy: 0.5,  kg: '5-7' },
  ceram:  { nazwa: 'dachówka ceramiczna',  c: [166, 72, 45], kursy: 0.33, szwy: 0.3,  kg: '40-55' },
  beton:  { nazwa: 'dachówka betonowa',    c: [90, 81, 75],  kursy: 0.33, szwy: 0.33, kg: '40-50' },
  papa:   { nazwa: 'papa / gont bitumiczny', c: [43, 46, 49], kursy: 1.0, szwy: 0,    kg: '5-12' }
};
const RAFT = 0.9; // rozstaw krokwi

const S = {
  typ: 'dwu', L: 12, W: 9, Hw: 3, kat: 40, okap: 0.6, mat: 'ceram', luk: 2, okna: 2,
  nieWiem: false, widok: 'krycie'
};

/* ---- projekcja aksonometryczna ---- */
const TH = 32 * DEG, PH = 24 * DEG;
const cT = Math.cos(TH), sT = Math.sin(TH), cP = Math.cos(PH), sP = Math.sin(PH);
const FWD = [-sT * cP, cT * cP, -sP];          // kierunek patrzenia
const LIGHT = norm([-0.55, -0.75, 0.95]);
function norm(v) { const l = Math.hypot(...v); return v.map(a => a / l); }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function P([x, y, z]) {
  const xr = x * cT + y * sT;
  const d = -x * sT + y * cT;
  return [xr, -z * cP - d * sP];
}
function depth([x, y, z]) { const d = -x * sT + y * cT; return d * cP - z * sP; }
function centroid(pts) { const c = [0, 0, 0]; pts.forEach(p => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); return c.map(v => v / pts.length); }
function normal(pts, ref) {
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) { // Newell
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  n = norm(n);
  if (ref && dot(n, sub(centroid(pts), ref)) < 0) n = n.map(v => -v);
  return n;
}
const visible = n => dot(n, FWD) < -0.001;
const shade = n => 0.62 + 0.38 * Math.max(0, dot(n, LIGHT));
const rgb = (c, k = 1, a = 1) => `rgba(${c.map(v => Math.round(Math.min(255, v * k))).join(',')},${a})`;

/* ---- geometria dachu ---- */
function geom() {
  const { typ, L, W, Hw } = S;
  const t = Math.tan(S.kat * DEG);
  const o = typ === 'plaski' ? Math.min(S.okap, 0.4) : S.okap;
  const x0 = -o, x1 = L + o, y0 = -o, y1 = W + o;
  const Lp = x1 - x0, Wp = y1 - y0;
  const g = { t, o, x0, x1, y0, y1, Lp, Wp, Hw, typ, L, W, walls: [], roof: [], lines: [], dorm: [], beams: [] };

  if (typ === 'plaski') {
    const zt = Hw + 0.35;              // gora attyki/plyty
    g.ze = zt; g.zr = zt + Wp * t;
    g.z = (x, y) => zt + (y1 - y) * t; // spadek do tylu
  } else {
    g.ze = Hw - o * t;
    if (typ === 'jedno') g.z = (x, y) => g.ze + (y - y0) * t;
    else if (typ === 'cztero') g.z = (x, y) => g.ze + Math.min(x - x0, x1 - x, y - y0, y1 - y) * t;
    else g.z = (x, y) => g.ze + Math.min(y - y0, y1 - y) * t;
  }
  const z = g.z, ze = g.ze;
  const C = [L / 2, W / 2, Hw / 2];

  /* sciany */
  const wall = (pts, id) => g.walls.push({ pts, id, n: normal(pts, C) });
  if (typ === 'dwu' || typ === 'lukarny') {
    const zr = Hw + (W / 2) * t;
    wall([[0, 0, 0], [L, 0, 0], [L, 0, Hw], [0, 0, Hw]], 'F');
    wall([[0, W, 0], [L, W, 0], [L, W, Hw], [0, W, Hw]], 'B');
    wall([[0, 0, 0], [0, W, 0], [0, W, Hw], [0, W / 2, zr], [0, 0, Hw]], 'Lw');
    wall([[L, 0, 0], [L, W, 0], [L, W, Hw], [L, W / 2, zr], [L, 0, Hw]], 'Rw');
  } else if (typ === 'jedno') {
    const zb = Hw + W * t;
    wall([[0, 0, 0], [L, 0, 0], [L, 0, Hw], [0, 0, Hw]], 'F');
    wall([[0, W, 0], [L, W, 0], [L, W, zb], [0, W, zb]], 'B');
    wall([[0, 0, 0], [0, W, 0], [0, W, zb], [0, 0, Hw]], 'Lw');
    wall([[L, 0, 0], [L, W, 0], [L, W, zb], [L, 0, Hw]], 'Rw');
  } else {
    const h = typ === 'plaski' ? Hw + 0.35 : Hw;
    wall([[0, 0, 0], [L, 0, 0], [L, 0, h], [0, 0, h]], 'F');
    wall([[0, W, 0], [L, W, 0], [L, W, h], [0, W, h]], 'B');
    wall([[0, 0, 0], [0, W, 0], [0, W, h], [0, 0, h]], 'Lw');
    wall([[L, 0, 0], [L, W, 0], [L, W, h], [L, 0, h]], 'Rw');
  }

  /* polacie */
  const RC = [L / 2, W / 2, Hw - 2];
  const face = (pts, id, extra = {}) => g.roof.push(Object.assign({ pts, id, n: normal(pts, RC) }, extra));
  if (typ === 'dwu' || typ === 'lukarny') {
    const zr = z(0, W / 2);
    face([[x0, y0, ze], [x1, y0, ze], [x1, W / 2, zr], [x0, W / 2, zr]], 'F');
    face([[x0, y1, ze], [x1, y1, ze], [x1, W / 2, zr], [x0, W / 2, zr]], 'B');
    g.zr = zr;
  } else if (typ === 'cztero') {
    const h = Math.min(Lp, Wp) / 2, zr = ze + h * t;
    const R1 = [x0 + h, y0 + h, zr], R2 = [x1 - h, y1 - h, zr];
    const c00 = [x0, y0, ze], c10 = [x1, y0, ze], c11 = [x1, y1, ze], c01 = [x0, y1, ze];
    if (Lp >= Wp) {
      face([c00, c10, R2, R1], 'F'); face([c01, c11, R2, R1], 'B');
      face([c00, c01, R1], 'L'); face([c10, c11, R2], 'R');
    } else {
      face([c00, c10, R1], 'F'); face([c01, c11, R2], 'B');
      face([c00, c01, R2, R1], 'L'); face([c10, c11, R2, R1], 'R');
    }
    g.zr = zr; g.h = h; g.R1 = R1; g.R2 = R2;
  } else if (typ === 'jedno') {
    face([[x0, y0, ze], [x1, y0, ze], [x1, y1, z(0, y1)], [x0, y1, z(0, y1)]], 'F');
  } else {
    const zf = g.ze;
    face([[x0, y0, z(0, y0)], [x1, y0, z(0, y0)], [x1, y1, zf], [x0, y1, zf]], 'F', { flat: true });
    // obrzeza plyty
    const zb = Hw + 0.05;
    const fas = (pts, id) => g.roof.push({ pts, id, n: normal(pts, RC), fas: true });
    fas([[x0, y0, zb], [x1, y0, zb], [x1, y0, z(0, y0)], [x0, y0, z(0, y0)]], 'fF');
    fas([[x1, y0, zb], [x1, y1, zb], [x1, y1, zf], [x1, y0, z(0, y0)]], 'fR');
    fas([[x0, y0, zb], [x0, y1, zb], [x0, y1, zf], [x0, y0, z(0, y0)]], 'fL');
    fas([[x0, y1, zb], [x1, y1, zb], [x1, y1, zf], [x0, y1, zf]], 'fB');
  }

  /* lukarny */
  if (typ === 'lukarny') {
    const n = S.luk, wd = Math.min(1.9, L / (n + 1.2)), yd = 0.35;
    const zb = Hw + yd * t, zt = zb + 1.3, ad = Math.tan(40 * DEG), ov = 0.15;
    const yAt = zz => y0 + (zz - ze) / t;
    let zrd = zt + (wd / 2) * ad;
    zrd = Math.min(zrd, g.zr - 0.35);
    const zed = zt - ov * ad;
    for (let k = 0; k < n; k++) {
      const xc = L * (k + 1) / (n + 1), xl = xc - wd / 2, xr = xc + wd / 2;
      const zg = zt + (wd / 2) * ad > zrd ? zrd : zt + (wd / 2) * ad;
      const DC = [xc, yd + 0.8, zb + 0.4];
      const parts = [];
      const dp = (pts, id, kind) => parts.push({ pts, id, kind, n: normal(pts, DC) });
      dp([[xl, yd, zb], [xr, yd, zb], [xr, yd, zt], [xc, yd, zg], [xl, yd, zt]], 'dF', 'wall');
      dp([[xl, yd, zb], [xl, yd, zt], [xl, yAt(zt), zt]], 'dL', 'wall');
      dp([[xr, yd, zb], [xr, yd, zt], [xr, yAt(zt), zt]], 'dR', 'wall');
      dp([[xl - ov, yd - ov, zed], [xc, yd - ov, zrd], [xc, yAt(zrd), zrd], [xl - ov, yAt(zed), zed]], 'dRL', 'roof');
      dp([[xr + ov, yd - ov, zed], [xc, yd - ov, zrd], [xc, yAt(zrd), zrd], [xr + ov, yAt(zed), zed]], 'dRR', 'roof');
      // okno lukarny
      const wx = Math.min(0.55, wd * 0.3);
      parts.push({ okno: true, pts: [[xc - wx, yd - 0.01, zb + 0.25], [xc + wx, yd - 0.01, zb + 0.25], [xc + wx, yd - 0.01, zt - 0.15], [xc - wx, yd - 0.01, zt - 0.15]] });
      g.dorm.push({ xc, parts, d: depth(DC), area: 2 * ((wd / 2 + ov) / Math.cos(40 * DEG)) * (((yAt(zed) + yAt(zrd)) / 2) - (yd - ov)), hole: (wd * (yAt(zt) - yd) + 0.5 * wd * (yAt(zrd) - yAt(zt))) / Math.cos(S.kat * DEG) });
    }
    g.dWd = wd;
  }
  return g;
}

/* ---- linie na polaciach (kursy dachowek, szwy, krokwie) ---- */
function linesFor(g, spacing, kind) {
  // kind: 'kursy' = linie poziome (warstwice), 'szwy' = linie w dol spadku (jak krokwie)
  const { x0, x1, y0, y1, z, typ } = g;
  const out = [];
  const L3 = (a, b, f) => out.push({ a: [a[0], a[1], z(a[0], a[1])], b: [b[0], b[1], z(b[0], b[1])], f });
  if (kind === 'kursy') {
    const step = spacing * Math.cos(S.kat * DEG);
    if (typ === 'cztero') {
      for (let r = step; r < g.h - 0.02; r += step) {
        L3([x0 + r, y0 + r], [x1 - r, y0 + r], 'F');
        L3([x0 + r, y1 - r], [x1 - r, y1 - r], 'B');
        L3([x0 + r, y0 + r], [x0 + r, y1 - r], 'L');
        L3([x1 - r, y0 + r], [x1 - r, y1 - r], 'R');
      }
    } else if (typ === 'jedno' || typ === 'plaski') {
      for (let y = y0 + step; y < y1 - 0.02; y += step) L3([x0, y], [x1, y], 'F');
    } else {
      const ym = (y0 + y1) / 2;
      for (let r = step; r < ym - y0 - 0.02; r += step) { L3([x0, y0 + r], [x1, y0 + r], 'F'); L3([x0, y1 - r], [x1, y1 - r], 'B'); }
    }
  } else {
    const xs = []; for (let x = x0 + 0.08; x <= x1 - 0.07; x += spacing) xs.push(x);
    if (typ === 'cztero') {
      const h = g.h;
      xs.forEach(x => { const r = Math.min(x - x0, x1 - x, h); if (r > 0.12) { L3([x, y0], [x, y0 + r], 'F'); L3([x, y1], [x, y1 - r], 'B'); } });
      for (let y = y0 + 0.08; y <= y1 - 0.07; y += spacing) { const r = Math.min(y - y0, y1 - y, h); if (r > 0.12) { L3([x0, y], [x0 + r, y], 'L'); L3([x1, y], [x1 - r, y], 'R'); } }
    } else if (typ === 'jedno' || typ === 'plaski') {
      xs.forEach(x => L3([x, y0], [x, y1], 'F'));
    } else {
      const ym = (y0 + y1) / 2;
      xs.forEach(x => { L3([x, y0], [x, ym], 'F'); L3([x, y1], [x, ym], 'B'); });
    }
  }
  return out;
}

/* ---- obliczenia ---- */
function calc(g) {
  const cosA = Math.cos(S.kat * DEG);
  let area = g.Lp * g.Wp / cosA;
  if (g.typ === 'lukarny') g.dorm.forEach(d => { area += d.area - d.hole; });
  let rynny, kalenica = 0, naroza = 0;
  if (g.typ === 'cztero') {
    rynny = 2 * (g.Lp + g.Wp);
    kalenica = Math.abs(g.Lp - g.Wp);
    naroza = 4 * Math.sqrt(2 * g.h * g.h + Math.pow(g.h * g.t, 2));
  } else if (g.typ === 'jedno' || g.typ === 'plaski') {
    rynny = g.Lp;
  } else {
    rynny = 2 * g.Lp; kalenica = g.Lp;
  }
  const rury = g.typ === 'jedno' || g.typ === 'plaski' ? Math.max(1, Math.ceil(rynny / 10)) : Math.max(2, Math.ceil(rynny / 10));
  const krokwie = linesFor(g, RAFT, 'szwy');
  const kN = krokwie.length;
  let kMax = 0; krokwie.forEach(l => { kMax = Math.max(kMax, Math.hypot(...sub(l.b, l.a))); });
  return { area, rynny, rury, kalenica, naroza, kN, kMax };
}

/* ---- rysowanie ---- */
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(e);
  return e;
}
const pstr = pts => pts.map(p => P(p).map(v => v.toFixed(2)).join(',')).join(' ');

function draw() {
  const g = geom();
  const R = calc(g);
  const m = MAT[S.mat];
  const wiezba = S.widok === 'wiezba';

  // granice rysunku
  const all = [];
  g.walls.forEach(w => all.push(...w.pts)); g.roof.forEach(f => all.push(...f.pts));
  all.push([g.x0 - 1.6, g.y0 - 1.4, 0], [g.x1 + 1.4, g.y0 - 1.4, 0], [g.x1 + 1.4, g.y1 + 0.5, 0], [g.x0 - 1.6, g.y0, 2]);
  const pp = all.map(P);
  let minX = Math.min(...pp.map(p => p[0])), maxX = Math.max(...pp.map(p => p[0]));
  let minY = Math.min(...pp.map(p => p[1])), maxY = Math.max(...pp.map(p => p[1]));
  const padX = (maxX - minX) * 0.06, padY = (maxY - minY) * 0.1;
  minX -= padX; maxX += padX; minY -= padY * 1.6; maxY += padY * 1.1;
  const narrow = svg.getBoundingClientRect().width < 600;
  if (narrow) minY -= (maxY - minY) * 0.16;
  // dopasuj do proporcji kontenera
  const box = svg.getBoundingClientRect();
  const ar = box.width > 10 && box.height > 10 ? box.width / box.height : 800 / 520;
  let w = maxX - minX, h = maxY - minY;
  if (w / h < ar) { const nw = h * ar; minX -= (nw - w) / 2; w = nw; } else { const nh = w / ar; minY -= (nh - h) / 2; h = nh; }
  svg.setAttribute('viewBox', `${minX.toFixed(2)} ${minY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  const px = w / (box.width || 800); // metry na piksel ekranu
  svg.textContent = '';

  const defs = el('defs', {});
  const fl = el('filter', { id: 'blur', x: '-20%', y: '-50%', width: '140%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: (0.35).toFixed(2) }, fl);

  // cien
  const sh = 0.5;
  el('polygon', { points: pstr([[g.x0 - sh * 0.2, g.y0 + 0.2, 0], [g.x1 + sh, g.y0 + 0.3, 0], [g.x1 + sh * 1.8, g.y1 + sh, 0], [g.x0 + sh, g.y1 + sh, 0]]), fill: 'rgba(60,50,40,.13)', filter: 'url(#blur)' });

  // wymiary
  dims(g, px);
  person(g);

  // sciany
  const WALL = [236, 231, 223];
  g.walls.filter(w => visible(w.n)).sort((a, b) => depth(centroid(b.pts)) - depth(centroid(a.pts))).forEach(wl => {
    el('polygon', { points: pstr(wl.pts), fill: rgb(WALL, shade(wl.n)), stroke: 'rgba(40,40,40,.35)', 'stroke-width': px * 0.9, 'stroke-linejoin': 'round' });
    openings(g, wl, px);
  });

  if (wiezba) drawTimber(g, px);
  else drawRoof(g, m, px);

  // wynik
  results(g, R);
}

function openings(g, wl, px) {
  const glass = '#33404b', frame = '#fbfaf7';
  const { L, W, Hw, typ } = g;
  const small = L < 7 && W < 7;
  const win = (pts) => {
    el('polygon', { points: pstr(pts), fill: frame, stroke: 'rgba(0,0,0,.25)', 'stroke-width': px * 0.7 });
    const c = centroid(pts);
    const ins = pts.map(p => [c[0] + (p[0] - c[0]) * 0.82, c[1] + (p[1] - c[1]) * 0.86, c[2] + (p[2] - c[2]) * 0.86]);
    el('polygon', { points: pstr(ins), fill: glass });
  };
  if (wl.id === 'F') {
    const y = -0.02;
    if (small) {
      if (typ === 'jedno' || W <= 4.5) return;
      const gw = Math.min(2.6, L * 0.55), gx = (L - gw) / 2; // brama garazowa
      el('polygon', { points: pstr([[gx, y, 0], [gx + gw, y, 0], [gx + gw, y, 2.1], [gx, y, 2.1]]), fill: '#d9d4cb', stroke: 'rgba(0,0,0,.25)', 'stroke-width': px * 0.7 });
      for (let k = 1; k < 5; k++) { const zz = 2.1 * k / 5; el('line', Object.assign(seg([gx, y, zz], [gx + gw, y, zz]), { stroke: 'rgba(0,0,0,.18)', 'stroke-width': px * 0.7 })); }
      return;
    }
    const dx = L * 0.5 - 0.5;
    el('polygon', { points: pstr([[dx, y, 0], [dx + 1.0, y, 0], [dx + 1.0, y, 2.1], [dx, y, 2.1]]), fill: '#7a4f33', stroke: 'rgba(0,0,0,.3)', 'stroke-width': px * 0.7 });
    // okna rozlozone symetrycznie po obu stronach drzwi
    const side = (from, to) => {
      const len = to - from; if (len < 1.6) return;
      const cnt = Math.max(1, Math.floor(len / 3));
      for (let k = 0; k < cnt; k++) {
        const c = from + len * (k + 0.5) / cnt;
        win([[c - 0.6, y, 0.9], [c + 0.6, y, 0.9], [c + 0.6, y, 2.3], [c - 0.6, y, 2.3]]);
      }
    };
    side(0.2, dx - 0.3); side(dx + 1.3, L - 0.2);
  } else if (wl.id === 'Rw' && !small) {
    const x = L + 0.02;
    const cnt = W > 8 ? 2 : 1;
    for (let k = 0; k < cnt; k++) {
      const c = W * (k + 1) / (cnt + 1);
      win([[x, c - 0.6, 0.9], [x, c + 0.6, 0.9], [x, c + 0.6, 2.3], [x, c - 0.6, 2.3]]);
    }
    if ((typ === 'dwu' || typ === 'lukarny') && Hw + (W / 2) * g.t > Hw + 2.4) {
      const zt = Hw + 0.5;
      win([[x, W / 2 - 0.45, zt], [x, W / 2 + 0.45, zt], [x, W / 2 + 0.45, zt + 1.1], [x, W / 2 - 0.45, zt + 1.1]]);
    }
  }
}
function seg(a, b) { const A = P(a), B = P(b); return { x1: A[0].toFixed(2), y1: A[1].toFixed(2), x2: B[0].toFixed(2), y2: B[1].toFixed(2) }; }

function drawRoof(g, m, px) {
  const faces = g.roof.filter(f => visible(f.n)).sort((a, b) => depth(centroid(b.pts)) - depth(centroid(a.pts)));
  const kursy = m.kursy ? linesFor(g, m.kursy, 'kursy') : [];
  const szwy = m.szwy ? linesFor(g, m.szwy, 'szwy') : [];
  const dark = S.mat === 'ceram' ? 0.62 : 0.55;
  faces.forEach(f => {
    const k = shade(f.n);
    if (f.fas) { el('polygon', { points: pstr(f.pts), fill: rgb([70, 74, 78], k), stroke: 'rgba(0,0,0,.3)', 'stroke-width': px * 0.8 }); return; }
    el('polygon', { points: pstr(f.pts), fill: rgb(m.c, k), stroke: rgb(m.c, 0.45), 'stroke-width': px * 1.1, 'stroke-linejoin': 'round' });
    const gk = el('g', { 'stroke-linecap': 'butt' });
    kursy.filter(l => l.f === f.id).forEach(l => el('line', Object.assign(seg(l.a, l.b), { stroke: rgb(m.c, k * dark, 0.9), 'stroke-width': px * (S.mat === 'papa' ? 0.8 : 1.15) }), gk));
    szwy.filter(l => l.f === f.id).forEach(l => el('line', Object.assign(seg(l.a, l.b), { stroke: S.mat === 'rabek' ? rgb(m.c, k * 1.55, 0.85) : rgb(m.c, k * dark, 0.45), 'stroke-width': px * (S.mat === 'rabek' ? 1.1 : 0.7) }), gk));
    // okna dachowe na przedniej polaci
    if (f.id === 'F' && !f.flat && document.getElementById('zOkna').checked) skylights(g, f, k, px);
    // kalenica / naroza
  });
  // linia kalenicy
  if (g.typ === 'dwu' || g.typ === 'lukarny') {
    el('line', Object.assign(seg([g.x0, (g.y0 + g.y1) / 2, g.zr], [g.x1, (g.y0 + g.y1) / 2, g.zr]), { stroke: rgb(m.c, 0.45), 'stroke-width': px * 3, 'stroke-linecap': 'round' }));
  } else if (g.typ === 'cztero') {
    const c = [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]];
    el('line', Object.assign(seg(g.R1, g.R2), { stroke: rgb(m.c, 0.45), 'stroke-width': px * 3, 'stroke-linecap': 'round' }));
    c.forEach(p => {
      const cp = [p[0], p[1], g.ze];
      const top = (Math.abs(p[0] - g.R1[0]) + Math.abs(p[1] - g.R1[1]) <= Math.abs(p[0] - g.R2[0]) + Math.abs(p[1] - g.R2[1])) ? g.R1 : g.R2;
      // naroze tylne zasloniete - rysuj tylko widoczne (przod i prawa strona)
      if (p[1] === g.y1 && p[0] === g.x0) return;
      el('line', Object.assign(seg(cp, top), { stroke: rgb(m.c, 0.5, 0.9), 'stroke-width': px * 2.4, 'stroke-linecap': 'round' }));
    });
  }
  // lukarny
  if (g.dorm.length) drawDormers(g, m, px, false);
}

function skylights(g, f, k, px) {
  let n = S.okna; if (!n) return;
  const { x0, x1, y0, z } = g;
  const run = (g.typ === 'cztero' ? g.h : (g.typ === 'jedno' ? g.Wp : g.Wp / 2));
  const cos = Math.cos(S.kat * DEG);
  const hw = 0.39, hl = 0.59 * cos; // 78 x 118 cm
  const yc = y0 + run * (g.typ === 'jedno' ? 0.45 : 0.5);
  let xa = x0 + 0.9, xb = x1 - 0.9;
  if (g.typ === 'cztero') { xa = x0 + (yc - y0) + 0.7; xb = x1 - (yc - y0) - 0.7; }
  let xs = [];
  if (g.typ === 'lukarny') {
    const ds = g.dorm.map(d => d.xc), pts = [x0 + 0.2, ...ds, x1 - 0.2];
    for (let i = 0; i < pts.length - 1 && xs.length < n; i++) xs.push((pts[i] + pts[i + 1]) / 2);
  } else {
    if (xb - xa < 1) return;
    n = Math.min(n, Math.max(1, Math.floor((xb - xa) / 1.3)));
    for (let i = 0; i < n; i++) xs.push(xa + (xb - xa) * (i + 1) / (n + 1));
  }
  xs.forEach(xc => {
    const q = [[xc - hw, yc - hl], [xc + hw, yc - hl], [xc + hw, yc + hl], [xc - hw, yc + hl]].map(([x, y]) => [x, y, z(x, y) + 0.04]);
    el('polygon', { points: pstr(q), fill: '#3a3f44', stroke: '#2a2d30', 'stroke-width': px * 0.8 });
    const c = centroid(q);
    const ins = q.map(p => [c[0] + (p[0] - c[0]) * 0.8, c[1] + (p[1] - c[1]) * 0.86, c[2] + (p[2] - c[2]) * 0.86]);
    el('polygon', { points: pstr(ins), fill: rgb([120, 150, 172], k * 1.05) });
    const a = ins[3], b = ins[2];
    el('polygon', { points: pstr([a, b, [b[0], b[1] - 0.12, b[2] - 0.1 * g.t], [a[0], a[1] - 0.12, a[2] - 0.1 * g.t]]), fill: 'rgba(255,255,255,.25)' });
  });
}

function drawDormers(g, m, px, wiezba) {
  const WALL = [236, 231, 223];
  g.dorm.slice().sort((a, b) => b.d - a.d).forEach(d => {
    d.parts.filter(p => p.okno || visible(p.n)).sort((a, b) => (a.okno ? 1 : 0) - (b.okno ? 1 : 0) || (a.kind === 'roof') - (b.kind === 'roof') || depth(centroid(b.pts)) - depth(centroid(a.pts))).forEach(p => {
      if (p.okno) {
        el('polygon', { points: pstr(p.pts), fill: '#fbfaf7', stroke: 'rgba(0,0,0,.25)', 'stroke-width': px * 0.7 });
        const c = centroid(p.pts);
        el('polygon', { points: pstr(p.pts.map(q => [c[0] + (q[0] - c[0]) * 0.78, q[1], c[2] + (q[2] - c[2]) * 0.84])), fill: '#33404b' });
        return;
      }
      const k = shade(p.n);
      if (p.kind === 'wall') el('polygon', { points: pstr(p.pts), fill: rgb(WALL, k), stroke: 'rgba(40,40,40,.35)', 'stroke-width': px * 0.8, 'stroke-linejoin': 'round' });
      else if (wiezba) el('polygon', { points: pstr(p.pts), fill: 'rgba(214,176,122,.18)', stroke: '#9b6e3c', 'stroke-width': px * 1.2 });
      else {
        el('polygon', { points: pstr(p.pts), fill: rgb(m.c, k), stroke: rgb(m.c, 0.45), 'stroke-width': px * 1.1, 'stroke-linejoin': 'round' });
        if (m.kursy) { // kursy na lukarnie
          const [a, b, c2, e] = p.pts; const N = Math.max(2, Math.round(Math.hypot(...sub(e, a)) / m.kursy));
          for (let i = 1; i < N; i++) { const t = i / N; const A = a.map((v, j) => v + (e[j] - v) * t), B = b.map((v, j) => v + (c2[j] - v) * t); el('line', Object.assign(seg(A, B), { stroke: rgb(m.c, k * 0.6, 0.85), 'stroke-width': px })); }
        }
      }
    });
  });
}

function beam(a, b, px, wd = 2.6) {
  el('line', Object.assign(seg(a, b), { stroke: '#8e6337', 'stroke-width': px * (wd + 1.8), 'stroke-linecap': 'round' }));
  el('line', Object.assign(seg(a, b), { stroke: '#dcb57f', 'stroke-width': px * wd, 'stroke-linecap': 'round' }));
}
function drawTimber(g, px) {
  // polacie jako przezroczyste plaszczyzny
  g.roof.filter(f => !f.fas).forEach(f => el('polygon', { points: pstr(f.pts), fill: 'rgba(214,176,122,.10)', stroke: 'rgba(142,99,55,.45)', 'stroke-width': px * 0.9, 'stroke-dasharray': `${px * 5} ${px * 4}` }));
  const bw = Math.max(2.2, 0.11 / px / 1); // grubosc krokwi ~ 11 cm w skali
  const segs = linesFor(g, RAFT, 'szwy').map(l => ({ a: l.a, b: l.b, w: bw }));
  // murlaty
  const { L, W, Hw, typ } = g;
  if (typ !== 'plaski') {
    if (typ !== 'jedno') { segs.push({ a: [0, 0.07, Hw], b: [L, 0.07, Hw], w: bw * 1.2 }); segs.push({ a: [0, W - 0.07, Hw], b: [L, W - 0.07, Hw], w: bw * 1.2 }); }
    else { segs.push({ a: [0, 0.07, Hw], b: [L, 0.07, Hw], w: bw * 1.2 }); segs.push({ a: [0, W - 0.07, Hw + W * g.t], b: [L, W - 0.07, Hw + W * g.t], w: bw * 1.2 }); }
    if (typ === 'cztero') { segs.push({ a: [0.07, 0, Hw], b: [0.07, W, Hw], w: bw * 1.2 }); segs.push({ a: [L - 0.07, 0, Hw], b: [L - 0.07, W, Hw], w: bw * 1.2 }); }
  }
  if (typ === 'dwu' || typ === 'lukarny') {
    const ym = (g.y0 + g.y1) / 2;
    segs.push({ a: [g.x0, ym, g.zr - 0.05], b: [g.x1, ym, g.zr - 0.05], w: bw * 1.1 });
    // jetki co druga para
    if (g.zr - Hw > 2.6) {
      const zj = Hw + (g.zr - Hw) * 0.62, dy = (zj - g.ze) / g.t;
      for (let x = g.x0 + 0.08, i = 0; x <= g.x1 - 0.07; x += RAFT, i++) if (i % 2 === 0) segs.push({ a: [x, g.y0 + dy, zj], b: [x, g.y1 - dy, zj], w: bw * 0.8 });
    }
  } else if (typ === 'cztero') {
    segs.push({ a: g.R1, b: g.R2, w: bw * 1.15 });
    [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]].forEach(p => {
      const top = (Math.abs(p[0] - g.R1[0]) + Math.abs(p[1] - g.R1[1]) <= Math.abs(p[0] - g.R2[0]) + Math.abs(p[1] - g.R2[1])) ? g.R1 : g.R2;
      segs.push({ a: [p[0], p[1], g.ze], b: top, w: bw * 1.2 });
    });
  }
  segs.sort((a, b) => depth(centroid([b.a, b.b])) - depth(centroid([a.a, a.b])));
  segs.forEach(s => beam(s.a, s.b, px, s.w));
  if (g.dorm.length) drawDormers(g, null, px, true);
}

function dims(g, px) {
  const col = '#8a8f96';
  const gy = g.y0 - 0.9, gx = g.x1 + 0.9;
  const line = (a, b, label) => {
    el('line', Object.assign(seg(a, b), { stroke: col, 'stroke-width': px }));
    const tick = (p, d) => el('line', Object.assign(seg(sub(p, d), [p[0] + d[0], p[1] + d[1], p[2] + d[2]]), { stroke: col, 'stroke-width': px * 1.2 }));
    const dir = norm(sub(b, a)); const perp = [dir[1] * 0.18, -dir[0] * 0.18, 0];
    tick(a, perp); tick(b, perp);
    const A = P(a), B = P(b);
    let ang = Math.atan2(B[1] - A[1], B[0] - A[0]) / DEG; if (ang > 90 || ang < -90) ang += 180;
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const t = el('text', { x: mx.toFixed(2), y: (my + px * 17).toFixed(2), 'font-size': (px * 13).toFixed(2), 'font-family': 'Archivo, sans-serif', 'font-weight': 600, fill: '#5b6168', 'text-anchor': 'middle', transform: `rotate(${ang.toFixed(1)} ${mx.toFixed(2)} ${my.toFixed(2)})` });
    t.textContent = label;
  };
  line([0, gy, 0], [g.L, gy, 0], fmt(g.L) + ' m');
  line([gx, 0, 0], [gx, g.W, 0], fmt(g.W) + ' m');
}

function person(g) {
  // sylwetka 1,75 m dla skali
  const base = [g.x0 - 1.0, g.y0 - 0.2, 0];
  const top = [base[0], base[1], 1.75];
  const B = P(base), T = P(top), hgt = B[1] - T[1], u = hgt / 1.75;
  const gp = el('g', { fill: '#a6abb1' });
  el('circle', { cx: B[0], cy: (T[1] + 0.12 * u).toFixed(2), r: (0.12 * u).toFixed(2) }, gp);
  el('path', { d: `M${B[0] - 0.2 * u} ${T[1] + 0.3 * u} h${0.4 * u} l${0.04 * u} ${0.62 * u} h${-0.1 * u} l${-0.02 * u} ${0.82 * u} h${-0.08 * u} l${-0.02 * u} ${-0.6 * u} l${-0.02 * u} ${0.6 * u} h${-0.08 * u} l${-0.02 * u} ${-0.82 * u} h${-0.1 * u}z` }, gp);
}

/* ---- wyniki + wiadomosc ---- */
const wyn = $('wyniki');
let last = null;
function results(g, R) {
  last = R;
  const typ = S.typ;
  const rows = [];
  rows.push(['Powierzchnia dachu', `ok. ${fmt0(R.area)} m²`]);
  rows.push(['Rynny', `ok. ${fmt0(R.rynny)} mb`, `rury spustowe: ${R.rury}`]);
  if (typ === 'plaski') rows.push(['Belki stropodachu', `ok. ${R.kN} szt.`, `rozstaw ok. 90 cm`]);
  else rows.push(['Krokwie', `ok. ${R.kN} szt.`, `najdłuższa ok. ${fmt(R.kMax)} m, rozstaw 90 cm`]);
  if (typ === 'cztero') rows.push(['Kalenica i naroża', `${fmt(R.kalenica)} + ${fmt(R.naroza)} m`]);
  else if (R.kalenica) rows.push(['Kalenica', `${fmt(R.kalenica)} m`]);
  else rows.push(['Spadek', `${S.kat}°`, typ === 'plaski' ? 'odwodnienie na tylną krawędź' : 'w stronę frontu']);
  $('wynikiM').innerHTML = wyn.innerHTML = rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}${r[2] ? `<small>${r[2]}</small>` : ''}</dd></div>`).join('');
  $('liveA').textContent = `ok. ${fmt0(R.area)} m²`;
  $('liveB').textContent = `rynny ${fmt0(R.rynny)} mb`;
  message();
}

function message() {
  if (!last) return;
  const R = last, t = TYPY[S.typ];
  const zak = [...document.querySelectorAll('#zakres input:checked')].map(i => i.value);
  const miejsce = $('miejsce').value.trim();
  let s = 'Dzień dobry, proszę o kontakt w sprawie dachu.\n';
  s += `Dach: ${t.nazwa}${S.typ === 'lukarny' ? ` (${S.luk} ${S.luk === 1 ? 'lukarna' : 'lukarny'})` : ''}, budynek ${fmt(S.L)} x ${fmt(S.W)} m, kąt ${S.nieWiem ? 'nie wiem (przyjęto ' + S.kat + '°)' : S.kat + '°'}, okap ${fmt(S.okap, 2).replace(/0$/, '')} m\n`;
  s += `Powierzchnia dachu ok. ${fmt0(R.area)} m², rynny ok. ${fmt0(R.rynny)} mb\n`;
  s += `Pokrycie: ${MAT[S.mat].nazwa}\n`;
  if (zak.length) s += `Zakres: ${zak.join(', ')}\n`;
  if ($('zOkna').checked) s += `Okna dachowe: ${S.okna} szt.\n`;
  if (miejsce) s += `Miejscowość: ${miejsce}\n`;
  s += '(policzone w kalkulatorze na stronie)';
  $('podsum').textContent = s;
  $('bSms').href = 'sms:+48534252915?&body=' + encodeURIComponent(s);
  $('bMail').href = 'mailto:biuro@dachy-orlowski.pl?subject=' + encodeURIComponent('Zapytanie o dach - ' + t.nazwa + ', ok. ' + fmt0(R.area) + ' m2') + '&body=' + encodeURIComponent(s);
}

/* ---- sterowanie ---- */
let raf = 0;
const render = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
const kat = $('kat'), okap = $('okap');
const fill = r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
function setKat(v, fromUser) {
  S.kat = +v; kat.value = v; $('katOut').textContent = v + '°'; fill(kat);
  if (fromUser) { S.nieWiem = false; $('nieWiem').setAttribute('aria-pressed', 'false'); }
}
document.querySelectorAll('input[name=typ]').forEach(r => r.addEventListener('change', () => {
  S.typ = r.value;
  const t = TYPY[S.typ];
  $('katHint').textContent = t.hint;
  $('fsLuk').hidden = S.typ !== 'lukarny';
  kat.min = S.typ === 'plaski' ? 1 : (S.typ === 'jedno' ? 3 : 15);
  kat.max = S.typ === 'plaski' ? 8 : 55;
  setKat(t.kat, false);
  // pokrycie dachu plaskiego
  document.querySelectorAll('input[name=mat]').forEach(m => { m.disabled = S.typ === 'plaski' && m.value !== 'papa'; });
  if (S.typ === 'plaski') { S.mat = 'papa'; document.querySelector('input[name=mat][value=papa]').checked = true; }
  svg.animate && svg.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  render();
}));
kat.addEventListener('input', () => { setKat(kat.value, true); render(); });
okap.addEventListener('input', () => { S.okap = +okap.value; $('okapOut').textContent = fmt(S.okap, 2).replace(/0$/, '') + ' m'; fill(okap); render(); });
$('nieWiem').addEventListener('click', e => {
  S.nieWiem = true; setKat(TYPY[S.typ].kat, false); e.currentTarget.setAttribute('aria-pressed', 'true'); render();
});
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
['dl', 'sz'].forEach(id => $(id).addEventListener('input', () => {
  const v = parseFloat(String($(id).value).replace(',', '.'));
  if (!isFinite(v)) return;
  if (id === 'dl') S.L = clampN(v, 3, 40); else S.W = clampN(v, 2.5, 20);
  document.querySelectorAll('#presety button').forEach(b => b.classList.remove('on'));
  render();
}));
['dl', 'sz'].forEach(id => $(id).addEventListener('blur', () => { $(id).value = id === 'dl' ? S.L : S.W; }));
document.querySelectorAll('#presety button').forEach(b => b.addEventListener('click', () => {
  const [l, w, h] = b.dataset.p.split(',').map(Number);
  S.L = l; S.W = w; S.Hw = h; $('dl').value = l; $('sz').value = w;
  document.querySelectorAll('#presety button').forEach(x => x.classList.toggle('on', x === b));
  render();
}));
document.querySelectorAll('input[name=mat]').forEach(r => r.addEventListener('change', () => { S.mat = r.value; if (S.widok === 'wiezba') setView('krycie'); render(); }));
$('lukN').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.luk = +b.dataset.n; [...$('lukN').children].forEach(x => x.classList.toggle('on', x === b)); render();
});
function setView(v) { S.widok = v; document.querySelectorAll('.k-view button').forEach(b => b.classList.toggle('on', b.dataset.view === v)); }
document.querySelector('.k-view').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setView(b.dataset.view); render(); });
$('zakres').addEventListener('change', e => {
  if (e.target.id === 'zOkna') $('oknaBox').hidden = !e.target.checked;
  if (e.target.value === 'nowa więźba cięta na CNC' && e.target.checked) setView('wiezba');
  render();
});
$('oMinus').addEventListener('click', () => { S.okna = Math.max(1, S.okna - 1); $('oN').textContent = S.okna; render(); });
$('oPlus').addEventListener('click', () => { S.okna = Math.min(6, S.okna + 1); $('oN').textContent = S.okna; render(); });
$('miejsce').addEventListener('input', message);
$('bCopy').addEventListener('click', async () => {
  const txt = $('podsum').textContent;
  try { await navigator.clipboard.writeText(txt); $('bCopy').textContent = 'Skopiowano'; }
  catch { const r = document.createRange(); r.selectNodeContents($('podsum')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('bCopy').textContent = 'Zaznaczono - skopiuj'; }
  setTimeout(() => { $('bCopy').textContent = 'Skopiuj opis'; }, 2200);
});

fill(kat); fill(okap);
let rw = 0;
new ResizeObserver(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w !== rw) { rw = w; render(); } }).observe(svg);
draw();
})();
