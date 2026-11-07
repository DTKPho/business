// Génère les illustrations vectorielles du QG (décors flous des onglets et images
// des installations) dans public/scenes et public/facilities.
// Usage : node scripts/scenes.mjs
// Pour utiliser vos propres photos : déposez un .jpg/.png dans public/ et
// modifiez le chemin correspondant dans src/data/scenes.json.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const W = 1600
const H = 900
const C = {
  orange: '#ff5a1f',
  copper: '#c08a5a',
  steel: '#8f98a8',
  steelDark: '#4a5263',
  ink: '#1c2029',
  white: '#f3f5f8',
  glass: '#9fc3e6',
  warm: '#ffd9a8',
  blue: '#5b8cff',
  green: '#3ccf8e',
}

// ------------------------------------------------------------------ primitives
let uid = 0
const id = (p) => `${p}${++uid}`

function svg(body, defs = '', w = W, h = H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`
}

function grad(colors, x2 = 0, y2 = 1) {
  const g = id('g')
  const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('')
  return { def: `<linearGradient id="${g}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops}</linearGradient>`, url: `url(#${g})` }
}

function radial(color, opacity = 0.6) {
  const g = id('r')
  return { def: `<radialGradient id="${g}"><stop offset="0%" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`, url: `url(#${g})` }
}

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`
const line = (x1, y1, x2, y2, stroke, w = 2, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`

/** Pièce en perspective : mur du fond, sol, plafond. */
function room({ wall = ['#d9dee6', '#b9c1cc'], floor = ['#9aa3b1', '#5d6676'], ceiling = '#eef1f5', horizon = 560 } = {}) {
  const gw = grad(wall)
  const gf = grad(floor)
  const body =
    rect(0, 0, W, horizon, gw.url) +
    rect(0, horizon, W, H - horizon, gf.url) +
    rect(0, 0, W, 70, ceiling) +
    Array.from({ length: 9 }, (_, i) => line(W / 2, horizon, -400 + i * 300, H, '#ffffff', 2, 'opacity="0.12"')).join('') +
    Array.from({ length: 5 }, (_, i) => line(0, horizon + 40 + i * i * 22, W, horizon + 40 + i * i * 22, '#ffffff', 1.5, 'opacity="0.08"')).join('')
  return { body, defs: gw.def + gf.def }
}

function ceilingLights(n = 6, y = 70, color = '#ffffff') {
  const glow = radial(color, 0.55)
  let b = ''
  for (let i = 0; i < n; i++) {
    const x = 120 + (i * (W - 240)) / (n - 1)
    b += rect(x - 70, y, 140, 10, color, 'rx="5"') + `<ellipse cx="${x}" cy="${y + 60}" rx="160" ry="90" fill="${glow.url}"/>`
  }
  return { body: b, defs: glow.def }
}

/** Silhouette latérale de F1 (longueur ~ 560 * s). */
function f1Side(x, y, s = 1, color = C.orange, accent = C.ink) {
  const t = (px, py) => `${x + px * s},${y + py * s}`
  const body = `<path d="M${t(0, 60)} L${t(40, 52)} L${t(150, 50)} L${t(210, 30)} L${t(300, 22)} L${t(330, 8)} L${t(370, 8)} L${t(390, 24)} L${t(470, 30)} L${t(540, 18)} L${t(560, 20)} L${t(560, 62)} L${t(0, 70)} Z" fill="${color}"/>`
  const wing = `<path d="M${t(520, -10)} L${t(575, -14)} L${t(575, 22)} L${t(530, 22)} Z" fill="${accent}"/><path d="M${t(-20, 62)} L${t(70, 60)} L${t(70, 72)} L${t(-20, 74)} Z" fill="${accent}"/>`
  const halo = `<path d="M${t(300, 22)} Q${t(330, -6)} ${t(372, 10)}" stroke="${accent}" stroke-width="${6 * s}" fill="none"/>`
  const wheel = (cx) => circle(x + cx * s, y + 70 * s, 34 * s, '#15171c') + circle(x + cx * s, y + 70 * s, 14 * s, '#6b7280')
  return body + wing + halo + wheel(95) + wheel(470)
}

/** F1 vue de dessus, centrée en (x, y). */
function f1Top(x, y, s = 1, rot = 0, color = C.orange) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <rect x="-120" y="-60" width="34" height="120" rx="6" fill="#20232b"/>
    <rect x="100" y="-55" width="30" height="110" rx="6" fill="#20232b"/>
    <path d="M-95 -12 L60 -26 L118 -8 L118 8 L60 26 L-95 12 Z" fill="${color}"/>
    <rect x="-70" y="-48" width="38" height="96" rx="12" fill="#15171c"/>
    <rect x="60" y="-46" width="34" height="92" rx="12" fill="#15171c"/>
    <ellipse cx="10" cy="0" rx="22" ry="12" fill="#15171c"/>
  </g>`
}

function monitor(x, y, w, h, kind = 'chart', accent = C.blue) {
  let content = ''
  if (kind === 'chart') {
    const pts = Array.from({ length: 9 }, (_, i) => `${x + 12 + (i * (w - 24)) / 8},${y + h - 16 - ((Math.sin(i * 1.3 + x) + 1.2) * (h - 36)) / 2.6}`).join(' ')
    content = `<polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="3"/>`
  } else if (kind === 'track') {
    content = `<path d="M${x + w * 0.2} ${y + h * 0.7} C${x + w * 0.1} ${y + h * 0.2} ${x + w * 0.5} ${y + h * 0.1} ${x + w * 0.6} ${y + h * 0.35} S${x + w * 0.95} ${y + h * 0.4} ${x + w * 0.8} ${y + h * 0.8} Z" fill="none" stroke="${accent}" stroke-width="3"/>`
  } else if (kind === 'bars') {
    content = Array.from({ length: 6 }, (_, i) => rect(x + 14 + i * ((w - 28) / 6), y + h - 14 - (20 + ((i * 37) % 50)) * (h / 120), (w - 28) / 8, (20 + ((i * 37) % 50)) * (h / 120), accent)).join('')
  } else if (kind === 'flow') {
    content = Array.from({ length: 5 }, (_, i) => `<path d="M${x + 10} ${y + 20 + i * ((h - 40) / 4)} C${x + w * 0.4} ${y + 10 + i * ((h - 40) / 4)} ${x + w * 0.6} ${y + 30 + i * ((h - 40) / 4)} ${x + w - 10} ${y + 20 + i * ((h - 40) / 4)}" stroke="${['#3ccf8e', '#5b8cff', '#ffd166', '#ff5a1f', '#c084fc'][i]}" stroke-width="3" fill="none"/>`).join('')
  } else if (kind === 'car') {
    content = `<g opacity="0.85">${f1Side(x + w * 0.12, y + h * 0.3, (w * 0.75) / 580, accent, '#0f1d33')}</g>`
  }
  return rect(x - 6, y - 6, w + 12, h + 12, '#1b1e25', 'rx="6"') + rect(x, y, w, h, '#0f1d33', 'rx="3"') + content + rect(x + w / 2 - 8, y + h + 6, 16, 26, '#2a2e37')
}

function person(x, y, s = 1, color = '#2b313d', shirt = C.orange) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-118" r="22" fill="${color}"/><path d="M-34 -88 Q0 -100 34 -88 L40 0 L-40 0 Z" fill="${shirt}"/><rect x="-30" y="0" width="24" height="90" fill="${color}"/><rect x="6" y="0" width="24" height="90" fill="${color}"/></g>`
}

function windowWall(x, y, w, h, sky = ['#bfe0ff', '#f4d7b0']) {
  const g = grad(sky)
  const cols = Math.round(w / 160)
  let b = rect(x, y, w, h, g.url)
  // Silhouette de la campagne anglaise / bâtiments
  b += `<path d="M${x} ${y + h * 0.75} Q${x + w * 0.25} ${y + h * 0.6} ${x + w * 0.5} ${y + h * 0.72} T${x + w} ${y + h * 0.68} L${x + w} ${y + h} L${x} ${y + h} Z" fill="#9fb59a" opacity="0.8"/>`
  for (let i = 0; i <= cols; i++) b += rect(x + (i * w) / cols - 4, y, 8, h, '#2f3540')
  b += rect(x, y - 6, w, 12, '#2f3540') + rect(x, y + h - 6, w, 12, '#2f3540') + rect(x, y + h * 0.42, w, 6, '#2f3540')
  return { body: b, defs: g.def }
}

function logoWall(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 70 L60 0 L120 70 L92 70 L60 34 L28 70 Z" fill="${C.orange}"/><rect x="0" y="82" width="120" height="10" rx="5" fill="${C.copper}"/><text x="150" y="58" font-family="Arial, sans-serif" font-weight="700" font-size="56" fill="#2a2f3a" letter-spacing="6">GENESIS MAGMA</text><text x="152" y="92" font-family="Arial, sans-serif" font-size="26" fill="${C.copper}" letter-spacing="14">F1 TEAM</text></g>`
}

function desk(x, y, w, color = '#e7e9ee') {
  return rect(x, y, w, 18, color, 'rx="4"') + rect(x + 20, y + 18, 12, 90, '#8d95a3') + rect(x + w - 32, y + 18, 12, 90, '#8d95a3')
}

function plant(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-26" y="0" width="52" height="60" rx="6" fill="#d7d2c8"/><path d="M0 0 C-60 -40 -40 -120 0 -150 C40 -120 60 -40 0 0" fill="#4f8a5b"/><path d="M0 0 C-80 -20 -90 -70 -60 -100 C-20 -70 -10 -30 0 0" fill="#3f7a4c"/><path d="M0 0 C80 -20 90 -70 60 -100 C20 -70 10 -30 0 0" fill="#5d9c68"/></g>`
}

function rack(x, y, h = 360) {
  let b = rect(x, y, 120, h, '#20242c', 'rx="4"')
  for (let i = 0; i < h / 30 - 1; i++) {
    b += rect(x + 10, y + 10 + i * 30, 100, 20, '#2c313b', 'rx="2"')
    b += circle(x + 20, y + 20 + i * 30, 3, i % 3 ? C.green : C.blue)
    b += circle(x + 32, y + 20 + i * 30, 3, i % 4 ? C.blue : C.orange)
  }
  return b
}

function trophy(x, y, s = 1, color = '#d4af37') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-40 -120 L40 -120 L32 -60 Q0 -30 -32 -60 Z" fill="${color}"/><path d="M-40 -110 Q-70 -110 -60 -80 Q-52 -62 -34 -66" stroke="${color}" stroke-width="8" fill="none"/><path d="M40 -110 Q70 -110 60 -80 Q52 -62 34 -66" stroke="${color}" stroke-width="8" fill="none"/><rect x="-8" y="-46" width="16" height="30" fill="${color}"/><rect x="-34" y="-16" width="68" height="16" fill="#3a3f4a"/></g>`
}

function helmet(x, y, s = 1, color = C.orange) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-50 20 C-60 -50 40 -70 56 -10 L56 20 Z" fill="${color}"/><path d="M-10 -12 L54 -12 L54 6 L-6 6 Z" fill="#1c2029"/><rect x="-54" y="20" width="112" height="10" rx="5" fill="#2b313d"/></g>`
}

function truck(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="-150" width="420" height="150" rx="6" fill="#eef0f4"/><rect x="0" y="-60" width="420" height="16" fill="${C.orange}"/><rect x="430" y="-120" width="110" height="120" rx="12" fill="#2b313d"/><rect x="450" y="-108" width="70" height="44" rx="6" fill="#9fc3e6"/>${[60, 120, 340, 470].map((c) => circle(c, 6, 26, '#15171c') + circle(c, 6, 10, '#6b7280')).join('')}${logoWall(130, -130, 0.45)}</g>`
}

function chair(x, y, s = 1, color = '#3a404c') {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-28" y="-90" width="56" height="70" rx="12" fill="${color}"/><rect x="-32" y="-20" width="64" height="16" rx="6" fill="${color}"/><rect x="-4" y="-4" width="8" height="40" fill="#6b7280"/><rect x="-26" y="34" width="52" height="6" rx="3" fill="#6b7280"/></g>`
}

function world(x, y, w, h, color = '#7f8ea6') {
  // Continents stylisés
  const sx = w / 1000
  const sy = h / 500
  const shapes = [
    'M80 90 L250 70 L320 140 L260 210 L200 230 L170 300 L120 220 L60 160 Z',
    'M230 290 L300 300 L320 380 L280 470 L240 420 Z',
    'M440 80 L560 70 L600 120 L540 160 L470 150 Z',
    'M460 180 L580 180 L620 300 L560 420 L500 360 L470 260 Z',
    'M600 70 L860 60 L920 150 L820 220 L700 200 L640 140 Z',
    'M800 330 L900 320 L930 400 L840 420 Z',
  ]
  return shapes.map((d) => `<path transform="translate(${x} ${y}) scale(${sx} ${sy})" d="${d}" fill="${color}"/>`).join('')
}

function vignette() {
  const g = radial('#000000', 0)
  const v = id('v')
  return {
    body: `<rect width="${W}" height="${H}" fill="url(#${v})"/>`,
    defs: g.def + `<radialGradient id="${v}" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialGradient>`,
  }
}

function compose(parts) {
  return svg(parts.map((p) => (typeof p === 'string' ? p : p.body)).join(''), parts.map((p) => (typeof p === 'string' ? '' : p.defs)).join(''))
}

// ------------------------------------------------------------------ décors des onglets
const scenes = {
  atrium: () => {
    const r = room({ wall: ['#e8ecf1', '#cfd6df'], floor: ['#c9ced6', '#8b94a2'] })
    const win = windowWall(80, 110, 1440, 380)
    return compose([r, win, ceilingLights(7), logoWall(520, 150, 1), `<ellipse cx="800" cy="760" rx="420" ry="60" fill="#2b313d" opacity="0.35"/>`, rect(420, 700, 760, 40, '#e5e7eb', 'rx="20"'), f1Side(520, 600, 1.05), plant(150, 760, 1.2), plant(1450, 760, 1.2), person(300, 780, 0.8, '#2b313d', '#e5e7eb'), person(1280, 790, 0.85), vignette()])
  },
  office: () => {
    const r = room({ wall: ['#ece7df', '#d4cdc2'], floor: ['#b39b7f', '#7d6650'] })
    const win = windowWall(900, 120, 620, 400, ['#aed4f6', '#f7dfbe'])
    return compose([r, win, ceilingLights(4, 70, '#fff3dc'), desk(160, 600, 640, '#f4f1ec'), monitor(220, 440, 220, 140, 'chart'), monitor(480, 440, 220, 140, 'bars', C.orange), chair(460, 760, 1.2), plant(1450, 760, 1.1), rect(120, 160, 300, 200, '#ffffff', 'rx="6" opacity="0.8"'), `<text x="150" y="220" font-family="Arial" font-size="30" fill="#2b313d">Courrier</text>`, vignette()])
  },
  travel: () => {
    const bg = grad(['#dfe8f2', '#b8c8da'])
    let routes = ''
    const pts = [[260, 300], [520, 260], [700, 330], [1180, 300], [1300, 560], [900, 420], [420, 520]]
    for (let i = 0; i < pts.length - 1; i++) routes += `<path d="M${pts[i][0]} ${pts[i][1]} Q${(pts[i][0] + pts[i + 1][0]) / 2} ${Math.min(pts[i][1], pts[i + 1][1]) - 120} ${pts[i + 1][0]} ${pts[i + 1][1]}" stroke="${C.orange}" stroke-width="4" fill="none" stroke-dasharray="10 10"/>`
    return compose([{ body: rect(0, 0, W, H, bg.url), defs: bg.def }, world(100, 120, 1400, 640, '#8fa3bd'), routes, pts.map(([x, y]) => circle(x, y, 12, C.orange) + circle(x, y, 26, C.orange, 'opacity="0.25"')).join(''), vignette()])
  },
  paddock: () => {
    const sky = grad(['#2b3a55', '#f08a4b'])
    const floor = grad(['#4a4f5a', '#23262d'])
    return compose([
      { body: rect(0, 0, W, 520, sky.url) + rect(0, 520, W, 380, floor.url), defs: sky.def + floor.def },
      rect(0, 430, W, 90, '#3a3f4a'),
      Array.from({ length: 6 }, (_, i) => rect(40 + i * 260, 300, 220, 220, i === 2 ? '#f3f5f8' : '#5a606c', 'rx="4"')).join(''),
      f1Side(560, 410, 0.55),
      Array.from({ length: 8 }, (_, i) => rect(i * 220, 160, 8, 160, '#1f232b') + circle(i * 220 + 4, 150, 30, '#fff6d6', 'opacity="0.8"')).join(''),
      rect(0, 520, W, 24, '#e5e7eb'),
      Array.from({ length: 16 }, (_, i) => rect(i * 100, 520, 50, 24, '#d64545')).join(''),
      f1Side(200, 650, 1.1, '#5b8cff'),
      vignette(),
    ])
  },
  trophies: () => {
    const r = room({ wall: ['#2d3340', '#20252f'], floor: ['#3a404c', '#1f232a'] })
    const spot = radial('#ffe7b0', 0.55)
    let shelves = ''
    for (let row = 0; row < 3; row++) {
      shelves += rect(160, 230 + row * 150, 1280, 12, '#c08a5a')
      for (let i = 0; i < 7; i++) shelves += trophy(240 + i * 180, 230 + row * 150, 0.7 + ((i + row) % 3) * 0.12, ['#d4af37', '#c0c4cc', '#cd7f32'][(i + row) % 3])
    }
    return compose([r, { body: `<ellipse cx="800" cy="300" rx="700" ry="300" fill="${spot.url}"/>`, defs: spot.def }, shelves, vignette()])
  },
  garage: () => {
    const r = room({ wall: ['#e3e6eb', '#c3c9d2'], floor: ['#cfd3da', '#8e96a3'] })
    let tools = ''
    for (let i = 0; i < 8; i++) tools += rect(100 + i * 180, 170, 150, 220, '#f8f9fb', 'rx="4"') + rect(115 + i * 180, 190, 120, 12, C.orange) + rect(115 + i * 180, 220, 80, 8, '#9aa2b1') + rect(115 + i * 180, 240, 100, 8, '#9aa2b1')
    return compose([r, ceilingLights(6), tools, logoWall(80, 420, 0.6), rect(200, 720, 520, 26, '#3a404c'), rect(880, 720, 520, 26, '#3a404c'), f1Side(180, 610, 0.95), f1Side(860, 610, 0.95, '#c08a5a'), person(760, 790, 0.9), person(1460, 800, 0.85, '#2b313d', '#e5e7eb'), vignette()])
  },
  driverroom: () => {
    const r = room({ wall: ['#e9e4dc', '#cfc6b8'], floor: ['#a89a88', '#6d6152'] })
    let b = rect(160, 200, 1280, 14, '#8a7a66') + rect(160, 400, 1280, 14, '#8a7a66')
    const colors = [C.orange, '#f3f5f8', '#5b8cff', C.copper, '#2b313d', C.orange]
    for (let i = 0; i < 6; i++) b += helmet(260 + i * 210, 180, 1, colors[i]) + helmet(260 + i * 210, 380, 1, colors[5 - i])
    b += `<path d="M640 480 L760 480 L780 820 L620 820 Z" fill="${C.orange}"/><path d="M840 480 L960 480 L980 820 L820 820 Z" fill="#2b313d"/>`
    return compose([r, ceilingLights(5, 70, '#fff5e6'), b, vignette()])
  },
  engineering: () => {
    const r = room({ wall: ['#e6ebf1', '#cdd5df'], floor: ['#c0c6cf', '#858e9b'] })
    let b = ''
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 4; i++) {
        const x = 140 + i * 360 + row * 60
        const y = 430 + row * 170
        b += desk(x, y + 120, 300, '#f3f5f8') + monitor(x + 30, y, 110, 70, ['chart', 'car', 'flow', 'bars'][(i + row) % 4]) + monitor(x + 160, y, 110, 70, ['track', 'bars', 'chart', 'car'][(i + row) % 4], C.orange)
      }
    }
    return compose([r, ceilingLights(6), monitor(500, 110, 600, 230, 'car', C.orange), b, vignette()])
  },
  meeting: () => {
    const r = room({ wall: ['#ece9e4', '#d3cec5'], floor: ['#a7968a', '#6e5f55'] })
    const win = windowWall(1000, 120, 520, 380)
    return compose([r, win, ceilingLights(4, 70, '#fff3dc'), monitor(160, 150, 560, 300, 'chart', C.orange), `<ellipse cx="760" cy="720" rx="520" ry="90" fill="#efe9df"/>`, [300, 500, 700, 900, 1100, 1250].map((x, i) => chair(x, 700 + (i % 2) * 120, 1)).join(''), plant(1480, 780, 1), vignette()])
  },
  campus: () => {
    const sky = grad(['#a9cff3', '#eaf3fb'])
    const grass = grad(['#a7c49b', '#6f9467'])
    const bld = (x, y, w, h, c = '#f4f6f9') => rect(x, y, w, h, c, 'rx="6"') + Array.from({ length: Math.floor(w / 50) }, (_, i) => rect(x + 14 + i * 50, y + 20, 30, h - 40, '#9fc3e6', 'opacity="0.8"')).join('')
    return compose([
      { body: rect(0, 0, W, 420, sky.url) + rect(0, 420, W, 480, grass.url), defs: sky.def + grass.def },
      `<path d="M0 420 Q400 360 800 400 T1600 380 L1600 420 Z" fill="#8fb487"/>`,
      bld(200, 300, 500, 200),
      bld(760, 260, 620, 240, '#eef0f4'),
      rect(760, 260, 620, 30, C.orange, 'rx="6"'),
      bld(320, 540, 380, 180),
      `<path d="M0 800 Q800 650 1600 820" stroke="#d9dce3" stroke-width="40" fill="none"/>`,
      Array.from({ length: 10 }, (_, i) => circle(80 + i * 160, 600 + (i % 3) * 40, 46, '#4f8a5b')).join(''),
      vignette(),
    ])
  },
  finance: () => {
    const r = room({ wall: ['#1f2633', '#141922'], floor: ['#2a303c', '#151920'] })
    let b = ''
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b += monitor(180 + i * 430, 140 + j * 230, 380, 190, ['chart', 'bars'][(i + j) % 2], [C.green, C.orange, C.blue][i])
    return compose([r, b, desk(200, 680, 1200, '#2a2f3a'), vignette()])
  },
  boardroom: () => {
    const r = room({ wall: ['#e6e0d6', '#c9bfb0'], floor: ['#8d7a66', '#5a4b3d'] })
    const win = windowWall(160, 110, 1280, 360, ['#9ec9f0', '#f5d6ad'])
    let chairs = ''
    for (let i = 0; i < 6; i++) chairs += chair(380 + i * 170, 650, 1.1, '#2f3540') + chair(420 + i * 170, 860, 1.25, '#2f3540')
    return compose([r, win, ceilingLights(5, 70, '#fff0d8'), chairs, `<path d="M280 700 L1320 700 L1460 800 L140 800 Z" fill="#3b2f26"/>`, rect(140, 800, 1320, 20, '#2b211a'), logoWall(600, 520, 0.55), vignette()])
  },
  archive: () => {
    const r = room({ wall: ['#e3e0da', '#c9c3b8'], floor: ['#a09684', '#6a604f'] })
    let b = ''
    for (let i = 0; i < 6; i++) {
      b += rect(140 + i * 230, 160, 200, 560, '#7a6a55', 'rx="4"')
      for (let s = 0; s < 6; s++) {
        b += rect(150 + i * 230, 180 + s * 90, 180, 8, '#5c4f3e')
        for (let k = 0; k < 6; k++) b += rect(156 + i * 230 + k * 28, 120 + s * 90 + 60, 22, 58, ['#c08a5a', '#e5e7eb', '#ff5a1f', '#5b8cff', '#8f98a8', '#d4af37'][(k + s + i) % 6], 'rx="2"')
      }
    }
    return compose([r, ceilingLights(5, 70, '#fff5e6'), b, vignette()])
  },
}

// ------------------------------------------------------------------ installations
const facilities = {
  windTunnel: () => {
    const bg = grad(['#e9edf2', '#c7ced8'])
    return compose([
      { body: rect(0, 0, W, H, bg.url), defs: bg.def },
      `<path d="M0 200 L700 320 L700 640 L0 760 Z" fill="#b8c0cc"/><path d="M900 320 L1600 180 L1600 780 L900 640 Z" fill="#b8c0cc"/>`,
      rect(700, 320, 200, 320, '#d7dde5'),
      Array.from({ length: 9 }, (_, i) => `<path d="M60 ${300 + i * 45} C500 ${300 + i * 45} 640 ${430 + i * 6} 800 ${450 + i * 8} S1200 ${330 + i * 45} 1560 ${300 + i * 45}" stroke="${['#5b8cff', '#3ccf8e', '#ffd166', '#ff5a1f'][i % 4]}" stroke-width="3" fill="none" opacity="0.7"/>`).join(''),
      f1Side(600, 480, 0.7),
      rect(780, 560, 40, 100, '#4a5263'),
      circle(1450, 480, 220, '#2b313d', 'opacity="0.85"'),
      Array.from({ length: 6 }, (_, i) => `<path d="M1450 480 L${1450 + Math.cos((i * Math.PI) / 3) * 200} ${480 + Math.sin((i * Math.PI) / 3) * 200}" stroke="#8f98a8" stroke-width="30"/>`).join(''),
      circle(1450, 480, 40, '#1c2029'),
    ])
  },
  cfd: () => {
    const r = room({ wall: ['#1b2230', '#121821'], floor: ['#232a36', '#12161d'] })
    let b = ''
    for (let i = 0; i < 9; i++) b += rack(80 + i * 165, 260, 420)
    return compose([r, b, monitor(450, 90, 700, 140, 'flow'), vignette()])
  },
  designCentre: () => {
    const r = room({ wall: ['#eef1f5', '#d3d9e2'], floor: ['#c4cad3', '#8c95a2'] })
    let b = ''
    for (let i = 0; i < 4; i++) b += desk(110 + i * 370, 640, 330, '#f8f9fb') + monitor(140 + i * 370, 470, 270, 150, ['car', 'flow', 'car', 'bars'][i], i % 2 ? C.orange : C.blue) + chair(270 + i * 370, 820, 1)
    return compose([r, ceilingLights(6), monitor(300, 110, 1000, 260, 'car', C.orange), b, vignette()])
  },
  factory: () => {
    const r = room({ wall: ['#d8dde4', '#aeb6c2'], floor: ['#9aa2ae', '#5f6774'] })
    let b = ''
    for (let i = 0; i < 3; i++) b += `<g transform="translate(${180 + i * 460} 360)"><rect width="320" height="300" rx="18" fill="#e9ecf1"/><rect x="20" y="30" width="200" height="140" rx="8" fill="#9fc3e6"/><rect x="240" y="40" width="60" height="200" rx="6" fill="#4a5263"/><rect x="20" y="200" width="200" height="60" rx="6" fill="${C.orange}"/></g>`
    b += `<g transform="translate(0 760)"><rect x="100" y="0" width="1400" height="40" fill="#3a404c"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${180 + i * 190} 0 L${260 + i * 190} -50 L${340 + i * 190} 0 Z" fill="#1c2029"/>`).join('')}</g>`
    return compose([r, ceilingLights(6), b, vignette()])
  },
  simulator: () => {
    const r = room({ wall: ['#1d2230', '#121620'], floor: ['#252b37', '#11141a'] })
    const sky = grad(['#7fb2e5', '#e9d2b0'])
    return compose([
      r,
      { body: `<path d="M120 140 Q800 40 1480 140 L1480 560 Q800 470 120 560 Z" fill="${sky.url}"/>`, defs: sky.def },
      `<path d="M560 560 L760 330 L840 330 L1040 560 Z" fill="#4b4f57"/><path d="M780 330 L820 330 L830 560 L770 560 Z" fill="#f3f5f8" opacity="0.7"/>`,
      `<g transform="translate(800 700)"><path d="M-260 60 L-200 -80 L200 -80 L260 60 Z" fill="#2b313d"/><path d="M-120 -80 Q0 -150 120 -80" stroke="${C.orange}" stroke-width="14" fill="none"/><rect x="-90" y="-60" width="180" height="40" rx="10" fill="#1c2029"/><circle cx="0" cy="-40" r="38" fill="none" stroke="#e5e7eb" stroke-width="10"/></g>`,
      vignette(),
    ])
  },
  puLab: () => {
    const r = room({ wall: ['#d9dde3', '#aeb5c0'], floor: ['#8e96a2', '#555d6a'] })
    return compose([
      r,
      ceilingLights(5),
      `<g transform="translate(560 380)"><rect width="480" height="260" rx="20" fill="#3a404c"/><rect x="40" y="40" width="400" height="80" rx="10" fill="#5a616e"/>${Array.from({ length: 6 }, (_, i) => rect(60 + i * 64, 140, 44, 90, '#8f98a8', 'rx="6"')).join('')}<path d="M480 120 C620 120 600 -60 760 -60" stroke="${C.copper}" stroke-width="30" fill="none"/><path d="M0 160 C-140 160 -120 -40 -260 -40" stroke="#8f98a8" stroke-width="26" fill="none"/></g>`,
      monitor(120, 200, 300, 180, 'chart', C.orange),
      monitor(1180, 200, 300, 180, 'bars', C.green),
      `<text x="640" y="720" font-family="Arial" font-size="40" fill="${C.orange}" font-weight="700">HYUNDAI · NAMYANG</text>`,
      vignette(),
    ])
  },
  wellbeing: () => {
    const r = room({ wall: ['#eef3ef', '#d1ddd4'], floor: ['#c8b79d', '#8c7b63'] })
    const win = windowWall(900, 120, 600, 380, ['#bfe2ff', '#e9f5e2'])
    return compose([
      r,
      win,
      `<g transform="translate(220 640)"><rect width="320" height="40" rx="20" fill="#2b313d"/><rect x="40" y="-120" width="30" height="120" fill="#8f98a8"/><rect x="250" y="-120" width="30" height="120" fill="#8f98a8"/><rect x="20" y="-140" width="280" height="24" rx="12" fill="${C.orange}"/></g>`,
      `<g transform="translate(700 700)"><circle r="60" fill="#5b8cff" opacity="0.8"/></g>`,
      `<g transform="translate(1000 680)"><rect x="-140" y="-20" width="280" height="40" rx="18" fill="#2b313d"/><rect x="-160" y="20" width="320" height="16" fill="#8f98a8"/></g>`,
      plant(150, 790, 1.1),
      plant(1480, 790, 1.1),
      vignette(),
    ])
  },
  academy: () => {
    const r = room({ wall: ['#eef1f5', '#d5dbe3'], floor: ['#bfa98e', '#85705a'] })
    let b = monitor(300, 120, 1000, 300, 'car', C.orange)
    for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) b += desk(160 + i * 270 + row * 40, 560 + row * 150, 220, '#f6f7f9') + person(270 + i * 270 + row * 40, 650 + row * 150, 0.55, '#2b313d', ['#5b8cff', C.orange, '#e5e7eb'][(i + row) % 3])
    return compose([r, ceilingLights(5), b, vignette()])
  },
  campus: () => scenes.campus(),
  logistics: () => {
    const sky = grad(['#b9d6f2', '#eef3f8'])
    const floor = grad(['#9aa2ae', '#5c6470'])
    return compose([
      { body: rect(0, 0, W, 520, sky.url) + rect(0, 520, W, 380, floor.url), defs: sky.def + floor.def },
      rect(100, 220, 1400, 300, '#e3e7ed', 'rx="6"'),
      Array.from({ length: 6 }, (_, i) => rect(150 + i * 225, 300, 180, 220, '#4a5263', 'rx="4"')).join(''),
      truck(140, 760, 1),
      truck(860, 800, 1),
      Array.from({ length: 4 }, (_, i) => rect(1300 + (i % 2) * 120, 560 + Math.floor(i / 2) * 90, 110, 80, ['#c08a5a', '#ff5a1f'][i % 2], 'rx="4"')).join(''),
      vignette(),
    ])
  },
  mission: () => {
    const r = room({ wall: ['#141a26', '#0d1119'], floor: ['#1d2330', '#0c0f15'] })
    let b = ''
    for (let i = 0; i < 4; i++) b += monitor(120 + i * 350, 110, 320, 180, ['track', 'chart', 'bars', 'flow'][i], [C.orange, C.blue, C.green, C.orange][i])
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) b += monitor(130 + i * 230 + row * 30, 420 + row * 170, 170, 90, ['chart', 'bars', 'track'][(i + row) % 3], [C.blue, C.green, C.orange][(i + row) % 3])
    return compose([r, b, vignette()])
  },
  pitTraining: () => {
    const r = room({ wall: ['#e2e6ec', '#bfc6d0'], floor: ['#d4d8de', '#8f97a3'] })
    const p = [380, 520, 1080, 1220, 640, 960]
    return compose([r, ceilingLights(5), rect(0, 600, W, 8, '#f5c400'), f1Top(800, 690, 1.6, 0), p.map((x, i) => person(x, 840 + (i > 3 ? -260 : 0), 0.75, '#2b313d', C.orange)).join(''), monitor(1240, 140, 260, 140, 'bars', C.orange), `<text x="1260" y="330" font-family="Arial" font-size="44" font-weight="700" fill="${C.orange}">2.1 s</text>`, vignette()])
  },
  hospitality: () => {
    const r = room({ wall: ['#efe8de', '#d2c5b2'], floor: ['#9c7d5e', '#5e4a36'] })
    const win = windowWall(160, 120, 1280, 360, ['#9fd0ff', '#f7d9b5'])
    return compose([r, win, ceilingLights(5, 70, '#fff0d6'), rect(200, 620, 600, 90, '#2b313d', 'rx="10"'), rect(200, 600, 600, 26, C.copper, 'rx="8"'), [960, 1160, 1360].map((x) => `<ellipse cx="${x}" cy="700" rx="80" ry="20" fill="#f3efe8"/>` + rect(x - 6, 700, 12, 90, '#8f98a8') + chair(x - 100, 800, 0.8, C.orange) + chair(x + 100, 800, 0.8, C.orange)).join(''), plant(120, 790, 1), vignette()])
  },
}

// ------------------------------------------------------------------ écriture
function write(dir, name, content) {
  const d = path.join(root, 'public', dir)
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, `${name}.svg`), content)
}

for (const [k, fn] of Object.entries(scenes)) write('scenes', k, fn())
for (const [k, fn] of Object.entries(facilities)) write('facilities', k, fn())
console.log(`${Object.keys(scenes).length} décors, ${Object.keys(facilities).length} installations générés.`)
