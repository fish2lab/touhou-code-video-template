'use strict';
// 第 2 段：画面是时间的纯函数（演示段）。一弯月牙沿着时间轴走，位置只由 tau 决定。
// 要点：不存状态、不用 Math.random()——想要「随机」用带种子的 hash/rng。这样才能随便跳到第 N 秒，也才能并行出片。
const S1LINES = seq(.9, [
  ['这里的秘诀只有一条：每一帧，只由当前时间决定。', { hold: .5 }],
  ['那直接录屏不行吗？', { who: 'cirno', mood: 'confused', pause: .2 }],
  ['录屏一卡就掉帧。我们把时钟拨到第几帧，截一张图，再拨下一帧。', { mood: 'smug', pause: .2, hold: .5 }],
  ['所以机器再慢，成片也是稳的。', { pause: .2, hold: .8 }],
]);
const S1T = i => S1LINES[i][0], S1E = i => S1LINES[i][1];
const S1DUR = S1E(3) + 1.2;

function s1Draw(c, tau, L) {
  spread(c, tau);
  pageHeader(c, '第一页 · 时间', tau, .2);
  const R = BOOK.R, x0 = 540, x1 = 1400, y = 640;   // 两人之间的空地：x 520–1410
  // 时间轴：一根墨线 + 刻度，从左往右画出
  rline(c, [[x0, y], [x1, y]], { w: 4, color: P.ink, seed: 21, p: sm(.5, 1.4, tau), t: tau });
  for (let k = 0; k <= 5; k++) { const x = lerp(x0, x1, k / 5); rline(c, [[x, y - 14], [x, y + 14]], { w: 3, color: P.ink2, seed: 30 + k, p: sm(.8 + k * .1, 1.2 + k * .1, tau) }); }
  // 月牙：位置 = key(tau, 关键帧)。tau 只有一个来源，拖到哪儿就是哪儿
  const u = key(tau, [[1.2, 0], [S1T(2), 0], [S1T(2) + 3.5, 1], [S1DUR, 1]], easeIO), mx = lerp(x0, x1, u);
  pop(c, mx, y - 62, sm(1.2, 1.7, tau, easeOutBack), () => drawMoonIcon(c, mx, y - 62, 44, P.moon, -.5 + u * 3));
  zh(c, `t = ${tau.toFixed(1)} s`, mx, y + 66, { size: 34, align: 'center', color: P.purple, al: sm(1.4, 1.9, tau) });
  // 右页：一行大字
  const f = '画面 = f ( t )';
  zh(c, f, R.x + R.w / 2, R.y + 270, { size: 92, align: 'center', color: P.ink, p: writeP(tau, S1T(0) + .4, f, .1) });
  zh(c, '同一个 t，永远是同一张画', R.x + R.w / 2, R.y + 335, { size: 38, align: 'center', color: P.ink2, p: writeP(tau, S1T(0) + 1.6, '同一个 t，永远是同一张画', .07) });
  // 两人
  drawPatchouli(c, { ...STD.pch, pose: tau > S1T(2) ? 'point' : 'lecture', mood: moodOf(L, 'patchouli', 'normal'), mouth: mouthOf(L, 'patchouli'), blink: blinkAt(tau), t: tau });
  drawCirno(c, { ...STD.cir, pose: tau > S1T(1) && tau < S1T(2) ? 'think' : 'stand', mood: moodOf(L, 'cirno', 'normal'), mouth: mouthOf(L, 'cirno'), blink: blinkAt(tau, 2), t: tau });
}
scene({ order: 2, key: 'time', title: '时间', dur: S1DUR, lines: S1LINES, fn: s1Draw });
