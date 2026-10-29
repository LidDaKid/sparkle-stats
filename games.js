// ============================================================
//  xXx SparkleStats xXx  -  games.js
//  the arcade: hub + heardle / cover art / higher-or-lower /
//  daily song / song tarot / challenge links / leaderboard.
//  sits on top of quiz.js and reuses its source picker, scoring,
//  reveal card and results screen.
// ============================================================

const G_HEARDLE_STAGES = [1, 2, 4, 8, 16, 30];          // seconds of clip unlocked per stage
const G_HEARDLE_MULT   = [1, 0.8, 0.6, 0.45, 0.3, 0.15]; // share of the points if you get it at that stage
const G_COVER_TIME = 15;                                 // seconds for the cover to fully sharpen
const G_HILO_TIME = 10;
const G_DAILY_PLAYLIST = '';   // paste a public playlist id here and everyone gets the same daily song. blank = your own top songs
const G_LB_KEY = 'sparkle_lb';
const G_DAILY_KEY = 'sparkle_daily';

const GAMES = {
  classic: { emoji: '🎧', name: 'guess the song', sub: 'hear a clip, name it, beat the clock' },
  heardle: { emoji: '🔊', name: 'heardle', sub: '1 second. then 2. then 4. fewer = more points' },
  cover:   { emoji: '🖼️', name: 'cover art', sub: 'a blurry album cover sharpens up. who is it?' },
  hilo:    { emoji: '⚖️', name: 'higher or lower', sub: 'which one is longer? which came out first?' },
};

const G = { stage: 0, wrong: [], clipTimer: null, challenge: null, daily: false, tarot: [], tarotFlipped: false, lbFilter: 'all' };

// ======================== LITTLE HELPERS ========================

// FNV-1a - a stable number from a string, for "same pick every time" things
function gHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

function gPrimary(t) { return (t.artists || [])[0]?.name || ''; }
function gYear(t) { return parseInt((t.album?.release_date || '').slice(0, 4)) || 0; }
function gPlayer() { return (typeof _data !== 'undefined' && _data?.user?.display_name) || 'me'; }

function gB64(o) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function gUnB64(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

function gClearClip() {
  if (G.clipTimer) { clearTimeout(G.clipTimer); G.clipTimer = null; }
}

function gHud() {
  return '<div class="q-hud">' +
    '<span class="qn">song ' + (Q.index + 1) + ' of ' + Q.questions.length + '</span>' +
    '<span class="sc">' + Math.round(Q.score) + ' pts</span>' +
  '</div>';
}

function gTimerBar() {
  return '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>';
}

function gHideGiveUp() {
  const gu = document.getElementById('q-giveup');
  if (gu) gu.style.display = 'none';
}

// ======================== HUB ========================

function gScreenHub() {
  Q.screen = 'hub';
  qStopAudio(); qClearTimers(); gClearClip();
  if (Q.game === 'online' && typeof oReset === 'function') oReset();   // hang up the online room
  if (Q.game === 'online') Q.game = 'classic';
  G.challenge = null; G.daily = false;
  const daily = gDailyState();
  const card = k => '<button class="q-src" onclick="gPick(\'' + k + '\')">' +
    '<span class="ico">' + GAMES[k].emoji + '</span><span class="lbl">' + GAMES[k].name + '</span>' +
    '<span class="sub">' + GAMES[k].sub + '</span></button>';
  qSet(
    qTopBar('&larr; back to stats', 'closeQuiz()') +
    qHeader('arcade', 'pick your poison') +
    '<div class="g-hub-label">games</div>' +
    '<div class="g-hub">' +
      Object.keys(GAMES).map(card).join('') +
      '<button class="q-src" onclick="gScreenDaily()">' +
        '<span class="ico">📅</span><span class="lbl">daily song' + (daily.playedToday ? '<span class="g-badge">done</span>' : '') + '</span>' +
        '<span class="sub">one song a day &middot; streak: ' + daily.streak + '</span></button>' +
      '<button class="q-src" onclick="gScreenTarot()">' +
        '<span class="ico">🔮</span><span class="lbl">song tarot</span>' +
        '<span class="sub">pick a card, get a song and a reading</span></button>' +
    '</div>' +
    '<div class="g-hub-label">scores</div>' +
    '<div class="g-hub">' +
      '<button class="q-src wide" onclick="gScreenLeaderboard()">' +
        '<span class="ico">🏆</span><span class="lbl">leaderboard</span>' +
        '<span class="sub">best runs on this device</span></button>' +
    '</div>' +
    (typeof lHubCards === 'function' ? lHubCards() : '') +
    (typeof vHubCards === 'function' ? vHubCards() : '') +
    (typeof mHubCards === 'function' ? mHubCards() : '')
  );
}

function gPick(game) {
  Q.game = GAMES[game] ? game : 'classic';
  Q.len = QUIZ_LEN;         // the mode screen restores the saved pick; this just undoes a daily's len=1
  G.daily = false;
  qScreenMenu();
}

// hands the question screen to the right renderer; false = let quiz.js do classic
function gRenderQuestion() {
  if (typeof mRenderQuestion === 'function' && mRenderQuestion()) return true;
  if (Q.game === 'versus' && typeof vRenderQuestion === 'function') { vRenderQuestion(); return true; }
  if (Q.game === 'heardle') { gRenderHeardle(); return true; }
  if (Q.game === 'cover')   { gRenderCover();   return true; }
  if (Q.game === 'hilo')    { gRenderHilo();    return true; }
  return false;
}

// ======================== HEARDLE ========================

function gPipsHtml() {
  return G_HEARDLE_STAGES.map((s, i) =>
    '<div class="g-pip ' + (i < G.stage ? 'miss' : i === G.stage ? 'on' : '') + '" title="' + s + 's"></div>'
  ).join('');
}

function gStageText() {
  const s = G_HEARDLE_STAGES[G.stage];
  return s + ' second' + (s === 1 ? '' : 's') + ' unlocked &middot; worth ' + Math.round(Q.perQ * G_HEARDLE_MULT[G.stage]) + ' pts';
}

function gRenderHeardle() {
  Q.screen = 'play'; Q.locked = false;
  qClearTimers(); gClearClip();
  G.stage = 0; G.wrong = [];
  const q = Q.questions[Q.index];

  const answerUI = Q.mode === 'mc'
    ? '<div class="q-choices">' + q.choices.map((c, i) =>
        '<button class="q-choice" id="q-c' + i + '" onclick="gHeardleChoice(' + i + ')">' + esc(qStrip(c.name)) + '</button>'
      ).join('') + '</div>'
    : '<div class="q-typewrap">' +
        '<div class="q-typerow">' +
          '<input id="q-type-input" class="q-input" placeholder="name that song..." autocomplete="off" autocorrect="off" spellcheck="false">' +
          '<button class="q-btn" onclick="gHeardleTyped()">guess</button>' +
        '</div>' +
        '<div class="g-wrongs" id="g-wrongs"></div>' +
      '</div>';

  qSet(
    gHud() +
    '<div class="q-player">' +
      '<div class="g-pips" id="g-pips">' + gPipsHtml() + '</div>' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="gPlayStage()"><div class="hole"></div></div>' +
      '<div class="g-bar"><div class="g-open" id="g-open"><div class="g-fill" id="g-fill"></div></div></div>' +
      '<div class="g-stage-txt" id="g-stage-txt">' + gStageText() + '</div>' +
      '<button class="q-replay" onclick="gPlayStage()">↻ play again</button>' +
    '</div>' +
    answerUI +
    '<div class="q-actions">' +
      '<button class="q-btn ghost" id="g-skip" onclick="gHeardleSkip()">skip &rarr; unlock more</button>' +
      '<button class="q-btn ghost" id="q-giveup" onclick="qGiveUp()">i give up</button>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );

  if (Q.mode === 'type') {
    const inp = document.getElementById('q-type-input');
    if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') gHeardleTyped(); }); }
  }
  gPlayStage();
}

// plays only as much of the clip as the current stage allows
function gPlayStage() {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  gClearClip();
  const secs = G_HEARDLE_STAGES[G.stage];
  qPlayClip(q.preview);
  const bars = document.getElementById('q-bars');
  const disc = document.getElementById('q-disc');
  if (bars) bars.classList.add('on');
  if (disc) disc.classList.add('spinning');

  // unlocked portion of the 30s bar, with a fill that sweeps across it in real time
  const open = document.getElementById('g-open');
  const fill = document.getElementById('g-fill');
  if (open && fill) {
    open.style.width = (secs / 30 * 100) + '%';
    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth;
    fill.style.transition = 'width ' + secs + 's linear';
    fill.style.width = '100%';
  }

  G.clipTimer = setTimeout(() => {
    if (Q.audio) Q.audio.pause();
    if (bars) bars.classList.remove('on');
    if (disc) disc.classList.remove('spinning');
  }, secs * 1000);
}

function gHeardleAdvance() {
  G.stage++;
  if (G.stage >= G_HEARDLE_STAGES.length) {
    G.stage = G_HEARDLE_STAGES.length - 1;
    qLockAnswerUI(-1);
    gHeardleLock();
    qFinishQuestion(false, null, 'gaveup');
    return;
  }
  const pips = document.getElementById('g-pips');
  const txt = document.getElementById('g-stage-txt');
  if (pips) pips.innerHTML = gPipsHtml();
  if (txt) txt.innerHTML = gStageText();
  gPlayStage();
}

function gHeardleLock() {
  gClearClip();
  const sk = document.getElementById('g-skip');
  if (sk) sk.style.display = 'none';
}

function gHeardleSkip() {
  if (Q.locked) return;
  gHeardleAdvance();
}

function gHeardlePoints() {
  return Math.round(Q.perQ * G_HEARDLE_MULT[G.stage]);
}

function gHeardleTyped() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  if (qMatches(guess, q.track.name)) {
    qLockAnswerUI(-1);
    gHeardleLock();
    qFinishQuestion(true, guess, null, gHeardlePoints());
    return;
  }
  G.wrong.push(guess);
  inp.value = '';
  const w = document.getElementById('g-wrongs');
  if (w) w.innerHTML = G.wrong.map(x => '<span>' + esc(x) + '</span>').join('');
  inp.classList.remove('g-shake'); void inp.offsetWidth; inp.classList.add('g-shake');
  gHeardleAdvance();
}

function gHeardleChoice(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const c = q.choices[i];
  if (qIsAnswer(c, q.track)) {
    qLockAnswerUI(i);
    gHeardleLock();
    qFinishQuestion(true, c.name, null, gHeardlePoints());
    return;
  }
  const el = document.getElementById('q-c' + i);
  if (el) { el.disabled = true; el.classList.add('wrong'); }
  gHeardleAdvance();
}

// ======================== COVER ART ========================

// one question per distinct artist, so the answer is never "the same person again"
function gBuildCoverQuestions(pool) {
  const byArtist = new Map();
  for (const t of qShuffle(pool.filter(t => !qIsAlt(t.name)))) {
    const k = qNorm(gPrimary(t));
    if (k && qArt(t) && !byArtist.has(k)) byArtist.set(k, t);
  }
  const picks = [...byArtist.values()];
  const names = picks.map(gPrimary);
  return picks.slice(0, Q.len).map(t => {
    const answer = gPrimary(t);
    const decoys = qShuffle(names.filter(n => n !== answer)).slice(0, 3);
    return { track: t, answer, choices: qShuffle([answer, ...decoys]) };
  });
}

function gRenderCover() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); gClearClip();
  const q = Q.questions[Q.index];
  Q.duration = G_COVER_TIME;
  Q.deadline = Date.now() + G_COVER_TIME * 1000;

  const answerUI = Q.mode === 'mc'
    ? '<div class="q-choices">' + q.choices.map((c, i) =>
        '<button class="q-choice" id="q-c' + i + '" onclick="gCoverChoice(' + i + ')">' + esc(c) + '</button>'
      ).join('') + '</div>'
    : '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="who is this?" autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="gCoverTyped()">lock it in</button>' +
      '</div></div>';

  qSet(
    gHud() + gTimerBar() +
    '<div class="g-coverwrap">' +
      '<img class="g-cover" id="g-cover" src="' + qArt(q.track) + '" alt="" style="filter:blur(30px);">' +
      '<p class="q-note" style="margin-top:8px;">whose album is this?</p>' +
    '</div>' +
    answerUI +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="gCoverGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );
  if (Q.mode === 'type') {
    const inp = document.getElementById('q-type-input');
    if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') gCoverTyped(); }); }
  }
  Q.tick = setInterval(gTickCover, 100);
}

function gTickCover() {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / Q.duration) * 100 + '%'; bar.classList.toggle('low', left <= Q.duration * 0.3); }
  const im = document.getElementById('g-cover');
  if (im) im.style.filter = 'blur(' + (30 * Math.pow(left / Q.duration, 1.6)).toFixed(1) + 'px)';
  if (left <= 0 && !Q.locked) { gCoverLock(-1); qFinishQuestion(false, null, 'timeout'); }
}

function gCoverLock(pickedIdx) {
  const q = Q.questions[Q.index];
  if (Q.mode === 'mc') {
    q.choices.forEach((c, j) => {
      const el = document.getElementById('q-c' + j);
      if (!el) return;
      el.disabled = true;
      if (c === q.answer) el.classList.add('right');
      else if (j === pickedIdx) el.classList.add('wrong');
      else el.classList.add('faded');
    });
  } else {
    const inp = document.getElementById('q-type-input');
    if (inp) inp.disabled = true;
  }
  gHideGiveUp();
  const im = document.getElementById('g-cover');
  if (im) im.style.filter = 'blur(0)';
}

function gCoverChoice(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  gCoverLock(i);
  qFinishQuestion(q.choices[i] === q.answer, q.choices[i]);
}

function gCoverTyped() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  gCoverLock(-1);
  qFinishQuestion(qMatches(guess, q.answer), guess);
}

function gCoverGiveUp() {
  if (Q.locked) return;
  gCoverLock(-1);
  qFinishQuestion(false, null, 'gaveup');
}

// ======================== HIGHER OR LOWER ========================

function gBuildHiloQuestions(pool) {
  const ok = pool.filter(t => t.duration_ms && gYear(t) && qArt(t) && !qIsAlt(t.name));
  const qs = [];
  const used = new Set();
  let tries = 0;
  while (qs.length < Q.len && tries++ < 400 && ok.length >= 2) {
    const a = ok[Math.floor(Math.random() * ok.length)];
    const b = ok[Math.floor(Math.random() * ok.length)];
    if (a.id === b.id) continue;
    const key = [a.id, b.id].sort().join('|');
    if (used.has(key)) continue;
    const ask = Math.random() < 0.5 ? 'longer' : 'older';
    // no coin flips: skip pairs that are basically the same
    if (ask === 'longer' && Math.abs(a.duration_ms - b.duration_ms) < 15000) continue;
    if (ask === 'older' && gYear(a) === gYear(b)) continue;
    used.add(key);
    const correct = ask === 'longer'
      ? (a.duration_ms > b.duration_ms ? a : b)
      : (gYear(a) < gYear(b) ? a : b);
    qs.push({
      track: correct, pair: [a, b], ask,
      detail: ask === 'longer' ? fmtDur(a.duration_ms) + ' vs ' + fmtDur(b.duration_ms) : gYear(a) + ' vs ' + gYear(b),
    });
  }
  return qs;
}

function gHiloFact(t, ask) {
  return ask === 'longer' ? fmtDur(t.duration_ms) : String(gYear(t));
}

function gRenderHilo() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); gClearClip(); qStopAudio();
  const q = Q.questions[Q.index];
  Q.duration = G_HILO_TIME;
  Q.deadline = Date.now() + G_HILO_TIME * 1000;
  const side = (t, i) =>
    '<button class="g-side" id="g-side' + i + '" onclick="gHiloPick(' + i + ')">' +
      (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '') +
      '<div class="nm">' + esc(qStrip(t.name)) + '</div>' +
      '<div class="ar">' + esc(qArtistNames(t)) + '</div>' +
      '<div class="fact" id="g-fact' + i + '"></div>' +
    '</button>';
  qSet(
    gHud() + gTimerBar() +
    '<div class="g-ask">' + (q.ask === 'longer' ? 'which song is LONGER?' : 'which one came out FIRST?') + '</div>' +
    '<div class="g-pair">' + side(q.pair[0], 0) + '<div class="vs">vs</div>' + side(q.pair[1], 1) + '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="gHiloGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );
  Q.tick = setInterval(gTickHilo, 100);
}

function gTickHilo() {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / Q.duration) * 100 + '%'; bar.classList.toggle('low', left <= Q.duration * 0.3); }
  if (left <= 0 && !Q.locked) { gHiloLock(-1); qFinishQuestion(false, null, 'timeout'); }
}

function gHiloLock(pickedIdx) {
  const q = Q.questions[Q.index];
  q.pair.forEach((t, i) => {
    const el = document.getElementById('g-side' + i);
    const f = document.getElementById('g-fact' + i);
    if (f) f.textContent = gHiloFact(t, q.ask);
    if (!el) return;
    el.disabled = true;
    if (t.id === q.track.id) el.classList.add('right');
    else if (i === pickedIdx) el.classList.add('wrong');
  });
  gHideGiveUp();
}

function gHiloPick(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  gHiloLock(i);
  qFinishQuestion(q.pair[i].id === q.track.id, q.pair[i].name);
}

function gHiloGiveUp() {
  if (Q.locked) return;
  gHiloLock(-1);
  qFinishQuestion(false, null, 'gaveup');
}

// ======================== DAILY SONG ========================

function gDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function gToday() { return gDateKey(new Date()); }

function gDailyLoad() {
  try { return JSON.parse(localStorage.getItem(G_DAILY_KEY) || '{}'); } catch { return {}; }
}

// consecutive days played, ending today (or yesterday if today isn't done yet)
function gStreak(days) {
  let n = 0;
  const d = new Date();
  if (!days[gDateKey(d)]) d.setDate(d.getDate() - 1);
  while (days[gDateKey(d)] !== undefined) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function gDailyState() {
  const s = gDailyLoad();
  const days = s.days || {};
  const today = gToday();
  return { days, playedToday: days[today] !== undefined, today: days[today], streak: gStreak(days) };
}

function gDailySave(points) {
  const s = gDailyLoad();
  s.days = s.days || {};
  s.days[gToday()] = points;
  try { localStorage.setItem(G_DAILY_KEY, JSON.stringify(s)); } catch {}
}

function gCalendarHtml(days) {
  const cells = [];
  const d = new Date();
  d.setDate(d.getDate() - 13);
  for (let i = 0; i < 14; i++) {
    const k = gDateKey(d);
    cells.push('<span class="' + (days[k] !== undefined ? 'hit' : '') + '" title="' + k + (days[k] !== undefined ? ': ' + days[k] + ' pts' : '') + '"></span>');
    d.setDate(d.getDate() + 1);
  }
  return '<div class="g-cal">' + cells.join('') + '</div>';
}

function gStreakBlock(st) {
  return '<div class="g-streak">' +
    '<div class="num">' + st.streak + '</div>' +
    '<div class="lbl">day streak</div>' +
    gCalendarHtml(st.days) +
  '</div>';
}

async function gScreenDaily() {
  const st = gDailyState();
  if (st.playedToday) {
    qSet(
      qTopBar('&larr; arcade', 'gScreenHub()') +
      qHeader('daily song', 'you already did today\'s') +
      '<div class="q-final"><div class="num">' + st.today + '</div><div class="outof">out of ' + QUIZ_MAX + ' today</div>' +
        gStreakBlock(st) +
        '<p class="q-note" style="margin-top:10px;">new song at midnight. don\'t break the streak.</p>' +
      '</div>'
    );
    return;
  }
  Q.game = 'heardle'; Q.mode = 'type';
  Q.source = { kind: 'daily', id: gToday(), name: 'daily song', image: '', sub: gToday() };
  G.daily = true; G.challenge = null;
  qSet('<div class="q-loadwrap"><div class="spinner">📅</div><p>picking today\'s song...</p></div>');
  try {
    let pool = G_DAILY_PLAYLIST ? await qPoolFromPlaylist(G_DAILY_PLAYLIST) : qPoolFromTop();
    pool = pool.filter(t => t && t.id).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (!pool.length) throw new Error('no songs to pick from yet');
    // same seed = same song for everyone on the same pool; walk forward until one has a clip
    const start = gHash(gToday() + '|' + (G_DAILY_PLAYLIST || 'top')) % pool.length;
    let track = null, preview = null;
    for (let i = 0; i < Math.min(pool.length, 12); i++) {
      const t = pool[(start + i) % pool.length];
      if (qIsAlt(t.name)) continue;
      const p = await qFindPreview(t);
      if (p) { track = t; preview = p; break; }
    }
    if (!track) throw new Error('couldn\'t find a clip for today\'s song');
    Q.pool = pool; Q.len = 1; Q.index = 0; Q.score = 0; Q.results = [];
    Q.perQ = QUIZ_MAX;
    Q.questions = [{ track, preview, choices: null }];
    qRenderQuestion();
  } catch (e) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('daily song', '') + qErrorBox(esc(e.message)));
  }
}

// ======================== SONG TAROT ========================

const G_READINGS = [
  "this one's been carrying you more than you admit. let it.",
  "the universe says: full volume, windows down, no skipping.",
  "you're going to hear this somewhere unexpected this week. that's a sign.",
  "put this on and text the person you're thinking about. or don't. the song knows.",
  "this is your walk-in song today. act accordingly.",
  "somebody in your life needs to hear this and it's your job to make them.",
  "the cards say your day peaks around the second chorus.",
  "an old feeling comes back around. this is the soundtrack for it.",
  "you already know why this one came up. yeah. that.",
  "protect your peace. this song is the fence.",
  "today calls for the deluxe edition of yourself. this is the opening track.",
  "a good day, but louder. hit play.",
  "something you've been avoiding is about to be a lot easier than you thought.",
  "the bridge of this song is a whole personality. so are you.",
];

function gScreenTarot() {
  Q.screen = 'tarot';
  qStopAudio(); qClearTimers(); gClearClip();
  const pool = qPoolFromTop().filter(t => qArt(t));
  if (pool.length < 3) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('song tarot', '') + qErrorBox('need a few top songs first. go listen to something.'));
    return;
  }
  G.tarot = qShuffle(pool).slice(0, 3);
  G.tarotFlipped = false;
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('song tarot', 'pick a card. no takebacks.') +
    '<div class="g-tarot">' +
      G.tarot.map((t, i) =>
        '<div class="g-card" id="g-card' + i + '" onclick="gTarotFlip(' + i + ')">' +
          '<div class="face back">🦇</div>' +
          '<div class="face front">' +
            '<img src="' + qArt(t) + '" alt="">' +
            '<div class="nm">' + esc(qStrip(t.name)) + '</div>' +
            '<div class="ar">' + esc(qArtistNames(t)) + '</div>' +
          '</div>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<div class="g-reading" id="g-reading"></div>' +
    '<div class="q-actions" id="g-tarot-again" style="visibility:hidden;">' +
      '<button class="q-btn ghost" onclick="gScreenTarot()">draw again</button>' +
    '</div>'
  );
}

function gTarotFlip(i) {
  if (G.tarotFlipped) return;
  G.tarotFlipped = true;
  const t = G.tarot[i];
  G.tarot.forEach((_, j) => {
    const el = document.getElementById('g-card' + j);
    if (!el) return;
    if (j === i) el.classList.add('flipped');
    else { el.style.opacity = '0.25'; el.style.cursor = 'default'; }
  });
  const reading = G_READINGS[gHash(t.id) % G_READINGS.length];
  setTimeout(() => {
    const r = document.getElementById('g-reading');
    if (r) r.innerHTML = '<b style="color:var(--pink);">' + esc(qStrip(t.name)) + '</b> &middot; ' + esc(reading);
    const again = document.getElementById('g-tarot-again');
    if (again) again.style.visibility = 'visible';
  }, 750);
}

// ======================== CHALLENGE LINKS ========================
// the exact songs get baked into the url, so a friend plays the same round

function gChallengeLink() {
  const payload = {
    v: 1, g: Q.game, m: Q.mode,
    s: Q.source ? { kind: Q.source.kind, id: Q.source.id, name: Q.source.name, image: Q.source.image || '', sub: Q.source.sub || '' } : null,
    t: Q.questions.map(q => q.track.id),
    sc: Math.round(Q.score),
    by: gPlayer(),
  };
  return location.origin + location.pathname + '?challenge=' + gB64(payload);
}

function gCopyChallenge(btn) {
  navigator.clipboard.writeText(gChallengeLink()).then(() => {
    btn.textContent = 'link copied 🩷 send it';
    setTimeout(() => { btn.textContent = 'challenge a friend 🔗'; }, 2500);
  }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}

async function gOpenChallenge(raw) {
  let c;
  try { c = gUnB64(raw); } catch { return false; }
  if (!c || !Array.isArray(c.t) || !c.t.length) return false;
  openQuiz();
  // sc null = a custom quiz with no score to beat (see more.js builder)
  G.challenge = { by: c.by || 'someone', sc: (c.sc === null || c.sc === undefined) ? null : (Number(c.sc) || 0) };
  G.daily = false;
  Q.game = GAMES[c.g] ? c.g : 'classic';
  Q.mode = c.m === 'type' ? 'type' : 'mc';
  Q.source = c.s || { kind: 'challenge', id: 'x', name: 'a challenge', image: '', sub: '' };
  qSet('<div class="q-loadwrap"><div class="spinner">🔗</div><p>loading ' + esc(G.challenge.by) + '\'s challenge...</p></div>');
  try {
    const tracks = [];
    for (const id of c.t.slice(0, 20)) {
      const t = await qFetch('/tracks/' + encodeURIComponent(id) + '?market=' + qMarket()).catch(() => null);
      if (t && t.id) tracks.push(t);
    }
    if (!tracks.length) throw new Error('couldn\'t load those songs');
    Q.pool = tracks; Q.len = tracks.length;
    Q.index = 0; Q.score = 0; Q.results = [];
    if (Q.game === 'cover') {
      Q.questions = gBuildCoverQuestions(tracks);
    } else if (Q.game === 'hilo') {
      Q.questions = gBuildHiloQuestions(tracks);
    } else {
      const qs = [];
      for (const t of tracks) {
        const p = await qFindPreview(t);
        if (p) qs.push({ track: t, preview: p, choices: Q.mode === 'mc' ? qMakeChoices(t, tracks) : null });
      }
      Q.questions = qs;
    }
    if (!Q.questions.length) throw new Error('none of those songs have a playable clip here');
    Q.perQ = QUIZ_MAX / Q.questions.length;
    qRenderQuestion();
  } catch (e) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('challenge', '') + qErrorBox(esc(e.message)));
  }
  return true;
}

// ======================== LEADERBOARD (this device) ========================

function gLoadLB() {
  try { return JSON.parse(localStorage.getItem(G_LB_KEY) || '[]'); } catch { return []; }
}

function gSaveScore(score) {
  if (!Q.source || !Q.results.length) return;
  const lb = gLoadLB();
  lb.push({
    game: Q.game, mode: Q.mode, len: Q.results.length, score,
    src: Q.source.kind + ':' + Q.source.id, name: Q.source.name,
    player: gPlayer(), at: Date.now(),
  });
  lb.sort((a, b) => b.score - a.score || a.at - b.at);
  if (lb.length > 300) lb.length = 300;
  try { localStorage.setItem(G_LB_KEY, JSON.stringify(lb)); } catch {}
}

function gScreenLeaderboard(filter) {
  Q.screen = 'leaderboard';
  qStopAudio(); qClearTimers(); gClearClip();
  if (filter) G.lbFilter = filter;
  const all = gLoadLB();
  const rows = all.filter(e => G.lbFilter === 'all' || e.game === G.lbFilter).slice(0, 25);
  const filters = ['all', ...Object.keys(GAMES)].map(k =>
    '<button class="q-btn ghost" style="padding:6px 14px;font-size:0.8rem;' +
      (k === G.lbFilter ? 'border-color:var(--pink);color:var(--pink);' : '') +
    '" onclick="gScreenLeaderboard(\'' + k + '\')">' + (k === 'all' ? 'everything' : GAMES[k].name) + '</button>'
  ).join('');
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('leaderboard', 'best runs on this device') +
    '<div class="g-filter">' + filters + '</div>' +
    '<div class="g-lb">' +
      (rows.length ? rows.map((e, i) =>
        '<div class="g-lb-row">' +
          '<span class="rank ' + (i < 3 ? 'top' : '') + '">' + (i + 1) + '</span>' +
          '<div class="who">' +
            '<div class="nm">' + esc(e.player) + ' &middot; ' + esc(e.name) + '</div>' +
            '<div class="mt">' + (GAMES[e.game]?.name || e.game) + ' &middot; ' + (e.mode === 'type' ? 'typed' : 'multiple choice') +
              ' &middot; ' + e.len + ' songs &middot; ' + new Date(e.at).toLocaleDateString() + '</div>' +
          '</div>' +
          '<span class="sc">' + e.score + '</span>' +
        '</div>'
      ).join('') : '<p class="q-note">nothing here yet. go play something.</p>') +
    '</div>'
  );
}

// ======================== RESULTS HOOK ========================
// quiz.js calls this after drawing the results screen

function gAfterResults() {
  const box = document.getElementById('g-results-extra');
  if (!box) return;
  const score = Math.round(Q.score);
  let html = '';
  if (G.challenge && G.challenge.sc === null) {
    // a custom quiz someone built - there's no score to beat, just a name on it
    html += '<div class="g-vs"><div class="line tie">made for you by ' + esc(G.challenge.by) + ' 🩷</div></div>';
  } else if (G.challenge) {
    const d = score - G.challenge.sc;
    const by = esc(G.challenge.by);
    html += '<div class="g-vs"><div class="line ' + (d > 0 ? 'win' : d < 0 ? 'lose' : 'tie') + '">' +
      (d > 0 ? 'you beat ' + by + ' 🖤' : d < 0 ? by + ' got you 💔' : 'dead tie with ' + by + ' 🩷') +
      '</div><div class="q-note" style="margin-top:4px;">' + score + ' vs ' + G.challenge.sc + '</div></div>';
  }
  if (G.daily) {
    // only the first attempt of the day counts - "run it back" is practice
    const already = gDailyState().playedToday;
    if (!already) gDailySave(score);
    html += gStreakBlock(gDailyState()) +
      '<p class="q-note">' + (already ? 'practice round - today\'s score already counted.' : 'that\'s today\'s. new song at midnight.') + '</p>';
  } else {
    gSaveScore(score);
  }
  html += '<div class="q-actions">' +
    (G.daily ? '' : '<button class="q-btn" onclick="gCopyChallenge(this)">challenge a friend 🔗</button>') +
    '<button class="q-btn ghost" onclick="gScreenLeaderboard()">leaderboard</button>' +
    (typeof lSaveNode === 'function' ? '<button class="q-btn ghost" onclick="lSaveNode(\'.q-final\', \'sparklestats-score\', this)">save as image</button>' : '') +
    '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
  '</div>';
  box.innerHTML = html;
  if (typeof mOnResults === 'function') mOnResults();   // badges
}

// per-game blurbs for the two answer-style cards on the mode screen
function gModeSubs() {
  if (Q.game === 'heardle') return {
    mc: '4 options, no timer<br>wrong picks unlock more clip',
    type: 'no options, no timer<br>wrong guesses unlock more clip',
  };
  if (Q.game === 'cover') return {
    mc: '4 artists, ' + G_COVER_TIME + ' sec<br>the chill one',
    type: 'type the artist, ' + G_COVER_TIME + ' sec<br>typos are forgiven',
  };
  return {
    mc: '4 options, ' + TIME_MC + ' sec each<br>the chill one',
    type: 'no options, ' + TIME_TYPE + ' sec each<br>typos are forgiven',
  };
}
window.gModeSubs = gModeSubs;

// ======================== EXPORTS ========================

window.gScreenHub = gScreenHub;
window.gPick = gPick;
window.gRenderQuestion = gRenderQuestion;
window.gPlayStage = gPlayStage;
window.gHeardleSkip = gHeardleSkip;
window.gHeardleTyped = gHeardleTyped;
window.gHeardleChoice = gHeardleChoice;
window.gCoverChoice = gCoverChoice;
window.gCoverTyped = gCoverTyped;
window.gCoverGiveUp = gCoverGiveUp;
window.gHiloPick = gHiloPick;
window.gHiloGiveUp = gHiloGiveUp;
window.gScreenDaily = gScreenDaily;
window.gScreenTarot = gScreenTarot;
window.gTarotFlip = gTarotFlip;
window.gScreenLeaderboard = gScreenLeaderboard;
window.gCopyChallenge = gCopyChallenge;
window.gOpenChallenge = gOpenChallenge;
window.gAfterResults = gAfterResults;
window.gBuildCoverQuestions = gBuildCoverQuestions;
window.gBuildHiloQuestions = gBuildHiloQuestions;
