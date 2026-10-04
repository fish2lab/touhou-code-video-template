'use strict';
// 亮点特效注册表。每个特效一个文件 src/fx/<id>.js，文件末尾 FX.add({...}) 登记；fx.html 按 id 播放。
//   FX.add({ id, title, src, dur, draw(c, t, o), bg })
//     id     英文短名，同文件名
//     title  一句话中文名
//     src    出处，例如 '第 4 集 nap 段'
//     dur    样张循环时长（秒）
//     draw   (c, t) 在 1920×1080 画布上画 t 秒（0..dur）的整帧，纯函数：同一个 t 必画出同一帧
//     bg     'paper' 先铺 paperBg（默认）| 'dark' 铺深色纸 | 'none' 自己铺
// 文件内的全局名一律带 fx 前缀（fxXxx），不覆盖 kit.js / core.js 的名字。
const FX = { list: [], add(o) { this.list.push({ bg: 'paper', dur: 8, ...o }); },
  render(o, c, t) { c.save(); c.clearRect(0, 0, 1920, 1080); if (o.bg === 'paper') paperBg(c); else if (o.bg === 'dark') paperBg(c, { dark: true }); o.draw(c, t); c.restore(); } };
