// 下载霞鹜文楷（OFL）到 fonts/。字体 25MB，不进 git。
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dst = new URL('../fonts/LXGWWenKai-Regular.ttf', import.meta.url).pathname;
if (existsSync(dst)) { console.log('font ok:', dst); process.exit(0); }
mkdirSync(new URL('../fonts/', import.meta.url).pathname, { recursive: true });
const url = 'https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf';
execFileSync('curl', ['-fsSL', '--retry', '4', '-o', dst, url], { stdio: 'inherit' });
console.log('font downloaded:', dst);
