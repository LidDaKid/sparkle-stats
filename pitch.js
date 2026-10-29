// ============================================================
//  xXx SparkleStats xXx  -  pitch.js
//  match the note: a held note from the song loops, you slide a
//  tone until it matches, then lock it in. scored on how many cents
//  off you are - octave doesn't count, sing it high or low.
//  the held note is found from the center of the stereo mix
//  (where the singer sits) and the steadiest stretch wins. loads after eight.js.
// ============================================================

GAMES.pitch = { emoji: '🎚️', name: 'match the note', sub: 'a held note from the song loops. slide until your tone matches' };

const PT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PT_LO = 4500, PT_HI = 8100;       // slider range in midi cents: A2 .. A5
const PT_SR = 11025;                    // clips get analysed at this rate (plenty for voices)
const PT_TIME = 45;
const PT = { seg: null, segTimer: null, osc: null, oscGain: null, holding: false, guess: 6300 };
const ptCache = new Map();

// ======================== NOTE MATH ========================

function ptMidi(hz) { return 69 + 12 * Math.log2(hz / 440); }
function ptHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function ptName(midi) {
  const n = Math.round(midi);
  return PT_NOTES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}
// how far a guess is from the target, ignoring octaves. + = sharp, - = flat, range -600..600
function ptCentsOff(guessMidi, targetMidi) {
  const d = Math.round((guessMidi - targetMidi) * 100);
  const pc = ((d % 1200) + 1200) % 1200;
  return pc > 600 ? pc - 1200 : pc;
}
function ptVerdict(off) {
  const a = Math.abs(off);
  if (a <= 15) return 'perfect pitch. scary.';
  if (a <= 50) return a + ' cents ' + (off > 0 ? 'sharp' : 'flat') + ' - basically on it';
  if (a <= 150) return a + ' cents ' + (off > 0 ? 'sharp' : 'flat') + ' - close';
  return Math.round(a / 100) + ' half steps ' + (off > 0 ? 'too high' : 'too low');
}

// ======================== PITCH TRACKING ========================
// time-domain trackers get fooled by the band, so this works on the spectrum:
// 1. keep only what sits dead center in the stereo mix (that's where the singer lives)
// 2. for every possible note, add up the energy at its overtones - the voice's note wins
// 3. sharpen the winner using the peaks of its first few overtones

const PT_FFT = 2048, PT_HOP = 512;

function ptFFT(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// one frame -> { midi, sal (how much the winner stands out), e (center loudness) } or null
function ptFrame(L, R, s, win, bufs, sr, cands) {
  const N = PT_FFT, bins = N >> 1;
  const { lr, li, rr, ri, cm } = bufs;
  for (let i = 0; i < N; i++) { lr[i] = L[s + i] * win[i]; rr[i] = R[s + i] * win[i]; li[i] = 0; ri[i] = 0; }
  ptFFT(lr, li); ptFFT(rr, ri);
  let e = 0;
  const lo = Math.floor(120 * N / sr), hi = Math.ceil(1100 * N / sr);
  for (let k = 0; k < bins; k++) {
    const ml = Math.hypot(lr[k], li[k]), mr = Math.hypot(rr[k], ri[k]);
    const sum = ml + mr;
    if (!sum) { cm[k] = 0; continue; }
    const diff = Math.hypot(lr[k] - rr[k], li[k] - ri[k]);
    const w = Math.max(0, 1 - diff / sum);
    const c = w * w * sum / 2;              // center-panned part of this frequency
    cm[k] = c;
    if (k >= lo && k <= hi) e += c * c;
  }
  // harmonic sum for every candidate note
  let best = -1, bestV = 0, total = 0;
  for (let j = 0; j < cands.length; j++) {
    const f0 = cands[j];
    let v = 0, wgt = 1;
    for (let h = 1; h <= 8; h++) {
      const b = Math.round(h * f0 * N / sr);
      if (b >= bins - 1) break;
      v += wgt * Math.sqrt(Math.max(cm[b - 1], cm[b], cm[b + 1]));
      wgt *= 0.8;
    }
    total += v;
    if (v > bestV) { bestV = v; best = j; }
  }
  if (best < 0 || !total) return null;
  const f0 = cands[best];
  // refine from the overtone peaks (parabolic fit on log magnitude)
  let fs = 0, ws = 0;
  for (let h = 1; h <= 5; h++) {
    const c0 = Math.round(h * f0 * N / sr);
    if (c0 + 3 >= bins) break;
    let k = c0;
    for (let d = -2; d <= 2; d++) if (cm[c0 + d] > cm[k]) k = c0 + d;
    if (k <= 0 || !cm[k]) continue;
    const a = Math.log(cm[k - 1] + 1e-9), b = Math.log(cm[k] + 1e-9), g = Math.log(cm[k + 1] + 1e-9);
    const den = a - 2 * b + g;
    const off = den ? 0.5 * (a - g) / den : 0;
    const f = (k + Math.max(-0.5, Math.min(0.5, off))) * sr / N / h;
    if (Math.abs(ptMidi(f) - ptMidi(f0)) > 0.6) continue;
    fs += f * cm[k]; ws += cm[k];
  }
  const fin = ws ? fs / ws : f0;
  return { midi: ptMidi(fin), sal: bestV / (total / cands.length), e };
}

// finds the steadiest held sung note. L/R are the two channels (R optional). returns { start, end, midi } in seconds, or null
function ptAnalyze(L, R, sr) {
  R = R || L;
  const N = PT_FFT;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  const bufs = { lr: new Float32Array(N), li: new Float32Array(N), rr: new Float32Array(N), ri: new Float32Array(N), cm: new Float32Array(N >> 1) };
  const cands = [];
  for (let m = 52; m <= 86; m += 0.2) cands.push(ptHz(m));     // E3 .. D6 - lower than that is usually the bass
  const from = Math.round(sr * 2), to = Math.min(L.length, R.length) - N;
  if (to <= from) return null;
  const frames = [];
  let loud = 0;
  for (let s = from; s < to; s += PT_HOP) {
    const f = ptFrame(L, R, s, win, bufs, sr, cands);
    if (!f) continue;
    f.s = s;
    if (f.e > loud) loud = f.e;
    frames.push(f);
  }
  for (const f of frames) f.ok = f.e >= loud * 0.04 && f.sal >= 2.2;
  // runs that stay within ~45 cents (one dropout allowed), at least 0.35s long
  const minN = Math.round(0.35 * sr / PT_HOP);
  let best = null, cur = null, gap = 0;
  const close = () => {
    if (cur && cur.n >= minN) {
      const sorted = cur.m.slice().sort((p, q) => p - q);
      const score = cur.n * (cur.sal / cur.n);
      if (!best || score > best.score) best = { start: cur.a, end: cur.b, midi: sorted[sorted.length >> 1], score };
    }
    cur = null; gap = 0;
  };
  for (const f of frames) {
    if (!f.ok) { if (cur && ++gap > 1) close(); continue; }
    if (cur && Math.abs(f.midi - cur.sum / cur.n) <= 0.45) {
      cur.n++; cur.sum += f.midi; cur.sal += f.sal; cur.m.push(f.midi); cur.b = f.s + N; gap = 0;
    } else {
      close();
      cur = { a: f.s, b: f.s + N, n: 1, sum: f.midi, sal: f.sal, m: [f.midi] };
    }
  }
  close();
  if (!best) return null;
  const start = Math.max(0, best.start / sr - 0.2);
  const end = Math.min(L.length / sr, Math.min(best.end / sr + 0.1, start + 2.4));
  return { start, end, midi: best.midi };
}

// fetch + decode + analyse one clip; keeps just the looped bit
function ptPrep(url) {
  if (ptCache.has(url)) return ptCache.get(url);
  const p = (async () => {
    if (!X.fxCtx) X.fxCtx = new (window.AudioContext || window.webkitAudioContext)();
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await xDecode(X.fxCtx, await res.arrayBuffer());
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(2, Math.ceil(buf.duration * PT_SR), PT_SR);
    const src = off.createBufferSource();
    src.buffer = buf;
    const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
    src.connect(hp); hp.connect(lp); lp.connect(off.destination);
    src.start(0);
    const st = await off.startRendering();
    const seg = ptAnalyze(st.getChannelData(0), st.numberOfChannels > 1 ? st.getChannelData(1) : null, PT_SR);
    if (!seg) return null;
    const a = Math.floor(seg.start * buf.sampleRate), b = Math.floor(seg.end * buf.sampleRate);
    const piece = X.fxCtx.createBuffer(buf.numberOfChannels, b - a, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) piece.getChannelData(c).set(buf.getChannelData(c).subarray(a, b));
    return { piece, midi: seg.midi };
  })().catch(() => null);
  ptCache.set(url, p);
  return p;
}

async function ptBuild(pool, onProgress) {
  if (!xFxOk()) return [];
  ptCtx();   // still inside the start button's click, so the browser lets sound start later
  const ordered = xOrdered(pool).filter(t => !qIsAlt(t.name));
  const out = [], seen = new Set();
  let i = 0, looked = 0;
  while (out.length < Q.len && i < ordered.length && looked < 45) {
    const batch = [];
    while (batch.length < 3 && i < ordered.length) {
      const t = ordered[i++];
      const k = qNorm(qStrip(t.name));
      if (seen.has(k)) continue;
      seen.add(k); batch.push(t);
    }
    if (!batch.length) break;
    looked += batch.length;
    const got = await Promise.all(batch.map(async t => {
      const url = await qFindPreview(t);
      return { t, r: url ? await ptPrep(url) : null };
    }));
    for (const g of got) if (g.r && out.length < Q.len) out.push({ track: g.t, preview: null, choices: null, piece: g.r.piece, midi: g.r.midi });
    onProgress(out.length);
  }
  Q.skipped = 0;
  return out;
}

// ======================== SOUND ========================

function ptCtx() {
  if (!X.fxCtx) X.fxCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (X.fxCtx.state === 'suspended') X.fxCtx.resume();
  return X.fxCtx;
}
function ptStopSong() {
  if (PT.segTimer) { clearTimeout(PT.segTimer); PT.segTimer = null; }
  if (PT.seg) { try { PT.seg.stop(); } catch {} PT.seg = null; }
  const b = document.getElementById('pt-song'); if (b) b.textContent = '▶ the song';
}
function ptToneOff(fast) {
  if (!PT.osc) return;
  const ctx = ptCtx(), now = ctx.currentTime, o = PT.osc, g = PT.oscGain;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(0, now + (fast ? 0.02 : 0.15));
  try { o.stop(now + 0.2); } catch {}
  PT.osc = null; PT.oscGain = null;
}
function ptToneOn(midi) {
  const ctx = ptCtx(), now = ctx.currentTime;
  if (PT.osc) { PT.osc.frequency.setTargetAtTime(ptHz(midi), now, 0.015); return; }
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(ptHz(midi), now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.03);
  o.connect(g); g.connect(ctx.destination);
  o.start(now);
  PT.osc = o; PT.oscGain = g;
}
function ptStopAll() { ptStopSong(); ptToneOff(true); PT.holding = false; }

// the looped bit, three times through (or until you stop it)
function ptPlaySong(withTone) {
  const q = Q.questions[Q.index]; if (!q) return;
  if (PT.seg && !withTone) { ptStopSong(); return; }
  ptStopSong();
  const ctx = ptCtx();
  const s = ctx.createBufferSource();
  s.buffer = q.piece; s.loop = true;
  const g = ctx.createGain(); g.gain.value = 0.9;
  s.connect(g); g.connect(ctx.destination);
  s.start();
  PT.seg = s;
  const b = document.getElementById('pt-song'); if (b) b.textContent = '■ stop';
  const ms = q.piece.duration * 3 * 1000;
  PT.segTimer = setTimeout(() => { ptStopSong(); if (withTone) ptToneOff(); }, ms);
  if (withTone) ptToneOn(withTone === true ? PT.guess / 100 : withTone);
}
function ptPlayTone() {
  ptToneOff(true);
  ptToneOn(PT.guess / 100);
  setTimeout(() => { if (!PT.holding) ptToneOff(); }, 1200);
}
function ptPlayBoth() { ptPlaySong(true); }

// ======================== QUESTION SCREEN ========================

function ptLabel() {
  const el = document.getElementById('pt-note');
  if (el) el.textContent = ptName(PT.guess / 100);
}

function ptRender() {
  Q.screen = 'play'; Q.locked = false; Q.hintShown = false;
  qClearTimers(); qStopAudio(); ptStopAll();
  const q = Q.questions[Q.index];
  Q.duration = PT_TIME; Q.deadline = Date.now() + PT_TIME * 1000;
  // start the slider somewhere random so nobody gets a head start
  PT.guess = Math.round(PT_LO + 600 + Math.random() * (PT_HI - PT_LO - 1200));
  const ticks = [];
  for (let m = 48; m <= 81; m += 12) ticks.push('<span style="left:' + ((m * 100 - PT_LO) / (PT_HI - PT_LO) * 100) + '%">C' + (m / 12 - 1) + '</span>');
  qSet(
    mHud('note ' + (Q.index + 1) + ' of ' + Q.questions.length) +
    '<div class="pt-wrap">' +
      '<div class="pt-song">' + (qArt(q.track) ? '<img src="' + qArt(q.track) + '" alt="">' : '') +
        '<div><div class="nm">' + esc(qStrip(q.track.name)) + '</div><div class="ar">' + esc(qArtistNames(q.track)) + '</div></div></div>' +
      '<div class="q-actions pt-btns">' +
        '<button class="q-btn" id="pt-song" onclick="ptPlaySong()">▶ the song</button>' +
        '<button class="q-btn ghost" onclick="ptPlayTone()">▶ my note</button>' +
        '<button class="q-btn ghost" onclick="ptPlayBoth()">▶ both</button>' +
      '</div>' +
      '<div class="pt-note" id="pt-note"></div>' +
      '<div class="pt-track"><input type="range" id="pt-slider" class="pt-slider" min="' + PT_LO + '" max="' + PT_HI + '" step="5" value="' + PT.guess + '">' +
        '<div class="pt-ticks" id="pt-ticks">' + ticks.join('') + '</div></div>' +
      '<div class="q-actions">' +
        '<button class="q-btn" onclick="ptLock()">that\'s the note</button>' +
        '<button class="q-btn ghost" id="q-giveup" onclick="ptGiveUp()">i give up</button>' +
      '</div>' +
    '</div>' +
    '<div id="q-reveal"></div>'
  );
  ptLabel();
  const sl = document.getElementById('pt-slider');
  if (sl) {
    sl.addEventListener('input', () => {
      PT.guess = parseInt(sl.value, 10);
      ptLabel();
      if (PT.osc) ptToneOn(PT.guess / 100);
    });
    // hold the slider = hear your tone while you drag
    const down = () => { PT.holding = true; ptToneOn(PT.guess / 100); };
    const up = () => { if (PT.holding) { PT.holding = false; ptToneOff(); } };
    sl.addEventListener('pointerdown', down);
    sl.addEventListener('pointerup', up);
    sl.addEventListener('pointercancel', up);
    sl.addEventListener('touchend', up);
  }
  ptPlaySong();
  Q.tick = setInterval(() => mTick(() => ptLock(true)), 100);
}

function ptLock(timedOut) {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const guess = PT.guess / 100;
  const off = ptCentsOff(guess, q.midi);
  const a = Math.abs(off);
  // the real note, in whichever octave you were singing
  const shown = q.midi + 12 * Math.round((guess - q.midi) / 12);
  q.detail = 'the note: ' + ptName(shown) + ' · you: ' + ptName(guess) + ' · ' + ptVerdict(off);
  const sl = document.getElementById('pt-slider'); if (sl) sl.disabled = true;
  const ticks = document.getElementById('pt-ticks');
  if (ticks) ticks.insertAdjacentHTML('beforeend', '<i class="pt-target" style="left:' + Math.max(0, Math.min(100, (shown * 100 - PT_LO) / (PT_HI - PT_LO) * 100)) + '%"></i>');
  const pts = Q.perQ * Math.max(0, 1 - a / 300);
  ptStopAll();
  mLockChoices(-1, () => false);
  qFinishQuestion(a <= 150, ptName(guess), timedOut === true ? 'timeout' : null, pts);
  // let them hear what it should have been
  ptPlaySong(shown);
}
function ptGiveUp() {
  if (Q.locked) return;
  const q = Q.questions[Q.index];
  const shown = q.midi + 12 * Math.round((PT.guess / 100 - q.midi) / 12);
  q.detail = 'the note was ' + ptName(shown);
  ptStopAll();
  mLockChoices(-1, () => false);
  qFinishQuestion(false, null, 'gaveup');
  ptPlaySong(shown);
}

// ======================== HOOKS ========================

(function ptInstallHooks() {
  const prev = { mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, qStopAudio };
  mSingleStart = () => Q.game === 'pitch' || prev.mSingleStart();
  mModeNote = () => Q.game === 'pitch'
    ? '<p class="q-note" style="margin-top:20px;">' + Q.len + ' songs &middot; drag the slider to hear your tone &middot; any octave counts &middot; ' + PT_TIME + ' seconds each</p>'
    : prev.mModeNote();
  mWhyTooFew = () => Q.game === 'pitch'
    ? (xFxOk() ? 'couldn\'t find enough clear held notes in these clips. songs with big sung notes work best - try another artist or playlist?' : 'this browser can\'t analyse audio. try chrome or brave?')
    : prev.mWhyTooFew();
  mBuildsGame = g => g === 'pitch' || prev.mBuildsGame(g);
  mBuildQuestions = (pool, onProgress) => Q.game === 'pitch' ? ptBuild(pool, onProgress) : prev.mBuildQuestions(pool, onProgress);
  mRenderQuestion = () => { if (Q.game === 'pitch') { ptRender(); return true; } return prev.mRenderQuestion(); };
  // anything that silences the quiz silences the loop + tone too (leaving, results, next song)
  qStopAudio = function () { ptStopAll(); return prev.qStopAudio(); };
})();

X_HUB.games.push(() => xCard('🎚️', 'match the note', GAMES.pitch.sub, 'gPick(\'pitch\')'));

Object.assign(window, {
  mSingleStart, mModeNote, mWhyTooFew, mBuildsGame, mBuildQuestions, mRenderQuestion, qStopAudio,
  ptPlaySong, ptPlayTone, ptPlayBoth, ptLock, ptGiveUp,
});
