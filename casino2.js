// ============================================================
//  xXx SparkleStats xXx  -  casino2.js
//  no skips (mines), higher or lower, setlist (keno), plinko, trade-in.
//  same coin jar as the rest of the casino. loads after casino.js (+ keeps.js for cards).
// ============================================================

const CZ2 = { ns: null, hl: null, sl: null, pk: null, nsSkips: 5 };

function cz2Cover(t) { const im = t && t.album && t.album.images; return im && im.length ? (im[1] || im[0]).url : ''; }
function cz2Pool() { return a5LoggedIn() ? qPoolFromTop() : []; }
function cz2Gate(title, n, pool) {
  if (pool.length >= n) return true;
  qSet(qTopBar('&larr; back', xBack()) + qHeader(title, '') + qErrorBox(a5LoggedIn() ? 'need a few more top songs first' : 'log in with spotify for this one'));
  return false;
}
function cz2Stats() { return a5Get('sparkle_cz2', { nsBest: 0, hlBest: 0, slBest: 0, pkBest: 0 }); }
function cz2Best(key, v) { const s = cz2Stats(); if (v > (s[key] || 0)) { s[key] = v; a5Put('sparkle_cz2', s); } }

// a soft pluck for plinko pegs
function cz2Pluck(freq, vol) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = CZ.ac || (CZ.ac = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
  } catch {}
}

// ======================== NO SKIPS ========================
// 25 face-down songs, some are skips. every song you flip raises the multiplier

const NS_N = 25;
const NS_SKIP_OPTS = [3, 5, 10];

function nsMult(k, m) {
  let x = 1;
  for (let i = 0; i < k; i++) x *= (NS_N - i) / (NS_N - m - i);
  return Math.floor(x * 0.97 * 100) / 100;
}

function nsOpen() { a5Open(nsScreen); }

function nsScreen() {
  Q.screen = 'cz-ns';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('no skips', 22, pool)) return;
  CZ2.ns = { state: 'bet', pool };
  qSet(
    czHead('no skips') +
    '<div class="ns-opts" id="ns-opts">' + NS_SKIP_OPTS.map(m => '<button class="cz-pill' + (m === CZ2.nsSkips ? ' on' : '') + '" data-m="' + m + '" onclick="nsSetSkips(' + m + ')">' + m + ' skips</button>').join('') + '</div>' +
    '<div class="ns-grid" id="ns-grid">' + Array.from({ length: NS_N }, (_, i) => '<button class="ns-tile" id="ns-t' + i + '" onclick="nsFlip(' + i + ')" disabled></button>').join('') + '</div>' +
    '<div class="cn-status" id="ns-next"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="ns-go" onclick="nsGo()">start</button></div>'
  );
}

function nsSetSkips(m) {
  const S = CZ2.ns; if (!S || S.state === 'play') return;
  CZ2.nsSkips = m;
  document.querySelectorAll('#ns-opts .cz-pill').forEach(b => b.classList.toggle('on', +b.dataset.m === m));
}

function nsGo() {
  const S = CZ2.ns; if (!S) return;
  if (S.state === 'play') { nsCash(); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  const m = CZ2.nsSkips;
  const idx = qShuffle(Array.from({ length: NS_N }, (_, i) => i));
  const songs = qShuffle(S.pool).slice(0, NS_N - m);
  Object.assign(S, { state: 'play', stake: amt, m, skips: new Set(idx.slice(0, m)), open: [], songs: {}, last: null });
  let k = 0;
  for (let i = 0; i < NS_N; i++) if (!S.skips.has(i)) S.songs[i] = songs[k++];
  for (let i = 0; i < NS_N; i++) { const t = czEl('ns-t' + i); if (t) { t.className = 'ns-tile live'; t.innerHTML = ''; t.disabled = false; } }
  document.querySelectorAll('#ns-opts .cz-pill').forEach(b => { b.disabled = true; });
  nsUpd();
}

function nsUpd() {
  const S = CZ2.ns, k = S.open.length;
  const go = czEl('ns-go');
  if (go) { go.textContent = S.state === 'play' ? (k ? 'cash out · ' + Math.floor(S.stake * nsMult(k, S.m)) : 'cash out') : 'start'; go.disabled = S.state === 'play' && !k; go.classList.toggle('cash', S.state === 'play' && k > 0); }
  const nx = czEl('ns-next');
  if (nx) nx.innerHTML = S.state === 'play' ? 'now <b>×' + (k ? nsMult(k, S.m) : '1.00') + '</b> &middot; next <b>×' + nsMult(k + 1, S.m) + '</b>' : '';
}

function nsFlip(i) {
  const S = CZ2.ns;
  if (!S || S.state !== 'play' || S.open.includes(i)) return;
  const t = czEl('ns-t' + i);
  if (S.skips.has(i)) {
    S.state = 'over';
    if (t) { t.className = 'ns-tile skip boom'; t.innerHTML = '<span>skip</span>'; }
    czScratch(); qStopAudio();
    nsRevealAll(i);
    czMsg('skipped &middot; -' + S.stake + ' 🪙', 'none');
    nsDone();
    return;
  }
  S.open.push(i); S.last = S.songs[i];
  const c = cz2Cover(S.songs[i]);
  if (t) { t.className = 'ns-tile song'; t.disabled = true; t.innerHTML = c ? '<img src="' + c + '" alt="">' : '<span>♫</span>'; }
  cz2Pluck(330 + S.open.length * 40, 0.1);
  if (S.open.length >= NS_N - S.m) { nsCash(); return; }
  nsUpd();
}

function nsRevealAll(hit) {
  const S = CZ2.ns;
  for (let i = 0; i < NS_N; i++) {
    const t = czEl('ns-t' + i); if (!t) continue;
    t.disabled = true;
    if (i === hit || S.open.includes(i)) continue;
    if (S.skips.has(i)) { t.className = 'ns-tile skip dim'; t.innerHTML = '<span>skip</span>'; }
    else { const c = cz2Cover(S.songs[i]); t.className = 'ns-tile song dim'; t.innerHTML = c ? '<img src="' + c + '" alt="">' : '<span>♫</span>'; }
  }
}

function nsCash() {
  const S = CZ2.ns;
  if (!S || S.state !== 'play' || !S.open.length) return;
  S.state = 'over';
  const m = nsMult(S.open.length, S.m), won = Math.floor(S.stake * m);
  czWin(won); cz2Best('nsBest', m);
  nsRevealAll(-1);
  czMsg('cashed out at ×' + m + ' &middot; +' + won + ' 🪙', m >= 5 ? 'jackpot' : 'three');
  if (m >= 3) czBoom(m >= 10);
  nsDone();
  if (S.last) czPlayFrom([S.last], () => Q.screen === 'cz-ns' && CZ2.ns === S && S.state === 'over');
}

function nsDone() {
  czLock(false);
  document.querySelectorAll('#ns-opts .cz-pill').forEach(b => { b.disabled = false; });
  nsUpd();
}

// ======================== HIGHER OR LOWER ========================
// guess if the next song's track number is higher or lower. every right call multiplies

function hlPool() { return cz2Pool().filter(t => t && t.track_number); }
function hlOdds(pool, n) {
  const hi = pool.filter(t => t.track_number >= n).length / pool.length;
  const lo = pool.filter(t => t.track_number <= n).length / pool.length;
  const m = p => (p > 0 ? Math.floor(0.96 / p * 100) / 100 : 0);
  return { hi: m(hi), lo: m(lo) };
}
function hlCard(t, cls) {
  const c = cz2Cover(t);
  return '<div class="bj-card hl-card ' + (cls || '') + ' fade-up">' + (c ? '<img src="' + c + '" alt="">' : '') +
    '<span class="bj-n">' + t.track_number + '</span>' +
    '<span class="bj-t"><span class="bj-tn">track ' + t.track_number + '</span>' + esc(qStrip(t.name)) + '</span></div>';
}

function hlOpen() { a5Open(hlScreen); }

function hlScreen() {
  Q.screen = 'cz-hl';
  qStopAudio(); qClearTimers();
  const pool = hlPool();
  if (!cz2Gate('higher or lower', 15, pool)) return;
  CZ2.hl = { pool, state: 'bet', hist: [] };
  qSet(
    czHead('higher or lower') +
    '<div class="hl-hist" id="hl-hist"></div>' +
    '<div class="hl-cur" id="hl-cur"><div class="bj-card back"><span>xXx</span></div></div>' +
    '<div class="cn-status" id="hl-total"></div>' +
    '<div class="q-actions" id="hl-acts"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="hl-go" onclick="hlGo()">deal</button></div>'
  );
  hlUpd();
}

function hlDraw(H) {
  let t;
  for (let k = 0; k < 10; k++) { t = H.pool[Math.floor(Math.random() * H.pool.length)]; if (!H.cur || t.id !== H.cur.id) break; }
  return t;
}

function hlUpd() {
  const H = CZ2.hl; if (!H) return;
  const acts = czEl('hl-acts'), go = czEl('hl-go'), tot = czEl('hl-total');
  if (H.state === 'play') {
    const o = hlOdds(H.pool, H.cur.track_number);
    if (acts) acts.innerHTML =
      '<button class="q-btn" onclick="hlGuess(\'hi\')"' + (o.hi < 1.01 ? ' disabled' : '') + '>higher or same &middot; ×' + o.hi + '</button>' +
      '<button class="q-btn" onclick="hlGuess(\'lo\')"' + (o.lo < 1.01 ? ' disabled' : '') + '>lower or same &middot; ×' + o.lo + '</button>';
    if (tot) tot.innerHTML = H.mult > 1 ? 'now <b>×' + H.mult.toFixed(2) + '</b> = ' + Math.floor(H.stake * H.mult) + ' 🪙' : '';
    if (go) { go.textContent = H.mult > 1 ? 'cash out · ' + Math.floor(H.stake * H.mult) : 'cash out'; go.disabled = !(H.mult > 1); go.classList.add('cash'); }
  } else {
    if (acts) acts.innerHTML = '';
    if (tot) tot.innerHTML = '';
    if (go) { go.textContent = 'deal'; go.disabled = false; go.classList.remove('cash'); }
  }
  const hist = czEl('hl-hist');
  if (hist) hist.innerHTML = H.hist.slice(-8).map(t => '<span class="hl-mini">' + t.track_number + '</span>').join('');
}

function hlGo() {
  const H = CZ2.hl; if (!H) return;
  if (H.state === 'play') { hlCash(); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  H.cur = null;
  Object.assign(H, { state: 'play', stake: amt, mult: 1, hist: [] });
  H.cur = hlDraw(H);
  const cur = czEl('hl-cur'); if (cur) cur.innerHTML = hlCard(H.cur);
  hlUpd();
}

function hlGuess(dir) {
  const H = CZ2.hl; if (!H || H.state !== 'play') return;
  const o = hlOdds(H.pool, H.cur.track_number), m = o[dir];
  if (m < 1.01) return;
  const next = hlDraw(H), a = H.cur.track_number, b = next.track_number;
  const right = dir === 'hi' ? b >= a : b <= a;
  H.hist.push(H.cur);
  H.cur = next;
  const cur = czEl('hl-cur'); if (cur) cur.innerHTML = hlCard(next, right ? 'good' : 'bad');
  if (!right) {
    H.state = 'over';
    czMsg('track ' + b + ' &middot; -' + H.stake + ' 🪙', 'none');
    czLock(false); hlUpd();
    return;
  }
  H.mult *= m;
  cz2Pluck(392 + H.hist.length * 30, 0.1);
  hlUpd();
}

function hlCash() {
  const H = CZ2.hl; if (!H || H.state !== 'play' || !(H.mult > 1)) return;
  H.state = 'over';
  const won = Math.floor(H.stake * H.mult);
  czWin(won); cz2Best('hlBest', H.mult);
  czMsg('cashed out at ×' + H.mult.toFixed(2) + ' &middot; +' + won + ' 🪙', H.mult >= 5 ? 'jackpot' : 'three');
  if (H.mult >= 3) czBoom(H.mult >= 10);
  czLock(false); hlUpd();
  const t = H.cur;
  czPlayFrom([t], () => Q.screen === 'cz-hl' && CZ2.hl === H && H.state === 'over');
}

// ======================== SETLIST ========================
// 20 of your songs. pick up to 5, the concert plays 8. paid by how many of yours made it

const SL_BOARD = 20, SL_DRAW = 8, SL_MAXPICK = 5;
const SL_PAY = {             // [hits] -> multiplier, about 92-95% back over time
  1: [0, 2.3],
  2: [0, 0.8, 3.5],
  3: [0, 0.5, 1.4, 6],
  4: [0, 0, 0.9, 3, 12],
  5: [0, 0, 0.3, 1.5, 6, 40],
};

function slOpen() { a5Open(slScreen); }

function slScreen() {
  Q.screen = 'cz-sl';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('setlist', SL_BOARD, pool)) return;
  const board = qShuffle(pool).slice(0, SL_BOARD);
  CZ2.sl = { board, picks: [], state: 'pick', drawn: [] };
  qSet(
    czHead('setlist') +
    '<div class="sl-board" id="sl-board">' + board.map((t, i) => {
      const c = cz2Cover(t);
      return '<button class="sl-song" id="sl-s' + i + '" onclick="slToggle(' + i + ')">' + (c ? '<img src="' + c + '" alt="">' : '') + '<span>' + esc(qStrip(t.name)) + '</span></button>';
    }).join('') + '</div>' +
    '<div class="sl-pay" id="sl-pay"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="sl-go" onclick="slGo()">play the setlist</button><button class="q-btn ghost" onclick="slScreen()">new songs</button></div>'
  );
  slUpd();
}

function slToggle(i) {
  const S = CZ2.sl; if (!S || S.state === 'draw') return;
  if (S.state === 'over') slClear();
  const at = S.picks.indexOf(i);
  if (at >= 0) S.picks.splice(at, 1);
  else if (S.picks.length < SL_MAXPICK) S.picks.push(i);
  slUpd();
}

function slClear() {
  const S = CZ2.sl;
  S.state = 'pick'; S.drawn = [];
  S.board.forEach((_, i) => { const b = czEl('sl-s' + i); if (b) b.classList.remove('drawn', 'hit'); });
}

function slUpd() {
  const S = CZ2.sl;
  S.board.forEach((_, i) => { const b = czEl('sl-s' + i); if (b) b.classList.toggle('on', S.picks.includes(i)); });
  const n = S.picks.length, pay = czEl('sl-pay');
  if (pay) pay.innerHTML = n ? SL_PAY[n].map((m, h) => m ? '<span>' + h + ' hit' + (h > 1 ? 's' : '') + ' <b>×' + m + '</b></span>' : '').join('') : '';
  const go = czEl('sl-go'); if (go) go.disabled = !n || S.state === 'draw';
}

function slGo() {
  const S = CZ2.sl; if (!S || S.state === 'draw' || !S.picks.length) return;
  if (S.state === 'over') { const keep = S.picks.slice(); slClear(); S.picks = keep; slUpd(); }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  S.state = 'draw'; S.stake = amt;
  S.drawn = qShuffle(Array.from({ length: SL_BOARD }, (_, i) => i)).slice(0, SL_DRAW);
  slUpd();
  let k = 0;
  const step = () => {
    if (CZ2.sl !== S || Q.screen !== 'cz-sl') return;
    const i = S.drawn[k], b = czEl('sl-s' + i), hit = S.picks.includes(i);
    if (b) { b.classList.add('drawn'); if (hit) b.classList.add('hit'); }
    cz2Pluck(hit ? 660 : 330 + k * 25, hit ? 0.16 : 0.08);
    if (++k < SL_DRAW) setTimeout(step, 450); else setTimeout(() => slDone(S), 300);
  };
  setTimeout(step, 250);
}

function slDone(S) {
  if (CZ2.sl !== S || Q.screen !== 'cz-sl') return;
  S.state = 'over';
  const hits = S.picks.filter(i => S.drawn.includes(i));
  const m = SL_PAY[S.picks.length][hits.length] || 0, won = Math.floor(S.stake * m);
  if (won) czWin(won);
  cz2Best('slBest', m);
  czMsg(hits.length + ' of ' + S.picks.length + ' made the setlist' + (won ? ' &middot; +' + won + ' 🪙' : ''), m >= 5 ? 'jackpot' : won > S.stake ? 'three' : won ? 'pair' : 'none');
  if (m >= 5) czBoom(m >= 20);
  czLock(false); slUpd();
  const songs = (hits.length ? hits : S.drawn).map(i => S.board[i]);
  czPlayFrom(songs, () => Q.screen === 'cz-sl' && CZ2.sl === S && S.state === 'over');
}

// ======================== PLINKO ========================

const PK_ROWS = 10;
const PK_MULT = [25, 5, 2, 1.2, 0.6, 0.4, 0.6, 1.2, 2, 5, 25];   // ~95% back
const PK_NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175];
const PK_W = 600, PK_H = 560, PK_TOP = 50, PK_DY = 44, PK_DX = PK_W / (PK_ROWS + 2);

function pkOpen() { a5Open(pkScreen); }

function pkScreen() {
  Q.screen = 'cz-pk';
  qStopAudio(); qClearTimers();
  if (!a5LoggedIn()) { qSet(qTopBar('&larr; back', xBack()) + qHeader('plinko', '') + qErrorBox('log in with spotify for this one')); return; }
  CZ2.pk = { balls: [], flash: {}, slotFlash: {}, raf: 0, last: null };
  qSet(
    czHead('plinko') +
    '<div class="pk-stage"><canvas id="pk-cv" class="pk-cv" width="' + PK_W + '" height="' + PK_H + '"></canvas></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" onclick="pkDrop()">drop</button></div>'
  );
  pkDraw();
}

function pkPeg(r, i) { return [PK_W / 2 + (i - (r + 2) / 2) * PK_DX, PK_TOP + r * PK_DY]; }
function pkSlotX(k) { return PK_W / 2 + (k - PK_ROWS / 2) * PK_DX; }

function pkDrop() {
  const S = CZ2.pk; if (!S || Q.screen !== 'cz-pk') return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  const path = Array.from({ length: PK_ROWS }, () => (Math.random() < 0.5 ? 0 : 1));
  S.balls.push({ path, t0: performance.now(), stake: amt, row: -1, jit: (Math.random() - 0.5) * 6 });
  if (!S.raf) S.raf = requestAnimationFrame(pkFrame);
}

// where a ball is: start above the top, then one hop per row
function pkBallAt(b, now) {
  const SEG = 120, u = (now - b.t0) / SEG;
  const pos = r => { let rights = 0; for (let i = 0; i < r; i++) rights += b.path[i]; return PK_W / 2 + (rights - r / 2) * PK_DX; };
  if (u < 1) return { x: PK_W / 2 + b.jit, y: PK_TOP - 34 + 30 * u, row: -1 };
  const r = Math.floor(u - 1), f = (u - 1) - r;
  if (r >= PK_ROWS) return { x: pos(PK_ROWS), y: PK_TOP + PK_ROWS * PK_DY - 12, row: PK_ROWS, done: true };
  const x0 = pos(r), x1 = pos(r + 1);
  const y = PK_TOP + r * PK_DY - 12 + f * PK_DY - Math.sin(Math.PI * f) * PK_DY * 0.35;
  return { x: x0 + (x1 - x0) * f, y, row: r };
}

function pkFrame(now) {
  const S = CZ2.pk;
  if (!S || Q.screen !== 'cz-pk') { if (S) S.raf = 0; return; }
  for (const b of S.balls.slice()) {
    const p = pkBallAt(b, now);
    if (p.row > b.row && p.row >= 0 && p.row < PK_ROWS) {
      let rights = 0; for (let i = 0; i < p.row; i++) rights += b.path[i];
      const col = rights + 1;   // the peg it just hit
      S.flash[p.row + ':' + col] = now;
      cz2Pluck(PK_NOTES[Math.min(PK_NOTES.length - 1, col)], 0.07);
    }
    b.row = p.row;
    if (p.done) {
      S.balls.splice(S.balls.indexOf(b), 1);
      const k = b.path.reduce((s, x) => s + x, 0), m = PK_MULT[k], won = Math.floor(b.stake * m);
      if (won) czWin(won);
      cz2Best('pkBest', m);
      S.slotFlash[k] = now;
      cz2Pluck(m >= 2 ? 1047 : 196, m >= 2 ? 0.16 : 0.1);
      czMsg('×' + m + (won ? ' &middot; +' + won + ' 🪙' : ''), m >= 5 ? 'jackpot' : m >= 1 ? 'three' : 'none');
      if (m >= 5) czBoom(m >= 25);
    }
  }
  pkDraw(now);
  S.raf = S.balls.length || Object.values(S.flash).some(t => now - t < 300) ? requestAnimationFrame(pkFrame) : 0;
}

function pkDraw(now) {
  const cv = czEl('pk-cv'); if (!cv || !cv.getContext) return;
  const g = cv.getContext('2d'), S = CZ2.pk;
  now = now || performance.now();
  g.clearRect(0, 0, PK_W, PK_H);
  for (let r = 0; r < PK_ROWS; r++) {
    for (let i = 0; i < r + 3; i++) {
      const [x, y] = pkPeg(r, i), f = S.flash[r + ':' + i], hot = f && now - f < 250;
      g.beginPath(); g.arc(x, y, hot ? 6 : 4.5, 0, 7);
      g.fillStyle = hot ? '#FFD700' : '#ff69b4'; g.shadowColor = hot ? '#FFD700' : '#ff1493'; g.shadowBlur = hot ? 14 : 6;
      g.fill();
    }
  }
  g.shadowBlur = 0;
  const sy = PK_TOP + PK_ROWS * PK_DY + 10;
  PK_MULT.forEach((m, k) => {
    const x = pkSlotX(k), f = S.slotFlash[k], hot = f && now - f < 500;
    g.fillStyle = hot ? '#FFD700' : m >= 5 ? '#d6136f' : m >= 1 ? '#5a1a3a' : '#2a1520';
    g.fillRect(x - PK_DX / 2 + 3, sy, PK_DX - 6, 34);
    g.fillStyle = hot ? '#140a10' : '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('×' + m, x, sy + 17);
  });
  for (const b of S.balls) {
    const p = pkBallAt(b, now);
    g.beginPath(); g.arc(p.x, p.y, 8, 0, 7);
    g.fillStyle = '#fff'; g.shadowColor = '#ff1493'; g.shadowBlur = 12; g.fill();
  }
  g.shadowBlur = 0;
}

// ======================== TRADE-IN ========================
// trade your top songs (once a day each) and extra trading cards for coins

const TI_KEY = 'sparkle_tradein';
const TI_CARD = { common: 10, rare: 25, ultra: 60, mythic: 150 };

function tiState() {
  const s = a5Get(TI_KEY, { day: '', songs: [] });
  const today = new Date().toDateString();
  if (s.day !== today) { s.day = today; s.songs = []; }
  return s;
}
function tiSongVal(i) { return Math.max(5, 60 - i * 2); }
function tiCards() {
  if (typeof kpColLoad !== 'function' || typeof kpCardSet !== 'function' || !a5LoggedIn()) return [];
  const col = kpColLoad();
  return kpCardSet().filter(c => (col.owned[c.id] || 0) > 1).map(c => ({ c, extra: col.owned[c.id] - 1 }));
}

function tiOpen() { a5Open(tiScreen); }

function tiScreen() {
  Q.screen = 'cz-ti';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('trade-in', 1, pool)) return;
  const st = tiState(), songs = pool.slice(0, 30), cards = tiCards();
  const extraTot = cards.reduce((s, x) => s + x.extra * TI_CARD[x.c.rar], 0);
  qSet(
    czHead('trade-in') +
    '<div class="sm-out" id="cz-out"></div>' +
    (cards.length ?
      '<div class="g-hub-label">extra cards</div>' +
      '<div class="ti-list">' + cards.map(x =>
        '<div class="ti-row">' + czFace({ img: x.c.img }) + '<span class="ti-nm">' + esc(x.c.name) + ' <i>' + KP_RARITY[x.c.rar].label + ' &middot; x' + x.extra + '</i></span>' +
        '<button class="q-btn ti-btn" onclick="tiCard(\'' + esc(x.c.id) + '\')">trade · ' + TI_CARD[x.c.rar] + '</button></div>').join('') + '</div>' +
      '<div class="q-actions"><button class="q-btn ghost" onclick="tiAllCards()">trade all extras · ' + extraTot + '</button></div>' : '') +
    '<div class="g-hub-label">songs</div>' +
    '<div class="ti-list">' + songs.map((t, i) => {
      const done = st.songs.includes(t.id), c = cz2Cover(t);
      return '<div class="ti-row' + (done ? ' done' : '') + '"><span class="ti-rank">#' + (i + 1) + '</span>' +
        (c ? '<img class="ti-cov" src="' + c + '" alt="">' : '') +
        '<span class="ti-nm">' + esc(qStrip(t.name)) + ' <i>' + esc(gPrimary(t)) + '</i></span>' +
        (done ? '<span class="ti-done">traded</span>' : '<button class="q-btn ti-btn" id="ti-s' + i + '" onclick="tiSong(' + i + ')">trade · ' + tiSongVal(i) + '</button>') +
      '</div>';
    }).join('') + '</div>'
  );
}

function tiSong(i) {
  const t = cz2Pool()[i]; if (!t) return;
  const st = tiState();
  if (st.songs.includes(t.id)) return;
  st.songs.push(t.id); a5Put(TI_KEY, st);
  const v = tiSongVal(i);
  czAdd(v);
  const b = czEl('ti-s' + i);
  if (b) { const row = b.parentNode; row.classList.add('done'); b.outerHTML = '<span class="ti-done">traded</span>'; }
  czMsg(esc(qStrip(t.name)) + ' &middot; +' + v + ' 🪙', 'three');
}

function tiCard(id) {
  const col = kpColLoad(), c = kpCardSet().find(x => x.id === id);
  if (!c || (col.owned[id] || 0) < 2) return;
  col.owned[id]--; kpColSave(col);
  czAdd(TI_CARD[c.rar]);
  tiScreen();
  czMsg(esc(c.name) + ' card &middot; +' + TI_CARD[c.rar] + ' 🪙', 'three');
}

function tiAllCards() {
  const col = kpColLoad(); let tot = 0;
  for (const x of tiCards()) { tot += x.extra * TI_CARD[x.c.rar]; col.owned[x.c.id] = 1; }
  if (!tot) return;
  kpColSave(col); czAdd(tot);
  tiScreen();
  czMsg('all extras &middot; +' + tot + ' 🪙', 'jackpot');
  czBoom(tot >= 300);
}

// ======================== HUB ========================

CZ_HUB.push(
  () => xCard('⏭️', 'no skips', 'flip songs, dodge the skips', 'nsOpen()'),
  () => xCard('↕️', 'higher or lower', 'guess the next track number', 'hlOpen()'),
  () => xCard('🎤', 'setlist', 'pick songs, see who makes the show', 'slOpen()'),
  () => xCard('🔻', 'plinko', 'every peg is a note', 'pkOpen()'),
  () => xCard('💱', 'trade-in', 'swap songs + extra cards for coins', 'tiOpen()')
);

Object.assign(window, {
  nsOpen, nsSetSkips, nsGo, nsFlip, hlOpen, hlGo, hlGuess, slOpen, slScreen, slToggle, slGo,
  pkOpen, pkDrop, tiOpen, tiSong, tiCard, tiAllCards,
});
