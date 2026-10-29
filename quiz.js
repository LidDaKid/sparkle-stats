// ============================================================
//  xXx SparkleStats xXx  -  quiz.js
//  "guess the song" - audio guessing game
//  loaded after app.js, reuses its globals (getToken, esc, img, _data)
// ============================================================

const QUIZ_LEN = 10;          // default questions per game
const QUIZ_LENGTHS = [5, 10, 15, 20, 30, 50, 100];  // what the picker offers (+ "all" on the mode screen) - score always scales to QUIZ_MAX
const QUIZ_MAX = 1000;        // max score for a perfect game
const QUIZ_MIN_Q = 5;         // fewer playable songs than this = bail out
const TIME_MC = 25;           // seconds per multiple-choice question
const TIME_TYPE = 35;         // seconds per type-it question (typing is slower)
const REVEAL_MS = 4000;       // how long the answer reveal sits before auto-advance
const SEARCH_LIMIT = 10;      // spotify 400s on any /search limit above this now
const ITUNES = 'https://itunes.apple.com/search';

const Q = {
  screen: 'menu',
  source: null,      // { kind, id, name, image, sub }
  mode: 'mc',        // 'mc' | 'type'
  len: QUIZ_LEN,     // songs this round, chosen on the mode screen
  game: 'classic',   // classic | heardle | cover | hilo - the others live in games.js
  depth: 'hits',     // artist rounds: hits | mix | deep (which songs get drawn, see qBuildQuestions)
  skipped: 0,        // songs in the last round that had no playable clip
  pool: [],          // every candidate track we could ask about
  questions: [],     // [{ track, preview, choices }]
  index: 0,
  score: 0,
  results: [],       // [{ track, points, correct, guess }]
  perQ: 100,
  audio: null,
  tick: null,
  revealTimer: null,
  deadline: 0,
  duration: 0,
  locked: false,
  hintShown: false,
};

// ======================== TEXT HELPERS ========================

// strips "(Remastered 2011)", "- Radio Edit", "feat. X" etc so titles compare cleanly
function qStrip(name) {
  if (!name) return '';
  const junk = 'remaster|remix|mix|demo|rough|live|session|version|edit|mono|stereo|deluxe|bonus|anniversary|explicit|instrumental|acoustic|unplugged|karaoke|re-?record';
  let s = String(name);
  s = s.replace(new RegExp('\\s*[\\(\\[][^\\)\\]]*(' + junk + ')[^\\)\\]]*[\\)\\]]', 'gi'), '');
  s = s.replace(new RegExp('\\s+-\\s+[^-]*(' + junk + ')[^-]*$', 'i'), '');
  s = s.replace(/\s*[\(\[]\s*(feat|ft|featuring|with)\b[^\)\]]*[\)\]]/gi, '');
  s = s.replace(/\s+(feat|ft)\.?\s+.*$/i, '');
  return s.trim() || String(name).trim();
}

// NFD splits accents off their letters, then the a-z filter below drops them,
// so "Beyonce" and "Beyoncé" compare equal
function qNorm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')   // dont -> dont, not "don t"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(the|a|an)\s+/, '');
}

function qLev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// typo-tolerant: roughly 1 mistake allowed per 6 characters
function qMatches(guess, answer) {
  const g = qNorm(qStrip(guess));
  if (!g) return false;
  for (const a of [qNorm(qStrip(answer)), qNorm(answer)]) {
    if (!a) continue;
    if (g === a) return true;
    const tol = a.length <= 6 ? 1 : Math.floor(a.length / 6);
    if (qLev(g, a) <= tol) return true;
  }
  return false;
}

function qMask(name, revealFirst) {
  return qStrip(name).split(/(\s+)/).map(word => {
    if (/^\s+$/.test(word)) return '  ';
    let first = true;
    return word.split('').map(ch => {
      if (!/[a-z0-9]/i.test(ch)) return ch;
      if (first) { first = false; return revealFirst ? ch.toUpperCase() : '_'; }
      return '_';
    }).join('');
  }).join('');
}

function qShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function qArtistNames(track) {
  return (track.artists || []).map(a => a.name).join(', ');
}

function qArt(track) {
  return img(track.album?.images, 'md') || '';
}

// ======================== SPOTIFY FETCH ========================

// like apiFetch but keeps the status code so we can tell 403/404 apart
async function qFetch(path) {
  const token = await getToken();
  if (!token) throw new Error('not connected to spotify anymore - refresh the page');
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '1');
    await new Promise(r => setTimeout(r, retry * 1000));
    return qFetch(path);
  }
  if (!res.ok) {
    const err = new Error('spotify said no (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function qMarket() {
  return (typeof _data !== 'undefined' && _data?.user?.country) || 'US';
}

function qHasPlaylistScope() {
  try {
    const t = JSON.parse(localStorage.getItem('sp_tokens') || '{}');
    return typeof t.scope === 'string' && t.scope.includes('playlist-read-private');
  } catch { return false; }
}

// song count moved from .tracks.total to .items.total; null = spotify didn't say
function qPlaylistCount(p) {
  const n = p?.items?.total ?? p?.tracks?.total;
  return typeof n === 'number' ? n : null;
}

function qDedupe(tracks) {
  const seen = new Set();
  const out = [];
  for (const t of tracks) {
    if (!t || !t.id || !t.name) continue;
    const key = qNorm(qStrip(t.name)) + '|' + qNorm((t.artists || [])[0]?.name || '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// alternate versions we never quiz on or play a clip of: live cuts, demos, remixes,
// acoustic takes, filler. "live" only counts when it reads like a version tag -
// "(Live)", "- Live at...", "Live from..." - so "Live Forever" stays a song.
const NOT_A_SONG = /\b(demo|remix|acoustic|unplugged|instrumental|karaoke|rehearsal|interlude|intro|outro|commentary|skit|tribute|rough mix)\b|[\(\[\-–]\s*(?:[^)\]]*\s)?live\b|\blive\s+(at|from|in|on|version|session|recording|acoustic)\b/i;
function qIsAlt(s) { return NOT_A_SONG.test(String(s || '')); }

// Spotify blocked /artists/{id}/top-tracks (403), so an artist's songs get
// assembled from their albums instead, widened with a few pages of search.
async function qPoolFromArtist(artist) {
  const market = qMarket();
  const errors = [];

  // 1. paged search - full track objects, most recognisable songs first.
  //    tagged priority 0 so the game asks these before the deep cuts.
  const pages = await Promise.all([0, 1, 2].map(i =>
    qFetch('/search?q=' + encodeURIComponent('artist:"' + artist.name + '"') +
      '&type=track&limit=' + SEARCH_LIMIT + '&offset=' + (i * SEARCH_LIMIT) + '&market=' + market)
      .catch(e => { errors.push('search: ' + e.message); return null; })
  ));
  const fromSearch = pages.flatMap(p => p?.tracks?.items || [])
    .filter(t => t && !qIsAlt(t.name) && !qIsAlt(t.album?.name))
    .map(t => ({ ...t, _priority: 0 }));

  // 2. album tracks for the deep cuts. these come back "simplified" with no
  //    album attached, so staple the album on ourselves to keep the artwork.
  let fromAlbums = [];
  try {
    const albums = await qFetch('/artists/' + artist.id +
      '/albums?include_groups=album,single&limit=' + SEARCH_LIMIT + '&market=' + market);
    const lists = await Promise.all((albums.items || []).filter(al => !qIsAlt(al.name)).slice(0, 8).map(al =>
      qFetch('/albums/' + al.id + '/tracks?limit=50&market=' + market)
        .then(r => (r.items || []).map(t => ({ ...t, album: al, _priority: 1 })))
        .catch(() => [])
    ));
    fromAlbums = lists.flat().filter(t => !qIsAlt(t.name));
  } catch (e) {
    errors.push('albums: ' + e.message);
  }

  // searching a name drags in other artists - keep only real matches.
  // search hits go first so dedupe keeps the studio cut over "- 2025 Mix".
  const all = [...fromSearch, ...fromAlbums].filter(t => t?.artists?.some(a => a.id === artist.id));
  if (!all.length && errors.length) throw new Error(errors[0]);
  return qDedupe(all);
}

async function qPoolFromPlaylist(id) {
  const market = qMarket();
  const out = [];
  let total = 0;
  // up to 1000 songs (10 pages) so a huge playlist doesn't just replay its first few hundred
  for (let offset = 0; offset < 1000; offset += 100) {
    // /tracks is 403 now - the endpoint is /items, and each row calls the
    // song "item" rather than "track"
    const res = await qFetch('/playlists/' + id + '/items?limit=100&offset=' + offset + '&market=' + market);
    const rows = res.items || [];
    total = res.total || 0;
    out.push(...rows.filter(r => r && !r.is_local).map(r => r.item || r.track));
    if (rows.length < 100 || out.length >= total) break;
  }
  return qDedupe(out.filter(t => t && t.id && t.type === 'track'));
}

function qPoolFromTop() {
  const t = _data?.tracks || {};
  return qDedupe([...(t.short_term || []), ...(t.medium_term || []), ...(t.long_term || [])]);
}

function qParsePlaylistId(input) {
  const s = String(input || '').trim();
  const m = s.match(/playlist[/:]([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{15,}$/.test(s)) return s;
  return null;
}

// ======================== APPLE PREVIEW LOOKUP ========================
// spotify stopped handing out 30-sec preview clips to newer apps,
// so we match the track on apple's free search api and use theirs.

const qPreviewCache = new Map();

async function qFindPreview(track) {
  if (qPreviewCache.has(track.id)) return qPreviewCache.get(track.id);
  const artist = (track.artists || [])[0]?.name || '';
  const term = (artist + ' ' + qStrip(track.name)).trim();
  const wantName = qNorm(qStrip(track.name));
  const wantArtist = qNorm(artist);
  // is the spotify track itself a live/alt cut? then we want the matching alt clip
  const spotAlt = qIsAlt(track.name) || qIsAlt(track.album?.name);

  // one apple query, ranked: right artist + right title required, then studio-for-studio
  // (or live-for-live) dominates, then exactness. null when nothing usable came back.
  const lookup = async (query) => {
    const res = await fetch(ITUNES + '?' + query + '&entity=song&limit=25');
    if (!res.ok) return null;
    const data = await res.json();
    const scored = (data.results || []).filter(r => r.previewUrl).map(r => {
      const name = qNorm(qStrip(r.trackName));
      const art = qNorm(r.artistName);
      const artistOk = !!art && (art === wantArtist || art.includes(wantArtist) || wantArtist.includes(art));
      const titleOk = name === wantName || qMatches(r.trackName, track.name);
      if (!artistOk || !titleOk) return null;
      const alt = qIsAlt(r.trackName) || qIsAlt(r.collectionName);
      let s = 0;
      if (alt === spotAlt) s += 4;
      if (name === wantName) s += 2;
      if (art === wantArtist) s += 1;
      if (r.isStreamable) s += 0.5;
      return { r, s, alt };
    }).filter(Boolean).sort((a, b) => b.s - a.s);
    return scored[0] || null;
  };

  let url = null;
  try {
    // 25 not 10: apple's top results are often live cuts and lullaby covers, the studio take sits lower
    let best = await lookup('term=' + encodeURIComponent(term));
    // a studio song that only turned up live/alt clips: retry by title alone - the original
    // usually ranks first there, and the artist check above keeps the cover bands out
    if (!spotAlt && (!best || best.alt)) {
      const retry = await lookup('term=' + encodeURIComponent(qStrip(track.name)) + '&attribute=songTerm');
      if (retry && !retry.alt) best = retry;
    }
    // no confident match, or only a live/alt clip for a studio song -> skip it rather than play the wrong thing
    url = (best && (spotAlt || !best.alt)) ? best.r.previewUrl : null;
  } catch { url = null; }
  qPreviewCache.set(track.id, url);
  return url;
}

async function qBuildQuestions(pool, onProgress) {
  // artist pools carry two tiers (0 = search hits, 1 = album deep cuts). Q.depth picks
  // how they're drawn: hits first (default), everything mixed, or deep cuts first.
  // playlists and top songs have no tiers, so those are always a plain shuffle.
  const tiers = {};
  for (const t of pool) (tiers[t._priority || 0] = tiers[t._priority || 0] || []).push(t);
  const keys = Object.keys(tiers).sort((a, b) => a - b);
  let shuffled;
  if (keys.length < 2 || Q.depth === 'mix') shuffled = qShuffle(pool);
  else if (Q.depth === 'deep') shuffled = keys.slice().reverse().flatMap(k => qShuffle(tiers[k]));
  else shuffled = keys.flatMap(k => qShuffle(tiers[k]));
  Q.skipped = 0;
  const picked = [];
  const usedNames = new Set();
  let i = 0;
  while (picked.length < Q.len && i < shuffled.length) {
    const batch = [];
    while (batch.length < 4 && i < shuffled.length) {
      const t = shuffled[i++];
      if (qIsAlt(t.name)) continue;          // no live cuts / demos in a round, even from playlists
      const key = qNorm(qStrip(t.name));
      if (usedNames.has(key)) continue;
      usedNames.add(key);
      batch.push(t);
    }
    if (!batch.length) break;
    const settled = await Promise.all(batch.map(async t => ({ t, url: await qFindPreview(t) })));
    for (const r of settled) {
      if (r.url && picked.length < Q.len) picked.push({ track: r.t, preview: r.url });
      else if (!r.url) Q.skipped++;          // apple has no clean clip for it - it never gets asked
    }
    onProgress(picked.length);
  }
  return picked;
}

function qMakeChoices(answer, pool) {
  const answerKey = qNorm(qStrip(answer.name));
  const others = qShuffle(pool.filter(t => qNorm(qStrip(t.name)) !== answerKey));
  const decoys = [];
  const used = new Set([answerKey]);
  for (const t of others) {
    const k = qNorm(qStrip(t.name));
    if (used.has(k)) continue;
    used.add(k);
    decoys.push(t);
    if (decoys.length === 3) break;
  }
  return qShuffle([answer, ...decoys]);
}

// ======================== SCREEN PLUMBING ========================

function qSet(html) {
  document.getElementById('game').innerHTML = html;
}

function qStopAudio() {
  if (Q.audio) { Q.audio.pause(); Q.audio.src = ''; }
}

function qClearTimers() {
  if (Q.tick) { clearInterval(Q.tick); Q.tick = null; }
  if (Q.revealTimer) { clearTimeout(Q.revealTimer); Q.revealTimer = null; }
}

function qTopBar(label, onclick) {
  return '<div class="q-topbar"><button class="q-back" onclick="' + onclick + '">' + label + '</button></div>';
}

function qHeader(title, sub) {
  return '<div class="q-head"><h1>' + title + '</h1>' +
    (sub ? '<p>' + sub + '</p>' : '') +
    '<div class="deco">' + String.fromCharCode(9733) + ' x ' + String.fromCharCode(9733) + ' x ' + String.fromCharCode(9733) + '</div></div>';
}

function qErrorBox(msg) {
  return '<div class="q-err">' + msg + '</div>';
}

// ======================== SCREEN: MENU ========================

function qScreenMenu() {
  Q.screen = 'menu';
  qStopAudio();
  qClearTimers();
  qSet(
    qTopBar('&larr; arcade', (typeof gScreenHub === 'function' ? 'gScreenHub()' : 'closeQuiz()')) +
    qHeader((() => {
              const m = (typeof GAMES !== 'undefined' && GAMES[Q.game]) || (typeof LABS !== 'undefined' && LABS[Q.game]);
              return m ? m.emoji + ' ' + m.name : 'guess the song';
            })(),
            Q.game === 'dna' ? 'pick something to sequence' : 'your ears vs ' + QUIZ_MAX + ' points') +
    '<p class="q-note" style="margin-bottom:20px;">pick what you wanna get quizzed on</p>' +
    '<div class="q-sources">' +
      '<button class="q-src" onclick="qGo(\'artist\')"' +
        (Q.game === 'cover' ? ' disabled style="opacity:0.35;cursor:default;" title="cover art needs a mix of artists - try a playlist"'
          : (typeof mSourceDisabled === 'function' && mSourceDisabled('artist')) ? ' disabled style="opacity:0.35;cursor:default;"' : '') + '>' +
        '<span class="ico">🎤</span><span class="lbl">an artist</span>' +
        '<span class="sub">search anyone on spotify</span></button>' +
      '<button class="q-src" onclick="qGo(\'mine\')"' + ((typeof mSourceDisabled === 'function' && mSourceDisabled('mine')) ? ' disabled style="opacity:0.35;cursor:default;" title="this one needs a single artist"' : '') + '>' +
        '<span class="ico">💿</span><span class="lbl">your playlists</span>' +
        '<span class="sub">anything you made or saved</span></button>' +
      '<button class="q-src" onclick="qGo(\'link\')"' + ((typeof mSourceDisabled === 'function' && mSourceDisabled('link')) ? ' disabled style="opacity:0.35;cursor:default;" title="this one needs a single artist"' : '') + '>' +
        '<span class="ico">🔗</span><span class="lbl">a playlist link</span>' +
        '<span class="sub">paste any spotify playlist</span></button>' +
      '<button class="q-src" onclick="qGo(\'top\')"' + ((typeof mSourceDisabled === 'function' && mSourceDisabled('top')) ? ' disabled style="opacity:0.35;cursor:default;" title="this one needs a single artist"' : '') + '>' +
        '<span class="ico">⭐</span><span class="lbl">your top songs</span>' +
        '<span class="sub">no excuses, you listen to these</span></button>' +
    '</div>'
  );
}

// ======================== SCREEN: PICK AN ARTIST ========================

function qScreenArtist() {
  Q.screen = 'artist';
  qSet(
    qTopBar('&larr; back', 'qScreenMenu()') +
    qHeader('pick an artist', 'who are we testing you on') +
    '<div style="max-width:480px;margin:0 auto;">' +
      '<div class="q-typerow">' +
        '<input id="q-artist-input" class="q-input" placeholder="type an artist name..." autocomplete="off">' +
        '<button class="q-btn" onclick="qSearchArtist()">go</button>' +
      '</div>' +
      '<div id="q-artist-results" style="margin-top:14px;"></div>' +
    '</div>'
  );
  const inp = document.getElementById('q-artist-input');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') qSearchArtist(); });
}

async function qSearchArtist() {
  const term = document.getElementById('q-artist-input').value.trim();
  const box = document.getElementById('q-artist-results');
  if (!term) return;
  box.innerHTML = '<p class="q-note">searching...</p>';
  try {
    const res = await qFetch('/search?q=' + encodeURIComponent(term) + '&type=artist&limit=' + SEARCH_LIMIT + '&market=' + qMarket());
    const artists = res.artists?.items || [];
    if (!artists.length) {
      box.innerHTML = qErrorBox('no artist by that name. check the spelling?');
      return;
    }
    qArtistHits = artists;
    box.innerHTML = artists.map((a, i) =>
      '<button class="q-row" onclick="qPickArtist(' + i + ')">' +
        (a.images?.length
          ? '<img src="' + img(a.images, 'sm') + '" alt="">'
          : '<div class="ph">🎸</div>') +
        '<div style="flex:1;overflow:hidden;">' +
          '<div class="nm">' + esc(a.name) + '</div>' +
          '<div class="mt">' + esc((a.genres || []).slice(0, 2).join(', ') || 'artist') + '</div>' +
        '</div>' +
      '</button>'
    ).join('');
  } catch (e) {
    box.innerHTML = qErrorBox(esc(e.message));
  }
}

let qArtistHits = [];

async function qPickArtist(i) {
  const a = qArtistHits[i];
  if (!a) return;
  Q.source = { kind: 'artist', id: a.id, name: a.name, image: img(a.images, 'md'), sub: 'artist' };
  await qLoadPool(() => qPoolFromArtist(a));
}

// ======================== SCREEN: YOUR PLAYLISTS ========================

let qMyPlaylists = [];

async function qScreenMine() {
  Q.screen = 'mine';
  qSet(
    qTopBar('&larr; back', 'qScreenMenu()') +
    qHeader('your playlists', 'pick one to get grilled on') +
    '<div id="q-mine-box" style="max-width:520px;margin:0 auto;"><p class="q-note">loading your playlists...</p></div>'
  );
  const box = document.getElementById('q-mine-box');
  try {
    const res = await qFetch('/me/playlists?limit=50');
    // spotify renamed the song count from .tracks.total to .items.total - read
    // both, and keep the playlist if it won't tell us at all
    qMyPlaylists = (res.items || []).filter(p => {
      const n = qPlaylistCount(p);
      return p && (n === null || n >= QUIZ_MIN_Q);
    });
    if (!qMyPlaylists.length) {
      box.innerHTML = qErrorBox('couldnt find any playlists with at least ' + QUIZ_MIN_Q + ' songs.' +
        (qHasPlaylistScope() ? '' : '<br><br>you connected before this feature existed so we cant see your private ones yet.') ) +
        (qHasPlaylistScope() ? '' : '<div class="q-actions"><button class="q-btn" onclick="login()">reconnect spotify</button></div>');
      return;
    }
    box.innerHTML =
      (qHasPlaylistScope() ? '' :
        '<div class="q-err" style="margin-bottom:14px;">only showing your <b>public</b> playlists rn. ' +
        'reconnect to unlock the private ones too.' +
        '<div class="q-actions" style="margin-top:12px;"><button class="q-btn ghost" onclick="login()">reconnect spotify</button></div></div>') +
      qMyPlaylists.map((p, i) =>
        '<button class="q-row" onclick="qPickMine(' + i + ')">' +
          (p.images?.length
            ? '<img src="' + img(p.images, 'sm') + '" alt="">'
            : '<div class="ph">💿</div>') +
          '<div style="flex:1;overflow:hidden;">' +
            '<div class="nm">' + esc(p.name) + '</div>' +
            '<div class="mt">' + (qPlaylistCount(p) === null ? '' : qPlaylistCount(p) + ' songs &middot; ') +
              'by ' + esc(p.owner?.display_name || 'you') + '</div>' +
          '</div>' +
        '</button>'
      ).join('');
  } catch (e) {
    box.innerHTML = qErrorBox(
      e.status === 403
        ? 'spotify wont let us read your playlists with the old login.<br>hit reconnect and it should work.'
        : esc(e.message)
    ) + '<div class="q-actions"><button class="q-btn" onclick="login()">reconnect spotify</button></div>';
  }
}

async function qPickMine(i) {
  const p = qMyPlaylists[i];
  if (!p) return;
  const n = qPlaylistCount(p);
  Q.source = { kind: 'playlist', id: p.id, name: p.name, image: img(p.images, 'md'), sub: (n === null ? 'playlist' : n + ' songs') };
  await qLoadPool(() => qPoolFromPlaylist(p.id));
}

// ======================== SCREEN: PLAYLIST LINK ========================

function qScreenLink() {
  Q.screen = 'link';
  qSet(
    qTopBar('&larr; back', 'qScreenMenu()') +
    qHeader('paste a playlist', 'any playlist a person made') +
    '<div style="max-width:520px;margin:0 auto;">' +
      '<div class="q-typerow">' +
        '<input id="q-link-input" class="q-input" placeholder="https://open.spotify.com/playlist/..." autocomplete="off">' +
        '<button class="q-btn" onclick="qUseLink()">go</button>' +
      '</div>' +
      '<p class="q-note" style="margin-top:12px;">heads up: spotify blocks their own auto-made playlists ' +
      '(discover weekly, release radar, the "this is ___" ones) from apps like this. ' +
      'playlists made by actual people work fine.</p>' +
      '<div id="q-link-msg" style="margin-top:14px;"></div>' +
    '</div>'
  );
  const inp = document.getElementById('q-link-input');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') qUseLink(); });
}

async function qUseLink() {
  const raw = document.getElementById('q-link-input').value;
  const msg = document.getElementById('q-link-msg');
  const id = qParsePlaylistId(raw);
  if (!id) {
    msg.innerHTML = qErrorBox('that doesnt look like a playlist link. it should have /playlist/ in it.');
    return;
  }
  msg.innerHTML = '<p class="q-note">loading...</p>';
  try {
    const p = await qFetch('/playlists/' + id);
    const n = qPlaylistCount(p);
    Q.source = { kind: 'playlist', id: p.id, name: p.name, image: img(p.images, 'md'), sub: (n === null ? 'playlist' : n + ' songs') };
    await qLoadPool(() => qPoolFromPlaylist(p.id));
  } catch (e) {
    msg.innerHTML = qErrorBox(
      e.status === 404
        ? 'cant open that one. if its a spotify-made playlist (discover weekly, "this is ___", etc) they blocked those from apps. try one a real person made.'
        : esc(e.message)
    );
  }
}

// ======================== POOL LOADING ========================

async function qLoadPool(fetcher) {
  Q.screen = 'pool';
  qSet(
    '<div class="q-loadwrap"><div class="spinner">💿</div>' +
    '<p>digging through ' + esc(Q.source.name) + '...</p></div>'
  );
  try {
    const pool = await fetcher();
    if (pool.length < QUIZ_MIN_Q) {
      qSet(
        qTopBar('&larr; back', 'qScreenMenu()') +
        qHeader('not enough songs', '') +
        qErrorBox('only found ' + pool.length + ' usable song' + (pool.length === 1 ? '' : 's') +
          ' there. need at least ' + QUIZ_MIN_Q + ' to make a game. try something bigger?')
      );
      return;
    }
    Q.pool = pool;
    qScreenMode();
  } catch (e) {
    qSet(
      qTopBar('&larr; back', 'qScreenMenu()') +
      qHeader('that didnt work', '') +
      qErrorBox(esc(e.message))
    );
  }
}

// ======================== SCREEN: MODE PICKER ========================

function qScreenMode() {
  // playlist DNA borrows the source picker, then goes to analysis instead of a game
  if (Q.game === 'dna' && typeof lRunDNA === 'function') { lRunDNA(); return; }
  // versus swaps the mode screen for a two-player setup screen
  if (Q.game === 'versus' && typeof vScreenSetup === 'function') { vScreenSetup(); return; }
  // the roast borrows the source picker too, then goes to judgement
  if (Q.game === 'roast' && typeof mRunRoast === 'function') { mRunRoast(); return; }
  Q.screen = 'mode';
  const s = Q.source;
  // restore the last length they picked, then step it down until this pool can cover it
  let all = false;
  try {
    const raw = localStorage.getItem('quiz_len');
    const saved = parseInt(raw);
    if (raw === 'all') all = true;
    else if (QUIZ_LENGTHS.includes(saved)) Q.len = saved;
  } catch {}
  if (all) Q.len = Q.pool.length;
  else if (Q.len > Q.pool.length) Q.len = QUIZ_LENGTHS.filter(n => n <= Q.pool.length).pop() || QUIZ_LENGTHS[0];
  qSet(
    qTopBar('&larr; pick something else', 'qScreenMenu()') +
    qHeader('how hard do you want it', '') +
    '<div class="q-chosen">' +
      (s.image ? '<img src="' + s.image + '" alt="">' : '<div class="ph">🎵</div>') +
      '<div style="text-align:left;"><div class="nm">' + esc(s.name) + '</div>' +
      '<div class="mt">' + esc(s.sub) + ' &middot; ' + Q.pool.length + ' songs in the pool</div></div>' +
    '</div>' +
    ((typeof mFixedLen === 'function' && mFixedLen()) ? '' :
    '<p class="q-note" style="margin-bottom:8px;">how many songs</p>' +
    '<div class="tabs" id="q-len-tabs">' +
      QUIZ_LENGTHS.map(n =>
        '<button class="' + (!all && n === Q.len ? 'active' : '') + '"' +
        (n > Q.pool.length ? ' disabled title="not enough songs in here for that"' : '') +
        ' onclick="qSetLen(' + n + ')">' + n + '</button>'
      ).join('') +
      '<button class="' + (all ? 'active' : '') + '" onclick="qSetLen(\'all\')">all ' + Q.pool.length + '</button>' +
    '</div>') +
    // artist pools: choose between the hits, the deep cuts, or a mix of both
    (Q.pool.some(t => t._priority === 1)
      ? '<p class="q-note" style="margin:14px 0 8px;">which songs</p>' +
        '<div class="tabs" id="q-depth-tabs">' +
          [['hits', 'the hits ⭐'], ['mix', 'a mix 🎲'], ['deep', 'deep cuts 🕳️']].map(([k, l]) =>
            '<button class="' + (Q.depth === k ? 'active' : '') + '" onclick="qSetDepth(\'' + k + '\')">' + l + '</button>'
          ).join('') +
        '</div>'
      : '') +
    ((Q.game === 'hilo' || (typeof mSingleStart === 'function' && mSingleStart()))
      // higher-or-lower has no answer style to pick - just go
      ? '<div class="q-actions" style="margin-top:4px;"><button class="q-btn" onclick="qStart(\'mc\')">start &rarr;</button></div>'
      : (() => {
          const sub = (typeof gModeSubs === 'function') ? gModeSubs() : {
            mc: '4 options, ' + TIME_MC + ' sec each<br>the chill one',
            type: 'no options, ' + TIME_TYPE + ' sec each<br>typos are forgiven',
          };
          return '<div class="q-modes">' +
            '<button class="q-src" onclick="qStart(\'mc\')">' +
              '<span class="ico">🅰️</span><span class="lbl">multiple choice</span>' +
              '<span class="sub">' + sub.mc + '</span></button>' +
            '<button class="q-src" onclick="qStart(\'type\')">' +
              '<span class="ico">⌨️</span><span class="lbl">type it out</span>' +
              '<span class="sub">' + sub.type + '</span></button>' +
          '</div>';
        })()) +
    ((typeof mModeNote === 'function' && mModeNote()) ||
    ('<p class="q-note" style="margin-top:20px;">' + Q.len + ' songs &middot; up to ' + QUIZ_MAX + ' points<br>' +
    (Q.game === 'heardle' ? 'fewer seconds = more points' : 'answer faster = more points') + '</p>'))
  );
}

function qSetLen(n) {
  if (n !== 'all' && (!QUIZ_LENGTHS.includes(n) || n > Q.pool.length)) return;
  Q.len = n === 'all' ? Q.pool.length : n;
  try { localStorage.setItem('quiz_len', String(n)); } catch {}
  qScreenMode();
}

// ======================== GAME START ========================

async function qStart(mode) {
  Q.mode = mode;
  Q.screen = 'building';
  Q.index = 0;
  Q.score = 0;
  Q.results = [];

  qSet(
    '<div class="q-loadwrap"><div class="spinner">💿</div>' +
    '<p id="q-load-text">finding songs you can actually hear...</p>' +
    '<div class="q-loadbar"><div id="q-load-fill"></div></div>' +
    '<p class="q-note" style="margin-top:14px;">grabbing clips, this takes a sec</p></div>'
  );

  const fill = document.getElementById('q-load-fill');
  // cover art and higher-or-lower don't need audio, so they build instantly;
  // classic and heardle go find clips
  let questions;
  if (typeof mBuildsGame === 'function' && mBuildsGame(Q.game)) {
    questions = await mBuildQuestions(Q.pool, n => {
      if (fill) fill.style.width = Math.min(100, (n / Q.len) * 100) + '%';
    });
  } else if (Q.game === 'cover' && typeof gBuildCoverQuestions === 'function') {
    questions = gBuildCoverQuestions(Q.pool);
  } else if (Q.game === 'hilo' && typeof gBuildHiloQuestions === 'function') {
    questions = gBuildHiloQuestions(Q.pool);
  } else {
    questions = await qBuildQuestions(Q.pool, n => {
      if (fill) fill.style.width = Math.min(100, (n / Q.len) * 100) + '%';
    });
  }

  if (questions.length < QUIZ_MIN_Q) {
    const why = Q.game === 'cover'
      ? 'cover art needs a mix of different artists and this is mostly one. try a playlist or your top songs.'
      : Q.game === 'hilo'
      ? 'not enough songs with release dates in here to make ' + QUIZ_MIN_Q + ' fair matchups.'
      : 'only found ' + questions.length + ' song' + (questions.length === 1 ? '' : 's') +
        ' with a playable clip in there. that usually means the music is pretty obscure or not on apple music. ' +
        'try a different artist or playlist?';
    qSet(qTopBar('&larr; back', 'qScreenMenu()') + qHeader('couldnt build a round', '') + qErrorBox((typeof mWhyTooFew === 'function' && mWhyTooFew()) || why));
    return;
  }

  Q.questions = questions.map(q => ({
    ...q,
    choices: q.choices !== undefined ? q.choices : (Q.mode === 'mc' && Q.game !== 'hilo' ? qMakeChoices(q.track, Q.pool) : null),
  }));
  Q.perQ = QUIZ_MAX / Q.questions.length;
  qRenderQuestion();
}

// ======================== SCREEN: QUESTION ========================

function qRenderQuestion() {
  // heardle / cover / higher-or-lower draw their own question screens
  if (typeof gRenderQuestion === 'function' && gRenderQuestion()) return;
  Q.screen = 'play';
  Q.locked = false;
  Q.hintShown = false;
  qClearTimers();

  const q = Q.questions[Q.index];
  const total = Q.mode === 'mc' ? TIME_MC : TIME_TYPE;
  Q.duration = total;
  Q.deadline = Date.now() + total * 1000;

  const body = Q.mode === 'mc'
    ? '<div class="q-choices">' + q.choices.map((c, i) =>
        '<button class="q-choice" id="q-c' + i + '" onclick="qAnswerChoice(' + i + ')">' + esc(qStrip(c.name)) + '</button>'
      ).join('') + '</div>'
    : '<div class="q-typewrap">' +
        '<div class="q-hint" id="q-hint">' + esc(qMask(q.track.name, false)) + '</div>' +
        '<div class="q-typerow">' +
          '<input id="q-type-input" class="q-input" placeholder="name that song..." autocomplete="off" autocorrect="off" spellcheck="false">' +
          '<button class="q-btn" onclick="qAnswerTyped()">lock it in</button>' +
        '</div>' +
      '</div>';

  qSet(
    '<div class="q-hud">' +
      '<span class="qn">song ' + (Q.index + 1) + ' of ' + Q.questions.length + '</span>' +
      '<span class="sc">' + Math.round(Q.score) + ' pts</span>' +
    '</div>' +
    '<div class="q-timerbar"><div class="q-timerfill" id="q-timer"></div></div>' +
    '<div class="q-player">' +
      '<div class="q-bars on" id="q-bars">' + '<i></i>'.repeat(7) + '</div>' +
      '<div class="q-disc spinning" id="q-disc" onclick="qReplay()"><div class="hole"></div></div>' +
      '<button class="q-replay" onclick="qReplay()">↻ play again</button>' +
      '<p class="q-note" style="margin-top:8px;">' +
        (Q.mode === 'mc' ? 'which one is this?' : 'type the song name') +
      '</p>' +
    '</div>' +
    body +
    '<div class="q-actions"><button class="q-btn ghost" id="q-giveup" onclick="qGiveUp()">i give up</button></div>' +
    '<div id="q-reveal"></div>'
  );

  if (Q.mode === 'type') {
    const inp = document.getElementById('q-type-input');
    inp.focus();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') qAnswerTyped(); });
  }

  qPlayClip(q.preview);
  Q.tick = setInterval(qTickTimer, 100);
}

function qPlayClip(url) {
  if (!Q.audio) {
    Q.audio = new Audio();
    Q.audio.preload = 'auto';
  }
  Q.audio.src = url;
  Q.audio.currentTime = 0;
  Q.audio.volume = 0.8;
  const p = Q.audio.play();
  if (p && p.catch) {
    p.catch(() => {
      // browser blocked autoplay - tell them to tap the record
      const disc = document.getElementById('q-disc');
      if (disc) {
        disc.classList.remove('spinning');
        disc.innerHTML = '<div class="hole"></div><span class="mark">▶</span>';
      }
    });
  }
}

function qReplay() {
  const q = Q.questions[Q.index];
  if (!q) return;
  const disc = document.getElementById('q-disc');
  if (disc) { disc.classList.add('spinning'); disc.innerHTML = '<div class="hole"></div>'; }
  qPlayClip(q.preview);
}

function qTickTimer() {
  const left = Math.max(0, Q.deadline - Date.now()) / 1000;
  const bar = document.getElementById('q-timer');
  if (bar) {
    bar.style.width = (left / Q.duration) * 100 + '%';
    bar.classList.toggle('low', left <= Q.duration * 0.3);
  }
  // halfway through type-it mode, hand out the first letters
  if (Q.mode === 'type' && !Q.hintShown && left <= Q.duration * 0.5) {
    Q.hintShown = true;
    const hint = document.getElementById('q-hint');
    if (hint) hint.textContent = qMask(Q.questions[Q.index].track.name, true);
  }
  if (left <= 0 && !Q.locked) {
    qLockAnswerUI(-1);
    qFinishQuestion(false, null, 'timeout');
  }
}

function qTimeLeft() {
  return Math.max(0, Q.deadline - Date.now()) / 1000;
}

// ======================== ANSWERING ========================

function qIsAnswer(choice, track) {
  return choice.id === track.id || qNorm(qStrip(choice.name)) === qNorm(qStrip(track.name));
}

// freeze the answer UI: always show which one was right.
// pickedIdx is -1 when they ran out of time or gave up.
function qLockAnswerUI(pickedIdx) {
  const q = Q.questions[Q.index];
  if (Q.mode === 'mc' && q.choices) {
    q.choices.forEach((c, j) => {
      const el = document.getElementById('q-c' + j);
      if (!el) return;
      el.disabled = true;
      if (qIsAnswer(c, q.track)) el.classList.add('right');
      else if (j === pickedIdx) el.classList.add('wrong');
      else el.classList.add('faded');
    });
  } else {
    const inp = document.getElementById('q-type-input');
    if (inp) inp.disabled = true;
  }
  const gu = document.getElementById('q-giveup');
  if (gu) gu.style.display = 'none';
}

function qAnswerChoice(i) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const picked = q.choices[i];
  const correct = qIsAnswer(picked, q.track);
  qLockAnswerUI(i);
  qFinishQuestion(correct, picked.name);
}

function qAnswerTyped() {
  if (Q.locked) return;
  const inp = document.getElementById('q-type-input');
  const guess = inp ? inp.value : '';
  if (!guess.trim()) return;
  const correct = qMatches(guess, Q.questions[Q.index].track.name);
  qLockAnswerUI(-1);
  qFinishQuestion(correct, guess);
}

function qGiveUp() {
  if (Q.locked) return;
  qLockAnswerUI(-1);
  qFinishQuestion(false, null, 'gaveup');
}

// pointsOverride lets a game mode (heardle) supply its own score for a correct answer
function qFinishQuestion(correct, guess, reason, pointsOverride) {
  if (Q.locked) return;
  Q.locked = true;
  const left = qTimeLeft();
  qClearTimers();
  qStopAudio();

  const bars = document.getElementById('q-bars');
  if (bars) bars.classList.remove('on');
  const disc = document.getElementById('q-disc');
  if (disc) disc.classList.remove('spinning');

  // half the points for being right, half for being quick
  const points = !correct ? 0
    : (pointsOverride != null) ? Math.round(pointsOverride)
    : Math.round(Q.perQ * (0.5 + 0.5 * (left / Q.duration)));
  Q.score += points;

  const q = Q.questions[Q.index];
  Q.results.push({ track: q.track, points, correct, guess });

  const hud = document.querySelector('.q-hud .sc');
  if (hud) hud.textContent = Math.round(Q.score) + ' pts';

  const last = Q.index === Q.questions.length - 1;
  const reveal = document.getElementById('q-reveal');
  if (reveal) {
    reveal.innerHTML =
      '<div class="q-reveal fade-up">' +
        (qArt(q.track) ? '<img src="' + qArt(q.track) + '" alt=""><br>' : '') +
        '<div class="verdict ' + (correct ? 'good' : 'bad') + '">' +
          (correct ? 'YES 🖤'
            : reason === 'timeout' ? "time's up 💔"
            : reason === 'gaveup' ? 'it was... 💔'
            : 'not it 💔') +
        '</div>' +
        '<div class="song">' + esc(qStrip(q.track.name)) + '</div>' +
        '<div class="who">' + esc(qArtistNames(q.track)) + '</div>' +
        (q.detail ? '<div class="who" style="color:var(--hotpink);font-family:monospace;">' + esc(q.detail) + '</div>' : '') +
        (correct ? '<div class="pts">+' + points + ' points</div>' : '<div class="pts" style="color:var(--dimtext);">+0 points</div>') +
        '<div class="q-actions"><button class="q-btn" onclick="qNext()">' +
          (last ? 'see my score →' : 'next song →') +
        '</button></div>' +
        '<div class="q-note" style="margin-top:6px;">or just hit enter ↵</div>' +
      '</div>';
    reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  Q.revealTimer = setTimeout(qNext, REVEAL_MS);
}

function qNext() {
  qClearTimers();
  if (Q.index >= Q.questions.length - 1) {
    qScreenResults();
  } else {
    Q.index++;
    qRenderQuestion();
  }
}

// ======================== SCREEN: RESULTS ========================

function qRank(score) {
  const pct = score / QUIZ_MAX;
  if (pct >= 0.95) return { emoji: '👑', name: 'certified menace', blurb: 'you knew every single one. this is your whole personality and it shows.' };
  if (pct >= 0.85) return { emoji: '🖤', name: 'obsessed (affectionate)', blurb: 'you dont just listen to music, you KNOW music. respect.' };
  if (pct >= 0.70) return { emoji: '🎧', name: 'the real deal', blurb: 'solid ears. you actually pay attention to what you\'re playing.' };
  if (pct >= 0.55) return { emoji: '⭐', name: 'pretty good honestly', blurb: 'you got most of them. a few slipped past but thats ok.' };
  if (pct >= 0.40) return { emoji: '🌸', name: 'casual enjoyer', blurb: 'you vibe to it, you just dont memorize the titles. valid.' };
  if (pct >= 0.20) return { emoji: '🔀', name: 'shuffle enthusiast', blurb: 'you press play and let it happen. no notes.' };
  return { emoji: '💀', name: 'first time hearing this?', blurb: 'brutal. run it back, you got this.' };
}

function qScreenResults() {
  // two-player rounds have their own winner screen; so does the lightning round
  if (Q.game === 'versus' && typeof vScreenResults === 'function') { vScreenResults(); return; }
  if (typeof mScreenResults === 'function' && mScreenResults()) return;
  Q.screen = 'results';
  qStopAudio();
  qClearTimers();

  const score = Math.round(Q.score);
  const rank = qRank(score);
  const got = Q.results.filter(r => r.correct).length;
  const dots = Q.results.map(r => r.correct ? '🩷' : '🖤').join('');

  qSet(
    '<div class="q-final fade-up">' +
      '<div style="font-size:2.6rem;">' + rank.emoji + '</div>' +
      '<div class="num">' + score + '</div>' +
      '<div class="outof">out of ' + QUIZ_MAX + ' &middot; ' + got + '/' + Q.results.length + ' right</div>' +
      '<div class="rank">' + rank.name + '</div>' +
      '<div class="blurb">' + rank.blurb + '</div>' +
      '<div class="dots">' + dots + '</div>' +
    '</div>' +
    '<p class="q-note" style="margin-bottom:10px;">' + esc(Q.source.name) + ' &middot; ' +
      (Q.mode === 'mc' ? 'multiple choice' : 'type it out') + '</p>' +
    (Q.skipped ? '<p class="q-note" style="margin-bottom:10px;">(' + Q.skipped + ' song' + (Q.skipped === 1 ? '' : 's') +
      ' in there ' + (Q.skipped === 1 ? 'has' : 'have') + ' no playable clip on apple, so ' + (Q.skipped === 1 ? 'it' : 'they') + ' never come' + (Q.skipped === 1 ? 's' : '') + ' up)</p>' : '') +
    '<div class="q-recap">' +
      Q.results.map((r, i) =>
        '<div class="q-recap-row">' +
          '<span style="color:var(--dimtext);min-width:20px;">' + (i + 1) + '</span>' +
          (qArt(r.track) ? '<img src="' + qArt(r.track) + '" alt="">' : '') +
          '<div class="info">' +
            '<div class="nm">' + esc(qStrip(r.track.name)) + '</div>' +
            '<div class="ar">' + esc(qArtistNames(r.track)) +
              (!r.correct && r.guess ? ' &middot; you said "' + esc(r.guess) + '"' : '') +
            '</div>' +
          '</div>' +
          '<span class="p ' + (r.correct ? 'good' : 'bad') + '">' + (r.correct ? '+' + r.points : '0') + '</span>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="qStart(\'' + Q.mode + '\')">run it back</button>' +
      '<button class="q-btn ghost" onclick="qScreenMode()">switch mode</button>' +
      '<button class="q-btn ghost" onclick="qScreenMenu()">new quiz</button>' +
      '<button class="q-btn ghost" onclick="qShare(this)">copy score</button>' +
    '</div>' +
    '<div id="g-results-extra"></div>' +
    '<div class="q-actions"><button class="q-back" onclick="closeQuiz()">&larr; back to stats</button></div>'
  );

  // games.js adds the challenge link, leaderboard save, daily streak etc
  if (typeof gAfterResults === 'function') gAfterResults();

  if (score >= 700 && window.confetti) {
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1', '#FF69B4'] });
  }
}

function qShare(btn) {
  const score = Math.round(Q.score);
  const dots = Q.results.map(r => r.correct ? '🩷' : '🖤').join('');
  const text = 'xXx SparkleStats xXx - guess the song\n' +
    '★ ' + Q.source.name + ' ★\n' +
    score + '/' + QUIZ_MAX + ' - ' + qRank(score).name + '\n' +
    dots + '\n' +
    SITE_URL;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'copied! 🩷';
    setTimeout(() => { btn.textContent = 'copy score'; }, 2000);
  }).catch(() => {
    btn.textContent = 'couldnt copy :(';
  });
}

// ======================== NAV ========================

function qGo(where) {
  if (where === 'artist') qScreenArtist();
  else if (where === 'mine') qScreenMine();
  else if (where === 'link') qScreenLink();
  else if (where === 'top') {
    const pool = qPoolFromTop();
    Q.source = { kind: 'top', id: 'top', name: 'your top songs', image: qArt(pool[0] || {}), sub: 'straight from your stats' };
    qLoadPool(async () => pool);
  }
}

// openQuiz() lands on the arcade hub; openQuiz('classic') skips straight to a game's source picker
function openQuiz(game) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  window.scrollTo(0, 0);
  if (game) { Q.game = game; Q.len = QUIZ_LEN; qScreenMenu(); }
  else if (typeof gScreenHub === 'function') gScreenHub();
  else qScreenMenu();
}

function closeQuiz() {
  qStopAudio();
  qClearTimers();
  if (Q.game === 'online' && typeof oReset === 'function') { oReset(); Q.game = 'classic'; }
  document.getElementById('game').style.display = 'none';
  document.getElementById('game').innerHTML = '';
  document.getElementById('app').style.display = 'block';
  window.scrollTo(0, 0);
}

// expose for inline handlers
window.openQuiz = openQuiz;
window.closeQuiz = closeQuiz;
window.qGo = qGo;
window.qScreenMenu = qScreenMenu;
window.qScreenMode = qScreenMode;
window.qSearchArtist = qSearchArtist;
window.qPickArtist = qPickArtist;
window.qPickMine = qPickMine;
window.qUseLink = qUseLink;
window.qStart = qStart;
window.qSetLen = qSetLen;

function qSetDepth(d) {
  if (!['hits', 'mix', 'deep'].includes(d)) return;
  Q.depth = d;
  qScreenMode();
}
window.qSetDepth = qSetDepth;
window.qAnswerChoice = qAnswerChoice;
window.qAnswerTyped = qAnswerTyped;
window.qGiveUp = qGiveUp;
window.qNext = qNext;
window.qReplay = qReplay;
window.qShare = qShare;

// ======================== KEYBOARD ========================
// enter submits while you're answering (each text box handles that itself);
// once the reveal card is up, enter = next song. works for every mode since
// they all go through qFinishQuestion -> Q.locked.
function qInstallKeys() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const game = document.getElementById('game');
    if (!game || game.style.display === 'none') return;
    if (Q.screen !== 'play' || !Q.locked) return;
    // a live text box is mid-submit on this very keypress - leave it alone
    if (e.target && e.target.tagName === 'INPUT' && !e.target.disabled) return;
    // stop a focused answer button from "clicking" itself onto the next question
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    qNext();
  });
}
qInstallKeys();
