// ============================================================
//  xXx SparkleStats xXx  -  versus.js
//  two people, one screen, same songs. player 1 answers on keys
//  1-4 (or the pink panel), player 2 on keys 7-0 (or the purple
//  panel). one guess each per song, faster = more points, and
//  nobody sees who was right until both have locked in.
//  loads after labs.js; reuses the quiz source picker + scoring.
// ============================================================

const V_TIME = 25;
const V_KEYS = [['1', '2', '3', '4'], ['7', '8', '9', '0']];
const V_NAMES_KEY = 'sparkle_versus_names';

LABS.versus = { emoji: '🥊', name: 'versus', sub: 'two of you, one screen, same songs. most points wins.' };

const V = { names: ['player 1', 'player 2'], scores: [0, 0], answered: [null, null], tick: null };

// ======================== NAMES ========================

function vLoadNames() {
  try {
    const s = JSON.parse(localStorage.getItem(V_NAMES_KEY) || 'null');
    if (Array.isArray(s) && s.length === 2) V.names = s.map(n => String(n || '').slice(0, 16));
  } catch {}
  if (V.names[0] === 'player 1' && typeof gPlayer === 'function' && gPlayer() !== 'me') V.names[0] = gPlayer();
  return V.names;
}

function vSaveNames() {
  try { localStorage.setItem(V_NAMES_KEY, JSON.stringify(V.names)); } catch {}
}

function vName(i, v) {
  V.names[i] = String(v || '').trim().slice(0, 16) || ('player ' + (i + 1));
  vSaveNames();
}

// ======================== HUB + ENTRY ========================

function vHubCards() {
  return '<div class="g-hub-label">together</div>' +
    '<div class="g-hub">' +
      '<button class="q-src" onclick="vOpen()">' +
        '<span class="ico">🥊</span><span class="lbl">versus <span class="g-badge">2 players</span></span>' +
        '<span class="sub">same screen, or host it online for two screens</span>' +
      '</button>' +
      (typeof oHubCards === 'function' ? oHubCards() : '') +
    '</div>';
}

function vOpen() {
  Q.game = 'versus'; Q.mode = 'mc'; Q.len = QUIZ_LEN;
  G.daily = false; G.challenge = null;
  qScreenMenu();
}

// stands in for the mode screen once a pool is loaded
function vScreenSetup() {
  Q.screen = 'mode';
  vLoadNames();
  try {
    const saved = parseInt(localStorage.getItem('quiz_len'));
    if (QUIZ_LENGTHS.includes(saved)) Q.len = saved;
  } catch {}
  while (Q.len > Q.pool.length && Q.len > QUIZ_LENGTHS[0]) {
    Q.len = QUIZ_LENGTHS[QUIZ_LENGTHS.indexOf(Q.len) - 1];
  }
  const s = Q.source || { name: '?', sub: '', image: '' };
  qSet(
    qTopBar('&larr; pick something else', 'vOpen()') +
    qHeader('🥊 versus', 'who\'s going down') +
    '<div class="q-chosen">' +
      (s.image ? '<img src="' + s.image + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(s.name) + '</div>' +
      '<div class="mt">' + esc(s.sub) + ' &middot; ' + Q.pool.length + ' songs in the pool</div></div>' +
    '</div>' +
    '<div class="v-setup">' +
      '<div class="v-namebox p1"><div class="v-who">🩷 player 1 <span class="v-keys">keys 1 2 3 4</span></div>' +
        '<input class="q-input" value="' + esc(V.names[0]) + '" maxlength="16" placeholder="name" oninput="vName(0,this.value)"></div>' +
      '<div class="v-namebox p2"><div class="v-who">💜 player 2 <span class="v-keys">keys 7 8 9 0</span></div>' +
        '<input class="q-input" value="' + esc(V.names[1]) + '" maxlength="16" placeholder="name" oninput="vName(1,this.value)"></div>' +
    '</div>' +
    '<p class="q-note" style="margin:16px 0 8px;">how many songs</p>' +
    '<div class="tabs" id="q-len-tabs">' +
      QUIZ_LENGTHS.map(n =>
        '<button class="' + (n === Q.len ? 'active' : '') + '"' + (n > Q.pool.length ? ' disabled' : '') +
        ' onclick="qSetLen(' + n + ')">' + n + '</button>'
      ).join('') +
    '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="vStart()">fight (same screen) &rarr;</button></div>' +
    (typeof oScreenHost === 'function'
      ? '<div class="q-actions" style="margin-top:2px;"><button class="q-btn ghost" onclick="oScreenHost()">🌐 host it online instead (two screens)</button></div>'
      : '') +
    '<p class="q-note" style="margin-top:14px;">same song for both of you. one guess each. faster = more points. ' +
      V_TIME + ' seconds a song.<br>nobody sees who got it until you\'ve both locked in.</p>'
  );
}

function vStart() {
  V.scores = [0, 0];
  Q.game = 'versus';
  Q.mode = 'mc';
  return qStart('mc');
}

// ======================== PLAY ========================

function vStopTick() {
  if (V.tick) { clearInterval(V.tick); V.tick = null; }
}

function vPanel(p, q) {
  return '<div class="v-panel p' + (p + 1) + '" id="v-panel' + p + '">' +
    '<div class="v-who">' + (p ? '💜 ' : '🩷 ') + esc(V.names[p]) +
      '<span class="v-score" id="v-score' + p + '">' + V.scores[p] + '</span></div>' +
    '<div class="q-choices v-choices">' +
      q.choices.map((c, i) =>
        '<button class="q-choice" id="v-c' + p + '-' + i + '" onclick="vAnswer(' + p + ',' + i + ')">' +
          '<span class="v-key">' + V_KEYS[p][i] + '</span><span>' + esc(qStrip(c.name)) + '</span>' +
        '</button>'
      ).join('') +
    '</div>' +
    '<div class="v-status" id="v-status' + p + '"><span class="wait">waiting...</span></div>' +
  '</div>';
}

function vRenderQuestion() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); vStopTick();
  V.answered = [null, null];
  const q = Q.questions[Q.index];
  Q.duration = V_TIME;
  Q.deadline = Date.now() + V_TIME * 1000;
  qSet(
    '<div class="v-hud">' +
      '<span class="qn">song ' + (Q.index + 1) + ' of ' + Q.questions.length + '</span>' +
      '<span>' + esc(V.names[0]) + ' <b style="color:var(--pink);">' + V.scores[0] + '</b>' +
        ' <span style="color:var(--darkpink);">vs</span> ' +
        '<b style="color:#b266ff;">' + V.scores[1] + '</b> ' + esc(V.names[1]) + '</span>' +
    '</div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    '<div class="q-player" style="padding:14px;">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="qReplay()" style="width:84px;height:84px;"><div class="hole"></div></div>' +
      '<button class="q-replay" onclick="qReplay()">↻ play again</button>' +
    '</div>' +
    '<div class="v-panels">' + vPanel(0, q) + vPanel(1, q) + '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="vFinish()">nobody knows it, skip</button></div>' +
    '<div id="q-reveal"></div>'
  );
  qPlayClip(q.preview);
  V.tick = setInterval(vTick, 100);
}

function vTick() {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / Q.duration) * 100 + '%'; bar.classList.toggle('low', left <= Q.duration * 0.3); }
  if (left <= 0 && !Q.locked) vFinish();
}

function vAnswer(p, i) {
  if (Q.locked || V.answered[p]) return;
  const q = Q.questions[Q.index];
  if (!q.choices[i]) return;
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const correct = qIsAnswer(q.choices[i], q.track);
  const points = correct ? Math.round(Q.perQ * (0.5 + 0.5 * (left / Q.duration))) : 0;
  V.answered[p] = { i, correct, points, guess: q.choices[i].name };
  // lock this player's panel but don't say if they were right - the other player is still guessing
  q.choices.forEach((c, j) => {
    const el = document.getElementById('v-c' + p + '-' + j);
    if (!el) return;
    el.disabled = true;
    if (j === i) el.classList.add('picked'); else el.classList.add('faded');
  });
  const st = document.getElementById('v-status' + p);
  if (st) st.innerHTML = '<span class="wait">locked in ✓</span>';
  if (V.answered[0] && V.answered[1]) vFinish();
}

function vFinish() {
  if (Q.locked) return;
  Q.locked = true;
  vStopTick(); qClearTimers(); qStopAudio();
  const bars = document.getElementById('q-bars'); if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc'); if (disc) disc.classList.remove('spinning');
  const gu = document.getElementById('q-giveup'); if (gu) gu.style.display = 'none';

  const q = Q.questions[Q.index];
  [0, 1].forEach(p => {
    const a = V.answered[p];
    if (a) V.scores[p] += a.points;
    q.choices.forEach((c, j) => {
      const el = document.getElementById('v-c' + p + '-' + j);
      if (!el) return;
      el.disabled = true;
      el.classList.remove('picked');
      if (qIsAnswer(c, q.track)) el.classList.add('right');
      else if (a && a.i === j) el.classList.add('wrong');
      else el.classList.add('faded');
    });
    const st = document.getElementById('v-status' + p);
    if (st) st.innerHTML = !a ? '<span class="bad">too slow 💤</span>'
      : a.correct ? '<span class="good">+' + a.points + ' 🖤</span>' : '<span class="bad">nope 💔</span>';
    const sc = document.getElementById('v-score' + p);
    if (sc) sc.textContent = V.scores[p];
  });

  Q.results.push({
    track: q.track,
    points: V.answered[0]?.points || 0, correct: !!V.answered[0]?.correct, guess: V.answered[0]?.guess || null,
    v: V.answered.map(a => a ? { ok: a.correct, pts: a.points } : { ok: false, pts: 0 }),
  });

  const last = Q.index === Q.questions.length - 1;
  const line = [0, 1].map(p => {
    const a = V.answered[p];
    return '<b style="color:' + (p ? '#b266ff' : 'var(--pink)') + ';">' + esc(V.names[p]) + '</b> ' +
      (a && a.correct ? '+' + a.points : '0');
  }).join(' &middot; ');
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML =
      '<div class="q-reveal fade-up">' +
        (qArt(q.track) ? '<img src="' + qArt(q.track) + '" alt=""><br>' : '') +
        '<div class="song">' + esc(qStrip(q.track.name)) + '</div>' +
        '<div class="who">' + esc(qArtistNames(q.track)) + '</div>' +
        '<div class="pts">' + line + '</div>' +
        '<div class="q-actions"><button class="q-btn" onclick="qNext()">' + (last ? 'see who won →' : 'next song →') + '</button></div>' +
        '<div class="q-note" style="margin-top:6px;">or just hit enter ↵</div>' +
      '</div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  Q.revealTimer = setTimeout(qNext, REVEAL_MS);
}

// ======================== RESULTS ========================

function vSaveScores() {
  if (!Q.source || !Q.results.length) return;
  const lb = gLoadLB();
  [0, 1].forEach(p => lb.push({
    game: 'versus', mode: 'mc', len: Q.results.length, score: V.scores[p],
    src: Q.source.kind + ':' + Q.source.id, name: Q.source.name, player: V.names[p], at: Date.now(),
  }));
  lb.sort((a, b) => b.score - a.score || a.at - b.at);
  if (lb.length > 300) lb.length = 300;
  try { localStorage.setItem(G_LB_KEY, JSON.stringify(lb)); } catch {}
}

function vScreenResults() {
  Q.screen = 'results';
  qStopAudio(); qClearTimers(); vStopTick();
  const [a, b] = V.scores;
  const winner = a === b ? -1 : (a > b ? 0 : 1);
  vSaveScores();
  if (typeof mOnVersusEnd === 'function') mOnVersusEnd(winner);
  const side = p =>
    '<div class="v-final-side p' + (p + 1) + (p === winner ? ' win' : '') + '">' +
      (p === winner ? '<div class="crown">👑</div>' : '') +
      '<div class="nm">' + esc(V.names[p]) + '</div>' +
      '<div class="num">' + V.scores[p] + '</div>' +
      '<div class="outof">out of ' + QUIZ_MAX + '</div>' +
    '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🥊 versus', winner === -1 ? 'dead tie. rematch, obviously.' : esc(V.names[winner]) + ' takes it') +
    '<div class="v-final">' + side(0) + '<div class="vs">vs</div>' + side(1) + '</div>' +
    '<p class="q-note" style="margin-bottom:10px;">' + esc(Q.source.name) + '</p>' +
    '<div class="q-recap">' +
      Q.results.map((r, i) =>
        '<div class="q-recap-row">' +
          '<span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' +
          (qArt(r.track) ? '<img src="' + qArt(r.track) + '" alt="">' : '') +
          '<div class="info"><div class="nm">' + esc(qStrip(r.track.name)) + '</div><div class="ar">' + esc(qArtistNames(r.track)) + '</div></div>' +
          '<span class="p ' + (r.v[0].ok ? 'good' : 'bad') + '" title="' + esc(V.names[0]) + '">🩷 ' + (r.v[0].ok ? '+' + r.v[0].pts : '0') + '</span>' +
          '<span class="p ' + (r.v[1].ok ? 'good' : 'bad') + '" title="' + esc(V.names[1]) + '">💜 ' + (r.v[1].ok ? '+' + r.v[1].pts : '0') + '</span>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="vStart()">rematch</button>' +
      '<button class="q-btn ghost" onclick="vSwap()">swap sides</button>' +
      '<button class="q-btn ghost" onclick="vOpen()">new songs</button>' +
      '<button class="q-btn ghost" onclick="gScreenLeaderboard()">leaderboard</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (winner >= 0 && window.confetti) {
    confetti({ particleCount: 110, spread: 80, origin: { x: winner === 0 ? 0.3 : 0.7, y: 0.4 },
               colors: winner === 0 ? ['#FF1493', '#FF69B4', '#FFB6C1'] : ['#8B00FF', '#b266ff', '#FF00FF'] });
  }
}

function vSwap() {
  V.names.reverse();
  vSaveNames();
  return vStart();
}

// ======================== KEYBOARD ========================
// 1-4 answers for player 1, 7-0 for player 2. only while a versus song is live.

function vInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    if (Q.game !== 'versus' || Q.screen !== 'play' || Q.locked) return;
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    for (let p = 0; p < 2; p++) {
      const i = V_KEYS[p].indexOf(e.key);
      if (i >= 0) { e.preventDefault(); vAnswer(p, i); return; }
    }
  });
}
vInstallKeys();

// ======================== EXPORTS ========================

window.vHubCards = vHubCards;
window.vOpen = vOpen;
window.vScreenSetup = vScreenSetup;
window.vName = vName;
window.vStart = vStart;
window.vRenderQuestion = vRenderQuestion;
window.vAnswer = vAnswer;
window.vFinish = vFinish;
window.vScreenResults = vScreenResults;
window.vSwap = vSwap;
