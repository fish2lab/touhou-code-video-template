'use strict';
// 第 1 段：阵容（演示段）。十四位角色分两排同台，同一个 h（头和身子一样大，帽子高低各不同），依次登场、轮换表情。
// 按书页排：左页七位、右页七位，每页上排四位下排三位，人物不跨书脊。前十位（左页七位 + 右页上排前三位）是 2024–2026 年东方人气投票前十
// （名单和出处见 docs/角色名单.md），其余四位来自「帕秋莉讲座」。
// 要点：每位角色就是一个 drawXxx(c, { x, y, h, pose, mood, ... }) 调用；全员 h 相同，并排才整齐。
//   想换谁出场：改下面的 SCAST 表（名字、画函数、姿势、轮换的表情）。姿势和表情见 src/character/*.js 文件头，样张 character.html。
const SCLINES = seq(.8, [
  ['这是目前的十四位角色，身高统一。', { hold: .4 }],
  ['前十位，是近三年东方人气投票的前十名。', { mood: 'smile', pause: .2, hold: .4 }],
  ['每一位，都是代码剪出来的。', { mood: 'smug', pause: .2, hold: .6 }],
]);
const SCDUR = SCLINES.at(-1)[1] + 4.2;
const SCAST = [
  ['博丽灵梦', drawReimu, 'stand', ['normal', 'smug', 'smile', 'annoyed']],
  ['雾雨魔理沙', drawMarisa, 'stand', ['normal', 'grin', 'smile', 'surprised']],
  ['芙兰朵露', drawFlandre, 'stand', ['normal', 'grin', 'smile', 'surprised']],
  ['古明地恋', drawKoishi, 'stand', ['normal', 'smile', 'grin', 'blank']],
  ['魂魄妖梦', drawYoumu, 'stand', ['normal', 'determined', 'smile', 'flustered']],
  ['十六夜咲夜', drawSakuya, 'stand', ['normal', 'smile', 'smug', 'surprised']],
  ['蕾米莉亚', drawRemilia, 'cross', ['normal', 'smug', 'pout', 'smile']],
  ['古明地觉', drawSatori, 'read', ['normal', 'smug', 'smile', 'surprised']],
  ['藤原妹红', drawMokou, 'stand', ['normal', 'grin', 'smile', 'annoyed']],
  ['琪露诺', drawCirno, 'proud', ['normal', 'proud', 'happy', 'confused']],
  ['帕秋莉', drawPatchouli, 'lecture', ['normal', 'smug', 'pout', 'smile']],
  ['红美铃', drawMeiling, 'stand', ['normal', 'smile', 'surprised', 'normal']],
  ['八云紫', drawYukari, 'parasol', ['normal', 'smug', 'smile', 'surprised']],
  ['八云蓝', drawRan, 'stand', ['normal', 'happy', 'proud', 'awkward']],
];
const SC_H = 290, SC_Y = [430, 850];   // 两排的脚底高度（下排名字要在字幕条上面）
// 第 i 位的落脚点：每页七位，上排四位间距 210，下排三位间距 250，都以页面中线对齐
function scSlot(i) {
  const pg = i < 7 ? BOOK.L : BOOK.R, j = i % 7, top = j < 4, mid = pg.x + pg.w / 2;
  return [mid + (top ? (j - 1.5) * 210 : (j - 5) * 250), SC_Y[top ? 0 : 1]];
}
function scDraw(c, tau, L) {
  spread(c, tau);
  SCAST.forEach(([name, fn, pose, moods], i) => {
    const [x, y] = scSlot(i), k = sm(.2 + i * .15, .7 + i * .15, tau, easeOutBack);   // 依次弹出
    const pch = fn === drawPatchouli, pz = fn === drawRan && tau > 7 ? 'read' : pose;                                                   // 八云蓝中途换成读纸
    const md = pch ? moodOf(L, 'patchouli', moods[0]) : moods[Math.floor(Math.max(0, tau - 2.5 - i * .2) / 1.6) % moods.length];
    pop(c, x, y, k, () => fn(c, { x, y, h: SC_H, pose: pz, mood: md, blink: blinkAt(tau, i + 1), mouth: pch ? mouthOf(L, 'patchouli') : 0, t: tau }));
    zh(c, name, x, y + 34, { size: 25, align: 'center', color: P.ink2, al: k });
  });
}
scene({ order: 1, key: 'cast', title: '阵容', dur: SCDUR, lines: SCLINES, fn: scDraw });
