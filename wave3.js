// ============================================================
//  xXx SparkleStats xXx  -  wave3.js
//  third wave, part 1: remix modes (nightcore / slowed + reverb /
//  backwards), anagram round, finish the lyric, swipe an artist,
//  song title word search. loads after more.js and wraps its hooks
//  so quiz.js / games.js never need to know we exist.
// ============================================================

const X = { fx: 'normal', fxCache: new Map(), fxToken: 0, fxCtx: null, swipe: null, ws: null, festStyle: 0 };

// later files push hub cards into these (functions or html strings)
const X_HUB = { games: [], you: [], social: [], labs: [] };

GAMES.anagram = { emoji: '🔀', name: 'anagram', sub: 'the title, scrambled. unscramble it. no audio' };
GAMES.lyric   = { emoji: '🎤', name: 'finish the lyric', sub: 'a line from the song, the end is missing. type it' };
LABS.swipe      = { emoji: '💘', name: 'swipe an artist', sub: 'yes or no on their whole catalog. build a to-listen list' };
LABS.wordsearch = { emoji: '🔤', name: 'word search', sub: '12 of their titles hidden in a grid. on screen or printable' };

const X_BUILDS = new Set(['anagram', 'lyric']);
const X_SINGLE = new Set(['anagram', 'lyric']);

// ======================== SHARED BITS ========================

function xCard(ico, lbl, sub, fn, badge) {
  return '<button class="q-src" onclick="' + fn + '"><span class="ico">' + ico + '</span>' +
    '<span class="lbl">' + lbl + (badge ? '<span class="g-badge">' + badge + '</span>' : '') + '</span><span class="sub">' + sub + '</span></button>';
}

function xHubCards() {
  const sec = (label, arr) => arr.length
    ? '<div class="g-hub-label">' + label + '</div><div class="g-hub">' + arr.map(f => typeof f === 'function' ? f() : f).join('') + '</div>'
    : '';
  return sec('even more games', X_HUB.games) + sec('more about you', X_HUB.you) + sec('with friends', X_HUB.social) + sec('toys', X_HUB.labs);
}

// same draw order as qBuildQuestions: hits first / mixed / deep cuts first
function xOrdered(pool) {
  const tiers = {};
  for (const t of pool) (tiers[t._priority || 0] = tiers[t._priority || 0] || []).push(t);
  const keys = Object.keys(tiers).sort((a, b) => a - b);
  if (keys.length < 2 || Q.depth === 'mix') return qShuffle(pool);
  if (Q.depth === 'deep') return keys.slice().reverse().flatMap(k => qShuffle(tiers[k]));
  return keys.flatMap(k => qShuffle(tiers[k]));
}

function xBack() { return (typeof _data !== 'undefined' && _data) ? 'gScreenHub()' : 'closeQuiz()'; }

function xCopy(btn, text, label) {
  const was = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = label || 'copied 🩷';
    setTimeout(() => { btn.textContent = was; }, 2000);
  }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}

// ======================== REMIX MODES (audio fx) ========================
// every clip is rendered offline through the web audio api into a wav blob,
// so the normal <audio> element (and everything that pauses / replays it)
// keeps working exactly as before. only the url changes.

const X_FX = {
  normal:    { label: 'normal', sub: 'as recorded' },
  nightcore: { label: 'nightcore ⚡', sub: 'sped up + pitched up', rate: 1.28 },
  slowed:    { label: 'slowed + reverb 🌧️', sub: 'dragged down + drowned in reverb', rate: 0.8, reverb: true },
  reverse:   { label: 'backwards 🔁', sub: 'the whole clip, in reverse', reverse: true },
};
const X_FX_GAMES = new Set(['classic', 'year', 'lightning']);
const X_FX_KEY = 'sparkle_fx';

function xFxOk() {
  return typeof window !== 'undefined' && !!(window.OfflineAudioContext || window.webkitOfflineAudioContext) &&
    !!(window.AudioContext || window.webkitAudioContext) && typeof fetch === 'function' && typeof Blob === 'function';
}
function xFxLoad() { try { const v = localStorage.getItem(X_FX_KEY); if (X_FX[v]) X.fx = v; } catch {} }
function xSetFx(k) {
  if (!X_FX[k]) return;
  X.fx = k;
  try { localStorage.setItem(X_FX_KEY, k); } catch {}
  if (Q.screen === 'mode') qScreenMode();
}
function xFxTabs() {
  return '<p class="q-note" style="margin:14px 0 8px;">remix it</p>' +
    '<div class="tabs x-fx-tabs" id="x-fx-tabs">' +
      Object.keys(X_FX).map(k =>
        '<button class="' + (X.fx === k ? 'active' : '') + '" onclick="xSetFx(\'' + k + '\')" title="' + X_FX[k].sub + '">' + X_FX[k].label + '</button>'
      ).join('') +
    '</div>' +
    (X.fx !== 'normal' ? '<p class="q-note" style="margin-top:6px;">' + X_FX[X.fx].sub + ' &middot; clips take a second longer to start</p>' : '');
}
function xFxActive() { return X.fx !== 'normal' && X_FX_GAMES.has(Q.game) && xFxOk(); }

function xFxGet(url, fx) {
  const key = fx + '|' + url;
  if (X.fxCache.has(key)) {
    const p = X.fxCache.get(key);
    X.fxCache.delete(key); X.fxCache.set(key, p);       // bump to newest
    return p;
  }
  const p = xFxRender(url, fx).catch(e => { X.fxCache.delete(key); throw e; });
  X.fxCache.set(key, p);
  while (X.fxCache.size > 12) {
    const k = X.fxCache.keys().next().value;
    const old = X.fxCache.get(k);
    X.fxCache.delete(k);
    old.then(u => { try { URL.revokeObjectURL(u); } catch {} }).catch(() => {});
  }
  return p;
}

function xDecode(ctx, ab) {
  return new Promise((resolve, reject) => {
    const r = ctx.decodeAudioData(ab, resolve, reject);
    if (r && r.then) r.then(resolve, reject);
  });
}

// pure: flips every channel of a buffer-like object in place-ish (returns arrays)
function xReverseChannels(chans) {
  return chans.map(d => { const out = new Float32Array(d.length); for (let i = 0; i < d.length; i++) out[i] = d[d.length - 1 - i]; return out; });
}

function xImpulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const b = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// 16-bit pcm wav from an AudioBuffer (or anything with the same shape)
function xWav(buf) {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, rate = buf.sampleRate;
  const bytes = n * ch * 2;
  const data = new DataView(new ArrayBuffer(44 + bytes));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, bytes, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    data.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
    o += 2;
  }
  return data.buffer;
}

async function xFxRender(url, fx) {
  const cfg = X_FX[fx];
  if (!cfg || fx === 'normal') return url;
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!X.fxCtx) X.fxCtx = new AC();
  const res = await fetch(url);
  if (!res.ok) throw new Error('clip fetch failed');
  const src = await xDecode(X.fxCtx, await res.arrayBuffer());
  const rate = cfg.rate || 1;
  const ch = Math.min(2, src.numberOfChannels);
  const tail = cfg.reverb ? 2.2 : 0;
  const len = Math.ceil(src.length / rate + tail * src.sampleRate);
  const off = new OAC(ch, len, src.sampleRate);
  let buf = src;
  if (cfg.reverse) {
    buf = off.createBuffer(ch, src.length, src.sampleRate);
    const flipped = xReverseChannels(Array.from({ length: ch }, (_, c) => src.getChannelData(c)));
    for (let c = 0; c < ch; c++) buf.getChannelData(c).set(flipped[c]);
  }
  const node = off.createBufferSource();
  node.buffer = buf;
  node.playbackRate.value = rate;
  if (cfg.reverb) {
    const dry = off.createGain(); dry.gain.value = 0.7;
    const wet = off.createGain(); wet.gain.value = 0.55;
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    const conv = off.createConvolver(); conv.buffer = xImpulse(off, 2.4, 2.6);
    node.connect(dry); dry.connect(off.destination);
    node.connect(lp); lp.connect(conv); conv.connect(wet); wet.connect(off.destination);
  } else {
    node.connect(off.destination);
  }
  node.start(0);
  const rendered = await off.startRendering();
  return URL.createObjectURL(new Blob([xWav(rendered)], { type: 'audio/wav' }));
}

// ======================== ANAGRAM ========================

function xScramble(word) {
  const letters = word.split('');
  if (letters.length < 2) return word;
  for (let tries = 0; tries < 10; tries++) {
    const s = qShuffle(letters).join('');
    if (s.toLowerCase() !== word.toLowerCase()) return s;
  }
  return letters.reverse().join('');
}
function xAnagramOf(title) {
  return qStrip(title).split(/\s+/).map(w => xScramble(w)).join(' ');
}

function xBuildAnagram(pool) {
  const seen = new Set();
  const out = [];
  for (const t of xOrdered(pool)) {
    if (qIsAlt(t.name)) continue;
    const name = qStrip(t.name);
    const letters = name.replace(/[^a-z]/gi, '');
    if (letters.length < 4 || name.length > 28) continue;
    const key = qNorm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ track: t, preview: null, choices: null, scrambled: xAnagramOf(name).toUpperCase() });
    if (out.length >= Q.len) break;
  }
  Q.skipped = 0;
  return out;
}

function xTiles(scrambled) {
  return '<div class="x-tiles">' + scrambled.split(' ').map(word =>
    '<span class="x-word">' + word.split('').map(ch => '<span class="x-tile' + (/[A-Z0-9]/.test(ch) ? '' : ' punct') + '">' + esc(ch) + '</span>').join('') + '</span>'
  ).join('<span class="x-gap"></span>') + '</div>';
}

function xAnagramRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); qStopAudio();
  const q = Q.questions[Q.index];
  Q.duration = 30; Q.deadline = Date.now() + 30000;
  qSet(
    mHud('title ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="m-blankwrap">' +
      '<div class="q-note">' + esc(qArtistNames(q.track)) + '</div>' +
      xTiles(q.scrambled) +
      '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="unscramble it..." autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="xAnagramAnswer()">that\'s it</button>' +
      '</div></div>' +
      '<div class="q-actions">' +
        '<button class="q-btn ghost" id="x-hint" onclick="xAnagramHint()">first letters?</button>' +
        '<button class="q-btn ghost" id="q-giveup" onclick="xAnagramGiveUp()">i give up</button>' +
      '</div>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  const inp = document.getElementById('q-type-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') xAnagramAnswer(); }); }
  Q.tick = setInterval(() => mTick(() => { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'timeout'); }), 100);
}
// shows the first letter of every word (costs a quarter of the points)
function xAnagramHint() {
  if (Q.locked || Q.hintShown) return;
  Q.hintShown = true;
  const q = Q.questions[Q.index];
  const inp = document.getElementById('q-type-input');
  if (inp) inp.placeholder = qMask(q.track.name, true);
  const b = document.getElementById('x-hint');
  if (b) b.style.display = 'none';
}
function xAnagramAnswer() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  const ok = qMatches(guess, q.track.name);
  mLockChoices(-1, () => false);
  const left = qTimeLeft();
  const pts = Q.perQ * (0.5 + 0.5 * (left / Q.duration)) * (Q.hintShown ? 0.75 : 1);
  qFinishQuestion(ok, guess, null, ok ? pts : undefined);
}
function xAnagramGiveUp() { if (!Q.locked) { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'gaveup'); } }

// ======================== FINISH THE LYRIC ========================
// lyrics come from lrclib.net (free, open, no key). we show one line of
// context and one line with its last words blanked out.

const X_LRC = 'https://lrclib.net/api/search';
const xLyricCache = new Map();

async function xLyricsFor(track) {
  if (xLyricCache.has(track.id)) return xLyricCache.get(track.id);
  const p = (async () => {
    const artist = gPrimary(track), title = qStrip(track.name);
    const res = await fetch(X_LRC + '?track_name=' + encodeURIComponent(title) + '&artist_name=' + encodeURIComponent(artist));
    if (!res.ok) return null;
    const list = await res.json();
    const want = qNorm(artist).split(' ')[0] || '';
    const hit = (Array.isArray(list) ? list : []).find(r =>
      r && !r.instrumental && r.plainLyrics && r.plainLyrics.length > 80 &&
      qNorm(r.artistName || '').includes(want) && qMatches(r.trackName || '', title));
    return hit ? hit.plainLyrics : null;
  })().catch(() => null);
  xLyricCache.set(track.id, p);
  return p;
}

// picks a singable line with a real line before it; blanks the last 1-3 words
function xPickLine(lyrics) {
  const lines = String(lyrics || '').split('\n').map(s => s.trim());
  const usable = i => {
    const l = lines[i];
    if (!l || /^\[/.test(l) || /^\(.*\)$/.test(l)) return false;
    const w = l.split(/\s+/);
    return w.length >= 4 && w.length <= 12 && /[a-z]/i.test(l);
  };
  const cands = [];
  for (let i = 1; i < lines.length; i++) if (usable(i) && lines[i - 1] && !/^\[/.test(lines[i - 1])) cands.push(i);
  if (!cands.length) return null;
  const i = cands[Math.floor(Math.random() * cands.length)];
  const words = lines[i].split(/\s+/);
  const k = words.length >= 8 ? 3 : words.length >= 5 ? 2 : 1;
  const answer = words.slice(-k).join(' ');
  const shown = words.slice(0, -k).join(' ') + ' ' +
    words.slice(-k).map(w => '_'.repeat(Math.max(3, w.replace(/[^a-z0-9']/gi, '').length))).join(' ');
  return { context: lines[i - 1], shown, answer, full: lines[i] };
}

async function xBuildLyric(pool, onProgress) {
  const ordered = xOrdered(pool).filter(t => !qIsAlt(t.name));
  const out = [];
  const seen = new Set();
  let i = 0, looked = 0;
  while (out.length < Q.len && i < ordered.length && looked < 60) {
    const batch = [];
    while (batch.length < 3 && i < ordered.length) {
      const t = ordered[i++];
      const k = qNorm(qStrip(t.name));
      if (seen.has(k)) continue;
      seen.add(k);
      batch.push(t);
    }
    if (!batch.length) break;
    looked += batch.length;
    const got = await Promise.all(batch.map(async t => ({ t, ly: await xLyricsFor(t) })));
    for (const g of got) {
      const pick = g.ly && xPickLine(g.ly);
      if (pick && out.length < Q.len) out.push({ track: g.t, preview: null, choices: null, ...pick, detail: '"' + pick.full + '"' });
    }
    onProgress(out.length);
  }
  Q.skipped = 0;     // the results screen's "no clip on apple" note doesn't apply here
  return out;
}

function xLyricRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); qStopAudio();
  const q = Q.questions[Q.index];
  Q.duration = 25; Q.deadline = Date.now() + 25000;
  qSet(
    mHud('lyric ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="m-blankwrap x-lyric">' +
      '<div class="q-note">' + esc(qStrip(q.track.name)) + ' &middot; ' + esc(qArtistNames(q.track)) + '</div>' +
      '<div class="x-lyric-ctx">' + esc(q.context) + '</div>' +
      '<div class="m-blank x-lyric-line">' + esc(q.shown) + '</div>' +
      '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="the missing words..." autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="xLyricAnswer()">sing it</button>' +
      '</div></div>' +
      '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="xLyricGiveUp()">i give up</button></div>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  const inp = document.getElementById('q-type-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') xLyricAnswer(); }); }
  Q.tick = setInterval(() => mTick(() => { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'timeout'); }), 100);
}
function xLyricAnswer() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  const ok = qNorm(guess) === qNorm(q.answer) || qMatches(guess, q.answer);
  mLockChoices(-1, () => false);
  qFinishQuestion(ok, guess);
}
function xLyricGiveUp() { if (!Q.locked) { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'gaveup'); } }

// ======================== SWIPE AN ARTIST ========================

const X_SWIPE_KEY = 'sparkle_swipes';
function xSwipeLoadAll() { try { return JSON.parse(localStorage.getItem(X_SWIPE_KEY) || '{}') || {}; } catch { return {}; } }
function xSwipeSave() {
  const S = X.swipe; if (!S) return;
  const all = xSwipeLoadAll();
  all[S.artist.id] = { name: S.artist.name, likes: S.likes, seen: S.seen };
  try { localStorage.setItem(X_SWIPE_KEY, JSON.stringify(all)); } catch {}
}

function xOpenSwipe() { Q.game = 'swipe'; qScreenMenu(); }

function xScreenSwipe() {
  Q.screen = 'swipe';
  qStopAudio(); qClearTimers();
  const s = Q.source;
  const known = new Set((typeof lCdTracks === 'function' ? lCdTracks() : []).map(lTrackKey));
  const saved = xSwipeLoadAll()[s.id] || { likes: [], seen: [] };
  const seenIds = new Set(saved.seen || []);
  const cards = qShuffle(Q.pool.filter(t => !qIsAlt(t.name) && !known.has(lTrackKey(t)) && !seenIds.has(t.id)));
  X.swipe = { artist: s, cards, i: 0, likes: saved.likes || [], seen: saved.seen || [], nope: 0, token: 0 };
  xSwipeRender();
}

function xSwipeLikes() {
  const S = X.swipe;
  return '<div class="x-likes" id="x-likes">' +
    '<div class="q-note" style="margin-bottom:6px;">to listen (' + S.likes.length + ')</div>' +
    (S.likes.length
      ? S.likes.map(l => '<a class="x-like" href="https://open.spotify.com/track/' + esc(l.id) + '" target="_blank" rel="noopener">' +
          '♥ ' + esc(l.n) + '<span class="mt">' + esc(l.al || '') + '</span></a>').join('')
      : '<div class="q-note">nothing yet. swipe right on something.</div>') +
    (S.likes.length ? '<div class="q-actions" style="margin-top:8px;"><button class="q-btn ghost" onclick="xSwipeCopy(this)">copy the list</button>' +
      '<button class="q-btn ghost" onclick="xSwipeClear()">clear</button></div>' : '') +
  '</div>';
}

function xSwipeRender() {
  const S = X.swipe;
  const t = S.cards[S.i];
  const head = qTopBar('&larr; pick another artist', 'qScreenMenu()') +
    qHeader('💘 ' + esc(S.artist.name), (S.cards.length - S.i) + ' songs you don\'t have yet');
  if (!t) {
    qSet(head +
      '<div class="q-final fade-up"><div style="font-size:2.4rem;">💘</div><div class="rank">that\'s the whole catalog</div>' +
        '<div class="blurb">' + S.likes.length + ' to listen &middot; ' + S.nope + ' passed on</div></div>' +
      xSwipeLikes() +
      '<div class="q-actions"><button class="q-btn" onclick="qScreenMenu()">swipe someone else</button>' +
        '<button class="q-btn ghost" onclick="' + xBack() + '">arcade</button></div>');
    return;
  }
  const year = gYear(t);
  qSet(head +
    '<div class="x-swcard fade-up" id="x-swcard">' +
      (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div class="nm">' + esc(qStrip(t.name)) + '</div>' +
      '<div class="mt">' + esc(t.album?.name || '') + (year ? ' &middot; ' + year : '') + '</div>' +
      '<button class="q-replay" id="x-swplay" onclick="xSwipePlay()">↻ play the clip</button>' +
    '</div>' +
    '<div class="x-swbtns">' +
      '<button class="x-sw no" onclick="xSwipe(0)" title="left arrow">✖<span>nah</span></button>' +
      '<button class="x-sw yes" onclick="xSwipe(1)" title="right arrow">♥<span>add it</span></button>' +
    '</div>' +
    '<p class="q-note">' + (S.i + 1) + ' of ' + S.cards.length + ' &middot; &larr; &rarr; keys, or swipe the card on your phone</p>' +
    xSwipeLikes());
  const card = document.getElementById('x-swcard');
  if (card && card.addEventListener) {
    let x0 = null;
    card.addEventListener('touchstart', e => { x0 = e.touches && e.touches[0] ? e.touches[0].clientX : null; }, { passive: true });
    card.addEventListener('touchend', e => {
      if (x0 == null || !e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (dx > 60) xSwipe(1); else if (dx < -60) xSwipe(0);
    }, { passive: true });
  }
  xSwipePlay();
}

async function xSwipePlay() {
  const S = X.swipe; if (!S) return;
  const t = S.cards[S.i]; if (!t) return;
  const token = ++S.token;
  const b = document.getElementById('x-swplay');
  if (b) b.textContent = 'finding the clip...';
  const url = await qFindPreview(t);
  if (token !== S.token || X.swipe !== S) return;
  if (!url) { if (b) b.textContent = 'no clip for this one'; return; }
  if (b) b.textContent = '↻ play again';
  qPlayClip(url);
}

function xSwipe(like) {
  const S = X.swipe; if (!S) return;
  const t = S.cards[S.i]; if (!t) return;
  qStopAudio();
  S.seen.push(t.id);
  if (like) S.likes.push({ id: t.id, n: qStrip(t.name), al: t.album?.name || '' });
  else S.nope++;
  S.i++;
  xSwipeSave();
  xSwipeRender();
}
function xSwipeCopy(btn) {
  const S = X.swipe; if (!S) return;
  xCopy(btn, 'to listen - ' + S.artist.name + '\n' + S.likes.map(l => '- ' + l.n + (l.al ? ' (' + l.al + ')' : '')).join('\n') + '\n' + SITE_URL);
}
function xSwipeClear() {
  const S = X.swipe; if (!S) return;
  S.likes = []; S.seen = []; S.i = 0; S.nope = 0;
  const all = xSwipeLoadAll(); delete all[S.artist.id];
  try { localStorage.setItem(X_SWIPE_KEY, JSON.stringify(all)); } catch {}
  xScreenSwipe();
}

// ======================== WORD SEARCH ========================

const X_WS_DIRS = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];

function xOpenWordSearch() { Q.game = 'wordsearch'; qScreenMenu(); }

function xWsWords(pool, n) {
  const seen = new Set();
  const words = [];
  for (const t of qShuffle(pool)) {
    const title = qStrip(t.name);
    const w = title.toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '');
    if (w.length < 4 || w.length > 12 || seen.has(w) || qIsAlt(t.name)) continue;
    seen.add(w);
    words.push({ w, title, artist: gPrimary(t) });
    if (words.length >= (n || 12)) break;
  }
  return words;
}

function xWsBuild(words, size) {
  const g = Array.from({ length: size }, () => Array(size).fill(''));
  const placed = [];
  for (const it of words.slice().sort((a, b) => b.w.length - a.w.length)) {
    let ok = false;
    for (let tries = 0; tries < 300 && !ok; tries++) {
      const [dx, dy] = X_WS_DIRS[Math.floor(Math.random() * X_WS_DIRS.length)];
      const x0 = Math.floor(Math.random() * size), y0 = Math.floor(Math.random() * size);
      const x1 = x0 + dx * (it.w.length - 1), y1 = y0 + dy * (it.w.length - 1);
      if (x1 < 0 || y1 < 0 || x1 >= size || y1 >= size) continue;
      let fits = true;
      for (let k = 0; k < it.w.length; k++) {
        const c = g[y0 + dy * k][x0 + dx * k];
        if (c && c !== it.w[k]) { fits = false; break; }
      }
      if (!fits) continue;
      for (let k = 0; k < it.w.length; k++) g[y0 + dy * k][x0 + dx * k] = it.w[k];
      placed.push({ ...it, x0, y0, x1, y1, found: false });
      ok = true;
    }
  }
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!g[y][x]) g[y][x] = A[Math.floor(Math.random() * 26)];
  return { grid: g, placed };
}

// cells on the straight line from a to b, or null if it isn't straight
function xWsLine(a, b) {
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  if (!(dx === 0 || dy === 0 || Math.abs(b.x - a.x) === Math.abs(b.y - a.y))) return null;
  const out = [];
  for (let k = 0; k <= n; k++) out.push({ x: a.x + dx * k, y: a.y + dy * k });
  return out;
}

function xScreenWordSearch() {
  Q.screen = 'wordsearch';
  qStopAudio(); qClearTimers();
  const words = xWsWords(Q.pool, 12);
  if (words.length < 6) {
    qSet(qTopBar('&larr; back', 'qScreenMenu()') + qHeader('🔤 word search', '') +
      qErrorBox('not enough usable titles in there (need 6+ with 4 to 12 letters). try something with more songs.'));
    return;
  }
  const longest = Math.max(...words.map(w => w.w.length));
  const size = Math.max(12, Math.min(15, longest + 3));
  const built = xWsBuild(words, size);
  X.ws = { ...built, size, first: null, startedAt: Date.now(), done: false, source: Q.source.name };
  xWsRender();
}

function xWsRender() {
  const W = X.ws;
  const found = W.placed.filter(p => p.found).length;
  qSet(
    qTopBar('&larr; pick something else', 'qScreenMenu()') +
    qHeader('🔤 word search', esc(W.source)) +
    '<p class="q-note" style="margin-bottom:10px;">tap the first letter, then the last letter. ' + found + ' / ' + W.placed.length + ' found</p>' +
    '<div class="x-wswrap" id="x-wswrap">' +
      '<div class="x-ws" style="grid-template-columns:repeat(' + W.size + ',1fr);">' +
        W.grid.map((row, y) => row.map((ch, x) =>
          '<button class="x-cell" id="x-cell-' + x + '-' + y + '" onclick="xWsTap(' + x + ',' + y + ')">' + ch + '</button>'
        ).join('')).join('') +
      '</div>' +
      '<div class="x-wslist" id="x-wslist">' +
        W.placed.map(p => '<div class="x-wsword' + (p.found ? ' found' : '') + '" id="x-wsw-' + p.w + '">' + esc(p.title) + '</div>').join('') +
      '</div>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn ghost" onclick="xWsPrint(this)">save printable</button>' +
      '<button class="q-btn ghost" onclick="xScreenWordSearch()">new grid</button>' +
    '</div>' +
    '<div id="x-wsdone"></div>'
  );
  // re-mark found cells after a rerender
  for (const p of W.placed) if (p.found) xWsMark(p, 'found');
}

function xWsMark(p, cls) {
  const cells = xWsLine({ x: p.x0, y: p.y0 }, { x: p.x1, y: p.y1 }) || [];
  for (const c of cells) { const el = document.getElementById('x-cell-' + c.x + '-' + c.y); if (el) el.classList.add(cls); }
}

function xWsTap(x, y) {
  const W = X.ws; if (!W || W.done) return;
  const el = document.getElementById('x-cell-' + x + '-' + y);
  if (!W.first) {
    W.first = { x, y };
    if (el) el.classList.add('sel');
    return;
  }
  const a = W.first; W.first = null;
  const ael = document.getElementById('x-cell-' + a.x + '-' + a.y);
  if (ael) ael.classList.remove('sel');
  if (a.x === x && a.y === y) return;
  const line = xWsLine(a, { x, y });
  if (!line) return;
  const s = line.map(c => W.grid[c.y][c.x]).join('');
  const rev = s.split('').reverse().join('');
  const hit = W.placed.find(p => !p.found && (p.w === s || p.w === rev));
  if (!hit) {
    for (const c of line) { const e = document.getElementById('x-cell-' + c.x + '-' + c.y); if (e) { e.classList.add('nope'); setTimeout(() => e.classList.remove('nope'), 400); } }
    return;
  }
  hit.found = true;
  xWsMark(hit, 'found');
  const w = document.getElementById('x-wsw-' + hit.w); if (w) w.classList.add('found');
  const found = W.placed.filter(p => p.found).length;
  const note = document.querySelector('#game .q-note');
  if (note) note.textContent = 'tap the first letter, then the last letter. ' + found + ' / ' + W.placed.length + ' found';
  if (found === W.placed.length) {
    W.done = true;
    const secs = Math.round((Date.now() - W.startedAt) / 1000);
    const box = document.getElementById('x-wsdone');
    if (box) box.innerHTML = '<div class="q-final fade-up"><div style="font-size:2rem;">🔤</div><div class="rank">all ' + W.placed.length + ' found</div>' +
      '<div class="blurb">' + Math.floor(secs / 60) + 'm ' + (secs % 60) + 's</div></div>';
    if (typeof mAward === 'function') mAward('wordsearch');
    if (window.confetti) confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: ['#FF1493', '#FFB6C1', '#FF69B4'] });
  }
}

// black-on-white version for printing
async function xWsPrint(btn) {
  const W = X.ws; if (!W) return;
  if (typeof html2canvas !== 'function') { btn.textContent = 'image tool didn\'t load'; return; }
  const was = btn.textContent;
  btn.textContent = 'making it...';
  const el = document.createElement('div');
  el.className = 'x-wsprint';
  el.innerHTML =
    '<div class="t">' + esc(W.source) + ' word search</div>' +
    '<div class="s">find all ' + W.placed.length + ' song titles &middot; xXx SparkleStats xXx</div>' +
    '<div class="g" style="grid-template-columns:repeat(' + W.size + ',1fr);">' +
      W.grid.map(row => row.map(ch => '<span>' + ch + '</span>').join('')).join('') +
    '</div>' +
    '<div class="l">' + W.placed.map(p => '<span>' + esc(p.title) + '</span>').join('') + '</div>';
  document.body.appendChild(el);
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, logging: false });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'sparklestats-wordsearch.png';
    document.body.appendChild(a); a.click(); a.remove();
    btn.textContent = 'saved 🩷';
  } catch (e) {
    btn.textContent = 'couldn\'t save :(';
  }
  el.remove();
  setTimeout(() => { btn.textContent = was; }, 2000);
}

// ======================== HOOKS (wrap more.js / quiz.js) ========================

function xModeNote() {
  const notes = {
    anagram: Q.len + ' titles &middot; letters shuffled inside each word &middot; 30 seconds each &middot; hint costs a quarter',
    lyric: Q.len + ' lyrics &middot; type the missing words &middot; 25 seconds each',
  };
  return notes[Q.game] ? '<p class="q-note" style="margin-top:20px;">' + notes[Q.game] + '</p>' : null;
}
function xWhyTooFew() {
  const why = {
    anagram: 'not enough titles worth scrambling in there (need 4+ letters, 28 characters max). try something bigger.',
    lyric: 'couldn\'t find lyrics for enough of these. lrclib doesn\'t have everything - try more well-known songs?',
  };
  return why[Q.game] || null;
}
async function xBuildQuestions(pool, onProgress) {
  if (Q.game === 'anagram') { const qs = xBuildAnagram(pool); onProgress(qs.length); return qs; }
  if (Q.game === 'lyric') return xBuildLyric(pool, onProgress);
  return [];
}
function xRenderQuestion() {
  if (Q.game === 'anagram') { xAnagramRender(); return true; }
  if (Q.game === 'lyric') { xLyricRender(); return true; }
  return false;
}

(function xInstallHooks() {
  const prev = { mSourceDisabled, mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, mHubCards, qScreenMode, qPlayClip, qRenderQuestion };
  mSourceDisabled = kind => (Q.game === 'swipe' ? kind !== 'artist' : prev.mSourceDisabled(kind));
  mSingleStart = () => X_SINGLE.has(Q.game) || prev.mSingleStart();
  mModeNote = () => xModeNote() || prev.mModeNote();
  mWhyTooFew = () => xWhyTooFew() || prev.mWhyTooFew();
  mBuildsGame = game => X_BUILDS.has(game) || prev.mBuildsGame(game);
  mBuildQuestions = (pool, onProgress) => X_BUILDS.has(Q.game) ? xBuildQuestions(pool, onProgress) : prev.mBuildQuestions(pool, onProgress);
  mRenderQuestion = () => xRenderQuestion() || prev.mRenderQuestion();
  mHubCards = () => prev.mHubCards() + xHubCards();

  // swipe / word search borrow the source picker then go to their own screens;
  // everything else gets the remix tabs slipped into the mode screen
  qScreenMode = function () {
    if (Q.game === 'swipe') { xScreenSwipe(); return; }
    if (Q.game === 'wordsearch') { xScreenWordSearch(); return; }
    const r = prev.qScreenMode();
    if (Q.screen === 'mode' && X_FX_GAMES.has(Q.game) && xFxOk()) {
      const game = document.getElementById('game');
      const anchor = game && game.querySelector && (game.querySelector('.q-modes') || game.querySelector('.q-actions'));
      if (anchor && anchor.insertAdjacentHTML) anchor.insertAdjacentHTML('beforebegin', xFxTabs());
    }
    return r;
  };
  qPlayClip = function (url) {
    if (!url || !xFxActive() || /^blob:/.test(url)) return prev.qPlayClip(url);
    const token = ++X.fxToken;
    xFxGet(url, X.fx).then(
      b => { if (token === X.fxToken) prev.qPlayClip(b || url); },
      () => { if (token === X.fxToken) prev.qPlayClip(url); }
    );
  };
  // warm the current and next clip so remixed rounds don't stall between songs
  qRenderQuestion = function () {
    if (xFxActive()) {
      [Q.index, Q.index + 1].forEach(i => { const q = Q.questions[i]; if (q && q.preview) xFxGet(q.preview, X.fx).catch(() => {}); });
    }
    return prev.qRenderQuestion();
  };
  xFxLoad();
})();

X_HUB.games.push(
  () => xCard('🔀', 'anagram', GAMES.anagram.sub, 'gPick(\'anagram\')'),
  () => xCard('🎤', 'finish the lyric', GAMES.lyric.sub, 'gPick(\'lyric\')'),
  () => xCard('🎚️', 'remix modes', 'nightcore, slowed + reverb, backwards. pick one on the guess-the-song mode screen', 'gPick(\'classic\')', X.fx !== 'normal' ? X_FX[X.fx].label : '')
);
X_HUB.labs.push(
  () => xCard('💘', 'swipe an artist', LABS.swipe.sub, 'xOpenSwipe()'),
  () => xCard('🔤', 'word search', LABS.wordsearch.sub, 'xOpenWordSearch()')
);

// ======================== KEYBOARD ========================

function xInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (Q.screen === 'swipe' && X.swipe) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); xSwipe(0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); xSwipe(1); }
      else if (e.key === ' ') { e.preventDefault(); xSwipePlay(); }
    }
  });
}
xInstallKeys();

// ======================== EXPORTS ========================

Object.assign(window, {
  mSourceDisabled, mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, mHubCards,
  qScreenMode, qPlayClip, qRenderQuestion,
  xSetFx, xAnagramAnswer, xAnagramHint, xAnagramGiveUp, xLyricAnswer, xLyricGiveUp,
  xOpenSwipe, xSwipe, xSwipePlay, xSwipeCopy, xSwipeClear,
  xOpenWordSearch, xScreenWordSearch, xWsTap, xWsPrint,
});
