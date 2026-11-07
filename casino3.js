// ============================================================
//  xXx SparkleStats xXx  -  casino3.js
//  crate dig (loot), props (bets on your own stats), war, daily spin.
//  same coin jar as the rest of the casino. loads after casino2.js.
// ============================================================

const CZ3 = { cd: null, pr: null, wr: null, ds: null };

// ======================== CRATE DIG ========================
// dig a record out of the crate. your top songs are the rare finds

const CD_TIERS = [
  { k: 'mythic', label: 'mythic', w: 3, mult: 8 },
  { k: 'ultra', label: 'ultra rare', w: 9, mult: 2.5 },
  { k: 'rare', label: 'rare', w: 25, mult: 1 },
  { k: 'common', label: 'common', w: 63, mult: 0.4 },
];   // ~97% back over time

function cdTierOf(i) { return i < 3 ? 'mythic' : i < 10 ? 'ultra' : i < 25 ? 'rare' : 'common'; }
function cdRoll(rnd) {
  let r = (rnd || Math.random)() * 100;
  for (const t of CD_TIERS) { r -= t.w; if (r < 0) return t; }
  return CD_TIERS[CD_TIERS.length - 1];
}

function cdOpen() { a5Open(cdScreen); }

function cdScreen() {
  Q.screen = 'cz-cd';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool().slice(0, 60);
  if (!cz2Gate('crate dig', 30, pool)) return;
  const tiers = {};
  pool.forEach((t, i) => (tiers[cdTierOf(i)] = tiers[cdTierOf(i)] || []).push(t));
  CZ3.cd = { tiers, busy: false, finds: 0 };
  qSet(
    czHead('crate dig') +
    '<div class="cd-stage"><div class="cd-crate" id="cd-crate">' +
      Array.from({ length: 7 }, (_, i) => '<span class="cd-sleeve" style="--i:' + i + '"></span>').join('') +
      '<div class="cd-find" id="cd-find"></div>' +
    '</div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="cd-go" onclick="cdDig()">dig</button></div>' +
    '<div class="sm-pay">' + CD_TIERS.map(t => '<div><span class="cd-tag t-' + t.k + '">' + t.label + '</span><b>×' + t.mult + '</b></div>').join('') + '</div>'
  );
}

function cdDig() {
  const D = CZ3.cd; if (!D || D.busy) return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  D.busy = true; qStopAudio(); czMsg('');
  const go = czEl('cd-go'); if (go) go.disabled = true;
  let tier = cdRoll();
  while (!D.tiers[tier.k]) tier = CD_TIERS[(CD_TIERS.indexOf(tier) + 1) % CD_TIERS.length];
  const list = D.tiers[tier.k], t = list[Math.floor(Math.random() * list.length)];
  const crate = czEl('cd-crate'), find = czEl('cd-find');
  if (crate) { crate.classList.remove('dig'); void crate.offsetWidth; crate.classList.add('dig'); }
  if (find) find.innerHTML = '';
  setTimeout(() => {
    if (CZ3.cd !== D || Q.screen !== 'cz-cd') return;
    const c = cz2Cover(t);
    if (find) find.innerHTML = '<div class="cd-rec t-' + tier.k + '">' + (c ? '<img src="' + c + '" alt="">' : '') +
      '<span class="cd-tag t-' + tier.k + '">' + tier.label + '</span><span class="cd-nm">' + esc(qStrip(t.name)) + '</span></div>';
    const pay = Math.floor(amt * tier.mult);
    if (pay) czWin(pay);
    cz2Best('cdBest', tier.mult);
    czMsg(tier.label + ' &middot; ' + (pay ? '+' + pay + ' 🪙' : 'nothing'), tier.k === 'mythic' ? 'jackpot' : tier.k === 'ultra' ? 'three' : tier.k === 'rare' ? 'pair' : 'none');
    if (tier.k === 'mythic' || tier.k === 'ultra') czBoom(tier.k === 'mythic');
    D.busy = false;
    if (go) go.disabled = false;
    czPlayFrom([t], () => Q.screen === 'cz-cd' && CZ3.cd === D && !D.busy);
  }, 900);
}

// ======================== PROPS ========================
// bets on your own stats. every right call multiplies, cash out whenever

const PR_MULT = 1.9;

function prYear(t) { return parseInt(String((t.album && t.album.release_date) || '').slice(0, 4), 10) || 0; }
function prMmss(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
// one random question about her songs: { text, songs, opts:[a,b], answer, reveal }
function prMake(pool, rnd) {
  rnd = rnd || Math.random;
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  const kinds = ['year', 'length', 'rank', 'track'];
  for (let tries = 0; tries < 20; tries++) {
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    if (kind === 'year') {
      const t = pick(), y = prYear(t); if (!y) continue;
      const line = y + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 5)) + (rnd() < 0.5 ? 0.5 : -0.5);
      return { kind, songs: [t], text: 'released before or after <b>' + line + '</b>?', opts: ['before', 'after'], answer: y < line ? 0 : 1, reveal: String(y) };
    }
    if (kind === 'length') {
      const t = pick(), s = (t.duration_ms || 0) / 1000; if (!s) continue;
      const line = Math.round(s + (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 50)) + 0.5;
      return { kind, songs: [t], text: 'shorter or longer than <b>' + prMmss(line - 0.5) + '</b>?', opts: ['shorter', 'longer'], answer: s < line ? 0 : 1, reveal: prMmss(s) };
    }
    if (kind === 'rank') {
      const n = Math.min(pool.length, 50), i = Math.floor(rnd() * n);
      let j = Math.floor(rnd() * n); if (j === i) j = (i + 1 + Math.floor(rnd() * (n - 1))) % n;
      return { kind, songs: [pool[i], pool[j]], text: 'which is higher in your top songs?', opts: ['this one', 'that one'], answer: i < j ? 0 : 1, reveal: '#' + (i + 1) + ' vs #' + (j + 1) };
    }
    if (kind === 'track') {
      const t = pick(), n = t.track_number; if (!n) continue;
      const line = Math.max(1, n + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 3))) + 0.5;
      return { kind, songs: [t], text: 'track number under or over <b>' + line + '</b>?', opts: ['under', 'over'], answer: n < line ? 0 : 1, reveal: 'track ' + n };
    }
  }
  return null;
}
function prSongHtml(t) {
  const c = cz2Cover(t);
  return '<div class="pr-song">' + (c ? '<img src="' + c + '" alt="">' : '') + '<b>' + esc(qStrip(t.name)) + '</b><span>' + esc(gPrimary(t)) + '</span></div>';
}

function prOpen() { a5Open(prScreen); }

function prScreen() {
  Q.screen = 'cz-pr';
  qStopAudio(); qClearTimers();
  const pool = cz2Pool();
  if (!cz2Gate('props', 20, pool)) return;
  CZ3.pr = { pool, state: 'bet', mult: 1, n: 0 };
  qSet(
    czHead('props') +
    '<div class="pr-q" id="pr-q"></div>' +
    '<div class="cn-status" id="pr-total"></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions"><button class="q-btn" id="pr-go" onclick="prGo()">place bet</button></div>'
  );
}

function prShow() {
  const P3 = CZ3.pr, q = P3.q, box = czEl('pr-q'); if (!box) return;
  box.innerHTML = '<div class="pr-songs">' + q.songs.map(prSongHtml).join('<span class="pr-vs">vs</span>') + '</div>' +
    '<div class="pr-text">' + q.text + '</div>' +
    '<div class="q-actions">' + q.opts.map((o, i) => '<button class="q-btn" onclick="prPick(' + i + ')">' + o + ' &middot; ×' + PR_MULT + '</button>').join('') + '</div>';
  prUpd();
}

function prUpd() {
  const P3 = CZ3.pr, go = czEl('pr-go'), tot = czEl('pr-total');
  if (tot) tot.innerHTML = P3.state === 'play' && P3.n ? '<b>' + P3.n + '</b> right &middot; ×' + P3.mult.toFixed(2) + ' = ' + Math.floor(P3.stake * P3.mult) + ' 🪙' : '';
  if (go) {
    if (P3.state === 'play') { go.textContent = P3.n ? 'cash out · ' + Math.floor(P3.stake * P3.mult) : 'cash out'; go.disabled = !P3.n; go.classList.add('cash'); }
    else { go.textContent = 'place bet'; go.disabled = false; go.classList.remove('cash'); }
  }
}

function prGo() {
  const P3 = CZ3.pr; if (!P3) return;
  if (P3.state === 'play') { prCash(); return; }
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg(''); czLock(true);
  Object.assign(P3, { state: 'play', stake: amt, mult: 1, n: 0, q: prMake(P3.pool) });
  if (!P3.q) { czAdd(amt); P3.state = 'bet'; czLock(false); czMsg('couldn\'t make a question, try again'); prUpd(); return; }
  prShow();
}

function prPick(i) {
  const P3 = CZ3.pr; if (!P3 || P3.state !== 'play' || P3.locked) return;
  const q = P3.q, right = i === q.answer;
  P3.locked = true;
  const box = czEl('pr-q');
  if (box) box.querySelectorAll('.q-btn').forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('pr-right'); else if (k === i) b.classList.add('pr-wrong'); });
  const txt = box && box.querySelector('.pr-text');
  if (txt) txt.innerHTML += ' <span class="pr-reveal">' + esc(q.reveal) + '</span>';
  if (!right) {
    P3.state = 'over'; P3.locked = false;
    czMsg('wrong &middot; -' + P3.stake + ' 🪙', 'none');
    czLock(false); prUpd();
    return;
  }
  P3.mult *= PR_MULT; P3.n++;
  cz2Pluck(392 + P3.n * 40, 0.1);
  prUpd();
  setTimeout(() => {
    if (CZ3.pr !== P3 || P3.state !== 'play' || Q.screen !== 'cz-pr') return;
    P3.locked = false;
    P3.q = prMake(P3.pool);
    prShow();
  }, 1100);
}

function prCash() {
  const P3 = CZ3.pr; if (!P3 || P3.state !== 'play' || !P3.n) return;
  P3.state = 'over'; P3.locked = false;
  const won = Math.floor(P3.stake * P3.mult);
  czWin(won); cz2Best('prBest', P3.mult);
  const box = czEl('pr-q'); if (box) box.innerHTML = '';
  czMsg(P3.n + ' right &middot; +' + won + ' 🪙', P3.mult >= 5 ? 'jackpot' : 'three');
  if (P3.mult >= 3) czBoom(P3.mult >= 10);
  czLock(false); prUpd();
}

// ======================== WAR ========================
// your song vs the dealer's. higher track number wins (past 13 counts 13)

function wrVal(t) { return Math.min(13, (t && t.track_number) || 1); }
function wrCard(t, who) {
  const c = cz2Cover(t);
  return '<div class="wr-side"><div class="bj-lbl">' + who + '</div><div class="bj-card hl-card fade-up">' + (c ? '<img src="' + c + '" alt="">' : '') +
    '<span class="bj-n">' + wrVal(t) + '</span><span class="bj-t"><span class="bj-tn">track ' + t.track_number + '</span>' + esc(qStrip(t.name)) + '</span></div></div>';
}

function wrOpen() { a5Open(wrScreen); }

function wrScreen() {
  Q.screen = 'cz-wr';
  qStopAudio(); qClearTimers();
  const pool = hlPool();
  if (!cz2Gate('war', 15, pool)) return;
  CZ3.wr = { pool, state: 'bet' };
  qSet(
    czHead('war') +
    '<div class="wr-table" id="wr-table"><div class="wr-side"><div class="bj-lbl">you</div><div class="bj-card back"><span>xXx</span></div></div>' +
      '<div class="wr-side"><div class="bj-lbl">dealer</div><div class="bj-card back"><span>xXx</span></div></div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    czBets() +
    '<div class="q-actions" id="wr-acts"><button class="q-btn" onclick="wrDeal()">deal</button></div>'
  );
}

function wrDraw(W) { return W.pool[Math.floor(Math.random() * W.pool.length)]; }

function wrDeal() {
  const W = CZ3.wr; if (!W || W.state === 'tie') return;
  const amt = czAmt();
  if (!czTake(amt)) { czMsg('not enough coins'); return; }
  qStopAudio(); czMsg('');
  W.stake = amt;
  wrRound(W, false);
}

function wrRound(W, atWar) {
  const me = wrDraw(W), dealer = wrDraw(W), a = wrVal(me), b = wrVal(dealer);
  const tbl = czEl('wr-table'); if (tbl) tbl.innerHTML = wrCard(me, 'you') + wrCard(dealer, 'dealer');
  const acts = czEl('wr-acts');
  const deal = '<button class="q-btn" onclick="wrDeal()">deal</button>';
  if (a === b) {
    if (atWar) {
      const won = W.stake * 3;
      czWin(won); W.state = 'bet';
      czMsg('tie at war &middot; +' + won + ' 🪙', 'jackpot'); czBoom(true);
      if (acts) acts.innerHTML = deal;
      czLock(false);
      return;
    }
    W.state = 'tie'; W.me = me;
    czLock(true);
    czMsg('tie &middot; ' + a + ' vs ' + b, 'pair');
    if (acts) acts.innerHTML = '<button class="q-btn" onclick="wrWar()">go to war &middot; ' + W.stake + '</button><button class="q-btn ghost" onclick="wrFold()">surrender &middot; get ' + Math.floor(W.stake / 2) + '</button>';
    return;
  }
  W.state = 'bet';
  czLock(false);
  if (acts) acts.innerHTML = deal;
  if (a > b) {
    const won = W.stake * 2;
    czWin(won);
    czMsg((atWar ? 'won the war' : 'you win') + ' &middot; +' + won + ' 🪙', atWar ? 'jackpot' : 'three');
    if (atWar) czBoom(false);
    czPlayFrom([me], () => Q.screen === 'cz-wr' && CZ3.wr === W && W.state === 'bet');
  } else {
    czMsg((atWar ? 'lost the war' : 'dealer wins') + ' &middot; -' + W.stake + ' 🪙', 'none');
  }
}

function wrWar() {
  const W = CZ3.wr; if (!W || W.state !== 'tie') return;
  if (!czTake(W.stake)) { czMsg('not enough coins to go to war'); return; }
  W.stake *= 2;
  wrRound(W, true);
}

function wrFold() {
  const W = CZ3.wr; if (!W || W.state !== 'tie') return;
  const back = Math.floor(W.stake / 2);
  czAdd(back);
  W.state = 'bet';
  czLock(false);
  czMsg('surrendered &middot; +' + back + ' 🪙 back', 'none');
  const acts = czEl('wr-acts'); if (acts) acts.innerHTML = '<button class="q-btn" onclick="wrDeal()">deal</button>';
}

// ======================== DAILY SPIN ========================
// free, once a day

const DS_KEY = 'sparkle_daily_spin';
const DS_PRIZES = [
  { c: 25, w: 22 }, { c: 50, w: 22 }, { c: 75, w: 16 }, { c: 100, w: 14 },
  { c: 150, w: 10 }, { c: 250, w: 8 }, { c: 500, w: 5 }, { c: 1000, w: 3 },
];

function dsToday() { return new Date().toDateString(); }
function dsReady() { return a5Get(DS_KEY, { day: '' }).day !== dsToday(); }
// slices in a fixed shuffled order so the big ones aren't bunched; sized by weight
function dsSegs() {
  const order = [0, 4, 1, 6, 2, 5, 3, 7];
  const tot = DS_PRIZES.reduce((s, p) => s + p.w, 0);
  let a = 0;
  return order.map((i, k) => { const p = DS_PRIZES[i], s = { c: p.c, p: p.w / tot, color: k % 2 ? 'black' : 'pink', from: a }; a += s.p * 360; s.to = a; return s; });
}

function dsOpen() { a5Open(dsScreen); }

function dsScreen() {
  Q.screen = 'cz-ds';
  qStopAudio(); qClearTimers();
  const segs = dsSegs();
  CZ3.ds = { segs, rot: 0, spinning: false };
  const grad = 'conic-gradient(' + segs.map(x => (x.color === 'pink' ? '#d6136f' : '#140a10') + ' ' + x.from + 'deg ' + x.to + 'deg').join(',') + ')';
  const ready = dsReady();
  qSet(
    czHead('daily spin') +
    '<div class="rl-stage"><div class="rl-ptr"></div><div class="rl-wheel" id="ds-wheel" style="background:' + grad + '">' +
      segs.map(x => '<div class="rl-lab ds-lab" style="transform:translate(-50%,-50%) rotate(' + ((x.from + x.to) / 2) + 'deg) translateY(calc(var(--wsz) * -0.36))">' + x.c + '</div>').join('') +
      '<div class="rl-hub"></div></div></div>' +
    '<div class="sm-out" id="cz-out"></div>' +
    '<div class="q-actions"><button class="q-btn" id="ds-go" onclick="dsSpin()"' + (ready ? '' : ' disabled') + '>' + (ready ? 'spin' : 'come back tomorrow') + '</button></div>'
  );
}

function dsSpin() {
  const D = CZ3.ds; if (!D || D.spinning || !dsReady()) return;
  a5Put(DS_KEY, { day: dsToday() });
  D.spinning = true;
  const go = czEl('ds-go'); if (go) go.disabled = true;
  const j = rlPickSeg(D.segs);
  D.rot = rlRotFor(D.rot, j, D.segs, 0.2 + Math.random() * 0.6);
  const w = czEl('ds-wheel');
  if (w) { w.style.transition = 'transform 4.6s cubic-bezier(.12,.62,.16,1)'; w.style.transform = 'rotate(' + D.rot + 'deg)'; }
  setTimeout(() => {
    const prize = D.segs[j].c;
    czAdd(prize);
    D.spinning = false;
    if (Q.screen !== 'cz-ds' || CZ3.ds !== D) return;
    czMsg('+' + prize + ' 🪙', prize >= 500 ? 'jackpot' : 'three');
    czBoom(prize >= 500);
    if (go) go.textContent = 'come back tomorrow';
  }, 4700);
}

// ======================== HUB ========================

CZ_HUB.unshift(() => xCard('🎁', 'daily spin', 'free coins once a day', 'dsOpen()', dsReady() ? 'ready' : ''));
CZ_HUB.push(
  () => xCard('📦', 'crate dig', 'your top songs are the rare finds', 'cdOpen()'),
  () => xCard('📊', 'props', 'bet on your own stats', 'prOpen()'),
  () => xCard('⚔️', 'war', 'higher track number wins', 'wrOpen()')
);

Object.assign(window, { cdOpen, cdDig, prOpen, prGo, prPick, wrOpen, wrDeal, wrWar, wrFold, dsOpen, dsSpin });
