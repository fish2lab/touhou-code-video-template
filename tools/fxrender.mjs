// 把一个亮点特效渲染成无声短视频（循环预览、网页素材用）：fx.html → out/fx/<id>.mp4
//   node tools/fxrender.mjs nap-fall [--width 960] [--fps 30] [--out out/fx/nap-fall.mp4] [--crf 28]
// 需要 ffmpeg（FFMPEG=路径，默认 PATH 里的）。浏览器同 browser.mjs（CHROMIUM=可执行文件路径）。页面有报错时退出码 1。
import { mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { openFilm, ROOT } from './browser.mjs';
const id = process.argv[2], arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
if (!id) { console.error('用法：node tools/fxrender.mjs <id> [--width 960] [--fps 30] [--crf 28] [--out 路径]'); process.exit(2); }
const width = +arg('width', 960), height = Math.round(width * 9 / 16), fps = +arg('fps', 30), crf = arg('crf', '28'), FF = process.env.FFMPEG || 'ffmpeg';
const out = resolve(ROOT, arg('out', `out/fx/${id}.mp4`)); mkdirSync(resolve(out, '..'), { recursive: true });
try { execFileSync(FF, ['-version'], { stdio: 'ignore' }); } catch { console.error('找不到 ffmpeg（设 FFMPEG=路径）'); process.exit(2); }
const { browser, page, errors } = await openFilm('fx=' + id, { html: resolve(ROOT, 'fx.html') });
const dur = await page.evaluate(i => FX.list.find(o => o.id === i)?.dur, id);
if (!dur) { console.error('找不到特效 ' + id); await browser.close(); process.exit(2); }
const N = Math.round(dur * fps);
const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const closed = new Promise((res, rej) => ff.on('close', code => code ? rej(new Error('ffmpeg ' + code)) : res()));
for (let i = 0; i < N; i++) {
  const url = await page.evaluate(({ t, w, h }) => { __fxAt(t); const s = document.createElement('canvas'); s.width = w; s.height = h; s.getContext('2d').drawImage(document.getElementById('cv'), 0, 0, w, h); return s.toDataURL('image/jpeg', .92); }, { t: i / fps, w: width, h: height });
  if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end(); await closed; await browser.close();
console.log(`done: ${out} (${N} 帧, ${dur}s, ${width}×${height})`);
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
