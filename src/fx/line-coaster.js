'use strict';
// line-coaster · 一根手抖线立起来变成过山车线轨
// 出处：第 1 集 动力段（1/src/scenes/3-dopamine.js:1-330，线轨 s3Shape/s3V、小车 S3CAR、镜头 s3Chase、台阶与火花）
// 好在哪：纸上先只有一根从左写到右的墨线（2.2 秒），线随后从左到右依次「立起」成透视里的线轨（每点 1.4 秒，左右错开 0.5 秒），镜头固定，整条线轨完整落在 1920 宽内，
//   观众当场明白「横轴是时间、高度是数值」。基线下方的低谷用一块粉色剪纸（纸厚边 + 单层硬投影）表示，谷底是一条比基线低的纸片加一面露纸厚边的侧壁；小车（约 130 像素宽）滑下谷底再借势爬坡，
//   一条线上同时讲了「冲高、跌破基线、慢慢回升」三件事；整张图只有一种强调色（粉）。
// 复用：把 FX_LC.prof 换成自己的数据曲线 [[位置 0..1, 高度], ...]（高度向上为正、负值落在基线以下），
//   把 FX_LC.car 改成小车在各时刻走到的位置；在 scene 里用 FX.list.find(o => o.id === 'line-coaster').draw(c, tau)，嵌用时 tau 取 0..10。
// 分叉：① prof 的形状（例：心率先升后降、股价暴涨暴跌）；② accent 粉色谷（例：把谷换成红色赤字区、蓝色冷却区）；
//   ③ 车上的角色与 pose（例：换成琪露诺 drawCirno 的 fly 姿势，或把车换成纸船）。

const FX_LC = {
  N: 160, L: 3600,                       // 线轨采样数、纵深总长（世界单位）
  base2: 640, x0: 90, x1: 1830, k2: .28,  // 平面阶段：基线 y、线的左右端点、高度换成像素的系数
  // 高度曲线：位置 s（0..1）、高度（向上为正）；相邻两点之间用余弦缓动，每点处切线水平
  prof: [[0, 0], [.10, 0], [.30, 540], [.54, -450], [.62, -450], [.80, 160], [.92, 0], [1, 0]],
  write: [.35, 2.4],                     // 墨线从左写到右
  morph: [2.8, 1.4, .5],                 // 立起：起点秒、每点用时、从左到右的错开
  carS0: .06,
  // 小车位置 s 随时间（先退一小步蓄力 → 爬坡 → 峰顶停顿 → 俯冲 → 借势爬坡 → 停稳）
  car: [[0, .06], [3.9, .06], [4.25, .047, easeOut], [5.5, .30, easeIn], [5.75, .312, easeOut], [6.75, .55, easeIn], [8.0, .80, easeOut]],
  spark: [5.5, 7.85],                   // 两次火花：冲上峰顶、爬出山谷
  fadeOut: [9.1, 9.8],
  col: { ink: P.ink, base: P.g2, valley: mix(P.red, P.paper, .5), valleyEdge: mix(P.red, P.ink, .35), car: '#f1ece4' },
  cam: { off: [2000, 1700, -1800], f: 1250, focus: [1250, 640] },   // 固定镜头：相对线轨中点的位置、焦距、中点落在屏幕的位置
  carK: .52, wheel: 26,                  // 小车缩放（k 为透视比例时再乘 sqrt(k/.45)）、车轮底到车身底的距离
};

const fxLcLerpKey = (t, K) => {          // 带逐段缓动的关键帧：[t, v, ease?]
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b, e = easeIO] = K[i]; return lerp(a, b, e((t - t0) / (t1 - t0))); }
  return K.at(-1)[1];
};
function fxLcH(s) {                      // 线轨高度
  const P_ = FX_LC.prof; s = clamp(s, 0, 1);
  for (let i = 1; i < P_.length; i++) if (s <= P_[i][0]) { const [s0, a] = P_[i - 1], [s1, b] = P_[i]; return lerp(a, b, easeSine((s - s0) / (s1 - s0))); }
  return P_.at(-1)[1];
}
const fxLcX = s => 100 * Math.sin(s * 5.2);                       // 线轨缓缓蜿蜒
const fxLcZ = s => s * FX_LC.L;
const fxLcW = (s, h = fxLcH(s)) => [fxLcX(s), -h, fxLcZ(s)];       // 世界点（y 向下，所以高度取负）
// 固定镜头：在线轨右侧偏高处斜看，整条线轨落在 1920 宽内，近端在左下，远端向右上收窄
function fxLcCam() {
  const { off, f, focus: [FX, FY] } = FX_LC.cam, foc = [fxLcX(.5), -40, FX_LC.L * .5], pos = [foc[0] + off[0], -off[1], foc[2] + off[2]];
  const dx = foc[0] - pos[0], dy = foc[1] - pos[1], dz = foc[2] - pos[2], yaw = Math.atan2(dx, dz) - Math.atan((FX - CX) / f);
  const dz1 = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return { x: pos[0], y: pos[1], z: pos[2], yaw, pitch: Math.atan2(dy, dz1) - Math.atan((FY - CY) / f), f };
}
// 平面阶段的点（侧视图：左右是时间，上下是高度）
const fxLc2D = (i, h) => { const u = i / FX_LC.N; return [lerp(FX_LC.x0, FX_LC.x1, u), FX_LC.base2 - h * FX_LC.k2 + 4 * noise1(i * .35, 11)]; };

// 一帧里所有点的屏幕位置：line（墨线）、base（基线）、sl/sr（枕木左右端）、k（透视比例）、m（立起程度）
function fxLcGeom(t, cam) {
  const { N } = FX_LC, [m0, md, ms] = FX_LC.morph, g = { line: [], base: [], bl: [], br: [], sl: [], sr: [], k: [], m: [], h: [] };
  for (let i = 0; i <= N; i++) {
    const s = i / N, h = fxLcH(s), m = sm(m0 + ms * s, m0 + ms * s + md - ms, t, u => easeOutBack(u, 1.2)), mm = clamp(m, 0, 1.15);
    const a = proj(fxLcW(s, h), cam), b = proj(fxLcW(s, 0), cam), l = proj([fxLcX(s) - 130, -h, fxLcZ(s)], cam), r = proj([fxLcX(s) + 130, -h, fxLcZ(s)], cam), bL = proj([fxLcX(s) - 130, 0, fxLcZ(s)], cam), bR = proj([fxLcX(s) + 130, 0, fxLcZ(s)], cam);
    const p2 = fxLc2D(i, h), b2 = [p2[0], FX_LC.base2], mix2 = (q2, q3) => q3 ? [lerp(q2[0], q3[0], mm), lerp(q2[1], q3[1], mm)] : (m < .02 ? q2 : null);
    g.line.push(mix2(p2, a)); g.base.push(mix2(b2, b)); g.bl.push(mix2(b2, bL)); g.br.push(mix2(b2, bR)); g.sl.push(mix2(p2, l)); g.sr.push(mix2(p2, r));
    g.k.push(a ? lerp(.6, a[2], clamp(m, 0, 1)) : null); g.m.push(clamp(m, 0, 1)); g.h.push(h);
  }
  return g;
}
const fxLcAt = (arr, f) => { const i = clamp(Math.floor(f), 0, arr.length - 2), a = arr[i], b = arr[i + 1]; return a && b ? [lerp(a[0], b[0], f - i), lerp(a[1], b[1], f - i)] : null; };

// 一块粉色剪纸：硬边投影 + 纸厚边 + 纸纹
function fxLcPaper(c, pts, color, edge, seed) {
  const path = polyPath(pts.map((p, i) => [p[0] + 1.6 * noise1(i * .5, seed), p[1] + 1.6 * noise1(i * .5, seed + 3)]), true);
  c.save(); c.translate(5, 6); c.fillStyle = 'rgba(30,20,35,.26)'; c.fill(path); c.restore();
  c.save(); c.translate(0, 4); c.fillStyle = edge; c.fill(path); c.restore();
  c.fillStyle = color; c.fill(path); grain(c, path, .1);
  c.strokeStyle = alpha('#ffffff', .45); c.lineWidth = 1.2; c.stroke(path);
}

// 小车 + 帕秋莉（局部坐标：车底中心在原点，向右为前进，尺寸按 ks 缩放）
function fxLcCar(c, x, y, ang, ks, t, pop) {
  if (pop <= .01) return;
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(ks * pop, ks * pop); c.translate(0, -FX_LC.wheel);
  drawPatchouli(c, { x: 0, y: -62, h: 330, pose: 'sit', mood: t > 5.4 && t < 7.2 ? 'surprised' : 'smile', t, blink: blinkAt(t, 5) });
  const body = [[-132, -108], [138, -108], [124, -22], [96, 0], [-96, 0], [-124, -22]];
  rshape(c, body, { fill: FX_LC.col.car, stroke: P.ink, w: 5, seed: 71, amp: 1.2 });
  grain(c, polyPath(body), .1);
  rline(c, [[-112, -86], [118, -86]], { w: 3, color: P.faint, seed: 72 });
  for (const wx of [-72, 72]) { rshape(c, circPts(wx, 6, 24, 20), { fill: P.ink2, stroke: P.ink, w: 4, seed: 73 + wx }); rline(c, [[wx - 10, 6], [wx + 10, 6]], { w: 3, color: P.paper, seed: 75 }); }
  c.restore();
}

// 火花：从车尾轮子处向车后方喷出，墨色短线 + 四角星（避开帕秋莉的脸）；back 为车后方的屏幕角度
function fxLcSparks(c, x, y, back, ks, u, seed) {
  if (u <= 0 || u >= 1) return;
  const r = rng(808 + seed * 17);
  for (let k = 0; k < 14; k++) {
    const a = back + (r() - .5) * 1.2 + .25 * (r() - .5), v = (150 + r() * 220) * (ks / .5), d = u * (1 - .35 * u);
    const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d + 140 * u * u * (.5 + r()), life = 1 - u, L = (12 + r() * 18) * (ks / .5);
    if (k % 3 === 0) { c.save(); c.globalAlpha *= life; c.fillStyle = P.ink; c.fill(polyPath(starPts(px, py, (9 + r() * 10) * (ks / .5), 4, .28, r() * 1.2))); c.restore(); }
    else rline(c, [[px, py], [px + Math.cos(a) * L * life, py + Math.sin(a) * L * life]], { w: 4, color: P.ink, seed: 900 + k, al: life, amp: .4 });
  }
}

FX.add({
  id: 'line-coaster', title: '一根线立起来变成过山车', src: '第 1 集 动力段', dur: 10, bg: 'paper',
  draw(c, t) {
    const { N, col } = FX_LC, sCar = fxLcLerpKey(t, FX_LC.car), camU = fxLcCam();
    const g = fxLcGeom(t, camU), fade_ = 1 - sm(FX_LC.fadeOut[0], FX_LC.fadeOut[1], t);
    if (fade_ <= 0) return;
    c.save(); c.globalAlpha *= fade_;
    const wp = clamp((t - FX_LC.write[0]) / (FX_LC.write[1] - FX_LC.write[0]), 0, 1), wE = easeIO(wp);
    // 1. 粉色山谷：基线以下那一段，写完线后从基线「垂」下来；立起后是谷底一条纸 + 近侧一面露着纸厚边的侧壁
    const gv = sm(2.45, 3.1, t, u => easeOutBack(u, 1.4));
    let i0 = -1, i1 = -1; g.h.forEach((h, i) => { if (h < -1) { if (i0 < 0) i0 = i; i1 = i; } });
    if (gv > 0 && i0 >= 0) {
      const a = Math.max(0, i0 - 1), b = Math.min(N, i1 + 1), fl = [], fr = [], top = [];
      const dn = (B, S_) => [lerp(B[0], S_[0], gv), lerp(B[1], S_[1], gv)];
      for (let i = a; i <= b; i++) { if (!g.br[i] || !g.sr[i] || !g.bl[i] || !g.sl[i]) continue; top.push(g.br[i]); fr.push(dn(g.br[i], g.sr[i])); fl.push(dn(g.bl[i], g.sl[i])); }
      if (top.length > 3) {
        if (g.m[(i0 + i1) >> 1] > .15) fxLcPaper(c, [...fl, ...fr.slice().reverse()], mix(col.valley, P.paper, .4), col.valleyEdge, 43);
        fxLcPaper(c, [...top, ...fr.slice().reverse()], col.valley, col.valleyEdge, 41);
      }
    }
    // 2. 基线（灰色虚线）和立柱
    const pieces = (arr, i0_, i1_) => { const out = []; let cur = []; for (let i = i0_; i <= i1_; i++) { if (arr[i]) cur.push(arr[i]); else { if (cur.length > 1) out.push(cur); cur = []; } } if (cur.length > 1) out.push(cur); return out; };
    const bp = clamp((t - 1.3) / .9, 0, 1);
    for (const seg of pieces(g.base, 0, N)) rline(c, seg, { w: 3, color: col.base, dash: [18, 14], p: bp, seed: 51, amp: .8 });
    for (let i = 8; i < N; i += 8) if (Math.abs(g.h[i]) > 40 && g.line[i] && g.base[i] && g.m[i] > .3)
      rline(c, [g.line[i], g.base[i]], { w: 1.6, color: P.ink2, al: .45 * g.m[i], seed: 60 + i, amp: .5 });
    // 3. 枕木（越靠后越先画）
    for (let i = N; i >= 4; i -= 2) if (g.sl[i] && g.sr[i] && g.m[i] > .05 && i / N <= wE + 1e-6)
      rline(c, [g.sl[i], g.sr[i]], { w: clamp(5 * (g.k[i] || .3), 1.4, 6), color: P.ink2, al: .75 * g.m[i], seed: 100 + i, amp: .5 });
    // 4. 墨线本体：近粗远细，分段画；写的时候按进度画出
    const CH = 8, nch = Math.ceil(N / CH);
    for (let j = nch - 1; j >= 0; j--) {
      const a = j * CH, b = Math.min(N, a + CH), seg = []; for (let i = a; i <= b; i++) if (g.line[i]) seg.push(g.line[i]);
      const pj = clamp(wE * nch - j, 0, 1); if (seg.length > 1 && pj > 0) rline(c, seg, { w: clamp(11 * (g.k[a] || .6), 2.4, 12), color: col.ink, p: pj, seed: 7 + j, amp: lerp(1.8, 1.0, g.m[a]) });
    }
    if (wp > 0 && wp < 1) { const q = fxLcAt(g.line, wE * N); if (q) { c.fillStyle = col.ink; c.beginPath(); c.arc(q[0], q[1], 7, 0, TAU); c.fill(); } }
    // 5. 小车
    const ic = sCar * N, qc = fxLcAt(g.line, ic), q2 = fxLcAt(g.line, ic + 1.5), q0 = fxLcAt(g.line, ic - 1.5);
    if (qc && q2 && q0) {
      const ang = Math.atan2(q2[1] - q0[1], q2[0] - q0[0]), kc = lerp(.4, FX_LC.carK * Math.sqrt((g.k[Math.round(ic)] || .45) / .45), g.m[Math.round(ic)]);
      const pop = sm(2.2, 2.8, t, u => easeOutBack(u, 2));
      fxLcCar(c, qc[0], qc[1], ang, kc, t, pop);
      const back = Math.atan2(q0[1] - qc[1], q0[0] - qc[0]);
      fxLcSparks(c, qc[0], qc[1], back, kc, (t - FX_LC.spark[0]) / 1.0, 1);
      fxLcSparks(c, qc[0], qc[1], back, kc, (t - FX_LC.spark[1]) / 1.0, 2);
    }
    c.restore();
  },
});
