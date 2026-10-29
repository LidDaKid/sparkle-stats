// ============================================================
//  xXx SparkleStats xXx  -  genres.js
//  spotify stopped returning artist genres to apps like this one
//  (sep 2026) - not on /me/top/artists, not on /artists/{id}, not on
//  search. the whole personality engine runs on genres, so this
//  backfills them from apple's catalog: one lookup per artist, cached
//  in localStorage. apple allows roughly 20 lookups a minute, so
//  callers pace themselves (see fillGenres options) and a throttled
//  answer is never mistaken for "this artist has no genre".
//  loads before app.js.
// ============================================================

const GF_CACHE_KEY = 'sparkle_genres_v2';   // bump when the lookup rules change so stale answers get redone
const GF_TTL_HIT = 30 * 24 * 3600 * 1000;   // a found genre is good for a month
const GF_TTL_MISS = 6 * 3600 * 1000;        // a real miss gets retried after six hours
const GF_ITUNES = 'https://itunes.apple.com/search';
const GF_BACKOFF_MS = (typeof window !== 'undefined' && window.GF_BACKOFF_MS) || 15000;

// apple's top-level genre names -> wording our mood / rarity maps know
const GF_MAP = {
  'alternative': ['alternative rock', 'alternative'],
  'adult alternative': ['alternative rock'],
  'rock': ['rock'],
  'hard rock': ['hard rock'],
  'arena rock': ['arena rock', 'classic rock'],
  'american trad rock': ['classic rock'],
  'rock & roll': ['rock and roll', 'rock'],
  'metal': ['metal', 'heavy metal'],
  'metalcore': ['metalcore'],
  'death metal': ['death metal'],
  'black metal': ['black metal'],
  'punk': ['punk rock', 'punk'],
  'emo': ['emo'],
  'grunge': ['grunge'],
  'goth rock': ['gothic rock'],
  'industrial': ['industrial'],
  'new wave': ['new wave'],
  'college rock': ['college rock'],
  'indie rock': ['indie rock'],
  'indie pop': ['indie pop'],
  'pop': ['pop'],
  'teen pop': ['teen pop', 'pop'],
  'k-pop': ['k-pop'],
  'j-pop': ['j-pop'],
  'hip-hop/rap': ['hip hop', 'rap'],
  'r&b/soul': ['r&b', 'soul'],
  'electronic': ['electronic'],
  'dance': ['dance pop', 'dance'],
  'singer/songwriter': ['singer-songwriter'],
  'country': ['country'],
  'soundtrack': ['soundtrack'],
  'christian & gospel': ['christian'],
  'latin': ['latin'],
  'jazz': ['jazz'],
  'reggae': ['reggae'],
  'blues': ['blues'],
  'folk': ['folk'],
  'classical': ['classical'],
  'world': ['world'],
  'new age': ['new age'],
};

// lowercase, accents off, only letters/digits/&/ kept - for comparing names
function gfNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9&/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function gfKey(name) { return gfNorm(name).replace(/[&/]/g, ' ').replace(/\s+/g, ' ').trim(); }

function gfMapGenre(apple) {
  const k = gfNorm(apple);
  if (GF_MAP[k]) return GF_MAP[k].slice();
  const plain = k.replace(/[/&]/g, ' ').replace(/\s+/g, ' ').trim();
  return plain ? [plain] : [];
}

function gfLoadCache() {
  try { return JSON.parse(localStorage.getItem(GF_CACHE_KEY) || '{}') || {}; } catch { return {}; }
}
function gfSaveCache(c) {
  try { localStorage.setItem(GF_CACHE_KEY, JSON.stringify(c)); } catch {}
}

// one apple request, with a hard 8s cap so a stalled connection can never hang the
// loading screen. { ok:false } means throttled / timed out / network trouble - not "no results"
async function gfGet(query) {
  const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : null;
  try {
    const r = await fetch(GF_ITUNES + '?' + query, ctl ? { signal: ctl.signal } : undefined);
    if (!r.ok) return { ok: false, results: [] };
    return { ok: true, results: ((await r.json()).results || []) };
  } catch { return { ok: false, results: [] }; }
  finally { if (timer) clearTimeout(timer); }
}

// the artist's albums on apple -> the genres they're *usually* filed under.
// one stray "Dance" remix EP shouldn't make an emo band read as club music, so a
// genre has to show up on at least two albums (or a quarter of them) to count;
// with only one album, that one counts. exact name matches win over fuzzy ones.
// falls back to the artist entry itself (one genre).
// returns { g: [...], ok } - ok:false when apple wouldn't answer (don't cache that)
async function gfLookup(name) {
  const want = gfKey(name);
  if (!want) return { g: [], ok: true };
  const exact = r => gfKey(r.artistName) === want;
  const fuzzy = r => { const a = gfKey(r.artistName); return want.length > 3 && (a.includes(want) || want.includes(a)); };

  const alb = await gfGet('term=' + encodeURIComponent(name) + '&entity=album&attribute=artistTerm&limit=25');
  if (!alb.ok) return { g: [], ok: false };
  const all = alb.results.filter(al => al.primaryGenreName);
  let albums = all.filter(exact);
  if (!albums.length) albums = all.filter(fuzzy);
  if (albums.length) {
    const counts = new Map();
    for (const al of albums) counts.set(al.primaryGenreName, (counts.get(al.primaryGenreName) || 0) + 1);
    const need = Math.max(2, Math.ceil(albums.length * 0.25));
    let keep = [...counts.entries()].filter(([, n]) => n >= need);
    if (!keep.length) keep = [[...counts.entries()].sort((a, b) => b[1] - a[1])[0]];
    const genres = new Set();
    keep.sort((a, b) => b[1] - a[1]).forEach(([g]) => gfMapGenre(g).forEach(x => genres.add(x)));
    return { g: [...genres], ok: true };
  }

  const art = await gfGet('term=' + encodeURIComponent(name) + '&entity=musicArtist&limit=5');
  if (!art.ok) return { g: [], ok: false };
  const withGenre = art.results.filter(ar => ar.primaryGenreName);
  const hit = withGenre.find(exact) || withGenre.find(fuzzy);
  return { g: hit ? gfMapGenre(hit.primaryGenreName) : [], ok: true };
}

// fills a.genres on every artist object that has none. the same artist shows up
// in several lists (three time ranges) - looked up once, written to all of them.
//   onProgress(done, total)   fires per lookup so a loading screen can count along
//   opts.max                  only look up this many (the rest stay for a later call)
//   opts.concurrency          parallel lookups (default 3)
//   opts.gapMs                pause after each lookup, to stay under apple's limit
//   opts.stopOnThrottle       give up the moment apple pushes back (no sleeping) - for
//                             a loading screen someone is staring at
//   opts.maxPauses            how many throttles to wait out before giving up (default 2)
//   opts.backoffMs            how long to wait out a throttle (default GF_BACKOFF_MS)
// returns { looked, filled, throttled, remaining, cached }
async function fillGenres(artists, onProgress, opts) {
  const o = Object.assign({ max: Infinity, concurrency: 3, gapMs: 0, stopOnThrottle: false, maxPauses: 2, backoffMs: GF_BACKOFF_MS }, opts || {});
  const cache = gfLoadCache();
  const now = Date.now();
  const byId = new Map();
  for (const a of artists) {
    if (!a || !a.id) continue;
    if (!byId.has(a.id)) byId.set(a.id, []);
    byId.get(a.id).push(a);
  }
  const todo = [];
  for (const [id, objs] of byId) {
    const known = objs.find(a => a.genres && a.genres.length);
    if (known) { objs.forEach(a => { if (!a.genres || !a.genres.length) a.genres = known.genres.slice(); }); continue; }
    const c = cache[id];
    if (c && Array.isArray(c.g) && (now - c.t) < (c.g.length ? GF_TTL_HIT : GF_TTL_MISS)) {
      objs.forEach(a => { a.genres = c.g.slice(); });
      continue;
    }
    objs.forEach(a => { if (!Array.isArray(a.genres)) a.genres = []; });
    todo.push({ id, name: objs[0].name || '', objs });
  }
  const batch = todo.slice(0, o.max);
  const total = batch.length;
  let done = 0, filled = 0, throttled = 0, pauses = 0, i = 0;
  let stopped = false;
  const worker = async () => {
    while (i < batch.length) {
      if (stopped || pauses >= o.maxPauses) return;   // apple is clearly rate-limiting us: leave the rest for next time
      const item = batch[i++];
      const res = item.name ? await gfLookup(item.name) : { g: [], ok: true };
      if (!res.ok) {
        // a throttle is not a miss: cache nothing. either bail right now (loading
        // screen) or wait it out once and carry on (background)
        throttled++;
        if (onProgress) onProgress(done, total);
        if (o.stopOnThrottle) { stopped = true; return; }
        pauses++;
        await new Promise(r => setTimeout(r, o.backoffMs));
        continue;
      }
      item.objs.forEach(a => { a.genres = res.g.slice(); });
      cache[item.id] = { g: res.g, t: Date.now() };
      if (res.g.length) filled++;
      done++;
      if (onProgress) onProgress(done, total);
      if (o.gapMs) await new Promise(r => setTimeout(r, o.gapMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency, batch.length) }, worker));
  if (done) gfSaveCache(cache);
  return { looked: done, filled, throttled, remaining: todo.length - done, cached: byId.size - todo.length };
}

window.fillGenres = fillGenres;
