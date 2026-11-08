// ============================================================
//  xXx SparkleStats xXx  -  quiz6.js
//  15 more games: shortest to longest, know your top 10, tracklist, which came first,
//  daily timeline, guess the length, backwards, mashup, odd one out, spot the fake,
//  who sang this line, initials, hangman, mini crossword, album puzzle.
//  loads after extra4.js.
// ============================================================

const Q6 = { so: null, t10: null, wf: null, gl: null, ch: null, in: null, hm: null, cw: null, pz: null, audio2: null };
const Q6_KEY = 'sparkle_q6';

function q6El(id) { return document.getElementById(id); }
function q6Pool() { return a5LoggedIn() ? qPoolFromTop().filter(t => t && t.name && !qIsAlt(t.name)) : []; }
function q6Gate(title, ok, msg) {
  if (ok) return true;
  qSet(qTopBar('&larr; back', xBack()) + qHeader(title, '') + qErrorBox(a5LoggedIn() ? (msg || 'need more songs in your top for this one') : 'log in with spotify for this one'));
  return false;
}
function q6Cover(t, big) { const im = t && t.album && t.album.images; return im && im.length ? (big ? im[0] : (im[1] || im[0])).url : ''; }
function q6Mmss(ms) { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function q6Best(id, v) { const s = a5Get(Q6_KEY, {}); const old = s[id] || 0; if (v > old) { s[id] = v; a5Put(Q6_KEY, s); } return Math.max(old, v); }
function q6Song(t) {
  const c = q6Cover(t);
  return '<div class="tl-now">' + (c ? '<img src="' + c + '" alt="">' : '') + '<div><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(qArtistNames(t)) + '</div></div></div>';
}
function q6Head(title, hud) { return qTopBar('&larr; back', xBack()) + qHeader(title, '') + (hud ? '<div class="q-hud" id="q6-hud">' + hud + '</div>' : ''); }
function q6Hud(html) { const h = q6El('q6-hud'); if (h) h.innerHTML = html; }

// plays a clip of t (or a raw url). returns false if there's no clip
async function q6Play(t, okFn) {
  let url = null;
  try { url = await qFindPreview(t); } catch {}
  if (!url || (okFn && !okFn())) return false;
  qPlayClip(url);
  return true;
}

// the shared end screen. score is out of 1000 unless unit says otherwise
function q6Done(id, title, score, line, rank, again, extra) {
  qStopAudio(); qClearTimers();
  Q.screen = 'q6-done';
  const best = q6Best(id, score);
  qSet(
    q6Head(title) +
    '<div class="q-final fade-up"><div class="num">' + score + '</div>' +
      '<div class="outof">' + line + '</div><div class="rank">' + rank + '</div>' +
      '<div class="q6-best">best ' + best + '</div></div>' +
    (extra || '') +
    '<div class="q-actions"><button class="q-btn" onclick="' + again + '">again</button><button class="q-btn ghost" onclick="' + xBack() + '">back</button></div>'
  );
  if (score >= 700 && window.confetti) confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
}

// seeded random for the daily ones
function q6Seed(str) { let h = 1779033703; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function q6Rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function q6ShuffleR(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function q6Today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ======================== SORT ENGINE (timeline style) ========================
// shortest to longest, tracklist and daily timeline all run on this

function soRun(cfg) {
  Q.screen = 'q6-so';
  qStopAudio(); qClearTimers();
  Q6.so = { cfg, line: [cfg.items[0]], i: 1, lives: 3, right: 0, marks: [], msg: '', flash: null, done: false };
  soRender();
}

function soRender() {
  const S = Q6.so; if (!S) return;
  const c = S.cfg, items = c.items, cur = !S.done ? items[S.i] : null;
  const slot = k => cur ? '<button class="tl-slot" onclick="soPlace(' + k + ')">＋ here</button>' : '';
  qSet(
    q6Head(c.title, '<span class="qn">' + c.emoji + ' ' + Math.min(S.i, items.length - 1) + ' / ' + (items.length - 1) + ' &middot; ' +
      '🖤'.repeat(S.lives) + '<span style="opacity:.3">' + '🖤'.repeat(3 - S.lives) + '</span></span><span class="sc">' + S.right + ' right</span>') +
    (c.top ? '<div class="q6-sub">' + c.top + '</div>' : '') +
    (cur ? q6Song(cur) : '') +
    (S.msg ? '<div class="cn-msg">' + S.msg + '</div>' : '') +
    '<div class="tl-line">' + (c.lo ? '<div class="q6-end">' + c.lo + '</div>' : '') + slot(0) +
      S.line.map((t, k) =>
        '<div class="tl-item' + (S.flash === t ? (S.flashOk ? ' ok' : ' bad') : '') + '"><span class="yr">' + c.show(t) + '</span>' +
          (q6Cover(t) ? '<img src="' + q6Cover(t) + '" alt="">' : '') +
          '<div class="tx"><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(gPrimary(t)) + '</div></div></div>' + slot(k + 1)
      ).join('') + (c.hi ? '<div class="q6-end">' + c.hi + '</div>' : '') +
    '</div>' +
    (S.done ? '<div class="q-actions"><button class="q-btn" onclick="soFinish()">see my score →</button></div>' : '')
  );
}

function soPlace(k) {
  const S = Q6.so; if (!S || S.done) return;
  const c = S.cfg, t = c.items[S.i], v = c.key(t);
  const keys = S.line.map(c.key);
  const ok = (k === 0 || keys[k - 1] <= v) && (k === keys.length || keys[k] >= v);
  let at = k;
  if (!ok) { at = keys.findIndex(x => x > v); if (at < 0) at = keys.length; }
  S.line.splice(at, 0, t);
  S.flash = t; S.flashOk = ok;
  S.marks.push(ok);
  if (ok) { S.right++; S.msg = '✓ ' + c.show(t); }
  else { S.lives--; S.msg = '✗ ' + c.show(t); }
  S.i++;
  if (S.lives <= 0 || S.i >= c.items.length) S.done = true;
  soRender();
}

function soFinish() {
  const S = Q6.so; if (!S) return;
  const n = S.cfg.items.length - 1, score = Math.round(S.right / n * 1000);
  if (S.cfg.onDone) S.cfg.onDone(S, score);
  q6Done(S.cfg.id, S.cfg.emoji + ' ' + S.cfg.title, score, S.right + '/' + n + ' placed right' + (S.lives <= 0 ? ' &middot; out of lives' : ''),
    S.right === n ? 'perfect' : S.right >= n * 0.7 ? 'so close' : S.right >= n * 0.4 ? 'not bad' : 'rough one', S.cfg.again,
    S.cfg.after ? S.cfg.after(S) : '');
}

// pure: n songs whose keys are all different, spread out
function soPickDistinct(pool, n, key, rnd) {
  const seen = new Set(), out = [];
  for (const t of (rnd ? q6ShuffleR(pool, rnd) : qShuffle(pool))) {
    const k = key(t);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

// ---- 1. shortest to longest ----
function lnOpen() { a5Open(lnStart); }
function lnStart() {
  const pool = q6Pool();
  const items = soPickDistinct(pool, 9, t => Math.round((t.duration_ms || 0) / 1000));
  if (!q6Gate('shortest to longest', items.length >= 6)) return;
  soRun({ id: 'ln', title: 'shortest to longest', emoji: '⏱️', items, key: t => t.duration_ms, show: t => q6Mmss(t.duration_ms), lo: 'shortest', hi: 'longest', again: 'lnOpen()' });
}

// ---- 3. tracklist ----
async function tkOpen() { a5Open(tkStart); }
async function tkStart() {
  const pool = q6Pool().filter(t => t.album && t.album.id && t.album.album_type !== 'single');
  if (!q6Gate('tracklist', pool.length >= 1)) return;
  qSet(q6Head('tracklist') + '<div class="q-loading">digging out an album...</div>');
  const albums = qShuffle([...new Map(pool.map(t => [t.album.id, t])).values()]);
  for (const seed of albums.slice(0, 6)) {
    let list = null;
    try { list = await apiFetch('/albums/' + seed.album.id + '/tracks?limit=50'); } catch {}
    if (Q.screen === 'q6-done' || !document.getElementById('game')) return;
    const songs = (list && list.items || []).filter(t => t && t.name && !qIsAlt(t.name) && t.track_number);
    if (songs.length < 6) continue;
    const pick = qShuffle(songs).slice(0, 8).map(t => Object.assign({}, t, { album: seed.album }));
    soRun({
      id: 'tk', title: 'tracklist', emoji: '💿', items: pick, key: t => (t.disc_number || 1) * 100 + t.track_number,
      show: t => 'track ' + t.track_number, top: esc(seed.album.name) + ' &middot; ' + esc(gPrimary(seed)), lo: 'track 1', again: 'tkOpen()',
    });
    return;
  }
  q6Gate('tracklist', false, 'couldn\'t load any albums right now');
}

// ---- 5. daily timeline ----
const DT_KEY = 'sparkle_daily_tl';
function dtState() { return a5Get(DT_KEY, { day: '', score: 0, streak: 0, last: '' }); }
function dtReady() { return dtState().day !== q6Today(); }
function dtOpen() { a5Open(dtStart); }
function dtStart() {
  const pool = q6Pool().slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const rnd = q6Rng(q6Seed(q6Today()));
  const items = soPickDistinct(pool, 9, t => gYear(t), rnd);
  if (!q6Gate('daily timeline', items.length >= 6, 'need songs from more different years for this one')) return;
  const st = dtState(), played = st.day === q6Today();
  soRun({
    id: 'dt', title: 'daily timeline', emoji: '📅', items, key: gYear, show: t => String(gYear(t)), lo: 'oldest', hi: 'newest', again: 'dtOpen()',
    top: played ? 'already played today &middot; this one doesn\'t count' : '🔥 ' + st.streak,
    onDone: (S, score) => {
      if (played) return;
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yd = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      a5Put(DT_KEY, { day: q6Today(), score, streak: st.day === yd ? st.streak + 1 : 1 });
    },
    after: () => '<div class="q6-sub">🔥 ' + dtState().streak + ' day streak</div>',
  });
}

// ======================== 2. KNOW YOUR TOP 10 ========================

function t10Open() { a5Open(() => t10Start('short_term')); }
function t10Start(range) {
  Q.screen = 'q6-t10';
  qStopAudio(); qClearTimers();
  const top = ((_data && _data.tracks && _data.tracks[range]) || []).slice(0, 10);
  if (!q6Gate('know your top 10', top.length >= 10)) return;
  Q6.t10 = { range, top, order: [], shuffled: qShuffle(top) };
  t10Render();
}
function t10Render() {
  const T = Q6.t10;
  const tabs = [['short_term', 'this month'], ['medium_term', '6 months'], ['long_term', 'all time']];
  qSet(
    q6Head('know your top 10') +
    '<div class="e4-tabs">' + tabs.map(([k, l]) => '<button class="cz-pill' + (k === T.range ? ' on' : '') + '" onclick="t10Start(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
    '<div class="q6-sub">tap them from #1 down</div>' +
    '<div class="t10-list">' + T.shuffled.map((t, i) => {
      const at = T.order.indexOf(t);
      const c = q6Cover(t);
      return '<button class="t10-row' + (at >= 0 ? ' on' : '') + '" onclick="t10Tap(' + i + ')"><span class="t10-n">' + (at >= 0 ? '#' + (at + 1) : '') + '</span>' +
        (c ? '<img src="' + c + '" alt="">' : '') + '<span class="tx"><b>' + esc(qStrip(t.name)) + '</b>' + esc(gPrimary(t)) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="q-actions">' + (T.order.length ? '<button class="q-btn ghost" onclick="t10Undo()">undo</button>' : '') +
      '<button class="q-btn" onclick="t10Lock()"' + (T.order.length < 10 ? ' disabled' : '') + '>lock it in</button></div>'
  );
}
function t10Tap(i) {
  const T = Q6.t10, t = T.shuffled[i];
  const at = T.order.indexOf(t);
  if (at >= 0) T.order.splice(at, 1); else T.order.push(t);
  t10Render();
}
function t10Undo() { Q6.t10.order.pop(); t10Render(); }
// pure: 100 for exact, 60 off by one, 30 off by two
function t10Score(order, top) { return order.reduce((s, t, i) => { const d = Math.abs(top.indexOf(t) - i); return s + (d === 0 ? 100 : d === 1 ? 60 : d === 2 ? 30 : 0); }, 0); }
function t10Lock() {
  const T = Q6.t10; if (T.order.length < 10) return;
  const score = t10Score(T.order, T.top), exact = T.order.filter((t, i) => T.top[i] === t).length;
  const rows = '<div class="t10-list">' + T.top.map((t, i) => {
    const you = T.order.indexOf(t);
    return '<div class="t10-row ' + (you === i ? 'ok' : Math.abs(you - i) <= 1 ? 'near' : 'bad') + '"><span class="t10-n">#' + (i + 1) + '</span>' +
      (q6Cover(t) ? '<img src="' + q6Cover(t) + '" alt="">' : '') + '<span class="tx"><b>' + esc(qStrip(t.name)) + '</b>you said #' + (you + 1) + '</span></div>';
  }).join('') + '</div>';
  q6Done('t10', '🔟 know your top 10', score, exact + '/10 exactly right', score >= 800 ? 'you know yourself' : score >= 500 ? 'pretty close' : 'spotify knows you better', 't10Start(\'' + T.range + '\')', rows);
}

// ======================== 4. WHICH CAME FIRST ========================

const WF_TIME = 30;
function wfOpen() { a5Open(wfStart); }
function wfStart() {
  Q.screen = 'q6-wf';
  qStopAudio(); qClearTimers();
  const pool = q6Pool().filter(t => gYear(t));
  if (!q6Gate('which came first', new Set(pool.map(gYear)).size >= 3, 'need songs from more different years for this one')) return;
  Q6.wf = { pool, right: 0, wrong: 0, streak: 0, t0: performance.now(), pair: null, over: false };
  qSet(q6Head('which came first', '') + '<div class="q6-sub">tap the older one</div><div class="wf-pair" id="wf-pair"></div><div class="cn-msg" id="wf-msg"></div>');
  wfNext();
  const W = Q6.wf;
  const tick = () => {
    if (Q6.wf !== W || W.over || Q.screen !== 'q6-wf') return;
    const left = Math.max(0, WF_TIME - (performance.now() - W.t0) / 1000);
    q6Hud('<span class="qn">⏳ ' + left.toFixed(1) + 's</span><span class="sc">' + W.right + ' right</span>');
    if (left <= 0) { wfEnd(); return; }
    requestAnimationFrame(tick);
  };
  tick();
}
function wfNext() {
  const W = Q6.wf;
  let a, b, n = 0;
  do { [a, b] = qShuffle(W.pool).slice(0, 2); n++; } while (n < 50 && gYear(a) === gYear(b));
  W.pair = [a, b];
  const box = q6El('wf-pair');
  if (box) box.innerHTML = W.pair.map((t, i) => {
    const c = q6Cover(t);
    return '<button class="wf-card" onclick="wfTap(' + i + ')">' + (c ? '<img src="' + c + '" alt="">' : '') + '<b>' + esc(qStrip(t.name)) + '</b><span>' + esc(gPrimary(t)) + '</span></button>';
  }).join('<span class="pr-vs">or</span>');
}
function wfTap(i) {
  const W = Q6.wf; if (!W || W.over) return;
  const [a, b] = W.pair, ok = gYear(W.pair[i]) <= gYear(W.pair[1 - i]);
  if (ok) { W.right++; W.streak++; } else { W.wrong++; W.streak = 0; W.t0 -= 2000; }
  const m = q6El('wf-msg');
  if (m) m.innerHTML = (ok ? '✓ ' : '✗ -2s &middot; ') + gYear(a) + ' vs ' + gYear(b);
  wfNext();
}
function wfEnd() {
  const W = Q6.wf; W.over = true;
  const score = W.right * 50;
  q6Done('wf', '⚡ which came first', score, W.right + ' right &middot; ' + W.wrong + ' wrong in ' + WF_TIME + 's', W.right >= 15 ? 'speed demon' : W.right >= 8 ? 'quick' : 'warming up', 'wfOpen()');
}

// ======================== ROUND ENGINE (multiple choice) ========================
// backwards, mashup, odd one out, spot the fake, who sang this line

function chRun(cfg) {
  Q.screen = 'q6-ch';
  qStopAudio(); qClearTimers();
  Q6.ch = { cfg, i: 0, score: 0, right: 0, rounds: [], busy: false };
  chRound();
}
async function chRound() {
  const C = Q6.ch, c = C.cfg;
  if (C.i >= c.n) { chEnd(); return; }
  qStopAudio();
  qSet(q6Head(c.title, '<span class="qn">' + c.emoji + ' ' + (C.i + 1) + ' / ' + c.n + '</span><span class="sc">' + C.score + ' pts</span>') +
    '<div class="q-loading" id="ch-body">...</div>');
  let r = null;
  try { r = await c.make(C.i); } catch { r = null; }
  if (Q6.ch !== C || Q.screen !== 'q6-ch') return;
  if (!r) { if (!C.rounds.length) { q6Gate(c.title, false, c.fail); return; } chEnd(); return; }
  C.cur = r; C.picked = [];
  const body = q6El('ch-body'); if (!body) return;
  body.className = '';
  body.innerHTML = (r.ask ? '<div class="q6-ask">' + r.ask + '</div>' : '') + (r.html || '') +
    '<div class="q-choices' + (r.opts.length > 4 ? ' q6-six' : '') + '" id="ch-opts">' + r.opts.map((o, i) => '<button class="q-choice" id="ch-o' + i + '" onclick="chPick(' + i + ')">' + o + '</button>').join('') + '</div>' +
    '<div class="cn-msg" id="ch-msg"></div><div class="q-actions" id="ch-next"></div>';
  if (r.start) r.start();
}
function chPick(i) {
  const C = Q6.ch, r = C && C.cur; if (!r || r.done || C.picked.includes(i)) return;
  C.picked.push(i);
  const need = r.answers.length;
  const b = q6El('ch-o' + i); if (b) b.classList.add(r.answers.includes(i) ? 'right' : 'wrong');
  if (C.picked.length < need) return;
  r.done = true;
  const hits = C.picked.filter(x => r.answers.includes(x)).length;
  C.raw = (C.raw || 0) + hits / need;
  C.score = Math.round(C.raw / C.cfg.n * 1000); if (hits === need) C.right++;
  C.rounds.push(hits === need);
  r.answers.forEach(x => { const e = q6El('ch-o' + x); if (e) e.classList.add('right'); });
  document.querySelectorAll('#ch-opts .q-choice').forEach(e => { e.disabled = true; });
  const m = q6El('ch-msg'); if (m) m.innerHTML = (hits === need ? '✓ ' : hits ? 'half right &middot; ' : '✗ ') + (r.reveal || '');
  q6Hud('<span class="qn">' + C.cfg.emoji + ' ' + (C.i + 1) + ' / ' + C.cfg.n + '</span><span class="sc">' + C.score + ' pts</span>');
  if (r.after) r.after(hits === need);
  const nx = q6El('ch-next'); if (nx) nx.innerHTML = '<button class="q-btn" onclick="chNext()">' + (C.i + 1 >= C.cfg.n ? 'see my score →' : 'next →') + '</button>';
}
function chNext() { const C = Q6.ch; if (!C) return; q6StopTwo(); C.i++; chRound(); }
function chEnd() {
  const C = Q6.ch, c = C.cfg; q6StopTwo();
  q6Done(c.id, c.emoji + ' ' + c.title, C.score, C.right + '/' + C.rounds.length + ' right', C.score >= 800 ? 'unreal' : C.score >= 500 ? 'solid' : 'tough crowd', c.again);
}
function chTitles(right, pool, n) {
  const others = qShuffle(pool.filter(t => qNorm(qStrip(t.name)) !== qNorm(qStrip(right.name))));
  const seen = new Set([qNorm(qStrip(right.name))]), out = [];
  for (const t of others) { const k = qNorm(qStrip(t.name)); if (seen.has(k)) continue; seen.add(k); out.push(t); if (out.length >= n) break; }
  return out;
}
function q6StopTwo() { if (Q6.audio2) { try { Q6.audio2.pause(); } catch {} } }

// ---- 7. backwards ----
function bwOpen() { a5Open(bwStart); }
function bwStart() {
  const pool = q6Pool();
  if (!q6Gate('backwards', pool.length >= 8)) return;
  const queue = qShuffle(pool);
  chRun({
    id: 'bw', title: 'backwards', emoji: '🔁', n: 5, again: 'bwOpen()', fail: 'couldn\'t load any clips right now',
    make: async () => {
      while (queue.length) {
        const t = queue.pop();
        let url = null; try { url = await qFindPreview(t); } catch {}
        if (!url) continue;
        let rev = null; try { rev = await xFxRender(url, 'reverse'); } catch {}
        if (!rev) continue;
        const opts = qShuffle([t, ...chTitles(t, pool, 3)]);
        return {
          ask: 'what song is this backwards?', html: '<div class="q6-rec spinning" id="q6-rec">🔁</div><div class="q-actions"><button class="q-btn ghost" onclick="bwReplay()">replay</button></div>',
          opts: opts.map(o => esc(qStrip(o.name))), answers: [opts.indexOf(t)], reveal: esc(qStrip(t.name)) + ' &middot; ' + esc(gPrimary(t)),
          start: () => { Q6.ch.bw = rev; qPlayClip(rev); }, after: () => qPlayClip(url),
        };
      }
      return null;
    },
  });
}
function bwReplay() { const C = Q6.ch; if (C && C.bw) qPlayClip(C.bw); }

// ---- 8. mashup ----
function mxOpen() { a5Open(mxStart); }
function mxStart() {
  const pool = q6Pool();
  if (!q6Gate('mashup', pool.length >= 10)) return;
  const queue = qShuffle(pool);
  const next = async () => { while (queue.length) { const t = queue.pop(); let u = null; try { u = await qFindPreview(t); } catch {} if (u) return [t, u]; } return null; };
  chRun({
    id: 'mx', title: 'mashup', emoji: '🎧', n: 5, again: 'mxOpen()', fail: 'couldn\'t load any clips right now',
    make: async () => {
      const a = await next(), b = await next();
      if (!a || !b) return null;
      const opts = qShuffle([a[0], b[0], ...chTitles(a[0], pool.filter(t => t !== b[0]), 4)]);
      return {
        ask: 'two songs at once. pick both', html: '<div class="q6-rec spinning">🎧</div><div class="q-actions"><button class="q-btn ghost" onclick="mxPlay()">replay</button></div>',
        opts: opts.map(o => esc(qStrip(o.name))), answers: [opts.indexOf(a[0]), opts.indexOf(b[0])],
        reveal: esc(qStrip(a[0].name)) + ' + ' + esc(qStrip(b[0].name)),
        start: () => { Q6.ch.mx = [a[1], b[1]]; mxPlay(); },
      };
    },
  });
}
function mxPlay() {
  const C = Q6.ch; if (!C || !C.mx) return;
  qPlayClip(C.mx[0]);
  if (!Q6.audio2) Q6.audio2 = new Audio();
  const a2 = Q6.audio2;
  a2.src = C.mx[1]; a2.currentTime = 0; a2.volume = 0.8;
  const p = a2.play(); if (p && p.catch) p.catch(() => {});
}

// ---- 9. odd one out ----
function q6ByArtist(pool, min) {
  const m = new Map();
  for (const t of pool) { const a = gPrimary(t); if (!a) continue; if (!m.has(a)) m.set(a, []); const l = m.get(a); if (!l.some(x => qNorm(qStrip(x.name)) === qNorm(qStrip(t.name)))) l.push(t); }
  return [...m.entries()].filter(([, l]) => l.length >= min);
}
function ooOpen() { a5Open(ooStart); }
function ooStart() {
  const pool = q6Pool(), groups = q6ByArtist(pool, 3);
  if (!q6Gate('odd one out', groups.length >= 2, 'need 3+ songs from at least 2 artists in your top')) return;
  chRun({
    id: 'oo', title: 'odd one out', emoji: '🙅', n: 6, again: 'ooOpen()',
    make: async () => {
      const [art, list] = groups[Math.floor(Math.random() * groups.length)];
      const three = qShuffle(list).slice(0, 3);
      const odd = qShuffle(pool.filter(t => gPrimary(t) !== art && !(t.artists || []).some(a => a.name === art)))[0];
      if (!odd) return null;
      const opts = qShuffle([...three, odd]);
      return {
        ask: 'three of these are by the same artist. which one isn\'t?',
        opts: opts.map(o => esc(qStrip(o.name))), answers: [opts.indexOf(odd)],
        reveal: 'the 3 are ' + esc(art) + ' &middot; that one is ' + esc(gPrimary(odd)),
        after: () => q6Play(odd, () => Q.screen === 'q6-ch'),
      };
    },
  });
}

// ---- 10. spot the fake ----
// pure: glue the start of one title to the end of another
function sfFake(titles, rnd) {
  rnd = rnd || Math.random;
  const real = new Set(titles.map(qNorm));
  const words = titles.map(t => t.split(/\s+/).filter(Boolean)).filter(w => w.length >= 2);
  for (let k = 0; k < 60 && words.length >= 2; k++) {
    const a = words[Math.floor(rnd() * words.length)], b = words[Math.floor(rnd() * words.length)];
    if (a === b) continue;
    const ca = 1 + Math.floor(rnd() * Math.min(2, a.length - 1)), cb = 1 + Math.floor(rnd() * Math.min(2, b.length - 1));
    const f = [...a.slice(0, ca), ...b.slice(b.length - cb)].join(' ');
    const fw = f.toLowerCase().split(' ');
    if (fw.length > 5 || new Set(fw).size < fw.length || real.has(qNorm(f))) continue;
    return f;
  }
  return null;
}
function sfOpen() { a5Open(sfStart); }
function sfStart() {
  const pool = q6Pool(), groups = q6ByArtist(pool, 3);
  const titles = [...new Set(pool.map(t => qStrip(t.name)))];
  if (!q6Gate('spot the fake', groups.length >= 1 && titles.length >= 10, 'need 3+ songs from one artist in your top')) return;
  chRun({
    id: 'sf', title: 'spot the fake', emoji: '🕵️', n: 6, again: 'sfOpen()',
    make: async () => {
      const [art, list] = groups[Math.floor(Math.random() * groups.length)];
      const three = qShuffle(list).slice(0, 3).map(t => qStrip(t.name));
      const fake = sfFake(titles);
      if (!fake) return null;
      const opts = qShuffle([...three, fake]);
      return {
        ask: 'one of these isn\'t a real ' + esc(art) + ' song', opts: opts.map(esc), answers: [opts.indexOf(fake)],
        reveal: '"' + esc(fake) + '" doesn\'t exist',
      };
    },
  });
}

// ---- 11. who sang this line ----
function q6Line(lyrics) {
  const lines = String(lyrics || '').split('\n').map(s => s.trim()).filter(s => s && !/^\[.*\]$/.test(s) && !/^\(.*\)$/.test(s));
  const good = lines.filter(s => { const n = s.split(/\s+/).length; return n >= 4 && n <= 14; });
  const uniq = [...new Set(good)];
  return uniq.length ? uniq[Math.floor(Math.random() * uniq.length)] : null;
}
function wsOpen() { a5Open(wsStart); }
function wsStart() {
  const pool = q6Pool(), names = [...new Set(a5Artists().map(a => a.name))];
  if (!q6Gate('who sang this line', pool.length >= 8 && names.length >= 4)) return;
  const queue = qShuffle(pool);
  chRun({
    id: 'ws', title: 'who sang this line', emoji: '🎤', n: 6, again: 'wsOpen()', fail: 'couldn\'t find lyrics for your songs right now',
    make: async () => {
      while (queue.length) {
        const batch = queue.splice(-3);
        const got = await Promise.all(batch.map(t => xLyricsFor(t).then(l => [t, l]).catch(() => [t, null])));
        const hit = got.find(([, l]) => q6Line(l));
        if (!hit) continue;
        const [t, l] = hit, line = q6Line(l), who = gPrimary(t);
        const opts = qShuffle([who, ...qShuffle(names.filter(n => n !== who)).slice(0, 3)]);
        return {
          ask: 'who sang this?', html: '<div class="q6-lyric">"' + esc(line) + '"</div>',
          opts: opts.map(esc), answers: [opts.indexOf(who)], reveal: esc(qStrip(t.name)) + ' &middot; ' + esc(who),
          after: () => q6Play(t, () => Q.screen === 'q6-ch'),
        };
      }
      return null;
    },
  });
}

// ======================== 6. GUESS THE LENGTH ========================

const GL_N = 5;
function glOpen() { a5Open(glStart); }
function glStart() {
  const pool = q6Pool().filter(t => t.duration_ms > 30000);
  if (!q6Gate('guess the length', pool.length >= GL_N)) return;
  Q6.gl = { list: qShuffle(pool).slice(0, GL_N), i: 0, score: 0, offs: [] };
  glRound();
}
// pure: 200 for spot on, minus 4 per second off
function glPts(guess, real) { return Math.max(0, 200 - Math.round(Math.abs(guess - real)) * 4); }
function glRound() {
  const G = Q6.gl, t = G.list[G.i];
  Q.screen = 'q6-gl';
  qStopAudio();
  G.done = false;
  qSet(
    q6Head('guess the length', '<span class="qn">⏱️ ' + (G.i + 1) + ' / ' + GL_N + '</span><span class="sc">' + G.score + ' pts</span>') +
    q6Song(t) +
    '<div class="gl-val" id="gl-val">3:30</div>' +
    '<div class="nd-ctl"><input type="range" id="gl-in" min="60" max="480" value="210" oninput="glSet(this.value)"><div class="nd-read"><span>1:00</span><span>8:00</span></div></div>' +
    '<div class="cn-msg" id="gl-msg"></div>' +
    '<div class="q-actions" id="gl-acts"><button class="q-btn" onclick="glLock()">lock it in</button></div>'
  );
  q6Play(t, () => Q.screen === 'q6-gl' && Q6.gl === G);
}
function glSet(v) { const e = q6El('gl-val'); if (e) e.textContent = q6Mmss(v * 1000); }
function glLock() {
  const G = Q6.gl; if (!G || G.done) return;
  G.done = true;
  const t = G.list[G.i], guess = +q6El('gl-in').value, real = t.duration_ms / 1000, pts = glPts(guess, real);
  G.score += pts; G.offs.push(Math.abs(guess - real));
  q6El('gl-in').disabled = true;
  q6El('gl-msg').innerHTML = 'it\'s ' + q6Mmss(t.duration_ms) + ' &middot; off by ' + Math.round(Math.abs(guess - real)) + 's &middot; +' + pts;
  q6Hud('<span class="qn">⏱️ ' + (G.i + 1) + ' / ' + GL_N + '</span><span class="sc">' + G.score + ' pts</span>');
  q6El('gl-acts').innerHTML = '<button class="q-btn" onclick="glNext()">' + (G.i + 1 >= GL_N ? 'see my score →' : 'next →') + '</button>';
}
function glNext() {
  const G = Q6.gl; G.i++;
  if (G.i < GL_N) { glRound(); return; }
  const avg = Math.round(G.offs.reduce((a, b) => a + b, 0) / G.offs.length);
  q6Done('gl', '⏱️ guess the length', G.score, 'off by ' + avg + 's on average', avg <= 10 ? 'human stopwatch' : avg <= 30 ? 'good ears' : 'time flies', 'glOpen()');
}

// ======================== 12. INITIALS ========================
// "B M T L" -> bring me to life. type it

const IN_N = 8;
function inOpen() { a5Open(inStart); }
// pure: first letter of every word
function inInitials(title) { return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/\s+/).map(w => (w.match(/[A-Za-z0-9]/) || [''])[0].toUpperCase()).filter(Boolean).join(' '); }
function inStart() {
  Q.screen = 'q6-in';
  qStopAudio(); qClearTimers();
  const seen = new Set();
  const pool = qShuffle(q6Pool()).filter(t => { const s = qStrip(t.name), n = s.split(/\s+/).length, k = qNorm(s); if (n < 2 || n > 8 || seen.has(k)) return false; seen.add(k); return true; });
  if (!q6Gate('initials', pool.length >= IN_N)) return;
  Q6.in = { list: pool.slice(0, IN_N), i: 0, score: 0, right: 0 };
  inRound();
}
function inRound() {
  const I = Q6.in, t = I.list[I.i];
  I.done = false; I.hint = false;
  qStopAudio();
  qSet(
    q6Head('initials', '<span class="qn">🔤 ' + (I.i + 1) + ' / ' + IN_N + '</span><span class="sc">' + I.score + ' pts</span>') +
    '<div class="in-big">' + esc(inInitials(qStrip(t.name))) + '</div>' +
    '<div class="q6-sub" id="in-hint"></div>' +
    '<div class="in-row"><input id="in-guess" class="q-input" autocomplete="off" placeholder="song title" onkeydown="if(event.key===\'Enter\')inGuess()"></div>' +
    '<div class="cn-msg" id="in-msg"></div>' +
    '<div class="q-actions" id="in-acts"><button class="q-btn" onclick="inGuess()">guess</button><button class="q-btn ghost" onclick="inHint()">hint</button><button class="q-btn ghost" onclick="inSkip()">skip</button></div>'
  );
  const g = q6El('in-guess'); if (g) g.focus();
}
function inHint() {
  const I = Q6.in; if (!I || I.done || I.hint) return;
  I.hint = true;
  const h = q6El('in-hint'); if (h) h.innerHTML = 'by ' + esc(qArtistNames(I.list[I.i])) + ' &middot; hint costs half';
  q6Play(I.list[I.i], () => Q.screen === 'q6-in' && Q6.in === I);
}
function inGuess() {
  const I = Q6.in; if (!I || I.done) return;
  const t = I.list[I.i], g = q6El('in-guess'), v = g ? g.value : '';
  if (!v.trim()) return;
  if (!qMatches(v, t.name)) { const m = q6El('in-msg'); if (m) m.textContent = 'nope'; if (g) g.select(); return; }
  const pts = Math.round(1000 / IN_N / (I.hint ? 2 : 1));
  I.score += pts; I.right++;
  inReveal('✓ +' + pts);
}
function inSkip() { const I = Q6.in; if (!I || I.done) return; inReveal('✗'); }
function inReveal(msg) {
  const I = Q6.in, t = I.list[I.i];
  I.done = true;
  const g = q6El('in-guess'); if (g) g.disabled = true;
  const m = q6El('in-msg'); if (m) m.innerHTML = msg + ' &middot; ' + esc(qStrip(t.name)) + ' &middot; ' + esc(gPrimary(t));
  q6Hud('<span class="qn">🔤 ' + (I.i + 1) + ' / ' + IN_N + '</span><span class="sc">' + I.score + ' pts</span>');
  const a = q6El('in-acts'); if (a) a.innerHTML = '<button class="q-btn" onclick="inNext()">' + (I.i + 1 >= IN_N ? 'see my score →' : 'next →') + '</button>';
  q6Play(t, () => Q.screen === 'q6-in' && Q6.in === I && I.done);
}
function inNext() {
  const I = Q6.in; I.i++;
  if (I.i < IN_N) { inRound(); return; }
  q6Done('in', '🔤 initials', I.score, I.right + '/' + IN_N + ' right', I.right >= 7 ? 'mind reader' : I.right >= 4 ? 'solid' : 'those were hard ok', 'inOpen()');
}

// ======================== 13. HANGMAN ========================

const HM_LIVES = 6;
const HM_KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function hmOpen() { a5Open(hmStart); }
function hmStart() {
  Q.screen = 'q6-hm';
  qStopAudio(); qClearTimers();
  const pool = q6Pool().filter(t => { const n = a5Letters(qStrip(t.name)).length; return n >= 3 && n <= 30; });
  if (!q6Gate('hangman', pool.length >= 1)) return;
  const t = pool[Math.floor(Math.random() * pool.length)];
  Q6.hm = { t, title: qStrip(t.name).normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase(), got: new Set(), miss: [], over: false };
  hmRender();
}
function hmSolved(H) { return H.title.split('').every(c => !/[A-Z]/.test(c) || H.got.has(c)); }
function hmRender() {
  const H = Q6.hm, lives = HM_LIVES - H.miss.length;
  const c = q6Cover(H.t);
  qSet(
    q6Head('hangman', '<span class="qn">' + '🖤'.repeat(lives) + '<span style="opacity:.3">' + '🖤'.repeat(HM_LIVES - lives) + '</span></span><span class="sc">' + esc(gPrimary(H.t)) + '</span>') +
    (c ? '<div class="hm-cover"><img src="' + c + '" alt="" style="filter:blur(' + (H.over ? 0 : Math.max(0, 14 - H.miss.length * 2)) + 'px)"></div>' : '') +
    '<div class="hm-word">' + H.title.split(' ').map(w => '<span class="hm-w">' + w.split('').map(ch =>
      /[A-Z]/.test(ch) ? '<span class="hm-l' + (!H.got.has(ch) && H.over ? ' miss' : '') + '">' + (H.got.has(ch) || H.over ? ch : '') + '</span>' : '<span class="hm-p">' + esc(ch) + '</span>').join('') + '</span>').join('') + '</div>' +
    '<div class="cn-msg">' + (H.msg || '') + '</div>' +
    (H.over
      ? '<div class="q-actions"><button class="q-btn" onclick="hmStart()">another one</button><button class="q-btn ghost" onclick="' + xBack() + '">back</button></div>'
      : '<div class="aw-kb">' + HM_KEYS.map(r => '<div>' + r.split('').map(k => '<button class="aw-k ' + (H.got.has(k) ? 'yes' : H.miss.includes(k) ? 'no' : '') + '" onclick="hmKey(\'' + k + '\')"' + (H.got.has(k) || H.miss.includes(k) ? ' disabled' : '') + '>' + k + '</button>').join('') + '</div>').join('') + '</div>')
  );
}
function hmKey(k) {
  const H = Q6.hm; if (!H || H.over || Q.screen !== 'q6-hm' || H.got.has(k) || H.miss.includes(k)) return;
  if (H.title.includes(k)) H.got.add(k); else H.miss.push(k);
  if (hmSolved(H)) {
    H.over = true; H.msg = 'got it';
    const st = a5Get(Q6_KEY, {}); st.hmWins = (st.hmWins || 0) + 1; a5Put(Q6_KEY, st);
    if (window.confetti) confetti({ particleCount: 70, spread: 70, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
    q6Play(H.t, () => Q.screen === 'q6-hm');
  } else if (H.miss.length >= HM_LIVES) { H.over = true; H.msg = 'out of lives'; }
  hmRender();
}

// ======================== 14. MINI CROSSWORD ========================

// pure: greedy crossword builder. words = [{ans, clue}], returns placed words with r,c,dir
function cwBuild(words, maxW, rnd) {
  rnd = rnd || Math.random;
  maxW = maxW || 13;
  const grid = new Map(), placed = [];
  const at = (r, c) => grid.get(r + ',' + c);
  const fits = (w, r, c, dir) => {
    const dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0;
    if (at(r - dr, c - dc) || at(r + dr * w.length, c + dc * w.length)) return -1;
    let cross = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i, g = at(rr, cc);
      if (g) { if (g.ch !== w[i] || g[dir]) return -1; cross++; continue; }
      // no side-by-side neighbors on a fresh cell
      if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1;
    }
    return cross;
  };
  const bounds = () => { let r0 = 0, r1 = 0, c0 = 0, c1 = 0, f = true; for (const k of grid.keys()) { const [r, c] = k.split(',').map(Number); if (f) { r0 = r1 = r; c0 = c1 = c; f = false; } r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } return { r0, r1, c0, c1 }; };
  const put = (w, r, c, dir) => {
    const dr = dir === 'd' ? 1 : 0, dc = dir === 'a' ? 1 : 0;
    for (let i = 0; i < w.ans.length; i++) { const k = (r + dr * i) + ',' + (c + dc * i); const g = grid.get(k) || { ch: w.ans[i] }; g[dir] = true; grid.set(k, g); }
    placed.push(Object.assign({}, w, { r, c, dir }));
  };
  const list = words.slice().sort((a, b) => b.ans.length - a.ans.length);
  if (!list.length) return [];
  put(list[0], 0, 0, 'a');
  for (const w of list.slice(1)) {
    let best = null;
    for (const [k, g] of grid) {
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < w.ans.length; i++) {
        if (w.ans[i] !== g.ch) continue;
        for (const dir of ['a', 'd']) {
          if (g[dir]) continue;
          const sr = dir === 'd' ? r - i : r, sc = dir === 'a' ? c - i : c;
          const x = fits(w.ans, sr, sc, dir);
          if (x < 1) continue;
          const b = bounds();
          const w2 = Math.max(b.c1, sc + (dir === 'a' ? w.ans.length - 1 : 0)) - Math.min(b.c0, sc) + 1;
          const h2 = Math.max(b.r1, sr + (dir === 'd' ? w.ans.length - 1 : 0)) - Math.min(b.r0, sr) + 1;
          if (w2 > maxW || h2 > maxW) continue;
          const sc2 = x * 10 - (w2 + h2) + rnd();
          if (!best || sc2 > best.s) best = { s: sc2, r: sr, c: sc, dir };
        }
      }
    }
    if (best) put(w, best.r, best.c, best.dir);
  }
  const b = bounds();
  return placed.map(p => Object.assign(p, { r: p.r - b.r0, c: p.c - b.c0 }));
}
function cwEnum(s) { return '(' + s.split(/\s+/).map(w => a5Letters(w).length).filter(Boolean).join(', ') + ')'; }
function cwWords() {
  const pool = q6Pool(), arts = a5Artists().slice(0, 30), out = [], used = new Set();
  for (const a of qShuffle(arts)) {
    const ans = a5Letters(a.name); if (ans.length < 3 || ans.length > 11 || used.has(ans)) continue;
    const song = pool.find(t => (t.artists || []).some(x => x.name === a.name));
    out.push({ ans, clue: (song ? 'sings "' + qStrip(song.name) + '"' : 'one of your top artists') + ' ' + cwEnum(a.name), kind: 'artist' });
    used.add(ans);
  }
  for (const t of qShuffle(pool)) {
    const title = qStrip(t.name), ans = a5Letters(title);
    if (ans.length < 3 || ans.length > 11 || used.has(ans)) continue;
    out.push({ ans, clue: 'song by ' + gPrimary(t) + (gYear(t) ? ', ' + gYear(t) : '') + ' ' + cwEnum(title), kind: 'song' });
    used.add(ans);
  }
  return out;
}
function cwOpen() { a5Open(cwStart); }
function cwStart() {
  Q.screen = 'q6-cw';
  qStopAudio(); qClearTimers();
  const words = cwWords();
  let best = [];
  for (let k = 0; k < 12; k++) {
    const arts = qShuffle(words.filter(w => w.kind === 'artist')).slice(0, 12), songs = qShuffle(words.filter(w => w.kind === 'song')).slice(0, 12);
    const p = cwBuild(qShuffle([...arts, ...songs]).slice(0, 16), 11);
    if (p.length > best.length) best = p;
    if (best.length >= 8) break;
  }
  if (!q6Gate('mini crossword', best.length >= 4)) return;
  const placed = best.slice(0, 9);
  // number the starts in reading order
  const starts = [...new Set(placed.map(p => p.r + ',' + p.c))].sort((a, b) => { const [ra, ca] = a.split(',').map(Number), [rb, cb] = b.split(',').map(Number); return ra - rb || ca - cb; });
  placed.forEach(p => { p.num = starts.indexOf(p.r + ',' + p.c) + 1; });
  const cells = new Map();
  let H = 0, W = 0;
  placed.forEach((p, wi) => { for (let i = 0; i < p.ans.length; i++) { const r = p.r + (p.dir === 'd' ? i : 0), c = p.c + (p.dir === 'a' ? i : 0); const k = r + ',' + c; const x = cells.get(k) || { ch: p.ans[i], words: [] }; x.words.push(wi); cells.set(k, x); H = Math.max(H, r + 1); W = Math.max(W, c + 1); } });
  Q6.cw = { placed, cells, H, W, dir: 'a', done: false };
  let g = '';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const x = cells.get(r + ',' + c);
    if (!x) { g += '<span class="cw-x"></span>'; continue; }
    const n = placed.find(p => p.r === r && p.c === c);
    g += '<label class="cw-c">' + (n ? '<i>' + n.num + '</i>' : '') + '<input id="cw-' + r + '-' + c + '" maxlength="1" autocomplete="off" autocapitalize="characters" onfocus="cwFocus(' + r + ',' + c + ')" oninput="cwType(' + r + ',' + c + ')" onkeydown="cwKey(event,' + r + ',' + c + ')"></label>';
  }
  const clues = dir => placed.filter(p => p.dir === dir).sort((a, b) => a.num - b.num).map(p => '<li><b>' + p.num + '</b> ' + esc(p.clue) + '</li>').join('');
  qSet(
    q6Head('mini crossword') +
    '<div class="cw-wrap"><div class="cw-grid" style="grid-template-columns:repeat(' + W + ',var(--cw))">' + g + '</div>' +
    '<div class="cw-clues"><div><h4>across</h4><ol>' + clues('a') + '</ol></div><div><h4>down</h4><ol>' + clues('d') + '</ol></div></div></div>' +
    '<div class="cn-msg" id="cw-msg"></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="cwCheck()">check</button><button class="q-btn ghost" onclick="cwReveal()">reveal</button><button class="q-btn ghost" onclick="cwStart()">new one</button></div>'
  );
}
function cwFocus(r, c) {
  const C = Q6.cw; if (!C) return;
  const x = C.cells.get(r + ',' + c);
  const dirs = x.words.map(i => C.placed[i].dir);
  if (C.last === r + ',' + c && dirs.length > 1) C.dir = C.dir === 'a' ? 'd' : 'a';
  else if (!dirs.includes(C.dir)) C.dir = dirs[0];
  C.last = r + ',' + c;
  document.querySelectorAll('.cw-c.hl').forEach(e => e.classList.remove('hl'));
  const wi = x.words.find(i => C.placed[i].dir === C.dir), p = C.placed[wi];
  if (p) for (let i = 0; i < p.ans.length; i++) { const e = q6El('cw-' + (p.r + (p.dir === 'd' ? i : 0)) + '-' + (p.c + (p.dir === 'a' ? i : 0))); if (e) e.parentNode.classList.add('hl'); }
}
function cwMove(r, c, step) {
  const C = Q6.cw, dr = C.dir === 'd' ? step : 0, dc = C.dir === 'a' ? step : 0;
  const e = q6El('cw-' + (r + dr) + '-' + (c + dc));
  if (e) { C.last = (r + dr) + ',' + (c + dc); e.focus(); e.select && e.select(); }
}
function cwType(r, c) {
  const e = q6El('cw-' + r + '-' + c); if (!e) return;
  e.value = a5Letters(e.value).slice(-1);
  e.parentNode.classList.remove('bad');
  if (e.value) cwMove(r, c, 1);
  cwSolvedCheck();
}
function cwKey(ev, r, c) {
  const e = q6El('cw-' + r + '-' + c);
  if (ev.key === 'Backspace' && e && !e.value) { ev.preventDefault(); cwMove(r, c, -1); }
  else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
    ev.preventDefault();
    Q6.cw.dir = (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') ? 'd' : 'a';
    cwMove(r, c, (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : -1);
  }
}
function cwSolvedCheck() {
  const C = Q6.cw; if (!C || C.done) return;
  for (const [k, x] of C.cells) { const e = q6El('cw-' + k.replace(',', '-')); if (!e || e.value !== x.ch) return; }
  C.done = true;
  const m = q6El('cw-msg'); if (m) m.textContent = 'solved';
  const st = a5Get(Q6_KEY, {}); st.cwSolved = (st.cwSolved || 0) + 1; a5Put(Q6_KEY, st);
  if (window.confetti) confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
}
function cwCheck() {
  const C = Q6.cw; if (!C) return;
  let wrong = 0, empty = 0;
  for (const [k, x] of C.cells) {
    const e = q6El('cw-' + k.replace(',', '-')); if (!e) continue;
    if (!e.value) { empty++; continue; }
    const bad = e.value !== x.ch; e.parentNode.classList.toggle('bad', bad); if (bad) wrong++;
  }
  const m = q6El('cw-msg'); if (m) m.textContent = wrong ? wrong + ' wrong' : empty ? 'all good so far' : '';
  cwSolvedCheck();
}
function cwReveal() {
  const C = Q6.cw; if (!C) return;
  C.done = true;
  for (const [k, x] of C.cells) { const e = q6El('cw-' + k.replace(',', '-')); if (e) { if (e.value !== x.ch) e.parentNode.classList.add('shown'); e.value = x.ch; } }
}

// ======================== 15. ALBUM PUZZLE ========================

function pzOpen() { a5Open(() => pzStart(3)); }
function pzStart(n) {
  Q.screen = 'q6-pz';
  qStopAudio(); qClearTimers();
  const pool = q6Pool().filter(t => q6Cover(t, true));
  if (!q6Gate('album puzzle', pool.length >= 1)) return;
  const t = pool[Math.floor(Math.random() * Math.min(pool.length, 40))];
  // shuffle by sliding so it's always solvable
  const tiles = Array.from({ length: n * n }, (_, i) => i);
  let blank = n * n - 1, prev = -1;
  for (let k = 0; k < n * n * 30; k++) {
    const r = Math.floor(blank / n), c = blank % n;
    const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => a * n + b).filter(x => x !== prev);
    const m = nb[Math.floor(Math.random() * nb.length)];
    [tiles[blank], tiles[m]] = [tiles[m], tiles[blank]];
    prev = blank; blank = m;
  }
  Q6.pz = { t, n, tiles, moves: 0, t0: 0, done: false };
  if (pzSolved(tiles)) { pzStart(n); return; }
  pzRender();
}
function pzSolved(tiles) { return tiles.every((v, i) => v === i); }
function pzRender() {
  const P = Q6.pz, n = P.n, img = q6Cover(P.t, true), blank = n * n - 1;
  qSet(
    q6Head('album puzzle', '<span class="qn">🧩 ' + P.moves + ' moves</span><span class="sc" id="pz-time"></span>') +
    '<div class="e4-tabs">' + [3, 4, 5].map(k => '<button class="cz-pill' + (k === n ? ' on' : '') + '" onclick="pzStart(' + k + ')">' + k + '×' + k + '</button>').join('') + '</div>' +
    '<div class="pz-board' + (P.done ? ' done' : '') + '" style="--n:' + n + '">' + P.tiles.map((v, i) =>
      v === blank && !P.done ? '<span class="pz-t blank"></span>'
        : '<button class="pz-t" onclick="pzTap(' + i + ')" style="background-image:url(\'' + img + '\');background-position:' + ((v % n) / (n - 1) * 100) + '% ' + (Math.floor(v / n) / (n - 1) * 100) + '%"></button>').join('') + '</div>' +
    '<div class="cn-msg">' + (P.done ? esc(qStrip(P.t.name)) + ' &middot; ' + esc(gPrimary(P.t)) : '') + '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="pzStart(' + n + ')">new cover</button></div>'
  );
  pzClock();
}
function pzClock() {
  const P = Q6.pz, e = q6El('pz-time');
  if (e) e.textContent = P.t0 ? Math.floor(((P.end || performance.now()) - P.t0) / 1000) + 's' : '';
}
function pzTap(i) {
  const P = Q6.pz; if (!P || P.done) return;
  const n = P.n, b = P.tiles.indexOf(n * n - 1);
  const r = Math.floor(i / n), c = i % n, br = Math.floor(b / n), bc = b % n;
  if (Math.abs(r - br) + Math.abs(c - bc) !== 1) return;
  if (!P.t0) { P.t0 = performance.now(); const tick = () => { if (Q6.pz !== P || P.done || Q.screen !== 'q6-pz') return; pzClock(); setTimeout(tick, 500); }; setTimeout(tick, 500); }
  [P.tiles[i], P.tiles[b]] = [P.tiles[b], P.tiles[i]];
  P.moves++;
  if (pzSolved(P.tiles)) {
    P.done = true; P.end = performance.now();
    if (window.confetti) confetti({ particleCount: 110, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
    q6Play(P.t, () => Q.screen === 'q6-pz');
  }
  pzRender();
}

// ======================== KEYBOARD (hangman) ========================

(function () {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key === 'Enter' ? 'ENTER' : e.key === 'Backspace' ? 'BACK' : '';
    if (!k) return;
    if (Q.screen === 'q6-hm' && /^[A-Z]$/.test(k)) { e.preventDefault(); hmKey(k); }
  });
})();

// ======================== HUB ========================

X_HUB.games.push(
  () => xCard('📅', 'daily timeline', 'a new timeline every day', 'dtOpen()', dtReady() ? 'new' : ''),
  () => xCard('⏱️', 'shortest to longest', 'timeline, but song length', 'lnOpen()'),
  () => xCard('💿', 'tracklist', 'put an album back in order', 'tkOpen()'),
  () => xCard('🔟', 'know your top 10', 'rank your top 10 like spotify does', 't10Open()'),
  () => xCard('⚡', 'which came first', 'tap the older song. 30 seconds', 'wfOpen()'),
  () => xCard('📐', 'guess the length', 'how long is this song?', 'glOpen()'),
  () => xCard('🔁', 'backwards', 'name the song played in reverse', 'bwOpen()'),
  () => xCard('🎧', 'mashup', 'two songs at once', 'mxOpen()'),
  () => xCard('🙅', 'odd one out', 'which song isn\'t like the others', 'ooOpen()'),
  () => xCard('🕵️', 'spot the fake', 'one title is made up', 'sfOpen()'),
  () => xCard('🎤', 'who sang this line', 'lyrics, pick the artist', 'wsOpen()'),
  () => xCard('🔤', 'initials', 'B M T L = ?', 'inOpen()'),
  () => xCard('🖤', 'hangman', 'guess the song title', 'hmOpen()'),
  () => xCard('✏️', 'mini crossword', 'your artists and songs', 'cwOpen()'),
  () => xCard('🧩', 'album puzzle', 'slide the cover back together', 'pzOpen()')
);

Object.assign(window, {
  lnOpen, tkOpen, dtOpen, soPlace, soFinish, t10Open, t10Start, t10Tap, t10Undo, t10Lock, wfOpen, wfTap,
  chPick, chNext, bwOpen, bwReplay, mxOpen, mxPlay, ooOpen, sfOpen, wsOpen, glOpen, glSet, glLock, glNext,
  inOpen, inGuess, inHint, inSkip, inNext, hmOpen, hmStart, hmKey, cwOpen, cwStart, cwFocus, cwType, cwKey, cwCheck, cwReveal,
  pzOpen, pzStart, pzTap,
});

// mashup's second clip stops whenever anything else stops the audio
(function () {
  const prev = qStopAudio;
  qStopAudio = function () { const r = prev.apply(this, arguments); q6StopTwo(); return r; };
})();
