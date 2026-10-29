// ============================================================
//  xXx SparkleStats xXx  -  app.js
//  ★ PUT YOUR SPOTIFY CLIENT ID ON THE NEXT LINE ★
// ============================================================
const CLIENT_ID = 'e07e7911ee904f7fa15a34d32efc8979';
// ============================================================

// spotify banned "localhost" in redirect URIs - it's https domains or the
// loopback IP only. so locally you MUST browse to 127.0.0.1, not localhost.
if (location.hostname === 'localhost') {
  location.replace(location.href.replace('//localhost', '//127.0.0.1'));
}
// works at the root (netlify) or in a subfolder (github pages /sparkle-stats/)
const SITE_BASE = location.pathname.replace(/[^/]*$/, '');
const SITE_URL = location.origin + SITE_BASE;
const REDIRECT_URI = SITE_URL + 'callback';
const SCOPES = 'user-read-private user-read-email user-top-read user-read-recently-played playlist-read-private playlist-read-collaborative user-library-read user-follow-read playlist-modify-private playlist-modify-public';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

// ======================== PKCE AUTH ========================

function generateVerifier(len = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const vals = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(vals, v => chars[v % chars.length]).join('');
}

async function generateChallenge(verifier) {
  if (window.crypto && window.crypto.subtle) {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  // Fallback for non-HTTPS (LAN access) using js-sha256
  const hashHex = sha256(verifier);
  const bytes = new Uint8Array(hashHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function login() {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  localStorage.setItem('pkce_verifier', verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = AUTH_URL + '?' + params;
}

async function exchangeCode(code) {
  const verifier = localStorage.getItem('pkce_verifier');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope || '',
  };
  localStorage.setItem('sp_tokens', JSON.stringify(tokens));
  localStorage.removeItem('pkce_verifier');
  return tokens;
}

async function refreshToken() {
  const tokens = JSON.parse(localStorage.getItem('sp_tokens'));
  if (!tokens) return null;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: CLIENT_ID,
    }),
  });
  if (!res.ok) { logout(); return null; }
  const data = await res.json();
  const updated = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope || tokens.scope || '',
  };
  localStorage.setItem('sp_tokens', JSON.stringify(updated));
  return updated;
}

function logout() {
  localStorage.removeItem('sp_tokens');
  window.location.href = SITE_BASE;
}

async function getToken() {
  const raw = localStorage.getItem('sp_tokens');
  if (!raw) return null;
  let tokens = JSON.parse(raw);
  if (Date.now() >= tokens.expires_at - 60000) {
    tokens = await refreshToken();
  }
  return tokens?.access_token || null;
}

// ======================== API ========================

async function apiFetch(path) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get('Retry-After') || '1');
    await new Promise(r => setTimeout(r, retry * 1000));
    return apiFetch(path);
  }
  if (res.status === 401) { logout(); throw new Error('Auth expired'); }
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

async function fetchAll() {
  const [me, ts, tm, tl, as, am, al, recent] = await Promise.all([
    apiFetch('/me'),
    apiFetch('/me/top/tracks?time_range=short_term&limit=50'),
    apiFetch('/me/top/tracks?time_range=medium_term&limit=50'),
    apiFetch('/me/top/tracks?time_range=long_term&limit=50'),
    apiFetch('/me/top/artists?time_range=short_term&limit=50'),
    apiFetch('/me/top/artists?time_range=medium_term&limit=50'),
    apiFetch('/me/top/artists?time_range=long_term&limit=50'),
    apiFetch('/me/player/recently-played?limit=50'),
  ]);
  return {
    user: me,
    tracks: { short_term: ts.items, medium_term: tm.items, long_term: tl.items },
    artists: { short_term: as.items, medium_term: am.items, long_term: al.items },
    recent: recent.items || [],
  };
}

// ======================== ANALYSIS ENGINE ========================

function analyzeGenres(artists) {
  const weights = { short_term: 1.5, medium_term: 1.0, long_term: 0.7 };
  const counts = {};
  for (const [range, list] of Object.entries(artists)) {
    const w = weights[range];
    for (const a of list) for (const g of (a.genres || [])) {
      const n = g.toLowerCase().trim();
      counts[n] = (counts[n] || 0) + w;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ranked = Object.entries(counts)
    .map(([genre, count]) => ({ genre, count, pct: total ? (count / total * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  return { ranked, total, topGenre: ranked[0]?.genre || 'unknown', uniqueCount: Object.keys(counts).length, counts };
}

function analyzeDecades(tracks) {
  const seen = new Set();
  const buckets = {};
  let yearSum = 0, yearCount = 0;
  for (const list of Object.values(tracks)) for (const t of list) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const y = parseInt((t.album.release_date || '').substring(0, 4));
    if (!y) continue;
    const dec = Math.floor(y / 10) * 10 + 's';
    buckets[dec] = (buckets[dec] || 0) + 1;
    yearSum += y; yearCount++;
  }
  const total = yearCount;
  const distribution = Object.entries(buckets)
    .map(([decade, count]) => ({ decade, count, pct: total ? count / total * 100 : 0 }))
    .sort((a, b) => parseInt(a.decade) - parseInt(b.decade));
  const dominant = distribution.reduce((m, d) => d.count > m.count ? d : m, { decade: '2020s', count: 0 }).decade;
  return { distribution, dominant, avgYear: yearCount ? Math.round(yearSum / yearCount) : 2020 };
}

function analyzeTrackStats(tracks) {
  const seen = new Set();
  const unique = [];
  for (const list of Object.values(tracks)) for (const t of list) {
    if (!seen.has(t.id)) { seen.add(t.id); unique.push(t); }
  }
  if (!unique.length) return { longest: null, shortest: null, avgMs: 0, explicitPct: 0, total: 0 };
  const sorted = [...unique].sort((a, b) => a.duration_ms - b.duration_ms);
  const explicit = unique.filter(t => t.explicit).length;
  const totalMs = unique.reduce((s, t) => s + t.duration_ms, 0);
  return {
    longest: sorted[sorted.length - 1],
    shortest: sorted[0],
    avgMs: Math.round(totalMs / unique.length),
    explicitPct: Math.round(explicit / unique.length * 100),
    total: unique.length,
  };
}

function computeMood(genreProfile) {
  const keys = ['melancholy', 'energy', 'angst', 'chill', 'hype', 'romance', 'darkness', 'quirkiness'];
  const sums = {}; keys.forEach(k => sums[k] = 0);
  let weight = 0;
  for (const { genre, count } of genreProfile.ranked.slice(0, 50)) {
    const m = window.getGenreMood(genre);
    for (const k of keys) sums[k] += m[k] * count;
    weight += count;
  }
  const mood = {};
  keys.forEach(k => mood[k] = weight ? Math.round(sums[k] / weight) : 50);
  let dominant = 'energy', max = 0;
  for (const k of keys) if (mood[k] > max) { max = mood[k]; dominant = k; }
  return { mood, dominant };
}

function computeObscurity(genreProfile) {
  let rSum = 0, wSum = 0;
  for (const { genre, count } of genreProfile.ranked) {
    rSum += window.getGenreRarity(genre) * count;
    wSum += count;
  }
  const rarityAvg = wSum ? rSum / wSum : 50;
  const avgWords = genreProfile.ranked.length
    ? genreProfile.ranked.reduce((s, g) => s + g.genre.split(/\s+/).length, 0) / genreProfile.ranked.length : 1;
  const specificity = Math.min(100, avgWords * 25);
  const score = Math.min(100, Math.max(0, Math.round(rarityAvg * 0.65 + specificity * 0.35)));
  const labels = [
    [90, 'Underground Legend'], [75, 'Hipster Overlord'], [60, 'Off the Beaten Path'],
    [45, 'Curious Explorer'], [30, 'Mainstream-Adjacent'], [15, 'Chart Hugger'], [0, "Billboard's BFF"],
  ];
  const label = labels.find(([t]) => score >= t)[1];
  return { score, label };
}

function computeDiversity(genreProfile) {
  const entries = Object.entries(genreProfile.counts);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (!total) return { score: 0, label: 'N/A' };
  let entropy = 0;
  for (const [, c] of entries) { const p = c / total; if (p > 0) entropy -= p * Math.log2(p); }
  const maxE = entries.length > 1 ? Math.log2(entries.length) : 1;
  const norm = Math.round((entropy / maxE) * 100);
  const bonus = Math.min(20, entries.length * 0.5);
  const score = Math.min(100, Math.round(norm * 0.8 + bonus));
  const labels = [
    [90, 'Genre Anarchist'], [75, 'Musical Omnivore'], [60, 'Well-Rounded'],
    [45, 'Comfort Zone Explorer'], [30, 'Creature of Habit'], [15, 'Tunnel Vision'], [0, 'One-Trick Pony'],
  ];
  const label = labels.find(([t]) => score >= t)[1];
  return { score, label };
}

// ======================== PERSONALITY ========================

const ARCHETYPES = [
  { id: 'sad-boi', name: 'Sad Boi/Girl', emoji: '😢', tag: 'tears as a lifestyle',
    desc: "you live in your feelings and honestly? you thrive there. your playlists are basically emotional support. you've cried to at least 3 of your top 10 tracks this week.",
    score: s => avg(s.melancholy * 1.5, s.angst * 0.9, (100 - s.energy) * 0.7),
    gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)' },
  { id: 'hype-beast', name: 'Hype Beast', emoji: '🔥', tag: 'permanently pre-gaming',
    desc: "you ARE the party. your music is pure adrenaline. you skip the slow intros, crank the bass, and make everyone listen to your hype playlist at full volume.",
    score: s => avg(s.energy * 1.4, s.hype * 1.5, (100 - s.melancholy) * 0.6),
    gradient: 'linear-gradient(135deg, #ff416c, #ff4b2b)' },
  { id: 'indie-kid', name: 'Indie Kid', emoji: '🎸', tag: "you probably haven't heard of them",
    desc: "you found your fav band on a blog post from 2014 and you've been gatekeeping since. your spotify is a curated museum of artists with under 10k listeners.",
    score: s => avg(s.quirkiness * 1.0, s.obscurity * 1.5, s.melancholy * 0.4),
    gradient: 'linear-gradient(135deg, #2d1b4e, #1a1a2e)' },
  { id: 'emo-royalty', name: 'Emo Royalty', emoji: '🖤', tag: "it's not a phase mom",
    desc: "MCR isn't just a band, it's a way of life. your eyeliner is sharp, your feelings are sharper, and your playlist reads like a diary entry from 2007.",
    score: s => avg(s.angst * 1.5, s.melancholy * 1.1, s.darkness * 0.9, s.energy * 0.5),
    gradient: 'linear-gradient(135deg, #0f0c29, #302b63)' },
  { id: 'chill-pill', name: 'Chill Pill', emoji: '🌊', tag: 'vibes only, no thoughts',
    desc: "your heart rate has never exceeded 80bpm and your music proves it. lo-fi beats, ambient textures, anything that sounds like a sunset.",
    score: s => avg(s.chill * 1.6, (100 - s.energy) * 1.0, (100 - s.angst) * 0.6),
    gradient: 'linear-gradient(135deg, #0d1b2a, #1b2838)' },
  { id: 'dark-sovereign', name: 'Dark Sovereign', emoji: '💀', tag: 'the night is my domain',
    desc: "your playlist would make a horror movie soundtrack jealous. you've explored the deepest, heaviest corners of music and came back stronger.",
    score: s => avg(s.darkness * 1.6, s.angst * 0.8, s.energy * 0.6, (100 - s.romance) * 0.4),
    gradient: 'linear-gradient(135deg, #0a0a0a, #1a0a1a)' },
  { id: 'hopeless-romantic', name: 'Hopeless Romantic', emoji: '💘', tag: 'slow dances alone at 2am',
    desc: "every song is a love letter and you are LIVING. your playlists are named 'thinking of you' and '3am feelings'. you've imagined movie scenes to half your top tracks.",
    score: s => avg(s.romance * 1.6, s.melancholy * 0.8, (100 - s.energy) * 0.5),
    gradient: 'linear-gradient(135deg, #2d1525, #1a0a15)' },
  { id: 'genre-chameleon', name: 'Genre Chameleon', emoji: '🦎', tag: 'no genre is safe',
    desc: "your on-repeat looks like someone shuffled every genre on spotify and said 'yes all of it'. you go from death metal to bossa nova in the same hour.",
    score: s => clamp(s.diversity * 1.8 + s.quirkiness * 0.3 - 30),
    gradient: 'linear-gradient(135deg, #1a2a1a, #1a1a2a)' },
  { id: 'throwback', name: 'Throwback Machine', emoji: '📼', tag: 'born in the wrong decade',
    desc: "you know every word to songs from before you were born. modern music? meh. you're vibing to the classics and wearing that title like a crown.",
    score: s => clamp(s.avgDecade < 2005 ? (2005 - s.avgDecade) * 3 + 40 : 10),
    gradient: 'linear-gradient(135deg, #2a1a0a, #1a1510)' },
  { id: 'pop-royalty', name: 'Pop Princess/Prince', emoji: '👑', tag: 'top 40 apologist and proud',
    desc: "you know every TikTok sound, every chart-topper. your playlists are basically the Billboard Hot 100 and you have ZERO shame. pop is art.",
    score: s => clamp(s.mainstream > 55 ? avg(s.mainstream * 1.2, s.hype * 0.8, (100 - s.darkness) * 0.5) : 15),
    gradient: 'linear-gradient(135deg, #2a1520, #1a0a15)' },
  { id: 'noise-goblin', name: 'Noise Goblin', emoji: '👹', tag: 'experimental and unhinged',
    desc: "your music scares your friends and you LOVE that. you've gone down rabbit holes of experimental sounds most people didn't know existed. unhinged and thriving.",
    score: s => avg(s.quirkiness * 1.4, s.darkness * 0.8, s.obscurity * 0.8, s.energy * 0.5),
    gradient: 'linear-gradient(135deg, #1a0a2a, #2a1020)' },
  { id: 'main-character', name: 'Main Character', emoji: '🎬', tag: 'every song is a movie scene',
    desc: "you don't just listen, you EXPERIENCE. every song is the soundtrack to your movie. you've stared dramatically out a car window to at least 5 of your top tracks.",
    score: s => avg(s.romance * 0.6, s.energy * 0.6, s.melancholy * 0.6, s.diversity * 0.5, 40),
    gradient: 'linear-gradient(135deg, #1a1030, #201a2a)' },
];

const ROASTS = {
  'Sad Boi/Girl': [
    "your top artist is {artist} and honestly that tracks. {pct}% of your music is {genre} which means you're basically a walking rain cloud with great taste. someone get this person a hug and a playlist called 'it gets better (but these songs slap while it doesn't)'.",
    "you listened to '{track}' on repeat and we're concerned but also impressed by your commitment to the aesthetic. {score}% obscurity score means you don't even cry to mainstream songs. respect.",
  ],
  'Hype Beast': [
    "you and {artist} are in a committed relationship and the rest of us just have to deal with it. {pct}% {genre}?? your aux cord privileges should come with a volume warning label.",
    "'{track}' is your anthem and honestly we can hear it from here. your entire personality is 'the beat drop' and we wouldn't have it any other way.",
  ],
  'Indie Kid': [
    "you stan {artist} and you'll make sure EVERYONE knows about it. your {score}% obscurity score means you physically cannot enjoy something once it hits 100k plays. it's a condition.",
    "'{track}' is your personality and {genre} is your religion. you've said 'you probably haven't heard of them' so many times it's basically your catchphrase.",
  ],
  'Emo Royalty': [
    "{artist} runs your life and {genre} runs your soul. {pct}% of your library would make Gerard Way proud. you didn't choose the emo life, the emo life chose you (in 2007 and you never left).",
    "your top track is '{track}' and we KNOW you scream-sing it in the car. your wardrobe is 90% black and your music taste confirms this is not a phase.",
  ],
  'Chill Pill': [
    "your top artist is {artist} and we're getting sleepy just reading that. {genre} at {pct}%?? your spotify is basically a white noise machine with better production value.",
    "you listened to '{track}' and probably fell asleep before it ended. no shade, that's talent. your vibe is 'horizontal' and we respect it.",
  ],
  'Dark Sovereign': [
    "{artist} is your ruler and {genre} is your kingdom. {pct}% of your library would set off a metal detector. you wear sunglasses indoors because the darkness is your brand.",
    "'{track}' is what you play to scare away door-to-door salespeople. your {score}% obscurity score means you've descended to musical depths most fear to tread.",
  ],
  'Hopeless Romantic': [
    "you and {artist} are in a love story that {artist} doesn't know about yet. {pct}% {genre}?? your heart is on your sleeve and your playlist is the proof.",
    "'{track}' made you feel things and now it's your whole personality. you've written 'thinking of you' on at least 3 playlists. we see you.",
  ],
  'Genre Chameleon': [
    "your top artist is {artist} but honestly that changes every 4 hours. {div}% diversity score means your taste has commitment issues and we love that for you.",
    "you went from '{track}' to god knows what in the span of an afternoon. {genre} is your top genre but like, barely. you're a beautiful mess.",
  ],
  'Throwback Machine': [
    "your top artist is {artist} and your average release year is {decade}. you were born in the wrong era and your spotify wrapped proves it every year.",
    "'{track}' is older than most of your friend group. you say 'they don't make music like they used to' at least twice a week. valid honestly.",
  ],
  'Pop Princess/Prince': [
    "{artist} is your bestie and {genre} is your oxygen. you know the choreography to '{track}' and you WILL perform it at any given moment.",
    "your spotify is basically the Billboard Hot 100 with a {pct}% {genre} twist. you unironically say 'this song is a bop' and you are correct every time.",
  ],
  'Noise Goblin': [
    "{artist} is your spirit animal and {genre} is your battle cry. your {score}% obscurity score means you've ascended past normal music into sonic chaos.",
    "you played '{track}' for your friends and they asked you to stop. you took that as a compliment. {pct}% {genre} and zero regrets.",
  ],
  'Main Character': [
    "you and {artist} are co-directing the movie of your life. '{track}' plays during your emotional climax scene. {genre} is the genre of your coming-of-age film.",
    "your {div}% diversity score means your soundtrack has range. one minute it's a montage, next it's the breakup scene. your life is cinema and {artist} is the score.",
  ],
};

function avg(...vals) { return vals.reduce((a, b) => a + b, 0) / vals.length; }
function clamp(v) { return Math.max(0, Math.min(100, v)); }

function matchPersonality(mood, obscurity, diversity, avgDecade) {
  const s = {
    ...mood,
    obscurity: obscurity.score,
    mainstream: 100 - obscurity.score,
    diversity: diversity.score,
    avgDecade,
  };
  const results = ARCHETYPES
    .map(a => ({ arch: a, score: clamp(a.score(s)) }))
    .sort((a, b) => b.score - a.score);
  return { primary: results[0].arch, secondary: results[1].arch, confidence: Math.round(results[0].score) };
}

function generateRoast(archName, data) {
  const templates = ROASTS[archName];
  if (!templates || !templates.length) return "your music taste is... something. we're still processing.";
  const t = templates[Math.floor(Math.random() * templates.length)];
  return t
    .replace(/{artist}/g, data.artist)
    .replace(/{track}/g, data.track)
    .replace(/{genre}/g, data.genre)
    .replace(/{pct}/g, data.pct)
    .replace(/{score}/g, data.obscurity)
    .replace(/{div}/g, data.diversity)
    .replace(/{decade}/g, data.decade);
}

// ======================== SCENE NAME GEN ========================

function generateSceneName(mood) {
  const adjs = {
    melancholy: ['Broken', 'Fallen', 'Silent', 'Fading', 'Hollow'],
    energy: ['Raging', 'Electric', 'Blazing', 'Sonic', 'Atomic'],
    angst: ['Screaming', 'Shattered', 'Torn', 'Wrecked', 'Chaos'],
    chill: ['Dreamy', 'Velvet', 'Cosmic', 'Lunar', 'Hazy'],
    hype: ['Neon', 'Flash', 'Ultra', 'Mega', 'Blitz'],
    romance: ['Starlit', 'Lovesick', 'Moonlit', 'Blushing', 'Petal'],
    darkness: ['Shadow', 'Phantom', 'Void', 'Obsidian', 'Raven'],
    quirkiness: ['Sparkle', 'Pixel', 'Glitch', 'Fizzy', 'Disco'],
  };
  const nouns = ['Heart', 'Scream', 'Dream', 'Star', 'Rose', 'Skull', 'Kiss', 'Storm', 'Angel', 'Ghost', 'Riot', 'Echo', 'Dagger', 'Ember', 'Frost'];
  const decs = [['xXx_','_xXx'], ['~*','*~'], ['x_','_x'], ['..x','x..'], ['xx_','_xx']];
  const adj = pick(adjs[mood] || adjs.melancholy);
  const noun = pick(nouns);
  const dec = pick(decs);
  return dec[0] + adj + noun + dec[1];
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ======================== BINGO ========================

function makeBingo(analysis) {
  // how much of your genre profile belongs to a family - so one 0.3% genre
  // can't light a cell, and "pop" doesn't fire because of pop punk.
  const share = (re, excl) => analysis.genres.ranked
    .filter(g => re.test(g.genre) && !(excl && excl.test(g.genre)))
    .reduce((s, g) => s + g.pct, 0);
  const mood = analysis.moodData.mood;
  const cells = [
    ['a song over 7 min', () => analysis.trackStats.longest && analysis.trackStats.longest.duration_ms > 420000],
    ['10+ genres', () => analysis.genres.uniqueCount >= 10],
    ['25+ genres', () => analysis.genres.uniqueCount >= 25],
    ['emo (for real)', () => share(/\bemo\b/) >= 8],
    ['actual pop', () => share(/\bpop\b/, /pop punk|pop rock|pop metal|noise pop|dream pop/) >= 10],
    ['rap / hip hop', () => share(/\b(rap|hip hop|hip-hop|drill|trap)\b/, /trap metal/) >= 8],
    ['rock', () => share(/\brock\b/) >= 10],
    ['metal', () => share(/metal/) >= 8],
    ['indie', () => share(/\bindie\b/) >= 8],
    ['punk / hardcore', () => share(/\bpunk\b|hardcore/) >= 8],
    ['half explicit', () => analysis.trackStats.explicitPct >= 50],
    ['obscurity 50+', () => analysis.obscurity.score >= 50],
    ['obscurity 75+', () => analysis.obscurity.score >= 75],
    ['diversity 50+', () => analysis.diversity.score >= 50],
    ['diversity 75+', () => analysis.diversity.score >= 75],
    ['pre-2000s taste', () => parseInt(analysis.decades.dominant) < 2000],
    ['2020s kid', () => analysis.decades.dominant === '2020s'],
    ['avg song < 3 min', () => analysis.trackStats.avgMs < 180000],
    ['avg song > 5 min', () => analysis.trackStats.avgMs > 300000],
    ['100+ different songs', () => analysis.trackStats.total >= 100],
    ['melancholy 65+', () => mood.melancholy >= 65],
    ['energy 65+', () => mood.energy >= 65],
    ['chill 65+', () => mood.chill >= 65],
    ['angst 65+', () => mood.angst >= 65],
    ['darkness 65+', () => mood.darkness >= 65],
    ['romance 65+', () => mood.romance >= 65],
  ];
  // real shuffle (sort() with a random comparator is biased), then 24 + free space
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const board = cells.slice(0, 24);
  board.splice(12, 0, ['FREE SPACE ★', () => true]);
  return board;
}

// ======================== HELPERS ========================

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  return m + ':' + String(s % 60).padStart(2, '0');
}

function img(images, size) {
  if (!images || !images.length) return '';
  if (size === 'sm') return images[images.length > 1 ? images.length - 1 : 0]?.url || '';
  return images[0]?.url || '';
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// little pink notice at the bottom of the screen, gone after a few seconds
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 8000);
}

function getExplicitLabel(pct) {
  if (pct >= 80) return '🤬 FCC Nightmare';
  if (pct >= 60) return '😈 Parental Advisory';
  if (pct >= 40) return '🌶️ Spicy Vocabulary';
  if (pct >= 20) return '😏 Mild Sauce';
  return '😇 PG Vibes';
}

function getEmojis(genreProfile) {
  const map = window.GENRE_DATA?.emojiMap || {};
  const result = [];
  const seen = new Set();
  for (const { genre } of genreProfile.ranked.slice(0, 20)) {
    let emoji = map[genre];
    if (!emoji) {
      for (const [k, v] of Object.entries(map)) {
        if (genre.includes(k) || k.includes(genre)) { emoji = v; break; }
      }
    }
    if (emoji && !seen.has(emoji)) { result.push({ genre, emoji }); seen.add(emoji); }
  }
  return result;
}

function getVibeStatement(dominant) {
  const stmts = {
    melancholy: 'you\'re giving sad hours 24/7... someone check on this person',
    energy: 'you literally never stop moving. pure adrenaline.',
    angst: 'you have a LOT of feelings and your music is screaming them',
    chill: 'you\'re so chill you\'re basically horizontal. vibes immaculate.',
    hype: 'every day is a party and you\'re the DJ. permanent hype mode.',
    romance: "you're living in a romance novel and it's beautiful honestly",
    darkness: 'you listen to music in the dark and honestly it fits',
    quirkiness: 'your taste is unhinged in the best way. wonderfully weird.',
  };
  return stmts[dominant] || 'your music taste is... a whole vibe';
}

// ======================== LISTENING TIME ========================

function analyzeListeningTime(recent) {
  if (!recent.length) return { recentMs: 0, dailyMs: 0, weeklyMs: 0, monthlyMs: 0, twoMonthMs: 0, yearlyMs: 0 };

  // Sum duration of all recently played tracks
  const recentMs = recent.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);

  // Figure out the time span of our recent data
  const timestamps = recent.filter(r => r.played_at).map(r => new Date(r.played_at).getTime());
  if (timestamps.length < 2) {
    return { recentMs, dailyMs: recentMs, weeklyMs: recentMs * 7, monthlyMs: recentMs * 30, twoMonthMs: recentMs * 60, yearlyMs: recentMs * 365 };
  }

  const newest = Math.max(...timestamps);
  const oldest = Math.min(...timestamps);
  const spanMs = newest - oldest;
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  // Extrapolate to daily rate, then multiply out
  const dailyMs = spanDays > 0 ? recentMs / spanDays : recentMs;
  const weeklyMs = dailyMs * 7;
  const monthlyMs = dailyMs * 30;
  const yearlyMs = dailyMs * 365;

  const twoMonthMs = dailyMs * 60;

  return { recentMs, dailyMs, weeklyMs, monthlyMs, twoMonthMs, yearlyMs, spanDays: Math.round(spanDays * 10) / 10 };
}

function fmtMinutes(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin >= 1440) {
    const days = Math.floor(totalMin / 1440);
    const hrs = Math.floor((totalMin % 1440) / 60);
    return days + 'd ' + hrs + 'h';
  }
  if (totalMin >= 60) {
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return hrs + 'h ' + mins + 'm';
  }
  return totalMin + ' min';
}

// ======================== LISTENING CLOCK ========================

function analyzeListeningClock(recent) {
  const hours = new Array(24).fill(0);
  for (const item of recent) {
    if (!item.played_at) continue;
    const h = new Date(item.played_at).getHours();
    hours[h]++;
  }
  const max = Math.max(...hours, 1);
  const peakHour = hours.indexOf(max);
  const nightOwl = hours.slice(22).reduce((a,b)=>a+b,0) + hours.slice(0,5).reduce((a,b)=>a+b,0);
  const earlyBird = hours.slice(5, 12).reduce((a,b)=>a+b,0);
  const total = hours.reduce((a,b)=>a+b,0);
  let chronotype = 'Afternoon Listener';
  if (nightOwl > total * 0.4) chronotype = 'Night Owl';
  else if (earlyBird > total * 0.4) chronotype = 'Early Bird';
  else if (hours.slice(12,18).reduce((a,b)=>a+b,0) > total * 0.4) chronotype = 'Afternoon Viber';
  else if (hours.slice(18,22).reduce((a,b)=>a+b,0) > total * 0.35) chronotype = 'Evening Listener';
  return { hours, max, peakHour, chronotype };
}

// ======================== ARTIST LOYALTY ========================

function analyzeArtistLoyalty(artists) {
  const appearances = {};
  for (const [range, list] of Object.entries(artists)) {
    for (const a of list) {
      if (!appearances[a.id]) appearances[a.id] = { artist: a, ranges: [] };
      appearances[a.id].ranges.push(range);
    }
  }
  const rideOrDie = [];
  const seasonal = [];
  for (const { artist, ranges } of Object.values(appearances)) {
    const unique = [...new Set(ranges)];
    if (unique.length === 3) rideOrDie.push(artist);
    else if (unique.length === 1 && unique[0] === 'short_term') seasonal.push(artist);
  }
  return { rideOrDie: rideOrDie.slice(0, 8), seasonal: seasonal.slice(0, 6) };
}

// ======================== REPEAT TRACKS ========================

function analyzeRepeatTracks(tracks) {
  const appearances = {};
  for (const [range, list] of Object.entries(tracks)) {
    for (const t of list) {
      if (!appearances[t.id]) appearances[t.id] = { track: t, ranges: [] };
      appearances[t.id].ranges.push(range);
    }
  }
  return Object.values(appearances)
    .filter(x => x.ranges.length >= 2)
    .sort((a, b) => b.ranges.length - a.ranges.length)
    .slice(0, 10);
}

// ======================== FLAGS ========================

function generateFlags(analysis, data) {
  const red = [];
  const green = [];

  // Red flags
  if (analysis.trackStats.explicitPct >= 70) red.push('70%+ of your music is explicit');
  if (analysis.obscurity.score >= 80) red.push('so hipster you cant share music with anyone');
  if (analysis.moodData.mood.melancholy >= 75) red.push('your playlists are emotional warfare');
  if (analysis.moodData.mood.angst >= 75) red.push("you're still processing something from 2007");
  if (analysis.moodData.mood.darkness >= 70) red.push('your music scares small children');
  if (analysis.genres.uniqueCount < 5) red.push('you only listen to ' + analysis.genres.uniqueCount + ' genres. branch out bestie');
  if (analysis.decades.avgYear < 2000) red.push('you gatekeep music from before you were born');
  const topPct = analysis.genres.ranked[0]?.pct || 0;
  if (topPct > 30) red.push(Math.round(topPct) + '% of your genres is just ' + analysis.genres.topGenre);
  if (analysis.trackStats.avgMs > 360000) red.push('average song over 6 min. you test peoples patience');

  // Green flags
  if (analysis.diversity.score >= 70) green.push('musically diverse. you contain multitudes');
  if (analysis.moodData.mood.romance >= 60) green.push('hopeless romantic energy. 10/10 playlist date');
  if (analysis.moodData.mood.chill >= 60) green.push('chill vibes. great road trip companion');
  if (analysis.genres.uniqueCount >= 20) green.push(analysis.genres.uniqueCount + ' genres! open-minded legend');
  if (analysis.moodData.mood.energy >= 65 && analysis.moodData.mood.hype >= 60) green.push('life of the party. amazing aux cord energy');
  if (analysis.obscurity.score >= 40 && analysis.obscurity.score <= 65) green.push('balanced taste. knows the hits AND the deep cuts');
  if (analysis.trackStats.explicitPct < 30) green.push('clean library. safe to play around grandma');
  if (analysis.moodData.mood.quirkiness >= 60) green.push('wonderfully weird taste. never boring');

  // Ensure at least 3 each
  const defaultRed = ['has committed to the sad hours lifestyle', 'will judge your spotify wrapped', 'takes aux cord too seriously'];
  const defaultGreen = ['has great taste (probably)', 'would make you a fire playlist', 'music taste has LAYERS'];
  while (red.length < 3) red.push(defaultRed[red.length % defaultRed.length]);
  while (green.length < 3) green.push(defaultGreen[green.length % defaultGreen.length]);

  return { red: red.slice(0, 5), green: green.slice(0, 5) };
}

// ======================== TASTE SUMMARY ========================

function generateTasteSummary(analysis, topArtist) {
  const { moodData, genres, obscurity, diversity, decades } = analysis;
  const moodWord = {
    melancholy: 'emotionally devastated',
    energy: 'permanently caffeinated',
    angst: 'internally screaming',
    chill: 'perpetually horizontal',
    hype: 'always pre-gaming',
    romance: 'chronically lovesick',
    darkness: 'embracing the void',
    quirkiness: 'delightfully unhinged',
  }[moodData.dominant] || 'vibing';

  const obscWord = obscurity.score >= 70 ? 'underground' : obscurity.score >= 40 ? 'curated' : 'mainstream';
  const divWord = diversity.score >= 70 ? 'chaotic' : diversity.score >= 40 ? 'eclectic' : 'focused';
  const decWord = decades.avgYear < 2000 ? 'nostalgic' : decades.avgYear < 2015 ? 'throwback-loving' : 'current';

  return `a <span class="hl">${moodWord}</span> listener with <span class="hl">${obscWord}</span>, <span class="hl">${divWord}</span> taste who's basically a <span class="hl">${decWord}</span> <span class="hl">${genres.topGenre}</span> devotee with <span class="hl">${topArtist}</span> on speed dial`;
}

// ======================== ALIGNMENT CHART ========================

function getAlignment(mood, obscurity, diversity) {
  // Lawful/Neutral/Chaotic based on diversity + quirkiness
  let order;
  const chaos = (diversity.score * 0.6 + mood.quirkiness * 0.4);
  if (chaos >= 65) order = 'Chaotic';
  else if (chaos >= 35) order = 'Neutral';
  else order = 'Lawful';

  // Good/Neutral/Evil based on darkness + angst vs romance + chill
  const light = (mood.romance + mood.chill) / 2;
  const dark = (mood.darkness + mood.angst) / 2;
  let moral;
  if (light - dark > 15) moral = 'Good';
  else if (dark - light > 15) moral = 'Evil';
  else moral = 'Neutral';

  const alignment = order + ' ' + moral;
  const descriptions = {
    'Lawful Good': 'you have a very wholesome, consistent playlist. your music is a warm hug.',
    'Lawful Neutral': 'you stick to what you know and you know what you like. reliable taste.',
    'Lawful Evil': 'your playlist is organized but DARK. curated chaos in a neat package.',
    'Neutral Good': 'balanced and kind vibes. you\'re the friend everyone trusts with the aux.',
    'Neutral Neutral': 'perfectly balanced. you contain a bit of everything. true neutral energy.',
    'Neutral Evil': 'your taste has an edge but you keep it controlled. lowkey menacing.',
    'Chaotic Good': 'your playlist is a beautiful mess of good vibes across every genre.',
    'Chaotic Neutral': 'nobody can predict your next song. you live for the chaos.',
    'Chaotic Evil': 'your playlist would make a horror movie director nervous. unhinged icon.',
  };
  return { alignment, description: descriptions[alignment] || 'your music defies classification' };
}

// ======================== MUSIC TASTE AGE ========================

function getMusicTasteAge(decades, mood, obscurity) {
  let age = 22; // base age
  // Older music = older taste
  if (decades.avgYear < 1990) age += 25;
  else if (decades.avgYear < 2000) age += 15;
  else if (decades.avgYear < 2010) age += 8;
  else if (decades.avgYear < 2020) age += 3;
  else age -= 3;
  // High obscurity = older (hipsters are old souls)
  age += Math.floor((obscurity.score - 50) * 0.15);
  // High energy/hype = younger
  age -= Math.floor((mood.energy + mood.hype - 100) * 0.08);
  // High melancholy = older
  age += Math.floor((mood.melancholy - 50) * 0.1);
  age = Math.max(13, Math.min(75, age));
  let label;
  if (age <= 16) label = 'baby zoomer. your taste is brand new and buzzing.';
  else if (age <= 22) label = 'peak gen z energy. very online, very current.';
  else if (age <= 30) label = 'millennial core. you grew up in the golden age of music discovery.';
  else if (age <= 40) label = 'elder millennial vibes. your taste has DEPTH.';
  else if (age <= 55) label = 'gen x soul. you appreciate the classics and have no time for trends.';
  else label = 'boomer in the best way. your taste is timeless.';
  return { age, label };
}

// ======================== FRIDAY NIGHT ========================

function getFridayNight(mood, personality) {
  const scenarios = {
    melancholy: 'crying to your playlist in the dark with fairy lights on. its called self care.',
    energy: 'pre-gaming at 7pm and not stopping until 3am. your playlist is the warmup.',
    angst: 'aggressively singing along to your entire queue alone in your car in a parking lot.',
    chill: 'horizontal on the couch with lo-fi playing. you might make tea. wild night.',
    hype: 'getting ready for 2 hours because the vibes have to be IMMACULATE.',
    romance: 'rewatching a comfort movie with a playlist called "imaginary love story" on.',
    darkness: 'binge-watching horror documentaries while your playlist makes the ambiance worse.',
    quirkiness: 'going down a wikipedia rabbit hole while shuffling a 47-genre playlist.',
  };
  return scenarios[mood.dominant] || 'something chaotic and music-adjacent';
}

// ======================== ARTIST TIER LIST ========================

function makeArtistTierList(artists) {
  const all = [];
  const weights = { short_term: 3, medium_term: 2, long_term: 1 };
  const scores = {};
  for (const [range, list] of Object.entries(artists)) {
    list.forEach((a, i) => {
      if (!scores[a.id]) scores[a.id] = { artist: a, score: 0 };
      scores[a.id].score += weights[range] * (50 - i);
    });
  }
  const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
  const tiers = { S: [], A: [], B: [], C: [], D: [] };
  sorted.forEach((item, i) => {
    if (i < 3) tiers.S.push(item.artist);
    else if (i < 8) tiers.A.push(item.artist);
    else if (i < 16) tiers.B.push(item.artist);
    else if (i < 25) tiers.C.push(item.artist);
    else if (i < 35) tiers.D.push(item.artist);
  });
  return tiers;
}

// ======================== MUSIC MOVIE ========================

function getMusicMovie(mood, genres) {
  const topGenre = genres.topGenre.toLowerCase();
  if (mood.darkness >= 65 || topGenre.includes('metal') || topGenre.includes('goth'))
    return { movie: 'a psychological thriller', desc: "directed by David Fincher. dark, brooding, and absolutely gripping." };
  if (mood.romance >= 65 || topGenre.includes('r&b') || topGenre.includes('soul'))
    return { movie: 'a coming-of-age romance', desc: "think Eternal Sunshine meets 500 Days of Summer. you're the sad but beautiful lead." };
  if (mood.angst >= 65 || topGenre.includes('punk') || topGenre.includes('emo'))
    return { movie: 'a 2000s teen drama', desc: "think Donnie Darko meets Perks of Being a Wallflower. you ARE the misunderstood protagonist." };
  if (mood.energy >= 65 && mood.hype >= 60)
    return { movie: 'an action blockbuster', desc: "fast cuts, big explosions, and a soundtrack that goes HARD. you're the main event." };
  if (mood.chill >= 65)
    return { movie: 'a studio ghibli film', desc: "gentle, beautiful, and deeply comforting. the vibes are immaculate." };
  if (mood.melancholy >= 60)
    return { movie: 'an indie art film', desc: "lots of rain shots, long silences, and a devastating third act. critically acclaimed." };
  if (mood.quirkiness >= 60)
    return { movie: 'a Wes Anderson film', desc: "perfectly symmetrical shots, quirky characters, and an unexpected soundtrack. iconic." };
  return { movie: 'an ensemble comedy-drama', desc: "a little bit of everything. funny, sad, weird, and somehow it all works." };
}

// ======================== TOP 3 MOODS ========================

function getTopMoods(mood) {
  return Object.entries(mood)
    .map(([name, val]) => ({ name, val }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 3);
}

// ======================== ERA COMPARISON ========================

function analyzeEras(artists) {
  const eras = {};
  for (const [range, list] of Object.entries(artists)) {
    const genreCounts = {};
    for (const a of list) {
      for (const g of (a.genres || [])) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }
    const sorted = Object.entries(genreCounts).sort((a,b) => b[1] - a[1]);
    eras[range] = sorted.slice(0, 5).map(([g]) => g);
  }
  return eras;
}

// ======================== SPARKLE CURSOR ========================

function initStars() {
  const container = document.getElementById('stars-bg');
  if (!container) return;
  const symbols = ['✦', '✧', '⋆', '★', '♥', '☆'];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    s.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3) + 's';
    s.style.animationDuration = (2 + Math.random() * 3) + 's';
    s.style.fontSize = (6 + Math.random() * 10) + 'px';
    container.appendChild(s);
  }
}

function initSparkles() {
  if ('ontouchstart' in window) return;
  const canvas = document.getElementById('sparkle-canvas');
  const ctx = canvas.getContext('2d');
  const sparkles = [];
  const chars = ['✦', '✧', '⋆', '★', '♥'];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  let lastX = 0, lastY = 0, lastTime = 0;
  document.addEventListener('mousemove', e => {
    const now = Date.now();
    if (now - lastTime < 60) return;
    lastTime = now;
    sparkles.push({
      x: e.clientX + (Math.random() * 10 - 5),
      y: e.clientY + (Math.random() * 10 - 5),
      size: 8 + Math.random() * 8,
      life: 1,
      char: chars[Math.floor(Math.random() * chars.length)],
      hue: 300 + Math.random() * 60,
    });
    lastX = e.clientX; lastY = e.clientY;
  });

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.life -= 0.03;
      s.y -= 0.5;
      if (s.life <= 0) { sparkles.splice(i, 1); continue; }
      ctx.globalAlpha = s.life;
      ctx.font = s.size + 'px serif';
      ctx.fillStyle = `hsl(${s.hue}, 100%, 70%)`;
      ctx.fillText(s.char, s.x, s.y);
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ======================== RENDER ========================

function renderLanding() {
  const noId = CLIENT_ID === 'YOUR_CLIENT_ID_HERE';
  return `
    <div class="landing">
      <h1>xXx SparkleStats xXx</h1>
      <p class="sub">your spotify personality</p>
      ${noId ? `
        <div class="card" style="max-width:500px;margin:0 auto 24px;text-align:left;">
          <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ one-time setup</p>
          <p style="font-size:0.85rem;color:var(--babypink);line-height:1.7;">
            open <b>app.js</b> and replace <code style="background:#1a0a15;padding:2px 5px;color:var(--hotpink);">YOUR_CLIENT_ID_HERE</code>
            with your Client ID from
            <a href="https://developer.spotify.com/dashboard" target="_blank">developer.spotify.com</a>.
            <br>set redirect URI to: <code style="background:#1a0a15;padding:2px 5px;color:var(--hotpink);">${esc(REDIRECT_URI)}</code>
          </p>
        </div>
      ` : ''}
      <button class="login-btn" onclick="login()" ${noId ? 'disabled style="opacity:0.5"' : ''}>
        ★ connect spotify ★
      </button>
      <p class="note">invite-only while spotify has this app in "development mode"</p>
      <p style="margin-top:18px;">
        <button class="login-btn" style="background:transparent;color:var(--hotpink);border-color:var(--darkpink);font-size:0.85rem;padding:10px 22px;" onclick="if(typeof pOpenJoin==='function')pOpenJoin()">got a room code? join a game</button>
      </p>
      <p class="note" style="margin-top:6px;">party mode, album pictionary and online versus work without logging in</p>
      <details class="card" style="max-width:460px;margin:18px auto 0;text-align:left;font-size:0.8rem;color:var(--babypink);">
        <summary style="cursor:pointer;color:var(--hotpink);">can't log in? read this</summary>
        <p style="margin-top:8px;line-height:1.7;">
          spotify only lets people on the invite list in. if it says
          <b>"user not registered in the developer dashboard"</b>, the email on the list doesn't match
          the email on <i>your spotify account</i> - people who signed up through google, facebook or apple
          usually have a different one than they think. check yours at
          <a href="https://www.spotify.com/account" target="_blank">spotify.com/account</a> and send that exact
          email to whoever runs this.<br><br>
          if it keeps bouncing you back here, you're logged into a different spotify account in this browser
          (family plans do this). log out of spotify, log into the invited one, try again.<br><br>
          you don't need premium.
        </p>
      </details>
    </div>`;
}

function renderLoading(msg, sub) {
  return `<div class="loading"><div class="skull">💀</div><p>${msg || 'analyzing your entire music personality...'}</p>` +
    `<p id="load-sub" style="color:var(--dimtext);font-size:0.8rem;margin-top:8px;">${sub || ''}</p></div>`;
}

function renderError(msg) {
  return `
    <div style="text-align:center;padding:80px 20px;">
      <div style="font-size:3rem;">💔</div>
      <h2 style="color:var(--pink);margin:12px 0;">something broke</h2>
      <p style="color:var(--dimtext);max-width:400px;margin:0 auto;">${esc(msg)}</p>
      <p style="margin-top:16px;"><a href="${SITE_BASE}">← try again</a></p>
    </div>`;
}

function renderDashboard(data, analysis) {
  const { user, tracks, artists } = data;
  const { personality, genres, decades, trackStats, obscurity, diversity, moodData, emojis, clock, loyalty, repeats, eras, listeningTime } = analysis;
  const { primary, secondary, confidence } = personality;
  const topArtist = artists.short_term[0]?.name || artists.medium_term[0]?.name || '???';
  const topTrack = tracks.short_term[0] || tracks.medium_term[0];
  const bingo = makeBingo(analysis);

  const roastData = {
    artist: topArtist,
    track: topTrack?.name || 'a song',
    genre: genres.topGenre,
    pct: genres.ranked[0]?.pct.toFixed(0) || '0',
    obscurity: obscurity.score,
    diversity: diversity.score,
    decade: decades.dominant,
  };
  const roast = generateRoast(primary.name, roastData);

  return `
    <!-- PROFILE HEADER -->
    <div style="text-align:center;margin-bottom:40px;" class="fade-up">
      ${user.images?.[0] ? `<img src="${user.images[0].url}" style="width:80px;height:80px;border-radius:50%;border:3px solid var(--pink);margin:0 auto 12px;box-shadow:var(--glow);">` : ''}
      <h2 style="font-size:1.6rem;background:linear-gradient(90deg,var(--pink),var(--hotpink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
        welcome, ${esc(user.display_name || 'stranger')}
      </h2>
      <p style="color:var(--dimtext);font-size:0.85rem;">here's everything your music says about you</p>
      <div class="sep">★ ★ ★</div>
    </div>

    <!-- GUESS THE SONG CTA -->
    <div class="card card-glow" style="max-width:480px;margin:0 auto 24px;text-align:center;cursor:pointer;" onclick="openQuiz('classic')">
      <div style="font-size:2rem;">🎧</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--pink);text-shadow:var(--glowtext);">guess the song</div>
      <p style="color:var(--babypink);font-size:0.82rem;margin:4px 0 12px;">
        any artist, any playlist, or your own. 1000 points on the line.<br>
        <span style="color:var(--dimtext);font-size:0.75rem;">plus heardle, cover art, higher or lower, a daily song and more</span>
      </p>
      <button class="share-btn" onclick="event.stopPropagation();openQuiz('classic')">★ play now ★</button>
      <button class="share-btn" style="background:transparent;color:var(--hotpink);border-color:var(--darkpink);margin-left:6px;" onclick="event.stopPropagation();openQuiz()">the arcade →</button>
    </div>

    <!-- PERSONALITY -->
    <div class="section-title">your personality</div>
    <div class="card card-glow personality-badge" style="background:${primary.gradient};max-width:480px;margin:0 auto 16px;">
      <div class="personality-emoji">${primary.emoji}</div>
      <div class="personality-name">${esc(primary.name)}</div>
      <div class="personality-tagline">"${esc(primary.tag)}"</div>
      <div class="personality-match">${confidence}% match</div>
    </div>
    <p style="text-align:center;margin:-6px 0 12px;"><button class="q-replay" onclick="lSaveNode(this.parentElement.previousElementSibling, 'sparklestats-personality', this)">💾 save as image</button></p>
    <p style="text-align:center;color:var(--dimtext);font-size:0.85rem;margin-bottom:16px;">
      with a splash of <b style="color:var(--hotpink)">${secondary.emoji} ${esc(secondary.name)}</b>
    </p>
    <div class="card half" style="max-width:520px;margin:0 auto 16px;">
      <p style="line-height:1.7;">${esc(primary.desc)}</p>
    </div>

    <!-- VIBE RADAR -->
    <div class="card half" style="max-width:440px;margin:0 auto 16px;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">★ your vibe breakdown ★</p>
      <div class="chart-box" style="height:280px;"><canvas id="radar-chart"></canvas></div>
    </div>

    <!-- ROAST -->
    <div class="card" style="max-width:520px;margin:0 auto 16px;">
      <div style="font-size:0.78rem;color:var(--dimtext);border-bottom:1px solid #2a1520;padding-bottom:6px;margin-bottom:8px;">
        <b style="color:var(--pink);">xXx_LiveJournal_xXx</b> | mood: ${esc(moodData.dominant)} | ${new Date().toLocaleDateString()}
      </div>
      <p style="font-style:italic;line-height:1.7;color:var(--babypink);">"${esc(roast)}"</p>
      <p style="text-align:right;color:var(--darkpink);font-size:0.75rem;margin-top:6px;">- what your music says about you</p>
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- TOP TRACKS -->
    <div class="section-title">top tracks</div>
    <div class="tabs" id="track-tabs">
      <button class="active" onclick="switchTracks('short_term',this)">last month xo</button>
      <button onclick="switchTracks('medium_term',this)">6 months &lt;3</button>
      <button onclick="switchTracks('long_term',this)">all time ~forever~</button>
    </div>
    <div class="card" id="tracks-list">${renderTrackList(tracks.short_term)}</div>

    <!-- TOP ARTISTS -->
    <div class="section-title">top artists</div>
    <div class="tabs" id="artist-tabs">
      <button class="active" onclick="switchArtists('short_term',this)">last month xo</button>
      <button onclick="switchArtists('medium_term',this)">6 months &lt;3</button>
      <button onclick="switchArtists('long_term',this)">all time ~forever~</button>
    </div>
    <div id="artists-grid">${renderArtistGrid(artists.short_term)}</div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- GENRES -->
    <div class="section-title">genre breakdown</div>
    <div class="grid-2">
      <div class="card">
        <div class="chart-box" style="height:260px;"><canvas id="genre-pie"></canvas></div>
      </div>
      <div class="card">
        <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">your top genres</p>
        ${genres.ranked.slice(0, 10).map((g, i) => `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span class="x-genre-click" data-genre="${esc(g.genre).replace(/"/g, '&quot;')}" onclick="if(typeof yShowGenre==='function')yShowGenre(this.dataset.genre)" title="which artists and songs are this?" style="font-size:0.78rem;color:var(--babypink);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(g.genre)}</span>
            <span style="font-size:0.72rem;color:var(--dimtext);font-family:monospace;">${g.pct.toFixed(1)}%</span>
          </div>
        `).join('')}
        <p style="color:var(--dimtext);font-size:0.7rem;margin-top:8px;">${genres.uniqueCount} unique genres ★</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">★ genre cloud ★</p>
      <div class="genre-cloud">
        ${genres.ranked.slice(0, 30).map((g, i) => {
          const size = Math.max(0.7, 1.8 - i * 0.04);
          const hue = 300 + (i * 7) % 60;
          return `<span class="x-genre-click" data-genre="${esc(g.genre).replace(/"/g, '&quot;')}" onclick="if(typeof yShowGenre==='function')yShowGenre(this.dataset.genre)" style="font-size:${size}rem;color:hsl(${hue},100%,${60 + (i % 3) * 10}%);font-weight:${i < 5 ? 700 : 400};">${esc(g.genre)}</span>`;
        }).join(' ')}
      </div>
    </div>

    <!-- MOOD -->
    <div class="section-title">mood & vibes</div>
    <div class="card card-glow" style="text-align:center;max-width:480px;margin:0 auto 16px;">
      <p style="color:var(--pink);font-weight:700;font-size:1.1rem;margin-bottom:4px;">★ vibe check ★</p>
      <p style="font-size:1rem;line-height:1.6;">${getVibeStatement(moodData.dominant)}</p>
      <p style="color:var(--dimtext);font-size:0.8rem;margin-top:4px;">dominant mood: <b style="color:var(--hotpink);">${moodData.dominant}</b></p>
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- STATS -->
    <div class="section-title">your stats</div>
    <div class="grid-3">
      <div class="card gauge-wrap">
        <div class="gauge-value">${obscurity.score}</div>
        <div class="gauge-label">${esc(obscurity.label)}</div>
        <div class="gauge-sub">how hipster are you?</div>
      </div>
      <div class="card gauge-wrap">
        <div class="gauge-value">${diversity.score}</div>
        <div class="gauge-label">${esc(diversity.label)}</div>
        <div class="gauge-sub">${genres.uniqueCount} unique genres</div>
      </div>
      <div class="card gauge-wrap">
        <div class="gauge-value">${trackStats.explicitPct}%</div>
        <div class="gauge-label">${getExplicitLabel(trackStats.explicitPct)}</div>
        <div class="gauge-sub">explicit content</div>
      </div>
    </div>

    <!-- LISTENING TIME -->
    <div class="section-title">listening minutes</div>
    <div class="card card-glow half" style="max-width:520px;margin-left:auto;margin-right:auto;">
      <p style="text-align:center;color:var(--dimtext);font-size:0.72rem;margin-bottom:16px;">estimated from your recent listening rate</p>
      <div class="grid-2" style="gap:12px;">
        <div style="text-align:center;padding:18px 10px;background:linear-gradient(135deg,#1a0a15,#200e1a);border:2px solid var(--darkpink);position:relative;">
          <div style="font-size:0.7rem;color:var(--hotpink);font-weight:700;margin-bottom:4px;">LAST MONTH</div>
          <div style="font-size:2.6rem;font-weight:700;color:var(--pink);text-shadow:var(--glowtext);">${Math.round(listeningTime.monthlyMs / 60000).toLocaleString()}</div>
          <div style="font-size:0.8rem;color:var(--babypink);">minutes</div>
          <div style="font-size:0.65rem;color:var(--dimtext);margin-top:4px;">~ ${fmtMinutes(listeningTime.monthlyMs)}</div>
        </div>
        <div style="text-align:center;padding:18px 10px;background:linear-gradient(135deg,#150a1a,#1a0e20);border:2px solid var(--darkpink);position:relative;">
          <div style="font-size:0.7rem;color:var(--hotpink);font-weight:700;margin-bottom:4px;">LAST 2 MONTHS</div>
          <div style="font-size:2.6rem;font-weight:700;color:var(--magenta);text-shadow:0 0 6px #FF00FF88;">${Math.round(listeningTime.twoMonthMs / 60000).toLocaleString()}</div>
          <div style="font-size:0.8rem;color:var(--babypink);">minutes</div>
          <div style="font-size:0.65rem;color:var(--dimtext);margin-top:4px;">~ ${fmtMinutes(listeningTime.twoMonthMs)}</div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;justify-content:center;gap:16px;">
        <div style="text-align:center;">
          <div style="font-size:1.4rem;font-weight:700;color:var(--hotpink);">${Math.round(listeningTime.dailyMs / 60000)}</div>
          <div style="font-size:0.65rem;color:var(--dimtext);">min/day</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.4rem;font-weight:700;color:var(--hotpink);">${fmtMinutes(listeningTime.weeklyMs)}</div>
          <div style="font-size:0.65rem;color:var(--dimtext);">per week</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.4rem;font-weight:700;color:var(--hotpink);">${Math.round(listeningTime.yearlyMs / 60000).toLocaleString()}</div>
          <div style="font-size:0.65rem;color:var(--dimtext);">min/year est.</div>
        </div>
      </div>
      <p style="text-align:center;color:var(--dimtext);font-size:0.65rem;margin-top:10px;font-style:italic;">
        ${Math.round(listeningTime.monthlyMs / 60000) > 4000 ? "that's literally a full-time job of listening. your ears are EMPLOYEES." :
          Math.round(listeningTime.monthlyMs / 60000) > 2000 ? "your ears are WORKING. music is basically your cardio." :
          Math.round(listeningTime.monthlyMs / 60000) > 800 ? "solid listener. your spotify is getting its money's worth." :
          "casual but cute. quality over quantity vibes."}
      </p>
    </div>

    <!-- DECADES -->
    <div class="card half" style="margin-top:16px;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">★ decade breakdown ★</p>
      <div class="chart-box" style="height:220px;"><canvas id="decade-chart"></canvas></div>
      <p style="text-align:center;margin-top:8px;">you're a <b style="color:var(--pink);">${esc(decades.dominant)}</b> kid at heart <span style="color:var(--dimtext);font-size:0.8rem;">(avg year: ${decades.avgYear})</span></p>
    </div>

    <!-- TRACK EXTREMES -->
    <div class="grid-2" style="margin-top:16px;">
      ${trackStats.longest ? `<div class="card"><p style="color:var(--pink);font-weight:700;">🐌 longest</p><p style="font-weight:700;">${esc(trackStats.longest.name)}</p><p style="color:var(--dimtext);font-size:0.8rem;">${esc(trackStats.longest.artists[0]?.name || '')} - ${fmtDur(trackStats.longest.duration_ms)}</p></div>` : ''}
      ${trackStats.shortest ? `<div class="card"><p style="color:var(--pink);font-weight:700;">⚡ shortest</p><p style="font-weight:700;">${esc(trackStats.shortest.name)}</p><p style="color:var(--dimtext);font-size:0.8rem;">${esc(trackStats.shortest.artists[0]?.name || '')} - ${fmtDur(trackStats.shortest.duration_ms)}</p></div>` : ''}
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- FUN STUFF -->
    <div class="section-title">fun stuff</div>

    <!-- EMOJIS -->
    <div class="card half" style="text-align:center;max-width:480px;margin:0 auto 16px;">
      <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ your music in emojis ★</p>
      <p style="font-size:2rem;letter-spacing:4px;">${emojis.map(e => e.emoji).join('')}</p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-top:8px;">
        ${emojis.slice(0, 6).map(e => `<span style="font-size:0.65rem;color:var(--dimtext);border:1px solid #1a1015;padding:1px 5px;">${e.emoji}=${esc(e.genre)}</span>`).join('')}
      </div>
    </div>

    <!-- MIX CD -->
    <div class="card half" style="text-align:center;max-width:440px;margin:0 auto 16px;">
      <div class="cd-disc"><div class="cd-hole"></div></div>
      <div style="border:2px dashed #2a1520;padding:12px;">
        <p style="color:var(--pink);font-weight:700;margin-bottom:6px;">★ ${esc(user.display_name || 'anon')}'s Mix CD ★</p>
        <ol style="text-align:left;padding-left:20px;font-size:0.7rem;line-height:1.8;color:var(--babypink);">
          ${(tracks.short_term.length ? tracks.short_term : tracks.medium_term).slice(0, 12).map(t =>
            `<li>${esc(t.artists[0]?.name || '')} - ${esc(t.name)}</li>`
          ).join('')}
        </ol>
      </div>
    </div>

    <!-- BAND TEE WALL -->
    <div class="card half" style="margin-top:16px;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">★ your band tee wall ★</p>
      <div class="grid-4" style="background:#0d0a0f;padding:8px;border:2px solid #222;">
        ${(artists.medium_term.length ? artists.medium_term : artists.long_term).slice(0, 12).map(a => `
          <div style="position:relative;aspect-ratio:1;overflow:hidden;border:2px solid #333;transform:rotate(${(Math.random()*4-2).toFixed(1)}deg);">
            ${a.images?.[0] ? `<img src="${img(a.images, 'sm')}" style="width:100%;height:100%;object-fit:cover;filter:contrast(1.1) saturate(0.8);">` : '<div style="width:100%;height:100%;background:#222;display:flex;align-items:center;justify-content:center;">🎸</div>'}
            <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.85));padding:3px;font-size:0.5rem;text-align:center;color:white;font-weight:700;">${esc(a.name)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- BINGO -->
    <div class="card half" style="margin-top:16px;max-width:480px;margin-left:auto;margin-right:auto;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">★ listening bingo ★</p>
      <p style="text-align:center;color:var(--dimtext);font-size:0.72rem;margin-bottom:6px;">${bingo.filter(([,fn]) => fn()).length}/25 checked</p>
      <div class="bingo-grid">
        ${bingo.map(([label, fn]) => `<div class="bingo-cell ${fn() ? 'checked' : ''}">${label}</div>`).join('')}
      </div>
    </div>

    <div class="sep" style="margin-top:24px;">★ x ★ x ★ x ★</div>

    <!-- TOP 3 MOODS -->
    <div class="section-title">your top moods</div>
    <div class="card" style="max-width:480px;margin:0 auto;">
      ${getTopMoods(moodData.mood).map((m, i) => {
        const colors = ['var(--pink)', 'var(--hotpink)', 'var(--darkpink)'];
        const emojis = { melancholy: '😢', energy: '⚡', angst: '💢', chill: '🌊', hype: '🔥', romance: '💘', darkness: '💀', quirkiness: '🦄' };
        return `
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span style="font-weight:700;color:${colors[i]};font-size:0.9rem;">${emojis[m.name] || '★'} ${m.name}</span>
              <span style="color:var(--dimtext);font-size:0.85rem;">${m.val}%</span>
            </div>
            <div style="height:14px;background:#1a0a15;border:1px solid #2a1520;overflow:hidden;">
              <div style="height:100%;width:${m.val}%;background:${colors[i]};transition:width 1s;"></div>
            </div>
          </div>`;
      }).join('')}
    </div>

    <!-- ALIGNMENT CHART -->
    <div class="card card-glow half" style="max-width:440px;margin:16px auto;text-align:center;">
      <p style="color:var(--pink);font-weight:700;margin-bottom:6px;">★ music alignment ★</p>
      ${(() => {
        const a = getAlignment(moodData.mood, obscurity, diversity);
        return `
          <p style="font-size:1.8rem;font-weight:700;background:linear-gradient(90deg,var(--pink),var(--magenta));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${a.alignment}</p>
          <p style="color:var(--babypink);font-size:0.85rem;margin-top:6px;line-height:1.5;">${a.description}</p>`;
      })()}
    </div>

    <!-- MUSIC TASTE AGE -->
    <div class="card half" style="max-width:440px;margin:16px auto;text-align:center;">
      <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ your music taste age ★</p>
      ${(() => {
        const ta = getMusicTasteAge(decades, moodData.mood, obscurity);
        return `
          <p style="font-size:3.5rem;font-weight:700;color:var(--pink);text-shadow:var(--glow);margin:8px 0;">${ta.age}</p>
          <p style="font-size:0.85rem;color:var(--babypink);line-height:1.5;">${ta.label}</p>`;
      })()}
    </div>

    <!-- FRIDAY NIGHT -->
    <div class="card card-glow half" style="max-width:480px;margin:16px auto;text-align:center;">
      <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ your friday night ★</p>
      <p style="font-size:0.78rem;color:var(--dimtext);margin-bottom:8px;">according to your music</p>
      <p style="font-size:1rem;line-height:1.6;color:var(--babypink);">${getFridayNight(moodData, personality)}</p>
    </div>

    <!-- MUSIC AS A MOVIE -->
    <div class="card half" style="max-width:480px;margin:16px auto;text-align:center;">
      <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">★ if your music was a movie ★</p>
      ${(() => {
        const m = getMusicMovie(moodData.mood, genres);
        return `
          <p style="font-size:1.3rem;font-weight:700;color:var(--hotpink);margin:8px 0;">it would be ${m.movie}</p>
          <p style="font-size:0.85rem;color:var(--babypink);line-height:1.5;">${m.desc}</p>`;
      })()}
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- TASTE IN ONE SENTENCE -->
    <div class="section-title">you in one sentence</div>
    <div class="taste-sentence">
      ${generateTasteSummary(analysis, topArtist)}
    </div>

    <div class="sep">♥ x ♥ x ♥ x ♥</div>

    <!-- ALBUM ART WALL -->
    <div class="section-title">album art wall</div>
    <div class="album-wall">
      ${(() => {
        const seen = new Set();
        const arts = [];
        for (const list of Object.values(tracks)) {
          for (const t of list) {
            const url = t.album?.images?.[0]?.url;
            if (url && !seen.has(url)) { seen.add(url); arts.push({ url, name: t.album.name, artist: t.artists[0]?.name || '' }); }
          }
        }
        return arts.slice(0, 32).map(a => `<img src="${a.url}" alt="${esc(a.name)}" title="${esc(a.artist + ' - ' + a.name)}">`).join('');
      })()}
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- LISTENING CLOCK -->
    <div class="section-title">when you listen</div>
    <div class="card" style="max-width:500px;margin:0 auto;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:4px;">★ listening clock ★</p>
      <p style="text-align:center;font-size:0.78rem;color:var(--dimtext);margin-bottom:10px;">based on your recently played</p>
      <div class="clock-grid">
        ${clock.hours.map((count, h) => {
          const pct = clock.max ? count / clock.max : 0;
          const bg = pct > 0.7 ? 'var(--pink)' : pct > 0.4 ? 'var(--darkpink)' : pct > 0.1 ? '#2a1520' : '#111';
          const color = pct > 0.4 ? 'white' : 'var(--dimtext)';
          return `<div class="clock-cell" style="background:${bg};color:${color};" title="${h}:00 - ${count} plays">${h}</div>`;
        }).join('')}
      </div>
      <p style="text-align:center;margin-top:10px;font-size:0.9rem;">
        you're a <b style="color:var(--pink);">${esc(clock.chronotype)}</b>
        <span style="color:var(--dimtext);font-size:0.75rem;"> (peak: ${clock.peakHour}:00)</span>
      </p>
    </div>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- ARTIST LOYALTY -->
    <div class="section-title">artist loyalty</div>
    <div class="grid-2">
      <div class="card">
        <p style="color:var(--pink);font-weight:700;margin-bottom:8px;">💍 ride or die</p>
        <p style="color:var(--dimtext);font-size:0.7rem;margin-bottom:8px;">in your top artists across ALL time ranges</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${loyalty.rideOrDie.length ? loyalty.rideOrDie.map(a => `
            <div class="loyalty-badge">
              ${a.images?.[0] ? `<img src="${img(a.images, 'sm')}" alt="">` : ''}
              <span class="ride-or-die">${esc(a.name)}</span>
            </div>
          `).join('') : '<p style="color:var(--dimtext);font-size:0.8rem;">no ride or dies yet... commitment issues?</p>'}
        </div>
      </div>
      <div class="card">
        <p style="color:var(--hotpink);font-weight:700;margin-bottom:8px;">🦋 new obsessions</p>
        <p style="color:var(--dimtext);font-size:0.7rem;margin-bottom:8px;">only in your recent top artists</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${loyalty.seasonal.length ? loyalty.seasonal.map(a => `
            <div class="loyalty-badge">
              ${a.images?.[0] ? `<img src="${img(a.images, 'sm')}" alt="">` : ''}
              <span class="seasonal">${esc(a.name)}</span>
            </div>
          `).join('') : '<p style="color:var(--dimtext);font-size:0.8rem;">your taste is pretty consistent rn</p>'}
        </div>
      </div>
    </div>

    <!-- REPEAT OFFENDERS -->
    ${repeats.length ? `
    <div class="card" style="margin-top:16px;max-width:520px;margin-left:auto;margin-right:auto;">
      <p style="text-align:center;color:var(--pink);font-weight:700;margin-bottom:8px;">🔁 repeat offenders</p>
      <p style="text-align:center;color:var(--dimtext);font-size:0.7rem;margin-bottom:8px;">tracks that appear across multiple time ranges - your constants</p>
      ${repeats.slice(0, 8).map(({ track, ranges }) => `
        <div class="repeat-track">
          ${track.album?.images?.[0] ? `<img src="${img(track.album.images, 'sm')}">` : ''}
          <div style="flex:1;overflow:hidden;">
            <div style="font-weight:700;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(track.name)}</div>
            <div style="font-size:0.7rem;color:var(--dimtext);">${esc(track.artists.map(a=>a.name).join(', '))}</div>
          </div>
          <div class="repeat-count">${ranges.length}x</div>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="sep">♥ x ♥ x ♥ x ♥</div>

    <!-- SPOTIFY RECEIPT -->
    <div class="section-title">your spotify receipt</div>
    <div class="receipt">
      <h3>★ SPARKLESTATS ★</h3>
      <div class="receipt-line"><span>date:</span><span>${new Date().toLocaleDateString()}</span></div>
      <div class="receipt-line"><span>customer:</span><span>${esc(user.display_name || 'anon')}</span></div>
      <div class="receipt-divider">- - - - - - - - - - - - -</div>
      <div class="receipt-line"><span>personality:</span><span>${esc(primary.name)}</span></div>
      <div class="receipt-line"><span>top genre:</span><span>${esc(genres.topGenre)}</span></div>
      <div class="receipt-line"><span>genres found:</span><span>${genres.uniqueCount}</span></div>
      <div class="receipt-line"><span>top artist:</span><span>${esc(topArtist)}</span></div>
      <div class="receipt-line"><span>top track:</span><span>${esc(topTrack?.name || 'n/a')}</span></div>
      <div class="receipt-line"><span>avg track len:</span><span>${fmtDur(trackStats.avgMs)}</span></div>
      <div class="receipt-line"><span>longest track:</span><span>${fmtDur(trackStats.longest?.duration_ms || 0)}</span></div>
      <div class="receipt-line"><span>explicit %:</span><span>${trackStats.explicitPct}%</span></div>
      <div class="receipt-divider">- - - - - - - - - - - - -</div>
      <div class="receipt-line"><span>obscurity:</span><span>${obscurity.score}/100</span></div>
      <div class="receipt-line"><span>diversity:</span><span>${diversity.score}/100</span></div>
      <div class="receipt-line"><span>dominant mood:</span><span>${esc(moodData.dominant)}</span></div>
      <div class="receipt-line"><span>decade vibe:</span><span>${esc(decades.dominant)}</span></div>
      <div class="receipt-line"><span>chronotype:</span><span>${esc(clock.chronotype)}</span></div>
      <div class="receipt-line"><span>est. min/day:</span><span>${Math.round(listeningTime.dailyMs / 60000)}</span></div>
      <div class="receipt-line"><span>est. min/year:</span><span>${Math.round(listeningTime.yearlyMs / 60000).toLocaleString()}</span></div>
      <div class="receipt-line total"><span>TOTAL VIBE:</span><span>${confidence}% ${esc(primary.name)}</span></div>
      <div class="receipt-divider">= = = = = = = = = = = = =</div>
      <div class="receipt-footer">
        thank you for shopping at SparkleStats
      </div>
    </div>
    <p style="text-align:center;margin:14px 0 0;"><button class="q-replay" onclick="lSaveNode(this.parentElement.previousElementSibling, 'sparklestats-receipt', this)">💾 save as image</button></p>

    <div class="sep">★ x ★ x ★ x ★</div>

    <!-- ERA COMPARISON -->
    <div class="section-title">how your taste changed</div>
    <div class="card" style="max-width:560px;margin:0 auto;">
      <div class="era-row">
        <div class="era-label" style="font-weight:700;color:var(--pink);">time range</div>
        <div style="flex:1;font-weight:700;font-size:0.72rem;color:var(--pink);">top genres</div>
      </div>
      ${[['short_term', 'last month'], ['medium_term', '6 months'], ['long_term', 'all time']].map(([range, label]) => `
        <div class="era-row">
          <div class="era-label">${label}</div>
          <div style="flex:1;display:flex;flex-wrap:wrap;gap:3px;">
            ${(eras[range] || []).map(g => `<span style="font-size:0.68rem;background:#1a0a15;border:1px solid #2a1520;padding:1px 6px;color:var(--hotpink);">${esc(g)}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="sep">♥ x ♥ x ♥ x ♥</div>

    <!-- HOW IT WORKS -->
    <details class="card" style="max-width:520px;margin:16px auto 0;font-size:0.75rem;color:var(--dimtext);">
      <summary style="cursor:pointer;color:var(--darkpink);">how does this work?</summary>
      <p style="margin-top:6px;line-height:1.6;">
        SparkleStats analyzes your personality based on the genres of your top artists, release dates, and listening diversity.
        we use genre-based mood estimation since Spotify's audio features aren't available to new apps anymore
        (and since Spotify stopped sharing artist genres too, those now come from Apple's catalog - a bit broader than they used to be).
        honestly it's more fun this way - genres tell a richer story. your results are 100% based on your actual listening data.
      </p>
    </details>
  `;
}

function renderTrackList(tracks) {
  return tracks.slice(0, 15).map((t, i) => `
    <a href="${t.external_urls?.spotify || '#'}" target="_blank" class="track-row" style="text-decoration:none;color:inherit;">
      <span class="track-rank ${i < 3 ? 'top3' : ''}">${i + 1}</span>
      ${t.album?.images?.[0] ? `<img src="${img(t.album.images, 'sm')}" class="track-art">` : ''}
      <div class="track-info">
        <div class="track-name">${esc(t.name)}${t.explicit ? ' <span style="color:var(--pink);font-size:0.65rem;">E</span>' : ''}</div>
        <div class="track-artist">${esc(t.artists.map(a => a.name).join(', '))}</div>
      </div>
      <span class="track-dur">${fmtDur(t.duration_ms)}</span>
    </a>
  `).join('');
}

function renderArtistGrid(artists) {
  return `<div class="grid-4">${artists.slice(0, 12).map((a, i) => `
    <a href="${a.external_urls?.spotify || '#'}" target="_blank" class="artist-card" style="text-decoration:none;color:inherit;">
      ${a.images?.[0] ? `<img src="${img(a.images, 'sm')}" class="artist-img">` : '<div class="artist-img" style="background:#222;display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🎸</div>'}
      <div class="artist-name">${esc(a.name)}</div>
      ${(a.genres || []).slice(0, 2).map(g => `<span class="artist-genre-tag">${esc(g)}</span>`).join('')}
    </a>
  `).join('')}</div>`;
}

// ======================== CHART INIT ========================

function initCharts(analysis) {
  const { genres, decades, moodData } = analysis;

  // Radar
  const radarCtx = document.getElementById('radar-chart');
  if (radarCtx) {
    new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Melancholy 😢', 'Energy ⚡', 'Angst 💢', 'Chill 🌊', 'Hype 🔥', 'Romance 💘', 'Darkness 💀', 'Quirky 🦄'],
        datasets: [{
          data: [moodData.mood.melancholy, moodData.mood.energy, moodData.mood.angst, moodData.mood.chill, moodData.mood.hype, moodData.mood.romance, moodData.mood.darkness, moodData.mood.quirkiness],
          backgroundColor: 'rgba(255,20,147,0.15)',
          borderColor: '#FF1493',
          borderWidth: 2,
          pointBackgroundColor: '#FF1493',
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#2a1520' }, angleLines: { color: '#2a1520' }, pointLabels: { color: '#FFB6C1', font: { family: 'Comic Neue, cursive', size: 10 } } } },
        plugins: { legend: { display: false } },
      },
    });
  }

  // Genre Pie
  const pieCtx = document.getElementById('genre-pie');
  if (pieCtx) {
    const top8 = genres.ranked.slice(0, 8);
    const colors = ['#FF1493', '#FF00FF', '#8B00FF', '#FF69B4', '#C71585', '#4B0082', '#DA70D6', '#9400D3'];
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: top8.map(g => g.genre),
        datasets: [{ data: top8.map(g => g.pct), backgroundColor: colors.slice(0, top8.length), borderColor: '#0a0a0a', borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#FFB6C1', font: { family: 'Comic Neue, cursive', size: 10 }, padding: 8 } } },
      },
    });
  }

  // Decade Bar
  const decCtx = document.getElementById('decade-chart');
  if (decCtx) {
    new Chart(decCtx, {
      type: 'bar',
      data: {
        labels: decades.distribution.map(d => d.decade),
        datasets: [{
          data: decades.distribution.map(d => d.pct),
          backgroundColor: decades.distribution.map(d => d.decade === decades.dominant ? '#FF1493' : '#C71585'),
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { ticks: { color: '#FFB6C1', font: { family: 'Comic Neue, cursive' } }, grid: { display: false } }, y: { ticks: { color: '#996b7d', callback: v => v + '%' }, grid: { color: '#1a1015' } } },
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ======================== GLOBAL HANDLERS ========================

let _data = null;

window.switchTracks = function(range, btn) {
  if (!_data) return;
  document.querySelectorAll('#track-tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tracks-list').innerHTML = renderTrackList(_data.tracks[range]);
};

window.switchArtists = function(range, btn) {
  if (!_data) return;
  document.querySelectorAll('#artist-tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('artists-grid').innerHTML = renderArtistGrid(_data.artists[range]);
};

window.revealCompat = function() {
  document.getElementById('compat-result').style.display = 'block';
};

window.generateSceneName = generateSceneName;
window.login = login;

// ======================== BOOT ========================

async function boot() {
  const app = document.getElementById('app');
  document.getElementById('visitor-num').textContent = (Math.floor(Math.random() * 99000) + 1000).toLocaleString();
  initSparkles();
  initStars();

  // Handle OAuth callback
  const params = new URLSearchParams(window.location.search);
  // a challenge link survives the login round-trip by parking in storage
  if (params.get('challenge')) {
    try { localStorage.setItem('pending_challenge', params.get('challenge')); } catch {}
  }
  if (params.get('battle')) {
    try { localStorage.setItem('pending_battle', params.get('battle')); } catch {}
  }
  if (params.get('code')) {
    app.innerHTML = renderLoading();
    try {
      await exchangeCode(params.get('code'));
      window.history.replaceState({}, '', SITE_BASE);
    } catch (e) {
      app.innerHTML = renderError(e.message);
      return;
    }
  }

  // Check auth
  const token = await getToken();
  if (!token) {
    app.innerHTML = renderLanding();
    document.getElementById('nav-right').innerHTML = '';
    return;
  }

  // Authenticated - load dashboard
  document.getElementById('nav-right').innerHTML =
    '<button onclick="openQuiz()" style="border-color:var(--pink);color:var(--pink);margin-right:6px;">★ arcade ★</button>' +
    '<button onclick="logout()">logout xo</button>';
  app.innerHTML = renderLoading();

  try {
    const data = await fetchAll();
    _data = data;

    // spotify stopped sending artist genres (sep 2026) and the whole personality
    // engine runs on them - backfill from apple's catalog, cached per artist.
    // apple only allows ~20 lookups a minute, so a first visit does the top
    // artists now and quietly finishes the rest after the dashboard is up.
    const everyArtist = [...data.artists.short_term, ...data.artists.medium_term, ...data.artists.long_term];
    let genresLeft = 0;
    if (typeof fillGenres === 'function' && everyArtist.some(a => !a.genres || !a.genres.length)) {
      app.innerHTML = renderLoading('reading genres...', 'spotify stopped sharing them, so we ask apple. only slow the first time.');
      // gentle: one at a time, and the second apple pushes back we render with what we have
      const r = await fillGenres(everyArtist, (done, total) => {
        const el = document.getElementById('load-sub');
        if (el) el.textContent = done + ' / ' + total + ' artists';
      }, { max: 12, concurrency: 1, gapMs: 400, stopOnThrottle: true });
      genresLeft = r.remaining;
    }

    // Analysis
    const genres = analyzeGenres(data.artists);
    console.log('[SparkleStats] Genres found:', genres.uniqueCount, '| Top 5:', genres.ranked.slice(0,5).map(g => g.genre + ' (' + g.pct.toFixed(1) + '%)'));
    console.log('[SparkleStats] Artists with genres:', Object.values(data.artists).flat().filter(a => a.genres && a.genres.length > 0).length, '/', Object.values(data.artists).flat().length);
    const decades = analyzeDecades(data.tracks);
    const trackStats = analyzeTrackStats(data.tracks);
    const moodData = computeMood(genres);
    const obscurity = computeObscurity(genres);
    const diversity = computeDiversity(genres);
    const emojis = getEmojis(genres);
    const personality = matchPersonality(moodData.mood, obscurity, diversity, decades.avgYear);
    const clock = analyzeListeningClock(data.recent);
    const listeningTime = analyzeListeningTime(data.recent);
    const loyalty = analyzeArtistLoyalty(data.artists);
    const repeats = analyzeRepeatTracks(data.tracks);
    const eras = analyzeEras(data.artists);

    const analysis = { personality, genres, decades, trackStats, obscurity, diversity, moodData, emojis, clock, loyalty, repeats, eras, listeningTime };
    app.innerHTML = renderDashboard(data, analysis);

    // Init charts after DOM is rendered
    requestAnimationFrame(() => initCharts(analysis));

    // someone sent a challenge link? jump straight into it
    let pending = null;
    try { pending = localStorage.getItem('pending_challenge'); localStorage.removeItem('pending_challenge'); } catch {}
    if (pending && typeof gOpenChallenge === 'function') {
      window.history.replaceState({}, '', SITE_BASE);
      gOpenChallenge(pending);
    }
    let battle = null;
    try { battle = localStorage.getItem('pending_battle'); localStorage.removeItem('pending_battle'); } catch {}
    if (battle && typeof lOpenBattle === 'function') {
      window.history.replaceState({}, '', SITE_BASE);
      lOpenBattle(battle);
    }

    // finish the genre backfill slowly in the background (only the next most-played
    // artists - the long tail barely moves the needle), waiting out throttles
    // patiently since nobody's watching, then offer a refresh
    if (genresLeft > 0 && typeof fillGenres === 'function') {
      fillGenres(everyArtist, null, { max: 18, concurrency: 1, gapMs: 3500, maxPauses: 6, backoffMs: 30000 }).then(r => {
        if (r.filled > 0) showToast('genres finished loading - refresh for the full picture');
      }).catch(() => {});
    }

    // Confetti!
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.45 }, colors: ['#FF1493', '#FF00FF', '#8B00FF', '#FFB6C1', '#FF69B4'] });
    }, 500);

  } catch (e) {
    app.innerHTML = renderError(e.message);
  }
}

boot();
