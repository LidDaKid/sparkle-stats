// ============================================================
//  xXx SparkleStats xXx  -  extra4.js
//  top 8 (myspace-style), lyric card, magazine cover, sparklestats FM,
//  the sparkle awards. loads after casino3.js.
// ============================================================

const E4 = { t8Range: 'short_term', t8Sel: -1, ly: null, lyTheme: 'cover', mg: null, fm: null, sa: null };

function e4Need(title) {
  if (a5LoggedIn()) return true;
  qSet(qTopBar('&larr; back', xBack()) + qHeader(title, '') + qErrorBox('log in with spotify for this one'));
  return false;
}
function e4Tabs(cur, fn) {
  return '<div class="e4-tabs">' + Y_RANGES.map(r => '<button class="cz-pill' + (r[0] === cur ? ' on' : '') + '" onclick="' + fn + '(\'' + r[0] + '\')">' + r[1] + '</button>').join('') + '</div>';
}
function e4Name() { return (_data.user && _data.user.display_name) || 'you'; }
function e4Img(a) { return a5ArtistImg(a); }
function e4Year(t) { return parseInt(String((t.album && t.album.release_date) || '').slice(0, 4), 10) || 0; }
function e4Save(sel, name, btn) { if (typeof lSaveNode === 'function') lSaveNode(sel, name, btn, 2); }

// ======================== TOP 8 ========================

const T8_KEY = 'sparkle_top8';

function t8Order(range) {
  const arts = (_data.artists[range] || []).slice(0, 30);
  const saved = a5Get(T8_KEY, {})[range];
  const ids = Array.isArray(saved) ? saved.filter(id => arts.some(a => a.id === id)) : [];
  for (const a of arts) { if (ids.length >= 8) break; if (!ids.includes(a.id)) ids.push(a.id); }
  return ids.slice(0, 8).map(id => arts.find(a => a.id === id));
}
function t8Store(range, list) { const s = a5Get(T8_KEY, {}); s[range] = list.map(a => a.id); a5Put(T8_KEY, s); }

function t8Open() { a5Open(t8Screen); }
function t8Range(r) { E4.t8Range = r; E4.t8Sel = -1; t8Screen(); }

function t8Screen() {
  Q.screen = 'e4-t8';
  qStopAudio(); qClearTimers();
  if (!e4Need('top 8')) return;
  const range = E4.t8Range, list = t8Order(range);
  const bench = (_data.artists[range] || []).slice(0, 30).filter(a => !list.includes(a));
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('top 8', '') +
    e4Tabs(range, 't8Range') +
    '<div class="t8-box" id="t8-box">' +
      '<div class="t8-head">' + esc(e4Name()) + '\'s Friend Space</div>' +
      '<div class="t8-sub">' + esc(e4Name()) + ' has <b>' + (_data.artists[range] || []).length + '</b> friends.</div>' +
      '<div class="t8-grid">' + list.map((a, i) =>
        '<button class="t8-friend' + (E4.t8Sel === i ? ' sel' : '') + '" onclick="t8Tap(' + i + ')">' +
          '<span class="t8-nm">' + esc(a.name) + '</span>' +
          '<span class="t8-pic">' + (e4Img(a) ? '<img src="' + e4Img(a) + '" alt="">' : '') + '</span>' +
        '</button>').join('') + '</div>' +
      '<div class="t8-foot">View All of ' + esc(e4Name()) + '\'s Friends</div>' +
    '</div>' +
    (bench.length ? '<div class="g-hub-label">swap in</div><div class="t8-bench">' + bench.map(a =>
      '<button class="t8-b" onclick="t8Swap(\'' + esc(a.id) + '\')"' + (E4.t8Sel < 0 ? ' disabled' : '') + '>' + czFace({ img: e4Img(a) }) + '<span>' + esc(a.name) + '</span></button>').join('') + '</div>' : '') +
    '<div class="q-actions"><button class="q-btn" onclick="e4Save(\'#t8-box\', \'my-top-8\', this)">save image</button><button class="q-btn ghost" onclick="t8Reset()">reset</button></div>'
  );
}

// tap one friend then another to swap them, or tap one then someone from the bench
function t8Tap(i) {
  const range = E4.t8Range, list = t8Order(range);
  if (E4.t8Sel < 0) { E4.t8Sel = i; t8Screen(); return; }
  if (E4.t8Sel !== i) { const j = E4.t8Sel; [list[i], list[j]] = [list[j], list[i]]; t8Store(range, list); }
  E4.t8Sel = -1; t8Screen();
}
function t8Swap(id) {
  if (E4.t8Sel < 0) return;
  const range = E4.t8Range, list = t8Order(range), a = (_data.artists[range] || []).find(x => x.id === id);
  if (!a) return;
  list[E4.t8Sel] = a; t8Store(range, list);
  E4.t8Sel = -1; t8Screen();
}
function t8Reset() { const s = a5Get(T8_KEY, {}); delete s[E4.t8Range]; a5Put(T8_KEY, s); E4.t8Sel = -1; t8Screen(); }

// ======================== LYRIC CARD ========================

const LY_THEMES = ['cover', 'pink', 'black', 'white'];

function lyOpen() { a5Open(lyPickScreen); }

function lyPickScreen() {
  Q.screen = 'e4-ly';
  qStopAudio(); qClearTimers();
  if (!e4Need('lyric card')) return;
  const songs = qPoolFromTop().slice(0, 40);
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('lyric card', '') +
    '<div class="ly-songs">' + songs.map((t, i) => {
      const c = cz2Cover(t);
      return '<button class="ly-song" onclick="lyLoad(' + i + ')">' + (c ? '<img src="' + c + '" alt="">' : '') + '<span><b>' + esc(qStrip(t.name)) + '</b>' + esc(gPrimary(t)) + '</span></button>';
    }).join('') + '</div>'
  );
}

async function lyLoad(i) {
  const t = qPoolFromTop()[i]; if (!t) return;
  qSet(qTopBar('&larr; songs', 'lyPickScreen()') + qHeader('lyric card', '') + '<div class="cn-status">finding the lyrics...</div>');
  const lyrics = await xLyricsFor(t);
  if (Q.screen !== 'e4-ly') return;
  if (!lyrics) { qSet(qTopBar('&larr; songs', 'lyPickScreen()') + qHeader('lyric card', '') + qErrorBox('no lyrics for this one')); return; }
  const lines = lyrics.split('\n').map(s => s.trim()).filter(l => l && !/^\[.*\]$/.test(l));
  E4.ly = { t, lines, sel: [] };
  lyScreen();
}

function lyScreen() {
  const L = E4.ly, t = L.t, c = cz2Cover(t);
  qSet(
    qTopBar('&larr; songs', 'lyPickScreen()') + qHeader('lyric card', '') +
    '<div class="ly-wrap">' +
      '<div class="ly-card th-' + E4.lyTheme + '" id="ly-card">' +
        (E4.lyTheme === 'cover' && c ? '<img class="ly-bg" src="' + c + '" alt="">' : '') +
        '<div class="ly-lines" id="ly-lines">' + lyCardLines() + '</div>' +
        '<div class="ly-meta">' + (c ? '<img src="' + c + '" alt="">' : '') + '<span><b>' + esc(qStrip(t.name)) + '</b>' + esc(gPrimary(t)) + '</span></div>' +
      '</div>' +
      '<div class="e4-tabs">' + LY_THEMES.map(th => '<button class="cz-pill' + (th === E4.lyTheme ? ' on' : '') + '" onclick="lyTheme(\'' + th + '\')">' + th + '</button>').join('') + '</div>' +
      '<div class="q-actions"><button class="q-btn" onclick="e4Save(\'#ly-card\', \'lyric-card\', this)">save image</button></div>' +
    '</div>' +
    '<div class="ly-pick">' + L.lines.map((l, i) => '<button class="ly-line' + (L.sel.includes(i) ? ' on' : '') + '" onclick="lyTap(' + i + ')">' + esc(l) + '</button>').join('') + '</div>'
  );
}
function lyCardLines() {
  const L = E4.ly, sel = L.sel.slice().sort((a, b) => a - b);
  return sel.length ? sel.map(i => '<p>' + esc(L.lines[i]) + '</p>').join('') : '<p class="ly-ph">♪</p>';
}
function lyTap(i) {
  const L = E4.ly; if (!L) return;
  const at = L.sel.indexOf(i);
  if (at >= 0) L.sel.splice(at, 1); else if (L.sel.length < 5) L.sel.push(i);
  const box = czEl('ly-lines'); if (box) box.innerHTML = lyCardLines();
  document.querySelectorAll('.ly-line').forEach((b, k) => b.classList.toggle('on', L.sel.includes(k)));
}
function lyTheme(th) { E4.lyTheme = th; lyScreen(); }

// ======================== MAGAZINE COVER ========================

const MG_HEADS = [
  a => a + ': THE OBSESSION CONTINUES',
  a => 'WHY WE CAN\'T STOP PLAYING ' + a,
  a => a + ' TELLS ALL',
  a => 'INSIDE ' + a + '\'S WORLD',
];
const MG_SIDE = [
  d => d.n2 + ' &amp; ' + d.n3 + ': THE NEW POWER DUO?',
  d => 'IS ' + d.genre + ' TAKING OVER YOUR LIFE?',
  d => 'EXCLUSIVE: why "' + d.song + '" won\'t leave your head',
  d => d.count + ' SONGS ON REPEAT',
  d => 'THE ' + d.decade + ' REVIVAL IS HERE',
  d => 'QUIZ: are you a true ' + d.n1 + ' fan?',
  d => 'FREE POSTER: ' + d.n2 + ' inside!',
  d => d.newbie + ': your newest obsession',
  d => 'we ranked every ' + d.n1 + ' song',
  d => 'plus: ' + d.old + ' is back on your radar',
];
const MG_COLORS = [['#ff1493', '#FFD700'], ['#b266ff', '#ff69b4'], ['#00c2ff', '#ff1493'], ['#ff3355', '#fff']];

function mgOpen() { a5Open(() => { E4.mg = null; mgScreen(); }); }

function mgData() {
  const A = _data.artists, T = _data.tracks;
  const s = A.short_term || [], l = A.long_term || [];
  const tracks = qPoolFromTop();
  const years = tracks.map(e4Year).filter(Boolean);
  const avg = years.length ? years.reduce((x, y) => x + y, 0) / years.length : 2010;
  const newbie = s.find(a => !l.some(x => x.id === a.id)) || s[3] || s[0];
  const old = l.find(a => !s.some(x => x.id === a.id)) || l[2] || l[0];
  let genre = 'EMO';
  try { genre = String(analyzeGenres(A).topGenre || genre).toUpperCase(); } catch {}
  const r = {
    n1: (s[0] || l[0]).name, n2: (s[1] || l[1] || s[0]).name, n3: (s[2] || l[2] || s[0]).name,
    song: qStrip(((T.short_term || [])[0] || tracks[0] || { name: 'that song' }).name),
    count: (T.short_term || []).length || tracks.length, genre,
    decade: (Math.floor(avg / 10) * 10 >= 2000 ? String(Math.floor(avg / 10) * 10) : "'" + String(Math.floor(avg / 10) * 10).slice(2)) + 's',
    newbie: newbie ? newbie.name : '', old: old ? old.name : '',
  };
  Object.keys(r).forEach(k => { r[k] = esc(String(r[k])); });
  return r;
}

function mgRoll() {
  const s = _data.artists.short_term && _data.artists.short_term.length ? _data.artists.short_term : _data.artists.long_term;
  const star = s[Math.floor(Math.random() * Math.min(5, s.length))];
  // skip headlines that would come out blank or say "unknown"
  const d = mgData();
  const good = MG_SIDE.map((f, i) => i).filter(i => { const h = MG_SIDE[i](d); return h && !/unknown|mystery|: your newest|plus:  is/i.test(h) && !/^\s|\s\s/.test(h); });
  const sides = qShuffle(good).slice(0, 4);
  return { star, head: Math.floor(Math.random() * MG_HEADS.length), sides, col: Math.floor(Math.random() * MG_COLORS.length) };
}

function mgScreen() {
  Q.screen = 'e4-mg';
  qStopAudio(); qClearTimers();
  if (!e4Need('magazine cover')) return;
  if (!E4.mg) E4.mg = mgRoll();
  const M = E4.mg, d = mgData(), [c1, c2] = MG_COLORS[M.col];
  const now = new Date(), month = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
  const img = e4Img(M.star);
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('magazine cover', '') +
    '<div class="mg-cover" id="mg-cover" style="--c1:' + c1 + ';--c2:' + c2 + '">' +
      (img ? '<img class="mg-star" src="' + img + '" alt="">' : '') +
      '<div class="mg-mast">SPARKLE</div>' +
      '<div class="mg-issue">' + month + ' ' + now.getFullYear() + ' &middot; $3.99</div>' +
      '<div class="mg-burst">' + (Math.random() < 0.5 ? 'NEW!' : 'HOT!') + '</div>' +
      '<div class="mg-sides">' + M.sides.map((k, i) => '<div class="mg-side' + (i % 2 ? ' alt' : '') + '">' + MG_SIDE[k](d) + '</div>').join('') + '</div>' +
      '<div class="mg-head">' + esc(MG_HEADS[M.head](M.star.name.toUpperCase())) + '</div>' +
      '<div class="mg-bar"><span>' + esc(e4Name()) + '\'s edition</span><span class="mg-code">' + Array.from({ length: 26 }, () => '<i style="width:' + (1 + Math.floor(Math.random() * 3)) + 'px"></i>').join('') + '</span></div>' +
    '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="E4.mg=null;mgScreen()">new cover</button><button class="q-btn ghost" onclick="e4Save(\'#mg-cover\', \'sparkle-magazine\', this)">save image</button></div>'
  );
}

// ======================== SPARKLESTATS FM ========================

const FM_STATIONS = [
  { k: 'now', label: 'this month' },
  { k: 'six', label: '6 months' },
  { k: 'ever', label: 'all time' },
  { k: 'deep', label: 'deep cuts' },
  { k: 'old', label: 'throwbacks' },
  { k: 'mix', label: 'shuffle' },
];

function fmList(k) {
  const T = _data.tracks, all = qPoolFromTop();
  if (k === 'now') return (T.short_term || []).slice();
  if (k === 'six') return (T.medium_term || []).slice();
  if (k === 'ever') return (T.long_term || []).slice();
  if (k === 'deep') return all.slice(Math.floor(all.length / 2)).reverse();
  if (k === 'old') return all.filter(t => e4Year(t)).sort((a, b) => e4Year(a) - e4Year(b)).slice(0, 40);
  return qShuffle(all);
}

function fmOpen() { a5Open(() => fmScreen(E4.fm ? E4.fm.k : 'now')); }

function fmScreen(k) {
  Q.screen = 'e4-fm';
  qStopAudio(); qClearTimers();
  if (!e4Need('sparklestats fm')) return;
  const list = fmList(k).filter(Boolean);
  E4.fm = { k, list, i: -1, tok: 0, playing: false };
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('sparklestats fm', '') +
    '<div class="fm-dial">' + FM_STATIONS.map((s, n) => '<button class="fm-st' + (s.k === k ? ' on' : '') + '" onclick="fmScreen(\'' + s.k + '\')"><b>' + (88.1 + n * 3.4).toFixed(1) + '</b>' + s.label + '</button>').join('') + '</div>' +
    '<div class="fm-now" id="fm-now"><div class="fm-disc"><div class="hole"></div></div><div class="fm-info"><b>' + FM_STATIONS.find(s => s.k === k).label + '</b><span>' + list.length + ' songs</span></div></div>' +
    '<div class="fm-bar"><i id="fm-fill"></i></div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="fmStep(-1)">prev</button><button class="q-btn" id="fm-play" onclick="fmToggle()">play</button><button class="q-btn ghost" onclick="fmStep(1)">skip</button></div>' +
    '<div class="g-hub-label">up next</div><div class="fm-next" id="fm-next"></div>'
  );
  fmNextList();
}

function fmNextList() {
  const F = E4.fm, box = czEl('fm-next'); if (!F || !box) return;
  const up = [];
  for (let n = 1; n <= 6 && F.list.length; n++) up.push(F.list[(Math.max(F.i, -1) + n + F.list.length) % F.list.length]);
  box.innerHTML = up.map(t => { const c = cz2Cover(t); return '<div class="fm-row">' + (c ? '<img src="' + c + '" alt="">' : '') + '<span><b>' + esc(qStrip(t.name)) + '</b>' + esc(gPrimary(t)) + '</span></div>'; }).join('');
}

function fmToggle() {
  const F = E4.fm; if (!F) return;
  if (F.playing) { F.playing = false; F.tok++; qStopAudio(); const b = czEl('fm-play'); if (b) b.textContent = 'play'; const d = document.querySelector('.fm-disc'); if (d) d.classList.remove('spin'); return; }
  F.playing = true;
  const b = czEl('fm-play'); if (b) b.textContent = 'pause';
  fmGo(F.i < 0 ? 0 : F.i, 1);
}
function fmStep(dir) {
  const F = E4.fm; if (!F || !F.list.length) return;
  F.playing = true;
  const b = czEl('fm-play'); if (b) b.textContent = 'pause';
  fmGo((F.i + dir + F.list.length) % F.list.length, dir || 1);
}

// plays song i; songs with no clip get skipped in the same direction
async function fmGo(i, dir, tries) {
  const F = E4.fm; if (!F || !F.list.length) return;
  tries = tries || 0;
  if (tries > 8) { F.playing = false; const b = czEl('fm-play'); if (b) b.textContent = 'play'; return; }
  const tok = ++F.tok, t = F.list[i];
  F.i = i;
  const c = cz2Cover(t), now = czEl('fm-now');
  if (now) now.innerHTML = '<div class="fm-disc spin">' + (c ? '<img src="' + c + '" alt="">' : '') + '<div class="hole"></div></div>' +
    '<div class="fm-info"><b>' + esc(qStrip(t.name)) + '</b><span>' + esc(gPrimary(t)) + '</span></div>';
  fmNextList();
  let url = null;
  try { url = await qFindPreview(t); } catch {}
  if (tok !== F.tok || E4.fm !== F || Q.screen !== 'e4-fm' || !F.playing) return;
  if (!url) { fmGo((i + dir + F.list.length) % F.list.length, dir, tries + 1); return; }
  qPlayClip(url);
  const a = Q.audio;
  const tick = () => {
    if (tok !== F.tok || Q.screen !== 'e4-fm') return;
    const fill = czEl('fm-fill');
    if (fill && a.duration) fill.style.width = (a.currentTime / a.duration * 100) + '%';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  a.onended = () => { if (tok === F.tok && F.playing && Q.screen === 'e4-fm') fmGo((F.i + 1) % F.list.length, 1); };
  // warm the next one
  const nx = F.list[(i + 1) % F.list.length]; if (nx) qFindPreview(nx).catch(() => {});
}

// ======================== THE SPARKLE AWARDS ========================

function saAwards() {
  const A = _data.artists, T = _data.tracks;
  const S = A.short_term || [], M = A.medium_term || [], L = A.long_term || [];
  const tracks = qPoolFromTop();
  const rank = (list, a) => { const i = list.findIndex(x => x.id === a.id); return i < 0 ? 99 : i; };
  const all = a5Artists();
  const out = [];
  const push = (title, winner, noms, kind, line) => { if (winner) out.push({ title, winner, noms: noms.filter(n => n && n !== winner).slice(0, 2), kind, line }); };
  push('artist of the year', L[0], [L[1], L[2]], 'a', 'your all-time #1');
  push('artist of the month', S[0], [S[1], S[2]], 'a', '#1 this month');
  push('song of the moment', (T.short_term || [])[0], [(T.short_term || [])[1], (T.short_term || [])[2]], 't', 'your most played right now');
  const rod = all.filter(a => rank(S, a) < 99 && rank(M, a) < 99 && rank(L, a) < 99).sort((a, b) => (rank(S, a) + rank(M, a) + rank(L, a)) - (rank(S, b) + rank(M, b) + rank(L, b)));
  push('ride or die', rod[0], rod.slice(1), 'a', 'top artist in every era');
  const fresh = S.filter(a => rank(L, a) === 99 && rank(M, a) === 99);
  push('new obsession', fresh[0], fresh.slice(1), 'a', 'out of nowhere this month');
  const gone = L.filter(a => rank(S, a) === 99).slice(0, 15);
  push('where did they go', gone[0], gone.slice(1), 'a', 'all-time favorite, missing this month');
  const back = S.filter(a => rank(L, a) < 99 && rank(M, a) === 99);
  push('the comeback', back[0], back.slice(1), 'a', 'back after a break');
  const count = {};
  tracks.forEach(t => (t.artists || []).forEach(x => { count[x.name] = (count[x.name] || 0) + 1; }));
  const most = Object.keys(count).sort((a, b) => count[b] - count[a]);
  const byName = n => all.find(a => a.name === n) || { name: n, images: [] };
  if (most.length) push('most songs in your top', byName(most[0]), most.slice(1, 3).map(byName), 'a', count[most[0]] + ' songs');
  const dated = tracks.filter(e4Year).sort((a, b) => e4Year(a) - e4Year(b));
  if (dated.length) push('timeless', dated[0], dated.slice(1, 3), 't', 'oldest song in your top, from ' + e4Year(dated[0]));
  const long = tracks.filter(t => t.duration_ms).sort((a, b) => b.duration_ms - a.duration_ms);
  if (long.length) push('longest song', long[0], long.slice(1, 3), 't', prMmss(long[0].duration_ms / 1000) + ' long');
  return out;
}
function saName(x, kind) { return kind === 't' ? qStrip(x.name) : x.name; }
function saPic(x, kind) { return kind === 't' ? cz2Cover(x) : e4Img(x); }

function saOpen() { a5Open(saStart); }

function saStart() {
  Q.screen = 'e4-sa';
  qStopAudio(); qClearTimers();
  if (!e4Need('the sparkle awards')) return;
  E4.sa = { list: saAwards(), i: 0, open: false };
  saShow();
}

function saShow() {
  const S = E4.sa, aw = S.list[S.i];
  if (!aw) { saAll(); return; }
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('the sparkle awards', (S.i + 1) + ' of ' + S.list.length) +
    '<div class="sa-stage">' +
      '<div class="sa-cat">' + esc(aw.title) + '</div>' +
      '<div class="sa-noms">' + [aw.winner].concat(aw.noms).sort(() => Math.random() - 0.5).map(n => '<div class="sa-nom">' + czFace({ img: saPic(n, aw.kind) }) + '<span>' + esc(saName(n, aw.kind)) + '</span></div>').join('') + '</div>' +
      '<div class="sa-env" id="sa-env"><button class="q-btn" onclick="saReveal()">open the envelope</button></div>' +
    '</div>'
  );
}

function saReveal() {
  const S = E4.sa, aw = S.list[S.i]; if (!aw) return;
  const pic = saPic(aw.winner, aw.kind);
  const env = czEl('sa-env');
  if (env) env.innerHTML = '<div class="sa-win fade-up"><div class="sa-trophy">★</div>' + (pic ? '<img src="' + pic + '" alt="">' : '') +
    '<div class="sa-wn">' + esc(saName(aw.winner, aw.kind)) + '</div><div class="sa-line">' + esc(aw.line) + '</div></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="saNext()">' + (S.i + 1 < S.list.length ? 'next award' : 'all the winners') + '</button></div>';
  if (typeof confetti === 'function') confetti({ particleCount: 110, spread: 80, origin: { y: 0.45 }, colors: ['#FF1493', '#FF69B4', '#FFD700'] });
  const songs = aw.kind === 't' ? [aw.winner] : a5TracksBy(aw.winner.name);
  const i = S.i;
  czPlayFrom(songs, () => Q.screen === 'e4-sa' && E4.sa === S && S.i === i);
}
function saNext() { const S = E4.sa; qStopAudio(); S.i++; saShow(); }

function saAll() {
  const S = E4.sa;
  qSet(
    qTopBar('&larr; back', xBack()) + qHeader('the sparkle awards', '') +
    '<div class="sa-all" id="sa-all"><div class="sa-all-h">THE SPARKLE AWARDS &middot; ' + esc(e4Name()) + '</div>' +
      S.list.map(aw => { const pic = saPic(aw.winner, aw.kind); return '<div class="sa-row">' + (pic ? '<img src="' + pic + '" alt="">' : '') + '<span><i>' + esc(aw.title) + '</i><b>' + esc(saName(aw.winner, aw.kind)) + '</b></span></div>'; }).join('') +
    '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="e4Save(\'#sa-all\', \'sparkle-awards\', this)">save image</button><button class="q-btn ghost" onclick="saStart()">watch again</button></div>'
  );
}

// ======================== HUB ========================

X_HUB.you.push(
  () => xCard('👯', 'top 8', 'your artists, myspace style', 't8Open()'),
  () => xCard('📰', 'magazine cover', 'you\'re on the cover', 'mgOpen()'),
  () => xCard('🏆', 'the sparkle awards', 'your data picks the winners', 'saOpen()')
);
X_HUB.labs.push(
  () => xCard('🎤', 'lyric card', 'pick the lines, save the card', 'lyOpen()'),
  () => xCard('📻', 'sparklestats fm', 'your songs, back to back', 'fmOpen()')
);

Object.assign(window, {
  t8Open, t8Range, t8Tap, t8Swap, t8Reset, lyOpen, lyPickScreen, lyLoad, lyTap, lyTheme,
  mgOpen, mgScreen, fmOpen, fmScreen, fmToggle, fmStep, saOpen, saStart, saReveal, saNext, e4Save,
});
