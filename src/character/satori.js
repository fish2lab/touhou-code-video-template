'use strict';
// 古明地觉 —— 剪纸人偶的部件表（地灵殿的觉妖怪：淡紫粉短发、发带、浅蓝宽袖短上衣、玫粉及膝裙、胸前悬着的第三只眼）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表，外加第三只眼和软管两个自画层。
// 纯 Canvas 代码绘制，不加载任何图片。结构照 src/character/remilia.js，去掉翅膀、洋帽、伞、趴、够，袖子改成宽袖（照八云紫的长袖口）。
//
// drawSatori(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], eye3:[x,y] }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和蕾米莉亚一样，样张里抬高 100）
//   h        全身高（发顶到脚底），默认 500（全员统一身高，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手交叠在身前（默认）| read 一手按在第三只眼上方、一手自然垂下（读心）
//            point 一手自然垂下、一手指向前方（gesture 伸多远）| think 一手托下巴、另一只手托着肘 | cross 双臂抱胸
//            sit 坐着、两腿垂下轻晃
//            旧名兼容：lecture→point、proud/cheer→cross、hold/lift/peek/lie/fly/walk/run/parasol/slump/reach/tired/doze→stand、present→point
//   mood     normal 半垂眼、嘴平（默认）| smile 眯眼浅笑 | smug 闭眼、嘴角挑起 | surprised 眼睛睁圆、嘴 o
//            sad 眉尾下垂、嘴角下 | annoyed 眼睑压低、嘴抿成波浪 | flustered 脸红、冒汗
//            旧名兼容：proud→smug、happy→smile、angry/pout→annoyed、confused/panic→surprised、cry→sad、calm/sleepy/awkward→normal、yawn→normal
//   eye3     第三只眼睁开程度 0..1（默认 1；0 闭上，眼睑合成一道弧线）
//   eyeLook  [dx, dy] 第三只眼瞳孔朝向，-1..1（默认 [.3, .1]；dx 正 = 朝 facing 那边）
//   read     0..1 读心：第三只眼后面一圈淡光晕和几道放射短线，随 t 轻微脉动（默认 0；read 姿势默认 .7）
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//            track 给了时，第三只眼挂在一根弹簧上：走路、转身时滞后晃动
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，eye3 第三只眼中心
//
// 设计坐标：脚底 (0,0)，y 向下；骨架尺寸照抄蕾米莉亚（脖子 -262、肩 ±22、腰 -204、头缩放 1.1），头部件用「头坐标」（原点在脖子关节）。
// 本文件顶层名字都带 sat / SAT 前缀。

// ===================== 颜色（压暗、低饱和，和 P 里帕秋莉那组同一个明度带；只有第三只眼和发带心形带一点饱和色） =====================
const SAT_K = (() => {
  const hair = mix('#c7a6c6', '#8f8496', .18), hairBack = mix(hair, '#5e4a66', .32), top = mix('#b6cbe0', '#8e95a4', .25), skirt = mix('#d295ab', '#8f7f88', .3);
  const eye = '#8e3a62', e3 = '#c93a72', tube = mix('#a8407a', '#6b5470', .25);
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .35),
    top, topFold: mix(top, '#5f6b85', .3), frill: '#eff0ee', button: mix(skirt, P.ink, .25),
    skirt, skirtFold: mix(skirt, '#6e4a5c', .32), flower: mix(skirt, '#f5e6ea', .55), flowerC: mix(skirt, '#8a5368', .45), hem: mix(skirt, '#6e4a5c', .2),
    skin: P.skin, blush: P.blush, sock: '#efe9e2', slipper: mix('#dca6b7', '#9a8a90', .25), slipperHeart: mix('#b0546f', '#7a6670', .3),
    band: mix('#5a4062', P.ink, .25), heart: '#cf3d6e', heartDk: mix('#cf3d6e', P.ink, .35),
    eye, iris: mix(eye, '#e8a2c2', .45), lash: mix('#4a2238', P.ink, .5), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    // 第三只眼：眼睑（深紫红）、眼球边（玫红）、眼白、虹膜、瞳孔；软管同色系
    lid3: mix('#7a2a56', P.ink, .15), lid3Dk: mix('#7a2a56', P.ink, .55), e3, e3In: '#f4dfe6', e3Iris: mix(e3, '#5a1030', .12), pupil: '#26121e',
    tube, tubeHi: mix(tube, '#f0c8dc', .35), glow: '#f2a7c6',
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  };
})();
const SAT_CUT = rigCutter(3600);
const SAT_NECK = -262, SAT_WAIST = -204, SAT_HEAD = 1.1, SAT_UP = 104;
const SAT_E3 = { r: 13, hang: [17, -264], len: 30 };   // 第三只眼：半径；挂点（上身坐标）和挂绳长（弹簧绕挂点摆）

// ===================== 部件（载入时剪好） =====================
// 心形：中心 (cx, cy)，宽约 2s，旋转 rot
function satHeartPts(cx, cy, s, rot = 0) {
  const out = [], co = Math.cos(rot), si = Math.sin(rot);
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, x = Math.pow(Math.sin(a), 3) * s, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * s;
    out.push([cx + x * co - y * si, cy + x * si + y * co]); }
  return out;
}
// 小花：五瓣（r(θ) = r0 + r1·cos 5θ）
const satFlowerPts = (cx, cy, r, rot) => { const out = []; for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, rr = r * (.62 + .38 * Math.cos(5 * (a + rot))); out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return out; };
// 微乱：轮廓点按 hash 抖一点（载入时一次）
const satJitter = (pts, seed, amp) => pts.map(([x, y], i) => [x + (hash(i, seed) - .5) * amp, y + (hash(i, seed + 1) - .5) * amp]);
const SAT_G = (() => {
  const cut = SAT_CUT, g = {};
  // ---- 腿（站姿，脚底为原点）：白袜到裙下、粉拖鞋 + 心形 ----
  const legR = [[5.5, -100], [15.5, -100], [15.2, -62], [13.8, -32], [13, -12], [7.6, -12], [7, -32], [6, -62]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  const slip = sd => [[sd * 2.5, -9], [sd * 9, -13.5], [sd * 18, -12], [sd * 23.5, -6], [sd * 22, -.5], [sd * 11, 0], [sd * 2, -1.5], [sd * .5, -5]];
  g.shoeR = cut(slip(1), 12, 5, .35); g.shoeL = cut(slip(-1), 13, 5, .35);
  g.slipHeartR = cut(satHeartPts(13.5, -8, 3.4), 14, 2, .1, false); g.slipHeartL = cut(satHeartPts(-13.5, -8, 3.4), 15, 2, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 拖鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.2, 30], [4.4, 62], [-4.4, 62], [-5.2, 30]], 16, 8, .3);
  g.sitShoe = cut(ellPts(2, 66, 9, 5.6, 14), 17, 5, .35);
  g.sitHeart = cut(satHeartPts(3, 64.5, 3), 18, 2, .1, false);
  // ---- 裙子（腰为 y=-204）：玫粉钟形及膝裙、几道褶、下摆一道深边 + 一圈小花 ----
  g.skirt = cut([[-18, -208], [0, -209], [18, -208], [22, -196], [31, -172], [45, -142], [58, -116], [68, -98], [71, -90], [36, -87], [0, -85.5], [-36, -87], [-71, -90], [-68, -98], [-58, -116], [-45, -142], [-31, -172], [-22, -196]], 21, 11, .8);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 19, xb = u * 64; return cut([[xt - .8, -196], [xt + .8, -196], [xb + 1.6, -106], [xb - 1.6, -106]], 23 + i, 12, .4, false); });
  g.hemBand = cut(rStroke(rOpen([[-69, -94], [-36, -91], [0, -89.5], [36, -91], [69, -94]], 4), 4), 27, 8, .3, false);
  const hemY = x => -101 + 8 * (x / 66) ** 2;
  g.flowers = [-56, -42, -28, -14, 0, 14, 28, 42, 56].map((x, i) => cut(satFlowerPts(x, hemY(x), 4.6, i * .4), 28 + i, 2.2, .15, false));
  g.flowerC = [-56, -42, -28, -14, 0, 14, 28, 42, 56].map((x, i) => cut(ellPts(x, hemY(x), 1.4, 1.4, 8), 37 + i, 2, .05, false));
  // ---- 上身：浅蓝短上衣（下摆荷叶边、略外扩）、荷叶边圆领、三颗心形纽扣 ----
  g.shirt = cut([[-13, -268], [13, -268], [22, -261], [25, -246], [24, -226], [26, -206], ...rScallop(rLine([28, -198], [-28, -198]), 6, 3), [-26, -206], [-24, -226], [-25, -246], [-22, -261]], 30, 7, .5, false);
  g.shirtFolds = [-.5, .5].map((u, i) => cut([[u * 12 - .7, -238], [u * 12 + .7, -238], [u * 20 + 1.2, -201], [u * 20 - 1.2, -201]], 48 + i, 10, .3, false));
  g.neck = cut([[-5, -280], [5, -280], [5.5, -262], [-5.5, -262]], 31, 8, .3, false);
  const collarR = [[.5, -268], [12, -270], [21, -262], [19, -254], [13, -250], [6, -253], [2, -259]];
  const collarPts = [...collarR.slice(0, 3), ...rScallop(rLine([21, -262], [6, -253]), 3, 2.2), ...collarR.slice(5)];
  g.collarR = cut(collarPts, 33, 3, .2, false); g.collarL = cut(rMirror(collarPts), 34, 3, .2, false);
  g.buttons = [-243, -229, -215].map((y, i) => cut(satHeartPts(0, y, 3), 50 + i, 1.6, .08, false));
  // ---- 手臂：上臂袖（肩为原点）、肩头、前臂宽袖口带荷叶边（肘为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-6, 4], [6, 4], [6.6, 22], [6.2, 38], [0, 41], [-6.2, 38], [-6.6, 22]], 40, 8, .3);
  g.shoulder = cut(ellPts(0, 6, 8.5, 10, 16), 41, 6, .3);
  g.fore = cut([[-5.6, -4], [0, -5.6], [5.6, -4], [7, 10], [9.6, 21], [13, 31], ...rScallop(rLine([13, 31], [-13, 31]), 3, 2.6), [-9.6, 21], [-7, 10]], 42, 7, .3, false);
  g.foreTrim = cut([...rScallop(rLine([13, 31], [-13, 31]), 3, 2.6), [-12.4, 27], [0, 28.5], [12.4, 27]], 43, 4, .2, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(H.open, 44, 3, .2, false); g.handFist = cut(ellPts(0, 5.6, 5.8, 6.6, 14), 45, 3, .25);
  g.handPoint = cut(H.point, 46, 3, .2, false); g.handGrip = cut(H.grip, 47, 3, .2, false);
  // ---- 第三只眼（眼心为原点）：眼睑一圈（整颗球的底）。开口和眼珠按开合量现剪（见 satEye3） ----
  g.e3Lid = cut(ellPts(0, 0, SAT_E3.r + 2.6, SAT_E3.r + 2.4, 24), 55, 4, .25);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = cut([[0, -3], [12, -6], [23, -13], [32, -25], [37, -42], [39, -62], [38, -82], [33, -98], [0, -107], [-33, -98], [-38, -82], [-39, -62], [-37, -42], [-32, -25], [-23, -13], [-12, -6]], 70, 7, .5);
  // 后发：蓬松的短发，刚到下巴，发梢往外翘、长短不齐（左右各抖一点，不对称）
  const bSide = rOpen([[0, -140], [30, -136], [50, -123], [61, -103], [65, -78], [64, -52], [61, -30], [63, -14]], 5);
  const bTipsR = [[72, -4], [62, -8], [61, 4], [51, -6], [46, 3], [37, -8], [24, -4], [0, -12]];
  const bTipsL = [[-28, -6], [-39, -1], [-45, -10], [-53, 2], [-59, -9], [-69, -2]];
  g.backHair = cut([...satJitter(bSide, 3, 3), ...bTipsR, ...bTipsL, ...satJitter(rMirror(bSide), 5, 3)], 73, 9, .8, false);
  // 鬓发：太阳穴垂到下巴，发梢外翘、分两叉
  const lockR = [...rOpen([[28, -102], [44, -96], [52, -76], [53, -50], [51, -28]], 4), [57, -12], [61, -4], [52, -8], [49, 2], [44, -10], [40, -4], [39, -18], ...rOpen([[37, -40], [35, -66], [29, -90]], 4)];
  g.lockR = cut(lockR, 74, 6, .5, false); g.lockL = cut(satJitter(rMirror(lockR), 9, 2.2), 75, 6, .5, false);
  // 刘海：参差不齐，长短交错，中间一绺最长
  g.bangs = cut([[-48, -114], [-34, -128], [-14, -135], [0, -136], [14, -135], [34, -128], [48, -114], [54, -96], [49, -70], [44, -88], [37, -62], [31, -86], [25, -70], [19, -88], [12, -58], [6, -84], [1, -66], [-4, -86], [-10, -62], [-17, -86], [-23, -72], [-29, -88], [-36, -64], [-42, -86], [-48, -74], [-54, -96]], 76, 6, .5, false);
  g.bangLines = [[12, -58, 9, -112], [-10, -62, -8, -116], [37, -62, 36, -104], [-36, -64, -36, -104]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 77 + i, 8, .2, false));
  // 头顶一绺弯起来的呆毛
  g.tufts = [cut(rStroke(rOpen([[-2, -133], [1, -143], [7, -151], [15, -153], [19, -149]], 3), u => 5.5 - 4.6 * u), 81, 3, .2, false)];
  // 发带：一条细带沿头顶的弧从左耳到右耳，左边一颗小心形
  const bandC = u => [57 * u, -127 + 33 * u * u];
  g.band = cut(rStroke(Array.from({ length: 17 }, (_, i) => bandC(i / 8 - 1)), u => 4.6 + .8 * Math.sin(Math.PI * u)), 83, 6, .2, false);
  g.bandHeart = cut(satHeartPts(-30, -118, 6.2, -.45), 84, 2.4, .12, false);
  g.bandHeartHi = cut(ellPts(-32.5, -121, 1.4, 1.1, 8), 85, 2, .05, false);
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat, 91, 3, .2);
  return g;
})();
// 发顶（翘发不算）到脚底的设计高度（用来把 h 换成缩放）
const SAT_TOP = -(SAT_NECK - 140 * SAT_HEAD);

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」）；lid 眼睑压下的比例（觉平时半垂眼），lower 下眼睑托起，chin 下巴抬（负）
const SAT_MOODS = {
  normal: { eye: 'open', lid: .42, es: 1, brow: [0, -.06], mouth: 'flat', blush: .8, lookY: .6 },
  smile: { eye: 'open', lid: .4, es: 1, lower: 7, brow: [2, -.12], mouth: 'smile', blush: 1.1 },
  smug: { eye: 'up', brow: [3, -.18], mouth: 'smirk', blush: 1, chin: -.1 },
  surprised: { eye: 'open', es: 1.14, iris: .6, brow: [7, -.12], mouth: 'o', blush: .9 },
  sad: { eye: 'open', lid: .4, es: .98, brow: [2, -.42], mouth: 'pout', blush: .9, lookY: 1.6, chin: .04 },
  annoyed: { eye: 'open', lid: .56, es: 1, brow: [-1, .38], mouth: 'wave', blush: .8 },
  flustered: { eye: 'open', es: 1.1, iris: .7, brow: [4, -.25], mouth: 'wobble', blush: 1.8, sweat: true },
};
const SAT_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', pout: 'annoyed', confused: 'surprised', panic: 'surprised', cry: 'sad', calm: 'normal', sleepy: 'normal', awkward: 'normal', yawn: 'normal', smirk: 'smug' };
const SAT_POSE_ALIAS = { lecture: 'point', present: 'point', proud: 'cross', cheer: 'cross', hold: 'stand', lift: 'stand', peek: 'stand', lie: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand', slump: 'stand', reach: 'stand', tired: 'stand', doze: 'stand', hide: 'stand', bow: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的（颜色换成自己的）
const SAT_CIR_MOUTHS = new Set(['laugh', 'grin', 'o']);
function satMouthPts(type, open) {
  const [pts, col, tg] = (SAT_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [pts, col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
//   标记 late：画在第三只眼和脸的外面（按眼、托下巴的那只手）
// up 上身下移（坐），lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开
// 两节手臂的反解：肩 (sx, sy) 到腕 (tx, ty)，上臂 L1、前臂 L2；bend +1 / -1 选肘弯向哪一边 → [a, b]
function satIK(sx, sy, tx, ty, L1, L2, bend = 1) {
  const vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) + bend * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
function satPose(pose, g, tt) {
  const hang = [-.1, .14 + .03 * Math.sin(tt * 1.1), 'open', false];
  switch (pose) {
    case 'read': { const [a, b] = satIK(22, -250, 31, -247, 36, 32, 1); return { back: hang, front: [a, b, 'open', 'late'], hr: .07, turn: .2, look: .3, lookY: .5, read: .7 }; }
    case 'point': return { back: hang, front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.15, g), lerp(1, 1.15, g)], hr: -.02, turn: .3, look: .6, lean: .03 * g };
    case 'think': { const [fa, fb] = satIK(22, -250, 3, -255, 36, 32, 1), ex = 22 + 36 * Math.sin(fa), ey = -250 + 36 * Math.cos(fa), [ba, bb] = satIK(-22, -250, ex - 2, ey + 4, 36, 32, -1);
      return { back: [ba, bb, 'open', false], front: [fa, fb, 'fist', 'late'], hr: .1, turn: .2, look: .5, lookY: -1.5 }; }
    case 'cross': return { back: [-.15, 2.0, 'fist', false, 1, 1.4], front: [.15, -2.0, 'fist', false, 1, 1.4], hr: -.04, turn: -.3, look: .8, keepTurn: true };
    case 'sit': return { back: [-.25, .5, 'open', false], front: [.25, -.5, 'open', false], up: SAT_UP, turn: .15, look: .2, hr: .04 };
    default: return { back: [-.12, 1.22, 'open', false], front: [.14, -1.3 + .03 * Math.sin(tt * 1.3), 'open', false], hr: .06, turn: .15, look: .2 };
  }
}

// ===================== 第三只眼和软管（自画层） =====================
// satTubes：从眼球伸出四根软管，分别连到发带右端、两只手腕、腰侧。端点每帧从骨头里取，曲线是三次贝塞尔：
// 中段往外鼓（每根方向不同）、往下垂一点，再随 t 轻轻摆。在上身坐标里剪好、按上身矩阵画（只做轮廓，不过剪刀，便宜）。
const SAT_TUBES = [[1, 1.1, .2], [1, -.55, 1.7], [-1, .7, 3.1], [1, .9, 4.4]];   // [鼓向（1 外侧）, 鼓的比例, 摆的相位]
function satTubes(k) {
  const { B, AB, AF, S, tt } = k, ug = B.ug, inv = rInv(ug), loc = p => rApply(inv, p);
  const e = loc(rApply(B.eye3, [0, 0]));
  const ends = [loc(rApply(B.head, [55, -98])), loc(rApply(AF.hm, [0, -2])), loc(rApply(AB.hm, [0, -2])), [23, -201]];
  const items = [], his = [];
  ends.forEach((p, i) => {
    const [side, bul, ph] = SAT_TUBES[i], dx = p[0] - e[0], dy = p[1] - e[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    // 鼓向：法线里朝外（+x 那侧）的一边 × side；挂得长的管子更垂
    const sg = Math.sign(nx || 1) * side, b = L * .22 * bul + 2 * Math.sin(tt * 1.3 + ph), sag = Math.min(18, L * .12);
    const c1 = [e[0] + dx * .3 + nx * b * sg, e[1] + dy * .3 + ny * b * sg + sag], c2 = [e[0] + dx * .72 + nx * b * .7 * sg, e[1] + dy * .72 + ny * b * .7 * sg + sag * .6];
    const pts = [];
    for (let j = 0; j <= 18; j++) { const u = j / 18, v = 1 - u; pts.push([0, 1].map(q => v * v * v * e[q] + 3 * v * v * u * c1[q] + 3 * v * u * u * c2[q] + u * u * u * p[q])); }
    const p2 = polyPath(rStroke(pts, u => 3.2 - .9 * u), true); p2.dim = 3;
    const h2 = polyPath(rStroke(pts.slice(2, 15).map(([x, y]) => [x - .5, y - .6]), .9), true); h2.dim = 1;
    items.push({ p: p2, m: ug, col: S.K.tube }); his.push({ p: h2, m: ug, col: S.K.tubeHi, edge: false });
  });
  k.paint(items, RIG_SH.tiny);
  k.paint(his, null, false, .7, true);
}
// satGlow：读心时眼球后面一圈淡光晕 + 几道放射短线（长短随 t 起伏）。直接在眼心坐标里画半透明色，不走剪纸
function satGlow(k) {
  const rd = k.read; if (rd <= .01) return;
  const { c, B, tt, K } = k, m = B.eye3, R = SAT_E3.r, pulse = 1 + .08 * Math.sin(tt * 3.1);
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const gr = c.createRadialGradient(0, 0, R * .8, 0, 0, R * 2.7 * pulse);
  gr.addColorStop(0, alpha(K.glow, .5 * rd)); gr.addColorStop(.55, alpha(K.glow, .2 * rd)); gr.addColorStop(1, alpha(K.glow, 0));
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R * 2.7 * pulse, 0, TAU); c.fill();
  c.strokeStyle = alpha(mix(K.glow, '#ffffff', .3), .75 * rd); c.lineCap = 'round'; c.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + .2 + .04 * Math.sin(tt * .7), ln = R * (.5 + .35 * hash(i, 361)) * (.75 + .25 * Math.sin(tt * 2.6 + hash(i, 362) * TAU)), r0 = R * 1.75;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * (r0 + ln), Math.sin(a) * (r0 + ln)); c.stroke();
  }
  c.restore();
}
// satEye3：眼睑一圈打底，开口是横椭圆（高 = 开合量），开口里：玫红眼球边 → 浅色眼白 → 虹膜 → 瞳孔 → 高光，都按开口上下沿裁好；
// 上沿一道深色眼线。闭上时只剩一道向下弯的弧形纸条。轮廓按量化后的开合、朝向记忆。
function satEye3(k) {
  const { S, B, K } = k, m = B.eye3, R = SAT_E3.r, op = rQ(k.e3open), lx = rQ(k.e3look[0], 10), ly = rQ(k.e3look[1], 10);
  const items = [{ p: S.G.e3Lid, m, col: K.lid3 }];
  k.paint(items, RIG_SH.mid);
  if (op < .08) {
    k.paint([{ p: rigMemo(S, 'e3c', () => { const top = [], bot = []; for (let j = 0; j <= 10; j++) { const u = j / 5 - 1, x = u * (R + .5), y = 2.4 * (1 - u * u) - .5; top.push([x, y - 1.2]); bot.unshift([x, y + 1.2 - Math.abs(u) * .6]); } return S.cut([...top, ...bot], 60, 3, .15, false); }), m, col: K.lid3Dk, edge: false }], null, false, 1, true);
    return;
  }
  const [ball, sclera, iris, pupil, hi, line] = rigMemo(S, ['e3', op, lx, ly].join('|'), () => {
    const ry = R * op, hl = x => Math.abs(x) >= R ? 0 : ry * Math.sqrt(1 - (x / R) ** 2), cl = ([x, y]) => [x, clamp(y, -hl(x), hl(x))];
    const ix = lx * R * .32, iy = ly * R * .28 + R * .05;
    const top = []; for (let j = 0; j <= 14; j++) { const x = (j / 7 - 1) * R; top.push([x, -hl(x)]); }
    return [S.cut(ellPts(0, 0, R, ry, 24), 61, 3, .15), S.cut(ellPts(ix * .3, iy * .3, R * .86, R * .86, 20).map(cl), 62, 3, .15),
      S.cut(ellPts(ix, iy, R * .52, R * .55, 18).map(cl), 63, 2.6, .12), S.cut(ellPts(ix, iy, R * .17, R * .34, 12).map(cl), 64, 2, .08),
      S.cut(ellPts(ix - R * .2, Math.max(iy - R * .24, -hl(ix - R * .2) + 1.6), R * .12, R * .12, 8), 65, 2, .05),
      S.cut(rStroke(top, u => .8 + 1.4 * Math.sin(Math.PI * u)), 66, 3, .1, false)];
  });
  k.paint([{ p: ball, m, col: K.e3, edge: false }, { p: sclera, m, col: K.e3In, edge: false }, { p: iris, m, col: K.e3Iris, edge: false }, { p: pupil, m, col: K.pupil, edge: false }], null, false, 1, true);
  k.paint([{ p: hi, m, col: K.white, edge: false }, { p: line, m, col: K.lid3Dk, edge: false }], null, false, 1, true);
}

// ===================== 部件表 =====================
const satIs = (...ps) => k => ps.includes(k.pose), satNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：手先画，宽袖口（带荷叶边）盖在手腕上，上臂袖子，肩头
const satArms = f => [
  { arms: f, order: 'arm', items: [['@hand', 'hm', 'skin'], ['fore', 'lD', 'top'], ['foreTrim', 'lD', 'frill'], ['armU', 'uD', 'top']], sh: 'mid' },
  { arms: f, items: [['shoulder', 'u', 'top']], sh: 'tiny' },
];
const SAT_RIG = {
  name: 'satori', h: 500, height: SAT_TOP, K: SAT_K, G: SAT_G, cut: SAT_CUT,
  moods: SAT_MOODS, moodAlias: SAT_MOOD_ALIAS, poseAlias: SAT_POSE_ALIAS, pose: satPose, mouth: satMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.014, .9, 1],
  face: { style: 'round', ex: 16, ey: -44, far: .25, turnX: 8, rx: 7.6, ry: 10, lookX: 2.4, mouthY: -20, mouthTurn: 9,
    blush: { dx: 8, turn: 0, y: -27, bump: 0, rx: 6, ry: 3 }, brow: { x: 16, y: -63, len: 6.5, seed: 198, th: [1.1, 1.1, .2, .9, 1.1] } },
  arm: { parent: 'ug', shoulder: [22, -250], upper: 36, fore: 32, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；第三只眼慢慢浮动
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .004 * Math.sin(tt * 2.4);
    k.breath = 1.2 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, SAT_WAIST, k.lean), 0, -k.breath);
    k.e3open = clamp(o.eye3 ?? 1, 0, 1);
    const el = o.eyeLook || [.3, .1]; k.e3look = [clamp(el[0], -1, 1), clamp(el[1], -1, 1)];
    k.read = clamp(o.read ?? ps.read ?? 0, 0, 1);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, SAT_NECK], rot: k => k.hr, scale: [SAT_HEAD, SAT_HEAD] },
    { name: 'skirt', parent: 'body', pivot: [0, SAT_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: satIs('sit'), parent: 'root', at: (k, sd) => [sd * 12, 4], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    // 第三只眼：挂点上一根看不见的摆（待机慢慢晃 + 弹簧滞后），眼球在摆的末端，但不跟着摆转（始终和上身同向）
    { name: 'eye3H', parent: 'ug', pivot: SAT_E3.hang, at: SAT_E3.hang, sway: [.05, 1.2, .3], spring: { len: SAT_E3.len, gain: 1.3, f: 1.5, zeta: .22, max: .7 } },
    { name: 'eye3', m: k => { const ug = k.B.ug, p = rApply(rInv(ug), rApply(k.B.eye3H, [0, SAT_E3.len])); return rTR(ug, p[0], p[1] + 1.5 * Math.sin(k.tt * 1.7), 0); } },
    { arms: true },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 40, -96], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 90, gain: .7, f: 2.3, max: .35 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 2.5, 0] },
    { name: 'band', parent: 'head', at: k => [-k.turn * 3, 0] },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [50, -90 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 后发
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 腿
    { when: satNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'mid' },
    { when: satNot('sit'), items: [['shoeL', 'root', 'slipper'], ['shoeR', 'root', 'slipper']], sh: 'tiny' },
    { when: satNot('sit'), items: [['slipHeartL', 'root', 'slipperHeart'], ['slipHeartR', 'root', 'slipperHeart']], gr: false },
    { when: satIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'slipper'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'slipper']], sh: 'mid' },
    { when: satIs('sit'), items: [['sitHeart', 'shinL', 'slipperHeart'], ['sitHeart', 'shinR', 'slipperHeart']], gr: false },
    // 裙子：玫粉钟形，褶、下摆深边、一圈小花
    { items: [['skirt', 'skirt', 'skirt']], sh: 'big' },
    { items: [['folds', 'skirt', 'skirtFold', false]], gr: false },
    { items: [['hemBand', 'skirt', 'hem']], gr: false },
    { items: [['flowers', 'skirt', 'flower', false]], gr: false },
    { items: [['flowerC', 'skirt', 'flowerC', false]], gr: false },
    // 上身：浅蓝短上衣、荷叶领、心形纽扣
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'top']], sh: 'mid' },
    { items: [['shirtFolds', 'ug', 'topFold', false]], gr: false },
    { items: [['collarL', 'ug', 'frill'], ['collarR', 'ug', 'frill']], sh: 'tiny' },
    { items: [['buttons', 'ug', 'button']], sh: 'tiny', gr: false },
    // 手臂，软管（压在袖口上、头那一头被头发盖住），读心光晕，第三只眼
    ...satArms(A => A.flag !== 'late'),
    { call: satTubes },
    { call: satGlow },
    { call: satEye3 },
    // 脸、前发、眉毛、发带
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['tufts', 'head', 'hair'], ['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    { items: [['band', 'band', 'band']], sh: 'tiny', gr: false },
    { items: [['bandHeart', 'band', 'heart']], sh: 'tiny', gr: false },
    { items: [['bandHeartHi', 'band', 'white', false]], gr: false, al: .7 },
    // 按眼、托下巴的手在最外面
    ...satArms(A => A.flag === 'late'),
    // 表情道具
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -50]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, eye3: rApply(B.eye3, [0, 0]) };
  },
};

function drawSatori(c, o = {}) { return drawRig(c, SAT_RIG, o); }
