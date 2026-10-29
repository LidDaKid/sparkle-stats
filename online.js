// ============================================================
//  xXx SparkleStats xXx  -  online.js
//  versus over the internet: two screens, same songs, same time.
//  browser-to-browser over webrtc (peerjs), with peerjs's free public
//  broker used only for the handshake. the host picks the songs and
//  keeps score; the guest joins with a 4-character room code.
//  loads after versus.js; reuses its panel styles.
// ============================================================

const O_PREFIX = 'sparkle-stats-';
const O_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I mixups
const O_TIME = 25;

LABS.online = { emoji: '🌐', name: 'online versus', sub: 'two screens, over the internet' };

const O = {
  role: null, peer: null, conn: null, code: '', connected: false,
  names: ['', ''], scores: [0, 0], questions: [], index: 0, results: [],
  mine: null, theirs: null, locked: false, deadline: 0, tick: null, revealTimer: null,
  hb: null, lastPong: 0, lastPing: 0, goneTimer: null,
};
function oPeerOpts() { return typeof pPeerOpts === 'function' ? pPeerOpts() : { debug: 0 }; }

// ======================== LITTLE HELPERS ========================

function oCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += O_ALPHABET[Math.floor(Math.random() * O_ALPHABET.length)];
  return s;
}
function oMyName() { return String(typeof gPlayer === 'function' ? gPlayer() : 'me').slice(0, 16); }
function oHasPeer() { return typeof Peer === 'function'; }
function oMe() { return O.role === 'host' ? 0 : 1; }
function oThem() { return 1 - oMe(); }
function oStopTick() { if (O.tick) { clearInterval(O.tick); O.tick = null; } }
function oStatus(html) { const el = document.getElementById('o-status'); if (el) el.innerHTML = html; }
function oSend(msg) { try { if (O.conn && O.conn.open) O.conn.send(msg); } catch {} }

// tear the connection down - called when leaving the online screens
function oReset() {
  oStopTick();
  if (O.revealTimer) { clearTimeout(O.revealTimer); O.revealTimer = null; }
  if (O.hb) { clearInterval(O.hb); O.hb = null; }
  if (O.goneTimer) { clearTimeout(O.goneTimer); O.goneTimer = null; }
  try { if (O.conn) O.conn.close(); } catch {}
  try { if (O.peer) O.peer.destroy(); } catch {}
  O.conn = null; O.peer = null; O.connected = false; O.role = null;
  O.scores = [0, 0]; O.results = []; O.questions = []; O.index = 0;
  O.mine = null; O.theirs = null; O.locked = false;
}

function oNoPeerScreen(back) {
  qSet(qTopBar('&larr; back', back) + qHeader('🌐 online versus', '') +
    qErrorBox('the online part didn\'t load (peerjs). refresh the page and try again?'));
}

function oHubCards() {
  return '<button class="q-src" onclick="oScreenJoin()">' +
    '<span class="ico">🌐</span><span class="lbl">join an online versus</span>' +
    '<span class="sub">got a room code from someone? enter it here</span></button>';
}

// ======================== HOST ========================
// reached from the versus setup screen, so a song pool is already loaded

function oScreenHost() {
  if (!oHasPeer()) { oNoPeerScreen('qScreenMode()'); return; }
  if (!Q.pool || Q.pool.length < QUIZ_MIN_Q) { qScreenMenu(); return; }
  oReset();
  O.role = 'host';
  O.names = [oMyName(), ''];
  O.code = oCode();
  Q.game = 'online'; Q.mode = 'mc';
  const s = Q.source || { name: '?', image: '' };
  qSet(
    qTopBar('&larr; back', 'gScreenHub()') +
    qHeader('🌐 online versus', 'waiting for your opponent') +
    '<div class="o-room">' +
      '<div class="q-note">room code</div>' +
      '<div class="o-code">' + O.code + '</div>' +
      '<p class="q-note">they open sparklestats &rarr; arcade &rarr; <b>join an online versus</b> &rarr; type this in.</p>' +
      '<p class="q-note" id="o-status" style="margin-top:8px;">setting up the room...</p>' +
      '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="oCopyCode(this)">copy code</button></div>' +
    '</div>' +
    '<div class="q-chosen" style="margin-top:20px;">' +
      (s.image ? '<img src="' + s.image + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(s.name) + '</div>' +
      '<div class="mt">' + Q.len + ' songs &middot; ' + O_TIME + ' sec each &middot; you pick, they join</div></div>' +
    '</div>'
  );
  const peer = new Peer(O_PREFIX + O.code.toLowerCase(), oPeerOpts());
  O.peer = peer;
  O.hb = setInterval(oHostBeat, 4000);
  peer.on('open', () => oStatus('room\'s open. waiting for them...'));
  peer.on('error', e => {
    const t = (e && e.type) || 'unknown';
    if (t === 'unavailable-id') { oScreenHost(); return; }          // code already taken, roll another
    oStatus('connection trouble (' + esc(t) + '). back to the arcade and try again?');
  });
  peer.on('connection', conn => {
    if (O.conn && O.conn.open) { try { conn.close(); } catch {} return; }        // one opponent only
    O.conn = conn;
    O.lastPong = Date.now();
    conn.on('open', () => { O.connected = true; oStatus('someone\'s here! setting up the songs...'); });
    conn.on('data', oOnData);
    conn.on('close', () => oGuestGone(conn));
    conn.on('error', () => oGuestGone(conn));
  });
}

// host: ping the guest; if they vanish mid-game hold the room open for them
function oHostBeat() {
  if (O.role !== 'host' || !O.conn) return;
  oSend({ type: 'ping' });
  if (O.lastPong && Date.now() - O.lastPong > 20000) { const c = O.conn; try { c.close(); } catch {} oGuestGone(c); }
}
function oGuestGone(conn) {
  if (O.role !== 'host' || Q.game !== 'online') return;
  if (conn && O.conn && conn !== O.conn) return;      // an old connection closing after a rejoin
  O.conn = null; O.connected = false;
  if (!O.questions.length) { oStatus('they left. waiting for someone...'); return; }
  if (O.goneTimer) return;
  oStopTick();
  const st = document.getElementById('o-status-them');
  if (st) st.innerHTML = '<span class="wait">' + esc(O.names[1] || 'they') + ' dropped - holding the room for them...</span>';
  if (typeof pBanner === 'function') pBanner('they dropped - waiting up to 90s for them to come back');
  O.goneTimer = setTimeout(() => { O.goneTimer = null; if (typeof pBanner === 'function') pBanner(''); oScreenDropped((O.names[1] || 'they') + ' didn\'t make it back'); }, 90000);
}

function oCopyCode(btn) {
  navigator.clipboard.writeText(O.code).then(() => {
    btn.textContent = 'copied 🩷';
    setTimeout(() => { btn.textContent = 'copy code'; }, 2000);
  }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}

// host: build the round the normal way (clips from apple, 4 choices) and ship it over
async function oHostStart() {
  oStatus('finding songs you can both hear...');
  const built = await qBuildQuestions(Q.pool, () => {});
  if (built.length < QUIZ_MIN_Q) {
    oSend({ type: 'abort', why: 'couldn\'t find enough songs with clips for that pick' });
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🌐 online versus', '') +
      qErrorBox('couldn\'t find enough songs with playable clips in there. try a different artist or playlist.'));
    return;
  }
  O.questions = built.map(q => ({
    id: q.track.id, name: qStrip(q.track.name), artist: qArtistNames(q.track), art: qArt(q.track), preview: q.preview,
    choices: qMakeChoices(q.track, Q.pool).map(c => ({ id: c.id, name: qStrip(c.name) })),
  }));
  O.scores = [0, 0]; O.results = []; O.index = 0;
  Q.perQ = QUIZ_MAX / O.questions.length;
  oSend({ type: 'start', questions: O.questions, names: O.names.slice(), perQ: Q.perQ });
  oSong(0);
  oSend({ type: 'song', index: 0 });
}

// ======================== GUEST ========================

function oScreenJoin() {
  if (!oHasPeer()) { oNoPeerScreen('gScreenHub()'); return; }
  oReset();
  O.role = 'guest';
  O.names = ['', oMyName()];
  Q.game = 'online'; Q.mode = 'mc';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🌐 join an online versus', 'get the room code from whoever\'s hosting') +
    '<div class="o-room">' +
      '<div class="q-typerow" style="max-width:340px;margin:0 auto;">' +
        '<input id="o-code-input" class="q-input o-code-input" placeholder="CODE" maxlength="4" autocomplete="off" autocapitalize="characters">' +
        '<button class="q-btn" onclick="oJoin()">join</button>' +
      '</div>' +
      '<p class="q-note" id="o-status" style="margin-top:12px;"></p>' +
    '</div>'
  );
  const inp = document.getElementById('o-code-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') oJoin(); }); }
}

function oJoin() {
  const inp = document.getElementById('o-code-input');
  const code = String(inp ? inp.value : '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 4) { oStatus('codes are 4 letters and numbers'); return; }
  if (O.peer) { try { O.peer.destroy(); } catch {} O.peer = null; }
  O.code = code;
  oStatus('connecting...');
  const peer = new Peer(undefined, oPeerOpts());
  O.peer = peer;
  peer.on('error', e => {
    const t = (e && e.type) || 'unknown';
    oStatus(t === 'peer-unavailable'
      ? 'no room with that code. double-check it with the host?'
      : 'connection trouble (' + esc(t) + '). try again, and wifi helps.');
  });
  peer.on('open', () => {
    const conn = peer.connect(O_PREFIX + code.toLowerCase(), { reliable: true });
    O.conn = conn;
    conn.on('open', () => {
      O.connected = true;
      oSend({ type: 'hello', name: oMyName() });
      oStatus('you\'re in! waiting for the host to start...');
    });
    conn.on('data', oOnData);
    conn.on('close', oDropped);
    conn.on('error', oDropped);
  });
}

// ======================== MESSAGES ========================

function oOnData(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'ping': if (O.role === 'guest') { O.lastPing = Date.now(); if (typeof P !== 'undefined') P.lastPing = Date.now(); oSend({ type: 'pong' }); } break;
    case 'pong': if (O.role === 'host') O.lastPong = Date.now(); break;
    case 'hello':
      if (O.role === 'host') {
        O.names[1] = String(msg.name || 'guest').slice(0, 16);
        if (O.goneTimer) { clearTimeout(O.goneTimer); O.goneTimer = null; }
        if (typeof pBanner === 'function') pBanner('');
        if (O.questions.length) {
          // they came back mid-game: hand them the round again and replay the current song
          oSend({ type: 'start', questions: O.questions, names: O.names.slice(), perQ: Q.perQ, scores: O.scores.slice(), results: O.results.slice() });
          if (Q.screen === 'oresults') oSend({ type: 'final', scores: O.scores.slice(), results: O.results.slice() });
          else { oSong(O.index); oSend({ type: 'song', index: O.index }); }
        } else oHostStart();
      }
      break;
    case 'start':
      if (O.role === 'guest') {
        O.questions = Array.isArray(msg.questions) ? msg.questions : [];
        if (Array.isArray(msg.names) && msg.names.length === 2) O.names = msg.names.map(n => String(n || '').slice(0, 16));
        Q.perQ = Number(msg.perQ) || (QUIZ_MAX / Math.max(1, O.questions.length));
        O.scores = Array.isArray(msg.scores) && msg.scores.length === 2 ? msg.scores.map(Number) : [0, 0];
        O.results = Array.isArray(msg.results) ? msg.results : [];
        O.index = 0;
        oStatus('starting...');
      }
      break;
    case 'song':   if (O.role === 'guest') oSong(Number(msg.index) || 0); break;
    case 'answer': oGotTheirs(msg); break;
    case 'result': if (O.role === 'guest') oShowResult(msg); break;
    case 'final':  if (O.role === 'guest') oScreenFinal(msg); break;
    case 'again':
      if (O.role === 'guest') qSet('<div class="q-loadwrap"><div class="spinner">🌐</div><p>' + esc(O.names[0]) + ' is picking new songs...</p></div>');
      break;
    case 'abort':  oScreenDropped(String(msg.why || 'the host had to stop')); break;
  }
}

// ======================== PLAY ========================

function oSong(index) {
  O.index = index; O.mine = null; O.theirs = null; O.locked = false;
  oStopTick();
  if (O.revealTimer) { clearTimeout(O.revealTimer); O.revealTimer = null; }
  const q = O.questions[index];
  if (!q) return;
  Q.screen = 'oplay';                 // not 'play', so the normal enter/next handler stays out of it
  O.deadline = Date.now() + O_TIME * 1000;
  const me = oMe(), them = oThem();
  qSet(
    '<div class="v-hud">' +
      '<span class="qn">song ' + (index + 1) + ' of ' + O.questions.length + '</span>' +
      '<span><b style="color:var(--pink);">' + esc(O.names[0]) + ' ' + O.scores[0] + '</b>' +
        ' <span style="color:var(--darkpink);">vs</span> ' +
        '<b style="color:#b266ff;">' + O.scores[1] + ' ' + esc(O.names[1]) + '</b></span>' +
    '</div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    '<div class="q-player" style="padding:14px;">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="oReplay()" style="width:84px;height:84px;"><div class="hole"></div></div>' +
      '<button class="q-replay" onclick="oReplay()">↻ play again</button>' +
    '</div>' +
    '<div class="v-panel p' + (me + 1) + '" style="margin-bottom:12px;">' +
      '<div class="v-who">' + (me ? '💜 ' : '🩷 ') + esc(O.names[me]) + ' (you) <span class="v-keys">keys 1 2 3 4</span></div>' +
      '<div class="q-choices v-choices">' +
        q.choices.map((c, i) =>
          '<button class="q-choice" id="o-c' + i + '" onclick="oAnswer(' + i + ')">' +
            '<span class="v-key">' + (i + 1) + '</span><span>' + esc(c.name) + '</span>' +
          '</button>'
        ).join('') +
      '</div>' +
      '<div class="v-status" id="o-status-me"><span class="wait">your call</span></div>' +
    '</div>' +
    '<div class="v-status" id="o-status-them" style="margin-bottom:12px;"><span class="wait">' + esc(O.names[them]) + ' is thinking...</span></div>' +
    '<div id="q-reveal"></div>'
  );
  qPlayClip(q.preview);
  O.tick = setInterval(oTick, 100);
}

function oReplay() {
  const q = O.questions[O.index];
  if (q && !O.locked) qPlayClip(q.preview);
}

function oTick() {
  const left = Math.max(0, O.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / O_TIME) * 100 + '%'; bar.classList.toggle('low', left <= O_TIME * 0.3); }
  if (left <= 0 && !O.locked) {
    if (O.role === 'host') oFinalize();
    else { oStopTick(); oLockMine(-1); const st = document.getElementById('o-status-me'); if (st) st.innerHTML = '<span class="wait">time\'s up - waiting for the host</span>'; }
  }
}

function oLockMine(pickedIdx) {
  const q = O.questions[O.index];
  if (!q) return;
  q.choices.forEach((c, j) => {
    const el = document.getElementById('o-c' + j);
    if (!el) return;
    el.disabled = true;
    if (j === pickedIdx) el.classList.add('picked'); else el.classList.add('faded');
  });
}

function oAnswer(i) {
  if (O.locked || O.mine) return;
  const q = O.questions[O.index];
  if (!q || !q.choices[i]) return;
  const left = Math.max(0, O.deadline - Date.now()) / 1000;
  O.mine = { i, left };
  oLockMine(i);
  const st = document.getElementById('o-status-me');
  if (st) st.innerHTML = '<span class="wait">locked in ✓</span>';
  oSend({ type: 'answer', index: O.index, i, left });
  if (O.role === 'host') oMaybeFinalize();
}

function oGotTheirs(msg) {
  if (Number(msg.index) !== O.index) return;
  O.theirs = { i: Number(msg.i), left: Math.max(0, Number(msg.left) || 0) };
  const st = document.getElementById('o-status-them');
  if (st) st.innerHTML = '<span class="wait">' + esc(O.names[oThem()]) + ' locked in ✓</span>';
  if (O.role === 'host') oMaybeFinalize();
}

function oMaybeFinalize() {
  if (O.mine && O.theirs) oFinalize();
}

// host only: score both answers the same way and tell the guest
function oFinalize() {
  if (O.locked) return;
  const q = O.questions[O.index];
  const calc = a => {
    if (!a || !q.choices[a.i]) return { ok: false, pts: 0, i: -1 };
    const ok = q.choices[a.i].id === q.id;
    const left = Math.min(O_TIME, Math.max(0, a.left));
    return { ok, pts: ok ? Math.round(Q.perQ * (0.5 + 0.5 * (left / O_TIME))) : 0, i: a.i };
  };
  const r = [calc(O.mine), calc(O.theirs)];      // [host, guest]
  O.scores[0] += r[0].pts; O.scores[1] += r[1].pts;
  const msg = { type: 'result', index: O.index, r, scores: O.scores.slice() };
  oSend(msg);
  oShowResult(msg);
}

function oShowResult(msg) {
  if (Number(msg.index) !== O.index || !Array.isArray(msg.r)) return;
  O.locked = true;
  oStopTick(); qStopAudio();
  O.scores = (msg.scores || O.scores).slice();
  O.results[O.index] = msg.r;
  const q = O.questions[O.index];
  const me = oMe(), them = oThem();
  const mine = msg.r[me], theirs = msg.r[them];
  q.choices.forEach((c, j) => {
    const el = document.getElementById('o-c' + j);
    if (!el) return;
    el.disabled = true;
    el.classList.remove('picked');
    if (c.id === q.id) el.classList.add('right');
    else if (j === mine.i) el.classList.add('wrong');
    else el.classList.add('faded');
  });
  const bars = document.getElementById('q-bars'); if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc'); if (disc) disc.classList.remove('spinning');
  const verdict = x => x.i < 0 ? '<span class="bad">too slow 💤</span>' : x.ok ? '<span class="good">+' + x.pts + ' 🖤</span>' : '<span class="bad">nope 💔</span>';
  const stMe = document.getElementById('o-status-me'); if (stMe) stMe.innerHTML = verdict(mine);
  const stThem = document.getElementById('o-status-them'); if (stThem) stThem.innerHTML = esc(O.names[them]) + ': ' + verdict(theirs);
  const last = O.index === O.questions.length - 1;
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML =
      '<div class="q-reveal fade-up">' +
        (q.art ? '<img src="' + q.art + '" alt=""><br>' : '') +
        '<div class="song">' + esc(q.name) + '</div>' +
        '<div class="who">' + esc(q.artist) + '</div>' +
        '<div class="pts"><b style="color:var(--pink);">' + esc(O.names[0]) + '</b> ' + (msg.r[0].ok ? '+' + msg.r[0].pts : '0') +
          ' &middot; <b style="color:#b266ff;">' + esc(O.names[1]) + '</b> ' + (msg.r[1].ok ? '+' + msg.r[1].pts : '0') + '</div>' +
        (O.role === 'host'
          ? '<div class="q-actions"><button class="q-btn" onclick="oNext()">' + (last ? 'see who won →' : 'next song →') + '</button></div>' +
            '<div class="q-note" style="margin-top:6px;">or just hit enter ↵</div>'
          : '<div class="q-note" style="margin-top:10px;">' + (last ? 'waiting for the final score...' : 'next song when the host\'s ready') + '</div>') +
      '</div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (O.role === 'host') O.revealTimer = setTimeout(oNext, REVEAL_MS);
}

// host only
function oNext() {
  if (O.role !== 'host' || !O.locked) return;
  if (O.revealTimer) { clearTimeout(O.revealTimer); O.revealTimer = null; }
  if (O.index >= O.questions.length - 1) {
    const msg = { type: 'final', scores: O.scores.slice(), results: O.results.slice() };
    oSend(msg);
    oScreenFinal(msg);
    return;
  }
  const n = O.index + 1;
  oSend({ type: 'song', index: n });
  oSong(n);
}

// ======================== FINAL ========================

function oSaveScores() {
  if (!Q.source && O.role === 'guest') Q.source = { kind: 'online', id: O.code, name: 'online versus' };
  if (typeof gLoadLB !== 'function') return;
  const lb = gLoadLB();
  const src = Q.source || { kind: 'online', id: O.code, name: 'online versus' };
  [0, 1].forEach(p => lb.push({
    game: 'online', mode: 'mc', len: O.questions.length, score: O.scores[p],
    src: src.kind + ':' + src.id, name: src.name, player: O.names[p], at: Date.now(),
  }));
  lb.sort((a, b) => b.score - a.score || a.at - b.at);
  if (lb.length > 300) lb.length = 300;
  try { localStorage.setItem(G_LB_KEY, JSON.stringify(lb)); } catch {}
}

function oScreenFinal(msg) {
  oStopTick(); qStopAudio();
  if (O.revealTimer) { clearTimeout(O.revealTimer); O.revealTimer = null; }
  Q.screen = 'oresults';
  O.locked = true;
  O.scores = (msg.scores || O.scores).slice();
  O.results = Array.isArray(msg.results) ? msg.results : O.results;
  const [a, b] = O.scores;
  const winner = a === b ? -1 : (a > b ? 0 : 1);
  const me = oMe();
  oSaveScores();
  if (typeof mOnOnlineEnd === 'function') mOnOnlineEnd(winner, me);
  const side = p =>
    '<div class="v-final-side p' + (p + 1) + (p === winner ? ' win' : '') + '">' +
      (p === winner ? '<div class="crown">👑</div>' : '') +
      '<div class="nm">' + esc(O.names[p]) + (p === me ? ' (you)' : '') + '</div>' +
      '<div class="num">' + O.scores[p] + '</div>' +
      '<div class="outof">out of ' + QUIZ_MAX + '</div>' +
    '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🌐 online versus', winner === -1 ? 'dead tie. rematch, obviously.' : (winner === me ? 'you took it' : esc(O.names[winner]) + ' took it')) +
    '<div class="v-final">' + side(0) + '<div class="vs">vs</div>' + side(1) + '</div>' +
    '<div class="q-recap">' +
      O.questions.map((q, i) => {
        const r = O.results[i] || [{ ok: false, pts: 0 }, { ok: false, pts: 0 }];
        return '<div class="q-recap-row">' +
          '<span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' +
          (q.art ? '<img src="' + q.art + '" alt="">' : '') +
          '<div class="info"><div class="nm">' + esc(q.name) + '</div><div class="ar">' + esc(q.artist) + '</div></div>' +
          '<span class="p ' + (r[0].ok ? 'good' : 'bad') + '">🩷 ' + (r[0].ok ? '+' + r[0].pts : '0') + '</span>' +
          '<span class="p ' + (r[1].ok ? 'good' : 'bad') + '">💜 ' + (r[1].ok ? '+' + r[1].pts : '0') + '</span>' +
        '</div>';
      }).join('') +
    '</div>' +
    '<div class="q-actions">' +
      (O.role === 'host'
        ? '<button class="q-btn" onclick="oAgain()">rematch (new songs)</button>'
        : '<span class="q-note">rematch is up to the host - stay on this screen</span>') +
      '<button class="q-btn ghost" onclick="gScreenLeaderboard()">leaderboard</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (winner === me && window.confetti) {
    confetti({ particleCount: 110, spread: 80, origin: { y: 0.4 }, colors: me === 0 ? ['#FF1493', '#FF69B4', '#FFB6C1'] : ['#8B00FF', '#b266ff', '#FF00FF'] });
  }
}

function oAgain() {
  if (O.role !== 'host') return;
  oSend({ type: 'again' });
  qSet('<div class="q-loadwrap"><div class="spinner">🌐</div><p>picking new songs...</p></div>');
  oHostStart();
}

// ======================== DROPS ========================

function oDropped() {
  if (Q.game !== 'online') return;
  oScreenDropped('connection dropped');
}

function oScreenDropped(why) {
  oStopTick(); qStopAudio();
  if (O.revealTimer) { clearTimeout(O.revealTimer); O.revealTimer = null; }
  qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🌐 online versus', '') +
    qErrorBox(esc(why) + '<br>both of you head back to the arcade and try again. wifi helps, and hotspots sometimes don\'t.'));
  oReset();
  Q.game = 'classic';
}

// ======================== KEYBOARD ========================
// 1-4 answers; enter = next song for the host once the reveal is up

function oInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    if (Q.game !== 'online' || Q.screen !== 'oplay') return;
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter') { if (O.role === 'host' && O.locked) { e.preventDefault(); oNext(); } return; }
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0 && !O.locked) { e.preventDefault(); oAnswer(i); }
  });
}
oInstallKeys();

// ======================== EXPORTS ========================

window.oHubCards = oHubCards;
window.oScreenHost = oScreenHost;
window.oScreenJoin = oScreenJoin;
window.oJoin = oJoin;
window.oCopyCode = oCopyCode;
window.oAnswer = oAnswer;
window.oReplay = oReplay;
window.oNext = oNext;
window.oAgain = oAgain;
window.oReset = oReset;
window.oOnData = oOnData;
