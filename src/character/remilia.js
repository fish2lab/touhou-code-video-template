'use strict';
// 蕾米莉亚·斯卡蕾特 —— 剪纸人偶的部件表（A 线常驻：红魔馆的吸血鬼大小姐）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
// 第三版（2026-10-08）：Q 版比例约 2.4 头身、分层眼睛、包住头的睡帽，比例照帕秋莉（规格见 docs/rig.md「统一比例」）。
//
// drawRemilia(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], parasol:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，帽顶高度各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手背在身后、下巴微抬 | point 一手叉腰、一手指向前方（gesture 伸多远）| cross 双臂抱胸、脸侧开（傲气）
//            sit 坐着、两腿垂下轻晃 | parasol 一手叉腰、一手把洋伞扛在肩后
//            slump 趴着：上身趴在一摞纸上、侧脸枕在交叠的手臂上（x, y 是胸口下面那条支撑线的中心；线以下整个不画，场景在下面垫纸或桌子）
//            reach 一只手举到头侧抓住东西往下拉（拉窗帘）：gesture 0 举到最高 → 1 拉到胸前，返回值多一个 grab（那只手的握点）
//            旧名兼容：lecture→point、proud/cheer→cross、hold/lift→parasol、peek/lie/fly→stand
//   mood     normal 半垂眼、眼角上挑 + 挑起一边嘴角 + 虎牙（默认）| smug 闭眼笑、下巴抬（大小姐的「呵呵」）| smile 眯眼笑 + 虎牙
//            pout 鼓腮、侧目、「哼」| surprised 眼睛睁圆、嘴 o | annoyed 眼睑压低、嘴抿成波浪 | flustered 脸红、冒汗
//            sleepy 眼皮半垂、嘴放平 | yawn 打哈欠：闭眼、嘴张大成竖椭圆（mouth 再张大一点）
//            旧名兼容：proud→smug、happy→smile、angry→annoyed、confused→surprised、panic→flustered、sad→annoyed、calm→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，parasol 伞尖（parasol 姿势），grab 拉东西那只手的握点（只在 reach 姿势里有）
//
// 设计坐标：脚底 (0,0)，y 向下，身子部件直接按第三版的数画（脖子 -248、肩 ±33、腰 -197、裙摆 -54）；
// 头部件在「头坐标」里画（原点在脖子关节，下巴 (0,-4)、头顶 -150、脸宽 ±64，和帕秋莉同一套），头骨头再乘 REM_HEAD = 1.2。
// 本文件顶层名字都带 rem 前缀。

// ===================== 颜色（压暗、低饱和，和 P 里帕秋莉那组同一个明度带；只有红缎带和眼睛带一点色） =====================
const REM_K = (() => {
  const hair = '#a4adc9', hairBack = '#7d87a7', dress = '#e3cfd4', red = P.ribbonRed, eye = '#9a3442', wing = '#3b3246';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress, fold: mix(dress, '#8f6f7c', .35), frill: '#f2ebe7', red, redKnot: mix(red, P.ink, .28),
    cap: mix(dress, P.cap, .55), capFold: mix(dress, '#8f6f7c', .18), pleat: mix(dress, '#8f6f7c', .42),
    skin: P.skin, blush: P.blush, sock: '#efe9e2', shoe: mix(red, P.ink, .62),
    // 眼睛分层（第三版）：虹膜红、下半亮一点、瞳孔深红，眼线深酒红
    eye, irisLt: mix(eye, '#f0a0a0', .5), pupil: mix(eye, P.ink, .72), irisShade: alpha(mix(eye, P.ink, .8), .45), sclera: '#fbf8f3',
    lid: mix('#5b2635', P.ink, .62), lash: mix('#5b2635', P.ink, .5), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    wing, wingBone: mix(wing, P.ink, .45), parasol: mix(dress, P.cap, .25), parasolRib: mix(dress, '#8f6f7c', .5), pole: '#5a4638',
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  };
})();
const REM_CUT = rigCutter(3000);
// 骨架：脖子 -248、腰 -197（第三版统一比例）；REM_HEAD 头坐标的放大；REM_UP 坐下时上身下移
const REM_NECK = -248, REM_WAIST = -197, REM_HEAD = 1.2, REM_UP = 86, REM_PARASOL = 1.4;
// 帽檐：绕头一圈的带子，戴得往后仰，正面看是一道拱（头坐标，中间 -150、两端到 ±86 时 -110）
const remBand = x => -150 + 40 * (x / 86) ** 2;

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
const REM_HAND_K = 1.2;   // 手放大（Q 版的手比身子显大一点，指头出袖约 14）
const REM_G = (() => {
  const cut = REM_CUT, g = {}, sc = (pts, k, dy = 0) => pts.map(([x, y]) => [x * k, y * k + dy]);
  // ---- 翅膀 ----
  g.wing = cut(REM_WING.pts, 1, 7, .5, false);
  g.wingBones = [[[0, -4], REM_WING.W], ...REM_WING.tips.slice(1).map(t => [REM_WING.W, t])].map(([a, b], i) => cut(rStroke([a, [lerp(a[0], b[0], .5), lerp(a[1], b[1], .5)], b], u => 3 - 1.9 * u), 2 + i, 5, .2, false));
  g.wingClaw = cut([[36, -54], [40, -66], [45, -55]], 6, 3, .1, false);
  // ---- 腿（站姿，脚底为原点）：裙下露一截白袜、深红圆头鞋（鞋尖略朝前） ----
  const legR = [[7, -72], [19, -72], [19.2, -44], [18.4, -14], [8.6, -14], [8, -44]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(18, -10, 17.5, 11, 18), 12, 5, .4); g.shoeL = cut(ellPts(-16, -10, 17.5, 11, 18), 13, 5, .4);
  const strapR = [[8, -19], [27, -19], [27, -15.5], [8, -15.5]];
  g.strapR = cut(strapR, 14, 4, .1, false); g.strapL = cut(rMirror(strapR).map(([x, y]) => [x + 2, y]), 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-6, -4], [6, -4], [5.8, 18], [5.2, 34], [-5.2, 34], [-5.8, 18]], 16, 8, .3);
  g.sitShoe = cut(ellPts(3, 39, 14, 9, 16), 17, 5, .4);
  // ---- 裙子（腰 -197）：荷叶衬裙、钟形裙、下摆一圈红缎带、几道褶 ----
  g.petti = cut([...rOpen([[-80, -74], [0, -70], [80, -74]], 6), ...rScallop(u => [lerp(84, -84, u), -57 + 3 * (1 - (2 * u - 1) ** 2)], 14, 5)], 20, 4, .45, false);
  g.skirt = cut([[-24, -201], [0, -202], [24, -201], [28, -189], [37, -162], [51, -130], [67, -98], [79, -76], [83, -69], [42, -65], [0, -63], [-42, -65], [-83, -69], [-79, -76], [-67, -98], [-51, -130], [-37, -162], [-28, -189]], 21, 11, .8);
  g.hemBand = cut(rStroke(rOpen([[-79, -77], [-40, -72], [0, -70.5], [40, -72], [79, -77]], 4), 6), 22, 8, .3, false);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 24, xb = u * 74; return cut([[xt - .9, -190], [xt + .9, -190], [xb + 1.8, -79], [xb - 1.8, -79]], 23 + i, 12, .4, false); });
  // ---- 上身：粉色上衣、红腰带、白荷叶领、胸前红领结 ----
  g.shirt = cut([[-16, -255], [16, -255], [27, -248], [32, -236], [31, -216], [27, -194], [-27, -194], [-31, -216], [-32, -236], [-27, -248]], 30, 8, .5);
  g.neck = cut([[-7, -264], [7, -264], [8, -248], [-8, -248]], 31, 8, .3, false);
  g.sash = cut([[-28, -207], [28, -207], [29.5, -194], [-29.5, -194]], 32, 6, .3, false);
  const collarR = [[.5, -256], [15, -258], [27, -249], [25, -240], [17, -235], [8, -239], [2, -246]];
  const collarP = [...collarR.slice(0, 3), ...rScallop(rLine([27, -249], [8, -239]), 3, 2.8), ...collarR.slice(5)];
  g.collarR = cut(collarP, 33, 3, .2, false); g.collarL = cut(rMirror(collarP), 34, 3, .2, false);
  g.ribbon = cut(sc(RIG_SHAPES.ribbon, 1.35), 35, 3, .25, false);
  g.ribbonKnot = cut(ellPts(0, 0, 3.3, 3.8, 8), 36, 2, .1, false);
  // ---- 手臂：上臂（肩为原点）、泡泡袖 + 红袖口、前臂（肘为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-5.4, 8], [5.4, 8], [5.6, 24], [5.2, 40], [0, 43], [-5.2, 40], [-5.6, 24]], 40, 8, .3);
  g.fore = cut([[-5.2, -3], [0, -5.2], [5.2, -3], [5, 18], [4.4, 37], [-4.4, 37], [-5, 18]], 41, 8, .3);
  g.puff = cut(sc(RIG_SHAPES.puff, 1.4), 42, 7, .5);
  g.cuff = cut(sc(RIG_SHAPES.cuff, 1.4, .8), 43, 5, .3, false);
  const H = RIG_SHAPES.hand, hk = REM_HAND_K;
  g.handOpen = cut(sc(H.open, hk), 44, 3, .2, false); g.handFist = cut(ellPts(0, 6.6, 7, 7.8, 14), 45, 3, .25);
  g.handPoint = cut(sc(H.point, hk), 46, 3, .2, false); g.handGrip = cut(sc(H.grip, hk), 47, 3, .2, false);
  // ---- 洋伞（握点为原点，伞杆朝 -y；整把再乘 REM_PARASOL）：伞杆、弯柄、浅粉伞面 + 红荷叶边、伞骨 ----
  g.pole = cut(rStroke([[0, 16], [0, -176]], 3.4), 50, 10, .15, false);
  g.crook = cut(rStroke([[0, 12], [0, 20], [-3, 25], [-8, 25], [-10, 21]], 3.4), 51, 4, .1, false);
  const rim = u => [lerp(96, -96, u), -150 + 6 * (1 - (2 * u - 1) ** 2)];
  g.canopy = cut([...rOpen([[-96, -150], [-78, -178], [-40, -196], [0, -201], [40, -196], [78, -178], [96, -150]], 6), ...rScallop(rim, 6, -9)], 52, 8, .6, false);
  const rimUp = u => { const [x, y] = rim(u); return [x, y - 7]; };
  g.canopyTrim = cut([...rScallop(rim, 6, -9), ...rScallop(rimUp, 6, -9).reverse()], 53, 5, .3, false);
  g.ribs = [-1, -.66, -.33, 0, .33, .66, 1].map((u, i) => cut(rStroke([[0, -201], [u * 96, -150 + (Math.abs(u) === 1 ? 0 : 4)]], 1.3), 54 + i, 12, .1, false));
  g.finial = cut([[-2.4, -200], [0, -214], [2.4, -200]], 61, 3, .1, false);
  // 扣在伞杆上的手指（伞的坐标，握点为原点）：三节指头横着绕过伞杆，指尖正好收在伞杆的边上
  g.gripFingers = [-3.3, 0, 3.3].map((y, i) => cut([[-3.4, y - 1.5], [1.2, y - 1.6], [1.75, y - .6], [1.75, y + .6], [1.2, y + 1.6], [-3.4, y + 1.5]], 62 + i, 2, .08));
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150，和帕秋莉同一张脸型） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 70, 7, .5);
  g.cheekPuff = cut(ellPts(51, -26, 10, 9.5, 16), 71, 5, .3);   // 鼓腮：只鼓一边（pout 时脸侧开，鼓的是朝外那边）
  // 后发：到肩的波浪短发，比脸宽一圈，发梢往外卷；顶部收在帽子里面
  const bSide = rOpen([[0, -180], [40, -174], [64, -152], [76, -118], [79, -80], [77, -44], [74, -16], [80, 2]], 5);
  const bTips = [[92, 12], [76, 9], [72, 22], [58, 8], [48, 18], [34, -2], [0, -8]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 73, 9, .8, false);
  // 鬓发：太阳穴垂到下巴，压住脸边，发梢外翘
  const lockR = [...rOpen([[48, -130], [64, -120], [73, -92], [75, -58], [73, -28]], 4), [80, -12], [88, -4], [75, -7], [69, 4], [62, -10], ...rOpen([[59, -22], [59, -52], [57, -86], [46, -116]], 4)];
  g.lockR = cut(lockR, 74, 6, .5, false); g.lockL = cut(rMirror(lockR), 75, 6, .5, false);
  // 刘海：细碎的尖、中间略分，下缘刚好压到眼睛上沿
  g.bangs = cut([[-70, -160], [-40, -172], [0, -175], [40, -172], [70, -160], [69, -112], [64, -84], [58, -100], [51, -76], [44, -96], [35, -79], [27, -99], [17, -80], [9, -101], [3, -90], [-2, -104], [-9, -81], [-17, -100], [-27, -78], [-36, -97], [-45, -79], [-53, -99], [-60, -82], [-66, -104], [-70, -122]], 76, 6, .5, false);
  g.bangLines = [[35, -79, 33, -128], [-9, -81, -6, -132], [-27, -78, -29, -126], [51, -76, 56, -118], [-45, -79, -50, -120]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 77 + i, 8, .2, false));
  // 睡帽（第三版，照帕秋莉的帽子做法）：帽顶罩住整个头顶、两侧顺着头往下包到太阳穴；帽顶下沿贴着帽檐那道拱（remBand）收进去；
  // 褶子从帽檐往上散，帽顶鼓起处右下压一层浅影；帽檐是一圈白荷叶边，上面压一道红缎带，右边系红蝴蝶结
  const domeTop = [[88, -110], [97, -136], [99, -164], [89, -190], [66, -208], [30, -218], [-8, -220], [-46, -214], [-76, -196], [-95, -168], [-98, -138], [-89, -110]];
  const domeBot = []; for (let k = 0; k <= 16; k++) { const x = -86 + k / 16 * 172; domeBot.push([x, remBand(x) - 4]); }
  g.capPuff = cut([...domeTop, ...domeBot], 80, 9, .8);
  g.capClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.capLight = polyPath(ellPts(-22, -190, 102, 88, 40), true);
  g.capPleats = [-64, -38, -12, 14, 40, 64].map((x, i) => { const y0 = remBand(x) - 9, x1 = x * 1.3, y1 = y0 - 42 + Math.abs(x) * .12, xm = lerp(x, x1, .5) + x * .05, ym = lerp(y0, y1, .5);
    return cut([[x - 1.8, y0], [xm - 1, ym], [x1, y1], [xm + 1, ym], [x + 1.8, y0]], 81 + i, 9, .25, false); });
  const fTop = rScallop(u => { const x = lerp(-92, 92, u), v = x / 92; return [x, remBand(x) - 9 - 4 * v * v]; }, 15, 2.6);
  const fBot = rScallop(u => { const x = lerp(94, -94, u); return [x, remBand(x) + 9]; }, 13, 6);
  g.capFrill = cut([...fTop, ...fBot], 86, 4, .5, false);
  const bandPts = []; for (let k = 0; k <= 12; k++) { const x = -90 + k / 12 * 180, v = x / 90; bandPts.push([x, remBand(x) - 4 - 2 * v * v]); }
  g.capBand = cut(rStroke(bandPts, 6.5), 85, 8, .3, false);
  g.capBow = cut(sc(RIG_SHAPES.bow, 1.75), 87, 3, .3, false);
  g.capKnot = cut(ellPts(0, 0, 4.4, 5, 10), 88, 2, .1, false);
  // 表情道具：「哼」气团、汗滴
  g.puffCloud = cut(sc(RIG_SHAPES.cloud, 1.2), 90, 4, .4);
  g.sweat = cut(sc(RIG_SHAPES.sweat, 1.3), 91, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// eye open/up/closed，lid 上眼睑盖住的比例，lidTilt 眼睑外端下垂（负数 = 眼角上挑），lower 下眼睑往上推（笑眼），es 眼睛大小，iris 虹膜大小
// brow [上移, 内端下压角]，mouth 嘴型，blush 腮红大小，chin 下巴抬(-)，turn 脸侧开；另加 fang 露虎牙、hmph「哼」气团、sweat 汗
const REM_MOODS = {
  normal: { eye: 'open', lid: .3, lidTilt: -.1, es: 1, brow: [1, -.1], mouth: 'smirk', blush: .9, fang: true, chin: -.05 },
  smug: { eye: 'up', brow: [3, -.18], mouth: 'laugh', blush: 1.1, chin: -.15, fang: true },
  smile: { eye: 'open', lid: .22, lidTilt: -.04, es: 1, lower: 4, brow: [2, -.08], mouth: 'smile', blush: 1.2, fang: true },
  pout: { eye: 'open', lid: .28, lidTilt: -.06, es: .98, brow: [-1, .32], mouth: 'pout', blush: 1.4, puff: true, turn: -.45, look: 1, hmph: true },
  surprised: { eye: 'open', es: 1.12, iris: .86, brow: [6, -.12], mouth: 'o', blush: 1 },
  annoyed: { eye: 'open', lid: .52, lidTilt: -.08, es: 1, brow: [-1, .34], mouth: 'wave', blush: .9 },
  flustered: { eye: 'open', lid: .04, es: 1.08, iris: .88, brow: [3, -.25], mouth: 'wobble', blush: 1.75, sweat: true },
  sleepy: { eye: 'open', lid: .62, lidTilt: .1, es: 1, brow: [-1, -.1], mouth: 'flat', blush: .9, lookY: 1.5 },
  yawn: { eye: 'closed', brow: [3, -.22], mouth: 'yawn', blush: 1.1, chin: -.1 },
};
const REM_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', confused: 'surprised', panic: 'flustered', sad: 'annoyed', calm: 'normal', cry: 'flustered' };
const REM_POSE_ALIAS = { lecture: 'point', proud: 'cross', cheer: 'cross', hold: 'parasol', lift: 'parasol', peek: 'stand', lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', think: 'cross' };
// 嘴：借两位的嘴型（大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的），按第三版的脸放大 1.3 倍
const REM_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']), REM_MOUTH_K = 1.3;
// yawn：竖着的大椭圆（含舌头），自己画
function remMouthPts(type, open) {
  const [pts, col, tg] = type === 'yawn' ? [ellPts(0, 4, 5.4 + open, 8.6 + open * 2.4, 16), 'mouthIn', ellPts(0, 9 + open * 1.6, 3.4, 2.4, 10)]
    : (REM_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  const k = p => p && p.map(([x, y]) => [x * REM_MOUTH_K, y * REM_MOUTH_K]);
  return [k(pts), col, k(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：标记 behind 背在身后（先于身体画）| late 画在头发外面 | pole 拿伞（整只手臂在伞杆后面，只有手指压到前面）
// | desk 趴着时压在纸上的手臂 | 其他在身体前
// wings [张开量, 下垂]，up 上身下移（坐、趴），sink 头往下沉，shrug 耸肩，parasol 扛伞
// 两节手臂的反解（reach 用）：肩 (sx, sy) 到腕 (tx, ty)，上臂 L1、前臂 L2，肘往外（屏幕上 +x、往下）弯 → [a, b]
function remIK(sx, sy, tx, ty, L1, L2) {
  const vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) - Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
const REM_REACH = { ku: 1.45, kf: 1.5, from: [104, -334], to: [72, -226] };
function remPose(pose, g, tt) {
  const hipB = [-.6, 1.5, 'fist', false];
  switch (pose) {
    // 趴着：上身沉到支撑线下（被纸挡住），头侧着枕在交叠的前臂上，翅膀耷拉
    //   手臂只用来出锚点（拳头大致在头下面）；画的是骨头 dkU / dkF
    case 'slump': return { back: [-1.1, 2.6, 'fist', 'desk'], front: [1.1, -2.6, 'fist', 'desk'], up: 236, sink: 0, shrug: 4,
      hr: .3, noChin: true, turn: .12, look: -.2, lookY: 1.5, wings: [.15, .55] };
    // 拉窗帘：前手从头侧一路拉到胸前；身子先往后仰着够，拉的时候往前压
    case 'reach': { const R = REM_REACH, u = g, tx = lerp(R.from[0], R.to[0], u), ty = lerp(R.from[1], R.to[1], u), sh = 6 * (1 - g), [a, b] = remIK(33, -234 - sh, tx, ty, 42 * R.ku, 37 * R.kf);
      return { back: hipB, front: [a, b, 'grip', 'late', R.ku, R.kf], shrug: sh, lean: lerp(-.04, .05, g), hr: lerp(-.1, -.02, g), turn: .25, look: .4, lookY: lerp(-3, 0, g), wings: [lerp(.4, .1, g), 0] }; }
    case 'point': return { back: hipB, front: [lerp(1.3, 1.75, g), lerp(.3, 0, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.05, turn: .3, look: .6, wings: [.35, 0], lean: .03 * g };
    case 'cross': return { back: [-.3, 2.3, 'fist', false], front: [.3, -2.38, 'fist', false], hr: -.1, turn: -.35, look: .9, wings: [.15, 0], keepTurn: true };
    case 'sit': return { back: [-.28, .55, 'open', false], front: [.28, -.55, 'open', false], up: REM_UP, turn: .15, look: .2, wings: [0, .2], hr: .02 };
    case 'parasol': return { back: hipB, front: [.42, -2.55, 'grip', 'pole'], parasol: true, hr: -.06, turn: .2, look: .3, wings: [.1, 0] };
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
// 帽顶亮面：裁在帽顶里，留出右下一圈浅影（帽顶鼓起来的体积）
function remCapLight(k) { const m = k.B.capTop, c = k.c; c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.capClip); c.fillStyle = k.K.cap; c.fill(k.G.capLight); c.restore(); }
const REM_RIG = {
  name: 'remilia', h: 500, height: 520, K: REM_K, G: REM_G, cut: REM_CUT,
  moods: REM_MOODS, moodAlias: REM_MOOD_ALIAS, poseAlias: REM_POSE_ALIAS, pose: remPose, mouth: remMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, 1, 1],
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13, fang: [4.4, .7],
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 98, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: [33, -234], upper: 42, fore: 37, mirrorHand: true,
    tips: Object.fromEntries(Object.entries(RIG_SHAPES.handTip).map(([n, [x, y]]) => [n, [x * REM_HAND_K, n === 'fist' ? 7.5 : y * REM_HAND_K]])),
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳（不蹦），只轻晃、呼吸；翅膀慢慢一抽一抽
  vars(k) {
    const { ps, tt } = k;
    k.sway = .008 * Math.sin(tt * 1.2) + .003 * Math.sin(tt * 2.7);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, REM_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐、趴：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, REM_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [REM_HEAD, REM_HEAD] },
    { name: 'desk', when: remIs('slump'), m: k => k.B.anchor },                                // 趴着时的支撑线（锚点那条水平线）
    // 趴着时交叠的手臂（不走 rigArm：头比肩宽，袖子得挪到头两边才看得见）：袖子耸在头两侧，前臂横着压在纸上，后手那条在下
    { name: 'dkU', sides: true, when: remIs('slump'), parent: 'ug', at: (k, sd) => [sd * 84, -262], rot: (k, sd) => sd * .5 },
    { name: 'dkF', sides: true, when: remIs('slump'), parent: 'ug', at: (k, sd) => [sd * 84, sd < 0 ? -253 : -248], rot: (k, sd) => sd * Math.PI / 2 + sd * .04, scale: [1.3, 2.5] },
    // 翅膀：先在翅根镜像（左边 scale(-1, 1)），再在镜像后的坐标里转，两边张开、下垂才对称
    { name: 'wingBase', sides: true, parent: 'ug', at: (k, sd) => [sd * 9, -226], scale: (k, sd) => [sd, 1] },
    { name: 'wing', sides: true, parent: (k, sd) => sd < 0 ? 'wingBaseL' : 'wingBaseR', rot: k => -.12 - .18 * k.ps.wings[0] + .4 * k.ps.wings[1],
      sway: (k, sd) => [.04, 1.6, sd * .7], scale: [1.75, 1.75], spring: { len: 110, dir: -.3, mirror: true, gain: .8, f: 2.2, max: .4 } },
    { name: 'skirt', parent: 'body', pivot: [0, REM_WAIST], rot: k => k.lean * .5, spring: { len: 140, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: remIs('sit'), parent: 'root', at: (k, sd) => [sd * 15, 18], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    { name: 'ribbonM', parent: 'ug', at: [0, -241] },
    { arms: true },
    // 洋伞：伞杆穿过前手的握点，往后上方斜着扛在肩后
    { name: 'parasol', when: k => k.ps.parasol, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), -.82 + .02 * Math.sin(k.tt * 1.3) + rigSpringRot(k, { len: 220, dir: -Math.PI / 2, gain: .3, max: .15 }), REM_PARASOL, REM_PARASOL); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -118], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 90, gain: .7, f: 2.3, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'cap', parent: 'head', at: k => [k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -150], sway: [.01, 1.2, .5] },
    { name: 'capBow', parent: 'cap', at: [62, remBand(62) - 6], rot: .3, sway: [.04, 2.1, 0], spring: { len: 18, gain: .5, f: 3, max: .4 } },
    { name: 'hmph', when: k => k.md.hmph, parent: 'head', at: [-112, -60], rot: k => -k.hr, sway: [.1, 3, 0], scale: k => { const v = 1 + .05 * Math.sin(k.tt * 5); return [v, v]; } },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [66, -108 + 3 * ((k.tt * 2) % 1)], rot: .15 },
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
    { when: remNot('sit', 'slump'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: remNot('sit', 'slump'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: remNot('sit', 'slump'), items: [['strapL', 'root', 'redKnot', false], ['strapR', 'root', 'redKnot', false]], gr: false },
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
    // 拿伞：袖子、袖口、手掌都在伞杆后面；伞杆压在上面，只有手指扣到伞杆前面、指尖收在伞杆边上
    ...remArms(A => A.flag === 'pole'),
    { when: k => k.ps.parasol, items: [['pole', 'parasol', 'pole'], ['crook', 'parasol', 'pole']], sh: 'mid', gr: false },
    { when: k => k.ps.parasol, items: [['gripFingers', 'parasol', 'skin']], sh: 'tiny', gr: false },
    ...remArms(A => !['late', 'desk', 'pole'].includes(A.flag)),
    // 趴着：交叠的前臂横在纸上（后手那条在下），袖子压住两条前臂的肘端（rigArm 算出的那两只不画，只给锚点）
    { when: remIs('slump'), items: [['fore', 'dkFL', 'skin']], sh: 'mid' },
    { when: remIs('slump'), items: [['fore', 'dkFR', 'skin']], sh: 'mid' },
    { when: remIs('slump'), items: [['puff', 'dkUL', 'dress'], ['puff', 'dkUR', 'dress']], sh: 'mid' },
    { when: remIs('slump'), items: [['cuff', 'dkUL', 'red'], ['cuff', 'dkUR', 'red']], gr: false },
    // 脸、前发、眉毛
    { items: k => [['face', 'head', 'skin'], ...(k.md.puff ? [['cheekPuff', 'head', 'skin']] : [])], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 睡帽：帽顶（暗面整片 + 亮面裁在里面）→ 褶子 → 荷叶帽檐 → 红缎带 → 蝴蝶结；全部压在头发外面
    { items: [['capPuff', 'capTop', 'capFold']], sh: 'big' },
    { call: remCapLight },
    { items: [['capPleats', 'capTop', 'pleat', false]], gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    { items: [['capBand', 'cap', 'red']], sh: 'tiny', gr: false },
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
    const out = { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, parasol: B.parasol ? rApply(B.parasol, [0, -214]) : null };
    if (k.pose === 'reach') out.grab = AF.tip;
    return out;
  },
};

function drawRemilia(c, o = {}) { return drawRig(c, REM_RIG, o); }
