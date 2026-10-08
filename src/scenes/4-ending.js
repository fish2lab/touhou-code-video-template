'use strict';
// 最后一段：收尾（演示段）。合书由 film.js 的转场之外自己画：这里只写一行总结 + 帕秋莉收口。
const S3LINES = seq(.9, [
  ['记住一句话：画面是时间的函数，质感来自剪刀和种子。', { hold: .5 }],
  ['下次，你来画。', { mood: 'smile', pause: .3, hold: 1 }],
]);
const S3T = i => S3LINES[i][0], S3E = i => S3LINES[i][1];
const S3DUR = S3E(1) + 1.6;

function s3Draw(c, tau, L) {
  spread(c, tau);
  const R = BOOK.R, s = '画面 = f ( t )';
  zh(c, s, R.x + R.w / 2, R.y + 290, { size: 96, align: 'center', color: P.ink, p: writeP(tau, .4, s, .08) });
  const k = sm(S3T(1), S3T(1) + .5, tau, easeOutBack);
  pop(c, R.x + R.w / 2 - 110, R.y + 380, k, () => drawMoonIcon(c, R.x + R.w / 2 - 110, R.y + 380, 56, P.moon, -.5));
  drawPatchouli(c, { ...STD.pch, pose: 'lecture', mood: moodOf(L, 'patchouli', 'normal'), mouth: mouthOf(L, 'patchouli'), blink: blinkAt(tau), t: tau });
  drawCirno(c, { ...STD.cir, pose: 'stand', mood: 'happy', blink: blinkAt(tau, 2), t: tau });
}
scene({ order: 4, key: 'ending', title: '结尾', dur: S3DUR, lines: S3LINES, fn: s3Draw });
