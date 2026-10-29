// ============================================================
//  xXx SparkleStats xXx  -  history.js
//  minutes listened: this week / 6 months / a year / lifetime,
//  per artist and per song. spotify's api doesn't expose listening
//  time at all, so this reads the data export spotify emails you
//  (privacy settings -> download your data). everything is parsed
//  in the browser and only the totals are kept, in localStorage.
// ============================================================

const H_KEY = 'sparkle_history';
const H_DAY = 86400000;
const H_PERIODS = [['week', 'this week', 7], ['half', 'past 6 months', 182], ['year', 'past year', 365], ['life', 'lifetime', 0]];
const H_MAX_TRACKS = 3000;      // per-day detail kept for this many songs (the rest still count in totals)

const H = { data: null, artist: '', tab: 'life', status: '' };

// ======================== PARSING ========================

// one stream in either export format -> { t (ms), artist, track, ms }
function hNormalize(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.endTime && (row.artistName || row.trackName)) {
    // "account data" export: StreamingHistory_music_N.json, endTime is "2025-03-04 21:15" (utc)
    const t = Date.parse(String(row.endTime).replace(' ', 'T') + ':00Z');
    if (!t || !row.artistName) return null;
    return { t, artist: String(row.artistName), track: String(row.trackName || ''), ms: Number(row.msPlayed) || 0 };
  }
  if (row.ts && ('ms_played' in row)) {
    // "extended streaming history": Streaming_History_Audio_*.json / endsong_N.json
    if (!row.master_metadata_track_name || !row.master_metadata_album_artist_name) return null;   // podcasts etc
    const t = Date.parse(row.ts);
    if (!t) return null;
    return { t, artist: String(row.master_metadata_album_artist_name), track: String(row.master_metadata_track_name), ms: Number(row.ms_played) || 0 };
  }
  return null;
}

function hIsHistoryFile(name) {
  return /StreamingHistory.*\.json$|Streaming_History_Audio.*\.json$|endsong.*\.json$/i.test(String(name || ''));
}

// rows -> compact aggregate { from, to, days, artists: {name: {ms, n, d: {day: ms}}}, tracks: {"track|artist": {...}} }
function hAggregate(rows) {
  const artists = {}, tracks = {};
  let from = Infinity, to = -Infinity;
  for (const r of rows) {
    if (!r || !r.artist) continue;
    if (r.t < from) from = r.t;
    if (r.t > to) to = r.t;
    const day = Math.floor(r.t / H_DAY);
    const a = artists[r.artist] = artists[r.artist] || { ms: 0, n: 0, d: {} };
    a.ms += r.ms; a.n++; a.d[day] = (a.d[day] || 0) + r.ms;
    if (r.track) {
      const k = r.track + '|' + r.artist;
      const tr = tracks[k] = tracks[k] || { ms: 0, n: 0, d: {} };
      tr.ms += r.ms; tr.n++; tr.d[day] = (tr.d[day] || 0) + r.ms;
    }
  }
  // keep per-day detail only for the biggest songs so the whole thing fits in localStorage
  const keys = Object.keys(tracks).sort((x, y) => tracks[y].ms - tracks[x].ms);
  for (const k of keys.slice(H_MAX_TRACKS)) delete tracks[k].d;
  return { v: 1, from: isFinite(from) ? from : 0, to: isFinite(to) ? to : 0, streams: rows.length, artists, tracks, loadedAt: Date.now() };
}

// merges a new export into what's saved: if the ranges overlap we trust the new one for its span
function hMerge(oldD, newD) {
  if (!oldD) return newD;
  if (!newD) return oldD;
  // simplest safe rule: keep whichever covers more, unless they don't overlap at all (then add)
  const overlap = newD.from <= oldD.to && oldD.from <= newD.to;
  if (overlap) return (newD.to - newD.from) >= (oldD.to - oldD.from) ? newD : oldD;
  const out = { v: 1, from: Math.min(oldD.from, newD.from), to: Math.max(oldD.to, newD.to), streams: (oldD.streams || 0) + (newD.streams || 0), artists: {}, tracks: {}, loadedAt: Date.now() };
  const add = (into, src) => {
    for (const [k, v] of Object.entries(src)) {
      const cur = into[k] = into[k] || { ms: 0, n: 0, d: {} };
      cur.ms += v.ms; cur.n += v.n;
      if (v.d && cur.d) for (const [day, ms] of Object.entries(v.d)) cur.d[day] = (cur.d[day] || 0) + ms;
    }
  };
  add(out.artists, oldD.artists); add(out.artists, newD.artists);
  add(out.tracks, oldD.tracks); add(out.tracks, newD.tracks);
  return out;
}

function hLoad() {
  if (H.data) return H.data;
  try { const d = JSON.parse(localStorage.getItem(H_KEY) || 'null'); if (d && d.artists) H.data = d; } catch {}
  return H.data;
}
function hSave(d) {
  H.data = d;
  try { localStorage.setItem(H_KEY, JSON.stringify(d)); return true; } catch { return false; }
}

// ======================== NUMBERS ========================

// ms for one entry inside a period (days back from the data's last day; 0 = lifetime)
function hMsIn(entry, days, toDay) {
  if (!entry) return 0;
  if (!days) return entry.ms;
  if (!entry.d) return null;                  // detail dropped - unknown for this period
  const start = toDay - days + 1;
  let ms = 0;
  for (const [day, v] of Object.entries(entry.d)) if (Number(day) >= start && Number(day) <= toDay) ms += v;
  return ms;
}
function hTop(map, days, toDay, n) {
  const rows = [];
  for (const [name, e] of Object.entries(map)) {
    const ms = hMsIn(e, days, toDay);
    if (ms) rows.push({ name, ms });
  }
  rows.sort((a, b) => b.ms - a.ms);
  return rows.slice(0, n || 20);
}
function hMinutes(ms) { return Math.round(ms / 60000); }
function hFmt(ms) {
  const m = hMinutes(ms);
  if (m >= 6000) return (m / 60).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' hrs';
  return m.toLocaleString() + ' min';
}
function hFmtLong(ms) {
  const m = hMinutes(ms);
  const h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 2) return d + ' days ' + (h % 24) + ' hrs';
  if (h >= 1) return h + ' hrs ' + (m % 60) + ' min';
  return m + ' min';
}
function hDate(ms) { return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function hFind(map, name) {
  const want = qNorm(name);
  if (!want) return null;
  const keys = Object.keys(map);
  let hit = keys.find(k => qNorm(k) === want);
  if (!hit) hit = keys.filter(k => qNorm(k).includes(want)).sort((a, b) => map[b].ms - map[a].ms)[0];
  return hit || null;
}

// ======================== IMPORT ========================

async function hReadFiles(files) {
  const rows = [];
  let seen = 0;
  const eat = (text, name) => {
    let arr;
    try { arr = JSON.parse(text); } catch { throw new Error(name + ' isn\'t valid json'); }
    if (!Array.isArray(arr)) return;
    for (const r of arr) { const n = hNormalize(r); if (n) rows.push(n); }
    seen++;
  };
  for (const f of files) {
    const name = f.name || 'file';
    if (/\.zip$/i.test(name)) {
      if (typeof JSZip !== 'function') throw new Error('zip support didn\'t load - unzip it and drop the json files instead');
      const zip = await JSZip.loadAsync(f);
      const entries = Object.values(zip.files).filter(e => !e.dir && hIsHistoryFile(e.name));
      if (!entries.length) throw new Error('no streaming history files in ' + name + '. make sure you ticked the right box on spotify.');
      for (const e of entries) eat(await e.async('string'), e.name);
    } else if (/\.json$/i.test(name)) {
      eat(await f.text(), name);
    }
  }
  if (!seen) throw new Error('drop the zip spotify emailed you, or the StreamingHistory / Streaming_History_Audio json files inside it');
  return rows;
}

async function hImport(files) {
  const st = document.getElementById('h-status');
  const say = m => { if (st) st.innerHTML = m; };
  try {
    say('reading...');
    const rows = await hReadFiles(Array.from(files || []));
    if (!rows.length) { say('found the files but no music streams in them?'); return; }
    say('adding up ' + rows.length.toLocaleString() + ' streams...');
    const agg = hAggregate(rows);
    const merged = hMerge(hLoad(), agg);
    const ok = hSave(merged);
    if (typeof mAward === 'function') mAward('history');
    hScreen();
    if (!ok && typeof showToast === 'function') showToast('too big to save in this browser - it\'ll work until you reload');
  } catch (e) {
    say(esc(e.message || String(e)));
  }
}
function hPick(input) { if (input && input.files && input.files.length) hImport(input.files); }
function hDrop(e) {
  e.preventDefault();
  const z = document.getElementById('h-drop'); if (z) z.classList.remove('over');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) hImport(e.dataTransfer.files);
}
function hDragOver(e) { e.preventDefault(); const z = document.getElementById('h-drop'); if (z) z.classList.add('over'); }
function hDragLeave() { const z = document.getElementById('h-drop'); if (z) z.classList.remove('over'); }
function hForget() {
  H.data = null;
  try { localStorage.removeItem(H_KEY); } catch {}
  hScreen();
}

// ======================== SCREEN ========================

function hHowTo() {
  return '<div class="h-howto">' +
    '<div class="q-note" style="margin-bottom:6px;">how to get the file</div>' +
    '<ol>' +
      '<li>go to <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noopener">spotify.com/account/privacy</a> and scroll to <b>download your data</b></li>' +
      '<li>tick <b>extended streaming history</b> for lifetime (takes up to 30 days) and/or <b>account data</b> for the last year (a few days)</li>' +
      '<li>spotify emails you a zip. drop the zip here, or the json files from inside it. nothing gets uploaded anywhere.</li>' +
    '</ol></div>';
}

function hDropZone() {
  return '<div class="h-drop" id="h-drop" ondragover="hDragOver(event)" ondragleave="hDragLeave()" ondrop="hDrop(event)">' +
      '<div class="big">📂</div><div>drop the zip or json files here</div>' +
      '<label class="q-btn ghost" style="margin-top:10px;display:inline-block;cursor:pointer;">or pick files<input type="file" multiple accept=".zip,.json,application/zip,application/json" style="display:none;" onchange="hPick(this)"></label>' +
      '<p class="q-note" id="h-status" style="margin-top:10px;"></p>' +
    '</div>';
}

function hScreen(tab) {
  Q.screen = 'history';
  qStopAudio(); qClearTimers();
  if (tab) H.tab = tab;
  const d = hLoad();
  if (!d) {
    qSet(qTopBar('&larr; arcade', 'gScreenHub()') + qHeader('⏱️ minutes listened', 'this week, 6 months, a year, lifetime') +
      '<p class="q-note" style="margin-bottom:12px;">spotify\'s api doesn\'t share listening time with apps, so this needs the data export spotify gives you directly. one-time thing (until you want fresh numbers).</p>' +
      hDropZone() + hHowTo());
    return;
  }
  const toDay = Math.floor(d.to / H_DAY);
  const period = H_PERIODS.find(p => p[0] === H.tab) || H_PERIODS[3];
  const days = period[2];
  const totalIn = dd => Object.values(d.artists).reduce((s, e) => s + (hMsIn(e, dd, toDay) || 0), 0);
  const tiles = H_PERIODS.map(([k, label, dd]) => '<div class="x-stat h-tile' + (k === H.tab ? ' on' : '') + '" onclick="hScreen(\'' + k + '\')"><div class="l">' + label + '</div><div class="v">' + hFmt(totalIn(dd)) + '</div></div>').join('');
  const topA = hTop(d.artists, days, toDay, 20);
  const topT = hTop(d.tracks, days, toDay, 20);
  const maxA = topA.length ? topA[0].ms : 1, maxT = topT.length ? topT[0].ms : 1;
  const bar = (r, max, sub) => '<div class="h-row"><div class="info"><div class="nm">' + esc(r.name.split('|')[0]) + '</div>' + (sub ? '<div class="ar">' + esc(sub(r)) + '</div>' : '') +
    '<div class="h-bar"><i style="width:' + Math.max(2, r.ms / max * 100) + '%;"></i></div></div><span class="sc">' + hFmt(r.ms) + '</span></div>';
  let artistBox = '';
  if (H.artist) {
    const key = hFind(d.artists, H.artist);
    if (!key) artistBox = qErrorBox('no "' + esc(H.artist) + '" in your history. spelled the way spotify spells it?');
    else {
      const e = d.artists[key];
      const first = Math.min(...Object.keys(e.d || {}).map(Number)) * H_DAY;
      const songs = Object.entries(d.tracks).filter(([k]) => k.endsWith('|' + key)).map(([k, v]) => ({ name: k, ms: hMsIn(v, days, toDay) || 0 })).filter(s => s.ms).sort((a, b) => b.ms - a.ms).slice(0, 8);
      const rank = dd => { const rows = hTop(d.artists, dd, toDay, 100000); const i = rows.findIndex(r => r.name === key); return i < 0 ? '-' : '#' + (i + 1); };
      artistBox = '<div class="h-artist">' +
        '<div class="h-artist-h">' + esc(key) + '</div>' +
        '<div class="x-stats">' + H_PERIODS.map(([k, label, dd]) => { const ms = hMsIn(e, dd, toDay) || 0; return '<div class="x-stat"><div class="l">' + label + '</div><div class="v">' + hFmt(ms) + '</div><div class="s">' + rank(dd) + ' artist' + (ms ? ' &middot; ' + hFmtLong(ms) : '') + '</div></div>'; }).join('') + '</div>' +
        '<div class="q-note">' + e.n.toLocaleString() + ' streams all time' + (isFinite(first) ? ' &middot; first heard ' + hDate(first) : '') + '</div>' +
        (songs.length ? '<div class="q-note" style="margin-top:10px;">their songs, ' + period[1] + '</div><div class="h-list">' + songs.map(s => bar(s, songs[0].ms)).join('') + '</div>' : '') +
      '</div>';
    }
  }
  qSet(
    qTopBar('&larr; arcade', 'gScreenHub()') +
    qHeader('⏱️ minutes listened', hDate(d.from) + ' to ' + hDate(d.to)) +
    '<div class="x-stats h-tiles">' + tiles + '</div>' +
    '<p class="q-note" style="margin:-4px 0 12px;">tap a period. "this week" = the last 7 days in the file, ending ' + hDate(d.to) + '. re-drop a fresh export whenever you want it current.</p>' +
    '<div class="q-typerow" style="max-width:420px;margin:0 auto 10px;">' +
      '<input id="h-artist" class="q-input" list="h-names" placeholder="look up an artist..." value="' + esc(H.artist) + '" autocomplete="off">' +
      '<datalist id="h-names">' + hTop(d.artists, 0, toDay, 300).map(r => '<option value="' + esc(r.name) + '">').join('') + '</datalist>' +
      '<button class="q-btn" onclick="hLookup()">go</button>' +
    '</div>' +
    artistBox +
    '<div class="h-cols">' +
      '<div><div class="q-note" style="margin-bottom:6px;">top artists &middot; ' + period[1] + '</div><div class="h-list">' + (topA.length ? topA.map(r => bar(r, maxA)).join('') : '<p class="q-note">nothing in this window</p>') + '</div></div>' +
      '<div><div class="q-note" style="margin-bottom:6px;">top songs &middot; ' + period[1] + '</div><div class="h-list">' + (topT.length ? topT.map(r => bar(r, maxT, x => x.name.split('|')[1] || '')).join('') : '<p class="q-note">nothing in this window</p>') + '</div></div>' +
    '</div>' +
    '<p class="q-note" style="margin-top:14px;">' + (d.streams || 0).toLocaleString() + ' streams &middot; ' + Object.keys(d.artists).length.toLocaleString() + ' artists &middot; saved on this device only</p>' +
    '<details class="h-more"><summary>add another export / start over</summary>' + hDropZone() + hHowTo() +
      '<div class="q-actions"><button class="q-btn ghost" onclick="hForget()">forget my history</button></div></details>'
  );
  const inp = document.getElementById('h-artist');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') hLookup(); });
}
function hLookup() {
  const inp = document.getElementById('h-artist');
  H.artist = String(inp ? inp.value : '').trim();
  hScreen();
}

X_HUB.you.push(() => { const d = hLoad(); return xCard('⏱️', 'minutes listened', 'per artist: this week, 6 months, a year, lifetime', 'hScreen()', d ? 'loaded' : ''); });

Object.assign(window, { hScreen, hImport, hPick, hDrop, hDragOver, hDragLeave, hForget, hLookup });
