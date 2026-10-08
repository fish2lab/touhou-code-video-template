'use strict';
// 芙兰朵露·斯卡蕾特 —— 剪纸人偶的部件表（红魔馆地下室的妹妹，蕾米莉亚的妹妹）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
// 第三版（2026-10-08）：Q 版比例约 2.4 头身、分层眼睛、包住头的睡帽，比例照帕秋莉（规格见 docs/rig.md「统一比例」），和姐姐 remilia.js 同一副骨架。
//
// drawFlandre(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], wand:[x,y] | null, wings:[[x,y],[x,y]] }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，帽顶高度各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 两手垂在身侧、手掌张开（默认）| point 一手叉腰、一手指向前方（gesture 伸多远）
//            wand 一手叉腰、一手把莱瓦汀（黑色弯钩铁杖）举过肩头（袖子在杖后面，只有手指扣在杖身边上）
//            cheer 两手举过头顶、张开（开心）| shy 两手背在身后、身子扭开、脸侧着低一点 | sit 坐着、两腿垂下轻晃
//            旧名兼容：lecture→point、hold/lift/parasol/throw→wand、proud/happy→cheer、hide/peek/cross/think→shy、lie/fly/read/walk/run/tired/slump/reach→stand
//   mood     normal 眼睛睁大、小笑 + 虎牙（默认）| smile 闭眼笑、嘴张开 | grin 咧嘴笑、露小尖牙、眼睛半弯
//            surprised 眼睛睁圆、嘴 o | pout 鼓腮、侧目、「哼」| crazy 瞳孔缩小、眼角上挑、咧嘴大笑 + 额头一片阴影（危险但可爱）
//            sad 眉尾下垂、眼睛往下看、嘴抿成波浪、眼泪
//            旧名兼容：happy→smile、proud/smug/smirk→grin、angry/annoyed→pout、confused/panic/flustered→surprised、cry→sad、mad/insane→crazy、calm/sleepy/yawn→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，wand 莱瓦汀的杖头（只在 wand 姿势里有，否则 null），
//           wings 两边翅膀根（枝条从背上长出来的那一点，按屏幕 x 从左到右）
//
// 设计坐标：脚底 (0,0)，y 向下，身子部件直接按第三版的数画（脖子 -248、肩 ±33、腰 -197、裙摆 -54）；
// 头部件在「头坐标」里画（原点在脖子关节，下巴 (0,-4)、头顶 -150、脸宽 ±64，和帕秋莉同一套），头骨头再乘 FLA_HEAD = 1.2。
// 衣服：白衬衫（短泡泡袖、红袖口）外面一件红背心连衣裙，领口黄色领巾，红裙下摆一圈白荷叶边；白袜红鞋。
// 头：浅金色短发，右侧（+x）扎一束侧马尾；白色睡帽包住头，帽檐一道红缎带、左边一个红蝴蝶结；红眼。
// 翅膀：背后两根弯曲的深色细枝，每根下面挂 7 颗彩色水晶（青 → 蓝 → 紫 → 粉 → 橙 → 黄 → 绿），每颗各自轻晃，整根枝条挂在弹簧上。
// 本文件顶层名字都带 fla / FLA_ 前缀。

// ===================== 颜色（压暗、低饱和，和 P 里帕秋莉那组同一个明度带；红裙、黄领巾、水晶带色） =====================
const FLA_K = (() => {
  const hair = '#e6d08e', hairBack = '#c4a862', dress = '#b9464f', shirt = '#f1ece5', eye = '#b2303d', branch = '#352c38', ascot = '#e2c25e';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .25),
    dress, fold: mix(dress, P.ink, .3), vestEdge: mix(dress, P.ink, .45), shirt, frill: '#f4efe9', red: P.ribbonRed, redKnot: mix(P.ribbonRed, P.ink, .3),
    ascot, ascotKnot: mix(ascot, '#a07a2c', .45),
    cap: P.cap, capFold: mix(P.cap, '#9c8f86', .2), pleat: mix(P.cap, '#9c8f86', .45),
    skin: P.skin, blush: P.blush, sock: '#efe9e2', shoe: mix(dress, P.ink, .35), strap: mix(dress, P.ink, .6),
    // 眼睛分层（第三版）：虹膜红、下半亮一点、瞳孔深红，眼线深酒红
    eye, irisLt: mix(eye, '#f3a6a0', .5), pupil: mix(eye, P.ink, .72), irisShade: alpha(mix(eye, P.ink, .8), .45), sclera: '#fbf8f3',
    lid: mix('#5b2635', P.ink, .6), lash: mix('#5b2635', P.ink, .5), brow: mix(hairBack, P.ink, .4),
    mouth: mix(hairBack, P.ink, .65), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    branch, branchKnot: mix(branch, P.ink, .4), wand: '#2b2430', wandHi: '#4b4052',
    tear: mix(P.ribbonBlue, P.cap, .55), sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
    // 水晶：从翅根往外 青、蓝、紫、粉、橙、黄、绿；hi 是亮面
    ...Object.fromEntries(['#7fcfd6', '#86a5e0', '#a88ad8', '#e695c0', '#eeaa78', '#ead67a', '#99d39a'].flatMap((cc, i) => [['cry' + i, cc], ['cryHi' + i, mix(cc, '#ffffff', .55)], ['cryLo' + i, mix(cc, P.ink, .22)]])),
  };
})();
const FLA_CUT = rigCutter(8000);
// 骨架：脖子 -248、腰 -197（第三版统一比例，和蕾米莉亚一样）；FLA_HEAD 头坐标的放大；FLA_UP 坐下时上身下移；FLA_WAND 杖的放大；FLA_WING 翅膀的放大
const FLA_NECK = -248, FLA_WAIST = -197, FLA_HEAD = 1.2, FLA_UP = 86, FLA_WAND = 1.35, FLA_WING = 1.25;
// 帽檐：绕头一圈的带子，戴得往后仰，正面看是一道拱（头坐标，中间 -150、两端到 ±86 时 -110）
const flaBand = x => -150 + 40 * (x / 86) ** 2;

// ===================== 部件（载入时剪好） =====================
// 翅膀枝条：翅根在原点，朝 +x 先往上拱、再往外往下垂；7 颗水晶挂在枝条下沿（FLA_BR.at[i] 是挂点）
const FLA_BR = (() => {
  const ctrl = [[0, -2], [10, -15], [28, -26], [52, -32], [78, -32], [100, -27], [118, -18], [128, -8]];
  const pts = spline(ctrl, 6, false);
  // 沿弧长取 7 个挂点（u 0.2 → 0.98）
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = u => { const s = u * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f) + 1.5]; };
  return { pts, at: [.2, .33, .46, .59, .72, .85, .98].map(at) };
})();
const FLA_HAND_K = 1.2;   // 手放大（Q 版的手比身子显大一点，指头出袖约 14）
const FLA_G = (() => {
  const cut = FLA_CUT, g = {}, sc = (pts, k, dy = 0) => pts.map(([x, y]) => [x * k, y * k + dy]);
  // ---- 翅膀：枝条（根粗梢细，梢上一个小弯钩）+ 根上一个小结；水晶是细长的六角棱柱，挂点为原点、朝 +y 垂下 ----
  g.branch = cut(rStroke([...FLA_BR.pts, [131, -1], [129, 4]], u => 5.2 - 3.6 * u), 1, 6, .25, false);
  g.branchKnot = cut(ellPts(1, -3, 4.6, 4.2, 10), 2, 3, .15);
  g.cry = cut([[0, 0], [4.6, 6], [4.4, 17], [0, 25], [-4.4, 17], [-4.6, 6]], 3, 4, .12, false);
  g.cryHi = cut([[.4, 1.6], [3.3, 6.4], [3.1, 16.4], [.4, 21.5]], 4, 3, .08, false);
  g.cryLo = cut([[-.6, 2], [-3.6, 6.6], [-3.4, 16.6], [-.6, 22]], 5, 3, .08, false);
  // ---- 腿（站姿，脚底为原点）：裙下露一截白袜、红色圆头鞋（鞋尖略朝前）+ 深红鞋带 ----
  const legR = [[7, -72], [19, -72], [19.2, -44], [18.4, -14], [8.6, -14], [8, -44]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(18, -10, 17.5, 11, 18), 12, 5, .4); g.shoeL = cut(ellPts(-16, -10, 17.5, 11, 18), 13, 5, .4);
  const strapR = [[8, -19], [27, -19], [27, -15.5], [8, -15.5]];
  g.strapR = cut(strapR, 14, 4, .1, false); g.strapL = cut(rMirror(strapR).map(([x, y]) => [x + 2, y]), 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-6, -4], [6, -4], [5.8, 18], [5.2, 34], [-5.2, 34], [-5.8, 18]], 16, 8, .3);
  g.sitShoe = cut(ellPts(3, 39, 14, 9, 16), 17, 5, .4);
  // ---- 裙子（腰 -197）：白荷叶衬裙、红色钟形裙（比姐姐的略短、略蓬）、下摆一圈白荷叶边、几道褶 ----
  g.petti = cut([...rOpen([[-84, -84], [0, -80], [84, -84]], 6), ...rScallop(u => [lerp(88, -88, u), -64 + 3 * (1 - (2 * u - 1) ** 2)], 14, 5.5)], 20, 4, .45, false);
  g.skirt = cut([[-24, -201], [0, -202], [24, -201], [29, -189], [39, -164], [54, -134], [70, -104], [82, -84], [86, -77], [43, -73], [0, -71], [-43, -73], [-86, -77], [-82, -84], [-70, -104], [-54, -134], [-39, -164], [-29, -189]], 21, 11, .8);
  const hemTop = u => { const x = lerp(-84, 84, u), v = x / 84; return [x, -84 + 5 * v * v - 2 * (1 - v * v)]; };
  const hemBot = u => { const x = lerp(85, -85, u), v = x / 85; return [x, -74 + 3 * v * v - 3 * (1 - v * v)]; };
  g.hemFrill = cut([...rOpen([0, .25, .5, .75, 1].map(hemTop), 4), ...rScallop(hemBot, 16, 3.6)], 22, 5, .3, false);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 24, xb = u * 76; return cut([[xt - .9, -190], [xt + .9, -190], [xb + 1.8, -88], [xb - 1.8, -88]], 23 + i, 12, .4, false); });
  // ---- 上身：白衬衫打底，外面红背心（领口开成 V）、腰上一道深红缝线；白小翻领；黄色领巾 ----
  g.shirt = cut([[-16, -255], [16, -255], [27, -248], [32, -236], [31, -216], [27, -194], [-27, -194], [-31, -216], [-32, -236], [-27, -248]], 30, 8, .5);
  g.neck = cut([[-7, -264], [7, -264], [8, -248], [-8, -248]], 31, 8, .3, false);
  g.vest = cut([[-21, -251], [-10, -246], [0, -226], [10, -246], [21, -251], [29, -244], [32.5, -234], [31.5, -216], [28, -193], [-28, -193], [-31.5, -216], [-32.5, -234], [-29, -244]], 32, 7, .4);
  g.waist = cut(rStroke(rOpen([[-29, -200], [0, -198.5], [29, -200]], 4), 2.4), 33, 6, .2, false);
  g.buttons = [-218, -207].map((y, i) => cut(ellPts(0, y, 1.9, 1.9, 8), 34 + i, 2, .05, false));
  const collarR = [[.5, -256], [13, -258], [22, -251], [17, -244], [8, -242], [2, -247]];
  g.collarR = cut(collarR, 36, 3, .2, false); g.collarL = cut(rMirror(collarR), 37, 3, .2, false);
  // 领巾：领口一个结，下面两片往外张的尾巴（局部坐标，结为原点）
  g.ascot = cut([[-3.6, 0], [3.6, 0], [8.4, 9.5], [7, 15.5], [2.6, 13.5], [0, 7], [-2.6, 13.5], [-7, 15.5], [-8.4, 9.5]], 38, 3, .2, false);
  g.ascotKnot = cut(ellPts(0, 1, 4.6, 3.6, 10), 39, 2, .1, false);
  // ---- 手臂：上臂（肩为原点）、白泡泡袖 + 红袖口、前臂（肘为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-5.4, 8], [5.4, 8], [5.6, 24], [5.2, 40], [0, 43], [-5.2, 40], [-5.6, 24]], 40, 8, .3);
  g.fore = cut([[-5.2, -3], [0, -5.2], [5.2, -3], [5, 18], [4.4, 37], [-4.4, 37], [-5, 18]], 41, 8, .3);
  g.puff = cut(sc(RIG_SHAPES.puff, 1.4), 42, 7, .5);
  g.cuff = cut(sc(RIG_SHAPES.cuff, 1.4, .8), 43, 5, .3, false);
  const H = RIG_SHAPES.hand, hk = FLA_HAND_K;
  g.handOpen = cut(sc(H.open, hk), 44, 3, .2, false); g.handFist = cut(ellPts(0, 6.6, 7, 7.8, 14), 45, 3, .25);
  g.handPoint = cut(sc(H.point, hk), 46, 3, .2, false); g.handGrip = cut(sc(H.grip, hk), 47, 3, .2, false);
  // ---- 莱瓦汀（握点为原点，杖身朝 -y；整根再乘 FLA_WAND）：一根黑色细铁杖，中段微弯，顶上弯成一个钩，底下一个小尖 ----
  const shaft = [[0, 52], [.4, 30], [0, 0], [-1.6, -40], [-1.2, -80], [1, -104], [5, -118], [12, -126], [19, -124], [21, -116], [16, -110]];
  g.wand = cut(rStroke(spline(shaft, 4, false), u => u < .7 ? 5 : 5 - 6 * (u - .7)), 50, 8, .15, false);
  g.wandHi = cut(rStroke(spline([[-.6, 40], [-.4, 0], [-2, -40], [-1.6, -78]], 4, false), 1.3), 51, 10, .05, false);
  g.wandTip = cut([[-2.6, 50], [2.6, 50], [0, 63]], 52, 3, .05, false);
  // 扣在杖上的手指（杖的坐标，握点为原点）：三节指头横着绕过杖身，指尖正好收在杖身的边上
  g.gripFingers = [-3.4, 0, 3.4].map((y, i) => cut([[-3.8, y - 1.5], [1.3, y - 1.6], [2.1, y - .6], [2.1, y + .6], [1.3, y + 1.6], [-3.8, y + 1.5]], 53 + i, 2, .08));
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150，和帕秋莉同一张脸型） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 70, 7, .5);
  g.faceClip = polyPath(spline([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 3, true), true);
  g.cheekPuff = cut(ellPts(51, -26, 10, 9.5, 16), 71, 5, .3);   // 鼓腮：只鼓一边
  // 后发：比姐姐短一点、发梢更碎更翘的短发；顶部收在帽子里面
  const bSide = rOpen([[0, -180], [40, -174], [64, -152], [75, -120], [78, -86], [76, -52], [72, -28], [80, -14]], 5);
  const bTips = [[90, -6], [74, -8], [70, 4], [58, -8], [50, 4], [38, -12], [24, -4], [0, -14]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 73, 9, .8, false);
  // 鬓发：太阳穴垂到下巴，压住脸边，发梢外翘
  const lockR = [...rOpen([[48, -130], [64, -120], [72, -94], [74, -62], [71, -34]], 4), [79, -20], [86, -12], [73, -14], [67, -4], [61, -18], ...rOpen([[59, -28], [59, -56], [57, -88], [46, -116]], 4)];
  g.lockR = cut(lockR, 74, 6, .5, false); g.lockL = cut(rMirror(lockR), 75, 6, .5, false);
  // 侧马尾（头的右侧，+x）：根在帽檐下沿、太阳穴后面，往外往下垂一束，发梢分三尖；根上一个红发圈（局部坐标，根为原点）
  g.tail = cut([[-6, -4], [6, -6], [14, 6], [21, 24], [24, 44], [22, 64], [26, 78], [17, 72], [13, 84], [8, 70], [1, 78], [2, 60], [-1, 40], [-5, 20], [-8, 6]], 76, 6, .5, false);
  g.tailLines = [[[3, 6], [9, 30], [11, 56]], [[9, 4], [16, 26], [17, 50]]].map((pts, i) => cut(rStroke(spline(pts, 4, false), u => 1.8 - 1.2 * u), 77 + i, 8, .1, false));
  g.tailTie = cut([[-4.5, 9], [12.5, 6], [14.5, 13], [-3, 16.5]], 79, 3, .1, false);
  // 刘海：细碎的尖、中间略分，下缘刚好压到眼睛上沿；比姐姐的少几根、尖更圆一点
  g.bangs = cut([[-70, -160], [-40, -172], [0, -175], [40, -172], [70, -160], [69, -112], [65, -86], [57, -100], [49, -78], [40, -98], [30, -80], [20, -101], [10, -82], [3, -98], [-4, -84], [-12, -102], [-21, -79], [-31, -99], [-40, -80], [-49, -99], [-58, -82], [-65, -104], [-70, -122]], 80, 6, .5, false);
  g.bangLines = [[30, -80, 28, -128], [-4, -84, -2, -132], [-21, -79, -24, -126], [49, -78, 54, -118], [-40, -80, -45, -120]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 81 + i, 8, .2, false));
  // 睡帽（照蕾米莉亚的帽子做法）：帽顶罩住整个头顶、两侧顺着头往下包到太阳穴；帽顶下沿贴着帽檐那道拱（flaBand）收进去；
  // 褶子从帽檐往上散，帽顶鼓起处右下压一层浅影；帽檐是一圈白荷叶边，上面压一道红缎带，左边系红蝴蝶结
  const domeTop = [[88, -110], [97, -136], [98, -164], [88, -190], [65, -207], [30, -217], [-8, -219], [-46, -213], [-76, -195], [-95, -167], [-98, -138], [-89, -110]];
  const domeBot = []; for (let k = 0; k <= 16; k++) { const x = -86 + k / 16 * 172; domeBot.push([x, flaBand(x) - 4]); }
  g.capPuff = cut([...domeTop, ...domeBot], 90, 9, .8);
  g.capClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.capLight = polyPath(ellPts(-22, -190, 102, 88, 40), true);
  g.capPleats = [-64, -38, -12, 14, 40, 64].map((x, i) => { const y0 = flaBand(x) - 9, x1 = x * 1.3, y1 = y0 - 42 + Math.abs(x) * .12, xm = lerp(x, x1, .5) + x * .05, ym = lerp(y0, y1, .5);
    return cut([[x - 1.8, y0], [xm - 1, ym], [x1, y1], [xm + 1, ym], [x + 1.8, y0]], 91 + i, 9, .25, false); });
  const fTop = rScallop(u => { const x = lerp(-92, 92, u), v = x / 92; return [x, flaBand(x) - 9 - 4 * v * v]; }, 15, 2.6);
  const fBot = rScallop(u => { const x = lerp(94, -94, u); return [x, flaBand(x) + 9]; }, 13, 6);
  g.capFrill = cut([...fTop, ...fBot], 97, 4, .5, false);
  const bandPts = []; for (let k = 0; k <= 12; k++) { const x = -90 + k / 12 * 180, v = x / 90; bandPts.push([x, flaBand(x) - 4 - 2 * v * v]); }
  g.capBand = cut(rStroke(bandPts, 6.5), 98, 8, .3, false);
  g.capBow = cut(sc(RIG_SHAPES.bow, 1.75), 99, 3, .3, false);
  g.capKnot = cut(ellPts(0, 0, 4.4, 5, 10), 100, 2, .1, false);
  // 表情道具：「哼」气团、汗滴、泪滴
  g.puffCloud = cut(sc(RIG_SHAPES.cloud, 1.2), 101, 4, .4);
  g.sweat = cut(sc(RIG_SHAPES.sweat, 1.3), 102, 3, .2);
  g.drop = cut(sc(RIG_SHAPES.sweat, .55), 103, 2, .1);
  return g;
})();

// ===================== 表情 =====================
// eye open/up/closed，lid 上眼睑盖住的比例，lidTilt 眼睑外端下垂（负数 = 眼角上挑），lower 下眼睑往上推（笑眼），es 眼睛大小，iris 虹膜大小
// brow [上移, 内端下压角]，mouth 嘴型，blush 腮红大小，chin 下巴抬(-)，turn 脸侧开，tilt 歪头；另加 fang 露虎牙、hmph「哼」气团、tears 眼泪、shade 额头阴影
const FLA_MOODS = {
  normal: { eye: 'open', lid: .1, lidTilt: -.02, es: 1.04, brow: [3, -.06], mouth: 'smile', blush: 1.1, fang: true },
  smile: { eye: 'up', brow: [4, -.12], mouth: 'laugh', blush: 1.35, fang: true, tilt: .05 },
  grin: { eye: 'open', lid: .26, lidTilt: -.06, es: 1, lower: 5, brow: [2, -.15], mouth: 'grin', blush: 1.2, fang: true, chin: -.04 },
  surprised: { eye: 'open', es: 1.14, iris: .86, brow: [7, -.12], mouth: 'o', blush: 1 },
  pout: { eye: 'open', lid: .26, lidTilt: -.06, es: .98, brow: [-1, .32], mouth: 'pout', blush: 1.5, puff: true, turn: -.45, look: 1, hmph: true },
  crazy: { eye: 'open', lid: .06, lidTilt: -.16, es: 1.14, iris: .5, brow: [-2, .4], mouth: 'laugh', blush: 1.6, fang: true, tilt: .1, shade: true },
  sad: { eye: 'open', lid: .36, lidTilt: .14, es: .98, brow: [3, -.42], mouth: 'wobble', blush: 1, lookY: 2, chin: .05, tears: true },
};
const FLA_MOOD_ALIAS = { happy: 'smile', proud: 'grin', smug: 'grin', smirk: 'grin', angry: 'pout', annoyed: 'pout', confused: 'surprised', panic: 'surprised', flustered: 'surprised', cry: 'sad', mad: 'crazy', insane: 'crazy', calm: 'normal', sleepy: 'normal', yawn: 'normal' };
const FLA_POSE_ALIAS = { lecture: 'point', hold: 'wand', lift: 'wand', parasol: 'wand', throw: 'wand', proud: 'cheer', happy: 'cheer', hide: 'shy', peek: 'shy', cross: 'shy', think: 'shy',
  lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', slump: 'stand', reach: 'stand' };
// 嘴：借两位的嘴型（大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的），按第三版的脸放大 1.3 倍
const FLA_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']), FLA_MOUTH_K = 1.3;
function flaMouthPts(type, open) {
  const [pts, col, tg] = (FLA_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  const k = p => p && p.map(([x, y]) => [x * FLA_MOUTH_K, y * FLA_MOUTH_K]);
  return [k(pts), col, k(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：标记 behind 背在身后（先于身体画）| late 画在头发和帽子外面（举起的手）
// | wand 拿杖（画在帽子外面；整只手臂在杖后面，只有手指压到前面）| 其他在身体前
// wings [张开量, 下垂]，up 上身下移（坐），shrug 耸肩，lean 上身前倾，wand 拿着莱瓦汀
function flaPose(pose, g, tt) {
  const hipB = [-.6, 1.5, 'fist', false];
  switch (pose) {
    case 'point': return { back: hipB, front: [lerp(1.3, 1.75, g), lerp(.3, 0, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.04, turn: .3, look: .6, wings: [.4, 0], lean: .03 * g };
    case 'wand': return { back: hipB, front: [2.15 + .05 * Math.sin(tt * 1.6), .55, 'grip', 'wand', 1.05, 1.05], wand: true, hr: -.05, turn: .25, look: .5, lookY: -1.5, wings: [.7, 0], shrug: 2 };
    case 'cheer': { const b = .06 * Math.sin(tt * 4);
      return { back: [-2.35 - b, -.4, 'open', 'late', 1.1, 1.1], front: [2.35 + b, .4, 'open', 'late', 1.1, 1.1], hr: .02 * Math.sin(tt * 2), turn: 0, look: 0, lookY: -1.5, wings: [1, 0], shrug: 4, hop: 4 * Math.abs(Math.sin(tt * 4)) }; }
    case 'shy': return { back: [-.25, 1.4, 'open', 'behind'], front: [.3, -1.4, 'open', 'behind'], hr: .1, turn: -.45, look: .8, lookY: 2, wings: [-.1, .25], lean: .035, twist: .9, keepTurn: false };
    case 'sit': return { back: [-.28, .55, 'open', false], front: [.28, -.55, 'open', false], up: FLA_UP, turn: .15, look: .2, wings: [.2, .15], hr: .02 };
    default: return { back: [-.28, .32, 'open', false], front: [.28, -.32, 'open', false], hr: -.02, turn: .15, look: .2, wings: [.25, 0] };
  }
}

// ===================== 部件表 =====================
const flaIs = (...ps) => k => ps.includes(k.pose), flaNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：背在身后的那只，前臂和手先于身体画（被裙子、上衣挡住），上臂和泡泡袖照常画在身前
const flaFore = (k, A) => A.flag === 'behind' ? null : k.G.fore, flaHand = (k, A) => A.flag === 'behind' ? null : k.G[k.S.arm.hands[A.hand]];
const flaArms = f => [
  { arms: f, order: 'arm', items: [['armU', 'uD', 'skin'], [flaFore, 'lD', 'skin'], [flaHand, 'hm', 'skin']], sh: 'mid' },
  { arms: f, items: [['puff', 'u', 'shirt']], sh: 'mid' },
  { arms: f, items: [['cuff', 'u', 'red']], gr: false },
];
// 翅膀的整体转角（水晶骨头用它抵消，让水晶始终朝下垂）
const flaWingRot = k => -.28 - .16 * k.ps.wings[0] + .4 * k.ps.wings[1];
// 帽顶亮面：裁在帽顶里，留出右下一圈浅影（帽顶鼓起来的体积）
function flaCapLight(k) { const m = k.B.capTop, c = k.c; c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.capClip); c.fillStyle = k.K.cap; c.fill(k.G.capLight); c.restore(); }
// crazy：额头到眼睛上半压一片半透明的暗影（裁在脸里，刘海和帽子会盖在上面）
function flaShade(k) {
  const m = k.B.head, c = k.c; c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.faceClip);
  const gr = c.createLinearGradient(0, -110, 0, -46); gr.addColorStop(0, alpha(P.ink, .3)); gr.addColorStop(.55, alpha(P.ink, .12)); gr.addColorStop(1, alpha(P.ink, 0));
  c.fillStyle = gr; c.fillRect(-80, -160, 160, 120); c.restore();
}
const FLA_CRY_N = FLA_BR.at.length;
const FLA_RIG = {
  name: 'flandre', h: 500, height: 520, K: FLA_K, G: FLA_G, cut: FLA_CUT,
  moods: FLA_MOODS, moodAlias: FLA_MOOD_ALIAS, poseAlias: FLA_POSE_ALIAS, pose: flaPose, mouth: flaMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.016, 1.3, .4],
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13, fang: [4.4, .7],
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 104, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: [33, -234], upper: 42, fore: 37, mirrorHand: true,
    tips: Object.fromEntries(Object.entries(RIG_SHAPES.handTip).map(([n, [x, y]]) => [n, [x * FLA_HAND_K, n === 'fist' ? 7.5 : y * FLA_HAND_K]])),
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：比姐姐活泼一点，身子轻晃、呼吸；cheer 时小跳
  vars(k) {
    const { ps, tt } = k;
    k.sway = .01 * Math.sin(tt * 1.4) + .004 * Math.sin(tt * 3.1);
    k.breath = 1.1 * Math.sin(tt * TAU / 2.6);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, FLA_WAIST, k.lean + (ps.twist ? -.03 : 0)), 0, -k.breath);
  },
  bones: [
    { name: 'root', at: k => [0, -(k.ps.hop || 0)], rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    // shy：上身扭开——横向压窄一点、往后错一点（剪纸的「侧身」）
    { name: 'ug', parent: 'body', local: k => k.ps.twist ? rMul(k.ugL, [1 - .1 * k.ps.twist, 0, 0, 1, -4 * k.ps.twist, 0]) : k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, FLA_NECK], rot: k => k.hr, scale: [FLA_HEAD, FLA_HEAD] },
    // 翅膀：先在翅根镜像（左边 scale(-1, 1)），再在镜像后的坐标里转，两边张开、下垂才对称；枝条挂在弹簧上
    { name: 'wingBase', sides: true, parent: 'ug', at: (k, sd) => [sd * 10, -216], scale: (k, sd) => [sd, 1] },
    { name: 'wing', sides: true, parent: (k, sd) => sd < 0 ? 'wingBaseL' : 'wingBaseR', rot: flaWingRot,
      sway: (k, sd) => [.035, 1.5, sd * .7], scale: [FLA_WING, FLA_WING], spring: { len: 110, dir: -.3, mirror: true, gain: .7, f: 2.2, max: .35 } },
    // 水晶：挂在枝条下沿，抵消枝条的转角后朝下垂，每颗各自轻晃（相位错开），也挂一点弹簧
    ...FLA_BR.at.map((p, i) => ({ name: 'cry' + i, sides: true, parent: (k, sd) => sd < 0 ? 'wingL' : 'wingR', at: p, rot: k => -flaWingRot(k),
      sway: (k, sd) => [.09 + .015 * i, 1.7 + .13 * i, i * .8 + sd * .5], spring: { len: 24, gain: .5, f: 2.6, max: .4 } })),
    { name: 'skirt', parent: 'body', pivot: [0, FLA_WAIST], rot: k => k.lean * .5, spring: { len: 140, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: flaIs('sit'), parent: 'root', at: (k, sd) => [sd * 15, 18], rot: (k, sd) => .2 * Math.sin(k.tt * 2.6 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    { name: 'ascotM', parent: 'ug', at: [0, -246] },
    { arms: true },
    // 莱瓦汀：杖身穿过前手的握点，往外斜着举过肩头
    { name: 'wand', when: k => k.ps.wand, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), .32 + .03 * Math.sin(k.tt * 1.6) + rigSpringRot(k, { len: 160, dir: -Math.PI / 2, gain: .25, max: .12 }), FLA_WAND, FLA_WAND); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -118], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 90, gain: .7, f: 2.3, max: .3 } },
    // 侧马尾：根在右边帽檐下沿，往外垂；跟着头晃，带弹簧
    { name: 'tail', parent: 'head', at: [84, -94], rot: k => -.38 - k.hr * .7, sway: [.06, 1.9, .3], spring: { len: 80, gain: .8, f: 2.1, max: .35 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'cap', parent: 'head', at: k => [k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -150], sway: [.01, 1.2, .5] },
    { name: 'capBow', parent: 'cap', at: [-62, flaBand(-62) - 6], rot: -.3, sway: [.04, 2.1, 0], spring: { len: 18, gain: .5, f: 3, max: .4 } },
    { name: 'hmph', when: k => k.md.hmph, parent: 'head', at: [-112, -60], rot: k => -k.hr, sway: [.1, 3, 0], scale: k => { const v = 1 + .05 * Math.sin(k.tt * 5); return [v, v]; } },
  ],
  layers: [
    // 翅膀：枝条在最后面，水晶挂在枝条下（半透明的亮色纸：底色 → 暗半边 → 亮半边）
    { items: [['branch', 'wingL', 'branch'], ['branch', 'wingR', 'branch'], ['branchKnot', 'wingL', 'branchKnot'], ['branchKnot', 'wingR', 'branchKnot']], sh: 'wing' },
    { items: () => { const out = []; for (let i = 0; i < FLA_CRY_N; i++) for (const s of 'LR') out.push(['cry', 'cry' + i + s, 'cry' + i]); return out; }, sh: 'wing', al: .86 },
    { items: () => { const out = []; for (let i = 0; i < FLA_CRY_N; i++) for (const s of 'LR') out.push(['cryLo', 'cry' + i + s, 'cryLo' + i, false], ['cryHi', 'cry' + i + s, 'cryHi' + i, false]); return out; }, gr: false, al: .8 },
    // 后发、侧马尾、背在身后的手
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    { items: [['tail', 'tail', 'hair']], sh: 'mid' },
    { items: [['tailLines', 'tail', 'hairLine', false]], gr: false },
    { arms: A => A.flag === 'behind', order: 'arm', items: [['fore', 'lD', 'skin'], ['@hand', 'hm', 'skin']], sh: 'mid' },
    // 腿
    { when: flaNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: flaNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: flaNot('sit'), items: [['strapL', 'root', 'strap', false], ['strapR', 'root', 'strap', false]], gr: false },
    { when: flaIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 裙子、上身
    { items: [['petti', 'skirt', 'frill']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'dress']], sh: 'big' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    { items: [['hemFrill', 'skirt', 'frill']], sh: 'tiny' },
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'shirt']], sh: 'mid' },
    { items: [['vest', 'ug', 'dress']], sh: 'tiny' },
    { items: [['waist', 'ug', 'vestEdge'], ['buttons', 'ug', 'ascot']], gr: false },
    { items: [['collarL', 'ug', 'shirt'], ['collarR', 'ug', 'shirt']], sh: 'tiny' },
    { items: [['ascot', 'ascotM', 'ascot']], sh: 'tiny', gr: false },
    { items: [['ascotKnot', 'ascotM', 'ascotKnot']], gr: false },
    ...flaArms(A => !['late', 'wand'].includes(A.flag)),
    // 脸、前发、眉毛
    { items: k => [['face', 'head', 'skin'], ...(k.md.puff ? [['cheekPuff', 'head', 'skin']] : [])], sh: 'mid' },
    { call: 'face' },
    { when: k => k.md.shade, call: flaShade },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 睡帽：帽顶（暗面整片 + 亮面裁在里面）→ 褶子 → 荷叶帽檐 → 红缎带 → 蝴蝶结；全部压在头发外面
    { items: [['capPuff', 'capTop', 'capFold']], sh: 'big' },
    { call: flaCapLight },
    { items: [['capPleats', 'capTop', 'pleat', false]], gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    { items: [['capBand', 'cap', 'red']], sh: 'tiny', gr: false },
    { items: [['capBow', 'capBow', 'red']], sh: 'tiny', gr: false },
    { items: [['capKnot', 'capBow', 'redKnot']], gr: false },
    // 侧马尾的红发圈压在帽檐下沿
    { items: [['tailTie', 'tail', 'red']], sh: 'tiny', gr: false },
    // 举起的手（cheer）画在帽子外面
    ...flaArms(A => A.flag === 'late'),
    // 拿杖：袖子、袖口、手掌都在杖后面；杖压在上面，只有手指扣到杖前面、指尖收在杖身边上
    ...flaArms(A => A.flag === 'wand'),
    { when: k => k.ps.wand, items: [['wand', 'wand', 'wand'], ['wandTip', 'wand', 'wand']], sh: 'mid', gr: false },
    { when: k => k.ps.wand, items: [['wandHi', 'wand', 'wandHi', false]], gr: false },
    { when: k => k.ps.wand, items: [['gripFingers', 'wand', 'skin']], sh: 'tiny', gr: false },
    // 表情道具
    { when: k => k.md.hmph, call: rigHmph },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip,
      wand: B.wand ? rApply(B.wand, [14, -126]) : null, wings: [rApply(B.wingBaseL, [0, 0]), rApply(B.wingBaseR, [0, 0])].sort((a, b) => a[0] - b[0]) };
  },
};

function drawFlandre(c, o = {}) { return drawRig(c, FLA_RIG, o); }
