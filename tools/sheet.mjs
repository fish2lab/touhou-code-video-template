// 角色样张截图：character.html → out/sheets/<who>-<poses|moods>.png（开发用，给没有图形界面的机器看图）
//   node tools/sheet.mjs --who ran [--sheet poses|moods] [--t 1]
// CHROMIUM=可执行文件路径；不设用 Playwright 自带的。页面有报错时退出码 1。
import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ROOT } from './browser.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const who = arg('who', ''), sheet = arg('sheet', ''), t = arg('t', '1');
const exe = process.env.CHROMIUM && existsSync(process.env.CHROMIUM) ? process.env.CHROMIUM : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 900 } }), errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(resolve(ROOT, 'character.html')).href + `?t=${t}` + (who ? `&who=${who}` : '') + (sheet ? `&sheet=${sheet}` : ''));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const outDir = resolve(ROOT, 'out/sheets'); mkdirSync(outDir, { recursive: true });
for (const id of await page.$$eval('canvas', cs => cs.map(c => c.id))) {
  const url = await page.evaluate(i => document.getElementById(i).toDataURL('image/png'), id);
  const f = resolve(outDir, id + '.png'); writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
}
await browser.close();
if (errors.length) { console.error('page errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
