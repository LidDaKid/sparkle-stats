// ============================================================
//  xXx SparkleStats xXx  -  casino.js
//  scratch-offs, roulette, chart race, the drop, blackjack.
//  every game shares the slot machine's coin jar (sparkle_sm).
//  loads after arcade5.js (needs smState / a5 helpers).
// ============================================================

const CZ = { bet: 25, sc: null, rl: null, hr: null, dr: null, bj: null, ac: null };
const CZ_KEY = 'sparkle_cz';
const CZ_CHIPS = [10, 25, 50, 100, 'all'];

// ======================== SHARED ========================

function czEl(id) { return document.getElementById(id); }
function czStats() { return a5Get(CZ_KEY, { dropBest: 0, bjWins: 0, bigWin: 0 }); }
function czCoins() { return smState().coins; }
function czAdd(n) { const st = smState(); st.coins = Math.max(0, st.coins + n); a5Put(SM_KEY, st); czUpd(); return st.coins; }
function czWin(n) { czAdd(n); const s = czStats(); if (n > (s.bigWin || 0)) { s.bigWin = n; a5Put(CZ_KEY, s); } }
function czTake(n) {
  const st = smState();
  if (!(n > 0) || st.coins < n) return false;
  st.coins -= n; a5Put(SM_KEY, st); czUpd();
  return true;
}
function czAmt() { return CZ.bet === 'all' ? czCoins() : CZ.bet; }

function czRefillBtn() { return czCoins() < 10 ? '<button class="q-btn ghost cz-mini" onclick="czRefill()">refill +100</button>' : ''; }
function czRefill() { czAdd(100); }
function czBar() {
  return '<div class="sm-top cz-top"><span>🪙 <b id="cz-coins">' + czCoins() + '</b></span><span id="cz-refill">' + czRefillBtn() + '</span></div>';
}
function czUpd() {
  const c = czEl('cz-coins'); if (c) c.textContent = czCoins();
  const r = czEl('cz-refill'); if (r) r.innerHTML = czRefillBtn();
  czChipState();
}
function czBets() {
  return '<div class="cz-bets" id="cz-bets">' + CZ_CHIPS.map(v =>
    '<button class="cz-chip' + (String(CZ.bet) === String(v) ? ' on' : '') + '" data-v="' + v + '" onclick="czSetBet(\'' + v + '\')">' + (v === 'all' ? 'all in' : v) + '</button>'
  ).join('') + '</div>';
}
function czSetBet(v) { CZ.bet = v === 'all' ? 'all' : +v; czChipState(); }
function czChipState() {
  const box = czEl('cz-bets'); if (!box || !box.querySelectorAll) return;
  box.querySelectorAll('.cz-chip').forEach(b => b.classList.toggle('on', String(CZ.bet) === b.dataset.v));
}
function czLock(on) {
  const box = czEl('cz-bets'); if (!box || !box.querySelectorAll) return;
  box.querySelectorAll('.cz-chip').forEach(b => { b.disabled = on; });
}
function czMsg(html, cls) {
  const o = czEl('cz-out');
  if (o) o.innerHTML = html ? '<div class="sm-res ' + (cls || '') + ' fade-up">' + html + '</div><div id="cz-now"></div>' : '<div id="cz-now"></div>';
}
function czBoom(big) {
  if (typeof confetti === 'function') confetti({ particleCount: big ? 200 : 90, spread: 90, colors: ['#FF1493', '#FF69B4', '#FFD700'] });
}
function czSym(a) { return { name: a.name, img: a5ArtistImg(a) }; }
function czGate(title, n) {
  const arts = a5Artists();
  if (arts.length >= n) return arts;
  qSet(qTopBar('&larr; back', xBack()) + qHeader(title, '') + qErrorBox(a5LoggedIn() ? 'need a few more top artists first' : 'log in with spotify for this one'));
  return null;
}
function czHead(title) { return qTopBar('&larr; back', xBack()) + qHeader(title, '') + czBar(); }
function czFace(s, cls) {
  return '<span class="cz-face ' + (cls || '') + '">' + (s.img ? '<img src="' + s.img + '" alt="">' : '<span>🎵</span>') + '</span>';
}

// plays one clip from these tracks while ok() stays true
async function czPlayFrom(tracks, ok) {
  for (const t of qShuffle(tracks || []).slice(0, 3)) {
    let url = null;
    try { url = await qFindPreview(t); } catch {}
    if (!ok()) return;
    if (!url) continue;
    qPlayClip(url);
    const now = czEl('cz-now');
    if (now) now.innerHTML = '<div class="q-note">▶ ' + esc(qStrip(t.name)) + ' &middot; <a href="#" onclick="qStopAudio();this.parentNode.remove();return false;">stop</a></div>';
    return;
  }
}

// a record scratch, made from filtered noise
function czScratch() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = CZ.ac || (CZ.ac = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const t = ctx.currentTime;
    src.playbackRate.setValueAtTime(0.5, t);
    src.playbackRate.linearRampToValueAtTime(2.4, t + 0.12);
    src.playbackRate.linearRampToValueAtTime(0.3, t + 0.4);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0.6;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(t);
  } catch {}
}

// ======================== SCRATCH-OFFS ========================

const SC_COST = 20;
const SC_PAY = { top: 150, any: 50 };
const SC_WIN = 0.3;

// 9 cells from n symbols. a win has exactly one symbol 3 times, everything else at most twice
function scTicket(n, rnd) {
  rnd = rnd || Math.random;
  const win = rnd() < SC_WIN;
  const who = win ? (rnd() < 0.15 ? 0 : 1 + Math.floor(rnd() * (n - 1))) : -1;
  const counts = Array(n).fill(0), cells = [];
  if (win) { cells.push(who, who, who); counts[who] = 3; }
  while (cells.length < 9) {
    const opts = [];
    for (let i = 0; i < n; i++) if (i !== who && counts[i] < 2) opts.push(i);
    const p = opts[Math.floor(rnd() * opts.length)];
    counts[p]++; cells.push(p);
  }
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return { cells, who, prize: who < 0 ? 0 : who === 0 ? SC_PAY.top : SC_PAY.any };
}

function scOpen() { a5Open(scScreen); }

function scScreen() {
  Q.screen = 'cz-sc';
  qStopAudio(); qClearTimers();
  const arts = czGate('scratch-offs', 5); if (!arts) return;
  const syms = arts.slice(0, 6).map(czSym);
  CZ.sc = { syms, t: null, done: true };
  qSet(
    czHead('scratch-offs') +
    '<div class="sc-wrap" id="sc-wrap"><div class="sc-blank">xXx scratch-off xXx</div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" id="sc-buy" onclick="scBuy()">buy ticket &middot; ' + SC_COST + '</button>' +
      '<button class="q-btn ghost" id="sc-rev" onclick="scReveal()" style="display:none">reveal</button>' +
    '</div>' +
    '<div class="sm-pay">' +
      '<div>' + smCell(syms[0]) + '<b>×3 = ' + SC_PAY.top + '</b></div>' +
      '<div><span class="sm-any">any ×3</span><b>' + SC_PAY.any + '</b></div>' +
    '</div>'
  );
}

function scBuy() {
  const S = CZ.sc;
  if (!S || !S.done) return;
  if (!czTake(SC_COST)) { czMsg('not enough coins'); return; }
  qStopAudio();
  S.t = scTicket(S.syms.length);
  S.done = false;
  const wrap = czEl('sc-wrap');
  wrap.innerHTML = '<div class="sc-grid">' + S.t.cells.map((i, k) => '<div class="sc-cell" id="sc-c' + k + '">' + smCell(S.syms[i]) + '</div>').join('') + '</div>' +
    '<canvas class="sc-foil" id="sc-foil"></canvas>';
  czMsg('');
  czEl('sc-buy').style.display = 'none';
  czEl('sc-rev').style.display = '';
  scFoil();
}

function scFoil() {
  const wrap = czEl('sc-wrap'), cv = czEl('sc-foil');
  if (!wrap || !cv || !cv.getContext) return;
  const w = wrap.clientWidth || 300, h = wrap.clientHeight || 300;
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#c9c3cc'); grad.addColorStop(0.45, '#f2d7e6'); grad.addColorStop(0.55, '#b8aebc'); grad.addColorStop(1, '#e8c1d6');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,20,147,0.35)';
  for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 2.2 + 0.6, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(60,20,40,0.55)'; g.font = 'bold ' + Math.round(w / 12) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('★ scratch ★', w / 2, h / 2);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(28, w / 9);
  let down = false, last = null, moves = 0;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)];
  };
  const rub = p => {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo((last || p)[0], (last || p)[1]); g.lineTo(p[0] + 0.1, p[1]); g.stroke();
    last = p;
    if (++moves % 10 === 0) scCheck();
  };
  cv.onpointerdown = e => { down = true; last = null; try { cv.setPointerCapture(e.pointerId); } catch {} rub(pt(e)); e.preventDefault(); };
  cv.onpointermove = e => { if (down) rub(pt(e)); };
  cv.onpointerup = cv.onpointercancel = () => { down = false; last = null; scCheck(); };
}

function scCheck() {
  const S = CZ.sc, cv = czEl('sc-foil');
  if (!S || S.done || !cv) return;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let clear = 0, n = 0;
  for (let i = 3; i < d.length; i += 64) { n++; if (d[i] < 40) clear++; }
  if (n && clear / n > 0.6) scReveal();
}

function scReveal() {
  const S = CZ.sc;
  if (!S || S.done || !S.t) return;
  S.done = true;
  const cv = czEl('sc-foil'); if (cv) cv.classList.add('gone');
  czEl('sc-buy').style.display = '';
  czEl('sc-rev').style.display = 'none';
  const t = S.t;
  if (t.who >= 0) {
    t.cells.forEach((i, k) => { if (i === t.who) { const c = czEl('sc-c' + k); if (c) c.classList.add('hit'); } });
    czWin(t.prize);
    czMsg((t.who === 0 ? 'top artist ×3' : 'three of a kind') + ' &middot; +' + t.prize + ' 🪙', t.who === 0 ? 'jackpot' : 'three');
    czBoom(t.who === 0);
    czPlayFrom(a5TracksBy(S.syms[t.who].name), () => Q.screen === 'cz-sc' && CZ.sc === S && S.done);
  } else {
    czMsg('no match', 'none');
  }
}

// ======================== ROULETTE ========================

const RL_PAY = { artist: 5, color: 2 };

function rlSegs(k) { return Array.from({ length: 2 * k }, (_, j) => ({ who: j % k, color: j % 2 ? 'black' : 'pink' })); }
function rlHit(pick, seg) { return pick === 'a' + seg.who || pick === seg.color; }
function rlMult(pick) { return pick && pick[0] === 'a' ? RL_PAY.artist : RL_PAY.color; }
// rotation that puts segment j (plus jitter in degrees) under the top pointer, always spinning forward
function rlRotFor(cur, j, S, jitter, turns) {
  const a = 360 / S;
  const target = -(j * a + a / 2 + (jitter || 0));
  const delta = (((target - cur) % 360) + 360) % 360;
  return cur + 360 * (turns == null ? 5 : turns) + delta;
}
function rlSegAt(rot, S) {
  const a = 360 / S;
  const phi = (((-rot) % 360) + 360) % 360;
  return Math.floor(phi / a) % S;
}

function rlWheel(syms, segs, rot, id) {
  const S = segs.length, a = 360 / S;
  const grad = 'conic-gradient(' + segs.map((s, j) => (s.color === 'pink' ? '#d6136f' : '#140a10') + ' ' + (j * a) + 'deg ' + ((j + 1) * a) + 'deg').join(',') + ')';
  return '<div class="rl-stage"><div class="rl-ptr"></div>' +
    '<div class="rl-wheel" id="' + (id || 'rl-wheel') + '" style="background:' + grad + ';transform:rotate(' + rot + 'deg)">' +
      segs.map((s, j) => '<div class="rl-lab" style="transform:translate(-50%,-50%) rotate(' + (j * a + a / 2) + 'deg) translateY(calc(var(--wsz) * -0.35))">' + czFace(syms[s.who]) + '</div>').join('') +
      '<div class="rl-hub"></div>' +
    '</div></div>';
}
function rlPickBtns(syms, pick, fn) {
  return '<div class="rl-picks" id="rl-picks">' +
    syms.map((s, i) => '<button class="rl-pick' + (pick === 'a' + i ? ' on' : '') + '" data-p="a' + i + '" onclick="' + fn + '(\'a' + i + '\')">' + czFace(s) + '<span>' + esc(s.name) + '</span><b>×' + RL_PAY.artist + '</b></button>').join('') +
    '<button class="rl-pick pink' + (pick === 'pink' ? ' on' : '') + '" data-p="pink" onclick="' + fn + '(\'pink\')"><span>pink</span><b>×' + RL_PAY.color + '</b></button>' +
    '<button class="rl-pick black' + (pick === 'black' ? ' on' : '') + '" data-p="black" onclick="' + fn + '(\'black\')"><span>black</span><b>×' + RL_PAY.color + '</b></button>' +
  '</div>';
}
function rlMarkPick(pick) {
  const box = czEl('rl-picks'); if (!box || !box.querySelectorAll) return;
  box.querySelectorAll('.rl-pick').forEach(b => b.classList.toggle('on', b.dataset.p === pick));
}
function rlPickLabel(syms, pick) { return pick[0] === 'a' ? syms[+pick.slice(1)].name : pick; }

function rlOpen() { a5Open(rlScreen); }

function rlScreen() {
  Q.screen = 'cz-rl';
  qStopAudio(); qClearTimers();
  const arts = czGate('roulette', 3); if (!arts) return;
  const syms = arts.slice(0, 6).map(czSym);
  const segs = rlSegs(syms.length);
  const rot = (CZ.rl && CZ.rl.rot) || 0;
  CZ.rl = { syms, segs, rot, pick: CZ.rl && CZ.rl.pick && CZ.rl.syms.length === syms.length ? CZ.rl.pick : null, spinning: false };
  qSet(
    czHead('roulette') +
    rlWheel(syms, segs, rot) +
    '<div class="sm-out" id="cz-out"></div>' +
    rlPickBtns(syms, CZ.rl.pick, 'rlPick') +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="rl-go" onclick="rlSpin()">spin</button></div>'
  );
}

function rlPick(p) { const R = CZ.rl; if (!R || R.spinning) return; R.pick = p; rlMarkPick(p); }

function rlSpin() {
  const R = CZ.rl;
  if (!R || R.spinning) return;
  if (!R.pick) { czMsg('pick something to bet on'); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  R.spinning = true; R.stake = amt;
  qStopAudio(); czMsg(''); czLock(true);
  const go = czEl('rl-go'); if (go) go.disabled = true;
  const S = R.segs.length;
  const j = Math.floor(Math.random() * S);
  R.rot = rlRotFor(R.rot, j, S, (Math.random() - 0.5) * (360 / S) * 0.7);
  const w = czEl('rl-wheel');
  if (w) { w.style.transition = 'transform 4.6s cubic-bezier(.12,.62,.16,1)'; w.style.transform = 'rotate(' + R.rot + 'deg)'; }
  setTimeout(() => rlLanded(R, j), 4700);
}

function rlLanded(R, j) {
  if (CZ.rl !== R || Q.screen !== 'cz-rl') return;
  R.spinning = false;
  czLock(false);
  const go = czEl('rl-go'); if (go) go.disabled = false;
  const seg = R.segs[j], s = R.syms[seg.who];
  if (rlHit(R.pick, seg)) {
    const mult = rlMult(R.pick), win = R.stake * mult;
    czWin(win);
    czMsg(esc(s.name) + ' &middot; ' + seg.color + ' &middot; +' + win + ' 🪙', mult === RL_PAY.artist ? 'jackpot' : 'three');
    czBoom(mult === RL_PAY.artist);
  } else {
    czMsg(esc(s.name) + ' &middot; ' + seg.color, 'none');
  }
  czPlayFrom(a5TracksBy(s.name), () => Q.screen === 'cz-rl' && CZ.rl === R && !R.spinning);
}

// ======================== CHART RACE ========================

const HR_N = 5;
const HR_MS = 6500;

// racers from her artists; the higher they rank, the better their odds
function hrLineup(arts, rnd) {
  rnd = rnd || Math.random;
  const pool = arts.slice(0, 10).map((a, idx) => ({ a, idx }));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const pick = pool.slice(0, Math.min(HR_N, pool.length)).sort((x, y) => x.idx - y.idx);
  const w = pick.map(p => 1 / (p.idx + 3));
  const tot = w.reduce((s, x) => s + x, 0);
  return pick.map((p, i) => {
    const prob = w[i] / tot;
    return Object.assign(czSym(p.a), { p: prob, mult: Math.max(1.5, Math.floor(0.92 / prob * 10) / 10) });
  });
}
function hrWinner(racers, rnd) {
  let r = (rnd || Math.random)();
  for (let i = 0; i < racers.length; i++) { r -= racers[i].p; if (r < 0) return i; }
  return racers.length - 1;
}
// cumulative progress knots, winner ends on 1, everyone else short of the line
function hrPaths(n, win, rnd) {
  rnd = rnd || Math.random;
  const K = 10;
  return Array.from({ length: n }, (_, i) => {
    const fin = i === win ? 1 : 0.8 + rnd() * 0.17;
    const cum = [0];
    for (let k = 0; k < K; k++) cum.push(cum[k] + 0.4 + rnd());
    return cum.map(c => c / cum[K] * fin);
  });
}
function hrAt(path, u) {
  const K = path.length - 1, x = Math.min(K, Math.max(0, u * K)), k = Math.min(K - 1, Math.floor(x));
  return path[k] + (path[k + 1] - path[k]) * (x - k);
}
function hrLanes(racers, pick, fn) {
  return '<div class="hr-track">' + racers.map((r, i) =>
    '<button class="hr-lane' + (pick === i ? ' on' : '') + '" id="hr-l' + i + '" onclick="' + fn + '(' + i + ')">' +
      '<span class="hr-top"><span class="hr-name">' + esc(r.name) + '</span><span class="hr-odds">×' + r.mult + '</span></span>' +
      '<span class="hr-run"><span class="hr-dot" id="hr-d' + i + '">' + czFace(r) + '</span></span>' +
    '</button>').join('') + '</div>';
}
function hrMove(i, x) { const d = czEl('hr-d' + i); if (d) d.style.left = 'calc(' + (x * 100).toFixed(2) + '% - ' + (x * 40).toFixed(1) + 'px)'; }
function hrMarkPick(n, pick) { for (let i = 0; i < n; i++) { const l = czEl('hr-l' + i); if (l) l.classList.toggle('on', i === pick); } }
// runs the animation, then done()
function hrAnimate(paths, live, done) {
  const t0 = performance.now();
  const step = () => {
    if (!live()) return;
    const u = Math.min(1, (performance.now() - t0) / HR_MS);
    let lead = 0, best = -1;
    paths.forEach((p, i) => { const x = hrAt(p, u); hrMove(i, x); if (x > best) { best = x; lead = i; } });
    paths.forEach((_, i) => { const l = czEl('hr-l' + i); if (l) l.classList.toggle('lead', i === lead); });
    if (u < 1) requestAnimationFrame(step); else done();
  };
  requestAnimationFrame(step);
}

function hrOpen() { a5Open(hrScreen); }

function hrScreen() {
  Q.screen = 'cz-hr';
  qStopAudio(); qClearTimers();
  const arts = czGate('chart race', 4); if (!arts) return;
  const racers = hrLineup(arts);
  CZ.hr = { racers, pick: -1, running: false, done: false };
  qSet(
    czHead('chart race') +
    hrLanes(racers, -1, 'hrPick') +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="hr-go" onclick="hrStart()">start race</button></div>'
  );
}

function hrPick(i) { const H = CZ.hr; if (!H || H.running || H.done) return; H.pick = i; hrMarkPick(H.racers.length, i); }

function hrStart() {
  const H = CZ.hr;
  if (!H || H.running) return;
  if (H.done) { hrScreen(); return; }
  if (H.pick < 0) { czMsg('pick a racer'); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  H.running = true; H.stake = amt;
  qStopAudio(); czMsg(''); czLock(true);
  const go = czEl('hr-go'); if (go) go.disabled = true;
  H.win = hrWinner(H.racers);
  const paths = hrPaths(H.racers.length, H.win);
  hrAnimate(paths, () => CZ.hr === H && Q.screen === 'cz-hr', () => hrDone(H));
}

function hrDone(H) {
  H.running = false; H.done = true;
  czLock(false);
  const go = czEl('hr-go'); if (go) { go.disabled = false; go.textContent = 'next race'; }
  const w = H.racers[H.win];
  const l = czEl('hr-l' + H.win); if (l) l.classList.add('win');
  if (H.pick === H.win) {
    const won = Math.floor(H.stake * w.mult);
    czWin(won);
    czMsg(esc(w.name) + ' wins &middot; +' + won + ' 🪙', 'three');
    czBoom(w.mult >= 5);
  } else {
    czMsg(esc(w.name) + ' wins', 'none');
  }
  czPlayFrom(a5TracksBy(w.name), () => Q.screen === 'cz-hr' && CZ.hr === H);
}

// ======================== THE DROP ========================
// a song plays, the multiplier climbs, cash out before it drops

const DR_K = 0.11;      // m = e^(k t)  ->  2x at ~6s, 10x at ~21s
const DR_EDGE = 0.96;
const DR_MAX = 29;      // clips are 30s; cash out for you at the end

function drCrashPoint(rnd) { const u = (rnd || Math.random)(); return Math.max(1, Math.floor(100 * DR_EDGE / (1 - u)) / 100); }
function drMult(t) { return Math.exp(DR_K * t); }

function drOpen() { a5Open(drScreen); }

function drScreen() {
  Q.screen = 'cz-dr';
  qStopAudio(); qClearTimers();
  if (!a5LoggedIn() || qPoolFromTop().length < 5) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('the drop', '') + qErrorBox(a5LoggedIn() ? 'need a few more top songs first' : 'log in with spotify for this one'));
    return;
  }
  CZ.dr = { state: 'idle' };
  qSet(
    czHead('the drop') +
    '<div class="dr-stage"><canvas id="dr-cv" class="dr-cv" width="600" height="240"></canvas>' +
      '<div class="dr-mult" id="dr-mult">1.00×</div><div class="dr-song" id="dr-song"></div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="dr-go" onclick="drGo()">drop it</button></div>' +
    '<div class="sm-pay"><div><span class="sm-any">best cash out</span><b id="dr-best">' + (czStats().dropBest || 0).toFixed(2) + '×</b></div></div>'
  );
  drDraw(0, 1, false);
}

function drBtn(txt, dis) { const b = czEl('dr-go'); if (b) { b.textContent = txt; b.disabled = !!dis; b.classList.toggle('cash', txt === 'cash out'); } }

async function drGo() {
  const cur = CZ.dr;
  if (!cur) return;
  if (cur.state === 'run') { drCash(); return; }
  if (cur.state === 'load') return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  const R = { state: 'load', stake: amt, crash: drCrashPoint(), m: 1 };
  CZ.dr = R;
  qStopAudio(); czMsg(''); czLock(true);
  drBtn('loading...', true);
  const mEl = czEl('dr-mult'); if (mEl) { mEl.textContent = '1.00×'; mEl.className = 'dr-mult'; }
  drDraw(0, 1, false);
  let url = null, track = null;
  for (const t of qShuffle(qPoolFromTop()).slice(0, 6)) {
    try { url = await qFindPreview(t); } catch { url = null; }
    if (CZ.dr !== R || Q.screen !== 'cz-dr') return;
    if (url) { track = t; break; }
  }
  if (!url) {
    czAdd(amt); R.state = 'idle'; czLock(false); drBtn('drop it');
    czMsg('no clip came back, try again');
    return;
  }
  const cover = track.album && track.album.images && (track.album.images[1] || track.album.images[0]);
  const song = czEl('dr-song');
  if (song) song.innerHTML = (cover ? '<img src="' + cover.url + '" alt="">' : '') + '<span>' + esc(qStrip(track.name)) + ' &middot; ' + esc(gPrimary(track)) + '</span>';
  qPlayClip(url);
  const start = () => {
    if (R.t0 || CZ.dr !== R || Q.screen !== 'cz-dr') return;
    R.t0 = performance.now(); R.state = 'run';
    drBtn('cash out');
    requestAnimationFrame(() => drTick(R));
  };
  czWhenPlaying(start);
}

// starts the meter once the clip is actually playing (or after 2.5s with no sound)
function czWhenPlaying(start) {
  const asked = performance.now();
  if (Q.audio && Q.audio.addEventListener) { Q.audio.addEventListener('playing', start, { once: true }); Q.audio.addEventListener('timeupdate', start, { once: true }); }
  const wait = () => {
    if (performance.now() - asked > 2500 || (Q.audio && Q.audio.currentTime > 0 && !Q.audio.paused)) { start(); return; }
    requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
  setTimeout(start, 2500);
}

function drTick(R) {
  if (CZ.dr !== R || R.state !== 'run') return;
  if (Q.screen !== 'cz-dr') { drCash(); return; }   // left mid-song: cash out for her
  const t = (performance.now() - R.t0) / 1000;
  const m = drMult(t);
  if (m >= R.crash) { drCrashed(R, t); return; }
  if (t >= DR_MAX) { drCash(); return; }
  R.m = m;
  const mEl = czEl('dr-mult');
  if (mEl) { mEl.textContent = m.toFixed(2) + '×'; mEl.classList.toggle('hot', m >= 2); mEl.classList.toggle('gold', m >= 5); }
  drDraw(t, m, false);
  requestAnimationFrame(() => drTick(R));
}

function drCash() {
  const R = CZ.dr;
  if (!R || R.state !== 'run') return;
  R.state = 'cashed';
  const won = Math.floor(R.stake * R.m);
  czWin(won);
  const s = czStats();
  if (R.m > (s.dropBest || 0)) { s.dropBest = R.m; a5Put(CZ_KEY, s); const b = czEl('dr-best'); if (b) b.textContent = R.m.toFixed(2) + '×'; }
  czMsg('cashed out at ' + R.m.toFixed(2) + '× &middot; +' + won + ' 🪙 <span class="dr-would">it dropped at ' + R.crash.toFixed(2) + '×</span>', R.m >= 5 ? 'jackpot' : 'three');
  if (R.m >= 3) czBoom(R.m >= 10);
  czLock(false); drBtn('drop it');
}

function drCrashed(R, t) {
  R.state = 'crashed';
  qStopAudio(); czScratch();
  const mEl = czEl('dr-mult');
  if (mEl) { mEl.textContent = R.crash.toFixed(2) + '×'; mEl.className = 'dr-mult dropped'; }
  drDraw(t, R.crash, true);
  czMsg('it dropped at ' + R.crash.toFixed(2) + '× &middot; -' + R.stake + ' 🪙', 'none');
  czLock(false); drBtn('drop it');
}

function drDraw(t, m, dead) {
  const cv = czEl('dr-cv');
  if (!cv || !cv.getContext) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, pad = 10;
  g.clearRect(0, 0, W, H);
  const tMax = Math.max(8, t * 1.15), mMax = Math.max(2, m * 1.15);
  const X = s => pad + (s / tMax) * (W - 2 * pad);
  const Y = v => H - pad - ((v - 1) / (mMax - 1)) * (H - 2 * pad);
  g.strokeStyle = 'rgba(255,105,180,0.12)'; g.lineWidth = 1;
  for (let v = 2; v < mMax; v *= 2) { g.beginPath(); g.moveTo(pad, Y(v)); g.lineTo(W - pad, Y(v)); g.stroke(); }
  if (t <= 0) return;
  g.beginPath(); g.moveTo(X(0), Y(1));
  const steps = 60;
  for (let i = 1; i <= steps; i++) { const s = t * i / steps; g.lineTo(X(s), Y(Math.min(m, drMult(s)))); }
  const col = dead ? '#777' : m >= 5 ? '#FFD700' : '#FF1493';
  g.strokeStyle = col; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = dead ? 0 : 14; g.stroke();
  g.shadowBlur = 0;
  g.lineTo(X(t), H - pad); g.lineTo(X(0), H - pad); g.closePath();
  const fill = g.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, dead ? 'rgba(120,120,120,0.25)' : 'rgba(255,20,147,0.35)'); fill.addColorStop(1, 'rgba(255,20,147,0)');
  g.fillStyle = fill; g.fill();
}

// ======================== BLACKJACK ========================
// the cards are her songs. value = track number on the album (track 1 = ace, past 10 counts 10)

function bjVal(t) { const n = (t && t.track_number) || 1; return n > 10 ? 10 : n; }
function bjTotal(cards) {
  let s = 0, ace = false;
  for (const c of cards) { const v = bjVal(c); s += v; if (v === 1) ace = true; }
  return ace && s + 10 <= 21 ? s + 10 : s;
}
function bjIsBJ(cards) { return cards.length === 2 && bjTotal(cards) === 21; }
// payout (stake included) for a finished hand
function bjSettle(p, d, stake, doubled) {
  const pt = bjTotal(p), dt = bjTotal(d), pbj = bjIsBJ(p) && !doubled, dbj = bjIsBJ(d);
  if (pt > 21) return { pay: 0, label: 'bust', cls: 'none' };
  if (pbj && dbj) return { pay: stake, label: 'push', cls: 'pair' };
  if (pbj) return { pay: Math.floor(stake * 2.5), label: 'blackjack', cls: 'jackpot' };
  if (dbj) return { pay: 0, label: 'dealer blackjack', cls: 'none' };
  if (dt > 21) return { pay: stake * 2, label: 'dealer busts', cls: 'three' };
  if (pt > dt) return { pay: stake * 2, label: 'you win', cls: 'three' };
  if (pt === dt) return { pay: stake, label: 'push', cls: 'pair' };
  return { pay: 0, label: 'dealer wins', cls: 'none' };
}
function bjCard(t, hidden) {
  if (hidden) return '<div class="bj-card back"><span>xXx</span></div>';
  const v = bjVal(t);
  const im = t.album && t.album.images && (t.album.images[1] || t.album.images[0]);
  return '<div class="bj-card fade-up">' + (im ? '<img src="' + im.url + '" alt="">' : '') +
    '<span class="bj-n">' + (v === 1 ? 'A' : v) + '</span>' +
    '<span class="bj-t"><span class="bj-tn">track ' + (t.track_number || 1) + '</span>' + esc(qStrip(t.name)) + '</span></div>';
}
function bjPool() { return a5LoggedIn() ? qPoolFromTop().filter(t => t && t.track_number) : []; }
function bjDraw(B) { if (!B.deck.length) B.deck = qShuffle(B.pool); return B.deck.pop(); }

function bjOpen() { a5Open(bjScreen); }

function bjScreen() {
  Q.screen = 'cz-bj';
  qStopAudio(); qClearTimers();
  const pool = bjPool();
  if (pool.length < 20) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('blackjack', '') + qErrorBox(a5LoggedIn() ? 'need a few more top songs first' : 'log in with spotify for this one'));
    return;
  }
  CZ.bj = { pool, deck: qShuffle(pool), state: 'bet', p: [], d: [] };
  qSet(
    czHead('blackjack') +
    '<div class="bj-table">' +
      '<div class="bj-side"><div class="bj-lbl">dealer <b id="bj-dt"></b></div><div class="bj-hand" id="bj-dealer"></div></div>' +
      '<div class="bj-side"><div class="bj-lbl">you <b id="bj-pt"></b></div><div class="bj-hand" id="bj-player"></div></div>' +
    '</div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions" id="bj-acts"></div>'
  );
  bjActs();
}

function bjRender() {
  const B = CZ.bj; if (!B) return;
  const hide = B.state === 'play';
  const dh = czEl('bj-dealer'), ph = czEl('bj-player');
  if (dh) dh.innerHTML = B.d.map((c, i) => bjCard(c, hide && i === 1)).join('');
  if (ph) ph.innerHTML = B.p.map(c => bjCard(c)).join('');
  const dt = czEl('bj-dt'), pt = czEl('bj-pt');
  if (dt) dt.textContent = B.d.length ? (hide ? bjTotal([B.d[0]]) + ' + ?' : bjTotal(B.d)) : '';
  if (pt) pt.textContent = B.p.length ? bjTotal(B.p) : '';
}

function bjActs() {
  const B = CZ.bj, box = czEl('bj-acts'); if (!B || !box) return;
  if (B.state === 'play') {
    box.innerHTML = '<button class="q-btn" onclick="bjHit()">hit</button><button class="q-btn" onclick="bjStand()">stand</button>' +
      (B.p.length === 2 && czCoins() >= B.stake ? '<button class="q-btn ghost" onclick="bjDouble()">double</button>' : '');
  } else if (B.state === 'dealer') {
    box.innerHTML = '';
  } else {
    box.innerHTML = '<button class="q-btn" onclick="bjDeal()">deal</button>';
  }
}

function bjDeal() {
  const B = CZ.bj;
  if (!B || (B.state !== 'bet' && B.state !== 'over')) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  B.stake = amt; B.doubled = false;
  B.p = [bjDraw(B), bjDraw(B)];
  B.d = [bjDraw(B), bjDraw(B)];
  B.state = 'play';
  if (bjIsBJ(B.p) || bjIsBJ(B.d)) { bjEnd(); return; }
  bjRender(); bjActs();
}

function bjHit() {
  const B = CZ.bj; if (!B || B.state !== 'play') return;
  B.p.push(bjDraw(B));
  bjRender();
  const t = bjTotal(B.p);
  if (t > 21) { bjEnd(); return; }
  if (t === 21) { bjStand(); return; }
  bjActs();
}

function bjDouble() {
  const B = CZ.bj; if (!B || B.state !== 'play' || B.p.length !== 2) return;
  if (!czTake(B.stake)) return;
  B.stake *= 2; B.doubled = true;
  B.p.push(bjDraw(B));
  if (bjTotal(B.p) > 21) { bjRender(); bjEnd(); return; }
  bjStand();
}

function bjStand() {
  const B = CZ.bj; if (!B || B.state !== 'play') return;
  B.state = 'dealer';
  bjRender(); bjActs();
  const step = () => {
    if (CZ.bj !== B || Q.screen !== 'cz-bj') return;
    if (bjTotal(B.d) < 17) { B.d.push(bjDraw(B)); bjRender(); setTimeout(step, 650); }
    else bjEnd();
  };
  setTimeout(step, 650);
}

function bjEnd() {
  const B = CZ.bj; if (!B) return;
  B.state = 'over';
  bjRender();
  const r = bjSettle(B.p, B.d, B.stake, B.doubled);
  if (r.pay) czWin(r.pay);
  czMsg(r.label + (r.pay > B.stake ? ' &middot; +' + r.pay + ' 🪙' : r.pay ? ' &middot; bet back' : ' &middot; -' + B.stake + ' 🪙'), r.cls);
  if (r.pay > B.stake) {
    czBoom(r.cls === 'jackpot');
    const s = czStats(); s.bjWins = (s.bjWins || 0) + 1; a5Put(CZ_KEY, s);
    const hand = B.p.slice();
    czPlayFrom(hand, () => Q.screen === 'cz-bj' && CZ.bj === B && B.state === 'over');
  }
  czLock(false); bjActs();
}

// ======================== HUB + KEYS ========================

function czKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    const game = czEl('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    if (e.key !== ' ') return;
    if (Q.screen === 'cz-dr') { e.preventDefault(); drGo(); }
    else if (Q.screen === 'cz-rl') { e.preventDefault(); rlSpin(); }
  });
}
czKeys();

const CZ_HUB = [
  () => xCard('🎟️', 'scratch-offs', 'match 3 artists', 'scOpen()'),
  () => xCard('🎡', 'roulette', 'bet on an artist or a color', 'rlOpen()'),
  () => xCard('🏇', 'chart race', 'your artists race. pick the winner', 'hrOpen()'),
  () => xCard('📈', 'the drop', 'cash out before the song drops', 'drOpen()'),
  () => xCard('🃏', 'blackjack', 'your songs are the cards', 'bjOpen()'),
];

(function () {
  // the slot machine moves out of "even more games" into the casino
  const i = X_HUB.games.findIndex(f => String(f).indexOf('smOpen') >= 0);
  if (i >= 0) CZ_HUB.unshift(X_HUB.games.splice(i, 1)[0]);
  const prev = { mHubCards };
  mHubCards = () => prev.mHubCards() +
    '<div class="g-hub-label">casino &middot; 🪙 ' + czCoins() + '</div><div class="g-hub">' + CZ_HUB.map(f => f()).join('') + '</div>';
})();

Object.assign(window, {
  mHubCards, czSetBet, czRefill,
  scOpen, scBuy, scReveal, rlOpen, rlPick, rlSpin, hrOpen, hrPick, hrStart,
  drOpen, drGo, bjOpen, bjDeal, bjHit, bjStand, bjDouble,
});
