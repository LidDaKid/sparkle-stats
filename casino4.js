// ============================================================
//  xXx SparkleStats xXx  -  casino4.js
//  high roller room: double or nothing, the tower, needle drop, mega wheel.
//  plus bigger chips everywhere. loads after casino3.js.
// ============================================================

const CZ4 = { dn: null, tw: null, nd: null, mw: null, twMode: 'hard', ndChance: 50 };

// high roller chips on every casino game
(function () {
  const i = CZ_CHIPS.indexOf('all');
  CZ_CHIPS.splice(i < 0 ? CZ_CHIPS.length : i, 0, 250, 500, 1000);
})();

function cz4Stats() { return a5Get('sparkle_cz4', { dnBest: 0, twBest: 0, ndBest: 0, mwBest: 0 }); }
function cz4Best(key, v) { const s = cz4Stats(); if (v > (s[key] || 0)) { s[key] = v; a5Put('sparkle_cz4', s); } }
function cz4Fix(x) { return Math.floor(x * 100 + 1e-6) / 100; }
function cz4Pay(x) { return Math.floor(x + 1e-6); }

// ======================== DOUBLE OR NOTHING ========================
// a coin with two of your artists on it. call it right and the pot doubles. keep going or cash out

const DN_MULT = 1.94;
const DN_MAX = 20;
function dnMult(k) { return cz4Fix(Math.pow(DN_MULT, k)); }

function dnOpen() { a5Open(dnScreen); }

function dnScreen() {
  Q.screen = 'cz-dn';
  qStopAudio(); qClearTimers();
  const arts = czGate('double or nothing', 2);
  if (!arts) return;
  const two = qShuffle(arts.slice(0, 10)).slice(0, 2).map(czSym);
  CZ4.dn = { state: 'bet', sides: two, rot: 0, k: 0, stake: 0, busy: false };
  qSet(
    czHead('double or nothing') +
    '<div class="dn-stage"><div class="dn-coin" id="dn-coin">' +
      '<div class="dn-face front">' + dnFaceHtml(two[0]) + '</div>' +
      '<div class="dn-face back">' + dnFaceHtml(two[1]) + '</div>' +
    '</div></div>' +
    '<div class="cn-status" id="dn-next"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions" id="dn-acts"></div>'
  );
  dnUpd();
}

function dnFaceHtml(s) {
  return (s.img ? '<img src="' + s.img + '" alt="">' : '<span>🎵</span>') + '<b>' + esc(s.name) + '</b>';
}

function dnUpd() {
  const D = CZ4.dn; if (!D) return;
  const acts = czEl('dn-acts'), nx = czEl('dn-next');
  const pick = (j) => '<button class="q-btn" onclick="dnFlip(' + j + ')"' + (D.busy ? ' disabled' : '') + '>' + esc(D.sides[j].name) + '</button>';
  let h = pick(0) + pick(1);
  if (D.state === 'play' && D.k > 0) h += '<button class="q-btn cash" onclick="dnCash()"' + (D.busy ? ' disabled' : '') + '>cash out &middot; ' + cz4Pay(D.stake * dnMult(D.k)) + '</button>';
  if (acts) acts.innerHTML = h;
  if (nx) nx.innerHTML = D.state === 'play'
    ? 'pot <b>' + cz4Pay(D.stake * dnMult(D.k)) + '</b> &middot; next <b>' + cz4Pay(D.stake * dnMult(D.k + 1)) + '</b> &middot; streak ' + D.k
    : '';
}

function dnFlip(j) {
  const D = CZ4.dn; if (!D || D.busy) return;
  if (D.state !== 'play') {
    const amt = czAmt();
    if (!czTake(amt)) { czMsg('not enough coins'); return; }
    Object.assign(D, { state: 'play', stake: amt, k: 0 });
    czLock(true);
  }
  D.busy = true; qStopAudio(); czMsg('');
  const land = Math.random() < 0.5 ? 0 : 1;
  const base = Math.ceil((D.rot + 1800) / 360) * 360;
  D.rot = base + (land ? 180 : 0);
  const coin = czEl('dn-coin');
  if (coin) { coin.style.transition = 'transform 1.4s cubic-bezier(.2,.7,.2,1)'; coin.style.transform = 'rotateY(' + D.rot + 'deg)'; }
  dnUpd();
  setTimeout(() => {
    if (CZ4.dn !== D) return;
    D.busy = false;
    if (land !== j) {
      D.state = 'bet';
      czLock(false);
      czScratch();
      czMsg('it was ' + esc(D.sides[land].name) + ' &middot; -' + D.stake + ' 🪙', 'none');
      dnUpd();
      return;
    }
    D.k++;
    cz2Pluck(330 + D.k * 30, 0.12);
    cz4Best('dnBest', D.k);
    if (D.k >= DN_MAX) { dnCash(); return; }
    czMsg(esc(D.sides[land].name) + '! &middot; ×' + dnMult(D.k), D.k >= 5 ? 'jackpot' : 'three');
    if (D.k >= 5) czBoom(D.k >= 8);
    dnUpd();
  }, 1450);
}

function dnCash() {
  const D = CZ4.dn; if (!D || D.busy || D.state !== 'play' || !D.k) return;
  const won = cz4Pay(D.stake * dnMult(D.k));
  czWin(won);
  D.state = 'bet';
  czLock(false);
  czMsg('cashed out ' + D.k + ' in a row &middot; +' + won + ' 🪙', D.k >= 4 ? 'jackpot' : 'three');
  if (D.k >= 3) czBoom(D.k >= 6);
  dnUpd();
  const pool = cz2Pool().filter(t => t.artists && t.artists.some(a => D.sides.some(s => s.name === a.name)));
  if (pool.length) czPlayFrom(pool, () => Q.screen === 'cz-dn' && CZ4.dn === D && D.state === 'bet');
}

// ======================== THE TOWER ========================
// climb 8 floors. each floor hides a scratched record. extreme = 2 scratched out of 3

const TW_FLOORS = 8;
const TW_MODES = [
  { k: 'easy', n: 4, bad: 1 },
  { k: 'hard', n: 3, bad: 1 },
  { k: 'extreme', n: 3, bad: 2 },
];
function twMode() { return TW_MODES.find(m => m.k === CZ4.twMode) || TW_MODES[1]; }
function twMult(f, m) { return f ? cz4Fix(0.97 * Math.pow(m.n / (m.n - m.bad), f)) : 1; }

function twOpen() { a5Open(twScreen); }

function twScreen() {
  Q.screen = 'cz-tw';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('the tower', 16, pool)) return;
  CZ4.tw = { state: 'bet', pool, floor: 0, stake: 0, last: null };
  qSet(
    czHead('the tower') +
    '<div class="ns-opts" id="tw-opts">' + TW_MODES.map(m => '<button class="cz-pill' + (m.k === CZ4.twMode ? ' on' : '') + '" data-m="' + m.k + '" onclick="twSetMode(\'' + m.k + '\')">' + m.k + '</button>').join('') + '</div>' +
    '<div class="tw-tower" id="tw-tower"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="tw-go" onclick="twGo()">start</button></div>'
  );
  twDraw();
}

function twSetMode(k) {
  const T = CZ4.tw; if (!T || T.state === 'play') return;
  CZ4.twMode = k;
  document.querySelectorAll('#tw-opts .cz-pill').forEach(b => b.classList.toggle('on', b.dataset.m === k));
  twDraw();
}

function twDraw() {
  const T = CZ4.tw, box = czEl('tw-tower'); if (!T || !box) return;
  const m = T.mode || twMode();
  let h = '';
  for (let f = TW_FLOORS - 1; f >= 0; f--) {
    const row = T.rows && T.rows[f];
    const cls = T.state === 'play' && f === T.floor ? ' live' : f < T.floor ? ' done' : '';
    h += '<div class="tw-floor' + cls + '"><span class="tw-m">×' + twMult(f + 1, m) + '</span><div class="tw-slots">';
    for (let i = 0; i < m.n; i++) {
      let inner = '', c = 'tw-slot';
      if (row && row.open[i]) {
        if (row.bad.has(i)) { c += ' bad' + (row.pick === i ? ' hit' : ' dim'); inner = '<span>✕</span>'; }
        else { const cv = cz2Cover(row.songs[i]); c += ' good' + (row.pick === i ? '' : ' dim'); inner = cv ? '<img src="' + cv + '" alt="">' : '<span>♫</span>'; }
      }
      const live = T.state === 'play' && f === T.floor;
      h += '<button class="' + c + '" onclick="twPick(' + f + ',' + i + ')"' + (live ? '' : ' disabled') + '>' + inner + '</button>';
    }
    h += '</div></div>';
  }
  box.innerHTML = h;
  const go = czEl('tw-go');
  if (go) {
    const can = T.state === 'play' && T.floor > 0;
    go.textContent = T.state === 'play' ? (can ? 'cash out · ' + cz4Pay(T.stake * twMult(T.floor, m)) : 'pick a record') : 'start';
    go.disabled = T.state === 'play' && !can;
    go.classList.toggle('cash', can);
  }
}

function twGo() {
  const T = CZ4.tw; if (!T) return;
  if (T.state === 'play') { twCash(); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  const m = twMode();
  const songs = qShuffle(T.pool);
  let k = 0;
  const rows = Array.from({ length: TW_FLOORS }, () => {
    const idx = qShuffle(Array.from({ length: m.n }, (_, i) => i));
    const bad = new Set(idx.slice(0, m.bad));
    const s = {};
    for (let i = 0; i < m.n; i++) if (!bad.has(i)) s[i] = songs[k++ % songs.length];
    return { bad, songs: s, open: {}, pick: -1 };
  });
  Object.assign(T, { state: 'play', stake: amt, floor: 0, mode: m, rows, last: null });
  document.querySelectorAll('#tw-opts .cz-pill').forEach(b => { b.disabled = true; });
  twDraw();
}

function twPick(f, i) {
  const T = CZ4.tw; if (!T || T.state !== 'play' || f !== T.floor) return;
  const row = T.rows[f];
  row.pick = i;
  for (let x = 0; x < T.mode.n; x++) row.open[x] = true;
  if (row.bad.has(i)) {
    T.state = 'over';
    czScratch(); qStopAudio();
    twReveal();
    czMsg('scratched on floor ' + (f + 1) + ' &middot; -' + T.stake + ' 🪙', 'none');
    twDone();
    return;
  }
  T.last = row.songs[i];
  T.floor++;
  cz2Pluck(300 + T.floor * 45, 0.12);
  if (T.floor >= TW_FLOORS) { twCash(); return; }
  twDraw();
}

function twReveal() {
  const T = CZ4.tw;
  T.rows.forEach(r => { for (let x = 0; x < T.mode.n; x++) r.open[x] = true; });
  twDraw();
}

function twCash() {
  const T = CZ4.tw; if (!T || T.state !== 'play' || !T.floor) return;
  T.state = 'over';
  const m = twMult(T.floor, T.mode), won = cz4Pay(T.stake * m);
  czWin(won); cz4Best('twBest', m);
  twReveal();
  czMsg((T.floor >= TW_FLOORS ? 'top of the tower' : 'cashed out on floor ' + T.floor) + ' &middot; ×' + m + ' &middot; +' + won + ' 🪙', m >= 5 ? 'jackpot' : 'three');
  if (m >= 3) czBoom(m >= 20);
  twDone();
  if (T.last) czPlayFrom([T.last], () => Q.screen === 'cz-tw' && CZ4.tw === T && T.state === 'over');
}

function twDone() {
  czLock(false);
  document.querySelectorAll('#tw-opts .cz-pill').forEach(b => { b.disabled = false; });
  const T = CZ4.tw; T.state = 'over';
  twDraw();
  const go = czEl('tw-go'); if (go) { go.textContent = 'again'; go.disabled = false; go.classList.remove('cash'); }
  T.state = 'bet';
}

// ======================== NEEDLE DROP ========================
// pick your odds. the needle drops somewhere in the song. land before your mark and you win

function ndMult(c) { return cz4Fix(97 / c); }

function ndOpen() { a5Open(ndScreen); }

function ndScreen() {
  Q.screen = 'cz-nd';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('needle drop', 5, pool)) return;
  CZ4.nd = { pool, busy: false, t: null };
  const c = CZ4.ndChance;
  qSet(
    czHead('needle drop') +
    '<div class="nd-song" id="nd-song"></div>' +
    '<div class="nd-track"><div class="nd-zone" id="nd-zone" style="width:' + c + '%"></div><div class="nd-needle" id="nd-needle"></div></div>' +
    '<div class="nd-roll" id="nd-roll">--</div>' +
    '<div class="nd-ctl"><input type="range" id="nd-chance" min="1" max="95" value="' + c + '" oninput="ndSet(this.value)">' +
      '<div class="nd-read"><span>win chance <b id="nd-c">' + c + '%</b></span><span>pays <b id="nd-m">×' + ndMult(c) + '</b></span></div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="nd-go" onclick="ndDrop()">drop the needle</button></div>'
  );
  ndSong();
}

function ndSong() {
  const N = CZ4.nd; if (!N) return;
  N.t = N.pool[Math.floor(Math.random() * N.pool.length)];
  const el = czEl('nd-song'), cv = cz2Cover(N.t);
  if (el) el.innerHTML = (cv ? '<img src="' + cv + '" alt="">' : '') + '<div><b>' + esc(qStrip(N.t.name)) + '</b><span>' + esc((N.t.artists || []).map(a => a.name).join(', ')) + '</span></div>';
}

function ndSet(v) {
  const N = CZ4.nd; if (N && N.busy) return;
  const c = Math.max(1, Math.min(95, Math.round(+v) || 50));
  CZ4.ndChance = c;
  const z = czEl('nd-zone'); if (z) z.style.width = c + '%';
  const a = czEl('nd-c'); if (a) a.textContent = c + '%';
  const b = czEl('nd-m'); if (b) b.textContent = '×' + ndMult(c);
}

function ndDrop() {
  const N = CZ4.nd; if (!N || N.busy) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  N.busy = true; qStopAudio(); czMsg(''); czLock(true);
  const c = CZ4.ndChance;
  const sl = czEl('nd-chance'); if (sl) sl.disabled = true;
  const go = czEl('nd-go'); if (go) go.disabled = true;
  const roll = Math.floor(Math.random() * 10000) / 100;   // 0.00 - 99.99
  const nd = czEl('nd-needle'), rl = czEl('nd-roll');
  if (nd) { nd.style.transition = 'none'; nd.style.left = '0%'; void nd.offsetWidth; nd.style.transition = 'left 1.1s cubic-bezier(.2,.8,.25,1)'; nd.style.left = roll + '%'; }
  const t0 = performance.now();
  const spin = () => {
    if (CZ4.nd !== N) return;
    const p = Math.min(1, (performance.now() - t0) / 1100);
    if (rl) rl.textContent = (p < 1 ? (Math.random() * 100) : roll).toFixed(2);
    if (p < 1) requestAnimationFrame(spin);
  };
  requestAnimationFrame(spin);
  setTimeout(() => {
    if (CZ4.nd !== N) return;
    if (rl) rl.textContent = roll.toFixed(2);
    const win = roll < c;
    if (win) {
      const m = ndMult(c), won = cz4Pay(amt * m);
      czWin(won); cz4Best('ndBest', m);
      czMsg(roll.toFixed(2) + ' &middot; under ' + c + ' &middot; +' + won + ' 🪙', m >= 10 ? 'jackpot' : 'three');
      if (m >= 4) czBoom(m >= 20);
      if (rl) rl.className = 'nd-roll win';
      const t = N.t;
      czPlayFrom([t], () => Q.screen === 'cz-nd' && CZ4.nd === N && !N.busy);
    } else {
      czScratch();
      czMsg(roll.toFixed(2) + ' &middot; over ' + c + ' &middot; -' + amt + ' 🪙', 'none');
      if (rl) rl.className = 'nd-roll lose';
    }
    N.busy = false; czLock(false);
    if (sl) sl.disabled = false;
    if (go) { go.disabled = false; go.textContent = 'again'; }
    if (!win) ndSong();
    else setTimeout(() => { if (CZ4.nd === N && !N.busy) ndSong(); }, 50);
  }, 1150);
}

// ======================== MEGA WHEEL ========================
// mostly nothing. sometimes ×50

const MW_SEQ = [0, 1.5, 2, 0, 1.5, 5, 0, 2, 1.5, 0, 50, 0, 1.5, 2, 0, 10, 1.5, 0, 2, 5, 0, 1.5];
const MW_P = { 1.5: 0.22 / 6, 2: 0.12 / 4, 5: 0.04 / 2, 10: 0.012, 50: 0.0014 };
const MW_COL = { 0: '#140a10', 1.5: '#5a1a3a', 2: '#d6136f', 5: '#b266ff', 10: '#ff69b4', 50: '#FFD700' };
function mwSegs() {
  const rest = 1 - Object.keys(MW_P).reduce((s, k) => s + MW_P[k] * MW_SEQ.filter(m => m === +k).length, 0);
  const zeroes = MW_SEQ.filter(m => m === 0).length;
  let a = 0;
  return MW_SEQ.map(m => { const p = m ? MW_P[m] : rest / zeroes, s = { m, p, from: a }; a += p * 360; s.to = a; return s; });
}
function mwRtp() { return mwSegs().reduce((s, x) => s + x.p * x.m, 0); }

function mwOpen() { a5Open(mwScreen); }

function mwScreen() {
  Q.screen = 'cz-mw';
  qStopAudio(); qClearTimers();
  const segs = mwSegs();
  CZ4.mw = { segs, rot: 0, spinning: false };
  const grad = 'conic-gradient(' + segs.map(x => MW_COL[x.m] + ' ' + x.from + 'deg ' + x.to + 'deg').join(',') + ')';
  qSet(
    czHead('mega wheel') +
    '<div class="rl-stage mw-stage"><div class="rl-ptr"></div><div class="rl-wheel" id="mw-wheel" style="background:' + grad + '">' +
      segs.filter(x => x.to - x.from >= 7).map(x => '<div class="rl-lab ds-lab mw-lab" style="transform:translate(-50%,-50%) rotate(' + ((x.from + x.to) / 2) + 'deg) translateY(calc(var(--wsz) * -0.38))">' + (x.m ? '×' + x.m : '0') + '</div>').join('') +
      '<div class="rl-hub"></div></div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="mw-go" onclick="mwSpin()">spin</button></div>' +
    '<div class="sm-pay mw-pay">' + [50, 10, 5, 2, 1.5].map(m => {
      const p = mwSegs().filter(x => x.m === m).reduce((s, x) => s + x.p, 0);
      return '<div><span class="mw-dot" style="background:' + MW_COL[m] + '"></span><b>×' + m + '</b> <span>' + (p * 100 < 1 ? (p * 100).toFixed(2) : Math.round(p * 100)) + '%</span></div>';
    }).join('') + '</div>'
  );
}

function mwSpin() {
  const W = CZ4.mw; if (!W || W.spinning) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  W.spinning = true; qStopAudio(); czMsg(''); czLock(true);
  const go = czEl('mw-go'); if (go) go.disabled = true;
  const j = rlPickSeg(W.segs);
  W.rot = rlRotFor(W.rot, j, W.segs, 0.15 + Math.random() * 0.7, 6);
  const w = czEl('mw-wheel');
  if (w) { w.style.transition = 'transform 5.2s cubic-bezier(.12,.62,.16,1)'; w.style.transform = 'rotate(' + W.rot + 'deg)'; }
  setTimeout(() => {
    W.spinning = false;
    czLock(false);
    if (go) go.disabled = false;
    if (Q.screen !== 'cz-mw' || CZ4.mw !== W) return;
    const m = W.segs[j].m;
    if (!m) { czScratch(); czMsg('nothing &middot; -' + amt + ' 🪙', 'none'); return; }
    const won = cz4Pay(amt * m);
    czWin(won); cz4Best('mwBest', m);
    czMsg('×' + m + ' &middot; +' + won + ' 🪙', m >= 10 ? 'jackpot' : m >= 2 ? 'three' : 'pair');
    if (m >= 5) czBoom(m >= 10);
    if (m >= 2) czPlayFrom(cz2Pool().slice(0, m >= 10 ? 5 : 30), () => Q.screen === 'cz-mw' && CZ4.mw === W && !W.spinning);
  }, 5300);
}

// ======================== HUB ========================

CZ_HUB.push(
  () => xCard('🪙', 'double or nothing', 'call the coin. keep doubling', 'dnOpen()'),
  () => xCard('🗼', 'the tower', 'climb 8 floors. dodge the scratched records', 'twOpen()'),
  () => xCard('📍', 'needle drop', 'pick your odds, up to ×97', 'ndOpen()'),
  () => xCard('💥', 'mega wheel', 'mostly nothing. sometimes ×50', 'mwOpen()')
);

Object.assign(window, { dnOpen, dnFlip, dnCash, twOpen, twSetMode, twGo, twPick, ndOpen, ndSet, ndDrop, mwOpen, mwSpin });
