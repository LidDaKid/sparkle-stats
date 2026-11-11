// ============================================================
//  xXx SparkleStats xXx  -  covers.js
//  cover saver: any song or album cover as a real png.
//  apple's catalog serves the original artwork (often 1400-3000px)
//  straight as png; spotify-only covers (640px jpg) get redrawn
//  onto a canvas and saved as png.
//  loads after eight.js (borrows its e-list / e-row / e-card styles).
// ============================================================

const CV = {
  tab: 'songs', hits: [], top: [], albums: [],
  pick: null,          // { title, artist, kind, apple, spotify }
  size: 'full', token: 0, dims: '',
};
const CV_SIZES = [['full', 'full size'], ['1000', '1000'], ['640', '640'], ['300', '300']];

// pure: apple artwork url at any size, as png. 3000 = "biggest they have"
function cvAppleUrl(base, size) {
  if (!base) return '';
  const n = size === 'full' ? 3000 : parseInt(size, 10) || 3000;
  return String(base).replace(/\/[^/]*$/, '/' + n + 'x' + n + 'bb.png');
}

// pure: loose title match so "Fallen (Deluxe Edition)" finds "Fallen"
function cvNorm(s) {
  return String(s || '').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').replace(/[^a-z0-9]+/g, '');
}

function cvFile(p) {
  return ((p.artist ? p.artist + ' - ' : '') + p.title).replace(/[\\/:*?"<>|]/g, '').slice(0, 120) || 'cover';
}

// ======================== FINDING COVERS ========================

async function cvSearch() {
  const inp = document.getElementById('cv-q');
  const q = inp ? inp.value.trim() : '';
  if (!q) return;
  const box = document.getElementById('cv-results');
  if (box) box.innerHTML = '<p class="q-note">looking...</p>';
  const ent = CV.tab === 'albums' ? 'album' : 'song';
  try {
    const res = await fetch(ITUNES + '?term=' + encodeURIComponent(q) + '&entity=' + ent + '&limit=20');
    const data = await res.json();
    CV.hits = (data.results || []).filter(r => r.artworkUrl100).map(r => ({
      title: ent === 'album' ? r.collectionName : r.trackName,
      artist: r.artistName,
      sub: ent === 'album' ? (r.releaseDate || '').slice(0, 4) : r.collectionName,
      thumb: r.artworkUrl100,
      apple: r.artworkUrl100,
      spotify: '',
    }));
  } catch { CV.hits = []; }
  cvRenderList();
}

// spotify covers top out at 640, so look for the same album on apple first
async function cvAppleFor(album, artist) {
  try {
    const res = await fetch(ITUNES + '?term=' + encodeURIComponent(album + ' ' + artist) + '&entity=album&limit=10');
    const data = await res.json();
    const want = cvNorm(album), who = cvNorm(artist);
    const hit = (data.results || []).find(r => cvNorm(r.collectionName) === want && cvNorm(r.artistName).indexOf(who) >= 0)
      || (data.results || []).find(r => cvNorm(r.collectionName) === want);
    return hit ? hit.artworkUrl100 : '';
  } catch { return ''; }
}

function cvLoadTop() {
  if (typeof _data === 'undefined' || !_data || CV.top.length) return;
  const t = _data.tracks;
  const all = qDedupe([...(t.short_term || []), ...(t.medium_term || []), ...(t.long_term || [])]).filter(x => !qIsAlt(x.name));
  CV.top = all.slice(0, 50).map(x => ({
    title: qStrip(x.name), artist: qArtistNames(x), sub: x.album ? x.album.name : '',
    thumb: img(x.album && x.album.images, 'sm'), spotify: img(x.album && x.album.images), album: x.album ? x.album.name : '',
  }));
  const seen = new Set();
  CV.albums = [];
  for (const x of all) {
    const a = x.album; if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    CV.albums.push({
      title: a.name, artist: (a.artists || x.artists || []).map(z => z.name).join(', '), sub: (a.release_date || '').slice(0, 4),
      thumb: img(a.images, 'sm'), spotify: img(a.images), album: a.name,
    });
    if (CV.albums.length >= 50) break;
  }
}

function cvPick(list, i) {
  const src = list === 'hits' ? CV.hits : list === 'top' ? CV.top : CV.albums;
  const p = src[i]; if (!p) return;
  CV.pick = Object.assign({}, p);
  CV.dims = '';
  cvRender();
  if (!p.apple && p.album) {
    const token = ++CV.token;
    cvAppleFor(p.album, p.artist.split(',')[0]).then(u => {
      if (token !== CV.token || !CV.pick) return;
      if (u) { CV.pick.apple = u; cvRender(); }
    });
  }
  const st = document.getElementById('cv-stage');
  if (st) st.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ======================== SAVING ========================

function cvSrc() {
  const p = CV.pick; if (!p) return '';
  return p.apple ? cvAppleUrl(p.apple, CV.size) : p.spotify;
}

function cvLoadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('load'));
    im.src = url;
  });
}

async function cvPngBlob() {
  const url = cvSrc();
  if (CV.pick.apple) {
    const r = await fetch(url);
    const b = await r.blob();
    if (r.ok && b.type === 'image/png') return b;
  }
  // spotify (jpg) or apple said no: redraw it as a png
  const im = await cvLoadImg(url);
  let w = im.naturalWidth, h = im.naturalHeight;
  if (!CV.pick.apple && CV.size !== 'full') { const n = parseInt(CV.size, 10); if (n < w) { h = Math.round(h * n / w); w = n; } }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(im, 0, 0, w, h);
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'));
}

async function cvSave(btn) {
  if (!CV.pick) return;
  const was = btn.textContent;
  btn.textContent = 'saving...';
  try {
    const blob = await cvPngBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = cvFile(CV.pick) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    btn.textContent = 'saved 🩷';
  } catch {
    btn.textContent = 'couldn\'t save :(';
  }
  setTimeout(() => { btn.textContent = was; }, 2200);
}

function cvSize(k) { CV.size = k; CV.dims = ''; cvRender(); }

function cvDims(im) {
  CV.dims = im.naturalWidth + ' × ' + im.naturalHeight;
  const el = document.getElementById('cv-dims'); if (el) el.textContent = CV.dims;
}

// ======================== SCREEN ========================

function cvOpen() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  cvScreen();
}

function cvScreen() {
  Q.screen = 'covers';
  qStopAudio(); qClearTimers();
  const loggedIn = typeof _data !== 'undefined' && _data;
  if (loggedIn) cvLoadTop();
  if (!loggedIn && (CV.tab === 'top' || CV.tab === 'mine')) CV.tab = 'songs';
  const tabs = [['songs', 'songs'], ['albums', 'albums']].concat(loggedIn ? [['top', 'your top songs'], ['mine', 'your top albums']] : []);
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🖼️ cover saver', '') +
    '<div class="tabs">' + tabs.map(([k, l]) => '<button class="' + (CV.tab === k ? 'active' : '') + '" onclick="cvTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
    '<div id="cv-stage"></div>' +
    '<div id="cv-src"></div>'
  );
  cvRender();
  cvRenderSrc();
}

function cvTab(k) {
  if (k !== CV.tab && (k === 'songs' || k === 'albums')) CV.hits = [];
  CV.tab = k; cvScreen();
}

function cvRow(p, list, i) {
  return '<button class="e-row" onclick="cvPick(\'' + list + '\',' + i + ')">' +
    (p.thumb ? '<img src="' + esc(p.thumb) + '" alt="" loading="lazy">' : '<span class="ph">🎵</span>') +
    '<span class="tx"><span class="nm">' + esc(p.title) + '</span><span class="ar">' + esc(p.artist) + (p.sub ? ' &middot; ' + esc(p.sub) : '') + '</span></span></button>';
}

function cvRenderSrc() {
  const box = document.getElementById('cv-src'); if (!box) return;
  if (CV.tab === 'top' || CV.tab === 'mine') {
    const list = CV.tab === 'top' ? CV.top : CV.albums, key = CV.tab === 'top' ? 'top' : 'mine';
    box.innerHTML = '<div class="e-list">' + list.map((p, i) => cvRow(p, key, i)).join('') + '</div>';
    return;
  }
  box.innerHTML =
    '<div class="q-typerow" style="max-width:460px;margin:14px auto 0;">' +
      '<input id="cv-q" class="q-input" placeholder="' + (CV.tab === 'albums' ? 'any album...' : 'any song...') + '" autocomplete="off" spellcheck="false">' +
      '<button class="q-btn" onclick="cvSearch()">search</button>' +
    '</div>' +
    '<div id="cv-results"></div>';
  const inp = document.getElementById('cv-q');
  if (inp) { if (!CV.pick) inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') cvSearch(); }); }
  if (CV.hits.length) cvRenderList();
}

function cvRenderList() {
  const box = document.getElementById('cv-results'); if (!box) return;
  box.innerHTML = CV.hits.length
    ? '<div class="e-list">' + CV.hits.map((p, i) => cvRow(p, 'hits', i)).join('') + '</div>'
    : '<p class="q-note">nothing came up. try different words?</p>';
}

function cvRender() {
  const box = document.getElementById('cv-stage'); if (!box) return;
  const p = CV.pick;
  if (!p) { box.innerHTML = ''; return; }
  const chip = (k, l) => '<button class="' + (CV.size === k ? 'active' : '') + '" onclick="cvSize(\'' + k + '\')">' + l + '</button>';
  box.innerHTML =
    '<div class="e-card fade-up">' +
      '<img class="cv-big" src="' + esc(cvSrc()) + '" alt="" crossorigin="anonymous" onload="cvDims(this)">' +
      '<div class="e-title">' + esc(p.title) + '</div>' +
      (p.artist ? '<div class="e-artist">' + esc(p.artist) + '</div>' : '') +
      '<p class="q-note" id="cv-dims">' + esc(CV.dims) + '</p>' +
      '<div class="tabs e-tabs">' + CV_SIZES.map(([k, l]) => chip(k, l)).join('') + '</div>' +
      '<div class="q-actions"><button class="q-btn" onclick="cvSave(this)">download png</button></div>' +
    '</div>';
}

X_HUB.labs.push(() => xCard('🖼️', 'cover saver', 'any song or album cover as a png', 'cvOpen()'));

Object.assign(window, { cvOpen, cvScreen, cvTab, cvSearch, cvPick, cvSize, cvSave, cvDims });
