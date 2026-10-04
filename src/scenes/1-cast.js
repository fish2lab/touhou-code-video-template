'use strict';
// 第 1 段：阵容（演示段）。六位角色同台，统一身高 500，依次登场、轮换表情。
// 要点：每位角色就是一个 drawXxx(c, { x, y, h, pose, mood, ... }) 调用；全员 h 相同，并排才整齐。
//   想换谁出场：改下面的 SCAST 表（名字、画函数、姿势、轮换的表情）。姿势和表情见 src/character/*.js 文件头，样张 character.html。
const SCLINES = seq(.8, [
  ['这是目前的六位角色，身高统一。', { hold: .4 }],
  ['每一位，都是代码剪出来的。', { mood: 'smug', pause: .2, hold: .6 }],
]);
const SCDUR = SCLINES.at(-1)[1] + 4.2;
const SCAST = [
  ['帕秋莉', drawPatchouli, 'lecture', ['normal', 'smug', 'pout', 'smile']],
  ['琪露诺', drawCirno, 'proud', ['normal', 'proud', 'happy', 'confused']],
  ['蕾米莉亚', drawRemilia, 'cross', ['normal', 'smug', 'pout', 'smile']],
  ['红美铃', drawMeiling, 'stand', ['normal', 'smile', 'surprised', 'normal']],
  ['八云蓝', drawRan, 'stand', ['normal', 'happy', 'proud', 'awkward']],
  ['八云紫', drawYukari, 'parasol', ['normal', 'smug', 'smile', 'surprised']],
];
function scDraw(c, tau, L) {
  spread(c, tau);
  SCAST.forEach(([name, fn, pose, moods], i) => {
    const x = 230 + i * 292, y = 800, k = sm(.2 + i * .25, .7 + i * .25, tau, easeOutBack);   // 依次弹出
    const pz = i === 4 && tau > 6 ? 'read' : pose;                                            // 八云蓝中途换成读纸
    const md = i === 0 ? moodOf(L, 'patchouli', moods[0]) : moods[Math.floor(Math.max(0, tau - 2.5 - i * .3) / 1.6) % moods.length];
    pop(c, x, y, k, () => fn(c, { x, y, h: 500, pose: pz, mood: md, blink: blinkAt(tau, i + 1), mouth: i === 0 ? mouthOf(L, 'patchouli') : 0, t: tau }));
    zh(c, name, x, 870, { size: 34, align: 'center', color: P.ink2, al: k });
  });
}
scene({ order: 1, key: 'cast', title: '阵容', dur: SCDUR, lines: SCLINES, fn: scDraw });
