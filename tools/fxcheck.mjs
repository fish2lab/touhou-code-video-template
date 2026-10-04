// 检查一个亮点特效：在 dur 内均匀取 N 帧拼成联系表 → out/fx/<id>.jpg，页面有报错时退出码 1。
//   node tools/fxcheck.mjs nap-fall            默认 12 帧
//   node tools/fxcheck.mjs nap-fall --n 18 --cell 480
//   node tools/fxcheck.mjs nap-fall --at 2.5,4  只出这几秒的整帧 → out/fx/<id>-<t>.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openFilm, ROOT } from './browser.mjs';
const id = process.argv[2], arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const n = +arg('n', 12), cell = +arg('cell', 400), at = arg('at', '');
if (!id) { console.error('用法：node tools/fxcheck.mjs <id> [--n 12] [--cell 400] [--at 2.5,4]'); process.exit(2); }
const out = resolve(ROOT, 'out/fx'); mkdirSync(out, { recursive: true });
const { browser, page, errors } = await openFilm('fx=' + id, { html: resolve(ROOT, 'fx.html'), wait: '__ready' });
const dur = await page.evaluate(i => FX.list.find(o => o.id === i)?.dur, id);
if (!dur) { console.error('找不到特效 ' + id); await browser.close(); process.exit(2); }
if (at) for (const t of at.split(',').map(Number)) {
  const url = await page.evaluate(tt => __fxAt(tt), t); const f = resolve(out, `${id}-${t}.png`); writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
} else {
  const url = await page.evaluate(({ n, cell, dur }) => {
    const cols = 4, rows = Math.ceil(n / cols), ch = Math.round(cell * 9 / 16), pad = 22, sheet = document.createElement('canvas');
    sheet.width = cols * cell; sheet.height = rows * (ch + pad); const g = sheet.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height); g.font = '14px monospace';
    for (let k = 0; k < n; k++) { const t = (dur - .02) * k / Math.max(1, n - 1); const img = new Image(); img.src = __fxAt(t);
      const x = (k % cols) * cell, y = Math.floor(k / cols) * (ch + pad); g.drawImage(document.getElementById('cv'), x, y, cell, ch); g.fillStyle = '#ddd'; g.fillText(t.toFixed(2) + 's', x + 4, y + ch + 16); }
    return sheet.toDataURL('image/jpeg', .9);
  }, { n, cell, dur });
  const f = resolve(out, `${id}.jpg`); writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
}
await browser.close();
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
