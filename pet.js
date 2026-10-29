// ============================================================
//  xXx SparkleStats xXx  -  pet.js
//  music pet: a little pixel bat-blob that hatches from an egg,
//  takes its colors + accessories from your top genres, eats the
//  songs you feed it, snacks on whatever you've been playing, and
//  grows with your visit streak. saved in localStorage.
//  listening calendar: day-by-day heatmap from the data export
//  (history.js sparkle_history). save to spotify: any list of
//  songs here -> a real playlist. loads last.
// ============================================================

const MP_KEY = 'sparkle_pet';
const MP_W = 28, MP_H = 27, MP_OX = 5, MP_OY = 6;   // sprite grid + where the body sits in it
const MP = { st: null, timer: null, frame: 0, chomp: 0, bounce: 0, parts: [], blinkAt: 0, fam: null, fam2: null };

// ======================== GENRES -> LOOK ========================

const MP_FAMS = [
  ['emo', ['emo', 'punk', 'goth', 'metalcore', 'screamo', 'post-hardcore', 'pop punk']],
  ['metal', ['metal', 'hardcore']],
  ['hiphop', ['hip hop', 'hip-hop', 'rap', 'r&b', 'soul', 'trap']],
  ['pop', ['dance pop', 'teen pop', 'k-pop', 'j-pop', 'electropop', 'synthpop']],
  ['electronic', ['electro', 'dance', 'edm', 'house', 'techno', 'industrial', 'new wave', 'synth', 'hyperpop']],
  ['indie', ['indie', 'alternative', 'grunge', 'singer', 'shoegaze', 'bedroom']],
  ['pop', ['pop']],
  ['rock', ['rock']],
  ['country', ['country', 'folk', 'americana']],
];

const MP_PALS = {
  emo:        { o: '#FF1493', b: '#1c1c1c', d: '#000000', l: '#3b2531', e: '#FF69B4', a: '#FF1493', h: '#0a0a0a', H: '#FF1493' },
  metal:      { o: '#0a0a0a', b: '#4a4a55', d: '#1e1e24', l: '#6d6d7a', e: '#ff2a3a', a: '#C71585', h: '#111111', H: '#C71585' },
  hiphop:     { o: '#1a0630', b: '#6a2ab8', d: '#3b0f73', l: '#9a6be0', e: '#120020', a: '#FFD700', h: '#1a0630', H: '#FFD700' },
  electronic: { o: '#1a0033', b: '#B026FF', d: '#5a00a8', l: '#d98bff', e: '#00F0FF', a: '#00F0FF', h: '#1a0033', H: '#00F0FF' },
  indie:      { o: '#3a2050', b: '#c9a7e8', d: '#8a62b0', l: '#efe0fb', e: '#2a1038', a: '#7fb069', h: '#3a2050', H: '#7fb069' },
  pop:        { o: '#C71585', b: '#FFB6C1', d: '#FF69B4', l: '#FFF0F5', e: '#2a0a1a', a: '#8B00FF', h: '#C71585', H: '#8B00FF' },
  rock:       { o: '#14000a', b: '#b31b4b', d: '#5c0a24', l: '#e0577f', e: '#14000a', a: '#111111', h: '#14000a', H: '#FF69B4' },
  country:    { o: '#4a2a10', b: '#e8c39e', d: '#a9774a', l: '#fbe9d4', e: '#2a1608', a: '#8b5a2b', h: '#4a2a10', H: '#FF69B4' },
  none:       { o: '#C71585', b: '#FF69B4', d: '#C71585', l: '#FFB6C1', e: '#1a0010', a: '#8B00FF', h: '#1a0010', H: '#FFB6C1' },
};
const MP_ITEM = { emo: 'fringe', metal: 'spikes', hiphop: 'chain', electronic: 'headphones', indie: 'beanie', pop: 'bow', rock: 'star', country: 'star', none: 'star' };
const MP_NECK = new Set(['spikes', 'chain']);
const MP_FAM_LABEL = { emo: 'emo', metal: 'metal', hiphop: 'hip hop', electronic: 'electronic', indie: 'indie', pop: 'pop', rock: 'rock', country: 'country', none: '-' };

function mpFamilyOf(genre) {
  const g = String(genre || '').toLowerCase();
  for (const [fam, keys] of MP_FAMS) if (keys.some(k => g.includes(k))) return fam;
  return null;
}
function mpFamilyOfArtistGenres(genres) {
  const c = {};
  for (const g of genres || []) { const f = mpFamilyOf(g); if (f) c[f] = (c[f] || 0) + 1; }
  return Object.keys(c).sort((x, y) => c[y] - c[x])[0] || null;
}
// her top two genre families from the top artists
function mpFamilies() {
  if (typeof _data === 'undefined' || !_data || !_data.artists) return null;
  const c = {};
  const add = (list, w) => (list || []).forEach((a, i) => {
    const f = mpFamilyOfArtistGenres(a.genres);
    if (f) c[f] = (c[f] || 0) + w * (1 - i / 80);
  });
  add(_data.artists.short_term, 1.5); add(_data.artists.medium_term, 1);
  const order = Object.keys(c).sort((x, y) => c[y] - c[x]);
  return order.length ? order : null;
}
function mpArtistFamily(track) {
  if (typeof _data === 'undefined' || !_data || !track) return null;
  const ids = new Set((track.artists || []).map(a => a.id));
  for (const r of ['short_term', 'medium_term', 'long_term']) {
    for (const a of _data.artists[r] || []) if (ids.has(a.id)) return mpFamilyOfArtistGenres(a.genres);
  }
  return null;
}

// ======================== STATE ========================

function mpDayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

function mpLoad() {
  if (MP.st) return MP.st;
  let st = null;
  try { st = JSON.parse(localStorage.getItem(MP_KEY) || 'null'); } catch {}
  if (!st || typeof st !== 'object') st = { name: '', born: Date.now(), hatched: false, full: 60, lastT: Date.now(), eaten: 0, snacks: 0, streak: 0, lastDay: '', lastRecent: 0, fed: [], fam: null, fam2: null, best: 0 };
  MP.st = st;
  return st;
}
function mpSave() { try { localStorage.setItem(MP_KEY, JSON.stringify(MP.st)); } catch {} }

// time passing, visit streak, snacks from what she's been playing
function mpTickState(now) {
  const st = mpLoad();
  now = now || Date.now();
  const hrs = Math.max(0, (now - (st.lastT || now)) / 3600000);
  st.full = Math.max(0, st.full - hrs * 4);
  st.lastT = now;
  const today = mpDayKey(now), yest = mpDayKey(now - 86400000);
  if (st.lastDay !== today) {
    st.streak = st.lastDay === yest ? (st.streak || 0) + 1 : 1;
    st.lastDay = today;
    st.best = Math.max(st.best || 0, st.streak);
  }
  let snacked = 0;
  if (typeof _data !== 'undefined' && _data && Array.isArray(_data.recent)) {
    const times = _data.recent.map(r => Date.parse(r.played_at)).filter(Boolean);
    if (!st.lastRecent) st.lastRecent = times.length ? Math.max(...times) : now;   // first visit: nothing counts yet
    else {
      snacked = times.filter(t => t > st.lastRecent).length;
      if (snacked) { st.lastRecent = Math.max(...times); st.snacks = (st.snacks || 0) + snacked; if (st.hatched) st.full = Math.min(100, st.full + snacked * 2); }
    }
  }
  const fams = mpFamilies();
  if (fams) { st.fam = fams[0]; st.fam2 = fams[1] || null; }
  mpSave();
  return snacked;
}

function mpStage(st) {
  if (!st.hatched) return 0;
  const pts = (st.eaten || 0) + (st.streak || 0) * 3;
  return pts >= 40 ? 3 : pts >= 12 ? 2 : 1;
}
const MP_STAGE_NAME = ['egg', 'baby', 'kid', 'grown'];

function mpMood(st, now) {
  const h = new Date(now || Date.now()).getHours();
  if (!st.hatched) return 'egg';
  if (h >= 1 && h < 6) return 'sleepy';
  if (st.full < 25) return 'hungry';
  if (st.full >= 70) return 'happy';
  return 'ok';
}

// ======================== SPRITE ========================

function mpBody() {
  const r = (s, n) => s.repeat(n);
  return [
    '.o' + r('.', 14) + 'o.',
    '.oo' + r('.', 12) + 'oo.',
    '.obo' + r('.', 10) + 'obo.',
    '.obb' + r('o', 10) + 'bbo.',
    '.o' + r('b', 14) + 'o.',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    'o' + r('b', 16) + 'o',
    '.o' + r('b', 14) + 'o.',
    '..oo' + r('b', 10) + 'oo..',
    '....' + r('o', 10) + '....',
    '.....oo....oo.....',
  ];
}
const MP_EGG = [
  '....oooo....',
  '...obbbbo...',
  '..obbabbbo..',
  '..obbbbbbo..',
  '.obbbbbabbo.',
  '.obabbbbbbo.',
  'obbbbbbbbbbo',
  'obbbbabbbbbo',
  'obbbbbbbabbo',
  'obabbbbbbbbo',
  '.obbbbbbbbo.',
  '.obbbabbbbo.',
  '..obbbbbbo..',
  '...oooooo...',
];
const MP_WING_S = ['...o', '..ow', '.oww', 'owww', '.o.o'];
const MP_WING_B = ['....o', '...ow', '..oww', '.owww', 'owwww', 'owwww', '.o.ow'];
const MP_HEART = ['.k.k.', 'kkkkk', '.kkk.', '..k..'];

// builds a char grid for the current look. pure (no canvas) so it can be tested.
function mpGrid(o) {
  const g = Array.from({ length: MP_H }, () => Array(MP_W).fill('.'));
  const put = (x, y, ch) => { x += MP_OX; y += MP_OY; if (x >= 0 && y >= 0 && x < MP_W && y < MP_H && ch !== '.') g[y][x] = ch; };
  const stamp = (rows, x0, y0, mirror) => rows.forEach((row, y) => {
    const s = mirror ? row.split('').reverse().join('') : row;
    for (let x = 0; x < s.length; x++) put(x0 + x, y0 + y, s[x]);
  });
  if (o.stage === 0) { stamp(MP_EGG, 3 + (o.wobble || 0), 2); return g; }

  // wings behind the body
  const flap = o.flap ? -1 : 0;
  if (o.stage === 2) { stamp(MP_WING_S, -4, 6 + flap); stamp(MP_WING_S, 18, 6 + flap, true); }
  if (o.stage === 3) { stamp(MP_WING_B, -5, 4 + flap); stamp(MP_WING_B, 18, 4 + flap, true); }

  stamp(mpBody(), 0, 0);
  // belly
  for (let y = 9; y <= 13; y++) for (let x = 5; x <= 12; x++) {
    if ((y === 9 || y === 13) && (x === 5 || x === 12)) continue;
    if (g[y + MP_OY][x + MP_OX] === 'b') g[y + MP_OY][x + MP_OX] = 'l';
  }

  // face
  const m = o.mood;
  const eye = (x, kind) => {
    if (kind === 'blink' || kind === 'sleepy') { put(x - 1, 8, 'e'); put(x, 8, 'e'); put(x + 1, 8, 'e'); put(x + 2, 8, 'e'); return; }
    if (kind === 'happy') { put(x - 1, 8, 'e'); put(x, 7, 'e'); put(x + 1, 7, 'e'); put(x + 2, 8, 'e'); return; }
    put(x, 7, 'W'); put(x + 1, 7, 'e'); put(x, 8, 'e'); put(x + 1, 8, 'e');
  };
  const eyeKind = o.blink ? 'blink' : m === 'sleepy' ? 'sleepy' : (m === 'happy' || o.chomp) ? 'happy' : 'open';
  eye(4, eyeKind); eye(12, eyeKind);
  if (m === 'hungry' && !o.chomp) { put(4, 9, 'T'); put(4, 10, 'T'); }
  if (o.chomp && o.chomp % 2) {
    [[7, 10], [10, 10], [7, 11], [10, 11], [8, 12], [9, 12]].forEach(p => put(p[0], p[1], 'e'));
    [[8, 10], [9, 10], [8, 11], [9, 11]].forEach(p => put(p[0], p[1], 'M'));
    put(8, 10, 'W');
  } else if (m === 'hungry') {
    put(7, 11, 'e'); put(8, 10, 'e'); put(9, 10, 'e'); put(10, 11, 'e');
  } else if (m === 'sleepy') {
    put(8, 11, 'e'); put(9, 11, 'e');
  } else {
    put(7, 10, 'e'); put(8, 11, 'e'); put(9, 11, 'e'); put(10, 10, 'e'); put(9, 12, 'W');
  }
  if (m === 'happy' || m === 'ok' || o.chomp) { put(2, 10, 'k'); put(3, 10, 'k'); put(14, 10, 'k'); put(15, 10, 'k'); }

  // accessories: one on the head, one around the neck
  const items = o.items || [];
  for (const it of items) {
    if (it === 'fringe') {
      const rows = [[2, 5, 12], [3, 3, 14], [4, 2, 15], [5, 1, 13], [6, 1, 9], [7, 1, 6], [8, 2, 5], [9, 3, 4]];
      for (const [y, a, b] of rows) for (let x = a; x <= b; x++) put(x, y, 'h');
      for (let x = 8; x <= 10; x++) put(x, 4, 'H');
      for (let x = 6; x <= 8; x++) put(x, 5, 'H');
    } else if (it === 'bow') {
      stamp(['aa.aa', 'aaoaa', 'aa.aa'], 12, 1);
    } else if (it === 'headphones') {
      for (let x = 3; x <= 14; x++) put(x, -2, 'a');
      [1, 2, 15, 16].forEach(x => put(x, -1, 'a'));
      for (let y = 0; y <= 5; y++) { put(0, y, 'a'); put(17, y, 'a'); }
      for (let y = 6; y <= 9; y++) { put(-1, y, 'a'); put(0, y, 'd'); put(17, y, 'd'); put(18, y, 'a'); }
    } else if (it === 'beanie') {
      for (let x = 6; x <= 11; x++) put(x, -1, 'a');
      for (let x = 4; x <= 13; x++) put(x, 0, 'a');
      for (let x = 3; x <= 14; x++) { put(x, 1, 'a'); put(x, 2, 'a'); }
      for (let x = 2; x <= 15; x++) put(x, 3, 'd');
      put(8, -2, 'H'); put(9, -2, 'H');
    } else if (it === 'star') {
      [[13, 3], [12, 4], [13, 4], [14, 4], [13, 5]].forEach(p => put(p[0], p[1], 'y'));
    } else if (it === 'spikes') {
      for (let x = 2; x <= 15; x++) put(x, 13, 'c');
      [3, 6, 9, 12, 15].forEach(x => put(x, 13, 'm'));
      [5, 8, 11].forEach(x => put(x, 14, 'm'));
    } else if (it === 'chain') {
      for (let x = 3; x <= 14; x += 2) put(x, 13, 'y');
      put(8, 14, 'y'); put(9, 14, 'y'); put(8, 15, 'y'); put(9, 15, 'y');
    }
  }
  if (o.crown) stamp(['y.yy.y', 'yyyyyy', 'ykyyky'], 6, -5);
  return g;
}

function mpItems(st) {
  const a = MP_ITEM[st.fam || 'none'], b = st.fam2 ? MP_ITEM[st.fam2] : null;
  const out = [a];
  if (b && b !== a && MP_NECK.has(b) !== MP_NECK.has(a)) out.push(b);
  return out;
}

function mpColors(st) {
  const p = MP_PALS[st.fam] || MP_PALS.none;
  return Object.assign({ W: '#ffffff', k: '#ff7eb6', T: '#7fd4ff', M: '#5a0018', c: '#111111', m: '#d8d8e0', y: '#FFD700', w: p.d }, p);
}

// ======================== DRAWING ========================

function mpDraw() {
  const cv = document.getElementById('mp-canvas');
  if (!cv) { mpStop(); return; }
  const st = mpLoad();
  const ctx = cv.getContext('2d');
  const stage = mpStage(st), mood = mpMood(st);
  const f = MP.frame;
  const cell = cv.width / MP_W;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const scale = [1, 0.8, 0.9, 1][stage];
  const bob = stage === 0 ? 0 : (mood === 'sleepy' ? (Math.floor(f / 8) % 2) : (Math.floor(f / 4) % 2)) - (MP.bounce > 0 ? 2 : 0);
  const now = Date.now();
  if (now > MP.blinkAt) MP.blinkAt = now + 2200 + Math.random() * 2600;
  const blink = MP.blinkAt - now < 140 && mood !== 'sleepy';
  const g = mpGrid({
    stage, mood, items: mpItems(st), crown: stage === 3 && (st.streak || 0) >= 7,
    flap: (mood === 'happy' || MP.bounce > 0) && Math.floor(f / 3) % 2 === 0,
    blink, chomp: MP.chomp, wobble: stage === 0 ? [0, 1, 0, -1][Math.floor(f / 3) % 4] : 0,
  });
  const col = mpColors(st);
  const s = cell * scale;
  const offX = (cv.width - MP_W * s) / 2, offY = cv.height - MP_H * s - cell * 0.5 + bob * s;
  // shadow
  ctx.fillStyle = 'rgba(255,20,147,0.16)';
  ctx.beginPath();
  ctx.ellipse(cv.width / 2, cv.height - cell * 1.1, 8 * s, cell * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let y = 0; y < MP_H; y++) for (let x = 0; x < MP_W; x++) {
    const ch = g[y][x];
    if (ch === '.') continue;
    ctx.fillStyle = col[ch] || '#fff';
    ctx.fillRect(Math.floor(offX + x * s), Math.floor(offY + y * s), Math.ceil(s), Math.ceil(s));
  }
  // floating hearts / z's
  MP.parts = MP.parts.filter(p => p.life > 0);
  for (const p of MP.parts) {
    p.y -= p.vy; p.life--;
    ctx.globalAlpha = Math.min(1, p.life / 10);
    if (p.z) { ctx.fillStyle = col.l; ctx.font = 'bold ' + Math.round(cell * 2.2) + 'px monospace'; ctx.fillText('z', p.x, p.y); }
    else MP_HEART.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] === 'k') { ctx.fillStyle = p.c; ctx.fillRect(p.x + xx * cell * 0.7, p.y + yy * cell * 0.7, cell * 0.7, cell * 0.7); } });
    ctx.globalAlpha = 1;
  }
  if (mood === 'sleepy' && f % 14 === 0) MP.parts.push({ x: cv.width * 0.66, y: cv.height * 0.42, vy: 1.4, life: 30, z: true });
}

function mpHearts(n, color) {
  const cv = document.getElementById('mp-canvas'); if (!cv) return;
  for (let i = 0; i < n; i++) MP.parts.push({ x: cv.width * (0.25 + Math.random() * 0.5), y: cv.height * (0.35 + Math.random() * 0.2), vy: 1.5 + Math.random() * 1.5, life: 26 + Math.random() * 14, c: color || '#FF69B4' });
}

function mpStart() {
  mpStop();
  MP.timer = setInterval(() => {
    MP.frame++;
    if (MP.chomp) MP.chomp--;
    if (MP.bounce) MP.bounce--;
    mpDraw();
  }, 110);
  mpDraw();
}
function mpStop() { if (MP.timer) { clearInterval(MP.timer); MP.timer = null; } }

function mpSay(text) {
  const b = document.getElementById('mp-bubble'); if (!b) return;
  b.textContent = text;
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}

// ======================== SCREEN ========================

function mpOpen() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  mpScreen();
}

function mpFeedList() {
  if (typeof _data === 'undefined' || !_data) return [];
  const recent = (_data.recent || []).map(r => r.track).filter(Boolean);
  return qDedupe([...(_data.tracks.short_term || []), ...recent]).filter(t => !qIsAlt(t.name)).slice(0, 24);
}

function mpScreen() {
  Q.screen = 'pet';
  qStopAudio(); qClearTimers();
  const snacked = mpTickState();
  const st = mpLoad();
  const stage = mpStage(st), mood = mpMood(st);
  const feed = mpFeedList();
  MP.feed = feed;
  const stat = (l, v) => '<div class="x-stat"><div class="l">' + l + '</div><div class="v">' + v + '</div></div>';
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🦇 ' + (st.name ? esc(st.name) : 'music pet'), '') +
    '<div class="mp-stage">' +
      '<div class="mp-bubble" id="mp-bubble"></div>' +
      '<canvas id="mp-canvas" class="mp-canvas" width="336" height="324" onclick="mpPoke()"></canvas>' +
    '</div>' +
    '<div class="mp-full"><span>full</span><div class="mp-bar"><i style="width:' + Math.round(st.full) + '%"></i></div><span>' + Math.round(st.full) + '%</span></div>' +
    '<div class="x-stats mp-stats">' +
      stat('stage', MP_STAGE_NAME[stage]) +
      stat('mood', mood === 'egg' ? '...' : mood) +
      stat('streak', (st.streak || 0) + ' day' + (st.streak === 1 ? '' : 's')) +
      stat('songs eaten', st.eaten || 0) +
      stat('snacks', st.snacks || 0) +
      stat('favorite', MP_FAM_LABEL[st.fam || 'none']) +
    '</div>' +
    '<div class="mp-name"><input id="mp-name" maxlength="20" placeholder="name" value="' + esc(st.name || '') + '"><button class="q-btn ghost" onclick="mpRename()">save name</button></div>' +
    (feed.length
      ? '<div class="g-hub-label">' + (stage === 0 ? 'feed it a song to hatch it' : 'feed it') + '</div><div class="mp-feed">' +
          feed.map((t, i) => '<button class="mp-food" onclick="mpFeed(' + i + ')">' + (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '<span class="nocover">♪</span>') +
            '<span class="nm">' + esc(qStrip(t.name)) + '</span></button>').join('') +
        '</div>'
      : '') +
    (st.fed && st.fed.length
      ? '<div class="g-hub-label">last meals</div><div class="mp-meals">' + st.fed.slice(0, 8).map(m => '<div class="mp-meal"><span class="nm">' + esc(m.name) + '</span><span class="ar">' + esc(m.artist) + '</span></div>').join('') + '</div>'
      : '')
  );
  mpStart();
  if (snacked && st.hatched) { mpSay('snacked on ' + snacked + ' song' + (snacked === 1 ? '' : 's') + ' you played'); mpHearts(3); }
  else if (stage > 0 && mood === 'hungry') mpSay('hungry...');
}

function mpRename() {
  const el = document.getElementById('mp-name'); if (!el) return;
  mpLoad().name = el.value.trim().slice(0, 20);
  mpSave();
  const h = document.querySelector('.q-head h1'); if (h) h.textContent = '🦇 ' + (MP.st.name || 'music pet');
  mpSay(MP.st.name ? 'i\'m ' + MP.st.name + '!' : '...');
  MP.bounce = 6; mpHearts(4);
}

function mpPoke() {
  const st = mpLoad();
  if (!st.hatched) { MP.bounce = 3; mpSay('...'); return; }
  MP.bounce = 6;
  mpHearts(3);
  if (mpMood(st) === 'sleepy') mpSay('zzz');
  else if (mpMood(st) === 'hungry') mpSay('feed me');
  else mpSay(['hi', '♡', 'hehe', ':3', 'again'][Math.floor(Math.random() * 5)]);
}

// pure: what one song does to the pet
function mpEat(st, track, fam, now) {
  const name = qStrip(track.name), artist = qArtistNames(track);
  if (st.hatched && st.full >= 100) return { ok: false, say: 'too full' };
  const last = st.fed && st.fed[0];
  let gain = 15, say = 'yum', hearts = 3;
  if (last && last.name === name && last.artist === artist) { gain = 5; say = 'again??'; hearts = 1; }
  else if (fam && fam === st.fam) { gain = 25; say = 'my favorite!!'; hearts = 7; }
  const hatching = !st.hatched;
  if (hatching) { st.hatched = true; st.full = 60; say = 'hi!!'; hearts = 8; }
  st.full = Math.min(100, st.full + gain);
  st.eaten = (st.eaten || 0) + 1;
  st.fed = [{ name, artist, t: now || Date.now() }].concat(st.fed || []).slice(0, 30);
  return { ok: true, say, hearts, hatching };
}

function mpFeed(i) {
  const t = MP.feed && MP.feed[i]; if (!t) return;
  const st = mpLoad();
  mpTickState();
  const before = mpStage(st);
  const r = mpEat(st, t, mpArtistFamily(t));
  mpSave();
  if (!r.ok) { mpSay(r.say); MP.bounce = 2; return; }
  if (r.hatching || mpStage(st) !== before) { mpScreen(); mpSay(r.hatching ? r.say : 'i grew!!'); mpHearts(10); return; }
  MP.chomp = 8; MP.bounce = 4;
  mpSay(r.say);
  mpHearts(r.hearts, r.say === 'my favorite!!' ? '#FFD700' : '#FF69B4');
  const bar = document.querySelector('.mp-bar i'); if (bar) bar.style.width = Math.round(st.full) + '%';
  const pct = document.querySelector('.mp-full span:last-child'); if (pct) pct.textContent = Math.round(st.full) + '%';
  const stats = document.querySelectorAll('.mp-stats .x-stat .v');
  if (stats[1]) stats[1].textContent = mpMood(st);
  if (stats[3]) stats[3].textContent = st.eaten;
}

// ======================== LISTENING CALENDAR ========================

const LC_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const LC = { view: 'month', y: 0, m: 0, sel: null, tot: null, max: 0, src: null };

function lcData() {
  const d = typeof hLoad === 'function' ? hLoad() : null;
  if (!d) return null;
  if (LC.src !== d) {
    // per-day totals across every artist
    const tot = {};
    let max = 0;
    for (const a of Object.values(d.artists || {})) for (const [day, ms] of Object.entries(a.d || {})) tot[day] = (tot[day] || 0) + ms;
    for (const v of Object.values(tot)) if (v > max) max = v;
    LC.tot = tot; LC.max = max; LC.src = d;
    const last = new Date(d.to || Date.now());
    LC.y = last.getUTCFullYear(); LC.m = last.getUTCMonth(); LC.sel = null;
  }
  return d;
}
function lcDay(y, m, dd) { return Math.floor(Date.UTC(y, m, dd) / H_DAY); }
function lcLevel(ms) {
  if (!ms || !LC.max) return 0;
  return Math.max(1, Math.min(5, Math.ceil(5 * Math.sqrt(ms / LC.max))));
}
function lcMin(ms) { return typeof hFmt === 'function' ? hFmt(ms) : Math.round(ms / 60000) + ' min'; }

function lcOpen() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  lcScreen();
}

function lcScreen() {
  Q.screen = 'calendar';
  qStopAudio(); qClearTimers();
  const d = lcData();
  if (!d) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('📅 listening calendar', '') +
      '<div class="q-actions"><button class="q-btn" onclick="hScreen()">load your spotify data</button></div>');
    return;
  }
  const tabs = '<div class="tabs">' + [['month', 'month'], ['year', 'year']].map(([k, l]) => '<button class="' + (LC.view === k ? 'active' : '') + '" onclick="lcView(\'' + k + '\')">' + l + '</button>').join('') + '</div>';
  qSet(qTopBar('&larr; back', xBack()) + qHeader('📅 listening calendar', '') + tabs + '<div id="lc-body"></div>');
  lcRender();
}
function lcView(v) { LC.view = v; LC.sel = null; lcScreen(); }

function lcBounds() {
  const d = LC.src, a = new Date(d.from || d.to), b = new Date(d.to);
  return { y0: a.getUTCFullYear(), m0: a.getUTCMonth(), y1: b.getUTCFullYear(), m1: b.getUTCMonth() };
}
function lcCanGo(y, m) {
  const b = lcBounds();
  const k = y * 12 + m;
  return k >= b.y0 * 12 + b.m0 && k <= b.y1 * 12 + b.m1;
}
function lcMove(step) {
  if (LC.view === 'year') {
    const b = lcBounds(), y = LC.y + step;
    if (y < b.y0 || y > b.y1) return;
    LC.y = y;
  } else {
    let y = LC.y, m = LC.m + step;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    if (!lcCanGo(y, m)) return;
    LC.y = y; LC.m = m;
  }
  LC.sel = null;
  lcRender();
}
function lcPickMonth(m) { LC.view = 'month'; LC.m = m; LC.sel = null; lcScreen(); }

function lcRender() {
  const box = document.getElementById('lc-body'); if (!box) return;
  const b = lcBounds();
  if (LC.view === 'year') {
    let html = '<div class="lc-nav"><button class="q-btn ghost" onclick="lcMove(-1)"' + (LC.y <= b.y0 ? ' disabled' : '') + '>‹</button><span class="lc-title">' + LC.y + '</span>' +
      '<button class="q-btn ghost" onclick="lcMove(1)"' + (LC.y >= b.y1 ? ' disabled' : '') + '>›</button></div>';
    let yearMs = 0, days = 0;
    html += '<div class="lc-year">';
    for (let m = 0; m < 12; m++) {
      const n = new Date(Date.UTC(LC.y, m + 1, 0)).getUTCDate();
      const first = new Date(Date.UTC(LC.y, m, 1)).getUTCDay();
      let cells = '', mMs = 0;
      for (let i = 0; i < first; i++) cells += '<i class="lc-mini"></i>';
      for (let dd = 1; dd <= n; dd++) {
        const ms = LC.tot[lcDay(LC.y, m, dd)] || 0;
        mMs += ms; if (ms) days++;
        cells += '<i class="lc-mini lc-l' + lcLevel(ms) + '"></i>';
      }
      yearMs += mMs;
      html += '<button class="lc-mon" onclick="lcPickMonth(' + m + ')"' + (lcCanGo(LC.y, m) ? '' : ' disabled') + '><span class="nm">' + LC_MONTHS[m].slice(0, 3) + '</span><span class="lc-minigrid">' + cells + '</span><span class="ms">' + (mMs ? lcMin(mMs) : '') + '</span></button>';
    }
    html += '</div>';
    box.innerHTML = '<div class="x-stats">' +
      '<div class="x-stat"><div class="l">listened in ' + LC.y + '</div><div class="v">' + lcMin(yearMs) + '</div></div>' +
      '<div class="x-stat"><div class="l">days with music</div><div class="v">' + days + '</div></div></div>' + html + lcLegend();
    return;
  }
  const y = LC.y, m = LC.m;
  const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const first = new Date(Date.UTC(y, m, 1)).getUTCDay();
  let cells = '', monthMs = 0, days = 0, big = null;
  for (let i = 0; i < first; i++) cells += '<span class="lc-cell empty"></span>';
  for (let dd = 1; dd <= n; dd++) {
    const day = lcDay(y, m, dd), ms = LC.tot[day] || 0;
    monthMs += ms; if (ms) days++;
    if (ms && (!big || ms > big.ms)) big = { dd, ms };
    cells += '<button class="lc-cell lc-l' + lcLevel(ms) + (LC.sel === day ? ' sel' : '') + '" onclick="lcPick(' + day + ')"><span>' + dd + '</span></button>';
  }
  // top artist of the month
  const start = lcDay(y, m, 1), end = lcDay(y, m, n);
  let topA = null;
  for (const [name, a] of Object.entries(LC.src.artists || {})) {
    let s = 0;
    for (const [day, ms] of Object.entries(a.d || {})) if (day >= start && day <= end) s += ms;
    if (s && (!topA || s > topA.ms)) topA = { name, ms: s };
  }
  box.innerHTML =
    '<div class="lc-nav"><button class="q-btn ghost" onclick="lcMove(-1)"' + (lcCanGo(m ? y : y - 1, m ? m - 1 : 11) ? '' : ' disabled') + '>‹</button>' +
      '<span class="lc-title">' + LC_MONTHS[m] + ' ' + y + '</span>' +
      '<button class="q-btn ghost" onclick="lcMove(1)"' + (lcCanGo(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1) ? '' : ' disabled') + '>›</button></div>' +
    '<div class="x-stats">' +
      '<div class="x-stat"><div class="l">this month</div><div class="v">' + lcMin(monthMs) + '</div></div>' +
      '<div class="x-stat"><div class="l">days with music</div><div class="v">' + days + ' / ' + n + '</div></div>' +
      '<div class="x-stat"><div class="l">biggest day</div><div class="v">' + (big ? LC_MONTHS[m].slice(0, 3) + ' ' + big.dd : '-') + '</div>' + (big ? '<div class="s">' + lcMin(big.ms) + '</div>' : '') + '</div>' +
      '<div class="x-stat"><div class="l">top artist</div><div class="v">' + (topA ? esc(topA.name) : '-') + '</div></div>' +
    '</div>' +
    '<div class="lc-week">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => '<span>' + w + '</span>').join('') + '</div>' +
    '<div class="lc-grid">' + cells + '</div>' + lcLegend() +
    '<div id="lc-day"></div>';
  if (LC.sel != null) lcShowDay(LC.sel);
}
function lcLegend() {
  return '<div class="lc-legend"><span>less</span>' + [0, 1, 2, 3, 4, 5].map(l => '<i class="lc-mini lc-l' + l + '"></i>').join('') + '<span>more</span></div>';
}

function lcPick(day) {
  LC.sel = LC.sel === day ? null : day;
  document.querySelectorAll('.lc-cell.sel').forEach(c => c.classList.remove('sel'));
  if (LC.sel != null) { const btn = document.querySelector('.lc-cell[onclick="lcPick(' + day + ')"]'); if (btn) btn.classList.add('sel'); }
  lcShowDay(LC.sel);
}

// pure: top artists + songs on one day
function lcDayTop(d, day, n) {
  const rows = (map) => Object.entries(map || {}).map(([k, e]) => ({ name: k, ms: (e.d && e.d[day]) || 0 })).filter(r => r.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, n || 8);
  return { artists: rows(d.artists), tracks: rows(d.tracks) };
}

function lcShowDay(day) {
  const box = document.getElementById('lc-day'); if (!box) return;
  if (day == null) { box.innerHTML = ''; return; }
  const total = LC.tot[day] || 0;
  const date = new Date(day * H_DAY).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  if (!total) { box.innerHTML = '<div class="lc-daybox"><div class="lc-daytitle">' + date.toLowerCase() + '</div><div class="lc-daymin">0 min</div></div>'; return; }
  const top = lcDayTop(LC.src, day, 8);
  const max = top.artists.length ? top.artists[0].ms : 1;
  const row = (r, mx, sub) => '<div class="h-row"><div class="info"><div class="nm">' + esc(r.name.split('|')[0]) + '</div>' + (sub ? '<div class="ar">' + esc(r.name.split('|')[1] || '') + '</div>' : '') +
    '<div class="h-bar"><i style="width:' + Math.max(2, r.ms / mx * 100) + '%;"></i></div></div><span class="sc">' + lcMin(r.ms) + '</span></div>';
  box.innerHTML = '<div class="lc-daybox"><div class="lc-daytitle">' + date.toLowerCase() + '</div><div class="lc-daymin">' + lcMin(total) + '</div>' +
    '<div class="g-hub-label">artists</div>' + top.artists.map(r => row(r, max)).join('') +
    (top.tracks.length ? '<div class="g-hub-label">songs</div>' + top.tracks.slice(0, 6).map(r => row(r, top.tracks[0].ms, true)).join('') : '') +
  '</div>';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ======================== SAVE TO SPOTIFY ========================

const SV = { src: 'short', pub: false, busy: false, game: null, gameName: '', done: null, err: '' };
const SV_SCOPES = ['playlist-modify-private', 'playlist-modify-public'];
const SV_SRC = {
  short:  { label: '4 weeks', name: 'top songs · 4 weeks' },
  medium: { label: '6 months', name: 'top songs · 6 months' },
  long:   { label: 'all time', name: 'top songs · all time' },
  recent: { label: 'recently played', name: 'recently played' },
  game:   { label: 'last game', name: '' },
};

function svScope() {
  try { const t = JSON.parse(localStorage.getItem('sp_tokens') || '{}'); return typeof t.scope === 'string' && SV_SCOPES.some(s => t.scope.includes(s)); } catch { return false; }
}
function svLoggedIn() { return typeof _data !== 'undefined' && !!_data; }

function svTracks(src) {
  if (src === 'game') return SV.game || [];
  if (!svLoggedIn()) return [];
  let list = [];
  if (src === 'recent') list = (_data.recent || []).map(r => r.track);
  else list = _data.tracks[src + '_term'] || [];
  return qDedupe(list.filter(t => t && t.uri));
}
function svDefaultName(src) {
  return src === 'game' ? (SV.gameName || 'from the arcade') : SV_SRC[src].name;
}

async function svApi(method, path, body) {
  const token = await getToken();
  if (!token) return { ok: false, status: 401, json: null };
  const res = await fetch(API + path, {
    method,
    headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '1');
    await new Promise(r => setTimeout(r, retry * 1000));
    return svApi(method, path, body);
  }
  let json = null;
  try { json = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, json };
}

// new playlist: /me/playlists first, the older /users/{id}/playlists if that's refused
async function svCreate(name, desc, isPublic) {
  const body = { name, description: desc, public: !!isPublic };
  let r = await svApi('POST', '/me/playlists', body);
  if (!r.ok && r.status !== 401) {
    let id = svLoggedIn() && _data.user ? _data.user.id : null;
    if (!id) { const me = await svApi('GET', '/me'); id = me.json && me.json.id; }
    if (id) r = await svApi('POST', '/users/' + encodeURIComponent(id) + '/playlists', body);
  }
  if (!r.ok || !r.json || !r.json.id) { const e = new Error('create ' + r.status); e.status = r.status; throw e; }
  return r.json;
}

// songs in, 100 at a time: /items first, /tracks if spotify says no
async function svAdd(pid, uris) {
  let path = 'items';
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    let r = await svApi('POST', '/playlists/' + pid + '/' + path, { uris: batch });
    if (!r.ok && path === 'items') { path = 'tracks'; r = await svApi('POST', '/playlists/' + pid + '/' + path, { uris: batch }); }
    if (!r.ok) { const e = new Error('add ' + r.status); e.status = r.status; throw e; }
  }
  return path;
}

function svOpen(src) {
  if (src) SV.src = src;
  SV.done = null; SV.err = '';
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  svScreen();
}

function svScreen() {
  Q.screen = 'save';
  qStopAudio(); qClearTimers();
  const head = qTopBar('&larr; back', xBack()) + qHeader('💾 save to spotify', '');
  if (!svLoggedIn() && !SV.game) {
    qSet(head + '<div class="q-actions"><button class="q-btn" onclick="login()">connect spotify</button></div>');
    return;
  }
  if (!svScope()) {
    qSet(head + '<div class="sv-box"><p class="q-note">saving playlists needs one more spotify permission. connect again once.</p>' +
      '<div class="q-actions"><button class="q-btn" onclick="login()">reconnect spotify</button></div></div>');
    return;
  }
  if (SV.src === 'game' && !SV.game) SV.src = 'short';
  if (SV.src !== 'game' && !svLoggedIn()) SV.src = 'game';
  const srcs = Object.keys(SV_SRC).filter(k => k === 'game' ? !!SV.game : svLoggedIn());
  const list = svTracks(SV.src);
  if (SV.done) {
    const url = SV.done.external_urls && SV.done.external_urls.spotify;
    qSet(head + '<div class="sv-box sv-done"><div class="big">saved 🩷</div><div class="nm">' + esc(SV.done.name) + '</div><div class="q-note">' + SV.done.count + ' songs</div>' +
      '<div class="q-actions">' + (url ? '<a class="q-btn" href="' + esc(url) + '" target="_blank" rel="noopener">open in spotify</a>' : '') +
      '<button class="q-btn ghost" onclick="svAgain()">save another</button></div></div>');
    return;
  }
  qSet(head +
    '<div class="tabs sv-tabs">' + srcs.map(k => '<button class="' + (SV.src === k ? 'active' : '') + '" onclick="svPick(\'' + k + '\')">' + SV_SRC[k].label + '</button>').join('') + '</div>' +
    '<div class="sv-box">' +
      '<input id="sv-name" class="sv-name" maxlength="100" value="' + esc(svDefaultName(SV.src)) + '">' +
      '<div class="tabs sv-vis"><button class="' + (SV.pub ? '' : 'active') + '" onclick="svVis(false)">private</button><button class="' + (SV.pub ? 'active' : '') + '" onclick="svVis(true)">public</button></div>' +
      '<div class="q-actions"><button class="q-btn" id="sv-go" onclick="svSave()"' + (list.length ? '' : ' disabled') + '>save ' + list.length + ' songs</button></div>' +
      (SV.err ? '<div class="q-err">' + SV.err + '</div>' : '') +
    '</div>' +
    '<div class="sv-list">' + list.map((t, i) =>
      '<div class="q-recap-row"><span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' + (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '') +
      '<div class="info"><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(qArtistNames(t)) + '</div></div></div>').join('') +
    '</div>'
  );
}
function svPick(k) { SV.src = k; SV.err = ''; svScreen(); }
function svVis(p) { const el = document.getElementById('sv-name'); const name = el ? el.value : null; SV.pub = p; svScreen(); const el2 = document.getElementById('sv-name'); if (el2 && name != null) el2.value = name; }
function svAgain() { SV.done = null; svScreen(); }

async function svSave() {
  if (SV.busy) return;
  const list = svTracks(SV.src);
  if (!list.length) return;
  const el = document.getElementById('sv-name');
  const name = ((el && el.value) || svDefaultName(SV.src)).trim().slice(0, 100) || 'sparklestats';
  const btn = document.getElementById('sv-go');
  SV.busy = true; SV.err = '';
  if (btn) { btn.disabled = true; btn.textContent = 'saving...'; }
  try {
    const pl = await svCreate(name, 'made with sparklestats xo', SV.pub);
    await svAdd(pl.id, list.map(t => t.uri));
    SV.done = { name: pl.name || name, external_urls: pl.external_urls, count: list.length };
  } catch (e) {
    SV.err = e.status === 403 ? 'spotify said no (403). try reconnecting spotify.' : e.status === 401 ? 'spotify logged you out. refresh the page.' : 'couldn\'t save (' + (e.status || e.message) + ')';
  }
  SV.busy = false;
  if (Q.screen === 'save') svScreen();
}

// results screen: the songs from that game -> a playlist
function svFromResults() {
  SV.game = (Q.results || []).map(r => r.track).filter(t => t && t.uri);
  SV.gameName = ((typeof GAMES !== 'undefined' && GAMES[Q.game] ? GAMES[Q.game].name : 'arcade') + (Q.source && Q.source.name ? ' · ' + Q.source.name : '')).slice(0, 100);
  svOpen('game');
}

(function svInstallHooks() {
  if (typeof mOnResults !== 'function') return;
  const prev = { mOnResults };
  mOnResults = function () {
    const r = prev.mOnResults.apply(this, arguments);
    try {
      const box = document.getElementById('g-results-extra');
      const ok = svLoggedIn() && (Q.results || []).some(x => x.track && x.track.uri);
      if (box && ok && !document.getElementById('sv-results-btn')) {
        box.insertAdjacentHTML('beforeend', '<div class="q-actions"><button class="q-btn ghost" id="sv-results-btn" onclick="svFromResults()">save these to spotify 💾</button></div>');
      }
    } catch {}
    return r;
  };
  window.mOnResults = mOnResults;
})();

// ======================== HUB ========================

X_HUB.you.push(
  () => { const st = mpLoad(); return xCard('🦇', st.name ? esc(st.name) : 'music pet', 'a little pixel creature that eats your songs', 'mpOpen()', st.hatched ? MP_STAGE_NAME[mpStage(st)] : 'egg'); },
  () => xCard('📅', 'listening calendar', 'every day you listened, as a heatmap', 'lcOpen()', (typeof hLoad === 'function' && hLoad()) ? '' : 'needs data'),
);
X_HUB.labs.push(() => xCard('💾', 'save to spotify', 'your top songs or a game\'s songs as a real playlist', 'svOpen()'));

Object.assign(window, {
  mpOpen, mpScreen, mpFeed, mpPoke, mpRename,
  lcOpen, lcScreen, lcView, lcMove, lcPick, lcPickMonth,
  svOpen, svPick, svVis, svSave, svAgain, svFromResults,
});
