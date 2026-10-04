'use strict';
// handoffs · 形状接形状：四种不靠硬切的转场
// 出处：第 1–4 集 各段交接（第 1 集 src/kit.js:362-376 handoffDisc/Thread/Sparks/Book；2-diet.js:566、3-dopamine.js:335、4-focus.js:456）
// 好在哪：每种转场 8 秒，前 2.2 秒停在上一页的末态，2.2–5.0 秒这一个形状在原地长成下一页的形状（月亮的缺口滑出变成满圆盘、松垂 240 像素的线绷直成两条轨道、60 颗火花里 12 颗长成四角星并连线、蓝色星图缩到右页再绕书脊翻过去），
//        后 3 秒留给下一页的细节出场（热气、枕木逐根弹出、星座连完、书页落平）。段与段之间只有 0.4 秒的叠化，镜头始终没有缩放，所有形状都不小于画高的 15%。
// 复用：四个 fxHoSeg[i](c, u) 各画一整帧（含自己的底），u 为段内秒数 0..8，可单独拷出当某一集的两页之间的过渡；时间点集中在 FX_HO.t，线的颜色在 FX_HO.c。
// 分叉：① 换形状对：圆盘换成别的圆形（钟面、齿轮），轨道换成别的平行线（琴弦、跑道）；② 换底：夜空、桌布、书页三种底色在 FX_HO.c 里改；③ 换节奏：morph 区间（0 秒到 2.2、2.2–5、5–8）整体拉长或缩短，保持三段式。

const FX_HO = {
  seg: 8, fade: 0.4, t: { hold: 2.2, morph: 5.0 },
  c: { night: '#1d1a22', moon: '#e6d49a', plate: '#ede6d6', rim: '#6d5d8c', thread: '#6b4f55', rail: '#4a3f58', bead: '#6d5d8c', spark: '#e0b84e', star: '#e8f0ff', chart: '#2c4f7c', chartLine: '#bcd3f0' },
  names: ['月亮 → 盘子', '桌布线 → 轨道', '火花 → 星点', '星图 → 书页'],
  sparks: Array.from({ length: 60 }, (_, k) => [120 + hash(k, 31) * 1680, 180 + hash(k, 32) * 700, 3 + hash(k, 33) * 5]),
  chart: [[.12, .30], [.22, .55], [.34, .36], [.46, .62], [.58, .30], [.70, .52], [.80, .28], [.90, .55]],
};

// 缺口月亮：外圆减去一个小圆（咬口），咬口远离时就是满圆
function fxHoBite(cx, cy, r, bx, by, br, n = 140) {
  if (Math.hypot(bx - cx, by - cy) >= r + br) return circPts(cx, cy, r, n);
  const outer = [], bite = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; outer.push(Math.hypot(p[0] - bx, p[1] - by) > br ? p : null); }
  let s = outer.findIndex((p, i) => p && !outer[(i + n - 1) % n]); if (s < 0) s = 0;
  const arc = []; for (let i = 0; i < n; i++) { const p = outer[(s + i) % n]; if (!p) break; arc.push(p); }
  for (let i = 0; i < n; i++) { const a = i / n * TAU, p = [bx + Math.cos(a) * br, by + Math.sin(a) * br]; if (Math.hypot(p[0] - cx, p[1] - cy) < r) bite.push(p); }
  let k0 = bite.findIndex((p, i) => { const q = bite[(i + bite.length - 1) % bite.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 2 * Math.PI * br / n * 3; }); if (k0 < 0) k0 = 0;
  let B = bite.slice(k0).concat(bite.slice(0, k0)); const E = arc.at(-1);
  if (Math.hypot(B[0][0] - E[0], B[0][1] - E[1]) > Math.hypot(B.at(-1)[0] - E[0], B.at(-1)[1] - E[1])) B = B.reverse();
  return [...arc, ...B];
}
const fxHoNight = c => { c.fillStyle = FX_HO.c.night; c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .06); };
const fxHoPaper = c => { c.fillStyle = P.paper; c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .12); };

// ① 月亮 → 盘子
function fxHoMoon(c, u) {
  const C = FX_HO.c, T = FX_HO.t; fxHoNight(c);
  for (let k = 0; k < 14; k++) { const x = 90 + hash(k, 5) * 1740, y = 90 + hash(k, 6) * 330; if (Math.hypot(x - 1470, y - 300) < 190) continue;
    sparkle(c, x, y, 7 + hash(k, 7) * 8, { color: C.star, al: (.7 - .4 * sm(T.hold, T.morph, u)) * (.7 + .3 * Math.sin(u * 2 + k)) }); }
  const e = sm(T.hold, T.morph, u), x = lerp(1470, CX, e), y = lerp(300, CY + 20, e), r = lerp(120, 330, e);
  const br = r * .78, bx = x + lerp(r * .5, (r + br) * 1.06, e), by = y - r * .32 * (1 - e);
  const pts = fxHoBite(x, y, r, bx, by, br), col = mix(C.moon, C.plate, sm(T.hold + .8, T.morph, u));
  cutPaper(c, pts, col, { seed: 4701, step: 8, blur: 10, sx: 6, sy: 8 });
  const rim = sm(T.morph - 1.2, T.morph, u);                                                           // 盘沿：一圈紫线 + 内圈
  if (rim > 0 && e > .5) { rline(c, circPts(x, y, r * .98, 90), { w: 7, color: C.rim, p: rim, seed: 4702, amp: 1.2, close: true }); rline(c, circPts(x, y, r * .70, 90), { w: 4, color: alpha(C.rim, .6), p: rim, seed: 4703, amp: 1, close: true }); }
  const st = sm(T.morph, T.morph + 1.2, u);                                                            // 热气
  for (let i = 0; i < 3; i++) { const bx0 = x - 90 + i * 90, pts2 = []; for (let j = 0; j <= 16; j++) { const v = j / 16; pts2.push([bx0 + 22 * Math.sin(v * 5 + u * 1.6 + i), y - r - 20 - v * 150]); }
    rline(c, pts2, { w: 5, color: C.plate, p: st, al: .75 * (1 - .0), seed: 4710 + i, amp: .8 }); }
}

// ② 桌布线 → 轨道
function fxHoRail(c, u) {
  const C = FX_HO.c, T = FX_HO.t; fxHoPaper(c);
  const e = sm(T.hold, T.morph, u), ax = 150, bx = 1770, ay = CY;
  for (let i = 0; i < 6; i++) rline(c, [[40, 150 + i * 150], [1880, 150 + i * 150 + (i % 2 ? 8 : -8)]], { w: 3, color: alpha(P.ink, .09 * (1 - e * .8)), amp: 2, seed: 4720 + i });   // 桌布折痕
  // 线：松垂 → 绷直（带一点过冲回弹），然后分成上下两条轨
  const taut = fxKey(u, [[0, 0], [T.hold, 0], [T.hold + 1.0, 1.08, easeOut], [T.hold + 1.5, .97, easeIO], [T.hold + 1.9, 1, easeIO]]);
  const sag = 240 * (1 - clamp(taut, 0, 1.08)), split = sm(T.hold + 1.6, T.morph, u), off = 36 * split;
  const mid = (1 - split);
  if (split < 1) { c.save(); c.globalAlpha *= mid; thread(c, [ax, ay], [bx, ay], { color: C.thread, w: 6, sag, taut: 0, seed: 4730, p: sm(0, 1.2, u) }); c.restore(); }
  if (split > 0) for (const s of [-1, 1]) rline(c, [[ax, ay + s * off], [bx, ay + s * off]], { w: 9, color: C.rail, amp: .8, seed: 4731 + s, p: 1 });
  brassPin(c, ax, ay, 15); brassPin(c, bx, ay, 15);
  const ties = 20; for (let i = 0; i < ties; i++) { const k = easeOutElastic(clamp((u - T.morph + .4 - i * .07) / .5, 0, 1)); if (k <= 0) continue;
    const x = ax + 40 + i * (bx - ax - 80) / (ties - 1); pop(c, x, ay, k, () => cutPaper(c, rectPts(x - 12, ay - 88, 24, 176, 3), '#a98a63', { seed: 4740 + i, step: 20, blur: 4, sx: 2, sy: 3 })); }
  if (u > T.morph + 1.4) { const v = ((u - T.morph - 1.4) * .22) % 1.2, x = lerp(ax + 40, bx - 40, clamp(v, 0, 1)); // 珠子沿上轨滚动
    c.save(); c.translate(x, ay - off - 2); const g = cutPaper(c, circPts(0, -34, 34, 28), C.bead, { seed: 4750, step: 6, blur: 6, sx: 3, sy: 4 }); c.restore(); }
}
const fxKey = (t, K) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b, e = easeIO] = K[i]; return lerp(a, b, e((t - t0) / (t1 - t0))); } return K.at(-1)[1]; };

// ③ 火花 → 星点
function fxHoSpark(c, u) {
  const C = FX_HO.c, T = FX_HO.t; fxHoNight(c);
  const e = sm(T.hold, T.morph, u), drift = 46 * sm(0, T.morph, u, easeOut);
  const big = FX_HO.sparks.map((s, k) => [k, s]).filter(([k]) => k % 5 === 0).sort((a, b) => a[1][0] - b[1][0]);          // 12 颗大星，按横坐标连成星座
  const isBig = new Set(big.map(([k]) => k));
  FX_HO.sparks.forEach(([x, y, r], k) => { const yy = y - drift * (.6 + hash(k, 41));
    if (isBig.has(k)) { const R = lerp(r, 34 + 12 * hash(k, 42), easeOut(e)); if (e < .5) { c.fillStyle = alpha(mix(C.spark, C.star, e * 2), .9); c.beginPath(); c.arc(x, yy, R * (1 - e * 2) + r * e * 2 * .9, 0, TAU); c.fill(); }
      sparkle(c, x, yy, R * (1 + .12 * Math.sin(u * 3 + k)), { color: C.star, al: sm(.25, .6, e), rot: .2 * Math.sin(u + k) }); }
    else { c.fillStyle = alpha(mix(C.spark, C.star, e), .9 - .55 * e); c.beginPath(); c.arc(x, yy, r * (1 - .35 * e), 0, TAU); c.fill(); } });
  const pts = big.map(([k, s]) => [s[0], s[1] - drift * (.6 + hash(k, 41))]), lp = sm(T.hold + 1.3, T.morph + 1.4, u);
  if (lp > 0) rline(c, pts, { w: 4, color: alpha(C.star, .7), p: lp, seed: 4760, amp: .8 });
}

// ④ 星图 → 书页
function fxHoChart(c, u, r) {                                                                          // 蓝晒星图，画在矩形 r={x,y,w,h} 内
  const C = FX_HO.c; cutPaper(c, rectPts(r.x, r.y, r.w, r.h, 6), C.chart, { seed: 4770, step: 50, blur: 10, sx: 3, sy: 5, grain: .1 });
  const pts = FX_HO.chart.map(([a, b]) => [r.x + a * r.w, r.y + b * r.h]);
  rline(c, pts, { w: Math.max(2, r.w / 480), color: alpha(C.chartLine, .75), amp: .5, seed: 4771 });
  pts.forEach(([x, y], i) => sparkle(c, x, y, Math.max(8, r.w * (i % 3 ? .018 : .028)), { color: '#fbfdff' }));
}
function fxHoBook(c, u) {
  const T = FX_HO.t, R = BOOK.R, tgt = { x: R.x + 30, y: R.y + 30, w: R.w - 60, h: R.h - 60 };
  const full = { x: 60, y: 60, w: W - 120, h: H - 120 }, shrink = sm(T.hold, T.hold + 1.4, u), flip = sm(T.hold + 1.8, T.morph, u);
  if (shrink <= 0) { fxHoChart(c, u, full); return; }
  spread(c, 0);
  if (flip <= 0) { const r = {}; for (const k of ['x', 'y', 'w', 'h']) r[k] = lerp(full[k], tgt[k], shrink); fxHoChart(c, u, r); return; }
  const e = easeIO(flip), cw = R.w * Math.cos(e * Math.PI);
  turnPage(c, flip);
  if (cw > 0) { c.save(); c.beginPath(); c.rect(CX, 0, cw, H); c.clip(); c.translate(CX, 0); c.scale(Math.cos(e * Math.PI), 1); c.translate(-CX, 0); fxHoChart(c, u, tgt); c.restore(); }
  if (flip >= 1) {                                                                                      // 落平后右页浮出几行字迹
    const k = sm(T.morph + .3, T.morph + 3.2, u); for (let i = 0; i < 5; i++) rline(c, [[R.x + 70, R.y + 150 + i * 90], [R.x + 70 + (i === 4 ? 360 : 700), R.y + 150 + i * 90]], { w: 5, color: alpha(P.ink, .55), p: clamp(k * 6 - i, 0, 1), amp: 1, seed: 4780 + i }); }
}

const fxHoSeg = [fxHoMoon, fxHoRail, fxHoSpark, fxHoBook];
function fxHoDraw(c, t) {
  const S = FX_HO.seg, i = Math.min(3, Math.floor(t / S)), u = t - i * S, f = FX_HO.fade;
  fxHoSeg[i](c, u);
  if (u > S - f) { c.save(); c.globalAlpha *= sm(S - f, S, u); fxHoSeg[(i + 1) % 4](c, 0); c.restore(); }
  const dark = i === 0 || i === 2, lab = FX_HO.names[i];
  zh(c, lab, 80, 120, { size: 56, color: i === 3 ? '#fbf3e0' : dark ? '#efe6d2' : P.ink, outline: i === 3 ? 'rgba(20,15,30,.85)' : null, ow: 10 });
}

FX.add({ id: 'handoffs', title: '形状接形状的四种转场', src: '第 1–4 集 段间交接', dur: 32, bg: 'none', draw: (c, t) => fxHoDraw(c, t) });
