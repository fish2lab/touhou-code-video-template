'use strict';
// 帕秋莉·诺蕾姬 —— 剪纸人偶（第三版：Q 版比例、分层眼睛、深色描边，全员的样板，规格见 docs/rig.md「统一比例」）。纯 Canvas 代码绘制，不加载任何图片。
//
// drawPatchouli(c, o) → { head:[x,y], hands:[[x,y],[x,y]], book:[x,y], tip:[x,y] }
//   x, y     锚点。stand 等站姿：脚底中心；sit：坐着的那条线上臀部中心；peek：她扒着的那条边线的中点；
//            lie：躺着贴地那条边的中点（facing=1 时头朝左）
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，帽顶高度各人不同，见 docs/rig.md）。所有姿势共用这个比例（坐着、躺着时人偶大小不变）
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
  cap: P.cap, capFold: mix(P.cap, P.stripe, .22), skin: P.skin, blush: P.blush,
  eye: mix(P.hairDark, P.ink, .5), lid: mix(P.hairDark, P.ink, .78), brow: mix(P.hairDark, P.ink, .45),
  mouth: mix(P.hairDark, P.ink, .55), mouthIn: mix(P.ribbonRed, P.ink, .45),
  book: mix(mix(P.ribbonRed, P.moon, .25), P.ink, .5), bookSpine: mix(mix(P.ribbonRed, P.moon, .25), P.ink, .66), pages: mix(P.cap, P.paperEdge, .35),
  gold: P.moon, red: P.ribbonRed, blue: P.ribbonBlue, shoe: mix(P.hairDark, P.ink, .35), leg: mix(P.cap, P.stripe, .15),
  sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  // 眼睛分层（第三版）：眼白、虹膜下半的亮色、瞳孔、虹膜上沿阴影
  sclera: '#fbf8f3', irisLt: mix(mix(P.hairDark, P.ink, .5), '#c7a4e6', .55), pupil: mix(P.hairDark, P.ink, .85), irisShade: alpha(mix(P.hairDark, P.ink, .8), .45),
};
const PCH_EDGE = {};
// 描边：深色细线（第三版，学 Flash 短篇的勾线；纸纹和投影照旧）
const pchEdge = col => PCH_EDGE[col] || (PCH_EDGE[col] = alpha(mix(col, P.ink, .62), .85));

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
// 第三版比例（Flash 短篇那种 Q 版）：身子坐标脖子在 -212，乘 PCH_BODY 后约 -248；头部件乘 PCH_HEAD 后脸宽约 156、下巴到头顶约 180，
// 帽顶约到 -520。不算帽子约 2.4 头身，脸宽约是肩宽的 2.3 倍。
const PCH_G = (() => {
  const g = {};
  // ---- 身体（站姿，脚底为原点） ----
  // 短钟形睡袍：窄肩，裙摆张开到小腿，下面露一截袜子和圆鞋
  g.dress = pchCut([[-14, -214], [0, -216], [14, -214], [25, -209], [32, -197], [35, -172], [41, -132], [51, -94], [63, -60], [70, -46], [-70, -46], [-63, -60], [-51, -94], [-41, -132], [-35, -172], [-32, -197], [-25, -209]], 11, 10, .8);
  g.hem = pchCut([...pchOpen([[-72, -52], [0, -49], [72, -52]], 6), ...pchScallop(u => [lerp(76, -76, u), -34 + 4 * (1 - (2 * u - 1) ** 2)], 11, 5.5)], 12, 4, .5, false);
  g.stripes = [-.78, -.52, -.26, 0, .26, .52, .78].map((u, i) => { const xt = u * 27, xb = u * 64;
    return pchCut([[xt - 2.4, -207], [xt + 2.4, -207], [xb + 3.6, -50], [xb - 3.6, -50]], 30 + i, 12, .5, false); });
  const robeL = [[-8, -213], [-20, -213], [-29, -207], [-35, -190], [-39, -160], [-46, -122], [-57, -84], [-71, -50], [-48, -46], [-29, -49], [-23, -92], [-17, -150], [-11, -190]];
  g.robeL = pchCut(robeL, 21, 10, .8); g.robeR = pchCut(pchMirror(robeL), 22, 10, .8);
  const trimL = [[-11, -190], [-17, -150], [-23, -92], [-27, -48], [-23, -48], [-19, -92], [-13, -150], [-7.5, -190], [-5, -212], [-8, -213]];
  g.trimL = pchCut(trimL, 23, 9, .4, false); g.trimR = pchCut(pchMirror(trimL), 24, 9, .4, false);
  // 袜子（一截）+ 大圆鞋，鞋尖朝前一点
  g.legL = pchCut([[-20, -52], [-8, -52], [-8.5, -12], [-19.5, -12]], 19, 6, .3, false); g.legR = pchCut([[8, -52], [20, -52], [19.5, -12], [8.5, -12]], 20, 6, .3, false);
  g.shoeL = pchCut(ellPts(-14, -9, 15, 9.5, 18), 25, 5, .4); g.shoeR = pchCut(ellPts(15, -9, 15, 9.5, 18), 26, 5, .4);
  // 坐姿（座面为原点）：睡袍盖到膝盖，短腿垂在座沿外
  g.sitDress = pchCut([[-14, -128], [0, -130], [14, -128], [25, -123], [32, -111], [36, -80], [44, -40], [56, -6], [62, 12], [-62, 12], [-56, -6], [-44, -40], [-36, -80], [-32, -111], [-25, -123]], 13, 10, .8);
  g.sitHem = pchCut([...pchOpen([[-64, 6], [0, 8], [64, 6]], 6), ...pchScallop(u => [lerp(67, -67, u), 22 + 3 * (1 - (2 * u - 1) ** 2)], 9, 5)], 14, 4, .5, false);
  g.sitStripes = [-.78, -.52, -.26, 0, .26, .52, .78].map((u, i) => { const xt = u * 28, xb = u * 58;
    return pchCut([[xt - 2.4, -121], [xt + 2.4, -121], [xb + 3.6, 10], [xb - 3.6, 10]], 40 + i, 12, .5, false); });
  const sitRobeL = [[-8, -127], [-20, -127], [-29, -121], [-35, -100], [-40, -60], [-50, -18], [-62, 6], [-42, 8], [-26, 4], [-21, -30], [-15, -80], [-11, -105]];
  g.sitRobeL = pchCut(sitRobeL, 27, 10, .8); g.sitRobeR = pchCut(pchMirror(sitRobeL), 28, 10, .8);
  g.shin = pchCut([[-5.5, -4], [5.5, -4], [5.5, 18], [4.8, 30], [-4.8, 30], [-5.5, 18]], 29, 8, .4);
  g.sitShoe = pchCut(ellPts(3, 33, 12.5, 8, 16), 31, 5, .4);
  // ---- 上身 ----
  g.neck = pchCut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 32, 8, .3, false);
  g.collar = pchCut([...pchOpen([[-16, -216], [0, -218], [16, -216]], 5), ...pchScallop(pchLine([18, -206], [-18, -206]), 4, 3.5)], 33, 3.5, .4, false);
  g.neckBow = pchCut(PCH_BOW_PTS.map(([x, y]) => [x * 1.05, y * .9]), 34, 3, .3, false);
  // ---- 手臂（肩为原点，向下 +y）：上袖 36，前袖是喇叭袖口 ----
  g.armU = pchCut([[-11, -3], [-6, -10], [1, -12], [7, -9], [12, -1], [13, 18], [13, 36], [0, 40], [-13, 36], [-12, 18]], 35, 8, .6);
  g.armL = pchCut([[-11, -6], [0, -9], [11, -6], [15, 10], [20, 26], [23, 36], [-23, 36], [-20, 26], [-15, 10]], 36, 8, .6);
  g.cuff = pchCut([...pchOpen([[-23, 32], [0, 34], [23, 32]], 5), ...pchScallop(pchLine([26, 41], [-26, 41]), 5, 4)], 37, 4, .4, false);
  g.handTips = pchCut([[-7, 40], [-8, 46], [-5.5, 50], [-3, 48.5], [-1, 52], [1.5, 51], [3.5, 51.5], [6.5, 47.5], [7, 40]], 38, 3, .25, false);
  g.handPoint = pchCut([[-6, 40], [-7, 47], [-4.5, 50], [-2.2, 49], [-1.8, 60], [.5, 62.5], [2.6, 60], [3, 49.5], [6.5, 46.5], [6.5, 40]], 39, 3, .25, false);
  g.handGrip = pchCut([[-8, 40], [-9, 46], [-5, 51], [0, 52.5], [5, 51], [9, 46], [8, 40]], 41, 3, .25, false);
  g.peekHand = pchCut([[-12, -5], [12, -5], [13, 3], [10.5, 8.5], [7.5, 5], [5.5, 10], [2, 6], [-.5, 10], [-3, 6], [-6, 9.5], [-8.5, 5], [-11, 7.5], [-13, 2]], 42, 3, .25, false);
  g.peekCuff = pchCut([[23, 2], [-23, 2], ...pchScallop(pchLine([-23, -11], [23, -11]), 4, 3.8)], 43, 4, .4, false);
  // ---- 书（中心为原点）：比身子宽一点，Q 版抱大书 ----
  g.pages = pchCut([[-34, -25], [41, -25], [41, 31], [-34, 31]], 44, 10, .5, false);
  g.book = pchCut([[-38, -29], [38, -29], [38, 29], [-38, 29]], 45, 10, .6, false);
  g.spine = pchCut([[-38, -29], [-30, -29], [-30, 29], [-38, 29]], 46, 9, .4, false);
  g.corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => pchCut([[sx * 38, sy * 29], [sx * 26, sy * 29], [sx * 38, sy * 17]], 47 + i, 5, .3, false));
  g.bookMoon = pchCut(pchCrescent(7, 3).map(([x, y]) => [x * Math.cos(-2.2) - y * Math.sin(-2.2) + 4, x * Math.sin(-2.2) + y * Math.cos(-2.2)]), 52, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  // 圆脸：两颊鼓、下巴小而尖一点
  g.face = pchCut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 53, 7, .5);
  g.cheekPuff = pchCut(ellPts(51, -26, 10, 9.5, 16), 54, 5, .3);
  // 后发：从帽下垂到小腿，比脸宽一圈，发梢剪成几道尖
  const bSide = pchOpen([[64, -156], [73, -118], [75, -60], [73, 0], [69, 50], [64, 92], [60, 116]], 5);
  const bTips = [[60, 136], [53, 120], [47, 140], [40, 116], [22, 106], [0, 102], [-22, 108], [-40, 118], [-47, 140], [-53, 122], [-59, 134], [-60, 114]];
  g.backHair = pchCut([...bSide, ...bTips, ...pchMirror(bSide), [-40, -172], [0, -176], [40, -172]], 55, 10, .9, false);
  // 刘海：厚的齐刘海，下缘几大簇尖，盖到眼睛上沿
  g.bangs = pchCut([[-68, -156], [68, -156], [67, -108], [63, -84], [56, -98], [49, -76], [39, -93], [29, -78], [19, -95], [9, -80], [0, -91], [-9, -80], [-19, -95], [-29, -78], [-39, -93], [-49, -76], [-56, -98], [-63, -84], [-67, -108]], 56, 6, .5, false);
  g.bangLines = [[29, -78, 31, -128], [0, -91, 1, -132], [-29, -78, -31, -126], [49, -76, 54, -118], [-49, -76, -54, -116]].map(([x0, y0, x1, y1], i) => pchCut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 57 + i, 8, .2, false));
  // 鬓发：从太阳穴垂到腰，比脸还靠外，发梢系蝴蝶结（根在 (±58,-110)）
  const lockR = [...pchOpen([[50, -128], [66, -118], [74, -86], [77, -40], [76, 10], [72, 52], [68, 78]], 4), [70, 92], [64, 108], [61, 94], [57, 104], [55, 80], ...pchOpen([[55, 78], [57, 50], [59, 10], [59, -40], [56, -80], [48, -112]], 4)];
  g.lockR = pchCut(lockR, 60, 7, .6, false);
  g.lockL = pchCut(pchMirror(lockR).map(([x, y]) => [x, y + (y > 70 ? 3 : 0)]), 61, 7, .6, false);
  g.bow = pchCut(PCH_BOW_PTS.map(([x, y]) => [x * 1.25, y * 1.25]), 62, 3, .3, false);
  g.bowKnot = pchCut(ellPts(0, 0, 3.2, 3.6, 8), 63, 2, .1, false);
  // 帽子：蓬大的睡帽 + 一圈荷叶边，帽檐在前额正中压低一点
  // 帽子（第三版，按美术意见重画）：帽子罩住整个头顶，两侧顺着头往下包到太阳穴，别让头发从帽子里穿出来。
  // 帽檐是绕头一圈的布带，戴得往后仰：前沿抬高、两端低，正面看是一道拱（PCH_BAND）。帽顶的布被帽檐束住，
  // 所以帽顶下沿就贴着这道拱；褶子从帽檐往上往外散；帽顶鼓出帽檐的地方压一层浅影，看得出是个鼓起来的布团。
  const band = x => -150 + 44 * (x / 86) ** 2;
  g.bandY = band;
  const domeTop = [[88, -108], [99, -134], [103, -164], [94, -192], [70, -213], [32, -225], [-8, -227], [-48, -220], [-80, -201], [-99, -172], [-101, -140], [-89, -108]];
  const domeBot = []; for (let k = 0; k <= 16; k++) { const x = -86 + k / 16 * 172; domeBot.push([x, band(x) - 4]); }
  g.puff = pchCut([...domeTop, ...domeBot], 64, 9, .8);
  g.puffClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.puffLight = polyPath(ellPts(-22, -196, 106, 96, 40), true);   // 帽顶亮面：留出右下一圈浅影
  g.pleats = [-66, -40, -14, 12, 38, 64].map((x, i) => { const y0 = band(x) - 7, x1 = x * 1.32, y1 = y0 - 46 + Math.abs(x) * .12, xm = lerp(x, x1, .5) + x * .05, ym = lerp(y0, y1, .5);
    return pchCut([[x - 1.9, y0], [xm - 1.1, ym], [x1, y1], [xm + 1.1, ym], [x + 1.9, y0]], 65 + i, 9, .25, false); });
  // 帽檐：上缘小荷叶边往外张（往上翘），下缘大荷叶边垂在刘海上
  const bandTop = pchScallop(u => { const x = lerp(-92, 92, u), v = x / 92; return [x, band(x) - 9 - 4 * v * v]; }, 15, 2.6);
  const bandBot = pchScallop(u => { const x = lerp(94, -94, u); return [x, band(x) + 9]; }, 13, 6.2);
  g.frill = pchCut([...bandTop, ...bandBot], 69, 4, .5, false);
  g.moon = pchCut(pchCrescent(20, 8.5), 70, 4, .3, false);
  g.puffCloud = pchCut([[-16, 4], [-19, -4], [-13, -11], [-5, -12], [0, -16], [9, -14], [14, -8], [19, -5], [18, 4], [11, 9], [2, 8], [-6, 10], [-13, 9]].map(([x, y]) => [x * 1.2, y * 1.2]), 71, 4, .4);
  g.sweat = pchCut([[0, -9], [4, -1], [5, 4], [2.5, 7.5], [-2.5, 7.5], [-5, 4], [-4, -1]].map(([x, y]) => [x * 1.3, y * 1.3]), 72, 3, .2);
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
// book [x, y, 旋转]（上身坐标，站姿脖子在 (0,-212)），hr 头额外转角（+ 低头），turn 脸侧开，lean 驼背角
function pchPose(pose, g, tt) {
  const sway = Math.sin(tt * 1.7);
  switch (pose) {
    case 'lecture': return { book: [-8, -146, -.12], back: [-.08, .98, 'tips', true], front: [lerp(.12, .95, g), lerp(-.05, 1.25, g) + .06 * sway * g, 'tips', false], turn: .22, look: .2 };
    case 'point': return { book: [-8, -146, -.12], back: [-.08, .98, 'tips', true], front: [2.02, .12, 'point', false], turn: .3, look: .8, hr: -.05 };
    case 'hide': return { book: [2, -222, -.04], back: [-.55, 3.48, 'tips', false], front: [.55, -3.5, 'tips', false], bookOverFace: true, turn: .12, look: .55, hr: .06 };
    case 'cross': return { book: [0, -150, .06], back: [-.2, 1.62, 'none', true], front: [.22, -1.5, 'none', true], turn: -.55, look: .9, hr: -.11 };
    case 'tired': return { lean: .035, hr: .1, nod: 1, sink: 12, shrug: -6, book: null, hang: true, back: [-.13, 0, 'tips', false], front: [-.1, 0, 'tips', false], turn: .1, look: -.2, drop: 5 };
    case 'lift': return { book: null, back: [-2.5, -.25, 'grip', true], front: [2.5, .25, 'grip', true], armsLate: true, armLen: 1.5, turn: 0, look: 0, shrug: 8, sink: 6 };
    case 'lie': return { hatRot: .5, hatShift: 30, book: [2, -148, .02], back: [-.2, 1.62, 'tips', true], front: [.22, -1.5, 'tips', true], turn: 0, look: 0 };
    default: return { book: [0, -153, .04], back: [-.06, .32, 'tips', false], front: [.06, -.3, 'tips', false], turn: .18, look: .15 };
  }
}

// ===================== 绘制 =====================
const PCH_OFF = 6000, PCH_BODY = 1.17, PCH_HEAD = 1.2 / PCH_BODY;   // 身子 1.17 倍（脖子落在 -248）、头 1.2 倍：不算帽子约 2.4 头身
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
  const { x = 0, y = 0, h = 500, facing = 1, gesture = null, tilt = 0, mouth = 0, blink = 0, t = 0 } = o;
  const pose = PCH_POSE_ALIAS[o.pose] || o.pose || 'stand', moodName = PCH_MOOD_ALIAS[o.mood] || o.mood || 'normal';
  const md = PCH_MOODS[moodName] || PCH_MOODS.normal, tt = twos(t + CLOCK0), s = h / 520;   // 设计高 520，按 h 缩放
  const g = gesture === null ? .55 + .35 * Math.sin(tt * 1.3) : clamp(gesture, 0, 1);
  const ps = pchPose(pose, g, tt);
  // ---- 根：锚点 → 人偶设计坐标 ----
  const sway = .006 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.9);
  let root = pchTR(PCH_I, x, y, 0, facing * s, s);
  if (pose === 'lie') root = pchTR(root, 262, -82, -Math.PI / 2 + .03);
  else if (pose === 'sit') root = pchTR(root, 0, 0, sway * .5);
  else if (pose === 'peek') root = pchTR(root, 0, 0, sway * .5);
  else root = pchTR(root, 0, 0, sway);
  const frame = root;                                                     // 锚点坐标（设计单位）
  root = pchTR(root, 0, 0, 0, PCH_BODY, PCH_BODY);
  const up = pose === 'sit' ? 86 : pose === 'peek' ? 240 : 0;           // 上身整体下移（坐、探头）
  const breath = 1.1 * Math.sin(tt * TAU / 3.4) + (ps.drop ? -ps.drop : 0);
  // 驼背：上身绕腰转；睡袍斜切跟上
  const lean = ps.lean || 0;
  const ugL = pchTR(pchPivot(pchTR(PCH_I, 0, up), 0, -130, lean), 0, -breath), ug = pchMul(root, ugL);
  const lowerM = lean ? pchMul(root, [1, 0, -Math.sin(lean) * 1.05 * 80 / 212, 1, 0, 0]) : root;
  // 头（头部件按 PCH_HEAD 放大：头大、身子小）
  const neck = [0, -212 + (ps.sink || 0)], neckL = pchApply(ugL, neck);
  const hr = (ps.hr || 0) + (md.chin || 0) * (pose === 'lie' ? 0 : 1) + tilt + .012 * Math.sin(tt * .9 + 1);
  const head = pchTR(ug, neck[0], neck[1], hr, PCH_HEAD, PCH_HEAD);
  const turn = clamp(pose !== 'cross' && md.turn !== undefined ? md.turn : ps.turn || 0, -1, 1);
  const look = clamp(o.look !== undefined ? o.look : (md.look !== undefined ? md.look : ps.look || 0), -1, 1);
  // 画的环境：投影随 s 略放大，边线约 1px
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1.7 / (s * dev), pat, x, y };
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
      for (const sd of [-1, 1]) { const a = .2 * Math.sin(tt * 2.4 + (sd > 0 ? 0 : 2.2)) + .08 * sd; const m = pchTR(root, sd * 15, 8, a); legs.push(it(G.shin, m, PCH_K.leg), it(G.sitShoe, m, PCH_K.shoe)); }
      paint(legs, PCH_SH.mid);
      paint([it(G.sitDress, root, PCH_K.dress), it(G.sitHem, root, PCH_K.dress)], PCH_SH.big);
      paint(G.sitStripes.map(p => it(p, root, PCH_K.stripe, false)), PCH_SH.tiny, false);
      paint([it(G.sitRobeL, root, PCH_K.robe), it(G.sitRobeR, root, PCH_K.robe)], PCH_SH.big);
    } else {
      const dm = pchTR(lowerM, 0, 0, 0, 1, 1 + breath / 320);
      paint([it(G.legL, root, PCH_K.leg), it(G.legR, root, PCH_K.leg)], PCH_SH.tiny);
      paint([it(G.shoeL, root, PCH_K.shoe), it(G.shoeR, root, PCH_K.shoe)], PCH_SH.mid);
      paint([it(G.dress, dm, PCH_K.dress), it(G.hem, lowerM, PCH_K.dress)], PCH_SH.big);
      paint(G.stripes.map(p => it(p, dm, PCH_K.stripe, false)), PCH_SH.tiny, false);
      paint([it(G.robeL, dm, PCH_K.robe), it(G.robeR, dm, PCH_K.robe), it(G.trimL, dm, PCH_K.trim), it(G.trimR, dm, PCH_K.trim)], PCH_SH.big);
    }
    paint([it(G.neck, ug, PCH_K.skin), it(G.collar, ug, PCH_K.trim)], PCH_SH.mid, false);
  }

  // ---- 手臂骨架 ----
  const shrug = ps.shrug || 0, arm = (sd, spec) => {
    const [a, b, hand, over] = spec, sh = [sd * 28, -200 - shrug];
    const k = ps.armLen || 1, u = pchTR(ug, sh[0], sh[1], -a, k, k), l = pchTR(u, 0, 36, -b);
    return { u, l, hand, over, tip: pchApply(l, hand === 'point' ? [.5, 62] : hand === 'grip' ? [0, 48] : [0, 51]) };
  };
  const AB = arm(-1, ps.back), AF = arm(1, ps.front);
  // 书
  let bookM = null;
  if (ps.book) bookM = pchTR(ug, ps.book[0], ps.book[1], ps.book[2] + .01 * Math.sin(tt * 1.1));
  else if (ps.hang) bookM = pchTR(AB.l, 0, 82, -.08 + .05 * Math.sin(tt * 1.6), -1, 1);  // tired：书吊在后手指尖下
  // 袖口跟袖子同一层（书后面的袖子，袖口也在书后面）；只有手指可以单独压到书前面，扣住书沿
  const sleeve = arms => { if (arms.length) { paint([...arms.map(A => it(G.armU, A.u, PCH_K.robe)), ...arms.map(A => it(G.armL, A.l, PCH_K.robe))], PCH_SH.big); paint(arms.map(A => it(G.cuff, A.l, PCH_K.trim)), PCH_SH.mid, false); } };
  const hands = arms => { const items = []; for (const A of arms) if (A.hand !== 'none') items.push(it(A.hand === 'point' ? G.handPoint : A.hand === 'grip' ? G.handGrip : G.handTips, A.l, PCH_K.skin)); paint(items, PCH_SH.mid, false); };
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
  pchFace(c, ps.nod ? pchTR(head, 0, ps.nod * 5.5) : head, md, { turn, look, blink, mouth, tt }, paint, it);

  // ---- 前发：鬓发、刘海 ----
  const lockM = sd => pchPivot(head, sd * 58, -110, -hr * .55 + .02 * Math.sin(tt * 1.5 + sd));
  const LR = lockM(1), LL = lockM(-1);
  paint([it(G.lockL, LL, PCH_K.hair), it(G.lockR, LR, PCH_K.hair), it(G.bangs, pchTR(head, turn * 5, 0), PCH_K.hair)], PCH_SH.mid);
  paint(G.bangLines.map(p => it(p, pchTR(head, turn * 5, 0), PCH_K.hairLine, false)), null, false);
  pchBrows(md, turn, ps.nod ? pchTR(head, 0, ps.nod * 3) : head, paint, it);
  if (ps.bookOverFace) { drawBook(); hands([AB, AF]); }
  // 发梢蝴蝶结（左红右蓝）
  const bowR = pchTR(LR, 67, 46, .2), bowL = pchTR(LL, -67, 48, -.25, .92, .92);   // 蝴蝶结系在胸口高度，下面再垂一截发尾
  paint([it(G.bow, bowL, PCH_K.red), it(G.bow, bowR, PCH_K.blue)], PCH_SH.tiny, false);
  paint([it(G.bowKnot, bowL, mix(PCH_K.red, P.ink, .25)), it(G.bowKnot, bowR, mix(PCH_K.blue, P.ink, .25))], null, false);
  if (pose !== 'peek') {
    const nb = pchTR(ug, 0, -207, 0, .9, .9);
    paint([it(G.neckBow, nb, PCH_K.red)], PCH_SH.tiny, false);
  }

  // ---- 帽子 ----
  const hat = pchPivot(pchTR(head, (ps.hatShift || 0) + turn * 4, 0), 0, -150, .01 * Math.sin(tt * 1.2 + .5) + (ps.hatRot || 0));   // lie：帽子被地板顶歪
  paint([it(G.puff, hat, PCH_K.capFold)], PCH_SH.big);
  c.save(); c.transform(hat[0], hat[1], hat[2], hat[3], hat[4], hat[5]); c.clip(G.puffClip); c.fillStyle = PCH_K.cap; c.fill(G.puffLight); c.restore();
  paint(G.pleats.map(p => it(p, hat, mix(PCH_K.cap, P.stripe, .45), false)), null, false);
  paint([it(G.frill, pchPivot(hat, 0, -150, .008 * Math.sin(tt * 1.9)), PCH_K.cap)], PCH_SH.mid);
  const moonM = pchTR(hat, 50, -180, -.55 + .03 * Math.sin(tt * 1.4));
  paint([it(G.moon, moonM, PCH_K.gold)], PCH_SH.mid);

  if (ps.armsLate) { sleeve([AB, AF]); hands([AB, AF]); }

  // ---- 表情道具 ----
  if (md.hmph) { const hm = pchTR(head, -112, -60, -hr + .1 * Math.sin(tt * 3), 1 + .05 * Math.sin(tt * 5), 1 + .05 * Math.sin(tt * 5));
    paint([it(G.puffCloud, hm, PCH_K.white)], PCH_SH.mid);
    c.save(); c.transform(hm[0], hm[1], hm[2], hm[3], hm[4], hm[5]); zh(c, '哼', 0, 4.5, { size: 13, align: 'center', color: P.ink }); c.restore(); }
  if (md.sweat) paint([it(G.sweat, pchTR(head, 66, -110 + 3 * ((tt * 2) % 1), .15), PCH_K.sweat)], PCH_SH.tiny);

  // ---- 扒边的手 ----
  let handPts;
  if (pose === 'peek') {
    if (clipped) { c.restore(); clipped = false; }
    const hp = [[-58, 0], [62, 0]].map(([hx, hy], i) => pchTR(frame, hx, hy + .6 * Math.sin(tt * 2 + i), (i ? .06 : -.08)));
    const cuffClip = new Path2D(); cuffClip.addPath(polyPath(rectPts(-3000, -3000, 6000, 3000)), new DOMMatrix(frame));
    c.save(); c.clip(cuffClip); paint(hp.map(m => it(G.peekCuff, m, PCH_K.trim)), PCH_SH.tiny, false); c.restore();
    paint(hp.map(m => it(G.peekHand, m, PCH_K.skin)), PCH_SH.mid, false);
    handPts = hp.map(m => pchApply(m, [0, 4]));
  } else handPts = [AB.tip, AF.tip];
  if (clipped) c.restore();
  const bookPt = bookM ? pchApply(bookM, [0, 0]) : pchApply(frame, [0, 0]);
  return { head: pchApply(head, [0, -70]), hands: handPts.slice().sort((a, b) => a[0] - b[0]), book: bookPt, tip: pose === 'peek' ? handPts[1] : AF.tip };
}

// 五官（第三版，照 Live2D 的拆层）：眼白 → 虹膜 → 虹膜下半的亮色 → 瞳孔 → 虹膜上沿的阴影 → 一大一小两个高光，后五层都裁在眼白里，
// 眼睑压下来时自动被盖住；最后压一条粗上眼线（外眼角一撇）。腮红是一团粉加三道斜线。
const pchSmooth = pts => polyPath(pts, true);
function pchFace(c, head, md, f, paint, it) {
  const { turn, look, blink, mouth, tt } = f, low = [], top = [], eyes = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .28 : 1, ex = sd * 28 * (sd * turn > 0 ? 1 - Math.abs(turn) * .15 : 1) + turn * 12, ey = -54;
    const bs = md.blush, bx = ex + sd * 14 + turn, by = -30 + (bs > 1.4 ? 1 : 0);
    low.push(it(pchCut(ellPts(bx, by, 10 * bs * far, 5 * Math.sqrt(bs), 16), 80 + sd, 4, .3), head, PCH_K.blush, false));
    for (let k = -1; k <= 1; k++) { const hx = bx + k * 4.2 * far, hy = by - .5; low.push(it(pchSmooth([[hx + 1.4, hy - 2.6], [hx + 2.3, hy - 2.2], [hx - 1.4, hy + 2.6], [hx - 2.3, hy + 2.2]]), head, mix(PCH_K.blush, P.ink, .25), false)); }
    const lidFrac = md.closed ? 1 : clamp(lerp(md.lid, 1, blink), 0, 1);
    const es = md.es || 1, rx = 13 * far * es, ry = 16 * es, ex2 = ex + look * 3.4 * far, topY = ey - ry;
    if (lidFrac > .9) {
      const arc = md.closed === 'up' ? -4.4 : 3.4, base = md.closed === 'up' ? ey + 2 : ey + ry * .55, pts = [], back = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10 * 2 - 1, xx = ex + u * (rx + 2), yy = base + arc * (1 - u * u) + sd * u; pts.push([xx, yy - 1.9]); back.unshift([xx, yy + 1.9 - Math.abs(u) * .9]); }
      top.push(it(pchCut([...pts, ...back], 90 + sd, 3, .2, false), head, PCH_K.lid, false));
      continue;
    }
    const lidY = xx => topY + lidFrac * 2 * ry + (md.tilt || 0) * (xx - ex) * sd;
    const lowY = md.lower ? ey + ry - md.lower : Infinity;
    const white = ellPts(ex, ey, rx, ry, 24).map(([xx, yy]) => [xx, clamp(yy, lidY(xx), lowY)]);
    const iy = ey + 1.5, irx = rx * .8, iry = ry * .86, lidC = lidY(ex2);
    eyes.push({ white, layers: [
      [ellPts(ex2, iy, irx, iry, 20), PCH_K.eye],
      [ellPts(ex2, iy + iry * .42, irx * .74, iry * .44, 16), PCH_K.irisLt],
      [ellPts(ex2, iy - 1, irx * .42, iry * .46, 14), PCH_K.pupil],
      [ellPts(ex2, Math.max(lidC, iy - iry) - 1, irx * 1.05, iry * .5, 18), PCH_K.irisShade, ellPts(ex2, iy, irx, iry, 20)],
      [ellPts(ex2 - irx * .36, iy - iry * .36, 3.9, 4.6, 12), PCH_K.white],
      [ellPts(ex2 + irx * .34, iy + iry * .4, 1.9, 1.9, 8), PCH_K.white],
    ] });
    // 粗上眼线：沿眼睑走，外眼角挑一撇；下睫毛一小截
    const xi = ex - sd * (rx + .5), xo = ex + sd * (rx + 2.4), ly0 = lidY(xi) + (lidFrac < .05 ? 5 : 0), ly1 = lidY(xo) + (lidFrac < .05 ? 5 : 0), lm = lerp(ly0, ly1, .5) - (lidFrac < .05 ? 4 : 0);
    top.push(it(pchCut([[xi, ly0 - 1.5], [lerp(xi, xo, .5), lm - 4.2], [xo, ly1 - 4.4], [xo + sd * 4, ly1 - 7.5], [xo + sd * 1.8, ly1 + .8], [lerp(xi, xo, .5), lm + .4], [xi, ly0 + 1.2]], 88 + sd, 3, .2, false), head, PCH_K.lid, false));
  }
  const [mp, mc] = pchMouthPts(md.mouth, mouth);
  low.push(it(pchCut(mp, 95, 2.4, .15, false), pchTR(head, turn * 13 + (md.puff ? -2 : 0), -24, 0, 1.3, 1.3), mc, false));
  paint(low, PCH_SH.tiny, false);
  // 眼睛：眼白一片，里面的层裁在眼白里
  for (const e of eyes) {
    const wp = pchSmooth(e.white);
    paint([it(wp, head, PCH_K.sclera, false)], PCH_SH.tiny, false);
    c.save(); c.transform(head[0], head[1], head[2], head[3], head[4], head[5]); c.clip(wp);
    for (const [pts, col, inside] of e.layers) { c.fillStyle = col; if (inside) { c.save(); c.clip(pchSmooth(inside)); c.fill(pchSmooth(pts)); c.restore(); } else c.fill(pchSmooth(pts)); }
    c.restore();
  }
  paint(top, PCH_SH.tiny, false);
}
// 眉毛：两小片细纸（压在刘海上，演不高兴/得意）
function pchBrows(md, turn, head, paint, it) {
  const [dy, ang] = md.brow || [0, 0], items = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * 28 * far + turn * 12, cy = -86 - dy, len = 8.5 * far;
    const pts = [[-sd * len, -1.6], [sd * len * .4, -1.4], [sd * len, -.2], [sd * len * .4, 1.1], [-sd * len, 1.6]];
    items.push(it(pchCut(pts, 97 + sd, 3, .15, false), pchTR(head, cx, cy, -sd * ang), PCH_K.brow, false));
  }
  paint(items, PCH_SH.tiny, false);
}

// 第一版 Q 版接口的兼容别名：旧场景还会调用，之后重写掉
function drawPatchouliChibi(c, o = {}) {
  const map = { stand: 'stand', flat: 'lie', lift: 'lift', sit: 'sit', lie: 'lie', run: 'stand' };
  return drawPatchouli(c, { ...o, pose: map[o.pose] || 'stand', h: o.h || 300 });
}
