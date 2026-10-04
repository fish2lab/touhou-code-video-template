'use strict';
// 画具：颜色、手绘线、字、背景、讲台布局。所有场景共用，场景文件不改这里（缺什么先写在自己文件里，汇报里提）。
// 画风第二版（docs/画风v2.md）：克制、高抽象、但不简单。整个画面是一本摊在深色木桌上的魔导书（spread），
// 旧纸、墨线、几级灰、一种帕秋莉紫；书页上用古书的纸机关讲事：转盘、立体书、拉条、图钉和线、剪纸层。
// 帕秋莉是贴在书页上的剪纸人偶（cutPaper）。字是霞鹜文楷手写体。

const P = {
  // 纸、墨、灰（主色）
  paper: '#ece5d6', paper2: '#e2d9c6', paperEdge: '#b9ab90', ink: '#221c26', ink2: '#4a4250', faint: '#b3aa9a',
  g1: '#cfc7b8', g2: '#8f887e', g3: '#57514b',
  // 夜：整页墨
  night: '#1d1a22', night2: '#26222c', night3: '#332e3a', shelf: '#3a3230', shelf2: '#4a403b', shelfDark: '#241f1e', lamp: '#e8cf9a',
  // 帕秋莉（剪纸用的彩纸，压暗、低饱和）
  hair: '#8676a8', hairDark: '#65588a', dress: '#ebe3e6', stripe: '#aea2c4', cap: '#f1ece4', moon: '#c9a24a', ribbonRed: '#ad4550', ribbonBlue: '#4f6b98', skin: '#f1e2d6', blush: '#dea3a3',
  // 强调色（一页最多一种）
  purple: '#6d5d8c', red: '#a8434a', green: '#5b7d5f', blue: '#4f6b8c', gold: '#c9a24a',
  // 旧键（第一版场景还在用，重做后删）
  sky: '#a9b8c4', sun: '#c9a24a', orange: '#b8794a', pink: '#c98f9c', teal: '#5b7d78', gray: '#8f887e',
};

// ===================== 几何 =====================
function ellPts(cx, cy, rx, ry, n = 48, rot = 0) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, x = rx * Math.cos(a), y = ry * Math.sin(a); p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return p; }
const circPts = (cx, cy, r, n = 48) => ellPts(cx, cy, r, r, n);
function rectPts(x, y, w, h, r = 0) {
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const p = [], arc = (cx, cy, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + k / 6 * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI); return p;
}
function starPts(x, y, r, n = 5, inner = .45, rot = 0) { const o = []; for (let k = 0; k < n * 2; k++) { const a = rot - Math.PI / 2 + k / (n * 2) * TAU, rr = k % 2 ? r * inner : r; o.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return o; }
function heartPts(x, y, s, n = 40) { const o = []; for (let k = 0; k < n; k++) { const a = k / n * TAU, u = Math.pow(Math.sin(a), 3), v = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16; o.push([x + s * u, y + s * v]); } return o; }
function pathLen(pts, close) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (close) L += Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]); return L; }
// resample：按弧长每 step 取一个点
function resample(pts, step = 6, close = false) {
  const q = close ? [...pts, pts[0]] : pts, out = [];
  for (let i = 1; i < q.length; i++) { const a = q[i - 1], b = q[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); }
  if (!close) out.push(q.at(-1).slice()); return out;
}
// spline：Catmull-Rom 过这些点（几个控制点画出顺滑曲线）
function spline(pts, step = 6, close = false) {
  if (pts.length < 3) return resample(pts, step, close);
  const n = pts.length, Pp = i => close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)], out = [], segs = close ? n : n - 1;
  for (let i = 0; i < segs; i++) { const p0 = Pp(i - 1), p1 = Pp(i), p2 = Pp(i + 1), p3 = Pp(i + 2), m = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3))); } }
  if (!close) out.push(pts.at(-1).slice()); return out;
}
// wobble：手绘的抖。seed 相同则形状相同；seed 加 tick(t) 就会按 8fps 换样子
function wobble(pts, seed = 1, amp = 1.6, freq = .035) {
  return pts.map((p, i) => [p[0] + amp * noise1(i * freq * 6 + seed * 3.1, seed), p[1] + amp * noise1(i * freq * 6 + seed * 7.7, seed + 9)]);
}
function polyPath(pts, close = true) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (close) p.closePath(); return p; }

// ===================== 手绘线和形状 =====================
// rline：一笔手绘线。o = { w 线宽, color, p 画出比例 0..1, close, amp 抖动幅度, seed, t（传入就会 8fps 抖）, smooth, cap, dash, al }
function rline(c, pts, o = {}) {
  const { w = 4, color = P.ink, p = 1, close = false, amp = 1.4, seed = 1, t = null, smooth = false, dash = null, al = 1 } = o;
  if (p <= 0 || pts.length < 2) return;
  let q = smooth ? spline(pts, 6, close) : resample(pts, 6, close);
  q = wobble(q, seed + (t === null ? 0 : tick(t)), amp);
  if (p < 1) { const L = pathLen(q), end = L * p; let acc = 0, k = 1; for (; k < q.length; k++) { const d = Math.hypot(q[k][0] - q[k - 1][0], q[k][1] - q[k - 1][1]); if (acc + d > end) { const u = (end - acc) / d; q = [...q.slice(0, k), [lerp(q[k - 1][0], q[k][0], u), lerp(q[k - 1][1], q[k][1], u)]]; break; } acc += d; } }
  c.save(); c.globalAlpha *= al; c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
  c.stroke(polyPath(q, close && p >= 1)); c.restore();
}
// rshape：填色 + 手绘描边。o = { fill, stroke(默认 P.ink，false 不描), w, seed, t, amp, smooth, al }
function rshape(c, pts, o = {}) {
  const { fill = null, stroke = P.ink, w = 4, seed = 1, t = null, amp = 1.2, smooth = false, al = 1 } = o;
  let q = smooth ? spline(pts, 6, true) : resample(pts, 6, true); q = wobble(q, seed + (t === null ? 0 : tick(t)), amp);
  const path = polyPath(q, true);
  c.save(); c.globalAlpha *= al;
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(path); }
  c.restore(); return path;
}
// hatch：在路径里画斜线阴影
function hatch(c, path, bbox, o = {}) {
  const { gap = 14, angle = -.8, color = P.ink, w = 2, al = .25, seed = 1, t = null } = o, [x, y, bw, bh] = bbox, R = Math.hypot(bw, bh);
  c.save(); c.clip(path); c.globalAlpha *= al; c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
  const cx = x + bw / 2, cy = y + bh / 2, ca = Math.cos(angle), sa = Math.sin(angle), s = seed + (t === null ? 0 : tick(t));
  for (let d = -R / 2; d < R / 2; d += gap) { const j = (hash(d | 0, s) - .5) * 3; c.beginPath(); c.moveTo(cx + ca * -R / 2 - sa * (d + j), cy + sa * -R / 2 + ca * (d + j)); c.lineTo(cx + ca * R / 2 - sa * (d - j), cy + sa * R / 2 + ca * (d - j)); c.stroke(); }
  c.restore();
}
// arrow：从 a 到 b 的手绘箭头（可弯：bend 为弯曲量）
function arrow(c, a, b, o = {}) {
  const { w = 5, color = P.ink, p = 1, bend = 0, head = 22, seed = 3, t = null } = o;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const pts = spline([a, [mx - dy / L * bend, my + dx / L * bend], b], 6);
  rline(c, pts, { w, color, p, seed, t });
  if (p >= .98) { const e = pts.at(-1), f = pts.at(-4) || pts[0], ang = Math.atan2(e[1] - f[1], e[0] - f[0]);
    rline(c, [[e[0] - Math.cos(ang - .45) * head, e[1] - Math.sin(ang - .45) * head], e, [e[0] - Math.cos(ang + .45) * head, e[1] - Math.sin(ang + .45) * head]], { w, color, seed: seed + 1, t }); }
}
function check(c, x, y, s, o = {}) { rline(c, [[x - s * .5, y], [x - s * .12, y + s * .38], [x + s * .55, y - s * .45]], { w: s * .14, color: P.green, ...o }); }
function cross(c, x, y, s, o = {}) { const p = o.p ?? 1; rline(c, [[x - s * .45, y - s * .45], [x + s * .45, y + s * .45]], { w: s * .14, color: P.red, ...o, p: clamp(p * 2, 0, 1) }); rline(c, [[x + s * .45, y - s * .45], [x - s * .45, y + s * .45]], { w: s * .14, color: P.red, ...o, p: clamp(p * 2 - 1, 0, 1), seed: 7 }); }
// sparkle：四角星闪光
function sparkle(c, x, y, r, o = {}) { const { color = '#fff6d8', al = 1, rot = 0 } = o; if (r <= 0) return; c.save(); c.globalAlpha *= al; c.fillStyle = color; c.fill(polyPath(starPts(x, y, r, 4, .28, rot))); c.restore(); }
// pop：以 (x, y) 为中心缩放 k 后执行 fn（弹出效果：k = easeOutBack(...)）
function pop(c, x, y, k, fn) { if (k <= .001) return; c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x, -y); fn(); c.restore(); }
// fade：以透明度 a 执行 fn
function fade(c, a, fn) { if (a <= .001) return; c.save(); c.globalAlpha *= clamp(a, 0, 1); fn(); c.restore(); }

// ===================== 字 =====================
// zh：手写楷体。o = { size=48, color, align='left'|'center'|'right', p=1（显示前 p 比例的字，逐字写出）, weight=400, outline（描边颜色）, ow 描边宽, base='alphabetic'|'middle', al }
function zh(c, text, x, y, o = {}) {
  const { size = 48, color = P.ink, align = 'left', p = 1, weight = 400, outline = null, ow = 8, base = 'alphabetic', al = 1 } = o;
  const chars = [...String(text)], n = p >= 1 ? chars.length : Math.floor(chars.length * clamp(p, 0, 1) + 1e-6), s = chars.slice(0, n).join('');
  if (!s) return;
  c.save(); c.globalAlpha *= al; c.font = `${weight} ${size}px ${ZH_STACK}`; c.textBaseline = base;
  // 对齐按全句宽度算，逐字写出时不跳位
  const full = c.measureText(chars.join('')).width, x0 = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x;
  c.textAlign = 'left';
  if (outline) { c.lineJoin = 'round'; c.strokeStyle = outline; c.lineWidth = ow; c.strokeText(s, x0, y); }
  c.fillStyle = color; c.fillText(s, x0, y); c.restore();
}
function zhWidth(c, text, size = 48, weight = 400) { c.save(); c.font = `${weight} ${size}px ${ZH_STACK}`; const w = c.measureText(text).width; c.restore(); return w; }
// wrapText：按宽度折行（中文逐字），返回行数组
function wrapText(c, text, maxW, size = 48) { const out = []; let cur = ''; for (const ch of String(text)) { if (ch === '\n') { out.push(cur); cur = ''; continue; } if (zhWidth(c, cur + ch, size) > maxW && cur) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
// writeP：从 t0 开始逐字写出的进度（每字 spc 秒）
const writeP = (tau, t0, text, spc = .07) => clamp((tau - t0) / Math.max(.01, [...String(text)].length * spc), 0, 1);

// ===================== 场景布景 =====================
// libraryBg：大图书馆夜景（远处书架、暖灯、飘着的尘光）。o = { dim 0..1 压暗, seed }
function libraryBg(c, t, o = {}) {
  const { dim = 0, seed = 3 } = o;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.night); g.addColorStop(1, P.night2); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 远处书架：三排，越远越暗
  for (let row = 0; row < 3; row++) {
    const y0 = 60 + row * 300, hh = 250, dark = mix(P.shelfDark, P.night, .35 + row * .05);
    c.fillStyle = dark; c.fillRect(0, y0 - 18, W, 18); c.fillRect(0, y0 + hh, W, 22);
    let x = -10; const r = rng(seed * 31 + row);
    while (x < W) { const bw = 18 + r() * 26, bh = hh * (.62 + r() * .36), col = ['#5b3a55', '#3d4a6b', '#6b4a3a', '#4a5a4a', '#5a3040', '#3a3a60', '#6a5a3a'][Math.floor(r() * 7)];
      c.fillStyle = mix(col, P.night, .45 + row * .08); c.fillRect(x, y0 + hh - bh, bw - 3, bh);
      if (r() < .5) { c.fillStyle = alpha('#e8c98a', .12); c.fillRect(x + 3, y0 + hh - bh + 12, bw - 9, 4); }
      x += bw + (r() < .08 ? 30 : 0); }
  }
  // 暖灯光晕
  const lg = c.createRadialGradient(W * .5, 120, 20, W * .5, 200, 900); lg.addColorStop(0, alpha(P.lamp, .22)); lg.addColorStop(1, alpha(P.lamp, 0)); c.fillStyle = lg; c.fillRect(0, 0, W, H);
  // 地板
  const fg = c.createLinearGradient(0, 930, 0, H); fg.addColorStop(0, '#2a1d2e'); fg.addColorStop(1, '#170f1f'); c.fillStyle = fg; c.fillRect(0, 930, W, H - 930);
  // 飘浮的尘光
  for (let k = 0; k < 40; k++) { const x = (hash(k, seed) * W + t * (8 + hash(k, 2) * 14)) % W, y = (hash(k, 5) * 900 - t * (5 + hash(k, 7) * 9) + 2000) % 900 + 40, a = .25 + .35 * Math.sin(t * 1.3 + k);
    c.fillStyle = alpha('#fff0c0', Math.max(0, a) * .6); c.beginPath(); c.arc(x, y, 1.5 + hash(k, 9) * 2.5, 0, TAU); c.fill(); }
  if (dim > 0) { c.fillStyle = alpha('#000', dim); c.fillRect(0, 0, W, H); }
}
// board：羊皮纸魔导书页（讲台右边的「黑板」）。返回内容区 { x, y, w, h }。o = { t, title, seed, color }
function board(c, x, y, w, h, o = {}) {
  const { t = null, title = null, seed = 11, color = P.paper } = o;
  c.save(); c.fillStyle = alpha('#000', .35); c.fill(polyPath(rectPts(x + 10, y + 14, w, h, 18))); c.restore();
  rshape(c, rectPts(x, y, w, h, 18), { fill: color, stroke: P.paperEdge, w: 6, seed, t, amp: 1 });
  c.save(); c.clip(polyPath(rectPts(x, y, w, h, 18)));
  const g = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * .3, x + w / 2, y + h / 2, Math.max(w, h) * .75); g.addColorStop(0, alpha(P.paper2, 0)); g.addColorStop(1, alpha(P.paperEdge, .45)); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.restore();
  // 四角的魔法花纹
  for (const [cx, cy, sx, sy] of [[x + 26, y + 26, 1, 1], [x + w - 26, y + 26, -1, 1], [x + 26, y + h - 26, 1, -1], [x + w - 26, y + h - 26, -1, -1]])
    rline(c, [[cx, cy + sy * 40], [cx, cy], [cx + sx * 40, cy]], { w: 3, color: P.paperEdge, seed: seed + cx, t });
  if (title) { zh(c, title, x + w / 2, y + 74, { size: 52, align: 'center', color: P.ink, weight: 400 }); rline(c, [[x + w / 2 - zhWidth(c, title, 52) / 2 - 20, y + 96], [x + w / 2 + zhWidth(c, title, 52) / 2 + 20, y + 96]], { w: 3, color: P.paperEdge, seed: seed + 5, t }); }
  return { x: x + 40, y: y + (title ? 120 : 40), w: w - 80, h: h - (title ? 160 : 80) };
}
// chapterTag：左上角章节签（「第一页 · 睡眠」）
function chapterTag(c, tau, text, o = {}) {
  const { t0 = 0, color = P.moon } = o, k = sm(t0, t0 + .5, tau, easeOutBack); if (k <= 0) return;
  const w = zhWidth(c, text, 40) + 70;
  c.save(); c.translate(lerp(-w, 0, k), 0);
  rshape(c, [[0, 36], [36 + w, 36], [w + 10, 70], [36 + w, 104], [0, 104]], { fill: P.ink, stroke: color, w: 3, seed: 21, t: tau });
  drawMoonIcon(c, 40, 70, 18, color);
  zh(c, text, 70, 84, { size: 40, color: P.paper });
  c.restore();
}
// crescentPts：月牙轮廓（外圆减去偏移的内圆），rot 旋转
function crescentPts(x, y, r, rot = 0, n = 96) {
  const ix = r * .45, iy = -r * .3, ir = r * .85, out = [], inn = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, px = Math.cos(a) * r, py = Math.sin(a) * r; if (Math.hypot(px - ix, py - iy) > ir) out.push(a); }
  // 外弧：找到不在内圆里的连续一段（从一个断点开始）
  let s0 = 0; for (let i = 0; i < out.length; i++) { const d = (out[(i + 1) % out.length] - out[i] + TAU) % TAU; if (d > TAU / n * 1.5) { s0 = (i + 1) % out.length; break; } }
  const arc = out.slice(s0).concat(out.slice(0, s0)), a0 = arc[0], a1 = arc[arc.length - 1];
  const P1 = [Math.cos(a1) * r, Math.sin(a1) * r], P0 = [Math.cos(a0) * r, Math.sin(a0) * r];
  let b0 = Math.atan2(P1[1] - iy, P1[0] - ix), b1 = Math.atan2(P0[1] - iy, P0[0] - ix); while (b1 < b0) b1 += TAU;
  // 内弧从 P1 回到 P0，走在外圆内部的那一边
  const mid = (b0 + b1) / 2, inside = Math.hypot(ix + Math.cos(mid) * ir, iy + Math.sin(mid) * ir) < r;
  if (!inside) { b1 -= TAU; }
  const pts = arc.map(a => [Math.cos(a) * r, Math.sin(a) * r]);
  for (let i = 1; i < 40; i++) { const b = lerp(b0, b1, i / 40); pts.push([ix + Math.cos(b) * ir, iy + Math.sin(b) * ir]); }
  const cr = Math.cos(rot), sr = Math.sin(rot); return pts.map(([u, v]) => [x + u * cr - v * sr, y + u * sr + v * cr]);
}
// drawMoonIcon：月牙（帕秋莉帽子上的那个）。rot 旋转
function drawMoonIcon(c, x, y, r, color = P.moon, rot = 0) { if (r <= .5) return; c.save(); c.fillStyle = color; c.fill(polyPath(crescentPts(x, y, r, rot))); c.restore(); }
// magicCircle：旋转的魔法阵（帕秋莉施法、转场）。o = { color, al, spin }
function magicCircle(c, x, y, r, t, o = {}) {
  const { color = P.moon, al = 1, spin = .3 } = o; if (r <= 1) return;
  c.save(); c.globalAlpha *= al; c.translate(x, y); c.strokeStyle = color; c.lineWidth = 3;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, r * .86, 0, TAU); c.stroke();
  c.rotate(t * spin); c.beginPath(); for (let k = 0; k <= 5; k++) { const a = k * 2 * TAU / 5 - Math.PI / 2; k ? c.lineTo(Math.cos(a) * r * .86, Math.sin(a) * r * .86) : c.moveTo(Math.cos(a) * r * .86, Math.sin(a) * r * .86); } c.stroke();
  c.rotate(-t * spin * 2); c.font = `${r * .1}px serif`; c.fillStyle = color; c.textAlign = 'center';
  const runes = '日月火水木金土☾✦◇'; for (let k = 0; k < 20; k++) { c.save(); c.rotate(k / 20 * TAU); c.fillText(runes[k % runes.length], 0, -r * .9); c.restore(); }
  c.restore();
}
// bubble：对话气泡/便签。tail = [x, y] 尾巴指向点（可空）
function bubble(c, x, y, w, h, o = {}) {
  const { tail = null, fill = '#fff', stroke = P.ink, t = null, seed = 31, w: lw = 4 } = o;
  const pts = rectPts(x, y, w, h, Math.min(28, h / 3));
  const bx = tail && clamp(tail[0], x + 40, x + w - 40), by = tail && (tail[1] > y + h ? y + h : y);
  if (tail) rshape(c, [[bx - 22, by], tail, [bx + 22, by]], { fill, stroke, w: lw, seed: seed + 1, t });
  rshape(c, pts, { fill, stroke, w: lw, seed, t });
  // 盖住气泡边框和尾巴相接的那一段，让尾巴和气泡连成一体
  if (tail) { c.save(); c.strokeStyle = fill; c.lineWidth = lw + 3; c.beginPath(); c.moveTo(bx - 17, by); c.lineTo(bx + 17, by); c.stroke(); c.restore(); }
}

// ===================== 讲台布局 =====================
// 标准讲课画面：帕秋莉站左边，右边一块魔导书页当黑板，字幕在最下方。场景可以不用这个布局。
const STAGE = {
  char: { x: 360, y: 1040, h: 860 },          // 帕秋莉脚底中心和身高
  board: { x: 700, y: 70, w: 1170, h: 790 },   // 黑板（魔导书页）
  sub: { y: 990 },                             // 字幕基线（film.js 画）
};
// blinkAt：自动眨眼。返回 0..1（1 = 闭眼）
function blinkAt(t, seed = 1) { const period = 3.2 + hash(1, seed) * 1.5, u = ((t + CLOCK0 + hash(2, seed) * 3) % period); return u < .12 ? Math.sin(u / .12 * Math.PI) : 0; }
// stageChar：在讲台位置画帕秋莉，嘴型、表情、眨眼自动从当前台词取。o 覆盖 drawPatchouli 的参数
function stageChar(c, tau, L, o = {}) {
  drawPatchouli(c, { x: STAGE.char.x, y: STAGE.char.y, h: STAGE.char.h, facing: 1, pose: 'lecture', mood: (L && L.mood) || 'normal', mouth: (L && L.mouth) || 0, blink: blinkAt(tau), t: tau, ...o });
}

// ===================== 第二版画具 =====================
// 纸纹：一张 256² 的细纤维纹理（载入时生成一次，确定性的），cutPaper 和 paperBg 叠在上面
const PAPER_GRAIN = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rng(77);
  for (let k = 0; k < 900; k++) { const x = r() * 256, y = r() * 256, a = r() * TAU, l = 2 + r() * 9; g.strokeStyle = r() < .5 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)'; g.lineWidth = .4 + r() * .6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let k = 0; k < 2500; k++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.3)'; g.fillRect(r() * 256, r() * 256, 1, 1); }
  return cv; })();
function grain(c, path, al = .08) { c.save(); c.clip(path); c.globalAlpha *= al; c.fillStyle = c.createPattern(PAPER_GRAIN, 'repeat'); c.fillRect(-4000, -4000, 8000, 8000); c.restore(); }
// scissor：把轮廓变成剪刀剪出来的边——每 step 像素一段直线，段与段之间有细小的折角
function scissor(pts, seed = 1, step = 12, amp = .9) {
  const q = resample(pts, 3, true), out = []; let acc = 0, k = 0;
  for (let i = 0; i < q.length; i++) { if (i && (acc += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1])) < step) continue; acc = 0; k++;
    const a = q[(i + 1) % q.length], b = q[(i - 1 + q.length) % q.length], tx = a[0] - b[0], ty = a[1] - b[1], L = Math.hypot(tx, ty) || 1, j = (hash(k, seed) - .5) * 2 * amp;
    out.push([q[i][0] - ty / L * j, q[i][1] + tx / L * j]); }
  return out;
}
// cutPaper：一片剪纸。pts 是轮廓（闭合），o = { seed, step 剪刀段长, shadow 投影（默认有）, sx/sy 投影偏移, blur, grain 纸纹浓度, edge 剪口亮边, al }
// 返回 Path2D，方便在里面再裁剪、贴纸条。
function cutPaper(c, pts, color, o = {}) {
  const { seed = 1, step = 12, shadow = true, sx = 2.5, sy = 3.5, blur = 5, grain: gr = .1, edge = true, al = 1, smooth = false } = o;
  const path = polyPath(scissor(smooth ? spline(pts, 6, true) : pts, seed, step), true);
  c.save(); c.globalAlpha *= al;
  if (shadow) { c.save(); c.shadowColor = 'rgba(30,20,35,.30)'; c.shadowBlur = blur; c.shadowOffsetX = sx; c.shadowOffsetY = sy; c.fillStyle = color; c.fill(path); c.restore(); }
  c.fillStyle = color; c.fill(path);
  if (gr) grain(c, path, gr);
  if (edge) { c.strokeStyle = alpha(mix(color, '#ffffff', .45), .55); c.lineWidth = 1; c.stroke(path); }
  c.restore(); return path;
}
// paperBg：整页纸（纸纹 + 极淡横格 + 四周略暗），o = { color, lines 横格, dark 夜页（整页墨）}
function paperBg(c, o = {}) {
  const { color = o.dark ? P.night : P.paper, lines = !o.dark } = o, full = polyPath(rectPts(0, 0, W, H));
  c.fillStyle = color; c.fillRect(0, 0, W, H); grain(c, full, o.dark ? .06 : .12);
  if (lines) { c.save(); c.strokeStyle = alpha(P.ink, .045); c.lineWidth = 1; for (let y = 120; y < H; y += 54) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); } c.restore(); }
  const v = c.createRadialGradient(CX, CY, H * .45, CX, CY, W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(40,30,20,${o.dark ? .35 : .06})`); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
// handFrame：手画的外框（整片的「画框」）。film.js 每帧最后画
function handFrame(c, t, o = {}) { const { color = P.ink, w = 7, inset = 14 } = o;
  rline(c, rectPts(inset, inset, W - inset * 2, H - inset * 2), { w, color, close: true, seed: 901, t, amp: 1.6 }); }
// caption：左上角展签（白底黑框，手写字逐字写出）。t0 出现，t1 收起（可省）
function caption(c, text, tau, t0 = 0, o = {}) {
  const { t1 = Infinity, size = 40 } = o, k = Math.min(sm(t0, t0 + .25, tau), 1 - sm(t1, t1 + .2, tau)); if (k <= 0) return;
  const w = zhWidth(c, text, size) + 44, h = size + 30, x = 40, y = 40;
  c.save(); c.globalAlpha *= k;
  rshape(c, rectPts(x, y, w, h), { fill: '#f6f2ea', stroke: P.ink, w: 3.5, seed: 911, t: tau, amp: .8 });
  zh(c, text, x + 22, y + h / 2 + size * .36, { size, color: P.ink, p: writeP(tau, t0 + .1, text, .06) });
  c.restore();
}

const CHALK = '#e9e4d6';   // 粉笔色
// 黑板：木框（剪纸）+ 石板（暗绿黑），返回石板内区 { x, y, w, h }。上面的字用粉笔色 CHALK
function chalkboard(c, x, y, w, h, t, o = {}) {
  const { legs = true } = o;
  if (legs) { cutPaper(c, [[x + 60, y + h], [x + 90, y + h], [x + 40, y + h + 170], [x + 14, y + h + 170]], '#6a4a38', { seed: 991 }); cutPaper(c, [[x + w - 90, y + h], [x + w - 60, y + h], [x + w - 14, y + h + 170], [x + w - 40, y + h + 170]], '#6a4a38', { seed: 992 }); }
  cutPaper(c, rectPts(x - 18, y - 18, w + 36, h + 36, 6), '#7a5640', { seed: 993, step: 24 });
  cutPaper(c, rectPts(x, y, w, h, 2), '#2b3430', { seed: 994, step: 40, shadow: false, grain: .16 });
  // 擦过的粉笔灰
  c.save(); c.globalAlpha *= .025; c.strokeStyle = CHALK; c.lineWidth = 60; c.lineCap = 'round'; const r = rng(995);
  for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x + 60 + r() * (w - 200), y + 50 + r() * (h - 100)); c.lineTo(x + 160 + r() * (w - 200), y + 40 + r() * (h - 80)); c.stroke(); } c.restore();
  return { x: x + 36, y: y + 30, w: w - 72, h: h - 60 };
}
// chalk：粉笔字（手写体、略透、边缘粗糙）
function chalk(c, text, x, y, o = {}) { zh(c, text, x, y, { color: CHALK, ...o, al: (o.al ?? 1) * .92 }); }
// ===================== 魔导书（第二版的舞台） =====================
// 整个画面是一本摊在深色木桌上的魔导书：旧纸色的左右两页、书脊的阴影、皮面书壳的边、几层书页的厚度。
// 这不是画框：它是一件东西，翻页时真的会翻。所有内容画在书页上（帕秋莉是贴在书页上的剪纸人偶）。
const BOOK = { x: 54, y: 40, w: W - 108, h: H - 80, gutter: CX, page: '#e7dcc4', page2: '#ddd0b3' };
BOOK.L = { x: BOOK.x + 26, y: BOOK.y + 18, w: CX - 8 - (BOOK.x + 26), h: BOOK.h - 36 };
BOOK.R = { x: CX + 8, y: BOOK.y + 18, w: BOOK.x + BOOK.w - 26 - (CX + 8), h: BOOK.h - 36 };
const WOOD = '#34261f';
function desk(c) {
  c.fillStyle = WOOD; c.fillRect(0, 0, W, H);
  c.save(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; for (let k = 0; k < 14; k++) { const y = 30 + k * 78 + Math.sin(k * 1.7) * 12; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(W * .3, y + 10, W * .6, y - 12, W, y + 6); c.stroke(); } c.restore();
  grain(c, polyPath(rectPts(0, 0, W, H)), .1);
}
// spread：画桌面 + 翻开的书（两页），返回 BOOK。o.blank = true 时只画空白书页
function spread(c, t = 0, o = {}) {
  desk(c);
  const { x, y, w, h } = BOOK;
  cutPaper(c, rectPts(x - 10, y - 8, w + 20, h + 20, 10), '#5b3034', { seed: 1101, step: 28, blur: 16, sx: 0, sy: 8, grain: .12 });   // 皮面书壳
  for (let k = 3; k >= 1; k--) cutPaper(c, rectPts(x + 14 - k * 3, y + 10 + k * 2, w - 28 + k * 6, h - 20, 4), mix(BOOK.page2, '#000000', .06 * k), { seed: 1102 + k, step: 60, shadow: false, grain: 0 });   // 书页厚度
  for (const [pg, side] of [[BOOK.L, -1], [BOOK.R, 1]]) {
    const path = cutPaper(c, rectPts(pg.x, pg.y, pg.w, pg.h, 3), BOOK.page, { seed: 1110 + side, step: 70, shadow: false, grain: .14, edge: false });
    c.save(); c.clip(path);
    // 书脊阴影 + 外缘略暗
    const gx = side < 0 ? pg.x + pg.w : pg.x, g = c.createLinearGradient(gx, 0, gx + side * 150, 0); g.addColorStop(0, 'rgba(60,40,20,.30)'); g.addColorStop(1, 'rgba(60,40,20,0)'); c.fillStyle = g; c.fillRect(pg.x, pg.y, pg.w, pg.h);
    const ox = side < 0 ? pg.x : pg.x + pg.w, g2 = c.createLinearGradient(ox, 0, ox + side * -70, 0); g2.addColorStop(0, 'rgba(60,40,20,.12)'); g2.addColorStop(1, 'rgba(60,40,20,0)'); c.fillStyle = g2; c.fillRect(pg.x, pg.y, pg.w, pg.h);
    c.restore();
  }
  rline(c, [[CX, BOOK.y + 14], [CX, BOOK.y + BOOK.h - 14]], { w: 2, color: 'rgba(60,40,20,.35)', seed: 1120 });
  return BOOK;
}
// pageHeader：书页左上角的页眉（一弯剪纸月牙 + 手写页名），代替参考片的展签
function pageHeader(c, text, tau, t0 = 0, o = {}) {
  const { t1 = 1e9, x = BOOK.L.x + 50, y = BOOK.L.y + 64 } = o, k = Math.min(sm(t0, t0 + .4, tau), 1 - sm(t1, t1 + .3, tau)); if (!(k > 0)) return;
  c.save(); c.globalAlpha *= k;
  drawMoonIcon(c, x, y - 14, 16, P.moon, -.5);
  zh(c, text, x + 30, y, { size: 36, color: P.ink2, p: writeP(tau, t0 + .1, text, .06) });
  rline(c, [[x + 30, y + 14], [x + 30 + zhWidth(c, text, 36) * clamp(writeP(tau, t0 + .1, text, .06), 0, 1), y + 14]], { w: 1.5, color: alpha(P.ink2, .5), seed: 1130 });
  c.restore();
}
// turnPage：翻页转场。右页绕书脊翻到左边，0..1；翻过去的那张纸画成空白旧纸（背面略暗）
function turnPage(c, u) {
  if (u <= 0 || u >= 1) return; const R = BOOK.R, e = easeIO(u), cw = R.w * Math.cos(e * Math.PI), lift = Math.sin(e * Math.PI) * 36;
  if (Math.abs(cw) < 2) return;
  // land：快落平时背面渐渐变成左页的样子（纸色、只剩书脊那 150 像素的阴影、投影淡掉），落下那一帧左页不会突然变亮
  const pts = [[CX, R.y], [CX + cw, R.y - lift], [CX + cw, R.y + R.h + lift], [CX, R.y + R.h]], land = cw > 0 ? 0 : sm(.6, 1, e);
  c.save(); c.shadowColor = `rgba(30,20,10,${.35 * (1 - land)})`; c.shadowBlur = 30; c.shadowOffsetY = 10; c.fillStyle = cw > 0 ? BOOK.page : mix(BOOK.page2, BOOK.page, land); c.fill(polyPath(pts)); c.restore();
  c.save(); c.clip(polyPath(pts)); grain(c, polyPath(pts), .14);
  const a1 = cw > 0 ? .05 : .18, sp = Math.min(1, 150 / Math.abs(cw)), g = c.createLinearGradient(CX, 0, CX + cw, 0);
  g.addColorStop(0, `rgba(60,40,20,${.28 + .02 * land})`); g.addColorStop(sp, `rgba(60,40,20,${lerp(.28, a1, sp) * (1 - land)})`); g.addColorStop(1, `rgba(60,40,20,${a1 * (1 - land)})`);
  c.fillStyle = g; c.fill(polyPath(pts)); c.restore();
}

// ===================== 纸机关（第二版书页上用） =====================
// brassPin：铜色两脚钉（转盘的轴、线的端点）
function brassPin(c, x, y, r = 9) { cutPaper(c, circPts(x, y, r, 16), '#b08a45', { seed: 1201 + (x | 0) % 17, step: 4, blur: 3, sx: 1, sy: 2, grain: 0 }); c.fillStyle = 'rgba(255,240,200,.7)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .28, 0, TAU); c.fill(); }
// thread：两点之间一根线，中间自然下垂 sag 像素；o = { color, w, p 画出比例, taut 0..1 绷紧 }
function thread(c, a, b, o = {}) { const { color = '#6b4f55', w = 2.2, p = 1, sag = 30, taut = 0, seed = 1210 } = o, s = sag * (1 - taut);
  const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * s]); }
  rline(c, pts, { w, color, p, seed, amp: .4 }); return pts; }
// popup：立体书——以 foldY 这条折线为轴，把 fn 画的东西从书页上「立起来」，k 0..1（0 = 平躺，1 = 立起）
// span = [x0, x1]：折线阴影只画立起物件那一段（默认整个画面宽，第 1、2 集的调用不变）
function popup(c, foldY, k, fn, span = [0, W]) { if (k <= .001) return; c.save(); c.translate(0, foldY); c.scale(1, k); c.translate(0, -foldY); fn(); c.restore();
  if (k < .98) { c.save(); c.globalAlpha *= (1 - k) * .5; c.fillStyle = 'rgba(40,25,15,.25)'; c.fillRect(span[0], foldY - 2, span[1] - span[0], 4); c.restore(); } }
// vellum：半透明的硫酸纸（叠在别的东西上，下面隐约透出来）
function vellum(c, pts, o = {}) { return cutPaper(c, pts, o.color || '#f4f1ea', { step: 20, grain: .05, blur: 4, ...o, al: (o.al ?? 1) * .55 }); }
// spin：绕 (x, y) 转 a 弧度后画 fn（转盘）
function spin(c, x, y, a, fn) { c.save(); c.translate(x, y); c.rotate(a); c.translate(-x, -y); fn(); c.restore(); }

// ===================== 立体与交接（第二版：图画展览会式编排） =====================
// 全片像《图画展览会》：魔导书是「漫步」主题（开场、总结、以及段与段之间），每一页是一幅风格不同的「画」，各有立体感和空间感。
// proj：简单透视投影。cam = { x, y, z 相机位置, yaw 左右转, pitch 俯仰, f 焦距（默认 900）}。返回 [sx, sy, scale] 或 null（在相机后面）
function proj(p, cam) {
  const { x = 0, y = 0, z = -1000, yaw = 0, pitch = 0, f = 900 } = cam;
  let dx = p[0] - x, dy = p[1] - y, dz = p[2] - z;
  const cy = Math.cos(yaw), sy = Math.sin(yaw); [dx, dz] = [dx * cy - dz * sy, dx * sy + dz * cy];
  const cp = Math.cos(pitch), sp = Math.sin(pitch); [dy, dz] = [dy * cp - dz * sp, dy * sp + dz * cp];
  if (dz < 10) return null; const k = f / dz; return [CX + dx * k, CY + dy * k, k];
}
// parallax：多层视差。layers = [{ depth, draw(c) }]，depth 越大越远；camX/camY 是镜头平移，zoom 推拉。远的层移动得少、缩放得少
function parallax(c, layers, camX = 0, camY = 0, zoom = 1) {
  for (const L of layers.slice().sort((a, b) => b.depth - a.depth)) { const k = 1 / (1 + L.depth), z = 1 + (zoom - 1) * k;
    c.save(); c.translate(CX, CY); c.scale(z, z); c.translate(-CX - camX * k, -CY - camY * k); L.draw(c); c.restore(); }
}
// ---- 段与段的交接画面：前一段最后 ≥0.15 秒、后一段最前 ≥0.15 秒都只画同一个交接函数，拼起来看不出接缝 ----
const NIGHT_BG = '#1d1a22';
// 睡眠 → 吃饭：夜色里正中一轮淡色圆盘（月亮 → 盘子）
function handoffDisc(c, o = {}) { if (o.bg !== false) { c.fillStyle = NIGHT_BG; c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .06); }
  if (o.disc !== false) cutPaper(c, circPts(CX, CY, 300, 72), '#ede6d6', { seed: 2001, step: 26, blur: 20, sx: 0, sy: 6 }); }
// 吃饭 → 动力：纸面上一根横贯画面的线（桌布上的线被拉直）
function handoffThread(c) { c.fillStyle = P.paper; c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .12);
  rline(c, [[-20, CY], [W + 20, CY]], { w: 3, color: '#6b4f55', seed: 2002, amp: .3 }); }
// 动力 → 专注：夜色里升起的金色火花（火花 → 星星），位置确定
const HANDOFF_SPARKS = Array.from({ length: 60 }, (_, k) => [hash(k, 31) * W, hash(k, 32) * H * .9, 1.5 + hash(k, 33) * 3.5]);
function handoffSparks(c) { c.fillStyle = NIGHT_BG; c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .06);
  for (const [x, y, r] of HANDOFF_SPARKS) { c.fillStyle = alpha(P.moon, .9); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }
// 专注 → 运动、运动 → 总结：空白的魔导书跨页（spread）
function handoffBook(c, t = 0) { spread(c, t); }
// tiltPlane：把 fn 画的整幅画面当成一张平放的纸，绕水平轴俯仰 pitch 弧度后按透视画出来（远处变窄变扁）。
// 用于「斜看桌上的书」一类镜头。o = { pitch, cx, cy 旋转轴所在的屏幕点, f 焦距, strip 条带高度 }
const TILT_BUF = document.createElement('canvas');
function tiltPlane(c, fn, o = {}) {
  const { pitch = 0, cx = CX, cy = CY, f = 1400, strip = 4 } = o;
  if (Math.abs(pitch) < .002) { fn(c); return; }
  const sc = c.getTransform().a || 1; if (TILT_BUF.width !== W * sc) { TILT_BUF.width = W * sc; TILT_BUF.height = H * sc; }
  const b = TILT_BUF.getContext('2d'); b.setTransform(sc, 0, 0, sc, 0, 0); b.clearRect(0, 0, W, H); fn(b);
  const cp = Math.cos(pitch), sp = Math.sin(pitch), map = y => { const d = y - cy, z = d * sp, k = f / (f + z); return [cy + d * cp * k, k]; };
  c.save(); c.imageSmoothingQuality = 'high';
  for (let y = 0; y < H; y += strip) { const [y0, k0] = map(y), [y1] = map(Math.min(H, y + strip)); if (y1 <= y0) continue;
    const w = W * k0; c.drawImage(TILT_BUF, 0, y * sc, W * sc, strip * sc, cx - cx * k0, y0, w, y1 - y0 + .6); }
  c.restore();
}

// ===================== 同一本魔导书的书板（开场桌上合着的书、片尾合上的书共用） =====================
// 开场和片尾是同一本书：皮面、书脊竹节、压印线、金线双框、四角角花、四角铜包角、书口的铜扣。
// 书板占 x0..x0+w、y = BOOK.y-8 .. BOOK.y+BOOK.h+12，书脊在左边（x0 一侧）。封面中间的纹章和字由调用方画
// （开场画七曜阵和标题，片尾写演职信息）。颜色都从 P 调出来。
const GRIMOIRE = { leather: '#5b3034', spine: 28, thick: 84, gold: mix(P.moon, P.cap, .32),
  brass: mix(P.moon, P.ink, .2), brassHi: mix(P.moon, P.cap, .6), brassLo: mix(P.moon, P.ink, .55) };
// grimoireCover：o = { frame 金线框画出进度 0..1, flourish 角花进度 0..1, clasp 铜扣（null 不画；0 扣着 → 1 弹开、扣带翻到封面上躺平）, shadow 书板投影（默认有）}
function grimoireCover(c, x0, w, o = {}) {
  const G = GRIMOIRE, { frame = 1, flourish = 1, clasp = null, shadow = true } = o, y0 = BOOK.y - 8, h = BOOK.h + 20, x1 = x0 + w, y1 = y0 + h, sw = G.spine;
  cutPaper(c, rectPts(x0, y0, w, h, 10), G.leather, { seed: 1201, step: 28, blur: 16, sx: 0, sy: 8, grain: .14, shadow });
  // 书脊：左边一条圆起来的皮（略暗）、一道书槽、五道竹节
  cutPaper(c, [[x0 + 3, y0 + 7], [x0 + sw, y0 + 3], [x0 + sw, y1 - 3], [x0 + 3, y1 - 7]], mix(G.leather, P.ink, .25), { seed: 1231, step: 36, shadow: false, grain: .12, edge: false });
  c.save(); c.lineCap = 'round';
  c.strokeStyle = alpha(P.ink, .55); c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + sw + 1, y0 + 8); c.lineTo(x0 + sw + 1, y1 - 8); c.stroke();
  c.strokeStyle = alpha(mix(G.leather, P.cap, .35), .45); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + sw + 4.5, y0 + 10); c.lineTo(x0 + sw + 4.5, y1 - 10); c.stroke(); c.restore();
  for (let k = 0; k < 5; k++) { const by = y0 + h * (k + .5) / 5;
    cutPaper(c, rectPts(x0 - 4, by - 10, sw + 3, 20, 7), mix(G.leather, P.cap, .1), { seed: 1240 + k, step: 9, blur: 4, sx: 0, sy: 3, grain: .1 });
    rline(c, [[x0, by - 5], [x0 + sw - 4, by - 5]], { w: 1.5, color: alpha(mix(G.leather, P.cap, .5), .5), seed: 1245 + k, amp: .4 }); }
  // 压印线（暗）+ 金线双框
  rline(c, rectPts(x0 + sw + 12, y0 + 16, w - sw - 28, h - 32, 4), { w: 2, color: alpha(P.ink, .35), close: true, seed: 1250, amp: .5 });
  const fx = x0 + 40, fy = y0 + 30, fw = w - 70, fh = h - 60;
  rline(c, rectPts(fx, fy, fw, fh), { w: 2.8, color: G.gold, close: true, p: frame, seed: 1251, amp: .45 });
  rline(c, rectPts(fx + 10, fy + 10, fw - 20, fh - 20), { w: 1.5, color: alpha(G.gold, .85), close: true, p: clamp((frame - .15) / .85, 0, 1), seed: 1252, amp: .45 });
  if (flourish > 0) [[fx + 10, fy + 10, 1, 1], [fx + fw - 10, fy + 10, -1, 1], [fx + fw - 10, fy + fh - 10, -1, -1], [fx + 10, fy + fh - 10, 1, -1]]
    .forEach(([cx, cy, sx, sy], i) => grimoireFlourish(c, cx, cy, sx, sy, flourish, G.gold, 1260 + i * 3));
  // 四角铜包角
  [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]].forEach(([cx, cy, sx, sy], i) => { const m = (u, v) => [cx + sx * u, cy + sy * v], s = 58;
    cutPaper(c, [m(-2, -2), m(s, -2), m(s - 4, 7), m(s * .55, 12), m(12, s * .55), m(7, s - 4), m(-2, s)], G.brass, { seed: 1270 + i, step: 8, blur: 3, sx: 1, sy: 2.5, grain: .12 });
    rline(c, [m(s - 9, 5), m(s * .52, 9), m(9, s * .52), m(5, s - 9)], { w: 1.4, color: G.brassLo, seed: 1274 + i, amp: .3 });
    rline(c, [m(1, s - 8), m(1, 1), m(s - 8, 1)], { w: 1.4, color: alpha(G.brassHi, .8), seed: 1278 + i, amp: .3 });
    const [rx, ry] = m(15, 15); c.fillStyle = G.brassLo; c.beginPath(); c.arc(rx, ry, 3.6, 0, TAU); c.fill(); c.fillStyle = alpha(G.brassHi, .9); c.beginPath(); c.arc(rx - 1, ry - 1, 1.3, 0, TAU); c.fill(); });
  if (clasp !== null) grimoireClasp(c, x1, (y0 + y1) / 2, clasp);
}
// grimoireFlourish：金线框内角的花饰（一道圆弧，两头卷进去，角上一片小叶和一个点）。(cx, cy) 是内框的角，sx/sy 朝框内
function grimoireFlourish(c, cx, cy, sx, sy, p, color, seed) { if (p <= 0) return;
  const m = pts => pts.map(([u, v]) => [cx + sx * u, cy + sy * v]), arc = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; arc.push([48 * Math.cos(a), 48 * Math.sin(a)]); }
  // 一笔：v 轴那头的卷（倒着走）→ 圆弧 → u 轴那头的卷
  const curl = [[62, 2], [72, 9], [70, 19], [62, 20], [60, 13]], full = [...curl.map(([u, v]) => [v, u]).reverse(), ...arc.slice().reverse(), ...curl];
  rline(c, spline(m(full), 3), { w: 1.8, color, p, seed, amp: .35 });
  if (p > .6) { const k = sm(.6, 1, p, easeOutBack), q = ([u, v]) => [5 + (u - 5) * k, 5 + (v - 5) * k];
    c.save(); c.fillStyle = color; c.fill(polyPath(m([[5, 5], [21, 12], [30, 30], [12, 21]].map(q))));
    const [dx, dy] = m([[38, 38]])[0]; c.beginPath(); c.arc(dx, dy, 3.4 * k, 0, TAU); c.fill(); c.restore(); }
}
// grimoireClasp：书口的铜扣。扣带钉在封面上（根上一块铜片），绕过书口扣在底下；
// u 0→1：舌片弹出来 → 扣带立起、翻过去、躺在封面上（翻到半空时离镜头近、变大）
function grimoireClasp(c, x1, ym, u) {
  const G = GRIMOIRE, rx = x1 - 74, sh = 20, a = Math.PI * sm(.15, 1, u), s = Math.sin(a), lf = lerp(74, 140, sm(0, .3, u, easeOut)), k = 1 / (1 - .0022 * lf * s);
  const ex = u <= 0 ? x1 + 2 : rx + lf * Math.cos(a) * k, hs = sh * k, up = Math.cos(a) >= 0;
  if (s > .02) { c.save(); c.fillStyle = `rgba(20,12,10,${.3 * s})`; c.fill(polyPath([[rx + 4, ym - sh + 6], [ex + 10 * s, ym - hs + 14 * s], [ex + 10 * s, ym + hs + 14 * s], [rx + 4, ym + sh + 6]])); c.restore(); }
  if (Math.abs(ex - rx) > 1) {
    cutPaper(c, [[rx, ym - sh], [ex, ym - hs], [ex, ym + hs], [rx, ym + sh]], up ? mix(G.leather, P.ink, .32) : mix(G.leather, P.g2, .3), { seed: 1280, step: 14, shadow: u <= 0, blur: 3, sx: 1, sy: 2, grain: .12 });
    if (up) { c.save(); c.setLineDash([6, 5]); c.strokeStyle = alpha(P.cap, .32); c.lineWidth = 1.2; c.beginPath(); c.moveTo(rx + 4, ym - sh + 5); c.lineTo(ex - 4, ym - hs + 5 * k); c.moveTo(rx + 4, ym + sh - 5); c.lineTo(ex - 4, ym + hs - 5 * k); c.stroke(); c.restore(); }
  }
  // 末端：扣着时是包住书口的铜套，弹开后是一枚带槽的铜舌
  if (u <= 0) { cutPaper(c, rectPts(x1 - 16, ym - 25, 20, 50, 4), G.brass, { seed: 1283, step: 8, blur: 3, sx: 1, sy: 2, grain: .1 }); rline(c, [[x1 - 10, ym - 18], [x1 - 10, ym + 18]], { w: 1.4, color: G.brassLo, seed: 1284, amp: .3 }); }
  else { const tl = (ex - rx) * .2, t0 = ex - tl;
    if (Math.abs(tl) > .8) { cutPaper(c, [[t0, ym - hs * 1.18], [ex, ym - hs * 1.05], [ex, ym + hs * 1.05], [t0, ym + hs * 1.18]], G.brass, { seed: 1285, step: 6, blur: 3, sx: 1, sy: 2, grain: .1 });
      c.save(); c.fillStyle = G.brassLo; c.fill(polyPath([[t0 + tl * .35, ym - hs * .35], [t0 + tl * .7, ym - hs * .35], [t0 + tl * .7, ym + hs * .35], [t0 + tl * .35, ym + hs * .35]])); c.restore(); } }
  // 根上的铜片（压在扣带上），两颗铆钉
  cutPaper(c, [[rx - 13, ym - 31], [rx + 11, ym - 31], [rx + 16, ym], [rx + 11, ym + 31], [rx - 13, ym + 31], [rx - 18, ym]], G.brass, { seed: 1286, step: 7, blur: 3, sx: 1, sy: 2.5, grain: .12 });
  rline(c, [[rx - 9, ym - 26], [rx + 7, ym - 26]], { w: 1.2, color: alpha(G.brassHi, .8), seed: 1287, amp: .3 });
  for (const yy of [ym - 15, ym + 15]) { c.fillStyle = G.brassLo; c.beginPath(); c.arc(rx - 1, yy, 3.4, 0, TAU); c.fill(); c.fillStyle = alpha(G.brassHi, .9); c.beginPath(); c.arc(rx - 2, yy - 1, 1.2, 0, TAU); c.fill(); }
}
// grimoireEdge：合着的书朝镜头的那一面（书尾的厚边）。(ax, ay)–(bx, by) 是封面下边在屏幕上的两端（书脊在 a 端），th 是这一面在屏幕上的高。
// 从上到下：上书板的边、一叠书页（几道细线，书口那头缩进去一点）、下书板；书脊那头是一个圆起来的皮头。
function grimoireEdge(c, ax, ay, bx, by, th) {
  if (th < .6) return; const G = GRIMOIRE, n = Math.hypot(bx - ax, by - ay) || 1, us = th * .5 / n, ue = th * .14 / n;
  const at = (u, v) => [lerp(ax, bx, u), lerp(ay, by, u) + th * v];
  cutPaper(c, [at(0, .8), at(1, .8), at(1, 1), at(0, 1)], mix(G.leather, P.ink, .35), { seed: 1291, step: 50, shadow: false, grain: .1, edge: false });
  cutPaper(c, [at(us, .12), at(1 - ue, .12), at(1 - ue, .84), at(us, .84)], BOOK.page2, { seed: 1292, step: 60, shadow: false, grain: .12, edge: false });
  c.save(); c.strokeStyle = alpha(P.paperEdge, .8); c.lineWidth = .9;
  for (let k = 1; k < 7; k++) { const v = .12 + .72 * k / 7, [p0x, p0y] = at(us, v), [p1x, p1y] = at(1 - ue, v); c.beginPath(); c.moveTo(p0x, p0y); c.lineTo(p1x, p1y); c.stroke(); }
  c.restore();
  cutPaper(c, [at(0, 0), at(1, 0), at(1, .15), at(0, .15)], mix(G.leather, P.cap, .1), { seed: 1293, step: 50, shadow: false, grain: .1, edge: false });
  // 书脊的圆头
  const cap = [at(us * 1.2, 0), at(0, 0)]; for (let i = 1; i < 10; i++) { const v = i / 10; cap.push([ax - th * .3 * Math.sin(v * Math.PI), ay + th * v]); } cap.push(at(0, 1), at(us * 1.2, 1));
  cutPaper(c, cap, mix(G.leather, P.ink, .18), { seed: 1294, step: 20, shadow: false, grain: .1, edge: false });
  rline(c, [at(us * .9, .1), [ax - th * .18, ay + th * .5], at(us * .9, .9)], { w: 1.2, color: alpha(mix(G.leather, P.cap, .45), .5), smooth: true, seed: 1295, amp: .2 });
}
