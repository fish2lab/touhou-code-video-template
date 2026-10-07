'use strict';
// 帕秋莉讲座 · 逐帧引擎
// 所有脚本是经典 <script>，共享一个全局作用域。逻辑画面固定 1920×1080；每一帧只由「全片时间 t」决定（纯函数），
// 这样浏览器播放、抽帧、出片看到的是同一张画。场景文件用 scene({...}) 登记，film.js 排成时间线。

const W = 1920, H = 1080, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const FPS = 30;                       // 出片帧率
const ZH = 'WenKai';                  // 霞鹜文楷（OFL）；没装时退回系统楷体
const ZH_STACK = `${ZH}, "LXGW WenKai", KaiTi, STKaiti, "Kaiti SC", serif`;

// ===================== 数学、缓动、随机 =====================
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic = t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1;
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
// sm：时间 t 在 [a, b] 之间走 0→1（带缓动），之前是 0，之后是 1
const sm = (a, b, t, e = easeIO) => e(clamp((t - a) / (b - a), 0, 1));
// win：在 [a, b] 里淡入淡出的可见度（前后各 f 秒），用于元素出现再消失
const win = (a, b, t, f = .3) => Math.min(sm(a, a + f, t), 1 - sm(b - f, b, t));
// key：关键帧插值。K = [[t0, v0], [t1, v1], ...]，v 可以是数或数组
function key(t, K, e = easeIO) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b] = K[i], u = e((t - t0) / (t1 - t0));
    return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], u)) : lerp(a, b, u); }
  return K[K.length - 1][1];
}
function hash(k, seed = 0) { let a = (Math.imul(k | 0, 0x9E3779B1) + Math.imul((seed * 4096) | 0, 0x85EBCA77)) | 0; a ^= a >>> 15; a = Math.imul(a, 0x2C1B3C6D); a ^= a >>> 12; a = Math.imul(a, 0x297A2D39); a ^= a >>> 15; return (a >>> 0) / 4294967296; }
function rng(seed) { let a = (seed * 1000003) >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function noise1(x, seed = 1) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u); }
// tick：手绘「抖」的种子，每秒换 fps 次。线条 seed 加上它，线就会轻轻地呼吸。
const tick = (t, fps = 8) => Math.floor(t * fps + 1e-6) * 17;
// twos：把时间吸附到 12fps 网格（手绘动作一拍两帧的感觉）
const twos = t => Math.floor(t * 12 + 1e-6) / 12;

// ===================== 颜色 =====================
function parseColor(c) {
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2]];
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function mix(a, b, t) { const A = parseColor(a), B = parseColor(b); return toHex(A.map((v, i) => lerp(v, B[i], t))); }
function alpha(c, a) { const [r, g, b] = parseColor(c); return `rgba(${r},${g},${b},${a})`; }

// ===================== 场景登记 =====================
// scene({ order, key, title, chapter, dur, lines, fn })
//   order    排序号；key 英文短名（?scene=key 只放这一段）；title 章节名（播放器章节按钮）；chapter 画面左上角章节标签（可空）
//   dur      秒
//   lines    台词/字幕：[[开始秒, 结束秒, '文字', { mood, who }], ...]（本段内时间）。film 统一画字幕；kit 的 talk() 用它让角色张嘴
//   fn(c, tau, L)  画本段第 tau 秒（本段内时间，纯函数，不许存状态）。L = { line, lineT, lineP, mood, who, talking, mouth } 当前台词信息
const SCENES = [];
function scene(o) { SCENES.push(o); }

// 当前台词：返回 tau 时刻正在说的那句
function lineAt(lines, tau) {
  if (!lines) return null;
  for (const l of lines) if (tau >= l[0] && tau < l[1]) return { text: l[2], t0: l[0], t1: l[1], o: l[3] || {} };
  return null;
}

// ===================== 时间线 =====================
let FILM = null;
function defineFilm(timeline) {
  let acc = 0;
  const T = timeline.map(s => { const r = { ...s, start: acc }; acc += s.dur; return r; });
  FILM = { T, DUR: acc };
  return FILM;
}
function locate(t) {
  const { T, DUR } = FILM; t = clamp(t, 0, DUR - 1e-6);
  for (let k = 0; k < T.length; k++) if (t < T[k].start + T[k].dur || k === T.length - 1) return { s: T[k], k, tau: t - T[k].start };
}

// 画全片第 t 秒。每帧都从干净状态开始。
let OVERLAY = null;
// CLOCK0：当前段在全片里的起点。角色的待机晃动和眨眼按「段内时间 + CLOCK0」走，段与段交接时人偶不会突然换个姿态。
let CLOCK0 = 0;   // film.js 设置：每帧最后画字幕等全局层 OVERLAY(c, s, tau)
function renderAt(c, t, scale = 1) {
  const { s, tau } = locate(t); CLOCK0 = s.start;
  c.save();
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.setLineDash([]); c.filter = 'none'; c.shadowBlur = 0;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const cur = lineAt(s.lines, tau);
  const L = cur ? { line: cur.text, lineT: tau - cur.t0, lineP: (tau - cur.t0) / (cur.t1 - cur.t0), mood: cur.o.mood, who: cur.o.who || 'patchouli', talking: true } : { line: null, who: null, talking: false };
  L.mouth = L.talking ? mouthAt(tau, cur) : 0;
  try { c.save(); s.fn(c, tau, L); c.restore(); }
  catch (e) { c.restore(); c.fillStyle = '#400'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '32px monospace'; c.fillText(`${s.key}: ${e.message}`, 40, 80); console.error(e); }
  if (OVERLAY) { c.save(); OVERLAY(c, s, tau, cur); c.restore(); }
  c.restore();
  return s;
}
// L.mouth 是当前说话人（L.who，默认 patchouli）的嘴型。场景里每个角色用 mouthOf(L, 'cirno') 取自己的嘴型，不说话时是 0；
// moodOf(L, who, d)：这句是 who 说的就用这句的 mood，否则用 d。
const mouthOf = (L, who) => L.who === who ? L.mouth : 0;
const moodOf = (L, who, d = 'normal') => L.who === who && L.mood ? L.mood : d;
// mouthAt：说话时嘴的开合 0..1。按字的节奏开合，句尾 0.25 秒闭嘴
function mouthAt(tau, cur) {
  if (!cur) return 0;
  const v = voiceOf(cur.text);
  if (v) { const u = tau - cur.t0, i = Math.floor(u * 30); if (u < 0 || i >= v.env.length) return 0;
    const e = (+v.env[i] + (+v.env[i + 1] || 0) * .5) / 1.5; return clamp((e - 1) / 5, 0, 1); }
  const u = tau - cur.t0, speakDur = Math.min(cur.t1 - cur.t0 - .25, cur.text.length * .16 + .2);
  if (u > speakDur) return 0;
  const ph = twos(u) * 9.5;   // 每秒约 4.7 次开合
  return clamp(.55 + .45 * Math.sin(ph * Math.PI) * (.7 + .3 * noise1(ph * .7, 5)), 0, 1) * sm(0, .08, u, easeOut);
}

// ===================== 播放器 =====================
// URL 参数：?t=秒 起始时间，?scene=key[,key] 只放这几段，?bare 只要画布（出片用），?autoplay
const Q = new URLSearchParams(location.search);
function mountPlayer() {
  const cv = document.getElementById('c'), c = cv.getContext('2d');
  const dpr = Q.has('bare') ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  let t = +Q.get('t') || 0, playing = false, last = 0;
  const bar = document.getElementById('bar');
  const draw = () => { renderAt(c, t, dpr); if (ui) ui.sync(); };
  let ui = null;
  if (bar && !Q.has('bare')) ui = buildBar(bar, {
    get t() { return t; }, set t(v) { t = clamp(v, 0, FILM.DUR - 1e-3); draw(); },
    get playing() { return playing; }, toggle() { playing = !playing; if (playing) { if (t >= FILM.DUR - .05) t = 0; last = performance.now(); requestAnimationFrame(loop); AUDIO.play(t); } else AUDIO.stop(); ui.sync(); },
  });
  function loop(now) { if (!playing) return; const at = AUDIO.now(); t = at !== null ? at : t + (now - last) / 1000; last = now; if (t >= FILM.DUR) { t = FILM.DUR - 1e-3; playing = false; AUDIO.stop(); } draw(); if (playing) requestAnimationFrame(loop); }
  // 出片、抽帧的钩子（tools/*.mjs 用）
  window.__film = { W, H, FPS, get DUR() { return FILM.DUR; }, scenes: FILM.T.map(s => ({ key: s.key, title: s.title, start: s.start, dur: s.dur })),
    frame(tt, scale = 1) { if (cv.width !== W * scale) { cv.width = W * scale; cv.height = H * scale; } renderAt(c, tt, scale); return cv.toDataURL('image/png'); },
    draw(tt) { t = tt; draw(); } };
  const ready = () => { draw(); window.__ready = true; if (Q.has('autoplay') && ui) ui.toggle(); };
  document.fonts.load(`40px ${ZH}`, '帕秋莉讲座').then(() => document.fonts.ready).then(ready, ready);
}
function buildBar(bar, P) {
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  bar.innerHTML = `<button id="pp" title="空格">▶</button><span id="tm">0:00</span>
    <div id="track"><div id="fill"></div>${FILM.T.map(s => `<i style="left:${s.start / FILM.DUR * 100}%"></i>`).join('')}</div>
    <span id="du">${fmt(FILM.DUR)}</span><button id="vo" class="on" title="油库里语音">🗣 语音</button><button id="snd" class="on" title="背景音乐">♪ 音乐</button><button id="fs" title="全屏">⛶</button>
    <div id="chaps">${FILM.T.map((s, k) => `<button data-k="${k}">${s.title}</button>`).join('')}</div>`;
  const $ = s => bar.querySelector(s), track = $('#track');
  $('#pp').onclick = () => P.toggle();
  const snd = (id, k) => $(id).onclick = e => { AUDIO[k] = !AUDIO[k]; e.currentTarget.classList.toggle('on', AUDIO[k]); if (P.playing) AUDIO.play(P.t); };
  snd('#vo', 'voice'); snd('#snd', 'bgm');
  $('#fs').onclick = () => document.querySelector('.stage').requestFullscreen?.();
  bar.querySelectorAll('#chaps button').forEach(b => b.onclick = () => { P.t = FILM.T[+b.dataset.k].start; if (P.playing) AUDIO.play(P.t); });
  let drag = false;
  const seek = e => { const r = track.getBoundingClientRect(); P.t = clamp((e.clientX - r.left) / r.width, 0, 1) * FILM.DUR; };
  track.onpointerdown = e => { drag = true; track.setPointerCapture(e.pointerId); seek(e); };
  track.onpointermove = e => drag && seek(e);
  track.onpointerup = () => { drag = false; if (P.playing) AUDIO.play(P.t); };
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); P.toggle(); }
    else if (e.code === 'ArrowRight') { P.t = P.t + 5; if (P.playing) AUDIO.play(P.t); }
    else if (e.code === 'ArrowLeft') { P.t = P.t - 5; if (P.playing) AUDIO.play(P.t); }
  });
  document.getElementById('c').onclick = () => P.toggle();
  return { sync() {
    $('#pp').textContent = P.playing ? '❚❚' : '▶'; $('#tm').textContent = fmt(P.t); $('#fill').style.width = (P.t / FILM.DUR * 100) + '%';
    const k = locate(P.t).k; bar.querySelectorAll('#chaps button').forEach((b, j) => b.classList.toggle('on', j === k));
  } };
}

// ===================== 声音：油库里语音 + 背景音乐 =====================
// 语音来自 src/voice-data.js（tools/voice.mjs 生成，没有时静音）。背景音乐是 WebAudio 现场合成的八音盒小曲，有人声时压低。
// 播放器和出片（tools/render.mjs 用 OfflineAudioContext）走同一个 mixAudio，听到的是一样的。
const voiceOf = text => (typeof VOICE !== 'undefined' && VOICE[text]) || null;
async function voiceBuffers(ac) {
  if (ac.__voice) return ac.__voice;
  const out = {}, b64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0)).buffer;
  if (typeof VOICE !== 'undefined') await Promise.all(Object.entries(VOICE).map(async ([k, v]) => { try { out[k] = await ac.decodeAudioData(b64(v.mp3)); } catch (e) { console.warn('voice', k, e); } }));
  return (ac.__voice = out);
}
// mixAudio：从全片第 from 秒起、在 ac 的 t0 时刻开始，排好 dur 秒的声音
async function mixAudio(ac, out, t0, from, dur, { voice = true, bgm = true } = {}) {
  const buf = voice ? await voiceBuffers(ac) : {}, hasVoice = voice && Object.keys(buf).length > 0;
  // 最后过一个限幅器，AquesTalk 原声峰值就顶到 0 dB，叠上音乐容易爆音
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .12; lim.connect(out); out = lim;
  if (bgm) { const g = ac.createGain(); g.gain.value = hasVoice ? .45 : 1; g.connect(out); score(ac, g, t0, from, from + dur); }
  if (!hasVoice) return;
  const vg = ac.createGain(); vg.gain.value = .35; vg.connect(out);
  for (const s of FILM.T) for (const l of s.lines || []) {
    const b = buf[l[2]], at = s.start + l[0]; if (!b || at + b.duration <= from || at >= from + dur) continue;
    const src = ac.createBufferSource(); src.buffer = b; src.connect(vg); src.start(t0 + Math.max(0, at - from), Math.max(0, from - at));
  }
}
const AUDIO = { voice: true, bgm: true, ac: null, master: null, t0: 0, from: 0, gen: 0,
  get running() { return !!this.master; },
  async play(from) { this.stop(); if (!this.voice && !this.bgm) return; const gen = ++this.gen;
    this.ac = this.ac || new AudioContext(); await this.ac.resume(); await voiceBuffers(this.ac); if (gen !== this.gen) return;
    this.master = this.ac.createGain(); this.master.gain.value = 1.8; this.master.connect(this.ac.destination);
    this.t0 = this.ac.currentTime + .05; this.from = from; await mixAudio(this.ac, this.master, this.t0, from, FILM.DUR - from, this); },
  // 声音在放时，画面跟着声音的时钟走，不会越放越错开
  now() { return this.running ? this.from + Math.max(0, this.ac.currentTime - this.t0) : null; },
  stop() { this.gen++; if (this.master) { const m = this.master; try { m.gain.setTargetAtTime(0, this.ac.currentTime, .03); setTimeout(() => m.disconnect(), 300); } catch (e) {} this.master = null; } } };
// mixdownWav：离线混出 [from, from+dur) 的声音，16-bit 立体声 WAV 的 base64（出片用）
async function mixdownWav(from, dur) {
  const sr = 48000, oac = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), g = oac.createGain(); g.gain.value = 1.8; g.connect(oac.destination);
  await mixAudio(oac, g, 0, from, dur); const buf = await oac.startRendering(), n = buf.length, dv = new DataView(new ArrayBuffer(44 + n * 4));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1); let o = 44; for (let i = 0; i < n; i++) { dv.setInt16(o, clamp(L[i], -1, 1) * 32767, true); dv.setInt16(o + 2, clamp(R[i], -1, 1) * 32767, true); o += 4; }
  const u = new Uint8Array(dv.buffer); let bs = ''; for (let k = 0; k < u.length; k += 32768) bs += String.fromCharCode.apply(null, u.subarray(k, k + 32768)); return btoa(bs);
}
// score：背景音乐。有 src/bgm-data.js（tools/bgm.mjs 从东方原曲扒谱里取的音符）时，按下面的编配演奏：
//   主旋律 = 八音盒（正弦 + 一点二倍频，敲下去后自己响完），副旋律同音色更轻，钢琴 = 过低通的三角波，低音 = 升高八度的正弦；整体放慢到 BGM.bpm，挂一点混响。
//   一遍放完从头再来；全片最后 3 秒淡出。没有 BGM 数据时退回原来的八音盒小曲（scoreBox）。
//   放慢后的速度写在 bgm-data.js 的 bpm 里（tools/bgm.mjs 的 BPM），原曲多在 140–160，八音盒放到 90 上下才不赶。
function score(ac, out, t0, from = 0, dur = 300) {
  if (typeof BGM === 'undefined') return scoreBox(ac, out, t0, from, dur);
  const beat = 60 / (BGM.bpm || 92), loop = BGM.lenBeats * beat, end = from + dur, hz = n => 440 * Math.pow(2, (n - 69) / 12);
  // 总线：干声 + 混响（脉冲响应用 rng 生成，确定性）
  const master = ac.createGain(); master.connect(out);
  const filmEnd = typeof FILM !== 'undefined' && FILM ? FILM.DUR : 1e9;
  master.gain.setValueAtTime(1, t0); if (filmEnd < end + 3) { const fs = t0 + Math.max(0, filmEnd - 3 - from); master.gain.setValueAtTime(1, fs); master.gain.linearRampToValueAtTime(0, fs + 3); }
  const rev = ac.createConvolver(), irLen = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, irLen, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch), r = rng(5200 + ch); for (let i = 0; i < irLen; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / irLen, 3.2); }
  rev.buffer = ir; const wet = ac.createGain(); wet.gain.value = .22; rev.connect(wet); wet.connect(master);
  const bus = (g, lp) => { const n = ac.createGain(); n.gain.value = g; let tail = n; if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); tail = f; } tail.connect(master); tail.connect(rev); return n; };
  const B = { mel: bus(1), counter: bus(.5), piano: bus(1, 1700), bass: bus(1, 900) };
  const note = (dst, f, t, ring, g, type = 'sine') => { if (t + ring < from || t >= end) return; const st = t0 + Math.max(0, t - from), off = Math.max(0, from - t);
    const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.value = f; const g0 = g * Math.exp(-off * 3 / ring);
    e.gain.setValueAtTime(0, st); e.gain.linearRampToValueAtTime(g0, st + .006); e.gain.exponentialRampToValueAtTime(.0004, st + Math.max(.06, ring - off));
    o.connect(e); e.connect(dst); o.start(st); o.stop(st + Math.max(.06, ring - off) + .05); };
  for (let L = Math.max(0, Math.floor((from - 3) / loop)); L * loop < end; L++) {
    const base = L * loop;
    for (const [b, d, n, v] of BGM.parts.mel) { const t = base + b * beat, ring = Math.max(1.1, d * beat + .5), g = .05 * (.55 + .45 * v);
      note(B.mel, hz(n), t, ring, g); note(B.mel, hz(n) * 2.003, t, ring * .55, g * .22); }
    for (const [b, d, n, v] of BGM.parts.counter) { const t = base + b * beat; note(B.counter, hz(n), t, Math.max(.9, d * beat + .4), .045 * (.55 + .45 * v)); }
    for (const [b, d, n, v] of BGM.parts.piano) { const t = base + b * beat; note(B.piano, hz(n), t, Math.min(1.8, d * beat + .25), .018 * (.5 + .5 * v), 'triangle'); }
    for (const [b, d, n, v] of BGM.parts.bass) { const t = base + b * beat; note(B.bass, hz(n + 12), t, Math.max(.15, d * beat * .9), .04 * (.5 + .5 * v)); }
  }
}
function scoreBox(ac, out, t0, from = 0, dur = 300) {
  const BPM = 84, beat = 60 / BPM, bar = beat * 4;
  const scale = [0, 2, 4, 7, 9, 12, 14, 16], base = 392;   // G 五声
  const hz = n => base * Math.pow(2, n / 12);
  const mel = [[4, 2], [2, 1], [0, 1], [2, 2], [4, 2], [5, 2], [4, 1], [2, 1], [0, 4], [2, 2], [4, 1], [5, 1], [7, 2], [5, 2], [4, 3], [2, 1], [0, 4]];
  const chords = [[-12, -5], [-15, -8], [-17, -10], [-12, -5]];
  const note = (f, t, d, g, type) => { if (t + d < from) return; const st = t0 + Math.max(0, t - from); const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.value = f;
    const off = Math.max(0, from - t); e.gain.setValueAtTime(0, st); e.gain.linearRampToValueAtTime(g * Math.exp(-off * 2.2), st + .01); e.gain.exponentialRampToValueAtTime(.0005, st + Math.max(.05, d - off)); o.connect(e); e.connect(out); o.start(st); o.stop(st + Math.max(.05, d - off) + .05); };
  const loopLen = mel.reduce((a, m) => a + m[1], 0) * beat;
  for (let L = 0; L * loopLen < dur; L++) {
    let tt = L * loopLen;
    for (const [n, d] of mel) { note(hz(scale[n % scale.length] + (n >= scale.length ? 12 : 0)), tt, d * beat * 1.6, .07, 'sine'); note(hz(scale[n % scale.length]) * 2, tt, d * beat, .018, 'triangle'); tt += d * beat; }
    for (let b = 0; b * bar < loopLen; b++) { const ch = chords[b % chords.length]; ch.forEach(n => note(hz(n), L * loopLen + b * bar, bar * .95, .035, 'triangle')); }
  }
}

// seq：把一串台词按顺序排成 lines。item 是 '文字' 或 ['文字', { mood, who, pause 句前停顿秒, hold 句后多停秒, dur 指定时长 }]
// 默认时长 = 字数 × 0.17 + 0.8 秒（约 6 字/秒），有油库里语音时至少盖住语音再多 0.35 秒；句间 0.25 秒。
function seq(t0, items) {
  let t = t0; const out = [];
  for (const it of items) { const [text, o = {}] = Array.isArray(it) ? it : [it]; t += o.pause || 0;
    const v = voiceOf(text), d = o.dur || Math.max([...text].length * .17 + .8, v ? v.d + .35 : 0) + (o.hold || 0); out.push([t, t + d, text, o]); t += d + .25; }
  return out;
}
const seqEnd = lines => lines.length ? lines.at(-1)[1] : 0;
