'use strict';
// 红美铃 —— 剪纸人偶的部件表（红魔馆的门卫，第 4 集小睡一段出场）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawMeiling(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y] }
//   x, y     脚底中心（startle 跳起来时脚离地，x, y 仍是站立时的脚底）
//   h        全身高（帽顶到脚底），默认 560（比帕秋莉高一点；头身比也比另外三位成熟）
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
// 设计坐标：脚底 (0,0)，y 向下；髋 -236、腰 -262、肩 ±28 / -330、脖子 -344；头部件用「头坐标」（原点在脖子关节，头不放大）。
// 腿分大腿、小腿、脚三节（马步、跳起要弯膝），身体按腿弯的程度自动下沉，脚始终踩在 y=0。
// 本文件顶层名字都带 mei 前缀。

// ===================== 颜色（压暗、低饱和，和帕秋莉、蕾米莉亚同一个明度带） =====================
const MEI_K = (() => {
  const hair = '#a9584f', hairBack = '#82443f', green = '#5d8467', eye = '#4f6b8c', trim = '#e6dcc4';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress: green, dressBack: mix(green, P.ink, .3), fold: mix(green, P.ink, .22), trim,
    hat: mix(green, '#ffffff', .06), hatBand: mix(green, P.ink, .28), star: P.gold, starInk: mix(P.ribbonRed, P.ink, .45),
    pants: '#efe9e2', pantsFold: mix('#efe9e2', '#8f887e', .4), shoe: '#2f2a31', bow: '#2b2630',
    skin: P.skin, blush: P.blush,
    eye, iris: mix(eye, '#b4c8da', .45), lash: mix('#3a2a2c', P.ink, .5), brow: mix(hairBack, P.ink, .4),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    sweat: mix(P.ribbonBlue, P.cap, .62), bubble: '#b9d6e2', white: '#f7f3ee',
  };
})();
const MEI_CUT = rigCutter(4000);
const MEI_NECK = -344, MEI_WAIST = -262, MEI_HIP = -236, MEI_HIPX = 13, MEI_L1 = 112, MEI_L2 = 106, MEI_FOOT = 18, MEI_HEAD = 1;

// ===================== 部件（载入时剪好） =====================
const MEI_G = (() => {
  const cut = MEI_CUT, g = {};
  // ---- 腿：白色阔腿裤（大腿：髋为原点；小腿：膝为原点；都朝 +y），黑布鞋（踝为原点，鞋底 y=18） ----
  const thighR = [[-12, -14], [14, -14], [20, 20], [23, 60], [22, 96], [18, 118], [-8, 118], [-11, 80], [-12, 40]];
  g.thighR = cut(thighR, 1, 9, .4); g.thighL = cut(rMirror(thighR), 2, 9, .4);
  const shinR = [[-9, -6], [17, -6], [19, 30], [17, 66], [12, 92], [11, 100], [-7, 100], [-8, 92], [-10, 60]];
  g.shinR = cut(shinR, 3, 9, .4); g.shinL = cut(rMirror(shinR), 4, 9, .4);
  g.kneeR = cut(ellPts(4, 2, 13.5, 13, 16), 11, 5, .3); g.kneeL = cut(ellPts(-4, 2, 13.5, 13, 16), 12, 5, .3);   // 膝盖：弯膝时把大腿、小腿接上
  const ankR = [[-8, 90], [12, 90], [12.5, 99], [-8.5, 99]];
  g.ankleR = cut(ankR, 5, 5, .2, false); g.ankleL = cut(rMirror(ankR), 6, 5, .2, false);
  const pfR = [[3, 10], [5, 10], [9, 104], [6.5, 104]];
  g.pantFoldR = cut(pfR, 7, 12, .3, false); g.pantFoldL = cut(rMirror(pfR), 8, 12, .3, false);
  const shoeR = [[-9, -1], [10, -1], [14, 5], [15.5, 12], [13, 18], [-8, 18], [-11, 13], [-11, 5]];
  g.shoeR = cut(shoeR, 9, 5, .35); g.shoeL = cut(rMirror(shoeR), 10, 5, .35);
  // ---- 绿色中式长裙（腰 y=-262）：后片宽、垂到小腿；前片窄，两侧开衩露出白裤 ----
  g.skirtBack = cut([[-25, -266], [25, -266], [33, -230], [42, -170], [50, -110], [56, -58], [30, -52], [0, -50], [-30, -52], [-56, -58], [-50, -110], [-42, -170], [-33, -230]], 20, 11, .8);
  g.skirtFront = cut([[-25, -266], [25, -266], [24.5, -236], [23, -180], [24, -120], [26, -64], [27, -56], [0, -52], [-27, -56], [-26, -64], [-24, -120], [-23, -180], [-24.5, -236]], 21, 11, .6);
  g.frontFold = cut([[-.8, -250], [.8, -250], [1.3, -62], [-1.3, -62]], 22, 14, .3, false);
  g.hemTrim = cut(rStroke(rOpen([[-26.5, -61], [0, -57], [26.5, -61]], 4), 3.6), 23, 6, .2, false);
  g.slitTrim = [1, -1].map((sd, i) => cut(rStroke([[sd * 23.6, -236], [sd * 23, -180], [sd * 24, -120], [sd * 26, -62]], 2.2), 24 + i, 10, .2, false));
  // ---- 上身：立领、斜襟（一道浅色滚边 + 两颗盘扣）、袖子（泡泡袖 + 浅色袖口） ----
  g.bodice = cut([[-14, -356], [14, -356], [26, -348], [31, -332], [30, -300], [25, -264], [-25, -264], [-30, -300], [-31, -332], [-26, -348]], 30, 8, .5);
  g.neck = cut([[-5.5, -366], [5.5, -366], [6, -344], [-6, -344]], 31, 8, .3, false);
  g.collar = cut([[-12.5, -354], [12.5, -354], [13.5, -339], [0, -336], [-13.5, -339]], 32, 4, .2, false);
  g.collarTrim = cut(rStroke([[-12.2, -352.4], [0, -353], [12.2, -352.4]], 2.4), 33, 5, .1, false);
  g.placket = cut(rStroke(rOpen([[1, -337], [9, -335], [17, -330], [24, -322], [29, -312]], 3), 2.6), 34, 5, .15, false);
  g.frogs = [[11, -334.5], [21, -325.5]].map(([x, y], i) => cut(rStroke([[x - 4, y], [x + 4, y]], 2.6), 35 + i, 3, .1, false));
  g.armU = cut([[-5, 8], [5, 8], [5.3, 26], [4.8, 44], [0, 47], [-4.8, 44], [-5.3, 26]], 40, 8, .3);
  g.fore = cut([[-4.8, -3], [0, -5], [4.8, -3], [4.5, 18], [4, 41], [-4, 41], [-4.5, 18]], 41, 8, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.2, y * 1.2]), 42, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.2, y * 1.2 + .6]), 43, 5, .3, false);
  const H = RIG_SHAPES.hand, k = 1.15, sc = pts => pts.map(([x, y]) => [x * k, y * k]);
  g.handOpen = cut(sc(H.open), 44, 3, .2, false); g.handFist = cut(ellPts(0, 6.4, 6.6, 7.6, 14), 45, 3, .25);
  g.handPoint = cut(sc(H.point), 46, 3, .2, false); g.handGrip = cut(sc(H.grip), 47, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = cut([[0, -3], [12, -6], [23, -13], [32, -25], [37, -42], [39, -62], [38, -82], [33, -98], [0, -107], [-33, -98], [-38, -82], [-39, -62], [-37, -42], [-32, -25], [-23, -13], [-12, -6]], 70, 7, .5);
  // 后发（跟头走）：盖住后脑，两侧垂到下巴，往下接长发
  const bSide = rOpen([[0, -134], [32, -130], [50, -116], [60, -94], [62, -66], [61, -36], [60, -6], [60, 20]], 5);
  g.backHair = cut([...bSide, [30, 26], [0, 24], [-30, 26], ...rMirror(bSide)], 71, 9, .7, false);
  // 长直发（挂在脖子上的一根骨头，带惯性）：垂到腰下，发梢剪成几道尖
  const mSide = rOpen([[0, -70], [48, -62], [60, -30], [62, 20], [64, 80], [62, 130]], 5);
  const mTips = [[66, 158], [52, 146], [46, 166], [34, 150], [24, 170], [12, 152], [0, 168]];
  g.mane = cut([...mSide, ...mTips, ...rMirror([...mSide, ...mTips.slice(0, -1)])], 72, 10, .8, false);
  g.maneLines = [[-34, 10, -38, 140], [-12, 20, -14, 150], [16, 16, 18, 146], [38, 6, 42, 136]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1, y0], [x1 - 1.4, y1], [x1 + 1.4, y1], [x0 + 1, y0]], 73 + i, 12, .2, false));
  // 鬓发：太阳穴直直垂到胸口
  const lockR = [...rOpen([[28, -100], [43, -96], [50, -76], [51, -46], [50, -10], [50, 30]], 4), [53, 52], [46, 44], [42, 56], [38, 40], ...rOpen([[38, 20], [37, -20], [35, -60], [29, -90]], 4)];
  g.lockR = cut(lockR, 77, 6, .5, false); g.lockL = cut(rMirror(lockR), 78, 6, .5, false);
  // 细辫子（辫根为原点，朝 +y 垂下）：一节一节的锯齿 + 斜纹，末端黑色小蝴蝶结和一撮发梢
  const bl = [], br = []; for (let i = 0; i <= 12; i++) { const y = i * 9, w = 4.4 - i * .08; bl.push([-w - (i % 2) * 1.6, y]); br.unshift([w + ((i + 1) % 2) * 1.6, y]); }
  g.braid = cut([...bl, [0, 112], ...br], 80, 4, .25, false);
  g.braidLines = Array.from({ length: 11 }, (_, i) => cut([[-3.6, i * 9 + 3], [3.6, i * 9 + 8], [3.6, i * 9 + 9.6], [-3.6, i * 9 + 4.6]], 81 + i, 4, .1, false));
  g.tuft = cut([[-4, 106], [4, 106], [7.5, 122], [2.5, 117], [0, 126], [-2.5, 117], [-7.5, 122]], 93, 3, .2, false);
  g.bow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * .8, y * .75 + 106]), 94, 3, .2, false);
  // 刘海：直一点，中间略分
  g.bangs = cut([[-47, -114], [-33, -128], [-14, -135], [0, -136], [14, -135], [33, -128], [47, -114], [53, -96], [48, -70], [42, -84], [37, -64], [30, -82], [24, -62], [17, -80], [10, -64], [4, -80], [0, -72], [-4, -82], [-11, -63], [-18, -81], [-25, -64], [-31, -82], [-37, -66], [-43, -86], [-48, -72], [-53, -96]], 95, 6, .5, false);
  g.bangLines = [[24, -62, 21, -112], [-11, -63, -9, -116], [37, -64, 36, -104], [-37, -66, -36, -104]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 96 + i, 8, .2, false));
  // 绿色贝雷式帽子：鼓起的帽顶 + 深色帽箍 + 两道褶；帽前金色五角星（星中心为原点）
  g.hatCrown = cut([[-66, -100], [-74, -118], [-68, -140], [-50, -158], [-24, -168], [0, -170], [26, -168], [52, -158], [70, -140], [76, -120], [68, -100], [0, -106]], 100, 9, .7);
  g.hatFolds = [[-44, -132, -52, -152], [42, -134, 52, -152]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1.4, y0], [lerp(x0, x1, .5) - .9, lerp(y0, y1, .5)], [x1, y1], [lerp(x0, x1, .5) + .9, lerp(y0, y1, .5)], [x0 + 1.4, y0]], 101 + i, 9, .2, false));
  g.hatBand = cut(rStroke(rOpen([[-67, -101], [-34, -110], [0, -113], [34, -110], [67, -101]], 4), 10), 103, 8, .3, false);
  g.star = cut(starPts(0, 0, 17, 5, .5), 104, 3, .15, false);
  // 表情道具：汗滴、鼻涕泡（半径 10，按骨头缩放）+ 高光
  g.sweat = cut(RIG_SHAPES.sweat, 110, 3, .2);
  g.bubble = cut(circPts(0, 0, 10, 24), 111, 3, .15);
  g.bubbleHi = cut(ellPts(-3.6, -3.8, 2.6, 1.8, 10, -.6), 112, 2, .05);
  return g;
})();
// 帽顶到脚底的设计高度（用来把 h 换成缩放）
const MEI_TOP = -(MEI_NECK - 170 * MEI_HEAD);

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」）；另加 eye: 'spin' 眼睛打转（下面注册的眼睛画法 mei）、bubble 鼻涕泡、sweat 汗
const MEI_MOODS = {
  normal: { eye: 'open', es: 1, brow: [1, .04], mouth: 'soft', blush: 1 },
  sleepy: { eye: 'closed', brow: [-1, -.14], mouth: 'snore', blush: 1.15, bubble: true },
  flustered: { eye: 'spin', es: 1.05, brow: [5, -.32], mouth: 'wobble', blush: 1.9, sweat: true },
  smile: { eye: 'up', brow: [3, -.1], mouth: 'smile', blush: 1.3, chin: -.06 },
  surprised: { eye: 'open', es: 1.18, iris: .6, brow: [7, -.12], mouth: 'o', blush: 1 },
};
const MEI_MOOD_ALIAS = { happy: 'smile', proud: 'smile', smug: 'smile', panic: 'flustered', pout: 'flustered', cry: 'flustered', annoyed: 'flustered', tired: 'sleepy', sad: 'sleepy', confused: 'surprised', calm: 'normal', angry: 'normal' };
const MEI_POSE_ALIAS = { guard: 'stand', sleep: 'doze', nap: 'doze', wake: 'startle', fight: 'kungfu', lecture: 'stand', point: 'stand', cross: 'stand', walk: 'stand', run: 'stand', sit: 'stand', lie: 'stand' };
// 嘴：借两位的嘴型（大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的）；soft 温和的小笑、snore 睡着时微张的小圆嘴
const MEI_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
function meiMouthPts(type, open) {
  if (type === 'snore') return [ellPts(0, 1.6, 2.3 + open * 2, 2.8 + open * 4, 12), 'mouthIn'];
  if (type === 'soft') return pchMouthPts('smile', open);
  return (MEI_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
}
// 眼睛画法 mei：平时同 round（琪露诺那种圆眼）；eye: 'spin' 时画白眼底 + 一圈打转的螺旋（转角取自本帧的 t，见 vars）
RIG_EYES.mei = e => {
  if (e.md.eye !== 'spin') return RIG_EYES.round(e);
  const { S, F, K, sd, ex, ey, far, es, head, low, top, key, cut } = e, rx = F.rx * far * es, ry = F.ry * es;
  low.push({ p: rigMemo(S, 'sw|' + key, () => cut(ellPts(ex, ey, rx + .6, ry, 20), 84 + sd, 3.2, .25)), m: head, col: K.white, edge: false });
  const sp = rigMemo(S, 'sp|' + sd, () => { const pts = []; for (let i = 0; i <= 44; i++) { const u = i / 44, a = u * TAU * 2.4, r = .6 + u * 6.6; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return cut(rStroke(pts, u => 1.1 + .7 * u), 90 + sd, 2, .06, false); });
  top.push({ p: sp, m: rTR(head, ex, ey + .4, sd * (S._spin || 0) * 7, es * far ** .5, es * far ** .5), col: K.lash, edge: false });
};

// ===================== 姿势 =====================
// 手臂 [a 上臂从下垂往 +x 摆的角, b 前臂相对上臂再摆的角, 手型, 标记, 上臂拉长, 前臂拉长]：标记 behind 背在身后 | late 画在头发、帽子外面 | 其他在身前
// spread 大腿往外张（弧度）、knee 小腿收回（弧度）、jump 离地高度、doze 打盹（晃得大、呼吸深）、nod 五官下移（低头）、sink 头往下沉、kick 辫子往外甩
const meiSeg = (g, a, b) => clamp((g - a) / (b - a), 0, 1);
const meiEase = u => u * u * (3 - 2 * u);
const meiMix = (A, B, u) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), u < .5 ? A[2] : B[2], u < .5 ? A[3] : B[3], lerp(A[4] ?? 1, B[4] ?? 1, u), lerp(A[5] ?? 1, B[5] ?? 1, u)];
const MEI_CROSS = { back: [-.15, 2.05, 'fist', false, 1, 1.25], front: [.15, -2.05, 'fist', false, 1, 1.25] };
function meiPose(pose, g, tt) {
  const br = Math.sin(tt * TAU / 3.6);
  switch (pose) {
    case 'doze': return { ...MEI_CROSS, doze: true, hr: .15 + .045 * br, nod: 1, sink: 5 + 2 * br, turn: .05, look: 0, kick: 0 };
    case 'startle': {
      const u1 = meiEase(meiSeg(g, .08, .22)), u2 = meiEase(meiSeg(g, .62, .82)), ph = g * TAU * 2.4;
      const flailF = [2.45 + .5 * Math.sin(ph), .7 * Math.sin(ph + 1.3), 'open', 'late', 1, 1], flailB = [-(2.3 + .5 * Math.sin(ph + 2.1)), -.7 * Math.sin(ph + .4), 'open', 'late', 1, 1];
      const w = Math.sin(tt * 9), waveF = [.5, 2.5 + .3 * w, 'open', 'late', 1, 1], waveB = [-.5, -2.5 + .3 * Math.sin(tt * 9 + 1.4), 'open', 'late', 1, 1];
      const air = Math.sin(Math.PI * meiSeg(g, .15, .55)), pre = Math.sin(Math.PI * meiSeg(g, 0, .17)), land = Math.sin(Math.PI * meiSeg(g, .53, .72));
      const wake = meiEase(meiSeg(g, .1, .24));
      return {
        back: meiMix(meiMix(MEI_CROSS.back, flailB, u1), waveB, u2), front: meiMix(meiMix(MEI_CROSS.front, flailF, u1), waveF, u2),
        jump: 52 * air, spread: .1 * pre + .06 * air + .14 * land, knee: .24 * pre + .4 * air + .32 * land,
        hr: lerp(.15, -.1, wake) + .1 * u2 + .03 * Math.sin(tt * 9) * u2, nod: 1 - wake, sink: 5 * (1 - wake), turn: lerp(.05, .2, u2), look: lerp(0, .5, u2) * Math.sin(tt * 3),
        lean: -.04 * air + .03 * land, kick: .45 * air + .15 * land,
      };
    }
    case 'kungfu': return { back: [-.55, 2.65, 'open', false], front: [lerp(1.25, 1.5, g), lerp(1.2, .9, g), 'open', false], spread: .72, knee: .78, hr: -.04, turn: .32, look: .7, lean: .025 };
    default: return { back: [-.2, 1.5, 'open', 'behind'], front: [.2, -1.5, 'open', 'behind'], hr: -.02, turn: .12, look: .15 };
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
// 帽徽上的「龙」字（朝左时把镜像抵消掉，字不反）
function meiRyu(k) {
  const m = rTR(k.B.star, 0, 0, 0, k.facing, 1), c = k.c;
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); zh(c, '龙', 0, 6, { size: 17, align: 'center', color: k.K.starInk, touch: 'meiling', qcRule: 'decor' }); c.restore();
}
const MEI_RIG = {
  name: 'meiling', h: 560, height: MEI_TOP, K: MEI_K, G: MEI_G, cut: MEI_CUT,
  moods: MEI_MOODS, moodAlias: MEI_MOOD_ALIAS, poseAlias: MEI_POSE_ALIAS, pose: meiPose, mouth: meiMouthPts,
  idleGesture: tt => .875 + .125 * Math.sin(tt * 1.2),
  headSway: [.015, 1, 1],
  face: { style: 'mei', ex: 16, ey: -44, far: .25, turnX: 8, rx: 7.2, ry: 9.8, lookX: 2.4, mouthY: -20, mouthTurn: 9,
    blush: { dx: 8, turn: 0, y: -27, bump: 0, rx: 6, ry: 3 }, brow: { x: 16, y: -63, len: 7, seed: 98, th: [1.2, 1.2, .2, 1, 1.2] } },
  arm: { parent: 'ug', shoulder: [28, -330], upper: 46, fore: 40, mirrorHand: true, tips: { open: [0, 15], fist: [0, 7.5], point: [0, 25.3], grip: [0, 8] },
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；打盹时整个人随呼吸前后摇（绕脚底摆）、呼吸更深
  vars(k) {
    const { ps, tt } = k, doze = !!ps.doze;
    k.br = Math.sin(tt * TAU / (doze ? 3.6 : 3.2));
    k.sway = (doze ? .02 * k.br + .006 * Math.sin(tt * .7) : .007 * Math.sin(tt * 1.1)) + .003 * Math.sin(tt * 2.5);
    k.breath = (doze ? 2.4 : 1.3) * k.br;
    k.lean = ps.lean || 0;
    k.th = ps.spread || 0; k.kn = ps.knee || 0;
    k.drop = -MEI_HIP - (MEI_L1 * Math.cos(k.th) + MEI_L2 * Math.cos(k.th - k.kn) + MEI_FOOT) - (ps.jump || 0);
    k.ugL = rTR(rPivot(R_I, 0, MEI_WAIST, k.lean), 0, -k.breath);
    k.S._spin = tt;   // 眼睛打转的转角（RIG_EYES.mei 读）
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'hips', parent: 'root', at: k => [0, k.drop] },
    { name: 'thigh', sides: true, parent: 'hips', at: (k, sd) => [sd * MEI_HIPX, MEI_HIP], rot: (k, sd) => -sd * k.th },
    { name: 'shin', sides: true, parent: (k, sd) => sd < 0 ? 'thighL' : 'thighR', at: [0, MEI_L1], rot: (k, sd) => sd * k.kn },
    { name: 'foot', sides: true, parent: (k, sd) => sd < 0 ? 'shinL' : 'shinR', at: [0, MEI_L2], rot: (k, sd) => sd * (k.th - k.kn) },
    { name: 'ug', parent: 'hips', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, MEI_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [MEI_HEAD, MEI_HEAD] },
    { name: 'mane', parent: 'ug', at: k => [0, MEI_NECK + (k.ps.sink || 0)], rot: k => k.hr * .3, sway: [.01, 1.1, .5], spring: { len: 160, gain: .5, f: 1.5, max: .15 } },
    { name: 'skirt', parent: 'hips', pivot: [0, MEI_WAIST], rot: k => k.lean * .5, spring: { len: 200, gain: .35, f: 1.6, max: .1 } },
    { arms: true },
    { name: 'faceM', parent: 'head', at: k => [0, (k.ps.nod || 0) * 5] },
    { name: 'browM', parent: 'head', at: k => [0, (k.ps.nod || 0) * 4] },
    { name: 'braid', sides: true, parent: 'head', at: (k, sd) => [sd * 45, -24], rot: (k, sd) => -k.hr * .8 - sd * (k.ps.kick || 0), sway: (k, sd) => [.03, 1.4, sd], spring: { len: 110, gain: .8, f: 2, max: .45 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 40, -96], rot: (k, sd) => -k.hr * .5 - sd * (k.ps.kick || 0) * .25, sway: (k, sd) => [.015, 1.5, sd], spring: { len: 120, gain: .6, f: 2.2, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 2.5, 0] },
    { name: 'hat', parent: 'head', at: k => [-k.turn * 4, 0], rot: -.04 },
    { name: 'star', parent: 'hat', at: k => [k.turn * 6, -132], scale: k => [1 - Math.abs(k.turn) * .15, 1] },
    { name: 'bubble', when: k => k.md.bubble, parent: 'faceM', m: k => { const r = 3 + 9 * (.5 - .5 * k.br); return rTR(k.B.faceM, 4 + k.turn * 8 + r * .85, -31 + r * .2, 0, r / 10, r / 10); } },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [52, -92 + 3 * ((k.tt * 2) % 1)], rot: .15 },
    { name: 'sweat2', when: k => k.md.sweat, parent: 'head', at: k => [-55, -72 + 3 * ((k.tt * 2 + .5) % 1)], rot: -.2, scale: [.8, .8] },
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
    { items: [['placket', 'ug', 'trim', false], ['frogs', 'ug', 'trim', false]], gr: false },
    { items: [['collar', 'ug', 'dress']], sh: 'tiny' },
    { items: [['collarTrim', 'ug', 'trim', false]], gr: false },
    ...meiArms(A => !A.flag || A.flag === 'behind'),
    // 脸、辫子、前发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['braid', 'braidL', 'hair'], ['braid', 'braidR', 'hair'], ['tuft', 'braidL', 'hair'], ['tuft', 'braidR', 'hair']], sh: 'mid' },
    { items: [['braidLines', 'braidL', 'hairLine', false], ['braidLines', 'braidR', 'hairLine', false]], gr: false },
    { items: [['bow', 'braidL', 'bow'], ['bow', 'braidR', 'bow']], sh: 'tiny', gr: false },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 帽子、星徽、「龙」
    { items: [['hatCrown', 'hat', 'hat']], sh: 'big' },
    { items: [['hatFolds', 'hat', 'hatBand', false]], gr: false },
    { items: [['hatBand', 'hat', 'hatBand']], sh: 'tiny' },
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
    return { head: rApply(B.head, [0, -50]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip };
  },
};

function drawMeiling(c, o = {}) { return drawRig(c, MEI_RIG, o); }
