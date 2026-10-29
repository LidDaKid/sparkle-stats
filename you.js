// ============================================================
//  xXx SparkleStats xXx  -  you.js
//  third wave, part 2 (about you): festival lineup poster,
//  your personal hot 100, your music in colors, time capsule. loads after wave3.js.
// ============================================================

const Y = { chartRange: 'short_term', colors: null };
const Y_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const Y_RANGES = [['short_term', 'last month'], ['medium_term', 'last 6 months'], ['long_term', 'all time']];

M_BADGES.push(
  { id: 'wordsearch', emoji: '🔤', name: 'puzzler', how: 'finish a word search' },
  { id: 'capsule', emoji: '⏳', name: 'sealed', how: 'bury a time capsule' },
  { id: 'chart4', emoji: '📈', name: 'charting', how: 'four weeks of your hot 100 tracked' },
  { id: 'party_host', emoji: '🎉', name: 'the DJ', how: 'host a party mode round' },
  { id: 'draw', emoji: '✏️', name: 'gallery night', how: 'finish an album pictionary' },
  { id: 'history', emoji: '⏱️', name: 'receipts', how: 'load your spotify listening history' }
);

function yTabs(active, fn, opts) {
  return '<div class="tabs">' + (opts || Y_RANGES).map(([k, l]) =>
    '<button class="' + (k === active ? 'active' : '') + '" onclick="' + fn + '(\'' + k + '\')">' + l + '</button>'
  ).join('') + '</div>';
}
function yFirstName() { return (String(gPlayer()).trim().split(/\s+/)[0] || 'sparkle'); }
function yAddDays(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function yFmtDate(d) { return Y_MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }

// ======================== FESTIVAL POSTER ========================

const Y_FEST_STYLES = [n => n + 'CHELLA', n => n + 'PALOOZA', n => 'xXx ' + n + ' FEST xXx', n => n + ' ROCK'];

function yFestDates() {
  const d = new Date();
  const toFriday = (5 - d.getDay() + 7) % 7 || 7;
  const fri = yAddDays(d, toFriday + 28);
  const sun = yAddDays(fri, 2);
  const m = Y_MONTHS[fri.getMonth()].toUpperCase();
  return fri.getMonth() === sun.getMonth()
    ? m + ' ' + fri.getDate() + '-' + sun.getDate() + ' ' + fri.getFullYear()
    : m + ' ' + fri.getDate() + ' - ' + Y_MONTHS[sun.getMonth()].toUpperCase() + ' ' + sun.getDate() + ' ' + fri.getFullYear();
}

function yFestRows(artists) {
  const names = artists.map(a => a.name);
  return [names.slice(0, 3), names.slice(3, 9), names.slice(9, 21), names.slice(21, 45)].filter(r => r.length);
}

function yScreenFest(range) {
  Q.screen = 'fest';
  qStopAudio(); qClearTimers();
  if (range) Y.festRange = range;
  const r = Y.festRange || 'medium_term';
  const arts = (_data.artists[r] || []);
  if (arts.length < 3) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎪 festival poster', '') + qErrorBox('need at least 3 top artists for a lineup. listen to more stuff?'));
    return;
  }
  const title = Y_FEST_STYLES[X.festStyle % Y_FEST_STYLES.length](yFirstName().toUpperCase());
  const rows = yFestRows(arts);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎪 festival poster', 'your top artists as a lineup') +
    yTabs(r, 'yScreenFest') +
    '<div class="x-poster" id="x-poster">' +
      '<div class="x-fest-pre">live from your headphones</div>' +
      '<div class="x-fest-title">' + esc(title) + '</div>' +
      '<div class="x-fest-dates">' + yFestDates() + ' &middot; the pit, your bedroom</div>' +
      rows.map((row, i) => '<div class="x-fest-row r' + (i + 1) + '">' + row.map(n => '<span>' + esc(n) + '</span>').join('<i>•</i>') + '</div>').join('') +
      '<div class="x-fest-foot">tickets: free, you already own the music &middot; xXx SparkleStats xXx</div>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#x-poster\', \'sparklestats-fest\', this, 2)">save the poster</button>' +
      '<button class="q-btn ghost" onclick="yFestRename()">rename it</button>' +
    '</div>'
  );
}
function yFestRename() { X.festStyle++; yScreenFest(); }

// ======================== YOUR HOT 100 ========================
// every dashboard load snapshots your top songs for the current iso week.
// compare this week to last week and you get a chart with arrows.

const Y_CHART_KEY = 'sparkle_chart';

function yWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return y + '-W' + String(wk).padStart(2, '0');
}
function yChartLoad() {
  try { const c = JSON.parse(localStorage.getItem(Y_CHART_KEY) || 'null'); if (c && c.weeks && c.songs) return c; } catch {}
  return { weeks: {}, songs: {} };
}
function yChartSave(c) { try { localStorage.setItem(Y_CHART_KEY, JSON.stringify(c)); } catch {} }

function yChartSnapshot(tracks, when) {
  const c = yChartLoad();
  const wk = yWeekKey(when || new Date());
  const ids = [], seen = new Set();
  for (const t of tracks || []) {
    if (!t || !t.id || seen.has(t.id)) continue;
    seen.add(t.id); ids.push(t.id);
    c.songs[t.id] = { n: qStrip(t.name), a: gPrimary(t), art: qArt(t) };
  }
  if (!ids.length) return c;
  c.weeks[wk] = { at: Date.now(), ids };
  const keys = Object.keys(c.weeks).sort();
  while (keys.length > 60) delete c.weeks[keys.shift()];
  const used = new Set(Object.values(c.weeks).flatMap(w => w.ids));
  for (const id of Object.keys(c.songs)) if (!used.has(id)) delete c.songs[id];
  yChartSave(c);
  return c;
}

function yChartCompute(c) {
  const keys = Object.keys(c.weeks).sort();
  if (!keys.length) return null;
  const curKey = keys[keys.length - 1];
  const cur = c.weeks[curKey];
  const prevKey = keys.length > 1 ? keys[keys.length - 2] : null;
  const prev = prevKey ? c.weeks[prevKey] : null;
  const rows = cur.ids.map((id, i) => {
    const pos = i + 1;
    const last = prev ? prev.ids.indexOf(id) + 1 : 0;
    let peak = pos, weeks = 0, before = false;
    for (const k of keys) {
      const p = c.weeks[k].ids.indexOf(id) + 1;
      if (!p) continue;
      weeks++;
      if (p < peak) peak = p;
      if (k < curKey) before = true;
    }
    const move = !prev ? 'new' : last ? (last - pos) : (before ? 're' : 'new');
    return { id, pos, last, peak, weeks, move, ...(c.songs[id] || { n: '?', a: '', art: '' }) };
  });
  return { rows, curKey, prevKey, weeksTracked: keys.length };
}

function yMoveHtml(m) {
  if (m === 'new') return '<span class="x-mv new">NEW</span>';
  if (m === 're') return '<span class="x-mv re">RE</span>';
  if (m > 0) return '<span class="x-mv up">▲' + m + '</span>';
  if (m < 0) return '<span class="x-mv down">▼' + (-m) + '</span>';
  return '<span class="x-mv same">—</span>';
}

function yScreenChart() {
  Q.screen = 'chart';
  qStopAudio(); qClearTimers();
  const c = yChartLoad();
  const ch = yChartCompute(c);
  if (!ch) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('📈 your hot 100', '') + qErrorBox('nothing tracked yet. refresh the dashboard once and come back.'));
    return;
  }
  if (ch.weeksTracked >= 4 && typeof mAward === 'function') mAward('chart4');
  const numeric = ch.rows.filter(r => typeof r.move === 'number');
  const climber = numeric.length ? numeric.reduce((m, r) => r.move > m.move ? r : m) : null;
  const faller = numeric.length ? numeric.reduce((m, r) => r.move < m.move ? r : m) : null;
  const longest = ch.rows.reduce((m, r) => r.weeks > m.weeks ? r : m, ch.rows[0]);
  const debuts = ch.rows.filter(r => r.move === 'new').length;
  const stat = (l, v, s) => '<div class="x-stat"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('📈 ' + esc(yFirstName()) + '\'s hot ' + ch.rows.length, 'week ' + esc(ch.curKey.replace(/^\d+-W/, '')) + (ch.prevKey ? ' vs last week' : '')) +
    (ch.weeksTracked < 2
      ? '<p class="q-note" style="margin-bottom:12px;">first week on the books. come back next week and the arrows show up. (it snapshots every time you open the dashboard)</p>'
      : '<div class="x-stats">' +
          (climber && climber.move > 0 ? stat('biggest climber', esc(climber.n), '▲' + climber.move + ' to #' + climber.pos) : '') +
          (faller && faller.move < 0 ? stat('biggest fall', esc(faller.n), '▼' + (-faller.move) + ' to #' + faller.pos) : '') +
          stat('longest run', esc(longest.n), longest.weeks + ' week' + (longest.weeks === 1 ? '' : 's')) +
          stat('debuts', debuts, 'new this week') +
        '</div>') +
    '<div class="x-chart">' +
      ch.rows.map(r =>
        '<div class="x-crow">' +
          '<span class="pos">' + r.pos + '</span>' +
          yMoveHtml(r.move) +
          (r.art ? '<img src="' + r.art + '" alt="">' : '<span class="ph"></span>') +
          '<div class="info"><div class="nm">' + esc(r.n) + '</div><div class="ar">' + esc(r.a) + '</div></div>' +
          '<span class="meta">peak ' + r.peak + ' &middot; ' + r.weeks + 'w</span>' +
        '</div>'
      ).join('') +
    '</div>' +
    '<p class="q-note" style="margin-top:12px;">' + ch.weeksTracked + ' week' + (ch.weeksTracked === 1 ? '' : 's') + ' tracked on this device &middot; based on your last-4-weeks top songs</p>'
  );
}

// hook: snapshot on every dashboard render, then quietly fetch places 51-100
if (typeof renderDashboard === 'function') {
  const yPrevRender = renderDashboard;
  renderDashboard = function (data, analysis) {
    try {
      const top = (data && data.tracks && data.tracks.short_term) || [];
      yChartSnapshot(top);
      if (typeof apiFetch === 'function' && top.length >= 50) {
        apiFetch('/me/top/tracks?time_range=short_term&limit=50&offset=50')
          .then(r => { if (r && r.items && r.items.length) yChartSnapshot([...top, ...r.items]); })
          .catch(() => {});
      }
    } catch {}
    return yPrevRender(data, analysis);
  };
  window.renderDashboard = renderDashboard;
}

// ======================== YOUR MUSIC IN COLORS ========================

function yKmeans(px, k, iters) {
  if (!px.length) return [];
  // seed with the pixels farthest from the seeds so far - a black cover with
  // one pink accent gets a black seed AND a pink seed instead of four blacks
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  let cents = [px[0].slice()];
  while (cents.length < k) {
    let best = px[0], bd = -1;
    for (const p of px) { const d = Math.min(...cents.map(c => d2(p, c))); if (d > bd) { bd = d; best = p; } }
    cents.push(best.slice());
  }
  let counts = cents.map(() => 0);
  for (let it = 0; it < iters; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let b = 0, bd = Infinity;
      for (let i = 0; i < cents.length; i++) {
        const c = cents[i];
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; b = i; }
      }
      const s = sums[b]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    cents = sums.map((s, i) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cents[i]);
    counts = sums.map(s => s[3]);
  }
  return cents.map((c, i) => ({ rgb: c.map(Math.round), n: counts[i] })).sort((a, b) => b.n - a.n);
}
function ySat(rgb) { const mx = Math.max(...rgb), mn = Math.min(...rgb); return mx ? (mx - mn) / mx : 0; }
function yHex(rgb) { return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function yHue(rgb) {
  const [r, g, b] = rgb.map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return -1;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  return h;
}
// the cover's "vibe" color: big clusters win, but a vivid accent beats a black background
function yVibe(clusters) {
  if (!clusters.length) return null;
  return clusters.map(c => ({ ...c, score: c.n * (0.25 + ySat(c.rgb)) })).sort((a, b) => b.score - a.score)[0];
}
function yPaletteName(swatches) {
  const vivid = swatches.filter(s => ySat(s.rgb) > 0.25 && Math.max(...s.rgb) > 60);
  const dark = swatches.filter(s => Math.max(...s.rgb) < 70).length;
  const fam = h => h < 0 ? 'gray' : (h >= 300 || h < 15) ? 'pink' : h < 45 ? 'orange' : h < 70 ? 'yellow' : h < 170 ? 'green' : h < 250 ? 'blue' : 'purple';
  const counts = {};
  for (const s of vivid) { const f = fam(yHue(s.rgb)); counts[f] = (counts[f] || 0) + 1; }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const names = { pink: 'hot pink hours', orange: 'sunset static', yellow: 'gold rush', green: 'poison apple', blue: 'blue light', purple: 'violet static', gray: 'grayscale' };
  const base = top ? names[top[0]] : 'blackout';
  return dark >= swatches.length / 2 ? base + ' (mostly black)' : base;
}

function yLoadPixels(url) {
  return new Promise(resolve => {
    if (typeof Image !== 'function') { resolve(null); return; }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, 32, 32);
        const d = ctx.getImageData(0, 0, 32, 32).data;
        const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
        resolve(px);
      } catch (e) { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

async function yScreenColors(range) {
  Q.screen = 'colors';
  qStopAudio(); qClearTimers();
  if (range) Y.colorRange = range;
  const r = Y.colorRange || 'medium_term';
  const seen = new Set();
  const albums = [];
  for (const t of (_data.tracks[r] || [])) {
    const key = t.album?.id || t.album?.name; const art = qArt(t);
    if (!art || !key || seen.has(key)) continue;
    seen.add(key); albums.push({ key, name: t.album.name, artist: gPrimary(t), art });
    if (albums.length >= 12) break;
  }
  qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎨 your music in colors', 'the colors of your top album covers') + yTabs(r, 'yScreenColors') +
    '<div class="q-loadwrap"><div class="spinner">🎨</div><p>reading the covers...</p></div>');
  const token = (Y.colorToken = (Y.colorToken || 0) + 1);
  const results = await Promise.all(albums.map(async a => ({ ...a, px: await yLoadPixels(a.art) })));
  if (token !== Y.colorToken || Q.screen !== 'colors') return;
  const swatches = results.filter(x => x.px).map(x => { const v = yVibe(yKmeans(x.px, 4, 8)); return { ...x, rgb: v.rgb, hex: yHex(v.rgb) }; });
  if (!swatches.length) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('🎨 your music in colors', '') +
      qErrorBox('couldn\'t read the cover images (the browser wouldn\'t let us look at the pixels). try again in a sec, or on another browser?'));
    return;
  }
  const sorted = swatches.slice().sort((a, b) => yHue(a.rgb) - yHue(b.rgb));
  const name = yPaletteName(swatches);
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('🎨 your music in colors', 'the colors of your top album covers') +
    yTabs(r, 'yScreenColors') +
    '<div class="x-palette" id="x-palette">' +
      '<div class="x-pal-title">' + esc(yFirstName()) + '\'s palette</div>' +
      '<div class="x-pal-name">' + esc(name) + '</div>' +
      '<div class="x-pal-strip">' + sorted.map(s => '<span style="background:' + s.hex + ';"></span>').join('') + '</div>' +
      '<div class="x-pal-grid">' +
        swatches.map(s => '<div class="x-sw"><img src="' + s.art + '" alt="" crossorigin="anonymous"><span class="chip" style="background:' + s.hex + ';"></span><span class="hex">' + s.hex + '</span></div>').join('') +
      '</div>' +
      '<div class="x-pal-foot">xXx SparkleStats xXx</div>' +
    '</div>' +
    '<div class="q-actions">' +
      '<button class="q-btn" onclick="lSaveNode(\'#x-palette\', \'sparklestats-colors\', this, 2)">save it</button>' +
      '<button class="q-btn ghost" onclick="xCopy(this, \'' + sorted.map(s => s.hex).join(' ') + '\')">copy the hex codes</button>' +
    '</div>'
  );
}

// ======================== TIME CAPSULE ========================

const Y_CAPSULE_KEY = 'sparkle_capsule';
function yCapsLoad() { try { return JSON.parse(localStorage.getItem(Y_CAPSULE_KEY) || '[]') || []; } catch { return []; } }
function yCapsSave(list) { try { localStorage.setItem(Y_CAPSULE_KEY, JSON.stringify(list)); } catch {} }

function yScreenCapsule() {
  Q.screen = 'capsule';
  qStopAudio(); qClearTimers();
  const list = yCapsLoad().sort((a, b) => a.openAt - b.openAt);
  const now = Date.now();
  const tomorrow = new Date(now + 86400000);
  const minDate = tomorrow.toISOString().slice(0, 10);
  const days = ms => Math.max(1, Math.ceil(ms / 86400000));
  const capHtml = c => {
    const ready = now >= c.openAt;
    return '<div class="x-cap' + (ready ? ' ready' : '') + (c.opened ? ' open' : '') + '">' +
      '<div class="x-cap-top"><span class="x-cap-ico">' + (c.opened ? '📖' : ready ? '🎁' : '🔒') + '</span>' +
        '<div><div class="nm">' + (c.opened ? 'opened' : ready ? 'ready to open' : 'sealed') + '</div>' +
        '<div class="mt">buried ' + yFmtDate(new Date(c.createdAt)) + ' &middot; ' + (ready ? 'opens ' : 'opens in ' + days(c.openAt - now) + ' days, ') + yFmtDate(new Date(c.openAt)) + '</div></div></div>' +
      (c.opened
        ? '<div class="x-cap-note">' + esc(c.note) + '</div>' +
          '<div class="q-note" style="margin:10px 0 6px;">your top songs back then</div>' +
          '<div class="x-cap-list">' + c.tracks.map(t => {
            const still = (typeof lCdTracks === 'function' ? lCdTracks() : []).some(x => x.id === t.id);
            return '<div class="x-cap-row">' + (t.art ? '<img src="' + t.art + '" alt="">' : '') + '<div class="info"><div class="nm">' + esc(t.n) + '</div><div class="ar">' + esc(t.a) + '</div></div>' +
              '<span class="' + (still ? 'still' : 'gone') + '">' + (still ? 'still on repeat' : 'fell off') + '</span></div>';
          }).join('') + '</div>' +
          (c.artists && c.artists.length ? '<div class="q-note" style="margin-top:8px;">top artists then: ' + esc(c.artists.join(', ')) + '</div>' : '') +
          '<div class="q-actions"><button class="q-btn ghost" onclick="yCapsDelete(\'' + c.id + '\')">let it go</button></div>'
        : ready
        ? '<div class="q-actions"><button class="q-btn" onclick="yCapsOpen(\'' + c.id + '\')">open it 🎁</button></div>'
        : '<div class="q-note">no peeking. it holds a note from you and your top 10 from that day.</div>') +
    '</div>';
  };
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('⏳ time capsule', 'a note to future you, sealed with today\'s top songs') +
    (list.length ? '<div class="x-caps">' + list.map(capHtml).join('') + '</div>' : '') +
    '<div class="x-cap-new">' +
      '<div class="q-note" style="margin-bottom:8px;">bury a new one</div>' +
      '<textarea id="x-cap-note" class="q-input x-textarea" maxlength="600" placeholder="dear future me..."></textarea>' +
      '<div class="q-note" style="margin:10px 0 6px;">opens on</div>' +
      '<div class="x-cap-when">' +
        '<input id="x-cap-date" type="date" class="q-input" min="' + minDate + '" value="' + new Date(now + 30 * 86400000).toISOString().slice(0, 10) + '">' +
        '<button class="q-btn ghost" onclick="yCapsQuick(30)">1 month</button>' +
        '<button class="q-btn ghost" onclick="yCapsQuick(182)">6 months</button>' +
        '<button class="q-btn ghost" onclick="yCapsQuick(365)">1 year</button>' +
      '</div>' +
      '<div class="q-actions"><button class="q-btn" onclick="yCapsBury()">seal it 🔒</button></div>' +
      '<p class="q-note" id="x-cap-status">lives on this device only. clearing your browser data clears it too.</p>' +
    '</div>'
  );
}
function yCapsQuick(days) {
  const el = document.getElementById('x-cap-date');
  if (el) el.value = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
function yCapsBury() {
  const noteEl = document.getElementById('x-cap-note'), dateEl = document.getElementById('x-cap-date'), st = document.getElementById('x-cap-status');
  const note = String(noteEl ? noteEl.value : '').trim();
  const when = dateEl && dateEl.value ? new Date(dateEl.value + 'T09:00:00') : null;
  if (!note) { if (st) st.textContent = 'write something first. even one line.'; return; }
  if (!when || isNaN(when.getTime()) || when.getTime() <= Date.now()) { if (st) st.textContent = 'pick a day in the future.'; return; }
  const tracks = ((_data && _data.tracks && _data.tracks.short_term) || []).slice(0, 10).map(t => ({ id: t.id, n: qStrip(t.name), a: gPrimary(t), art: qArt(t) }));
  const artists = ((_data && _data.artists && _data.artists.short_term) || []).slice(0, 5).map(a => a.name);
  const list = yCapsLoad();
  list.push({ id: 'c' + Date.now().toString(36), note, createdAt: Date.now(), openAt: when.getTime(), tracks, artists, opened: false });
  yCapsSave(list);
  if (typeof mAward === 'function') mAward('capsule');
  yScreenCapsule();
}
function yCapsOpen(id) {
  const list = yCapsLoad();
  const c = list.find(x => x.id === id);
  if (!c || Date.now() < c.openAt) return;
  c.opened = true;
  yCapsSave(list);
  yScreenCapsule();
  if (window.confetti) confetti({ particleCount: 90, spread: 75, origin: { y: 0.4 }, colors: ['#FF1493', '#FFB6C1', '#FF69B4', '#8B00FF'] });
}
function yCapsDelete(id) {
  const list = yCapsLoad().filter(x => !(x.id === id && x.opened));
  yCapsSave(list);
  yScreenCapsule();
}

// ======================== WHICH SONGS ARE THAT GENRE ========================
// genres are per artist (apple tags an artist's albums), so a genre on your
// dashboard = "one or more of your top artists is tagged with it". this shows
// which artists, and which of your top songs are theirs.

function yGenreWho(genre) {
  const want = String(genre || '').toLowerCase().trim();
  const artists = [];
  const seen = new Set();
  const ranges = { short_term: 'last month', medium_term: 'last 6 months', long_term: 'all time' };
  for (const [range, list] of Object.entries((_data && _data.artists) || {})) {
    for (const a of list || []) {
      if (!a || seen.has(a.id)) continue;
      if (!(a.genres || []).some(g => String(g).toLowerCase().trim() === want)) continue;
      seen.add(a.id);
      artists.push({ id: a.id, name: a.name, img: img(a.images, 'sm'), genres: (a.genres || []).filter(g => String(g).toLowerCase().trim() !== want), range: ranges[range] });
    }
  }
  const ids = new Set(artists.map(a => a.id));
  const songs = [];
  const seenT = new Set();
  for (const list of Object.values((_data && _data.tracks) || {})) {
    for (const t of list || []) {
      if (!t || seenT.has(t.id)) continue;
      if (!(t.artists || []).some(a => ids.has(a.id))) continue;
      seenT.add(t.id);
      songs.push({ id: t.id, name: qStrip(t.name), artist: qArtistNames(t), art: qArt(t) });
    }
  }
  return { artists, songs };
}

function yShowGenre(genre) {
  if (!_data) return;
  const { artists, songs } = yGenreWho(genre);
  let pop = document.getElementById('x-genre-pop');
  if (!pop) { pop = document.createElement('div'); pop.id = 'x-genre-pop'; document.body.appendChild(pop); }
  pop.onclick = e => { if (e.target === pop) yHideGenre(); };
  pop.innerHTML = '<div class="box">' +
    '<h3>' + esc(genre) + '</h3>' +
    '<div class="sub">' + (artists.length
      ? artists.length + ' of your top artist' + (artists.length === 1 ? ' is' : 's are') + ' tagged "' + esc(genre) + '" on apple music. ' +
        'it counts toward you even if only some of their songs sound like it.'
      : 'none of your current top artists carry this tag. it came from an artist who fell out of your top 50 - refresh and it should clear up.') + '</div>' +
    (artists.length ? '<div class="lbl">the artists</div>' + artists.map(a =>
      '<div class="who">' + (a.img ? '<img src="' + a.img + '" alt="">' : '') + '<div style="flex:1;min-width:0;"><div class="nm">' + esc(a.name) + '</div>' +
      '<div class="ar">' + esc(a.range) + (a.genres.length ? ' &middot; also ' + esc(a.genres.slice(0, 3).join(', ')) : '') + '</div></div></div>').join('') : '') +
    (songs.length ? '<div class="lbl">your songs by them</div>' + songs.slice(0, 20).map(s =>
      '<div class="who">' + (s.art ? '<img src="' + s.art + '" alt="">' : '') + '<div style="flex:1;min-width:0;"><div class="nm">' + esc(s.name) + '</div><div class="ar">' + esc(s.artist) + '</div></div></div>').join('') +
      (songs.length > 20 ? '<div class="sub" style="margin-top:6px;">+ ' + (songs.length - 20) + ' more</div>' : '')
      : (artists.length ? '<div class="sub" style="margin-top:10px;">none of their songs are in your top 50s right now - they\'re in your top artists from plays that don\'t show up as top songs.</div>' : '')) +
    '<div class="q-actions" style="margin-top:14px;"><button class="q-btn ghost" onclick="yHideGenre()">close</button></div>' +
  '</div>';
}
function yHideGenre() { const pop = document.getElementById('x-genre-pop'); if (pop) pop.remove(); }

// ======================== HUB ========================

X_HUB.you.push(
  () => xCard('🎪', 'festival poster', 'your top artists as a lineup poster', 'yScreenFest()'),
  () => { const c = yChartLoad(); const n = Object.keys(c.weeks).length; return xCard('📈', 'your hot 100', 'your top songs as a weekly chart with arrows', 'yScreenChart()', n ? n + ' wk' : ''); },
  () => xCard('🎨', 'your music in colors', 'a palette pulled from your top album covers', 'yScreenColors()'),
  () => { const n = yCapsLoad().filter(c => !c.opened && Date.now() >= c.openAt).length; return xCard('⏳', 'time capsule', 'a note to future you, sealed with today\'s top songs', 'yScreenCapsule()', n ? 'open me' : ''); }
);

Object.assign(window, {
  yScreenFest, yFestRename, yScreenChart, yScreenColors, yScreenCapsule, yCapsQuick, yCapsBury, yCapsOpen, yCapsDelete,
  yShowGenre, yHideGenre,
});
