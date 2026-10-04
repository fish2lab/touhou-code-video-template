// 打包：把 index.html 和所有脚本、字体（按用到的字裁剪）合成一个单文件 dist/index.html，双击就能看，不用网络。
// 字体裁剪用 fonttools（pip install fonttools brotli）；没有就原样内嵌整个字体（25MB）。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const ROOT = resolve(new URL('..', import.meta.url).pathname), DIST = resolve(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true }); mkdirSync(DIST, { recursive: true });
let html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const block = html.slice(html.indexOf('<!-- @scripts -->'), html.indexOf('<!-- @end -->') + '<!-- @end -->'.length);
const srcs = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = srcs.map(s => `// ---- ${s}\n` + readFileSync(resolve(ROOT, s), 'utf8')).join('\n');
// 用到的字：所有脚本和页面里的非 ASCII 字符 + ASCII 可见字符
const chars = new Set([...(html + js)].filter(ch => ch.charCodeAt(0) > 127));
for (let i = 32; i < 127; i++) chars.add(String.fromCharCode(i));
const font = resolve(ROOT, 'fonts/LXGWWenKai-Regular.ttf');
if (!existsSync(font)) execFileSync('node', [resolve(ROOT, 'tools/fetch-font.mjs')], { stdio: 'inherit' });
let fontUrl;
try {
  const txt = resolve(DIST, 'chars.txt'), sub = resolve(DIST, 'wenkai-subset.woff2'); writeFileSync(txt, [...chars].join(''));
  execFileSync('pyftsubset', [font, `--text-file=${txt}`, '--flavor=woff2', `--output-file=${sub}`, '--layout-features=*'], { stdio: 'inherit' });
  fontUrl = 'data:font/woff2;base64,' + readFileSync(sub).toString('base64'); rmSync(txt); rmSync(sub);
} catch (e) { console.warn('pyftsubset 不可用，内嵌完整字体：', e.message); fontUrl = 'data:font/ttf;base64,' + readFileSync(font).toString('base64'); }
html = html.replace('url(fonts/LXGWWenKai-Regular.ttf)', `url(${fontUrl})`)
  .replace(block, `<script>\n${js.replace(/<\/script/g, '<\\/script')}\n</script>`);
writeFileSync(resolve(DIST, 'index.html'), html);
console.log(`dist/index.html ${(statSync(resolve(DIST, 'index.html')).size / 1024).toFixed(0)} KB, ${chars.size} 字`);
