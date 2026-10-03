// Generates the mockup illustrations used until real photos arrive.
// Flat scenes drawn in the theme palette, each marked "illustrazione di prova".
//   node scripts/make-mockups.mjs
// Output: src/assets/foto/mockup-*.jpg (2400 x 1600). Replace them with
// real photos and delete the mockup files before launch.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const W = 2400;
const H = 1600;

/* ---------- palette (theme tokens and their tints) ---------- */
const C = {
  paper: '#f5efe3',
  sand: '#ece2d0',
  ink: '#22301f',
  inkSoft: '#34452f',
  honey: '#e5c07a',
  honeyDeep: '#c9a86a',
  earth: '#b89a6e',
  stone: '#cfc6b4',
  stoneDark: '#a99e88',
  roof: '#9c6b4e',
  snow: '#fbfaf6',
  water: '#a9c2bb',
  waterDeep: '#8fb0a8',
  wine: '#7a2f3a',
  greens: ['#dfe7d5', '#cfdcc4', '#bdcfb2', '#a3bb9f', '#86a283', '#6a8a68', '#4f7358'],
};
const SKY = {
  dawn: ['#f1dfc2', '#f7efe2'],
  day: ['#dde6e1', '#f5efe3'],
  dusk: ['#e7c49a', '#f4dfc4'],
  winter: ['#e3e9e8', '#f8f7f2'],
  paper: [C.paper, C.sand],
};

/* ---------- helpers ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sky = (k) => `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[k][0]}"/><stop offset="1" stop-color="${SKY[k][1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#sky)"/>`;

const sun = (x, y, r, color = C.honey, o = 0.9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${o}"/>`;

function clouds(seed, n = 3, y0 = 250) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 200 + r() * (W - 400);
    const y = y0 + r() * 220;
    const w = 180 + r() * 220;
    s += `<g fill="${C.snow}" opacity="0.75"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="${w * 0.22}"/><ellipse cx="${x - w * 0.35}" cy="${y + 10}" rx="${w * 0.5}" ry="${w * 0.18}"/><ellipse cx="${x + w * 0.3}" cy="${y - 18}" rx="${w * 0.45}" ry="${w * 0.2}"/></g>`;
  }
  return s;
}

/** A mountain or hill line from x=0 to W; returns the list of points. */
function profile(seed, base, amp, { sharp: pointy = 0, step = 20 } = {}) {
  const r = rng(seed);
  const o = [r() * 6, r() * 6, r() * 6, r() * 6];
  const pts = [];
  for (let x = -step; x <= W + step; x += step) {
    const t = (x / W) * Math.PI * 2;
    let y = amp * (0.55 * Math.sin(t * 1.1 + o[0]) + 0.28 * Math.sin(t * 2.7 + o[1]) + 0.12 * Math.sin(t * 6.3 + o[2]) + 0.05 * Math.sin(t * 13 + o[3]));
    if (pointy) y = y * (1 - pointy) + pointy * amp * (1 - 2 * Math.abs(Math.sin(t * 1.6 + o[1])));
    pts.push([x, base - y]);
  }
  return pts;
}
const fillBelow = (pts, color, o = 1) =>
  `<path d="M${pts.map((p) => `${p[0]} ${p[1].toFixed(1)}`).join(' L')} L${W + 40} ${H} L-40 ${H} Z" fill="${color}" opacity="${o}"/>`;
const yAt = (pts, x) => {
  const i = pts.findIndex((p) => p[0] >= x);
  if (i <= 0) return pts[0][1];
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
};

/** Snow caps: the parts of a profile above `line`. */
function snow(pts, line) {
  const top = pts.map(([x, y]) => [x, Math.max(y, line)]);
  const d = `M${pts.map((p) => `${p[0]} ${p[1].toFixed(1)}`).join(' L')} L${top
    .slice()
    .reverse()
    .map((p) => `${p[0]} ${(p[1] + 0).toFixed(1)}`)
    .join(' L')} Z`;
  return `<path d="${d}" fill="${C.snow}" opacity="0.95"/>`;
}

function conifer(x, y, h, color) {
  const w = h * 0.42;
  return `<g fill="${color}"><polygon points="${x},${y - h} ${x - w * 0.55},${y - h * 0.45} ${x + w * 0.55},${y - h * 0.45}"/><polygon points="${x},${y - h * 0.75} ${x - w * 0.8},${y - h * 0.15} ${x + w * 0.8},${y - h * 0.15}"/><polygon points="${x},${y - h * 0.5} ${x - w},${y} ${x + w},${y}"/></g>`;
}
function leafy(x, y, h, color, trunk = C.inkSoft) {
  const r = h * 0.3;
  return `<rect x="${x - h * 0.04}" y="${y - h * 0.45}" width="${h * 0.08}" height="${h * 0.45}" fill="${trunk}"/><g fill="${color}"><circle cx="${x}" cy="${y - h * 0.72}" r="${r}"/><circle cx="${x - r * 0.7}" cy="${y - h * 0.55}" r="${r * 0.8}"/><circle cx="${x + r * 0.7}" cy="${y - h * 0.57}" r="${r * 0.85}"/></g>`;
}
function forest(pts, seed, { from = 0, to = W, n = 30, h = [60, 110], color = C.greens[6], kind = 'conifer', dy = 6 } = {}) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = from + r() * (to - from);
    const size = h[0] + r() * (h[1] - h[0]);
    const y = yAt(pts, x) + dy;
    s += kind === 'conifer' ? conifer(x, y, size, color) : leafy(x, y, size, color);
  }
  return s;
}

function house(x, y, w, h, { wall = C.stone, roof = C.roof, stone = false } = {}) {
  let s = `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}"/>`;
  s += `<polygon points="${x - w * 0.08},${y - h} ${x + w / 2},${y - h - w * 0.42} ${x + w * 1.08},${y - h}" fill="${roof}"/>`;
  s += `<rect x="${x + w * 0.2}" y="${y - h * 0.62}" width="${w * 0.16}" height="${h * 0.22}" fill="${C.inkSoft}" opacity="0.7"/>`;
  s += `<rect x="${x + w * 0.62}" y="${y - h * 0.62}" width="${w * 0.16}" height="${h * 0.22}" fill="${C.inkSoft}" opacity="0.7"/>`;
  if (stone) {
    for (let i = 0; i < 6; i++) s += `<line x1="${x}" y1="${y - (h / 6) * i}" x2="${x + w}" y2="${y - (h / 6) * i}" stroke="${C.stoneDark}" stroke-width="3" opacity="0.5"/>`;
  }
  return s;
}

function fence(y, x0, x1, color = C.inkSoft, post = 150) {
  let s = `<g stroke="${color}" stroke-width="10" stroke-linecap="round"><line x1="${x0}" y1="${y - 70}" x2="${x1}" y2="${y - 70}"/><line x1="${x0}" y1="${y - 30}" x2="${x1}" y2="${y - 30}"/></g>`;
  for (let x = x0; x <= x1; x += post) s += `<rect x="${x - 9}" y="${y - 110}" width="18" height="115" rx="4" fill="${color}"/>`;
  return s;
}

/* ---------- animals, built from simple shapes in one colour ---------- */
// Local boxes face right; `flip` mirrors them.
const place = (inner, x, y, scale, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})">${inner}</g>`;

function horse(color = C.ink) {
  return `<g fill="${color}">
    <path d="M30 64 C14 80 12 104 18 128 C26 108 30 90 42 74 Z"/>
    <ellipse cx="56" cy="72" rx="26" ry="24"/>
    <ellipse cx="98" cy="74" rx="56" ry="24"/>
    <ellipse cx="138" cy="78" rx="22" ry="22"/>
    <polygon points="126,70 146,26 170,32 160,84"/>
    <path d="M146 26 C150 18 162 16 170 24 L174 34 Z"/>
    <ellipse cx="180" cy="46" rx="26" ry="12" transform="rotate(38 180 46)"/>
    <ellipse cx="194" cy="62" rx="10" ry="9"/>
    <polygon points="156,26 160,8 166,26"/>
    <rect x="128" y="88" width="10" height="56" rx="4"/><rect x="144" y="88" width="10" height="56" rx="4"/>
    <rect x="44" y="84" width="11" height="60" rx="4"/><rect x="62" y="86" width="10" height="58" rx="4"/>
    <rect x="126" y="140" width="14" height="7" rx="2"/><rect x="142" y="140" width="14" height="7" rx="2"/>
    <rect x="42" y="140" width="15" height="7" rx="2"/><rect x="60" y="140" width="14" height="7" rx="2"/>
  </g>`;
}
function rider(color = C.ink) {
  return `<g fill="${color}"><path d="M96 58 L90 18 C90 8 104 6 108 14 L116 56 Z"/><circle cx="100" cy="0" r="10"/><path d="M92 50 L84 82 L94 84 L102 56 Z"/><path d="M106 22 L128 40 L124 46 L102 32 Z"/></g>`;
}
function dog(color = C.ink) {
  return `<g fill="${color}">
    <path d="M46 62 C28 56 16 72 12 94 C24 82 34 76 50 74 Z"/>
    <ellipse cx="88" cy="70" rx="46" ry="19"/>
    <ellipse cx="126" cy="68" rx="18" ry="20"/>
    <polygon points="116,62 134,32 152,38 142,74"/>
    <ellipse cx="152" cy="38" rx="17" ry="14"/>
    <polygon points="160,30 186,42 182,52 156,50"/>
    <polygon points="142,30 146,10 156,28"/>
    <rect x="114" y="76" width="9" height="42" rx="3"/><rect x="128" y="76" width="9" height="42" rx="3"/>
    <rect x="52" y="74" width="10" height="44" rx="3"/><rect x="66" y="76" width="9" height="42" rx="3"/>
    <path d="M60 84 L64 94 L70 86 L76 96 L82 86 L88 96 L94 86 L100 94 L106 84 Z"/>
  </g>`;
}
function goat(color = C.ink) {
  return `<g fill="${color}">
    <polygon points="44,62 32,54 46,70"/>
    <ellipse cx="86" cy="72" rx="42" ry="21"/>
    <path d="M48 80 L54 100 L60 86 L66 102 L72 88 L78 102 L84 88 L90 102 L96 88 L102 100 L108 86 L116 98 L122 80 Z"/>
    <polygon points="112,64 128,40 144,44 134,76"/>
    <ellipse cx="148" cy="50" rx="18" ry="10" transform="rotate(38 148 50)"/>
    <polygon points="146,58 140,78 154,62"/>
    <polygon points="132,40 124,34 134,44"/>
    <rect x="112" y="86" width="7" height="38" rx="3"/><rect x="124" y="86" width="7" height="38" rx="3"/>
    <rect x="56" y="86" width="8" height="38" rx="3"/><rect x="70" y="88" width="7" height="36" rx="3"/>
  </g>
  <path d="M136 38 C128 12 106 6 96 20 C92 28 96 34 102 30" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
}
function sheep(color = C.snow, head = C.ink) {
  return `<g><g fill="${head}"><rect x="30" y="40" width="6" height="24" rx="2"/><rect x="56" y="40" width="6" height="24" rx="2"/><ellipse cx="86" cy="30" rx="11" ry="8"/></g><g fill="${color}"><ellipse cx="46" cy="30" rx="36" ry="18"/><circle cx="24" cy="26" r="14"/><circle cx="46" cy="16" r="15"/><circle cx="68" cy="24" r="14"/></g></g>`;
}

/* ---------- scene parts ---------- */
function alps(seed, { far = 820, mid = 1000, snowLine = 760, near = 1200 } = {}) {
  const p1 = profile(seed, far, 260, { sharp: 0.6 });
  const p2 = profile(seed + 1, mid, 200, { sharp: 0.4 });
  const p3 = profile(seed + 2, near, 90);
  return { svg: fillBelow(p1, C.greens[2]) + snow(p1, snowLine) + fillBelow(p2, C.greens[3]) + fillBelow(p3, C.greens[4]), p1, p2, p3 };
}
function hills(seed, bases = [900, 1060, 1220, 1380], colors = [C.greens[1], C.greens[2], C.greens[3], C.greens[4]]) {
  const ps = bases.map((b, i) => profile(seed + i, b, 120 - i * 18));
  return { svg: ps.map((p, i) => fillBelow(p, colors[i])).join(''), ps };
}
function label() {
  return `<text x="${W - 60}" y="${H - 50}" text-anchor="end" font-family="Consolas, Menlo, monospace" font-size="34" letter-spacing="6" fill="${C.ink}" opacity="0.55">ILLUSTRAZIONE DI PROVA</text>`;
}

/* ---------- scenes ---------- */
const S = {};

S['equitazione/mockup-cavallo-crinale'] = () => {
  const h = hills(11, [980, 1120, 1260, 1360], [C.greens[1], C.greens[2], C.greens[4], C.greens[5]]);
  const x = 1350;
  return sky('dawn') + sun(1700, 700, 210) + clouds(3, 2) + h.svg + place(horse(), x, yAt(h.ps[3], x + 170) - 580, 4);
};
S['equitazione/mockup-cavalli-recinto'] = () => {
  const h = hills(21, [940, 1100, 1300, 1450], [C.greens[1], C.greens[2], C.greens[3], C.greens[4]]);
  return sky('day') + clouds(8, 3) + h.svg + forest(h.ps[1], 5, { n: 40, h: [90, 150], kind: 'leafy', color: C.greens[5] }) +
    place(horse(C.inkSoft), 500, 900, 2.6) + place(horse(C.ink), 1500, 960, 2.9, true) + fence(1560, 60, 2360);
};
S['equitazione/mockup-lezione-maneggio'] = () => {
  const h = hills(31, [900, 1040, 1180, 1300]);
  return sky('day') + clouds(4, 2) + h.svg + `<rect x="0" y="1260" width="${W}" height="340" fill="${C.earth}" opacity="0.55"/>` +
    place(horse() + rider(), 900, 690, 3.6) + fence(1330, 60, 2360, C.inkSoft, 200);
};
S['equitazione/mockup-sentiero-orobie'] = () => {
  const a = alps(41, { far: 760, mid: 960, near: 1180 });
  const p = profile(44, 1330, 60);
  return sky('day') + clouds(9, 2, 180) + a.svg + forest(a.p3, 7, { n: 60, h: [120, 220], color: C.greens[6] }) + fillBelow(p, C.greens[5]) +
    `<path d="M1100 ${H} C1200 1450 1250 1380 1380 1330" fill="none" stroke="${C.earth}" stroke-width="70" stroke-linecap="round"/>` +
    place(horse() + rider(), 1350, 980, 1.5);
};
S['equitazione/mockup-alpe-palu-valmalenco'] = () => {
  const a = alps(51, { far: 700, mid: 920, snowLine: 640, near: 1150 });
  return sky('day') + clouds(2, 2, 160) + a.svg +
    `<ellipse cx="1200" cy="1260" rx="760" ry="120" fill="${C.water}"/><ellipse cx="1200" cy="1260" rx="560" ry="70" fill="${C.waterDeep}" opacity="0.5"/>` +
    fillBelow(profile(55, 1420, 50), C.greens[4]) + forest(profile(55, 1420, 50), 9, { n: 18, h: [140, 240], color: C.greens[6] });
};
S['equitazione/mockup-pensione-scuderia'] = () => {
  const h = hills(61, [950, 1100, 1250, 1400]);
  return sky('dusk') + sun(500, 760, 160) + h.svg +
    `<rect x="1250" y="880" width="780" height="420" fill="${C.stone}"/><polygon points="1200,880 1640,640 2080,880" fill="${C.roof}"/><rect x="1540" y="1040" width="200" height="260" fill="${C.inkSoft}"/><rect x="1330" y="960" width="120" height="90" fill="${C.inkSoft}" opacity="0.7"/><rect x="1830" y="960" width="120" height="90" fill="${C.inkSoft}" opacity="0.7"/>` +
    place(horse(), 700, 1020, 2.2) + fence(1480, 60, 1150);
};
S['equitazione/mockup-buono-regalo'] = () =>
  sky('paper') +
  `<rect x="700" y="420" width="1000" height="700" rx="10" fill="${C.snow}" stroke="${C.honeyDeep}" stroke-width="6"/><rect x="700" y="720" width="1000" height="70" fill="${C.honey}"/><rect x="1150" y="420" width="70" height="700" fill="${C.honey}"/>` +
  `<g transform="translate(1185 755) scale(3.2)"><path d="M-20 -8 C-50 -40 -60 -10 -20 0 Z M20 -8 C50 -40 60 -10 20 0 Z" fill="${C.honeyDeep}"/></g>` +
  place(`<path fill="${C.inkSoft}" d="M100 26c-30 0-52 24-52 56 0 26 10 46 10 62 0 10-8 14-8 22h26c0-14-6-22-6-36 0-22-8-34-8-48 0-22 16-38 38-38s38 16 38 38c0 14-8 26-8 48 0 14-6 22-6 36h26c0-8-8-12-8-22 0-16 10-36 10-62 0-32-22-56-52-56z"/>`, 820, 470, 1.6);

S['pastore-del-lagorai/mockup-pastore-prato'] = () => {
  const a = alps(71, { far: 780, mid: 980, near: 1180 });
  const p = profile(74, 1320, 50);
  return sky('day') + clouds(6, 2) + a.svg + fillBelow(p, C.greens[4]) + place(dog(), 850, 700, 4.2);
};
S['pastore-del-lagorai/mockup-pastore-gregge'] = () => {
  const h = hills(81, [900, 1040, 1200, 1340]);
  let s = sky('dawn') + sun(1900, 640, 150) + h.svg;
  const r = rng(82);
  for (let i = 0; i < 9; i++) s += place(sheep(), 900 + r() * 1300, 1150 + r() * 250, 2 + r() * 0.8, r() > 0.5);
  return s + place(dog(), 300, 1020, 2.8);
};
S['pastore-del-lagorai/mockup-pastore-neve'] = () => {
  const a = alps(91, { far: 760, mid: 960, snowLine: 1100, near: 1180 });
  return sky('winter') + a.svg + fillBelow(profile(94, 1300, 60), C.snow) + forest(profile(94, 1300, 60), 3, { n: 14, h: [150, 260], color: C.greens[6] }) +
    place(dog(C.inkSoft), 1150, 830, 3.4, true);
};

S['capra-orobica/mockup-capra-ritratto'] = () => {
  const a = alps(101, { far: 760, mid: 980, near: 1200 });
  return sky('day') + clouds(12, 2) + a.svg + fillBelow(profile(104, 1330, 40), C.greens[5]) + place(goat(), 850, 620, 5);
};
S['capra-orobica/mockup-capre-pascolo'] = () => {
  const h = hills(111, [880, 1020, 1180, 1340]);
  let s = sky('day') + clouds(13, 3) + h.svg + forest(h.ps[1], 11, { n: 25, h: [90, 150], color: C.greens[5] });
  const r = rng(112);
  for (let i = 0; i < 6; i++) s += place(goat(i % 2 ? C.inkSoft : C.ink), 200 + i * 350 + r() * 80, 1060 + r() * 260, 1.6 + r() * 0.6, r() > 0.5);
  return s;
};

S['valtellina/mockup-terrazzamenti'] = () => {
  let s = sky('dusk') + sun(1900, 520, 170) + fillBelow(profile(121, 700, 200, { sharp: 0.4 }), C.greens[2]);
  for (let i = 0; i < 9; i++) {
    const y = 760 + i * 95;
    const x0 = 100 + i * 60;
    s += `<polygon points="${x0},${y} ${W},${y - 120} ${W},${y - 30} ${x0 - 40},${y + 90}" fill="${i % 2 ? C.greens[3] : C.greens[4]}"/>`;
    s += `<line x1="${x0 - 40}" y1="${y + 90}" x2="${W}" y2="${y - 30}" stroke="${C.stoneDark}" stroke-width="10"/>`;
    for (let x = x0 + 40; x < W; x += 70) {
      const yy = y + 50 - ((x - x0) / (W - x0)) * 110;
      s += `<circle cx="${x}" cy="${yy}" r="12" fill="${C.greens[6]}"/>`;
    }
  }
  return s;
};
S['valtellina/mockup-valle-sondrio'] = () => {
  const a = alps(131, { far: 760, mid: 940, near: 1120 });
  let s = sky('day') + clouds(14, 2) + a.svg +
    `<path d="M0 1350 C600 1280 900 1420 1400 1330 S2100 1300 2400 1380 L2400 1440 C2000 1380 1700 1470 1300 1420 S500 1360 0 1420 Z" fill="${C.water}"/>`;
  const r = rng(132);
  for (let i = 0; i < 14; i++) s += house(700 + i * 70 + r() * 30, 1300 - r() * 60, 60 + r() * 30, 50 + r() * 40, { wall: i % 3 ? C.stone : C.sand });
  return s + `<rect x="1180" y="1100" width="40" height="160" fill="${C.stoneDark}"/><polygon points="1170,1100 1200,1030 1230,1100" fill="${C.roof}"/>`;
};
S['valtellina/mockup-borgo-albosaggia'] = () => {
  const h = hills(141, [860, 1000, 1160, 1330]);
  let s = sky('dawn') + sun(600, 600, 140) + h.svg + forest(h.ps[1], 13, { n: 30, h: [90, 160], color: C.greens[5], kind: 'leafy' });
  s += house(800, 1350, 260, 240, { stone: true }) + house(1100, 1370, 220, 200, { stone: true, roof: C.stoneDark }) + house(1360, 1340, 300, 260, { stone: true }) + house(1700, 1380, 200, 180, { stone: true, roof: C.stoneDark });
  return s + `<rect x="0" y="1380" width="${W}" height="220" fill="${C.greens[4]}"/>`;
};
S['valtellina/mockup-ghiacciaio'] = () => {
  const p1 = profile(151, 800, 360, { sharp: 0.7 });
  const p2 = profile(152, 1050, 220, { sharp: 0.5 });
  return sky('winter') + fillBelow(p1, C.greens[1]) + snow(p1, 820) + fillBelow(p2, C.stoneDark, 0.8) + snow(p2, 950) +
    fillBelow(profile(153, 1300, 80), C.greens[3]) + fillBelow(profile(154, 1450, 50), C.greens[4]);
};
S['valtellina/mockup-castello'] = () => {
  const h = hills(161, [920, 1060, 1220, 1380]);
  const top = yAt(h.ps[2], 1400);
  let s = sky('dusk') + sun(1850, 620, 150) + h.svg;
  s += `<rect x="1320" y="${top - 380}" width="160" height="400" fill="${C.stoneDark}"/>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${1320 + i * 44}" y="${top - 420}" width="28" height="44" fill="${C.stoneDark}"/>`;
  s += `<rect x="1480" y="${top - 220}" width="260" height="240" fill="${C.stone}"/><rect x="1385" y="${top - 300}" width="30" height="60" fill="${C.inkSoft}"/>`;
  return s + forest(h.ps[3], 17, { n: 30, h: [100, 170], color: C.greens[6] });
};
S['valtellina/mockup-estate'] = () => {
  const a = alps(171, { far: 760, mid: 980, snowLine: 690 });
  let s = sky('day') + sun(1900, 380, 130) + clouds(17, 2) + a.svg + fillBelow(profile(174, 1250, 60), C.greens[3]);
  const r = rng(175);
  for (let i = 0; i < 160; i++) s += `<circle cx="${r() * W}" cy="${1290 + r() * 300}" r="${6 + r() * 8}" fill="${[C.honey, C.snow, '#c98f9e'][i % 3]}"/>`;
  return s;
};
S['valtellina/mockup-inverno'] = () => {
  const a = alps(181, { far: 760, mid: 960, snowLine: 1300, near: 1160 });
  const p = profile(184, 1320, 50);
  return sky('winter') + a.svg + fillBelow(p, C.snow) + forest(p, 19, { n: 40, h: [140, 260], color: C.greens[6] }) + forest(p, 20, { n: 30, h: [90, 160], color: C.greens[5], dy: 60 });
};
S['valtellina/mockup-pizzoccheri'] = () => {
  let s = sky('paper') + `<rect x="0" y="1000" width="${W}" height="600" fill="${C.earth}" opacity="0.45"/>`;
  s += `<ellipse cx="1200" cy="980" rx="720" ry="220" fill="${C.snow}"/><path d="M480 980 C520 1300 1880 1300 1920 980 Z" fill="${C.snow}"/><ellipse cx="1200" cy="980" rx="640" ry="180" fill="${C.stone}"/>`;
  const r = rng(191);
  for (let i = 0; i < 60; i++) {
    const x = 700 + r() * 1000;
    const y = 880 + r() * 180;
    s += `<rect x="${x}" y="${y}" width="${90 + r() * 70}" height="18" rx="8" fill="#8a7a62" transform="rotate(${r() * 60 - 30} ${x} ${y})"/>`;
  }
  for (let i = 0; i < 25; i++) s += `<circle cx="${700 + r() * 1000}" cy="${880 + r() * 180}" r="${14 + r() * 14}" fill="${C.greens[5]}"/>`;
  return s;
};
S['valtellina/mockup-formaggi'] = () => {
  let s = sky('paper') + `<rect x="0" y="1100" width="${W}" height="500" fill="${C.earth}" opacity="0.45"/>`;
  const wheel = (x, y, rx, ry, h) => `<rect x="${x - rx}" y="${y - h}" width="${rx * 2}" height="${h}" fill="${C.honeyDeep}"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.honeyDeep}"/><ellipse cx="${x}" cy="${y - h}" rx="${rx}" ry="${ry}" fill="${C.honey}"/>`;
  s += wheel(900, 1240, 420, 110, 240) + wheel(900, 1000, 360, 95, 200) + wheel(1650, 1260, 300, 80, 180);
  s += `<polygon points="1500,1320 1900,1320 1700,1180" fill="${C.honey}"/><polygon points="1500,1320 1900,1320 1900,1400 1500,1400" fill="${C.honeyDeep}"/>`;
  return s;
};
S['valtellina/mockup-vini'] = () => {
  let s = sky('dusk') + fillBelow(profile(201, 1000, 120), C.greens[3], 0.7) + `<rect x="0" y="1150" width="${W}" height="450" fill="${C.earth}" opacity="0.5"/>`;
  s += `<path d="M1000 1300 L1000 760 C1000 680 1060 640 1060 560 L1060 380 L1140 380 L1140 560 C1140 640 1200 680 1200 760 L1200 1300 Z" fill="${C.inkSoft}"/><rect x="1020" y="880" width="160" height="200" fill="${C.snow}"/>`;
  s += `<path d="M1420 820 C1420 960 1500 1000 1560 1000 C1620 1000 1700 960 1700 820 Z" fill="${C.snow}" opacity="0.8"/><path d="M1432 900 C1450 970 1500 990 1560 990 C1620 990 1670 970 1688 900 Z" fill="${C.wine}"/><rect x="1552" y="1000" width="16" height="220" fill="${C.snow}"/><ellipse cx="1560" cy="1225" rx="90" ry="18" fill="${C.snow}"/>`;
  for (let i = 0; i < 12; i++) s += `<circle cx="${640 + (i % 4) * 40 + (Math.floor(i / 4) % 2) * 20}" cy="${1150 + Math.floor(i / 4) * 36}" r="24" fill="${C.wine}" opacity="0.85"/>`;
  return s;
};
S['valtellina/mockup-mappa'] = () => {
  let s = `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;
  for (let i = 1; i < 9; i++) s += `<ellipse cx="1650" cy="350" rx="${i * 140}" ry="${i * 90}" fill="none" stroke="${C.greens[2]}" stroke-width="4"/>`;
  for (let i = 1; i < 7; i++) s += `<ellipse cx="700" cy="1350" rx="${i * 150}" ry="${i * 80}" fill="none" stroke="${C.greens[2]}" stroke-width="4"/>`;
  s += `<path d="M0 900 C500 820 900 980 1300 880 S2000 820 2400 900" fill="none" stroke="${C.water}" stroke-width="36"/>`;
  s += `<path d="M1300 860 C1340 600 1420 400 1500 0" fill="none" stroke="${C.water}" stroke-width="18"/>`;
  s += `<path d="M0 960 C600 900 1000 1020 2400 950" fill="none" stroke="${C.stoneDark}" stroke-width="10" stroke-dasharray="30 18"/>`;
  s += `<path d="M1160 950 C1150 1050 1100 1150 1040 1230" fill="none" stroke="${C.stoneDark}" stroke-width="8"/>`;
  const t = (x, y, txt, size = 44) => `<text x="${x}" y="${y}" font-family="Consolas, Menlo, monospace" font-size="${size}" letter-spacing="6" fill="${C.ink}">${txt}</text>`;
  s += `<circle cx="1180" cy="820" r="20" fill="${C.ink}"/>` + t(1220, 800, 'SONDRIO');
  s += `<circle cx="1480" cy="300" r="14" fill="${C.ink}"/>` + t(1520, 300, 'VALMALENCO', 38);
  s += `<path d="M1040 1250 c-40 -70 -60 -100 -60 -140 a60 60 0 1 1 120 0 c0 40 -20 70 -60 140z" fill="${C.honeyDeep}"/><circle cx="1040" cy="1110" r="24" fill="${C.paper}"/>` + t(1120, 1150, 'ALBOSAGGIA');
  s += t(200, 870, 'ADDA', 34);
  return s;
};
S['equitazione/mockup-tramonto-conduzione'] = () => {
  const h = hills(211, [960, 1100, 1250, 1380], [C.greens[2], C.greens[3], C.greens[4], C.greens[5]]);
  const person = `<g fill="${C.ink}"><circle cx="0" cy="-150" r="18"/><path d="M-18 -130 L18 -130 L24 -40 L10 -40 L6 0 L-6 0 L-10 -40 L-24 -40 Z"/></g>`;
  return sky('dusk') + sun(1200, 860, 260, C.honey, 0.95) + h.svg + place(horse(), 1150, 960, 2.4) + place(person, 1560, yAt(h.ps[3], 1560) - 20, 2.4) +
    `<line x1="1520" y1="${yAt(h.ps[3], 1560) - 250}" x2="1600" y2="1080" stroke="${C.ink}" stroke-width="6"/>`;
};

/* ---------- write ---------- */
const root = new URL('../src/assets/', import.meta.url);
for (const [name, draw] of Object.entries(S)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw()}${label()}</svg>`;
  const file = new URL(`foto/${name.split('/').pop()}.jpg`, root);
  mkdirSync(new URL('.', file), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 80, mozjpeg: true }).toFile(fileURLToPath(file));
  console.log(`src/assets/foto/${name.split('/').pop()}.jpg`);
}
