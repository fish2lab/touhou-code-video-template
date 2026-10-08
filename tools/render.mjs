// 出片：逐帧取图交给 ffmpeg，配上离线混好的油库里语音和背景音乐 → out/touhou-code-video-template.mp4（1920×1080，30fps，H.264 + AAC）
//   node tools/render.mjs [--jobs 4] [--scale 1] [--out out/xxx.mp4] [--from 0 --to 20]
// ffmpeg：优先用 PATH 里的，没有就用 FFMPEG 环境变量。
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { openFilm, ROOT } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const jobs = +arg('jobs', 4), scale = +arg('scale', 1), out = resolve(ROOT, arg('out', 'out/touhou-code-video-template.mp4'));
const FF = process.env.FFMPEG || 'ffmpeg';
try { execFileSync(FF, ['-version'], { stdio: 'ignore' }); } catch { console.error('找不到 ffmpeg（设 FFMPEG=路径）'); process.exit(2); }
const tmp = resolve(ROOT, 'out/render-tmp'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });

const first = await openFilm();
const { DUR, FPS } = first.info, from = +arg('from', 0), to = +arg('to', DUR);
const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS), N = F1 - F0;
console.log(`render ${N} frames (${(N / FPS).toFixed(1)}s) × ${jobs} jobs → ${out}`);
// 背景音乐：页面里用 OfflineAudioContext 渲染同一份乐谱
const wavB64 = await first.page.evaluate(({ from, dur }) => mixdownWav(from, dur), { from, dur: N / FPS });   // 油库里语音 + 背景音乐，和播放器同一份混音
writeFileSync(resolve(tmp, 'music.wav'), Buffer.from(wavB64, 'base64'));

const pages = [first];
for (let j = 1; j < jobs; j++) pages.push(await openFilm());
const t0 = Date.now(); let done = 0;
async function segment(j) {
  const { page } = pages[j], a = F0 + Math.floor(N * j / jobs), b = F0 + Math.floor(N * (j + 1) / jobs), file = resolve(tmp, `seg${j}.mp4`);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg ' + code)) : res()));
  for (let i = a; i < b; i++) {
    const url = await page.evaluate(({ t, s }) => { const cv = document.getElementById('c'); if (cv.width !== 1920 * s) { cv.width = 1920 * s; cv.height = 1080 * s; } renderAt(cv.getContext('2d'), t, s); return cv.toDataURL('image/jpeg', .95); }, { t: i / FPS, s: scale });
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 300 === 0) console.log(`${done}/${N} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await closed; return file;
}
const files = await Promise.all(pages.map((_, j) => segment(j)));
writeFileSync(resolve(tmp, 'list.txt'), files.map(f => `file '${f}'`).join('\n'));
mkdirSync(resolve(out, '..'), { recursive: true });
execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', resolve(tmp, 'list.txt'), '-i', resolve(tmp, 'music.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
const errors = pages.flatMap(p => p.errors);
for (const p of pages) await p.browser.close();
console.log(`done: ${out} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
