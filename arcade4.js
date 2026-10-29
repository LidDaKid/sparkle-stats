// ============================================================
//  xXx SparkleStats xXx  -  arcade4.js
//  connections (4 groups of 4), pixel reveal (a blocky cover
//  sharpens up, name the album), memory match (covers, or
//  cover <-> clip on hard), timeline (put songs in release order).
//  all four use the normal source picker. loads after pitch.js.
// ============================================================

GAMES.connections = { emoji: '🧩', name: 'connections', sub: '16 songs, 4 secret groups. find them. 4 mistakes' };
GAMES.pixel       = { emoji: '👾', name: 'pixel reveal', sub: 'a blocky cover gets sharper. name the album' };
GAMES.memory      = { emoji: '🃏', name: 'memory match', sub: 'flip cards, match the covers. hard mode: match the sound' };
GAMES.timeline    = { emoji: '📏', name: 'timeline', sub: 'put the songs in the order they came out. 3 lives' };

const A4_WHOLE = new Set(['connections', 'memory', 'timeline']);   // these run as one board, not song by song
const A4_GAMES = new Set(['connections', 'pixel', 'memory', 'timeline']);
const A4 = { cn: null, mm: null, tl: null };

// ======================== SHARED ========================

function a4Key(t) { return qNorm(qStrip(t.name)); }

// one track per title, no live cuts / demos
function a4Clean(pool) {
  const seen = new Set(), out = [];
  for (const t of qShuffle(pool)) {
    if (qIsAlt(t.name)) continue;
    const k = a4Key(t);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}

// the shared results screen for the one-board games
function a4Results(title, score, line, rank, rows) {
  Q.screen = 'results';
  qStopAudio(); qClearTimers();
  Q.score = Math.round(score);
  if (typeof gSaveScore === 'function' && Q.results.length) gSaveScore(Q.score);
  if (typeof mAward === 'function' && Q.results.length) mAward('first_game');
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader(title, esc((Q.source || {}).name || '')) +
    '<div class="q-final fade-up">' +
      '<div class="num">' + Q.score + '</div>' +
      '<div class="outof">out of ' + QUIZ_MAX + ' &middot; ' + line + '</div>' +
      '<div class="rank">' + rank + '</div>' +
    '</div>' +
    (rows || '') +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="qStart(\'' + Q.mode + '\')">again</button>' +
      '<button class="q-btn ghost" onclick="gScreenLeaderboard()">leaderboard</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (Q.score >= 700 && window.confetti) confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
}

function a4Recap(tracks, mark) {
  return '<div class="q-recap">' + tracks.map((t, i) =>
    '<div class="q-recap-row">' + (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '') +
      '<div class="info"><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(qArtistNames(t)) + '</div></div>' +
      (mark ? '<span class="p ' + (mark(t, i) ? 'good' : 'bad') + '">' + (mark(t, i) ? '✓' : '✗') + '</span>' : '') +
    '</div>').join('') + '</div>';
}

function a4Clock(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ======================== CONNECTIONS ========================
// groups come from the real data: same artist, same album, same year,
// and title words (colors, numbers, the night sky...). a board only
// counts if each group's rule fits exactly its own 4 tiles, so there is
// always one answer.

const CN_WORDS = [
  ['a color in the title', ['red', 'blue', 'black', 'white', 'pink', 'green', 'gold', 'golden', 'gray', 'grey', 'purple', 'yellow', 'silver', 'violet', 'scarlet', 'crimson', 'orange']],
  ['a number in the title', ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'first', 'second', 'third', 'last', 'zero', 'twice', 'double', '1', '2', '3', '4', '5', '7', '22', '99', '100']],
  ['the night sky', ['night', 'nights', 'midnight', 'moon', 'moonlight', 'star', 'stars', 'dark', 'darkness', 'sky', 'tonight', 'sunset', 'twilight']],
  ['body parts', ['heart', 'hearts', 'eyes', 'eye', 'hands', 'hand', 'lips', 'bones', 'blood', 'skin', 'head', 'face', 'teeth', 'body', 'mouth', 'arms', 'veins', 'tongue', 'feet', 'hair']],
  ['the weather', ['rain', 'snow', 'storm', 'sun', 'sunshine', 'thunder', 'lightning', 'cloud', 'clouds', 'wind', 'hurricane', 'cold', 'fire', 'ice', 'frozen', 'winter', 'summer']],
  ['"love" in the title', ['love', 'lover', 'loved', 'lovesick', 'loving']],
  ['"you" in the title', ['you', "you're", 'your', 'yours', 'u']],
  ['"me" or "my"', ['me', 'my', 'mine', 'myself']],
  ['"girl" or "boy"', ['girl', 'girls', 'boy', 'boys', 'baby', 'babe']],
  ['death and ghosts', ['dead', 'die', 'dying', 'death', 'ghost', 'ghosts', 'grave', 'kill', 'killer', 'haunted', 'bury', 'funeral', 'cemetery', 'vampire']],
  ['time words', ['time', 'forever', 'never', 'always', 'tomorrow', 'yesterday', 'today', 'now', 'again', 'minute', 'hour', 'years', 'days', 'day']],
  ['places', ['home', 'city', 'town', 'street', 'road', 'paradise', 'heaven', 'hell', 'world', 'room', 'house', 'hollywood', 'california', 'london', 'paris', 'america', 'ocean', 'sea']],
];

function cnWords(t) {
  return qStrip(t.name).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
}

function cnCategories(tracks) {
  const cats = [];
  const bucket = (kind, keyFn, labelFn) => {
    const m = new Map();
    for (const t of tracks) { const k = keyFn(t); if (!k) continue; (m.get(k) || m.set(k, []).get(k)).push(t); }
    for (const [k, list] of m) if (list.length >= 4) cats.push({ kind, label: labelFn(k, list), test: t => keyFn(t) === k, members: list });
  };
  bucket('artist', t => qNorm(gPrimary(t)), (k, l) => 'by ' + gPrimary(l[0]));
  bucket('album', t => {
    const a = t.album || {};
    if (!a.name || a.album_type === 'single' || qNorm(a.name) === a4Key(t)) return '';
    return qNorm(a.name);
  }, (k, l) => 'on ' + qStrip(l[0].album.name));
  bucket('year', t => String(gYear(t) || ''), k => 'came out in ' + k);
  for (const [label, words] of CN_WORDS) {
    const set = new Set(words);
    const test = t => cnWords(t).some(w => set.has(w));
    const members = tracks.filter(test);
    if (members.length >= 4) cats.push({ kind: 'word', label, test, members });
  }
  const one = t => cnWords(t).length === 1;
  const ones = tracks.filter(one);
  if (ones.length >= 4) cats.push({ kind: 'shape', label: 'one-word titles', test: one, members: ones });
  const long = t => cnWords(t).length >= 5;
  const longs = tracks.filter(long);
  if (longs.length >= 4) cats.push({ kind: 'shape', label: 'five words or more', test: long, members: longs });
  return cats;
}

// pure: tries random boards until every group's rule matches exactly its own 4 tiles
function cnMakeBoard(tracks, tries) {
  const cats = cnCategories(tracks);
  if (cats.length < 4) return null;
  for (let n = 0; n < (tries || 400); n++) {
    const pick = qShuffle(cats).slice(0, 4);
    // no more than 2 of the same kind (4 "by artist" groups is boring)
    const kinds = {};
    if (pick.some(c => (kinds[c.kind] = (kinds[c.kind] || 0) + 1) > 2)) continue;
    // the first tries insist on a title-word group when there is one - those are the fun ones
    if (n < (tries || 400) / 2 && cats.some(c => c.kind === 'word') && !pick.some(c => c.kind === 'word')) continue;
    const used = new Set(), groups = [];
    let ok = true;
    for (const c of pick) {
      const free = qShuffle(c.members.filter(t => !used.has(a4Key(t))));
      if (free.length < 4) { ok = false; break; }
      const four = free.slice(0, 4);
      four.forEach(t => used.add(a4Key(t)));
      groups.push({ label: c.label, test: c.test, tracks: four });
    }
    if (!ok) continue;
    const all = groups.flatMap(g => g.tracks);
    const texts = new Set(all.map(t => qStrip(t.name).toLowerCase()));
    if (texts.size !== 16) continue;
    if (groups.every(g => all.filter(g.test).length === 4)) return groups;
  }
  return null;
}

function cnStart() {
  const groups = A4.cnGroups;
  A4.cn = {
    groups, solved: [], mistakes: 0, sel: [], done: false, guesses: new Set(), msg: '',
    tiles: qShuffle(groups.flatMap((g, gi) => g.tracks.map(t => ({ t, gi })))),
  };
  cnRender();
}

function cnRender() {
  const C = A4.cn; if (!C) return;
  Q.screen = 'cn';
  const left = C.tiles.filter(x => !C.solved.includes(x.gi));
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    '<div class="q-hud"><span class="qn">🧩 connections</span><span class="sc">mistakes ' +
      '<b class="cn-dots">' + '🖤'.repeat(4 - C.mistakes) + '<span>' + '·'.repeat(C.mistakes) + '</span></b></span></div>' +
    '<div class="cn-board">' +
      C.solved.map(gi => {
        const g = C.groups[gi];
        return '<div class="cn-group cn-c' + C.solved.indexOf(gi) + '"><div class="lb">' + esc(g.label) + '</div>' +
          '<div class="it">' + g.tracks.map(t => esc(qStrip(t.name))).join(' &middot; ') + '</div></div>';
      }).join('') +
      '<div class="cn-grid">' + left.map(x => {
        const i = C.tiles.indexOf(x);
        return '<button class="cn-tile' + (C.sel.includes(i) ? ' on' : '') + '" onclick="cnTap(' + i + ')">' + esc(qStrip(x.t.name)) + '</button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="cn-msg" id="cn-msg">' + (C.msg || '') + '</div>' +
    (C.done
      ? '<div class="q-actions"><button class="q-btn" onclick="cnFinish()">see my score →</button></div>'
      : '<div class="q-actions">' +
          '<button class="q-btn ghost" onclick="cnShuffle()">shuffle</button>' +
          '<button class="q-btn ghost" onclick="cnClear()"' + (C.sel.length ? '' : ' disabled') + '>deselect</button>' +
          '<button class="q-btn" onclick="cnSubmit()"' + (C.sel.length === 4 ? '' : ' disabled') + '>submit</button>' +
        '</div>')
  );
}

function cnTap(i) {
  const C = A4.cn; if (!C || C.done) return;
  const at = C.sel.indexOf(i);
  if (at >= 0) C.sel.splice(at, 1);
  else if (C.sel.length < 4) C.sel.push(i);
  C.msg = '';
  cnRender();
}
function cnClear() { const C = A4.cn; if (!C) return; C.sel = []; C.msg = ''; cnRender(); }
function cnShuffle() {
  const C = A4.cn; if (!C) return;
  const picked = C.sel.map(i => C.tiles[i]);
  C.tiles = qShuffle(C.tiles);
  C.sel = picked.map(x => C.tiles.indexOf(x));
  cnRender();
}

function cnSubmit() {
  const C = A4.cn; if (!C || C.done || C.sel.length !== 4) return;
  const key = C.sel.map(i => a4Key(C.tiles[i].t)).sort().join('|');
  if (C.guesses.has(key)) { C.msg = 'already tried that one'; cnRender(); return; }
  C.guesses.add(key);
  const counts = {};
  for (const i of C.sel) counts[C.tiles[i].gi] = (counts[C.tiles[i].gi] || 0) + 1;
  const top = Math.max(...Object.values(counts));
  if (top === 4) {
    C.solved.push(C.tiles[C.sel[0]].gi);
    C.sel = []; C.msg = '';
    if (C.solved.length === 4) C.done = true;
  } else {
    C.mistakes++;
    C.msg = top === 3 ? 'one away...' : 'nope';
    if (C.mistakes >= 4) {
      C.done = true; C.sel = [];
      C.lost = C.groups.map((g, gi) => gi).filter(gi => !C.solved.includes(gi));
      C.solved = C.solved.concat(C.lost);
      C.msg = 'out of mistakes 💔';
    }
  }
  cnRender();
}

function cnFinish() {
  const C = A4.cn; if (!C) return;
  const lost = new Set(C.lost || []);
  const found = C.groups.length - lost.size;
  const score = found * 200 + (found === 4 ? (4 - C.mistakes) * 50 : 0);
  Q.results = C.groups.flatMap((g, gi) => g.tracks.map(t => ({ track: t, points: lost.has(gi) ? 0 : 1, correct: !lost.has(gi), guess: null })));
  a4Results('🧩 connections', score, found + '/4 groups &middot; ' + C.mistakes + ' mistake' + (C.mistakes === 1 ? '' : 's'),
    found === 4 && !C.mistakes ? 'flawless' : found === 4 ? 'got them all' : found >= 2 ? 'halfway there' : 'tricky one',
    '<div class="cn-board" style="margin-bottom:14px;">' + C.groups.map((g, gi) =>
      '<div class="cn-group cn-c' + gi + (lost.has(gi) ? ' lost' : '') + '"><div class="lb">' + esc(g.label) + '</div>' +
      '<div class="it">' + g.tracks.map(t => esc(qStrip(t.name))).join(' &middot; ') + '</div></div>').join('') + '</div>');
}

// ======================== PIXEL REVEAL ========================

const PX_STEPS = [4, 6, 8, 11, 15, 20, 28, 40, 56, 80];   // blocks across, over the timer
const PX_TIME = 24;

function pxBuild(pool) {
  const byAlbum = new Map();
  for (const t of qShuffle(pool.filter(t => !qIsAlt(t.name)))) {
    const a = t.album || {};
    if (!a.name || !qArt(t) || qIsAlt(a.name)) continue;
    const k = qNorm(qStrip(a.name));
    if (k && !byAlbum.has(k)) byAlbum.set(k, t);
  }
  const picks = [...byAlbum.values()];
  if (picks.length < 4) return [];
  const names = picks.map(t => qStrip(t.album.name));
  return picks.slice(0, Q.len).map(t => {
    const answer = qStrip(t.album.name);
    const decoys = qShuffle(names.filter(n => n !== answer)).slice(0, 3);
    return { track: t, answer, choices: Q.mode === 'mc' ? qShuffle([answer, ...decoys]) : null, detail: 'from ' + answer };
  });
}

function pxRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers();
  const q = Q.questions[Q.index];
  Q.duration = PX_TIME; Q.deadline = Date.now() + PX_TIME * 1000;
  q.px = 0;
  qSet(
    mHud('cover ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="px-wrap"><canvas id="px-can" class="px-can" width="320" height="320"></canvas>' +
      '<div class="q-note" id="px-worth"></div></div>' +
    (Q.mode === 'mc'
      ? '<div class="q-choices">' + q.choices.map((c, i) =>
          '<button class="q-choice" id="q-c' + i + '" onclick="pxChoice(' + i + ')">' + esc(c) + '</button>').join('') + '</div>'
      : '<div class="q-typewrap"><div class="q-typerow">' +
          '<input id="q-type-input" class="q-input" placeholder="album name" autocomplete="off" autocorrect="off" spellcheck="false">' +
          '<button class="q-btn" onclick="pxTyped()">lock it in</button></div></div>') +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="pxGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );
  if (Q.mode === 'type') {
    const inp = document.getElementById('q-type-input');
    if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') pxTyped(); }); }
  }
  const im = new Image();
  im.onload = () => { q.img = im; pxDraw(); };
  im.src = qArt(q.track);
  pxDraw();
  Q.tick = setInterval(pxTick, 100);
}

function pxStep() {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  return Math.min(PX_STEPS.length - 1, Math.floor((1 - left / Q.duration) * PX_STEPS.length));
}
function pxWorth(step) { return Math.round(Q.perQ * (1 - step / PX_STEPS.length)); }

function pxDraw(full) {
  const q = Q.questions[Q.index], can = document.getElementById('px-can');
  if (!q || !can) return;
  const ctx = can.getContext('2d'), W = can.width;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, W);
  if (!q.img) return;
  ctx.imageSmoothingEnabled = !!full;
  if (full) { ctx.drawImage(q.img, 0, 0, W, W); return; }
  const n = PX_STEPS[q.px];
  const tmp = pxDraw.tmp || (pxDraw.tmp = document.createElement('canvas'));
  tmp.width = n; tmp.height = n;
  const tc = tmp.getContext('2d');
  tc.imageSmoothingEnabled = true;
  tc.drawImage(q.img, 0, 0, n, n);
  ctx.drawImage(tmp, 0, 0, n, n, 0, 0, W, W);
}

function pxTick() {
  mTick(() => { pxLock(-1); qFinishQuestion(false, null, 'timeout'); });
  const q = Q.questions[Q.index];
  if (!q || Q.locked) return;
  const s = pxStep();
  if (s !== q.px) { q.px = s; pxDraw(); }
  const w = document.getElementById('px-worth');
  if (w) w.textContent = pxWorth(q.px) + ' pts';
}

function pxLock(picked) {
  const q = Q.questions[Q.index];
  mLockChoices(picked, c => c === q.answer);
  pxDraw(true);
}
function pxChoice(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index], pts = pxWorth(q.px);
  pxLock(i);
  qFinishQuestion(q.choices[i] === q.answer, q.choices[i], null, pts);
}
function pxTyped() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input'), g = inp ? inp.value : '';
  if (!g.trim()) return;
  const q = Q.questions[Q.index], pts = pxWorth(q.px);
  pxLock(-1);
  qFinishQuestion(qMatches(g, q.answer), g, null, pts);
}
function pxGiveUp() { if (Q.locked) return; pxLock(-1); qFinishQuestion(false, null, 'gaveup'); }

// ======================== MEMORY MATCH ========================
// easy (mode 'mc'): cover <-> same cover. hard (mode 'type'): cover <-> its clip.

const MM_EASY = 8, MM_HARD = 6;

async function mmBuild(pool, onProgress) {
  const hard = Q.mode === 'type';
  const want = hard ? MM_HARD : MM_EASY;
  const arts = new Set(), out = [];
  for (const t of a4Clean(pool)) {
    if (out.length >= want) break;
    const art = qArt(t);
    if (!art || arts.has(art)) continue;
    if (hard) {
      const url = await qFindPreview(t);
      if (!url) continue;
      out.push({ track: t, preview: url, choices: null });
    } else out.push({ track: t, preview: null, choices: null });
    arts.add(art);
    onProgress(out.length * Q.len / want);
  }
  return out.length >= QUIZ_MIN_Q ? out : [];
}

function mmStart() {
  const hard = Q.mode === 'type';
  const cards = [];
  Q.questions.forEach((q, p) => {
    cards.push({ p, kind: 'cover' });
    cards.push({ p, kind: hard ? 'clip' : 'cover' });
  });
  A4.mm = { hard, cards: qShuffle(cards), open: [], matched: new Set(), moves: 0, start: Date.now(), busy: false, done: false };
  mmRender();
  Q.tick = setInterval(mmClock, 500);
}

function mmClock() {
  const el = document.getElementById('mm-time');
  if (el && A4.mm && !A4.mm.done) el.textContent = a4Clock(Date.now() - A4.mm.start);
}

function mmFace(c) {
  const q = Q.questions[c.p];
  if (c.kind === 'clip') return '<span class="mm-clip">🎧</span>';
  return '<img src="' + qArt(q.track) + '" alt="">';
}

function mmRender() {
  const S = A4.mm; if (!S) return;
  Q.screen = 'mm';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    '<div class="q-hud"><span class="qn">🃏 ' + (S.hard ? 'hard' : 'memory') + ' &middot; ' + S.matched.size + '/' + Q.questions.length + '</span>' +
      '<span class="sc">' + S.moves + ' moves &middot; <span id="mm-time">' + a4Clock(Date.now() - S.start) + '</span></span></div>' +
    '<div class="mm-grid' + (S.cards.length > 12 ? ' four' : '') + '">' + S.cards.map((c, i) => {
      const up = S.open.includes(i) || S.matched.has(c.p);
      return '<button class="mm-card' + (up ? ' up' : '') + (S.matched.has(c.p) ? ' got' : '') + (c.kind === 'clip' ? ' clip' : '') +
        (S.playing === i ? ' playing' : '') + '" onclick="mmFlip(' + i + ')">' +
        '<span class="back">✦</span><span class="face">' + mmFace(c) + '</span></button>';
    }).join('') + '</div>' +
    (S.last ? '<div class="cn-msg">' + S.last + '</div>' : '')
  );
}

function mmFlip(i) {
  const S = A4.mm; if (!S || S.done) return;
  const c = S.cards[i];
  if (!c) return;
  // tapping a matched or open clip card just replays it
  if ((S.matched.has(c.p) || S.open.includes(i)) && c.kind === 'clip') { mmPlay(i); return; }
  if (S.busy || S.open.includes(i) || S.matched.has(c.p)) return;
  S.open.push(i);
  if (c.kind === 'clip') mmPlay(i);
  if (S.open.length === 2) {
    S.moves++;
    const [a, b] = S.open.map(k => S.cards[k]);
    if (a.p === b.p) {
      S.matched.add(a.p); S.open = [];
      S.last = esc(qStrip(Q.questions[a.p].track.name));
      if (S.matched.size === Q.questions.length) { S.done = true; mmRender(); setTimeout(mmFinish, 900); return; }
    } else {
      S.busy = true;
      setTimeout(() => { S.open = []; S.busy = false; mmRender(); }, S.hard ? 1600 : 900);
    }
  }
  mmRender();
}

function mmPlay(i) {
  const S = A4.mm, q = Q.questions[S.cards[i].p];
  if (!q.preview) return;
  S.playing = i;
  qPlayClip(q.preview);
}

function mmFinish() {
  const S = A4.mm; if (!S) return;
  qStopAudio(); qClearTimers();
  const n = Q.questions.length, secs = (Date.now() - S.start) / 1000;
  const extra = Math.max(0, S.moves - n);
  const score = Math.max(100, Math.min(QUIZ_MAX, QUIZ_MAX - extra * (S.hard ? 30 : 40) - Math.max(0, secs - (S.hard ? 60 : 30)) * 2));
  Q.results = Q.questions.map(q => ({ track: q.track, points: 1, correct: true, guess: null }));
  a4Results('🃏 memory match' + (S.hard ? ' (hard)' : ''), score, S.moves + ' moves &middot; ' + a4Clock(secs * 1000),
    extra === 0 ? 'photographic memory' : extra <= n / 2 ? 'sharp' : extra <= n ? 'got there' : 'goldfish mode',
    a4Recap(Q.questions.map(q => q.track)));
}

// ======================== TIMELINE ========================

// pure: picks songs with release years, spreading across as many different years as possible
function tlPick(pool, n) {
  const withYear = a4Clean(pool).filter(t => gYear(t));
  const byYear = new Map();
  for (const t of withYear) (byYear.get(gYear(t)) || byYear.set(gYear(t), []).get(gYear(t))).push(t);
  if (byYear.size < 3) return [];
  const out = [], lists = qShuffle([...byYear.values()]);
  for (let round = 0; out.length < n; round++) {
    let added = false;
    for (const l of lists) if (l[round] && out.length < n) { out.push(l[round]); added = true; }
    if (!added) break;
  }
  return qShuffle(out);
}

// pure: is putting year y into the sorted years list at slot i correct?
function tlFits(years, i, y) {
  return (i === 0 || years[i - 1] <= y) && (i === years.length || years[i] >= y);
}

function tlStart() {
  const qs = Q.questions;
  A4.tl = { line: [qs[0].track], i: 1, lives: 3, right: 0, marks: [], flash: null, done: false };
  tlRender();
}

function tlRender() {
  const T = A4.tl; if (!T) return;
  Q.screen = 'tl';
  const cur = !T.done && Q.questions[T.i] ? Q.questions[T.i].track : null;
  const slot = k => cur ? '<button class="tl-slot" onclick="tlPlace(' + k + ')">＋ here</button>' : '';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    '<div class="q-hud"><span class="qn">📏 ' + Math.min(T.i, Q.questions.length - 1) + ' / ' + (Q.questions.length - 1) + ' &middot; ' +
      '🖤'.repeat(T.lives) + '<span style="opacity:.3">' + '🖤'.repeat(3 - T.lives) + '</span></span>' +
      '<span class="sc">' + Math.round(Q.score) + ' pts</span></div>' +
    (cur
      ? '<div class="tl-now">' + (qArt(cur) ? '<img src="' + qArt(cur) + '" alt="">' : '') +
          '<div><div class="nm">' + esc(qStrip(cur.name)) + '</div><div class="ar">' + esc(qArtistNames(cur)) + '</div></div></div>'
      : '') +
    (T.msg ? '<div class="cn-msg">' + T.msg + '</div>' : '') +
    '<div class="tl-line">' + slot(0) +
      T.line.map((t, k) =>
        '<div class="tl-item' + (T.flash === t ? (T.flashOk ? ' ok' : ' bad') : '') + '"><span class="yr">' + gYear(t) + '</span>' +
          (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '') +
          '<div class="tx"><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(gPrimary(t)) + '</div></div></div>' + slot(k + 1)
      ).join('') +
    '</div>' +
    (T.done ? '<div class="q-actions"><button class="q-btn" onclick="tlFinish()">see my score →</button></div>' : '')
  );
}

function tlPlace(k) {
  const T = A4.tl; if (!T || T.done) return;
  const t = Q.questions[T.i].track, y = gYear(t);
  const years = T.line.map(gYear);
  const ok = tlFits(years, k, y);
  let at = k;
  if (!ok) { at = years.findIndex(v => v > y); if (at < 0) at = years.length; }
  T.line.splice(at, 0, t);
  T.flash = t; T.flashOk = ok;
  T.marks.push({ track: t, ok });
  if (ok) { T.right++; Q.score += QUIZ_MAX / (Q.questions.length - 1); T.msg = '✓ ' + y; }
  else { T.lives--; T.msg = '✗ it came out in ' + y; }
  T.i++;
  if (T.lives <= 0 || T.i >= Q.questions.length) T.done = true;
  tlRender();
}

function tlFinish() {
  const T = A4.tl; if (!T) return;
  Q.results = T.marks.map(m => ({ track: m.track, points: m.ok ? 1 : 0, correct: m.ok, guess: null }));
  const n = Q.questions.length - 1;
  a4Results('📏 timeline', Q.score, T.right + '/' + n + ' placed right' + (T.lives <= 0 ? ' &middot; out of lives' : ''),
    T.right === n ? 'walking music history' : T.right >= n * 0.7 ? 'knows their eras' : T.right >= n * 0.4 ? 'roughly right' : 'time is fake anyway',
    a4Recap(T.marks.map(m => m.track), (t, i) => T.marks[i].ok));
}

// ======================== HOOKS ========================

(function a4InstallHooks() {
  const prev = { mSingleStart, mFixedLen, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, gModeSubs, qScreenMode };
  mSingleStart = () => Q.game === 'connections' || Q.game === 'timeline' || prev.mSingleStart();
  mFixedLen = () => Q.game === 'connections' ? 16 : Q.game === 'memory' ? MM_EASY : prev.mFixedLen();
  mModeNote = () => {
    const notes = {
      connections: '16 songs &middot; 4 groups of 4 &middot; 4 mistakes',
      pixel: Q.len + ' covers &middot; name the album &middot; fewer pixels = more points',
      memory: 'fewer moves + faster = more points',
      timeline: Q.len + ' songs &middot; 3 lives',
    };
    return notes[Q.game] ? '<p class="q-note" style="margin-top:20px;">' + notes[Q.game] + '</p>' : prev.mModeNote();
  };
  mWhyTooFew = () => {
    const why = {
      connections: 'couldn\'t make 4 clean groups out of these. a bigger playlist or your top songs works best.',
      pixel: 'need at least ' + QUIZ_MIN_Q + ' different albums with covers in here.',
      memory: 'need more songs with different covers' + (Q.mode === 'type' ? ' and playable clips' : '') + ' in here.',
      timeline: 'need songs from at least 3 different years in here.',
    };
    return why[Q.game] || prev.mWhyTooFew();
  };
  mBuildsGame = g => A4_GAMES.has(g) || prev.mBuildsGame(g);
  mBuildQuestions = async (pool, onProgress) => {
    switch (Q.game) {
      case 'connections': {
        const groups = cnMakeBoard(a4Clean(pool));
        if (!groups) return [];
        A4.cnGroups = groups;   // quiz.js copies the question list, so the board lives on the side
        return groups.flatMap(g => g.tracks.map(t => ({ track: t, preview: null, choices: null })));
      }
      case 'pixel': return pxBuild(pool);
      case 'memory': return mmBuild(pool, onProgress);
      case 'timeline': {
        const qs = tlPick(pool, Q.len + 1).map(t => ({ track: t, preview: null, choices: null }));
        return qs.length >= QUIZ_MIN_Q ? qs : [];
      }
    }
    return prev.mBuildQuestions(pool, onProgress);
  };
  mRenderQuestion = () => {
    if (Q.game === 'pixel') { pxRender(); return true; }
    if (A4_WHOLE.has(Q.game)) {
      if (Q.game === 'connections') cnStart();
      else if (Q.game === 'memory') mmStart();
      else tlStart();
      return true;
    }
    return prev.mRenderQuestion();
  };
  gModeSubs = () => Q.game === 'pixel'
    ? { mc: '4 albums, ' + PX_TIME + ' sec<br>the chill one', type: 'type the album, ' + PX_TIME + ' sec<br>typos are forgiven' }
    : prev.gModeSubs();
  // memory: the two answer-style cards become easy / hard
  qScreenMode = function () {
    const r = prev.qScreenMode.apply(this, arguments);
    if (Q.game === 'memory') {
      const box = document.querySelector('.q-modes');
      if (box) box.innerHTML =
        '<button class="q-src" onclick="qStart(\'mc\')"><span class="ico">🖼️</span><span class="lbl">covers</span>' +
          '<span class="sub">' + MM_EASY + ' pairs of album covers</span></button>' +
        '<button class="q-src" onclick="qStart(\'type\')"><span class="ico">🎧</span><span class="lbl">cover ↔ clip</span>' +
          '<span class="sub">' + MM_HARD + ' covers, ' + MM_HARD + ' clips. match the sound</span></button>';
    }
    return r;
  };
})();

X_HUB.games.push(
  () => xCard('🧩', 'connections', GAMES.connections.sub, 'gPick(\'connections\')'),
  () => xCard('👾', 'pixel reveal', GAMES.pixel.sub, 'gPick(\'pixel\')'),
  () => xCard('🃏', 'memory match', GAMES.memory.sub, 'gPick(\'memory\')'),
  () => xCard('📏', 'timeline', GAMES.timeline.sub, 'gPick(\'timeline\')'),
);

Object.assign(window, {
  mSingleStart, mFixedLen, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, gModeSubs, qScreenMode,
  cnTap, cnClear, cnShuffle, cnSubmit, cnFinish, pxChoice, pxTyped, pxGiveUp, mmFlip, tlPlace, tlFinish,
});
