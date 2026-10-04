'use strict';
// 第 3 段：剪纸和手绘的抖（演示段）。同一个圆，左边是数学圆，右边是剪刀剪的纸；一根线「抖」是因为种子每秒换 8 次。
// 画具全在 src/kit.js：cutPaper 剪纸、rline 手绘线、zh 手写字、thread 线、popup 立体书、spin 转盘。
const S2LINES = seq(.9, [
  ['画面的质感，来自两件小事。', { hold: .3 }],
  ['第一，剪纸：边不是曲线，是一段一段略带折角的直线，再垫一层软影。', { pause: .2, hold: .5 }],
  ['第二，手绘：线每秒换八次种子，看起来就像在呼吸。', { mood: 'smug', pause: .2, hold: .6 }],
  ['不依赖任何素材，换谁来画都是这个效果。', { who: 'cirno', mood: 'proud', pause: .2, hold: .8 }],
]);
const S2T = i => S2LINES[i][0], S2E = i => S2LINES[i][1];
const S2DUR = S2E(3) + 1.2;

function s2Draw(c, tau, L) {
  spread(c, tau);
  pageHeader(c, '第二页 · 质感', tau, .2);
  const R = BOOK.R, cx = 730, cy = 500;   // 圆放在两人之间的左半边，线放在右半边
  // 左页：数学圆（描边）和剪纸圆（同样大小、叠在旁边）
  const a = sm(S2T(1) - .2, S2T(1) + .6, tau, easeOutBack);
  pop(c, cx - 80, cy, a, () => { c.strokeStyle = P.g2; c.lineWidth = 3; c.setLineDash([10, 8]); c.beginPath(); c.arc(cx - 80, cy, 110, 0, TAU); c.stroke(); c.setLineDash([]); });
  pop(c, cx + 80, cy, a, () => cutPaper(c, circPts(cx + 80, cy, 110, 40), P.hair, { seed: 41, step: 22, blur: 9, sx: 4, sy: 6 }));
  zh(c, '曲线', cx - 80, cy + 190, { size: 32, align: 'center', color: P.ink2, al: a });
  zh(c, '剪纸', cx + 80, cy + 190, { size: 32, align: 'center', color: P.ink2, al: a });
  // 右页：同一根线，上面静止，下面按 t 抖
  const x0 = 1030, x1 = 1400, pts = [[x0, 0], [lerp(x0, x1, .3), -26], [lerp(x0, x1, .6), 22], [x1, -10]], p = sm(S2T(2), S2T(2) + 1.2, tau);
  rline(c, pts.map(([x, y]) => [x, R.y + 420 + y]), { w: 6, color: P.ink, seed: 51, smooth: true, p });
  rline(c, pts.map(([x, y]) => [x, R.y + 580 + y]), { w: 6, color: P.purple, seed: 51, smooth: true, p, t: tau, amp: 2.2 });
  zh(c, '固定种子', x0, R.y + 370, { size: 30, color: P.ink2, al: p });
  zh(c, '每秒换 8 次', x0, R.y + 530, { size: 30, color: P.purple, al: p });
  drawPatchouli(c, { ...STD.pch, pose: tau > S2T(1) ? 'lecture' : 'stand', mood: moodOf(L, 'patchouli', 'normal'), mouth: mouthOf(L, 'patchouli'), blink: blinkAt(tau), t: tau });
  drawCirno(c, { ...STD.cir, pose: tau > S2T(3) ? 'proud' : 'stand', mood: moodOf(L, 'cirno', 'normal'), mouth: mouthOf(L, 'cirno'), blink: blinkAt(tau, 2), t: tau });
}
scene({ order: 3, key: 'paper', title: '质感', dur: S2DUR, lines: S2LINES, fn: s2Draw });
