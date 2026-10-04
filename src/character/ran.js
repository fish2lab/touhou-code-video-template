'use strict';
// 八云蓝 —— 剪纸人偶（做法同 src/character/patchouli.js：部件载入时用 scissor 剪好，每帧只做仿射变换，同层合并一条路径画一次投影）。
//
// drawRan(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], hold:[x,y] }
//   x, y     脚底中心
//   h        全身高（帽顶到脚底），默认 620（比帕秋莉 520 高一头半；6 头身）
//   facing   1 朝右 / -1 朝左（整张人偶镜像，投影方向不变）
//   pose     stand 双手拢袖 | read 双手把打印纸举到胸前看（hold 是纸的中心）| point 一手伸向前（gesture 伸多远）
//            present 一手把纸条递出去（hold 是纸条中心）| think 手指点下巴、尾巴垂 | bow 微微低头拱手
//   mood     normal 狐狸式眯眼微笑 | happy 眯成弧线 | surprised 眼圆、嘴 o | awkward 冷汗、眉斜、嘴抿成波浪 | proud 下巴抬、眼半闭
//   look / tilt / mouth 0..1 / blink 0..1 / t 秒（待机呼吸、尾巴轻晃，一拍两帧）/ gesture 0..1 / al 整体透明度
//   tails    0..1 九条尾巴翘起来的程度（念纸条时翘一下）
// 设计：道服（白底、藏青滚边、前襟八卦纹）、白帽（露两只金色狐耳）、金色短发、九条尾巴剪成一把扇形在身后、两只宽袖。
// 设计坐标：人偶高 620，脚底 (0,0)，y 向下；头部件用「头坐标」（原点在脖子关节 (0,-448)，下巴尖约 (0,-2)）。
// 本文件顶层名字都带 ran 前缀。

const RAN_H = 620, RAN_DH = 664, RAN_HS = 1.12, RAN_NECK = -448, RAN_SH = 40, RAN_SY = -428, RAN_L1 = 86;

// ===================== 颜色 =====================
const RAN_K = {
  hair: '#d9b765', hairBack: '#b6954d', hairLine: '#c4a257', robe: '#f3efe7', navy: mix(P.ribbonBlue, P.ink, .5), navy2: mix(P.ribbonBlue, P.ink, .32),
  cap: '#f4f0e8', capBand: mix(P.ribbonBlue, P.ink, .5), tail: '#dcbc72', tailAlt: '#cfac60', tailTip: '#f6f0e2', earIn: '#eccaa6',
  skin: P.skin, blush: P.blush, eye: '#46362d', iris: '#c68d3a', lid: '#2e2430', brow: '#a08546', mouth: '#7a4c4a', mouthIn: '#8d4a4c',
  gold: P.moon, white: '#f7f3ee', sweat: mix(P.ribbonBlue, P.cap, .62), shoe: mix(P.ribbonBlue, P.ink, .6),
  paper: '#f2ecda', paperEdge: '#d7c9a8', hole: '#b9ab90',
};
const RAN_EDGE = {};
const ranEdge = col => RAN_EDGE[col] || (RAN_EDGE[col] = alpha(mix(col, '#ffffff', .5), .6));

// ===================== 矩阵 =====================
const ranMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const ranApply = (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]];
function ranTR(m, x = 0, y = 0, a = 0, sx = 1, sy = 1) { const co = Math.cos(a), si = Math.sin(a); return ranMul(m, [co * sx, si * sx, -si * sy, co * sy, x, y]); }
const ranPivot = (m, px, py, a) => ranTR(ranTR(m, px, py, a), -px, -py);
const RAN_I = [1, 0, 0, 1, 0, 0];

// ===================== 剪纸轮廓 =====================
function ranCut(pts, seed, step = 8, amp = .7, smooth = true) { return polyPath(scissor(smooth ? spline(pts, 3, true) : pts, seed, step, amp), true); }
const ranMirror = pts => pts.map(([x, y]) => [-x, y]).reverse();

// 尾巴：中线按 bend 弯曲，宽度前粗后收，尖端圆；返回 [身, 白尖]。局部坐标：根在原点，向 -y 伸出
function ranTailPts(L, wmax, bend) {
  const N = 40, mid = [], hw0 = u => wmax * (.2 * (1 - u) + .86 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(u, 1), 1.45)), .8)), U0 = .88, hw = u => u < U0 ? hw0(u) : hw0(U0) * Math.sqrt(Math.max(0, 1 - Math.pow((u - U0) / (1 - U0), 2)));
  let x = 0, y = 0, a = 0;
  for (let k = 0; k <= N; k++) { const u = k / N; mid.push([x, y, a, u]); a = bend * u; x += Math.sin(a) * L / N; y -= Math.cos(a) * L / N; }
  const left = [], right = [];
  for (const [mx, my, ma, u] of mid) { const w = hw(u) * (1 + .02 * Math.sin(u * 22)), nx = Math.cos(ma), ny = Math.sin(ma); left.push([mx - nx * w, my - ny * w]); right.push([mx + nx * w, my + ny * w]); }
  const body = [...left, ...right.reverse().slice(1)];
  const t0 = 29, tl = left.slice(t0), tr = right.slice().reverse().slice(0, 0);
  const rr = mid.slice(t0).map(([mx, my, ma, u]) => { const w = hw(u) * (1 + .02 * Math.sin(u * 22)), nx = Math.cos(ma), ny = Math.sin(ma); return [mx + nx * w, my + ny * w]; });
  const lowL = left[t0], lowR = rr[0], zig = [];
  for (let k = 1; k < 12; k++) { const u = k / 12; zig.push([lerp(lowR[0], lowL[0], u), lerp(lowR[1], lowL[1], u) + 7 * Math.sin(u * Math.PI * 3 + .6)]); }
  const tip = [...tl.map(p => p), ...[...rr].reverse(), ...zig];
  return [body, tip];
}

// ===================== 静态部件（载入时剪好） =====================
const RAN_G = (() => {
  const g = {};
  // ---- 尾巴：九条，外侧短，各自带弯 ----
  g.tails = Array.from({ length: 9 }, (_, i) => {
    const d = i - 4, L = 285 - Math.abs(d) * 9, [body, tip] = ranTailPts(L, 38 - Math.abs(d) * .8, d * .075);
    return { L, body: ranCut(body, 200 + i, 8, 1.5, false), tip: ranCut(tip, 220 + i, 6, 1.2, false) };
  });
  // ---- 身体（脚底为原点） ----
  g.robe = ranCut([[-44, -436], [-14, -441], [14, -441], [44, -436], [50, -410], [54, -340], [60, -250], [72, -140], [88, -50], [92, -18], [-92, -18], [-88, -50], [-72, -140], [-60, -250], [-54, -340], [-50, -410]], 11, 11, .9);
  g.hem = ranCut([[-86, -52], [0, -50], [86, -52], [93, -16], [0, -14], [-93, -16]], 12, 10, .5, false);
  g.hemLine = ranCut([[-85, -61], [0, -59], [85, -61], [86, -57], [0, -55], [-86, -57]], 13, 10, .3, false);
  g.lapelL = ranCut([[-26, -441], [-14, -442], [4, -330], [-5, -326]], 14, 8, .4, false);
  g.lapelR = ranCut(ranMirror([[-26, -441], [-14, -442], [4, -330], [-5, -326]]), 15, 8, .4, false);
  g.seam = ranCut([[-2.5, -330], [2.5, -330], [3.5, -18], [-3.5, -18]], 16, 12, .4, false);
  g.sash = ranCut([[-56, -298], [0, -300], [56, -298], [59, -268], [0, -266], [-59, -268]], 17, 10, .5, false);
  g.knot = ranCut(ellPts(0, -283, 7.5, 9.5, 12), 18, 4, .3);
  g.baguaDisc = ranCut(ellPts(0, 0, 23, 23, 22), 19, 5, .5);
  g.baguaBars = [-9, 0, 9].map((y, i) => ranCut([[-14, y - 2], [14, y - 2], [14, y + 2], [-14, y + 2]], 20 + i, 6, .3, false));
  g.shoe = ranCut(ellPts(0, -6, 17, 7, 14), 23, 5, .4);
  g.neck = ranCut([[-9, -450], [9, -450], [11, -428], [-11, -428]], 24, 8, .3, false);
  // ---- 手臂：上袖（肩为原点向下 86）、前袖（肘为原点向下，袖口 96）----
  g.armU = ranCut([[-20, -10], [0, -14], [20, -10], [27, 22], [30, 62], [29, 90], [-29, 90], [-30, 62], [-27, 22]], 25, 9, .6);
  g.armL = ranCut([[-27, -12], [0, -15], [27, -12], [34, 28], [42, 66], [47, 96], [0, 99], [-47, 96], [-42, 66], [-34, 28]], 26, 9, .7);
  g.cuff = ranCut([[-45.5, 82], [0, 84], [45.5, 82], [47.5, 99], [0, 101], [-47.5, 99]], 27, 8, .3, false);
  g.cuffLine = ranCut([[-44.5, 76], [0, 77.5], [44.5, 76], [45, 79.5], [0, 81], [-45, 79.5]], 28, 8, .2, false);
  g.handTips = ranCut([[-10, 90], [-11, 108], [-8, 119], [-4, 124], [0, 121], [4, 125], [8, 119], [11, 108], [10, 90]], 29, 3, .25, false);
  g.handPoint = ranCut([[-8, 90], [-9, 106], [-6, 112], [-3, 111], [-2.5, 132], [0, 138], [3, 132], [3.5, 111], [8, 112], [10, 104], [9, 90]], 30, 3, .25, false);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = ranCut([[0, -2], [8, -4], [19, -11], [30, -25], [38, -45], [41, -66], [39, -91], [30, -104], [0, -110], [-30, -104], [-39, -91], [-41, -66], [-38, -45], [-30, -25], [-19, -11], [-8, -4]], 31, 7, .5);
  g.backHair = ranCut([[-50, -122], [-55, -96], [-53, -60], [-50, -26], [-42, -2], [-33, 8], [-24, -8], [0, -14], [24, -8], [33, 8], [42, -2], [50, -26], [53, -60], [55, -96], [50, -122], [0, -134]], 32, 9, .8);
  const lock = [[33, -102], [44, -94], [50, -66], [50, -34], [47, -4], [42, -20], [37, -48], [35, -78]];
  g.lockR = ranCut(lock, 33, 7, .6, false); g.lockL = ranCut(ranMirror(lock), 34, 7, .6, false);
  g.bangs = ranCut([[-50, -112], [50, -112], [49, -96], [45, -86], [40, -96], [32, -77], [24, -96], [14, -74], [6, -97], [-3, -73], [-11, -97], [-20, -76], [-28, -97], [-36, -80], [-42, -96], [-47, -86], [-50, -96]], 35, 6, .5, false);
  g.bangLines = [[24, -76, 26, -108], [-3, -75, -2, -110], [-29, -80, -30, -108]].map(([x0, y0, x1, y1], i) => ranCut([[x0 - .9, y0], [x1 - 1.5, y1], [x1 + 1.5, y1], [x0 + .9, y0]], 36 + i, 8, .2, false));
  const ear = [[-46, -118], [-45, -150], [-38, -190], [-26, -168], [-12, -138], [-10, -116]], earIn = [[-40, -128], [-39, -152], [-36, -176], [-28, -156], [-20, -134]];
  g.earL = ranCut(ear, 40, 5, .5, false); g.earR = ranCut(ranMirror(ear), 41, 5, .5, false);
  g.earInL = ranCut(earIn, 42, 4, .3, false); g.earInR = ranCut(ranMirror(earIn), 43, 4, .3, false);
  g.cap = ranCut([[-52, -92], [-57, -108], [-52, -126], [-34, -140], [0, -146], [34, -140], [52, -126], [57, -108], [52, -92], [26, -86], [0, -84], [-26, -86]], 44, 9, .8);
  g.capBand = ranCut([[-53, -99], [-26, -96], [0, -95], [26, -96], [53, -99], [52, -90], [26, -86], [0, -84], [-26, -86], [-52, -90]], 45, 8, .3, false);
  g.capCrest = ranCut(ellPts(0, -121, 7, 7, 12), 46, 3, .3);
  g.sweat = ranCut([[0, -9], [4, -1], [5, 4], [2.5, 7.5], [-2.5, 7.5], [-5, 4], [-4, -1]], 47, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// open 眼睛张开比例，tilt 外眼角抬起（负为下垂），es 眼睛大小，brow [上移, 内端角（负=八字）]，mouth 嘴型，blush 腮红，chin 下巴抬(-)
const RAN_MOODS = {
  normal: { open: .4, tilt: .18, es: 1, brow: [0, .04], mouth: 'smile', blush: 1 },
  happy: { closed: 'up', brow: [3, -.06], mouth: 'grin', blush: 1.35 },
  surprised: { open: 1, tilt: 0, es: 1.14, brow: [8, 0], mouth: 'o', blush: .9, small: true },
  awkward: { open: .52, tilt: -.14, es: 1, brow: [-1, -.32], mouth: 'wave', blush: .7, sweat: true },
  proud: { open: .22, tilt: .06, es: 1, brow: [3, .1], mouth: 'smirk', blush: .9, chin: -.1 },
};
const RAN_MOOD_ALIAS = { calm: 'normal', smile: 'happy', smug: 'proud', sad: 'awkward', flustered: 'awkward', confused: 'surprised' };

function ranMouthPts(type, open) {
  if (open > .06) {
    const w = 8 + open * 3, oh = 2 + open * 7, lift = type === 'smile' || type === 'grin' || type === 'smirk' ? 1.4 : 0;
    return [[[-w / 2, -lift], [-w / 4, -.5], [w / 4, -.5], [w / 2, -lift - (type === 'smirk' ? 1.6 : 0)], [w * .36, oh * .62], [0, oh], [-w * .36, oh * .62]], RAN_K.mouthIn];
  }
  switch (type) {
    case 'grin': return [[[-6, -1.2], [0, -.4], [6, -1.2], [4, 3], [0, 4.4], [-4, 3]], RAN_K.mouthIn];
    case 'smirk': return [[[-5, .6], [0, -.2], [3.5, -1.2], [6.4, -4], [5.4, .1], [2, 1.5], [-2.5, 1.5]], RAN_K.mouth];
    case 'o': return [ellPts(0, 1.8, 3, 4, 12), RAN_K.mouthIn];
    case 'wave': { const top = [], bot = []; for (let k = 0; k <= 12; k++) { const x = -6.5 + k * 13 / 12, y = Math.sin(k / 12 * TAU * 1.25) * 1; top.push([x, y - .7]); bot.unshift([x, y + .7]); } return [[...top, ...bot], RAN_K.mouth]; }
    default: return [[[-6, -1.4], [-3, .4], [0, 1.2], [3, .4], [6, -1.4], [5, -1.6], [3, -.1], [0, .6], [-3, -.1], [-5, -1.6]], RAN_K.mouth];   // smile：一道上扬的线
  }
}

// ===================== 姿势（手尖目标在上身坐标，站姿脖子在 (0,-448)） =====================
// back/front：手尖目标 [x,y]（null 则按函数给）、hand 手型；Lh 手尖离肘的距离
function ranPose(pose, g, tt) {
  const sw = Math.sin(tt * 1.7);
  switch (pose) {
    case 'read': return { back: { T: [-34, -338], hand: 'tips' }, front: { T: [62, -344], hand: 'tips' }, hold: [14, -372], hr: .07, lookY: .7, turn: .12, look: .2 };
    case 'point': return { back: { T: [14, -372], hand: 'none' }, front: { T: [RAN_SH + 78 + g * 112, RAN_SY - 16 - g * 22 + .03 * sw * g], hand: 'point' }, turn: .3, look: .8, hr: -.03 };
    case 'present': { const T = [RAN_SH + 70 + g * 105, RAN_SY + 34 - g * 24]; return { back: { T: [14, -372], hand: 'none' }, front: { T, hand: 'tips' }, holdFrom: T, hold: [30, -8], turn: .22, look: .6 }; }
    case 'think': return { back: { T: [20, -372], hand: 'none' }, front: { T: [12, -458], hand: 'point', late: true }, fall: 1, turn: .1, look: -.3, hr: .05 };
    case 'bow': return { back: { T: [30, -358], hand: 'none' }, front: { T: [-6, -350], hand: 'none' }, lean: .13, hr: .09, turn: .05, look: .1, lookY: .4 };
    default: return { back: { T: [14, -372], hand: 'none' }, front: { T: [-14, -360], hand: 'none' }, turn: .14, look: .15 };
  }
}
const RAN_LH = { none: 100, tips: 120, point: 136 };

// 两节手臂反解：肩 s、手尖 T、两节长 l1/l2，肘取较低的那一解。返回 { e, T }（T 可能被夹进可达范围）
function ranIK(s, T, l1, l2) {
  let dx = T[0] - s[0], dy = T[1] - s[1], d = Math.hypot(dx, dy) || 1; const dd = clamp(d, Math.abs(l1 - l2) + 2, l1 + l2 - 1), al = Math.atan2(dy, dx), cg = clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1), g = Math.acos(cg);
  const e1 = [s[0] + Math.cos(al + g) * l1, s[1] + Math.sin(al + g) * l1], e2 = [s[0] + Math.cos(al - g) * l1, s[1] + Math.sin(al - g) * l1];
  return { e: e1[1] > e2[1] ? e1 : e2, T: [s[0] + dx / d * dd, s[1] + dy / d * dd] };
}

// ===================== 绘制 =====================
const RAN_OFF = 6000;
function ranPaint(c, items, sh, env, gr = true) {
  if (!items.length) return;
  const all = new Path2D();
  for (const it of items) all.addPath(it.p, new DOMMatrix(it.m));
  if (sh) {
    const T = c.getTransform();
    c.save(); c.shadowColor = `rgba(30,20,35,${sh.al ?? .3})`; c.shadowBlur = sh.blur * env.sk; c.shadowOffsetX = T.a * RAN_OFF + sh.sx * env.sk; c.shadowOffsetY = T.b * RAN_OFF + sh.sy * env.sk;
    c.translate(-RAN_OFF, 0); c.fillStyle = '#000'; c.fill(all); c.restore();
  }
  for (const it of items) {
    c.save(); c.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5]); c.fillStyle = it.col; c.fill(it.p);
    if (it.edge !== false) { c.strokeStyle = ranEdge(it.col); c.lineWidth = env.lw; c.stroke(it.p); }
    c.restore();
  }
  if (gr && env.pat) { c.save(); c.globalAlpha *= .11; c.fillStyle = env.pat; c.fill(all); c.restore(); }
}
const RAN_SD = { big: { blur: 5, sx: 2.4, sy: 3.4, al: .3 }, mid: { blur: 3.5, sx: 1.8, sy: 2.4, al: .3 }, tiny: { blur: 1.2, sx: .8, sy: 1, al: .3 } };

function drawRan(c, o = {}) {
  const { x = 0, y = 0, h = RAN_H, facing = 1, gesture = null, tilt = 0, mouth = 0, blink = 0, t = 0, tails = 0, al = 1 } = o;
  const pose = o.pose || 'stand', moodName = RAN_MOOD_ALIAS[o.mood] || o.mood || 'normal';
  const md = RAN_MOODS[moodName] || RAN_MOODS.normal, tt = twos(t + CLOCK0), s = h / RAN_DH;
  const g = gesture === null || gesture === undefined ? .55 + .35 * Math.sin(tt * 1.3) : clamp(gesture, 0, 1);
  const ps = ranPose(pose, g, tt);
  c.save(); c.globalAlpha *= al;
  const sway = .005 * Math.sin(tt * 1.1) + .0025 * Math.sin(tt * 2.9);
  const root = ranTR(RAN_I, x, y, sway, facing * s, s);
  const breath = 1.2 * Math.sin(tt * TAU / 3.4), lean = ps.lean || 0;
  const ugL = ranTR(ranPivot(RAN_I, 0, -230, lean), 0, -breath), ug = ranMul(root, ugL);
  const cs = -Math.sin(lean) * 210 / 290, lowerM = lean ? ranMul(root, [1, 0, cs, 1, -cs * -150, 0]) : root;   // 长袍随上身前倾剪切
  const hr = (ps.hr || 0) + (md.chin || 0) + tilt + .012 * Math.sin(tt * .9 + 1);
  const head = ranTR(ug, 0, RAN_NECK, hr, RAN_HS, RAN_HS);
  const turn = clamp(ps.turn || 0, -1, 1), look = clamp(o.look !== undefined ? o.look : ps.look || 0, -1, 1), lookY = ps.lookY || 0;
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1 / (s * dev), pat };
  const it = (p, m, col, edge) => ({ p, m, col, edge });
  const paint = (items, sh, gr) => ranPaint(c, items, sh, env, gr);
  const G = RAN_G;

  // ---- 1 尾巴：一把扇形，外侧先画；tails 抬高、think 时垂下去 ----
  const fall = ps.fall || 0, lift = clamp(tails, 0, 1);
  const tilt0 = lerp(-.2 + .2 * lift, -1.55, fall), step = lerp(.255 * (1 + .2 * lift), .21, fall), lenK = lerp(1 + .1 * lift, .86, fall);
  const piv = [-6, lerp(-226, -200, fall)], order = [0, 8, 1, 7, 2, 6, 3, 5, 4];
  for (const i of order) {
    const d = i - 4, a = tilt0 + d * step + .03 * Math.sin(tt * 1.25 + i * .8) + (fall ? .02 * Math.sin(tt * .9 + i) : 0);
    const m = ranTR(root, piv[0], piv[1], a, 1, lenK), tg = G.tails[i];
    paint([it(tg.body, m, i % 2 ? RAN_K.tailAlt : RAN_K.tail), it(tg.tip, m, RAN_K.tailTip, false)], RAN_SD.mid);
  }

  // ---- 2 后发 ----
  const hairM = ranTR(ug, 0, RAN_NECK, hr * .15 + .006 * Math.sin(tt * 1.3 + 2), RAN_HS, RAN_HS);
  paint([it(G.backHair, hairM, RAN_K.hairBack)], RAN_SD.big);

  // ---- 3 鞋、长袍、滚边、腰带、八卦纹 ----
  paint([-1, 1].map(sd => it(G.shoe, ranTR(root, sd * 28, 0), RAN_K.shoe)), RAN_SD.mid, false);
  paint([it(G.robe, lowerM, RAN_K.robe)], RAN_SD.big);
  paint([it(G.hem, lowerM, RAN_K.navy), it(G.hemLine, lowerM, RAN_K.gold, false)], RAN_SD.tiny, false);
  paint([it(G.lapelL, lowerM, RAN_K.navy), it(G.lapelR, lowerM, RAN_K.navy), it(G.seam, lowerM, RAN_K.navy2)], RAN_SD.tiny, false);
  paint([it(G.sash, lowerM, RAN_K.navy), it(G.knot, lowerM, RAN_K.gold)], RAN_SD.mid, false);
  const bm = ranTR(lowerM, 0, -205);
  paint([it(G.baguaDisc, bm, RAN_K.navy), ...G.baguaBars.map(p => it(p, bm, RAN_K.cap, false))], RAN_SD.tiny, false);
  paint([it(G.neck, ug, RAN_K.skin)], RAN_SD.mid, false);

  // ---- 4 手臂：手尖目标 → 反解出肘 → 上袖、手、前袖、袖口 ----
  const arm = (sd, spec) => {
    const Lh = RAN_LH[spec.hand], sh = [sd * RAN_SH, RAN_SY], k = ranIK(sh, spec.T, RAN_L1, Lh), e = k.e;
    const th1 = Math.atan2(-(e[0] - sh[0]), e[1] - sh[1]), th2 = Math.atan2(-(k.T[0] - e[0]), k.T[1] - e[1]);
    return { u: ranTR(ug, sh[0], sh[1], th1), l: ranTR(ug, e[0], e[1], th2), hand: spec.hand, tip: ranApply(ug, k.T), T: k.T, late: spec.late };
  };
  const AB = arm(-1, ps.back), AF = arm(1, ps.front);
  const drawArm = A => paint([it(G.armU, A.u, RAN_K.robe), ...(A.hand === 'none' ? [] : [it(A.hand === 'point' ? G.handPoint : G.handTips, A.l, RAN_K.skin)]), it(G.armL, A.l, RAN_K.robe), it(G.cuff, A.l, RAN_K.navy), it(G.cuffLine, A.l, RAN_K.gold, false)], RAN_SD.big);
  drawArm(AB); if (!AF.late) drawArm(AF);

  // ---- 5 脸 ----
  paint([it(G.face, head, RAN_K.skin)], RAN_SD.mid);
  ranFace(c, head, md, { turn, look, lookY, blink, mouth, tt }, paint, it);

  // ---- 6 前发、眉、耳朵、帽子 ----
  const lockM = sd => ranPivot(head, sd * 40, -100, -hr * .5 + .02 * Math.sin(tt * 1.5 + sd));
  const bangM = ranTR(head, turn * 3, 0);
  paint([it(G.lockL, lockM(-1), RAN_K.hair), it(G.lockR, lockM(1), RAN_K.hair), it(G.bangs, bangM, RAN_K.hair)], RAN_SD.mid);
  paint(G.bangLines.map(p => it(p, bangM, RAN_K.hairLine, false)), null, false);
  ranBrows(md, turn, head, paint, it);
  const tw = sd => ranPivot(head, sd * 28, -124, .05 * Math.sin(tt * 2.1 + sd * 1.3) * (Math.sin(tt * .6) > .6 ? 1 : .2) + sd * lift * .06);
  const EL = tw(-1), ER = tw(1);
  paint([it(G.earL, EL, RAN_K.hair), it(G.earR, ER, RAN_K.hair)], RAN_SD.mid);
  paint([it(G.earInL, EL, RAN_K.earIn, false), it(G.earInR, ER, RAN_K.earIn, false)], null, false);
  const cap = ranPivot(head, 0, -90, .008 * Math.sin(tt * 1.2 + .5));
  paint([it(G.cap, cap, RAN_K.cap)], RAN_SD.big);
  paint([it(G.capBand, cap, RAN_K.capBand, false), it(G.capCrest, cap, RAN_K.gold)], RAN_SD.tiny, false);
  if (AF.late) drawArm(AF);
  if (md.sweat) paint([it(G.sweat, ranTR(head, 50, -84 + 3 * ((tt * 2) % 1), .15), RAN_K.sweat)], RAN_SD.tiny);
  c.restore();

  const hold = ps.holdFrom ? ranApply(ug, [AF.T[0] + ps.hold[0], AF.T[1] + ps.hold[1]]) : ranApply(ug, ps.hold || [10, -380]);
  return { head: ranApply(head, [0, -55]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, hold };
}

// 五官：腮红、狐狸眼（深色杏仁形 + 琥珀瞳 + 厚上眼线带外角一撇）、嘴
function ranFace(c, head, md, f, paint, it) {
  const { turn, look, lookY, blink, mouth } = f, low = [], top = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .28 : 1, ex = sd * 18 * (sd * turn > 0 ? 1 - Math.abs(turn) * .15 : 1) + turn * 9, ey = -56;
    const bs = md.blush;
    low.push(it(ranCut(ellPts(ex + sd * 9, -40, 7 * bs * far, 3.6 * Math.sqrt(bs), 14), 120 + sd, 4, .3), head, RAN_K.blush, false));
    const open = md.closed ? 0 : clamp(lerp(md.open, 0, blink), 0, 1), es = md.es || 1, rx = 9.5 * far * es, ry = 10.5 * es;
    if (md.closed || open < .08) {
      // 闭眼：happy 向上拱，眨眼向下弯
      const up = md.closed === 'up', arc = up ? -4 : 2.2, base = up ? ey + 2 : ey + 1, pts = [], back = [];
      for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1, xx = ex + u * (rx + 2), yy = base + arc * (1 - u * u) - sd * u * (up ? .8 : 0); pts.push([xx, yy - 1.6]); back.unshift([xx, yy + 1.6 - Math.abs(u) * .8]); }
      top.push(it(ranCut([...pts, ...back], 130 + sd, 3, .2, false), head, RAN_K.lid, false));
      continue;
    }
    // 杏仁形：v 从内眼角到外眼角
    const topC = [], botC = [], N = 12, hv = open * ry;
    for (let k = 0; k <= N; k++) { const v = k / N, xx = ex - sd * rx + sd * 2 * rx * v, sl = (md.tilt || 0) * rx * 2 * (v - .5), sn = Math.sin(Math.PI * v);
      topC.push([xx, ey - hv * Math.pow(sn, .75) - sl]); botC.push([xx, ey + hv * .45 * Math.pow(sn, .9) - sl]); }
    low.push(it(ranCut([...topC, ...botC.reverse().slice(1, -1)], 124 + sd, 3, .2, false), head, RAN_K.eye, false));
    // 琥珀瞳
    const ix = ex + look * 2.6 * far, iy = ey + lookY * 1.5 + (open < .6 ? 1 : 0), ir = md.small ? 3.2 : 4.4, ih = Math.max(1.2, Math.min(ir * 1.1, hv * .7));
    low.push(it(ranCut(ellPts(ix, iy, ir, ih, 12), 126 + sd, 2, .1), head, RAN_K.iris, false));
    if (open > .7) top.push(it(ranCut(ellPts(ix - 1.8, iy - 2, 1.7, 1.7, 8), 128 + sd, 2, .1), head, RAN_K.white, false));
    // 上眼线：沿上缘一条厚带，外端翘起一撇
    const band = [], back = [];
    for (let k = 0; k <= N; k++) { const p = topC[k], v = k / N; band.push([p[0], p[1] - 1.2]); back.unshift([p[0], p[1] + 1.8 - (1 - Math.sin(Math.PI * v)) * 1.2]); }
    const last = topC[N], fl = md.tilt < 0 ? 1 : 3.2;
    top.push(it(ranCut([...band, [last[0] + sd * 3.2, last[1] - fl - 1.2], [last[0] + sd * 4, last[1] - fl], ...back], 132 + sd, 3, .2, false), head, RAN_K.lid, false));
  }
  const [mp, mc] = ranMouthPts(md.mouth, mouth);
  low.push(it(ranCut(mp, 140, 2.4, .15, false), ranTR(head, turn * 10, -26), mc, false));
  paint(low, RAN_SD.tiny, false);
  paint(top, RAN_SD.tiny, false);
}
function ranBrows(md, turn, head, paint, it) {
  const [dy, ang] = md.brow || [0, 0], items = [];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * 19 * far + turn * 9, cy = -80 - dy, len = 7 * far;
    const pts = [[-sd * len, -1.1], [sd * len * .3, -1.5], [sd * len, -.4], [sd * len * .3, .8], [-sd * len, 1.1]];
    items.push(it(ranCut(pts, 150 + sd, 3, .15, false), ranTR(head, cx, cy, -sd * ang), RAN_K.brow, false));
  }
  paint(items, RAN_SD.tiny, false);
}

// ===================== 打印纸条 =====================
// ranSlip(c, x, y, lines, { w, al, rot, size, color })：蓝手里那卷终端打印纸撕下来的一张。两侧走纸孔条，顶端撕口锯齿，纸略旧，等宽字
function ranSlip(c, x, y, lines, o = {}) {
  const { w = 420, al = 1, rot = .03, size = 44, color = P.ink } = o, lh = size * 1.35, h = 74 + lines.length * lh, strip = 34;
  c.save(); c.globalAlpha *= al; c.translate(x, y); c.rotate(rot);
  // 纸身：顶端锯齿撕口，底端略微不齐
  const top = [], x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  for (let k = 0; k <= 22; k++) top.push([lerp(x0, x1, k / 22), y0 + (k % 2 ? 7 : 0)]);
  const bot = []; for (let k = 22; k >= 0; k--) bot.push([lerp(x0, x1, k / 22), y1 - (hash(k, 7301) < .5 ? 0 : 3)]);
  const body = polyPath(scissor([...top, ...bot], 7300, 14, .9), true);
  c.save(); c.shadowColor = 'rgba(30,20,35,.30)'; c.shadowBlur = 6; c.shadowOffsetX = 2.5; c.shadowOffsetY = 3.5; c.fillStyle = RAN_K.paper; c.fill(body); c.restore();
  c.fillStyle = RAN_K.paper; c.fill(body); grain(c, body, .12);
  // 旧：边缘泛黄、底部一道折痕阴影
  c.save(); c.clip(body); const gd = c.createLinearGradient(x0, 0, x1, 0); gd.addColorStop(0, alpha(RAN_K.paperEdge, .55)); gd.addColorStop(.08, alpha(RAN_K.paperEdge, 0)); gd.addColorStop(.92, alpha(RAN_K.paperEdge, 0)); gd.addColorStop(1, alpha(RAN_K.paperEdge, .55)); c.fillStyle = gd; c.fillRect(x0, y0, w, h);
  c.fillStyle = alpha('#8a7a5a', .06); c.fillRect(x0 + strip, y1 - 26, w - 2 * strip, 2); c.fillStyle = alpha('#ffffff', .35); c.fillRect(x0 + strip, y1 - 24, w - 2 * strip, 1.5);
  // 撕缝虚线 + 走纸孔
  c.strokeStyle = alpha(P.g2, .5); c.lineWidth = 1.2; c.setLineDash([5, 4]);
  for (const sx of [x0 + strip, x1 - strip]) { c.beginPath(); c.moveTo(sx, y0 + 6); c.lineTo(sx, y1); c.stroke(); }
  c.setLineDash([]);
  for (let yy = y0 + 22; yy < y1 - 8; yy += 30) for (const sx of [x0 + strip / 2, x1 - strip / 2]) { c.fillStyle = alpha(RAN_K.hole, .95); c.beginPath(); c.arc(sx, yy, 5, 0, TAU); c.fill(); c.fillStyle = alpha('#ffffff', .5); c.beginPath(); c.arc(sx + .6, yy + .8, 5, .3, Math.PI * .9); c.lineWidth = 1; c.strokeStyle = alpha('#ffffff', .6); c.stroke(); }
  c.restore();
  c.strokeStyle = alpha(mix(RAN_K.paper, '#ffffff', .5), .7); c.lineWidth = 1; c.stroke(body);
  // 字：等宽网格，西文 0.6 格、汉字 1 格（先用 0.6 size 当一格宽，汉字占两格）
  c.fillStyle = color; c.font = `${size}px "LXGW WenKai", monospace`; c.textAlign = 'left'; c.textBaseline = 'middle';
  const cell = size * .6;
  lines.forEach((ln, i) => { let px = x0 + strip + 18; const py = y0 + 54 + (i + .5) * lh; for (const ch of ln) { const wide = ch.charCodeAt(0) > 255; c.fillText(ch, px + (wide ? 0 : (cell - c.measureText(ch).width) / 2), py); px += wide ? cell * 2 : cell; } });
  c.restore();
}
