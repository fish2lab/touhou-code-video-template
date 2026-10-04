// 抽帧检查。
//   node tools/frames.mjs --scene sleep --grid 24        本段均匀 24 帧的联系表 → out/frames/sleep-grid.jpg
//   node tools/frames.mjs --scene sleep --at 3,10.5      本段第 3、10.5 秒整帧 → out/frames/sleep-3.png …
//   node tools/frames.mjs --grid 36                      全片联系表
// 页面有报错时退出码 1。
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openFilm, ROOT } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const sceneKey = arg('scene', ''), grid = +arg('grid', 0), at = arg('at', ''), cell = +arg('cell', 320), from = +arg('from', 0), to = arg('to', '');
const outDir = resolve(ROOT, 'out/frames'); mkdirSync(outDir, { recursive: true });
const name = sceneKey || 'film';
const { browser, page, errors, info } = await openFilm(sceneKey ? 'scene=' + sceneKey : '');
console.log(`${name}: ${info.DUR.toFixed(2)}s`, info.scenes.map(s => `${s.key}@${s.start.toFixed(1)}+${s.dur.toFixed(1)}`).join(' '));
if (at) for (const t of at.split(',').map(Number)) {
  const url = await page.evaluate(tt => __film.frame(tt), t);
  const f = resolve(outDir, `${name}-${t}.png`); writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
}
if (grid || !at) {
  const n = grid || 24, end = to ? +to : info.DUR;
  const url = await page.evaluate(({ n, cell, from, end }) => {
    const cols = 6, rows = Math.ceil(n / cols), ch = Math.round(cell * 9 / 16), pad = 22, sheet = document.createElement('canvas');
    sheet.width = cols * cell; sheet.height = rows * (ch + pad); const g = sheet.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
    const img = document.createElement('canvas'); img.width = 1920; img.height = 1080; const ic = img.getContext('2d');
    g.font = '14px monospace'; g.fillStyle = '#ddd';
    for (let k = 0; k < n; k++) { const t = from + (end - from - .05) * k / Math.max(1, n - 1); renderAt(ic, t, 1);
      const x = (k % cols) * cell, y = Math.floor(k / cols) * (ch + pad); g.drawImage(img, x, y, cell, ch); g.fillStyle = '#ddd'; g.fillText(t.toFixed(2) + 's  ' + locate(t).s.key, x + 4, y + ch + 16); }
    return sheet.toDataURL('image/jpeg', .9);
  }, { n, cell, from, end });
  const f = resolve(outDir, `${name}-grid.jpg`); writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
}
await browser.close();
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
