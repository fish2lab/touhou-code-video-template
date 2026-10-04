'use strict';
// 第 0 段：开场（演示段）。摊开的魔导书，标题一笔笔写出，帕秋莉自我介绍，琪露诺插话。
// 新集：整段重写。本段只演示三件事：台词用 seq 排、画面用 sm/key 按段内时间 tau 算、两个角色用标准站位。
// 顶层名字一律带本段前缀 S0 / s0（所有脚本共用一个全局作用域，重名会静默覆盖）。
const S0LINES = seq(1.2, [
  ['我是帕秋莉，这是一份用纯代码做出来的视频。', { hold: .4 }],
  ['没有一张外部图片，也没有 AI 生图。', { who: 'cirno', mood: 'surprised', pause: .3 }],
  ['每一笔，都是 JavaScript 在画布上画的。', { mood: 'smug', pause: .3, hold: .6 }],
]);
const S0T = i => S0LINES[i][0], S0E = i => S0LINES[i][1];
const S0DUR = S0E(2) + 1.2;

function s0Draw(c, tau, L) {
  spread(c, tau);
  // 右页：标题一笔笔写出。writeP(tau, 开始时刻, 文字, 每字秒数) 给出 zh 的 p
  const T1 = '纯代码做一集东方视频', T2 = '帕秋莉讲座 · 模板', R = BOOK.R;
  zh(c, T1, R.x + R.w / 2, R.y + 230, { size: 74, align: 'center', color: P.ink, p: writeP(tau, .3, T1, .1) });
  rline(c, [[R.x + 140, R.y + 262], [R.x + R.w - 140, R.y + 262]], { w: 3, color: P.purple, seed: 11, p: sm(1.6, 2.4, tau), t: tau });
  zh(c, T2, R.x + R.w / 2, R.y + 322, { size: 36, align: 'center', color: P.ink2, p: writeP(tau, 2.2, T2, .08) });
  // 左页：一弯剪纸月牙，慢慢转进来
  const m = sm(.6, 1.6, tau, easeOutBack);
  drawMoonIcon(c, 720, 520, 130 * m, P.moon, -.5 + (1 - m) * 1.2);
  // 两人：标准站位。琪露诺的台词出现后才进场（pop 缩放进来）
  const cirK = sm(S0T(1) - .3, S0T(1), tau, easeOutBack);
  drawPatchouli(c, { ...STD.pch, pose: tau > S0T(2) ? 'lecture' : 'stand', mood: moodOf(L, 'patchouli', 'normal'), mouth: mouthOf(L, 'patchouli'), blink: blinkAt(tau), t: tau });
  pop(c, STD.cir.x, STD.cir.y, cirK, () => drawCirno(c, { ...STD.cir, pose: 'stand', mood: moodOf(L, 'cirno', 'normal'), mouth: mouthOf(L, 'cirno'), blink: blinkAt(tau, 2), t: tau }));
}
scene({ order: 0, key: 'opening', title: '开场', dur: S0DUR, lines: S0LINES, fn: s0Draw });
