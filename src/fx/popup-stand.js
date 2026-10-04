'use strict';
// popup-stand · 立体书纸件从折痕啪地立起
// 出处：第 1 集 运动段（第 1 集 src/scenes/5-exercise.js:1-700，斜放摊开的书 s5P 透视、s5Loc/s5Aff 纸件仿射、s5Sh 硬投影、折痕立起）
// 好在哪：一本 1 : 1.414 的摊开书（每页 640×905，书脊在正中 x=960）斜放 0.85 弧度，3 个纸件各自沿折线立起：小楼 1.0 秒、树 2.9 秒、帕秋莉 4.8 秒。
//       每次立起 1 秒：先往后蓄 0.10 弧度（0.32 秒），再 0.22 秒冲到 1.80 弧度（过冲 12 度），回弹到 1.46、再到 1.63、最后落定在 1.5708，整个过程有蓄力、冲出、回弹三拍，冲到顶点同时冒一个「啪」和三道短线。
//       立起后纸件在书页上留下一块单层硬边投影（光从左上，投影向右下偏 0.28/0.28 倍高度），原位留一个剪空的洞露出下层暗纸；后立起的纸件冲到顶点时，已经立住的纸件跟着抖 0.03 弧度、0.4 秒内衰减掉。
// 复用：scene 里 fxPlay('popup-stand', c, t)；单独拿 fxPopAngle(t, t0) 就是一条「啪」的立起曲线，任何折起的纸件都能用；fxPopCard(c, spec, a) 画一个纸件（透视仿射 + 投影），spec 是 FX_POP.pieces 的一项。
//       加纸件只需在 FX_POP.pieces 里加一项 {X, Y, w, H, t0, outline, draw}，draw 在本地坐标里画（脚底在 0,0，向上是负 y）。
// 分叉：1) 换题材时换纸件：房子换成书架、齿轮、火车，outline 同时是投影轮廓；2) 改 FX_POP.view.pitch 与光向 FX_POP.light，让书更平或更立；3) 把 FX_POP.spring 换成缓一点的一拍（[[0,0],[.5,1.7],[1,1.5708]]）就是温柔版立起，适合讲「慢慢长出来」。

const FX_POP = {
  view: { pitch: -.85, cx: CX, cy: 520, f: 2800 },              // 书页相对镜头的俯角；cy 是页面透视的视平线锚点
  page: { w: 640, h: 905, x0: 320, y0: 60 },                    // 每页 1 : 1.414，两页相接于 x=960
  light: [.28, .28],                                            // 高 1 个单位的点，投影在页面上向右偏 0.28、向前偏 0.28
  // 立起曲线：[相对 t0 的秒, 弧度]。先蓄 0.10，再冲到 1.80（过冲），回弹两次，落在 π/2
  spring: [[0, 0], [.32, .10], [.54, 1.80], [.72, 1.46], [.88, 1.63], [1, 1.5708]],
  wobble: { amp: .03, k: 9, hz: 22 },                           // 别的纸件冲到顶点时，已立住的纸件的抖动
  colors: { cover: '#5b3034', hole: mix(P.paper, P.ink, .3), kraft: '#c9ad7f', shadow: mix(P.paper, '#281a22', .19) },
  pieces: [
    { id: 'house', X: 560, Y: 650, w: 230, H: 440, t0: 1.0, boom: [250, -260] },
    { id: 'tree', X: 1110, Y: 560, w: 260, H: 410, t0: 2.9, boom: [230, -250] },
    { id: 'girl', X: 1400, Y: 860, w: 190, H: 490, t0: 4.8, boom: [-140, -320] },
  ],
};

// ---- 透视：页面坐标 (X, Y) 加离页高度 h → 屏幕 [x, y, 缩放]。pitch 为负时 Y 越大越靠近镜头
function fxPopP(X, Y, h = 0) {
  const V = FX_POP.view, cp = Math.cos(V.pitch), sp = Math.sin(V.pitch), x = X - V.cx, d = Y - V.cy;
  const y = d * cp + h * sp, z = d * sp - h * cp, k = V.f / (V.f + z);
  return [V.cx + x * k, V.cy + y * k, k];
}
// 立起曲线：t0 之前平躺，之后按 spring 走
const fxPopAngle = (t, t0) => key(t - t0, [...FX_POP.spring.map(([s, a]) => [s, a]), [99, Math.PI / 2]], easeIO);

// 各纸件的轮廓（本地坐标，脚底在 0,0，向上为负 y）：既是投影形状，也是平躺时的剪洞形状
const fxPopOutline = {
  house: [[-115, 0], [-115, -330], [-140, -330], [0, -440], [140, -330], [115, -330], [115, 0]],
  tree: [[-18, 0], [-16, -150], ...circPts(-62, -255, 80, 28), ...circPts(0, -325, 86, 28), ...circPts(62, -255, 80, 28), [16, -150], [18, 0]],
  girl: [[-78, 0], [-90, -190], [-66, -330], [-88, -420], [-52, -490], [52, -490], [88, -420], [66, -330], [90, -190], [78, 0]],
};
const fxPopShapes = { // 投影用的整块多边形：树冠三个圆各自一块（实心色，叠起来不会变深）
  house: [fxPopOutline.house],
  tree: [[[-18, 0], [-16, -150], [16, -150], [18, 0]], circPts(-62, -255, 80, 28), circPts(0, -325, 86, 28), circPts(62, -255, 80, 28)],
  girl: [fxPopOutline.girl],
};

// 本地 → 屏幕的仿射：本地 x 向右 → 页面 +X；本地 y 向上（负）→ 离开折线 cos a、抬高 sin a
function fxPopM(sp, a) {
  const { X, Y, w, H } = sp, O = fxPopP(X, Y, 0), U = fxPopP(X + w, Y, 0), T = fxPopP(X, Y - H * Math.cos(a), H * Math.sin(a));
  return [(U[0] - O[0]) / w, (U[1] - O[1]) / w, (O[0] - T[0]) / H, (O[1] - T[1]) / H, O[0], O[1]];
}

// ---- 纸件本体（本地坐标）
function fxPopHouse(c) {
  const body = mix(P.g1, P.paper, .25), line = alpha(P.ink2, .55);
  cutPaper(c, rectPts(-115, -330, 230, 330, 3), body, { seed: 701, step: 22, shadow: false, grain: .1 });
  cutPaper(c, [[-140, -326], [0, -440], [140, -326]], P.purple, { seed: 702, step: 18, shadow: false, grain: .12 });   // 全页唯一的彩色：紫屋顶
  cutPaper(c, rectPts(58, -432, 28, 60, 2), mix(P.g2, P.paper, .3), { seed: 703, step: 12, shadow: false, grain: .08 });    // 烟囱
  for (const [x, y] of [[-72, -270], [18, -270], [-72, -170], [18, -170]]) {                                              // 4 扇窗：深色纸衬在洞后
    cutPaper(c, rectPts(x, y, 56, 70, 2), mix(P.night3, P.ink, .2), { seed: 710 + (x + y | 0), step: 10, shadow: false, grain: .04 });
    rline(c, [[x + 28, y], [x + 28, y + 70]], { w: 3, color: body, seed: 720, amp: .3 }); rline(c, [[x, y + 35], [x + 56, y + 35]], { w: 3, color: body, seed: 721, amp: .3 });
  }
  cutPaper(c, rectPts(-26, -110, 52, 110, 2), mix(P.g3, P.ink2, .35), { seed: 730, step: 12, shadow: false, grain: .08 });     // 门
  c.fillStyle = P.moon; c.beginPath(); c.arc(14, -56, 4.5, 0, TAU); c.fill();
  rline(c, [[-115, -326], [115, -326]], { w: 2, color: line, seed: 731, amp: .4 });
}
function fxPopTree(c) {
  const trunk = mix(P.g3, P.paper, .15), leaf = mix(P.green, P.paper, .38), leaf2 = mix(P.green, P.g2, .5);
  cutPaper(c, [[-18, 0], [-16, -150], [16, -150], [18, 0]], trunk, { seed: 740, step: 14, shadow: false, grain: .1 });
  rline(c, [[-4, -10], [-3, -120]], { w: 2, color: alpha(P.ink2, .4), seed: 741, amp: .5 });
  for (const [i, [x, y, r, col]] of [[-62, -255, 80, leaf2], [62, -255, 80, leaf2], [0, -325, 86, leaf]].entries()) {
    cutPaper(c, circPts(x, y, r, 28), col, { seed: 745 + i, step: 12, shadow: false, grain: .1 });
    rline(c, circPts(x, y, r - 22, 18).slice(2, 10), { w: 2, color: alpha(P.ink2, .3), seed: 750 + i, amp: .6 });   // 叶面上一道剪痕
  }
}
function fxPopGirl(c, t, ts, ok) {
  const sm_ = ok ? sm(ts, ts + .15, t) : 0;
  drawPatchouli(c, { x: 0, y: 0, h: 490, facing: -1, pose: 'stand', mood: sm_ > .5 ? 'smug' : 'surprised', t, blink: blinkAt(t, 3) });
}

// ---- 一个纸件：投影在平面层画（下面），本体经仿射画在透视层之上
function fxPopShadow(c, sp, a) {
  if (a < .03) return;
  const [Lx, Ly] = FX_POP.light, ca = Math.cos(a), sa = Math.sin(a);
  c.fillStyle = FX_POP.colors.shadow;
  for (const poly of fxPopShapes[sp.id]) {
    c.beginPath(); poly.forEach(([lx, ly], i) => { const hh = -ly * sa, x = sp.X + lx + hh * Lx, y = sp.Y + ly * ca + hh * Ly; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fill();
  }
}
function fxPopCard(c, sp, a, t) {
  c.save(); c.transform(...fxPopM(sp, a));
  if (sp.id === 'house') fxPopHouse(c); else if (sp.id === 'tree') fxPopTree(c); else fxPopGirl(c, t, sp.t0 + .54, true);
  c.restore();
}

// ---- 书（平面层，画在 tiltPlane 的缓冲里）
function fxPopBook(c, angles) {
  const { w, h, x0, y0 } = FX_POP.page, C = FX_POP.colors, x1 = x0 + 2 * w, y1 = y0 + h, m = 28;
  cutPaper(c, rectPts(x0 - m, y0 - m, 2 * w + 2 * m, h + 2 * m, 14), C.cover, { seed: 800, step: 40, shadow: false, grain: .14 });
  rline(c, rectPts(x0 - m + 12, y0 - m + 12, 2 * w + 2 * m - 24, h + 2 * m - 24, 8), { w: 2, color: alpha(P.moon, .5), close: true, seed: 801, amp: .5 });
  for (let k = 3; k >= 1; k--) {                                                    // 页叠：三层偏移的纸边
    cutPaper(c, rectPts(x0 - 7 * k, y0 + 3 * k, 2 * w + 14 * k, h + 5 * k, 3), mix(P.paper, P.g1, .2 * k), { seed: 810 + k, step: 40, shadow: false, grain: .06, edge: false });
  }
  for (const [px, k] of [[x0, 0], [x0 + w, 1]]) {
    cutPaper(c, rectPts(px, y0, w, h, 2), P.paper, { seed: 820 + k, step: 40, shadow: false, grain: .1 });
    for (let r = 0; r < 3; r++) rline(c, [[px + 60, y0 + 56 + r * 30], [px + w - 60 - (r === 2 ? 180 : 0), y0 + 56 + r * 30]], { w: 3, color: alpha(P.g2, .55), seed: 830 + k * 3 + r, amp: .5 });   // 版心的几行字
  }
  // 书脊处的阶梯暗带（硬边，不用渐变）
  for (const [bw, al] of [[70, .05], [42, .06], [20, .08]]) { c.fillStyle = `rgba(40,25,35,${al})`; c.fillRect(CX - bw, y0, bw * 2, h); }
  rline(c, [[CX, y0 - 2], [CX, y1 + 2]], { w: 3, color: alpha(P.ink, .5), seed: 840, amp: .4 });
  // 剪洞、折痕、粘片
  FX_POP.pieces.forEach((sp, i) => {
    const poly = fxPopOutline[sp.id].map(([lx, ly]) => [sp.X + lx, sp.Y + ly]);
    c.fillStyle = C.hole; c.beginPath(); fxPopOutline[sp.id].forEach(([lx, ly], j) => { const x = sp.X + lx, y = sp.Y + ly; j ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.fill();
    rline(c, poly, { w: 2, color: alpha(P.ink, .35), close: true, seed: 860 + i, amp: .4 });
  });
  c.save(); c.beginPath(); c.rect(x0, y0, 2 * w, h); c.clip();                  // 投影只落在书页上，不越过书边
  FX_POP.pieces.forEach((sp, i) => fxPopShadow(c, sp, angles[i]));
  c.restore();
  FX_POP.pieces.forEach((sp, i) => {
    cutPaper(c, rectPts(sp.X - sp.w / 2 - 4, sp.Y, sp.w + 8, 30, 3), C.kraft, { seed: 870 + i, step: 14, shadow: false, grain: .1 });                          // 牛皮纸粘片
    rline(c, [[sp.X - sp.w / 2 - 28, sp.Y], [sp.X + sp.w / 2 + 28, sp.Y]], { w: 2.4, color: alpha(P.ink, .55), dash: [14, 9], seed: 880 + i, amp: .4 });          // 折痕
  });
}

// ---- 桌面：木色 + 沿透视收拢的木板缝
function fxPopDesk(c) {
  c.fillStyle = WOOD; c.fillRect(0, 0, W, H);
  for (let k = -5; k < 9; k++) {
    const xa = k * 520 - 700, xb = xa + 520, q = [fxPopP(xa, -900), fxPopP(xb, -900), fxPopP(xb, 1700), fxPopP(xa, 1700)].map(p => [p[0], p[1]]);
    cutPaper(c, q, mix(WOOD, '#47342a', hash(k, 4) * .7), { seed: 900 + k, step: 80, shadow: false, grain: .08, edge: false });
  }
  for (let k = -5; k <= 9; k++) { const xa = k * 520 - 700; rline(c, [fxPopP(xa, -900), fxPopP(xa, 1700)].map(p => [p[0], p[1]]), { w: 3, color: 'rgba(8,4,6,.5)', seed: 920 + k, amp: .6 }); }
  grain(c, polyPath(rectPts(0, 0, W, H)), .1);
}

function fxPopDraw(c, t) {
  const { w, h, x0, y0 } = FX_POP.page, V = FX_POP.view, Wb = FX_POP.wobble, ps = FX_POP.pieces;
  // 各纸件此刻的角度：自己的立起曲线 + 后来者冲到顶点时的抖动
  const angles = ps.map((sp, i) => {
    let a = fxPopAngle(t, sp.t0);
    for (let j = i + 1; j < ps.length; j++) { const dt = t - (ps[j].t0 + .54); if (dt > 0 && a > 1.4) a += Wb.amp * Math.exp(-dt * Wb.k) * Math.sin(dt * Wb.hz); }
    return a;
  });
  fxPopDesk(c);
  // 书在桌上的投影（单层硬边，朝右下）
  const sh = rectPts(x0 - 28 + 18, y0 - 28 + 24, 2 * w + 56, h + 56, 12).map(([x, y]) => fxPopP(x, y));
  c.fillStyle = 'rgba(8,4,6,.42)'; c.fill(polyPath(sh.map(p => [p[0], p[1]])));
  tiltPlane(c, b => fxPopBook(b, angles), { pitch: V.pitch, cx: V.cx, cy: V.cy, f: V.f });
  // 书厚：近边下垂的皮面
  const a0 = fxPopP(x0 - 28, y0 + h + 28), a1 = fxPopP(x0 + 2 * w + 28, y0 + h + 28);
  cutPaper(c, [[a0[0], a0[1]], [a1[0], a1[1]], [a1[0], a1[1] + 24], [a0[0], a0[1] + 24]], mix(FX_POP.colors.cover, P.ink, .4), { seed: 930, step: 60, shadow: false, grain: .1, edge: false });
  // 纸件：远的先画
  ps.map((sp, i) => [sp, i]).sort((a, b) => a[0].Y - b[0].Y).forEach(([sp, i]) => fxPopCard(c, sp, angles[i], t));
  // 「啪」：冲到顶点那一刻冒出，0.5 秒淡掉
  ps.forEach((sp, i) => {
    const dt = t - (sp.t0 + .54); if (dt < 0 || dt > .6) return;
    const k = easeOut(clamp(dt / .12, 0, 1)), al = 1 - sm(.25, .6, dt), [bx, by] = sp.boom, T = fxPopP(sp.X + bx, sp.Y + by, 80), s = 1 + .35 * (1 - k);
    c.save(); c.translate(T[0], T[1]); c.rotate(i % 2 ? .12 : -.12); c.scale(s, s);
    zh(c, '啪', 0, 0, { size: 84, color: P.ink, align: 'center', base: 'middle', al, weight: 700 });
    for (let q = 0; q < 3; q++) { const th = -2.5 + q * .55 + (i % 2) * .4 * 0, r0 = 54 + k * 6, r1 = r0 + 22 * k; rline(c, [[Math.cos(th) * r0, Math.sin(th) * r0], [Math.cos(th) * r1, Math.sin(th) * r1]], { w: 4, color: alpha(P.ink, al), seed: 940 + i * 3 + q, amp: .3 }); }
    c.restore();
  });
}

FX.add({ id: 'popup-stand', title: '立体书纸件从折痕啪地立起', src: '第 1 集 运动段', dur: 9, bg: 'none', draw: fxPopDraw });
