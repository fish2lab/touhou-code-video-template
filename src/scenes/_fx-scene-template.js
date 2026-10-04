'use strict';
// 用现成的亮点特效做一段：复制成 src/scenes/N-名字.js，替换 SX/sx，并在 index.html 里加两类脚本（顺序在 props.js 之后、scenes 之前）：
//   <script src="src/fx/_fx.js"></script>
//   <script src="src/fx/nap-fall.js"></script>        ← 要用哪个特效就加哪个
// 文件名以 _ 开头的不会被载入，这个文件只是模板。可用的特效 id 和效果：docs/亮点.html，样张 fx.html?fx=<id>。
const SXLINES = seq(1.0, [
  ['第一句台词，配合特效开头。', { hold: .4 }],
  ['第二句，琪露诺插话。', { who: 'cirno', mood: 'confused', pause: .2 }],
]);

// 写法一：整段就是这个特效，上面叠自己的东西（两人、气泡、页眉）。dur 默认 = 特效 dur ÷ speed + hold。
fxScene({ id: 'nap-fall', order: 9, key: 'sx', title: '本段标题', lines: SXLINES, hold: 1,
  opt: { speed: 1 },                                   // 同 fxPlay 的 opt：t0 / speed / loop / box / bg / al
  over: (c, tau, L) => { /* 在特效上面画：drawCirno(c, { ...STD.cir, ... }) 等 */ } });

// 写法二：特效只是一个零件，缩进书页右半边，其余自己画（把上面的 fxScene 换成这个）：
//   scene({ order: 9, key: 'sx', title: '本段标题', dur: 12, lines: SXLINES, fn: (c, tau, L) => {
//     spread(c, tau);
//     fxPlay('nap-fall', c, tau, { box: [BOOK.R.x, BOOK.R.y, BOOK.R.w, BOOK.R.h], t0: 1.2, bg: false });
//     drawPatchouli(c, { ...STD.pch, pose: 'lecture', mood: moodOf(L, 'patchouli'), mouth: mouthOf(L, 'patchouli'), t: tau });
//   } });
