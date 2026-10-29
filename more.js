// ============================================================
//  xXx SparkleStats xXx  -  more.js
//  the second wave: blind ranking, song bracket, lightning round,
//  guess the year, finish the title, which album, then vs now,
//  you vs past you, playlist roast, phone wallpaper,
//  custom quiz builder, whose song is this, badges.
//  loads last; hooks into quiz.js / games.js / labs.js / versus.js.
// ============================================================

const M = { blind: null, bracket: null, light: null, tn: null, builder: null, whose: null };
const M_YEAR_MIN = 1950;
const M_YEAR_MAX = new Date().getFullYear();

// games that go through the normal source picker (the hub lists these automatically)
GAMES.lightning = { emoji: '⚡', name: 'lightning round', sub: '60 seconds, 3-second clips, keep the streak alive' };
GAMES.year      = { emoji: '⏳', name: 'guess the year', sub: 'hear it, slide to the year it came out' };
GAMES.finish    = { emoji: '✍️', name: 'finish the title', sub: 'one word is missing. type it. no audio, no mercy' };
GAMES.album     = { emoji: '💽', name: 'which album?', sub: 'superfan mode: which album is this song on' };
GAMES.bracket   = { emoji: '🥇', name: 'song bracket', sub: '16 songs, head to head, one champion' };
LABS.roast      = { emoji: '🔥', name: 'playlist roast', sub: 'pick a playlist. get judged.' };
LABS.blind      = { emoji: '🪞', name: 'blind ranking', sub: 'rank your top songs before you know what comes next' };

const M_SINGLE_START = new Set(['lightning', 'year', 'finish', 'bracket']);
const M_BUILDS = new Set(['lightning', 'year', 'finish', 'album', 'bracket']);

// ======================== HOOKS quiz.js / games.js CALL ========================

function mSourceDisabled(kind) {
  if (Q.game === 'album') return kind !== 'artist';      // albums only make sense for one artist
  return false;
}
function mSingleStart() { return M_SINGLE_START.has(Q.game); }
function mFixedLen() {
  if (Q.game === 'bracket') return 16;
  if (Q.game === 'lightning') return 20;
  return 0;
}
function mModeNote() {
  const notes = {
    bracket: '16 songs (8 if the pool is small) &middot; no points, just a champion',
    lightning: '60 seconds &middot; 3-second clips &middot; streaks stack the points',
    year: Q.len + ' songs &middot; exact year = full points, ten years off = nothing',
    finish: Q.len + ' songs &middot; type the missing word &middot; 15 seconds each',
    album: Q.len + ' songs &middot; which album is it on &middot; 20 seconds each',
  };
  return notes[Q.game] ? '<p class="q-note" style="margin-top:20px;">' + notes[Q.game] + '</p>' : null;
}
function mWhyTooFew() {
  const why = {
    bracket: 'a bracket needs at least 8 songs with playable clips. try a bigger playlist?',
    finish: 'not enough titles with a word worth blanking in here. try something wordier.',
    album: 'need songs from at least 2 different albums. this is basically one record.',
    year: 'not enough songs with release dates and clips in here.',
    lightning: 'need at least ' + QUIZ_MIN_Q + ' songs with clips for a lightning round.',
  };
  return why[Q.game] || null;
}
function mBuildsGame(game) { return M_BUILDS.has(game); }

async function mBuildQuestions(pool, onProgress) {
  switch (Q.game) {
    case 'lightning': Q.len = 20; return (await qBuildQuestions(pool, onProgress)).map(q => ({ ...q, choices: qMakeChoices(q.track, pool) }));
    case 'year': {
      const qs = await qBuildQuestions(pool.filter(t => gYear(t)), onProgress);
      return qs.map(q => ({ ...q, choices: null, year: gYear(q.track) }));
    }
    case 'finish': return mBuildFinish(pool);
    case 'album': {
      const withAlbum = pool.filter(t => t.album && t.album.name && !qIsAlt(t.album.name));
      const albums = [...new Set(withAlbum.map(t => t.album.name))];
      if (albums.length < 2) return [];
      const qs = await qBuildQuestions(withAlbum, onProgress);
      return qs.map(q => {
        const answer = q.track.album.name;
        const decoys = qShuffle(albums.filter(a => a !== answer)).slice(0, 3);
        return { ...q, answer, choices: qShuffle([answer, ...decoys]) };
      });
    }
    case 'bracket': {
      Q.len = 16;
      const qs = await qBuildQuestions(pool, onProgress);
      if (qs.length >= 16) return qs.slice(0, 16).map(q => ({ ...q, choices: null }));
      if (qs.length >= 8) return qs.slice(0, 8).map(q => ({ ...q, choices: null }));
      return [];
    }
  }
  return [];
}

function mRenderQuestion() {
  switch (Q.game) {
    case 'lightning': mLightRender(); return true;
    case 'year': mYearRender(); return true;
    case 'finish': mFinishRender(); return true;
    case 'album': mAlbumRender(); return true;
    case 'bracket': mBracketRender(); return true;
  }
  return false;
}

function mScreenResults() {
  if (Q.game === 'lightning') { mLightResults(); return true; }
  return false;
}

// hub sections
function mHubCards() {
  const card = (ico, lbl, sub, fn, badge) =>
    '<button class="q-src" onclick="' + fn + '"><span class="ico">' + ico + '</span>' +
    '<span class="lbl">' + lbl + (badge ? '<span class="g-badge">' + badge + '</span>' : '') + '</span><span class="sub">' + sub + '</span></button>';
  mCheckDashboardBadges();
  const earned = Object.keys(mBadgesLoad()).length;
  return '<div class="g-hub-label">more games</div><div class="g-hub">' +
      card('🪞', 'blind ranking', LABS.blind.sub, 'mScreenBlind()') +
    '</div>' +
    '<div class="g-hub-label">about you</div><div class="g-hub">' +
      card('👻', 'then vs now', 'songs that fell off, songs that showed up. keep or toss.', 'mScreenThenNow()') +
      card('🔮', 'you vs past you', 'last month against all time. who wins the aux?', 'mScreenPastYou()') +
      card('🔥', 'playlist roast', LABS.roast.sub, 'mOpenRoast()') +
      card('📱', 'phone wallpaper', 'your album wall as a lock screen', 'mScreenWallpaper()') +

      card('🎖️', 'badges', earned + ' / ' + M_BADGES.length + ' unlocked', 'mScreenBadges()') +
    '</div>' +
    '<div class="g-hub-label">social</div><div class="g-hub">' +
      card('🧩', 'custom quiz builder', 'hand-pick 10 songs, name it, send the link', 'mScreenBuilder()') +
      card('🎭', 'whose song is this?', 'your top songs mixed with someone\'s. guess whose', 'mScreenWhose()') +
    '</div>';
}

// ======================== SHARED BITS ========================

function mTick(onTimeout) {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / Q.duration) * 100 + '%'; bar.classList.toggle('low', left <= Q.duration * 0.3); }
  if (left <= 0 && !Q.locked) onTimeout();
}
function mHud(label) {
  return '<div class="q-hud"><span class="qn">' + label + '</span><span class="sc">' + Math.round(Q.score) + ' pts</span></div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>';
}
function mPlayer(prompt) {
  return '<div class="q-player">' +
    '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
    '<div class="q-disc spinning" id="q-disc" onclick="qReplay()"><div class="hole"></div></div>' +
    '<button class="q-replay" onclick="qReplay()">↻ play again</button>' +
    '<p class="q-note" style="margin-top:8px;">' + prompt + '</p></div>';
}
function mStopVisuals() {
  const bars = document.getElementById('q-bars'); if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc'); if (disc) disc.classList.remove('spinning');
  const gu = document.getElementById('q-giveup'); if (gu) gu.style.display = 'none';
}
function mLockChoices(pickedIdx, isRight) {
  const q = Q.questions[Q.index];
  (q.choices || []).forEach((c, j) => {
    const el = document.getElementById('q-c' + j);
    if (!el) return;
    el.disabled = true;
    if (isRight(c)) el.classList.add('right');
    else if (j === pickedIdx) el.classList.add('wrong');
    else el.classList.add('faded');
  });
  const inp = document.getElementById('q-type-input'); if (inp) inp.disabled = true;
  mStopVisuals();
}
function mTrackLabel(t) { return qStrip(t.name) + ' - ' + gPrimary(t); }

// ======================== GUESS THE YEAR ========================

function mYearRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers();
  const q = Q.questions[Q.index];
  Q.duration = 20; Q.deadline = Date.now() + 20000;
  qSet(
    mHud('song ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    mPlayer('<b>' + esc(qStrip(q.track.name)) + '</b> &middot; ' + esc(qArtistNames(q.track)) + '<br>when did this come out?') +
    '<div class="m-yearwrap">' +
      '<div class="m-year" id="m-year-val">2005</div>' +
      '<input type="range" class="m-slider" id="m-year" min="' + M_YEAR_MIN + '" max="' + M_YEAR_MAX + '" value="2005" oninput="mYearShow(this.value)">' +
      '<div class="m-yearends"><span>' + M_YEAR_MIN + '</span><span>' + M_YEAR_MAX + '</span></div>' +
      '<div class="q-actions"><button class="q-btn" onclick="mYearLock()">lock it in</button>' +
      '<button class="q-btn ghost" id="q-giveup" onclick="mYearGiveUp()">no idea</button></div>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  qPlayClip(q.preview);
  Q.tick = setInterval(() => mTick(() => mYearFinish(null, 'timeout')), 100);
}
function mYearShow(v) { const el = document.getElementById('m-year-val'); if (el) el.textContent = v; }
function mYearLock() {
  if (Q.locked) return;
  const s = document.getElementById('m-year');
  mYearFinish(parseInt(s ? s.value : '0') || 2005, null);
}
function mYearGiveUp() { if (!Q.locked) mYearFinish(null, 'gaveup'); }
function mYearFinish(guess, reason) {
  const q = Q.questions[Q.index];
  const s = document.getElementById('m-year'); if (s) s.disabled = true;
  mStopVisuals();
  if (guess === null) { q.detail = 'came out ' + q.year; qFinishQuestion(false, null, reason); return; }
  const diff = Math.abs(guess - q.year);
  const pts = Math.round(Q.perQ * Math.max(0, 1 - diff / 10));
  q.detail = 'came out ' + q.year + ' &middot; you said ' + guess + (diff === 0 ? ' &middot; dead on' : ' &middot; ' + diff + ' off');
  qFinishQuestion(pts > 0, String(guess), null, pts);
}

// ======================== FINISH THE TITLE ========================

const M_STOP = new Set(['the', 'and', 'you', 'your', 'for', 'with', 'this', 'that', 'not', 'are', 'but', 'all', 'out', 'she', 'him', 'her', 'his', 'its', 'was', 'were', 'have', 'has', 'from', 'into', 'than', 'then', 'when', 'what', 'who', 'why', 'how', 'can', 'don', 'won', 'ain', 'feat', 'remix', 'version', 'edit']);

function mBuildFinish(pool) {
  const seen = new Set();
  const out = [];
  for (const t of qShuffle(pool)) {
    if (qIsAlt(t.name)) continue;
    const title = qStrip(t.name);
    const words = title.split(/\s+/);
    if (words.length < 2) continue;
    const cands = words.filter(w => /^[a-z']{3,}$/i.test(w) && !M_STOP.has(w.toLowerCase().replace(/'/g, '')));
    if (!cands.length) continue;
    const blank = cands.sort((a, b) => b.length - a.length)[0];
    const key = qNorm(title);
    if (seen.has(key)) continue;
    seen.add(key);
    let done = false;
    const shown = words.map(w => (!done && w === blank) ? (done = true, '_'.repeat(Math.max(3, w.length))) : w).join(' ');
    out.push({ track: t, preview: null, choices: null, answer: blank, shown });
    if (out.length >= Q.len) break;
  }
  return out;
}
function mFinishRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); qStopAudio();
  const q = Q.questions[Q.index];
  Q.duration = 15; Q.deadline = Date.now() + 15000;
  qSet(
    mHud('title ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="m-blankwrap">' +
      '<div class="q-note">' + esc(qArtistNames(q.track)) + '</div>' +
      '<div class="m-blank">' + esc(q.shown) + '</div>' +
      '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="the missing word..." autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="mFinishAnswer()">fill it</button>' +
      '</div></div>' +
      '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="mFinishGiveUp()">i give up</button></div>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  const inp = document.getElementById('q-type-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') mFinishAnswer(); }); }
  Q.tick = setInterval(() => mTick(() => { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'timeout'); }), 100);
}
function mFinishAnswer() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  const ok = qNorm(guess) === qNorm(q.answer) || qMatches(guess, q.answer);
  mLockChoices(-1, () => false);
  qFinishQuestion(ok, guess);
}
function mFinishGiveUp() { if (!Q.locked) { mLockChoices(-1, () => false); qFinishQuestion(false, null, 'gaveup'); } }

// ======================== WHICH ALBUM ========================

function mAlbumRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers();
  const q = Q.questions[Q.index];
  Q.duration = 20; Q.deadline = Date.now() + 20000;
  const body = Q.mode === 'type'
    ? '<div class="q-typewrap"><div class="q-typerow">' +
        '<input id="q-type-input" class="q-input" placeholder="album name..." autocomplete="off" autocorrect="off" spellcheck="false">' +
        '<button class="q-btn" onclick="mAlbumTyped()">lock it in</button></div></div>'
    : '<div class="q-choices">' + q.choices.map((c, i) =>
        '<button class="q-choice" id="q-c' + i + '" onclick="mAlbumChoice(' + i + ')">' + esc(c) + '</button>').join('') + '</div>';
  qSet(
    mHud('song ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    mPlayer('<b>' + esc(qStrip(q.track.name)) + '</b><br>which album is it on?') +
    body +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="mAlbumGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );
  if (Q.mode === 'type') {
    const inp = document.getElementById('q-type-input');
    if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') mAlbumTyped(); }); }
  }
  q.detail = 'album: ' + q.answer;
  qPlayClip(q.preview);
  Q.tick = setInterval(() => mTick(() => { mLockChoices(-1, c => c === q.answer); qFinishQuestion(false, null, 'timeout'); }), 100);
}
function mAlbumChoice(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  mLockChoices(i, c => c === q.answer);
  qFinishQuestion(q.choices[i] === q.answer, q.choices[i]);
}
function mAlbumTyped() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value.trim() : '';
  if (!guess) return;
  const q = Q.questions[Q.index];
  mLockChoices(-1, c => c === q.answer);
  qFinishQuestion(qMatches(guess, q.answer), guess);
}
function mAlbumGiveUp() { if (!Q.locked) { const q = Q.questions[Q.index]; mLockChoices(-1, c => c === q.answer); qFinishQuestion(false, null, 'gaveup'); } }

// ======================== LIGHTNING ROUND ========================

const M_LIGHT_TOTAL = 60, M_LIGHT_CLIP = 3;

function mLightRender() {
  Q.screen = 'mplay';
  if (Q.index === 0 || !M.light) {
    M.light = { deadline: Date.now() + M_LIGHT_TOTAL * 1000, streak: 0, best: 0, score: 0, right: [], wrong: [], done: false, clip: null, tick: null };
  }
  const L = M.light;
  if (L.tick) { clearInterval(L.tick); L.tick = null; }
  if (L.clip) { clearTimeout(L.clip); L.clip = null; }
  Q.locked = false;
  const q = Q.questions[Q.index];
  qSet(
    '<div class="q-hud"><span class="qn">song ' + (Q.index + 1) + ' &middot; streak <b class="m-flame">' + (L.streak ? '🔥'.repeat(Math.min(L.streak, 5)) + ' ' + L.streak : '-') + '</b></span>' +
      '<span class="sc">' + L.score + ' pts</span></div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    '<div class="q-player" style="padding:12px;"><div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-note">' + M_LIGHT_CLIP + ' seconds. go.</div></div>' +
    '<div class="q-choices">' + q.choices.map((c, i) =>
      '<button class="q-choice" id="q-c' + i + '" onclick="mLightAnswer(' + i + ')"><span class="v-key">' + (i + 1) + '</span> ' + esc(qStrip(c.name)) + '</button>').join('') + '</div>' +
    '<div class="v-status" id="m-light-status"></div>'
  );
  qPlayClip(q.preview);
  L.clip = setTimeout(() => { if (Q.audio) Q.audio.pause(); const b = document.getElementById('q-bars'); if (b) b.classList.remove('on'); }, M_LIGHT_CLIP * 1000);
  L.tick = setInterval(mLightTick, 100);
}
function mLightTick() {
  const L = M.light; if (!L) return;
  const left = Math.max(0, L.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) { bar.style.width = (left / M_LIGHT_TOTAL) * 100 + '%'; bar.classList.toggle('low', left <= 10); }
  if (left <= 0 && !L.done) mLightEnd();
}
function mLightAnswer(i) {
  const L = M.light; if (!L || L.done || Q.locked) return;
  Q.locked = true;
  const q = Q.questions[Q.index];
  const ok = qIsAnswer(q.choices[i], q.track);
  if (ok) { L.streak++; L.best = Math.max(L.best, L.streak); L.score += 50 + 10 * Math.min(L.streak - 1, 5); L.right.push(q.track); }
  else { L.streak = 0; L.wrong.push(q.track); }
  mLockChoices(i, c => qIsAnswer(c, q.track));
  const st = document.getElementById('m-light-status');
  if (st) st.innerHTML = ok ? '<span class="good">+' + (50 + 10 * Math.min(L.streak - 1, 5)) + ' 🖤</span>' : '<span class="bad">nope - it was ' + esc(qStrip(q.track.name)) + '</span>';
  setTimeout(() => {
    if (L.done) return;
    if (Q.index >= Q.questions.length - 1) { mLightEnd(); return; }
    Q.index++;
    mLightRender();
  }, ok ? 450 : 900);
}
function mLightEnd() {
  const L = M.light; if (!L || L.done) return;
  L.done = true;
  if (L.tick) { clearInterval(L.tick); L.tick = null; }
  if (L.clip) { clearTimeout(L.clip); L.clip = null; }
  qStopAudio();
  Q.score = L.score;
  Q.results = L.right.map(t => ({ track: t, points: 1, correct: true, guess: null })).concat(L.wrong.map(t => ({ track: t, points: 0, correct: false, guess: null })));
  qScreenResults();
}
function mLightResults() {
  const L = M.light || { score: 0, best: 0, right: [], wrong: [] };
  Q.screen = 'results';
  qStopAudio(); qClearTimers();
  if (typeof gSaveScore === 'function' && Q.results.length) gSaveScore(L.score);
  if (L.best >= 10) mAward('light10');
  if (Q.results.length) mAward('first_game');
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('⚡ lightning round', esc((Q.source || {}).name || '')) +
    '<div class="q-final fade-up">' +
      '<div class="num">' + L.score + '</div>' +
      '<div class="outof">' + L.right.length + ' right &middot; ' + L.wrong.length + ' wrong &middot; best streak ' + L.best + '</div>' +
      '<div class="rank">' + (L.best >= 10 ? 'lightning in a bottle' : L.best >= 5 ? 'on fire' : L.right.length >= 5 ? 'quick hands' : 'warming up') + '</div>' +
    '</div>' +
    '<div class="q-recap">' +
      Q.results.map(r => '<div class="q-recap-row">' + (qArt(r.track) ? '<img src="' + qArt(r.track) + '" alt="">' : '') +
        '<div class="info"><div class="nm">' + esc(qStrip(r.track.name)) + '</div><div class="ar">' + esc(qArtistNames(r.track)) + '</div></div>' +
        '<span class="p ' + (r.correct ? 'good' : 'bad') + '">' + (r.correct ? '✓' : '✗') + '</span></div>').join('') +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="qStart(\'mc\')">again</button>' +
      '<button class="q-btn ghost" onclick="gScreenLeaderboard()">leaderboard</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (L.best >= 10 && window.confetti) confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#FFB6C1'] });
}

// ======================== SONG BRACKET ========================

function mRoundName(n) { return n === 16 ? 'round of 16' : n === 8 ? 'quarterfinals' : n === 4 ? 'semifinals' : 'the final'; }

function mBracketRender() {
  Q.screen = 'mplay';
  if (!M.bracket || M.bracket.songs !== Q.questions) {
    const songs = Q.questions;
    const pairs = [];
    for (let i = 0; i < songs.length; i += 2) pairs.push([songs[i], songs[i + 1]]);
    M.bracket = { songs, rounds: [pairs], winners: [[]], r: 0, m: 0, champion: null, playing: -1 };
  }
  const B = M.bracket;
  const pair = B.rounds[B.r][B.m];
  const side = (q, i) =>
    '<div class="g-side m-side' + (B.playing === i ? ' playing' : '') + '" id="m-side' + i + '">' +
      (qArt(q.track) ? '<img src="' + qArt(q.track) + '" alt="">' : '') +
      '<div class="nm">' + esc(qStrip(q.track.name)) + '</div><div class="ar">' + esc(qArtistNames(q.track)) + '</div>' +
      '<div class="q-actions" style="margin-top:10px;">' +
        '<button class="q-replay" onclick="mBracketPlay(' + i + ')">▶ play</button>' +
        '<button class="q-btn" style="padding:8px 16px;" onclick="mBracketPick(' + i + ')">this one</button>' +
      '</div></div>';
  qSet(
    '<div class="q-hud"><span class="qn">' + mRoundName(B.rounds[B.r].length * 2) + ' &middot; match ' + (B.m + 1) + ' of ' + B.rounds[B.r].length + '</span>' +
      '<span class="qn">' + esc((Q.source || {}).name || '') + '</span></div>' +
    '<div class="g-ask">which one survives?</div>' +
    '<div class="g-pair">' + side(pair[0], 0) + '<div class="vs">vs</div>' + side(pair[1], 1) + '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="gScreenHub()">quit bracket</button></div>'
  );
}
function mBracketPlay(i) {
  const B = M.bracket; if (!B) return;
  B.playing = i;
  qPlayClip(B.rounds[B.r][B.m][i].preview);
  [0, 1].forEach(j => { const el = document.getElementById('m-side' + j); if (el) el.classList.toggle('playing', j === i); });
}
function mBracketPick(i) {
  const B = M.bracket; if (!B) return;
  qStopAudio(); B.playing = -1;
  const pick = B.rounds[B.r][B.m][i];
  B.winners[B.r].push(pick);
  B.m++;
  if (B.m >= B.rounds[B.r].length) {
    if (B.winners[B.r].length === 1) { B.champion = pick; mBracketResults(); return; }
    const w = B.winners[B.r];
    const next = [];
    for (let k = 0; k < w.length; k += 2) next.push([w[k], w[k + 1]]);
    B.rounds.push(next); B.winners.push([]); B.r++; B.m = 0;
  }
  mBracketRender();
}
function mBracketResults() {
  const B = M.bracket;
  Q.screen = 'results';
  qStopAudio(); qClearTimers();
  mAward('bracket_champ'); mAward('first_game');
  const col = (pairs, winners, title) =>
    '<div class="m-bcol"><div class="m-bcol-h">' + title + '</div>' +
      pairs.map((p, i) => '<div class="m-bmatch">' + p.map(q => '<div class="m-bteam' + (winners[i] === q ? ' w' : '') + '">' + esc(qStrip(q.track.name)) + '</div>').join('') + '</div>').join('') +
    '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🥇 song bracket', esc((Q.source || {}).name || '')) +
    '<div id="m-bracket-card" class="card card-glow" style="max-width:820px;margin:0 auto;">' +
      '<div class="q-final" style="max-width:none;margin:0 0 14px;border-width:2px;">' +
        (qArt(B.champion.track) ? '<img src="' + qArt(B.champion.track) + '" alt="" style="width:120px;height:120px;border:3px solid var(--pink);margin-bottom:10px;">' : '') +
        '<div class="rank">champion</div>' +
        '<div class="num" style="font-size:2rem;">' + esc(qStrip(B.champion.track.name)) + '</div>' +
        '<div class="outof">' + esc(qArtistNames(B.champion.track)) + '</div>' +
      '</div>' +
      '<div class="m-bracket">' + B.rounds.map((pairs, r) => col(pairs, B.winners[r], mRoundName(pairs.length * 2))).join('') + '</div>' +
      '<p class="q-note" style="margin-top:10px;">xXx SparkleStats xXx &middot; song bracket</p>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#m-bracket-card\', \'sparklestats-bracket\', this)">save as image</button>' +
      '<button class="q-btn ghost" onclick="mBracketCopy(this)">copy result</button>' +
      '<button class="q-btn ghost" onclick="qStart(\'mc\')">new bracket</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (window.confetti) confetti({ particleCount: 120, spread: 80, origin: { y: 0.35 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1'] });
}
function mBracketCopy(btn) {
  const B = M.bracket; if (!B) return;
  const text = '🥇 song bracket champion: ' + mTrackLabel(B.champion.track) + '\n(' + (Q.source || {}).name + ', ' + B.songs.length + ' songs)\n' + SITE_URL;
  navigator.clipboard.writeText(text).then(() => { btn.textContent = 'copied 🩷'; setTimeout(() => { btn.textContent = 'copy result'; }, 2000); }).catch(() => {});
}

// ======================== BLIND RANKING ========================

async function mScreenBlind() {
  Q.game = 'blind'; G.daily = false; G.challenge = null;
  Q.source = { kind: 'top', id: 'top', name: 'your top songs', image: '', sub: 'blind ranking' };
  const top = _data.tracks.short_term.length >= 8 ? _data.tracks.short_term : _data.tracks.medium_term;
  const ranked = top.map((t, i) => ({ t, rank: i + 1 })).filter(x => !qIsAlt(x.t.name)).slice(0, 20);
  if (ranked.length < 5) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🪞 blind ranking', '') + qErrorBox('need at least 5 top songs to rank. go listen to something.'));
    return;
  }
  qSet('<div class="q-loadwrap"><div class="spinner">🪞</div><p>pulling 5 of your top songs...</p></div>');
  const picked = [];
  for (const x of qShuffle(ranked)) {
    const p = await qFindPreview(x.t);
    if (p) picked.push({ track: x.t, rank: x.rank, preview: p });
    if (picked.length === 5) break;
  }
  if (picked.length < 5) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🪞 blind ranking', '') + qErrorBox('couldn\'t find clips for enough of your songs. try again in a bit?'));
    return;
  }
  picked.slice().sort((a, b) => a.rank - b.rank).forEach((x, i) => { x.actual = i + 1; });
  M.blind = { songs: picked, slots: [null, null, null, null, null], i: 0 };
  mBlindRender();
}
function mBlindRender() {
  const B = M.blind; const cur = B.songs[B.i];
  Q.screen = 'mplay';
  qSet(
    '<div class="q-hud"><span class="qn">song ' + (B.i + 1) + ' of 5</span><span class="qn">rank it before you hear the next one</span></div>' +
    '<div class="q-player">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      (qArt(cur.track) ? '<img src="' + qArt(cur.track) + '" alt="" style="width:110px;height:110px;border:2px solid var(--pink);margin:6px 0;">' : '') +
      '<div style="font-weight:700;font-size:1.05rem;">' + esc(qStrip(cur.track.name)) + '</div>' +
      '<div class="q-note">' + esc(qArtistNames(cur.track)) + '</div>' +
      '<button class="q-replay" style="margin-top:8px;" onclick="mBlindReplay()">↻ play again</button>' +
    '</div>' +
    '<p class="q-note" style="margin-bottom:8px;">where does it go? #1 = your favorite. no take-backs.</p>' +
    '<div class="m-slots">' + B.slots.map((s, i) => s
      ? '<div class="m-slot filled"><span class="n">#' + (i + 1) + '</span> ' + esc(qStrip(s.track.name)) + '</div>'
      : '<button class="m-slot" onclick="mBlindPlace(' + i + ')"><span class="n">#' + (i + 1) + '</span> put it here</button>').join('') +
    '</div>' +
    '<div class="q-actions"><button class="q-btn ghost" onclick="gScreenHub()">quit</button></div>'
  );
  qPlayClip(cur.preview);
}
function mBlindReplay() { const B = M.blind; if (B) qPlayClip(B.songs[B.i].preview); }
function mBlindPlace(i) {
  const B = M.blind; if (!B || B.slots[i]) return;
  B.slots[i] = B.songs[B.i];
  B.i++;
  if (B.i >= 5) mBlindResults(); else mBlindRender();
}
function mBlindResults() {
  const B = M.blind;
  Q.screen = 'results';
  qStopAudio(); qClearTimers();
  let score = 0;
  B.slots.forEach((s, i) => { score += Math.round(200 * (1 - Math.abs((i + 1) - s.actual) / 4)); });
  Q.score = score;
  Q.results = B.slots.map((s, i) => ({ track: s.track, points: Math.round(200 * (1 - Math.abs((i + 1) - s.actual) / 4)), correct: s.actual === i + 1, guess: null }));
  if (typeof gSaveScore === 'function') gSaveScore(score);
  mAward('first_game'); if (score === 1000) { mAward('blind_perfect'); mAward('perfect'); }
  const actual = B.slots.slice().sort((a, b) => a.actual - b.actual);
  const row = (s, i, hit) => '<div class="q-recap-row' + (hit ? ' m-hit' : '') + '"><span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' +
    (qArt(s.track) ? '<img src="' + qArt(s.track) + '" alt="">' : '') + '<div class="info"><div class="nm">' + esc(qStrip(s.track.name)) + '</div></div>' + (hit ? '<span class="p good">✓</span>' : '') + '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🪞 blind ranking', score === 1000 ? 'you know yourself scary well' : score >= 700 ? 'pretty close to the truth' : 'the numbers disagree with you') +
    '<div id="m-blind-card" class="card card-glow" style="max-width:760px;margin:0 auto;">' +
      '<div class="q-final" style="max-width:none;margin:0 0 14px;border-width:2px;"><div class="num">' + score + '</div><div class="outof">out of ' + QUIZ_MAX + '</div></div>' +
      '<div class="grid-2">' +
        '<div><p class="l-h">your ranking</p>' + B.slots.map((s, i) => row(s, i, s.actual === i + 1)).join('') + '</div>' +
        '<div><p class="l-h">what spotify says (by plays)</p>' + actual.map((s, i) => row(s, i, B.slots[i] === s)).join('') + '</div>' +
      '</div>' +
      '<p class="q-note" style="margin-top:10px;">xXx SparkleStats xXx &middot; blind ranking</p>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="mScreenBlind()">5 more</button>' +
      '<button class="q-btn ghost" onclick="lSaveNode(\'#m-blind-card\', \'sparklestats-blind-ranking\', this)">save as image</button>' +
      '<button class="q-btn ghost" onclick="gScreenHub()">arcade</button>' +
    '</div>'
  );
  if (score === 1000 && window.confetti) confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#FFB6C1'] });
}

// ======================== THEN VS NOW ========================

function mTrackKey(t) { return qNorm(qStrip(t.name)) + '|' + qNorm(gPrimary(t)); }

function mScreenThenNow() {
  Q.screen = 'thennow'; qStopAudio(); qClearTimers();
  const now = _data.tracks.short_term, all = _data.tracks.long_term;
  const nowKeys = new Set(now.map(mTrackKey)), allKeys = new Set(all.map(mTrackKey));
  const ghosts = all.filter(t => !nowKeys.has(mTrackKey(t)) && !qIsAlt(t.name)).slice(0, 20);
  const fresh = now.filter(t => !allKeys.has(mTrackKey(t)) && !qIsAlt(t.name)).slice(0, 12);
  M.tn = { ghosts, fresh, i: 0, keep: [], over: [] };
  mThenNowRender();
}
function mThenNowRender() {
  const T = M.tn;
  const g = T.ghosts[T.i];
  const left = g
    ? '<div class="m-ghost">' +
        (qArt(g) ? '<img src="' + qArt(g) + '" alt="">' : '') +
        '<div class="nm">' + esc(qStrip(g.name)) + '</div><div class="ar">' + esc(qArtistNames(g)) + '</div>' +
        '<div class="q-note">in your all-time top, missing from last month</div>' +
        '<div class="q-actions"><button class="q-btn ghost" onclick="mThenNowSwipe(0)">over it 💔</button><button class="q-btn" onclick="mThenNowSwipe(1)">still love it 🖤</button></div>' +
        '<div class="q-note">' + (T.i + 1) + ' / ' + T.ghosts.length + ' &middot; ← → keys work</div>' +
      '</div>'
    : '<div class="m-ghost done">' +
        '<div class="nm">revival list</div>' +
        (T.keep.length ? '<ol class="m-list">' + T.keep.map(t => '<li>' + esc(mTrackLabel(t)) + '</li>').join('') + '</ol>' : '<p class="q-note">you\'re over all of them. cold.</p>') +
        '<div class="q-note" style="margin-top:8px;">' + T.over.length + ' let go &middot; ' + T.keep.length + ' kept</div>' +
        '<div class="q-actions">' +
          (T.keep.length ? '<button class="q-btn" onclick="mThenNowCopy(this)">copy the list</button>' : '') +
          (T.keep.length >= QUIZ_MIN_Q ? '<button class="q-btn ghost" onclick="mThenNowQuiz()">quiz me on these</button>' : '') +
          '<button class="q-btn ghost" onclick="mScreenThenNow()">start over</button>' +
        '</div>' +
      '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('👻 then vs now', 'what fell off, what showed up') +
    '<div class="grid-2" style="max-width:820px;margin:0 auto;align-items:start;">' +
      '<div class="card" style="margin:0;"><p class="l-h">👻 ghosts</p>' + (T.ghosts.length ? left : '<p class="q-note">nothing\'s fallen off. consistent.</p>') + '</div>' +
      '<div class="card" style="margin:0;"><p class="l-h">✨ new obsessions</p>' +
        (T.fresh.length ? T.fresh.map(t => '<div class="q-recap-row">' + (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '') +
          '<div class="info"><div class="nm">' + esc(qStrip(t.name)) + '</div><div class="ar">' + esc(qArtistNames(t)) + '</div></div></div>').join('')
          : '<p class="q-note">nothing new broke in this month.</p>') +
      '</div>' +
    '</div>'
  );
}
function mThenNowSwipe(keep) {
  const T = M.tn; if (!T || T.i >= T.ghosts.length) return;
  (keep ? T.keep : T.over).push(T.ghosts[T.i]);
  T.i++;
  mThenNowRender();
}
function mThenNowCopy(btn) {
  const T = M.tn;
  navigator.clipboard.writeText('🖤 revival list\n' + T.keep.map((t, i) => (i + 1) + '. ' + mTrackLabel(t)).join('\n'))
    .then(() => { btn.textContent = 'copied 🩷'; setTimeout(() => { btn.textContent = 'copy the list'; }, 2000); }).catch(() => {});
}
function mThenNowQuiz() {
  const T = M.tn; if (!T) return;
  Q.game = 'classic'; Q.len = QUIZ_LEN;
  Q.pool = T.keep.slice();
  Q.source = { kind: 'revival', id: 'revival', name: 'your revival list', image: qArt(T.keep[0]) || '', sub: T.keep.length + ' songs' };
  qScreenMode();
}

// ======================== YOU VS PAST YOU ========================

function mCardFor(tracks, artists, name) {
  const an = lAnalyze(artists, tracks);
  const ar = artists.slice(0, L_CARD_N), tr = tracks.slice(0, L_CARD_N);
  return {
    v: 2, n: name, p: an.personality.primary.name, pe: an.personality.primary.emoji,
    g: an.genres.ranked.slice(0, 12).map(x => x.genre.replace(/\|/g, '/')).join('|'),
    m: L_MOOD_KEYS.map(k => an.moodData.mood[k]),
    o: an.obscurity.score, d: an.diversity.score, dec: an.decades.dominant,
    a: ar.map(a => String(a.id).slice(0, 8)).join(''),
    t: tr.map(t => lHash5(lTrackKey(t))).join(''),
    ta: ar.slice(0, L_TOP).map(a => String(a.name).replace(/\|/g, '/').slice(0, 24)).join('|'),
    tt: tr.slice(0, L_TOP).map(lSongLabel).join('|'),
  };
}
function mScreenPastYou() {
  Q.screen = 'pastyou'; qStopAudio(); qClearTimers();
  const now = mCardFor(_data.tracks.short_term, _data.artists.short_term, 'you now');
  const then = mCardFor(_data.tracks.long_term, _data.artists.long_term, 'you, all time');
  L.myNames = {
    a: new Map(_data.artists.short_term.slice(0, L_CARD_N).map(a => [String(a.id).slice(0, 8), a.name])),
    t: new Map(_data.tracks.short_term.slice(0, L_CARD_N).map(t => [lHash5(lTrackKey(t)), lSongLabel(t)])),
  };
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🔮 you vs past you', 'last month against all time') +
    '<div id="l-battle-result"></div>'
  );
  lRenderBattle(now, then);
}

// ======================== PLAYLIST ROAST ========================

function mOpenRoast() {
  Q.game = 'roast'; G.daily = false; G.challenge = null;
  qScreenMenu();
}
function mRoastLines(pool, name) {
  const lines = [];
  const n = pool.length;
  const artists = new Map();
  for (const t of pool) { const a = gPrimary(t); artists.set(a, (artists.get(a) || 0) + 1); }
  const [topArtist, topCount] = [...artists.entries()].sort((x, y) => y[1] - x[1])[0] || ['', 0];
  const share = n ? Math.round(topCount / n * 100) : 0;
  const years = pool.map(gYear).filter(Boolean);
  const avgYear = years.length ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : 0;
  const durs = pool.map(t => t.duration_ms || 0).filter(Boolean);
  const avgDur = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  const titles = new Map();
  for (const t of pool) { const k = qNorm(qStrip(t.name)); titles.set(k, (titles.get(k) || 0) + 1); }
  const dupes = [...titles.values()].filter(c => c > 1).length;
  const alts = pool.filter(t => qIsAlt(t.name)).length;
  const explicit = n ? Math.round(pool.filter(t => t.explicit).length / n * 100) : 0;
  const longest = pool.slice().sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0))[0];
  const oldest = pool.filter(gYear).sort((a, b) => gYear(a) - gYear(b))[0];
  const oneWord = n ? Math.round(pool.filter(t => qStrip(t.name).split(/\s+/).length === 1).length / n * 100) : 0;

  if (n < 15) lines.push('this is ' + n + ' songs. that\'s not a playlist, that\'s a snack.');
  if (n > 150) lines.push(n + ' songs. this isn\'t a playlist, it\'s a hoarding situation with a cover image.');
  if (share >= 40 && artists.size > 1) lines.push(share + '% of this is ' + topArtist + '. at that point just call it an album.');
  if (artists.size <= 3 && n >= 10) lines.push(artists.size + ' artists total. bold of you to call this a "playlist".');
  if (avgYear && avgYear <= 2006) lines.push('average release year: ' + avgYear + '. this playlist has a myspace.');
  if (avgYear && avgYear >= 2022) lines.push('average release year: ' + avgYear + '. the ink isn\'t dry on half of these.');
  if (dupes >= 1) lines.push(dupes + ' song' + (dupes > 1 ? 's are' : ' is') + ' in here twice. commitment, or a mistake? you decide.');
  if (alts >= 3) lines.push(alts + ' live / acoustic / remix versions. we get it. you were there.');
  if (avgDur > 300000) lines.push('average song ' + fmtDur(avgDur) + '. the patience of a saint, or the taste of a prog fan.');
  if (avgDur && avgDur < 180000) lines.push('average song under three minutes. attention span of a goldfish with a ring light.');
  if (explicit >= 60) lines.push(explicit + '% explicit. do not play this in the car with your mom.');
  if (longest && longest.duration_ms > 480000) lines.push('"' + qStrip(longest.name) + '" is ' + fmtDur(longest.duration_ms) + ' long. that\'s not a song, that\'s a commute.');
  if (oldest && gYear(oldest) < 1990) lines.push('oldest thing here: "' + qStrip(oldest.name) + '" (' + gYear(oldest) + '). okay, respect.');
  if (oneWord >= 40) lines.push(oneWord + '% one-word titles. minimal effort, maximum drama.');
  if (n >= 30 && artists.size >= n * 0.8) lines.push('almost every song is a different artist. commitment issues, but eclectic ones.');
  if (!lines.length) lines.push('honestly? it\'s fine. that\'s the roast. it\'s fine. suspiciously fine.');
  const grade = lines.length >= 6 ? 'D' : lines.length >= 4 ? 'C' : lines.length >= 2 ? 'B' : 'A';
  return { lines: lines.slice(0, 7), grade, stats: { n, artists: artists.size, avgYear, avgDur, explicit } };
}
function mRunRoast() {
  const pool = Q.pool || [];
  const src = Q.source || { name: 'this', image: '' };
  if (pool.length < 3) {
    qSet(qTopBar('&larr; back', 'mOpenRoast()') + qHeader('🔥 playlist roast', '') + qErrorBox('need a few songs to work with here.'));
    return;
  }
  const r = mRoastLines(pool, src.name);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🔥 playlist roast', esc(src.name)) +
    '<div id="m-roast-card" class="card" style="max-width:560px;margin:0 auto;">' +
      '<div style="font-size:0.78rem;color:var(--dimtext);border-bottom:1px solid #2a1520;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;">' +
        '<span><b style="color:var(--pink);">xXx_LiveJournal_xXx</b> | roasting: ' + esc(src.name) + '</span><span>grade: <b style="color:var(--hotpink);">' + r.grade + '</b></span></div>' +
      (src.image ? '<img src="' + src.image + '" alt="" style="width:80px;height:80px;border:2px solid var(--pink);float:right;margin:0 0 8px 12px;">' : '') +
      r.lines.map(l => '<p style="font-style:italic;line-height:1.7;color:var(--babypink);margin-bottom:8px;">"' + esc(l) + '"</p>').join('') +
      '<p style="text-align:right;color:var(--darkpink);font-size:0.75rem;margin-top:6px;clear:both;">' + r.stats.n + ' songs &middot; ' + r.stats.artists + ' artists' + (r.stats.avgYear ? ' &middot; avg ' + r.stats.avgYear : '') + '</p>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#m-roast-card\', \'sparklestats-roast\', this)">save as image</button>' +
      '<button class="q-btn ghost" onclick="mOpenRoast()">roast another</button>' +
    '</div>'
  );
}

// ======================== PHONE WALLPAPER ========================

function mScreenWallpaper(range) {
  Q.screen = 'wallpaper'; qStopAudio(); qClearTimers();
  range = range || 'medium_term';
  const label = { short_term: 'last month', medium_term: 'last 6 months', long_term: 'all time' }[range];
  const seen = new Set(); const arts = [];
  for (const t of (_data.tracks[range] || [])) {
    const url = t.album && t.album.images && t.album.images[0] && t.album.images[0].url;
    if (url && !seen.has(url)) { seen.add(url); arts.push(url); }
    if (arts.length >= 15) break;
  }
  const tabs = ['short_term', 'medium_term', 'long_term'].map(r =>
    '<button class="' + (r === range ? 'active' : '') + '" onclick="mScreenWallpaper(\'' + r + '\')">' + { short_term: 'last month', medium_term: '6 months', long_term: 'all time' }[r] + '</button>').join('');
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('📱 phone wallpaper', 'your album wall, lock-screen shaped') +
    '<div class="tabs">' + tabs + '</div>' +
    (arts.length < 6 ? qErrorBox('not enough album art in that range yet.') :
    '<div class="m-wallwrap"><div id="m-wall" class="m-wall">' +
      '<div class="m-wallgrid">' + arts.map(u => '<img src="' + u + '" alt="">').join('') + '</div>' +
      '<div class="m-wallfoot"><div class="m-wallname">' + esc(gPlayer()) + '</div><div class="m-wallsub">top songs &middot; ' + label + '</div><div class="m-wallbrand">xXx SparkleStats xXx</div></div>' +
    '</div></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="lSaveNode(\'#m-wall\', \'sparklestats-wallpaper\', this, 3)">save wallpaper</button></div>' +
    '<p class="q-note">saves at 1080 x 1920. set it as your lock screen and act like you didn\'t make it.</p>')
  );
}

// ======================== CUSTOM QUIZ BUILDER ========================

function mBuilderLoad() {
  if (M.builder) return M.builder;
  try { M.builder = JSON.parse(localStorage.getItem('sparkle_builder') || 'null'); } catch { M.builder = null; }
  if (!M.builder || !Array.isArray(M.builder.songs)) M.builder = { title: 'can you guess my songs?', mode: 'mc', songs: [], results: [] };
  return M.builder;
}
function mBuilderSave() { try { localStorage.setItem('sparkle_builder', JSON.stringify(M.builder)); } catch {} }
function mBuilderSlim(t) { return { id: t.id, name: qStrip(t.name), artist: gPrimary(t), art: qArt(t) }; }

function mScreenBuilder() {
  Q.screen = 'builder'; qStopAudio(); qClearTimers();
  const b = mBuilderLoad();
  const inCd = new Set(b.songs.map(s => s.id));
  const mine = lCdTracks().filter(t => !qIsAlt(t.name)).slice(0, 40);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🧩 custom quiz builder', 'pick 5 to 10 songs, name it, send it') +
    '<div class="grid-2" style="max-width:900px;margin:0 auto;align-items:start;">' +
      '<div class="card" style="margin:0;">' +
        '<div class="q-typerow" style="margin-bottom:10px;"><input id="m-b-search" class="q-input" placeholder="search any song on spotify..." autocomplete="off"><button class="q-btn" onclick="mBuilderSearch()">search</button></div>' +
        '<div id="m-b-results"></div>' +
        '<p class="l-h" style="margin-top:12px;">or from your top songs</p>' +
        '<div class="l-pick" style="max-height:320px;">' + mine.map(t =>
          '<button class="q-row" style="margin-bottom:3px;padding:5px 8px;' + (inCd.has(t.id) ? 'opacity:0.35;' : '') + '" ' + (inCd.has(t.id) ? 'disabled' : '') + ' onclick="mBuilderAddTop(\'' + t.id + '\')">' +
            (qArt(t) ? '<img src="' + qArt(t) + '" alt="" style="width:34px;height:34px;">' : '') +
            '<div style="flex:1;overflow:hidden;"><div class="nm" style="font-size:0.8rem;">' + esc(qStrip(t.name)) + '</div><div class="mt">' + esc(qArtistNames(t)) + '</div></div><span style="color:var(--pink);font-weight:700;">+</span></button>').join('') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="q-typerow" style="margin-bottom:10px;"><input id="m-b-title" class="q-input" value="' + esc(b.title) + '" maxlength="40" placeholder="name your quiz..." oninput="mBuilderTitle(this.value)"></div>' +
        '<div class="tabs" style="margin-bottom:10px;">' +
          '<button class="' + (b.mode === 'mc' ? 'active' : '') + '" onclick="mBuilderMode(\'mc\')">multiple choice</button>' +
          '<button class="' + (b.mode === 'type' ? 'active' : '') + '" onclick="mBuilderMode(\'type\')">they type it</button>' +
        '</div>' +
        '<div class="card" style="margin:0 0 10px;"><p class="l-h">' + b.songs.length + ' / 10 songs</p>' +
          (b.songs.length ? b.songs.map((s, i) => '<div class="q-recap-row">' + (s.art ? '<img src="' + s.art + '" alt="">' : '') +
            '<div class="info"><div class="nm">' + esc(s.name) + '</div><div class="ar">' + esc(s.artist) + '</div></div>' +
            '<button class="x l-slot-x" onclick="mBuilderRemove(' + i + ')" style="background:none;border:1px solid #2a1520;color:var(--dimtext);cursor:pointer;padding:1px 6px;">✕</button></div>').join('')
            : '<p class="q-note">nothing yet. add some songs.</p>') +
        '</div>' +
        '<div class="q-actions" style="justify-content:flex-start;">' +
          '<button class="q-btn" onclick="mBuilderLink(this)" ' + (b.songs.length < 5 ? 'disabled' : '') + '>make the link 🔗</button>' +
          '<button class="q-btn ghost" onclick="mBuilderTry()" ' + (b.songs.length < 5 ? 'disabled' : '') + '>try it myself</button>' +
          '<button class="q-btn ghost" onclick="mBuilderClear()">clear</button>' +
        '</div>' +
        '<p class="q-note" style="text-align:left;margin-top:8px;">the link carries the exact songs. whoever opens it (logged in) plays your quiz and sees your name on it.</p>' +
      '</div>' +
    '</div>'
  );
  const s = document.getElementById('m-b-search');
  if (s) s.addEventListener('keydown', e => { if (e.key === 'Enter') mBuilderSearch(); });
}
let mSearchHits = [];
async function mBuilderSearch() {
  const inp = document.getElementById('m-b-search');
  const term = inp ? inp.value.trim() : '';
  const box = document.getElementById('m-b-results');
  if (!term || !box) return;
  box.innerHTML = '<p class="q-note">searching...</p>';
  try {
    const res = await qFetch('/search?q=' + encodeURIComponent(term) + '&type=track&limit=' + SEARCH_LIMIT + '&market=' + qMarket());
    mSearchHits = (res.tracks && res.tracks.items || []).filter(t => t && t.id && !qIsAlt(t.name));
    box.innerHTML = mSearchHits.length ? mSearchHits.map((t, i) =>
      '<button class="q-row" style="margin-bottom:3px;padding:5px 8px;" onclick="mBuilderAddHit(' + i + ')">' +
        (qArt(t) ? '<img src="' + qArt(t) + '" alt="" style="width:34px;height:34px;">' : '') +
        '<div style="flex:1;overflow:hidden;"><div class="nm" style="font-size:0.8rem;">' + esc(qStrip(t.name)) + '</div><div class="mt">' + esc(qArtistNames(t)) + '</div></div><span style="color:var(--pink);font-weight:700;">+</span></button>').join('')
      : '<p class="q-note">nothing found.</p>';
  } catch (e) { box.innerHTML = qErrorBox(esc(e.message)); }
}
function mBuilderAdd(t) {
  const b = mBuilderLoad();
  if (b.songs.length >= 10 || b.songs.some(s => s.id === t.id)) return;
  b.songs.push(mBuilderSlim(t));
  mBuilderSave();
  mScreenBuilder();
}
function mBuilderAddHit(i) { if (mSearchHits[i]) mBuilderAdd(mSearchHits[i]); }
function mBuilderAddTop(id) { const t = lCdTracks().find(x => x.id === id); if (t) mBuilderAdd(t); }
function mBuilderRemove(i) { const b = mBuilderLoad(); b.songs.splice(i, 1); mBuilderSave(); mScreenBuilder(); }
function mBuilderTitle(v) { mBuilderLoad().title = String(v || '').slice(0, 40) || 'can you guess my songs?'; mBuilderSave(); }
function mBuilderMode(m) { mBuilderLoad().mode = m === 'type' ? 'type' : 'mc'; mBuilderSave(); mScreenBuilder(); }
function mBuilderClear() { M.builder = { title: 'can you guess my songs?', mode: 'mc', songs: [], results: [] }; mBuilderSave(); mScreenBuilder(); }
function mBuilderPayload() {
  const b = mBuilderLoad();
  return {
    v: 1, g: 'classic', m: b.mode,
    s: { kind: 'custom', id: String(gHash(b.title + '|' + gPlayer())), name: b.title, image: (b.songs[0] && b.songs[0].art) || '', sub: 'made by ' + gPlayer() },
    t: b.songs.map(s => s.id), sc: null, by: gPlayer(),
  };
}
function mBuilderLink(btn) {
  const b = mBuilderLoad();
  if (b.songs.length < 5) return;
  const link = location.origin + location.pathname + '?challenge=' + gB64(mBuilderPayload());
  mAward('builder');
  navigator.clipboard.writeText(link).then(() => { btn.textContent = 'link copied 🩷 send it'; setTimeout(() => { btn.textContent = 'make the link 🔗'; }, 2500); }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}
function mBuilderTry() {
  const b = mBuilderLoad();
  if (b.songs.length < 5) return Promise.resolve(false);
  return gOpenChallenge(gB64(mBuilderPayload()));
}

// ======================== WHOSE SONG IS THIS ========================

function mScreenWhose(prefill) {
  Q.screen = 'whose'; qStopAudio(); qClearTimers();
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎭 whose song is this?', 'your top songs, shuffled with someone else\'s') +
    '<div class="o-room">' +
      '<div class="q-typerow" style="max-width:420px;margin:0 auto;"><input id="m-w-input" class="q-input" placeholder="paste their aux battle link..." autocomplete="off"><button class="q-btn" onclick="mWhoseGo()">mix it up</button></div>' +
      '<p class="q-note" style="margin-top:10px;">they get their link from arcade &rarr; aux battle &rarr; copy my battle link.</p>' +
      '<div id="m-w-msg" style="margin-top:10px;"></div>' +
    '</div>'
  );
  const inp = document.getElementById('m-w-input');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') mWhoseGo(); }); if (prefill) { inp.value = prefill; mWhoseGo(); } }
}
function mWhoseGo() {
  const inp = document.getElementById('m-w-input');
  const msg = document.getElementById('m-w-msg');
  const theirsRaw = lParseBattle(inp ? inp.value : '');
  if (!theirsRaw) { if (msg) msg.innerHTML = qErrorBox('that doesn\'t look like a battle link.'); return; }
  const theirs = lNormCard(theirsRaw);
  const mineCard = lNormCard(lMyCard());
  const theirLabels = theirs.topT.filter(Boolean);
  const mineLabels = mineCard.topT.filter(Boolean);
  const overlap = new Set(theirLabels.map(qNorm));
  const items = qShuffle(
    mineLabels.filter(l => !overlap.has(qNorm(l))).map(l => ({ label: l, owner: 0 }))
      .concat(theirLabels.filter(l => !new Set(mineLabels.map(qNorm)).has(qNorm(l))).map(l => ({ label: l, owner: 1 })))
  );
  if (items.length < 6) { if (msg) msg.innerHTML = qErrorBox('you two share too many songs for this to be a game. suspicious.'); return; }
  M.whose = { items, i: 0, score: 0, right: 0, names: [gPlayer(), theirs.n], theirs };
  Q.source = { kind: 'whose', id: theirs.n, name: 'whose song: you vs ' + theirs.n, image: '', sub: items.length + ' songs' };
  mWhoseRender();
}
function mWhoseRender() {
  const W = M.whose; const it = W.items[W.i];
  Q.screen = 'mplay'; Q.locked = false;
  qClearTimers();
  Q.duration = 6; Q.deadline = Date.now() + 6000;
  qSet(
    '<div class="q-hud"><span class="qn">' + (W.i + 1) + ' of ' + W.items.length + '</span><span class="sc">' + W.score + ' pts</span></div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    '<div class="m-blankwrap"><div class="m-blank" style="font-size:1.3rem;">' + esc(it.label) + '</div>' +
      '<p class="q-note">whose top song is this?</p>' +
      '<div class="g-pair" style="max-width:520px;margin:0 auto;">' +
        '<button class="g-side" id="m-w0" onclick="mWhosePick(0)"><div class="nm">🩷 ' + esc(W.names[0]) + '</div><div class="ar">(you)</div></button>' +
        '<div class="vs">or</div>' +
        '<button class="g-side" id="m-w1" onclick="mWhosePick(1)"><div class="nm">💜 ' + esc(W.names[1]) + '</div><div class="ar">(them)</div></button>' +
      '</div></div>' +
    '<div class="v-status" id="m-w-status"></div>'
  );
  Q.tick = setInterval(() => mTick(() => mWhosePick(-1)), 100);
}
function mWhosePick(p) {
  const W = M.whose; if (!W || Q.locked) return;
  Q.locked = true; qClearTimers();
  const it = W.items[W.i];
  const ok = p === it.owner;
  const per = Math.round(QUIZ_MAX / W.items.length);
  if (ok) { W.score += per; W.right++; }
  [0, 1].forEach(j => { const el = document.getElementById('m-w' + j); if (!el) return; el.disabled = true; if (j === it.owner) el.classList.add('right'); else if (j === p) el.classList.add('wrong'); });
  const st = document.getElementById('m-w-status');
  if (st) st.innerHTML = ok ? '<span class="good">+' + per + ' 🖤</span>' : '<span class="bad">' + (p < 0 ? 'too slow - ' : 'nope - ') + 'that\'s ' + esc(W.names[it.owner]) + '\'s</span>';
  setTimeout(() => {
    W.i++;
    if (W.i >= W.items.length) mWhoseResults(); else mWhoseRender();
  }, 800);
}
function mWhoseResults() {
  const W = M.whose;
  Q.screen = 'results'; qClearTimers();
  Q.score = W.score;
  Q.results = W.items.map(it => ({ track: { name: it.label, artists: [] }, points: 0, correct: false, guess: null }));
  if (typeof gSaveScore === 'function') gSaveScore(W.score);
  mAward('first_game'); mAward('battle');
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎭 whose song is this?', 'you vs ' + esc(W.names[1])) +
    '<div class="q-final fade-up"><div class="num">' + W.score + '</div><div class="outof">' + W.right + ' / ' + W.items.length + ' right</div>' +
      '<div class="rank">' + (W.right === W.items.length ? 'you know both of you scary well' : W.right >= W.items.length * 0.75 ? 'you pay attention' : W.right >= W.items.length / 2 ? 'coin flips went your way' : 'do you two even talk about music') + '</div></div>' +
    '<div class="q-actions"><button class="q-btn" onclick="mScreenWhose()">another link</button><button class="q-btn ghost" onclick="gScreenHub()">arcade</button></div>'
  );
}

// ======================== BADGES ========================

const M_BADGES = [
  { id: 'first_game', emoji: '🎧', name: 'first spin', how: 'finish any round' },
  { id: 'perfect', emoji: '👑', name: '1000 club', how: 'a perfect 1000 in any round' },
  { id: 'heardle_1s', emoji: '⚡', name: 'one second', how: 'nail a heardle song on the 1-second stage' },
  { id: 'streak3', emoji: '🔥', name: '3-day streak', how: 'daily song, three days running' },
  { id: 'streak7', emoji: '🌙', name: 'week strong', how: 'daily song, a whole week' },
  { id: 'versus_win', emoji: '🥊', name: 'aux champion', how: 'win a versus' },
  { id: 'online_win', emoji: '🌐', name: 'long distance', how: 'win an online versus' },
  { id: 'bracket_champ', emoji: '🥇', name: 'bracketologist', how: 'crown a bracket champion' },
  { id: 'light10', emoji: '💥', name: 'lightning in a bottle', how: 'a 10 streak in lightning round' },
  { id: 'blind_perfect', emoji: '🪞', name: 'know thyself', how: 'blind rank your top 5 perfectly' },
  { id: 'obscure75', emoji: '🕳️', name: 'underground', how: 'obscurity 75+ on your dashboard' },
  { id: 'diverse75', emoji: '🌈', name: 'omnivore', how: 'diversity 75+ on your dashboard' },
  { id: 'builder', emoji: '✍️', name: 'quizmaster', how: 'make a custom quiz link' },
  { id: 'battle', emoji: '🆚', name: 'compared notes', how: 'finish an aux battle or a whose-song round' },
  { id: 'hundred', emoji: '💯', name: 'century', how: '100 songs guessed right, all time' },
  { id: 'nightowl', emoji: '🦇', name: 'night owl', how: 'finish a round between midnight and 5am' },
];
function mBadgesLoad() { try { return JSON.parse(localStorage.getItem('sparkle_badges') || '{}') || {}; } catch { return {}; } }
function mAward(id) {
  const b = M_BADGES.find(x => x.id === id);
  if (!b) return false;
  const have = mBadgesLoad();
  if (have[id]) return false;
  have[id] = Date.now();
  try { localStorage.setItem('sparkle_badges', JSON.stringify(have)); } catch {}
  if (typeof showToast === 'function') showToast('badge unlocked: ' + b.emoji + ' ' + b.name);
  return true;
}
function mCheckDashboardBadges() {
  try {
    if (!_data || !_data.artists || !_data.artists.medium_term.length) return;
    const an = lMine();
    if (an.obscurity.score >= 75) mAward('obscure75');
    if (an.diversity.score >= 75) mAward('diverse75');
  } catch {}
}
// after any normal results screen (classic / heardle / cover / hilo / year / finish / album / challenge)
function mOnResults() {
  if (!Q.results || !Q.results.length) return;
  mAward('first_game');
  if (Math.round(Q.score) >= QUIZ_MAX) mAward('perfect');
  if (Q.game === 'heardle' && Q.results.some(r => r.correct && r.points >= Math.round(Q.perQ))) mAward('heardle_1s');
  const h = new Date().getHours();
  if (h >= 0 && h < 5) mAward('nightowl');
  let total = 0;
  try { total = parseInt(localStorage.getItem('sparkle_right') || '0') || 0; } catch {}
  total += Q.results.filter(r => r.correct).length;
  try { localStorage.setItem('sparkle_right', String(total)); } catch {}
  if (total >= 100) mAward('hundred');
  if (typeof gDailyState === 'function') {
    const s = gDailyState().streak;
    if (s >= 3) mAward('streak3');
    if (s >= 7) mAward('streak7');
  }
}
function mOnVersusEnd(winner, meIdx) {
  if (winner < 0) return;
  if (meIdx === undefined || winner === meIdx) mAward('versus_win');
}
function mOnOnlineEnd(winner, meIdx) {
  if (winner >= 0 && winner === meIdx) mAward('online_win');
}
function mScreenBadges() {
  Q.screen = 'badges'; qStopAudio(); qClearTimers();
  mCheckDashboardBadges();
  const have = mBadgesLoad();
  const n = Object.keys(have).length;
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎖️ badges', n + ' of ' + M_BADGES.length + ' unlocked') +
    '<div id="m-badges-card" class="card" style="max-width:760px;margin:0 auto;">' +
      '<div class="m-badges">' + M_BADGES.map(b => {
        const got = have[b.id];
        return '<div class="m-badge' + (got ? ' got' : '') + '"><div class="e">' + b.emoji + '</div><div class="n">' + b.name + '</div>' +
          '<div class="h">' + (got ? new Date(got).toLocaleDateString() : b.how) + '</div></div>';
      }).join('') + '</div>' +
      '<p class="q-note" style="margin-top:10px;">' + esc(gPlayer()) + ' &middot; xXx SparkleStats xXx</p>' +
    '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="lSaveNode(\'#m-badges-card\', \'sparklestats-badges\', this)">save as image</button></div>'
  );
}

// ======================== KEYBOARD ========================

function mInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (Q.screen === 'thennow' && M.tn) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); mThenNowSwipe(0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); mThenNowSwipe(1); }
      return;
    }
    if (Q.screen === 'mplay' && !Q.locked) {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i < 0) return;
      if (Q.game === 'lightning') { e.preventDefault(); mLightAnswer(i); }
      else if (Q.game === 'whose' || (M.whose && Q.source && Q.source.kind === 'whose')) { if (i < 2) { e.preventDefault(); mWhosePick(i); } }
    }
    if (Q.screen === 'play' && Q.game === 'album' && Q.mode === 'mc' && !Q.locked) {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) { e.preventDefault(); mAlbumChoice(i); }
    }
  });
}
mInstallKeys();

// ======================== EXPORTS ========================

Object.assign(window, {
  mSourceDisabled, mSingleStart, mFixedLen, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, mScreenResults, mHubCards,
  mYearShow, mYearLock, mYearGiveUp, mFinishAnswer, mFinishGiveUp, mAlbumChoice, mAlbumTyped, mAlbumGiveUp,
  mLightAnswer, mBracketPlay, mBracketPick, mBracketCopy,
  mScreenBlind, mBlindReplay, mBlindPlace,
  mScreenThenNow, mThenNowSwipe, mThenNowCopy, mThenNowQuiz, mScreenPastYou,
  mOpenRoast, mRunRoast, mScreenWallpaper,
  mScreenBuilder, mBuilderSearch, mBuilderAddHit, mBuilderAddTop, mBuilderRemove, mBuilderTitle, mBuilderMode, mBuilderClear, mBuilderLink, mBuilderTry,
  mScreenWhose, mWhoseGo, mWhosePick,
  mAward, mOnResults, mOnVersusEnd, mOnOnlineEnd, mScreenBadges,
});
