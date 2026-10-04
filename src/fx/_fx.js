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
//
// ===== 在一集里用特效（三步） =====
//   1. index.html：在 props.js 之后、scenes 之前加  <script src="src/fx/_fx.js"></script>  和要用的  <script src="src/fx/nap-fall.js"></script>
//   2. 整段当一个场景（一行）：  fxScene({ id: 'nap-fall', order: 3, lines: SXLINES, over: (c, tau, L) => {…叠自己的东西…} });
//      或者在自己的画面函数里，当一个零件画：  fxPlay('nap-fall', c, tau, { box: [x, y, w, h] });
//   3. 配音、字幕、时间线照常：台词写在 lines 里，场景 dur 默认等于特效 dur ÷ speed，可用 dur / hold 改。
//
//   fxPlay(id, c, t, opt)   在场景时间 t 画特效。opt（都可省）：
//     t0     特效从场景的第几秒开始（默认 0）；之前什么都不画
//     speed  放映速度（默认 1；2 = 快一倍）
//     loop   true 则 dur 之后循环；默认停在最后一帧
//     box    [x, y, w, h]：把 1920×1080 的特效等比缩进这个矩形，并裁掉矩形外的（默认铺满整个画布）
//     bg     false 不铺特效声明的底色（bg 为 'none' 的特效自己铺底，关不掉）
//     al     整体透明度 0..1
//   fxScene(o)              登记一个只放这个特效的场景。o = { id, order, key, title, lines, dur, hold, opt, over }
//     opt    同 fxPlay 的 opt（不含 box 以外的场景级内容）  over  (c, tau, L) 在特效上面再画，比如两人、气泡
//     dur    默认 = 特效 dur ÷ speed + hold（hold 默认 0）
//   fxInfo(id)              { id, title, src, dur, bg } 查时长、出处
const FX = { list: [], add(o) { this.list.push({ bg: 'paper', dur: 8, ...o }); },
  get(id) { const o = this.list.find(f => f.id === id); if (!o) throw new Error(`没有特效 ${id}；已载入：${this.list.map(f => f.id).join('、') || '（空，index.html 里加 <script src="src/fx/<id>.js">）'}`); return o; },
  play(id, c, t, opt = {}) {
    const o = typeof id === 'string' ? this.get(id) : id, { box, t0 = 0, speed = 1, loop = false, bg = true, al = 1 } = opt;
    let u = (t - t0) * speed; if (u < 0) return;
    u = loop ? u % o.dur : Math.min(u, o.dur - 1e-3);
    c.save(); if (al < 1) c.globalAlpha *= al;
    if (box) { const [x, y, w, h] = box, s = Math.min(w / 1920, h / 1080); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x + (w - 1920 * s) / 2, y + (h - 1080 * s) / 2); c.scale(s, s); }
    if (bg) { if (o.bg === 'paper') paperBg(c); else if (o.bg === 'dark') paperBg(c, { dark: true }); }
    o.draw(c, u, opt);
    c.restore();
  },
  // 样张页用：清空 + 画一帧（不裁剪、不缩放）
  render(o, c, t) { c.save(); c.clearRect(0, 0, 1920, 1080); this.play(o, c, t); c.restore(); } };
const fxPlay = (id, c, t, opt) => FX.play(id, c, t, opt);
const fxInfo = id => { const { title, src, dur, bg } = FX.get(id); return { id, title, src, dur, bg }; };
function fxScene(o) {
  const f = FX.get(o.id), opt = o.opt || {}, dur = o.dur ?? f.dur / (opt.speed || 1) + (o.hold || 0);
  scene({ order: o.order ?? 9, key: o.key ?? f.id, title: o.title ?? f.title, dur, lines: o.lines || [],
    fn: (c, tau, L) => { FX.play(f, c, tau, opt); if (o.over) o.over(c, tau, L); } });
}
