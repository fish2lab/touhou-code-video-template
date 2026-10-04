'use strict';
// 帕秋莉·诺蕾姬 —— 剪纸人偶（第二版画风，见 docs/画风v2.md「帕秋莉」一节）。纯 Canvas 代码绘制，不加载任何图片。
//
// drawPatchouli(c, o) → { head:[x,y], hands:[[x,y],[x,y]], book:[x,y], tip:[x,y] }
//   x, y     锚点。stand 等站姿：脚底中心；sit：坐着的那条线上臀部中心；peek：她扒着的那条边线的中点；
//            lie：躺着贴地那条边的中点（facing=1 时头朝左）
//   h        全身高（帽顶到脚底），默认 520。所有姿势共用这个比例（坐着、躺着时人偶大小不变）
//   facing   1 朝右 / -1 朝左（整张人偶镜像，投影方向不变）
//   pose     stand 双手抱书 | lecture 一臂抱书、另一只袖子比划（gesture 0..1 抬起程度，不传则缓慢起伏）
//            point 手臂伸向前上方 | hide 书推上来挡住下半张脸 | cross 抱书双臂交叉、下巴抬起、脸侧开（傲娇）
//            sit 坐着、两腿垂下轻晃 | peek 只露帽子、头和两只扒着边线的手 | tired 驼背低头、袖子垂下、书吊在手上
//            lift 双手举过头顶（hands 是杠铃握点）| lie 抱书仰躺
//            旧名兼容：read→stand、shrug/cheer→lecture、walk/run→stand、slump→tired、flat→lie
//   mood     normal 半眯ジト目（默认）| smug 闭眼弧线+嘴角一挑+下巴抬 | pout 鼓腮、侧目、「哼」气团
//            flustered 脸红加大、眼睛睁圆、冒汗 | annoyed ジト目更低、嘴抿成波浪 | sleepy | surprised | smile
//            旧名兼容：sad→sleepy、happy→smile、calm→normal、confused→surprised、panic→flustered
//   look     -1..1 眼珠左右（+ 朝 facing 那边）  tilt 头部倾斜（弧度，+ 朝前低头）
//   mouth    0..1 说话张嘴   blink 0..1 闭眼   t 秒（待机呼吸、发梢和帽檐轻晃；一拍两帧）
//   返回值都是调用方坐标系里的点：head 脸中心，hands 两只手的指尖/握点（按屏幕 x 从左到右），book 书的中心，
//   tip 指东西那只（前手）的指尖。
//
// drawPatchouliChibi(c, o)：第一版 Q 版接口的兼容别名（stand/flat/lift/sit/lie/run → 上面的 pose），返回同样结构。
//
// 做法：每个部件是一片剪纸（kit 的 scissor 剪刀边 + 纸纹），轮廓在载入时剪好（seed 固定），每帧只做仿射变换——
// 部件绕脖子、肩、肘转，边缘不抖；「活」来自整片轻晃和投影的微小变化。同一层的部件合并成一条路径画一次投影。
// 设计坐标：人偶高 520，脚底 (0,0)，y 向下；头部件用「头坐标」（原点在脖子关节，下巴尖约 (0,-6)）。
// 本文件顶层名字都带 pch 前缀。

// ===================== 颜色（只用 P 里帕秋莉那组，及它们之间的混色） =====================
const PCH_K = {
  hair: P.hair, hairBack: P.hairDark, hairLine: mix(P.hairDark, P.hair, .35),
  dress: P.dress, stripe: P.stripe, robe: mix(P.dress, P.stripe, .42), trim: mix(P.dress, P.cap, .5),
  cap: P.cap, capFold: mix(P.cap, P.stripe, .38), skin: P.skin, blush: P.blush,
  eye: mix(P.hairDark, P.ink, .5), lid: mix(P.hairDark, P.ink, .78), brow: mix(P.hairDark, P.ink, .45),
  mouth: mix(P.hairDark, P.ink, .55), mouthIn: mix(P.ribbonRed, P.ink, .45),
  book: mix(mix(P.ribbonRed, P.moon, .25), P.ink, .5), bookSpine: mix(mix(P.ribbonRed, P.moon, .25), P.ink, .66), pages: mix(P.cap, P.paperEdge, .35),
  gold: P.moon, red: P.ribbonRed, blue: P.ribbonBlue, shoe: mix(P.cap, P.stripe, .28), leg: mix(P.skin, P.cap, .3),
  sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
};
const PCH_EDGE = {};
const pchEdge = col => PCH_EDGE[col] || (PCH_EDGE[col] = alpha(mix(col, '#ffffff', .5), .6));

// ===================== 矩阵（[a,b,c,d,e,f]，和 canvas 的 transform 同序） =====================
const pchMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const pchApply = (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]];
// pchTR：m × 平移(x,y) × 旋转 a × 缩放(sx,sy)
function pchTR(m, x = 0, y = 0, a = 0, sx = 1, sy = 1) { const co = Math.cos(a), si = Math.sin(a); return pchMul(m, [co * sx, si * sx, -si * sy, co * sy, x, y]); }
// pchPivot：m × 绕点 (px,py) 转 a
const pchPivot = (m, px, py, a) => pchTR(pchTR(m, px, py, a), -px, -py);
const PCH_I = [1, 0, 0, 1, 0, 0];

// ===================== 剪纸轮廓 =====================
// pchCut：轮廓 → 剪刀剪出的 Path2D（smooth 先过 Catmull-Rom；step 剪刀段长，amp 折角幅度）
function pchCut(pts, seed, step = 8, amp = .7, smooth = true) { return polyPath(scissor(smooth ? spline(pts, 3, true) : pts, seed, step, amp), true); }
const pchMirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const pchOpen = (pts, step = 4) => spline(pts, step, false);
// pchScallop：沿曲线 f(u)（u: 0→1）做 n 个荷叶边鼓包：往 +x 走时鼓向上，往 -x 走时鼓向下（屏幕坐标），深 depth
function pchScallop(f, n, depth, m = 4) {
  const out = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
    const u = (i + k / m) / n, p = f(u), q = f(Math.min(1, u + .01)), r = f(Math.max(0, u - .01)), dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, b = Math.sin(Math.PI * k / m) * depth;
    out.push([p[0] + dy / l * b, p[1] - dx / l * b]);
  }
  out.push(f(1)); return out;
}
const pchLine = (a, b) => u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
// 月牙：开口朝 +x，r 外半径，th 最厚处
function pchCrescent(r, th, phi = .95) {
  const out = [], cx = r * Math.cos(phi), rx = cx + r - th, ry = r * Math.sin(phi);
  for (let k = 0; k <= 24; k++) { const a = phi + k / 24 * (TAU - 2 * phi); out.push([r * Math.cos(a), r * Math.sin(a)]); }
  for (let k = 1; k < 16; k++) { const a = -Math.PI / 2 + k / 16 * Math.PI; out.push([cx - rx * Math.cos(a), ry * Math.sin(a)]); }
  return out;
}
// 小蝴蝶结（宽约 22）：两只耳朵 + 两条尾巴，一片剪出来
const PCH_BOW_PTS = [[0, -2.5], [-5, -6], [-10, -7], [-11.5, -1], [-9, 5], [-3, 2.5], [-6, 11], [-2.5, 11.5], [0, 4], [2.5, 11.5], [6, 11], [3, 2.5], [9, 5], [11.5, -1], [10, -7], [5, -6]];

// ===================== 静态部件（载入时剪好） =====================
const PCH_G = (() => {
  const g = {};
  // ---- 身体（站姿，脚底为原点） ----
  // 钟形睡袍：肩窄，裙摆微微张开到脚踝
  g.dress = pchCut([[-16, -298], [0, -300], [16, -298], [26, -290], [29, -262], [31, -215], [37, -160], [48, -100], [62, -46], [66, -30], [-66, -30], [-62, -46], [-48, -100], [-37, -160], [-31, -215], [-29, -262], [-26, -290]], 11, 10, .8);
  // 裙摆荷叶边（下缘中间略低，像从略高处看圆裙）
  g.hem = pchCut([...pchOpen([[-68, -38], [0, -35], [68, -38]], 6), ...pchScallop(u => [lerp(72, -72, u), -21 + 4 * (1 - (2 * u - 1) ** 2)], 11, 5)], 12, 4, .5, false);
  // 竖条纹：贴在睡袍上的细纸条（按裙形向下散开）
  g.stripes = [-.78, -.52, -.26, 0, .26, .52, .78].map((u, i) => { const xt = u * 26, xb = u * 62;
    return pchCut([[xt - 2.3, -291], [xt + 2.3, -291], [xb + 3.4, -38], [xb - 3.4, -38]], 30 + i, 12, .5, false); });
  // 外袍：两片，前面敞开露出条纹
  const robeL = [[-9, -297], [-20, -297], [-28, -291], [-32, -262], [-35, -212], [-41, -155], [-52, -98], [-66, -46], [-45, -42], [-26, -46], [-21, -100], [-16, -180], [-12, -250]];
  g.robeL = pchCut(robeL, 21, 10, .8); g.robeR = pchCut(pchMirror(robeL), 22, 10, .8);
  const trimL = [[-12, -250], [-16, -180], [-21, -100], [-24, -45], [-20.5, -45], [-17.5, -100], [-12.5, -180], [-8.5, -250], [-6, -296], [-9, -297]];
  g.trimL = pchCut(trimL, 23, 9, .4, false); g.trimR = pchCut(pchMirror(trimL), 24, 9, .4, false);
  g.shoeL = pchCut(ellPts(-12, -6, 9.5, 6, 14), 25, 5, .4); g.shoeR = pchCut(ellPts(12, -6, 9.5, 6, 14), 26, 5, .4);
  // 坐姿（座面为原点）：睡袍盖住膝盖垂到座沿下面
  g.sitDress = pchCut([[-17, -148], [0, -150], [17, -148], [29, -140], [32, -112], [35, -60], [44, -18], [55, 2], [59, 16], [-59, 16], [-55, 2], [-44, -18], [-35, -60], [-32, -112], [-29, -140]], 13, 10, .8);
  g.sitHem = pchCut([...pchOpen([[-61, 10], [0, 12], [61, 10]], 6), ...pchScallop(u => [lerp(64, -64, u), 26 + 3 * (1 - (2 * u - 1) ** 2)], 9, 5)], 14, 4, .5, false);
  g.sitStripes = [-.78, -.52, -.26, 0, .26, .52, .78].map((u, i) => { const xt = u * 29, xb = u * 58;
    return pchCut([[xt - 2.3, -141], [xt + 2.3, -141], [xb + 3.4, 14], [xb - 3.4, 14]], 40 + i, 12, .5, false); });
  const sitRobeL = [[-9, -147], [-21, -147], [-31, -141], [-35, -112], [-38, -60], [-48, -16], [-59, 8], [-40, 10], [-25, 6], [-21, -30], [-15, -90], [-11, -110]];
  g.sitRobeL = pchCut(sitRobeL, 27, 10, .8); g.sitRobeR = pchCut(pchMirror(sitRobeL), 28, 10, .8);
  // 小腿（膝盖为原点，垂下）+ 鞋
  g.shin = pchCut([[-5, -4], [5, -4], [5.5, 24], [4.5, 50], [-4.5, 50], [-5.5, 24]], 29, 8, .4);
  g.sitShoe = pchCut(ellPts(1.5, 53, 8.5, 6, 14), 31, 5, .4);
  // ---- 上身（和身体同一坐标，随呼吸、驼背一起动） ----
  g.neck = pchCut([[-6, -312], [6, -312], [7, -295], [-7, -295]], 32, 8, .3, false);
  g.collar = pchCut([...pchOpen([[-15, -302], [0, -304], [15, -302]], 5), ...pchScallop(pchLine([17, -293], [-17, -293]), 4, 3)], 33, 3.5, .4, false);
  g.neckBow = pchCut(PCH_BOW_PTS.map(([x, y]) => [x * .95, y * .8]), 34, 3, .3, false);
  // ---- 手臂（肩为原点，向下 +y）：上袖 44，前袖 46 ----
  g.armU = pchCut([[-12, -3], [-7, -11], [1, -13], [8, -10], [13, -1], [14, 22], [14, 44], [0, 50], [-14, 44], [-13, 22]], 35, 8, .6);
  g.armL = pchCut([[-12, -7], [0, -10], [12, -7], [16, 14], [22, 34], [26, 45], [-26, 45], [-22, 34], [-16, 14]], 36, 8, .6);
  // 袖口荷叶边 + 指尖（前袖坐标，肘为原点）
  g.cuff = pchCut([...pchOpen([[-25, 39], [0, 41], [25, 39]], 5), ...pchScallop(pchLine([28, 49], [-28, 49]), 5, 4)], 37, 4, .4, false);
  g.handTips = pchCut([[-8, 48], [-9, 55], [-6.5, 59.5], [-4, 57.5], [-1.5, 61.5], [1.5, 60], [4, 60.5], [7.5, 56], [8, 48]], 38, 3, .25, false);
  g.handPoint = pchCut([[-7, 48], [-8, 56], [-5, 59.5], [-2.5, 58], [-2, 71], [.5, 74], [3, 71.5], [3.5, 58.5], [7.5, 55], [7.5, 48]], 39, 3, .25, false);
  g.handGrip = pchCut([[-9, 48], [-10, 55], [-6, 60.5], [0, 62], [6, 60.5], [10, 55], [9, 48]], 41, 3, .25, false);
  // 扒着边线的手（边线为 y=0，指尖垂下搭在线外）
  g.peekHand = pchCut([[-11, -5], [11, -5], [12, 3], [9.5, 8], [7, 5], [5, 9.5], [2, 6], [-.5, 9.5], [-3, 6], [-5.5, 9], [-8, 5], [-10.5, 7], [-12, 2]], 42, 3, .25, false);
  g.peekCuff = pchCut([[21, 2], [-21, 2], ...pchScallop(pchLine([-21, -10], [21, -10]), 4, 3.5)], 43, 4, .4, false);
  // ---- 书（中心为原点）：深红褐封面、金色包角、书口一截纸页 ----
  g.pages = pchCut([[-40, -30], [48, -30], [48, 38], [-40, 38]], 44, 12, .5, false);
  g.book = pchCut([[-44, -34], [44, -34], [44, 34], [-44, 34]], 45, 12, .6, false);
  g.spine = pchCut([[-44, -34], [-35, -34], [-35, 34], [-44, 34]], 46, 10, .4, false);
  g.corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => pchCut([[sx * 44, sy * 34], [sx * 30, sy * 34], [sx * 44, sy * 20]], 47 + i, 5, .3, false));
  g.bookMoon = pchCut(pchCrescent(8, 3.4).map(([x, y]) => [x * Math.cos(-2.2) - y * Math.sin(-2.2) + 4, x * Math.sin(-2.2) + y * Math.cos(-2.2)]), 52, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = pchCut([[0, -6], [12, -8], [25, -15], [35, -28], [41, -46], [43, -70], [42, -96], [37, -118], [0, -127], [-37, -118], [-42, -96], [-43, -70], [-41, -46], [-35, -28], [-25, -15], [-12, -8]], 53, 7, .5);
  g.cheekPuff = pchCut(ellPts(31, -23, 8, 7.5, 16), 54, 5, .3);
  // 后发：从帽下一直垂到小腿，两侧框住身体，发梢剪成几道尖
  const bSide = pchOpen([[58, -140], [64, -104], [66, -50], [69, 0], [68, 50], [62, 100], [56, 145], [52, 172]], 5);
  const bTips = [[50, 196], [44, 180], [38, 200], [32, 174], [16, 160], [0, 152], [-16, 162], [-31, 172], [-37, 198], [-44, 178], [-51, 194], [-54, 168]];
  g.backHair = pchCut([...bSide, ...bTips, ...pchMirror(bSide), [-30, -160], [0, -164], [30, -160]], 55, 10, .9, false);
  // 刘海：齐刘海剪成几片尖角
  g.bangs = pchCut([[-50, -142], [50, -142], [49, -100], [47, -70], [44, -61], [37, -77], [31, -58], [24, -74], [17, -61], [10, -76], [4, -57], [-3, -75], [-9, -60], [-16, -76], [-22, -57], [-29, -74], [-35, -61], [-41, -77], [-46, -63], [-49, -80], [-50, -110]], 56, 6, .5, false);
  // 刘海上的几道发缝（深一点的细纸条）
  g.bangLines = [[24, -74, 26, -118], [-3, -75, -1, -122], [-29, -74, -30, -116]].map(([x0, y0, x1, y1], i) => pchCut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 57 + i, 8, .2, false));
  // 鬓发：从太阳穴垂到胸前，发梢系蝴蝶结（右 +x，左 -x；根在 (±47,-104)）
  const lockR = [...pchOpen([[40, -118], [54, -110], [59, -80], [59, -36], [57, 8], [54, 44], [50, 70]], 4), [52, 82], [47, 99], [44, 86], [41, 96], [39, 72], ...pchOpen([[39, 70], [41, 44], [43, 8], [43, -36], [41, -78], [37, -106]], 4)];
  g.lockR = pchCut(lockR, 60, 7, .6, false);
  g.lockL = pchCut(pchMirror(lockR).map(([x, y]) => [x, y + (y > 60 ? 3 : 0)]), 61, 7, .6, false);
  g.bow = pchCut(PCH_BOW_PTS, 62, 3, .3, false);
  g.bowKnot = pchCut(ellPts(0, 0, 2.6, 3, 8), 63, 2, .1, false);
  // 帽子：蓬大的睡帽 + 一圈荷叶边 + 帽顶几道褶
  g.puff = pchCut([[-80, -104], [-92, -124], [-92, -150], [-76, -174], [-46, -191], [-8, -198], [30, -196], [62, -184], [84, -162], [90, -136], [82, -110], [0, -118]], 64, 9, .8);
  g.pleats = [[-52, -128, -66, -160], [-20, -134, -26, -168], [14, -134, 18, -166], [48, -128, 60, -156]].map(([x0, y0, x1, y1], i) => pchCut([[x0 - 1.6, y0], [lerp(x0, x1, .5) - 1, lerp(y0, y1, .5)], [x1, y1], [lerp(x0, x1, .5) + 1, lerp(y0, y1, .5)], [x0 + 1.6, y0]], 65 + i, 9, .25, false));
  g.frill = pchCut([...pchOpen([[-86, -96], [-46, -120], [0, -130], [46, -120], [86, -96]], 5), ...pchScallop(u => { const v = 1 - 2 * u; return [88 * v, -110 + 32 * v * v]; }, 12, 6)], 69, 4, .5, false);
  g.moon = pchCut(pchCrescent(20, 8.5), 70, 4, .3, false);
  // 小道具：「哼」气团、汗滴
  g.puffCloud = pchCut([[-16, 4], [-19, -4], [-13, -11], [-5, -12], [0, -16], [9, -14], [14, -8], [19, -5], [18, 4], [11, 9], [2, 8], [-6, 10], [-13, 9]], 71, 4, .4);
  g.sweat = pchCut([[0, -9], [4, -1], [5, 4], [2.5, 7.5], [-2.5, 7.5], [-5, 4], [-4, -1]], 72, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// lid 上眼睑盖住眼睛的比例，tilt 眼睑外端下垂，es 眼睛大小，brow [上移, 内端下压角]，mouth 嘴型，blush 腮红大小，chin 下巴抬(-)，turn 脸侧开
const PCH_MOODS = {
  normal: { lid: .36, tilt: .07, es: 1, brow: [0, .05], mouth: 'flat', blush: 1 },
  smug: { closed: 'up', brow: [2, -.12], mouth: 'smirk', blush: 1, chin: -.1 },
  pout: { lid: .3, tilt: .02, es: 1, brow: [-1, .3], mouth: 'pout', blush: 1.15, turn: -.5, look: 1, puff: true, hmph: true },
  flustered: { lid: .04, tilt: 0, es: 1.1, brow: [3, -.25], mouth: 'wobble', blush: 1.75, sweat: true },
  annoyed: { lid: .56, tilt: 0, es: 1, brow: [-1, .32], mouth: 'wave', blush: .9 },
  sleepy: { lid: .66, tilt: .12, es: 1, brow: [-1, -.1], mouth: 'flat', blush: 1 },
  surprised: { lid: 0, tilt: 0, es: 1.12, brow: [6, -.1], mouth: 'o', blush: 1 },
  smile: { lid: .3, tilt: .04, es: 1, brow: [1, -.05], mouth: 'smile', blush: 1.15, lower: 3.2 },
};
const PCH_MOOD_ALIAS = { sad: 'sleepy', happy: 'smile', calm: 'normal', confused: 'surprised', panic: 'flustered', tired: 'sleepy', angry: 'annoyed' };
const PCH_POSE_ALIAS = { read: 'stand', shrug: 'lecture', cheer: 'lecture', walk: 'stand', run: 'stand', slump: 'tired', flat: 'lie' };

// 嘴：一小片会变形的纸。open 0..1 说话张嘴。返回 [轮廓, 颜色]
function pchMouthPts(type, open) {
  if (open > .06) {
    const w = 7 + open * 2.5, oh = 1.8 + open * 6.5, lift = type === 'smile' || type === 'smirk' ? 1.2 : type === 'pout' || type === 'wave' ? -.6 : 0;
    return [[[-w / 2, -lift], [-w / 4, -.5], [w / 4, -.5], [w / 2, -lift - (type === 'smirk' ? 1.5 : 0)], [w * .36, oh * .62], [0, oh], [-w * .36, oh * .62]], PCH_K.mouthIn];
  }
  switch (type) {
    case 'smirk': return [[[-4.5, .4], [0, -.2], [3, -1], [5.4, -3.4], [4.6, .1], [2, 1.3], [-2, 1.4]], PCH_K.mouth];
    case 'smile': return [[[-4.6, -1], [0, -.3], [4.6, -1], [2.8, 2.2], [0, 3], [-2.8, 2.2]], PCH_K.mouthIn];
    case 'wave': { const top = [], bot = []; for (let k = 0; k <= 12; k++) { const x = -6 + k, y = Math.sin(k / 12 * TAU * 1.25) * .9; top.push([x, y - .65]); bot.unshift([x, y + .65]); } return [[...top, ...bot], PCH_K.mouth]; }
    case 'wobble': { const top = [], bot = []; for (let k = 0; k <= 8; k++) { const x = -5 + k * 1.25, y = Math.sin(k * Math.PI / 2) * .9; top.push([x, y - .6]); bot.unshift([x, y + 1.8 + Math.sin(k / 8 * Math.PI) * 1.2]); } return [[...top, ...bot], PCH_K.mouthIn]; }
    case 'pout': return [[[-4.2, 1.4], [0, -1.2], [4.2, 1.4], [3.4, 2.4], [0, .6], [-3.4, 2.4]], PCH_K.mouth];
    case 'o': return [ellPts(0, 1.5, 2.8, 3.6, 12), PCH_K.mouthIn];
    default: return [[[-3.8, .1], [0, -.7], [3.8, .5], [0, 1.1]], PCH_K.mouth];
  }
}

// ===================== 姿势 =====================
// 手臂 [a 上袖从下垂向前(+x)摆的角, b 前袖相对上袖再摆的角, 手型, 是否压在书上面]
// book [x, y, 旋转]（上身坐标，站姿脖子在 (0,-300)），hr 头额外转角（+ 低头），turn 脸侧开，lean 驼背角
function pchPose(pose, g, tt) {
  const sway = Math.sin(tt * 1.7);
  switch (pose) {
    case 'lecture': return { book: [-10, -226, -.12], back: [-.08, .98, 'tips', true], front: [lerp(.12, .95, g), lerp(-.05, 1.25, g) + .06 * sway * g, 'tips', false], turn: .22, look: .2 };
    case 'point': return { book: [-10, -226, -.12], back: [-.08, .98, 'tips', true], front: [2.02, .12, 'point', false], turn: .3, look: .8, hr: -.05 };
    case 'hide': return { book: [2, -306, -.04], back: [-.55, 3.48, 'tips', false], front: [.55, -3.5, 'tips', false], bookOverFace: true, turn: .12, look: .55, hr: .06 };
    case 'cross': return { book: [0, -232, .06], back: [-.2, 1.62, 'none', true], front: [.22, -1.5, 'none', true], turn: -.55, look: .9, hr: -.11 };
    case 'tired': return { lean: .035, hr: .1, nod: 1, sink: 12, shrug: -6, book: null, hang: true, back: [-.13, 0, 'tips', false], front: [-.1, 0, 'tips', false], turn: .1, look: -.2, drop: 5 };
    case 'lift': return { book: null, back: [-2.5, -.25, 'grip', true], front: [2.5, .25, 'grip', true], armsLate: true, armLen: 1.5, turn: 0, look: 0, shrug: 8, sink: 6 };
    case 'lie': return { hatRot: .5, hatShift: 30, book: [2, -230, .02], back: [-.2, 1.62, 'tips', true], front: [.22, -1.5, 'tips', true], turn: 0, look: 0 };
    default: return { book: [0, -226, .04], back: [-.06, .32, 'tips', false], front: [.06, -.3, 'tips', false], turn: .18, look: .15 };
  }
}

// ===================== 绘制 =====================
const PCH_OFF = 6000, PCH_BODY = .95, PCH_HEAD = 1.12 / PCH_BODY;   // 头 1.12 倍、身子 0.95 倍：约 3.7 头身
// pchPaint：画一层剪纸。items = [{ p: Path2D, m: 矩阵, col }]。sh = 投影 { blur, sx, sy, al }，同层合并一次投影；gr 纸纹
function pchPaint(c, items, sh, env, gr = true) {
  if (!items.length) return;
  const all = new Path2D();
  for (const it of items) all.addPath(it.p, new DOMMatrix(it.m));
  if (sh) {
    // 只要影子：把路径挪到画面外，用 shadowOffset 把影子挪回来（不会留下填色的毛边）
    const T = c.getTransform();
    c.save(); c.shadowColor = `rgba(30,20,35,${sh.al ?? .3})`; c.shadowBlur = sh.blur * env.sk; c.shadowOffsetX = T.a * PCH_OFF + sh.sx * env.sk; c.shadowOffsetY = T.b * PCH_OFF + sh.sy * env.sk;
    c.translate(-PCH_OFF, 0); c.fillStyle = '#000'; c.fill(all); c.restore();
  }
  for (const it of items) {
    c.save(); c.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5]); c.fillStyle = it.col; c.fill(it.p);
    if (it.edge !== false) { c.strokeStyle = pchEdge(it.col); c.lineWidth = env.lw; c.stroke(it.p); }
    c.restore();
  }
  if (gr && env.pat) { c.save(); c.globalAlpha *= .11; c.fillStyle = env.pat; c.fill(all); c.restore(); }   // 纸纹：直接用纹理填同一条路径（不用 clip，快）
}
const PCH_SH = { big: { blur: 5, sx: 2.4, sy: 3.4, al: .3 }, mid: { blur: 3.5, sx: 1.8, sy: 2.4, al: .3 }, tiny: { blur: 1.2, sx: .8, sy: 1, al: .3 } };

function drawPatchouli(c, o = {}) {
  const { x = 0, y = 0, h = 520, facing = 1, gesture = null, tilt = 0, mouth = 0, blink = 0, t = 0 } = o;
  const pose = PCH_POSE_ALIAS[o.pose] || o.pose || 'stand', moodName = PCH_MOOD_ALIAS[o.mood] || o.mood || 'normal';
  const md = PCH_MOODS[moodName] || PCH_MOODS.normal, tt = twos(t + CLOCK0), s = h / 520;
  const g = gesture === null ? .55 + .35 * Math.sin(tt * 1.3) : clamp(gesture, 0, 1);
  const ps = pchPose(pose, g, tt);
  // ---- 根：锚点 → 人偶设计坐标 ----
  const sway = .006 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.9);
  let root = pchTR(PCH_I, x, y, 0, facing * s, s);
  if (pose === 'lie') root = pchTR(root, 262, -64, -Math.PI / 2 + .03);
  else if (pose === 'sit') root = pchTR(root, 0, 0, sway * .5);
  else if (pose === 'peek') root = pchTR(root, 0, 0, sway * .5);
  else root = pchTR(root, 0, 0, sway);
  const frame = root;                                                     // 锚点坐标（设计单位）
  root = pchTR(root, 0, 0, 0, PCH_BODY, PCH_BODY);                         // 身子略小一号
  const up = pose === 'sit' ? 150 : pose === 'peek' ? 313 : 0;           // 上身整体下移（坐、探头）
  const breath = 1.1 * Math.sin(tt * TAU / 3.4) + (ps.drop ? -ps.drop : 0);
  // 驼背：上身绕腰转；睡袍斜切跟上
  const lean = ps.lean || 0;
  const ugL = pchTR(pchPivot(pchTR(PCH_I, 0, up), 0, -190, lean), 0, -breath), ug = pchMul(root, ugL);
  const lowerM = lean ? pchMul(root, [1, 0, -Math.sin(lean) * 1.05 * 110 / 300, 1, 0, 0]) : root;
  // 头（头部件按 PCH_HEAD 放大：头大、身子小）
  const neck = [0, -300 + (ps.sink || 0)], neckL = pchApply(ugL, neck);
  const hr = (ps.hr || 0) + (md.chin || 0) * (pose === 'lie' ? 0 : 1) + tilt + .012 * Math.sin(tt * .9 + 1);
  const head = pchTR(ug, neck[0], neck[1], hr, PCH_HEAD, PCH_HEAD);
  const turn = clamp(pose !== 'cross' && md.turn !== undefined ? md.turn : ps.turn || 0, -1, 1);
  const look = clamp(o.look !== undefined ? o.look : (md.look !== undefined ? md.look : ps.look || 0), -1, 1);
  // 画的环境：投影随 s 略放大，边线约 1px
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1 / (s * dev), pat, x, y };
  const it = (p, m, col, edge) => ({ p, m, col, edge });
  const paint = (items, sh, gr) => pchPaint(c, items, sh, env, gr);
  const G = PCH_G;
  let clipped = false;
  if (pose === 'peek') { const cp = new Path2D(); cp.addPath(polyPath(rectPts(-3000, -3000, 6000, 3000)), new DOMMatrix(frame)); c.save(); c.clip(cp); clipped = true; }

  // ---- 1 后发 ----
  // 后发垂着：只跟一点头的转动，不跟驼背；躺下时散在头顶那边的地上
  const hairM = pose === 'lie' ? pchTR(root, neckL[0], neckL[1], 0, PCH_HEAD * .8, PCH_HEAD * .75)
    : pchTR(root, neckL[0], neckL[1], hr * .12 + .008 * Math.sin(tt * 1.3 + 2), PCH_HEAD, PCH_HEAD);
  paint([it(G.backHair, hairM, PCH_K.hairBack)], PCH_SH.big);

  // ---- 2 腿、睡袍、条纹、外袍（peek 不画身体） ----
  const legs = [];
  if (pose !== 'peek') {
    if (pose === 'sit') {
      for (const sd of [-1, 1]) { const a = .2 * Math.sin(tt * 2.4 + (sd > 0 ? 0 : 2.2)) + .08 * sd; const m = pchTR(root, sd * 14, 24, a); legs.push(it(G.shin, m, PCH_K.leg), it(G.sitShoe, m, PCH_K.shoe)); }
      paint(legs, PCH_SH.mid);
      paint([it(G.sitDress, root, PCH_K.dress), it(G.sitHem, root, PCH_K.dress)], PCH_SH.big);
      paint(G.sitStripes.map(p => it(p, root, PCH_K.stripe, false)), PCH_SH.tiny, false);
      paint([it(G.sitRobeL, root, PCH_K.robe), it(G.sitRobeR, root, PCH_K.robe)], PCH_SH.big);
    } else {
      const dm = pchTR(lowerM, 0, 0, 0, 1, 1 + breath / 320);
      paint([it(G.shoeL, root, PCH_K.shoe), it(G.shoeR, root, PCH_K.shoe)], PCH_SH.mid, false);
      paint([it(G.dress, dm, PCH_K.dress), it(G.hem, lowerM, PCH_K.dress)], PCH_SH.big);
      paint(G.stripes.map(p => it(p, dm, PCH_K.stripe, false)), PCH_SH.tiny, false);
      paint([it(G.robeL, dm, PCH_K.robe), it(G.robeR, dm, PCH_K.robe), it(G.trimL, dm, PCH_K.trim), it(G.trimR, dm, PCH_K.trim)], PCH_SH.big);
    }
    paint([it(G.neck, ug, PCH_K.skin), it(G.collar, ug, PCH_K.trim)], PCH_SH.mid, false);
  }

  // ---- 手臂骨架 ----
  const shrug = ps.shrug || 0, arm = (sd, spec) => {
    const [a, b, hand, over] = spec, sh = [sd * 27, -284 - shrug];
    const k = ps.armLen || 1, u = pchTR(ug, sh[0], sh[1], -a, k, k), l = pchTR(u, 0, 44, -b);
    return { u, l, hand, over, tip: pchApply(l, hand === 'point' ? [.5, 73] : hand === 'grip' ? [0, 56] : [0, 60]) };
  };
  const AB = arm(-1, ps.back), AF = arm(1, ps.front);
  // 书
  let bookM = null;
  if (ps.book) bookM = pchTR(ug, ps.book[0], ps.book[1], ps.book[2] + .01 * Math.sin(tt * 1.1));
  else if (ps.hang) bookM = pchTR(AB.l, 0, 92, -.08 + .05 * Math.sin(tt * 1.6), -1, 1);  // tired：书吊在后手指尖下
  const sleeve = arms => { if (arms.length) paint([...arms.map(A => it(G.armU, A.u, PCH_K.robe)), ...arms.map(A => it(G.armL, A.l, PCH_K.robe))], PCH_SH.big); };
  const hands = arms => { const items = []; for (const A of arms) { items.push(it(G.cuff, A.l, PCH_K.trim)); if (A.hand !== 'none') items.push(it(A.hand === 'point' ? G.handPoint : A.hand === 'grip' ? G.handGrip : G.handTips, A.l, PCH_K.skin)); } paint(items, PCH_SH.mid, false); };
  const drawBook = () => { if (!bookM) return;
    paint([it(G.pages, bookM, PCH_K.pages), it(G.book, bookM, PCH_K.book), it(G.spine, bookM, PCH_K.bookSpine)], PCH_SH.big);
    paint([...G.corners.map(p => it(p, bookM, PCH_K.gold)), it(G.bookMoon, bookM, PCH_K.gold)], PCH_SH.tiny, false); };

  if (pose === 'peek') {
    // 只露头：手扒在边线上（手在最后画）
  } else if (ps.bookOverFace) {
    sleeve([AB, AF]);
  } else if (ps.armsLate) {
    // lift：举起的袖子压在头发和帽子外面，最后画
  } else {
    sleeve([AB, AF].filter(A => !A.over));
    drawBook();
    sleeve([AB, AF].filter(A => A.over));
    hands([AB, AF]);
  }

  // ---- 脸 ----
  const faceItems = [it(G.face, head, PCH_K.skin)];
  if (md.puff) faceItems.push(it(G.cheekPuff, head, PCH_K.skin));
  paint(faceItems, PCH_SH.mid);
  pchFace(c, ps.nod ? pchTR(head, 0, ps.nod * 4.5) : head, md, { turn, look, blink, mouth, tt }, paint, it);

  // ---- 前发：鬓发、刘海 ----
  const lockM = sd => pchPivot(head, sd * 47, -104, -hr * .55 + .02 * Math.sin(tt * 1.5 + sd));
  const LR = lockM(1), LL = lockM(-1);
  paint([it(G.lockL, LL, PCH_K.hair), it(G.lockR, LR, PCH_K.hair), it(G.bangs, pchTR(head, turn * 3, 0), PCH_K.hair)], PCH_SH.mid);
  paint(G.bangLines.map(p => it(p, pchTR(head, turn * 3, 0), PCH_K.hairLine, false)), null, false);
  pchBrows(md, turn, ps.nod ? pchTR(head, 0, ps.nod * 3) : head, paint, it);
  if (ps.bookOverFace) { drawBook(); hands([AB, AF]); }
  // 发梢蝴蝶结（左红右蓝）
  const bowR = pchTR(LR, 47, 74, .2), bowL = pchTR(LL, -47, 77, -.25, .92, .92);
  paint([it(G.bow, bowL, PCH_K.red), it(G.bow, bowR, PCH_K.blue)], PCH_SH.tiny, false);
  paint([it(G.bowKnot, bowL, mix(PCH_K.red, P.ink, .25)), it(G.bowKnot, bowR, mix(PCH_K.blue, P.ink, .25))], null, false);
  if (pose !== 'peek') {
    const nb = pchTR(ug, 0, -293, 0, .9, .9);
    paint([it(G.neckBow, nb, PCH_K.red)], PCH_SH.tiny, false);
  }

  // ---- 帽子 ----
  const hat = pchTR(pchPivot(pchTR(head, ps.hatShift || 0, 0), 0, -112, .01 * Math.sin(tt * 1.2 + .5) + (ps.hatRot || 0)), 0, 0, 0, .93, 1);   // lie：帽子被地板顶歪
  paint([it(G.puff, hat, PCH_K.cap)], PCH_SH.big);
  paint(G.pleats.map(p => it(p, hat, PCH_K.capFold, false)), null, false);
  paint([it(G.frill, pchPivot(hat, 0, -112, .008 * Math.sin(tt * 1.9)), PCH_K.cap)], PCH_SH.mid);
  const moonM = pchTR(hat, 50, -160, -.7 + .03 * Math.sin(tt * 1.4));
  paint([it(G.moon, moonM, PCH_K.gold)], PCH_SH.mid);

  if (ps.armsLate) { sleeve([AB, AF]); hands([AB, AF]); }

  // ---- 表情道具 ----
  if (md.hmph) { const hm = pchTR(head, -88, -44, -hr + .1 * Math.sin(tt * 3), 1 + .05 * Math.sin(tt * 5), 1 + .05 * Math.sin(tt * 5));
    paint([it(G.puffCloud, hm, PCH_K.white)], PCH_SH.mid);
    c.save(); c.transform(hm[0], hm[1], hm[2], hm[3], hm[4], hm[5]); zh(c, '哼', 0, 4.5, { size: 13, align: 'center', color: P.ink }); c.restore(); }
  if (md.sweat) paint([it(G.sweat, pchTR(head, 52, -92 + 3 * ((tt * 2) % 1), .15), PCH_K.sweat)], PCH_SH.tiny);

  // ---- 扒边的手 ----
  let handPts;
  if (pose === 'peek') {
    if (clipped) { c.restore(); clipped = false; }
    const hp = [[-46, 0], [50, 0]].map(([hx, hy], i) => pchTR(frame, hx, hy + .6 * Math.sin(tt * 2 + i), (i ? .06 : -.08)));
    const cuffClip = new Path2D(); cuffClip.addPath(polyPath(rectPts(-3000, -3000, 6000, 3000)), new DOMMatrix(frame));
    c.save(); c.clip(cuffClip); paint(hp.map(m => it(G.peekCuff, m, PCH_K.trim)), PCH_SH.tiny, false); c.restore();
    paint(hp.map(m => it(G.peekHand, m, PCH_K.skin)), PCH_SH.mid, false);
    handPts = hp.map(m => pchApply(m, [0, 4]));
  } else handPts = [AB.tip, AF.tip];
  if (clipped) c.restore();
  const bookPt = bookM ? pchApply(bookM, [0, 0]) : pchApply(frame, [0, 0]);
  return { head: pchApply(head, [0, -55]), hands: handPts.slice().sort((a, b) => a[0] - b[0]), book: bookPt, tip: pose === 'peek' ? handPts[1] : AF.tip };
}

// 五官：腮红、眼睛（深紫纸片 + 白点高光 + 压在上面的眼睑纸条）、嘴
function pchFace(c, head, md, f, paint, it) {
  const { turn, look, blink, mouth, tt } = f, low = [], top = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .28 : 1, ex = sd * 19 * (sd * turn > 0 ? 1 - Math.abs(turn) * .15 : 1) + turn * 9, ey = -44;
    // 腮红
    const bs = md.blush;
    low.push(it(pchCut(ellPts(ex + sd * 8 + turn * 1, -30 + (bs > 1.4 ? 1 : 0), 6.5 * bs * far, 3.4 * Math.sqrt(bs), 14), 80 + sd, 4, .3), head, PCH_K.blush, false));
    const lidFrac = md.closed ? 1 : clamp(lerp(md.lid, 1, blink), 0, 1);
    const rx = 7 * far * (md.es || 1), ry = 8.8 * (md.es || 1), ex2 = ex + look * 2.4 * far, topY = ey - ry;
    if (lidFrac > .9) {
      // 闭眼：一道弧形纸条（smug 向上拱，眨眼/睡着向下弯）
      const arc = md.closed === 'up' ? -3.2 : 2.6, base = md.closed === 'up' ? ey + 1 : ey + ry * .55, pts = [], back = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1, xx = ex + u * (rx + 1.5), yy = base + arc * (1 - u * u) + sd * u * .8; pts.push([xx, yy - 1.4]); back.unshift([xx, yy + 1.4 - Math.abs(u) * .6]); }
      top.push(it(pchCut([...pts, ...back], 90 + sd, 3, .2, false), head, PCH_K.lid, false));
      continue;
    }
    const lidY = xx => topY + lidFrac * 2 * ry + (md.tilt || 0) * (xx - ex) * sd;
    const lowY = md.lower ? ey + ry - md.lower : Infinity;
    const eye = ellPts(ex2, ey, rx, ry, 18).map(([xx, yy]) => [xx, clamp(yy, lidY(xx), lowY)]);
    low.push(it(pchCut(eye, 84 + sd, 3.2, .25), head, PCH_K.eye, false));
    // 高光：一个白色小圆点，在眼睑下面
    const hy = Math.max(ey - 2, lidY(ex2) + 3);
    top.push(it(pchCut(ellPts(ex2 - sd * 0 - 2.2 + look * .8, hy, 2.1, 2.1, 8), 86 + sd, 2, .1), head, PCH_K.white, false));
    // 上眼睑：平直的深色纸条，外端一撇
    const xi = ex - sd * (rx + .8), xo = ex + sd * (rx + 2.6), ly0 = lidY(xi), ly1 = lidY(xo);
    top.push(it(pchCut([[xi, ly0 - 3], [lerp(xi, xo, .5), lerp(ly0, ly1, .5) - 3.3], [xo, ly1 - 3.6], [xo + sd * 2.6, ly1 - 6], [xo + sd * 1.2, ly1 + .2], [lerp(xi, xo, .5), lerp(ly0, ly1, .5) + .6], [xi, ly0 + .5]], 88 + sd, 3, .2, false), head, PCH_K.lid, false));
  }
  // 嘴
  const [mp, mc] = pchMouthPts(md.mouth, mouth);
  low.push(it(pchCut(mp, 95, 2.4, .15, false), pchTR(head, turn * 10 + (md.puff ? -2 : 0), -21), mc, false));
  paint(low, PCH_SH.tiny, false);
  paint(top, PCH_SH.tiny, false);
}
// 眉毛：两小片细纸（压在刘海上，演不高兴/得意）
function pchBrows(md, turn, head, paint, it) {
  const [dy, ang] = md.brow || [0, 0], items = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * 19 * far + turn * 9, cy = -66 - dy, len = 6.5 * far;
    const pts = [[-sd * len, -1.3], [sd * len * .4, -1.1], [sd * len, -.2], [sd * len * .4, .9], [-sd * len, 1.3]];
    items.push(it(pchCut(pts, 97 + sd, 3, .15, false), pchTR(head, cx, cy, -sd * ang), PCH_K.brow, false));
  }
  paint(items, PCH_SH.tiny, false);
}

// 第一版 Q 版接口的兼容别名：旧场景还会调用，之后重写掉
function drawPatchouliChibi(c, o = {}) {
  const map = { stand: 'stand', flat: 'lie', lift: 'lift', sit: 'sit', lie: 'lie', run: 'stand' };
  return drawPatchouli(c, { ...o, pose: map[o.pose] || 'stand', h: o.h || 300 });
}
