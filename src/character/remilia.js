'use strict';
// 蕾米莉亚·斯卡蕾特 —— 剪纸人偶的部件表（A 线常驻：红魔馆的吸血鬼大小姐）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawRemilia(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], parasol:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心
//   h        全身高（洋帽顶到脚底），默认 440（比琪露诺还矮一点，娇小）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手背在身后、下巴微抬 | point 一手叉腰、一手指向前方（gesture 伸多远）| cross 双臂抱胸、脸侧开（傲气）
//            sit 坐着、两腿垂下轻晃 | parasol 一手叉腰、一手把洋伞扛在肩后
//            slump 趴着：上身趴在一摞纸上、侧脸枕在交叠的手臂上（x, y 是胸口下面那条支撑线的中心；线以下整个不画，场景在下面垫纸或桌子）
//            reach 一只手举到头侧抓住东西往下拉（拉窗帘）：gesture 0 举到最高 → 1 拉到胸前，返回值多一个 grab（那只手的握点）
//            旧名兼容：lecture→point、proud/cheer→cross、hold/lift→parasol、peek/lie/fly→stand
//   mood     normal 半垂眼 + 挑起一边嘴角 + 虎牙（默认）| smug 闭眼笑、下巴抬（大小姐的「呵呵」）| smile 眯眼笑 + 虎牙
//            pout 鼓腮、侧目、「哼」| surprised 眼睛睁圆、嘴 o | annoyed 眼睑压低、嘴抿成波浪 | flustered 脸红、冒汗
//            sleepy 眼皮半垂、嘴放平 | yawn 打哈欠：闭眼、嘴张大成竖椭圆（mouth 再张大一点）
//            旧名兼容：proud→smug、happy→smile、angry→annoyed、confused→surprised、panic→flustered、sad→annoyed、calm→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，parasol 伞尖（parasol 姿势），grab 拉东西那只手的握点（只在 reach 姿势里有）
//
// 设计坐标：脚底 (0,0)，y 向下；骨架尺寸照抄琪露诺（脖子 -262、肩 ±22、腰 -204），头部件用「头坐标」（原点在脖子关节）。
// 本文件顶层名字都带 rem 前缀。

// ===================== 颜色（压暗、低饱和，和 P 里帕秋莉那组同一个明度带；只有红缎带和眼睛带一点色） =====================
const REM_K = (() => {
  const hair = '#a4adc9', hairBack = '#7d87a7', dress = '#e3cfd4', red = P.ribbonRed, eye = '#8e3440', wing = '#3b3246';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress, fold: mix(dress, '#8f6f7c', .35), frill: '#f2ebe7', red, redKnot: mix(red, P.ink, .28),
    cap: mix(dress, P.cap, .45), capFold: mix(dress, '#8f6f7c', .25),
    skin: P.skin, blush: P.blush, sock: '#efe9e2', shoe: mix(red, P.ink, .62),
    eye, iris: mix(eye, '#eaa0a0', .45), lash: mix('#5b2635', P.ink, .5), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    wing, wingBone: mix(wing, P.ink, .45), parasol: mix(dress, P.cap, .25), parasolRib: mix(dress, '#8f6f7c', .5), pole: '#5a4638',
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  };
})();
const REM_CUT = rigCutter(3000);
const REM_NECK = -262, REM_WAIST = -204, REM_HEAD = 1.1, REM_UP = 104;

// ===================== 部件（载入时剪好） =====================
// 蝙蝠翼：翅根在原点，朝 +x、向上张开；前缘一根臂骨到腕，腕上散出三根指骨，指尖之间的膜往里凹
const REM_WING = (() => {
  const W = [30, -40], tips = [[40, -58], [82, -34], [92, 0], [70, 30]], root = [4, 10], out = [[0, -6], [12, -24], [24, -40]];
  const bez = (a, b, cp, n = 8) => { const r = []; for (let i = 1; i <= n; i++) { const u = i / n; r.push([0, 1].map(j => (1 - u) ** 2 * a[j] + 2 * u * (1 - u) * cp[j] + u * u * b[j])); } return r; };
  const mid = (a, b, k) => [lerp((a[0] + b[0]) / 2, W[0], k), lerp((a[1] + b[1]) / 2, W[1], k)];
  out.push(tips[0]);
  for (let i = 1; i < tips.length; i++) out.push(...bez(tips[i - 1], tips[i], mid(tips[i - 1], tips[i], .5)));
  out.push(...bez(tips[3], root, mid(tips[3], root, .25)));
  return { W, tips, pts: out };
})();
const REM_G = (() => {
  const cut = REM_CUT, g = {};
  // ---- 翅膀 ----
  g.wing = cut(REM_WING.pts, 1, 7, .5, false);
  g.wingBones = [[[0, -4], REM_WING.W], ...REM_WING.tips.slice(1).map(t => [REM_WING.W, t])].map(([a, b], i) => cut(rStroke([a, [lerp(a[0], b[0], .5), lerp(a[1], b[1], .5)], b], u => 3.4 - 2.2 * u), 2 + i, 5, .2, false));
  g.wingClaw = cut([[36, -54], [40, -66], [45, -55]], 6, 3, .1, false);
  // ---- 腿（站姿，脚底为原点）：白长袜到裙下、深红圆头鞋 ----
  const legR = [[5.5, -100], [15.5, -100], [15.2, -62], [13.8, -32], [13, -12], [7.6, -12], [7, -32], [6, -62]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(11.5, -6.5, 9.5, 6.5, 14), 12, 5, .35); g.shoeL = cut(ellPts(-11.5, -6.5, 9.5, 6.5, 14), 13, 5, .35);
  g.strapR = cut([[5, -11], [18, -11], [18, -8.5], [5, -8.5]], 14, 4, .1, false); g.strapL = cut(rMirror([[5, -11], [18, -11], [18, -8.5], [5, -8.5]]), 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.2, 30], [4.4, 62], [-4.4, 62], [-5.2, 30]], 16, 8, .3);
  g.sitShoe = cut(ellPts(1.5, 66, 8.5, 6, 14), 17, 5, .35);
  // ---- 裙子（腰为 y=-204）：荷叶衬裙、钟形裙、下摆一圈红缎带、几道褶 ----
  g.petti = cut([...rOpen([[-72, -104], [0, -100], [72, -104]], 6), ...rScallop(u => [lerp(76, -76, u), -88 + 3 * (1 - (2 * u - 1) ** 2)], 13, 4.5)], 20, 4, .45, false);
  g.skirt = cut([[-18, -208], [0, -209], [18, -208], [22, -196], [31, -172], [45, -142], [60, -116], [72, -101], [75, -96], [38, -93], [0, -91], [-38, -93], [-75, -96], [-72, -101], [-60, -116], [-45, -142], [-31, -172], [-22, -196]], 21, 11, .8);
  g.hemBand = cut(rStroke(rOpen([[-71, -104], [-36, -100], [0, -98.5], [36, -100], [71, -104]], 4), 5), 22, 8, .3, false);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 19, xb = u * 68; return cut([[xt - .8, -196], [xt + .8, -196], [xb + 1.6, -106], [xb - 1.6, -106]], 23 + i, 12, .4, false); });
  // ---- 上身：粉色上衣、红腰带、白荷叶领、胸前红领结 ----
  g.shirt = cut([[-13, -268], [13, -268], [22, -261], [25, -246], [23, -226], [20, -204], [-20, -204], [-23, -226], [-25, -246], [-22, -261]], 30, 8, .5);
  g.neck = cut([[-5, -280], [5, -280], [5.5, -262], [-5.5, -262]], 31, 8, .3, false);
  g.sash = cut([[-21.5, -214], [21.5, -214], [22.5, -203], [-22.5, -203]], 32, 6, .3, false);
  const collarR = [[.5, -268], [12, -270], [21, -262], [19, -254], [13, -250], [6, -253], [2, -259]];
  g.collarR = cut([...collarR.slice(0, 3), ...rScallop(rLine([21, -262], [6, -253]), 3, 2.2), ...collarR.slice(5)], 33, 3, .2, false);
  g.collarL = cut(rMirror([...collarR.slice(0, 3), ...rScallop(rLine([21, -262], [6, -253]), 3, 2.2), ...collarR.slice(5)]), 34, 3, .2, false);
  g.ribbon = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * 1.15, y * 1.15]), 35, 3, .25, false);
  g.ribbonKnot = cut(ellPts(0, 0, 2.8, 3.2, 8), 36, 2, .1, false);
  // ---- 手臂：上臂（肩为原点）、泡泡袖 + 红袖口、前臂（肘为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-4.4, 8], [4.4, 8], [4.6, 22], [4.2, 38], [0, 40], [-4.2, 38], [-4.6, 22]], 40, 8, .3);
  g.fore = cut([[-4.2, -3], [0, -4.4], [4.2, -3], [4, 15], [3.5, 33], [-3.5, 33], [-4, 15]], 41, 8, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.05, y * 1.05]), 42, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.05, y * 1.05 + .6]), 43, 5, .3, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(H.open, 44, 3, .2, false); g.handFist = cut(ellPts(0, 5.6, 5.8, 6.6, 14), 45, 3, .25);
  g.handPoint = cut(H.point, 46, 3, .2, false); g.handGrip = cut(H.grip, 47, 3, .2, false);
  // ---- 洋伞（握点为原点，伞杆朝 -y）：伞杆、弯柄、浅粉伞面 + 红荷叶边、伞骨 ----
  g.pole = cut(rStroke([[0, 16], [0, -176]], 3.4), 50, 10, .15, false);
  g.crook = cut(rStroke([[0, 12], [0, 20], [-3, 25], [-8, 25], [-10, 21]], 3.4), 51, 4, .1, false);
  const rim = u => [lerp(96, -96, u), -150 + 6 * (1 - (2 * u - 1) ** 2)];
  g.canopy = cut([...rOpen([[-96, -150], [-78, -178], [-40, -196], [0, -201], [40, -196], [78, -178], [96, -150]], 6), ...rScallop(rim, 6, -9)], 52, 8, .6, false);
  const rimUp = u => { const [x, y] = rim(u); return [x, y - 7]; };
  g.canopyTrim = cut([...rScallop(rim, 6, -9), ...rScallop(rimUp, 6, -9).reverse()], 53, 5, .3, false);
  g.ribs = [-1, -.66, -.33, 0, .33, .66, 1].map((u, i) => cut(rStroke([[0, -201], [u * 96, -150 + (Math.abs(u) === 1 ? 0 : 4)]], 1.3), 54 + i, 12, .1, false));
  g.finial = cut([[-2.4, -200], [0, -214], [2.4, -200]], 61, 3, .1, false);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = cut([[0, -3], [12, -6], [23, -13], [32, -25], [37, -42], [39, -62], [38, -82], [33, -98], [0, -107], [-33, -98], [-38, -82], [-39, -62], [-37, -42], [-32, -25], [-23, -13], [-12, -6]], 70, 7, .5);
  g.cheekPuff = [1, -1].map((sd, i) => cut(ellPts(sd * 29, -20, 8.5, 7.5, 16), 71 + i, 5, .3));
  // 后发：到肩的波浪短发，发梢往外卷
  const bSide = rOpen([[0, -132], [32, -128], [50, -114], [60, -92], [62, -66], [59, -40], [57, -20], [63, -4]], 5);
  const bTips = [[72, 8], [60, 4], [56, 16], [45, 4], [37, 13], [27, -4], [0, -10]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 73, 9, .8, false);
  // 鬓发：太阳穴垂到下巴，发梢外翘
  const lockR = [...rOpen([[28, -100], [43, -96], [50, -76], [50, -48], [47, -26]], 4), [53, -12], [58, -6], [49, -8], [44, 0], [40, -12], ...rOpen([[38, -18], [37, -42], [35, -66], [29, -90]], 4)];
  g.lockR = cut(lockR, 74, 6, .5, false); g.lockL = cut(rMirror(lockR), 75, 6, .5, false);
  // 刘海：细碎、中间略分，左右各一绺长一点
  g.bangs = cut([[-47, -114], [-33, -128], [-14, -135], [0, -136], [14, -135], [33, -128], [47, -114], [53, -96], [47, -72], [42, -86], [36, -66], [30, -84], [23, -62], [17, -82], [9, -66], [3, -82], [-2, -70], [-7, -84], [-13, -63], [-20, -83], [-26, -66], [-32, -84], [-38, -68], [-43, -88], [-48, -74], [-53, -96]], 76, 6, .5, false);
  g.bangLines = [[23, -62, 20, -110], [-13, -63, -10, -114], [36, -66, 35, -102], [-38, -68, -37, -104]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 77 + i, 8, .2, false));
  // 洋帽（mob cap）：蓬起的帽顶、红缎带箍、白荷叶帽檐、右边一个红蝴蝶结
  g.capPuff = cut([[-64, -100], [-73, -118], [-69, -140], [-52, -158], [-26, -168], [0, -171], [26, -168], [52, -158], [69, -140], [73, -118], [64, -100], [0, -108]], 80, 9, .7);
  g.capPleats = [[-40, -128, -48, -152], [-12, -132, -14, -162], [18, -132, 22, -160], [44, -126, 52, -148]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1.4, y0], [lerp(x0, x1, .5) - .9, lerp(y0, y1, .5)], [x1, y1], [lerp(x0, x1, .5) + .9, lerp(y0, y1, .5)], [x0 + 1.4, y0]], 81 + i, 9, .2, false));
  const brim = u => { const v = 1 - 2 * u; return [74 * v, -100 + 26 * v * v]; };
  g.capBand = cut(rStroke(rOpen([[-70, -104], [-36, -116], [0, -120], [36, -116], [70, -104]], 4), 7), 85, 8, .3, false);
  g.capFrill = cut([...rOpen([[-76, -96], [-40, -110], [0, -116], [40, -110], [76, -96]], 5), ...rScallop(u => { const [x, y] = brim(u); return [x, y + 2]; }, 11, 5)], 86, 4, .45, false);
  g.capBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 1.7, y * 1.5]), 87, 3, .3, false);
  g.capKnot = cut(ellPts(0, 0, 4, 4.6, 10), 88, 2, .1, false);
  // 表情道具：「哼」气团、汗滴
  g.puffCloud = cut(RIG_SHAPES.cloud, 90, 4, .4);
  g.sweat = cut(RIG_SHAPES.sweat, 91, 3, .2);
  return g;
})();
// 帽顶到脚底的设计高度（用来把 h 换成缩放）
const REM_TOP = -(REM_NECK - 171 * REM_HEAD);

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」），另加 fang 露虎牙、hmph「哼」气团、sweat 汗
const REM_MOODS = {
  normal: { eye: 'open', lid: .3, es: 1, brow: [1, -.08], mouth: 'smirk', blush: .9, fang: true, chin: -.05 },
  smug: { eye: 'up', brow: [3, -.18], mouth: 'laugh', blush: 1.1, chin: -.15, fang: true },
  smile: { eye: 'open', es: 1.02, lower: 6, brow: [3, -.1], mouth: 'smile', blush: 1.25, fang: true },
  pout: { eye: 'open', lid: .25, es: .96, brow: [-2, .4], mouth: 'pout', blush: 1.5, puff: true, turn: -.45, look: 1, hmph: true },
  surprised: { eye: 'open', es: 1.15, iris: .6, brow: [7, -.12], mouth: 'o', blush: 1 },
  annoyed: { eye: 'open', lid: .5, es: 1, brow: [-1, .38], mouth: 'wave', blush: .9 },
  flustered: { eye: 'open', es: 1.1, iris: .7, brow: [4, -.25], mouth: 'wobble', blush: 1.8, sweat: true },
  sleepy: { eye: 'open', lid: .58, es: .98, brow: [-1, -.1], mouth: 'flat', blush: .9, lookY: 1.5 },
  yawn: { eye: 'closed', brow: [3, -.22], mouth: 'yawn', blush: 1.1, chin: -.1 },
};
const REM_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', confused: 'surprised', panic: 'flustered', sad: 'annoyed', calm: 'normal', cry: 'flustered' };
const REM_POSE_ALIAS = { lecture: 'point', proud: 'cross', cheer: 'cross', hold: 'parasol', lift: 'parasol', peek: 'stand', lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', think: 'cross' };
// 嘴：借两位的嘴型（大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的）
const REM_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
// yawn：竖着的大椭圆（含舌头），自己画
const remMouthPts = (type, open) => type === 'yawn' ? [ellPts(0, 4, 5.4 + open, 8.6 + open * 2.4, 16), 'mouthIn', ellPts(0, 9 + open * 1.6, 3.4, 2.4, 10)]
  : (REM_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：标记 behind 背在身后（先于身体画）| late 画在头发外面 | 其他在身体前
// wings [张开量, 下垂]，up 上身下移（坐、趴），sink 头往下沉，shrug 耸肩，parasol 扛伞；标记 desk 趴着时压在纸上的手臂（袖子先画、前臂后画）
// 两节手臂的反解（reach 用）：肩 (sx, sy) 到腕 (tx, ty)，上臂 L1、前臂 L2，肘往外（屏幕上 +x、往下）弯 → [a, b]
function remIK(sx, sy, tx, ty, L1, L2) {
  const vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) - Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
const REM_REACH = { ku: 1.8, kf: 1.9, from: [80, -362], to: [66, -232] };
function remPose(pose, g, tt) {
  const hipB = [-.62, 1.38, 'fist', false];
  switch (pose) {
    // 趴着：上身沉到支撑线下（被纸挡住），头侧着枕在交叠的前臂上，翅膀耷拉
    //   手臂只用来出锚点（拳头大致在头下面）；画的是骨头 dkU / dkF
    case 'slump': return { back: [-1, 2.57, 'fist', 'desk', 1.13, 2.4], front: [.92, -2.49, 'fist', 'desk', 1.19, 2.4], up: 222, sink: 26, shrug: 4,
      hr: .36, noChin: true, turn: .12, look: -.2, lookY: 1.5, wings: [.15, .55] };
    // 拉窗帘：前手从头侧一路拉到胸前；身子先往后仰着够，拉的时候往前压
    case 'reach': { const R = REM_REACH, u = g, tx = lerp(R.from[0], R.to[0], u), ty = lerp(R.from[1], R.to[1], u), sh = 6 * (1 - g), [a, b] = remIK(22, -250 - sh, tx, ty, 36 * R.ku, 32 * R.kf);
      return { back: hipB, front: [a, b, 'grip', 'late', R.ku, R.kf], shrug: sh, lean: lerp(-.04, .05, g), hr: lerp(-.1, -.02, g), turn: .25, look: .4, lookY: lerp(-3, 0, g), wings: [lerp(.4, .1, g), 0] }; }
    case 'point': return { back: hipB, front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.15, g), lerp(1, 1.15, g)], hr: -.05, turn: .3, look: .6, wings: [.35, 0], lean: .03 * g };
    case 'cross': return { back: [-.15, 2.0, 'fist', false, 1, 1.4], front: [.15, -2.0, 'fist', false, 1, 1.4], hr: -.1, turn: -.35, look: .9, wings: [.15, 0], keepTurn: true };
    case 'sit': return { back: [-.25, .5, 'open', false], front: [.25, -.5, 'open', false], up: REM_UP, turn: .15, look: .2, wings: [0, .2], hr: .02 };
    case 'parasol': return { back: hipB, front: [.35, -2.2, 'grip', false], parasol: true, hr: -.06, turn: .2, look: .3, wings: [.1, 0] };
    default: return { back: [-.2, 1.5, 'open', 'behind'], front: [.2, -1.5, 'open', 'behind'], hr: -.05, turn: .15, look: .2, wings: [0, 0] };
  }
}

// ===================== 部件表 =====================
const remIs = (...ps) => k => ps.includes(k.pose), remNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：背在身后的那只，前臂和手先于身体画（被裙子、上衣挡住），上臂和泡泡袖照常画在身前
const remFore = (k, A) => A.flag === 'behind' ? null : k.G.fore, remHand = (k, A) => A.flag === 'behind' ? null : k.G[k.S.arm.hands[A.hand]];
const remArms = f => [
  { arms: f, order: 'arm', items: [['armU', 'uD', 'skin'], [remFore, 'lD', 'skin'], [remHand, 'hm', 'skin']], sh: 'mid' },
  { arms: f, items: [['puff', 'u', 'dress']], sh: 'mid' },
  { arms: f, items: [['cuff', 'u', 'red']], gr: false },
];
const REM_RIG = {
  name: 'remilia', h: 440, height: REM_TOP, K: REM_K, G: REM_G, cut: REM_CUT,
  moods: REM_MOODS, moodAlias: REM_MOOD_ALIAS, poseAlias: REM_POSE_ALIAS, pose: remPose, mouth: remMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.015, 1, 1],
  face: { style: 'round', ex: 16, ey: -44, far: .25, turnX: 8, rx: 7.6, ry: 10, lookX: 2.4, mouthY: -20, mouthTurn: 9, fang: [3.2, .4],
    blush: { dx: 8, turn: 0, y: -27, bump: 0, rx: 6, ry: 3 }, brow: { x: 16, y: -63, len: 6.5, seed: 98, th: [1.1, 1.1, .2, .9, 1.1] } },
  arm: { parent: 'ug', shoulder: [22, -250], upper: 36, fore: 32, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳（不蹦），只轻晃、呼吸；翅膀慢慢一抽一抽
  vars(k) {
    const { ps, tt } = k;
    k.sway = .01 * Math.sin(tt * 1.2) + .004 * Math.sin(tt * 2.7);
    k.breath = 1.2 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, REM_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, REM_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [REM_HEAD, REM_HEAD] },
    { name: 'desk', when: remIs('slump'), m: k => k.B.anchor },                                // 趴着时的支撑线（锚点那条水平线）
    // 趴着时交叠的手臂（不走 rigArm：头比肩宽，袖子得挪到头两边才看得见）：袖子耸在头两侧，前臂横着压在纸上，后手那条在下
    { name: 'dkU', sides: true, when: remIs('slump'), parent: 'ug', at: (k, sd) => [sd * 58, -254], rot: (k, sd) => sd * .55 },
    { name: 'dkF', sides: true, when: remIs('slump'), parent: 'ug', at: (k, sd) => [sd * 68, sd < 0 ? -234 : -230], rot: (k, sd) => sd * Math.PI / 2 + sd * .04, scale: [1.4, 2.75] },
    // 翅膀：先在翅根镜像（左边 scale(-1, 1)），再在镜像后的坐标里转，两边张开、下垂才对称
    { name: 'wingBase', sides: true, parent: 'ug', at: (k, sd) => [sd * 7, -242], scale: (k, sd) => [sd, 1] },
    { name: 'wing', sides: true, parent: (k, sd) => sd < 0 ? 'wingBaseL' : 'wingBaseR', rot: k => -.12 - .18 * k.ps.wings[0] + .4 * k.ps.wings[1],
      sway: (k, sd) => [.045, 1.6, sd * .7], scale: [1.3, 1.3], spring: { len: 80, dir: -.3, mirror: true, gain: .8, f: 2.2, max: .45 } },
    { name: 'skirt', parent: 'body', pivot: [0, REM_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: remIs('sit'), parent: 'root', at: (k, sd) => [sd * 12, 4], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    { name: 'ribbonM', parent: 'ug', at: [0, -252] },
    { arms: true },
    // 洋伞：伞杆穿过前手的握点，往后上方斜着扛在肩后
    { name: 'parasol', when: k => k.ps.parasol, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), -.8 + .02 * Math.sin(k.tt * 1.3) + rigSpringRot(k, { len: 180, dir: -Math.PI / 2, gain: .3, max: .15 })); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 40, -96], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 90, gain: .7, f: 2.3, max: .35 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 2.5, 0] },
    { name: 'cap', parent: 'head', at: k => [-k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -104], sway: [.012, 1.3, .4], spring: { len: 60, dir: -Math.PI / 2, gain: .4, f: 2.6, max: .12 } },
    { name: 'capBow', parent: 'cap', at: [58, -114], rot: .35, sway: [.04, 2.1, 0], spring: { len: 14, gain: .5, f: 3, max: .4 } },
    { name: 'hmph', when: k => k.md.hmph, parent: 'head', at: [-84, -42], rot: k => -k.hr, sway: [.1, 3, 0], scale: k => { const v = 1 + .05 * Math.sin(k.tt * 5); return [v, v]; } },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [50, -90 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 趴着：支撑线以下一律不画（身子被纸挡住）
    { when: remIs('slump'), clipOpen: 'desk' },
    // 伞面在最后面（扛在肩后）
    { when: k => k.ps.parasol, items: [['canopy', 'parasol', 'parasol']], sh: 'big' },
    { when: k => k.ps.parasol, items: [['ribs', 'parasol', 'parasolRib', false]], gr: false },
    { when: k => k.ps.parasol, items: [['canopyTrim', 'parasol', 'red'], ['finial', 'parasol', 'pole']], sh: 'tiny' },
    // 翅膀、后发、背在身后的手
    { items: [['wing', 'wingL', 'wing'], ['wing', 'wingR', 'wing']], sh: 'wing' },
    { items: [['wingBones', 'wingL', 'wingBone', false], ['wingBones', 'wingR', 'wingBone', false], ['wingClaw', 'wingL', 'wingBone', false], ['wingClaw', 'wingR', 'wingBone', false]], gr: false },
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    { arms: A => A.flag === 'behind', order: 'arm', items: [['fore', 'lD', 'skin'], ['@hand', 'hm', 'skin']], sh: 'mid' },
    // 腿
    { when: remNot('sit', 'slump'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'mid' },
    { when: remNot('sit', 'slump'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe'], ['strapL', 'root', 'shoe'], ['strapR', 'root', 'shoe']], sh: 'tiny', gr: false },
    { when: remIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 裙子、上身
    { items: [['petti', 'skirt', 'frill']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'dress']], sh: 'big' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    { items: [['hemBand', 'skirt', 'red']], sh: 'tiny', gr: false },
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'dress']], sh: 'mid' },
    { items: [['sash', 'ug', 'red']], sh: 'tiny', gr: false },
    { items: [['collarL', 'ug', 'frill'], ['collarR', 'ug', 'frill']], sh: 'tiny' },
    { items: [['ribbon', 'ribbonM', 'red']], sh: 'tiny', gr: false },
    { items: [['ribbonKnot', 'ribbonM', 'redKnot']], gr: false },
    // 伞杆压在身前、手在伞杆外面握住
    { when: k => k.ps.parasol, items: [['pole', 'parasol', 'pole'], ['crook', 'parasol', 'pole']], sh: 'mid', gr: false },
    ...remArms(A => A.flag !== 'late' && A.flag !== 'desk'),
    // 趴着：袖子先画，交叠的前臂压在上面（rigArm 算出的那两只不画，只给锚点）
    { when: remIs('slump'), items: [['puff', 'dkUL', 'dress'], ['puff', 'dkUR', 'dress']], sh: 'mid' },
    { when: remIs('slump'), items: [['cuff', 'dkUL', 'red'], ['cuff', 'dkUR', 'red']], gr: false },
    { when: remIs('slump'), items: [['fore', 'dkFL', 'skin']], sh: 'mid' },
    { when: remIs('slump'), items: [['fore', 'dkFR', 'skin']], sh: 'mid' },
    // 脸、前发、眉毛
    { items: k => [['face', 'head', 'skin'], ...(k.md.puff ? [['cheekPuff', 'head', 'skin']] : [])], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 洋帽
    { items: [['capPuff', 'capTop', 'cap']], sh: 'big' },
    { items: [['capPleats', 'capTop', 'capFold', false]], gr: false },
    { items: [['capBand', 'cap', 'red']], sh: 'tiny', gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    { items: [['capBow', 'capBow', 'red']], sh: 'tiny', gr: false },
    { items: [['capKnot', 'capBow', 'redKnot']], gr: false },
    ...remArms(A => A.flag === 'late'),
    // 表情道具
    { when: k => k.md.hmph, call: rigHmph },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
    { when: remIs('slump'), clipClose: true },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    const out = { head: rApply(B.head, [0, -50]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, parasol: B.parasol ? rApply(B.parasol, [0, -214]) : null };
    if (k.pose === 'reach') out.grab = AF.tip;
    return out;
  },
};

function drawRemilia(c, o = {}) { return drawRig(c, REM_RIG, o); }
