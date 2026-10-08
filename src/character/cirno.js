'use strict';
// 琪露诺 —— 剪纸人偶（第三版：Q 版比例、分层眼睛、深色描边，照 src/character/patchouli.js 的样板，规格见 docs/rig.md「统一比例」）。
// 纯 Canvas 代码绘制，不加载任何图片。
//
// drawCirno(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], hold:[x,y] }
//   x, y     脚底中心（fly：悬空时脚尖下方那一点，也就是她影子落的地方）
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，头和身子和帕秋莉一样大，蝴蝶结高出头顶多少不算）。所有姿势共用这个比例
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手叉腰 | proud 一手叉腰、一手握拳举高（「我是最强的」，gesture 举多高）
//            point 一手叉腰、一手伸向前方（gesture 伸多远）| hold 双手把一张纸举过头顶（hold 是纸的中心）
//            think 手指点下巴、头歪、眼睛往上看 | slump 垂头垮肩、手垂下、翅膀耷拉
//            fly 悬空、两臂张开、翅膀扇动、两腿后收 | throw 双手向前泼（拿水桶用：hands 是桶沿两侧，hold 是桶口中心；gesture 0 拉回 → 1 泼出）
//            旧名兼容：lecture→point、cross/cheer→proud、tired→slump、lift→hold、sit/lie/peek→stand
//   mood     normal 睁圆的大眼+自信的笑（默认）| proud 闭眼弧线+大张嘴笑、下巴抬 | happy 笑眼 | surprised 眼睛更圆、瞳孔缩小、嘴 o
//            confused 眉毛一高一低、眼睛往上、头顶冒问号 | pout 鼓腮、斜眼、眉毛压低 | cry 眼睛挤成「> <」、冰晶眼泪
//            旧名兼容：smug→proud、smile→happy、flustered→surprised、annoyed/angry→pout、sad→cry、sleepy/calm→normal
//   look     -1..1 眼珠左右（+ 朝 facing 那边）  tilt 头部倾斜（弧度）   mouth 0..1 说话张嘴   blink 0..1 闭眼
//   t        秒（待机晃动、翅膀轻闪；一拍两帧）   gesture 0..1 动作幅度（不传则缓慢起伏）
//   返回值都是调用方坐标系里的点：head 脸中心，hands 两只手（拳心/握点/指尖，按屏幕 x 从左到右），
//   tip 前手（朝 facing 那只）的指尖或拳头，hold 两手之间（hold 姿势是举着的那张纸的中心，throw 是桶口中心）。
//
// 做法照抄帕秋莉：每个部件是一片剪纸（kit 的 scissor 剪刀边 + 纸纹），轮廓在载入时剪好（seed 固定），每帧只做仿射变换，
// 部件绕脖子、肩、肘、翅根转；同一层的部件合并成一条路径画一次投影。五官随参数变形，按量化后的参数记忆（只是缓存，画面仍只由参数决定）。
// 翅膀是半透明的浅冰蓝纸（vellum 的思路：透出底下的纸和投影）。
// 设计坐标：人偶高 520，脚底 (0,0)，y 向下。身子部件按脖子 -212 画、再乘 CIR_BODY（脖子落在 -248）；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150，脸宽 ±64，和帕秋莉同一套），再乘 CIR_HEADK（绝对 1.2 倍）。
// 本文件顶层名字都带 cir 前缀。

// ===================== 颜色（和 P 里帕秋莉那组同样压暗、低饱和） =====================
// 冰色和 props.js 的 EP2_ICE / EP2_ICE_DEEP / EP2_FROST 相同（本文件先于 props.js 载入，所以抄值）
const CIR_K = (() => {
  const hair = '#9db7cb', hairBack = '#7c9ab4', dress = '#5b7ca2', bow = '#44628c', eye = '#3d6390';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress, pleat: mix(dress, P.ink, .2), trim: mix(dress, P.cap, .35),
    bow, bowLight: mix(bow, '#b9cde0', .3), bowFold: mix(bow, P.ink, .38), bowKnot: mix(bow, P.ink, .12), bowCrease: mix(bow, P.ink, .3),
    shirt: P.cap, collar: mix(P.cap, '#b9c9d6', .25), ribbon: P.ribbonRed,
    skin: P.skin, blush: P.blush, leg: mix(P.skin, P.cap, .15), sock: '#f3efe8', shoe: mix(dress, P.ink, .5),
    // 眼睛分层（第三版）：眼白、虹膜、虹膜下半亮色、瞳孔、虹膜上沿阴影
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#a9d4ec', .62), pupil: mix(eye, P.ink, .78), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lash: mix(eye, P.ink, .72), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    wing: '#cfe2ee', wingDeep: '#9fc3da', frost: '#f4fafd', tear: '#bcd9ea', q: mix(bow, P.ink, .2), white: '#f7f3ee',
  };
})();
// 描边：深色细线（第三版，同 pchEdge；翅膀是半透明冰纸，边用冰蓝压暗，不用墨色）
const CIR_EDGE = { [CIR_K.wing]: alpha(mix(CIR_K.wingDeep, P.ink, .3), .7) };
const cirEdge = col => CIR_EDGE[col] || (CIR_EDGE[col] = alpha(mix(col, P.ink, .62), .85));

// ===================== 矩阵（[a,b,c,d,e,f]，和 canvas 的 transform 同序） =====================
const cirMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const cirApply = (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]];
// cirTR：m × 平移(x,y) × 旋转 a × 缩放(sx,sy)
function cirTR(m, x = 0, y = 0, a = 0, sx = 1, sy = 1) { const co = Math.cos(a), si = Math.sin(a); return cirMul(m, [co * sx, si * sx, -si * sy, co * sy, x, y]); }
const cirPivot = (m, px, py, a) => cirTR(cirTR(m, px, py, a), -px, -py);
const CIR_I = [1, 0, 0, 1, 0, 0];

// ===================== 剪纸轮廓 =====================
function cirCut(pts, seed, step = 8, amp = .7, smooth = true) { return polyPath(scissor(smooth ? spline(pts, 3, true) : pts, 2000 + seed, step, amp), true); }
const cirMirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const cirOpen = (pts, step = 4) => spline(pts, step, false);
const cirSmooth = pts => polyPath(pts, true);
// 粗线 → 轮廓（问号、眼泪用）：沿折线两侧各偏 w/2（w 可以是 u→宽度 的函数）
function cirStroke(pts, w) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.min(n - 1, i + 1)], b = pts[Math.max(0, i - 1)], dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, hw = (typeof w === 'function' ? w(i / (n - 1)) : w) / 2;
    L.push([pts[i][0] - dy / l * hw, pts[i][1] + dx / l * hw]); R.unshift([pts[i][0] + dy / l * hw, pts[i][1] - dx / l * hw]);
  }
  return [...L, ...R];
}
// 荷叶边：沿 f(u) 做 n 个鼓包（同 pchScallop）
function cirScallop(f, n, depth, m = 4) {
  const out = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
    const u = (i + k / m) / n, p = f(u), q = f(Math.min(1, u + .01)), r = f(Math.max(0, u - .01)), dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, b = Math.sin(Math.PI * k / m) * depth;
    out.push([p[0] + dy / l * b, p[1] - dx / l * b]);
  }
  out.push(f(1)); return out;
}
// 五官随参数变形：按量化后的 key 记忆剪好的路径
const CIR_MEMO = new Map();
function cirMemo(key, f) { let p = CIR_MEMO.get(key); if (!p) { if (CIR_MEMO.size > 800) CIR_MEMO.clear(); p = f(); CIR_MEMO.set(key, p); } return p; }
const cirQ = (v, k = 20) => Math.round(v * k) / k;

// ===================== 静态部件（载入时剪好） =====================
// 第三版比例（同帕秋莉）：身子坐标脖子在 -212、肩 (±28,-200)，乘 CIR_BODY 后脖子约 -248；头部件乘 CIR_HEADK 后脸宽约 154、下巴到头顶约 180。
// 翅膀：每边三片 [基础角（0 = 水平向外，- 向上）, 长, 宽]
const CIR_WINGS = [[-.78, 74, 17], [-.24, 86, 19], [.32, 66, 15]];
const CIR_NECK = -212, CIR_SHOULDER = [28, -200], CIR_UP = 34, CIR_FORE = 30, CIR_WAIST = -170, CIR_HAND = 1.3;
const CIR_BODY = 1.17, CIR_HEADK = 1.2 / CIR_BODY, CIR_BOWY = -172, CIR_BOWS = .8;   // 蝴蝶结：结的位置（头坐标）和整体缩放
const CIR_G = (() => {
  const g = {};
  // ---- 腿（站姿，脚底为原点）：短腿、白袜、深色圆鞋（鞋尖略朝前） ----
  const legR = [[8, -60], [19, -60], [18.6, -36], [18, -14], [9, -14], [8.6, -36]];
  g.legR = cirCut(legR, 1, 8, .3); g.legL = cirCut(cirMirror(legR), 2, 8, .3);
  const sockR = [[8.4, -32], [18.4, -32], [18.2, -11], [8.6, -11]];
  g.sockR = cirCut(sockR, 3, 6, .25, false); g.sockL = cirCut(cirMirror(sockR), 4, 6, .25, false);
  g.shoeR = cirCut(ellPts(15, -9, 15, 9.5, 18), 5, 5, .4); g.shoeL = cirCut(ellPts(-14, -9, 15, 9.5, 18), 6, 5, .4);
  // 衬裙：裙摆下露出的一圈白色荷叶边
  g.petti = cirCut([...cirOpen([[-70, -54], [0, -51], [70, -54]], 6), ...cirScallop(u => [lerp(75, -75, u), -41 + 3 * (1 - (2 * u - 1) ** 2)], 12, 4.5)], 7, 4, .45, false);
  // 背心裙：腰在 -170，裙摆张成钟形（下缘中间略低，像从略高处看圆裙）
  g.skirt = cirCut([[-18, -173], [0, -174], [18, -173], [22, -162], [30, -140], [43, -110], [57, -80], [68, -58], [73, -50], [36, -47], [0, -46], [-36, -47], [-73, -50], [-68, -58], [-57, -80], [-43, -110], [-30, -140], [-22, -162]], 8, 11, .8);
  // 褶：贴在裙子上的深色细纸条，按裙形散开
  g.pleats = [-.7, -.35, 0, .35, .7].map((u, i) => { const xt = u * 20, xb = u * 68;
    return cirCut([[xt - .9, -160], [xt + .9, -160], [xb + 2, -50], [xb - 2, -50]], 10 + i, 12, .4, false); });
  // 衬衫上身 + 背心裙胸片（U 形领口露出衬衫）
  g.shirt = cirCut([[-14, -218], [14, -218], [23, -211], [27, -198], [25, -176], [-25, -176], [-27, -198], [-23, -211]], 16, 8, .5);
  g.bodice = cirCut([[-24, -201], [-13, -201], [-10, -191], [0, -186], [10, -191], [13, -201], [24, -201], [25, -184], [22, -167], [-22, -167], [-25, -184]], 17, 8, .5, false);
  g.neck = cirCut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 18, 8, .3, false);
  const collarR = [[1, -215], [13, -217], [20, -208], [13, -200], [5, -203], [2, -209]];
  g.collarR = cirCut(collarR, 19, 4, .3, false); g.collarL = cirCut(cirMirror(collarR), 20, 4, .3, false);
  // 小红领结（中心为原点，宽约 20）
  g.ribbon = cirCut([[0, -2.2], [-5, -5.5], [-9.5, -6], [-10.5, -.5], [-8.5, 4.5], [-3, 2.2], [-5, 9.5], [-2, 10], [0, 3.5], [2, 10], [5, 9.5], [3, 2.2], [8.5, 4.5], [10.5, -.5], [9.5, -6], [5, -5.5]], 21, 3, .25, false);
  // 飞行时的腿（胯为原点，脚尖朝下）
  g.flyLeg = cirCut([[-5.5, 0], [5.5, 0], [5.2, 22], [4.6, 40], [-4.6, 40], [-5.2, 22]], 22, 8, .3);
  g.flySock = cirCut([[-4.9, 22], [4.9, 22], [4.6, 42], [-4.6, 42]], 23, 6, .2, false);
  g.flyShoe = cirCut(ellPts(0, 46, 7.5, 10.5, 16), 24, 4, .3);
  // ---- 手臂：上臂（肩为原点，向下 +y，长 CIR_UP）、泡泡袖、前臂（肘为原点，长 CIR_FORE）、手（腕为原点，乘 CIR_HAND） ----
  g.armU = cirCut([[-6, 6], [6, 6], [6.2, 22], [5.6, CIR_UP + 2], [0, CIR_UP + 4.5], [-5.6, CIR_UP + 2], [-6.2, 22]], 30, 8, .3);
  g.fore = cirCut([[-5.6, -3], [0, -5], [5.6, -3], [5.3, 15], [4.7, CIR_FORE + 1], [-4.7, CIR_FORE + 1], [-5.3, 15]], 31, 8, .3);
  g.puff = cirCut([[-13, -6], [-5, -12], [5, -12], [13, -6], [16, 6], [13.5, 17], [0, 20.5], [-13.5, 17], [-16, 6]], 32, 7, .5);
  g.cuff = cirCut([[-13.8, 15.5], [0, 18.5], [13.8, 15.5], [13.2, 20.5], [0, 23.5], [-13.2, 20.5]], 33, 5, .3, false);
  const hs = pts => pts.map(([x, y]) => [x * CIR_HAND, y * CIR_HAND]);
  g.hand = {
    open: cirCut(hs([[-4.2, -1], [4.2, -1], [5.6, 5], [5.2, 10.5], [2.8, 13.6], [-.6, 14], [-3.4, 12.6], [-4.8, 8.5], [-7.6, 6], [-7.8, 3.4], [-4.8, 2.4]]), 34, 3, .2, false),
    fist: cirCut(hs(ellPts(0, 5.6, 6, 6.8, 14)), 35, 3, .25),
    point: cirCut(hs([[-4.2, -1], [4.2, -1], [5.2, 5], [4, 8.8], [2.2, 10], [2.1, 20], [0, 22.6], [-2, 20], [-2.2, 10], [-5, 8], [-5.4, 3]]), 36, 3, .2, false),
    grip: cirCut(hs([[-4.2, -1], [4.2, -1], [6.2, 4], [6.4, 9], [3, 12], [-1, 11.4], [-3, 8.5], [-6.4, 7.4], [-6.2, 2.4]]), 37, 3, .2, false),
  };
  g.handTip = { open: [0, 13 * CIR_HAND], fist: [0, 6.5 * CIR_HAND], point: [0, 22 * CIR_HAND], grip: [0, 7 * CIR_HAND] };
  // ---- 翅膀：细长冰晶（根为原点，指向 +x），每片按自己的长宽剪；中间一道霜白的棱 ----
  g.wings = CIR_WINGS.map(([, L, w], k) => ({
    p: cirCut([[0, -w * .34], [L * .62, -w * .5], [L * .9, -w * .3], [L, 0], [L * .9, w * .3], [L * .62, w * .5], [0, w * .34]], 40 + k, 9, .5, false),
    f: cirCut([[4, -w * .06], [L * .84, -w * .05], [L * .93, 0], [L * .84, w * .05], [4, w * .06]], 44 + k, 9, .2, false) }));
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150；脸型同帕秋莉：圆脸、两颊鼓、下巴小） ----
  g.face = cirCut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 50, 7, .5);
  g.cheekPuff = [1, -1].map((sd, i) => cirCut(ellPts(sd * 50, -26, 10, 9.5, 16), 51 + i, 5, .3));
  // 后发：到肩上的波波头，比脸宽一圈，发梢往外翘（剪成几道尖）
  const bSide = cirOpen([[0, -177], [40, -173], [66, -152], [79, -118], [84, -80], [83, -44], [79, -16], [81, 0]], 5);
  const bTips = [[90, 12], [74, 6], [70, 17], [60, 3], [50, 13], [40, -2], [24, 4], [0, -6]];
  g.backHair = cirCut([...bSide, ...bTips, ...cirMirror([...bSide, ...bTips.slice(0, -1)])], 52, 9, .8, false);
  // 鬓发：从太阳穴垂到下巴两侧，盖住脸边
  const lockR = [...cirOpen([[50, -134], [69, -122], [78, -92], [79, -56], [76, -26], [73, -8]], 4), [76, 8], [66, -1], [62, 10], [57, -8], ...cirOpen([[57, -22], [58, -56], [56, -90], [47, -122]], 4)];
  g.lockR = cirCut(lockR, 53, 6, .5, false); g.lockL = cirCut(cirMirror(lockR), 54, 6, .5, false);
  // 刘海：盖住整个头顶（没有帽子，刘海的上沿就是头顶的轮廓），下缘碎、长短不齐，正中一缕长的；下缘压到眼睛上沿
  g.bangs = cirCut([[-73, -116], [-71, -146], [-57, -166], [-31, -177], [0, -180], [31, -177], [57, -166], [71, -146], [73, -116], [71, -100], [63, -82], [57, -97], [49, -74], [41, -92], [33, -76], [25, -95], [15, -78], [7, -92], [2, -70], [-3, -92], [-12, -77], [-22, -95], [-31, -75], [-40, -93], [-48, -76], [-56, -97], [-63, -84], [-71, -102]], 55, 6, .5, false);
  g.bangLines = [[33, -76, 36, -132], [2, -70, 3, -138], [-31, -75, -33, -130], [49, -74, 56, -118], [-48, -76, -55, -120], [15, -78, 18, -150], [-12, -77, -14, -150]].map(([x0, y0, x1, y1], i) => cirCut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 56 + i, 8, .2, false));
  // 头顶的大蝴蝶结（结为原点，结正压在头顶的头发上）：两翼斜向上张开、下缘贴着头顶的弧往下垂到头发上。
  // 体积靠三层：后面一层深色（翼的背面，从上沿露出一道）、前面一层翼、里面一道深色的口（布圈的开口），加从结散开的褶和上沿的亮面。
  const loopR = [[5, -7], [18, -22], [38, -42], [62, -56], [84, -57], [97, -42], [96, -18], [86, 2], [66, 12], [42, 13], [20, 10], [5, 6]];
  g.bowBackR = cirCut(loopR.map(([x, y]) => [x * 1.03 + 1, y * 1.12 - 4]), 59, 7, .6); g.bowBackL = cirCut(cirMirror(loopR.map(([x, y]) => [x * 1.03 + 1, y * 1.12 - 4])), 58, 7, .6);
  g.bowR = cirCut(loopR, 60, 7, .6); g.bowL = cirCut(cirMirror(loopR), 61, 7, .6);
  const lightR = [[14, -16], [38, -38], [62, -51], [82, -52], [92, -40], [78, -42], [60, -40], [38, -28], [16, -10]];
  g.lightR = cirSmooth(spline(lightR, 3, true)); g.lightL = cirSmooth(spline(cirMirror(lightR), 3, true));
  const pocketR = [[8, -4], [16, -14], [26, -16], [30, -6], [26, 4], [14, 5]];
  g.pocketR = cirCut(pocketR, 62, 4, .3); g.pocketL = cirCut(cirMirror(pocketR), 63, 4, .3);
  g.creases = [[[14, -2], [70, -30]], [[14, 4], [72, 0]], [[14, -8], [56, -46]]].flatMap(([a, b], i) => [1, -1].map(sd => {
    const ax = a[0] * sd, bx = b[0] * sd, mx = lerp(ax, bx, .5), my = lerp(a[1], b[1], .5) + 3;
    return cirCut([[ax, a[1] - 1.6], [mx, my - .9], [bx, b[1]], [mx, my + .9], [ax, a[1] + 1.6]], 64 + i * 2 + (sd > 0 ? 0 : 1), 9, .2, false); }));
  g.bowKnot = cirCut(ellPts(0, 0, 13, 15, 16), 70, 4, .3);
  g.knotFold = cirCut([[-11, -2.5], [0, -4], [11, -2.5], [10, 1], [0, 0], [-10, 1]], 71, 4, .2, false);
  // ---- 表情道具 ----
  // 问号：一段粗弧 + 一个点（中心约在原点，高约 34）
  const hook = []; for (let k = 0; k <= 14; k++) { const a = Math.PI * 1.08 + k / 14 * Math.PI * 1.42; hook.push([8.5 * Math.cos(a), -9 + 8.5 * Math.sin(a)]); }
  hook.push([0, 2], [0, 6]);
  g.qHook = cirCut(cirStroke(hook, 5.2), 72, 3, .25, false); g.qDot = cirCut(circPts(0, 13, 3.2, 10), 73, 3, .2);
  // 冰晶眼泪（小菱形）
  g.drop = cirCut([[0, -4.5], [2.6, 0], [0, 4.5], [-2.6, 0]], 74, 2, .1, false);
  return g;
})();

// ===================== 表情 =====================
// eye: open（默认）| up（∩ 闭眼笑）| squeeze（> <）；lid 上眼睑盖住的比例，lt 眼睑外端下垂，es 眼睛大小，iris 虹膜大小，lower 下眼睑推上来（笑眼）
// brow [上移, 内端下压角, 是否一高一低]；mouth 嘴型；blush 腮红；chin 下巴抬(-)；htilt 头歪；turn 脸侧开；look / lookY 眼珠
const CIR_MOODS = {
  normal: { lid: 0, es: 1.05, brow: [2, .18], mouth: 'grin', blush: 1 },
  proud: { eye: 'up', brow: [5, -.2], mouth: 'laugh', blush: 1.25, chin: -.16 },
  happy: { lid: .04, es: 1.04, lower: 8, brow: [4, -.12], mouth: 'smile', blush: 1.3 },
  surprised: { lid: 0, es: 1.16, iris: .74, brow: [9, -.12], mouth: 'o', blush: 1 },
  confused: { lid: .04, es: .98, iris: .86, brow: [4, -.22, true], mouth: 'wave', blush: 1, q: true, htilt: .1, look: -.4, lookY: -3.5 },
  pout: { lid: .3, lt: -.05, es: 1, brow: [-2, .42], mouth: 'pout', blush: 1.45, puff: true, turn: -.45, look: 1 },
  cry: { eye: 'squeeze', brow: [4, -.42], mouth: 'wail', blush: 1.45, tears: true },
};
const CIR_MOOD_ALIAS = { smug: 'proud', smile: 'happy', flustered: 'surprised', panic: 'surprised', annoyed: 'pout', angry: 'pout', sad: 'cry', sleepy: 'normal', calm: 'normal' };
const CIR_POSE_ALIAS = { lecture: 'point', cross: 'proud', cheer: 'proud', tired: 'slump', lift: 'hold', sit: 'stand', lie: 'stand', peek: 'stand', read: 'stand', walk: 'stand', run: 'stand' };

// 嘴：一小片会变形的纸（嘴坐标原点在嘴中间）。open 0..1 说话张嘴。返回 [轮廓, 颜色, 舌头轮廓?]
function cirMouthPts(type, open) {
  const big = { laugh: [9.5, 8.5], smile: [7, 5.2], wail: [7.5, 7.5] }[type];
  if (big) {
    const [w, h0] = big, oh = h0 + open * 4, ww = w + open * 1.5, dip = type === 'wail' ? -1.6 : 0;
    const pts = [[-ww, -1.5 - dip * .3], [-ww * .45, -.8 + dip], [0, -.3], [ww * .45, -.8 + dip], [ww, -1.5 - dip * .3], [ww * .78, oh * .5], [ww * .42, oh * .9], [0, oh], [-ww * .42, oh * .9], [-ww * .78, oh * .5]];
    return [pts, CIR_K.mouthIn, ellPts(0, oh * .72, ww * .45, oh * .26, 12)];
  }
  if (open > .06 && type !== 'o') {
    const w = 8 + open * 3, oh = 2 + open * 7, lift = type === 'grin' ? 1.4 : type === 'pout' || type === 'wave' ? -.6 : 0;
    return [[[-w / 2, -lift], [-w / 4, -.5], [w / 4, -.5], [w / 2, -lift - (type === 'grin' ? .8 : 0)], [w * .36, oh * .62], [0, oh], [-w * .36, oh * .62]], CIR_K.mouthIn, open > .4 ? ellPts(0, oh * .72, w * .2, oh * .2, 10) : null];
  }
  switch (type) {
    // 自信的笑：宽而浅的 D 形，一边嘴角挑高
    case 'grin': return [[[-7, -1.4], [-3, -.3], [3, -.6], [7.4, -2.8], [5, 2.2], [0, 3.6], [-4.6, 2.4]], CIR_K.mouthIn];
    case 'wave': { const top = [], bot = []; for (let k = 0; k <= 12; k++) { const x = -6.5 + k * 13 / 12, y = Math.sin(k / 12 * TAU * 1.25) * 1.1; top.push([x, y - .7]); bot.unshift([x, y + .7]); } return [[...top, ...bot], CIR_K.mouth]; }
    case 'pout': return [[[-4.4, 1.6], [0, -1.4], [4.4, 1.6], [3.5, 2.6], [0, .7], [-3.5, 2.6]], CIR_K.mouth];
    case 'o': return [ellPts(0, 3, 4.4 + open * 2, 5.8 + open * 3, 14), CIR_K.mouthIn];
    default: return [[[-4, .1], [0, -.7], [4, .5], [0, 1.1]], CIR_K.mouth];
  }
}

// ===================== 姿势 =====================
// 手臂 [a 上臂从下垂往 +x 摆的角, b 前臂相对上臂再摆的角, 手型, 画在头发外面(late), 上臂拉长, 前臂拉长]
// lean 上身绕腰转（+ 朝 facing 那边），hr 头额外转角，sink 脖子下沉，shrug 耸肩，wings [张开量, 扇动幅度, 下垂]
// hold：纸的中心在两手中点上方多少（身子坐标）
function cirPose(pose, g, tt) {
  const hipB = [-.62, 1.38, 'fist', false], hipF = [.62, -1.38, 'fist', false];
  switch (pose) {
    case 'proud': return { back: hipB, front: [lerp(1.9, 2.75, g), lerp(-.35, .2, g), 'fist', true, 1.3, 1.3], lean: -.035, turn: .1, look: .2, wings: [.4, 0, 0], shrug: 3 };
    case 'point': return { back: hipB, front: [lerp(1.25, 1.62, g), lerp(.3, 0, g), 'point', false, lerp(1, 1.15, g), lerp(1, 1.15, g)], lean: .045 * g, turn: .32, look: .8, wings: [.15, 0, 0] };
    case 'hold': return { back: [-2.5, -.45, 'grip', true, 1.85, 1.85], front: [2.5, .45, 'grip', true, 1.85, 1.85], shrug: 8, sink: 3, turn: 0, look: 0, lookY: -3.5, hr: 0, wings: [.25, 0, 0], hold: 90 };
    case 'think': return { back: [-.62, 1.38, 'fist', false], front: [-.35, -2.6, 'point', true, 1, 1], hr: -.13, turn: .22, look: .5, lookY: -4, wings: [0, 0, .05] };
    case 'slump': return { back: [-.06, .05, 'open', false], front: [.06, -.05, 'open', false], lean: .02, hr: .2, nod: 1, sink: 6, shrug: -6, turn: .1, look: -.2, lookY: 3, wings: [-.2, 0, .55], droop: 1 };
    case 'fly': return { back: [-1.38, -.4, 'open', true], front: [1.28, .42, 'open', true], lean: .09, turn: .25, look: .5, wings: [1, 1, 0], fly: true, shrug: 2 };
    case 'throw': return { back: [lerp(.2, 1.62, g), lerp(-.1, .1, g), 'grip', false, 1.1, 1.1], front: [lerp(.35, 1.78, g), lerp(-.3, -.1, g), 'grip', false, 1.1, 1.1], lean: lerp(-.05, .1, g), turn: .35, look: .7, wings: [.3 * g, 0, 0] };
    default: return { back: hipB, front: hipF, turn: .16, look: .15, wings: [0, 0, 0] };
  }
}

// ===================== 绘制 =====================
const CIR_OFF = 6000;
// cirPaint：画一层剪纸。items = [{ p, m, col, edge }]；sh 投影（同层合并一次）；gr 纸纹；al 半透明（翅膀）
function cirPaint(c, items, sh, env, gr = true, al = 1) {
  if (!items.length) return;
  const all = new Path2D();
  for (const it of items) all.addPath(it.p, new DOMMatrix(it.m));
  if (al < 1) { c.save(); c.globalAlpha *= al; }
  if (sh) {
    const T = c.getTransform();
    c.save(); c.shadowColor = `rgba(30,20,35,${sh.al ?? .3})`; c.shadowBlur = sh.blur * env.sk; c.shadowOffsetX = T.a * CIR_OFF + sh.sx * env.sk; c.shadowOffsetY = T.b * CIR_OFF + sh.sy * env.sk;
    c.translate(-CIR_OFF, 0); c.fillStyle = '#000'; c.fill(all); c.restore();
  }
  for (const it of items) {
    c.save(); c.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5]); c.fillStyle = it.col; c.fill(it.p);
    if (it.edge !== false) { c.strokeStyle = cirEdge(it.col); c.lineWidth = env.lw; c.stroke(it.p); }
    c.restore();
  }
  if (gr && env.pat) { c.save(); c.globalAlpha *= .11; c.fillStyle = env.pat; c.fill(all); c.restore(); }
  if (al < 1) c.restore();
}
const CIR_SH = { big: { blur: 5, sx: 2.4, sy: 3.4, al: .3 }, mid: { blur: 3.5, sx: 1.8, sy: 2.4, al: .3 }, tiny: { blur: 1.2, sx: .8, sy: 1, al: .3 }, wing: { blur: 4, sx: 2.6, sy: 3.6, al: .22 } };

function drawCirno(c, o = {}) {
  const { x = 0, y = 0, h = 500, facing = 1, tilt = 0, mouth = 0, blink = 0, t = 0 } = o;
  const pose = CIR_POSE_ALIAS[o.pose] || o.pose || 'stand', moodName = CIR_MOOD_ALIAS[o.mood] || o.mood || 'normal';
  const md = CIR_MOODS[moodName] || CIR_MOODS.normal, tt = twos(t + CLOCK0), s = h / 520;   // 设计高 520；CLOCK0：全片时钟（core.js），交接处待机动作连续
  const g = o.gesture == null ? .6 + .3 * Math.sin(tt * 1.4) : clamp(o.gesture, 0, 1);
  const ps = cirPose(pose, g, tt);
  // ---- 根：锚点 → 设计坐标。待机晃得比帕秋莉明显（身体绕脚底摆，外加一点上下蹦） ----
  const fly = !!ps.fly, lift = fly ? 50 + 6 * Math.sin(tt * 2.2) : 0;
  const sway = (fly ? .03 : .016) * Math.sin(tt * 1.3) + .006 * Math.sin(tt * 3.1);
  const bounce = fly ? 0 : 1.4 * Math.max(0, Math.sin(tt * 2.6));
  const frame = cirTR(CIR_I, x, y, 0, facing * s, s);
  const swayed = fly ? cirPivot(frame, 0, -240, sway) : cirTR(frame, 0, 0, sway);
  const root = cirTR(cirTR(swayed, 0, 0, 0, CIR_BODY, CIR_BODY), 0, -lift - bounce);
  const breath = 1.1 * Math.sin(tt * TAU / 2.6);
  const lean = (ps.lean || 0) + (fly ? .02 * Math.sin(tt * 2.2 + 1) : 0);
  const ugL = cirTR(cirPivot(CIR_I, 0, CIR_WAIST, lean), 0, -breath), ug = cirMul(root, ugL);
  // 头（头部件按 CIR_HEADK 放大：头大、身子小）
  const neck = [0, CIR_NECK + (ps.sink || 0)];
  const hr = (ps.hr || 0) + (md.chin || 0) + (md.htilt || 0) + tilt + .022 * Math.sin(tt * 1.1 + 1) + (fly ? -.04 : 0);
  const head = cirTR(ug, neck[0], neck[1], hr, CIR_HEADK, CIR_HEADK);
  const turn = clamp(md.turn !== undefined ? md.turn : ps.turn || 0, -1, 1);
  const look = clamp(o.look !== undefined ? o.look : (md.look !== undefined ? md.look : ps.look || 0), -1, 1);
  const lookY = md.lookY !== undefined ? md.lookY : ps.lookY || 0;
  // 画的环境：投影随 s 略放大，边线约 1.7px（同帕秋莉）
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1.7 / (s * dev), pat };
  const it = (p, m, col, edge) => ({ p, m, col, edge });
  const paint = (items, sh, gr, al) => cirPaint(c, items, sh, env, gr, al);
  const G = CIR_G;

  // ---- 1 翅膀（在最后面）：半透明冰纸 + 一道霜白的棱 ----
  const [wOpen, wFlap, wDroop] = ps.wings || [0, 0, 0], wings = [], facets = [];
  const flap = wFlap ? Math.sin(tt * 13) : 0;
  for (const sd of [-1, 1]) {
    const base = cirTR(ug, sd * 6, -188, 0, sd, 1);
    CIR_WINGS.forEach(([a0], k) => {
      const a = a0 * (1 + .35 * wOpen) + wDroop * (.5 + k * .15) - wFlap * .32 * flap * (1 - k * .2) + .035 * Math.sin(tt * 2.3 + k * 1.7 + sd);
      const m = cirTR(base, 0, 0, a, 1 + .1 * wOpen, 1 + .1 * wOpen);
      wings.push(it(G.wings[k].p, m, CIR_K.wing)); facets.push(it(G.wings[k].f, m, CIR_K.frost, false));
    });
  }
  paint(wings, CIR_SH.wing, false, .72);
  paint(facets, null, false, .8);

  // ---- 2 后发（跟头一起转） ----
  paint([it(G.backHair, head, CIR_K.hairBack)], CIR_SH.big);

  // ---- 3 腿、衬裙、裙子、上身 ----
  if (fly) {
    const legs = [];
    for (const sd of [-1, 1]) { const m = cirTR(root, sd * 11, -62, -sd * .12 + .16 + .08 * Math.sin(tt * 2.2 + sd), 1, sd > 0 ? .8 : .92);
      legs.push(it(G.flyLeg, m, CIR_K.leg), it(G.flySock, m, CIR_K.sock, false), it(G.flyShoe, m, CIR_K.shoe)); }
    paint(legs, CIR_SH.mid);
  } else {
    paint([it(G.legL, root, CIR_K.leg), it(G.legR, root, CIR_K.leg), it(G.sockL, root, CIR_K.sock, false), it(G.sockR, root, CIR_K.sock, false)], CIR_SH.tiny);
    paint([it(G.shoeL, root, CIR_K.shoe), it(G.shoeR, root, CIR_K.shoe)], CIR_SH.mid);
  }
  // 裙子跟上身的转动走一半，裙摆在飞的时候往后飘一点
  const skirtM = cirPivot(root, 0, CIR_WAIST, lean * .5 + (fly ? -.06 : 0));
  paint([it(G.petti, skirtM, CIR_K.shirt)], CIR_SH.mid);
  paint([it(G.skirt, skirtM, CIR_K.dress)], CIR_SH.big);
  paint(G.pleats.map(p => it(p, skirtM, CIR_K.pleat, false)), null, false);
  paint([it(G.neck, ug, CIR_K.skin, false), it(G.shirt, ug, CIR_K.shirt)], CIR_SH.mid);
  paint([it(G.bodice, ug, CIR_K.dress)], CIR_SH.mid);
  paint([it(G.collarL, ug, CIR_K.collar), it(G.collarR, ug, CIR_K.collar)], CIR_SH.tiny);
  paint([it(G.ribbon, cirTR(ug, 0, -205, 0, .95, .95), CIR_K.ribbon)], CIR_SH.tiny, false);

  // ---- 手臂骨架 ----
  const shrug = ps.shrug || 0, arm = (sd, spec) => {
    const [a, b, hand, late, ku = 1, kf = 1] = spec;
    const u = cirTR(ug, sd * CIR_SHOULDER[0], CIR_SHOULDER[1] - shrug, -a), l = cirTR(u, 0, CIR_UP * ku, -b), hm = cirTR(l, 0, CIR_FORE * kf, 0, sd, 1);
    return { u, uD: cirTR(u, 0, 0, 0, 1, ku), lD: cirTR(l, 0, 0, 0, 1, kf), hm, hand, late, tip: cirApply(hm, G.handTip[hand]) };
  };
  const AB = arm(-1, ps.back), AF = arm(1, ps.front);
  const drawArms = arms => { if (!arms.length) return;
    // 上臂在泡泡袖下面；前臂和手压在袖子外面（think 这种折回来的手臂才不会被袖子吃掉）
    paint(arms.map(A => it(G.armU, A.uD, CIR_K.skin)), CIR_SH.mid);
    paint(arms.map(A => it(G.puff, A.u, CIR_K.shirt)), CIR_SH.mid);
    paint(arms.map(A => it(G.cuff, A.u, CIR_K.trim)), null, false);
    paint([...arms.map(A => it(G.fore, A.lD, CIR_K.skin)), ...arms.map(A => it(G.hand[A.hand], A.hm, CIR_K.skin))], CIR_SH.mid); };
  drawArms([AB, AF].filter(A => !A.late));

  // ---- 4 脸、五官 ----
  const faceItems = [it(G.face, head, CIR_K.skin)];
  if (md.puff) faceItems.push(...G.cheekPuff.map(p => it(p, head, CIR_K.skin)));
  paint(faceItems, CIR_SH.mid);
  const fHead = ps.nod ? cirTR(head, 0, ps.nod * 5.5) : head;
  cirFace(c, fHead, md, { turn, look, lookY, blink, mouth, tt }, paint, it);

  // ---- 5 前发：鬓发、刘海、发缝、眉毛 ----
  const lockM = sd => cirPivot(head, sd * 56, -120, -hr * .5 + .025 * Math.sin(tt * 1.6 + sd));
  const bangM = cirTR(head, turn * 4, 0);
  paint([it(G.lockL, lockM(-1), CIR_K.hair), it(G.lockR, lockM(1), CIR_K.hair), it(G.bangs, bangM, CIR_K.hair)], CIR_SH.mid);
  paint(G.bangLines.map(p => it(p, bangM, CIR_K.hairLine, false)), null, false);
  cirBrows(md, turn, ps.nod ? cirTR(head, 0, ps.nod * 3) : head, paint, it);

  // ---- 6 蝴蝶结：结压在头顶的头发上，两翼往两边张开、下缘搭在头顶上；耳朵随动作轻颤（slump 耷拉） ----
  const droop = ps.droop || 0;
  const bowM = cirTR(head, -turn * 4, CIR_BOWY, .03 * Math.sin(tt * 1.9), CIR_BOWS, CIR_BOWS);
  const earA = sd => sd * (.1 + .03 * Math.sin(tt * 2.4 + sd) + droop * .2 + (fly ? .05 * flap : 0));
  const bowRM = cirTR(bowM, 0, 0, earA(1)), bowLM = cirTR(bowM, 0, 0, earA(-1));
  paint([it(G.bowBackL, bowLM, CIR_K.bowFold), it(G.bowBackR, bowRM, CIR_K.bowFold)], CIR_SH.big);
  paint([it(G.bowL, bowLM, CIR_K.bow), it(G.bowR, bowRM, CIR_K.bow)], CIR_SH.mid);
  for (const [lp, bp, m] of [[G.lightL, G.bowL, bowLM], [G.lightR, G.bowR, bowRM]]) {
    c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(bp); c.fillStyle = CIR_K.bowLight; c.fill(lp); c.restore(); }
  paint([...G.creases.map((p, i) => it(p, (i % 2) ? bowLM : bowRM, CIR_K.bowCrease, false)),
    it(G.pocketL, bowLM, CIR_K.bowFold, false), it(G.pocketR, bowRM, CIR_K.bowFold, false)], null, false);
  paint([it(G.bowKnot, bowM, CIR_K.bowKnot)], CIR_SH.tiny);
  paint([it(G.knotFold, bowM, CIR_K.bowCrease, false)], null, false);

  // ---- 7 举起的手臂（压在头发外面） ----
  drawArms([AB, AF].filter(A => A.late));

  // ---- 8 表情道具 ----
  if (md.q) { const qm = cirTR(head, 98, -128 + 3 * Math.sin(tt * 3), .18 + .12 * Math.sin(tt * 2.2) - hr, 1.25, 1.25);
    paint([it(G.qHook, qm, CIR_K.q), it(G.qDot, qm, CIR_K.q)], CIR_SH.mid, false); }

  // ---- 返回锚点 ----
  const hands = [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]);
  const mid = [(AB.tip[0] + AF.tip[0]) / 2, (AB.tip[1] + AF.tip[1]) / 2];
  const hold = ps.hold ? [mid[0], mid[1] - ps.hold * s * CIR_BODY] : mid;
  return { head: cirApply(head, [0, -70]), hands, tip: AF.tip, hold };
}

// 五官（第三版，照 pchFace 的拆层）：眼白 → 虹膜 → 虹膜下半的亮色 → 瞳孔 → 虹膜上沿的阴影 → 一大一小两个高光，后五层都裁在眼白里；
// 最后压一条粗上眼线（外眼角一撇）。琪露诺的眼睛默认睁圆（不压眼睑）。腮红是一团粉加三道斜线。cry 的 > < 和闭眼弧线另画。
function cirFace(c, head, md, f, paint, it) {
  const { turn, look, lookY, blink, mouth, tt } = f, low = [], top = [], eyes = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .28 : 1, ex = sd * 28 * (sd * turn > 0 ? 1 - Math.abs(turn) * .15 : 1) + turn * 12, ey = -54;
    // 腮红 + 三道斜线
    const bs = md.blush, bx = ex + sd * 14 + turn, by = -30 + (bs > 1.4 ? 1 : 0);
    low.push(it(cirMemo(['b', sd, cirQ(bx, 4), bs, cirQ(far)].join('|'), () => cirCut(ellPts(bx, by, 10 * bs * far, 5 * Math.sqrt(bs), 16), 80 + sd, 4, .3)), head, CIR_K.blush, false));
    for (let k = -1; k <= 1; k++) { const hx = bx + k * 4.2 * far, hy = by - .5; low.push(it(cirSmooth([[hx + 1.4, hy - 2.6], [hx + 2.3, hy - 2.2], [hx - 1.4, hy + 2.6], [hx - 2.3, hy + 2.2]]), head, mix(CIR_K.blush, P.ink, .25), false)); }
    const es = (md.es || 1) * (md.brow && md.brow[2] ? 1 + sd * .08 : 1), rx = 13 * far * es, ry = 16 * es;
    if (md.eye === 'squeeze') {
      // > <：一道折成尖角的纸条，尖朝鼻梁
      top.push(it(cirMemo(['sq', sd, cirQ(ex, 4), cirQ(far)].join('|'), () => cirCut([[8, -6.5], [-7, 0], [8, 6.5], [8, 3.6], [-2.8, 0], [8, -3.6]].map(([px, py]) => [ex + sd * px * 1.6 * far, ey + 2 + py * 1.6]), 90 + sd, 3, .15, false)), head, CIR_K.lash, false));
      continue;
    }
    const lidFrac = md.eye === 'up' ? 1 : clamp(lerp(md.lid || 0, 1, blink), 0, 1);
    if (lidFrac > .9) {
      // 闭眼：弧形纸条（笑：∩；眨眼：∪）
      const up = md.eye === 'up', arc = up ? -4.4 : 3.4, base = up ? ey + 2 : ey + ry * .55, pts = [], back = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10 * 2 - 1, xx = ex + u * (rx + 2), yy = base + arc * (1 - u * u) + sd * u; pts.push([xx, yy - 1.9]); back.unshift([xx, yy + 1.9 - Math.abs(u) * .9]); }
      top.push(it(cirCut([...pts, ...back], 92 + sd, 3, .2, false), head, CIR_K.lash, false));
      continue;
    }
    const ex2 = ex + look * 3.4 * far, topY = ey - ry;
    const lidY = xx => topY + lidFrac * 2 * ry + (md.lt || 0) * (xx - ex) * sd;
    const lowY = md.lower ? ey + ry - md.lower : Infinity;
    const white = ellPts(ex, ey, rx, ry, 24).map(([xx, yy]) => [xx, clamp(yy, lidY(xx), lowY)]);
    const ir = md.iris || 1, iy = ey + 1.5 + lookY, irx = rx * .8 * ir, iry = ry * .86 * ir, lidC = lidY(ex2);
    eyes.push({ white, layers: [
      [ellPts(ex2, iy, irx, iry, 20), CIR_K.eye],
      [ellPts(ex2, iy + iry * .42, irx * .74, iry * .44, 16), CIR_K.irisLt],
      [ellPts(ex2, iy - 1, irx * .42, iry * .46, 14), CIR_K.pupil],
      [ellPts(ex2, Math.max(lidC, iy - iry) - 1, irx * 1.05, iry * .5, 18), CIR_K.irisShade, ellPts(ex2, iy, irx, iry, 20)],
      [ellPts(ex2 - irx * .36, iy - iry * .36, 3.9 * es, 4.6 * es, 12), CIR_K.white],
      [ellPts(ex2 + irx * .34, iy + iry * .4, 1.9, 1.9, 8), CIR_K.white],
    ] });
    // 粗上眼线：沿眼睑走，外眼角挑一撇（睁圆时顺着眼眶上沿拱起来）
    const xi = ex - sd * (rx + .5), xo = ex + sd * (rx + 2.4), op = lidFrac < .05, ly0 = lidY(xi) + (op ? 5 : 0), ly1 = lidY(xo) + (op ? 5 : 0), lm = lerp(ly0, ly1, .5) - (op ? 4 : 0);
    top.push(it(cirCut([[xi, ly0 - 1.5], [lerp(xi, xo, .5), lm - 4.2], [xo, ly1 - 4.4], [xo + sd * 4, ly1 - 7.5], [xo + sd * 1.8, ly1 + .8], [lerp(xi, xo, .5), lm + .4], [xi, ly0 + 1.2]], 88 + sd, 3, .2, false), head, CIR_K.lash, false));
  }
  // 嘴
  const mo = cirQ(mouth), [mp, mc, tongue] = cirMemo(['m', md.mouth, mo].join('|'), () => { const [pts, col, tg] = cirMouthPts(md.mouth, mo); return [cirCut(pts, 95, 2.4, .15, false), col, tg ? cirCut(tg, 96, 2, .1) : null]; });
  const mm = cirTR(head, turn * 13 + (md.puff ? -2 : 0), -25, 0, 1.15, 1.15);
  low.push(it(mp, mm, mc, false));
  paint(low, CIR_SH.tiny, false);
  if (tongue) paint([it(tongue, mm, CIR_K.tongue, false)], null, false);
  // 眼睛：眼白一片，里面的层裁在眼白里
  for (const e of eyes) {
    const wp = cirSmooth(e.white);
    paint([it(wp, head, CIR_K.sclera, false)], CIR_SH.tiny, false);
    c.save(); c.transform(head[0], head[1], head[2], head[3], head[4], head[5]); c.clip(wp);
    for (const [pts, col, inside] of e.layers) { c.fillStyle = col; if (inside) { c.save(); c.clip(cirSmooth(inside)); c.fill(cirSmooth(pts)); c.restore(); } else c.fill(cirSmooth(pts)); }
    c.restore();
  }
  paint(top, CIR_SH.tiny, false);
  // 眼泪：眼下两道半透明的冰纸条 + 往外落的小冰晶
  if (md.tears) {
    const items = [], drops = [];
    for (const sd of [-1, 1]) {
      const ex = sd * 28 + turn * 12;
      items.push(it(cirMemo(['t', sd, cirQ(turn)].join('|'), () => cirCut(cirStroke([[ex + sd * 3, -44], [ex + sd * 6, -26], [ex + sd * 8, -8]], u => 4 + 3.5 * u), 97 + sd, 3, .2, false)), head, CIR_K.tear, false));
      for (let k = 0; k < 2; k++) { const u = (tt * 1.4 + k * .5 + (sd > 0 ? .23 : 0)) % 1;
        drops.push(it(CIR_G.drop, cirTR(head, ex + sd * (12 + u * 36), -14 + u * 30 + u * u * 50, u * 2 * sd, 1.4 - u * .6, 1.4 - u * .6), CIR_K.tear)); }
    }
    paint(items, CIR_SH.tiny, false, .85);
    paint(drops, CIR_SH.tiny, false, .9);
  }
}
// 眉毛：两小片细纸（压在刘海上）
function cirBrows(md, turn, head, paint, it) {
  const [dy, ang, asym] = md.brow || [0, 0], items = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * 28 * far + turn * 12, cy = -88 - dy - (asym ? sd * 4.5 : 0), len = 9 * far;
    const a = asym ? (sd > 0 ? -.3 : .25) : -sd * ang;
    const p = cirMemo(['r', sd, cirQ(len, 10)].join('|'), () => cirCut([[-sd * len, -1.6], [sd * len * .4, -1.4], [sd * len, -.2], [sd * len * .4, 1.1], [-sd * len, 1.6]], 98 + sd, 3, .15, false));
    items.push(it(p, cirTR(head, cx, cy, a), CIR_K.brow, false));
  }
  paint(items, CIR_SH.tiny, false);
}
