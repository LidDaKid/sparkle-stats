// ============================================================
//  xXx SparkleStats xXx  -  labs.js
//  playlist DNA / aux battle / mix CD builder / save-as-image.
//  loads after games.js; reuses the quiz source picker (Q.game = 'dna'),
//  the dashboard's analysis engine (analyzeGenres & co) and html2canvas.
// ============================================================

const LABS = {
  dna: { emoji: '🧬', name: 'playlist DNA', sub: 'run the whole personality engine on any playlist' },
};

const L = { cd: null, battle: null, dna: null };

const L_PINKS = ['#FF1493', '#FF69B4', '#FF00FF', '#8B00FF', '#C71585', '#FFB6C1', '#4B0082', '#ff8fa3', '#b266ff', '#ff4da6'];

// ======================== SHARED BITS ========================

function lHubCards() {
  const card = (ico, lbl, sub, fn) =>
    '<button class="q-src" onclick="' + fn + '"><span class="ico">' + ico + '</span>' +
    '<span class="lbl">' + lbl + '</span><span class="sub">' + sub + '</span></button>';
  return '<div class="g-hub-label">labs</div>' +
    '<div class="g-hub">' +
      card('🧬', 'playlist DNA', LABS.dna.sub, 'lOpenDNA()') +
      card('🆚', 'aux battle', 'compare taste with someone, settle who gets the aux', 'lScreenBattle()') +
      card('💿', 'mix CD builder', 'burn 12 of your songs onto a CD you can post', 'lScreenMixCD()') +
    '</div>';
}

// run up to `limit` of fn at once; failures come back as null
async function lMapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]).catch(() => null);
    }
  }));
  return out;
}

function lChart(id, config) {
  if (typeof Chart !== 'function') return null;
  const c = document.getElementById(id);
  return c ? new Chart(c, config) : null;
}

const L_MOOD_KEYS = ['melancholy', 'energy', 'angst', 'chill', 'hype', 'romance', 'darkness', 'quirkiness'];

function lRadarConfig(datasets) {
  return {
    type: 'radar',
    data: { labels: L_MOOD_KEYS, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { color: '#FFB6C1', font: { size: 11 } } } },
      scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#2a1520' },
                     angleLines: { color: '#2a1520' }, pointLabels: { color: '#FFB6C1', font: { size: 10 } } } },
    },
  };
}

function lMoodDataset(label, mood, color, fill) {
  return { label, data: L_MOOD_KEYS.map(k => mood[k]), borderColor: color, backgroundColor: fill,
           pointBackgroundColor: color, borderWidth: 2 };
}

// runs the dashboard's engine on any {artists with genres, tracks} pair
function lAnalyze(artistList, trackList) {
  const artists = { short_term: [], medium_term: artistList, long_term: [] };
  const tracks = { medium_term: trackList };
  const genres = analyzeGenres(artists);
  const decades = analyzeDecades(tracks);
  const trackStats = analyzeTrackStats(tracks);
  const moodData = computeMood(genres);
  const obscurity = computeObscurity(genres);
  const diversity = computeDiversity(genres);
  const personality = matchPersonality(moodData.mood, obscurity, diversity, decades.avgYear);
  return { genres, decades, trackStats, moodData, obscurity, diversity, personality };
}

// the logged-in user's own analysis, straight from what the dashboard loaded
function lMine() {
  const a = _data.artists, t = _data.tracks;
  return lAnalyze([...a.short_term, ...a.medium_term, ...a.long_term], [...t.short_term, ...t.medium_term, ...t.long_term]);
}

// ======================== SAVE AS IMAGE ========================

async function lSaveNode(el, name, btn, scale) {
  if (typeof el === 'string') el = document.querySelector(el);
  const label = btn ? btn.textContent : '';
  if (!el) return;
  if (typeof html2canvas !== 'function') {
    if (btn) btn.textContent = 'image tool didn\'t load - refresh?';
    return;
  }
  if (btn) btn.textContent = 'making it...';
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#000000', scale: scale || 2, useCORS: true, logging: false });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = (name || 'sparklestats') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (btn) { btn.textContent = 'saved 🩷'; setTimeout(() => { btn.textContent = label; }, 2000); }
  } catch (e) {
    if (btn) btn.textContent = 'couldn\'t save :(';
  }
}

// ======================== PLAYLIST DNA ========================

function lOpenDNA() {
  Q.game = 'dna';
  G.daily = false; G.challenge = null;
  qScreenMenu();
}

// quiz.js hands off here instead of the mode screen when Q.game is 'dna'
async function lRunDNA() {
  const pool = Q.pool || [];
  const src = Q.source || { name: 'this', image: '', sub: '' };
  if (pool.length < 5) {
    qSet(qTopBar('&larr; back', 'lOpenDNA()') + qHeader('playlist DNA', '') + qErrorBox('need at least 5 songs to read the DNA.'));
    return;
  }
  qSet('<div class="q-loadwrap"><div class="spinner">🧬</div><p>sequencing ' + esc(src.name) + '...</p>' +
       '<p class="q-note" style="margin-top:10px;">looking up the artists\' genres <span id="l-dna-prog"></span></p></div>');

  // primary artist per song, most-played first, capped so it stays quick
  const counts = new Map(), names = new Map();
  for (const t of pool) {
    const a = (t.artists || [])[0];
    if (!a?.id) continue;
    counts.set(a.id, (counts.get(a.id) || 0) + 1);
    if (!names.has(a.id)) names.set(a.id, a.name || '');
  }
  const ids = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 40).map(e => e[0]);
  // spotify dropped artist genres, so these come from apple (genres.js), cached per artist
  const stubs = ids.map(id => ({ id, name: names.get(id) || '', genres: [] }));
  if (typeof fillGenres === 'function') {
    // paced for apple's ~20/min limit; anything already cached from the dashboard is free
    await fillGenres(stubs, (done, total) => {
      const el = document.getElementById('l-dna-prog');
      if (el) el.textContent = done + ' / ' + total;
    }, { max: 16, concurrency: 1, gapMs: 1500 });
  }
  const artists = stubs.filter(a => a.genres && a.genres.length);
  if (!artists.length) {
    qSet(qTopBar('&larr; back', 'lOpenDNA()') + qHeader('playlist DNA', '') + qErrorBox('couldn\'t find genres for these artists anywhere. try something a little less underground?'));
    return;
  }
  // weight each artist by how many songs they have in here
  const weighted = artists.flatMap(a => Array(counts.get(a.id) || 1).fill(a));
  const an = lAnalyze(weighted, pool);
  L.dna = { src, pool, artists, an };
  lRenderDNA();
}

function lGauge(val, label, sub) {
  return '<div class="card gauge-wrap" style="margin:0;"><div class="gauge-value">' + val + '</div>' +
         '<div class="gauge-label">' + esc(label) + '</div><div class="gauge-sub">' + sub + '</div></div>';
}

function lRenderDNA() {
  const { src, pool, artists, an } = L.dna;
  const p = an.personality.primary;
  const years = an.decades;
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🧬 playlist DNA', esc(src.name)) +
    '<div id="l-dna-card" class="card card-glow" style="max-width:760px;margin:0 auto;">' +
      '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">' +
        (src.image ? '<img src="' + src.image + '" alt="" style="width:72px;height:72px;object-fit:cover;border:2px solid var(--pink);">' : '') +
        '<div><div style="font-size:1.2rem;font-weight:700;color:var(--pink);">' + esc(src.name) + '</div>' +
        '<div class="q-note" style="text-align:left;">' + pool.length + ' songs &middot; ' + artists.length + ' artists &middot; avg year ' + years.avgYear + '</div></div>' +
      '</div>' +
      '<div class="personality-badge" style="background:' + p.gradient + ';padding:22px 16px;margin-bottom:12px;">' +
        '<div class="personality-emoji" style="font-size:2.6rem;">' + p.emoji + '</div>' +
        '<div class="personality-name" style="font-size:2rem;">' + esc(p.name) + '</div>' +
        '<div class="personality-tagline">"' + esc(p.tag) + '"</div>' +
        '<div class="personality-match">' + an.personality.confidence + '% match &middot; splash of ' + an.personality.secondary.emoji + ' ' + esc(an.personality.secondary.name) + '</div>' +
      '</div>' +
      '<p style="line-height:1.6;font-size:0.9rem;margin-bottom:14px;">' + esc(p.desc) + '</p>' +
      '<div class="grid-2" style="margin-bottom:14px;">' +
        '<div class="card" style="margin:0;"><p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:6px;">★ vibe breakdown ★</p><div class="chart-box" style="height:240px;"><canvas id="l-radar"></canvas></div></div>' +
        '<div class="card" style="margin:0;"><p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:6px;">★ genres ★</p><div class="chart-box" style="height:240px;"><canvas id="l-pie"></canvas></div></div>' +
      '</div>' +
      '<div class="grid-3" style="margin-bottom:14px;">' +
        lGauge(an.obscurity.score, an.obscurity.label, 'obscurity') +
        lGauge(an.diversity.score, an.diversity.label, an.genres.uniqueCount + ' genres') +
        lGauge(an.trackStats.explicitPct + '%', getExplicitLabel(an.trackStats.explicitPct), 'explicit') +
      '</div>' +
      '<div class="genre-cloud" style="margin-bottom:14px;">' +
        an.genres.ranked.slice(0, 14).map((g, i) =>
          '<span style="font-size:' + Math.max(0.7, 1.4 - i * 0.05) + 'rem;color:' + L_PINKS[i % L_PINKS.length] + ';font-weight:' + (i < 4 ? 700 : 400) + ';">' +
          esc(g.genre) + ' <span style="font-size:0.6rem;color:var(--dimtext);">' + g.pct.toFixed(0) + '%</span></span>'
        ).join(' ') +
      '</div>' +
      '<div class="card" style="margin:0 0 14px;"><div class="chart-box" style="height:160px;"><canvas id="l-dec"></canvas></div>' +
        '<p style="text-align:center;margin-top:8px;font-size:0.9rem;">a <b style="color:var(--pink);">' + esc(years.dominant) + '</b> playlist at heart</p></div>' +
      '<div class="taste-sentence" style="font-size:1rem;">' + esc(getVibeStatement(an.moodData.dominant)) +
        '<div class="q-note" style="margin-top:6px;">dominant mood: <b style="color:var(--hotpink);">' + esc(an.moodData.dominant) + '</b></div></div>' +
      '<p class="q-note" style="margin-top:12px;">xXx SparkleStats xXx &middot; playlist DNA</p>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#l-dna-card\', \'sparklestats-dna\', this)">save as image</button>' +
      '<button class="q-btn ghost" onclick="lDNAtoQuiz()">quiz me on this</button>' +
      '<button class="q-btn ghost" onclick="lOpenDNA()">another one</button>' +
    '</div>'
  );
  requestAnimationFrame(() => {
    lChart('l-radar', lRadarConfig([lMoodDataset(src.name, an.moodData.mood, '#FF1493', 'rgba(255,20,147,0.18)')]));
    const top = an.genres.ranked.slice(0, 8);
    lChart('l-pie', {
      type: 'doughnut',
      data: { labels: top.map(g => g.genre), datasets: [{ data: top.map(g => Math.round(g.pct * 10) / 10), backgroundColor: L_PINKS.slice(0, top.length), borderColor: '#000', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#FFB6C1', font: { size: 10 }, boxWidth: 10 } } } },
    });
    lChart('l-dec', {
      type: 'bar',
      data: { labels: years.distribution.map(d => d.decade), datasets: [{ data: years.distribution.map(d => Math.round(d.pct)), backgroundColor: '#FF1493', borderColor: '#FF69B4', borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                 scales: { x: { ticks: { color: '#FFB6C1' }, grid: { display: false } }, y: { ticks: { color: '#996b7d', callback: v => v + '%' }, grid: { color: '#1a0a15' } } } },
    });
  });
}

// the pool is already loaded, so jump straight to picking a mode
function lDNAtoQuiz() {
  Q.game = 'classic';
  Q.len = QUIZ_LEN;
  qScreenMode();
}

// ======================== AUX BATTLE ========================

// ---- taste cards ----
// built to fit in a chat message (discord caps at 2000 chars): artist ids trimmed
// to 8 chars, songs hashed to 5, everything joined into strings. names only travel
// for each player's top 8 - anything else that's shared gets named from the
// reader's own side, since "shared" means it's in their list too.
const L_CARD_N = 24;   // artists / songs carried for overlap
const L_TOP = 8;       // named favourites shown side by side

function lHash5(s) { return ((gHash(String(s)) >>> 0).toString(16) + '00000').slice(0, 5); }
function lTrackKey(t) { return qNorm(qStrip(t.name)) + '|' + qNorm(gPrimary(t)); }
function lSongLabel(t) { return (qStrip(t.name) + ' - ' + gPrimary(t)).replace(/\|/g, '/').slice(0, 40); }

function lMyLists() {
  const ar = _data.artists.medium_term.length ? _data.artists.medium_term : _data.artists.long_term;
  const tr = _data.tracks.medium_term.length ? _data.tracks.medium_term : _data.tracks.long_term;
  return { ar: ar.slice(0, L_CARD_N), tr: tr.slice(0, L_CARD_N) };
}

// the logged-in user's card (v2). also stashes a name table for this side - it never
// goes in the url, it's how shared things beyond the top 8 get their names back.
function lMyCard() {
  const an = lMine();
  const u = _data.user || {};
  const { ar, tr } = lMyLists();
  L.myNames = {
    a: new Map(ar.map(a => [String(a.id).slice(0, 8), a.name])),
    t: new Map(tr.map(t => [lHash5(lTrackKey(t)), lSongLabel(t)])),
  };
  return {
    v: 2,
    n: String(u.display_name || 'someone').slice(0, 20),
    p: an.personality.primary.name, pe: an.personality.primary.emoji,
    g: an.genres.ranked.slice(0, 12).map(x => x.genre.replace(/\|/g, '/')).join('|'),
    m: L_MOOD_KEYS.map(k => an.moodData.mood[k]),
    o: an.obscurity.score, d: an.diversity.score,
    dec: an.decades.dominant,
    a: ar.map(a => String(a.id).slice(0, 8)).join(''),
    t: tr.map(t => lHash5(lTrackKey(t))).join(''),
    ta: ar.slice(0, L_TOP).map(a => String(a.name).replace(/\|/g, '/').slice(0, 24)).join('|'),
    tt: tr.slice(0, L_TOP).map(lSongLabel).join('|'),
  };
}

// either card version -> one internal shape. keys stay ordered so the first
// eight line up with the top-8 names.
function lNormCard(c) {
  if (!c) return null;
  const m = Array.isArray(c.m)
    ? Object.fromEntries(L_MOOD_KEYS.map((k, i) => [k, Number(c.m[i]) || 0]))
    : (c.m || {});
  const base = { n: String(c.n || 'someone'), p: String(c.p || ''), pe: String(c.pe || ''), o: Number(c.o) || 0, d: Number(c.d) || 0, dec: c.dec || '', m };
  if (c.v === 2) {
    const aKeys = String(c.a || '').match(/.{8}/g) || [];
    const tKeys = String(c.t || '').match(/.{5}/g) || [];
    const topA = c.ta ? String(c.ta).split('|') : [];
    const topT = c.tt ? String(c.tt).split('|') : [];
    return Object.assign(base, {
      g: c.g ? String(c.g).split('|') : [], aKeys, tKeys, topA, topT,
      aNames: new Map(topA.map((n, i) => [aKeys[i], n])),
      tNames: new Map(topT.map((n, i) => [tKeys[i], n])),
    });
  }
  const ar = Array.isArray(c.ar) ? c.ar : [], tr = Array.isArray(c.tr) ? c.tr : [];
  const aKeys = ar.map(a => String(a.i || '').slice(0, 8));
  const tKeys = tr.map(t => lHash5(t.k || ''));
  return Object.assign(base, {
    g: Array.isArray(c.g) ? c.g : [], aKeys, tKeys,
    topA: ar.slice(0, L_TOP).map(a => a.n), topT: tr.slice(0, L_TOP).map(t => t.n + ' - ' + t.a),
    aNames: new Map(ar.map((a, i) => [aKeys[i], a.n])),
    tNames: new Map(tr.map((t, i) => [tKeys[i], t.n + ' - ' + t.a])),
  });
}

function lBattleLink() {
  return location.origin + location.pathname + '?battle=' + gB64(lMyCard());
}

function lCopyBattle(btn) {
  navigator.clipboard.writeText(lBattleLink()).then(() => {
    btn.textContent = 'copied 🩷 send it to them';
    setTimeout(() => { btn.textContent = 'copy my battle link'; }, 2500);
  }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}

function lParseBattle(raw) {
  let s = String(raw || '').trim();
  const m = s.match(/[?&]battle=([^&#\s]+)/);
  if (m) s = decodeURIComponent(m[1]);
  try {
    const c = gUnB64(s);
    if (!c || !c.m) return null;
    if (c.v === 2 && typeof c.a === 'string') return c;
    if (c.v === 1 && Array.isArray(c.ar)) return c;
    return null;
  } catch { return null; }
}

function lCompare(mineRaw, theirsRaw) {
  const mine = lNormCard(mineRaw), theirs = lNormCard(theirsRaw);
  const theirA = new Set(theirs.aKeys), theirT = new Set(theirs.tKeys);
  const sharedA = mine.aKeys.filter(k => theirA.has(k));
  const sharedT = mine.tKeys.filter(k => theirT.has(k));
  const nameFor = (kind, k) =>
    (L.myNames && L.myNames[kind] && L.myNames[kind].get(k)) ||
    mine[kind === 'a' ? 'aNames' : 'tNames'].get(k) ||
    theirs[kind === 'a' ? 'aNames' : 'tNames'].get(k) || '?';
  const sharedArtists = sharedA.map(k => nameFor('a', k));
  const sharedTracks = sharedT.map(k => nameFor('t', k));
  const myG = new Set(mine.g), sharedGenres = theirs.g.filter(g => myG.has(g));
  const moodDiff = L_MOOD_KEYS.reduce((s, k) => s + Math.abs((mine.m[k] || 0) - (theirs.m[k] || 0)), 0) / L_MOOD_KEYS.length;
  const moodSim = Math.max(0, 1 - moodDiff / 60);   // 60 avg points apart = nothing in common
  // full marks at 8 shared artists / 6 shared genres, or everything if someone's list is shorter
  const artistFull = Math.max(1, Math.min(8, mine.aKeys.length, theirs.aKeys.length));
  const genreFull = Math.max(1, Math.min(6, mine.g.length, theirs.g.length));
  const score = Math.round(100 * (0.4 * Math.min(1, sharedA.length / artistFull) +
                                  0.3 * Math.min(1, sharedGenres.length / genreFull) +
                                  0.3 * moodSim));
  const label = score >= 80 ? 'aux soulmates'
              : score >= 60 ? 'same car, no fights'
              : score >= 40 ? 'you\'d survive a road trip'
              : score >= 20 ? 'separate headphones'
              : 'different planets, same orbit';
  const myCur = mine.o + mine.d, theirCur = theirs.o + theirs.d;
  const aux = myCur === theirCur ? null : (myCur > theirCur ? mine : theirs);
  const auxWhy = aux === null ? 'dead even. shared custody of the aux.'
    : (aux.o > (aux === mine ? theirs : mine).o ? 'deeper cuts' : 'wider range') + ' - ' + esc(aux.n) + ' curates, the other one vibes.';
  return { sharedArtists, sharedTracks, sharedArtistCount: sharedA.length, sharedTrackCount: sharedT.length,
           sharedGenres, moodSim, score, label, aux, auxWhy };
}

function lScreenBattle(prefill) {
  Q.screen = 'battle';
  qStopAudio(); qClearTimers();
  const mine = lMyCard();
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🆚 aux battle', 'who actually wins the aux') +
    '<div class="grid-2" style="max-width:760px;margin:0 auto;">' +
      '<div class="card" style="margin:0;">' +
        '<p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ your card</p>' +
        '<div class="l-mini"><div class="big">' + mine.pe + ' ' + esc(mine.p) + '</div>' +
          '<div class="q-note" style="text-align:left;">top: ' + esc(String(mine.ta || '').split('|').slice(0, 3).join(', ')) + '</div>' +
          '<div class="q-note" style="text-align:left;">' + esc(String(mine.g || '').split('|').slice(0, 3).join(' · ')) + '</div></div>' +
        '<div class="q-actions" style="margin-top:12px;justify-content:flex-start;"><button class="q-btn" onclick="lCopyBattle(this)">copy my battle link</button></div>' +
        '<p class="q-note" style="text-align:left;margin-top:8px;">send it. when they open it logged in, they see the matchup - and can send theirs back.</p>' +
      '</div>' +
      '<div class="card" style="margin:0;">' +
        '<p style="color:var(--hotpink);font-weight:700;margin-bottom:8px;">★ got someone\'s link?</p>' +
        '<div class="q-typerow"><input id="l-battle-input" class="q-input" placeholder="paste their battle link..." autocomplete="off">' +
        '<button class="q-btn" onclick="lBattleGo()">battle</button></div>' +
        '<div id="l-battle-msg" style="margin-top:10px;"></div>' +
      '</div>' +
    '</div>' +
    '<div id="l-battle-result" style="margin-top:20px;"></div>'
  );
  if (prefill) {
    const theirs = lParseBattle(prefill);
    if (theirs) lRenderBattle(mine, theirs);
  }
}

function lBattleGo() {
  const inp = document.getElementById('l-battle-input');
  const msg = document.getElementById('l-battle-msg');
  const theirs = lParseBattle(inp ? inp.value : '');
  if (!theirs) { if (msg) msg.innerHTML = qErrorBox('that doesn\'t look like a battle link.'); return; }
  if (msg) msg.innerHTML = '';
  lRenderBattle(lMyCard(), theirs);
}

function lRenderBattle(mine, theirs) {
  const A = lNormCard(mine), B = lNormCard(theirs);
  const c = lCompare(mine, theirs);
  L.battle = { mine: A, theirs: B, c };
  const box = document.getElementById('l-battle-result');
  if (!box) return;
  const chips = (arr, empty) => arr.length
    ? arr.map(x => '<span class="l-chip">' + esc(x) + '</span>').join('')
    : '<span class="q-note">' + empty + '</span>';
  // each player's top 8, with anything the other one also has marked
  const topList = (items, keys, otherKeys) => items.length
    ? items.map((n, i) => {
        const hit = otherKeys.includes(keys[i]);
        return '<div class="l-top-row' + (hit ? ' shared' : '') + '">' + (i + 1) + '. ' + esc(n) + (hit ? ' 🩷' : '') + '</div>';
      }).join('')
    : '<div class="q-note" style="text-align:left;">-</div>';
  const topCol = (X, Y) =>
    '<div class="card" style="margin:0;"><p class="l-h">' + esc(X.n) + '\'s top ' + L_TOP + '</p>' +
      '<div class="l-top-h">artists</div>' + topList(X.topA, X.aKeys, Y.aKeys) +
      '<div class="l-top-h" style="margin-top:8px;">songs</div>' + topList(X.topT, X.tKeys, Y.tKeys) +
    '</div>';
  box.innerHTML =
    '<div id="l-battle-card" class="card card-glow" style="max-width:760px;margin:0 auto;">' +
      '<div class="l-vs-head">' +
        '<div><div class="nm">' + esc(A.n) + '</div><div class="pp">' + A.pe + ' ' + esc(A.p) + '</div></div>' +
        '<div class="vs">VS</div>' +
        '<div><div class="nm">' + esc(B.n) + '</div><div class="pp">' + B.pe + ' ' + esc(B.p) + '</div></div>' +
      '</div>' +
      '<div class="l-ring"><div class="num">' + c.score + '%</div><div class="lbl">' + c.label + '</div></div>' +
      '<div class="card" style="margin:14px 0;"><div class="chart-box" style="height:260px;"><canvas id="l-battle-radar"></canvas></div></div>' +
      '<div class="grid-3" style="margin-bottom:14px;">' +
        '<div class="card" style="margin:0;"><p class="l-h">🎤 shared artists (' + c.sharedArtistCount + ')</p>' + chips(c.sharedArtists, 'none. wow.') + '</div>' +
        '<div class="card" style="margin:0;"><p class="l-h">🎵 shared songs (' + c.sharedTrackCount + ')</p>' + chips(c.sharedTracks, 'zero overlap') + '</div>' +
        '<div class="card" style="margin:0;"><p class="l-h">🏷️ shared genres (' + c.sharedGenres.length + ')</p>' + chips(c.sharedGenres, 'nothing in common') + '</div>' +
      '</div>' +
      '<div class="grid-2" style="margin-bottom:14px;">' + topCol(A, B) + topCol(B, A) + '</div>' +
      '<div class="grid-2" style="margin-bottom:14px;">' +
        '<div class="card" style="margin:0;"><p class="l-h">obscurity</p>' + lBar(A, B, 'o') + '</div>' +
        '<div class="card" style="margin:0;"><p class="l-h">diversity</p>' + lBar(A, B, 'd') + '</div>' +
      '</div>' +
      '<div class="taste-sentence" style="font-size:1rem;">the aux goes to: <span class="hl">' + (c.aux ? esc(c.aux.n) : 'both of you') + '</span>' +
        '<div class="q-note" style="margin-top:6px;">' + c.auxWhy + '</div></div>' +
      '<p class="q-note" style="margin-top:12px;">xXx SparkleStats xXx &middot; aux battle</p>' +
    '</div>' +
    '<div class="q-actions"><button class="q-btn" onclick="lSaveNode(\'#l-battle-card\', \'sparklestats-aux-battle\', this)">save as image</button></div>';
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof mAward === 'function' && Q.screen !== 'pastyou') mAward('battle');
  requestAnimationFrame(() => {
    lChart('l-battle-radar', lRadarConfig([
      lMoodDataset(A.n, A.m, '#FF1493', 'rgba(255,20,147,0.18)'),
      lMoodDataset(B.n, B.m, '#8B00FF', 'rgba(139,0,255,0.18)'),
    ]));
  });
}

function lBar(mine, theirs, key) {
  const row = (name, v, col) =>
    '<div class="l-barrow"><span class="who">' + esc(name) + '</span>' +
    '<div class="bar"><div style="width:' + v + '%;background:' + col + ';"></div></div><span class="v">' + v + '</span></div>';
  return row(mine.n, mine[key], 'var(--pink)') + row(theirs.n, theirs[key] || 0, 'var(--purple)');
}

// from a ?battle= link on boot
function lOpenBattle(raw) {
  const theirs = lParseBattle(raw);
  if (!theirs) return false;
  openQuiz();
  lScreenBattle(raw);
  return true;
}

// ======================== MIX CD BUILDER ========================

function lCdLoad() {
  if (L.cd) return L.cd;
  try { L.cd = JSON.parse(localStorage.getItem('sparkle_cd') || 'null'); } catch { L.cd = null; }
  if (!L.cd || !Array.isArray(L.cd.slots)) L.cd = { title: (gPlayer() + '\'s mix'), slots: [] };
  return L.cd;
}

function lCdSave() {
  try { localStorage.setItem('sparkle_cd', JSON.stringify(L.cd)); } catch {}
}

function lCdTracks() {
  const t = _data.tracks;
  return qDedupe([...(t.short_term || []), ...(t.medium_term || []), ...(t.long_term || [])]);
}

function lScreenMixCD() {
  Q.screen = 'mixcd';
  qStopAudio(); qClearTimers();
  const cd = lCdLoad();
  const tracks = lCdTracks();
  const inCd = new Set(cd.slots.map(s => s.id));
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('💿 mix CD builder', '12 songs. make it count.') +
    '<div class="grid-2" style="max-width:900px;margin:0 auto;align-items:start;">' +
      '<div class="card" style="margin:0;">' +
        '<p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ your songs <span class="q-note" style="display:inline;">tap to add</span></p>' +
        '<div class="l-pick" id="l-pick">' +
          tracks.map(t =>
            '<button class="q-row" style="margin-bottom:3px;padding:5px 8px;' + (inCd.has(t.id) ? 'opacity:0.35;' : '') + '" onclick="lCdAdd(\'' + t.id + '\')" ' + (inCd.has(t.id) ? 'disabled' : '') + '>' +
              (qArt(t) ? '<img src="' + qArt(t) + '" alt="" style="width:34px;height:34px;">' : '<div class="ph" style="width:34px;height:34px;">🎵</div>') +
              '<div style="flex:1;overflow:hidden;"><div class="nm" style="font-size:0.8rem;">' + esc(qStrip(t.name)) + '</div><div class="mt">' + esc(qArtistNames(t)) + '</div></div>' +
              '<span style="color:var(--pink);font-weight:700;">+</span>' +
            '</button>'
          ).join('') +
        '</div>' +
      '</div>' +
      '<div>' +
        '<div class="q-typerow" style="margin-bottom:10px;"><input id="l-cd-title" class="q-input" value="' + esc(cd.title) + '" placeholder="name your mix..." maxlength="40" oninput="lCdTitle(this.value)"></div>' +
        '<div id="l-cd-wrap">' + lCdHtml() + '</div>' +
        '<div class="q-actions">' +
          '<button class="q-btn" onclick="lSaveNode(\'#l-cd\', \'sparklestats-mix-cd\', this)">save as image</button>' +
          '<button class="q-btn ghost" onclick="lCdCopy(this)">copy tracklist</button>' +
          '<button class="q-btn ghost" onclick="lCdClear()">start over</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function lCdHtml() {
  const cd = lCdLoad();
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const s = cd.slots[i];
    rows.push('<li class="l-slot' + (s ? '' : ' empty') + '">' +
      (s ? '<span class="t">' + esc(s.artist) + ' - ' + esc(s.name) + '</span>' +
           '<button class="x" onclick="lCdRemove(' + i + ')" title="remove">✕</button>'
         : '<span class="t">&mdash;</span>') +
      '</li>');
  }
  return '<div id="l-cd" class="l-cd">' +
    '<div class="cd-disc" style="width:110px;height:110px;margin-bottom:10px;"><div class="cd-hole"></div></div>' +
    '<div class="l-cd-title">' + esc(cd.title || 'untitled mix') + '</div>' +
    '<ol class="l-cd-list">' + rows.join('') + '</ol>' +
    '<div class="q-note" style="margin-top:8px;">' + cd.slots.length + '/12 &middot; burned ' + new Date().toLocaleDateString() + ' &middot; xXx SparkleStats xXx</div>' +
  '</div>';
}

function lCdAdd(id) {
  const cd = lCdLoad();
  if (cd.slots.length >= 12 || cd.slots.some(s => s.id === id)) return;
  const t = lCdTracks().find(x => x.id === id);
  if (!t) return;
  cd.slots.push({ id: t.id, name: qStrip(t.name), artist: gPrimary(t) });
  lCdSave();
  lScreenMixCD();
}

function lCdRemove(i) {
  const cd = lCdLoad();
  cd.slots.splice(i, 1);
  lCdSave();
  lScreenMixCD();
}

function lCdTitle(v) {
  lCdLoad().title = v;
  const el = document.querySelector('#l-cd .l-cd-title');
  if (el) el.textContent = v || 'untitled mix';
  lCdSave();
}

function lCdClear() {
  L.cd = { title: (gPlayer() + '\'s mix'), slots: [] };
  lCdSave();
  lScreenMixCD();
}

function lCdCopy(btn) {
  const cd = lCdLoad();
  const text = '💿 ' + cd.title + '\n' + cd.slots.map((s, i) => (i + 1) + '. ' + s.artist + ' - ' + s.name).join('\n') + '\n' + SITE_URL;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'copied 🩷';
    setTimeout(() => { btn.textContent = 'copy tracklist'; }, 2000);
  }).catch(() => { btn.textContent = 'couldn\'t copy :('; });
}

// ======================== EXPORTS ========================

window.lHubCards = lHubCards;
window.lSaveNode = lSaveNode;
window.lOpenDNA = lOpenDNA;
window.lRunDNA = lRunDNA;
window.lDNAtoQuiz = lDNAtoQuiz;
window.lScreenBattle = lScreenBattle;
window.lCopyBattle = lCopyBattle;
window.lBattleGo = lBattleGo;
window.lOpenBattle = lOpenBattle;
window.lScreenMixCD = lScreenMixCD;
window.lCdAdd = lCdAdd;
window.lCdRemove = lCdRemove;
window.lCdTitle = lCdTitle;
window.lCdClear = lCdClear;
window.lCdCopy = lCdCopy;
