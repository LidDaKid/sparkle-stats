// ============================================================
//  xXx SparkleStats xXx  -  eight.js
//  the 8D room: any song (search, your top songs, or your own
//  file) spun around your head, plus reverb and rooms (bathroom
//  at a party, huge room, empty mall). everything is mixed in the
//  browser with an OfflineAudioContext and can be downloaded.
//  loads after wave3.js (borrows xDecode / xImpulse / xWav / xCard).
// ============================================================

const E = {
  tab: 'search', hits: [], top: [],
  orig: null, title: '', artist: '', art: '', full: false,
  url: null, token: 0, timer: null, raf: null, busy: false,
  set: { eight: true, spin: 'med', room: 'none', reverb: 40 },
};

const E_SPIN = { slow: 0.06, med: 0.12, fast: 0.22 };   // trips around your head per second
const E_ROOMS = {
  none:     { label: 'no room' },
  bathroom: { label: 'bathroom at a party', lp: 520, hp: 60, imp: [0.7, 3.2], wet: 0.5, dry: 0.75 },
  huge:     { label: 'huge room', lp: 9000, imp: [4.6, 2.1], pre: 0.06, wet: 0.85, dry: 0.55 },
  mall:     { label: 'empty mall', rate: 0.9, lp: 3600, hp: 140, imp: [6, 1.5], pre: 0.09, wet: 0.8, dry: 0.35 },
};
const E_LAME = 'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';

function eOk() { return typeof xFxOk === 'function' && xFxOk(); }

// ======================== MIXING ========================

// pure: where the sound sits at time t (top-down view, -z is in front of you)
function eOrbit(t, hz, r) {
  const a = 2 * Math.PI * hz * t;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
}

function eTag(s) {
  const bits = [];
  if (s.eight) bits.push('8D');
  if (s.room !== 'none') bits.push(E_ROOMS[s.room].label);
  else if (s.reverb > 0) bits.push('reverb');
  return bits.join(' + ') || 'normal';
}

async function eMix(src, s) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const room = E_ROOMS[s.room] || E_ROOMS.none;
  const sr = src.sampleRate;
  const rate = room.rate || 1;
  const verb = s.reverb / 100;
  const imp = room.imp || (verb > 0 ? [2.6, 2.4] : null);
  const tail = imp ? imp[0] : 0;
  const len = Math.ceil(src.length / rate + tail * sr);
  const off = new OAC(2, len, sr);

  const node = off.createBufferSource();
  node.buffer = src;
  node.playbackRate.value = rate;

  // room tone first (the muffled-through-the-door part), then the spin
  let head = node;
  const filt = (type, f) => { const b = off.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = 0.7; head.connect(b); head = b; };
  if (room.hp) filt('highpass', room.hp);
  if (room.lp) filt('lowpass', room.lp);

  if (s.eight) {
    const mono = off.createGain();
    mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    head.connect(mono);
    const p = off.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 0.2;
    const hz = E_SPIN[s.spin] || E_SPIN.med, dur = len / sr;
    if (p.positionX) {
      for (let t = 0; t <= dur; t += 0.05) {
        const o = eOrbit(t, hz, 1.6);
        p.positionX.linearRampToValueAtTime(o.x, t);
        p.positionZ.linearRampToValueAtTime(o.z, t);
        p.positionY.setValueAtTime(0, t);
      }
    } else if (p.setPosition) {
      p.setPosition(0, 0, -1.6);          // very old browser: no moving, still sounds "around"
    }
    mono.connect(p);
    const lift = off.createGain(); lift.gain.value = 1.5;   // hrtf comes out quiet
    p.connect(lift);
    head = lift;
    // hrtf alone only leans ~30% to each side; push it most of the way into each ear
    if (off.createStereoPanner) {
      const sp = off.createStereoPanner();
      for (let t = 0; t <= dur; t += 0.05) sp.pan.linearRampToValueAtTime(eOrbit(t, hz, 0.6).x, t);
      head.connect(sp);
      head = sp;
    }
  }

  const out = off.createGain();
  out.connect(off.destination);
  if (imp) {
    const wetAmt = (room.wet != null ? room.wet : 0.9) * (room.imp ? verb * 2 : verb);
    const dry = off.createGain(); dry.gain.value = room.dry != null ? room.dry : 1 - verb * 0.35;
    const wet = off.createGain(); wet.gain.value = wetAmt;
    const conv = off.createConvolver(); conv.buffer = xImpulse(off, imp[0], imp[1]);
    head.connect(dry); dry.connect(out);
    let w = head;
    if (room.pre) { const d = off.createDelay(1); d.delayTime.value = room.pre; w.connect(d); w = d; }
    w.connect(conv); conv.connect(wet); wet.connect(out);
  } else {
    head.connect(out);
  }
  node.start(0);
  const res = await off.startRendering();
  eNormalize(res);
  return res;
}

// loudest point to 0.95 so rooms that soak up volume (bathroom) still come out loud enough
function eNormalize(buf) {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  }
  if (!peak) return buf;
  const k = 0.95 / peak;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

// ======================== LOADING A SONG ========================

async function eLoadUrl(url, title, artist, art) {
  E.full = false;
  return eLoadBytes(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('couldn\'t get the clip');
    return res.arrayBuffer();
  }, title, artist, art);
}

async function eLoadBytes(getBytes, title, artist, art) {
  const token = ++E.token;
  E.title = title; E.artist = artist; E.art = art || '';
  E.orig = null; eDropUrl();
  eRender();
  eStatus('loading...');
  try {
    if (!X.fxCtx) X.fxCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await xDecode(X.fxCtx, await getBytes());
    if (token !== E.token) return;
    E.orig = buf;
    eRemix(true);
  } catch (e) {
    if (token === E.token) eStatus('couldn\'t load that one :( ' + esc(e.message || ''));
  }
}

function eFile(input) {
  const f = input && input.files && input.files[0];
  if (f) eUseFile(f);
}
function eUseFile(f) {
  E.full = true;
  const title = String(f.name || 'my song').replace(/\.[a-z0-9]+$/i, '');
  eLoadBytes(() => f.arrayBuffer(), title, '', '');
}
function eDrop(ev) {
  ev.preventDefault();
  const z = document.getElementById('e-drop'); if (z) z.classList.remove('over');
  const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (f) eUseFile(f);
}
function eDragOver(ev) { ev.preventDefault(); const z = document.getElementById('e-drop'); if (z) z.classList.add('over'); }
function eDragLeave() { const z = document.getElementById('e-drop'); if (z) z.classList.remove('over'); }

async function eSearch() {
  const inp = document.getElementById('e-q');
  const q = inp ? inp.value.trim() : '';
  if (!q) return;
  const box = document.getElementById('e-results');
  if (box) box.innerHTML = '<p class="q-note">looking...</p>';
  try {
    const res = await fetch(ITUNES + '?term=' + encodeURIComponent(q) + '&entity=song&limit=12');
    const data = await res.json();
    E.hits = (data.results || []).filter(r => r.previewUrl);
  } catch { E.hits = []; }
  eRenderList();
}
function ePickHit(i) {
  const r = E.hits[i]; if (!r) return;
  eLoadUrl(r.previewUrl, r.trackName, r.artistName, (r.artworkUrl100 || '').replace('100x100', '300x300'));
}
async function ePickTop(i) {
  const t = E.top[i]; if (!t) return;
  E.title = qStrip(t.name); E.artist = qArtistNames(t); E.art = qArt(t);
  eRender(); eStatus('finding the clip...');
  const url = await qFindPreview(t);
  if (!url) { eStatus('no clip for that one, try another'); return; }
  eLoadUrl(url, E.title, E.artist, E.art);
}

// ======================== REMIX + PLAYBACK ========================

function eDropUrl() {
  if (E.url) { try { URL.revokeObjectURL(E.url); } catch {} E.url = null; }
}

function eRemix(now) {
  if (E.timer) clearTimeout(E.timer);
  E.timer = setTimeout(eRemixNow, now ? 0 : 250);
}
async function eRemixNow() {
  if (!E.orig) return;
  const token = ++E.token;
  const a = document.getElementById('e-audio');
  const wasAt = a ? a.currentTime : 0;
  E.busy = true;
  eStatus(E.full ? 'mixing the whole song...' : 'mixing...');
  try {
    const buf = await eMix(E.orig, E.set);
    if (token !== E.token) return;
    eDropUrl();
    E.url = URL.createObjectURL(new Blob([xWav(buf)], { type: 'audio/wav' }));
    E.busy = false;
    const el = document.getElementById('e-audio');
    if (el) {
      el.src = E.url;
      // pick up where you were, so changing a setting doesn't restart the song
      el.currentTime = Math.min(wasAt, buf.duration - 0.1) || 0;
      el.play().catch(() => {});
    }
    eStatus('');
  } catch (e) {
    if (token === E.token) { E.busy = false; eStatus('mixing broke :( ' + esc(e.message || '')); }
  }
}

function eSet(k, v) {
  if (k === 'eight') v = !E.set.eight;
  if (k === 'reverb') v = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
  E.set[k] = v;
  if (k !== 'reverb') eRenderControls();
  else { const n = document.getElementById('e-rv-n'); if (n) n.textContent = v; }
  eRemix();
}

// the little album art disc circles your head in time with the audio
function eAnimate() {
  if (E.raf) cancelAnimationFrame(E.raf);
  const step = () => {
    const a = document.getElementById('e-audio'), dot = document.getElementById('e-orbit');
    if (!a || !dot) { E.raf = null; return; }
    if (E.set.eight) {
      const o = eOrbit(a.currentTime || 0, E_SPIN[E.set.spin] || E_SPIN.med, 1);
      dot.style.transform = 'translate(' + (o.x * 78) + 'px,' + (o.z * 78) + 'px)';
    } else {
      dot.style.transform = 'translate(0px,-78px)';
    }
    E.raf = requestAnimationFrame(step);
  };
  E.raf = requestAnimationFrame(step);
}

// ======================== DOWNLOAD ========================

function eLoadLame() {
  if (window.lamejs) return Promise.resolve(true);
  return new Promise(res => {
    const s = document.createElement('script');
    s.src = E_LAME;
    s.onload = () => res(!!window.lamejs);
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}

function eMp3(buf) {
  const ch = Math.min(2, buf.numberOfChannels);
  const enc = new lamejs.Mp3Encoder(ch, buf.sampleRate, 192);
  const toInt = d => { const o = new Int16Array(d.length); for (let i = 0; i < d.length; i++) { const v = Math.max(-1, Math.min(1, d[i])); o[i] = v < 0 ? v * 32768 : v * 32767; } return o; };
  const L = toInt(buf.getChannelData(0)), R = ch > 1 ? toInt(buf.getChannelData(1)) : null;
  const parts = [];
  for (let i = 0; i < L.length; i += 1152) {
    const m = R ? enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152)) : enc.encodeBuffer(L.subarray(i, i + 1152));
    if (m.length) parts.push(new Uint8Array(m));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

async function eSave(btn) {
  if (!E.orig || E.busy) return;
  const was = btn.textContent;
  btn.textContent = 'saving...';
  try {
    const buf = await eMix(E.orig, E.set);
    const name = (E.artist ? E.artist + ' - ' : '') + E.title + ' (' + eTag(E.set) + ')';
    let blob, ext;
    if (await eLoadLame()) { blob = eMp3(buf); ext = '.mp3'; }
    else { blob = new Blob([xWav(buf)], { type: 'audio/wav' }); ext = '.wav'; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[\\/:*?"<>|]/g, '') + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    btn.textContent = 'saved 🩷';
  } catch (e) {
    btn.textContent = 'couldn\'t save :(';
  }
  setTimeout(() => { btn.textContent = was; }, 2200);
}

// ======================== SCREEN ========================

function eOpen() {
  const app = document.getElementById('app'), game = document.getElementById('game');
  if (app) app.style.display = 'none';
  if (game) game.style.display = 'block';
  window.scrollTo(0, 0);
  eScreen();
}

function eScreen() {
  Q.screen = 'eight';
  qStopAudio(); qClearTimers();
  if (!eOk()) {
    qSet(qTopBar('&larr; back', xBack()) + qHeader('🌀 8D room', '') + qErrorBox('this browser can\'t mix audio. try chrome or brave?'));
    return;
  }
  const loggedIn = typeof _data !== 'undefined' && _data;
  if (loggedIn && !E.top.length) E.top = qDedupe([...(_data.tracks.short_term || []), ...(_data.tracks.medium_term || [])]).filter(t => !qIsAlt(t.name)).slice(0, 30);
  if (!loggedIn && E.tab === 'top') E.tab = 'search';
  const tabs = [['search', 'search a song']].concat(loggedIn ? [['top', 'your top songs']] : []).concat([['file', 'your own file']]);
  qSet(
    qTopBar('&larr; back', xBack()) +
    qHeader('🌀 8D room', 'headphones on') +
    '<div class="tabs">' + tabs.map(([k, l]) => '<button class="' + (E.tab === k ? 'active' : '') + '" onclick="eTab(\'' + k + '\')">' + l + '</button>').join('') + '</div>' +
    '<div id="e-src"></div>' +
    '<div id="e-stage"></div>'
  );
  eRenderSrc();
  eRender();
}

function eTab(k) { E.tab = k; eScreen(); }

function eRenderSrc() {
  const box = document.getElementById('e-src'); if (!box) return;
  if (E.tab === 'file') {
    box.innerHTML =
      '<label class="e-drop" id="e-drop" ondrop="eDrop(event)" ondragover="eDragOver(event)" ondragleave="eDragLeave()">' +
        '<input type="file" accept="audio/*,video/*" onchange="eFile(this)" hidden>' +
        '<span class="big">drop a song</span><span class="q-note">or tap to pick one &middot; mp3, wav, m4a</span>' +
      '</label>';
    return;
  }
  if (E.tab === 'top') {
    box.innerHTML = '<div class="e-list">' + E.top.map((t, i) =>
      '<button class="e-row" onclick="ePickTop(' + i + ')">' + (qArt(t) ? '<img src="' + qArt(t) + '" alt="">' : '<span class="ph">🎵</span>') +
      '<span class="tx"><span class="nm">' + esc(qStrip(t.name)) + '</span><span class="ar">' + esc(qArtistNames(t)) + '</span></span></button>'
    ).join('') + '</div>';
    return;
  }
  box.innerHTML =
    '<div class="q-typerow" style="max-width:460px;margin:0 auto;">' +
      '<input id="e-q" class="q-input" placeholder="any song..." autocomplete="off" spellcheck="false">' +
      '<button class="q-btn" onclick="eSearch()">search</button>' +
    '</div>' +
    '<div id="e-results"></div>';
  const inp = document.getElementById('e-q');
  if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') eSearch(); }); }
  if (E.hits.length) eRenderList();
}

function eRenderList() {
  const box = document.getElementById('e-results'); if (!box) return;
  box.innerHTML = E.hits.length
    ? '<div class="e-list">' + E.hits.map((r, i) =>
        '<button class="e-row" onclick="ePickHit(' + i + ')"><img src="' + esc(r.artworkUrl100 || '') + '" alt="">' +
        '<span class="tx"><span class="nm">' + esc(r.trackName) + '</span><span class="ar">' + esc(r.artistName) + '</span></span></button>'
      ).join('') + '</div>'
    : '<p class="q-note">nothing came up. try different words?</p>';
}

function eStatus(t) { const el = document.getElementById('e-status'); if (el) el.innerHTML = t; }

function eRender() {
  const box = document.getElementById('e-stage'); if (!box) return;
  if (!E.title) { box.innerHTML = ''; return; }
  box.innerHTML =
    '<div class="e-card fade-up">' +
      '<div class="e-head">' +
        '<div class="e-ring"></div>' +
        '<div class="e-you">🎧</div>' +
        '<div class="e-orbit" id="e-orbit">' + (E.art ? '<img src="' + esc(E.art) + '" alt="">' : '<span>♪</span>') + '</div>' +
      '</div>' +
      '<div class="e-title">' + esc(E.title) + '</div>' +
      (E.artist ? '<div class="e-artist">' + esc(E.artist) + '</div>' : '') +
      (!E.full ? '<div class="q-note">30-second clip &middot; use "your own file" for whole songs</div>' : '') +
      '<audio id="e-audio" controls loop></audio>' +
      '<p class="q-note" id="e-status"></p>' +
      '<div id="e-ctrls"></div>' +
      '<div class="q-actions"><button class="q-btn" id="e-save" onclick="eSave(this)">download it</button></div>' +
    '</div>';
  eRenderControls();
  if (E.url) { const a = document.getElementById('e-audio'); if (a) a.src = E.url; }
  eAnimate();
}

function eRenderControls() {
  const box = document.getElementById('e-ctrls'); if (!box) return;
  const s = E.set;
  const chip = (on, label, fn) => '<button class="' + (on ? 'active' : '') + '" onclick="' + fn + '">' + label + '</button>';
  box.innerHTML =
    '<div class="tabs e-tabs">' + chip(s.eight, '🌀 8D ' + (s.eight ? 'on' : 'off'), 'eSet(\'eight\')') + '</div>' +
    (s.eight ? '<p class="q-note e-lbl">spin</p><div class="tabs e-tabs">' +
      [['slow', 'slow'], ['med', 'medium'], ['fast', 'fast']].map(([k, l]) => chip(s.spin === k, l, 'eSet(\'spin\',\'' + k + '\')')).join('') + '</div>' : '') +
    '<p class="q-note e-lbl">room</p><div class="tabs e-tabs">' +
      Object.keys(E_ROOMS).map(k => chip(s.room === k, E_ROOMS[k].label, 'eSet(\'room\',\'' + k + '\')')).join('') + '</div>' +
    '<p class="q-note e-lbl">reverb <span id="e-rv-n">' + s.reverb + '</span></p>' +
    '<input type="range" class="e-slider" min="0" max="100" value="' + s.reverb + '" oninput="eSet(\'reverb\', this.value)">';
}

X_HUB.labs.push(() => xCard('🌀', '8D room', 'any song spinning around your head. reverb, rooms, download it', 'eOpen()'));

Object.assign(window, { eOpen, eScreen, eTab, eSearch, ePickHit, ePickTop, eFile, eDrop, eDragOver, eDragLeave, eSet, eSave });
