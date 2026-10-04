'use strict';
// 剪纸人偶引擎（rig）：所有角色共用的矩阵、剪纸部件、分层投影、光照两级色、表情（五官）、手臂、关节层级、二阶弹簧。
// 一个角色 = 一张部件表（src/character/*.js 里的 XXX_RIG）+ 一行薄封装 drawXxx(c, o) = drawRig(c, XXX_RIG, o)。
// 部件表字段、加角色的步骤、弹簧和光照参数见 docs/rig.md。本文件顶层名字都带 r / rig / RIG 前缀。
//
// 做法（沿用第 3 集人偶）：每个部件是一片剪纸（kit 的 scissor 剪刀边 + 纸纹），轮廓在载入时剪好（seed 固定），每帧只做仿射变换；
// 同一层的部件合并成一条路径画一次投影；五官随参数变形，按量化后的参数记忆（只是缓存，画面仍只由参数决定）。
//
// 弹簧的思路借自 papermotion（MIT License）src/rig/Strand.ts、Hair.ts：根随骨骼走，末端被拉回静止形、带惯性。
// papermotion 用 Verlet 存帧间状态；这里要逐帧确定性，改写成纯函数：末端的滞后 = 阻尼振子的脉冲响应 × 过去 0.5 秒根的加速度，
// 加权求和（rigSpring）。根的轨迹由场景传 o.track(t) → [x, y]；不传就没有弹簧，画面和以前完全一样。

// ===================== 矩阵（[a,b,c,d,e,f]，和 canvas 的 transform 同序） =====================
const rMul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const rApply = (A, p) => [A[0] * p[0] + A[2] * p[1] + A[4], A[1] * p[0] + A[3] * p[1] + A[5]];
// rTR：m × 平移(x,y) × 旋转 a × 缩放(sx,sy)
function rTR(m, x = 0, y = 0, a = 0, sx = 1, sy = 1) { const co = Math.cos(a), si = Math.sin(a); return rMul(m, [co * sx, si * sx, -si * sy, co * sy, x, y]); }
// rPivot：m × 绕点 (px,py) 转 a
const rPivot = (m, px, py, a) => rTR(rTR(m, px, py, a), -px, -py);
function rInv(m) { const d = m[0] * m[3] - m[1] * m[2]; if (!d) return null; const a = m[3] / d, b = -m[1] / d, c = -m[2] / d, e = m[0] / d; return [a, b, c, e, -(a * m[4] + c * m[5]), -(b * m[4] + e * m[5])]; }
const R_I = [1, 0, 0, 1, 0, 0];

// ===================== 剪纸轮廓 =====================
// rCut：轮廓 → 剪刀剪出的 Path2D（smooth 先过 Catmull-Rom；step 剪刀段长，amp 折角幅度）。p.dim = 包围盒短边（光照定背光带宽用）
function rCut(pts, seed, step = 8, amp = .7, smooth = true) {
  const q = scissor(smooth ? spline(pts, 3, true) : pts, seed, step, amp), p = polyPath(q, true);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of q) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  p.dim = Math.min(x1 - x0, y1 - y0); return p;
}
// rigCutter(off)：每个角色一把剪刀，种子整体加 off（两个角色同一个 seed 剪出来的边不一样）
const rigCutter = off => (pts, seed, step, amp, smooth) => rCut(pts, off + seed, step, amp, smooth);
const rMirror = pts => pts.map(([x, y]) => [-x, y]).reverse();
const rOpen = (pts, step = 4) => spline(pts, step, false);
const rLine = (a, b) => u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
// rScallop：沿曲线 f(u)（u: 0→1）做 n 个荷叶边鼓包：往 +x 走时鼓向上，往 -x 走时鼓向下（屏幕坐标），深 depth
function rScallop(f, n, depth, m = 4) {
  const out = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) {
    const u = (i + k / m) / n, p = f(u), q = f(Math.min(1, u + .01)), r = f(Math.max(0, u - .01)), dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, b = Math.sin(Math.PI * k / m) * depth;
    out.push([p[0] + dy / l * b, p[1] - dx / l * b]);
  }
  out.push(f(1)); return out;
}
// rStroke：粗线 → 轮廓：沿折线两侧各偏 w/2（w 可以是 u→宽度 的函数）
function rStroke(pts, w) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.min(n - 1, i + 1)], b = pts[Math.max(0, i - 1)], dx = a[0] - b[0], dy = a[1] - b[1], l = Math.hypot(dx, dy) || 1, hw = (typeof w === 'function' ? w(i / (n - 1)) : w) / 2;
    L.push([pts[i][0] - dy / l * hw, pts[i][1] + dx / l * hw]); R.unshift([pts[i][0] + dy / l * hw, pts[i][1] - dx / l * hw]);
  }
  return [...L, ...R];
}
// 月牙：开口朝 +x，r 外半径，th 最厚处
function rCrescent(r, th, phi = .95) {
  const out = [], cx = r * Math.cos(phi), rx = cx + r - th, ry = r * Math.sin(phi);
  for (let k = 0; k <= 24; k++) { const a = phi + k / 24 * (TAU - 2 * phi); out.push([r * Math.cos(a), r * Math.sin(a)]); }
  for (let k = 1; k < 16; k++) { const a = -Math.PI / 2 + k / 16 * Math.PI; out.push([cx - rx * Math.cos(a), ry * Math.sin(a)]); }
  return out;
}
// 共用轮廓（角色部件表直接引用）
const RIG_SHAPES = {
  // 小蝴蝶结（宽约 22）：两只耳朵 + 两条尾巴，一片剪出来
  bow: [[0, -2.5], [-5, -6], [-10, -7], [-11.5, -1], [-9, 5], [-3, 2.5], [-6, 11], [-2.5, 11.5], [0, 4], [2.5, 11.5], [6, 11], [3, 2.5], [9, 5], [11.5, -1], [10, -7], [5, -6]],
  // 领结（中心为原点，宽约 20）
  ribbon: [[0, -2.2], [-5, -5.5], [-9.5, -6], [-10.5, -.5], [-8.5, 4.5], [-3, 2.2], [-5, 9.5], [-2, 10], [0, 3.5], [2, 10], [5, 9.5], [3, 2.2], [8.5, 4.5], [10.5, -.5], [9.5, -6], [5, -5.5]],
  // 小手（腕为原点，手指朝 +y；拇指在 -x 侧，左右手由 arm.mirrorHand 镜像）。剪纸人偶只画轮廓：张开、拳、指、握
  hand: {
    open: [[-4.2, -1], [4.2, -1], [5.6, 5], [5.2, 10.5], [2.8, 13.6], [-.6, 14], [-3.4, 12.6], [-4.8, 8.5], [-7.6, 6], [-7.8, 3.4], [-4.8, 2.4]],
    point: [[-4.2, -1], [4.2, -1], [5.2, 5], [4, 8.8], [2.2, 10], [2.1, 20], [0, 22.6], [-2, 20], [-2.2, 10], [-5, 8], [-5.4, 3]],
    grip: [[-4.2, -1], [4.2, -1], [6.2, 4], [6.4, 9], [3, 12], [-1, 11.4], [-3, 8.5], [-6.4, 7.4], [-6.2, 2.4]],
  },
  handTip: { open: [0, 13], fist: [0, 6.5], point: [0, 22], grip: [0, 7] },
  // 泡泡袖、袖口（上臂坐标：肩为原点）
  puff: [[-11, -5], [-4, -10], [5, -10], [11, -5], [13.5, 6], [11.5, 16], [0, 19], [-11.5, 16], [-13.5, 6]],
  cuff: [[-11.8, 14.5], [0, 17.5], [11.8, 14.5], [11.2, 19], [0, 22], [-11.2, 19]],
  // 汗滴、「哼」气团
  sweat: [[0, -9], [4, -1], [5, 4], [2.5, 7.5], [-2.5, 7.5], [-5, 4], [-4, -1]],
  cloud: [[-16, 4], [-19, -4], [-13, -11], [-5, -12], [0, -16], [9, -14], [14, -8], [19, -5], [18, 4], [11, 9], [2, 8], [-6, 10], [-13, 9]],
};

// ===================== 光照两级色 =====================
// o.light = { dir 光从哪边来（屏幕坐标的弧度：0 右、-π/2 正上方；默认 -2.2 左上）, warm 0 冷 .. 1 暖, level 0..1 亮度 }
// 每片纸：整片先涂受光色，背光一侧（离光远的那条边）剪出一条背光色的带，宽约部件短边的 20%（最宽 12 设计单位）；朝光一侧再压一道细亮边。
// 投影方向跟着光走（落在光的对面），深浅跟亮度走。不传 light 时这些都不做，画面和以前一样。
const RIG_TONE = new Map();
function rigLight(l) {
  if (!l) return null;
  const dir = l.dir ?? -2.2, warm = clamp(l.warm ?? .5, 0, 1), level = clamp(l.level ?? 1, 0, 1);
  const lc = mix('#b3c7ff', '#ffc684', warm), amb = mix('#6a4a7c', '#3c4d8c', warm);
  return { dir, warm, level, ux: Math.cos(dir), uy: Math.sin(dir), key: [dir, warm, level].map(v => v.toFixed(3)).join(','), lc, amb,
    shAl: .75 + .55 * level, shCol: a => `rgba(${mix('#1e1423', '#10142a', warm).slice(1).match(/../g).map(h => parseInt(h, 16)).join(',')},${Math.min(.7, a)})` };
}
const rMulCol = (a, b, k) => { const A = parseColor(a), B = parseColor(b); return toHex(A.map((v, i) => v * B[i] / 255 * k)); };
function rigTone(col, L) {
  const key = col + '|' + L.key; let t = RIG_TONE.get(key);
  if (!t) {
    if (RIG_TONE.size > 4000) RIG_TONE.clear();
    const lit = mix(rMulCol(col, mix('#ffffff', L.lc, .35), .82 + .26 * L.level), L.lc, .05 * L.level);
    const shade = rMulCol(col, mix('#ffffff', L.amb, .5), .6 + .2 * L.level);
    t = { lit, shade, rim: alpha(mix(lit, L.lc, .55), .75), edge: alpha(mix(lit, '#ffffff', .4), .5) };
    RIG_TONE.set(key, t);
  }
  return t;
}
// band：路径里、沿 (dx,dy) 方向那一侧以外的一条边（P 减去 P 平移 (dx,dy)），当前变换下
function rigBand(c, p, dx, dy, col) {
  const out = new Path2D(); out.rect(-1e4, -1e4, 2e4, 2e4); out.addPath(p, new DOMMatrix([1, 0, 0, 1, dx, dy]));
  c.save(); c.clip(p); c.fillStyle = col; c.fill(out, 'evenodd'); c.restore();
}

// ===================== 画一层剪纸 =====================
const RIG_OFF = 6000, RIG_EDGE = {};
// rigOff：挪走本体用的偏移。默认 RIG_OFF；人偶在大画布上离原点很远时，挪 6000 可能正好挪进画面，就逐次翻倍到挪出画布为止
function rigOff(c, T) {
  const cw = c.canvas.width, ch = c.canvas.height, rb = 900 * Math.hypot(T.a, T.b);
  let off = RIG_OFF;
  for (let k = 0; k < 12; k++, off *= 2) { const x = T.e - T.a * off, y = T.f - T.b * off; if (x < -rb || x > cw + rb || y < -rb || y > ch + rb) break; }
  return off;
}
const rigEdge = col => RIG_EDGE[col] || (RIG_EDGE[col] = alpha(mix(col, '#ffffff', .5), .6));
const RIG_SH = { big: { blur: 5, sx: 2.4, sy: 3.4, al: .3 }, mid: { blur: 3.5, sx: 1.8, sy: 2.4, al: .3 }, tiny: { blur: 1.2, sx: .8, sy: 1, al: .3 }, wing: { blur: 4, sx: 2.6, sy: 3.6, al: .22 } };
// rigPaint：items = [{ p: Path2D, m: 矩阵, col, edge }]。sh 投影（同层合并一次）；gr 纸纹；al 半透明；flat 不分受光背光（五官）
function rigPaint(c, items, sh, env, gr = true, al = 1, flat = false) {
  if (!items.length) return;
  const all = new Path2D(), L = env.L;
  for (const it of items) all.addPath(it.p, new DOMMatrix(it.m));
  if (al < 1) { c.save(); c.globalAlpha *= al; }
  if (sh) {
    // 只要影子：把路径挪到画面外，用 shadowOffset 把影子挪回来（不会留下填色的毛边）
    const T = c.getTransform();
    let sx = sh.sx, sy = sh.sy, a = sh.al ?? .3;
    if (L) { const r = Math.hypot(sx, sy); sx = -L.ux * r; sy = -L.uy * r; a *= L.shAl; }
    const off = rigOff(c, T);
    c.save(); c.shadowColor = L ? L.shCol(a) : `rgba(30,20,35,${a})`; c.shadowBlur = sh.blur * env.sk; c.shadowOffsetX = T.a * off + sx * env.sk; c.shadowOffsetY = T.b * off + sy * env.sk;
    c.translate(-off, 0); c.fillStyle = '#000'; c.fill(all); c.restore();
  }
  for (const it of items) {
    c.save(); c.transform(it.m[0], it.m[1], it.m[2], it.m[3], it.m[4], it.m[5]);
    if (!L) {
      c.fillStyle = it.col; c.fill(it.p);
      if (it.edge !== false) { c.strokeStyle = rigEdge(it.col); c.lineWidth = env.lw; c.stroke(it.p); }
    } else {
      const tn = rigTone(it.col, L);
      c.fillStyle = tn.lit; c.fill(it.p);
      if (!flat && it.p.dim > 2.5) {
        // 屏幕上「朝光」的单位向量换到部件自己的坐标里（镜像、旋转都算进去）
        const M = c.getTransform(), d = M.a * M.d - M.b * M.c;
        if (d) { let vx = (M.d * L.ux - M.c * L.uy) / d, vy = (-M.b * L.ux + M.a * L.uy) / d; const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
          const w = clamp(it.p.dim * .2, 1.2, 12);
          rigBand(c, it.p, vx * w, vy * w, tn.shade);
          if (it.p.dim > 6) rigBand(c, it.p, -vx * 1.6, -vy * 1.6, tn.rim); }
      }
      if (it.edge !== false) { c.strokeStyle = tn.edge; c.lineWidth = env.lw; c.stroke(it.p); }
    }
    c.restore();
  }
  if (gr && env.pat) { c.save(); c.globalAlpha *= .11; c.fillStyle = env.pat; c.fill(all); c.restore(); }   // 纸纹：直接用纹理填同一条路径（不用 clip，快）
  if (al < 1) c.restore();
}

// ===================== 二阶弹簧（纯函数） =====================
// rigSpring(track, t, f, zeta)：根沿 track(t) → [x,y] 运动时，挂在上面的弹簧末端相对静止位置的滞后位移 [dx, dy]（调用方坐标）。
// 末端满足 x'' + 2ζω x' + ω² x = -a_根(t)，解是脉冲响应 g(τ) = e^{-ζωτ} sin(ω_d τ) / ω_d 和过去加速度的卷积；
// 只积过去 T 秒（默认 0.5，f=2Hz、ζ=.3 时 0.5 秒后衰减到约 15%），n 个采样点。根静止时加速度为 0，滞后自然回零。
function rigSpring(track, t, f = 2, zeta = .3, T = .5, n = 20) {
  const w = TAU * f, wd = w * Math.sqrt(1 - zeta * zeta), dt = T / n, X = [];
  for (let k = -1; k <= n + 1; k++) { const p = track(t - k * dt); X.push(Array.isArray(p) ? p : [p.x, p.y]); }   // X[k+1] = 根在 t - k·dt
  let dx = 0, dy = 0;
  for (let k = 1; k <= n; k++) {
    const tau = k * dt, gk = Math.exp(-zeta * w * tau) * Math.sin(wd * tau) / wd * dt * (k === n ? .5 : 1);
    const ax = (X[k + 2][0] - 2 * X[k + 1][0] + X[k][0]) / (dt * dt), ay = (X[k + 2][1] - 2 * X[k + 1][1] + X[k][1]) / (dt * dt);
    dx -= gk * ax; dy -= gk * ay;
  }
  return [dx, dy];
}
// rigSpringRot(k, sp, sd)：把滞后位移换成挂件绕根的转角（部件坐标里的弧度）。
//   sp = { len 挂件长（设计单位）, dir 静止时从根指向末端的方向（部件坐标弧度，默认 π/2 朝下）, gain 1, f 2, zeta .3, max .6,
//          mirror 左侧（sd=-1）那根骨头的坐标是镜像的（例如 scale(sd, 1) 出来的翅膀）}
function rigSpringRot(k, sp, sd = 1) {
  if (!k.track || !sp) return 0;
  const f = sp.f ?? 2, z = sp.zeta ?? .3, key = f + '|' + z;
  const lag = k.lags[key] || (k.lags[key] = rigSpring(k.track, k.t, f, z));
  // 部件坐标的方向 → 屏幕方向（facing 镜像 x；sd = -1 的那一侧再镜像一次）
  const dir = sp.dir ?? Math.PI / 2, mx = k.facing * (sd < 0 && sp.mirror ? -1 : 1), ux = Math.cos(dir) * mx, uy = Math.sin(dir);
  const rot = (ux * lag[1] - uy * lag[0]) / ((sp.len || 100) * k.s);
  return clamp(rot * (sp.gain ?? 1), -(sp.max ?? .6), sp.max ?? .6) * mx;
}

// ===================== 五官 =====================
const rQ = (v, k = 20) => Math.round(v * k) / k;
function rigMemo(S, key, f) { const M = S._memo || (S._memo = new Map()); let p = M.get(key); if (!p) { if (M.size > 800) M.clear(); p = f(); M.set(key, p); } return p; }
// 眼睛画法：lid 平直眼睑纸条压在深色眼睛上（帕秋莉的ジト目）；round 圆眼 + 浅色瞳孔 + 两个高光 + 弧形上睫毛（琪露诺）
const RIG_EYES = {
  lid(e) {
    const { S, F, K, sd, ex, ey, far, es, md, lidFrac, look, head, low, top, key, cut } = e;
    const rx = F.rx * far * es, ry = F.ry * es, ex2 = ex + look * F.lookX * far, topY = ey - ry;
    if (lidFrac > .9) {
      // 闭眼：一道弧形纸条（笑 up 向上拱，眨眼/睡着向下弯）
      top.push({ p: rigMemo(S, 'cl|' + key, () => { const up = md.eye === 'up', arc = up ? -3.2 : 2.6, base = up ? ey + 1 : ey + ry * .55, pts = [], back = [];
        for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1, xx = ex + u * (rx + 1.5), yy = base + arc * (1 - u * u) + sd * u * .8; pts.push([xx, yy - 1.4]); back.unshift([xx, yy + 1.4 - Math.abs(u) * .6]); }
        return cut([...pts, ...back], 90 + sd, 3, .2, false); }), m: head, col: K.lid, edge: false });
      return;
    }
    const [eyeP, hiP, lidP] = rigMemo(S, 'op|' + key, () => {
      const lidY = xx => topY + lidFrac * 2 * ry + (md.lidTilt || 0) * (xx - ex) * sd;
      const lowY = md.lower ? ey + ry - md.lower : Infinity;
      const eye = cut(ellPts(ex2, ey, rx, ry, 18).map(([xx, yy]) => [xx, clamp(yy, lidY(xx), lowY)]), 84 + sd, 3.2, .25);
      // 高光：一个白色小圆点，在眼睑下面
      const hy = Math.max(ey - 2, lidY(ex2) + 3);
      const hi = cut(ellPts(ex2 - 2.2 + look * .8, hy, 2.1, 2.1, 8), 86 + sd, 2, .1);
      // 上眼睑：平直的深色纸条，外端一撇
      const xi = ex - sd * (rx + .8), xo = ex + sd * (rx + 2.6), ly0 = lidY(xi), ly1 = lidY(xo);
      const lid = cut([[xi, ly0 - 3], [lerp(xi, xo, .5), lerp(ly0, ly1, .5) - 3.3], [xo, ly1 - 3.6], [xo + sd * 2.6, ly1 - 6], [xo + sd * 1.2, ly1 + .2], [lerp(xi, xo, .5), lerp(ly0, ly1, .5) + .6], [xi, ly0 + .5]], 88 + sd, 3, .2, false);
      return [eye, hi, lid];
    });
    low.push({ p: eyeP, m: head, col: K.eye, edge: false });
    top.push({ p: hiP, m: head, col: K.white, edge: false }, { p: lidP, m: head, col: K.lid, edge: false });
  },
  round(e) {
    const { S, F, K, sd, ex, ey, far, es, md, lidFrac, look, lookY, head, low, top, key, cut } = e;
    const rx = F.rx * far * es, ry = F.ry * es;
    if (md.eye === 'squeeze') {
      // > <：一道折成尖角的纸条，尖朝鼻梁
      top.push({ p: rigMemo(S, 'sq|' + key, () => cut([[8, -6.5], [-7, 0], [8, 6.5], [8, 3.6], [-2.8, 0], [8, -3.6]].map(([px, py]) => [ex + sd * px * far, ey + 1 + py]), 90 + sd, 3, .15, false)), m: head, col: K.lash, edge: false });
      return;
    }
    if (md.eye === 'up' || lidFrac > .9) {
      // 闭眼：弧形纸条（笑：∩；眨眼：∪）
      top.push({ p: rigMemo(S, 'cl|' + key, () => { const up = md.eye === 'up', arc = up ? -4 : 2.8, base = up ? ey + 2 : ey + ry * .5, pts = [], back = [];
        for (let k = 0; k <= 8; k++) { const u = k / 8 * 2 - 1, xx = ex + u * (rx + 1.5), yy = base + arc * (1 - u * u); pts.push([xx, yy - 1.5]); back.unshift([xx, yy + 1.5 - Math.abs(u) * .7]); }
        return cut([...pts, ...back], 92 + sd, 3, .2, false); }), m: head, col: K.lash, edge: false });
      return;
    }
    const ex2 = ex + look * F.lookX * far, ey2 = ey + lookY * .4, topY = ey - ry;
    const lidY = topY + lidFrac * 2 * ry, lowY = md.lower ? ey + ry - md.lower : Infinity;
    const [eyeP, irisP, hiP, hi2P, lashP] = rigMemo(S, 'op|' + key, () => {
      const cl = ([xx, yy]) => [xx, clamp(yy, lidY, lowY)];
      const eye = cut(ellPts(ex, ey, rx, ry, 20).map(cl), 84 + sd, 3.2, .25);
      const ir = (md.iris || 1), iris = cut(ellPts(ex2, ey2 + ry * .18, rx * .66 * ir, ry * .62 * ir, 16).map(cl), 86 + sd, 3, .2);
      const hy = Math.max(ey2 - ry * .35, lidY + 2.6);
      const hi = cut(ellPts(ex2 - 2.6, hy, 2.6 * es, 2.9 * es, 10), 88 + sd, 2, .1);
      const hi2 = cut(ellPts(ex2 + 2.8, ey2 + ry * .4, 1.2, 1.2, 8), 89 + sd, 2, .05);
      // 上睫毛：睁圆时沿眼眶上缘的弧，外端一撇；有眼睑时是平的一条
      let lash;
      if (lidFrac > .02) { const xi = ex - sd * (rx + .5), xo = ex + sd * (rx + 2.4);
        lash = [[xi, lidY - 2.2], [xo, lidY - 2.8], [xo + sd * 2.8, lidY - 5.5], [xo + sd * 1.4, lidY + .8], [xi, lidY + 1.2]]; }
      else { const arc = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.08 + k / 10 * .84); arc.push([ex + Math.cos(a) * (rx + .8), ey + Math.sin(a) * (ry + .8)]); }
        if (sd < 0) arc.reverse();
        lash = rStroke(arc, u => 1.4 + 2.2 * Math.sin(Math.PI * u) + (u > .8 ? 1.2 : 0));
        const e2 = arc[arc.length - 1]; lash.splice(arc.length, 0, [e2[0] + sd * 3.2, e2[1] - 3.4]); }
      return [eye, iris, hi, hi2, cut(lash, 90 + sd, 3, .15, false)];
    });
    low.push({ p: eyeP, m: head, col: K.eye, edge: false }, { p: irisP, m: head, col: K.iris, edge: false });
    top.push({ p: hiP, m: head, col: K.white, edge: false }, { p: hi2P, m: head, col: K.white, edge: false }, { p: lashP, m: head, col: K.lash, edge: false });
  },
};
// rigFace：腮红、眼睛、嘴（、虎牙、眼泪）。参数在部件表的 face 里
function rigFace(k) {
  const { S, md, turn, look, lookY, blink, mouth, tt, B, paint } = k, F = S.face, K = S.K, cut = S.cut, head = B[F.bone || 'faceM'], low = [], top = [];
  const lidFrac = md.eye && md.eye !== 'open' ? 1 : clamp(lerp(md.lid || 0, 1, blink), 0, 1);
  const qt = rQ(turn), ql = rQ(look), qy = rQ(lookY, 2), qf = rQ(lidFrac);
  for (const sd of [-1, 1]) {
    const near = sd * turn > 0, far = near ? 1 - Math.abs(turn) * F.far : 1, ex = sd * F.ex * (near ? 1 - Math.abs(turn) * .15 : 1) + turn * F.turnX, ey = F.ey;
    const es = (md.es || 1) * (md.brow && md.brow[2] ? 1 + sd * .08 : 1);
    // 腮红
    const bs = md.blush, Bl = F.blush;
    low.push({ p: rigMemo(S, ['b', sd, qt, bs].join('|'), () => cut(ellPts(ex + sd * Bl.dx + turn * Bl.turn, Bl.y + (bs > 1.4 ? Bl.bump : 0), Bl.rx * bs * far, Bl.ry * Math.sqrt(bs), 14), 80 + sd, 4, .3)), m: head, col: K.blush, edge: false });
    const key = ['e', md.eye || 'open', sd, qt, ql, qy, qf, es, md.iris || 1, md.lower || 0, md.lidTilt || 0].join('|');
    RIG_EYES[F.style]({ S, F, K, sd, ex, ey, far, es, md, lidFrac, look, lookY, head, low, top, key, cut });
  }
  // 嘴：一小片会变形的纸（S.mouth(type, open) → [轮廓, 颜色键, 舌头轮廓?]）
  const mo = rQ(mouth), [mp, mc, tongue] = rigMemo(S, ['m', md.mouth, mo].join('|'), () => { const [pts, col, tg] = S.mouth(md.mouth, mo); return [cut(pts, 95, 2.4, .15, false), col, tg ? cut(tg, 96, 2, .1) : null]; });
  const mm = rTR(head, turn * F.mouthTurn + (md.puff ? -2 : 0), F.mouthY);
  low.push({ p: mp, m: mm, col: K[mc] || mc, edge: false });
  if (tongue) top.push({ p: tongue, m: mm, col: K.tongue, edge: false });
  // 虎牙：嘴角一颗白色小三角（mood.fang；位置在 face.fang）
  if (md.fang && F.fang) top.push({ p: rigMemo(S, 'fang', () => cut([[-2.2, 0], [2.2, 0], [0, 4.2]], 99, 2, .05, false)), m: rTR(mm, F.fang[0] + (md.mouth === 'smile' || md.mouth === 'laugh' ? -1.5 : 0), F.fang[1]), col: K.white, edge: false });
  paint(low, RIG_SH.tiny, false, 1, true);
  paint(top, RIG_SH.tiny, false, 1, true);
  // 眼泪：眼下两道半透明的纸条 + 往外落的小纸片（mood.tears；部件 drop、颜色 tear）
  if (md.tears) {
    const items = [], drops = [];
    for (const sd of [-1, 1]) {
      const ex = sd * F.ex + turn * F.turnX;
      items.push({ p: rigMemo(S, ['t', sd, rQ(turn)].join('|'), () => cut(rStroke([[ex + sd * 2, -38], [ex + sd * 4, -24], [ex + sd * 5, -10]], u => 3 + 2.5 * u), 97 + sd, 3, .2, false)), m: head, col: K.tear, edge: false });
      for (let j = 0; j < 2; j++) { const u = (tt * 1.4 + j * .5 + (sd > 0 ? .23 : 0)) % 1;
        drops.push({ p: S.G.drop, m: rTR(head, ex + sd * (8 + u * 26), -12 + u * 24 + u * u * 40, u * 2 * sd, 1 - u * .5, 1 - u * .5), col: K.tear }); }
    }
    paint(items, RIG_SH.tiny, false, .85, true);
    paint(drops, RIG_SH.tiny, false, .9, true);
  }
}
// rigHmph：「哼」气团（mood.hmph）：骨头 hmph 上一片白纸 + 一个「哼」字。部件表里写 { when: k => k.md.hmph, call: rigHmph }
function rigHmph(k) { const hm = k.B.hmph; k.paint([{ p: k.G.puffCloud, m: hm, col: k.K.white }], RIG_SH.mid);
  k.c.save(); k.c.transform(hm[0], hm[1], hm[2], hm[3], hm[4], hm[5]); zh(k.c, '哼', 0, 4.5, { size: 13, align: 'center', color: P.ink, qcRule: 'decor', touch: true }); k.c.restore(); }
// rigBrows：两小片细纸（压在刘海上，演不高兴/得意）。md.brow = [上移, 内端下压角, 一高一低]
function rigBrows(k) {
  const { S, md, turn, B, paint } = k, F = S.face, Bw = F.brow, th = Bw.th, [dy, ang, asym] = md.brow || [0, 0], items = [], head = B[Bw.bone || 'browM'];
  for (const sd of [-1, 1]) {
    const far = sd * turn > 0 ? 1 - Math.abs(turn) * .2 : 1, cx = sd * Bw.x * far + turn * F.turnX, cy = Bw.y - dy - (asym ? sd * 3.5 : 0), len = Bw.len * far;
    const a = asym ? (sd > 0 ? -.3 : .25) : -sd * ang;
    const p = rigMemo(S, ['r', sd, rQ(len, 10)].join('|'), () => S.cut([[-sd * len, -th[0]], [sd * len * .4, -th[1]], [sd * len, -th[2]], [sd * len * .4, th[3]], [-sd * len, th[4]]], Bw.seed + sd, 3, .15, false));
    items.push({ p, m: rTR(head, cx, cy, a), col: S.K.brow, edge: false });
  }
  paint(items, RIG_SH.tiny, false, 1, true);
}

// ===================== 手臂 =====================
// 姿势里的手臂 [a 上臂从下垂往 +x 摆的角, b 前臂相对上臂再摆的角, 手型, 标记（各角色自定：压在书上/画在头发外面）, 上臂拉长, 前臂拉长]
// 部件表 arm = { parent 挂在哪根骨头, shoulder [x, y], upper 上臂长, fore 前臂长（0 = 手直接画在前臂坐标里）, mirrorHand 左手镜像,
//               tips { 手型: 指尖点 }, hands { 手型: 部件名 | null } }
function rigArm(k, sd, spec) {
  const A = k.S.arm, [a, b, hand, flag, ku = 1, kf = 1] = spec, K = k.ps.armLen || 1;
  const u = rTR(k.B[A.parent], sd * A.shoulder[0], A.shoulder[1] - (k.ps.shrug || 0), -a, K, K);
  const l = rTR(u, 0, A.upper * ku, -b);
  const hm = A.fore ? rTR(l, 0, A.fore * kf, 0, A.mirrorHand ? sd : 1, 1) : l;
  return { sd, u, l, hm, uD: rTR(u, 0, 0, 0, 1, ku), lD: rTR(l, 0, 0, 0, 1, kf), hand, flag, tip: rApply(hm, A.tips[hand]) };
}

// ===================== 主函数 =====================
// drawRig(c, S, o)：S 部件表，o 同 drawPatchouli 的参数，另加 light（见上）和 track（弹簧驱动：t → 锚点 [x, y]，调用方坐标）。
// 返回 S.anchors(k) 给出的锚点。
function drawRig(c, S, o = {}) {
  const { x = 0, y = 0, h = S.h, facing = 1, tilt = 0, mouth = 0, blink = 0, t = 0 } = o;
  const pose = S.poseAlias[o.pose] || o.pose || 'stand', moodName = S.moodAlias[o.mood] || o.mood || 'normal';
  const md = S.moods[moodName] || S.moods.normal, tt = twos(t + CLOCK0), s = h / S.height;   // CLOCK0：全片时钟（core.js），交接处待机动作连续
  const g = o.gesture == null ? S.idleGesture(tt) : clamp(o.gesture, 0, 1);
  const ps = S.pose(pose, g, tt);
  const k = { c, o, S, G: S.G, K: S.K, x, y, h, s, facing, pose, mood: moodName, md, ps, g, t, tt, tilt, mouth, blink, B: {}, track: typeof o.track === 'function' ? o.track : null, lags: {} };
  // 头的朝向：脸侧开、眼珠、低头
  k.turn = clamp(!ps.keepTurn && md.turn !== undefined ? md.turn : ps.turn || 0, -1, 1);
  k.look = clamp(o.look !== undefined ? o.look : (md.look !== undefined ? md.look : ps.look || 0), -1, 1);
  k.lookY = md.lookY !== undefined ? md.lookY : ps.lookY || 0;
  const hs = S.headSway;
  k.hr = (ps.hr || 0) + (ps.noChin ? 0 : md.chin || 0) + (md.tilt || 0) + tilt + hs[0] * Math.sin(tt * hs[1] + hs[2]);
  if (S.vars) S.vars(k);
  // 骨骼：按表的顺序求矩阵。字段可以是常数，也可以是 (k, sd) => 值
  const B = k.B; B.anchor = rTR(R_I, x, y, 0, facing * s, s);
  for (const b of S.bones) {
    if (b.arms) { k.AB = rigArm(k, -1, ps.back); k.AF = rigArm(k, 1, ps.front); continue; }
    if (b.when && !b.when(k)) continue;
    for (const sd of b.sides ? [-1, 1] : [1]) {
      const v = f => typeof f === 'function' ? f(k, sd) : f, name = b.sides ? b.name + (sd < 0 ? 'L' : 'R') : b.name;
      if (b.m) { B[name] = b.m(k, sd); continue; }
      let M = B[v(b.parent) || 'anchor'];
      const loc = v(b.local); if (loc) M = rMul(M, loc);
      const sh = v(b.shear); if (sh) M = rMul(M, [1, 0, sh, 1, 0, 0]);
      let rot = v(b.rot) || 0; const sw = v(b.sway); if (sw) rot += sw[0] * Math.sin(tt * sw[1] + sw[2]);
      if (b.spring && k.track) rot += rigSpringRot(k, v(b.spring), sd);
      const at = v(b.at), sc = v(b.scale), pv = v(b.pivot);
      if (pv) { M = rPivot(M, pv[0], pv[1], rot); if (at || sc) M = rTR(M, at ? at[0] : 0, at ? at[1] : 0, 0, sc ? sc[0] : 1, sc ? sc[1] : 1); }
      else if (at || sc || rot) M = rTR(M, at ? at[0] : 0, at ? at[1] : 0, rot, sc ? sc[0] : 1, sc ? sc[1] : 1);
      B[name] = M;
    }
  }
  // 画的环境：投影随 s 略放大，边线约 1px
  const sk = Math.sqrt(clamp(s, .4, 3)), T0 = c.getTransform(), dev = Math.hypot(T0.a, T0.b) || 1;
  let pat = null;
  try { pat = c.createPattern(PAPER_GRAIN, 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.round(x), Math.round(y)])); } catch (e) { pat = null; }
  const env = { sk: sk * dev * (1 + .08 * Math.sin(tt * .8)), lw: 1 / (s * dev), pat, L: rigLight(o.light) };
  k.env = env; k.paint = (items, sh, gr, al, flat) => rigPaint(c, items, sh, env, gr, al, flat);
  // 图层：按表的顺序画
  let clips = 0;
  const col = (cc, A) => typeof cc === 'function' ? cc(k, A) : cc[0] === '#' ? cc : S.K[cc];
  const bone = (bn, A) => typeof bn === 'function' ? bn(k, A) : A && A[bn] ? A[bn] : B[bn];
  const part = (pn, A) => typeof pn === 'function' ? pn(k, A) : pn === '@hand' ? (S.arm.hands[A.hand] ? S.G[S.arm.hands[A.hand]] : null) : S.G[pn];
  const push = (out, sp, A) => { if (!Array.isArray(sp)) { out.push(sp); return; } const [pn, bn, cc, edge] = sp, p = part(pn, A); if (!p) return; const m = bone(bn, A), cl = col(cc, A);
    if (Array.isArray(p)) for (const q of p) out.push({ p: q, m, col: cl, edge }); else out.push({ p, m, col: cl, edge }); };
  const above = bn => { const cp = new Path2D(); cp.addPath(polyPath(rectPts(-3000, -3000, 6000, 3000)), new DOMMatrix(B[bn])); return cp; };
  for (const L of S.layers) {
    if (L.when && !L.when(k)) continue;
    if (L.clipOpen) { c.save(); c.clip(above(L.clipOpen)); clips++; continue; }
    if (L.clipClose) { if (clips) { c.restore(); clips--; } continue; }
    if (L.call) { L.call === 'face' ? rigFace(k) : L.call === 'brows' ? rigBrows(k) : L.call(k); continue; }
    const items = [];
    if (L.arms) {
      const arms = [k.AB, k.AF].filter(A => L.arms === 'all' || L.arms(A));
      if (L.order === 'arm') { for (const A of arms) for (const sp of L.items) push(items, sp, A); }
      else for (const sp of L.items) for (const A of arms) push(items, sp, A);
    } else for (const sp of (typeof L.items === 'function' ? L.items(k) : L.items)) push(items, sp, null);
    if (L.clip) { c.save(); c.clip(above(L.clip)); }
    k.paint(items, L.sh ? RIG_SH[L.sh] : null, L.gr !== false, L.al ?? 1, L.flat);
    if (L.clip) c.restore();
  }
  while (clips--) c.restore();
  return S.anchors(k);
}
