// ============================================================
//  xXx SparkleStats xXx  -  arcade5.js
//  artist wordle (daily + your artists), mystery artist,
//  tap the beat, slot machine, typing race.
//  tap the beat + typing race go through the normal source picker;
//  the other three are their own screens. loads after arcade4.js.
// ============================================================

GAMES.tap    = { emoji: '🥁', name: 'tap the beat', sub: 'tap along to the clip. how close is your bpm' };
GAMES.typing = { emoji: '⌨️', name: 'typing race', sub: 'type the lyrics while the song plays. wpm + accuracy' };

const A5 = { aw: null, ma: null, sm: null, tb: { taps: [] }, ty: { start: 0 } };

// ======================== SHARED ========================

function a5Open(fn) {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo && window.scrollTo(0, 0);
  fn();
}
function a5LoggedIn() { return typeof _data !== 'undefined' && !!_data; }
function a5Get(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch { return def; } }
function a5Put(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
function a5Letters(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, ''); }

// her artists, most recent first, no repeats
function a5Artists() {
  if (!a5LoggedIn()) return [];
  const a = _data.artists || {}, seen = new Set(), out = [];
  for (const x of [...(a.short_term || []), ...(a.medium_term || []), ...(a.long_term || [])]) {
    if (!x || seen.has(x.id)) continue;
    seen.add(x.id); out.push(x);
  }
  return out;
}
function a5ArtistImg(a) { return (typeof img === 'function' && img(a.images, 'md')) || (a.images && a.images[0] && a.images[0].url) || ''; }
function a5TracksBy(name) {
  if (!a5LoggedIn()) return [];
  const want = qNorm(name);
  return qPoolFromTop().filter(t => (t.artists || []).some(x => qNorm(x.name) === want));
}

// ======================== ARTIST WORDLE ========================
// the daily answer is the same for everyone: day number -> spot in a fixed shuffle of this list

const AW_LIST = [
  'Flyleaf', 'Evanescence', 'Britney', 'Kesha', 'Halsey', 'Garbage', 'Blondie', 'No Doubt', 'Hole', 'Skillet',
  'Halestorm', 'Lacuna Coil', 'PVRIS', 'Marina', 'Grimes', 'Mitski', 'Aurora', 'Madonna', 'Cher', 'Pink',
  'Lady Gaga', 'Lana Del Rey', 'Charli xcx', 'Green Day', 'Weezer', 'The Used', 'Saosin', 'Underoath', 'Chiodos', 'Atreyu',
  'The Maine', 'Fall Out Boy', 'All Time Low', 'Hey Monday', 'Hilary Duff', 'Fefe Dobson', 'JoJo', 'Rihanna', 'Amy Lee', 'Lights',
  'Eisley', 'Nightwish', 'Placebo', 'The Cure', 'Kittie', 'We the Kings', 'Icon for Hire', 'Metric', 'Lorde', 'Ashnikko',
];
const AW_TRIES = 6;
const AW_KEY = 'sparkle_aw';
const AW_EPOCH = Date.UTC(2026, 0, 1);

function awDayNum(d) {
  d = d || new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - AW_EPOCH) / 864e5);
}
function awOrder() {
  const a = AW_LIST.slice();
  let s = 1234567;
  for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function awDaily(day) { const o = awOrder(); const n = day == null ? awDayNum() : day; return o[((n % o.length) + o.length) % o.length]; }

// wordle coloring with repeated letters done right: 2 = right spot, 1 = in it somewhere, 0 = nope
function awScore(guess, answer) {
  const res = new Array(answer.length).fill(0), left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res[i] = 2;
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < answer.length; i++) {
    if (res[i] === 2) continue;
    if (left[guess[i]]) { res[i] = 1; left[guess[i]]--; }
  }
  return res;
}

function awStats() { return a5Get(AW_KEY, { day: -1, guesses: [], done: false, won: false, streak: 0, best: 0, lastWin: -9, played: 0, wins: 0 }); }

function awOpen() { a5Open(() => awStart(A5.aw && A5.aw.mode === 'mine' && a5LoggedIn() ? 'mine' : 'daily')); }

function awStart(mode) {
  qStopAudio(); qClearTimers();
  if (mode === 'mine') {
    const pool = a5Artists().map(a => ({ name: a.name, w: a5Letters(a.name), a })).filter(x => x.w.length >= 3 && x.w.length <= 12);
    if (!pool.length) { mode = 'daily'; }
    else {
      const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 40))];
      A5.aw = { mode, name: pick.name, answer: pick.w, gaps: awGaps(pick.name), guesses: [], cur: '', done: false, won: false, img: a5ArtistImg(pick.a) };
      awRender();
      return;
    }
  }
  const day = awDayNum(), name = awDaily(day), st = awStats();
  const today = st.day === day;
  A5.aw = { mode: 'daily', day, name, answer: a5Letters(name), gaps: awGaps(name), guesses: today ? st.guesses.slice() : [], cur: '', done: today && st.done, won: today && st.won, img: '' };
  awRender();
}

// where the spaces were, so the board can show the word breaks
function awGaps(name) {
  const gaps = new Set();
  let n = 0;
  for (const w of String(name).split(/\s+/)) { n += a5Letters(w).length; gaps.add(n); }
  return gaps;
}

function awBoard() {
  const W = A5.aw, len = W.answer.length, rows = [];
  for (let r = 0; r < AW_TRIES; r++) {
    const g = W.guesses[r], live = r === W.guesses.length && !W.done;
    const sc = g ? awScore(g, W.answer) : null;
    let row = '';
    for (let i = 0; i < len; i++) {
      const ch = g ? g[i] : live ? (W.cur[i] || '') : '';
      const cls = sc ? ['no', 'in', 'yes'][sc[i]] : ch ? 'typed' : '';
      row += '<div class="aw-tile ' + cls + (W.gaps.has(i) && i ? ' gap' : '') + '">' + ch + '</div>';
    }
    rows.push('<div class="aw-row" style="--n:' + len + '">' + row + '</div>');
  }
  return rows.join('');
}

function awKeys() {
  const W = A5.aw, best = {};
  for (const g of W.guesses) awScore(g, W.answer).forEach((s, i) => { best[g[i]] = Math.max(best[g[i]] ?? -1, s); });
  const key = k => '<button class="aw-key ' + (best[k] === 2 ? 'yes' : best[k] === 1 ? 'in' : best[k] === 0 ? 'no' : '') + '" onclick="awType(\'' + k + '\')">' + k + '</button>';
  return ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((r, i) =>
    '<div class="aw-krow">' + (i === 2 ? '<button class="aw-key wide" onclick="awType(\'ENTER\')">enter</button>' : '') +
    r.split('').map(key).join('') + (i === 2 ? '<button class="aw-key wide" onclick="awType(\'BACK\')">⌫</button>' : '') + '</div>'
  ).join('');
}

function awRender() {
  Q.screen = 'aw';
  const W = A5.aw, st = awStats();
  const tabs = '<div class="tabs"><button class="' + (W.mode === 'daily' ? 'active' : '') + '" onclick="awStart(\'daily\')">daily</button>' +
    (a5LoggedIn() ? '<button class="' + (W.mode === 'mine' ? 'active' : '') + '" onclick="awStart(\'mine\')">your artists</button>' : '') + '</div>';
  const end = W.done
    ? '<div class="aw-end fade-up">' +
        (W.img ? '<img src="' + W.img + '" alt="">' : '') +
        '<div class="verdict ' + (W.won ? 'good' : 'bad') + '">' + (W.won ? W.guesses.length + '/' + AW_TRIES + ' 🖤' : 'X/' + AW_TRIES + ' 💔') + '</div>' +
        '<div class="aw-name">' + esc(W.name) + '</div>' +
        (W.mode === 'daily' ? '<div class="q-note">streak ' + st.streak + ' &middot; best ' + st.best + ' &middot; ' + st.wins + '/' + st.played + '</div>' : '') +
        '<div class="q-actions">' +
          (W.mode === 'daily' ? '<button class="q-btn" onclick="awShare(this)">copy result</button>' : '') +
          (a5LoggedIn() ? '<button class="q-btn ghost" onclick="awStart(\'mine\')">another one</button>' : '') +
        '</div>' +
      '</div>'
    : '';
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🔠 artist wordle', W.mode === 'daily' ? '#' + (W.day + 1) : '') +
    tabs +
    '<div class="aw-board">' + awBoard() + '</div>' +
    '<div class="aw-msg" id="aw-msg"></div>' +
    end +
    (W.done ? '' : '<div class="aw-kb">' + awKeys() + '</div>')
  );
}

function awMsg(t) {
  const el = document.getElementById('aw-msg');
  if (!el) return;
  el.textContent = t;
  clearTimeout(A5.awMsgT);
  A5.awMsgT = setTimeout(() => { if (el) el.textContent = ''; }, 1600);
}

function awType(k) {
  const W = A5.aw;
  if (!W || W.done) return;
  if (k === 'BACK') W.cur = W.cur.slice(0, -1);
  else if (k === 'ENTER') return awEnter();
  else if (/^[A-Z]$/.test(k) && W.cur.length < W.answer.length) W.cur += k;
  awRender();
}

function awEnter() {
  const W = A5.aw;
  if (W.cur.length < W.answer.length) { awMsg(W.answer.length + ' letters'); return; }
  W.guesses.push(W.cur);
  W.cur = '';
  if (W.guesses[W.guesses.length - 1] === W.answer) { W.done = true; W.won = true; }
  else if (W.guesses.length >= AW_TRIES) { W.done = true; W.won = false; }
  if (W.mode === 'daily') awSave();
  awRender();
  if (W.done && W.won && typeof confetti === 'function') confetti({ particleCount: 90, spread: 70, colors: ['#FF1493', '#FF69B4', '#000000'] });
}

function awSave() {
  const W = A5.aw, st = awStats();
  const first = st.day !== W.day;
  st.day = W.day; st.guesses = W.guesses.slice(); st.done = W.done; st.won = W.won;
  if (W.done && (first || !st.counted)) {
    st.counted = true;
    st.played++;
    if (W.won) { st.wins++; st.streak = st.lastWin === W.day - 1 ? st.streak + 1 : 1; st.lastWin = W.day; st.best = Math.max(st.best, st.streak); }
    else st.streak = 0;
  } else if (first) st.counted = false;
  a5Put(AW_KEY, st);
}

function awShareText() {
  const W = A5.aw;
  const grid = W.guesses.map(g => awScore(g, W.answer).map(s => ['🖤', '💛', '💗'][s]).join('')).join('\n');
  return 'artist wordle #' + (W.day + 1) + ' ' + (W.won ? W.guesses.length : 'X') + '/' + AW_TRIES + '\n' + grid;
}
function awShare(btn) { xCopy(btn, awShareText()); }

// ======================== MYSTERY ARTIST ========================

const MA_ROUNDS = 5;
const MA_ITUNES = 'https://itunes.apple.com/search';

async function maApple(q) {
  try {
    const r = await fetch(MA_ITUNES + '?' + q);
    if (!r.ok) return [];
    return (await r.json()).results || [];
  } catch { return []; }
}

// clues go hardest -> easiest. every one that exists gets used
async function maClues(a) {
  const want = qNorm(a.name);
  const same = r => qNorm(r.artistName || '') === want;
  const [albums, songs] = await Promise.all([
    maApple('term=' + encodeURIComponent(a.name) + '&entity=album&attribute=artistTerm&limit=50'),
    maApple('term=' + encodeURIComponent(a.name) + '&entity=song&attribute=artistTerm&limit=25'),
  ]);
  const alb = albums.filter(same).filter(x => x.releaseDate);
  const sng = songs.filter(same).filter(x => x.trackName && !qNorm(x.trackName).includes(want));
  const clues = [];
  const genre = (a.genres && a.genres.length ? a.genres.slice(0, 2).join(', ') : '') || (alb[0] && alb[0].primaryGenreName) || '';
  if (genre) clues.push({ k: 'genre', html: '<span class="lbl">genre</span><b>' + esc(genre.toLowerCase()) + '</b>' });
  if (alb.length) {
    const yr = Math.min(...alb.map(x => parseInt(x.releaseDate.slice(0, 4))).filter(Boolean));
    if (yr) clues.push({ k: 'year', html: '<span class="lbl">first release</span><b>' + yr + '</b>' });
  }
  const mine = a5TracksBy(a.name).filter(t => !qNorm(t.name).includes(want));
  const title = mine[0] ? qStrip(mine[0].name) : sng[0] ? qStrip(sng[0].trackName) : '';
  if (title) clues.push({ k: 'song', html: '<span class="lbl">a song</span><b class="ma-mask">' + esc(maMaskSong(title)) + '</b>' });
  const covers = alb.filter(x => x.artworkUrl100);
  const cover = covers.length ? covers[Math.floor(Math.random() * covers.length)].artworkUrl100.replace('100x100', '400x400') : a5ArtistImg(a);
  if (cover) clues.push({ k: 'cover', html: '<span class="lbl">' + (covers.length ? 'a cover' : 'a photo') + '</span><img class="ma-blur" src="' + cover + '" alt="">' });
  const clipSrc = sng.find(x => x.previewUrl);
  let clip = clipSrc ? clipSrc.previewUrl : null;
  if (!clip && mine[0]) clip = await qFindPreview(mine[0]);
  if (clip) clues.push({ k: 'clip', url: clip, html: '<span class="lbl">a clip</span><button class="q-btn ghost" onclick="maPlay()">▶ play</button>' });
  clues.push({ k: 'letters', html: '<span class="lbl">their name</span><b class="ma-mask">' + esc(maMaskName(a.name)) + '</b>' });
  return { name: a.name, img: a5ArtistImg(a), clues };
}

// first letter of every word stays, the rest become blanks
function maMaskSong(t) { return String(t).split(/(\s+)/).map(w => /\s/.test(w) ? w : w.replace(/[a-z0-9]/gi, (c, i) => i === 0 ? c : '_')).join(''); }
function maMaskName(n) { return String(n).replace(/[a-z0-9]/gi, (c, i, s) => (i === 0 || /\s/.test(s[i - 1])) ? c.toUpperCase() : '_'); }
function maMatches(guess, name) {
  const g = qNorm(guess).replace(/^the /, ''), n = qNorm(name).replace(/^the /, '');
  return !!g && (g === n || qMatches(guess, name) || g.replace(/ /g, '') === n.replace(/ /g, ''));
}
function maPoints(shown, total) { return Math.round((1000 / MA_ROUNDS) * (total - shown + 1) / total); }

function maOpen() { a5Open(maStart); }

async function maStart() {
  qStopAudio(); qClearTimers();
  Q.screen = 'ma';
  const all = a5Artists();
  if (all.length < MA_ROUNDS) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('🕵️ mystery artist', '') + qErrorBox(a5LoggedIn() ? 'need at least ' + MA_ROUNDS + ' top artists for this one' : 'log in with spotify for this one'));
    return;
  }
  const picks = qShuffle(all.slice(0, 50)).slice(0, MA_ROUNDS + 3);   // a few spares in case apple knows nothing about one
  A5.ma = { picks, i: 0, round: null, score: 0, results: [], loading: picks.map(a => maClues(a).catch(() => null)), used: 0 };
  qSet('<div class="q-loadwrap"><div class="spinner">🕵️</div><p>gathering clues...</p></div>');
  await maNextRound();
}

async function maNextRound() {
  const M = A5.ma;
  if (!M) return;
  while (M.used < M.loading.length) {
    const r = await M.loading[M.used++];
    if (A5.ma !== M) return;
    if (r && r.clues.length >= 4) { M.round = { ...r, shown: 1, done: false, won: false, wrong: [] }; maRender(); return; }
  }
  maResults();
}

function maRender() {
  Q.screen = 'ma';
  const M = A5.ma, R = M.round;
  const pts = maPoints(R.shown, R.clues.length);
  qSet(
    qTopBar('&larr; back', xBack()) +
    '<div class="q-hud"><span class="qn">artist ' + (M.results.length + 1) + ' of ' + MA_ROUNDS + '</span><span class="sc">' + M.score + ' pts</span></div>' +
    '<div class="ma-clues">' +
      R.clues.map((c, i) => '<div class="ma-clue ' + (i < R.shown || R.done ? 'on' : '') + '">' +
        (i < R.shown || R.done ? c.html : '<span class="lbl">clue ' + (i + 1) + '</span><b>?</b>') + '</div>').join('') +
    '</div>' +
    (R.done
      ? '<div class="q-reveal fade-up">' + (R.img ? '<img src="' + R.img + '" alt=""><br>' : '') +
          '<div class="verdict ' + (R.won ? 'good' : 'bad') + '">' + (R.won ? 'YES 🖤' : 'it was... 💔') + '</div>' +
          '<div class="song">' + esc(R.name) + '</div>' +
          '<div class="pts">+' + (R.won ? pts : 0) + ' points</div>' +
          '<div class="q-actions"><button class="q-btn" onclick="maNext()">' + (M.results.length >= MA_ROUNDS ? 'see my score →' : 'next artist →') + '</button></div></div>'
      : '<div class="q-typerow">' +
          '<input id="ma-input" class="q-input" placeholder="who is it" autocomplete="off" autocorrect="off" spellcheck="false">' +
          '<button class="q-btn" onclick="maGuess()">guess</button>' +
        '</div>' +
        (R.wrong.length ? '<div class="ma-wrong">' + R.wrong.map(w => '<s>' + esc(w) + '</s>').join(' ') + '</div>' : '') +
        '<div class="q-actions">' +
          (R.shown < R.clues.length ? '<button class="q-btn ghost" onclick="maMore()">next clue (' + maPoints(R.shown + 1, R.clues.length) + ' pts)</button>' : '') +
          '<button class="q-btn ghost" onclick="maGiveUp()">i give up</button>' +
        '</div>' +
        '<p class="q-note">worth ' + pts + ' pts</p>')
  );
  const inp = document.getElementById('ma-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') maGuess(); }); }
}

function maPlay() {
  const R = A5.ma && A5.ma.round; if (!R) return;
  const c = R.clues.find(x => x.k === 'clip');
  if (c) qPlayClip(c.url);
}
function maMore() {
  const R = A5.ma && A5.ma.round;
  if (!R || R.done) return;
  if (R.shown < R.clues.length) R.shown++;
  maRender();
}
function maGuess() {
  const R = A5.ma && A5.ma.round;
  if (!R || R.done) return;
  const inp = document.getElementById('ma-input');
  const g = inp ? inp.value.trim() : '';
  if (!g) return;
  if (maMatches(g, R.name)) return maEnd(true);
  R.wrong.push(g);
  if (R.shown < R.clues.length) R.shown++;
  else return maEnd(false);
  maRender();
}
function maGiveUp() { const R = A5.ma && A5.ma.round; if (R && !R.done) maEnd(false); }
function maEnd(won) {
  const M = A5.ma, R = M.round;
  R.done = true; R.won = won;
  const pts = won ? maPoints(R.shown, R.clues.length) : 0;
  M.score += pts;
  M.results.push({ name: R.name, img: R.img, pts, won, clues: R.shown });
  if (won && typeof confetti === 'function') confetti({ particleCount: 60, spread: 60, colors: ['#FF1493', '#FF69B4'] });
  maRender();
}
function maNext() {
  qStopAudio();
  const M = A5.ma;
  if (M.results.length >= MA_ROUNDS) return maResults();
  qSet('<div class="q-loadwrap"><div class="spinner">🕵️</div><p>gathering clues...</p></div>');
  maNextRound();
}
function maResults() {
  const M = A5.ma;
  Q.screen = 'maresults';
  qStopAudio();
  const best = Math.max(a5Get('sparkle_ma_best', 0), M.score);
  a5Put('sparkle_ma_best', best);
  qSet(
    qTopBar('&larr; back', xBack()) +
    '<div class="q-final fade-up"><div style="font-size:2.6rem;">🕵️</div><div class="num">' + M.score + '</div>' +
      '<div class="outof">out of 1000 &middot; ' + M.results.filter(r => r.won).length + '/' + M.results.length + ' &middot; best ' + best + '</div></div>' +
    '<div class="q-recap">' + M.results.map((r, i) =>
      '<div class="q-recap-row"><span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' +
      (r.img ? '<img src="' + r.img + '" alt="">' : '') +
      '<span style="flex:1;text-align:left;">' + esc(r.name) + '</span>' +
      '<span>' + (r.won ? r.clues + ' clue' + (r.clues === 1 ? '' : 's') + ' · +' + r.pts : '💔') + '</span></div>').join('') + '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="maStart()">play again</button><button class="q-btn ghost" onclick="' + xBack() + '">back</button></div>'
  );
}

// ======================== TAP THE BEAT ========================
// the real tempo is found in the browser: spectral flux (how much new sound
// shows up each moment) -> autocorrelation -> the beat period that repeats best

const TB_SR = 11025;
const TB_TIME = 25;
const tbCache = new Map();

function a5FFT(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// mono samples -> { bpm, conf } or null
function tbTempo(x, sr) {
  const N = 1024, H = 128, fps = sr / H;
  const nF = Math.floor((x.length - N) / H);
  if (nF < fps * 8) return null;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const re = new Float32Array(N), im = new Float32Array(N), bins = N >> 1;
  const prev = new Float32Array(bins);
  const flux = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    const s = f * H;
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
    a5FFT(re, im);
    let sum = 0;
    for (let k = 1; k < bins; k++) {
      const m = Math.log(1 + 1000 * Math.hypot(re[k], im[k]));
      const d = m - prev[k];
      if (d > 0 && f) sum += d;
      prev[k] = m;
    }
    flux[f] = sum;
  }
  // take away the slow loudness swell so only the hits are left
  const w = Math.round(fps * 0.25), pre = new Float64Array(nF + 1);
  for (let i = 0; i < nF; i++) pre[i + 1] = pre[i] + flux[i];
  const o = new Float32Array(nF);
  for (let i = 0; i < nF; i++) {
    const a = Math.max(0, i - w), b = Math.min(nF, i + w + 1);
    o[i] = Math.max(0, flux[i] - (pre[b] - pre[a]) / (b - a));
  }
  const ac = lag => { let s = 0; for (let i = 0; i + lag < nF; i++) s += o[i] * o[i + lag]; return s / (nF - lag); };
  const minL = Math.floor(60 * fps / 200), maxL = Math.ceil(60 * fps / 50);
  const A = new Float32Array(maxL * 2 + 3);
  for (let L = 1; L < A.length; L++) A[L] = ac(L);
  // a real beat also lines up at 2x its period; lean toward 70-170 bpm like people tap
  let best = -1, bestV = -Infinity, mean = 0;
  for (let L = minL; L <= maxL; L++) mean += A[L];
  mean /= (maxL - minL + 1);
  const score = new Float32Array(maxL + 1);
  for (let L = minL; L <= maxL; L++) {
    const bpm = 60 * fps / L;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.75, 2));
    const harm = A[L] + 0.5 * A[2 * L];
    score[L] = harm * prior;
    if (score[L] > bestV) { bestV = score[L]; best = L; }
  }
  if (best < 0 || !mean) return null;
  const a = A[best - 1], b = A[best], c = A[best + 1], den = a - 2 * b + c;
  const L = best + (den ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0);
  // a rival period that isn't half/double of the winner and nearly as strong = no clear beat
  let rival = 0;
  for (let k = minL + 1; k < maxL; k++) {
    if (!(A[k] > A[k - 1] && A[k] >= A[k + 1])) continue;
    const r = k / best;
    if ([0.5, 1, 2].some(m => Math.abs(r / m - 1) < 0.06)) continue;
    rival = Math.max(rival, score[k]);
  }
  return { bpm: 60 * fps / L, conf: A[best] / mean, clear: rival ? bestV / rival : 9 };
}

// how close a tapped bpm is, letting half-time / double-time count
function tbOff(tapped, real) {
  let bestK = 1, best = Infinity;
  for (const k of [0.5, 1, 2]) { const e = Math.abs(tapped - real * k) / (real * k); if (e < best) { best = e; bestK = k; } }
  return { err: best, target: real * bestK };
}
// taps (ms timestamps) -> { bpm, steady 0..1 } or null
function tbFromTaps(taps) {
  if (taps.length < 4) return null;
  const iv = [];
  for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
  const sorted = iv.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1];
  const keep = iv.filter(v => v > med * 0.6 && v < med * 1.6);   // a missed or doubled tap shouldn't wreck it
  const mean = keep.reduce((s, v) => s + v, 0) / keep.length;
  const sd = Math.sqrt(keep.reduce((s, v) => s + (v - mean) * (v - mean), 0) / keep.length);
  return { bpm: 60000 / mean, steady: Math.max(0, 1 - (sd / mean) / 0.2) };
}
function tbPoints(perQ, tapped, steady, real) {
  const { err } = tbOff(tapped, real);
  const close = Math.max(0, 1 - err / 0.12);
  return perQ * (0.75 * close + 0.25 * steady * (close > 0 ? 1 : 0));
}

function tbPrep(url) {
  if (tbCache.has(url)) return tbCache.get(url);
  const p = (async () => {
    if (!X.fxCtx) X.fxCtx = new (window.AudioContext || window.webkitAudioContext)();
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await xDecode(X.fxCtx, await res.arrayBuffer());
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(1, Math.ceil(buf.duration * TB_SR), TB_SR);
    const src = off.createBufferSource();
    src.buffer = buf; src.connect(off.destination); src.start(0);
    const mono = await off.startRendering();
    return tbTempo(mono.getChannelData(0), TB_SR);
  })().catch(() => null);
  tbCache.set(url, p);
  return p;
}

async function tbBuild(pool, onProgress) {
  if (!xFxOk()) return [];
  const ordered = xOrdered(pool).filter(t => !qIsAlt(t.name));
  const out = [], seen = new Set();
  let i = 0, looked = 0;
  while (out.length < Q.len && i < ordered.length && looked < 40) {
    const batch = [];
    while (batch.length < 3 && i < ordered.length) {
      const t = ordered[i++], k = qNorm(qStrip(t.name));
      if (seen.has(k)) continue;
      seen.add(k); batch.push(t);
    }
    if (!batch.length) break;
    looked += batch.length;
    const got = await Promise.all(batch.map(async t => {
      const url = await qFindPreview(t);
      return { t, url, r: url ? await tbPrep(url) : null };
    }));
    for (const g of got) if (g.r && g.r.conf >= 2 && g.r.clear >= 1.2 && out.length < Q.len) out.push({ track: g.t, preview: g.url, choices: null, bpm: g.r.bpm });
    onProgress(out.length);
  }
  Q.skipped = 0;
  return out;
}

function tbRender() {
  Q.screen = 'play'; Q.locked = false;
  qClearTimers();
  const q = Q.questions[Q.index];
  A5.tb = { taps: [] };
  Q.duration = TB_TIME; Q.deadline = Date.now() + TB_TIME * 1000;
  qSet(
    mHud('song ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    mPlayer(esc(qStrip(q.track.name)) + ' &middot; ' + esc(qArtistNames(q.track))) +
    '<button class="tb-pad" id="tb-pad"><span class="tb-bpm" id="tb-bpm">tap</span><span class="tb-n" id="tb-n"></span></button>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="tbLock()">lock it in</button>' +
      '<button class="q-btn ghost" onclick="tbReset()">start over</button>' +
      '<button class="q-btn ghost" id="q-giveup" onclick="tbGiveUp()">i give up</button>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  const pad = document.getElementById('tb-pad');
  if (pad) pad.addEventListener('pointerdown', e => { e.preventDefault(); tbTap(); });
  qPlayClip(q.preview);
  Q.tick = setInterval(() => mTick(() => tbLock(true)), 100);
}

function tbTap() {
  if (Q.locked || Q.game !== 'tap' || Q.screen !== 'play') return;
  const T = A5.tb, now = performance.now();
  if (T.taps.length && now - T.taps[T.taps.length - 1] > 2500) T.taps = [];   // a long pause = starting fresh
  T.taps.push(now);
  if (T.taps.length > 40) T.taps.shift();
  const r = tbFromTaps(T.taps);
  const b = document.getElementById('tb-bpm'), n = document.getElementById('tb-n'), pad = document.getElementById('tb-pad');
  if (b) b.textContent = r ? Math.round(r.bpm) + ' bpm' : '...';
  if (n) n.textContent = T.taps.length + ' taps';
  if (pad) { pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit'); }
}
function tbReset() {
  A5.tb.taps = [];
  const b = document.getElementById('tb-bpm'), n = document.getElementById('tb-n');
  if (b) b.textContent = 'tap'; if (n) n.textContent = '';
}

function tbLock(timedOut) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const r = tbFromTaps(A5.tb.taps);
  if (!r) {
    if (timedOut !== true) { const n = document.getElementById('tb-n'); if (n) n.textContent = 'tap at least 4 times'; return; }
    q.detail = 'the song: ' + Math.round(q.bpm) + ' bpm';
    mLockChoices(-1, () => false);
    qFinishQuestion(false, null, 'timeout');
    return;
  }
  const { err, target } = tbOff(r.bpm, q.bpm);
  q.detail = 'you: ' + Math.round(r.bpm) + ' bpm · the song: ' + Math.round(target) + ' bpm · ' + Math.round(r.steady * 100) + '% steady';
  const pad = document.getElementById('tb-pad'); if (pad) pad.disabled = true;
  mLockChoices(-1, () => false);
  qFinishQuestion(err <= 0.05, Math.round(r.bpm) + ' bpm', null, tbPoints(Q.perQ, r.bpm, r.steady, q.bpm));
}
function tbGiveUp() {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  q.detail = 'the song: ' + Math.round(q.bpm) + ' bpm';
  mLockChoices(-1, () => false);
  qFinishQuestion(false, null, 'gaveup');
}

// ======================== SLOT MACHINE ========================

const SM_KEY = 'sparkle_sm';
const SM_COST = 10;
const SM_H = 96;   // px per reel cell, matches arcade5.css
const SM_PAY = { jackpot: 300, three: 100, pair: 15 };

function smState() { return a5Get(SM_KEY, { coins: 100, best: 0, pulls: 0, jackpots: 0 }); }

function smSymbols() {
  return a5Artists().slice(0, 6).map((a, i) => ({ name: a.name, img: a5ArtistImg(a), w: i === 0 ? 1 : 2 }));
}
function smRoll(syms, rnd) {
  rnd = rnd || Math.random;
  const tot = syms.reduce((s, x) => s + x.w, 0);
  let r = rnd() * tot;
  for (let i = 0; i < syms.length; i++) { r -= syms[i].w; if (r < 0) return i; }
  return syms.length - 1;
}
// three symbol indexes -> { kind, win, who }
function smJudge(res) {
  const [a, b, c] = res;
  if (a === b && b === c) return a === 0 ? { kind: 'jackpot', win: SM_PAY.jackpot, who: a } : { kind: 'three', win: SM_PAY.three, who: a };
  if (a === b || a === c) return { kind: 'pair', win: SM_PAY.pair, who: a };
  if (b === c) return { kind: 'pair', win: SM_PAY.pair, who: b };
  return { kind: 'none', win: 0, who: -1 };
}

function smOpen() { a5Open(smScreen); }

function smCell(s) {
  return '<div class="sm-cell">' + (s.img ? '<img src="' + s.img + '" alt="">' : '<span class="sm-ph">🎵</span>') + '<span class="sm-nm">' + esc(s.name) + '</span></div>';
}

function smScreen() {
  Q.screen = 'slots';
  qStopAudio(); qClearTimers();
  const syms = smSymbols();
  if (syms.length < 3) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('🎰 slot machine', '') + qErrorBox(a5LoggedIn() ? 'need a few more top artists first' : 'log in with spotify for this one'));
    return;
  }
  A5.sm = { syms, spinning: false, last: A5.sm && A5.sm.last || [0, 1, 2].map(i => i % syms.length) };
  const st = smState();
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🎰 slot machine', '') +
    '<div class="sm-top"><span>🪙 <b id="sm-coins">' + st.coins + '</b></span><span>best win <b id="sm-best">' + st.best + '</b></span><span><b id="sm-pulls">' + st.pulls + '</b> pulls</span></div>' +
    '<div class="sm-machine">' +
      '<div class="sm-reels">' + [0, 1, 2].map(r => '<div class="sm-reel"><div class="sm-strip" id="sm-strip' + r + '">' + smCell(syms[A5.sm.last[r]]) + '</div></div>').join('') + '</div>' +
      '<div class="sm-lever" id="sm-lever" onclick="smPull()"><i></i></div>' +
    '</div>' +
    '<div class="sm-out" id="sm-out"></div>' +
    '<div class="q-actions">' +
      (st.coins < SM_COST ? '<button class="q-btn" onclick="smRefill()">refill +100 🪙</button>'
        : '<button class="q-btn" id="sm-pull" onclick="smPull()">pull (' + SM_COST + ' 🪙)</button>') +
    '</div>' +
    '<div class="sm-pay">' +
      '<div>' + smCell(syms[0]) + '<b>×3 = ' + SM_PAY.jackpot + '</b></div>' +
      '<div><span class="sm-any">any ×3</span><b>' + SM_PAY.three + '</b></div>' +
      '<div><span class="sm-any">any ×2</span><b>' + SM_PAY.pair + '</b></div>' +
    '</div>'
  );
}

function smRefill() { const st = smState(); st.coins += 100; a5Put(SM_KEY, st); smScreen(); }

function smPull() {
  const S = A5.sm;
  if (!S || S.spinning) return;
  const st = smState();
  if (st.coins < SM_COST) return;
  st.coins -= SM_COST; st.pulls++;
  a5Put(SM_KEY, st);
  S.spinning = true;
  qStopAudio();
  const c = document.getElementById('sm-coins'); if (c) c.textContent = st.coins;
  const lever = document.getElementById('sm-lever');
  if (lever) { lever.classList.add('pulled'); setTimeout(() => lever.classList.remove('pulled'), 450); }
  const btn = document.getElementById('sm-pull'); if (btn) btn.disabled = true;
  const out = document.getElementById('sm-out'); if (out) out.innerHTML = '';
  const res = [0, 1, 2].map(() => smRoll(S.syms));
  const durs = [1100, 1600, 2100];
  res.forEach((r, k) => {
    const strip = document.getElementById('sm-strip' + k);
    if (!strip) return;
    const cells = [S.last[k]];
    for (let i = 0; i < 16 + k * 5; i++) cells.push(Math.floor(Math.random() * S.syms.length));
    cells.push(r);
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = cells.map(i => smCell(S.syms[i])).join('');
    void strip.offsetHeight;
    strip.style.transition = 'transform ' + durs[k] + 'ms cubic-bezier(.15,.7,.25,1.04)';
    strip.style.transform = 'translateY(-' + ((cells.length - 1) * SM_H) + 'px)';
  });
  S.last = res;
  setTimeout(() => smLanded(res), durs[2] + 80);
}

async function smLanded(res) {
  const S = A5.sm;
  if (!S || Q.screen !== 'slots') return;
  S.spinning = false;
  const j = smJudge(res), st = smState();
  st.coins += j.win;
  if (j.win > st.best) st.best = j.win;
  if (j.kind === 'jackpot') st.jackpots = (st.jackpots || 0) + 1;
  a5Put(SM_KEY, st);
  const label = { jackpot: 'JACKPOT', three: 'three in a row', pair: 'a pair', none: 'nothing' }[j.kind];
  const out = document.getElementById('sm-out');
  if (out) out.innerHTML = '<div class="sm-res ' + j.kind + ' fade-up">' + label + (j.win ? ' &middot; +' + j.win + ' 🪙' : '') + '</div><div id="sm-now"></div>';
  if (j.kind === 'jackpot' || j.kind === 'three') { if (typeof confetti === 'function') confetti({ particleCount: j.kind === 'jackpot' ? 200 : 90, spread: 90, colors: ['#FF1493', '#FF69B4', '#FFD700'] }); }
  const c = document.getElementById('sm-coins'); if (c) c.textContent = st.coins;
  const bw = document.getElementById('sm-best'); if (bw) bw.textContent = st.best;
  const pl = document.getElementById('sm-pulls'); if (pl) pl.textContent = st.pulls;
  const btn = document.getElementById('sm-pull');
  if (btn) btn.disabled = false;
  if (st.coins < SM_COST) smScreen();
  // a win plays one of that artist's songs
  if (j.who >= 0) {
    const songs = qShuffle(a5TracksBy(S.syms[j.who].name));
    for (const t of songs.slice(0, 3)) {
      const url = await qFindPreview(t);
      if (!url || Q.screen !== 'slots' || A5.sm !== S || S.spinning) continue;
      qPlayClip(url);
      const now = document.getElementById('sm-now');
      if (now) now.innerHTML = '<div class="q-note">▶ ' + esc(qStrip(t.name)) + ' &middot; <a href="#" onclick="qStopAudio();this.parentNode.remove();return false;">stop</a></div>';
      break;
    }
  }
}

// ======================== TYPING RACE ========================

const TY_TIME = 60;
const TY_KEY = 'sparkle_ty_best';

// what you type: lowercase, straight quotes, no punctuation besides apostrophes
function tyClean(s) {
  return String(s || '').toLowerCase().replace(/[‘’ʼ`´]/g, '\'').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
// two lyric lines in a row that make a nice 25-140 char sprint
function tyPick(lyrics) {
  const lines = String(lyrics || '').split('\n').map(s => s.trim());
  const ok = l => l && !/^\[/.test(l) && !/^\(.*\)$/.test(l) && /[a-z]/i.test(l);
  const cands = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!ok(lines[i]) || !ok(lines[i + 1])) continue;
    const t = tyClean(lines[i] + ' ' + lines[i + 1]);
    if (t.length >= 25 && t.length <= 140 && t.split(' ').length >= 6) cands.push(t);
  }
  if (!cands.length) return null;
  return cands[Math.floor(Math.random() * cands.length)];
}
// typed vs target -> { correct, acc, wpm }
function tyStats(typed, target, ms) {
  typed = tyClean(typed).slice(0, target.length);
  let correct = 0;
  for (let i = 0; i < target.length; i++) if (typed[i] === target[i]) correct++;
  const acc = correct / target.length;
  const wpm = ms > 0 ? (correct / 5) / (ms / 60000) : 0;
  return { correct, acc, wpm };
}
function tyPoints(perQ, acc, wpm) { return perQ * acc * acc * Math.min(1, 0.25 + wpm / 80); }

async function tyBuild(pool, onProgress) {
  const ordered = xOrdered(pool).filter(t => !qIsAlt(t.name));
  const out = [], seen = new Set();
  let i = 0, looked = 0;
  while (out.length < Q.len && i < ordered.length && looked < 60) {
    const batch = [];
    while (batch.length < 3 && i < ordered.length) {
      const t = ordered[i++], k = qNorm(qStrip(t.name));
      if (seen.has(k)) continue;
      seen.add(k); batch.push(t);
    }
    if (!batch.length) break;
    looked += batch.length;
    const got = await Promise.all(batch.map(async t => {
      const [ly, url] = await Promise.all([xLyricsFor(t), qFindPreview(t).catch(() => null)]);
      return { t, text: ly ? tyPick(ly) : null, url };
    }));
    for (const g of got) if (g.text && out.length < Q.len) out.push({ track: g.t, preview: g.url, choices: null, text: g.text });
    onProgress(out.length);
  }
  Q.skipped = 0;
  return out;
}

function tyRender() {
  Q.screen = 'play'; Q.locked = false;
  qClearTimers();
  const q = Q.questions[Q.index];
  A5.ty = { start: 0 };
  Q.duration = TY_TIME; Q.deadline = Date.now() + TY_TIME * 1000;
  qSet(
    mHud('song ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="ty-song">' + (qArt(q.track) ? '<img src="' + qArt(q.track) + '" alt="">' : '') +
      '<div><div class="nm">' + esc(qStrip(q.track.name)) + '</div><div class="ar">' + esc(qArtistNames(q.track)) + '</div></div>' +
      (q.preview ? '<button class="q-replay" onclick="qReplay()">↻</button>' : '') + '</div>' +
    '<div class="ty-target" id="ty-target">' + tyMarkup('', q.text) + '</div>' +
    '<input id="ty-input" class="q-input ty-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
    '<div class="ty-live" id="ty-live"></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="tyLock()">done</button><button class="q-btn ghost" id="q-giveup" onclick="tyGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );
  const inp = document.getElementById('ty-input');
  if (inp) {
    inp.focus();
    inp.addEventListener('paste', e => e.preventDefault());
    inp.addEventListener('input', () => tyInput(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') tyLock(); });
  }
  if (q.preview) qPlayClip(q.preview);
  Q.tick = setInterval(() => mTick(() => tyLock(true)), 100);
}

function tyMarkup(typed, target) {
  typed = tyClean(typed.replace(/\s+$/, ' x')).replace(/ x$/, ' ');   // keep a trailing space so the caret moves on
  let h = '';
  for (let i = 0; i < target.length; i++) {
    const ch = target[i] === ' ' ? '&nbsp;' : esc(target[i]);
    const cls = i < typed.length ? (typed[i] === target[i] ? 'ok' : 'bad') : i === typed.length ? 'cur' : '';
    h += '<span class="' + cls + '">' + ch + '</span>';
  }
  return h;
}

function tyInput(v) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  if (!A5.ty.start && v) A5.ty.start = performance.now();
  const box = document.getElementById('ty-target');
  if (box) box.innerHTML = tyMarkup(v, q.text);
  const s = tyStats(v, q.text, performance.now() - A5.ty.start);
  const live = document.getElementById('ty-live');
  const done = Math.min(tyClean(v).length, q.text.length);
  if (live && A5.ty.start && done) live.textContent = Math.round(s.wpm) + ' wpm · ' + Math.round(100 * s.correct / done) + '%';
  if (tyClean(v).length >= q.text.length) tyLock();
}

function tyLock(timedOut) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const inp = document.getElementById('ty-input');
  const v = inp ? inp.value : '';
  if (!tyClean(v)) {
    if (timedOut !== true) return;
    mLockChoices(-1, () => false);
    q.detail = '"' + q.text + '"';
    qFinishQuestion(false, null, 'timeout');
    return;
  }
  const s = tyStats(v, q.text, performance.now() - (A5.ty.start || performance.now()));
  const wpm = Math.round(s.wpm), acc = Math.round(s.acc * 100);
  const best = a5Get(TY_KEY, { wpm: 0 });
  const record = s.acc >= 0.9 && wpm > best.wpm;
  if (record) a5Put(TY_KEY, { wpm, acc, song: qStrip(q.track.name) });
  q.detail = wpm + ' wpm · ' + acc + '% accurate' + (record ? ' · new best' : ' · best ' + best.wpm);
  if (inp) inp.disabled = true;
  mLockChoices(-1, () => false);
  qFinishQuestion(s.acc >= 0.9, wpm + ' wpm', timedOut === true ? 'timeout' : null, tyPoints(Q.perQ, s.acc, s.wpm));
}
function tyGiveUp() {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  q.detail = '"' + q.text + '"';
  mLockChoices(-1, () => false);
  qFinishQuestion(false, null, 'gaveup');
}

// ======================== HOOKS ========================

(function a5InstallHooks() {
  const mine = g => g === 'tap' || g === 'typing';
  const prev = { mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion };
  mSingleStart = () => mine(Q.game) || prev.mSingleStart();
  mModeNote = () => Q.game === 'tap'
    ? '<p class="q-note" style="margin-top:20px;">' + Q.len + ' songs &middot; tap along &middot; half or double time counts &middot; ' + TB_TIME + ' seconds each</p>'
    : Q.game === 'typing'
    ? '<p class="q-note" style="margin-top:20px;">' + Q.len + ' songs &middot; two lines each &middot; ' + TY_TIME + ' seconds</p>'
    : prev.mModeNote();
  mWhyTooFew = () => Q.game === 'tap'
    ? (xFxOk() ? 'couldn\'t find a steady beat in enough of these clips. try another artist or playlist?' : 'this browser can\'t analyse audio. try chrome or brave?')
    : Q.game === 'typing'
    ? 'couldn\'t find lyrics for enough of these. lrclib doesn\'t have everything - try more well-known songs?'
    : prev.mWhyTooFew();
  mBuildsGame = g => mine(g) || prev.mBuildsGame(g);
  mBuildQuestions = (pool, onProgress) => Q.game === 'tap' ? tbBuild(pool, onProgress) : Q.game === 'typing' ? tyBuild(pool, onProgress) : prev.mBuildQuestions(pool, onProgress);
  mRenderQuestion = () => {
    if (Q.game === 'tap') { tbRender(); return true; }
    if (Q.game === 'typing') { tyRender(); return true; }
    return prev.mRenderQuestion();
  };
})();

function a5InstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (Q.screen === 'aw' && A5.aw && !A5.aw.done) {
      if (e.key === 'Enter') { e.preventDefault(); awType('ENTER'); }
      else if (e.key === 'Backspace') { e.preventDefault(); awType('BACK'); }
      else if (/^[a-z]$/i.test(e.key)) awType(e.key.toUpperCase());
    } else if (Q.game === 'tap' && Q.screen === 'play' && !Q.locked && (e.key === ' ' || e.key === 't')) {
      e.preventDefault(); tbTap();
    } else if (Q.screen === 'slots' && e.key === ' ') {
      e.preventDefault(); smPull();
    }
  });
}
a5InstallKeys();

X_HUB.games.push(
  () => { const st = awStats(); return xCard('🔠', 'artist wordle', 'guess the artist in 6. new one every day', 'awOpen()', st.day === awDayNum() && st.done ? 'done' : (st.streak ? '🔥' + st.streak : '')); },
  () => xCard('🕵️', 'mystery artist', 'one clue at a time. fewer clues, more points', 'maOpen()'),
  () => xCard('🥁', 'tap the beat', GAMES.tap.sub, 'gPick(\'tap\')'),
  () => xCard('🎰', 'slot machine', 'your top artists on the reels. 3 in a row pays', 'smOpen()'),
  () => xCard('⌨️', 'typing race', GAMES.typing.sub, 'gPick(\'typing\')')
);

Object.assign(window, {
  mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion,
  awOpen, awStart, awType, awShare,
  maOpen, maStart, maPlay, maMore, maGuess, maGiveUp, maNext,
  tbLock, tbReset, tbGiveUp, tbTap,
  smOpen, smPull, smRefill,
  tyLock, tyGiveUp,
});
