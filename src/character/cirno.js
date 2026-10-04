'use strict';
// 琪露诺 —— 剪纸人偶（和 src/character/patchouli.js 同一套接口、同一种剪纸画法）。纯 Canvas 代码绘制，不加载任何图片。
//
// drawCirno(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], hold:[x,y] }
//   x, y     脚底中心（fly：悬空时脚尖下方那一点，也就是她影子落的地方）
//   h        全身高（头顶蝴蝶结顶到脚底），默认 460（比帕秋莉的 520 矮一点）。所有姿势共用这个比例
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手叉腰 | proud 一手叉腰、一手握拳举高（「我是最强的」，gesture 举多高）
//            point 一手叉腰、一手伸向前方（gesture 伸多远）| hold 双手把一张纸举过头顶（hold 是纸的中心）
//            think 手指点下巴、头歪、眼睛往上看 | slump 垂头垮肩、手垂下、翅膀耷拉
//            fly 悬空、两臂张开、翅膀扇动、两腿后收 | throw 双手向前泼（拿水桶用：hands 是桶沿两侧，hold 是桶口中心；gesture 0 拉回 → 1 泼出）
//            旧名兼容：lecture→point、cross/cheer→proud、tired→slump、lift→hold、sit/lie/peek→stand
//   mood     normal 圆眼睛+自信的笑（默认）| proud 闭眼弧线+大张嘴笑、下巴抬 | happy 眯眼笑 | surprised 眼睛更圆、嘴 o
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
// 设计坐标：脚底 (0,0)，y 向下，蝴蝶结顶在 y≈-CIR_TOP；头部件用「头坐标」（原点在脖子关节，下巴尖约 (0,-3)）。
// 本文件顶层名字都带 cir 前缀。

// ===================== 颜色（和 P 里帕秋莉那组同样压暗、低饱和） =====================
// 冰色和 props.js 的 EP2_ICE / EP2_ICE_DEEP / EP2_FROST 相同（本文件先于 props.js 载入，所以抄值）
const CIR_K = (() => {
  const hair = '#9db7cb', hairBack = '#7c9ab4', dress = '#5b7ca2', bow = '#44628c', eye = '#3d6390';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    dress, pleat: mix(dress, P.ink, .2), trim: mix(dress, P.cap, .35),
    bow, bowFold: mix(bow, P.ink, .32), bowKnot: mix(bow, P.ink, .15),
    shirt: P.cap, collar: mix(P.cap, '#b9c9d6', .25), ribbon: P.ribbonRed,
    skin: P.skin, blush: P.blush, leg: mix(P.skin, P.cap, .15), sock: '#f3efe8', shoe: mix(dress, P.ink, .5),
    eye, iris: mix(eye, '#a9cbe0', .45), lash: mix(eye, P.ink, .7), brow: mix(hairBack, P.ink, .4),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    wing: '#cfe2ee', wingDeep: '#9fc3da', frost: '#f4fafd', tear: '#bcd9ea', q: mix(bow, P.ink, .2), white: '#f7f3ee',
  };
})();
const CIR_EDGE = {};
const cirEdge = col => CIR_EDGE[col] || (CIR_EDGE[col] = alpha(mix(col, '#ffffff', .5), .6));

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
// 翅膀：每边三片 [基础角（0 = 水平向外，- 向上）, 长, 宽]
const CIR_WINGS = [[-.78, 76, 17], [-.24, 88, 19], [.32, 68, 15]];
const CIR_NECK = -262, CIR_SHOULDER = [23, -250], CIR_UP = 38, CIR_FORE = 34, CIR_WAIST = -206;
const CIR_G = (() => {
  const g = {};
  // ---- 腿（站姿，脚底为原点）：细腿、白短袜、深色圆头鞋 ----
  const legR = [[6, -104], [16, -104], [15.6, -64], [14.2, -34], [13.4, -14], [7.8, -14], [7.2, -34], [6.4, -64]];
  g.legR = cirCut(legR, 1, 8, .3); g.legL = cirCut(cirMirror(legR), 2, 8, .3);
  const sockR = [[7.1, -32], [14.3, -32], [13.9, -11], [7.4, -11]];
  g.sockR = cirCut(sockR, 3, 6, .25, false); g.sockL = cirCut(cirMirror(sockR), 4, 6, .25, false);
  g.shoeR = cirCut(ellPts(12, -6.5, 9.5, 6.5, 14), 5, 5, .35); g.shoeL = cirCut(ellPts(-12, -6.5, 9.5, 6.5, 14), 6, 5, .35);
  // 衬裙：裙摆下露出的一圈白色荷叶边
  g.petti = cirCut([...cirOpen([[-72, -104], [0, -100], [72, -104]], 6), ...cirScallop(u => [lerp(76, -76, u), -91 + 3 * (1 - (2 * u - 1) ** 2)], 12, 4.5)], 7, 4, .45, false);
  // 背心裙：腰细，裙摆张开（下缘中间略低，像从略高处看圆裙）
  g.skirt = cirCut([[-17, -210], [0, -211], [17, -210], [21, -200], [29, -176], [42, -146], [57, -118], [70, -102], [74, -97], [38, -94], [0, -92], [-38, -94], [-74, -97], [-70, -102], [-57, -118], [-42, -146], [-29, -176], [-21, -200]], 8, 11, .8);
  // 褶：贴在裙子上的深色细纸条，按裙形散开
  g.pleats = [-.7, -.35, 0, .35, .7].map((u, i) => { const xt = u * 18, xb = u * 70;
    return cirCut([[xt - .8, -198], [xt + .8, -198], [xb + 1.8, -96], [xb - 1.8, -96]], 10 + i, 12, .4, false); });
  // 衬衫上身 + 背心裙胸片（U 形领口露出衬衫）
  g.shirt = cirCut([[-13, -268], [13, -268], [22, -261], [25, -248], [22, -228], [-22, -228], [-25, -248], [-22, -261]], 16, 8, .5);
  g.bodice = cirCut([[-21, -252], [-12, -252], [-9, -243], [0, -239], [9, -243], [12, -252], [21, -252], [22, -232], [20, -206], [-20, -206], [-22, -232]], 17, 8, .5, false);
  g.neck = cirCut([[-5, -280], [5, -280], [5.5, -262], [-5.5, -262]], 18, 8, .3, false);
  const collarR = [[1, -267], [11, -269], [17, -260], [11, -253], [5, -256], [2, -261]];
  g.collarR = cirCut(collarR, 19, 4, .3, false); g.collarL = cirCut(cirMirror(collarR), 20, 4, .3, false);
  // 小红领结（中心为原点，宽约 20）
  g.ribbon = cirCut([[0, -2.2], [-5, -5.5], [-9.5, -6], [-10.5, -.5], [-8.5, 4.5], [-3, 2.2], [-5, 9.5], [-2, 10], [0, 3.5], [2, 10], [5, 9.5], [3, 2.2], [8.5, 4.5], [10.5, -.5], [9.5, -6], [5, -5.5]], 21, 3, .25, false);
  // 飞行时的腿（胯为原点，脚尖朝下，短一点）
  g.flyLeg = cirCut([[-4.8, 0], [4.8, 0], [4.4, 34], [3.6, 58], [-3.6, 58], [-4.4, 34]], 22, 8, .3);
  g.flySock = cirCut([[-3.8, 40], [3.8, 40], [3.5, 60], [-3.5, 60]], 23, 6, .2, false);
  g.flyShoe = cirCut(ellPts(0, 63, 5.8, 8.5, 14), 24, 4, .3);
  // ---- 手臂：上臂（肩为原点，向下 +y，长 CIR_UP）、泡泡袖、前臂（肘为原点，长 CIR_FORE）、手（腕为原点） ----
  g.armU = cirCut([[-4.6, 8], [4.6, 8], [4.8, 24], [4.4, CIR_UP + 2], [0, CIR_UP + 4], [-4.4, CIR_UP + 2], [-4.8, 24]], 30, 8, .3);
  g.fore = cirCut([[-4.4, -3], [0, -4.5], [4.4, -3], [4.2, 16], [3.7, CIR_FORE + 1], [-3.7, CIR_FORE + 1], [-4.2, 16]], 31, 8, .3);
  g.puff = cirCut([[-11, -5], [-4, -10], [5, -10], [11, -5], [13.5, 6], [11.5, 16], [0, 19], [-11.5, 16], [-13.5, 6]], 32, 7, .5);
  g.cuff = cirCut([[-11.8, 14.5], [0, 17.5], [11.8, 14.5], [11.2, 19], [0, 22], [-11.2, 19]], 33, 5, .3, false);
  g.hand = {
    open: cirCut([[-4.2, -1], [4.2, -1], [5.6, 5], [5.2, 10.5], [2.8, 13.6], [-.6, 14], [-3.4, 12.6], [-4.8, 8.5], [-7.6, 6], [-7.8, 3.4], [-4.8, 2.4]], 34, 3, .2, false),
    fist: cirCut(ellPts(0, 5.6, 6, 6.8, 14), 35, 3, .25),
    point: cirCut([[-4.2, -1], [4.2, -1], [5.2, 5], [4, 8.8], [2.2, 10], [2.1, 20], [0, 22.6], [-2, 20], [-2.2, 10], [-5, 8], [-5.4, 3]], 36, 3, .2, false),
    grip: cirCut([[-4.2, -1], [4.2, -1], [6.2, 4], [6.4, 9], [3, 12], [-1, 11.4], [-3, 8.5], [-6.4, 7.4], [-6.2, 2.4]], 37, 3, .2, false),
  };
  g.handTip = { open: [0, 13], fist: [0, 6.5], point: [0, 22], grip: [0, 7] };
  // ---- 翅膀：细长冰晶（根为原点，指向 +x），每片按自己的长宽剪；中间一道霜白的棱 ----
  g.wings = CIR_WINGS.map(([, L, w], k) => ({
    p: cirCut([[0, -w * .34], [L * .62, -w * .5], [L * .9, -w * .3], [L, 0], [L * .9, w * .3], [L * .62, w * .5], [0, w * .34]], 40 + k, 9, .5, false),
    f: cirCut([[4, -w * .06], [L * .84, -w * .05], [L * .93, 0], [L * .84, w * .05], [4, w * .06]], 44 + k, 9, .2, false) }));
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = cirCut([[0, -3], [12, -6], [23, -13], [32, -25], [37, -42], [39, -62], [38, -82], [33, -98], [0, -108], [-33, -98], [-38, -82], [-39, -62], [-37, -42], [-32, -25], [-23, -13], [-12, -6]], 50, 7, .5);
  g.cheekPuff = [1, -1].map((sd, i) => cirCut(ellPts(sd * 30, -21, 9, 8, 16), 51 + i, 5, .3));
  // 后发：到下巴的波波头，两侧发梢略往外翘（剪成几道尖）
  const bSide = cirOpen([[0, -134], [30, -130], [49, -117], [59, -96], [62, -70], [59, -46], [56, -28], [59, -12]], 5);
  const bTips = [[68, 0], [56, -4], [53, 6], [45, -6], [38, 2], [30, -12], [0, -16]];
  g.backHair = cirCut([...bSide, ...bTips, ...cirMirror([...bSide, ...bTips.slice(0, -1)])], 52, 9, .8, false);
  // 鬓发：从太阳穴垂到下巴两侧，压在脸边上
  const lockR = [...cirOpen([[29, -102], [44, -98], [51, -78], [50, -50], [48, -26]], 4), [51, -10], [55, 4], [46, -4], [43, 6], [39, -8], ...cirOpen([[38, -14], [37, -40], [35, -66], [30, -90]], 4)];
  g.lockR = cirCut(lockR, 53, 6, .5, false); g.lockL = cirCut(cirMirror(lockR), 54, 6, .5, false);
  // 刘海：碎一点、长短不齐，中间分开一点
  g.bangs = cirCut([[-47, -116], [-33, -129], [-14, -136], [0, -137], [14, -136], [33, -129], [47, -116], [54, -98], [48, -78], [43, -88], [39, -68], [32, -86], [25, -64], [18, -84], [10, -68], [5, -86], [1, -74], [-4, -88], [-9, -64], [-16, -84], [-23, -67], [-30, -86], [-36, -70], [-41, -88], [-46, -76], [-50, -92], [-54, -100]], 55, 6, .5, false);
  g.bangLines = [[25, -64, 22, -112], [-9, -64, -6, -116], [39, -68, 38, -104], [-36, -70, -35, -108]].map(([x0, y0, x1, y1], i) => cirCut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 56 + i, 8, .2, false));
  // 头顶的大蝴蝶结（结为原点）：两只宽耳朵斜向上张开 + 里面一道折痕 + 中间的结
  const loopR = [[3, -3], [14, -14], [30, -28], [48, -38], [60, -36], [65, -22], [60, -6], [48, 4], [30, 6], [14, 5], [4, 3]];
  g.bowR = cirCut(loopR, 60, 7, .6); g.bowL = cirCut(cirMirror(loopR), 61, 7, .6);
  const foldR = [[8, -1], [30, -16], [52, -26], [54, -21], [32, -10], [9, 2]];
  g.foldR = cirCut(foldR, 62, 6, .3, false); g.foldL = cirCut(cirMirror(foldR), 63, 6, .3, false);
  g.bowKnot = cirCut(ellPts(0, 0, 8.5, 10.5, 14), 64, 4, .3);
  // ---- 表情道具 ----
  // 问号：一段粗弧 + 一个点（中心约在原点，高约 34）
  const hook = []; for (let k = 0; k <= 14; k++) { const a = Math.PI * 1.08 + k / 14 * Math.PI * 1.42; hook.push([8.5 * Math.cos(a), -9 + 8.5 * Math.sin(a)]); }
  hook.push([0, 2], [0, 6]);
  g.qHook = cirCut(cirStroke(hook, 5.2), 70, 3, .25, false); g.qDot = cirCut(circPts(0, 13, 3.2, 10), 71, 3, .2);
  // 冰晶眼泪（小菱形）
  g.drop = cirCut([[0, -4.5], [2.6, 0], [0, 4.5], [-2.6, 0]], 72, 2, .1, false);
  return g;
})();
// 蝴蝶结顶到脚底的设计高度（量出来的，用来把 h 换成缩放）
const CIR_HEAD = 1.08, CIR_BOW = .8, CIR_BOWY = -128;
const CIR_TOP = -(CIR_NECK + (CIR_BOWY - 38 * CIR_BOW) * CIR_HEAD);

// ===================== 表情 =====================
// eye: open | up（∩ 闭眼笑）| squeeze（> <）；es 眼睛大小；iris 瞳孔大小；lid 上眼睑盖住的比例；lower 下眼睑推上来（笑眼）
// brow [上移, 内端下压角, 是否一高一低]；mouth 嘴型；blush 腮红；chin 下巴抬(-)；turn 脸侧开；look / lookY 眼珠
const CIR_MOODS = {
  normal: { eye: 'open', es: 1, brow: [1, .18], mouth: 'grin', blush: 1 },
  proud: { eye: 'up', brow: [4, -.2], mouth: 'laugh', blush: 1.25, chin: -.16 },
  happy: { eye: 'open', es: 1.02, lower: 6.5, brow: [3, -.12], mouth: 'smile', blush: 1.3 },
  surprised: { eye: 'open', es: 1.2, iris: .62, brow: [8, -.12], mouth: 'o', blush: 1 },
  confused: { eye: 'open', es: .94, iris: .8, brow: [3, -.22, true], mouth: 'wave', blush: 1, q: true, tilt: .1, look: -.4, lookY: -2.5 },
  pout: { eye: 'open', es: .96, lid: .3, brow: [-2, .42], mouth: 'pout', blush: 1.45, puff: true, turn: -.45, look: 1 },
  cry: { eye: 'squeeze', brow: [3, -.42], mouth: 'wail', blush: 1.45, tears: true },
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
function cirPose(pose, g, tt) {
  const hipB = [-.62, 1.38, 'fist', false], hipF = [.62, -1.38, 'fist', false];
  switch (pose) {
    case 'proud': return { back: hipB, front: [lerp(1.8, 2.72, g), lerp(-.3, .25, g), 'fist', true, 1.35, 1.35], lean: -.035, turn: .1, look: .2, wings: [.4, 0, 0], shrug: 3 };
    case 'point': return { back: hipB, front: [lerp(1.2, 1.6, g), lerp(.3, 0, g), 'point', false, lerp(1, 1.18, g), lerp(1, 1.18, g)], lean: .045 * g, turn: .32, look: .8, wings: [.15, 0, 0] };
    case 'hold': return { back: [-2.66, -.42, 'grip', true, 1.62, 1.62], front: [2.66, .42, 'grip', true, 1.62, 1.62], shrug: 10, sink: 3, turn: 0, look: 0, lookY: -2.5, hr: 0, wings: [.25, 0, 0], hold: 36 };
    case 'think': return { back: [-.58, 1.34, 'fist', false], front: [.2, -2.93, 'point', true, 1, 1.12], hr: -.13, turn: .22, look: .5, lookY: -3, wings: [0, 0, .05] };
    case 'slump': return { back: [-.06, .05, 'open', false], front: [.06, -.05, 'open', false], lean: .02, hr: .2, nod: 1, sink: 9, shrug: -7, turn: .1, look: -.2, lookY: 2, wings: [-.2, 0, .55], droop: 1 };
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
  const { x = 0, y = 0, h = 460, facing = 1, tilt = 0, mouth = 0, blink = 0, t = 0 } = o;
  const pose = CIR_POSE_ALIAS[o.pose] || o.pose || 'stand', moodName = CIR_MOOD_ALIAS[o.mood] || o.mood || 'normal';
  const md = CIR_MOODS[moodName] || CIR_MOODS.normal, tt = twos(t + CLOCK0), s = h / CIR_TOP;   // CLOCK0：全片时钟（core.js），交接处待机动作连续
  const g = o.gesture == null ? .6 + .3 * Math.sin(tt * 1.4) : clamp(o.gesture, 0, 1);
  const ps = cirPose(pose, g, tt);
  // ---- 根：锚点 → 设计坐标。待机晃得比帕秋莉明显（身体绕脚底摆，外加一点上下蹦） ----
  const fly = !!ps.fly, lift = fly ? 58 + 7 * Math.sin(tt * 2.2) : 0;
  const sway = (fly ? .03 : .016) * Math.sin(tt * 1.3) + .006 * Math.sin(tt * 3.1);
  const bounce = fly ? 0 : 1.6 * Math.max(0, Math.sin(tt * 2.6));
  const frame = cirTR(CIR_I, x, y, 0, facing * s, s);
  const root = cirTR(fly ? cirPivot(frame, 0, -200 - lift, sway) : cirTR(frame, 0, 0, sway), 0, -lift - bounce);
  const breath = 1.3 * Math.sin(tt * TAU / 2.6);
  const lean = (ps.lean || 0) + (fly ? .02 * Math.sin(tt * 2.2 + 1) : 0);
  const ugL = cirTR(cirPivot(CIR_I, 0, CIR_WAIST, lean), 0, -breath), ug = cirMul(root, ugL);
  // 头
  const neck = [0, CIR_NECK + (ps.sink || 0)], neckL = cirApply(ugL, neck);
  const hr = (ps.hr || 0) + (md.chin || 0) + (md.tilt || 0) + tilt + .022 * Math.sin(tt * 1.1 + 1) + (fly ? -.04 : 0);
  const head = cirTR(ug, neck[0], neck[1], hr, CIR_HEAD, CIR_HEAD);
  const turn = clamp(md.turn !== undefined ? md.turn : ps.turn || 0, -1, 1);
  const look = clamp(o.look !== undefined ? o.look : (md.look !== undefined ? md.look : ps.look || 0), -1, 1);
  const lookY = md.lookY !== undefined ? md.lookY : ps.lookY || 0;
  // 画的环境
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1 / (s * dev), pat };
  const it = (p, m, col, edge) => ({ p, m, col, edge });
  const paint = (items, sh, gr, al) => cirPaint(c, items, sh, env, gr, al);
  const G = CIR_G;

  // ---- 1 翅膀（在最后面）：半透明冰纸 + 一道霜白的棱 ----
  const [wOpen, wFlap, wDroop] = ps.wings || [0, 0, 0], wings = [], facets = [];
  const flap = wFlap ? Math.sin(tt * 13) : 0;
  for (const sd of [-1, 1]) {
    const base = cirTR(ug, sd * 5, -226, 0, sd, 1);
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
    for (const sd of [-1, 1]) { const m = cirTR(root, sd * 10, -104, -sd * .12 + .14 + .08 * Math.sin(tt * 2.2 + sd), 1, sd > 0 ? .78 : .9);
      legs.push(it(G.flyLeg, m, CIR_K.leg), it(G.flySock, m, CIR_K.sock, false), it(G.flyShoe, m, CIR_K.shoe)); }
    paint(legs, CIR_SH.mid);
  } else {
    paint([it(G.legL, root, CIR_K.leg), it(G.legR, root, CIR_K.leg), it(G.sockL, root, CIR_K.sock, false), it(G.sockR, root, CIR_K.sock, false)], CIR_SH.mid);
    paint([it(G.shoeL, root, CIR_K.shoe), it(G.shoeR, root, CIR_K.shoe)], CIR_SH.tiny, false);
  }
  // 裙子跟上身的转动走一半，裙摆在飞的时候往后飘一点
  const skirtM = cirPivot(root, 0, CIR_WAIST, lean * .5 + (fly ? -.06 : 0));
  paint([it(G.petti, skirtM, CIR_K.shirt)], CIR_SH.mid);
  paint([it(G.skirt, skirtM, CIR_K.dress)], CIR_SH.big);
  paint(G.pleats.map(p => it(p, skirtM, CIR_K.pleat, false)), null, false);
  paint([it(G.neck, ug, CIR_K.skin, false), it(G.shirt, ug, CIR_K.shirt)], CIR_SH.mid);
  paint([it(G.bodice, ug, CIR_K.dress)], CIR_SH.mid);
  paint([it(G.collarL, ug, CIR_K.collar), it(G.collarR, ug, CIR_K.collar)], CIR_SH.tiny);
  paint([it(G.ribbon, cirTR(ug, 0, -257), CIR_K.ribbon)], CIR_SH.tiny, false);

  // ---- 手臂骨架 ----
  const shrug = ps.shrug || 0, arm = (sd, spec) => {
    const [a, b, hand, late, ku = 1, kf = 1] = spec;
    const u = cirTR(ug, sd * CIR_SHOULDER[0], CIR_SHOULDER[1] - shrug, -a), l = cirTR(u, 0, CIR_UP * ku, -b), hm = cirTR(l, 0, CIR_FORE * kf, 0, sd, 1);
    return { u, uD: cirTR(u, 0, 0, 0, 1, ku), lD: cirTR(l, 0, 0, 0, 1, kf), hm, hand, late, tip: cirApply(hm, G.handTip[hand]) };
  };
  const AB = arm(-1, ps.back), AF = arm(1, ps.front);
  const drawArms = arms => { if (!arms.length) return;
    paint([...arms.map(A => it(G.armU, A.uD, CIR_K.skin)), ...arms.map(A => it(G.fore, A.lD, CIR_K.skin)), ...arms.map(A => it(G.hand[A.hand], A.hm, CIR_K.skin))], CIR_SH.mid);
    paint(arms.map(A => it(G.puff, A.u, CIR_K.shirt)), CIR_SH.mid);
    paint(arms.map(A => it(G.cuff, A.u, CIR_K.trim)), null, false); };
  drawArms([AB, AF].filter(A => !A.late));

  // ---- 4 脸、五官 ----
  const faceItems = [it(G.face, head, CIR_K.skin)];
  if (md.puff) faceItems.push(...G.cheekPuff.map(p => it(p, head, CIR_K.skin)));
  paint(faceItems, CIR_SH.mid);
  const fHead = ps.nod ? cirTR(head, 0, ps.nod * 4) : head;
  cirFace(fHead, md, { turn, look, lookY, blink, mouth, tt }, paint, it);

  // ---- 5 前发：鬓发、刘海、发缝、眉毛 ----
  const lockM = sd => cirPivot(head, sd * 40, -98, -hr * .5 + .025 * Math.sin(tt * 1.6 + sd));
  const bangM = cirTR(head, turn * 2.5, 0);
  paint([it(G.lockL, lockM(-1), CIR_K.hair), it(G.lockR, lockM(1), CIR_K.hair), it(G.bangs, bangM, CIR_K.hair)], CIR_SH.mid);
  paint(G.bangLines.map(p => it(p, bangM, CIR_K.hairLine, false)), null, false);
  cirBrows(md, turn, ps.nod ? cirTR(head, 0, ps.nod * 3) : head, paint, it);

  // ---- 6 蝴蝶结：扎在头顶偏后，耳朵随动作轻颤（slump 耷拉） ----
  const droop = ps.droop || 0;
  const bowM = cirTR(head, -turn * 5, CIR_BOWY, .06 - hr * .25 + .03 * Math.sin(tt * 1.9), CIR_BOW, CIR_BOW);
  const earA = sd => sd * (.035 * Math.sin(tt * 2.4 + sd) + droop * .38 + (fly ? .05 * flap : 0));
  const bowRM = cirTR(bowM, 0, 0, earA(1)), bowLM = cirTR(bowM, 0, 0, earA(-1));
  paint([it(G.bowL, bowLM, CIR_K.bow), it(G.bowR, bowRM, CIR_K.bow)], CIR_SH.big);
  paint([it(G.foldL, bowLM, CIR_K.bowFold, false), it(G.foldR, bowRM, CIR_K.bowFold, false)], null, false);
  paint([it(G.bowKnot, bowM, CIR_K.bowKnot)], CIR_SH.tiny);

  // ---- 7 举起的手臂（压在头发外面） ----
  drawArms([AB, AF].filter(A => A.late));

  // ---- 8 表情道具 ----
  if (md.q) { const qm = cirTR(head, 74, -150 + 3 * Math.sin(tt * 3), .18 + .12 * Math.sin(tt * 2.2) - hr, 1.1, 1.1);
    paint([it(G.qHook, qm, CIR_K.q), it(G.qDot, qm, CIR_K.q)], CIR_SH.mid, false); }

  // ---- 返回锚点 ----
  const hands = [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]);
  const mid = [(AB.tip[0] + AF.tip[0]) / 2, (AB.tip[1] + AF.tip[1]) / 2];
  const hold = ps.hold ? [mid[0], mid[1] - ps.hold * s] : mid;
  return { head: cirApply(head, [0, -50]), hands, tip: AF.tip, hold };
}

// 五官：腮红、眼睛（深蓝纸片 + 浅蓝瞳孔 + 白点高光 + 上睫毛纸条）、嘴、眼泪
function cirFace(head, md, f, paint, it) {
  const { turn, look, lookY, blink, mouth, tt } = f, low = [], top = [];
  const lidBase = md.lid || 0, lidFrac = md.eye === 'open' ? clamp(lerp(lidBase, 1, blink), 0, 1) : 1;
  const qt = cirQ(turn), ql = cirQ(look), qy = cirQ(lookY, 2), qf = cirQ(lidFrac);
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .25 : 1, ex = sd * 17 * (sd * turn > 0 ? 1 - Math.abs(turn) * .15 : 1) + turn * 8, ey = -45;
    const es = (md.es || 1) * (md.brow && md.brow[2] ? 1 + sd * .08 : 1), rx = 8 * far * es, ry = 10.5 * es;
    // 腮红
    const bs = md.blush;
    low.push(it(cirMemo(['b', sd, qt, bs].join('|'), () => cirCut(ellPts(ex + sd * 8, -28, 6.5 * bs * far, 3.2 * Math.sqrt(bs), 14), 80 + sd, 4, .3)), head, CIR_K.blush, false));
    const key = ['e', md.eye, sd, qt, ql, qy, qf, es, md.iris || 1, md.lower || 0].join('|');
    if (md.eye === 'squeeze') {
      // > <：一道折成尖角的纸条，尖朝鼻梁
      top.push(it(cirMemo('sq|' + key, () => cirCut([[8, -6.5], [-7, 0], [8, 6.5], [8, 3.6], [-2.8, 0], [8, -3.6]].map(([px, py]) => [ex + sd * px * far, ey + 1 + py]), 90 + sd, 3, .15, false)), head, CIR_K.lash, false));
      continue;
    }
    if (md.eye === 'up' || lidFrac > .9) {
      // 闭眼：弧形纸条（笑：∩；眨眼：∪）
      top.push(it(cirMemo('cl|' + key, () => { const up = md.eye === 'up', arc = up ? -4 : 2.8, base = up ? ey + 2 : ey + ry * .5, pts = [], back = [];
        for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1, xx = ex + u * (rx + 1.5), yy = base + arc * (1 - u * u); pts.push([xx, yy - 1.5]); back.unshift([xx, yy + 1.5 - Math.abs(u) * .7]); }
        return cirCut([...pts, ...back], 92 + sd, 3, .2, false); }), head, CIR_K.lash, false));
      continue;
    }
    const ex2 = ex + look * 2.6 * far, ey2 = ey + lookY * .4, topY = ey - ry;
    const lidY = topY + lidFrac * 2 * ry, lowY = md.lower ? ey + ry - md.lower : Infinity;
    const [eyeP, irisP, hiP, hi2P, lashP] = cirMemo('op|' + key, () => {
      const cl = ([xx, yy]) => [xx, clamp(yy, lidY, lowY)];
      const eye = cirCut(ellPts(ex, ey, rx, ry, 20).map(cl), 84 + sd, 3.2, .25);
      const ir = (md.iris || 1), irisPts = ellPts(ex2, ey2 + ry * .18, rx * .66 * ir, ry * .62 * ir, 16).map(cl);
      const iris = cirCut(irisPts, 86 + sd, 3, .2);
      const hy = Math.max(ey2 - ry * .35, lidY + 2.6);
      const hi = cirCut(ellPts(ex2 - 2.6, hy, 2.6 * es, 2.9 * es, 10), 88 + sd, 2, .1);
      const hi2 = cirCut(ellPts(ex2 + 2.8, ey2 + ry * .4, 1.2, 1.2, 8), 89 + sd, 2, .05);
      // 上睫毛：睁圆时沿眼眶上缘的弧，外端一撇；有眼睑时是平的一条
      let lash;
      if (lidFrac > .02) { const xi = ex - sd * (rx + .5), xo = ex + sd * (rx + 2.4);
        lash = [[xi, lidY - 2.2], [xo, lidY - 2.8], [xo + sd * 2.8, lidY - 5.5], [xo + sd * 1.4, lidY + .8], [xi, lidY + 1.2]]; }
      else { const arc = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.08 + k / 10 * .84); arc.push([ex + Math.cos(a) * (rx + .8), ey + Math.sin(a) * (ry + .8)]); }
        if (sd < 0) arc.reverse();
        lash = cirStroke(arc, u => 1.4 + 2.2 * Math.sin(Math.PI * u) + (u > .8 ? 1.2 : 0));
        const e = arc[arc.length - 1]; lash.splice(arc.length, 0, [e[0] + sd * 3.2, e[1] - 3.4]); }
      return [eye, iris, hi, hi2, cirCut(lash, 90 + sd, 3, .15, false)];
    });
    low.push(it(eyeP, head, CIR_K.eye, false), it(irisP, head, CIR_K.iris, false));
    top.push(it(hiP, head, CIR_K.white, false), it(hi2P, head, CIR_K.white, false), it(lashP, head, CIR_K.lash, false));
  }
  // 嘴
  const mo = cirQ(mouth), [mp, mc, tongue] = cirMemo(['m', md.mouth, mo].join('|'), () => { const [pts, col, tg] = cirMouthPts(md.mouth, mo); return [cirCut(pts, 95, 2.4, .15, false), col, tg ? cirCut(tg, 96, 2, .1) : null]; });
  const mm = cirTR(head, turn * 9 + (md.puff ? -2 : 0), -21);
  low.push(it(mp, mm, mc, false));
  if (tongue) top.push(it(tongue, mm, CIR_K.tongue, false));
  paint(low, CIR_SH.tiny, false);
  paint(top, CIR_SH.tiny, false);
  // 眼泪：眼下两道半透明的冰纸条 + 往外落的小冰晶
  if (md.tears) {
    const items = [], drops = [];
    for (const sd of [-1, 1]) {
      const ex = sd * 17 + turn * 8;
      items.push(it(cirMemo(['t', sd, cirQ(turn)].join('|'), () => cirCut(cirStroke([[ex + sd * 2, -38], [ex + sd * 4, -24], [ex + sd * 5, -10]], u => 3 + 2.5 * u), 97 + sd, 3, .2, false)), head, CIR_K.tear, false));
      for (let k = 0; k < 2; k++) { const u = (tt * 1.4 + k * .5 + (sd > 0 ? .23 : 0)) % 1;
        drops.push(it(CIR_G.drop, cirTR(head, ex + sd * (8 + u * 26), -12 + u * 24 + u * u * 40, u * 2 * sd, 1 - u * .5, 1 - u * .5), CIR_K.tear)); }
    }
    paint(items, CIR_SH.tiny, false, .85);
    paint(drops, CIR_SH.tiny, false, .9);
  }
}
// 眉毛：两小片细纸（压在刘海上）
function cirBrows(md, turn, head, paint, it) {
  const [dy, ang, asym] = md.brow || [0, 0], items = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * 17 * far + turn * 8, cy = -64 - dy - (asym ? sd * 3.5 : 0), len = 7 * far;
    const a = asym ? (sd > 0 ? -.3 : .25) : -sd * ang;
    const p = cirMemo(['r', sd, cirQ(len, 10)].join('|'), () => cirCut([[-sd * len, -1.2], [sd * len * .4, -1.2], [sd * len, -.2], [sd * len * .4, 1], [-sd * len, 1.2]], 98 + sd, 3, .15, false));
    items.push(it(p, cirTR(head, cx, cy, a), CIR_K.brow, false));
  }
  paint(items, CIR_SH.tiny, false);
}
