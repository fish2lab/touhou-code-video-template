// ice-slabs · 半透明冰板一层层叠高，再一块块化成水滴
// 出处：第 2 集 巩固段（2/src/scenes/3-consolidate.js:157-300 冰层 s3Stack/s3IceSlab、527-540 水桶 s3Bucket）
// 好在哪：5 块半透明淡蓝冰板在 0.85 秒间隔里依次落下，每块都落地压扁到 78% 厚再弹回（0.5 秒衰减），脚下荡开一圈 0.6 秒的水纹线；
//   板与板的边缘错开 ±30 像素，下一块的硬边投影落在上一块的顶面上，半透明让你看见每层的叠法。融化时从最上面开始，
//   每块 0.5 秒缩成一滴，0.55 秒画弧落进桶里。冰的亮只靠留白和每块两条白色手抖线，没有渐变、没有高光。
// 复用：在 scene 里调用 FX 注册的 draw 逻辑即可；把 FX_ICE.n 换成要叠的层数，FX_ICE.drop / FX_ICE.melt 的 t0 和 gap 换成台词时间，
//   FX_ICE.bucket 放水滴的去处。想复用成别的「一层层积累」（卷子、书、钞票），只换 fxIceSlab 里的颜色和厚度。
// 分叉：1) 层数与厚度 n、th（学习：5 层冰；存钱：8 枚硬币）；2) 颜色 side/top（冰蓝换成纸黄做成一摞稿纸）；
//   3) 终点 bucket（水桶换成瓶子、存钱罐）。

const FX_ICE = {
  n: 5, th: 46,                                   // 层数、每层厚度（像素）
  cx: 1000, cy: 810, hw: 380, hh: 122, shrink: 12, // 底板中心、半宽、半深（斜俯视下压扁）、每上一层缩小量
  off: [[0, 0], [30, 9], [-36, -7], [26, 7], [-18, -5]],   // 每层相对底板错开的位置
  drop: { t0: .6, gap: .85, fall: .45, h: 380 },   // 第一块落下的时刻、间隔、下落时长、起落高度
  melt: { t0: 5.7, gap: .55, shrink: .5, fly: .55 },       // 开始融化、每块间隔、缩成水滴、飞进桶
  bucket: { x: 1625, y: 735 },                     // 桶口中心
  cirno: { x: 330, y: 900, h: 480 },
  mat: [[330, 300], [1590, 300], [1810, 990], [110, 990]],
  col: { side: '#7da9c8', rim: '#5d8db2', top: '#e3f0f7', frost: '#f4fafd', mat: '#ece5d6' },
};

// 缓动：先蓄后发——下落用 easeIn；落地的压扁是衰减余弦（落地瞬间最扁，回弹过冲）
const fxIceU = (t, t0, d) => clamp((t - t0) / d, 0, 1);
const fxIceSquash = s => s < 0 ? 0 : Math.exp(-s * 7) * Math.cos(s * 20);   // s = 落地后的秒数

function fxIceCenter(i) { const F = FX_ICE; return [F.cx + F.off[i][0], F.cy - i * F.th + F.off[i][1]]; }   // 第 i 块底面中心

// 一块冰板：底面中心 (x, y)，厚 th，宽深缩放 k，旋转 rot
function fxIceSlab(c, i, x, y, th, k, rot, t) {
  const F = FX_ICE, K = F.col, hw = (F.hw - i * F.shrink) * k, hh = (F.hh - i * F.shrink * .35) * k;
  if (hw < 3) return;
  c.save(); c.translate(x, y); c.rotate(rot); c.translate(-x, -y);
  const top = rectPts(x - hw, y - th - hh, hw * 2, hh * 2, Math.min(44, hh)), q = top.map(([a, b]) => [a, b + th]);
  // 厚度：顶面每条边扫到底面，取并集，一次填色（边的方向统一成正面积，避免 nonzero 相消）
  const side = new Path2D();
  for (let s = 0; s < top.length; s++) { const a = top[s], b = top[(s + 1) % top.length], quad = [a, b, [b[0], b[1] + th], [a[0], a[1] + th]];
    const area = quad.reduce((m, p, j) => { const n = quad[(j + 1) % 4]; return m + p[0] * n[1] - n[0] * p[1]; }, 0);
    side.addPath(polyPath(area < 0 ? quad.slice().reverse() : quad)); }
  c.save(); c.globalAlpha *= .62; c.shadowColor = 'rgba(30,20,35,.24)'; c.shadowOffsetX = 7; c.shadowOffsetY = 8; c.shadowBlur = 0;
  c.fillStyle = K.side; c.fill(side); c.restore();
  cutPaper(c, top, K.top, { seed: 710 + i, step: 18, shadow: false, grain: .05, al: .62 });
  // 厚度边（顶面外框）和底边，加每块两条白色手抖线
  rline(c, top, { w: 3, color: K.rim, close: true, seed: 720 + i, amp: .8, al: .85, t });
  rline(c, q.slice(Math.floor(q.length * .1), Math.floor(q.length * .4)), { w: 2.2, color: K.rim, seed: 730 + i, amp: .6, al: .55, t });
  const u = (hash(i, 77) - .5) * 80;
  rline(c, [[x - hw * .55 + u, y - th - hh * .45], [x - hw * .3 + u, y - th - hh * .72]], { w: 4, color: K.frost, seed: 740 + i, amp: 1.2, al: .95, t });
  rline(c, [[x - hw * .2 + u, y - th + hh * .6], [x + hw * .08 + u, y - th + hh * .6]], { w: 3, color: K.frost, seed: 750 + i, amp: 1, al: .9, t });
  c.restore();
}

// 一滴水（尖朝上），用剪纸画
function fxIceDrop(c, x, y, r, squash = 0) {
  if (r < 1) return;
  const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, tip = Math.pow(Math.max(0, -Math.sin(a)), 3);
    pts.push([x + Math.cos(a) * r * (1 - tip * .8) * (1 + squash * .5), y + Math.sin(a) * r * (1 + tip * 1.1) * (1 - squash * .5)]); }
  cutPaper(c, pts, FX_ICE.col.side, { seed: 760, step: 8, blur: 0, sx: 3, sy: 4, grain: .04 });
  rline(c, [[x - r * .35, y - r * .1], [x - r * .3, y + r * .35]], { w: 2.5, color: FX_ICE.col.frost, amp: .3 });
}

function fxIceBucket(c, t, ripple) {
  const [x, y] = [FX_ICE.bucket.x, FX_ICE.bucket.y], hoop = mix(P.g3, P.ink, .2), body = mix(P.shelf2, P.paper2, .28);
  cutPaper(c, [[x - 78, y], [x + 78, y], [x + 62, y + 168], [x - 62, y + 168]], body, { seed: 770, step: 14, blur: 0, sx: 5, sy: 6 });
  for (const yy of [26, 128]) { const hw = 78 - yy * 16 / 168; rline(c, [[x - hw, y + yy], [x + hw, y + yy]], { w: 8, color: hoop, seed: 771 + yy, amp: .4 }); }
  for (const dx of [-34, 8, 44]) rline(c, [[x + dx * 1.1, y + 6], [x + dx * .85, y + 162]], { w: 1.6, color: alpha(P.ink, .35), seed: 780 + dx, amp: .4 });
  c.fillStyle = FX_ICE.col.side; c.beginPath(); c.ellipse(x, y + 2, 76, 15, 0, 0, TAU); c.fill();
  if (ripple > 0) rline(c, ellPts(x, y + 2, 20 + 50 * ripple, 4 + 10 * ripple, 24), { w: 3, color: FX_ICE.col.frost, close: true, seed: 790, amp: .5, al: 1 - ripple, t });
  rline(c, ellPts(x, y + 2, 78, 16, 28), { w: 4, color: hoop, close: true, seed: 791, amp: .4 });
}

function fxIceDraw(c, t) {
  const F = FX_ICE, K = F.col, D = F.drop, M = F.melt, N = F.n;
  desk(c);
  cutPaper(c, F.mat, K.mat, { seed: 700, step: 60, blur: 14, sx: 0, sy: 8, grain: .12 });
  const [bx, by] = [F.bucket.x, F.bucket.y];

  // ---- 每块冰板的时间状态 ----
  const st = i => {
    const tl = D.t0 + i * D.gap, tm = M.t0 + (N - 1 - i) * M.gap;
    return { tl, tm, land: tl + D.fall, fall: fxIceU(t, tl, D.fall), melt: fxIceU(t, tm, M.shrink), fly: fxIceU(t, tm + M.shrink, M.fly) };
  };
  // 桌面影子：底板的硬边椭圆，随整摞最大宽度
  const base = st(0), shadowK = fxIceU(t, base.land - .05, .2) * (1 - st(0).melt);
  if (shadowK > 0.01) { c.save(); c.globalAlpha *= .22 * shadowK; c.fillStyle = '#2a1c16'; c.beginPath(); c.ellipse(F.cx + 24, F.cy + 24, F.hw + 18, F.hh + 8, 0, 0, TAU); c.fill(); c.restore(); }

  // 瞄准影：下一块正在落时，目标顶面上一团越来越清楚的影子
  // 水纹线：落地后 0.6 秒内向外荡开，画在板的底面那一层
  for (let i = 0; i < N; i++) {
    const s = st(i), age = t - s.land;
    if (age > 0 && age < .6 && s.melt <= 0) { const v = age / .6, [x, y] = fxIceCenter(i), hw = F.hw - i * F.shrink, hh = F.hh - i * F.shrink * .35;
      rline(c, ellPts(x, y + 4, hw * (1.02 + .22 * easeOut(v)), hh * (1.04 + .24 * easeOut(v)), 40), { w: 4, color: K.frost, close: true, seed: 800 + i, amp: 1, al: (1 - v) * .95, p: 1, t }); }
    if (s.fall > 0 && s.fall < 1) { const [x, y] = fxIceCenter(i), hw = F.hw - i * F.shrink; c.save(); c.globalAlpha *= .13 * s.fall * s.fall; c.fillStyle = '#2a1c16';
      c.beginPath(); c.ellipse(x + 8, y - F.th * 0 - 2, hw * .9, (F.hh - i * F.shrink * .35) * .9, 0, 0, TAU); c.fill(); c.restore(); }
  }

  // ---- 冰板：从下往上画 ----
  const drops = [];
  for (let i = 0; i < N; i++) {
    const s = st(i); if (s.fall <= 0 || s.fly > 0) { if (s.fly > 0 && s.fly < 1) drops.push([i, s]); continue; }
    let [x, y] = fxIceCenter(i), th = F.th, k = 1, rot = 0;
    if (s.fall < 1) { const e = easeIn(s.fall); y -= (1 - e) * D.h; rot = (1 - e) * .05 * (i % 2 ? 1 : -1); x += (1 - e) * 40 * (i % 2 ? -1 : 1); }
    else { const q = fxIceSquash(t - s.land); th = F.th * (1 - .22 * q); }   // 落地：压扁到 78%，回弹过冲
    if (s.melt > 0) { const m = easeIn(s.melt); th = F.th * lerp(1, .45, m); k = 1 - m; y += F.th - th; y -= 0; }
    fxIceSlab(c, i, x, y, th, k, rot, t);
    if (s.melt > .55 && s.melt < 1) drops.push([i, s]);       // 缩到一半，水滴在板心长出来
  }
  // 板压扁时上面的板被带着往下走一点：用整摞的最低点补偿——此处每块独立计算，不再叠加（上方板在自己落地之后才存在）

  fxIceBucket(c, t, 0);
  // ---- 水滴：板心长出 → 画弧飞到桶口 → 消失并荡一圈水纹 ----
  let ripple = 0;
  for (const [i, s] of drops) {
    const [x0, y0] = fxIceCenter(i), r = 30;
    if (s.fly <= 0) { fxIceDrop(c, x0, y0 - F.th * .5, r * sm(.55, 1, s.melt), 0); continue; }
    const u = s.fly, e = u * u * (3 - 2 * u) * .6 + u * .4, px = lerp(x0, bx, e), py = lerp(y0 - F.th * .5, by - 8, u * u) - Math.sin(u * Math.PI) * 190;
    fxIceDrop(c, px, py, r * (1 - .2 * u), u > .85 ? (u - .85) * 2 : 0);
  }
  // 桶口水纹（最近一滴入桶之后 0.5 秒）
  for (let i = 0; i < N; i++) { const a = t - (st(i).tm + M.shrink + M.fly); if (a > 0 && a < .5) ripple = Math.max(ripple, a / .5); }
  if (ripple > 0) rline(c, ellPts(bx, by + 2, 20 + 50 * ripple, 4 + 10 * ripple, 24), { w: 3, color: K.frost, close: true, seed: 792, amp: .5, al: 1 - ripple, t });

  // ---- 琪露诺：落板时指着，叠完得意，化的时候垮下来，最后站回原位 ----
  const C = F.cirno, lastLand = D.t0 + (N - 1) * D.gap + D.fall, endMelt = M.t0 + (N - 1) * M.gap + M.shrink + M.fly;
  let pose = 'stand', mood = 'normal', g = 0;
  if (t > D.t0 - .2 && t < lastLand + .5) { pose = 'point'; mood = 'happy'; g = .5 + .5 * Math.sin((t - D.t0) / D.gap * TAU - 1.2) ** 2; }
  else if (t >= lastLand + .5 && t < M.t0 - .1) { pose = 'proud'; mood = 'proud'; g = sm(lastLand + .5, lastLand + 1.1, t, easeOutBack) * .9; }
  else if (t >= M.t0 - .1 && t < endMelt + .2) { pose = 'slump'; mood = t > M.t0 + .6 ? 'cry' : 'surprised'; }
  drawCirno(c, { x: C.x, y: C.y, h: C.h, facing: 1, pose, mood, gesture: g, t });
}

FX.add({ id: 'ice-slabs', title: '半透明冰板叠层', src: '第 2 集 巩固段', dur: 10, bg: 'none', draw: fxIceDraw });
