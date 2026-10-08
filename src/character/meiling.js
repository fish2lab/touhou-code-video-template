'use strict';
// 红美铃 —— 剪纸人偶的部件表（红魔馆的门卫，第 4 集小睡一段出场）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
// 第三版：Q 版比例（约 2.4 头身）、分层眼睛、包住头的帽子，规格见 docs/rig.md「统一比例」，样板是帕秋莉。
//
// drawMeiling(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y] }
//   x, y     脚底中心（startle 跳起来时脚离地，x, y 仍是站立时的脚底）
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，帽顶高度各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像；帽徽上的「龙」字不跟着反）
//   pose     stand 站岗：双手背在身后 | doze 站着打盹：抱臂、头垂下、身子随呼吸轻晃（t 驱动）
//            startle 惊醒：gesture 0..1 是惊醒的进度（0 还在打盹 → .15 下蹲预备 → .15–.55 跳起、两手乱摆 → .55–.7 落地缓冲 → .8 以后两手在胸前直摆「没睡没睡」）
//            kungfu 起手式：马步，前手立掌、后手护胸（gesture 前掌推出多少）
//            旧名兼容：guard→stand、sleep/nap→doze、wake→startle、fight→kungfu，其余→stand
//   mood     normal 睁眼、温和的笑（默认）| sleepy 闭眼 + 随呼吸胀缩的鼻涕泡（t 驱动）| flustered 脸红冒汗、眼睛打转
//            smile 眯眼笑、张嘴 | surprised 眼睛睁圆、嘴 o
//            旧名兼容：happy/proud/smug→smile、panic/pout/cry/annoyed→flustered、tired/sad→sleepy、confused→surprised、calm/angry→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   不传 gesture 时 gesture 在 .75..1 之间缓慢起伏（startle 就停在「没睡没睡」那一段，kungfu 前掌轻轻推收）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手（朝 facing 那只）
//
// 设计坐标（设计高 520）：脚底 (0,0)，y 向下；髋 -128、腰 -170、肩 ±33 / -234、脖子 -248。
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），整体乘 MEI_HEAD = 1.2，和帕秋莉的头一样大。
// 腿分大腿、小腿、脚三节（马步、跳起要弯膝），身体按腿弯的程度自动下沉，脚始终踩在 y=0。
// 本文件顶层名字都带 mei 前缀。

// ===================== 颜色（压暗、低饱和，和帕秋莉、蕾米莉亚同一个明度带） =====================
const MEI_K = (() => {
  const hair = '#a9584f', hairBack = '#82443f', green = '#5d8467', eye = '#4f6b8c', trim = '#e6dcc4';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress: green, dressBack: mix(green, P.ink, .3), fold: mix(green, P.ink, .22), trim,
    hat: mix(green, '#ffffff', .1), hatShade: mix(green, P.ink, .12), hatPleat: mix(green, P.ink, .3), hatBand: mix(green, P.ink, .28),
    star: P.gold, starInk: mix(P.ribbonRed, P.ink, .45),
    pants: '#efe9e2', pantsFold: mix('#efe9e2', '#8f887e', .4), shoe: '#2f2a31', bow: '#2b2630',
    skin: P.skin, blush: P.blush,
    // 分层眼睛（第三版）：虹膜蓝灰，眼线深棕
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#b4d2e6', .55), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: mix('#3a2a2c', P.ink, .6), lash: mix('#3a2a2c', P.ink, .5), brow: mix(hairBack, P.ink, .4),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    sweat: mix(P.ribbonBlue, P.cap, .62), bubble: '#b9d6e2', white: '#f7f3ee',
  };
})();
const MEI_CUT = rigCutter(4000);
// 骨架（第三版 Q 版）：脖子 -248，短腿（髋 -128 = 大腿 58 + 小腿 54 + 脚 16），头部件乘 1.2
const MEI_NECK = -248, MEI_WAIST = -170, MEI_HIP = -128, MEI_HIPX = 13, MEI_L1 = 58, MEI_L2 = 54, MEI_FOOT = 16, MEI_HEAD = 1.2;
// 帽檐：绕头一圈的布带，戴得往后仰，正面看是一道拱（头坐标，前沿 -142，两端 ±82 处低到 -114）
const meiBand = x => -142 + 28 * (x / 82) ** 2;

// ===================== 部件（载入时剪好） =====================
const MEI_G = (() => {
  const cut = MEI_CUT, g = {};
  // ---- 腿：白色阔腿裤（大腿：髋为原点；小腿：膝为原点；都朝 +y），黑色圆头布鞋（踝为原点，鞋底 y=16） ----
  const thighR = [[-11, -8], [12, -8], [15, 12], [15.5, 34], [13.5, 58], [-8.5, 58], [-11, 36], [-12, 14]];
  g.thighR = cut(thighR, 1, 8, .4); g.thighL = cut(rMirror(thighR), 2, 8, .4);
  const shinR = [[-9, -4], [12.5, -4], [13.5, 18], [12, 40], [10.5, 50], [-7.5, 50], [-8.5, 40], [-10, 18]];
  g.shinR = cut(shinR, 3, 8, .4); g.shinL = cut(rMirror(shinR), 4, 8, .4);
  g.kneeR = cut(ellPts(2, 1, 12, 11.5, 16), 11, 5, .3); g.kneeL = cut(ellPts(-2, 1, 12, 11.5, 16), 12, 5, .3);   // 膝盖：弯膝时把大腿、小腿接上
  const ankR = [[-7.5, 44], [10.5, 44], [11, 51], [-8, 51]];
  g.ankleR = cut(ankR, 5, 5, .2, false); g.ankleL = cut(rMirror(ankR), 6, 5, .2, false);
  const pfR = [[3, 6], [5, 6], [8, 54], [5.5, 54]];
  g.pantFoldR = cut(pfR, 7, 12, .3, false); g.pantFoldL = cut(rMirror(pfR), 8, 12, .3, false);
  g.shoeR = cut(ellPts(4, 7.5, 16.5, 9, 18), 9, 5, .35); g.shoeL = cut(ellPts(-4, 7.5, 16.5, 9, 18), 10, 5, .35);
  // ---- 绿色中式长裙（腰 y=-170）：后片宽、垂到小腿上；前片窄，两侧开衩露出白裤 ----
  g.skirtBack = cut([[-24, -174], [24, -174], [31, -150], [40, -112], [49, -72], [56, -40], [30, -35], [0, -33], [-30, -35], [-56, -40], [-49, -72], [-40, -112], [-31, -150]], 20, 10, .8);
  g.skirtFront = cut([[-24, -174], [24, -174], [22.5, -150], [21, -110], [22, -64], [23.5, -38], [0, -34], [-23.5, -38], [-22, -64], [-21, -110], [-22.5, -150]], 21, 10, .6);
  g.frontFold = cut([[-.8, -160], [.8, -160], [1.3, -40], [-1.3, -40]], 22, 14, .3, false);
  g.hemTrim = cut(rStroke(rOpen([[-23, -41], [0, -37], [23, -41]], 4), 3.4), 23, 6, .2, false);
  g.slitTrim = [1, -1].map((sd, i) => cut(rStroke([[sd * 22, -150], [sd * 21, -110], [sd * 22, -64], [sd * 23.2, -41]], 2.2), 24 + i, 10, .2, false));
  g.sash = cut([[-25, -176], [25, -176], [26, -166], [0, -164], [-26, -166]], 26, 6, .3, false);
  // ---- 上身：立领、斜襟（一道浅色滚边 + 两颗盘扣）、袖子（泡泡袖 + 浅色袖口） ----
  g.bodice = cut([[-13, -253], [13, -253], [25, -246], [32, -234], [31, -206], [27, -170], [-27, -170], [-31, -206], [-32, -234], [-25, -246]], 30, 8, .5);
  g.neck = cut([[-6, -262], [6, -262], [6.5, -244], [-6.5, -244]], 31, 8, .3, false);
  g.collar = cut([[-11.5, -253], [11.5, -253], [12.5, -240], [0, -237], [-12.5, -240]], 32, 4, .2, false);
  g.collarTrim = cut(rStroke([[-11.2, -251.6], [0, -252.2], [11.2, -251.6]], 2.4), 33, 5, .1, false);
  g.placket = cut(rStroke(rOpen([[1, -238], [9, -236], [17, -231], [24, -223], [29, -213]], 3), 2.6), 34, 5, .15, false);
  g.frogs = [[11, -235.5], [21, -226.5]].map(([x, y], i) => cut(rStroke([[x - 4, y], [x + 4, y]], 2.6), 35 + i, 3, .1, false));
  // 手臂（肩为原点，朝 +y）：上臂 40、前臂 38，手再出来约 16
  g.armU = cut([[-5.4, 6], [5.4, 6], [5.6, 22], [5, 38], [0, 41.5], [-5, 38], [-5.6, 22]], 40, 8, .3);
  g.fore = cut([[-5, -3], [0, -5], [5, -3], [4.7, 18], [4.2, 39], [-4.2, 39], [-4.7, 18]], 41, 8, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.2, y * 1.15]), 42, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.2, y * 1.15 + .4]), 43, 5, .3, false);
  const H = RIG_SHAPES.hand, k = 1.3, sc = pts => pts.map(([x, y]) => [x * k, y * k]);
  g.handOpen = cut(sc(H.open), 44, 3, .2, false); g.handFist = cut(ellPts(0, 7.4, 7.6, 8.6, 14), 45, 3, .25);
  g.handPoint = cut(sc(H.point), 46, 3, .2, false); g.handGrip = cut(sc(H.grip), 47, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150；和帕秋莉同一张圆脸） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 70, 7, .5);
  // 后发（跟头走）：盖住后脑，两侧垂到下巴下面，往下接长发
  const bSide = rOpen([[60, -160], [71, -128], [75, -80], [75, -30], [74, 20]], 5);
  g.backHair = cut([...bSide, [40, 30], [0, 28], [-40, 30], ...rMirror(bSide), [-36, -176], [0, -180], [36, -176]], 71, 9, .7, false);
  // 长直发（挂在脖子上的一根骨头，带惯性，也乘 1.2）：垂到腰下，发梢剪成几道尖
  const mSide = rOpen([[0, -150], [60, -136], [76, -96], [80, -30], [81, 40], [79, 96]], 5);
  const mTips = [[78, 122], [66, 108], [60, 128], [46, 112], [34, 130], [18, 114], [0, 128]];
  g.mane = cut([...mSide, ...mTips, ...rMirror([...mSide, ...mTips.slice(0, -1)])], 72, 10, .8, false);
  g.maneLines = [[-48, 20, -54, 108], [-20, 30, -22, 116], [22, 26, 24, 112], [50, 16, 56, 104]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1, y0], [x1 - 1.4, y1], [x1 + 1.4, y1], [x0 + 1, y0]], 73 + i, 12, .2, false));
  // 鬓发：从帽檐下沿着脸颊垂到下巴，盖住辫根
  const lockR = [...rOpen([[52, -132], [66, -118], [73, -86], [75, -48], [74, -14]], 4), [73, -2], [67, -10], [63, 2], [59, -12], ...rOpen([[58, -34], [58, -70], [55, -104], [46, -126]], 4)];
  g.lockR = cut(lockR, 77, 6, .5, false); g.lockL = cut(rMirror(lockR), 78, 6, .5, false);
  // 细辫子（辫根为原点，朝 +y 垂下）：一节一节的锯齿 + 斜纹，辫梢在胸口高度系黑色小蝴蝶结，下面再垂一撮发尾
  const bl = [], br = []; for (let i = 0; i <= 9; i++) { const y = i * 8.4, w = 4.6 - i * .08; bl.push([-w - (i % 2) * 1.6, y]); br.unshift([w + ((i + 1) % 2) * 1.6, y]); }
  g.braid = cut([...bl, [0, 80], ...br], 80, 4, .25, false);
  g.braidLines = Array.from({ length: 9 }, (_, i) => cut([[-3.8, i * 8.4 + 3], [3.8, i * 8.4 + 7.4], [3.8, i * 8.4 + 9], [-3.8, i * 8.4 + 4.6]], 81 + i, 4, .1, false));
  g.tuft = cut([[-4.2, 76], [4.2, 76], [6, 88], [8, 100], [3, 94], [0, 106], [-3, 94], [-8, 100], [-6, 88]], 93, 3, .2, false);
  g.bow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * .95, y * .85 + 78]), 94, 3, .2, false);
  // 刘海：厚的齐刘海，正中分开一道缝，下缘几簇尖压到眼睛上沿
  g.bangs = cut([[-68, -156], [68, -156], [67, -108], [64, -80], [57, -96], [50, -74], [41, -92], [32, -77], [22, -94], [12, -80], [5, -100], [0, -110], [-5, -100], [-12, -80], [-22, -94], [-32, -77], [-41, -92], [-50, -74], [-57, -96], [-64, -80], [-67, -108]], 95, 6, .5, false);
  g.bangLines = [[32, -77, 33, -126], [-32, -77, -33, -124], [12, -80, 9, -128], [-12, -80, -9, -128], [50, -74, 55, -116], [-50, -74, -55, -114]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 96 + i, 8, .2, false));
  // 帽子（第三版，按美术意见）：绿色软帽罩住整个头顶、盖住头发顶部，两侧顺着头包到太阳穴；帽檐是绕头一圈的深色布带，
  // 正面看是一道拱（往后仰戴：前沿高、两端低）；帽顶的布被帽檐束住，帽顶下沿贴着这道拱收进去；褶子从帽檐往上散。
  const domeTop = [[84, -114], [93, -140], [92, -170], [77, -196], [48, -213], [6, -219], [-38, -215], [-72, -199], [-91, -172], [-94, -140], [-85, -114]];
  const domeBot = []; for (let i = 0; i <= 16; i++) { const x = -82 + i / 16 * 164; domeBot.push([x, meiBand(x) - 3]); }
  g.crown = cut([...domeTop, ...domeBot], 100, 9, .7);
  g.crownClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.crownLight = polyPath(ellPts(-16, -194, 92, 66, 40), true);   // 帽顶亮面：留出右下一圈暗面，看得出是鼓起来的布团
  g.pleats = [-58, -30, 0, 30, 58].map((x, i) => { const y0 = meiBand(x) - 6, x1 = x * 1.3, y1 = y0 - 38 + Math.abs(x) * .1, xm = lerp(x, x1, .5) + x * .04, ym = lerp(y0, y1, .5);
    return cut([[x - 1.8, y0], [xm - 1, ym], [x1, y1], [xm + 1, ym], [x + 1.8, y0]], 101 + i, 9, .25, false); });
  const bandTop = [], bandBot = [];
  for (let i = 0; i <= 20; i++) { const x = lerp(-84, 84, i / 20); bandTop.push([x, meiBand(x) - 6.5]); bandBot.unshift([x, meiBand(x) + 6.5]); }
  g.hatBand = cut([...bandTop, ...bandBot], 106, 6, .3, false);
  g.star = cut(starPts(0, 0, 17, 5, .5), 104, 3, .15, false);
  // 表情道具：汗滴、鼻涕泡（半径 10，按骨头缩放）+ 高光
  g.sweat = cut(RIG_SHAPES.sweat.map(([x, y]) => [x * 1.3, y * 1.3]), 110, 3, .2);
  g.bubble = cut(circPts(0, 0, 10, 24), 111, 3, .15);
  g.bubbleHi = cut(ellPts(-3.6, -3.8, 2.6, 1.8, 10, -.6), 112, 2, .05);
  return g;
})();

// ===================== 表情 =====================
// lid 上眼睑压下的比例、lidTilt 眼睑外端下垂、es 眼睛大小、iris 虹膜大小、lower 下眼睑上推（笑眼）；
// eye: 'closed' 闭眼、'up' 笑眼弧线；spin 眼睛打转（在分层眼睛上压一层眼白和螺旋，见 meiSpin）；bubble 鼻涕泡、sweat 汗
// 美铃的眼神：友善、眼睑放松（lid 小、外端微垂），不像帕秋莉那样半眯
const MEI_MOODS = {
  normal: { eye: 'open', lid: .14, lidTilt: .05, es: 1, brow: [1, -.04], mouth: 'soft', blush: 1, lower: 1.5 },
  sleepy: { eye: 'closed', brow: [-1, -.14], mouth: 'snore', blush: 1.15, bubble: true },
  flustered: { eye: 'open', lid: 0, es: 1.06, iris: .5, spin: true, brow: [5, -.32], mouth: 'wobble', blush: 1.75, sweat: true },
  smile: { eye: 'up', brow: [3, -.1], mouth: 'smile', blush: 1.3, chin: -.06 },
  surprised: { eye: 'open', lid: 0, es: 1.12, iris: .62, brow: [7, -.12], mouth: 'o', blush: 1 },
};
const MEI_MOOD_ALIAS = { happy: 'smile', proud: 'smile', smug: 'smile', panic: 'flustered', pout: 'flustered', cry: 'flustered', annoyed: 'flustered', tired: 'sleepy', sad: 'sleepy', confused: 'surprised', calm: 'normal', angry: 'normal' };
const MEI_POSE_ALIAS = { guard: 'stand', sleep: 'doze', nap: 'doze', wake: 'startle', fight: 'kungfu', lecture: 'stand', point: 'stand', cross: 'stand', walk: 'stand', run: 'stand', sit: 'stand', lie: 'stand' };
// 嘴：借两位的嘴型（大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的，帕秋莉的放大 1.3 和她脸上一样大）；soft 温和的小笑、snore 睡着时微张的小圆嘴
const MEI_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const meiScale = (pts, k) => pts && pts.map(([x, y]) => [x * k, y * k]);
function meiMouthPts(type, open) {
  if (type === 'snore') return [ellPts(0, 2, 3 + open * 2.5, 3.6 + open * 5, 12), 'mouthIn'];
  if (type === 'soft') { const [p, c] = pchMouthPts('smile', open); return [meiScale(p, 1.3), c]; }
  if (MEI_CIR_MOUTHS.has(type)) { const [p, c, tg] = cirMouthPts(type, open); return [meiScale(p, 1.1), c, meiScale(tg, 1.1)]; }
  const [p, c] = pchMouthPts(type, open); return [meiScale(p, 1.3), c];
}
// 眼睛打转（mood.spin）：分层眼睛画完后，在眼睛中下部压一片眼白盖住虹膜，再压一圈打转的螺旋；粗上眼线留在上面不被盖
function meiSpin(k) {
  const { S, turn, B, tt } = k, F = S.face, items = [], spirals = [], head = B.faceM, es = k.md.es || 1;
  const sp = rigMemo(S, 'spiral', () => { const pts = []; for (let i = 0; i <= 44; i++) { const u = i / 44, a = u * TAU * 2.4, r = .9 + u * 10.4; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return S.cut(rStroke(pts, u => 1.7 + 1.1 * u), 90, 2, .06, false); });
  for (const sd of [-1, 1]) {
    const near = sd * turn > 0, far = near ? 1 - Math.abs(turn) * F.far : 1, ex = sd * F.ex * (near ? 1 - Math.abs(turn) * .15 : 1) + turn * F.turnX, ey = F.ey;
    const rx = F.rx * far * es, ry = F.ry * es;
    items.push({ p: rigMemo(S, ['sw', sd, rQ(turn)].join('|'), () => polyPath(ellPts(ex, ey + ry * .14, rx * .93, ry * .74, 20), true)), m: head, col: S.K.sclera, edge: false });
    spirals.push({ p: sp, m: rTR(head, ex, ey + ry * .14, sd * tt * 7, far ** .5, 1), col: S.K.lid, edge: false });
  }
  k.paint(items, null, false, 1, true); k.paint(spirals, null, false, 1, true);
}

// ===================== 姿势 =====================
// 手臂 [a 上臂从下垂往 +x 摆的角, b 前臂相对上臂再摆的角, 手型, 标记, 上臂拉长, 前臂拉长]：标记 behind 背在身后 | late 画在头发、帽子外面 | 其他在身前
// spread 大腿往外张（弧度）、knee 小腿收回（弧度）、jump 离地高度、doze 打盹（晃得大、呼吸深）、nod 五官下移（低头）、sink 头往下沉、kick 辫子往外甩
const meiSeg = (g, a, b) => clamp((g - a) / (b - a), 0, 1);
const meiEase = u => u * u * (3 - 2 * u);
const meiMix = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), u < .5 ? A[2] : B[2], u < .5 ? A[3] : B[3], lerp(A[4] ?? 1, B[4] ?? 1, u), lerp(A[5] ?? 1, B[5] ?? 1, u)];
// 抱臂：两只前臂横在胸前，拳头收在对侧上臂前
const MEI_CROSS = { back: [-.12, 2.2, 'fist', false, 1, 1.05], front: [.12, -2.2, 'fist', false, 1, 1.05] };
function meiPose(pose, g, tt) {
  const br = Math.sin(tt * TAU / 3.6);
  switch (pose) {
    case 'doze': return { ...MEI_CROSS, doze: true, hr: .15 + .045 * br, nod: 1, sink: 4 + 1.5 * br, turn: .05, look: 0, kick: 0 };
    case 'startle': {
      const u1 = meiEase(meiSeg(g, .08, .22)), u2 = meiEase(meiSeg(g, .62, .82)), ph = g * TAU * 2.4;
      const flailF = [2 + .35 * Math.sin(ph), .25 + .45 * Math.sin(ph + 1.3), 'open', 'late', 1, 1], flailB = [-(1.9 + .35 * Math.sin(ph + 2.1)), -(.25 + .45 * Math.sin(ph + .4)), 'open', 'late', 1, 1];   // 两手往斜上方乱摆，不挡脸
      const w = Math.sin(tt * 9), waveF = [.55, 2.45 + .3 * w, 'open', 'late', 1, 1], waveB = [-.55, -2.45 + .3 * Math.sin(tt * 9 + 1.4), 'open', 'late', 1, 1];
      const air = Math.sin(Math.PI * meiSeg(g, .15, .55)), pre = Math.sin(Math.PI * meiSeg(g, 0, .17)), land = Math.sin(Math.PI * meiSeg(g, .53, .72));
      const wake = meiEase(meiSeg(g, .1, .24));
      return {
        back: meiMix(meiMix(MEI_CROSS.back, flailB, u1), waveB, u2), front: meiMix(meiMix(MEI_CROSS.front, flailF, u1), waveF, u2),
        jump: 34 * air, spread: .1 * pre + .06 * air + .14 * land, knee: .24 * pre + .4 * air + .32 * land,
        hr: lerp(.15, -.1, wake) + .1 * u2 + .03 * Math.sin(tt * 9) * u2, nod: 1 - wake, sink: 4 * (1 - wake), turn: lerp(.05, .2, u2), look: lerp(0, .5, u2) * Math.sin(tt * 3),
        lean: -.04 * air + .03 * land, kick: .45 * air + .15 * land,
      };
    }
    case 'kungfu': return { back: [-.6, 2.5, 'open', false], front: [lerp(1.25, 1.5, g), lerp(1.2, .9, g), 'open', false], spread: .62, knee: .72, hr: -.04, turn: .32, look: .7, lean: .025 };
    default: return { back: [-.22, 1.45, 'open', 'behind'], front: [.22, -1.45, 'open', 'behind'], hr: -.02, turn: .12, look: .15 };
  }
}

// ===================== 部件表 =====================
// 手臂：背在身后的那只，前臂和手先于身体画（被裙子、上衣挡住），上臂和袖子照常画在身前
const meiFore = (k, A) => A.flag === 'behind' ? null : k.G.fore, meiHand = (k, A) => A.flag === 'behind' ? null : k.G[k.S.arm.hands[A.hand]];
const meiArms = f => [
  { arms: f, order: 'arm', items: [['armU', 'uD', 'skin'], [meiFore, 'lD', 'skin'], [meiHand, 'hm', 'skin']], sh: 'mid' },
  { arms: f, items: [['puff', 'u', 'dress']], sh: 'mid' },
  { arms: f, items: [['cuff', 'u', 'trim']], gr: false },
];
// 帽顶亮面：帽顶整片先涂暗面色，再在帽顶轮廓里填一块亮面，右下留一圈暗面
function meiHatLight(k) {
  const m = k.B.hat, c = k.c, L = k.env.L;
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.crownClip); c.fillStyle = L ? rigTone(k.K.hat, L).lit : k.K.hat; c.fill(k.G.crownLight); c.restore();
}
// 帽徽上的「龙」字（朝左时把镜像抵消掉，字不反）
function meiRyu(k) {
  const m = rTR(k.B.star, 0, 0, 0, k.facing, 1), c = k.c;
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); zh(c, '龙', 0, 6, { size: 17, align: 'center', color: k.K.starInk, touch: 'meiling', qcRule: 'decor' }); c.restore();
}
const MEI_RIG = {
  name: 'meiling', h: 500, height: 520, K: MEI_K, G: MEI_G, cut: MEI_CUT,
  moods: MEI_MOODS, moodAlias: MEI_MOOD_ALIAS, poseAlias: MEI_POSE_ALIAS, pose: meiPose, mouth: meiMouthPts,
  idleGesture: tt => .875 + .125 * Math.sin(tt * 1.2),
  headSway: [.012, .9, 1],
  // 五官按头坐标（再乘 MEI_HEAD 1.2）：眼睛 (±28,-54) rx 13 ry 16，落到全身坐标正好是规格的 (±34,-313)、15.6 × 19.2
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 98, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: [33, -234], upper: 40, fore: 38, mirrorHand: true, tips: { open: [0, 17], fist: [0, 8.5], point: [0, 28.6], grip: [0, 9] },
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；打盹时整个人随呼吸前后摇（绕脚底摆）、呼吸更深
  vars(k) {
    const { ps, tt } = k, doze = !!ps.doze;
    k.br = Math.sin(tt * TAU / (doze ? 3.6 : 3.2));
    k.sway = (doze ? .02 * k.br + .006 * Math.sin(tt * .7) : .006 * Math.sin(tt * 1.1)) + .003 * Math.sin(tt * 2.5);
    k.breath = (doze ? 1.8 : 1.1) * k.br;
    k.lean = ps.lean || 0;
    k.th = ps.spread || 0; k.kn = ps.knee || 0;
    k.drop = -MEI_HIP - (MEI_L1 * Math.cos(k.th) + MEI_L2 * Math.cos(k.th - k.kn) + MEI_FOOT) - (ps.jump || 0);
    k.ugL = rTR(rPivot(R_I, 0, MEI_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'hips', parent: 'root', at: k => [0, k.drop] },
    { name: 'thigh', sides: true, parent: 'hips', at: (k, sd) => [sd * MEI_HIPX, MEI_HIP], rot: (k, sd) => -sd * k.th },
    { name: 'shin', sides: true, parent: (k, sd) => sd < 0 ? 'thighL' : 'thighR', at: [0, MEI_L1], rot: (k, sd) => sd * k.kn },
    { name: 'foot', sides: true, parent: (k, sd) => sd < 0 ? 'shinL' : 'shinR', at: [0, MEI_L2], rot: (k, sd) => sd * (k.th - k.kn) },
    { name: 'ug', parent: 'hips', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, MEI_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [MEI_HEAD, MEI_HEAD] },
    { name: 'mane', parent: 'ug', at: k => [0, MEI_NECK + (k.ps.sink || 0)], rot: k => k.hr * .3, scale: [MEI_HEAD, MEI_HEAD], sway: [.01, 1.1, .5], spring: { len: 150, gain: .5, f: 1.5, max: .15 } },
    { name: 'skirt', parent: 'hips', pivot: [0, MEI_WAIST], rot: k => k.lean * .5, spring: { len: 130, gain: .35, f: 1.6, max: .1 } },
    { arms: true },
    { name: 'faceM', parent: 'head', at: k => [0, (k.ps.nod || 0) * 5.5] },
    { name: 'browM', parent: 'head', at: k => [0, (k.ps.nod || 0) * 3] },
    { name: 'braid', sides: true, parent: 'head', at: (k, sd) => [sd * 66, -26], rot: (k, sd) => -k.hr * .8 - sd * (k.ps.kick || 0) + sd * .04, sway: (k, sd) => [.03, 1.4, sd], spring: { len: 90, gain: .8, f: 2, max: .45 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -118], rot: (k, sd) => -k.hr * .5 - sd * (k.ps.kick || 0) * .25, sway: (k, sd) => [.012, 1.5, sd], spring: { len: 110, gain: .6, f: 2.2, max: .25 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'hat', parent: 'head', pivot: [0, -140], at: k => [k.turn * 4, 0], rot: k => .01 * Math.sin(k.tt * 1.2 + .5) },
    { name: 'star', parent: 'hat', at: k => [k.turn * 10, -172], scale: k => [1 - Math.abs(k.turn) * .15, 1] },
    { name: 'bubble', when: k => k.md.bubble, parent: 'faceM', m: k => { const r = 4 + 10 * (.5 - .5 * k.br); return rTR(k.B.faceM, 6 + k.turn * 13 + r * .85, -30 + r * .2, 0, r / 10, r / 10); } },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [70, -112 + 3 * ((k.tt * 2) % 1)], rot: .15 },
    { name: 'sweat2', when: k => k.md.sweat, parent: 'head', at: k => [-74, -92 + 3 * ((k.tt * 2 + .5) % 1)], rot: -.2, scale: [.8, .8] },
  ],
  layers: [
    // 长发、后发、背在身后的手
    { items: [['mane', 'mane', 'hairBack']], sh: 'big' },
    { items: [['maneLines', 'mane', 'hairLine', false]], gr: false },
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    { arms: A => A.flag === 'behind', order: 'arm', items: [['fore', 'lD', 'skin'], ['@hand', 'hm', 'skin']], sh: 'mid' },
    // 裙子后片、裤腿、鞋
    { items: [['skirtBack', 'skirt', 'dressBack']], sh: 'big' },
    { items: [['shinL', 'shinL', 'pants'], ['shinR', 'shinR', 'pants']], sh: 'mid' },
    { items: [['ankleL', 'shinL', 'pantsFold', false], ['ankleR', 'shinR', 'pantsFold', false]], gr: false },
    { items: [['shoeL', 'footL', 'shoe'], ['shoeR', 'footR', 'shoe']], sh: 'tiny', gr: false },
    { when: k => k.kn > .05, items: [['kneeL', 'shinL', 'pants'], ['kneeR', 'shinR', 'pants']], gr: false },
    { items: [['thighL', 'thighL', 'pants'], ['thighR', 'thighR', 'pants']], sh: 'mid' },
    { items: [['pantFoldL', 'thighL', 'pantsFold', false], ['pantFoldR', 'thighR', 'pantsFold', false]], gr: false },
    // 裙子前片、上身
    { items: [['skirtFront', 'skirt', 'dress']], sh: 'big' },
    { items: [['frontFold', 'skirt', 'fold', false], ['hemTrim', 'skirt', 'trim', false], ['slitTrim', 'skirt', 'trim', false]], gr: false },
    { items: [['neck', 'ug', 'skin', false], ['bodice', 'ug', 'dress']], sh: 'mid' },
    { items: [['sash', 'ug', 'fold', false], ['placket', 'ug', 'trim', false], ['frogs', 'ug', 'trim', false]], gr: false },
    { items: [['collar', 'ug', 'dress']], sh: 'tiny' },
    { items: [['collarTrim', 'ug', 'trim', false]], gr: false },
    ...meiArms(A => !A.flag || A.flag === 'behind'),
    // 脸、辫子、前发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { when: k => k.md.spin, call: meiSpin },
    { items: [['braid', 'braidL', 'hair'], ['braid', 'braidR', 'hair'], ['tuft', 'braidL', 'hair'], ['tuft', 'braidR', 'hair']], sh: 'mid' },
    { items: [['braidLines', 'braidL', 'hairLine', false], ['braidLines', 'braidR', 'hairLine', false]], gr: false },
    { items: [['bow', 'braidL', 'bow'], ['bow', 'braidR', 'bow']], sh: 'tiny', gr: false },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 帽子：帽顶（暗面整片 + 亮面）→ 褶子 → 帽檐布带 → 星徽、「龙」
    { items: [['crown', 'hat', 'hatShade']], sh: 'big' },
    { call: meiHatLight },
    { items: [['pleats', 'hat', 'hatPleat', false]], gr: false },
    { items: [['hatBand', 'hat', 'hatBand']], sh: 'mid' },
    { items: [['star', 'star', 'star']], sh: 'tiny' },
    { call: meiRyu },
    ...meiArms(A => A.flag === 'late'),
    // 表情道具
    { when: k => k.md.bubble, items: [['bubble', 'bubble', 'bubble']], sh: 'tiny', gr: false, al: .8 },
    { when: k => k.md.bubble, items: [['bubbleHi', 'bubble', 'white', false]], gr: false },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat'], ['sweat', 'sweat2', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip };
  },
};

function drawMeiling(c, o = {}) { return drawRig(c, MEI_RIG, o); }
