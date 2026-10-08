'use strict';
// 博丽灵梦 —— 剪纸人偶的部件表（第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 博丽神社的巫女：黑里带棕的齐肩发、两侧鬓发用白色发筒束起、头后一个大红蝴蝶结（白镶边）、红色无袖上衣 + 黄领巾、
// 白色分离式宽袖（红袖口）、红长裙（白荷叶下摆、腰后红系带）、白袜棕圆鞋；道具御币（木棍顶上一串白色锯齿纸垂）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawReimu(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], gohei:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和帕秋莉一样，样张里抬高 100）
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，蝴蝶结高出头顶多少各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 两手自然垂下、微微外张（默认）| point 一手叉腰、一手指向前方（gesture 伸多远）
//            gohei 一手叉腰、一手把御币高高举起（纸垂在头侧）| cross 双臂抱胸、脸侧开
//            sit 坐着、两腿垂下轻晃 | bored 懒洋洋：御币扛在肩上、另一手垂着、歪头塌肩
//            旧名兼容：lecture→point、cheer/hold/lift/parasol/throw→gohei、proud/think→cross、slump/tired/doze/hide→bored、
//                      其余（peek/lie/fly/read/walk/run/reach/present…）→stand
//   mood     normal 略不耐烦的平常脸：眼皮微压、眉头略皱、嘴平（默认）| smile 眯眼笑 | smug 半垂眼、嘴角一挑、下巴抬
//            surprised 眼睛睁圆、嘴 o | annoyed 眼睑压低、眉头紧皱、嘴撅 | sleepy 眼皮半垂、嘴放平
//            旧名兼容：happy→smile、proud/smirk→smug、angry/pout→annoyed、confused/panic/flustered/cry→surprised、
//                      calm/awkward→normal、yawn/doze/sad→sleepy
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，gohei 御币顶端（gohei、bored 姿势；其余 null）
//
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -180），root 骨头整体乘 REI_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 REI_HEAD，合起来 1.2 倍：脸宽约 154、下巴到头顶约 180。
// 本文件顶层名字都带 rei / REI 前缀。

// ===================== 颜色（压暗、低饱和；红白要分明，黄领巾要看得出来） =====================
const REI_K = (() => {
  const hair = '#433130', hairBack = '#2f2224', white = '#f7f3ee', red = '#bb3f3d', eye = '#9a3b33', yellow = '#e2bd4f';
  return {
    hair, hairBack, hairLine: mix(hair, '#9a7a68', .35), hairHi: mix(hair, white, .2),
    white, fold: mix(white, '#8f8a9a', .3), frill: '#f6f1ea',
    red, redDeep: mix(red, P.ink, .3), redLite: mix(red, '#ffffff', .12), bowWhite: '#f8f3ec',
    yellow, yellowDeep: mix(yellow, '#7a5a1a', .38),
    skin: P.skin, blush: P.blush, sock: '#f3eee9', shoe: '#5a3a2e', shoeDeep: mix('#5a3a2e', P.ink, .35),
    // 眼睛分层（第三版）：红棕虹膜、下半亮色、深瞳孔、上沿阴影；粗眼线深棕
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#f0a088', .5), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: mix('#3a2422', P.ink, .5), lash: mix('#3a2422', P.ink, .5), brow: mix(hairBack, P.ink, .3),
    mouth: mix(hairBack, P.ink, .5), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    wood: '#b48a58', woodDeep: mix('#b48a58', '#4a3020', .4), shide: '#fbf8f0', shideBack: mix('#fbf8f0', '#9a9488', .3), gold: P.gold,
  };
})();
const REI_CUT = rigCutter(6000);
// 身子坐标：脖子 -212、腰 -180；root 乘 REI_BODY（脖子落在 -248），头再乘 REI_HEAD（合起来 1.2）；坐下时上身下移 REI_UP（×1.17 ≈ 100）
const REI_BODY = 1.17, REI_NECK = -212, REI_WAIST = -180, REI_HEAD = 1.2 / REI_BODY, REI_UP = 86;

// ===================== 部件（载入时剪好） =====================
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变
const reiHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
// 二次贝塞尔取 n 个点（不含起点）
const reiQuad = (a, c, b, n = 6) => Array.from({ length: n }, (_, k) => { const u = (k + 1) / n, v = 1 - u; return [v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]; });
// 御币的纸垂：从棍顶往外、往下折三折的锯齿纸条（sd 朝哪边，s 大小）
const reiShidePts = (sd, s, y0) => { const zz = [[1.5, 0], [11, 6], [4, 16], [14, 22], [7, 32], [17, 38], [10, 48]].map(([x, y]) => [sd * x * s, y0 + y * s]); return rStroke(zz, 6.2 * s); };
const REI_GOHEI_TOP = -132;
const REI_G = (() => {
  const cut = REI_CUT, g = {};
  // ---- 腿（站姿，脚底为原点，身子坐标）：一截白袜 + 棕色圆鞋，鞋尖朝前一点 ----
  g.legL = cut([[-20, -56], [-8, -56], [-8.5, -12], [-19.5, -12]], 10, 6, .3, false); g.legR = cut([[8, -56], [20, -56], [19.5, -12], [8.5, -12]], 11, 6, .3, false);
  g.shoeL = cut(ellPts(-14, -9, 15, 9.5, 18), 12, 5, .4); g.shoeR = cut(ellPts(15, -9, 15, 9.5, 18), 13, 5, .4);
  g.strapL = cut([[-25, -16.5], [-5, -16.5], [-5, -13.6], [-25, -13.6]], 14, 4, .1, false); g.strapR = cut([[6, -16.5], [26, -16.5], [26, -13.6], [6, -13.6]], 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.5, 18], [4.8, 30], [-4.8, 30], [-5.5, 18]], 16, 8, .4);
  g.sitShoe = cut(ellPts(3, 33, 12.5, 8, 16), 17, 5, .4);
  // ---- 红长裙（腰 -180 到 -58）：钟形，下摆一圈白荷叶边；几道深红褶 ----
  g.skirt = cut([[-25, -184], [0, -185], [25, -184], [30, -168], [37, -146], [46, -120], [56, -94], [66, -70], [70, -60], [0, -56], [-70, -60], [-66, -70], [-56, -94], [-46, -120], [-37, -146], [-30, -168]], 20, 10, .7);
  g.skirtFrill = cut([...rOpen([[-68, -66], [0, -62], [68, -66]], 6), ...rScallop(u => [lerp(75, -75, u), -50 + 3 * (1 - (2 * u - 1) ** 2)], 12, 4.5)], 21, 4, .45, false);
  g.folds = [-.75, -.38, 0, .38, .75].map((u, i) => { const xt = u * 18, xb = u * 58; return cut([[xt - .8, -172], [xt + .8, -172], [xb + 1.6, -64], [xb - 1.6, -64]], 23 + i, 11, .4, false); });
  // 腰后的红系带：一个大蝴蝶结藏在腰后，两只耳朵从腰两侧露出来
  g.waistBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 4.3, -177 + y * 2.6]), 30, 6, .5);
  g.waistBowFold = [-1, 1].map((sd, i) => cut([[sd * 26, -180], [sd * 44, -186], [sd * 45, -183], [sd * 28, -177]], 31 + i, 6, .2, false));
  // ---- 上身：红色无袖上衣（肩膀露出来）、腰带、白色小立领、黄领巾 ----
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 40, 8, .3, false);
  g.top = cut([[-12, -216], [12, -216], [19, -212], [22, -204], [24, -194], [27, -184], [27, -176], [-27, -176], [-27, -184], [-24, -194], [-22, -204], [-19, -212]], 41, 8, .5);
  g.topHem = cut([...rOpen([[-27.5, -181], [0, -181.5], [27.5, -181]], 4), ...rScallop(rLine([28, -176], [-28, -176]), 7, 2.2)], 42, 4, .25, false);
  g.collar = cut([[-11, -220], [11, -220], [12.5, -210], [0, -206.5], [-12.5, -210]], 43, 4, .2, false);
  g.ascotTails = [-1, 1].map((sd, i) => cut([[sd * 1, -207], [sd * 5.5, -207], [sd * 8.5, -189], [sd * 5, -186.5], [sd * 3, -190], [sd * .2, -188]], 44 + i, 4, .2, false));
  g.ascot = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * 1.1, -208 + y * .95]), 46, 3, .25, false);
  g.ascotKnot = cut(ellPts(0, -208, 3, 3.4, 8), 47, 2, .1, false);
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：露在外面的上臂（肩为原点）、白色分离宽袖（上臂一截 + 前臂喇叭袖）、红袖口、袖口上沿的红绑带、手 ----
  g.armU = cut([[-6.8, -5], [0, -8], [6.8, -5], [7.6, 10], [7.6, 26], [7.2, 38], [0, 41], [-7.2, 38], [-7.6, 26], [-7.6, 10]], 50, 8, .3);
  g.sleeveU = cut([[-9.5, 14], [9.5, 14], [12, 26], [13, 40], [-13, 40], [-12, 26]], 51, 7, .35);
  g.sleeveBand = cut([[-9.8, 12.5], [9.8, 12.5], [10.4, 17.5], [-10.4, 17.5]], 52, 5, .15, false);
  g.sleeveF = cut([[-12, -5], [-6, -9], [0, -10], [6, -9], [12, -5], [15.5, 8], [19.5, 20], [23, 33], [0, 35], [-23, 33], [-19.5, 20], [-15.5, 8]], 53, 8, .45);
  g.sleeveFolds = [-1, 1].map((sd, i) => cut([[sd * 4 - .7, 0], [sd * 4 + .7, 0], [sd * 15 + 1.2, 28], [sd * 15 - 1.2, 28]], 54 + i, 9, .3, false));
  g.sleeveCuff = cut([[-23.2, 29], [0, 31], [23.2, 29], [23.6, 34.5], [0, 36.5], [-23.6, 34.5]], 56, 5, .2, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(reiHandPts(H.open), 60, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 61, 3, .25);
  g.handPoint = cut(reiHandPts(H.point), 62, 3, .2, false); g.handGrip = cut(reiHandPts(H.grip), 63, 3, .2, false);
  // ---- 御币（握点为原点，木棍朝 -y）：木棍、顶上一圈金箍、两侧各两条锯齿纸垂（后面一对浅灰小一点） ----
  g.stick = cut(rStroke([[0, 18], [0, REI_GOHEI_TOP - 4]], 3.6), 70, 10, .15, false);
  g.stickCap = cut([[-3.4, REI_GOHEI_TOP - 7], [3.4, REI_GOHEI_TOP - 7], [3.4, REI_GOHEI_TOP - 2], [-3.4, REI_GOHEI_TOP - 2]], 71, 3, .1, false);
  g.stickKnob = cut(ellPts(0, REI_GOHEI_TOP - 9, 2.6, 2.6, 8), 72, 2, .1, false);
  g.shideBack = [-1, 1].map((sd, i) => cut(reiShidePts(sd, 1.1, REI_GOHEI_TOP + 2), 73 + i, 4, .2, false));
  g.shide = [-1, 1].map((sd, i) => cut(reiShidePts(sd, 1.35, REI_GOHEI_TOP - 2).map(([x, y]) => [x + sd * 1, y]), 75 + i, 4, .2, false));
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 100, 7, .5);
  // 后发：齐肩，比脸宽一圈，发梢剪成几道尖、微微往里收
  const bSide = rOpen([[0, -178], [40, -174], [66, -153], [79, -118], [84, -80], [84, -42], [82, -6], [80, 22]], 5);
  const bTips = [[74, 34], [66, 22], [58, 32], [48, 18], [36, 28], [22, 14], [0, 18]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 101, 9, .8, false);
  g.hairStrands = [-54, -26, 26, 54].map((x0, i) => cut(rStroke(rOpen([[x0 * .9, -60], [x0 * 1.02, -20], [x0 * 1.06, 12]], 4), u => 2.2 - 1.2 * u), 102 + i, 6, .2, false));
  // 鬓发：从太阳穴垂到胸口，两侧压在脸外缘；胸口高度套一个白色发筒，发筒下沿垂一排流苏，下面再露一截发尾（根在 (±58,-118)）
  const lockR = [...rOpen([[48, -134], [66, -122], [75, -92], [77, -56], [76, -22], [76, 10], [76, 40], [74, 62]], 4), [72, 78], [68, 66], [64, 80], [62, 62],
    ...rOpen([[62, 40], [61, 10], [60, -22], [61, -56], [58, -90], [47, -122]], 4)];
  g.lockR = cut(lockR, 110, 6, .5, false); g.lockL = cut(rMirror(lockR), 111, 6, .5, false);
  const tubeR = [[58, -4], [79, -4], [80.5, 10], [80, 24], [57, 24], [56.5, 10]];
  g.tubeR = cut(tubeR, 112, 5, .25); g.tubeL = cut(rMirror(tubeR), 113, 5, .25);
  const tubeBandR = [[57.5, -7], [79.5, -7], [80, -2], [57, -2]];
  g.tubeBandR = cut(tubeBandR, 114, 4, .1, false); g.tubeBandL = cut(rMirror(tubeBandR), 115, 4, .1, false);
  const fringe = sd => [58.5, 62.5, 66.5, 70.5, 74.5, 78.5].map((x, i) => rStroke([[sd * x, 23], [sd * (x + .4), 31], [sd * (x + .8), 38 + (i % 2) * 5]], u => 3 - 1.4 * u));
  g.tubeFringeR = fringe(1).map((p, i) => cut(p, 116 + i, 4, .1, false)); g.tubeFringeL = fringe(-1).map((p, i) => cut(p, 124 + i, 4, .1, false));
  const tubeLines = (sd, j) => [6, 15].map((y, i) => cut([[sd * 57, y], [sd * 80.5, y], [sd * 80.5, y + 1.3], [sd * 57, y + 1.3]], 132 + j * 2 + i, 6, .1, false));
  g.tubeLinesL = tubeLines(-1, 0); g.tubeLinesR = tubeLines(1, 1);
  // 刘海：盖住整个头顶（没有帽子，刘海的上沿就是头顶的轮廓），下缘一绺一绺的尖压到眼睛上沿；正中一绺最长，垂在两眼之间
  const fNotch = [[73, -116], [53, -100], [31, -110], [8, -98], [-10, -98], [-33, -110], [-55, -102], [-73, -116]];
  const fTip = [[-84, 6], [-74, 4], [-72, 4], [-60, 0], [-72, 4], [-75, 4], [-85, 6]];
  const fTips = fTip.map(([ty, hook], i) => { const a = fNotch[i], b = fNotch[i + 1], mx = (a[0] + b[0]) / 2; return [mx - Math.sign(mx) * hook, ty]; });
  const fEdge = fTips.flatMap((t, i) => { const a = fNotch[i], b = fNotch[i + 1];
    return [...reiQuad(a, [a[0] + (t[0] - a[0]) * .12, a[1] + (t[1] - a[1]) * .78], t), ...reiQuad(t, [b[0] + (t[0] - b[0]) * .12, b[1] + (t[1] - b[1]) * .78], b)]; });
  g.bangs = cut([[-73, -116], [-71, -146], [-57, -166], [-31, -177], [0, -180], [31, -177], [57, -166], [71, -146], ...fEdge.slice(0, -1)], 140, 5, .35, false);
  g.bangLines = [1, 2, 4, 5].map((i, k) => { const t = fTips[i], a = fNotch[i], b = fNotch[i + 1], mx = (a[0] + b[0]) / 2;
    return cut(rStroke([[t[0] + (mx - t[0]) * .25, t[1] - 9], ...reiQuad([t[0] + (mx - t[0]) * .25, t[1] - 9], [mx + (mx >= 0 ? 3 : -3), -104], [mx * 1.05 + (mx >= 0 ? 2 : -2), -128], 8)], u => .4 + 2.2 * u), 141 + k, 6, .15, false); });
  // 头顶光泽：一道弯弯的浅色细弧
  g.hairShine = cut(rStroke(Array.from({ length: 11 }, (_, k) => { const a = Math.PI * (1.18 + k / 10 * .5); return [62 * Math.cos(a), -118 + 50 * Math.sin(a)]; }), u => 1 + 3 * Math.sin(Math.PI * u)), 146, 6, .15, false);
  // 头后的大红蝴蝶结（结在后脑 (0,-138)，被头和头发挡住；两只大耳朵从头的两侧往上张开），白镶边是后面一层稍大的白纸
  // 翼：从结往外上方张开，外沿是一道略内凹的直边（布圈压扁的样子），上下两个角；褶子从结往外沿散开
  const loopR = [[4, -6], [24, -24], [52, -48], [80, -66], [94, -66], [97, -50], [94, -32], [97, -12], [94, 6], [80, 10], [52, 8], [24, 6], [4, 6]];
  const trimR = rScallop(u => { const p = spline(loopR.slice(1, 12), 3, false); return p[Math.min(p.length - 1, Math.round(u * (p.length - 1)))]; }, 14, 3.4);
  g.bowTrimR = cut([[4, -6], ...trimR.map(([x, y]) => [x * 1.07 + 1, y * 1.08]), [4, 6]], 150, 4, .3, false); g.bowTrimL = cut(rMirror([[4, -6], ...trimR.map(([x, y]) => [x * 1.07 + 1, y * 1.08]), [4, 6]]), 151, 4, .3, false);
  g.bowR = cut(loopR, 154, 7, .5); g.bowL = cut(rMirror(loopR), 155, 7, .5);
  g.bowCreases = [[[12, -6], [80, -54]], [[12, -1], [88, -26]], [[12, 3], [86, 0]], [[12, -9], [58, -46]]].flatMap(([a, b], i) => [1, -1].map(sd => {
    const ax = a[0] * sd, bx = b[0] * sd, mx = lerp(ax, bx, .5), my = lerp(a[1], b[1], .5) + 3;
    return cut([[ax, a[1] - 2], [mx, my - 1.2], [bx, b[1]], [mx, my + 1.2], [ax, a[1] + 2]], 158 + i * 2 + (sd > 0 ? 0 : 1), 9, .2, false); }));
  g.bowShadeR = cut([[60, 6], [80, 9], [93, 5], [96, -10], [84, -4], [64, 0]], 168, 5, .2, false); g.bowShadeL = cut(rMirror([[60, 6], [80, 9], [93, 5], [96, -10], [84, -4], [64, 0]]), 169, 5, .2, false);
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat.map(([x, y]) => [x * 1.3, y * 1.3]), 170, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂（负：外端上挑），lower 下眼睑托起，es 眼睛大小，iris 虹膜大小，brow [上移, 内端下压角]，chin 下巴抬（负）
// 灵梦的平常脸：眼皮压下两三成、外端略挑，眉头略压——一副「又有什么麻烦事」的样子
const REI_MOODS = {
  normal: { eye: 'open', lid: .26, lidTilt: -.04, es: 1, brow: [0, .16], mouth: 'flat', blush: .8 },
  smile: { eye: 'open', lid: .12, lidTilt: .02, lower: 5, es: 1, brow: [3, -.12], mouth: 'smile', blush: 1.15 },
  smug: { eye: 'open', lid: .44, lidTilt: .02, lower: 3, es: 1, brow: [2, -.16], mouth: 'smirk', blush: .9, chin: -.1 },
  surprised: { eye: 'open', lid: 0, es: 1.1, iris: .78, brow: [7, -.12], mouth: 'o', blush: .9 },
  annoyed: { eye: 'open', lid: .5, lidTilt: -.06, es: 1, brow: [-2, .4], mouth: 'pout', blush: 1, sweat: false },
  sleepy: { eye: 'open', lid: .66, lidTilt: .1, es: 1, brow: [-1, -.1], mouth: 'flat', blush: .9, lookY: 1.5 },
};
const REI_MOOD_ALIAS = { happy: 'smile', proud: 'smug', smirk: 'smug', angry: 'annoyed', pout: 'annoyed', confused: 'surprised', panic: 'surprised', flustered: 'surprised', cry: 'surprised', calm: 'normal', awkward: 'normal', yawn: 'sleepy', doze: 'sleepy', sad: 'sleepy' };
const REI_POSE_ALIAS = { lecture: 'point', cheer: 'gohei', hold: 'gohei', lift: 'gohei', parasol: 'gohei', throw: 'gohei', proud: 'cross', think: 'cross', slump: 'bored', tired: 'bored', doze: 'bored', hide: 'bored',
  peek: 'stand', lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', reach: 'stand', present: 'stand', kungfu: 'stand', startle: 'stand' };
// 嘴：smile、o 用琪露诺的，其余用帕秋莉的；Q 版脸大，嘴整体放大 1.3 倍。他们返回的颜色是色值，rig 要颜色键，这里换回来
const REI_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const reiScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
function reiMouthPts(type, open) {
  const [pts, col, tg] = (REI_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [reiScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', reiScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
// gohei：前手握着御币，值是御币相对上身的转角（0 竖直朝上）；up 上身下移（坐），sink 头往下沉，shrug 耸肩（负：塌肩），lean 前倾，hr 歪头，turn 脸侧开
function reiPose(pose, g, tt) {
  const hipB = [-.95, 1.7, 'fist', false];
  switch (pose) {
    case 'point': return { back: hipB, front: [lerp(1.35, 1.9, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    case 'gohei': return { back: hipB, front: [2.62 + .04 * Math.sin(tt * 1.6), .3, 'grip', false], gohei: .38 + .05 * Math.sin(tt * 1.6), hr: -.05, turn: .25, look: .5, lookY: -1.5 };
    case 'cross': return { back: [-.32, 2.15, 'fist', false, 1, 1.15], front: [.3, -2.1, 'fist', false, 1, 1.15], hr: -.05, turn: -.35, look: .9, keepTurn: true };
    case 'sit': return { back: [-.3, .62, 'open', false], front: [.3, -.62, 'open', false], up: REI_UP, turn: .15, look: .2, hr: .06 };
    case 'bored': return { back: [-.06, .04, 'open', false], front: [.42, -2.1, 'grip', false], gohei: -.72 + .03 * Math.sin(tt * 1.1), hr: .15 + .02 * Math.sin(tt * .9), sink: 4, shrug: -3, lean: .025, turn: .12, look: .2, lookY: 1 };
    default: return { back: [-.16, .1, 'open', false], front: [.16, -.1, 'open', false], hr: .03, turn: .12, look: .2 };
  }
}

// ===================== 部件表 =====================
const reiIs = (...ps) => k => ps.includes(k.pose), reiNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：手先画，露出的上臂、前臂喇叭袖、上臂那截袖子、袖褶、红绑带、红袖口（袖子和袖口同一层）。
// 握御币的那只手不在这里画——袖子整条在木棍后面，木棍画完再只压手指上去（见图层表）
const reiHandPart = (k, A) => k.ps.gohei != null && A === k.AF ? null : k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
const REI_ARMS = { arms: 'all', order: 'arm', sh: 'mid', items: [[reiHandPart, 'hm', 'skin'], ['armU', 'uD', 'skin'], ['sleeveF', 'lD', 'white'], ['sleeveU', 'uD', 'white'], ['sleeveFolds', 'lD', 'fold', false], ['sleeveBand', 'uD', 'red', false], ['sleeveCuff', 'lD', 'red', false]] };
// 坐下时裙子绕腰压扁一点、放宽一点，裙摆刚好盖过座沿
const REI_SIT_SKIRT = (() => { const sx = 1.08, sy = .8; return [sx, 0, 0, sy, 0, REI_WAIST * (1 - sy)]; })();
const REI_RIG = {
  name: 'reimu', h: 500, height: 520, K: REI_K, G: REI_G, cut: REI_CUT,
  moods: REI_MOODS, moodAlias: REI_MOOD_ALIAS, poseAlias: REI_POSE_ALIAS, pose: reiPose, mouth: reiMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.014, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 298, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: [28, -200], upper: 36, fore: 36, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  vars(k) {
    const { ps, tt } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, REI_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway, scale: [REI_BODY, REI_BODY] },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, REI_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [REI_HEAD, REI_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.ps.up ? REI_SIT_SKIRT : null, pivot: [0, REI_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: reiIs('sit'), parent: 'root', at: (k, sd) => [sd * 15, 8], rot: (k, sd) => .18 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .07 * sd },
    { arms: true },
    // 御币：木棍穿过前手的握点（整根放大到 1.1）；gohei 举起时竖直略外倾，bored 时往后斜扛在肩上
    { name: 'gohei', when: k => k.ps.gohei != null, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), k.ps.gohei + rigSpringRot(k, { len: 120, dir: -Math.PI / 2, gain: .3, max: .12 }), 1.1, 1.1); } },
    { name: 'shideM', when: k => k.ps.gohei != null, parent: 'gohei', pivot: [0, REI_GOHEI_TOP], rot: k => -k.ps.gohei * .6, sway: [.05, 2.3, .4] },
    { name: 'gripHand', when: k => k.ps.gohei != null, m: k => k.AF.hm },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    // 后发：只跟一点头的转动（绕脖子把头的转角退回去一半），带弹簧
    { name: 'hairB', parent: 'head', rot: k => -k.hr * .5, sway: [.006, 1.1, .5], spring: { len: 120, gain: .4, f: 1.6, max: .1 } },
    // 大蝴蝶结：结贴在后脑，跟着头走，两只耳朵轻轻扇
    { name: 'bow', parent: 'head', at: [0, -140], scale: [1.12, 1.12], sway: [.012, 1.4, .3], spring: { len: 80, dir: -Math.PI / 2, gain: .4, f: 2.2, max: .08 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -118], rot: k => -k.hr * .55, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 140, gain: .6, f: 2, max: .25 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
  ],
  layers: [
    // 头后的大蝴蝶结（白镶边在后、红面在前，结藏在头后）
    { items: [['bowTrimL', 'bow', 'bowWhite'], ['bowTrimR', 'bow', 'bowWhite']], sh: 'big' },
    { items: [['bowL', 'bow', 'red'], ['bowR', 'bow', 'red']], sh: 'tiny' },
    { items: [['bowShadeL', 'bow', 'redDeep', false], ['bowShadeR', 'bow', 'redDeep', false], ['bowCreases', 'bow', 'redDeep', false]], gr: false },
    // 后发
    { items: [['backHair', 'hairB', 'hairBack']], sh: 'big' },
    { items: [['hairStrands', 'hairB', 'hairLine', false]], gr: false, al: .6 },
    // 腿
    { when: reiNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: reiNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: reiNot('sit'), items: [['strapL', 'root', 'shoeDeep'], ['strapR', 'root', 'shoeDeep']], gr: false },
    { when: reiIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 腰后的红系带（耳朵从腰两侧露出来）、白荷叶下摆、红裙、褶
    { items: [['waistBow', 'skirt', 'red']], sh: 'mid' },
    { items: [['waistBowFold', 'skirt', 'redDeep', false]], gr: false },
    { items: [['skirtFrill', 'skirt', 'frill']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'red']], sh: 'big' },
    { items: [['folds', 'skirt', 'redDeep', false]], gr: false },
    // 上身：红色无袖上衣（下沿一道白荷叶）、白立领、黄领巾
    { items: [['neck', 'ug', 'skin', false], ['top', 'ug', 'red']], sh: 'mid' },
    { items: [['topHem', 'ug', 'frill']], sh: 'tiny' },
    { items: [['collar', 'ug', 'white']], sh: 'tiny', gr: false },
    { items: [['ascotTails', 'ug', 'yellowDeep'], ['ascot', 'ug', 'yellow']], sh: 'tiny' },
    { items: [['ascotKnot', 'ug', 'yellowDeep']], gr: false },
    // 手臂（握御币的手除外）
    REI_ARMS,
    // 御币：后面一对纸垂、木棍、金箍，前面一对纸垂；握御币的手指再压在木棍上
    { when: k => k.ps.gohei != null, items: [['shideBack', 'shideM', 'shideBack']], sh: 'tiny' },
    { when: k => k.ps.gohei != null, items: [['stick', 'gohei', 'wood']], sh: 'mid' },
    { when: k => k.ps.gohei != null, items: [['stickCap', 'gohei', 'gold'], ['stickKnob', 'gohei', 'gold']], sh: 'tiny', gr: false },
    { when: k => k.ps.gohei != null, items: [['shide', 'shideM', 'shide']], sh: 'tiny' },
    { when: k => k.ps.gohei != null, items: [['handGrip', 'gripHand', 'skin']], sh: 'tiny' },
    // 脸、鬓发（套白发筒）、刘海、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false], ['hairShine', 'bangs', 'hairHi', false]], gr: false },
    { items: [['tubeFringeL', 'lockL', 'white'], ['tubeFringeR', 'lockR', 'white']], sh: 'tiny', gr: false },
    { items: [['tubeL', 'lockL', 'white'], ['tubeR', 'lockR', 'white']], sh: 'tiny' },
    { items: [['tubeLinesL', 'lockL', 'fold', false], ['tubeLinesR', 'lockR', 'fold', false], ['tubeBandL', 'lockL', 'red'], ['tubeBandR', 'lockR', 'red']], gr: false },
    { call: 'brows' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, gohei: B.gohei ? rApply(B.gohei, [0, REI_GOHEI_TOP - 9]) : null };
  },
};

function drawReimu(c, o = {}) { return drawRig(c, REI_RIG, o); }
