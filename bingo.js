// ============================================================
//  xXx SparkleStats xXx  -  bingo.js
//  music bingo. you get a card of song titles, clips play one at
//  a time (no titles shown), tap the square when you hear one of
//  yours. a full row / column / diagonal = bingo.
//  solo: one card, fewest songs + fewest wrong taps wins points.
//  party: up to 8 phones (peer prefix sparkle-bingo-, see party.js),
//  the host's screen plays the music, every guest gets their own
//  card, the host checks every tap and calls the winner.
//  loads after party.js (borrows the room / ping / rejoin plumbing).
// ============================================================

LABS.bingo  = { emoji: '🎱', name: 'music bingo', sub: 'a card of song titles. hear one of yours, tap it. 5 in a row wins' };
LABS.bingop = { emoji: '🎱', name: 'bingo party', sub: 'everyone gets their own card. your screen plays the music. up to 8 phones' };

const BN_WANT = 40;        // songs to look up clips for (a card holds 24, the rest are decoys)
const BN_CALL = 15;        // seconds each song plays before the next one
const BN_BEST_KEY = 'sparkle_bingo_best';

// solo state (guests keep their card in here too)
const BN = { size: 5, playable: [], calls: [], n: -1, card: [], marked: new Set(), wrong: 0, start: 0, done: false, live: false, score: 0, pending: new Set() };

// ======================== CARD MATH (pure) ========================

function bnSizeFor(n) { return n >= 24 ? 5 : n >= 16 ? 4 : n >= 8 ? 3 : 0; }
function bnFree(size) { return size % 2 ? (size * size - 1) / 2 : -1; }   // the middle square on odd cards

// every row, column and both diagonals as lists of cell indexes
function bnLines(size) {
  const out = [], d1 = [], d2 = [];
  for (let r = 0; r < size; r++) {
    const row = [], col = [];
    for (let c = 0; c < size; c++) { row.push(r * size + c); col.push(c * size + r); }
    out.push(row, col);
    d1.push(r * size + r); d2.push(r * size + (size - 1 - r));
  }
  out.push(d1, d2);
  return out;
}

// marked = Set of cell indexes (the free square counts as marked). returns the winning line or null
function bnBingo(marked, size) {
  const free = bnFree(size);
  for (const line of bnLines(size)) if (line.every(i => i === free || marked.has(i))) return line;
  return null;
}

// a card: size*size song ids, null on the free square
function bnMakeCard(ids, size) {
  const free = bnFree(size), need = size * size - (free >= 0 ? 1 : 0);
  const pick = qShuffle(ids.slice()).slice(0, need);
  const card = [];
  for (let i = 0, k = 0; i < size * size; i++) card.push(i === free ? null : pick[k++]);
  return card;
}
function bnCardKey(card) { return card.filter(Boolean).slice().sort().join('|'); }
// a card nobody else in the room already has (different songs, not just shuffled)
function bnUniqueCard(ids, size, taken) {
  let card = bnMakeCard(ids, size);
  for (let t = 0; t < 60 && taken.has(bnCardKey(card)); t++) card = bnMakeCard(ids, size);
  return card;
}

// fewer songs to a bingo + fewer wrong taps = more points
function bnScore(calls, wrong, size) {
  const min = size % 2 ? size - 1 : size;
  return Math.max(0, Math.max(100, Math.round(1000 - 30 * Math.max(0, calls - min))) - 40 * wrong);
}

// ======================== SHARED BITS ========================

function bnShow() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
}

// clips for up to BN_WANT songs from the picked pool
async function bnBuildPlayable(label) {
  Q.screen = 'bnbuild';
  qSet('<div class="q-loadwrap"><div class="spinner">🎱</div><p>' + label + '</p><p class="q-note" id="bn-prog">0</p></div>');
  const keep = Q.len;
  Q.len = BN_WANT;
  let built = [];
  try { built = await qBuildQuestions(Q.pool, n => { const el = document.getElementById('bn-prog'); if (el) el.textContent = n + ' / ' + Math.min(BN_WANT, Q.pool.length); }); }
  finally { Q.len = keep; }
  return built.map(q => ({ id: q.track.id, name: qStrip(q.track.name), artist: qArtistNames(q.track), art: qArt(q.track), preview: q.preview }));
}

function bnSong(id, list) { return list.find(s => s.id === id) || null; }

// the grid. cells = [{ name, artist } | null], classes = per-cell extra classes
function bnGridHtml(cells, size, onTap, classes) {
  const free = bnFree(size);
  return '<div class="bn-grid bn-s' + size + '" style="--bn-n:' + size + '">' + cells.map((c, i) =>
    i === free
      ? '<div class="bn-cell bn-free on' + (classes[i] || '') + '">🖤<span>free</span></div>'
      : '<button class="bn-cell' + (classes[i] || '') + '" id="bn-c' + i + '"' + (onTap ? ' onclick="' + onTap + '(' + i + ')"' : ' disabled') + '>' +
          '<span class="t">' + esc(c ? c.name : '?') + '</span>' + (c && c.artist ? '<span class="a">' + esc(c.artist) + '</span>' : '') + '</button>'
  ).join('') + '</div>';
}

function bnCalledHtml(list, onCard) {
  if (!list.length) return '';
  return '<div class="bn-called"><div class="q-note">what played</div>' + list.map((s, i) =>
    '<div class="bn-crow' + (onCard && onCard.has(s.id) ? ' mine' : '') + '"><span class="n">' + (i + 1) + '</span>' +
      (s.art ? '<img src="' + s.art + '" alt="">' : '') + '<span class="nm">' + esc(s.name) + '</span><span class="ar">' + esc(s.artist || '') + '</span></div>'
  ).join('') + '</div>';
}

function bnDisc(onclick) {
  return '<div class="q-player bn-player">' +
    '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
    '<div class="q-disc spinning" id="q-disc" onclick="' + onclick + '()"><div class="hole"></div></div>' +
  '</div>';
}

function bnFlash(i, cls) {
  const el = document.getElementById('bn-c' + i);
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 600);
}

// ======================== SOLO ========================

function bnOpen() {
  bnShow();
  if (typeof pReset === 'function' && P.kind === 'bingop') pReset();
  Q.game = 'bingo'; Q.len = QUIZ_LEN;
  qScreenMenu();
}

async function bnSoloBuild() {
  const list = await bnBuildPlayable('finding songs for your card...');
  if (Q.game !== 'bingo') return;
  const size = bnSizeFor(list.length);
  if (!size) {
    qSet(qTopBar('&larr; back', 'qScreenMenu()') + qHeader('🎱 music bingo', '') +
      qErrorBox('only found ' + list.length + ' songs with playable clips. need at least 8 for a card. try something bigger?'));
    return;
  }
  BN.playable = list; BN.size = size;
  bnSoloStart();
}

function bnSoloStart() {
  qStopAudio(); qClearTimers();
  BN.card = bnMakeCard(BN.playable.map(s => s.id), BN.size);
  BN.calls = qShuffle(BN.playable.slice());
  BN.n = -1; BN.wrong = 0; BN.done = false; BN.start = Date.now();
  BN.marked = new Set();
  Q.screen = 'bnsolo';
  const cells = BN.card.map(id => id ? bnSong(id, BN.playable) : null);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    '<div class="v-hud"><span class="qn" id="bn-hud">song 1 of ' + BN.calls.length + '</span><span id="bn-wrong">✗ 0</span></div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    bnDisc('bnSoloReplay') +
    '<div class="q-actions bn-acts"><button class="q-btn ghost" onclick="bnSoloReplay()">↻ again</button><button class="q-btn" onclick="bnSoloNext()">next song ▶</button></div>' +
    '<div class="v-status" id="bn-status"></div>' +
    bnGridHtml(cells, BN.size, 'bnSoloTap', {})
  );
  bnSoloNext();
}

function bnSoloNext() {
  if (BN.done || Q.screen !== 'bnsolo') return;
  qClearTimers();
  BN.n++;
  if (BN.n >= BN.calls.length) { bnSoloEnd(null); return; }
  const hud = document.getElementById('bn-hud'); if (hud) hud.textContent = 'song ' + (BN.n + 1) + ' of ' + BN.calls.length;
  const st = document.getElementById('bn-status'); if (st) st.innerHTML = '';
  const disc = document.getElementById('q-disc'); if (disc) { disc.classList.add('spinning'); disc.innerHTML = '<div class="hole"></div>'; }
  Q.duration = BN_CALL; Q.deadline = Date.now() + BN_CALL * 1000;
  qPlayClip(BN.calls[BN.n].preview);
  Q.tick = setInterval(() => {
    const left = Math.max(0, Q.deadline - Date.now()) / 1000;
    const bar = document.getElementById('q-timer');
    if (bar) { bar.style.width = (left / BN_CALL) * 100 + '%'; bar.classList.toggle('low', left <= BN_CALL * 0.3); }
    if (left <= 0) bnSoloNext();
  }, 100);
}
function bnSoloReplay() { if (!BN.done && BN.calls[BN.n]) qPlayClip(BN.calls[BN.n].preview); }

function bnSoloTap(i) {
  if (BN.done || Q.screen !== 'bnsolo' || BN.marked.has(i) || BN.n < 0) return;
  const id = BN.card[i];
  if (!id) return;
  const st = document.getElementById('bn-status');
  // anything that's played so far counts, not just the song that's on right now
  if (BN.calls.slice(0, BN.n + 1).some(s => s.id === id)) {
    BN.marked.add(i);
    const el = document.getElementById('bn-c' + i); if (el) el.classList.add('on');
    if (st) st.innerHTML = '<span class="good">🖤</span>';
    const line = bnBingo(BN.marked, BN.size);
    if (line) bnSoloEnd(line);
  } else {
    BN.wrong++;
    bnFlash(i, 'bad');
    const w = document.getElementById('bn-wrong'); if (w) w.textContent = '✗ ' + BN.wrong;
    if (st) st.innerHTML = '<span class="bad">hasn\'t played yet 💔</span>';
  }
}

function bnBest() { try { return JSON.parse(localStorage.getItem(BN_BEST_KEY) || 'null'); } catch { return null; } }

function bnSoloEnd(line) {
  BN.done = true;
  qStopAudio(); qClearTimers();
  Q.screen = 'bnresults';
  const calls = BN.n + 1;
  const secs = Math.round((Date.now() - BN.start) / 1000);
  const score = line ? bnScore(calls, BN.wrong, BN.size) : 0;
  BN.score = score;
  const best = bnBest();
  const isBest = line && (!best || score > best.score);
  if (isBest) { try { localStorage.setItem(BN_BEST_KEY, JSON.stringify({ score, calls, wrong: BN.wrong, at: Date.now() })); } catch {} }
  const classes = {};
  BN.marked.forEach(i => { classes[i] = ' on'; });
  if (line) line.forEach(i => { classes[i] = (classes[i] || '') + ' win'; });
  const cells = BN.card.map(id => id ? bnSong(id, BN.playable) : null);
  const s = Q.source || {};
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎱 ' + (line ? 'BINGO' : 'no bingo'), esc(s.name || '')) +
    '<div class="q-final fade-up"><div class="num">' + score + '</div><div class="outof">out of 1000' + (isBest ? ' &middot; new best 👑' : best ? ' &middot; best ' + best.score : '') + '</div></div>' +
    '<div class="bn-stats"><span>🎵 ' + calls + ' songs</span><span>✗ ' + BN.wrong + ' wrong</span><span>⏱️ ' + Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') + '</span></div>' +
    bnGridHtml(cells, BN.size, null, classes) +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="bnSoloStart()">new card</button>' +
      '<button class="q-btn ghost" onclick="qScreenMenu()">pick something else</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>' +
    bnCalledHtml(BN.calls.slice(0, calls), new Set(BN.card.filter(Boolean)))
  );
  if (line && window.confetti) confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#b266ff'] });
  if (line && typeof mAward === 'function') { try { mAward('bingo'); } catch {} }
}

// ======================== PARTY: HOST ========================

function bnOpenParty() {
  bnShow();
  if (!pHasPeer()) { qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎱 bingo party', '') + qErrorBox('the online part didn\'t load (peerjs). refresh and try again?')); return; }
  if (P.kind !== 'bingop' || P.role !== 'host') pReset();
  Q.game = 'bingop'; Q.len = QUIZ_LEN;
  qScreenMenu();
}

function bnLobbyMsg() {
  return { type: 'lobby', kind: 'bingop', host: P.myName, players: P.players.filter(p => p.name).map(p => p.name) };
}

function bnLobby() {
  Q.screen = 'bnlobby';
  qStopAudio(); qClearTimers(); pStopTick(); pStopReveal();
  if (!Q.pool || Q.pool.length < QUIZ_MIN_Q) { qScreenMenu(); return; }
  P.role = 'host'; P.kind = 'bingop'; P.myName = pSavedName() || 'the caller';
  Q.game = 'bingop';
  P.bn = null;
  const s = Q.source || { name: '?', image: '', sub: '' };
  qSet(
    qTopBar('&larr; pick something else', 'qScreenMenu()') +
    qHeader('🎱 bingo party', 'everyone gets their own card') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code" id="p-code">' + esc(P.code || '....') + '</div>' +
      '<p class="q-note">sparklestats &rarr; <b>join with a room code</b></p>' +
      '<p class="q-note" id="p-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="pCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<div class="q-chosen" style="margin-top:16px;">' +
      (s.image ? '<img src="' + s.image + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(s.name) + '</div>' +
      '<div class="mt">' + Q.pool.length + ' songs in the pool</div></div>' +
    '</div>' +
    '<div class="q-note" style="margin:16px 0 6px;">who\'s here</div>' +
    '<div class="p-chips" id="p-players"></div>' +
    '<div class="q-actions"><button class="q-btn" id="p-start" onclick="bnHostStart()" disabled>start &rarr;</button></div>'
  );
  if (P.peer && !P.peer.destroyed) { pStatus('room\'s open. waiting...'); pLobbyPlayers(); return; }
  pHostPeer(P_BINGO, conn => {
    if (P.players.length >= P_MAX) { conn.on('open', () => { pSendTo(conn, { type: 'full' }); setTimeout(() => { try { conn.close(); } catch {} }, 300); }); return; }
    const pl = { conn, name: '', score: 0, ans: null, id: conn.peer, since: Date.now(), lastPong: 0 };
    P.players.push(pl);
    conn.on('data', msg => bnHostData(pl, msg));
    conn.on('close', () => pHostPlayerLeft(pl));
    conn.on('error', () => pHostPlayerLeft(pl));
  }, bnLobby);
  const codeEl = document.getElementById('p-code'); if (codeEl) codeEl.textContent = P.code;
}

function bnHostData(pl, msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'pong': pl.lastPong = Date.now(); break;
    case 'hello': {
      pWelcomeBack(pl, msg, 0);
      pSendTo(pl.conn, { type: 'you', name: pl.name });
      if (Q.screen === 'bnlobby') { pSend(bnLobbyMsg()); pLobbyPlayers(); }
      else if (P.bn && !P.bn.over) {
        bnDealTo(pl);
        if (P.bn.n >= 0) pSendTo(pl.conn, { type: 'call', n: P.bn.n + 1, total: P.bn.calls.length, secs: Math.max(1, Math.ceil(pLeft())) });
        bnChips();
      } else if (P.bn && P.bn.over && P.bn.fin) pSendTo(pl.conn, P.bn.fin);
      else pSendTo(pl.conn, bnLobbyMsg());
      break;
    }
    case 'mark': bnHostMark(pl, msg); break;
  }
}

// called from party.js when a phone drops (their card + marks stay saved under their name)
function bnHostLeft() {
  if (Q.screen === 'bnlobby') { pSend(bnLobbyMsg()); pLobbyPlayers(); }
  else bnChips();
}

async function bnHostStart() {
  const named = P.players.filter(p => p.name);
  if (!named.length || Q.screen !== 'bnlobby') return;
  const list = await bnBuildPlayable('finding songs for everyone\'s cards...');
  if (Q.game !== 'bingop' || P.role !== 'host') return;
  const size = bnSizeFor(list.length);
  if (!size) {
    qSet(qTopBar('&larr; back', 'bnLobby()') + qHeader('🎱 bingo party', '') +
      qErrorBox('only found ' + list.length + ' songs with playable clips. need at least 8. pick something else?'));
    return;
  }
  P.bn = { playable: list, size, calls: qShuffle(list.slice()), n: -1, cards: {}, over: false, fin: null };
  P.players.forEach(p => { p.score = 0; });
  P.gone = {};
  P.players.filter(p => p.name).forEach(bnDealTo);
  bnHostNext();
}

// give a player their card (a new one, or the one they had before a reconnect)
function bnDealTo(pl) {
  const B = P.bn; if (!B || !pl.name) return;
  let c = B.cards[pl.name];
  if (!c) {
    const taken = new Set(Object.values(B.cards).map(x => bnCardKey(x.cells)));
    c = B.cards[pl.name] = { cells: bnUniqueCard(B.playable.map(s => s.id), B.size, taken), marked: [], wrong: 0 };
  }
  pSendTo(pl.conn, {
    type: 'card', size: B.size, marked: c.marked, score: pl.score || 0,
    cells: c.cells.map(id => { const s = id && bnSong(id, B.playable); return s ? { name: s.name, artist: s.artist } : null; }),
  });
}

function bnChips() {
  const box = document.getElementById('bn-chips');
  if (!box || !P.bn) return;
  box.innerHTML = P.players.filter(p => p.name).map(p => {
    const c = P.bn.cards[p.name];
    return '<span class="p-chip in">' + esc(p.name) + ' · ' + (c ? c.marked.length : 0) + '</span>';
  }).join('') || '<span class="q-note">everyone left?</span>';
}

function bnHostNext() {
  const B = P.bn; if (!B || B.over || P.role !== 'host') return;
  qClearTimers(); pStopTick();
  B.n++;
  if (B.n >= B.calls.length) { bnHostFinal(null); return; }
  Q.screen = 'bnplay';
  P.secs = BN_CALL;
  P.deadline = Date.now() + BN_CALL * 1000;
  pSend({ type: 'call', n: B.n + 1, total: B.calls.length, secs: BN_CALL });
  qSet(
    '<div class="v-hud"><span class="qn">song ' + (B.n + 1) + ' of ' + B.calls.length + '</span><span>🎱 ' + esc(P.code) + '</span></div>' +
    pTimerBar() +
    bnDisc('bnHostReplay') +
    '<div class="q-actions bn-acts"><button class="q-btn ghost" onclick="bnHostReplay()">↻ again</button><button class="q-btn" onclick="bnHostNext()">next song ▶</button></div>' +
    '<div class="p-chips" id="bn-chips"></div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="bnHostFinal(null)">🏁 end it</button></div>'
  );
  bnChips();
  qPlayClip(B.calls[B.n].preview);
  P.tick = setInterval(() => { if (pTickBar() <= 0) bnHostNext(); }, 100);
}
function bnHostReplay() { const B = P.bn; if (B && !B.over && B.calls[B.n]) qPlayClip(B.calls[B.n].preview); }

function bnHostMark(pl, msg) {
  const B = P.bn; if (!B || B.over || !pl.name) return;
  const c = B.cards[pl.name]; if (!c) return;
  const i = Number(msg.i);
  const id = c.cells[i];
  if (!Number.isInteger(i) || !id) return;
  if (c.marked.includes(i)) { pSendTo(pl.conn, { type: 'mk', i, ok: true, score: pl.score }); return; }
  const at = B.calls.findIndex(s => s.id === id);
  const ok = at >= 0 && at <= B.n;
  if (ok) { c.marked.push(i); pl.score += at === B.n ? 50 : 25; }
  else { c.wrong++; pl.score = Math.max(0, pl.score - 20); }
  pSendTo(pl.conn, { type: 'mk', i, ok, score: pl.score });
  bnChips();
  if (ok) {
    const line = bnBingo(new Set(c.marked), B.size);
    if (line) { pl.score += 500; bnHostFinal(pl, line); }
  }
}

function bnHostFinal(winner, line) {
  const B = P.bn; if (!B || B.over) return;
  B.over = true;
  qClearTimers(); pStopTick(); qStopAudio();
  Q.screen = 'bnfinal';
  P.board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  const called = B.calls.slice(0, Math.max(0, B.n + 1)).map(s => ({ id: s.id, name: s.name, artist: s.artist, art: s.art }));
  const wc = winner && B.cards[winner.name];
  B.fin = {
    type: 'fin', board: P.board, winner: winner ? winner.name : '', line: line || [], called,
    card: wc ? { size: B.size, marked: wc.marked, cells: wc.cells.map(id => { const s = id && bnSong(id, B.playable); return s ? { name: s.name, artist: s.artist } : null; }) } : null,
  };
  pSend(B.fin);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎱 ' + (winner ? 'BINGO' : 'no bingo'), winner ? esc(winner.name) + ' got it' : '') +
    (wc ? bnWinCardHtml(B.fin.card, B.fin.line) : '') +
    pPodiumHtml(P.board) +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="bnAgain()">again, new cards</button>' +
      '<button class="q-btn ghost" onclick="qScreenMenu()">pick something else</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>' +
    bnCalledHtml(called)
  );
  if (winner && window.confetti) confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#b266ff'] });
}

function bnWinCardHtml(card, line) {
  const classes = {};
  (card.marked || []).forEach(i => { classes[i] = ' on'; });
  (line || []).forEach(i => { classes[i] = (classes[i] || '') + ' win'; });
  return bnGridHtml(card.cells, card.size, null, classes);
}

function bnAgain() {
  if (P.role !== 'host' || P.kind !== 'bingop') return;
  P.bn = null;
  bnLobby();
  pSend(bnLobbyMsg());
}

// ======================== PARTY: GUEST ========================

function bnGuestData(msg) {
  switch (msg.type) {
    case 'lobby':
      BN.live = false; BN.callN = 0; BN.callTotal = 0;
      pGuestWait('🎱 bingo party', 'connected to <b>' + esc(msg.host || 'the host') + '</b>. waiting for them to start...',
        '<div class="p-chips" style="justify-content:center;margin-top:10px;">' + (msg.players || []).map(n => '<span class="p-chip in">' + esc(n) + '</span>').join('') + '</div>');
      break;
    case 'card': bnGuestCard(msg); break;
    case 'call': bnGuestCall(msg); break;
    case 'mk': bnGuestMarked(msg); break;
    case 'fin': bnGuestFinal(msg); break;
    case 'full': pScreenDropped('that room is full (' + P_MAX + ' phones max)'); break;
    case 'abort': pScreenDropped(String(msg.why || 'the host stopped the game')); break;
  }
}

function bnGuestCard(msg) {
  const size = [3, 4, 5].includes(Number(msg.size)) ? Number(msg.size) : 5;
  BN.size = size; BN.live = true;
  BN.cells = (Array.isArray(msg.cells) ? msg.cells : []).slice(0, size * size);
  BN.marked = new Set((msg.marked || []).map(Number));
  BN.pending = new Set();
  BN.score = Number(msg.score) || 0;
  Q.screen = 'bnguest';
  const classes = {};
  BN.marked.forEach(i => { classes[i] = ' on'; });
  qSet(
    '<div class="v-hud"><span class="qn" id="bn-hud">' + (BN.callN ? 'song ' + BN.callN + ' of ' + BN.callTotal : 'get ready') + '</span><span>' + esc(P.myName) + ' · <b id="bn-score">' + BN.score + '</b></span></div>' +
    pTimerBar() +
    '<div class="v-status" id="bn-status"><span class="wait">listen to the host\'s screen</span></div>' +
    bnGridHtml(BN.cells, size, 'bnGuestTap', classes)
  );
}

function bnGuestCall(msg) {
  BN.callN = Number(msg.n) || 0; BN.callTotal = Number(msg.total) || 0;
  if (Q.screen !== 'bnguest') return;
  const hud = document.getElementById('bn-hud'); if (hud) hud.textContent = 'song ' + BN.callN + ' of ' + BN.callTotal;
  const st = document.getElementById('bn-status'); if (st) st.innerHTML = '<span class="wait">🎵</span>';
  P.secs = Number(msg.secs) || BN_CALL;
  P.deadline = Date.now() + P.secs * 1000;
  pStopTick();
  P.tick = setInterval(() => { if (pTickBar() <= 0) pStopTick(); }, 100);
}

function bnGuestTap(i) {
  if (Q.screen !== 'bnguest' || !BN.live || BN.marked.has(i) || BN.pending.has(i) || P.role !== 'guest') return;
  BN.pending.add(i);
  const el = document.getElementById('bn-c' + i); if (el) el.classList.add('pend');
  pSend({ type: 'mark', i });
}

function bnGuestMarked(msg) {
  const i = Number(msg.i);
  BN.pending.delete(i);
  const el = document.getElementById('bn-c' + i);
  if (el) el.classList.remove('pend');
  BN.score = Number(msg.score) || 0;
  const sc = document.getElementById('bn-score'); if (sc) sc.textContent = BN.score;
  const st = document.getElementById('bn-status');
  if (msg.ok) {
    BN.marked.add(i);
    if (el) el.classList.add('on');
    if (st) st.innerHTML = '<span class="good">🖤</span>';
  } else {
    bnFlash(i, 'bad');
    if (st) st.innerHTML = '<span class="bad">hasn\'t played yet 💔 -20</span>';
  }
}

function bnGuestFinal(msg) {
  BN.live = false; pStopTick();
  Q.screen = 'pfinal';
  const board = Array.isArray(msg.board) ? msg.board : [];
  const place = board.findIndex(b => b.name === P.myName) + 1;
  const me = board[place - 1];
  const won = msg.winner && msg.winner === P.myName;
  qSet(
    qTopBar('&larr; leave', pBack()) +
    qHeader('🎱 ' + (msg.winner ? 'BINGO' : 'no bingo'), won ? 'you got it 👑' : msg.winner ? esc(msg.winner) + ' got it' : '') +
    '<div class="q-final fade-up"><div class="num">' + (me ? me.score : 0) + '</div><div class="outof">' + (place ? 'points &middot; #' + place : 'points') + '</div></div>' +
    (msg.card ? bnWinCardHtml(msg.card, msg.line) : '') +
    pBoardHtml(board, P.myName) +
    bnCalledHtml(Array.isArray(msg.called) ? msg.called : [])
  );
  if (won && window.confetti) confetti({ particleCount: 110, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1'] });
}

// ======================== HOOKS ========================

(function bnInstallHooks() {
  const prev = { qScreenMode };
  // bingo borrows the source picker, then goes to its own screens
  qScreenMode = function () {
    if (Q.game === 'bingo') { bnSoloBuild(); return; }
    if (Q.game === 'bingop') { bnLobby(); return; }
    return prev.qScreenMode();
  };
})();

X_HUB.games.push(() => xCard('🎱', 'music bingo', LABS.bingo.sub, 'bnOpen()'));
X_HUB.social.push(() => xCard('🎱', 'bingo party', LABS.bingop.sub, 'bnOpenParty()'));

Object.assign(window, {
  qScreenMode,
  bnOpen, bnSoloStart, bnSoloNext, bnSoloReplay, bnSoloTap,
  bnOpenParty, bnLobby, bnHostStart, bnHostNext, bnHostReplay, bnHostFinal, bnAgain,
  bnGuestData, bnGuestTap, bnHostLeft,
});
