// ============================================================
//  xXx SparkleStats xXx  -  party.js
//  party mode (up to 8 phones, one screen) + album pictionary
//  (two screens, co-op) + one join screen that works for every
//  room code: party, pictionary, or a plain online versus.
//  guests don't need a spotify login - the host supplies everything.
//  loads after you.js; same peerjs setup as online.js.
// ============================================================

const P_PARTY = 'sparkle-party-';
const P_DRAW = 'sparkle-draw-';
const P_BINGO = 'sparkle-bingo-';   // music bingo party rooms (the game itself lives in bingo.js)
const P_TIME = 20;          // seconds per party question
const P_MAX = 8;            // phones per party
const P_DRAW_TIME = 60;     // seconds per pictionary round
const P_DRAW_ROUNDS = 6;
const P_NAME_KEY = 'sparkle_guest_name';
const P_COLORS = [['#FF1493', 'pink'], ['#FFB6C1', 'light pink'], ['#ffffff', 'white'], ['#b266ff', 'purple'], ['#000000', 'eraser']];

LABS.party = { emoji: '🎉', name: 'party mode', sub: 'up to 8 phones, one screen, one room code' };
LABS.draw  = { emoji: '✏️', name: 'album pictionary', sub: 'draw an album cover from memory, they guess. over the internet' };

const P = {
  role: null, kind: null, peer: null, conn: null, code: '', myName: '',
  players: [], questions: [], index: 0, deadline: 0, secs: P_TIME, tick: null, locked: false, revealTimer: null,
  board: [], mine: null, lobby: null, tryIdx: 0, trying: '', draw: null, canvas: null, len: QUIZ_LEN,
  // reliability: heartbeats, rejoin, wake lock
  hb: null, ghb: null, lastPing: 0, rejoin: null, reconnecting: false, attempts: 0, rejoinTimer: null, gone: {}, goneTimer: null, wake: null, lastRoom: null,
};

// stun for the easy cases, a free turn relay for phones whose networks won't do peer-to-peer
const P_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];
function pPeerOpts() { return { debug: 0, config: { iceServers: P_ICE } }; }
const P_HB_MS = 4000, P_HOST_GRACE = 20000, P_GUEST_GRACE = 15000, P_GONE_MS = 90000, P_REJOIN_TRIES = 14;

// keep the screen awake during a game (phones kill the connection when the screen locks)
async function pWake() {
  try { if (typeof navigator !== 'undefined' && navigator.wakeLock && document.visibilityState === 'visible') P.wake = await navigator.wakeLock.request('screen'); } catch {}
}
function pWakeRelease() { try { if (P.wake) P.wake.release(); } catch {} P.wake = null; }
function pBanner(text) {
  let el = document.getElementById('p-banner');
  if (!text) { if (el && el.remove) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'p-banner'; el.className = 'p-banner'; document.body.appendChild(el); }
  el.textContent = text;
}

// ======================== LITTLE HELPERS ========================

function pHasPeer() { return typeof Peer === 'function'; }
function pStopTick() { if (P.tick) { clearInterval(P.tick); P.tick = null; } }
function pStopReveal() { if (P.revealTimer) { clearTimeout(P.revealTimer); P.revealTimer = null; } }
function pStatus(html) { const el = document.getElementById('p-status'); if (el) el.innerHTML = html; }
function pBack() { return (typeof _data !== 'undefined' && _data) ? 'gScreenHub()' : 'closeQuiz()'; }
function pSendTo(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch {} }
function pSend(msg) { if (P.role === 'host') P.players.forEach(pl => pSendTo(pl.conn, msg)); else pSendTo(P.conn, msg); }
function pLeft() { return Math.max(0, P.deadline - Date.now()) / 1000; }
function pTimerBar() { return '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>'; }
function pTickBar() {
  const left = pLeft();
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / P.secs) * 100 + '%'; bar.classList.toggle('low', left <= P.secs * 0.3); }
  return left;
}
function pSavedName() {
  let n = P.myName;
  if (!n) { try { n = localStorage.getItem(P_NAME_KEY) || ''; } catch {} }
  if (!n && typeof gPlayer === 'function' && gPlayer() !== 'me') n = gPlayer();
  return String(n || '').slice(0, 16);
}
function pUniqueName(name) {
  let n = String(name || 'guest').trim().slice(0, 16) || 'guest';
  const taken = new Set(P.players.map(p => p.name).concat([P.myName]));
  let k = 2, out = n;
  while (taken.has(out)) out = n.slice(0, 14) + ' ' + k++;
  return out;
}
function pBoardHtml(board, meName) {
  return '<div class="p-board">' + board.map((b, i) =>
    '<div class="p-brow' + (b.name === meName ? ' you' : '') + '">' +
      '<span class="rank">' + (i === 0 ? '👑' : i + 1) + '</span><span class="nm">' + esc(b.name) + '</span><span class="sc">' + b.score + '</span>' +
    '</div>'
  ).join('') + '</div>';
}

// tear everything down (leaving the screens, dropping, arcade button)
function pReset() {
  pStopTick(); pStopReveal();
  if (P.hb) { clearInterval(P.hb); P.hb = null; }
  if (P.ghb) { clearInterval(P.ghb); P.ghb = null; }
  if (P.rejoinTimer) { clearTimeout(P.rejoinTimer); P.rejoinTimer = null; }
  if (P.goneTimer) { clearTimeout(P.goneTimer); P.goneTimer = null; }
  P.rejoin = null; P.reconnecting = false; P.attempts = 0; P.gone = {}; P.lastPing = 0;
  pWakeRelease(); pBanner('');
  try { P.players.forEach(pl => { try { pl.conn.close(); } catch {} }); } catch {}
  try { if (P.conn) P.conn.close(); } catch {}
  try { if (P.peer) P.peer.destroy(); } catch {}
  P.peer = null; P.conn = null; P.players = []; P.role = null; P.kind = null;
  P.questions = []; P.index = 0; P.locked = false; P.board = []; P.mine = null; P.draw = null; P.canvas = null;
}

function pHostPeer(prefix, onConnection, retry) {
  P.code = oCode();
  const peer = new Peer(prefix + P.code.toLowerCase(), pPeerOpts());
  P.peer = peer;
  if (P.hb) clearInterval(P.hb);
  P.hb = setInterval(pHostBeat, P_HB_MS);
  pWake();
  peer.on('open', () => pStatus('room\'s open. waiting...'));
  peer.on('error', e => {
    const t = (e && e.type) || 'unknown';
    if (t === 'unavailable-id') { try { peer.destroy(); } catch {} P.peer = null; retry(); return; }
    pStatus('connection trouble (' + esc(t) + '). back to the arcade and try again?');
  });
  peer.on('connection', onConnection);
}

// host pings everyone; a phone that goes quiet for 20s is treated as gone
// (and can come back - see the rejoin bits in the hello handlers)
function pHostBeat() {
  if (P.role !== 'host') return;
  const now = Date.now();
  for (const pl of P.players.slice()) {
    pSendTo(pl.conn, { type: 'ping' });
    if (now - (pl.lastPong || pl.since || now) > P_HOST_GRACE) {
      try { pl.conn.close(); } catch {}
      if (P.kind === 'draw') pDrawPartnerGone(pl); else pHostPlayerLeft(pl);
    }
  }
}
function pRemember(pl, index) {
  if (!pl || !pl.name) return;
  P.gone[pl.name] = { score: pl.score || 0, ans: pl.ans || null, index, at: Date.now() };
}
// a returning player: drop any stale copy of them, give their score back
function pWelcomeBack(pl, msg, index) {
  const want = String(msg.name || '').trim().slice(0, 16);
  const stale = P.players.find(p => p !== pl && p.name === want);
  if (stale && (msg.rejoin || !stale.conn.open)) {
    pRemember(stale, index);
    P.players.splice(P.players.indexOf(stale), 1);
    try { stale.conn.close(); } catch {}
  }
  pl.name = pUniqueName(want);
  const g = P.gone[pl.name];
  if (g && Date.now() - g.at < 180000) {
    pl.score = g.score;
    if (g.index === index) pl.ans = g.ans;
    delete P.gone[pl.name];
    return true;
  }
  return false;
}

// ======================== PARTY: HOST ========================

function pOpenParty() {
  if (!pHasPeer()) { qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎉 party mode', '') + qErrorBox('the online part didn\'t load (peerjs). refresh and try again?')); return; }
  if (P.kind !== 'party' || P.role !== 'host') pReset();
  Q.game = 'party'; Q.len = P.len;
  qScreenMenu();
}

// stands in for the mode screen once a pool is loaded
function pScreenLobby() {
  Q.screen = 'plobby';
  qStopAudio(); qClearTimers(); pStopTick(); pStopReveal();
  if (!Q.pool || Q.pool.length < QUIZ_MIN_Q) { qScreenMenu(); return; }
  P.role = 'host'; P.kind = 'party'; P.myName = pSavedName() || 'the DJ';
  Q.game = 'party'; Q.mode = 'mc';
  P.questions = []; P.index = 0; P.locked = false;
  const s = Q.source || { name: '?', image: '', sub: '' };
  qSet(
    qTopBar('&larr; pick something else', 'qScreenMenu()') +
    qHeader('🎉 party mode', 'everyone answers on their own phone') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code" id="p-code">' + esc(P.code || '....') + '</div>' +
      '<p class="q-note">on their phones: sparklestats &rarr; <b>join with a room code</b> (it\'s on the front page too, no login needed)</p>' +
      '<p class="q-note" id="p-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="pCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<div class="q-chosen" style="margin-top:16px;">' +
      (s.image ? '<img src="' + s.image + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(s.name) + '</div>' +
      '<div class="mt">' + esc(s.sub || '') + ' &middot; ' + Q.pool.length + ' songs in the pool</div></div>' +
    '</div>' +
    '<p class="q-note" style="margin:14px 0 8px;">how many songs</p>' +
    '<div class="tabs">' + QUIZ_LENGTHS.map(n =>
      '<button class="' + (n === P.len ? 'active' : '') + '"' + (n > Q.pool.length ? ' disabled' : '') + ' onclick="pSetLen(' + n + ')">' + n + '</button>').join('') +
    '</div>' +
    '<div class="q-note" style="margin:16px 0 6px;">who\'s here</div>' +
    '<div class="p-chips" id="p-players"></div>' +
    '<div class="q-actions"><button class="q-btn" id="p-start" onclick="pHostStart()" disabled>start &rarr;</button></div>' +
    '<p class="q-note" style="margin-top:12px;">the music plays out of <b>this</b> screen, so keep it near everyone. you\'re the DJ, you don\'t answer. ' +
      P_TIME + ' seconds a song, faster = more points, ' + P_MAX + ' phones max.</p>'
  );
  if (P.peer && !P.peer.destroyed) { pStatus('room\'s open. waiting...'); pLobbyPlayers(); return; }
  pHostPeer(P_PARTY, conn => {
    if (P.players.length >= P_MAX) { conn.on('open', () => { pSendTo(conn, { type: 'full' }); setTimeout(() => { try { conn.close(); } catch {} }, 300); }); return; }
    const pl = { conn, name: '', score: 0, ans: null, id: conn.peer, since: Date.now(), lastPong: 0 };
    P.players.push(pl);
    conn.on('data', msg => pHostData(pl, msg));
    conn.on('close', () => pHostPlayerLeft(pl));
    conn.on('error', () => pHostPlayerLeft(pl));
  }, pScreenLobby);
  const codeEl = document.getElementById('p-code'); if (codeEl) codeEl.textContent = P.code;
}

function pCopyCode(btn) {
  navigator.clipboard.writeText(P.code).then(() => { btn.textContent = 'copied 🩷'; setTimeout(() => { btn.textContent = 'copy code'; }, 2000); })
    .catch(() => { btn.textContent = 'couldn\'t copy :('; });
}
function pSetLen(n) { if (QUIZ_LENGTHS.includes(n) && n <= Q.pool.length) { P.len = n; Q.len = n; pScreenLobby(); } }

function pLobbyPlayers() {
  const named = P.players.filter(p => p.name);
  const box = document.getElementById('p-players');
  if (box) box.innerHTML = named.length ? named.map(p => '<span class="p-chip in">' + esc(p.name) + '</span>').join('') : '<span class="q-note">nobody yet...</span>';
  const btn = document.getElementById('p-start');
  if (btn) btn.disabled = !named.length;
  const st = document.getElementById('p-status');
  if (st && named.length) st.innerHTML = named.length + ' in the room';
}
function pLobbyMsg() {
  return { type: 'lobby', kind: 'party', host: P.myName, players: P.players.filter(p => p.name).map(p => p.name), len: P.len };
}

function pHostData(pl, msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'pong': pl.lastPong = Date.now(); break;
    case 'hello': {
      pWelcomeBack(pl, msg, P.index);
      pSendTo(pl.conn, { type: 'you', name: pl.name });
      pSend(pLobbyMsg());
      if (Q.screen === 'plobby') pLobbyPlayers();
      else if (Q.screen === 'pplay') {
        pChips();
        const q = P.questions[P.index];
        if (q && !P.locked && !pl.ans) pSendTo(pl.conn, { type: 'q', index: P.index, total: P.questions.length, choices: q.choices, secs: Math.max(1, Math.ceil(pLeft())) });
      } else if (Q.screen === 'pfinal') pSendTo(pl.conn, { type: 'fin', board: P.board });
      break;
    }
    case 'ans': pGotAnswer(pl, msg); break;
  }
}
function pHostPlayerLeft(pl) {
  const i = P.players.indexOf(pl);
  if (i < 0) return;
  P.players.splice(i, 1);
  if (P.role !== 'host') return;
  pRemember(pl, P.kind === 'dj' ? (P.dj ? P.dj.index : 0) : P.index);
  if (P.kind === 'bingop') { if (typeof bnHostLeft === 'function') bnHostLeft(pl); return; }
  if (P.kind === 'casinop') { if (typeof cnHostLeft === 'function') cnHostLeft(pl); return; }
  if (P.kind === 'dj') {
    pSend(pDjLobbyMsg());
    if (Q.screen === 'djlobby') pLobbyPlayers();
    else if (Q.screen === 'djlive') { pChips(); if (!P.locked && P.players.filter(p => p.name).every(p => p.ans)) pDjReveal(); }
    else if (Q.screen === 'djpick') pChips();
    return;
  }
  if (P.kind !== 'party') return;
  pSend(pLobbyMsg());
  if (Q.screen === 'plobby') pLobbyPlayers();
  else if (Q.screen === 'pplay') { pChips(); if (!P.locked && P.players.every(p => p.ans)) pFinalize(); }
}

async function pHostStart() {
  const named = P.players.filter(p => p.name);
  if (!named.length) return;
  Q.screen = 'pbuild';
  qSet('<div class="q-loadwrap"><div class="spinner">🎉</div><p>finding songs everyone can hear...</p></div>');
  Q.len = P.len;
  const built = await qBuildQuestions(Q.pool, () => {});
  if (built.length < QUIZ_MIN_Q) {
    qSet(qTopBar('&larr; back', 'pScreenLobby()') + qHeader('🎉 party mode', '') +
      qErrorBox('couldn\'t find enough songs with playable clips in there. pick something else?'));
    return;
  }
  P.questions = built.map(q => ({
    id: q.track.id, name: qStrip(q.track.name), artist: qArtistNames(q.track), art: qArt(q.track), preview: q.preview,
    choices: qMakeChoices(q.track, Q.pool).map(c => ({ id: c.id, name: qStrip(c.name) })),
  }));
  Q.perQ = QUIZ_MAX / P.questions.length;
  P.players.forEach(p => { p.score = 0; });
  if (typeof mAward === 'function') mAward('party_host');
  pSong(0);
}

function pSong(i) {
  P.index = i; P.locked = false;
  pStopTick(); pStopReveal();
  const q = P.questions[i];
  if (!q) return;
  Q.screen = 'pplay';
  P.secs = P_TIME;
  P.deadline = Date.now() + P_TIME * 1000;
  P.players.forEach(p => { p.ans = null; });
  pSend({ type: 'q', index: i, total: P.questions.length, choices: q.choices, secs: P_TIME });
  qSet(
    '<div class="v-hud"><span class="qn">song ' + (i + 1) + ' of ' + P.questions.length + '</span><span>🎉 ' + esc(P.code) + '</span></div>' +
    pTimerBar() +
    '<div class="q-player">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="pReplay()"><div class="hole"></div></div>' +
      '<button class="q-replay" onclick="pReplay()">↻ play again</button>' +
      '<p class="q-note" style="margin-top:8px;">answer on your phones!</p>' +
    '</div>' +
    '<div class="p-chips" id="p-chips"></div>' +
    '<div id="q-reveal"></div>'
  );
  pChips();
  qPlayClip(q.preview);
  P.tick = setInterval(() => { if (pTickBar() <= 0 && !P.locked) pFinalize(); }, 100);
}
function pReplay() { const q = P.questions[P.index]; if (q && !P.locked) qPlayClip(q.preview); }
function pChips() {
  const box = document.getElementById('p-chips');
  if (!box) return;
  box.innerHTML = P.players.filter(p => p.name).map(p =>
    '<span class="p-chip' + (p.ans ? ' in' : '') + '">' + esc(p.name) + (p.ans ? ' ✓' : ' …') + '</span>').join('');
}
function pGotAnswer(pl, msg) {
  if (P.locked || Number(msg.index) !== P.index || pl.ans) return;
  const q = P.questions[P.index];
  const i = Number(msg.i);
  if (!q || !q.choices[i]) return;
  pl.ans = { i, left: pLeft() };
  pChips();
  if (P.players.filter(p => p.name).every(p => p.ans)) pFinalize();
}

function pFinalize() {
  if (P.locked) return;
  P.locked = true;
  pStopTick(); qStopAudio();
  const bars = document.getElementById('q-bars'); if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc'); if (disc) disc.classList.remove('spinning');
  const q = P.questions[P.index];
  const results = P.players.filter(p => p.name).map(p => {
    const a = p.ans;
    const ok = !!(a && q.choices[a.i] && q.choices[a.i].id === q.id);
    const pts = ok ? Math.round(Q.perQ * (0.5 + 0.5 * (Math.min(P.secs, a.left) / P.secs))) : 0;
    p.score += pts;
    return { p, i: a ? a.i : -1, ok, pts };
  });
  P.board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  const correct = { id: q.id, name: q.name, artist: q.artist, art: q.art };
  results.forEach(r => pSendTo(r.p.conn, { type: 'res', index: P.index, i: r.i, ok: r.ok, pts: r.pts, correct, board: P.board }));
  const last = P.index === P.questions.length - 1;
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML =
      '<div class="q-reveal fade-up">' +
        (q.art ? '<img src="' + q.art + '" alt=""><br>' : '') +
        '<div class="song">' + esc(q.name) + '</div><div class="who">' + esc(q.artist) + '</div>' +
        '<div class="p-chips" style="justify-content:center;margin:10px 0;">' +
          results.map(r => '<span class="p-chip ' + (r.ok ? 'good' : 'bad') + '">' + esc(r.p.name) + ' ' + (r.i < 0 ? '💤' : r.ok ? '+' + r.pts : '✗') + '</span>').join('') +
        '</div>' +
        pBoardHtml(P.board) +
        '<div class="q-actions"><button class="q-btn" onclick="pNext()">' + (last ? 'final scores →' : 'next song →') + '</button></div>' +
        '<div class="q-note" style="margin-top:6px;">or just hit enter ↵</div>' +
      '</div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  P.revealTimer = setTimeout(pNext, 7000);
}

function pNext() {
  if (P.role !== 'host' || !P.locked) return;
  pStopReveal();
  if (P.index >= P.questions.length - 1) { pFinal(); return; }
  pSong(P.index + 1);
}

function pFinal() {
  Q.screen = 'pfinal';
  pStopTick(); pStopReveal(); qStopAudio();
  P.board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  pSend({ type: 'fin', board: P.board });
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎉 party mode', P.board.length ? esc(P.board[0].name) + ' takes it' : 'everyone left?') +
    pPodiumHtml(P.board) +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="pAgain()">again, new songs</button>' +
      '<button class="q-btn ghost" onclick="qScreenMenu()">pick something else</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (window.confetti) confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#b266ff'] });
}
function pAgain() {
  if (P.role !== 'host') return;
  pSend(pLobbyMsg());
  pScreenLobby();
}

// ======================== JOIN (any room code) ========================

function pOpenJoin() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  pScreenJoin();
}

function pScreenJoin() {
  if (!pHasPeer()) { qSet(qTopBar('&larr; back', pBack()) + qHeader('🔑 join a game', '') + qErrorBox('the online part didn\'t load (peerjs). refresh the page and try again?')); return; }
  pReset();
  if (typeof oReset === 'function') oReset();
  Q.screen = 'pjoin';
  P.role = 'guest';
  qSet(
    qTopBar('&larr; back', pBack()) +
    qHeader('🔑 join a game', 'party mode, DJ mode, bingo, casino night, album pictionary, or an online versus') +
    '<div class="o-room">' +
      '<div class="q-note" style="margin-bottom:6px;">your name</div>' +
      '<input id="p-name-input" class="q-input" maxlength="16" placeholder="who are you" value="' + esc(pSavedName()) + '" style="max-width:260px;margin:0 auto 12px;display:block;">' +
      '<div class="q-note" style="margin-bottom:6px;">room code</div>' +
      '<div class="q-typerow" style="max-width:340px;margin:0 auto;">' +
        '<input id="p-code-input" class="q-input o-code-input" placeholder="CODE" maxlength="4" autocomplete="off" autocapitalize="characters">' +
        '<button class="q-btn" onclick="pJoin()">join</button>' +
      '</div>' +
      '<p class="q-note" id="p-status" style="margin-top:12px;"></p>' +
    '</div>' +
    '<p class="q-note" style="margin-top:14px;">get the 4-letter code from whoever\'s hosting. no spotify login needed on your end.</p>'
  );
  const inp = document.getElementById('p-code-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') pJoin(); }); }
}

const P_TRY = [[P_PARTY, 'party'], ['sparkle-dj-', 'dj'], [P_DRAW, 'draw'], [P_BINGO, 'bingop'], [O_PREFIX, 'versus']];

function pJoin() {
  const codeEl = document.getElementById('p-code-input'), nameEl = document.getElementById('p-name-input');
  const code = String(codeEl ? codeEl.value : '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = String(nameEl ? nameEl.value : '').trim().slice(0, 16) || 'guest';
  if (code.length !== 4) { pStatus('codes are 4 letters and numbers'); return; }
  P.myName = name;
  try { localStorage.setItem(P_NAME_KEY, name); } catch {}
  if (P.peer) { try { P.peer.destroy(); } catch {} P.peer = null; }
  P.code = code; P.tryIdx = 0;
  pStatus('looking for the room...');
  pWake();
  const peer = new Peer(undefined, pPeerOpts());
  P.peer = peer;
  peer.on('error', e => {
    const t = (e && e.type) || 'unknown';
    if (t === 'peer-unavailable') { if (P.tryMiss) P.tryMiss(); return; }
    pStatus('connection trouble (' + esc(t) + '). try again, and wifi helps.');
  });
  peer.on('open', () => pTry(peer));
}

// knocks on every kind of room at once - whichever answers wins. (one at a time was slow,
// and the broker sometimes never says "no such room", which left phones stuck on "looking")
function pTry(peer) {
  if (P.peer !== peer) return;
  let left = P_TRY.length, done = false;
  const conns = [];
  const giveUp = () => {
    if (done || P.peer !== peer) return;
    done = true;
    conns.forEach(c => { try { c.close(); } catch {} });
    pStatus('no room with that code. double-check it with the host?');
  };
  const to = setTimeout(giveUp, 20000);
  P.tryMiss = () => { if (--left <= 0) { clearTimeout(to); giveUp(); } };
  P_TRY.forEach(t => {
    const id = t[0] + P.code.toLowerCase();
    const conn = peer.connect(id, { reliable: true });
    conns.push(conn);
    conn.on('open', () => {
      if (done || P.peer !== peer) { try { conn.close(); } catch {} return; }
      done = true; clearTimeout(to); P.tryMiss = null;
      conns.forEach(c => { if (c !== conn) { try { c.close(); } catch {} } });
      P.trying = id;
      pGuestConnected(peer, conn, t[1]);
    });
  });
}

function pGuestConnected(peer, conn, kind, isRejoin) {
  P.rejoin = { kind, code: P.code, name: P.myName };
  P.lastRoom = P.rejoin;
  P.lastPing = Date.now();
  if (P.ghb) clearInterval(P.ghb);
  P.ghb = setInterval(pGuestBeat, P_HB_MS);
  if (kind === 'versus') {
    // hand the connection to online.js and let it run the show
    if (typeof oOnData !== 'function') { pStatus('versus isn\'t loaded?'); return; }
    O.role = 'guest'; O.names = ['', P.myName]; O.peer = peer; O.conn = conn; O.connected = true; O.code = P.code;
    P.peer = null; P.conn = null; P.role = null;
    Q.game = 'online'; Q.mode = 'mc';
    conn.on('data', oOnData);
    conn.on('close', oDropped);
    conn.on('error', oDropped);
    qSet(qTopBar('&larr; leave', pBack()) + qHeader('🌐 online versus', isRejoin ? 'you\'re back in' : 'you\'re in') +
      '<div class="o-room"><p class="q-note" id="o-status">waiting for the host...</p></div>');
    oSend({ type: 'hello', name: P.myName, rejoin: !!isRejoin });
    return;
  }
  P.conn = conn; P.kind = kind; P.role = 'guest';
  Q.game = kind;
  conn.on('data', pGuestData);
  conn.on('close', pDropped);
  conn.on('error', pDropped);
  pSendTo(conn, { type: 'hello', name: P.myName, rejoin: !!isRejoin });
  pGuestWait(pKindTitle(), isRejoin ? 'you\'re back in! waiting for the host...' : 'you\'re in! waiting for the host...');
}

// ---- guest side: notice a dead connection and quietly get back in ----
function pGuestBeat() {
  const rj = P.rejoin;
  if (!rj || P.reconnecting) return;
  const conn = rj.kind === 'versus' ? O.conn : P.conn;
  if (!conn || !conn.open || Date.now() - P.lastPing > P_GUEST_GRACE) pGuestLost();
}
function pGuestLost() {
  const rj = P.rejoin;
  if (!rj || P.reconnecting) return;
  P.reconnecting = true; P.attempts = 0;
  pStopTick();
  pBanner('connection hiccup - getting you back in...');
  pRejoinTry();
}
function pRejoinTry() {
  const rj = P.rejoin;
  if (!rj || !P.reconnecting) return;
  if (P.rejoinTimer) { clearTimeout(P.rejoinTimer); P.rejoinTimer = null; }
  if (P.attempts++ >= P_REJOIN_TRIES) {
    P.reconnecting = false; pBanner('');
    pScreenDropped('couldn\'t get back into the room');
    return;
  }
  try { if (P.conn) P.conn.close(); } catch {}
  try { if (typeof O !== 'undefined' && O.conn) O.conn.close(); } catch {}
  try { if (P.peer) P.peer.destroy(); } catch {}
  try { if (typeof O !== 'undefined' && O.peer && O.peer !== P.peer) O.peer.destroy(); } catch {}
  P.conn = null; if (typeof O !== 'undefined') { O.conn = null; O.peer = null; }
  const peer = new Peer(undefined, pPeerOpts());
  P.peer = peer;
  let settled = false;
  const later = () => { if (settled) return; settled = true; try { peer.destroy(); } catch {} P.rejoinTimer = setTimeout(pRejoinTry, 5000); };
  peer.on('error', later);
  peer.on('open', () => {
    const prefix = rj.kind === 'party' ? P_PARTY : rj.kind === 'dj' ? P_DJ : rj.kind === 'draw' ? P_DRAW : rj.kind === 'bingop' ? P_BINGO : rj.kind === 'casinop' ? 'sparkle-casino-' : O_PREFIX;
    const conn = peer.connect(prefix + rj.code.toLowerCase(), { reliable: true });
    const to = setTimeout(later, 8000);
    conn.on('open', () => {
      if (settled) { try { conn.close(); } catch {} return; }
      settled = true; clearTimeout(to);
      P.reconnecting = false; pBanner('');
      P.code = rj.code; P.myName = rj.name;
      pGuestConnected(peer, conn, rj.kind, true);
    });
    conn.on('error', later);
  });
}
function pRejoinLast() {
  const rj = P.lastRoom;
  if (!rj) { pScreenJoin(); return; }
  pScreenJoin();
  const c = document.getElementById('p-code-input'), n = document.getElementById('p-name-input');
  if (c) c.value = rj.code;
  if (n) n.value = rj.name;
  pJoin();
}
function pInstallVisibility() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (P.wake) pWake();
    if (P.rejoin && !P.reconnecting) {
      const conn = P.rejoin.kind === 'versus' ? O.conn : P.conn;
      if (!conn || !conn.open || Date.now() - P.lastPing > P_GUEST_GRACE) pGuestLost();
    }
  });
}
pInstallVisibility();

function pGuestWait(title, msg, extra) {
  Q.screen = 'pwait';
  qSet(qTopBar('&larr; leave', pBack()) + qHeader(title, 'room ' + esc(P.code)) +
    '<div class="o-room"><p class="q-note" id="p-status">' + msg + '</p>' + (extra || '') + '</div>');
}

function pGuestData(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'ping') { P.lastPing = Date.now(); pSend({ type: 'pong' }); return; }
  if (msg.type === 'you') {           // the host may have renamed us ("meadow 2") - rejoin under that name
    const n = String(msg.name || '').slice(0, 16);
    if (n) { P.myName = n; if (P.rejoin) P.rejoin.name = n; if (P.lastRoom) P.lastRoom.name = n; }
    return;
  }
  if (P.kind === 'draw') { pDrawGuestData(msg); return; }
  if (P.kind === 'dj') { pDjGuestData(msg); return; }
  if (P.kind === 'bingop') { if (typeof bnGuestData === 'function') bnGuestData(msg); return; }
  if (P.kind === 'casinop') { if (typeof cnGuestData === 'function') cnGuestData(msg); return; }
  switch (msg.type) {
    case 'lobby':
      P.lobby = msg;
      pGuestWait('🎉 party mode', 'connected to <b>' + esc(msg.host || 'the host') + '</b>. waiting for them to start...',
        '<div class="p-chips" style="justify-content:center;margin-top:10px;">' + (msg.players || []).map(n => '<span class="p-chip in">' + esc(n) + '</span>').join('') + '</div>');
      break;
    case 'q': pGuestQuestion(msg); break;
    case 'res': pGuestResult(msg); break;
    case 'fin': pGuestFinal(msg); break;
    case 'full': pScreenDropped('that room is full (' + P_MAX + ' phones max)'); break;
    case 'abort': pScreenDropped(String(msg.why || 'the host stopped the game')); break;
  }
}

function pGuestQuestion(msg) {
  Q.screen = 'pplay';
  P.index = Number(msg.index) || 0; P.mine = null; P.locked = false;
  P.secs = Number(msg.secs) || P_TIME;
  P.deadline = Date.now() + P.secs * 1000;
  pStopTick();
  const choices = Array.isArray(msg.choices) ? msg.choices : [];
  qSet(
    '<div class="v-hud"><span class="qn">song ' + (P.index + 1) + ' of ' + (msg.total || '?') + '</span><span>' + esc(P.myName) + '</span></div>' +
    pTimerBar() +
    '<p class="q-note" style="margin:10px 0;">listen to the host\'s screen. which one is it?</p>' +
    '<div class="q-choices p-big">' + choices.map((c, i) =>
      '<button class="q-choice" id="p-c' + i + '" onclick="pGuestAnswer(' + i + ')"><span class="v-key">' + (i + 1) + '</span><span>' + esc(c.name) + '</span></button>'
    ).join('') + '</div>' +
    '<div class="v-status" id="p-status"><span class="wait">your call</span></div>' +
    '<div id="q-reveal"></div>'
  );
  P.tick = setInterval(() => { if (pTickBar() <= 0) { pStopTick(); if (!P.mine) { pLockGuest(-1); pStatus('<span class="wait">time\'s up - waiting for everyone</span>'); } } }, 100);
}
function pLockGuest(picked) {
  for (let j = 0; j < 4; j++) {
    const el = document.getElementById('p-c' + j);
    if (!el) continue;
    el.disabled = true;
    if (j === picked) el.classList.add('picked'); else el.classList.add('faded');
  }
}
function pGuestAnswer(i) {
  if (P.mine || P.locked || Q.screen !== 'pplay' || P.role !== 'guest') return;
  P.mine = { i };
  pLockGuest(i);
  pStatus('<span class="wait">locked in ✓ waiting for everyone</span>');
  pSend({ type: 'ans', index: P.index, i });
}
function pGuestResult(msg) {
  if (Number(msg.index) !== P.index) return;
  P.locked = true; pStopTick();
  const c = msg.correct || {};
  for (let j = 0; j < 4; j++) {
    const el = document.getElementById('p-c' + j);
    if (!el) continue;
    el.disabled = true; el.classList.remove('picked');
    if (j === msg.i && msg.ok) el.classList.add('right');
    else if (j === msg.i) el.classList.add('wrong');
    else el.classList.add('faded');
  }
  pStatus(msg.i < 0 ? '<span class="bad">too slow 💤</span>' : msg.ok ? '<span class="good">+' + msg.pts + ' 🖤</span>' : '<span class="bad">nope 💔</span>');
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML = '<div class="q-reveal fade-up">' +
      (c.art ? '<img src="' + c.art + '" alt=""><br>' : '') +
      '<div class="song">' + esc(c.name || '') + '</div><div class="who">' + esc(c.artist || '') + '</div>' +
      pBoardHtml(msg.board || [], P.myName) +
      '<div class="q-note" style="margin-top:8px;">next song when the host\'s ready</div></div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
function pGuestFinal(msg) {
  Q.screen = 'pfinal'; pStopTick();
  const board = Array.isArray(msg.board) ? msg.board : [];
  const place = board.findIndex(b => b.name === P.myName) + 1;
  const me = board[place - 1];
  qSet(
    qTopBar('&larr; leave', pBack()) +
    qHeader(pKindTitle(), place === 1 ? 'you won 👑' : place ? 'you came ' + place + (place === 2 ? 'nd' : place === 3 ? 'rd' : 'th') : 'game over') +
    '<div class="q-final fade-up"><div class="num">' + (me ? me.score : 0) + '</div><div class="outof">' + (P.kind === 'dj' ? 'points' : 'out of ' + QUIZ_MAX) + '</div></div>' +
    pBoardHtml(board, P.myName) +
    '<p class="q-note" style="margin-top:12px;">stay here if the host runs it back.</p>'
  );
  if (place === 1 && window.confetti) confetti({ particleCount: 110, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1'] });
}

// ======================== ALBUM PICTIONARY ========================
// co-op: you take turns drawing one of the host's top albums; the other
// one picks it out of a list. 60 seconds a round, 100 points max each.

function pAlbums() {
  const seen = new Set(), out = [];
  for (const t of (typeof lCdTracks === 'function' ? lCdTracks() : [])) {
    const al = t.album; if (!al || !al.name || qIsAlt(al.name)) continue;
    const key = qNorm(al.name) + '|' + qNorm(gPrimary(t));
    if (seen.has(key) || !qArt(t)) continue;
    seen.add(key);
    out.push({ n: al.name, a: gPrimary(t), art: qArt(t) });
  }
  return qShuffle(out).slice(0, 12);
}

function pOpenDraw() {
  if (!pHasPeer()) { qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('✏️ album pictionary', '') + qErrorBox('the online part didn\'t load (peerjs). refresh and try again?')); return; }
  const albums = pAlbums();
  if (albums.length < 6) { qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('✏️ album pictionary', '') + qErrorBox('need at least 6 different albums in your top songs for this one.')); return; }
  pReset();
  P.role = 'host'; P.kind = 'draw'; P.myName = pSavedName() || 'host';
  Q.game = 'draw'; Q.screen = 'dlobby';
  P.draw = { albums, round: 0, rounds: Math.min(P_DRAW_ROUNDS, albums.length), used: [], score: 0, wrong: [], target: -1, drawer: 'host', partner: '' };
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('✏️ album pictionary', 'waiting for your partner') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code" id="p-code">....</div>' +
      '<p class="q-note">they open sparklestats &rarr; <b>join with a room code</b> (front page or arcade, no login needed)</p>' +
      '<p class="q-note" id="p-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="pCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<p class="q-note" style="margin-top:14px;">' + P.draw.rounds + ' rounds, you take turns drawing. the albums come from your top songs. ' +
      'you\'re a team: ' + (P.draw.rounds * 100) + ' points is perfect.</p>'
  );
  pHostPeer(P_DRAW, conn => {
    const live = P.players.filter(p => p.conn && p.conn.open);
    if (live.length) { conn.on('open', () => { pSendTo(conn, { type: 'full' }); setTimeout(() => { try { conn.close(); } catch {} }, 300); }); return; }
    P.players = [];
    const pl = { conn, name: '', id: conn.peer, since: Date.now(), lastPong: 0, score: 0 };
    P.players.push(pl);
    conn.on('data', msg => pDrawHostData(pl, msg));
    conn.on('close', () => pDrawPartnerGone(pl));
    conn.on('error', () => pDrawPartnerGone(pl));
  }, pOpenDraw);
  const codeEl = document.getElementById('p-code'); if (codeEl) codeEl.textContent = P.code;
}

function pDrawHostData(pl, msg) {
  if (!msg || typeof msg !== 'object' || !P.draw) return;
  switch (msg.type) {
    case 'pong': pl.lastPong = Date.now(); break;
    case 'hello': {
      pl.name = String(msg.name || 'partner').slice(0, 16);
      P.draw.partner = pl.name;
      pSendTo(pl.conn, { type: 'lobby', kind: 'draw', host: P.myName });
      const back = !!P.goneTimer;
      if (P.goneTimer) { clearTimeout(P.goneTimer); P.goneTimer = null; }
      if (back && P.draw.round > 0 || (back && P.draw.used.length)) pDrawRound(P.draw.round);   // they came back mid-game: redo this round
      else if (!back) pDrawRound(0);
      else pDrawRound(0);
      break;
    }
    case 'stroke': if (P.draw.drawer === 'guest' && P.canvas) pDrawRecv(P.canvas, msg); break;
    case 'clear': if (P.draw.drawer === 'guest' && P.canvas) pCanvasClear(P.canvas); break;
    case 'guess': if (P.draw.drawer === 'host') pDrawJudge(Number(msg.i)); break;
  }
}

function pDrawRound(n) {
  const D = P.draw; if (!D) return;
  pStopTick(); pStopReveal();
  D.round = n; D.wrong = []; D.locked = false;
  D.drawer = n % 2 === 0 ? 'host' : 'guest';
  const pool = D.albums.map((_, i) => i).filter(i => !D.used.includes(i));
  D.target = pool[Math.floor(Math.random() * pool.length)];
  D.used.push(D.target);
  P.secs = P_DRAW_TIME; P.deadline = Date.now() + P_DRAW_TIME * 1000;
  pSend({ type: 'round', n, rounds: D.rounds, drawer: D.drawer, options: D.albums.map(a => ({ n: a.n, a: a.a })), target: D.drawer === 'guest' ? D.target : null, secs: P_DRAW_TIME, score: D.score });
  if (D.drawer === 'host') pDrawRenderDrawer({ n, rounds: D.rounds, target: D.albums[D.target], score: D.score });
  else pDrawRenderGuesser({ n, rounds: D.rounds, options: D.albums, score: D.score });
  P.tick = setInterval(() => { if (pTickBar() <= 0 && P.role === 'host' && !D.locked) pDrawEnd(false, -1); }, 100);
}

function pDrawHud(n, rounds, score, who) {
  return '<div class="v-hud"><span class="qn">round ' + (n + 1) + ' of ' + rounds + ' &middot; ' + who + '</span><span class="sc">' + score + ' pts</span></div>' + pTimerBar();
}
function pDrawTools() {
  return '<div class="p-tools">' +
    P_COLORS.map(([c, l]) => '<button class="p-color" style="background:' + c + ';" title="' + l + '" onclick="pDrawColor(\'' + c + '\')"></button>').join('') +
    '<button class="p-tool" onclick="pDrawWidth(4)" title="thin">thin</button>' +
    '<button class="p-tool" onclick="pDrawWidth(12)" title="thick">thick</button>' +
    '<button class="p-tool" onclick="pDrawClear()">clear</button>' +
  '</div>';
}

function pDrawRenderDrawer(r) {
  Q.screen = 'dplay';
  qSet(
    pDrawHud(r.n, r.rounds, r.score, 'you draw') +
    '<div class="p-target"><div class="q-note">draw this (no words, no letters)</div><div class="nm">' + esc(r.target.n) + '</div><div class="mt">' + esc(r.target.a) + '</div></div>' +
    '<div class="p-canvaswrap"><canvas id="p-canvas" width="600" height="600" class="p-canvas"></canvas></div>' +
    pDrawTools() +
    '<div class="v-status" id="p-status"><span class="wait">they\'re guessing...</span></div>' +
    '<div id="q-reveal"></div>'
  );
  P.canvas = pCanvasSetup('p-canvas', true);
}
function pDrawRenderGuesser(r) {
  Q.screen = 'dplay';
  qSet(
    pDrawHud(r.n, r.rounds, r.score, 'you guess') +
    '<div class="p-canvaswrap"><canvas id="p-canvas" width="600" height="600" class="p-canvas"></canvas></div>' +
    '<p class="q-note" style="margin:8px 0;">which album is that? 3 wrong guesses and the round\'s over.</p>' +
    '<div class="p-options">' + r.options.map((o, i) =>
      '<button class="p-opt" id="p-o' + i + '" onclick="pDrawGuess(' + i + ')"><span class="nm">' + esc(o.n) + '</span><span class="mt">' + esc(o.a) + '</span></button>'
    ).join('') + '</div>' +
    '<div class="v-status" id="p-status"></div>' +
    '<div id="q-reveal"></div>'
  );
  P.canvas = pCanvasSetup('p-canvas', false);
}

// ---- canvas plumbing ----
function pCanvasSetup(id, canSend) {
  const c = document.getElementById(id);
  if (!c || typeof c.getContext !== 'function') return null;
  const ctx = c.getContext('2d');
  const D = { c, ctx, color: '#FF1493', width: 6, cur: null, pending: [], flush: null, strokes: {} };
  pCanvasClear(D, true);
  if (!canSend) return D;
  const pos = e => { const r = c.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)]; };
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch {}
    D.cur = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), c: D.color, w: D.width, p: [pos(e)] };
    D.pending = D.cur.p.slice();
    pDrawSeg(D, D.cur, D.cur.p);
  });
  c.addEventListener('pointermove', e => {
    if (!D.cur) return;
    e.preventDefault();
    const p = pos(e);
    D.cur.p.push(p); D.pending.push(p);
    pDrawSeg(D, D.cur, D.cur.p.slice(-2));
    if (!D.flush) D.flush = setTimeout(() => pFlush(D, false), 60);
  });
  const up = () => { if (!D.cur) return; pFlush(D, true); D.cur = null; };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  return D;
}
function pCanvasClear(D, silent) {
  if (!D) return;
  D.ctx.fillStyle = '#000000'; D.ctx.fillRect(0, 0, D.c.width, D.c.height);
  D.ctx.lineCap = 'round'; D.ctx.lineJoin = 'round';
  D.strokes = {};
  if (!silent) pSend({ type: 'clear' });
}
function pFlush(D, done) {
  if (D.flush) { clearTimeout(D.flush); D.flush = null; }
  if (!D.cur) return;
  const p = D.pending; D.pending = [];
  if (p.length || done) pSend({ type: 'stroke', id: D.cur.id, c: D.cur.c, w: D.cur.w, p, done: !!done });
}
function pDrawSeg(D, s, pts) {
  const ctx = D.ctx, k = D.c.width / 1000;
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w * k;
  ctx.beginPath();
  if (pts.length === 1) { ctx.arc(pts[0][0] * k, pts[0][1] * k, s.w * k / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.moveTo(pts[0][0] * k, pts[0][1] * k);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * k, pts[i][1] * k);
  ctx.stroke();
}
function pDrawRecv(D, msg) {
  if (!D || !msg || !msg.id) return;
  let s = D.strokes[msg.id];
  if (!s) s = D.strokes[msg.id] = { c: String(msg.c || '#FF1493'), w: Number(msg.w) || 6, last: null };
  const pts = (Array.isArray(msg.p) ? msg.p : []).filter(p => Array.isArray(p) && p.length === 2).map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
  const seq = s.last ? [s.last, ...pts] : pts;
  if (seq.length) pDrawSeg(D, s, seq);
  if (pts.length) s.last = pts[pts.length - 1];
}
function pDrawColor(c) { if (P.canvas) P.canvas.color = c; }
function pDrawWidth(w) { if (P.canvas) P.canvas.width = w; }
function pDrawClear() { if (P.canvas) pCanvasClear(P.canvas); }

// ---- guessing ----
function pDrawGuess(i) {
  const D = P.draw; if (!D || D.locked) return;
  if (P.role === 'host') pDrawJudge(i);
  else { if (D.wrong.includes(i)) return; pSend({ type: 'guess', i }); }
}
// host only
function pDrawJudge(i) {
  const D = P.draw; if (!D || D.locked || !D.albums[i]) return;
  if (i === D.target) { pDrawEnd(true, i); return; }
  if (D.wrong.includes(i)) return;
  D.wrong.push(i);
  pSend({ type: 'judge', i, ok: false, wrong: D.wrong.length });
  pDrawMarkWrong(i);
  if (D.wrong.length >= 3) pDrawEnd(false, -1);
}
function pDrawMarkWrong(i) {
  const el = document.getElementById('p-o' + i);
  if (el) { el.disabled = true; el.classList.add('wrong'); }
  const st = document.getElementById('p-status');
  if (st) st.innerHTML = '<span class="bad">nope 💔</span>';
}
// host only
function pDrawEnd(ok, i) {
  const D = P.draw; if (!D || D.locked) return;
  D.locked = true; pStopTick();
  const pts = ok ? Math.round(40 + 60 * (pLeft() / P_DRAW_TIME)) : 0;
  D.score += pts;
  const t = D.albums[D.target];
  const msg = { type: 'roundend', ok, pts, score: D.score, i, target: { idx: D.target, n: t.n, a: t.a, art: t.art }, last: D.round >= D.rounds - 1 };
  pSend(msg);
  pDrawShowEnd(msg);
  P.revealTimer = setTimeout(() => { if (D.round >= D.rounds - 1) pDrawFinal(); else pDrawRound(D.round + 1); }, 6000);
}
function pDrawShowEnd(msg) {
  const D = P.draw; if (!D) return;
  D.locked = true; pStopTick();
  const t = msg.target || {};
  if (t.idx != null) { const el = document.getElementById('p-o' + t.idx); if (el) el.classList.add('right'); }
  document.querySelectorAll('.p-opt').forEach(el => { el.disabled = true; });
  const st = document.getElementById('p-status');
  if (st) st.innerHTML = msg.ok ? '<span class="good">+' + msg.pts + ' 🖤</span>' : '<span class="bad">' + (msg.i === -1 && D.wrong.length < 3 ? 'time\'s up 💤' : 'not it 💔') + '</span>';
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML = '<div class="q-reveal fade-up">' +
      (t.art ? '<img src="' + t.art + '" alt=""><br>' : '') +
      '<div class="song">' + esc(t.n || '') + '</div><div class="who">' + esc(t.a || '') + '</div>' +
      '<div class="pts">' + (msg.ok ? '+' + msg.pts + ' points' : '+0 points') + ' &middot; ' + msg.score + ' total</div>' +
      '<div class="q-note" style="margin-top:8px;">' + (msg.last ? 'final score coming up...' : 'next round in a sec') + '</div></div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
function pDrawFinal() {
  const D = P.draw; if (!D) return;
  const max = D.rounds * 100;
  const msg = { type: 'drawfin', score: D.score, max, rounds: D.rounds };
  if (P.role === 'host') pSend(msg);
  pDrawShowFinal(msg);
}
function pDrawShowFinal(msg) {
  Q.screen = 'dfinal'; pStopTick(); pStopReveal();
  const pct = msg.max ? msg.score / msg.max : 0;
  const verdict = pct >= 0.85 ? 'you two share a brain' : pct >= 0.6 ? 'solid team. gallery worthy' : pct >= 0.35 ? 'some of those were... abstract' : 'never draw again (affectionate)';
  if (P.role === 'host' && typeof mAward === 'function') mAward('draw');
  qSet(
    qTopBar('&larr; ' + (P.role === 'host' ? 'arcade' : 'leave'), pBack()) +
    qHeader('✏️ album pictionary', verdict) +
    '<div class="q-final fade-up"><div style="font-size:2.4rem;">🖼️</div><div class="num">' + msg.score + '</div><div class="outof">out of ' + msg.max + ' &middot; ' + msg.rounds + ' rounds, together</div></div>' +
    '<div class="q-actions">' +
      (P.role === 'host' ? '<button class="q-btn" onclick="pDrawAgain()">again, new albums</button>' : '<span class="q-note">rematch is up to the host - stay here</span>') +
      '<button class="q-btn ghost" onclick="' + pBack() + '">' + (P.role === 'host' ? 'arcade' : 'leave') + '</button>' +
    '</div>'
  );
  if (pct >= 0.6 && window.confetti) confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FFB6C1', '#ffffff', '#b266ff'] });
}
function pDrawAgain() {
  const D = P.draw; if (!D || P.role !== 'host') return;
  const albums = pAlbums();
  P.draw = { ...D, albums, round: 0, rounds: Math.min(P_DRAW_ROUNDS, albums.length), used: [], score: 0, wrong: [], target: -1 };
  pSend({ type: 'drawagain' });
  pDrawRound(0);
}

// host: the partner vanished - hold the room open for a bit instead of ending it
function pDrawPartnerGone(pl) {
  const i = P.players.indexOf(pl);
  if (i >= 0) P.players.splice(i, 1);
  if (P.role !== 'host' || P.kind !== 'draw' || P.goneTimer) return;
  pStopTick(); pStopReveal();
  if (P.draw) P.draw.locked = true;
  pStatus('<span class="wait">they dropped - holding the room for them to come back...</span>');
  pBanner('your partner dropped - waiting up to 90s for them');
  P.goneTimer = setTimeout(() => { P.goneTimer = null; pBanner(''); pScreenDropped('they didn\'t make it back'); }, P_GONE_MS);
}

// guest side of pictionary
function pDrawGuestData(msg) {
  switch (msg.type) {
    case 'lobby': pGuestWait('✏️ album pictionary', 'connected to <b>' + esc(msg.host || 'the host') + '</b>. first round starting...'); break;
    case 'round': {
      pStopTick(); pStopReveal();
      const options = Array.isArray(msg.options) ? msg.options : [];
      P.draw = { albums: options, round: Number(msg.n) || 0, rounds: Number(msg.rounds) || P_DRAW_ROUNDS, drawer: msg.drawer, target: msg.target, score: Number(msg.score) || 0, wrong: [], locked: false, used: [] };
      P.secs = Number(msg.secs) || P_DRAW_TIME; P.deadline = Date.now() + P.secs * 1000;
      if (msg.drawer === 'guest' && options[msg.target]) pDrawRenderDrawer({ n: P.draw.round, rounds: P.draw.rounds, target: options[msg.target], score: P.draw.score });
      else pDrawRenderGuesser({ n: P.draw.round, rounds: P.draw.rounds, options, score: P.draw.score });
      P.tick = setInterval(() => { if (pTickBar() <= 0) pStopTick(); }, 100);
      break;
    }
    case 'stroke': if (P.draw && P.draw.drawer === 'host' && P.canvas) pDrawRecv(P.canvas, msg); break;
    case 'clear': if (P.draw && P.draw.drawer === 'host' && P.canvas) pCanvasClear(P.canvas, true); break;
    case 'judge': if (P.draw) { P.draw.wrong.push(Number(msg.i)); pDrawMarkWrong(Number(msg.i)); } break;
    case 'roundend': if (P.draw) { P.draw.score = Number(msg.score) || 0; pDrawShowEnd(msg); } break;
    case 'drawfin': pDrawShowFinal(msg); break;
    case 'drawagain': pGuestWait('✏️ album pictionary', 'the host is picking new albums...'); break;
    case 'full': pScreenDropped('that room already has a partner'); break;
    case 'abort': pScreenDropped(String(msg.why || 'the host stopped')); break;
  }
}

// ======================== DJ MODE ========================
// up to 8 people anywhere on the internet. the host picks every song live
// (search anyone, or a random one from their top songs); everyone else hears
// the clip on their own phone and answers - multiple choice or type it.
// 100 points a song, no fixed length: the host ends it whenever.

const P_DJ = 'sparkle-dj-';
const P_DJ_SECS = { mc: 20, type: 30 };
LABS.dj = { emoji: '🎧', name: 'DJ mode', sub: 'up to 8 people anywhere. you pick every song, they guess on their phones' };

function pKindTitle() { return P.kind === 'dj' ? '🎧 DJ mode' : P.kind === 'draw' ? '✏️ album pictionary' : P.kind === 'bingop' ? '🎱 bingo party' : P.kind === 'casinop' ? '🎲 casino night' : '🎉 party mode'; }

function pOpenDj() {
  if (!pHasPeer()) { qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎧 DJ mode', '') + qErrorBox('the online part didn\'t load (peerjs). refresh and try again?')); return; }
  if (P.kind !== 'dj' || P.role !== 'host') { pReset(); P.dj = null; }
  Q.game = 'dj';
  pDjLobby();
}

function pDjLobby() {
  Q.screen = 'djlobby';
  qStopAudio(); qClearTimers(); pStopTick(); pStopReveal();
  P.role = 'host'; P.kind = 'dj'; P.myName = pSavedName() || 'the DJ';
  Q.game = 'dj';
  P.dj = P.dj || { mode: 'mc', index: 0, cur: null, used: [], hits: [], pools: {} };
  P.dj.index = 0; P.dj.cur = null; P.dj.used = [];
  P.players.forEach(p => { p.score = 0; p.ans = null; });
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎧 DJ mode', 'you pick the songs, they guess') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code" id="p-code">' + esc(P.code || '....') + '</div>' +
      '<p class="q-note">they open sparklestats &rarr; <b>join with a room code</b> (front page, no login). anywhere with wifi works - the clip plays on their own phone.</p>' +
      '<p class="q-note" id="p-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="pCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<p class="q-note" style="margin:14px 0 8px;">how they answer</p>' +
    '<div class="tabs">' +
      '<button class="' + (P.dj.mode === 'mc' ? 'active' : '') + '" onclick="pDjMode(\'mc\')">multiple choice</button>' +
      '<button class="' + (P.dj.mode === 'type' ? 'active' : '') + '" onclick="pDjMode(\'type\')">type it out</button>' +
    '</div>' +
    '<div class="q-note" style="margin:16px 0 6px;">who\'s here</div>' +
    '<div class="p-chips" id="p-players"></div>' +
    '<div class="q-actions"><button class="q-btn" id="p-start" onclick="pDjPickScreen()" disabled>start picking songs &rarr;</button></div>' +
    '<p class="q-note" style="margin-top:12px;">100 points a song, faster = more. no set number of songs - you call it when it\'s over. ' + P_MAX + ' people max.</p>'
  );
  if (P.peer && !P.peer.destroyed) { pStatus('room\'s open. waiting...'); pLobbyPlayers(); return; }
  pHostPeer(P_DJ, conn => {
    if (P.players.length >= P_MAX) { conn.on('open', () => { pSendTo(conn, { type: 'full' }); setTimeout(() => { try { conn.close(); } catch {} }, 300); }); return; }
    const pl = { conn, name: '', score: 0, ans: null, id: conn.peer, since: Date.now(), lastPong: 0 };
    P.players.push(pl);
    conn.on('data', msg => pDjHostData(pl, msg));
    conn.on('close', () => pHostPlayerLeft(pl));
    conn.on('error', () => pHostPlayerLeft(pl));
  }, pDjLobby);
  const codeEl = document.getElementById('p-code'); if (codeEl) codeEl.textContent = P.code;
}
function pDjMode(m) { if (P.dj) { P.dj.mode = m === 'type' ? 'type' : 'mc'; pSend(pDjLobbyMsg()); pDjLobby(); } }
function pDjLobbyMsg() {
  return { type: 'lobby', kind: 'dj', host: P.myName, players: P.players.filter(p => p.name).map(p => p.name), mode: P.dj ? P.dj.mode : 'mc' };
}
function pDjHostData(pl, msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'pong': pl.lastPong = Date.now(); break;
    case 'hello': {
      const D = P.dj;
      pWelcomeBack(pl, msg, D ? D.index : 0);
      pSendTo(pl.conn, { type: 'you', name: pl.name });
      pSend(pDjLobbyMsg());
      if (Q.screen === 'djlobby') pLobbyPlayers();
      else if (Q.screen === 'djpick') pChips();
      else if (Q.screen === 'djlive') {
        pChips();
        if (D && D.cur && !P.locked && !pl.ans) pSendTo(pl.conn, { type: 'dj', index: D.index, mode: D.mode, preview: D.cur.preview, choices: D.cur.choices, secs: Math.max(1, Math.ceil(pLeft())) });
      } else if (Q.screen === 'pfinal') pSendTo(pl.conn, { type: 'fin', board: P.board });
      break;
    }
    case 'ans': pDjGotAnswer(pl, msg); break;
  }
}

// the host's "pick the next song" screen
function pDjPickScreen() {
  const D = P.dj; if (!D) return;
  if (!P.players.some(p => p.name) && Q.screen === 'djlobby') return;
  Q.screen = 'djpick';
  pStopTick(); pStopReveal(); qStopAudio();
  const board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  qSet(
    '<div class="v-hud"><span class="qn">song ' + (D.index + 1) + '</span><span>🎧 ' + esc(P.code) + '</span></div>' +
    '<p class="q-note" style="margin:10px 0 6px;">pick the next song. they can\'t see this screen.</p>' +
    '<div style="max-width:480px;margin:0 auto;">' +
      '<div class="q-typerow">' +
        '<input id="p-dj-input" class="q-input" placeholder="search any song or artist..." autocomplete="off">' +
        '<button class="q-btn" onclick="pDjSearch()">go</button>' +
      '</div>' +
      '<div class="q-actions" style="margin-top:8px;"><button class="q-btn ghost" onclick="pDjRandom()">🎲 random from my top songs</button></div>' +
      '<p class="q-note" id="p-status"></p>' +
      '<div id="p-dj-results" style="margin-top:10px;"></div>' +
    '</div>' +
    (board.length ? pBoardHtml(board) : '') +
    '<div class="p-chips" id="p-chips"></div>' +
    '<div class="q-actions" style="margin-top:14px;">' +
      (D.index > 0 ? '<button class="q-btn ghost" onclick="pDjFinal()">🏁 final scores</button>' : '') +
      '<button class="q-btn ghost" onclick="gScreenHub()">quit</button>' +
    '</div>'
  );
  pChips();
  const inp = document.getElementById('p-dj-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') pDjSearch(); }); }
}

async function pDjSearch() {
  const D = P.dj; if (!D) return;
  const inp = document.getElementById('p-dj-input');
  const term = String(inp ? inp.value : '').trim();
  const box = document.getElementById('p-dj-results');
  if (!term || !box) return;
  box.innerHTML = '<p class="q-note">searching...</p>';
  try {
    const res = await qFetch('/search?q=' + encodeURIComponent(term) + '&type=track&limit=' + SEARCH_LIMIT + '&market=' + qMarket());
    D.hits = (res.tracks?.items || []).filter(t => t && t.id && !qIsAlt(t.name));
    if (!D.hits.length) { box.innerHTML = qErrorBox('nothing came up. try the artist name plus the song?'); return; }
    box.innerHTML = D.hits.map((t, i) =>
      '<button class="q-row" onclick="pDjPick(' + i + ')">' +
        (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '<div class="ph">🎵</div>') +
        '<div style="flex:1;overflow:hidden;"><div class="nm">' + esc(qStrip(t.name)) + (D.used.includes(t.id) ? ' <span class="g-badge">played</span>' : '') + '</div>' +
        '<div class="mt">' + esc(qArtistNames(t)) + ' &middot; ' + esc(t.album?.name || '') + '</div></div>' +
      '</button>'
    ).join('');
  } catch (e) {
    box.innerHTML = qErrorBox(esc(e.message));
  }
}
function pDjPick(i) { const D = P.dj; return (D && D.hits[i]) ? pDjSendTrack(D.hits[i]) : Promise.resolve(); }
function pDjRandom() {
  const D = P.dj; if (!D) return;
  const mine = (typeof lCdTracks === 'function' ? lCdTracks() : []).filter(t => !D.used.includes(t.id) && !qIsAlt(t.name));
  if (!mine.length) { pStatus('you\'ve played all your top songs already. search for something!'); return; }
  return pDjSendTrack(mine[Math.floor(Math.random() * mine.length)]);
}

// decoys for multiple choice: the same artist's other songs, topped up from the host's top songs
async function pDjChoices(t) {
  const D = P.dj;
  const a = (t.artists || [])[0];
  let pool = a && D.pools[a.id];
  if (a && !pool) {
    try { pool = await qPoolFromArtist(a); } catch { pool = []; }
    D.pools[a.id] = pool;
  }
  let cand = (pool || []).filter(x => x.id !== t.id && !qIsAlt(x.name));
  if (cand.length < 3) cand = cand.concat((typeof lCdTracks === 'function' ? lCdTracks() : []).filter(x => x.id !== t.id));
  return qMakeChoices(t, [t, ...cand]).map(c => ({ id: c.id, name: qStrip(c.name) }));
}

async function pDjSendTrack(t) {
  const D = P.dj; if (!D || Q.screen !== 'djpick') return;
  if (D.busy) return;
  D.busy = true;
  pStatus('finding a clip for ' + esc(qStrip(t.name)) + '...');
  try {
    const preview = await qFindPreview(t);
    if (!preview) { pStatus('apple has no clean clip for that one - pick another'); return; }
    const choices = D.mode === 'mc' ? await pDjChoices(t) : null;
    if (choices && choices.length < 2) { pStatus('couldn\'t find enough other songs to make choices from. try type-it mode, or another song.'); return; }
    D.cur = { id: t.id, name: qStrip(t.name), artist: qArtistNames(t), art: qArt(t), preview, choices };
    D.used.push(t.id);
    D.index++;
    pDjLive();
  } catch (e) {
    pStatus('that didn\'t work: ' + esc(e.message));
  } finally {
    D.busy = false;
  }
}

function pDjLive() {
  const D = P.dj; if (!D || !D.cur) return;
  Q.screen = 'djlive';
  P.locked = false;
  P.secs = P_DJ_SECS[D.mode] || 20;
  P.deadline = Date.now() + P.secs * 1000;
  P.players.forEach(p => { p.ans = null; });
  pSend({ type: 'dj', index: D.index, mode: D.mode, preview: D.cur.preview, choices: D.cur.choices, secs: P.secs });
  qSet(
    '<div class="v-hud"><span class="qn">song ' + D.index + ' &middot; playing on their phones</span><span>🎧 ' + esc(P.code) + '</span></div>' +
    pTimerBar() +
    '<div class="q-chosen" style="margin-top:12px;">' +
      (D.cur.art ? '<img src="' + D.cur.art + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(D.cur.name) + '</div><div class="mt">' + esc(D.cur.artist) + ' &middot; only you can see this</div></div>' +
    '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="pDjPlayHere()">▶ play it here too</button></div>' +
    '<div class="p-chips" id="p-chips"></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="pDjReveal()">reveal now</button></div>' +
    '<div id="q-reveal"></div>'
  );
  pChips();
  P.tick = setInterval(() => { if (pTickBar() <= 0 && !P.locked) pDjReveal(); }, 100);
}
function pDjPlayHere() { const D = P.dj; if (D && D.cur) qPlayClip(D.cur.preview); }

function pDjGotAnswer(pl, msg) {
  const D = P.dj; if (!D || P.locked || Q.screen !== 'djlive' || Number(msg.index) !== D.index || pl.ans) return;
  pl.ans = { i: Number(msg.i), text: String(msg.text || '').slice(0, 80), left: pLeft() };
  pChips();
  if (P.players.filter(p => p.name).every(p => p.ans)) pDjReveal();
}

function pDjReveal() {
  const D = P.dj; if (!D || !D.cur || P.locked) return;
  P.locked = true;
  pStopTick(); qStopAudio();
  const cur = D.cur;
  const results = P.players.filter(p => p.name).map(p => {
    const a = p.ans;
    let ok = false, guess = '';
    if (a) {
      if (D.mode === 'mc') { const c = cur.choices && cur.choices[a.i]; ok = !!(c && c.id === cur.id); guess = c ? c.name : ''; }
      else { guess = a.text; ok = !!guess && qMatches(guess, cur.name); }
    }
    const pts = ok ? Math.round(100 * (0.5 + 0.5 * (Math.min(P.secs, a.left) / P.secs))) : 0;
    p.score += pts;
    return { p, ok, pts, guess, answered: !!a };
  });
  const board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  const correct = { id: cur.id, name: cur.name, artist: cur.artist, art: cur.art };
  results.forEach(r => pSendTo(r.p.conn, { type: 'res', index: D.index, ok: r.ok, pts: r.pts, guess: r.guess, i: r.p.ans ? r.p.ans.i : -1, correct, board }));
  Q.screen = 'djreveal';
  qSet(
    '<div class="v-hud"><span class="qn">song ' + D.index + '</span><span>🎧 ' + esc(P.code) + '</span></div>' +
    '<div class="q-reveal fade-up">' +
      (cur.art ? '<img src="' + cur.art + '" alt=""><br>' : '') +
      '<div class="song">' + esc(cur.name) + '</div><div class="who">' + esc(cur.artist) + '</div>' +
      '<div class="p-chips" style="justify-content:center;margin:10px 0;">' +
        results.map(r => '<span class="p-chip ' + (r.ok ? 'good' : 'bad') + '">' + esc(r.p.name) + ' ' +
          (!r.answered ? '💤' : r.ok ? '+' + r.pts : '✗') + (D.mode === 'type' && r.answered && !r.ok ? ' <i>"' + esc(r.guess) + '"</i>' : '') + '</span>').join('') +
      '</div>' +
      pBoardHtml(board) +
      '<div class="q-actions"><button class="q-btn" onclick="pDjPickScreen()">pick the next song →</button>' +
        '<button class="q-btn ghost" onclick="pDjFinal()">🏁 final scores</button></div>' +
      '<div class="q-note" style="margin-top:6px;">or just hit enter ↵</div>' +
    '</div>'
  );
}

function pDjFinal() {
  const D = P.dj; if (!D) return;
  Q.screen = 'pfinal';
  pStopTick(); pStopReveal(); qStopAudio();
  P.board = P.players.filter(p => p.name).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score);
  pSend({ type: 'fin', board: P.board });
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎧 DJ mode', P.board.length ? esc(P.board[0].name) + ' takes it after ' + D.index + ' song' + (D.index === 1 ? '' : 's') : 'everyone left?') +
    pPodiumHtml(P.board) +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="pDjAgain()">run it back</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (window.confetti) confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#b266ff'] });
}
function pDjAgain() {
  if (P.role !== 'host' || P.kind !== 'dj') return;
  pSend(pDjLobbyMsg());
  pDjLobby();
}

function pPodiumHtml(board) {
  const medal = ['👑', '🥈', '🥉'];
  return '<div class="p-podium">' + board.slice(0, 3).map((b, i) =>
    '<div class="p-pod p' + (i + 1) + '"><div class="medal">' + medal[i] + '</div><div class="nm">' + esc(b.name) + '</div><div class="num">' + b.score + '</div></div>'
  ).join('') + '</div>' + (board.length > 3 ? pBoardHtml(board.slice(3)) : '');
}

// ---- guest side ----
function pDjGuestData(msg) {
  switch (msg.type) {
    case 'lobby':
      pGuestWait('🎧 DJ mode', '<b>' + esc(msg.host || 'the host') + '</b> is the DJ. waiting for the first song...' +
        (msg.mode === 'type' ? '<br>you\'ll be typing the titles.' : '<br>multiple choice.'),
        '<div class="p-chips" style="justify-content:center;margin-top:10px;">' + (msg.players || []).map(n => '<span class="p-chip in">' + esc(n) + '</span>').join('') + '</div>');
      break;
    case 'dj': pDjGuestQuestion(msg); break;
    case 'res': pDjGuestResult(msg); break;
    case 'fin': pGuestFinal(msg); break;
    case 'full': pScreenDropped('that room is full (' + P_MAX + ' people max)'); break;
    case 'abort': pScreenDropped(String(msg.why || 'the DJ stopped')); break;
  }
}

function pDjGuestQuestion(msg) {
  Q.screen = 'pplay';
  P.index = Number(msg.index) || 0; P.mine = null; P.locked = false;
  P.secs = Number(msg.secs) || 20;
  P.deadline = Date.now() + P.secs * 1000;
  P.dj = { mode: msg.mode === 'type' ? 'type' : 'mc', preview: String(msg.preview || ''), choices: Array.isArray(msg.choices) ? msg.choices : [] };
  pStopTick();
  const body = P.dj.mode === 'mc'
    ? '<div class="q-choices p-big">' + P.dj.choices.map((c, i) =>
        '<button class="q-choice" id="p-c' + i + '" onclick="pGuestAnswer(' + i + ')"><span class="v-key">' + (i + 1) + '</span><span>' + esc(c.name) + '</span></button>'
      ).join('') + '</div>'
    : '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="name that song..." autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="pDjGuestType()">lock it in</button>' +
      '</div></div>';
  qSet(
    '<div class="v-hud"><span class="qn">song ' + P.index + '</span><span>' + esc(P.myName) + '</span></div>' +
    pTimerBar() +
    '<div class="q-player" style="padding:14px;">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="pDjGuestReplay()" style="width:84px;height:84px;"><div class="hole"></div></div>' +
      '<button class="q-replay" onclick="pDjGuestReplay()">↻ play again</button>' +
      '<p class="q-note" style="margin-top:8px;">' + (P.dj.mode === 'mc' ? 'which one is this?' : 'type the song name') + '</p>' +
    '</div>' +
    body +
    '<div class="v-status" id="p-status"><span class="wait">your call</span></div>' +
    '<div id="q-reveal"></div>'
  );
  const inp = document.getElementById('q-type-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') pDjGuestType(); }); }
  qPlayClip(P.dj.preview);
  P.tick = setInterval(() => {
    if (pTickBar() <= 0) {
      pStopTick();
      if (!P.mine) { pLockGuest(-1); const i2 = document.getElementById('q-type-input'); if (i2) i2.disabled = true; pStatus('<span class="wait">time\'s up - waiting for the DJ</span>'); }
    }
  }, 100);
}
function pDjGuestReplay() { if (P.dj && P.dj.preview && !P.locked) qPlayClip(P.dj.preview); }
function pDjGuestType() {
  if (P.mine || P.locked || Q.screen !== 'pplay' || P.role !== 'guest') return;
  const inp = document.getElementById('q-type-input');
  const text = String(inp ? inp.value : '').trim();
  if (!text) return;
  P.mine = { text };
  if (inp) inp.disabled = true;
  pStatus('<span class="wait">locked in ✓ waiting for the DJ</span>');
  pSend({ type: 'ans', index: P.index, text });
}
function pDjGuestResult(msg) {
  if (Number(msg.index) !== P.index) return;
  P.locked = true; pStopTick(); qStopAudio();
  const bars = document.getElementById('q-bars'); if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc'); if (disc) disc.classList.remove('spinning');
  const c = msg.correct || {};
  if (P.dj && P.dj.mode === 'mc') {
    P.dj.choices.forEach((ch, j) => {
      const el = document.getElementById('p-c' + j);
      if (!el) return;
      el.disabled = true; el.classList.remove('picked');
      if (ch.id === c.id) el.classList.add('right');
      else if (j === msg.i) el.classList.add('wrong');
      else el.classList.add('faded');
    });
  } else {
    const inp = document.getElementById('q-type-input'); if (inp) inp.disabled = true;
  }
  pStatus(msg.i === -1 && !msg.guess ? '<span class="bad">too slow 💤</span>' : msg.ok ? '<span class="good">+' + msg.pts + ' 🖤</span>' : '<span class="bad">nope 💔</span>');
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML = '<div class="q-reveal fade-up">' +
      (c.art ? '<img src="' + c.art + '" alt=""><br>' : '') +
      '<div class="song">' + esc(c.name || '') + '</div><div class="who">' + esc(c.artist || '') + '</div>' +
      (!msg.ok && msg.guess ? '<div class="who">you said "' + esc(msg.guess) + '"</div>' : '') +
      pBoardHtml(msg.board || [], P.myName) +
      '<div class="q-note" style="margin-top:8px;">next song when the DJ picks one</div></div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

X_HUB.social.push(() => xCard('🎧', 'DJ mode', LABS.dj.sub, 'pOpenDj()'));

// ======================== DROPS ========================

function pDropped() {
  if (!['party', 'draw', 'dj', 'bingop', 'casinop'].includes(Q.game)) return;
  if (P.role === 'host') return;                       // hosts handle leavers per player (see pHostPlayerLeft / pDrawPartnerGone)
  if (P.rejoin && !P.reconnecting) { pGuestLost(); return; }   // guests try to get back in first
  if (P.reconnecting) return;
  pScreenDropped('connection dropped');
}
function pScreenDropped(why) {
  pStopTick(); pStopReveal(); qStopAudio();
  const guest = P.role !== 'host';
  const title = pKindTitle();
  qSet(qTopBar('&larr; ' + (guest ? 'back' : 'arcade'), pBack()) + qHeader(title, '') +
    qErrorBox(esc(why) + '<br>' + (guest ? 'if the host\'s still there you can jump right back in.' : 'head back and try again. wifi helps, and hotspots sometimes don\'t.')) +
    (guest && P.lastRoom ? '<div class="q-actions"><button class="q-btn" onclick="pRejoinLast()">rejoin the room</button></div>' : ''));
  const keep = P.lastRoom;
  pReset();
  P.lastRoom = keep;
  Q.game = 'classic';
}

// ======================== HOOKS ========================

(function pInstallHooks() {
  const prev = { qScreenMode, gScreenHub, closeQuiz, oMyName, oHubCards, oDropped };
  qScreenMode = function () {
    if (Q.game === 'party') { pScreenLobby(); return; }
    return prev.qScreenMode();
  };
  gScreenHub = function () {
    if (Q.game === 'party' || Q.game === 'draw' || Q.game === 'dj' || Q.game === 'bingop' || Q.game === 'casinop') { pReset(); Q.game = 'classic'; }
    return prev.gScreenHub();
  };
  closeQuiz = function () {
    if (Q.game === 'party' || Q.game === 'draw' || Q.game === 'dj' || Q.game === 'bingop' || Q.game === 'casinop' || Q.screen === 'pjoin') { pReset(); Q.game = 'classic'; }
    return prev.closeQuiz();
  };
  oMyName = () => P.myName || prev.oMyName();
  const prevDropped = oDropped;
  oDropped = function () {
    if (O.role === 'guest' && P.rejoin && P.rejoin.kind === 'versus') { if (!P.reconnecting) pGuestLost(); return; }
    return prevDropped();
  };
  window.oDropped = oDropped;
  oHubCards = () =>
    '<button class="q-src" onclick="pScreenJoin()"><span class="ico">🔑</span><span class="lbl">join with a room code</span>' +
    '<span class="sub">party mode, DJ mode, bingo, casino night, album pictionary, or an online versus - got a code? in here</span></button>';
})();

X_HUB.social.push(
  () => xCard('🎉', 'party mode', LABS.party.sub, 'pOpenParty()'),
  () => xCard('✏️', 'album pictionary', LABS.draw.sub, 'pOpenDraw()')
);

// ======================== KEYBOARD ========================

function pInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (Q.screen === 'djreveal' && e.key === 'Enter' && P.role === 'host') { e.preventDefault(); pDjPickScreen(); return; }
    if (Q.screen === 'pplay') {
      if (e.key === 'Enter' && P.role === 'host' && P.locked) { e.preventDefault(); pNext(); return; }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0 && P.role === 'guest') { e.preventDefault(); pGuestAnswer(i); }
    }
  });
}
pInstallKeys();

// ======================== EXPORTS ========================

Object.assign(window, {
  qScreenMode, gScreenHub, closeQuiz, oMyName, oHubCards,
  pOpenParty, pScreenLobby, pCopyCode, pSetLen, pHostStart, pReplay, pNext, pAgain,
  pOpenJoin, pScreenJoin, pJoin, pGuestAnswer,
  pOpenDraw, pDrawGuess, pDrawColor, pDrawWidth, pDrawClear, pDrawAgain, pReset,
  pOpenDj, pDjMode, pDjPickScreen, pDjSearch, pDjPick, pDjRandom, pDjPlayHere, pDjReveal, pDjFinal, pDjAgain, pDjGuestType, pDjGuestReplay,
  pRejoinLast, pGuestLost, pPeerOpts,
});
