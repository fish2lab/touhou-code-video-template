'use strict';
// 新段的起手文件：复制成 src/scenes/N-名字.js，全局替换 SX/sx 为本段前缀，再在 index.html 里加一行 <script>。
// 文件名以 _ 开头的不会被载入，这个文件只是模板。
//
// 约定（详见 docs/教程.md）：
//   · 顶层名字全带本段前缀（所有脚本共用一个全局作用域，重名会静默覆盖）。
//   · 画面只由 tau（段内时间）决定：不存状态，不用 Math.random()，要随机用 hash/rng 带种子。
//   · 段首、段末各留约 0.8 秒的「标准画面」（spread + 两人在 STD 站位），段间转场才接得上。
//   · 人物站位区（穿模）：帕秋莉 x 205–455，琪露诺 x 1446–1754（身高 500/440，脚底 y=880）；内容放两人之间 x 520–1410，或两人头顶以上。字幕占 y≈930–1030，书脊 CX±20 不放字。
//   · 改完跑：node tools/overlap.mjs --scene 段名；列出来的时间点用 frames.mjs --at 抽整帧看。
const SXLINES = seq(1.0, [
  ['第一句台词。', { hold: .4 }],
  ['第二句，琪露诺插话。', { who: 'cirno', mood: 'confused', pause: .2 }],
]);
const sxT = i => SXLINES[i][0], sxE = i => SXLINES[i][1];   // 第 i 句的开始 / 结束（段内秒）
const SXDUR = sxE(SXLINES.length - 1) + 1.0;                 // 段长：最后一句结束后留一秒标准画面

function sxDraw(c, tau, L) {
  spread(c, tau);                                   // 桌面 + 摊开的魔导书；BOOK.L / BOOK.R 是左右页
  pageHeader(c, '第 N 页 · 名字', tau, .2);          // 书页左上角页眉
  // 内容：sm(a, b, tau) 在 [a,b] 秒内 0→1；key(tau, [[t0, v0], [t1, v1]]) 关键帧；win(a, b, tau) 淡入淡出
  const k = sm(sxT(0), sxT(0) + .5, tau, easeOutBack);
  pop(c, CX + 220, 400, k, () => drawMoonIcon(c, CX + 220, 400, 60, P.moon, -.5));
  // 两人：mouthOf / moodOf 自动从当前台词取嘴型和表情
  drawPatchouli(c, { ...STD.pch, pose: 'lecture', mood: moodOf(L, 'patchouli', 'normal'), mouth: mouthOf(L, 'patchouli'), blink: blinkAt(tau), t: tau });
  drawCirno(c, { ...STD.cir, pose: 'stand', mood: moodOf(L, 'cirno', 'normal'), mouth: mouthOf(L, 'cirno'), blink: blinkAt(tau, 2), t: tau });
}
scene({ order: 9, key: 'sx', title: '本段标题', dur: SXDUR, lines: SXLINES, fn: sxDraw });
