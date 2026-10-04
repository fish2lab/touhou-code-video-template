// 穿模检查：不画人物渲染每一帧，看两人的包围框里有没有道具、字（和框外一圈的底色差得多的像素）。
//   node tools/overlap.mjs --scene brain [--step .25] [--thr .04]
// 输出可疑的时间点（框内「异色」像素比例 ≥ thr）。只是筛查：把列出来的时间用 frames.mjs --at 抽整帧再看。
// 包围框是估的（帕秋莉宽 0.5h、琪露诺 0.7h，飞行姿势偏差更大），书脊阴影、桌面边缘也可能误报。
import { openFilm } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const key = arg('scene', ''), step = +arg('step', .25), thr = +arg('thr', .04);
const { browser, page, errors, info } = await openFilm((key ? 'scene=' + key + '&' : '') + 'nochar');
const hits = await page.evaluate(({ step, thr, DUR }) => {
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; const c = cv.getContext('2d', { willReadFrequently: true }), out = [];
  for (let t = 0; t < DUR; t += step) {
    __boxes.length = 0; renderAt(c, t, .5);
    for (const b of __boxes) {
      const x0 = Math.max(0, Math.floor(b.x0 + 4)), x1 = Math.min(960, Math.ceil(b.x1 - 4)), y0 = Math.max(0, Math.floor(b.y0 + 4)), y1 = Math.min(462, Math.ceil(b.y1 - 4));   // 框已是半尺寸画布坐标（getTransform 含 0.5 缩放）；字幕区以下不算
      if (x1 - x0 < 8 || y1 - y0 < 8) continue;
      const ring = [], R = 18, d = c.getImageData(Math.max(0, x0 - R), Math.max(0, y0 - R), Math.min(960, x1 + R) - Math.max(0, x0 - R), Math.min(540, y1 + R) - Math.max(0, y0 - R));
      const ox = Math.max(0, x0 - R), oy = Math.max(0, y0 - R), px = (i, j) => { const k = ((j - oy) * d.width + (i - ox)) * 4; return [d.data[k], d.data[k + 1], d.data[k + 2]]; };
      for (let j = oy; j < oy + d.height; j += 3) for (let i = ox; i < ox + d.width; i += 3) if (i < x0 || i >= x1 || j < y0 || j >= y1) ring.push(px(i, j));
      if (!ring.length) continue;
      const med = [0, 1, 2].map(k => ring.map(p => p[k]).sort((a, b) => a - b)[ring.length >> 1]);
      let n = 0, bad = 0;
      for (let j = y0; j < y1; j += 2) for (let i = x0; i < x1; i += 2) { const p = px(i, j); n++; if (Math.abs(p[0] - med[0]) + Math.abs(p[1] - med[1]) + Math.abs(p[2] - med[2]) > 70) bad++; }
      const r = bad / n; if (r >= thr) out.push({ t: +t.toFixed(2), scene: locate(t).s.key, who: b.who, r: +r.toFixed(3) });
    }
  }
  return out;
}, { step, thr, DUR: info.DUR });
await browser.close();
// 连续的时间点合并成区间
const runs = [];
for (const h of hits) { const r = runs.find(q => q.who === h.who && Math.abs(q.t1 - h.t) <= step * 1.5); if (r) { r.t1 = h.t; r.max = Math.max(r.max, h.r); } else runs.push({ scene: h.scene, who: h.who, t0: h.t, t1: h.t, max: h.r }); }
for (const r of runs) console.log(`${r.scene}\t${r.who}\t${r.t0}–${r.t1}s\t最大异色 ${(r.max * 100).toFixed(1)}%`);
console.log(`共 ${runs.length} 段可疑（阈值 ${thr * 100}%）`);
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
