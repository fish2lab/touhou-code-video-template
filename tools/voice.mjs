// 中文油库里语音：把全片台词合成成 AquesTalk 的语音 → src/voice-data.js。按台词的 who 选声音（VOICES）：
// 帕秋莉 f1（「ゆっくり霊夢」那把声音），琪露诺 f2。
//   node tools/voice.mjs [--list]
// 做法和社区的中文油库里一样：汉字 → 拼音（pinyin-pro，带多音字上下文）→ 片假名（平凡社音节表）→ AquesTalk 音声记号。
// 每句一段 MP3（base64）+ 30fps 响度包络（让帕秋莉按真实语音张嘴）。改了台词就重跑一次，生成的文件要提交。
// AquesTalk 旧版（免费许可，含商用）；DLL 不单独再分发，这里只发布合成出来的声音，片尾和 README 注明「AquesTalk（株式会社アクエスト）」。
import { load } from 'aquestalk.js';
import { pinyin } from 'pinyin-pro';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PINYIN_KANA } from './zh-kana.mjs';
import { openFilm, ROOT } from './browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const FF = process.env.FFMPEG || 'ffmpeg';
const VOICES = { patchouli: { voice: 'f1', speed: 110 }, cirno: { voice: 'f2', speed: 115 } };   // 第 3 集第三稿放慢（原 120 / 125），照顾没有基础的观众

// ---- 中文 → 音声记号 ----
const DIG = '零一二三四五六七八九';
function cnInt(n) {   // 0..9999 → 汉字读法（10 读「十」，15 读「十五」）
  if (n < 10) return DIG[n];
  const q = Math.floor(n / 1000), b = Math.floor(n / 100) % 10, s = Math.floor(n / 10) % 10, g = n % 10;
  let out = '', zero = false;
  for (const [d, u] of [[q, '千'], [b, '百'], [s, '十'], [g, '']]) {
    if (d === 0) { if (out) zero = true; continue; }
    if (zero) { out += '零'; zero = false; }
    out += (d === 1 && u === '十' && !out ? '' : DIG[d]) + u;
  }
  return out;
}
const numbers = t => t.replace(/(\d{4})(?=\s*年)/g, y => [...y].map(d => DIG[d]).join(''))   // 年份逐字读
  .replace(/(\d+)\.(\d+)/g, (_, i, f) => cnInt(+i) + '点' + [...f].map(d => DIG[d]).join(''))   // 小数：1.75 读一点七五
  .replace(/\d+/g, n => cnInt(+n));
// 拼音表里没有的词：拉丁字母、口癖
const WORDS = { 'AI': 'エーアイ', 'JavaScript': 'ジャバスクリプト', 'Q': 'キュー', 'buff': 'バフ', 'WHO': 'ダブリューエイチオー', 'delta': 'デルタ', 'PNG': 'ピーエヌジー', 'FLAC': 'フラック',
  '得你': 'デイニー', '你得': 'ニーデイ' };   // 「得」读 děi 的地方（pinyin-pro 按 de 读）
const WORDS_RE = new RegExp(Object.keys(WORDS).sort((a, b) => b.length - a.length).join('|'), 'g');
function toKoe(text) {
  const src = numbers(text).replace(WORDS_RE, m => `<${m}>`), out = [];
  for (const part of src.split(/(<[^>]+>)/)) {
    if (part.startsWith('<')) { out.push(WORDS[part.slice(1, -1)]); continue; }
    for (const p of pinyin(part, { toneType: 'none', type: 'array', v: true, nonZh: 'consecutive' })) {
      const k = PINYIN_KANA[p] ?? PINYIN_KANA[p.replace(/v/g, 'ü')] ?? { ng: 'ン', n: 'ン', m: 'ム' }[p];
      if (k) out.push(k);
      else if (/[？?]/.test(p)) out.push('?');
      else if (/[。！!…—]/.test(p)) out.push('。');
      else if (/[，、；：,;:“”「」]/.test(p)) out.push('、');
      else if (p.trim() && !/^[·\s>\-]+$/.test(p)) console.warn('  没读的字符：', JSON.stringify(p), '←', text);
    }
  }
  return out.join('').replace(/^[、。?]+/, '').replace(/([、。?])[、。?]+/g, '$1');
}

// ---- 取全片台词 ----
const { browser, page } = await openFilm();
const who = Object.fromEntries(await page.evaluate(() => SCENES.flatMap(s => (s.lines || []).map(l => [l[2], (l[3] || {}).who || 'patchouli']))));
const texts = Object.keys(who);
await browser.close();
if (process.argv.includes('--list')) { for (const t of texts) console.log(`[${who[t]}] ${t}`, '\n  →', toKoe(t)); process.exit(0); }

// ---- 合成 ----
const tmp = mkdtempSync(join(tmpdir(), 'voice-')), VOICE = {};
let peak = 0; const raw = {};
for (const [name, { voice, speed }] of Object.entries(VOICES)) {
  const mine = texts.filter(t => (VOICES[who[t]] ? who[t] : 'patchouli') === name); if (!mine.length) continue;
  const aq = await load(voice);
  for (const text of mine) {
    const koe = toKoe(text);
    let wav; try { wav = aq.run(koe, speed); } catch (e) { console.error('合成失败：', text, koe, e.message); continue; }
    const pcm = new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.byteLength - (wav.byteLength - 44) % 2));
    const sr = new DataView(wav.buffer, wav.byteOffset).getUint32(24, true), hop = sr / 30, env = [];
    for (let i = 0; i * hop < pcm.length; i++) { let s = 0; const a = Math.floor(i * hop), b = Math.min(pcm.length, Math.floor((i + 1) * hop)); for (let j = a; j < b; j++) s += pcm[j] * pcm[j]; const r = Math.sqrt(s / Math.max(1, b - a)); env.push(r); peak = Math.max(peak, r); }
    const f = join(tmp, 'a.wav'), m = join(tmp, 'a.mp3'); writeFileSync(f, wav);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-i', f, '-ar', '16000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', m]);
    raw[text] = { d: +(pcm.length / sr).toFixed(3), env, mp3: readFileSync(m).toString('base64'), koe };
  }
  await aq.destroy();
}
rmSync(tmp, { recursive: true, force: true });
for (const [t, v] of Object.entries(raw)) VOICE[t] = { d: v.d, env: v.env.map(r => Math.min(9, Math.round(r / peak * 12))).join(''), mp3: v.mp3 };
const js = `'use strict';\n// 由 tools/voice.mjs 生成，别手改。中文油库里语音（AquesTalk f1 帕秋莉 / f2 琪露诺，© 株式会社アクエスト）：每句 { d 秒, env 30fps 响度 0-9, mp3 base64 }\nconst VOICE = ${JSON.stringify(VOICE)};\n`;
writeFileSync(resolve(ROOT, 'src/voice-data.js'), js);
console.log(`src/voice-data.js：${Object.keys(VOICE).length} 句，${(js.length / 1024).toFixed(0)} KB，共 ${Object.values(VOICE).reduce((a, v) => a + v.d, 0).toFixed(0)} 秒`);
