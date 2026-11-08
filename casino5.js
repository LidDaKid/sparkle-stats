// ============================================================
//  xXx SparkleStats xXx  -  casino5.js
//  ride the bus, artist dice, baccarat, shell game.
//  same coin jar as the rest of the casino. loads after casino4.js.
// ============================================================

const CZ5 = { rb: null, ad: null, bc: null, sh: null, adPick: 0, bcSide: 'you', shSpeed: 'fast' };

function cz5Card(t, n, cls) {
  const im = t.album && t.album.images && (t.album.images[1] || t.album.images[0]);
  return '<div class="bj-card fade-up ' + (cls || '') + '">' + (im ? '<img src="' + im.url + '" alt="">' : '') +
    '<span class="bj-n">' + n + '</span>' +
    '<span class="bj-t"><span class="bj-tn">track ' + (t.track_number || 1) + '</span>' + esc(qStrip(t.name)) + '</span></div>';
}
function cz5Back() { return '<div class="bj-card back"><span>xXx</span></div>'; }
function cz5Pick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

// ======================== RIDE THE BUS ========================
// 4 cards, 4 calls. pink or black, higher or lower, inside or outside, then name the artist

const RB_MULT = [1.9, 3, 5, 18];
const RB_ASK = ['pink or black?', 'higher or lower?', 'inside or outside?', 'whose song is it?'];
function rbVal(t) { return Math.min(13, (t && t.track_number) || 1); }
function rbFace(v) { return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[v] || v; }
function rbColor(t) { return ((t && t.track_number) || 1) % 2 ? 'pink' : 'black'; }

function rbOpen() { a5Open(rbScreen); }

function rbScreen() {
  Q.screen = 'cz-rb';
  qStopAudio(); qClearTimers();
  const pool = hlPool();
  if (!cz2Gate('ride the bus', 15, pool)) return;
  CZ5.rb = { pool, state: 'bet', cards: [], stage: 0, stake: 0 };
  qSet(
    czHead('ride the bus') +
    '<div class="bj-hand rb-hand" id="rb-hand"></div>' +
    '<div class="rb-ladder" id="rb-ladder"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions" id="rb-acts"></div>'
  );
  rbDraw();
}

function rbDraw() {
  const R = CZ5.rb; if (!R) return;
  const hand = czEl('rb-hand');
  if (hand) hand.innerHTML = [0, 1, 2, 3].map(i => {
    const t = R.cards[i];
    return i < R.stage || (R.state === 'over' && t && R.shown > i) ? cz5Card(t, rbFace(rbVal(t)), 'rb-' + rbColor(t)) : cz5Back();
  }).join('');
  const lad = czEl('rb-ladder');
  if (lad) lad.innerHTML = RB_MULT.map((m, i) => '<span class="' + (R.state === 'play' && i === R.stage ? 'on' : i < R.stage ? 'done' : '') + '">×' + m + '</span>').join('');
  const acts = czEl('rb-acts'); if (!acts) return;
  if (R.state !== 'play') { acts.innerHTML = '<button class="q-btn" onclick="rbGo()">' + (R.state === 'over' ? 'ride again' : 'start') + '</button>'; return; }
  const b = (k, l) => '<button class="q-btn" onclick="rbCall(\'' + k + '\')">' + l + '</button>';
  let h = '<div class="rb-ask">' + RB_ASK[R.stage] + '</div>';
  if (R.stage === 0) h += b('pink', 'pink') + b('black', 'black');
  else if (R.stage === 1) h += b('hi', 'higher') + b('lo', 'lower');
  else if (R.stage === 2) h += b('in', 'inside') + b('out', 'outside');
  else h += R.opts.map((a, i) => '<button class="q-btn" onclick="rbCall(' + i + ')">' + esc(a) + '</button>').join('');
  if (R.stage > 0) h += '<button class="q-btn cash" onclick="rbCash()">cash out &middot; ' + cz4Pay(R.stake * RB_MULT[R.stage - 1]) + '</button>';
  acts.innerHTML = h;
}

function rbGo() {
  const R = CZ5.rb; if (!R || R.state === 'play') return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  const cards = [];
  while (cards.length < 4) { const t = cz5Pick(R.pool); if (!cards.includes(t) || R.pool.length < 4) cards.push(t); }
  const answer = (cards[3].artists && cards[3].artists[0] && cards[3].artists[0].name) || '?';
  const others = qShuffle([...new Set(R.pool.map(t => t.artists && t.artists[0] && t.artists[0].name).filter(n => n && n !== answer))]).slice(0, 3);
  Object.assign(R, { state: 'play', cards, stage: 0, stake: amt, answer, opts: qShuffle([answer, ...others]), shown: 0 });
  rbDraw();
}

function rbCall(k) {
  const R = CZ5.rb; if (!R || R.state !== 'play') return;
  const c = R.cards, s = R.stage, v = c.map(rbVal);
  let right;
  if (s === 0) right = rbColor(c[0]) === k;
  else if (s === 1) right = k === 'hi' ? v[1] > v[0] : v[1] < v[0];
  else if (s === 2) {
    const lo = Math.min(v[0], v[1]), hi = Math.max(v[0], v[1]);
    right = k === 'in' ? v[2] > lo && v[2] < hi : v[2] < lo || v[2] > hi;
  } else right = R.opts[k] === R.answer;
  R.stage++;
  if (!right) {
    R.state = 'over'; R.shown = 4;
    czLock(false); czScratch();
    czMsg('wrong &middot; -' + R.stake + ' 🪙' + (s === 3 ? ' &middot; it was ' + esc(R.answer) : ''), 'none');
    rbDraw();
    return;
  }
  cz2Pluck(330 + R.stage * 60, 0.12);
  if (R.stage >= 4) { rbCash(); return; }
  czMsg('right &middot; ×' + RB_MULT[R.stage - 1], 'three');
  rbDraw();
}

function rbCash() {
  const R = CZ5.rb; if (!R || R.state !== 'play' || !R.stage) return;
  const m = RB_MULT[R.stage - 1], won = cz4Pay(R.stake * m);
  czWin(won);
  R.state = 'over'; R.shown = 4;
  czLock(false);
  czMsg((R.stage >= 4 ? 'rode the whole bus' : 'cashed out') + ' &middot; ×' + m + ' &middot; +' + won + ' 🪙', m >= 5 ? 'jackpot' : 'three');
  if (m >= 3) czBoom(m >= 18);
  rbDraw();
  const t = R.cards[R.stage - 1];
  czPlayFrom([t], () => Q.screen === 'cz-rb' && CZ5.rb === R && R.state === 'over');
}

// ======================== ARTIST DICE ========================
// pick an artist, roll 3 dice with your artists on them. 1 match ×2, 2 matches ×3, all 3 ×12

const AD_PAY = [0, 2, 3, 12];

function adOpen() { a5Open(adScreen); }

function adScreen() {
  Q.screen = 'cz-ad';
  qStopAudio(); qClearTimers();
  const arts = czGate('artist dice', 6);
  if (!arts) return;
  const faces = arts.slice(0, 6).map(czSym);
  if (CZ5.adPick > 5) CZ5.adPick = 0;
  CZ5.ad = { faces, busy: false };
  qSet(
    czHead('artist dice') +
    '<div class="ad-dice" id="ad-dice">' + [0, 1, 2].map(i => '<div class="ad-die" id="ad-d' + i + '">' + czFace(faces[i]) + '</div>').join('') + '</div>' +
    '<div class="ad-picks" id="ad-picks">' + faces.map((f, i) =>
      '<button class="ad-pick' + (i === CZ5.adPick ? ' on' : '') + '" data-i="' + i + '" onclick="adSet(' + i + ')">' + czFace(f) + '<span>' + esc(f.name) + '</span></button>').join('') + '</div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="ad-go" onclick="adRoll()">roll</button></div>' +
    '<div class="sm-pay"><div><span>1 match</span><b>×2</b></div><div><span>2 matches</span><b>×3</b></div><div><span>all 3</span><b>×12</b></div></div>'
  );
}

function adSet(i) {
  const A = CZ5.ad; if (!A || A.busy) return;
  CZ5.adPick = i;
  document.querySelectorAll('#ad-picks .ad-pick').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
}

function adRoll() {
  const A = CZ5.ad; if (!A || A.busy) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  A.busy = true; qStopAudio(); czMsg(''); czLock(true);
  const go = czEl('ad-go'); if (go) go.disabled = true;
  const res = [0, 1, 2].map(() => Math.floor(Math.random() * 6));
  const t0 = performance.now();
  const tick = () => {
    if (CZ5.ad !== A) return;
    const done = performance.now() - t0 > 1100;
    [0, 1, 2].forEach(i => {
      const d = czEl('ad-d' + i); if (!d) return;
      const k = done ? res[i] : Math.floor(Math.random() * 6);
      d.innerHTML = czFace(A.faces[k]);
      d.className = 'ad-die' + (done ? (res[i] === CZ5.adPick ? ' hit' : '') : ' roll');
    });
    if (!done) { setTimeout(tick, 80); return; }
    const n = res.filter(x => x === CZ5.adPick).length, m = AD_PAY[n];
    A.busy = false; czLock(false);
    if (go) go.disabled = false;
    if (!m) { czMsg('no ' + esc(A.faces[CZ5.adPick].name) + ' &middot; -' + amt + ' 🪙', 'none'); return; }
    const won = cz4Pay(amt * m);
    czWin(won);
    czMsg(n + ' ' + esc(A.faces[CZ5.adPick].name) + ' &middot; ×' + m + ' &middot; +' + won + ' 🪙', n === 3 ? 'jackpot' : n === 2 ? 'three' : 'pair');
    if (n >= 2) czBoom(n === 3);
    const name = A.faces[CZ5.adPick].name;
    czPlayFrom(cz2Pool().filter(t => t.artists && t.artists.some(a => a.name === name)), () => Q.screen === 'cz-ad' && CZ5.ad === A && !A.busy);
  };
  tick();
}

// ======================== BACCARAT ========================
// you vs the house. card = last digit of the track number, hand = last digit of the total. closest to 9 wins

const BC_PAY = { you: 1.95, house: 1.95, tie: 8 };
function bcVal(t) { return ((t && t.track_number) || 1) % 10; }
function bcTot(h) { return h.reduce((s, t) => s + bcVal(t), 0) % 10; }

function bcOpen() { a5Open(bcScreen); }

function bcScreen() {
  Q.screen = 'cz-bc';
  qStopAudio(); qClearTimers();
  const pool = hlPool();
  if (!cz2Gate('baccarat', 15, pool)) return;
  CZ5.bc = { pool, busy: false };
  qSet(
    czHead('baccarat') +
    '<div class="bc-table">' +
      '<div><div class="bj-lbl">you <b id="bc-yt"></b></div><div class="bj-hand" id="bc-you">' + cz5Back() + cz5Back() + '</div></div>' +
      '<div><div class="bj-lbl">the house <b id="bc-ht"></b></div><div class="bj-hand" id="bc-house">' + cz5Back() + cz5Back() + '</div></div>' +
    '</div>' +
    '<div class="ns-opts" id="bc-sides">' + Object.keys(BC_PAY).map(k =>
      '<button class="cz-pill' + (k === CZ5.bcSide ? ' on' : '') + '" data-k="' + k + '" onclick="bcSet(\'' + k + '\')">' + (k === 'house' ? 'the house' : k) + ' ×' + BC_PAY[k] + '</button>').join('') + '</div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="bc-go" onclick="bcDeal()">deal</button></div>'
  );
}

function bcSet(k) {
  const B = CZ5.bc; if (!B || B.busy) return;
  CZ5.bcSide = k;
  document.querySelectorAll('#bc-sides .cz-pill').forEach(b => b.classList.toggle('on', b.dataset.k === k));
}

// simple rules: both get 2. 8 or 9 stands. anyone on 5 or less takes a third card
function bcPlay(draw) {
  const you = [draw(), draw()], house = [draw(), draw()];
  if (bcTot(you) < 8 && bcTot(house) < 8) {
    if (bcTot(you) <= 5) you.push(draw());
    if (bcTot(house) <= 5) house.push(draw());
  }
  const y = bcTot(you), h = bcTot(house);
  return { you, house, win: y > h ? 'you' : h > y ? 'house' : 'tie' };
}

function bcDeal() {
  const B = CZ5.bc; if (!B || B.busy) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  B.busy = true; qStopAudio(); czMsg(''); czLock(true);
  const go = czEl('bc-go'); if (go) go.disabled = true;
  const side = CZ5.bcSide;
  const r = bcPlay(() => cz5Pick(B.pool));
  const yEl = czEl('bc-you'), hEl = czEl('bc-house');
  if (yEl) yEl.innerHTML = ''; if (hEl) hEl.innerHTML = '';
  const steps = [];
  for (let i = 0; i < 3; i++) {
    if (r.you[i]) steps.push(['you', r.you[i], r.you.slice(0, i + 1)]);
    if (r.house[i]) steps.push(['house', r.house[i], r.house.slice(0, i + 1)]);
  }
  steps.forEach(([w, t, so], i) => setTimeout(() => {
    if (CZ5.bc !== B) return;
    const el = w === 'you' ? yEl : hEl;
    if (el) el.insertAdjacentHTML('beforeend', cz5Card(t, bcVal(t)));
    const tot = czEl(w === 'you' ? 'bc-yt' : 'bc-ht'); if (tot) tot.textContent = bcTot(so);
    cz2Pluck(300 + i * 40, 0.08);
  }, 350 * i));
  setTimeout(() => {
    if (CZ5.bc !== B) return;
    B.busy = false; czLock(false);
    if (go) go.disabled = false;
    const wl = r.win === 'house' ? 'the house wins' : r.win === 'you' ? 'you win' : 'tie';
    if (r.win === side) {
      const won = cz4Pay(amt * BC_PAY[side]);
      czWin(won);
      czMsg(wl + ' &middot; +' + won + ' 🪙', side === 'tie' ? 'jackpot' : 'three');
      if (side === 'tie') czBoom(true);
      czPlayFrom(side === 'house' ? r.house : r.you, () => Q.screen === 'cz-bc' && CZ5.bc === B && !B.busy);
    } else if (r.win === 'tie') {
      czAdd(amt);
      czMsg('tie &middot; bet back', 'pair');
    } else {
      czMsg(wl + ' &middot; -' + amt + ' 🪙', 'none');
    }
  }, 350 * steps.length + 200);
}

// ======================== SHELL GAME ========================
// your song goes under a sleeve. they shuffle. find it

const SH_SPEEDS = [
  { k: 'chill', swaps: 6, ms: 480, pay: 2 },
  { k: 'fast', swaps: 10, ms: 280, pay: 2.5 },
  { k: 'insane', swaps: 18, ms: 150, pay: 2.9 },
];
function shSpeed() { return SH_SPEEDS.find(s => s.k === CZ5.shSpeed) || SH_SPEEDS[1]; }

function shOpen() { a5Open(shScreen); }

function shScreen() {
  Q.screen = 'cz-sh';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('shell game', 5, pool)) return;
  CZ5.sh = { pool, state: 'bet', pos: [0, 1, 2], song: null, stake: 0 };
  qSet(
    czHead('shell game') +
    '<div class="ns-opts" id="sh-opts">' + SH_SPEEDS.map(s => '<button class="cz-pill' + (s.k === CZ5.shSpeed ? ' on' : '') + '" data-k="' + s.k + '" onclick="shSet(\'' + s.k + '\')">' + s.k + ' ×' + s.pay + '</button>').join('') + '</div>' +
    '<div class="sh-table" id="sh-table">' + [0, 1, 2].map(i =>
      '<button class="sh-cup" id="sh-c' + i + '" style="left:' + (i * 33.33) + '%" onclick="shPick(' + i + ')" disabled><span class="sh-rec"></span><span class="sh-sleeve"></span></button>').join('') + '</div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="sh-go" onclick="shGo()">hide it</button></div>'
  );
}

function shSet(k) {
  const S = CZ5.sh; if (!S || S.state !== 'bet') return;
  CZ5.shSpeed = k;
  document.querySelectorAll('#sh-opts .cz-pill').forEach(b => b.classList.toggle('on', b.dataset.k === k));
}

function shLay(S, ms) {
  [0, 1, 2].forEach(id => {
    const c = czEl('sh-c' + id); if (!c) return;
    c.style.transition = 'left ' + ms + 'ms ease-in-out';
    c.style.left = (S.pos[id] * 33.33) + '%';
  });
}

function shGo() {
  const S = CZ5.sh; if (!S || S.state !== 'bet') return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  const sp = shSpeed();
  const song = cz5Pick(S.pool), cv = cz2Cover(song);
  Object.assign(S, { state: 'show', stake: amt, song, speed: sp, hid: Math.floor(Math.random() * 3) });
  document.querySelectorAll('#sh-opts .cz-pill').forEach(b => { b.disabled = true; });
  const go = czEl('sh-go'); if (go) go.disabled = true;
  [0, 1, 2].forEach(id => {
    const c = czEl('sh-c' + id); if (!c) return;
    c.className = 'sh-cup' + (id === S.hid ? ' has' : '');
    c.querySelector('.sh-rec').innerHTML = id === S.hid && cv ? '<img src="' + cv + '" alt="">' : '';
    c.disabled = true;
  });
  const tbl = czEl('sh-table'); if (tbl) tbl.classList.add('open');
  setTimeout(() => {
    if (CZ5.sh !== S) return;
    if (tbl) tbl.classList.remove('open');
    S.state = 'shuffle';
    let n = 0;
    const swap = () => {
      if (CZ5.sh !== S) return;
      if (n++ >= sp.swaps) {
        S.state = 'pick';
        [0, 1, 2].forEach(id => { const c = czEl('sh-c' + id); if (c) c.disabled = false; });
        czMsg('which one?', 'pair');
        return;
      }
      const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      const ia = S.pos.indexOf(a), ib = S.pos.indexOf(b);
      S.pos[ia] = b; S.pos[ib] = a;
      shLay(S, sp.ms);
      setTimeout(swap, sp.ms + 30);
    };
    setTimeout(swap, 400);
  }, 1300);
}

function shPick(id) {
  const S = CZ5.sh; if (!S || S.state !== 'pick') return;
  S.state = 'bet';
  [0, 1, 2].forEach(i => { const c = czEl('sh-c' + i); if (c) c.disabled = true; });
  const tbl = czEl('sh-table'); if (tbl) tbl.classList.add('open');
  const c = czEl('sh-c' + id); if (c) c.classList.add('picked');
  czLock(false);
  document.querySelectorAll('#sh-opts .cz-pill').forEach(b => { b.disabled = false; });
  const go = czEl('sh-go'); if (go) { go.disabled = false; go.textContent = 'again'; }
  if (id !== S.hid) { czScratch(); czMsg('empty &middot; -' + S.stake + ' 🪙', 'none'); return; }
  const won = cz4Pay(S.stake * S.speed.pay);
  czWin(won);
  czMsg('found it &middot; +' + won + ' 🪙', S.speed.k === 'insane' ? 'jackpot' : 'three');
  czBoom(S.speed.k === 'insane');
  czPlayFrom([S.song], () => Q.screen === 'cz-sh' && CZ5.sh === S && S.state === 'bet');
}

// ======================== HUB ========================

CZ_HUB.push(
  () => xCard('🚌', 'ride the bus', '4 cards, 4 calls, up to ×18', 'rbOpen()'),
  () => xCard('🎲', 'artist dice', 'roll your artists', 'adOpen()'),
  () => xCard('🂠', 'baccarat', 'you vs the house', 'bcOpen()'),
  () => xCard('🥤', 'shell game', 'follow your song', 'shOpen()')
);

Object.assign(window, { rbOpen, rbGo, rbCall, rbCash, adOpen, adSet, adRoll, bcOpen, bcSet, bcDeal, shOpen, shSet, shGo, shPick });
