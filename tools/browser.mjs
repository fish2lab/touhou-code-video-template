// 共用：起一个 Chromium 打开 index.html（file://），等 __ready。页面报错会记下来，调用方决定退出码。
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export const ROOT = resolve(new URL('..', import.meta.url).pathname);
export async function openFilm(query = '', { html = resolve(ROOT, 'index.html') } = {}) {
  // 需要指定浏览器时设 CHROMIUM=可执行文件路径；否则用 Playwright 自带的
  const exe = process.env.CHROMIUM && existsSync(process.env.CHROMIUM) ? process.env.CHROMIUM : undefined;
  const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(html).href + '?bare' + (query ? '&' + query : ''));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const info = await page.evaluate(() => ({ DUR: __film.DUR, FPS: __film.FPS, scenes: __film.scenes }));
  return { browser, page, errors, info };
}
