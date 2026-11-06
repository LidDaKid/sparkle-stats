// ============================================================
//  xXx SparkleStats xXx  -  casino-party.js
//  casino night: up to 8 phones (peer prefix sparkle-casino-, see party.js).
//  the host's screen runs roulette / chart race / the drop on the host's
//  artists; everyone (host too) bets from their own screen with party chips.
//  guests don't need to log in. loads after casino.js + party.js.
// ============================================================

const P_CASINO = 'sparkle-casino-';
const CN_START = 500;      // chips everyone starts the night with
const CN_BET_SECS = 25;
const CN_REBUY = 100;      // broke players get this back at the table
const CN_GAMES = { rl: 'roulette', hr: 'chart race', dr: 'the drop' };

const C = { phase: 'lobby', chips: {}, bets: {}, game: null, opts: null, deadline: 0, tick: null, drop: null, round: 0, rot: 0, pick: null, myChips: 0, placed: null, dropT0: 0 };

if (typeof P_TRY !== 'undefined') P_TRY.push([P_CASINO, 'casinop']);

// ======================== SHARED ========================

function cnStopTick() { if (C.tick) { clearInterval(C.tick); C.tick = null; } }
function cnNames() { return [P.myName].concat(P.players.filter(p => p.name).map(p => p.name)); }
function cnChips(n) { return C.chips[n] == null ? CN_START : C.chips[n]; }
function cnSetChips(n, v) {
  C.chips[n] = Math.max(0, Math.floor(v));
  const pl = P.players.find(p => p.name === n); if (pl) pl.score = C.chips[n];
}
function cnBoard(deltas) {
  return cnNames().map(n => ({ name: n, score: cnChips(n), delta: deltas && deltas[n] != null ? deltas[n] : null })).sort((a, b) => b.score - a.score);
}
function cnBoardHtml(board) {
  board = Array.isArray(board) ? board : [];
  return '<div class="cn-board">' + board.map((b, i) =>
    '<div class="cn-row' + (b.name === P.myName ? ' you' : '') + '"><span>' + (i === 0 ? '👑 ' : '') + esc(b.name) + '</span><span>' +
      (b.delta != null ? '<span class="d ' + (b.delta > 0 ? 'plus' : 'minus') + '">' + (b.delta > 0 ? '+' : '') + b.delta + '</span> ' : '') +
      '<b>' + b.score + '</b></span></div>'
  ).join('') + '</div>';
}
function cnValidPick(game, opts, pick) {
  pick = String(pick || '');
  if (game === 'rl') return pick === 'pink' || pick === 'black' || (/^a\d+$/.test(pick) && +pick.slice(1) < opts.syms.length);
  if (game === 'hr') return /^r\d+$/.test(pick) && +pick.slice(1) < opts.racers.length;
  if (game === 'dr') return pick === 'in';
  return false;
}
function cnPickLabel(game, opts, pick) {
  if (!pick) return '';
  if (game === 'rl') return rlPickLabel(opts.syms, pick);
  if (game === 'hr') return (opts.racers[+pick.slice(1)] || {}).name || '';
  return 'the drop';
}
// bet payout (stake included) for a finished roulette / race round
function cnPayFor(game, opts, bet, r) {
  if (game === 'rl') { const seg = opts.segs[r.j]; return rlHit(bet.pick, seg) ? rlPay(bet.amt, bet.pick, opts.segs) : 0; }
  if (game === 'hr') return bet.pick === 'r' + r.win ? Math.floor(bet.amt * opts.racers[r.win].mult) : 0;
  return 0;
}

// the betting controls, same on the host's screen and the phones
function cnBetUI() {
  const g = C.game, o = C.opts;
  let picker = '';
  if (g === 'rl') picker = rlPickBtns(o.syms, C.pick, 'cnPick', o.segs || rlSegs(o.syms.length));
  else if (g === 'hr' && P.role !== 'host') picker = hrLanes(o.racers, C.pick ? +C.pick.slice(1) : -1, 'cnPickR');
  return '<div id="cn-betui">' + picker + czBets() +
    '<div class="q-actions"><button class="q-btn" id="cn-place" onclick="cnPlaceMine()">place bet</button></div></div>' +
    '<div class="cn-status" id="cn-mine">' + cnMineText() + '</div>';
}
function cnMineText() {
  return C.placed ? 'your bet: ' + C.placed.amt + ' on ' + esc(cnPickLabel(C.game, C.opts, C.placed.pick)) : '';
}
function cnPick(p) { if (C.phase !== 'bet' && P.role === 'host') return; C.pick = p; rlMarkPick(p); }
function cnPickR(i) {
  if (P.role === 'host' && C.phase !== 'bet') return;
  C.pick = 'r' + i;
  hrMarkPick(C.opts.racers.length, i);
}
function cnMyChips() { return P.role === 'host' ? cnChips(P.myName) : C.myChips; }
function cnPlaceMine() {
  if (C.game === 'dr') C.pick = 'in';
  if (!C.pick) { cnSetMine('pick something first'); return; }
  const have = cnMyChips() + (C.placed ? C.placed.amt : 0);
  const amt = CZ.bet === 'all' ? have : CZ.bet;
  if (!(amt > 0) || amt > have) { cnSetMine('not enough chips'); return; }
  if (P.role === 'host') cnPlace(P.myName, C.pick, amt, null);
  else pSend({ type: 'place', pick: C.pick, amt });
}
function cnSetMine(html) { const el = czEl('cn-mine'); if (el) el.innerHTML = html; }
function cnShowPlaced(msg) {
  if (msg.chips != null) C.myChips = msg.chips;
  const ch = czEl('cn-chips'); if (ch) ch.textContent = cnMyChips();
  if (!msg.ok) { cnSetMine('not enough chips'); return; }
  C.placed = { pick: msg.pick, amt: msg.amt };
  cnSetMine(cnMineText());
}
function cnChipsBar(left) {
  return '<div class="sm-top"><span>chips <b id="cn-chips">' + cnMyChips() + '</b></span>' + (left ? '<span id="cn-left"></span>' : '') + '</div>';
}
function cnLeftTick() {
  const el = czEl('cn-left'); const s = Math.max(0, Math.ceil((C.deadline - Date.now()) / 1000));
  if (el) el.textContent = s + 's';
  return s;
}
function cnDropStage() {
  return '<div class="dr-stage"><canvas id="dr-cv" class="dr-cv" width="600" height="240"></canvas>' +
    '<div class="dr-mult" id="dr-mult">1.00×</div><div class="dr-song" id="dr-song"></div></div>';
}
function cnSongHtml(d) {
  return (d.cover ? '<img src="' + d.cover + '" alt="">' : '') + '<span>' + esc(d.title || '') + '</span>';
}

// ======================== HOST ========================

function cnOpen() {
  a5Open(() => {
    if (!pHasPeer()) {
      qSet(qTopBar('&larr; back', xBack()) + qHeader('casino night', '') + qErrorBox('the online part didn\'t load (peerjs). refresh and try again?'));
      return;
    }
    if (!czGate('casino night', 5)) return;
    if (P.kind !== 'casinop' || P.role !== 'host') { pReset(); C.chips = {}; C.round = 0; }
    cnLobby();
  });
}

function cnLobbyMsg() { return { type: 'lobby', kind: 'casinop', host: P.myName, players: P.players.filter(p => p.name).map(p => p.name) }; }

function cnLobby() {
  Q.screen = 'cnlobby';
  qStopAudio(); qClearTimers(); cnStopTick();
  P.role = 'host'; P.kind = 'casinop'; P.myName = pSavedName() || 'the house';
  Q.game = 'casinop';
  C.phase = 'lobby';
  qSet(
    qTopBar('&larr; back', pBack()) +
    qHeader('casino night', '') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code" id="p-code">' + esc(P.code || '....') + '</div>' +
      '<p class="q-note">sparklestats &rarr; <b>join with a room code</b></p>' +
      '<p class="q-note" id="p-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="pCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<div class="q-note" style="margin:16px 0 6px;">who\'s here</div>' +
    '<div class="p-chips" id="p-players"></div>' +
    '<div class="q-actions"><button class="q-btn" id="p-start" onclick="cnTable()" disabled>start &rarr;</button></div>'
  );
  if (P.peer && !P.peer.destroyed) { pStatus('room\'s open. waiting...'); pLobbyPlayers(); return; }
  pHostPeer(P_CASINO, conn => {
    if (P.players.length >= P_MAX) { conn.on('open', () => { pSendTo(conn, { type: 'full' }); setTimeout(() => { try { conn.close(); } catch {} }, 300); }); return; }
    const pl = { conn, name: '', score: CN_START, ans: null, id: conn.peer, since: Date.now(), lastPong: 0 };
    P.players.push(pl);
    conn.on('data', msg => cnHostData(pl, msg));
    conn.on('close', () => pHostPlayerLeft(pl));
    conn.on('error', () => pHostPlayerLeft(pl));
  }, cnLobby);
  const codeEl = czEl('p-code'); if (codeEl) codeEl.textContent = P.code;
}

function cnHostData(pl, msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'pong': pl.lastPong = Date.now(); break;
    case 'hello':
      pWelcomeBack(pl, msg, 0);
      pSendTo(pl.conn, { type: 'you', name: pl.name });
      if (C.chips[pl.name] == null) cnSetChips(pl.name, CN_START); else pl.score = C.chips[pl.name];
      if (C.phase === 'lobby') { pSend(cnLobbyMsg()); pLobbyPlayers(); }
      else { cnSendState(pl); cnWho(); }
      break;
    case 'place': cnPlace(pl.name, msg.pick, msg.amt, pl); break;
    case 'cash': cnCash(pl.name, pl); break;
  }
}

// called from party.js when a phone drops (their chips stay saved under their name)
function cnHostLeft() {
  if (C.phase === 'lobby') { pSend(cnLobbyMsg()); pLobbyPlayers(); }
  else cnWho();
}

function cnTableMsg(n) { return { type: 'table', chips: cnChips(n), board: cnBoard() }; }
function cnBetMsg(n) {
  const o = C.game === 'rl' ? { syms: C.opts.syms }
    : C.game === 'hr' ? { racers: C.opts.racers.map(r => ({ name: r.name, img: r.img, mult: r.mult })) } : {};
  return { type: 'bet', game: C.game, opts: o, secs: Math.max(1, Math.ceil((C.deadline - Date.now()) / 1000)), chips: cnChips(n), mine: C.bets[n] || null };
}
function cnSendState(pl) {
  const n = pl.name;
  if (C.phase === 'bet') pSendTo(pl.conn, cnBetMsg(n));
  else if (C.phase === 'run' && C.game === 'dr' && C.drop && C.drop.t0) pSendTo(pl.conn, cnDropMsg(n));
  else if (C.phase === 'run') pSendTo(pl.conn, { type: 'go', game: C.game, chips: cnChips(n) });
  else if (C.phase === 'end') pSendTo(pl.conn, { type: 'fin', board: cnBoard() });
  else pSendTo(pl.conn, cnTableMsg(n));
}

function cnTable() {
  if (P.role !== 'host' || P.kind !== 'casinop') return;
  Q.screen = 'cntable';
  qStopAudio(); cnStopTick();
  C.phase = 'table'; C.bets = {}; C.pick = null; C.placed = null; C.drop = null;
  cnNames().forEach(n => { if (cnChips(n) < 10) cnSetChips(n, cnChips(n) + CN_REBUY); });
  qSet(
    qTopBar('&larr; leave', pBack()) +
    qHeader('casino night', 'room ' + esc(P.code)) +
    cnBoardHtml(cnBoard()) +
    '<div class="cn-games">' + Object.keys(CN_GAMES).map(g => '<button class="q-btn" onclick="cnStartBet(\'' + g + '\')">' + CN_GAMES[g] + '</button>').join('') + '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="cnEnd()">end the night</button></div>'
  );
  P.players.forEach(pl => { if (pl.name) pSendTo(pl.conn, cnTableMsg(pl.name)); });
}

function cnStartBet(game) {
  if (P.role !== 'host' || (C.phase !== 'table' && C.phase !== 'res')) return;
  const arts = a5Artists();
  C.game = game; C.bets = {}; C.pick = game === 'dr' ? 'in' : null; C.placed = null; C.phase = 'bet'; C.round++;
  if (game === 'rl') { const syms = arts.slice(0, 6).map(czSym); C.opts = { syms, segs: rlSegs(syms.length) }; }
  else if (game === 'hr') C.opts = { racers: hrLineup(arts) };
  else C.opts = {};
  C.deadline = Date.now() + CN_BET_SECS * 1000;
  Q.screen = 'cnbet';
  qStopAudio();
  const visual = game === 'rl' ? rlWheel(C.opts.syms, C.opts.segs, C.rot) : game === 'hr' ? hrLanes(C.opts.racers, -1, 'cnPickR') : cnDropStage();
  qSet(
    qTopBar('&larr; table', 'cnTable()') +
    qHeader(CN_GAMES[game], '') +
    cnChipsBar(true) +
    visual +
    '<div class="sm-out" id="cz-out"></div>' +
    '<div class="cn-who" id="cn-who"></div>' +
    cnBetUI() +
    '<div id="cn-after"><div class="q-actions"><button class="q-btn" id="cn-go" onclick="cnGo()">' + (game === 'rl' ? 'spin' : game === 'hr' ? 'start race' : 'drop it') + '</button></div></div>'
  );
  if (game === 'dr') drDraw(0, 1, false);
  cnWho();
  P.players.forEach(pl => { if (pl.name) pSendTo(pl.conn, cnBetMsg(pl.name)); });
  cnLeftTick();
  C.tick = setInterval(() => { if (C.phase !== 'bet' || Q.screen !== 'cnbet') { cnStopTick(); return; } if (cnLeftTick() <= 0) cnGo(); }, 250);
}

function cnWho() {
  const box = czEl('cn-who'); if (!box) return;
  const D = C.drop;
  box.innerHTML = cnNames().map(n => {
    const b = C.bets[n], out = D && D.out[n];
    return '<span class="cn-p' + (out ? ' up' : b ? ' in' : '') + '">' + esc(n) + (out ? '<b>' + out.toFixed(2) + '×</b>' : b ? '<b>' + b.amt + '</b>' : '') + '</span>';
  }).join('');
}

function cnPlace(name, pick, amt, pl) {
  const reply = m => { if (pl) pSendTo(pl.conn, m); else cnShowPlaced(m); };
  if (C.phase !== 'bet') return;
  amt = Math.floor(Number(amt));
  const prevBet = C.bets[name];
  const avail = cnChips(name) + (prevBet ? prevBet.amt : 0);
  if (!cnValidPick(C.game, C.opts, pick) || !(amt > 0) || amt > avail) { reply({ type: 'placed', ok: false, chips: cnChips(name) }); return; }
  cnSetChips(name, avail - amt);
  C.bets[name] = { pick: String(pick), amt };
  reply({ type: 'placed', ok: true, pick: String(pick), amt, chips: cnChips(name) });
  cnWho();
  // everyone with chips has a bet down - no need to wait out the clock
  const waiting = cnNames().filter(n => !C.bets[n] && cnChips(n) > 0);
  if (!waiting.length) setTimeout(cnGo, 800);
}

function cnGo() {
  if (P.role !== 'host' || C.phase !== 'bet') return;
  cnStopTick();
  C.phase = 'run';
  const ui = czEl('cn-betui'); if (ui) ui.innerHTML = '';
  const left = czEl('cn-left'); if (left) left.textContent = '';
  const go = czEl('cn-go'); if (go) go.style.display = 'none';
  const round = C.round;
  if (C.game === 'rl') {
    const spin = rlSpinTo(C.rot, C.opts.segs), j = spin.j;
    C.rot = spin.rot;
    const w = czEl('rl-wheel');
    if (w) { w.style.transition = 'transform 4.6s cubic-bezier(.12,.62,.16,1)'; w.style.transform = 'rotate(' + C.rot + 'deg)'; }
    pSend({ type: 'go', game: 'rl' });
    setTimeout(() => { if (C.round === round && C.phase === 'run') cnSettle({ j }); }, 4700);
  } else if (C.game === 'hr') {
    const win = hrWinner(C.opts.racers);
    pSend({ type: 'go', game: 'hr' });
    hrAnimate(hrPaths(C.opts.racers.length, win), () => C.round === round && C.phase === 'run' && Q.screen === 'cnbet', () => cnSettle({ win }));
  } else {
    cnDropStart();
  }
}

// pays everyone, tells every phone how they did
function cnFinish(pays, text, cls, song) {
  C.phase = 'res';
  const deltas = {};
  Object.keys(C.bets).forEach(n => {
    const pay = pays[n] || 0;
    cnSetChips(n, cnChips(n) + pay);
    deltas[n] = pay - C.bets[n].amt;
  });
  const board = cnBoard(deltas);
  czMsg(text, cls);
  const ch = czEl('cn-chips'); if (ch) ch.textContent = cnChips(P.myName);
  if (deltas[P.myName] > 0) czBoom(false);
  const after = czEl('cn-after');
  if (after) after.innerHTML = cnBoardHtml(board) +
    '<div class="q-actions"><button class="q-btn" onclick="cnStartBet(\'' + C.game + '\')">again</button><button class="q-btn ghost" onclick="cnTable()">table</button></div>';
  P.players.forEach(pl => { if (pl.name) pSendTo(pl.conn, { type: 'res', text, cls, delta: deltas[pl.name] == null ? null : deltas[pl.name], chips: cnChips(pl.name), board }); });
  const round = C.round;
  if (song) czPlayFrom(song, () => C.round === round && C.phase === 'res' && Q.screen === 'cnbet');
}

function cnSettle(r) {
  if (C.phase !== 'run') return;
  const pays = {};
  Object.keys(C.bets).forEach(n => { pays[n] = cnPayFor(C.game, C.opts, C.bets[n], r); });
  if (C.game === 'rl') {
    const seg = C.opts.segs[r.j], s = C.opts.syms[seg.who];
    cnFinish(pays, esc(s.name) + ' &middot; ' + seg.color, 'three', a5TracksBy(s.name));
  } else {
    const w = C.opts.racers[r.win];
    const l = czEl('hr-l' + r.win); if (l) l.classList.add('win');
    cnFinish(pays, esc(w.name) + ' wins', 'three', a5TracksBy(w.name));
  }
}

// ---- the drop, for everyone ----

function cnDropMsg(n) {
  const D = C.drop;
  return { type: 'drop', since: Date.now() - D.t0, title: D.title, cover: D.cover, url: D.url, chips: cnChips(n), out: D.out[n] || 0, bet: !!C.bets[n] };
}

async function cnDropStart() {
  const round = C.round;
  czMsg('finding a song...');
  const live = () => C.round === round && C.phase === 'run' && Q.screen === 'cnbet';
  let url = null, track = null;
  for (const t of qShuffle(qPoolFromTop()).slice(0, 6)) {
    try { url = await qFindPreview(t); } catch { url = null; }
    if (!live()) return;
    if (url) { track = t; break; }
  }
  if (!url) {
    Object.keys(C.bets).forEach(n => cnSetChips(n, cnChips(n) + C.bets[n].amt));
    C.bets = {};
    cnTable();
    return;
  }
  const im = track.album && track.album.images && (track.album.images[1] || track.album.images[0]);
  C.drop = { t0: 0, crash: drCrashPoint(), out: {}, url, title: qStrip(track.name) + ' · ' + gPrimary(track), cover: im ? im.url : '', m: 1 };
  czMsg('');
  const song = czEl('dr-song'); if (song) song.innerHTML = cnSongHtml(C.drop);
  qPlayClip(url);
  const D = C.drop;
  const start = () => {
    if (D.t0 || C.drop !== D || !live()) return;
    D.t0 = Date.now();
    P.players.forEach(pl => { if (pl.name) pSendTo(pl.conn, cnDropMsg(pl.name)); });
    const after = czEl('cn-after');
    if (after && C.bets[P.myName]) after.innerHTML = '<div class="q-actions"><button class="q-btn cash" id="dr-go" onclick="cnCash(P.myName)">cash out</button></div>';
    else if (after) after.innerHTML = '';
    requestAnimationFrame(cnDropTick);
  };
  czWhenPlaying(start);
}

function cnDropTick() {
  const D = C.drop;
  if (!D || C.phase !== 'run' || C.game !== 'dr' || Q.screen !== 'cnbet') return;
  const t = (Date.now() - D.t0) / 1000, m = drMult(t);
  if (m >= D.crash) { cnDropEnd(true, t); return; }
  if (t >= DR_MAX) { cnDropEnd(false, t); return; }
  D.m = m;
  const mEl = czEl('dr-mult');
  if (mEl) { mEl.textContent = m.toFixed(2) + '×'; mEl.classList.toggle('hot', m >= 2); mEl.classList.toggle('gold', m >= 5); }
  drDraw(t, m, false);
  requestAnimationFrame(cnDropTick);
}

function cnCash(name, pl) {
  const D = C.drop;
  if (!D || !D.t0 || C.phase !== 'run' || C.game !== 'dr') return;
  if (!C.bets[name] || D.out[name]) return;
  const m = drMult((Date.now() - D.t0) / 1000);
  if (m >= D.crash) return;
  D.out[name] = Math.floor(m * 100) / 100;
  if (pl) pSendTo(pl.conn, { type: 'cashed', m: D.out[name] });
  else { const b = czEl('dr-go'); if (b) { b.disabled = true; b.textContent = 'out at ' + D.out[name].toFixed(2) + '×'; } }
  cnWho();
}

function cnDropEnd(crashed, t) {
  const D = C.drop;
  const mEl = czEl('dr-mult');
  if (crashed) {
    qStopAudio(); czScratch();
    if (mEl) { mEl.textContent = D.crash.toFixed(2) + '×'; mEl.className = 'dr-mult dropped'; }
    drDraw(t, D.crash, true);
  } else {
    Object.keys(C.bets).forEach(n => { if (!D.out[n]) D.out[n] = Math.floor(D.m * 100) / 100; });
  }
  const pays = {};
  Object.keys(C.bets).forEach(n => { pays[n] = D.out[n] ? Math.floor(C.bets[n].amt * D.out[n]) : 0; });
  cnFinish(pays, crashed ? 'it dropped at ' + D.crash.toFixed(2) + '×' : 'the song ended at ' + D.m.toFixed(2) + '×', crashed ? 'none' : 'jackpot', null);
}

function cnEnd() {
  if (P.role !== 'host') return;
  cnStopTick(); qStopAudio();
  C.phase = 'end';
  Q.screen = 'cnend';
  const board = cnBoard();
  qSet(
    qTopBar('&larr; leave', pBack()) +
    qHeader('casino night', board[0] ? esc(board[0].name) + ' wins the night' : '') +
    cnBoardHtml(board) +
    '<div class="q-actions"><button class="q-btn" onclick="cnNewNight()">new night</button></div>'
  );
  if (typeof confetti === 'function') confetti({ particleCount: 140, spread: 90, colors: ['#FF1493', '#FF69B4', '#FFD700'] });
  pSend({ type: 'fin', board });
}
function cnNewNight() { C.chips = {}; cnNames().forEach(n => cnSetChips(n, CN_START)); cnTable(); }

// ======================== GUEST ========================

function cnGuestData(msg) {
  switch (msg.type) {
    case 'lobby':
      pGuestWait('casino night', 'connected to <b>' + esc(msg.host || 'the host') + '</b>. waiting for them to start...',
        '<div class="p-chips" style="justify-content:center;margin-top:10px;">' + (msg.players || []).map(n => '<span class="p-chip in">' + esc(n) + '</span>').join('') + '</div>');
      break;
    case 'table': cnGuestTable(msg); break;
    case 'bet': cnGuestBet(msg); break;
    case 'placed': cnShowPlaced(msg); break;
    case 'go': cnGuestGo(msg); break;
    case 'drop': cnGuestDrop(msg); break;
    case 'cashed': cnGuestCashed(msg); break;
    case 'res': cnGuestRes(msg); break;
    case 'fin': cnGuestFin(msg); break;
    case 'full': pScreenDropped('that room is full (' + P_MAX + ' phones max)'); break;
    case 'abort': pScreenDropped(String(msg.why || 'the host stopped the game')); break;
  }
}

function cnGuestReset() { cnStopTick(); C.dropT0 = 0; }

function cnGuestTable(msg) {
  cnGuestReset();
  C.myChips = msg.chips || 0;
  Q.screen = 'cnwait';
  qSet(
    qTopBar('&larr; leave', pBack()) + qHeader('casino night', 'room ' + esc(P.code)) +
    '<div class="q-final fade-up"><div class="num">' + C.myChips + '</div><div class="outof">chips</div></div>' +
    cnBoardHtml(msg.board) +
    '<div class="cn-status">next game soon</div>'
  );
}

function cnGuestBet(msg) {
  cnGuestReset();
  if (!CN_GAMES[msg.game]) return;
  C.game = msg.game; C.opts = msg.opts || {}; C.myChips = msg.chips || 0;
  if (C.game === 'rl' && !Array.isArray(C.opts.syms)) return;
  if (C.game === 'hr' && !Array.isArray(C.opts.racers)) return;
  C.placed = msg.mine && msg.mine.pick ? { pick: msg.mine.pick, amt: msg.mine.amt } : null;
  C.pick = C.placed ? C.placed.pick : C.game === 'dr' ? 'in' : null;
  C.phase = 'bet';
  C.deadline = Date.now() + (Number(msg.secs) || CN_BET_SECS) * 1000;
  Q.screen = 'cnbet';
  qSet(
    qTopBar('&larr; leave', pBack()) + qHeader(CN_GAMES[C.game], '') +
    cnChipsBar(true) +
    cnBetUI()
  );
  cnLeftTick();
  C.tick = setInterval(() => { if (Q.screen !== 'cnbet' || C.phase !== 'bet') { cnStopTick(); return; } cnLeftTick(); }, 250);
}

function cnGuestGo(msg) {
  cnGuestReset();
  C.phase = 'run';
  if (msg.chips != null) C.myChips = msg.chips;
  const ui = czEl('cn-betui');
  const txt = msg.game === 'rl' ? 'spinning...' : 'racing...';
  if (ui) { ui.innerHTML = '<div class="cn-status">' + txt + '</div>'; const l = czEl('cn-left'); if (l) l.textContent = ''; return; }
  Q.screen = 'cnbet';
  qSet(qTopBar('&larr; leave', pBack()) + qHeader(CN_GAMES[msg.game] || 'casino night', '') + cnChipsBar(false) +
    '<div class="cn-status">' + txt + '</div><div class="cn-status" id="cn-mine">' + (C.opts ? cnMineText() : '') + '</div>');
}

function cnGuestDrop(msg) {
  cnGuestReset();
  C.phase = 'run'; C.game = 'dr';
  if (msg.chips != null) C.myChips = msg.chips;
  C.dropT0 = Date.now() - (Number(msg.since) || 0);
  C.dropUrl = msg.url || '';
  Q.screen = 'cnbet';
  qSet(
    qTopBar('&larr; leave', pBack()) + qHeader('the drop', '') + cnChipsBar(false) +
    cnDropStage() +
    '<div class="q-actions">' +
      (msg.bet ? '<button class="q-btn cash" id="dr-go" onclick="cnGuestCash()"' + (msg.out ? ' disabled>out at ' + Number(msg.out).toFixed(2) + '×' : '>cash out') + '</button>' : '') +
      (C.dropUrl ? '<button class="q-btn ghost" onclick="cnPlayHere()">play here</button>' : '') +
    '</div>' +
    '<div class="cn-status" id="cn-mine">' + (msg.bet ? '' : 'no bet this round') + '</div>'
  );
  const song = czEl('dr-song'); if (song) song.innerHTML = cnSongHtml(msg);
  const t0 = C.dropT0;
  const step = () => {
    if (C.dropT0 !== t0 || Q.screen !== 'cnbet') return;
    const t = Math.min(DR_MAX, (Date.now() - t0) / 1000), m = drMult(t);
    const mEl = czEl('dr-mult');
    if (mEl) { mEl.textContent = m.toFixed(2) + '×'; mEl.classList.toggle('hot', m >= 2); mEl.classList.toggle('gold', m >= 5); }
    drDraw(t, m, false);
    if (t < DR_MAX) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function cnPlayHere() { if (C.dropUrl) qPlayClip(C.dropUrl); }
function cnGuestCash() { const b = czEl('dr-go'); if (b) b.disabled = true; pSend({ type: 'cash' }); }
function cnGuestCashed(msg) {
  const b = czEl('dr-go'); if (b) { b.disabled = true; b.textContent = 'out at ' + Number(msg.m).toFixed(2) + '×'; }
}

function cnGuestRes(msg) {
  const wasDrop = C.game === 'dr' && C.dropT0;
  cnGuestReset();
  C.phase = 'res';
  if (wasDrop && msg.cls === 'none') { qStopAudio(); czScratch(); }
  C.myChips = msg.chips || 0;
  Q.screen = 'cnres';
  const d = msg.delta;
  qSet(
    qTopBar('&larr; leave', pBack()) + qHeader(CN_GAMES[C.game] || 'casino night', '') +
    '<div class="sm-out"><div class="sm-res ' + (msg.cls || '') + ' fade-up">' + (msg.text || '') + '</div></div>' +
    '<div class="q-final fade-up"><div class="num">' + (d == null ? C.myChips : (d > 0 ? '+' : '') + d) + '</div><div class="outof">' + (d == null ? 'chips' : C.myChips + ' chips') + '</div></div>' +
    cnBoardHtml(msg.board)
  );
  if (d > 0) czBoom(d >= 200);
}

function cnGuestFin(msg) {
  cnGuestReset(); qStopAudio();
  Q.screen = 'pfinal';
  const board = Array.isArray(msg.board) ? msg.board : [];
  const won = board[0] && board[0].name === P.myName;
  qSet(
    qTopBar('&larr; leave', pBack()) +
    qHeader('casino night', board[0] ? (won ? 'you win the night 👑' : esc(board[0].name) + ' wins the night') : '') +
    cnBoardHtml(board)
  );
  if (won && typeof confetti === 'function') confetti({ particleCount: 140, spread: 90, colors: ['#FF1493', '#FF69B4', '#FFD700'] });
}

X_HUB.social.push(() => xCard('🎲', 'casino night', 'everyone bets from their phone', 'cnOpen()'));

Object.assign(window, {
  cnOpen, cnLobby, cnTable, cnStartBet, cnGo, cnEnd, cnNewNight, cnPick, cnPickR, cnPlaceMine, cnCash,
  cnGuestData, cnGuestCash, cnPlayHere, cnHostLeft,
});
