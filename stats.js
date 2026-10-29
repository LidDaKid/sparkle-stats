// ============================================================
//  xXx SparkleStats xXx  -  stats.js
//  "deep stats" section on the dashboard: title autopsy, tracklist
//  habits, your music's age, artist takeover, collab stats, same-name
//  songs, listening sessions, playlist forensics, liked songs timeline,
//  follow vs listen. loads last; wraps renderDashboard / initCharts.
// ============================================================

const S = { data: null, playlists: null, liked: null, follow: null, yearHist: null, token: 0 };
const S_STOP = new Set(['the', 'a', 'an', 'of', 'in', 'to', 'and', 'i', 'you', 'me', 'my', 'it', 'is', 'on', 'for', 'this', 'that', 'with', 'we', 'be',
  'are', 'your', 'at', 'all', 'not', 'no', 'so', 'up', 'do', 'im', 'like', 'its', 'if', 'or', 'as', 'by', 'from', 'was', 'am', 'am', 'ill', 'ive',
  'dont', 'cant', 'wont', 'let', 'get', 'got', 'just', 'what', 'when', 'where', 'who', 'how', 'why', 'out', 'off', 'into', 'than', 'then', 'them', 'they',
  'he', 'she', 'her', 'his', 'him', 'us', 'our', 'ya', 'yeah', 'oh', 'na', 'la', 'da', 'pt', 'feat', 'ft', 'vs', 'de', 'el', 'y', 'en']);
const S_SAD = /\b(love|loved|lover|heart|hearts|cry|crying|cried|tears|dead|die|died|dying|death|kill|hate|alone|lonely|lost|lose|losing|gone|hurt|pain|sorry|goodbye|bye|ghost|broken|break|miss|missing|never|scream|blood|bleed|fear|hell|sad|dark|forever|end|fall|falling|grave|numb|empty|nothing|sick|burn|burning|drown)\b/i;
const S_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// ======================== LITTLE HELPERS ========================

function sUnique(tracks) {
  const seen = new Set(), out = [];
  for (const list of Object.values(tracks || {})) for (const t of list || []) {
    if (!t || !t.id || seen.has(t.id)) continue;
    seen.add(t.id); out.push(t);
  }
  return out;
}
function sPct(n, d) { return d ? Math.round(n / d * 100) : 0; }
function sMonthKey(iso) { const d = new Date(iso); return isNaN(d) ? null : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function sMonthLabel(key) { const [y, m] = key.split('-'); return S_MONTHS[parseInt(m, 10) - 1] + ' ' + y; }
function sHasScope(name) {
  try { const t = JSON.parse(localStorage.getItem('sp_tokens') || '{}'); return typeof t.scope === 'string' && t.scope.includes(name); } catch { return false; }
}
function sTile(label, value, sub) {
  return '<div class="x-stat"><div class="l">' + label + '</div><div class="v">' + value + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
}
function sBar(label, pct, right) {
  return '<div class="s-bar"><div class="s-bar-top"><span>' + label + '</span><span>' + (right != null ? right : pct + '%') + '</span></div>' +
    '<div class="s-bar-track"><i style="width:' + Math.max(1, Math.min(100, pct)) + '%;"></i></div></div>';
}
function sCard(title, body, opts) {
  const o = opts || {};
  return '<div class="card' + (o.wide ? '' : ' half') + ' s-card"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
    '<p class="s-title">' + title + '</p>' + body + '</div>';
}
function sNote(t) { return '<p class="s-note">' + t + '</p>'; }
function sReconnect(what) {
  return sNote(what + ' needs one more spotify permission. connect again once and it shows up here.') +
    '<div class="q-actions" style="margin-top:8px;"><button class="q-btn" onclick="login()">reconnect spotify</button></div>';
}

// ======================== TITLE AUTOPSY ========================

function sTitles(tracks) {
  const titles = tracks.map(t => ({ raw: String(t.name || ''), clean: qStrip(t.name), t }));
  const counts = {};
  let wordsTotal = 0;
  for (const x of titles) {
    const words = x.clean.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
    wordsTotal += words.length;
    const seen = new Set();
    for (const w0 of words) {
      const w = w0.replace(/'/g, '');
      if (w.length < 2 || S_STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  const words = Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([w, n]) => ({ w, n }));
  const oneWord = titles.filter(x => x.clean.trim().split(/\s+/).length === 1);
  const questions = titles.filter(x => /\?\s*$/.test(x.clean));
  const numbers = titles.filter(x => /\d/.test(x.clean));
  const caps = titles.filter(x => /[A-Z]/.test(x.clean) && x.clean === x.clean.toUpperCase() && x.clean.replace(/[^A-Z]/g, '').length >= 3);
  const sad = titles.filter(x => S_SAD.test(x.clean));
  const byLen = titles.slice().sort((a, b) => a.clean.length - b.clean.length);
  return {
    total: titles.length, words, oneWord: oneWord.length, questions: questions.length, numbers: numbers.length, caps: caps.length,
    heartbreakPct: sPct(sad.length, titles.length), avgWords: titles.length ? Math.round(wordsTotal / titles.length * 10) / 10 : 0,
    shortest: byLen[0] ? byLen[0].clean : '', longest: byLen.length ? byLen[byLen.length - 1].clean : '',
    example: { question: questions[0] ? questions[0].clean : '', oneWord: oneWord.slice(0, 4).map(x => x.clean) },
  };
}
function sTitlesHtml(a) {
  if (!a.total) return sNote('no songs to read yet.');
  const verdict = a.heartbreakPct >= 50 ? 'your titles are ' + a.heartbreakPct + '% heartbreak. as expected.'
    : a.heartbreakPct >= 25 ? a.heartbreakPct + '% of your titles are some flavor of sad. balanced, honestly.'
    : 'only ' + a.heartbreakPct + '% of your titles are sad words. the songs themselves are another story.';
  return '<div class="x-stats s-tiles">' +
      sTile('heartbreak index', a.heartbreakPct + '%', 'titles with a sad word') +
      sTile('one-word titles', a.oneWord, a.example.oneWord.length ? esc(a.example.oneWord.slice(0, 2).join(', ')) : '') +
      sTile('questions', a.questions, a.example.question ? esc(a.example.question) : 'none') +
      sTile('all caps', a.caps, 'SCREAMING') +
    '</div>' +
    (a.words.length ? '<div class="s-words">' + a.words.map(w => '<span class="s-word">' + esc(w.w) + '<b>' + w.n + '</b></span>').join('') + '</div>' : sNote('no word shows up twice. every title is a one-off.')) +
    '<div class="s-kv"><span>shortest</span><span>' + esc(a.shortest) + '</span></div>' +
    '<div class="s-kv"><span>longest</span><span>' + esc(a.longest) + '</span></div>' +
    '<div class="s-kv"><span>average</span><span>' + a.avgWords + ' words &middot; ' + a.numbers + ' with a number in it</span></div>' +
    sNote(verdict);
}

// ======================== TRACKLIST HABITS ========================

function sTracklist(tracks) {
  let openers = 0, closers = 0, trackSum = 0, trackN = 0;
  const types = { album: 0, single: 0, compilation: 0 };
  for (const t of tracks) {
    const n = Number(t.track_number) || 0, total = Number(t.album?.total_tracks) || 0;
    if (n) { trackN++; trackSum += n; if (n === 1) openers++; if (total > 1 && n === total) closers++; }
    const ty = String(t.album?.album_type || '').toLowerCase();
    if (ty in types) types[ty]++;
  }
  const typed = types.album + types.single + types.compilation;
  return {
    total: tracks.length, openers, closers, avgTrack: trackN ? Math.round(trackSum / trackN * 10) / 10 : 0,
    albumPct: sPct(types.album, typed), singlePct: sPct(types.single, typed), compPct: sPct(types.compilation, typed),
    openerPct: sPct(openers, trackN), closerPct: sPct(closers, trackN),
  };
}
function sTracklistHtml(a) {
  if (!a.total) return sNote('nothing to read yet.');
  const who = a.albumPct >= 60 ? 'album person. you hear the whole thing.' : a.singlePct >= 50 ? 'singles person. straight to the point.' : 'a bit of both. albums when you\'re invested, singles when you\'re not.';
  const pos = a.openerPct >= 30 ? 'you fall for track 1s. the opener gets you every time.'
    : a.closerPct >= 20 ? 'you stick around for the closer. patient.'
    : a.avgTrack >= 7 ? 'your favorites hide deep in the tracklist. deep cuts, on average track ' + a.avgTrack + '.'
    : 'your favorites sit around track ' + a.avgTrack + ' on average. front half of the record.';
  return sBar('from albums', a.albumPct) + sBar('from singles / EPs', a.singlePct) + (a.compPct ? sBar('from compilations', a.compPct) : '') +
    '<div class="x-stats s-tiles" style="margin-top:10px;">' +
      sTile('openers', a.openerPct + '%', 'track 1s') + sTile('closers', a.closerPct + '%', 'last track') + sTile('avg position', 'track ' + a.avgTrack, '') +
    '</div>' + sNote(who + ' ' + pos);
}

// ======================== YOUR MUSIC'S AGE ========================

function sAge(tracks) {
  const now = new Date().getFullYear();
  const years = [];
  const hist = {};
  let oldest = null, newest = null;
  for (const t of tracks) {
    const y = gYear(t);
    if (!y || y < 1900 || y > now + 1) continue;
    years.push(y);
    hist[y] = (hist[y] || 0) + 1;
    if (!oldest || y < gYear(oldest)) oldest = t;
    if (!newest || y > gYear(newest)) newest = t;
  }
  years.sort((a, b) => a - b);
  const avg = years.length ? years.reduce((s, y) => s + y, 0) / years.length : now;
  const median = years.length ? years[Math.floor(years.length / 2)] : now;
  const thisYear = years.filter(y => y >= now - 1).length;
  return { n: years.length, avgAge: Math.round((now - avg) * 10) / 10, medianYear: median, oldest, newest, hist, minYear: years[0] || now, maxYear: years[years.length - 1] || now, recentPct: sPct(thisYear, years.length) };
}
function sAgeHtml(a) {
  if (!a.n) return sNote('no release dates to read.');
  const line = a.avgAge >= 20 ? 'your music is older than you. on purpose.' : a.avgAge >= 10 ? 'about a decade old on average. you found your era and stayed.' : a.avgAge >= 4 ? 'mostly recent, with a few throwbacks.' : 'you live in the present tense. almost everything is brand new.';
  return '<div class="x-stats s-tiles">' +
      sTile('average age', a.avgAge + ' yrs', 'median ' + a.medianYear) +
      sTile('oldest', gYear(a.oldest), esc(qStrip(a.oldest.name)) + ' &middot; ' + esc(gPrimary(a.oldest))) +
      sTile('newest', gYear(a.newest), esc(qStrip(a.newest.name)) + ' &middot; ' + esc(gPrimary(a.newest))) +
      sTile('from the last 2 years', a.recentPct + '%', '') +
    '</div>' +
    '<div class="chart-box" style="height:180px;"><canvas id="s-year-chart"></canvas></div>' +
    sNote(line);
}
function sYearChart(a) {
  if (typeof Chart !== 'function' || !a || !a.n) return null;
  const el = document.getElementById('s-year-chart');
  if (!el) return null;
  const span = a.maxYear - a.minYear;
  const step = span > 45 ? 5 : 1;
  const labels = [], vals = [];
  for (let y = Math.floor(a.minYear / step) * step; y <= a.maxYear; y += step) {
    labels.push(step === 1 ? String(y) : y + 's');
    let n = 0; for (let k = 0; k < step; k++) n += a.hist[y + k] || 0;
    vals.push(n);
  }
  return new Chart(el, {
    type: 'bar',
    data: { labels, datasets: [{ data: vals, backgroundColor: 'rgba(255,20,147,0.55)', borderColor: '#FF1493', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#996b7d', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } }, y: { ticks: { color: '#996b7d', precision: 0 }, grid: { color: '#1a0f15' } } } },
  });
}

// ======================== ARTIST TAKEOVER ========================

function sTakeover(tracks) {
  const counts = {};
  for (const t of tracks) { const a = gPrimary(t); if (a) counts[a] = (counts[a] || 0) + 1; }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n, pct: sPct(n, tracks.length) }));
  let cum = 0, half = 0;
  for (const r of ranked) { cum += r.n; half++; if (cum >= tracks.length / 2) break; }
  return { total: tracks.length, artists: ranked.length, top: ranked.slice(0, 5), half: ranked.length ? half : 0, oneSong: ranked.filter(r => r.n === 1).length };
}
function sTakeoverHtml(a) {
  if (!a.total) return sNote('nothing to read yet.');
  const t = a.top[0];
  const line = t.pct >= 40 ? t.name + ' is ' + t.pct + '% of your top songs. that\'s not a favorite, that\'s a personality.'
    : t.pct >= 20 ? t.name + ' takes ' + t.pct + '%. loyal, but you get around.'
    : 'no one artist runs the show. ' + t.name + ' leads with just ' + t.pct + '%.';
  return a.top.map(r => sBar(esc(r.name), r.pct, r.n + ' song' + (r.n === 1 ? '' : 's'))).join('') +
    '<div class="x-stats s-tiles" style="margin-top:10px;">' +
      sTile('artists in your top', a.artists, 'across ' + a.total + ' songs') +
      sTile('to cover half', a.half + ' artist' + (a.half === 1 ? '' : 's'), 'of your top songs') +
      sTile('one-song artists', a.oneSong, 'just the one hit') +
    '</div>' + sNote(esc(line));
}

// ======================== COLLABS ========================

function sCollabs(tracks) {
  let multi = 0;
  const guests = {}, pairs = {};
  for (const t of tracks) {
    const names = (t.artists || []).map(a => a.name).filter(Boolean);
    if (names.length < 2) continue;
    multi++;
    for (const g of names.slice(1)) guests[g] = (guests[g] || 0) + 1;
    const pair = names.slice(0, 2).sort().join(' + ');
    pairs[pair] = (pairs[pair] || 0) + 1;
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0] || null;
  const g = top(guests), p = top(pairs);
  return { total: tracks.length, multi, pct: sPct(multi, tracks.length), guest: g ? { name: g[0], n: g[1] } : null, pair: p ? { name: p[0], n: p[1] } : null };
}
function sCollabsHtml(a) {
  if (!a.total) return sNote('nothing to read yet.');
  const line = a.pct >= 40 ? 'almost half your songs have a guest on them. you like a crowd.' : a.pct >= 15 ? 'a healthy amount of features.' : a.pct ? 'you mostly want one voice at a time.' : 'zero features. solo acts only. respect.';
  return '<div class="x-stats s-tiles">' +
      sTile('songs with a feature', a.pct + '%', a.multi + ' of ' + a.total) +
      sTile('most common guest', a.guest ? esc(a.guest.name) : '-', a.guest ? 'shows up ' + a.guest.n + 'x' : '') +
      sTile('your favorite duo', a.pair ? esc(a.pair.name) : '-', a.pair && a.pair.n > 1 ? a.pair.n + ' songs together' : '') +
    '</div>' + sNote(line);
}

// ======================== SAME-NAME SONGS ========================

function sSameName(tracks) {
  const groups = {};
  for (const t of tracks) {
    const k = qNorm(qStrip(t.name));
    if (!k) continue;
    (groups[k] = groups[k] || []).push(t);
  }
  return Object.values(groups)
    .map(list => { const seen = new Set(); return list.filter(t => { const a = qNorm(gPrimary(t)); if (seen.has(a)) return false; seen.add(a); return true; }); })
    .filter(list => list.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map(list => ({ title: qStrip(list[0].name), artists: list.map(gPrimary) }));
}
function sSameNameHtml(list) {
  if (!list.length) return sNote('every title in your top songs is unique. no "Home" times three for you.');
  return list.slice(0, 6).map(g => '<div class="s-kv"><span>' + esc(g.title) + ' <b>&times;' + g.artists.length + '</b></span><span>' + esc(g.artists.join(' / ')) + '</span></div>').join('') +
    sNote('you have ' + list.length + ' title' + (list.length === 1 ? '' : 's') + ' that ' + (list.length === 1 ? 'belongs' : 'belong') + ' to more than one song in your top lists.');
}

// ======================== LISTENING SESSIONS ========================

function sSessions(recent) {
  const rows = (recent || []).filter(r => r && r.played_at).map(r => ({ t: new Date(r.played_at).getTime(), dur: Number(r.track?.duration_ms) || 0, ctx: r.context || null })).sort((a, b) => a.t - b.t);
  if (!rows.length) return { n: 0 };
  const sessions = [];
  let cur = null;
  for (const r of rows) {
    if (!cur || r.t - cur.last > 30 * 60000) { cur = { start: r.t, last: r.t, plays: 0, ms: 0 }; sessions.push(cur); }
    cur.last = r.t; cur.plays++; cur.ms += r.dur;
  }
  const lens = sessions.map(s => (s.last - s.start) + (s.plays ? rows.find(r => r.t === s.last).dur : 0));
  const ctx = { playlist: 0, album: 0, artist: 0, collection: 0, other: 0 };
  const playlists = {};
  for (const r of rows) {
    const ty = r.ctx && String(r.ctx.type || '');
    if (ty in ctx) ctx[ty]++; else ctx.other++;
    if (ty === 'playlist' && r.ctx.uri) playlists[r.ctx.uri] = (playlists[r.ctx.uri] || 0) + 1;
  }
  const topPl = Object.entries(playlists).sort((a, b) => b[1] - a[1])[0] || null;
  const spanDays = (rows[rows.length - 1].t - rows[0].t) / 86400000;
  return {
    n: rows.length, sessions: sessions.length, avgMin: Math.round(lens.reduce((s, x) => s + x, 0) / lens.length / 60000),
    longestMin: Math.round(Math.max(...lens) / 60000), avgPlays: Math.round(rows.length / sessions.length * 10) / 10,
    ctx: Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, sPct(v, rows.length)])),
    topPlaylist: topPl ? { uri: topPl[0], id: topPl[0].split(':').pop(), n: topPl[1] } : null, spanDays: Math.round(spanDays * 10) / 10,
  };
}
function sSessionsHtml(a) {
  if (!a.n) return sNote('spotify hasn\'t shared any recent plays yet. play something and refresh.');
  const c = a.ctx;
  const who = c.playlist >= 50 ? 'playlist person. you press play on a list and let it ride.'
    : c.album >= 40 ? 'album front-to-back person. rare and correct.'
    : c.artist >= 40 ? 'artist page person. you pick a name and live there for a while.'
    : c.collection >= 40 ? 'liked-songs-on-shuffle person. chaos, but curated chaos.'
    : 'you play from a bit of everything - playlists, albums, artist pages.';
  return '<div class="x-stats s-tiles">' +
      sTile('sittings', a.sessions, 'in your last ' + a.n + ' plays') +
      sTile('typical sitting', a.avgMin + ' min', a.avgPlays + ' songs') +
      sTile('longest sitting', a.longestMin + ' min', '') +
      sTile('days covered', a.spanDays, a.spanDays < 2 ? 'you burned through 50 songs fast' : '') +
    '</div>' +
    sBar('playlists', c.playlist) + sBar('albums', c.album) + sBar('artist pages', c.artist) + sBar('liked songs', c.collection) +
    '<div id="s-top-playlist">' + (a.topPlaylist ? sNote('go-to playlist: looking it up...') : '') + '</div>' +
    sNote(who + ' (a sitting = plays with no gap longer than 30 minutes.)');
}
async function sTopPlaylistName(a) {
  if (!a || !a.topPlaylist) return;
  const box = document.getElementById('s-top-playlist');
  if (!box) return;
  try {
    const p = await qFetch('/playlists/' + a.topPlaylist.id);
    box.innerHTML = sNote('go-to playlist lately: <b>' + esc(p.name || '?') + '</b> &middot; ' + a.topPlaylist.n + ' of your last ' + a.n + ' plays came from it');
  } catch { box.innerHTML = ''; }
}

// ======================== PLAYLIST FORENSICS ========================

async function sPlaylists() {
  const first = await qFetch('/me/playlists?limit=50');
  let lists = first.items || [];
  if ((first.total || 0) > 50) { try { const more = await qFetch('/me/playlists?limit=50&offset=50'); lists = lists.concat(more.items || []); } catch {} }
  lists = lists.filter(p => p && p.id);
  const me = (typeof _data !== 'undefined' && _data && _data.user && _data.user.id) || null;
  const mine = me ? lists.filter(p => p.owner && p.owner.id === me) : lists;
  const sized = lists.map(p => ({ p, n: qPlaylistCount(p) || 0 }));
  const totalSongs = sized.reduce((s, x) => s + x.n, 0);
  const biggest = sized.slice().sort((a, b) => b.n - a.n)[0] || null;
  const sample = sized.filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 12);
  const trackIn = {};          // track id -> { name, artist, lists: Set }
  const months = {};
  let dupes = 0, oldest = null;
  let sampled = 0;
  await lMapLimit(sample, 3, async x => {
    const seen = new Set();
    for (let offset = 0; offset < 200; offset += 100) {
      const res = await qFetch('/playlists/' + x.p.id + '/items?limit=100&offset=' + offset);
      const rows = res.items || [];
      for (const r of rows) {
        const t = r && (r.item || r.track);
        if (!t || !t.id) continue;
        sampled++;
        if (seen.has(t.id)) dupes++; else seen.add(t.id);
        const e = trackIn[t.id] = trackIn[t.id] || { name: qStrip(t.name), artist: gPrimary(t), lists: new Set() };
        e.lists.add(x.p.name);
        if (r.added_at) {
          const mk = sMonthKey(r.added_at);
          if (mk) months[mk] = (months[mk] || 0) + 1;
          const at = new Date(r.added_at).getTime();
          if (at > 0 && (!oldest || at < oldest.at)) oldest = { at, name: x.p.name };
        }
      }
      if (rows.length < 100) break;
    }
  });
  const multi = Object.values(trackIn).filter(e => e.lists.size >= 2).sort((a, b) => b.lists.size - a.lists.size).slice(0, 5).map(e => ({ ...e, lists: [...e.lists] }));
  const busiest = Object.entries(months).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    count: lists.length, mine: mine.length, totalSongs, biggest: biggest ? { name: biggest.p.name, n: biggest.n } : null,
    collab: lists.filter(p => p.collaborative).length, pub: lists.filter(p => p.public).length,
    avgLen: sized.length ? Math.round(totalSongs / sized.length) : 0,
    multi, dupes, oldest, busiest: busiest ? { month: busiest[0], n: busiest[1] } : null, sampled, sampledLists: sample.length,
  };
}
function sPlaylistsHtml(a) {
  if (!a.count) return sNote('no playlists on this account yet.');
  return '<div class="x-stats s-tiles">' +
      sTile('playlists', a.count, a.mine + ' made by you') +
      sTile('songs in them', a.totalSongs.toLocaleString(), 'avg ' + a.avgLen + ' each') +
      sTile('biggest', a.biggest ? esc(a.biggest.name) : '-', a.biggest ? a.biggest.n.toLocaleString() + ' songs' : '') +
      sTile('collaborative', a.collab, a.pub + ' public') +
    '</div>' +
    (a.oldest ? '<div class="s-kv"><span>longest running</span><span>' + esc(a.oldest.name) + ' &middot; since ' + esc(sMonthLabel(sMonthKey(new Date(a.oldest.at).toISOString()))) + '</span></div>' : '') +
    (a.busiest ? '<div class="s-kv"><span>busiest month</span><span>' + esc(sMonthLabel(a.busiest.month)) + ' &middot; ' + a.busiest.n + ' songs added</span></div>' : '') +
    '<div class="s-kv"><span>duplicates</span><span>' + a.dupes + ' song' + (a.dupes === 1 ? '' : 's') + ' in a playlist twice</span></div>' +
    (a.multi.length
      ? '<p class="s-sub">lives in the most playlists</p>' + a.multi.map(e => '<div class="s-kv"><span>' + esc(e.name) + ' <span class="s-dim">' + esc(e.artist) + '</span></span><span><b>' + e.lists.length + '</b> playlists</span></div>').join('')
      : sNote('no song shows up in two of your big playlists. tidy.')) +
    sNote('based on the first 200 songs of your ' + a.sampledLists + ' biggest playlists (' + a.sampled.toLocaleString() + ' songs read).');
}

// ======================== LIKED SONGS TIMELINE ========================

async function sLiked() {
  const first = await qFetch('/me/tracks?limit=50');
  const total = Number(first.total) || 0;
  const months = {};
  const eat = res => { for (const r of (res.items || [])) { const mk = r && r.added_at && sMonthKey(r.added_at); if (mk) months[mk] = (months[mk] || 0) + 1; } };
  eat(first);
  const pages = [];
  for (let offset = 50; offset < Math.min(total, 1000); offset += 50) pages.push(offset);
  await lMapLimit(pages, 4, async offset => eat(await qFetch('/me/tracks?limit=50&offset=' + offset)));
  let firstEver = null;
  if (total > 0) {
    try {
      const last = await qFetch('/me/tracks?limit=1&offset=' + (total - 1));
      const r = (last.items || [])[0];
      if (r && (r.item || r.track)) firstEver = { name: qStrip((r.item || r.track).name), artist: gPrimary(r.item || r.track), at: r.added_at };
    } catch {}
  }
  const keys = Object.keys(months).sort();
  const busiest = Object.entries(months).sort((a, b) => b[1] - a[1])[0] || null;
  const recent = keys.slice(-12);
  const lastMonth = recent.length ? months[recent[recent.length - 1]] : 0;
  return { total, months, keys, busiest: busiest ? { month: busiest[0], n: busiest[1] } : null, firstEver, sampled: Math.min(total, 1000), lastMonth };
}
function sLikedHtml(a) {
  if (!a.total) return sNote('no liked songs yet. the heart button is right there.');
  const line = a.busiest ? 'the month you went feral: ' + sMonthLabel(a.busiest.month) + ', ' + a.busiest.n + ' likes.' : '';
  return '<div class="x-stats s-tiles">' +
      sTile('liked songs', a.total.toLocaleString(), '') +
      sTile('first ever like', a.firstEver ? esc(a.firstEver.name) : '-', a.firstEver ? esc(a.firstEver.artist) + (a.firstEver.at ? ' &middot; ' + esc(sMonthLabel(sMonthKey(a.firstEver.at))) : '') : '') +
      sTile('biggest month', a.busiest ? a.busiest.n : '-', a.busiest ? esc(sMonthLabel(a.busiest.month)) : '') +
    '</div>' +
    '<div class="chart-box" style="height:170px;"><canvas id="s-liked-chart"></canvas></div>' +
    sNote(line + (a.total > a.sampled ? ' (chart covers your ' + a.sampled.toLocaleString() + ' most recent likes.)' : ''));
}
function sLikedChart(a) {
  if (typeof Chart !== 'function' || !a || !a.keys.length) return null;
  const el = document.getElementById('s-liked-chart');
  if (!el) return null;
  const keys = a.keys.slice(-24);
  return new Chart(el, {
    type: 'bar',
    data: { labels: keys.map(k => sMonthLabel(k)), datasets: [{ data: keys.map(k => a.months[k]), backgroundColor: 'rgba(255,105,180,0.55)', borderColor: '#FF69B4', borderWidth: 1 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#996b7d', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }, y: { ticks: { color: '#996b7d', precision: 0 }, grid: { color: '#1a0f15' } } } },
  });
}

// ======================== FOLLOW VS LISTEN ========================

async function sFollow(artists) {
  const followed = [];
  let after = null, total = 0;
  for (let page = 0; page < 10; page++) {
    const res = await qFetch('/me/following?type=artist&limit=50' + (after ? '&after=' + after : ''));
    const a = res.artists || {};
    total = Number(a.total) || total;
    followed.push(...(a.items || []));
    after = a.cursors && a.cursors.after;
    if (!after || !(a.items || []).length) break;
  }
  const fIds = new Set(followed.map(x => x.id));
  const listened = [];
  const seen = new Set();
  for (const list of Object.values(artists || {})) for (const x of list || []) { if (x && x.id && !seen.has(x.id)) { seen.add(x.id); listened.push(x); } }
  const both = listened.filter(x => fIds.has(x.id));
  const notFollowed = listened.filter(x => !fIds.has(x.id));
  const neverPlay = followed.filter(x => !seen.has(x.id));
  return { followed: total || followed.length, listened: listened.length, both: both.length, notFollowed: notFollowed.slice(0, 6).map(x => x.name), neverPlay: neverPlay.slice(0, 6).map(x => x.name), neverPlayN: neverPlay.length };
}
function sFollowHtml(a) {
  const line = !a.followed ? 'you follow nobody. you just show up and listen. iconic.'
    : a.both / Math.max(1, a.listened) >= 0.7 ? 'you follow almost everyone you actually play. consistent.'
    : a.neverPlayN > a.both ? 'you follow more artists you don\'t play than ones you do. the follow button means nothing to you.'
    : 'you follow some, you play others. the venn diagram has gaps.';
  return '<div class="x-stats s-tiles">' +
      sTile('you follow', a.followed, 'artists') +
      sTile('you actually play', a.listened, 'in your top lists') +
      sTile('both', a.both, 'follow + play') +
    '</div>' +
    (a.notFollowed.length ? '<div class="s-kv"><span>play but don\'t follow</span><span>' + esc(a.notFollowed.join(', ')) + '</span></div>' : '') +
    (a.neverPlay.length ? '<div class="s-kv"><span>follow but never play</span><span>' + esc(a.neverPlay.join(', ')) + (a.neverPlayN > a.neverPlay.length ? ' +' + (a.neverPlayN - a.neverPlay.length) + ' more' : '') + '</span></div>' : '') +
    sNote(line);
}

// ======================== RENDER ========================

function sRender(data) {
  const tracks = sUnique(data.tracks);
  S.data = data;
  S.yearHist = sAge(tracks);
  S.sessions = sSessions(data.recent || []);
  return '<div class="section-title">deep stats</div>' +
    sCard('🔪 title autopsy', sTitlesHtml(sTitles(tracks))) +
    sCard('💿 tracklist habits', sTracklistHtml(sTracklist(tracks))) +
    sCard('⏳ your music\'s age', sAgeHtml(S.yearHist)) +
    sCard('👑 artist takeover', sTakeoverHtml(sTakeover(tracks))) +
    sCard('🤝 collab stats', sCollabsHtml(sCollabs(tracks))) +
    sCard('🪞 same-name songs', sSameNameHtml(sSameName(tracks))) +
    sCard('🛋️ listening sessions', sSessionsHtml(S.sessions)) +
    sCard('🗂️ playlist forensics', '<p class="s-note" id="s-playlists-status">reading your playlists...</p>', { id: 's-playlists' }) +
    sCard('🩷 liked songs timeline', sHasScope('user-library-read') ? '<p class="s-note">counting your likes...</p>' : sReconnect('the liked songs timeline'), { id: 's-liked' }) +
    sCard('👀 follow vs listen', sHasScope('user-follow-read') ? '<p class="s-note">checking who you follow...</p>' : sReconnect('follow vs listen'), { id: 's-follow' });
}

function sFill(id, html) {
  const el = document.getElementById(id);
  if (!el) return false;
  const title = el.querySelector && el.querySelector('.s-title');
  el.innerHTML = (title ? title.outerHTML : '') + html;
  return true;
}

async function sLoadAsync(data) {
  const token = ++S.token;
  sTopPlaylistName(S.sessions).catch(() => {});
  const jobs = [];
  jobs.push(sPlaylists().then(a => { S.playlists = a; if (token === S.token) sFill('s-playlists', sPlaylistsHtml(a)); })
    .catch(e => { if (token === S.token) sFill('s-playlists', sNote('couldn\'t read your playlists: ' + esc(e.message))); }));
  if (sHasScope('user-library-read')) {
    jobs.push(sLiked().then(a => { S.liked = a; if (token === S.token) { sFill('s-liked', sLikedHtml(a)); sLikedChart(a); } })
      .catch(e => { if (token === S.token) sFill('s-liked', sNote('couldn\'t read your likes: ' + esc(e.message))); }));
  }
  if (sHasScope('user-follow-read')) {
    jobs.push(sFollow(data.artists).then(a => { S.follow = a; if (token === S.token) sFill('s-follow', sFollowHtml(a)); })
      .catch(e => { if (token === S.token) sFill('s-follow', sNote('couldn\'t read who you follow: ' + esc(e.message))); }));
  }
  await Promise.all(jobs);
}

// hooks: add the section to the dashboard, draw its charts, kick off the slow bits
if (typeof renderDashboard === 'function') {
  const sPrevRender = renderDashboard;
  renderDashboard = function (data, analysis) {
    const html = sPrevRender(data, analysis);
    let extra = '';
    try { extra = sRender(data); setTimeout(() => { sLoadAsync(data).catch(() => {}); }, 0); } catch (e) { extra = ''; }
    return html + extra;
  };
  window.renderDashboard = renderDashboard;
}
if (typeof initCharts === 'function') {
  const sPrevCharts = initCharts;
  initCharts = function (analysis) {
    const r = sPrevCharts(analysis);
    try { sYearChart(S.yearHist); } catch {}
    return r;
  };
  window.initCharts = initCharts;
}

Object.assign(window, { sRender, sLoadAsync, sFill });
