// ============================================================
//  xXx SparkleStats xXx  -  keeps.js
//  keepsakes: artist trading cards (holo, packs, binder), a
//  scrapbook page, story-style recap, dream concert ticket and
//  a vinyl shelf with a turntable. loads after bingo.js
//  (borrows xCard / xBack / lSaveNode / yTabs / qFindPreview).
// ============================================================

const KP = {
  cardTab: 'packs', busy: false,
  scrapRange: 'medium_term', scrap: null, drag: null, scrapSeed: 1,
  storyRange: 'short_term', story: null, storyTimer: null,
  ticketRange: 'medium_term', ticketStyle: 'paper', ticketSeed: 1,
  vinylRange: 'medium_term', vinyl: null, audio: null, playTok: 0,
};
const KP_CARDS_KEY = 'sparkle_cards_v1';
const KP_PACKS_DAY = 5;
const KP_FONTS = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Permanent+Marker&display=swap';
const KP_RARITY = {
  mythic: { label: '✦ mythic', w: 4 },
  ultra:  { label: '★ ultra rare', w: 13 },
  rare:   { label: '♥ rare', w: 30 },
  common: { label: 'common', w: 53 },
};

// ======================== SHARED ========================

function kpRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function kpHash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function kpPick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
function kpImg(o) { return ((o && o.images) || [])[0]?.url || ''; }
function kpToday() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function kpRangeLabel(r) { return (Y_RANGES.find(x => x[0] === r) || [, ''])[1]; }

function kpFonts() {
  if (document.getElementById('kp-fonts')) return;
  const l = document.createElement('link');
  l.id = 'kp-fonts'; l.rel = 'stylesheet'; l.href = KP_FONTS;
  document.head.appendChild(l);
}

// opens a keepsake screen from anywhere (hub, or straight from the dashboard)
function kpGo(fn) {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  kpFonts();
  fn();
}

function kpNeedData(title) {
  if (typeof _data !== 'undefined' && _data && _data.artists) return false;
  qSet(qTopBar('&larr; back', xBack()) + qHeader(title, '') + qErrorBox('log in with spotify first'));
  return true;
}

// every artist across the three ranges, best overall first
function kpRankArtists() {
  const w = { short_term: 1.3, medium_term: 1, long_term: 0.8 }, m = new Map();
  for (const r of Object.keys(w)) (_data.artists[r] || []).forEach((a, i) => {
    if (!a || !a.id) return;
    const e = m.get(a.id) || { a, s: 0, rank: {} };
    e.s += w[r] * (50 - i);
    e.rank[r] = i + 1;
    m.set(a.id, e);
  });
  return [...m.values()].sort((x, y) => y.s - x.s);
}
function kpAllTracks() {
  return qDedupe([...(_data.tracks.short_term || []), ...(_data.tracks.medium_term || []), ...(_data.tracks.long_term || [])]);
}

// ======================== AUDIO ========================

function kpStopAudio() {
  KP.playTok++;
  if (KP.audio) { KP.audio.pause(); KP.audio.removeAttribute('src'); }
}
// plays a track's preview clip. cb(true) once it starts, cb(false) when there's no clip
function kpPlayTrack(t, cb) {
  const tok = ++KP.playTok;
  if (KP.audio) KP.audio.pause();
  qFindPreview(t).then(url => {
    if (tok !== KP.playTok) return;
    if (!url) { if (cb) cb(false); return; }
    if (!KP.audio) { KP.audio = new Audio(); KP.audio.preload = 'auto'; }
    KP.audio.src = url;
    KP.audio.volume = 0.8;
    const p = KP.audio.play();
    if (p && p.catch) p.catch(() => { if (tok === KP.playTok && cb) cb(false); });
    if (cb) cb(true);
  }).catch(() => { if (tok === KP.playTok && cb) cb(false); });
}

// ======================== TRADING CARDS ========================

function kpCardSet() {
  const tracks = kpAllTracks();
  return kpRankArtists().slice(0, 50).map((e, i) => {
    const a = e.a;
    const theirs = tracks.filter(t => (t.artists || []).some(x => x.id === a.id));
    const rar = i < 3 ? 'mythic' : i < 10 ? 'ultra' : i < 25 ? 'rare' : 'common';
    return {
      id: a.id, no: i + 1, name: a.name, img: kpImg(a), rar,
      genre: (a.genres || [])[0] || 'mystery genre',
      songs: theirs.length,
      now: e.rank.short_term || 0, ever: e.rank.long_term || 0,
      top: theirs[0] ? qStrip(theirs[0].name) : '',
      hp: 10 * Math.round(e.s / 10) + 30,
    };
  });
}

function kpColLoad() {
  try {
    const c = JSON.parse(localStorage.getItem(KP_CARDS_KEY) || 'null');
    if (c && c.owned) return c;
  } catch {}
  return { owned: {}, day: '', used: 0, opened: 0 };
}
function kpColSave(c) { try { localStorage.setItem(KP_CARDS_KEY, JSON.stringify(c)); } catch {} }
function kpPacksLeft(c) {
  c = c || kpColLoad();
  return Math.max(0, KP_PACKS_DAY - (c.day === kpToday() ? c.used : 0));
}

function kpCardHtml(c, opts) {
  opts = opts || {};
  const pad = n => String(n).padStart(3, '0');
  const stat = (v, l) => '<div><b>' + (v ? (l === 'songs' ? v : '#' + v) : '-') + '</b><span>' + l + '</span></div>';
  return '<div class="kp-card r-' + c.rar + (opts.tilt ? ' tilt' : '') + '" data-id="' + esc(c.id) + '">' +
    '<div class="kp-card-in">' +
      '<div class="kp-card-top"><span class="kp-card-nm">' + esc(c.name) + '</span><span class="kp-card-hp">HP ' + c.hp + '</span></div>' +
      '<div class="kp-card-art">' + (c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<span>♫</span>') + '</div>' +
      '<div class="kp-card-type">' + KP_RARITY[c.rar].label + ' &middot; ' + esc(c.genre) + '</div>' +
      '<div class="kp-card-stats">' + stat(c.now, 'this month') + stat(c.ever, 'all time') + stat(c.songs, 'songs') + '</div>' +
      (c.top ? '<div class="kp-card-move"><i>♫</i>' + esc(c.top) + '</div>' : '') +
      '<div class="kp-card-foot"><span>#' + pad(c.no) + '/050</span><span>xXx SparkleStats xXx</span></div>' +
    '</div>' +
    '<div class="kp-holo"></div><div class="kp-glare"></div>' +
    (opts.isNew ? '<div class="kp-new">NEW</div>' : '') +
    (opts.count > 1 ? '<div class="kp-dupe">x' + opts.count + '</div>' : '') +
  '</div>';
}

// the shine follows your finger / mouse
function kpTilt(root) {
  (root || document).querySelectorAll('.kp-card.tilt').forEach(el => {
    if (el._kpTilt) return;
    el._kpTilt = true;
    const move = e => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      el.classList.add('touched');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      el.style.setProperty('--rx', ((0.5 - y) * 22).toFixed(1) + 'deg');
      el.style.setProperty('--ry', ((x - 0.5) * 22).toFixed(1) + 'deg');
    };
    const leave = () => {
      el.classList.remove('touched');
      ['--mx', '--my', '--rx', '--ry'].forEach(p => el.style.removeProperty(p));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointercancel', leave);
  });
}

function kpScreenCards(tab) {
  Q.screen = 'kp-cards';
  qStopAudio(); qClearTimers();
  if (kpNeedData('🃏 trading cards')) return;
  if (tab) KP.cardTab = tab;
  const set = kpCardSet();
  if (set.length < 5) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('🃏 trading cards', '') + qErrorBox('need at least 5 top artists for a set'));
    return;
  }
  const col = kpColLoad();
  const owned = set.filter(c => col.owned[c.id]).length;
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🃏 trading cards', owned + ' / ' + set.length + ' collected') +
    '<div class="tabs">' + [['packs', 'packs'], ['binder', 'binder']].map(([k, l]) =>
      '<button class="' + (KP.cardTab === k ? 'active' : '') + '" onclick="kpScreenCards(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
    '<div id="kp-cards-body"></div>'
  );
  if (KP.cardTab === 'binder') kpRenderBinder(set, col); else kpRenderPacks(set, col);
}

function kpRenderPacks(set, col) {
  const box = document.getElementById('kp-cards-body'); if (!box) return;
  const left = kpPacksLeft(col);
  const faces = set.slice(0, 3).map(c => c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<span>♫</span>').join('');
  box.innerHTML =
    '<div class="kp-packzone">' +
      '<div class="kp-pack' + (left ? '' : ' empty') + '" id="kp-pack" onclick="kpOpenPack()">' +
        '<div class="kp-pack-crimp"></div>' +
        '<div class="kp-pack-face">' +
          '<div class="kp-pack-logo">SparkleStats</div>' +
          '<div class="kp-pack-faces">' + faces + '</div>' +
          '<div class="kp-pack-series">series 01 &middot; 5 cards</div>' +
        '</div>' +
        '<div class="kp-pack-crimp bot"></div>' +
        '<div class="kp-pack-shine"></div>' +
      '</div>' +
    '</div>' +
    '<div class="q-actions">' +
      (left
        ? '<button class="q-btn" onclick="kpOpenPack()">open a pack &middot; ' + left + ' left</button>'
        : '<button class="q-btn" disabled>new packs tomorrow</button>') +
      '<button class="q-btn ghost" onclick="kpScreenCards(\'binder\')">binder</button>' +
    '</div>';
}

function kpDrawPack(set, rnd) {
  const tiers = {};
  for (const c of set) (tiers[c.rar] = tiers[c.rar] || []).push(c);
  const roll = floor => {
    const order = ['mythic', 'ultra', 'rare', 'common'];
    const allowed = order.slice(0, order.indexOf(floor) + 1).filter(k => tiers[k]);
    const tot = allowed.reduce((s, k) => s + KP_RARITY[k].w, 0);
    let x = rnd() * tot;
    for (const k of allowed) { x -= KP_RARITY[k].w; if (x <= 0) return k; }
    return allowed[allowed.length - 1];
  };
  const out = [];
  for (let i = 0; i < 5; i++) {
    const k = roll(i === 4 ? 'rare' : 'common') || Object.keys(tiers)[0];
    out.push(kpPick(tiers[k], rnd));
  }
  // rarest last, for the drama
  const rank = { common: 0, rare: 1, ultra: 2, mythic: 3 };
  return out.sort((a, b) => rank[a.rar] - rank[b.rar]);
}

function kpOpenPack() {
  if (KP.busy) return;
  const col = kpColLoad();
  if (kpPacksLeft(col) <= 0) return;
  const set = kpCardSet();
  const pulled = kpDrawPack(set, Math.random);
  if (col.day !== kpToday()) { col.day = kpToday(); col.used = 0; }
  col.used++; col.opened = (col.opened || 0) + 1;
  const fresh = new Set();
  for (const c of pulled) {
    if (!col.owned[c.id] && !fresh.has(c.id)) fresh.add(c.id);
    col.owned[c.id] = (col.owned[c.id] || 0) + 1;
  }
  kpColSave(col);
  KP.busy = true;
  const pack = document.getElementById('kp-pack');
  if (pack) pack.classList.add('kp-rip');
  setTimeout(() => {
    KP.busy = false;
    const box = document.getElementById('kp-cards-body'); if (!box) return;
    const seen = new Set();
    box.innerHTML =
      '<div class="kp-pull">' + pulled.map((c, i) => {
        const isNew = fresh.has(c.id) && !seen.has(c.id);
        seen.add(c.id);
        return '<div class="kp-flip r-' + c.rar + '" style="--i:' + i + '" data-id="' + esc(c.id) + '" onclick="kpFlip(this)">' +
          '<div class="kp-flip-in"><div class="kp-back"><span>xXx</span><b>SparkleStats</b><span>xXx</span></div>' +
          '<div class="kp-front">' + kpCardHtml(c, { isNew }) + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="q-actions">' +
        '<button class="q-btn" onclick="kpFlipAll()">flip all</button>' +
        (kpPacksLeft() ? '<button class="q-btn ghost" onclick="kpScreenCards(\'packs\')">next pack &middot; ' + kpPacksLeft() + ' left</button>' : '') +
        '<button class="q-btn ghost" onclick="kpScreenCards(\'binder\')">binder</button>' +
      '</div>';
    const h = document.querySelector('.q-head p');
    if (h) h.textContent = set.filter(c => col.owned[c.id]).length + ' / ' + set.length + ' collected';
  }, 950);
}

function kpFlip(el) {
  if (!el.classList.contains('flipped')) {
    el.classList.add('flipped');
    const big = el.classList.contains('r-mythic') || el.classList.contains('r-ultra');
    if (big && typeof confetti === 'function') {
      const r = el.getBoundingClientRect();
      confetti({ particleCount: el.classList.contains('r-mythic') ? 140 : 60, spread: 70,
        origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight },
        colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#ffffff', '#8B00FF'] });
    }
    return;
  }
  kpZoom(el.dataset.id);
}
function kpFlipAll() {
  document.querySelectorAll('.kp-flip:not(.flipped)').forEach((el, i) => setTimeout(() => kpFlip(el), i * 180));
}

function kpRenderBinder(set, col) {
  const box = document.getElementById('kp-cards-body'); if (!box) return;
  const pad = n => String(n).padStart(3, '0');
  box.innerHTML = '<div class="kp-binder">' + set.map(c => {
    const n = col.owned[c.id] || 0;
    if (!n) return '<div class="kp-slot empty"><span class="q">?</span><span class="no">#' + pad(c.no) + '</span></div>';
    return '<button class="kp-slot r-' + c.rar + '" onclick="kpZoom(\'' + esc(c.id) + '\')">' +
      (c.img ? '<img src="' + esc(c.img) + '" alt="">' : '<span class="q">♫</span>') +
      '<span class="nm">' + esc(c.name) + '</span><span class="no">#' + pad(c.no) + '</span>' +
      (n > 1 ? '<i>x' + n + '</i>' : '') + '</button>';
  }).join('') + '</div>' +
  '<div class="q-actions"><button class="q-btn" onclick="kpScreenCards(\'packs\')">open packs &middot; ' + kpPacksLeft(col) + ' left</button></div>';
}

function kpZoom(id) {
  const c = kpCardSet().find(x => x.id === id); if (!c) return;
  kpCloseZoom();
  const n = kpColLoad().owned[id] || 0;
  const z = document.createElement('div');
  z.className = 'kp-zoom'; z.id = 'kp-zoom';
  z.onclick = e => { if (e.target === z) kpCloseZoom(); };
  z.innerHTML = '<div class="kp-zoom-card" id="kp-zoom-card">' + kpCardHtml(c, { tilt: true, count: n }) + '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="kpSaveCard(this)">save card</button>' +
      '<button class="q-btn ghost" onclick="kpCloseZoom()">close</button>' +
    '</div>';
  document.getElementById('game').appendChild(z);
  kpTilt(z);
}
function kpCloseZoom() { const z = document.getElementById('kp-zoom'); if (z) z.remove(); }
function kpSaveCard(btn) {
  const el = document.querySelector('#kp-zoom-card .kp-card'); if (!el) return;
  el.classList.remove('touched');
  ['--mx', '--my', '--rx', '--ry'].forEach(p => el.style.removeProperty(p));
  el.classList.add('kp-snap');
  const name = (el.querySelector('.kp-card-nm') || {}).textContent || 'card';
  lSaveNode(el, 'sparklestats-card-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), btn, 3)
    .finally(() => el.classList.remove('kp-snap'));
}

// ======================== SCRAPBOOK ========================

const KP_STICKERS = ['★', '♥', '✿', '✦', '☾', '💀', '🦇', '🎀', '⛓️', '💋', '🖤', '🩷', '♡', '🕸️', '🍒', '⚡', '🌙', '💿', '🎸', '✩'];
const KP_DOODLES = [
  // heart
  '<svg viewBox="0 0 60 56"><path d="M30 52C8 36 2 24 6 14 10 4 24 2 30 14 36 2 50 4 54 14 58 24 52 36 30 52Z"/></svg>',
  // star
  '<svg viewBox="0 0 60 60"><path d="M30 4 37 22 56 23 41 35 46 54 30 43 14 54 19 35 4 23 23 22Z"/></svg>',
  // swirl
  '<svg viewBox="0 0 60 60"><path d="M30 30c0-4 6-4 6 0 0 8-12 8-12 0 0-12 18-12 18 0 0 16-24 16-24 0 0-20 30-20 30 0"/></svg>',
  // lightning
  '<svg viewBox="0 0 40 60"><path d="M24 2 6 34h14L14 58 34 24H20Z"/></svg>',
  // crown
  '<svg viewBox="0 0 64 44"><path d="M6 38 4 10 20 24 32 4 44 24 60 10 58 38Z"/></svg>',
  // little bat
  '<svg viewBox="0 0 80 40"><path d="M40 12c-3 0-4 4-4 4l-2-4-1 6C28 10 18 6 4 10c8 4 10 10 10 16 4-4 10-4 14 0 2-4 6-6 12-4 6-2 10 0 12 4 4-4 10-4 14 0 0-6 2-12 10-16-14-4-24 0-29 8l-1-6-2 4s-1-4-4-4Z"/></svg>',
  // squiggle underline
  '<svg viewBox="0 0 90 24"><path d="M4 14c10-12 16 8 26-2s16 8 26-2 16 8 30-4"/></svg>',
];

function kpScrapBuild(range, seed) {
  const rnd = kpRng(seed * 7919 + 17);
  const arts = (_data.artists[range] || []).slice(0, 3);
  const tracks = _data.tracks[range] || [];
  const albums = [], seenAl = new Set();
  for (const t of tracks) {
    const id = t.album?.id || t.id;
    if (seenAl.has(id) || !qArt(t)) continue;
    seenAl.add(id); albums.push(t);
    if (albums.length >= 5) break;
  }
  const genre = analyzeGenres({ [range]: _data.artists[range] || [] }).ranked[0]?.genre || '';
  const items = [];
  const big = [];
  arts.forEach(a => big.push({ kind: 'pol', w: 30, html: (kpImg(a) ? '<img src="' + esc(kpImg(a)) + '" alt="">' : '<div class="ph">♫</div>') + '<span>' + esc(a.name) + '</span>' }));
  albums.forEach(t => big.push({ kind: 'cov', w: 22, html: '<img src="' + esc(qArt(t)) + '" alt="">' }));
  if (tracks[0]) big.push({ kind: 'note', w: 38, html: '<i>on repeat</i><b>' + esc(qStrip(tracks[0].name)) + '</b><span>' + esc(gPrimary(tracks[0])) + '</span>' });
  if (genre) big.push({ kind: 'tag', w: 30, html: esc(genre) });
  // a jittered grid so the big stuff mostly doesn't stack
  const cells = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) cells.push([18 + col * 32, 25 + row * 19]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  big.forEach((it, i) => {
    const [cx, cy] = cells[i % cells.length];
    it.x = cx + (rnd() - 0.5) * 10; it.y = cy + (rnd() - 0.5) * 8;
    it.r = (rnd() - 0.5) * 22;
    it.tape = it.kind === 'pol' || it.kind === 'cov' ? Math.floor(rnd() * 3) : -1;
    it.z = 1 + Math.floor(rnd() * 10);
    items.push(it);
  });
  items.push({ kind: 'title', w: 84, x: 50, y: 8, r: -2, z: 30, html: esc(yFirstName()) + '\'s <b>' + esc(kpRangeLabel(range)) + '</b>' });
  for (let i = 0; i < 5; i++) {
    items.push({ kind: 'doodle', w: 12 + rnd() * 6, x: 6 + rnd() * 88, y: 16 + rnd() * 80, r: (rnd() - 0.5) * 50, z: 20, tone: rnd() < 0.5 ? 'pk' : 'bk', html: kpPick(KP_DOODLES, rnd) });
  }
  for (let i = 0; i < 9; i++) items.push(kpSticker(rnd));
  return { items, top: 40 };
}
function kpSticker(rnd) {
  return { kind: 'stk', w: 9 + rnd() * 5, x: 5 + rnd() * 90, y: 14 + rnd() * 82, r: (rnd() - 0.5) * 40, z: 35, html: kpPick(KP_STICKERS, rnd) };
}

function kpScrapItemHtml(it, i) {
  const tape = it.tape >= 0 ? '<div class="kp-tape t' + it.tape + '"></div>' : '';
  return '<div class="kp-it k-' + it.kind + (it.tone ? ' ' + it.tone : '') + '" data-i="' + i + '" style="left:' + it.x + '%;top:' + it.y +
    '%;width:' + it.w + '%;z-index:' + it.z + ';--r:' + it.r.toFixed(1) + 'deg">' + tape + '<div class="kp-it-in">' + it.html + '</div></div>';
}

function kpScreenScrap(range) {
  Q.screen = 'kp-scrap';
  qStopAudio(); qClearTimers();
  if (kpNeedData('📒 scrapbook')) return;
  if (range) KP.scrapRange = range;
  const r = KP.scrapRange;
  if ((_data.artists[r] || []).length < 3) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('📒 scrapbook', '') + yTabs(r, 'kpScreenScrap') + qErrorBox('not enough top artists in this range yet'));
    return;
  }
  KP.scrap = kpScrapBuild(r, KP.scrapSeed);
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('📒 scrapbook', '') +
    yTabs(r, 'kpScreenScrap') +
    '<div class="kp-scrap" id="kp-scrap"></div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#kp-scrap\', \'sparklestats-scrapbook\', this, 2)">save page</button>' +
      '<button class="q-btn ghost" onclick="kpScrapShuffle()">shuffle</button>' +
      '<button class="q-btn ghost" onclick="kpScrapSticker()">+ sticker</button>' +
    '</div>'
  );
  kpScrapDraw();
  const page = document.getElementById('kp-scrap');
  page.addEventListener('pointerdown', kpScrapDown);
  page.addEventListener('pointermove', kpScrapMove);
  page.addEventListener('pointerup', kpScrapUp);
  page.addEventListener('pointercancel', kpScrapUp);
}
function kpScrapDraw() {
  const page = document.getElementById('kp-scrap'); if (!page || !KP.scrap) return;
  page.innerHTML = '<div class="kp-scrap-holes"></div>' + KP.scrap.items.map(kpScrapItemHtml).join('');
}
function kpScrapShuffle() { KP.scrapSeed++; kpScreenScrap(); }
function kpScrapSticker() {
  if (!KP.scrap) return;
  const it = kpSticker(Math.random);
  it.x = 30 + Math.random() * 40; it.y = 35 + Math.random() * 30; it.z = ++KP.scrap.top;
  KP.scrap.items.push(it);
  kpScrapDraw();
}
function kpScrapDown(e) {
  const el = e.target.closest('.kp-it'); if (!el || !KP.scrap) return;
  e.preventDefault();
  const it = KP.scrap.items[+el.dataset.i]; if (!it) return;
  const page = document.getElementById('kp-scrap');
  KP.drag = { el, it, r: page.getBoundingClientRect(), sx: e.clientX, sy: e.clientY, x0: it.x, y0: it.y };
  it.z = ++KP.scrap.top;
  el.style.zIndex = it.z;
  el.classList.add('kp-lift');
  try { el.setPointerCapture(e.pointerId); } catch {}
}
function kpScrapMove(e) {
  const d = KP.drag; if (!d) return;
  d.it.x = Math.max(0, Math.min(100, d.x0 + (e.clientX - d.sx) / d.r.width * 100));
  d.it.y = Math.max(0, Math.min(100, d.y0 + (e.clientY - d.sy) / d.r.height * 100));
  d.el.style.left = d.it.x + '%';
  d.el.style.top = d.it.y + '%';
}
function kpScrapUp() {
  if (!KP.drag) return;
  KP.drag.el.classList.remove('kp-lift');
  KP.drag = null;
}

// ======================== STORY RECAP ========================

function kpStorySlides(r) {
  const arts = _data.artists[r] || [], tracks = _data.tracks[r] || [];
  const name = yFirstName();
  const out = [];
  const sparkles = '<div class="kp-sparks">' + Array.from({ length: 14 }, (_, i) =>
    '<i style="left:' + ((i * 37) % 100) + '%;animation-delay:' + (i * 0.37 % 3).toFixed(2) + 's">' + (i % 3 ? '✦' : '♥') + '</i>').join('') + '</div>';

  out.push({ bg: 'b0', html: sparkles + '<div class="kp-s-mid"><div class="kp-s-kick" style="text-transform:none">xXx SparkleStats xXx</div><div class="kp-s-huge">' + esc(name) + '\'s<br>recap</div><div class="kp-s-pill">' + esc(kpRangeLabel(r)) + '</div></div>' });

  const g = analyzeGenres({ [r]: arts }).ranked;
  if (g.length) out.push({ bg: 'b1', html: '<div class="kp-s-mid"><div class="kp-s-kick">top genre</div><div class="kp-s-big kp-pop">' + esc(g[0].genre) + '</div>' +
    '<div class="kp-s-list small">' + g.slice(1, 4).map((x, i) => '<div style="--d:' + (0.6 + i * 0.25) + 's"><b>' + (i + 2) + '</b>' + esc(x.genre) + '</div>').join('') + '</div></div>' });

  if (arts[0]) out.push({ bg: 'b2', html: '<div class="kp-s-mid"><div class="kp-s-kick">your #1 artist</div>' +
    (kpImg(arts[0]) ? '<img class="kp-s-hero" src="' + esc(kpImg(arts[0])) + '" alt="">' : '') +
    '<div class="kp-s-big">' + esc(arts[0].name) + '</div></div>' });

  if (arts.length >= 5) out.push({ bg: 'b3', html: '<div class="kp-s-mid"><div class="kp-s-kick">top artists</div><div class="kp-s-list">' +
    arts.slice(0, 5).map((a, i) => '<div style="--d:' + (0.2 + i * 0.3) + 's"><b>' + (i + 1) + '</b>' + (kpImg(a) ? '<img src="' + esc(kpImg(a)) + '" alt="">' : '') + '<span>' + esc(a.name) + '</span></div>').join('') + '</div></div>' });

  if (tracks[0]) out.push({ bg: 'b4', dur: 9000, song: tracks[0], html: '<div class="kp-s-mid"><div class="kp-s-kick">your #1 song</div>' +
    '<div class="kp-s-rec"><div class="kp-s-disc">' + (qArt(tracks[0]) ? '<img src="' + esc(qArt(tracks[0])) + '" alt="">' : '') + '</div></div>' +
    '<div class="kp-s-big">' + esc(qStrip(tracks[0].name)) + '</div><div class="kp-s-sub">' + esc(qArtistNames(tracks[0])) + '</div></div>' });

  if (tracks.length >= 5) out.push({ bg: 'b5', html: '<div class="kp-s-mid"><div class="kp-s-kick">top songs</div><div class="kp-s-list">' +
    tracks.slice(0, 5).map((t, i) => '<div style="--d:' + (0.2 + i * 0.3) + 's"><b>' + (i + 1) + '</b>' + (qArt(t) ? '<img class="sq" src="' + esc(qArt(t)) + '" alt="">' : '') + '<span>' + esc(qStrip(t.name)) + '<small>' + esc(gPrimary(t)) + '</small></span></div>').join('') + '</div></div>' });

  const dec = analyzeDecades({ [r]: tracks });
  if (dec.distribution.length) {
    const mx = Math.max(...dec.distribution.map(d => d.count));
    out.push({ bg: 'b6', html: '<div class="kp-s-mid"><div class="kp-s-kick">your music is from</div><div class="kp-s-huge kp-pop">' + dec.avgYear + '</div>' +
      '<div class="kp-s-bars">' + dec.distribution.map((d, i) => '<div><i style="--h:' + Math.max(6, d.count / mx * 100) + '%;--d:' + (0.5 + i * 0.12) + 's"></i><span>' + esc(d.decade.replace(/^\d\d/, '\'')) + '</span></div>').join('') + '</div></div>' });
  }

  if (tracks.length && arts[0]) {
    const uniq = new Set(tracks.flatMap(t => (t.artists || []).map(a => a.id))).size;
    const byTop = tracks.filter(t => (t.artists || []).some(a => a.id === arts[0].id)).length;
    out.push({ bg: 'b7', html: '<div class="kp-s-mid"><div class="kp-s-kick">by the numbers</div><div class="kp-s-nums">' +
      '<div style="--d:.2s"><b>' + tracks.length + '</b>top songs</div>' +
      '<div style="--d:.5s"><b>' + uniq + '</b>different artists in them</div>' +
      '<div style="--d:.8s"><b>' + byTop + '</b>by ' + esc(arts[0].name) + '</div>' +
    '</div></div>' });
  }

  // the summary card at the end
  const a0 = arts[0];
  out.push({ bg: 'b8', dur: 999999, html: '<div class="kp-s-sum">' +
    '<div class="kp-s-sumhead">' + esc(name) + '\'s ' + esc(kpRangeLabel(r)) + '</div>' +
    (a0 && kpImg(a0) ? '<img class="kp-s-sumimg" src="' + esc(kpImg(a0)) + '" alt="">' : '') +
    '<div class="kp-s-grid">' +
      '<div><span>top artists</span>' + arts.slice(0, 5).map((a, i) => '<p>' + (i + 1) + ' ' + esc(a.name) + '</p>').join('') + '</div>' +
      '<div><span>top songs</span>' + tracks.slice(0, 5).map((t, i) => '<p>' + (i + 1) + ' ' + esc(qStrip(t.name)) + '</p>').join('') + '</div>' +
    '</div>' +
    '<div class="kp-s-grid two">' +
      (g.length ? '<div><span>top genre</span><p class="big">' + esc(g[0].genre) + '</p></div>' : '') +
      (dec.distribution.length ? '<div><span>music age</span><p class="big">' + dec.avgYear + '</p></div>' : '') +
    '</div>' +
    '<div class="kp-s-foot">xXx SparkleStats xXx</div>' +
  '</div>' });
  return out;
}

function kpScreenStory(range) {
  Q.screen = 'kp-story';
  qStopAudio(); qClearTimers();
  if (kpNeedData('📱 story recap')) return;
  if (range) KP.storyRange = range;
  const r = KP.storyRange;
  const slides = kpStorySlides(r);
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('📱 story recap', '') +
    yTabs(r, 'kpScreenStory') +
    '<div class="kp-story" id="kp-story">' +
      '<div class="kp-bars">' + slides.map(() => '<i><b></b></i>').join('') + '</div>' +
      '<div class="kp-slide" id="kp-slide"></div>' +
      '<div class="kp-mute" id="kp-mute"></div>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="kpStorySave(this)">save this slide</button>' +
      '<button class="q-btn ghost" onclick="kpStoryGo(0)">replay</button>' +
    '</div>'
  );
  KP.story = { slides, i: 0, t: 0, paused: false, last: Date.now(), hold: null, held: false };
  const box = document.getElementById('kp-story');
  box.addEventListener('pointerdown', e => {
    const s = KP.story; if (!s) return;
    s.held = false;
    s.hold = setTimeout(() => { s.held = true; s.paused = true; box.classList.add('paused'); if (KP.audio) KP.audio.pause(); }, 260);
  });
  const up = e => {
    const s = KP.story; if (!s) return;
    clearTimeout(s.hold);
    if (s.held) {
      s.held = false; s.paused = false; box.classList.remove('paused');
      if (KP.audio && KP.audio.getAttribute('src') && s.slides[s.i].song) KP.audio.play().catch(() => {});
      return;
    }
    if (e.type !== 'pointerup') return;
    const rc = box.getBoundingClientRect();
    if (e.clientX - rc.left < rc.width * 0.3) kpStoryGo(s.i - 1); else kpStoryGo(s.i + 1);
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
  box.addEventListener('contextmenu', e => e.preventDefault());
  kpStoryGo(0);
  clearInterval(KP.storyTimer);
  KP.storyTimer = setInterval(kpStoryTick, 50);
}

function kpStoryGo(i) {
  const s = KP.story; if (!s) return;
  i = Math.max(0, Math.min(s.slides.length - 1, i));
  s.i = i; s.t = 0; s.last = Date.now(); s.paused = false;
  const box = document.getElementById('kp-story'); if (!box) return;
  box.classList.remove('paused');
  const sl = s.slides[i];
  const old = document.getElementById('kp-slide');
  const fresh = document.createElement('div');
  fresh.className = 'kp-slide ' + sl.bg; fresh.id = 'kp-slide';
  fresh.innerHTML = sl.html;
  old.replaceWith(fresh);
  box.querySelectorAll('.kp-bars b').forEach((b, k) => { b.style.width = k < i ? '100%' : '0%'; });
  const mute = document.getElementById('kp-mute');
  if (mute) mute.textContent = '';
  if (sl.song) {
    kpPlayTrack(sl.song, ok => {
      const disc = document.querySelector('#kp-slide .kp-s-disc');
      if (disc) disc.classList.toggle('spin', ok);
    });
  } else kpStopAudio();
}

function kpStoryTick() {
  const s = KP.story;
  if (!s || !document.getElementById('kp-story')) { clearInterval(KP.storyTimer); KP.storyTimer = null; return; }
  const now = Date.now(), dt = now - s.last;
  s.last = now;
  if (s.paused) return;
  const sl = s.slides[s.i];
  const dur = sl.dur || 5500;
  s.t += dt;
  const bar = document.querySelectorAll('#kp-story .kp-bars b')[s.i];
  if (bar) bar.style.width = (dur > 100000 ? 100 : Math.min(100, s.t / dur * 100)) + '%';
  if (s.t >= dur && s.i < s.slides.length - 1) kpStoryGo(s.i + 1);
}

function kpStorySave(btn) {
  const s = KP.story; if (!s) return;
  s.paused = true;
  lSaveNode('#kp-story', 'sparklestats-story-' + (s.i + 1), btn, 2).finally(() => { s.paused = false; s.last = Date.now(); });
}

// ======================== CONCERT TICKET ========================

const KP_VENUES = ['the roller rink', 'an abandoned mall food court', 'the high school gym', 'a basement in the suburbs',
  'the parking lot behind the mall', 'a sold-out arena', 'the rooftop', 'a tiny record store', 'the ice rink', 'the pier at midnight',
  'a laundromat', 'the skate park', 'the planetarium', 'your bedroom'];
const KP_TICKET_STYLES = [['paper', 'paper'], ['vip', 'vip'], ['pass', 'backstage pass']];

function kpBarcode(seed) {
  const rnd = kpRng(seed);
  let x = 0, bars = '';
  while (x < 196) {
    const w = 1 + Math.floor(rnd() * 3);
    bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>';
    x += w + 1 + Math.floor(rnd() * 3);
  }
  return '<svg class="kp-bar" viewBox="0 0 200 40" preserveAspectRatio="none">' + bars + '</svg>';
}

function kpScreenTicket(range) {
  Q.screen = 'kp-ticket';
  qStopAudio(); qClearTimers();
  if (kpNeedData('🎟️ concert ticket')) return;
  if (range) KP.ticketRange = range;
  const r = KP.ticketRange;
  const arts = _data.artists[r] || [];
  if (arts.length < 3) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('🎟️ concert ticket', '') + yTabs(r, 'kpScreenTicket') + qErrorBox('need at least 3 top artists in this range'));
    return;
  }
  const seed = kpHash(arts[0].id + r) + KP.ticketSeed * 101;
  const rnd = kpRng(seed);
  const venue = kpPick(KP_VENUES, rnd);
  const d = new Date();
  d.setDate(d.getDate() + 14 + Math.floor(rnd() * 120));
  while (d.getDay() !== 5 && d.getDay() !== 6) d.setDate(d.getDate() + 1);
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const date = days[d.getDay()] + ' ' + Y_MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + d.getFullYear();
  const pit = rnd() < 0.35;
  const sec = pit ? 'PIT' : String(100 + Math.floor(rnd() * 30));
  const row = pit ? 'GA' : 'ABCDEFGHJK'[Math.floor(rnd() * 10)];
  const seat = pit ? '-' : String(1 + Math.floor(rnd() * 24));
  const no = String(seed % 100000000).padStart(8, '0');
  const st = KP.ticketStyle;
  const head = arts[0], openers = arts.slice(1, 3), guest = arts[3];
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🎟️ concert ticket', '') +
    yTabs(r, 'kpScreenTicket') +
    '<div class="tabs kp-subtabs">' + KP_TICKET_STYLES.map(([k, l]) =>
      '<button class="' + (st === k ? 'active' : '') + '" onclick="kpTicketStyle(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
    '<div class="kp-ticketwrap"><div class="kp-ticket s-' + st + '" id="kp-ticket">' +
      (st === 'pass' ? '<div class="kp-tk-strap"></div><div class="kp-tk-hole"></div>' : '') +
      '<div class="kp-tk-main">' +
        '<div class="kp-tk-pre">' + (st === 'pass' ? 'ALL ACCESS' : st === 'vip' ? 'VIP' : 'ADMIT ONE') + '</div>' +
        (kpImg(head) ? '<div class="kp-tk-img"><img src="' + esc(kpImg(head)) + '" alt=""></div>' : '') +
        '<div class="kp-tk-head">' + esc(head.name) + '</div>' +
        '<div class="kp-tk-with">with ' + openers.map(a => esc(a.name)).join(' &amp; ') + '</div>' +
        (guest ? '<div class="kp-tk-guest">special guest ' + esc(guest.name) + '</div>' : '') +
        '<div class="kp-tk-grid">' +
          '<div><span>venue</span><b>' + esc(venue) + '</b></div>' +
          '<div><span>date</span><b>' + date + '</b></div>' +
          '<div><span>doors</span><b>7:00 pm</b></div>' +
          '<div><span>show</span><b>8:00 pm</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="kp-tk-perf"></div>' +
      '<div class="kp-tk-stub">' +
        '<div class="kp-tk-seat"><div><span>sec</span><b>' + sec + '</b></div><div><span>row</span><b>' + row + '</b></div><div><span>seat</span><b>' + seat + '</b></div></div>' +
        kpBarcode(seed) +
        '<div class="kp-tk-no">' + no + ' &middot; ' + esc(yFirstName()) + '</div>' +
      '</div>' +
    '</div></div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#kp-ticket\', \'sparklestats-ticket\', this, 3)">save ticket</button>' +
      '<button class="q-btn ghost" onclick="kpTicketReroll()">new venue</button>' +
    '</div>'
  );
}
function kpTicketStyle(s) { KP.ticketStyle = s; kpScreenTicket(); }
function kpTicketReroll() { KP.ticketSeed++; kpScreenTicket(); }

// ======================== VINYL SHELF ========================

function kpAlbums(r) {
  const m = new Map();
  for (const t of _data.tracks[r] || []) {
    const al = t.album; if (!al) continue;
    const id = al.id || al.name;
    if (!m.has(id)) m.set(id, { al, t });
  }
  return [...m.values()].slice(0, 16);
}

function kpScreenVinyl(range) {
  Q.screen = 'kp-vinyl';
  qStopAudio(); qClearTimers();
  if (kpNeedData('💿 vinyl shelf')) return;
  if (range) KP.vinylRange = range;
  const r = KP.vinylRange;
  const albums = kpAlbums(r);
  KP.vinyl = { albums, cur: -1 };
  if (!albums.length) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('💿 vinyl shelf', '') + yTabs(r, 'kpScreenVinyl') + qErrorBox('no albums in this range yet'));
    return;
  }
  const rows = [];
  for (let i = 0; i < albums.length; i += 4) rows.push(albums.slice(i, i + 4).map((x, k) => [x, i + k]));
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('💿 vinyl shelf', '') +
    yTabs(r, 'kpScreenVinyl') +
    '<div class="kp-deck">' +
      '<div class="kp-tt" id="kp-tt">' +
        '<div class="kp-platter"><div class="kp-disc" id="kp-disc"><div class="kp-label" id="kp-label"></div></div></div>' +
        '<div class="kp-arm"><i></i></div>' +
        '<div class="kp-knobs"><i></i><i></i></div>' +
      '</div>' +
      '<div class="kp-now" id="kp-now"></div>' +
      '<div class="q-actions kp-vbtns">' +
        '<button class="q-btn ghost" onclick="kpVinylStop()">■ stop</button>' +
        '<button class="q-btn ghost" onclick="kpVinylNext()">next ⏭</button>' +
      '</div>' +
    '</div>' +
    '<div class="kp-shelves">' + rows.map(row =>
      '<div class="kp-shelf"><div class="kp-row">' + row.map(([x, i]) =>
        '<button class="kp-sleeve" id="kp-sl-' + i + '" style="--t:' + (((i * 7) % 5) - 2) * 1.5 + 'deg" onclick="kpVinylPick(' + i + ')">' +
          '<span class="kp-peek"></span>' +
          ((x.al.images || [])[0] ? '<img src="' + esc(x.al.images[0].url) + '" alt="">' : '<span class="ph">♫</span>') +
        '</button>').join('') +
      '</div><div class="kp-board"></div></div>').join('') +
    '</div>'
  );
}

function kpVinylPick(i) {
  const v = KP.vinyl; if (!v || !v.albums[i]) return;
  const x = v.albums[i];
  document.querySelectorAll('.kp-sleeve.out').forEach(el => el.classList.remove('out'));
  const sl = document.getElementById('kp-sl-' + i); if (sl) sl.classList.add('out');
  v.cur = i;
  const tt = document.getElementById('kp-tt'), lab = document.getElementById('kp-label'), now = document.getElementById('kp-now');
  const art = (x.al.images || [])[0]?.url;
  if (lab) lab.innerHTML = art ? '<img src="' + esc(art) + '" alt="">' : '';
  if (tt) { tt.classList.remove('on', 'loaded'); void tt.offsetWidth; tt.classList.add('loaded'); }
  if (now) now.innerHTML = '<b>' + esc(x.al.name || '') + '</b><span>' + esc(qArtistNames(x.t)) + ' &middot; ♫ ' + esc(qStrip(x.t.name)) + '</span>';
  kpPlayTrack(x.t, ok => {
    if (v !== KP.vinyl || v.cur !== i) return;
    if (tt) tt.classList.toggle('on', ok);
    if (!ok && now) now.insertAdjacentHTML('beforeend', '<span class="kp-noclip">no clip for this one</span>');
  });
  const deck = document.querySelector('.kp-deck');
  if (deck && deck.getBoundingClientRect().top < 0) deck.scrollIntoView({ behavior: 'smooth' });
}
function kpVinylStop() {
  kpStopAudio();
  const tt = document.getElementById('kp-tt'); if (tt) tt.classList.remove('on');
}
function kpVinylNext() {
  const v = KP.vinyl; if (!v || !v.albums.length) return;
  kpVinylPick((v.cur + 1) % v.albums.length);
}

// ======================== HOOKS ========================

(function kpInstallHooks() {
  const prev = { qStopAudio };
  qStopAudio = function () {
    kpStopAudio();
    if (KP.storyTimer) { clearInterval(KP.storyTimer); KP.storyTimer = null; }
    const tt = document.getElementById('kp-tt'); if (tt) tt.classList.remove('on');
    return prev.qStopAudio();
  };
})();

X_HUB.you.push(
  () => { let n = 0; try { n = kpPacksLeft(); } catch {} return xCard('🃏', 'trading cards', 'holo cards of your top artists. open packs, fill the binder', 'kpGo(kpScreenCards)', n ? n + ' packs' : ''); },
  () => xCard('📒', 'scrapbook', 'your covers + artists taped into a page. drag stuff around', 'kpGo(kpScreenScrap)'),
  () => xCard('📱', 'story recap', 'your stats as tap-through stories', 'kpGo(kpScreenStory)'),
  () => xCard('🎟️', 'concert ticket', 'your dream show, headlined by your top artist', 'kpGo(kpScreenTicket)'),
  () => xCard('💿', 'vinyl shelf', 'your top albums on a shelf. pull one out and spin it', 'kpGo(kpScreenVinyl)')
);

Object.assign(window, {
  qStopAudio, kpGo,
  kpScreenCards, kpOpenPack, kpFlip, kpFlipAll, kpZoom, kpCloseZoom, kpSaveCard,
  kpScreenScrap, kpScrapShuffle, kpScrapSticker,
  kpScreenStory, kpStoryGo, kpStorySave,
  kpScreenTicket, kpTicketStyle, kpTicketReroll,
  kpScreenVinyl, kpVinylPick, kpVinylStop, kpVinylNext,
});
