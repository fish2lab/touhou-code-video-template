'use strict';
// pinwheel-tiles · 冰块按风车形一块块落进蓝格板，累加吃掉的边数，最后故意错位一块给你看冲突
// 出处：第 5 集 风车段（第 5 集 src/scenes/2-pinwheel.js:1-190 风车摆法与冰块节拍、5/src/lake.js:16-110 湖板/洞/冰块、5/src/scenes/1-edges.js 数边计数）
// 好在哪：9×9 的蛛网格板厚 12 像素（深水纸垫在下面），9 个洞按风车位置排开；12 块白冰纸各带 ±1.6 像素手抖的剪口和 8 像素深蓝侧面，
//   中间四块 3×3 每隔 0.5 秒下落 0.42 秒（前 25% 淡入），落地压扁 6% 再弹起 14 像素，整张板跟着以 5 像素振幅弹跳（衰减 e^-9s、频率 26）；边上八块每隔 0.24 秒接着落。
//   每块落下时它吃到的洞边从洞口画出一道金线（中间四块各 4 条，边上八块各 2 条，共 32 条，边数由代码按几何算出），左边的数字同步弹出：块数 1→12、边数 4→32，再写「4 块 × 4 条 = 16」「8 块 × 2 条 = 16」。
//   最后底部那块抬起、上滑一格、落下，压住 3 格（金色斜线抖 0.9 秒、板子晃），再抬起滑回，冲突数字消失。
// 复用：改 FX_PIN.holes（9 个洞的格子）和 FX_PIN.tiles（[行,列,高,宽] 加类型），时间在 land 里；吃边数由 fxPinEdges 自动重算。要换成别的铺法，只改这两个表。
//   misplace 里的 tile 下标和 5.5–7.6 秒的时间换成别的块，就能展示别的冲突。
// 分叉：1) 板的格数 n 与格宽 cell（9×9 换成 6×6 讲小棋盘）；2) 冰块与板的两种颜色（冰蓝换成木色做拼板、换成榻榻米色做铺地）；3) 强调色 FX_PIN.gold（边数标记与冲突斜线）换别的单色。

const FX_PIN = {
  cell: 84, n: 9, cx: 1020, cy: 500, rise: 12,
  holes: [[0, 2], [1, 5], [2, 8], [3, 1], [4, 4], [5, 7], [6, 0], [7, 3], [8, 6]],
  // [行, 列, 高, 宽, 类型]：前四块是中间的 3×3（顺时针：上右下左），后八块是边上（从左上起顺时针）
  tiles: [[1, 2, 3, 3, 'c'], [2, 5, 3, 3, 'c'], [5, 4, 3, 3, 'c'], [4, 1, 3, 3, 'c'],
    [0, 0, 3, 2, 'e'], [0, 3, 1, 3, 'e'], [0, 6, 2, 3, 'e'], [3, 8, 3, 1, 'e'], [6, 7, 3, 2, 'e'], [8, 0, 1, 6, 'e'], [7, 0, 1, 3, 'e'], [3, 0, 3, 1, 'e']],
  land: [1.0, 1.5, 2.0, 2.5, 3.1, 3.34, 3.58, 3.82, 4.06, 4.3, 4.54, 4.78], fall: .42,
  mis: { tile: 2, lift: [5.5, 5.8], up: [5.8, 6.1], hold: [6.15, 7.05], down: [7.1, 7.45], land: 7.5 },
  clear: 8.3,
  col: { board: '#9fc3da', side: '#6f9ab5', water: '#2b4a63', frost: '#f4fafd', ice: '#f7fbfd', iceSide: '#8fb4cc', gold: '#e2a928' },
  ran: { x: 1700, y: 1030, h: 600, facing: -1 },
  side: 100,
};
const fxPinG = (r, c) => [FX_PIN.cx + (c - (FX_PIN.n - 1) / 2) * FX_PIN.cell, FX_PIN.cy + (r - (FX_PIN.n - 1) / 2) * FX_PIN.cell];
const fxPinEase = u => u * u;

// 每块冰吃到的洞边：边对面那格落在冰里；贴岸的边（对面出界）吃不到
function fxPinEdges(tile) {
  const [r0, c0, h, w] = tile, out = [];
  FX_PIN.holes.forEach(([r, c]) => [['N', -1, 0], ['E', 0, 1], ['S', 1, 0], ['W', 0, -1]].forEach(([d, dr, dc]) => {
    const rr = r + dr, cc = c + dc; if (rr >= r0 && rr < r0 + h && cc >= c0 && cc < c0 + w) out.push([r, c, d]);
  }));
  return out;
}
const fxPinEat = FX_PIN.tiles.map(fxPinEdges);   // 中间四块各 4 条，边上八块各 2 条，共 32

// 缓存的剪刀轮廓
const fxPinCut = {
  tile: FX_PIN.tiles.map((t, i) => scissor(rectPts(-t[3] * 42 + 3, -t[2] * 42 + 3, t[3] * 84 - 6, t[2] * 84 - 6, 4), 7200 + i, 14, 1.6)),
  board: scissor(rectPts(FX_PIN.cx - 378, FX_PIN.cy - 378, 756, 756, 5), 7230, 36, 1.2),
  water: scissor(rectPts(FX_PIN.cx - 400, FX_PIN.cy - 400, 800, 800, 6), 7231, 40, 1.4),
  hole: FX_PIN.holes.map(([r, c], i) => { const [x, y] = fxPinG(r, c); return wobble(circPts(x, y, 21, 18), 7240 + i, 1.2); }),
};
const fxPinBeat = (t, a, A, k = 9, f = 26) => { const s = t - a; return s > 0 ? A * Math.exp(-k * s) * Math.sin(f * s) : 0; };

// 整张板的弹跳：每块落地一次，错位的两次更大
function fxPinBounce(t) {
  let b = 0; FX_PIN.land.forEach((l, i) => { b += fxPinBeat(t, l, FX_PIN.tiles[i][4] === 'c' ? 5 : 3) * (1 - sm(FX_PIN.clear - .1, FX_PIN.clear + .1, t)); });
  return b + fxPinBeat(t, FX_PIN.mis.hold[0], 6) + fxPinBeat(t, FX_PIN.mis.land, 5);
}

function fxPinBoard(c) {
  const K = FX_PIN.col, T = FX_PIN.rise, x0 = FX_PIN.cx - 378, y0 = FX_PIN.cy - 378;
  fxPinPaper(c, fxPinCut.water, K.water, { sx: 7, sy: 10 });
  // 板的厚边：深蓝副本逐像素下移
  for (let o = T; o >= 2; o -= 2) { c.fillStyle = K.side; c.fill(polyPath(fxPinCut.board.map(p => [p[0] + o * .15, p[1] + o]))); }
  fxPinPaper(c, fxPinCut.board, K.board, { sa: 0, gr: .12 });
  for (let k = 1; k < FX_PIN.n; k++) {
    rline(c, [[x0 + k * 84, y0], [x0 + k * 84, y0 + 756]], { w: 2.2, color: alpha(K.frost, .55), seed: 7250 + k, amp: .6 });
    rline(c, [[x0, y0 + k * 84], [x0 + 756, y0 + k * 84]], { w: 2.2, color: alpha(K.frost, .55), seed: 7270 + k, amp: .6 });
  }
  FX_PIN.holes.forEach(([r, col], i) => {
    const [x, y] = fxPinG(r, col);
    c.fillStyle = alpha(K.frost, .95); c.beginPath(); c.arc(x, y, 25, 0, TAU); c.fill();
    c.fillStyle = K.water; c.fill(polyPath(fxPinCut.hole[i]));
    c.fillStyle = alpha('#6f93ad', .55); c.beginPath(); c.arc(x - 7, y - 7, 4.5, 0, TAU); c.fill();
  });
}

// 一片剪好的纸：硬偏移投影 + 纸纹 + 亮边
function fxPinPaper(c, pts, color, o = {}) {
  const { sx = 4, sy = 6, sa = .28, gr = .1, al = 1 } = o, path = polyPath(pts);
  c.save(); c.globalAlpha *= al;
  if (sa > 0) { c.fillStyle = `rgba(30,20,35,${sa})`; c.fill(polyPath(pts.map(p => [p[0] + sx, p[1] + sy]))); }
  c.fillStyle = color; c.fill(path); if (gr) grain(c, path, gr);
  c.strokeStyle = alpha(mix(color, '#ffffff', .5), .55); c.lineWidth = 1; c.stroke(path); c.restore(); return path;
}

// 一块冰：i 号，dy 相对落点的高度（负=在空中），rot，sq 压扁，z 抬起高度（投影放大），al 透明度
function fxPinTile(c, i, o) {
  const t = FX_PIN.tiles[i], K = FX_PIN.col, [r, col, h, w] = t, [x1, y1] = fxPinG(r, col), cx = x1 + (w - 1) * 42, cy = y1 + (h - 1) * 42 + o.ey, pts = fxPinCut.tile[i];
  const air = -o.dy + o.z;                                   // 离板高度
  c.save(); c.globalAlpha *= o.al;
  c.save(); c.translate(cx, cy); c.globalAlpha *= clamp(1 - air / 500, .25, 1);
  c.fillStyle = 'rgba(30,20,35,.26)'; c.fill(polyPath(pts.map(p => [p[0] + 4 + air * .08, p[1] + 6 + air * .16]))); c.restore();
  c.translate(cx, cy + o.dy - o.z); c.rotate(o.rot); c.scale(1 + o.sq * .5, 1 - o.sq);
  for (let d = 8; d >= 2; d -= 2) { c.fillStyle = K.iceSide; c.fill(polyPath(pts.map(p => [p[0], p[1] + d]))); }
  const path = fxPinPaper(c, pts, K.ice, { sa: 0, gr: .08 });
  // 冰面两道手画的浅裂纹
  c.save(); c.clip(path);
  const hw = w * 42, hh = h * 42;
  rline(c, [[-hw * .5, -hh * .3], [-hw * .1, -hh * .45], [hw * .2, -hh * .2]], { w: 3, color: '#bcd6e6', seed: 7300 + i, amp: .6 });
  rline(c, [[hw * .1, hh * .5], [hw * .4, hh * .25], [hw * .6, hh * .35]], { w: 3, color: '#bcd6e6', seed: 7320 + i, amp: .6 });
  c.restore(); c.restore();
}

// 每块冰此刻的状态；错位那块额外抬起、上滑
function fxPinState(i, t) {
  const F = FX_PIN, L = F.land[i], s = t - L, u = clamp((t - (L - F.fall)) / F.fall, 0, 1);
  const clearK = F.tiles.length - 1 - i, cu = clamp((t - (F.clear + clearK * .06)) / .5, 0, 1);
  let dy = -240 * (1 - fxPinEase(u)), rot = (hash(i, 7330) - .5) * .24 * (1 - u), sq = 0, z = 0, al = clamp(u * 4, 0, 1) * (1 - cu);
  if (s > 0) { dy = -14 * Math.exp(-7 * s) * Math.abs(Math.sin(12 * s)) * (s < .5 ? 1 : 0); sq = .06 * Math.exp(-9 * s) * Math.cos(22 * s); }
  z += 70 * easeOut(cu);
  let ey = 0;
  if (i === F.mis.tile) {
    const M = F.mis, a = sm(M.up[0], M.up[1], t, v => easeOutBack(v, 1.5)), b = sm(M.down[0], M.down[1], t, v => easeOutBack(v, 1.5));
    ey = -84 * (a - b);
    z += 36 * sm(M.lift[0], M.lift[1], t, easeOut) - 36 * sm(6.05, 6.2, t) + 28 * sm(7.0, 7.2, t) - 28 * sm(7.38, 7.5, t, easeIn);
    const sl = M.land - t; if (sl < 0) sq += .06 * Math.exp(9 * sl) * Math.cos(-22 * sl);
  }
  return { dy, ey, rot: rot * (s > 0 ? 0 : 1), sq, z, al };
}

// 吃到的边：金线从洞口画出，落地时先粗一下
function fxPinEdgeMarks(c, t) {
  const F = FX_PIN, h = F.cell / 2;
  F.tiles.forEach((tile, i) => {
    const L = F.land[i], clearK = F.tiles.length - 1 - i, cu = clamp((t - (F.clear + clearK * .06)) / .4, 0, 1);
    let pres = sm(L, L + .3, t, v => v) * (1 - cu);
    if (i === F.mis.tile) pres *= 1 - sm(F.mis.up[0], F.mis.up[0] + .15, t) + sm(F.mis.down[1] - .1, F.mis.down[1] + .15, t);
    if (pres <= .01) return;
    fxPinEat[i].forEach(([r, col, d], k) => {
      const [x, y] = fxPinG(r, col), Lh = F.cell * .31, seg = { N: [[x - Lh, y - h], [x + Lh, y - h]], S: [[x - Lh, y + h], [x + Lh, y + h]], W: [[x - h, y - Lh], [x - h, y + Lh]], E: [[x + h, y - Lh], [x + h, y + Lh]] }[d];
      const fl = clamp(1 - (t - L) / .8, 0, 1) * (t >= L ? 1 : 0);
      if (fl > 0) rline(c, seg, { w: 8 + 14 * fl, color: '#f3c957', amp: .3, seed: 7340 + i * 4 + k, al: .55 * fl * pres });
      rline(c, seg, { w: 8, color: F.col.gold, amp: .3, seed: 7340 + i * 4 + k, p: sm(L, L + .25, t, v => v), al: pres });
    });
  });
}

// 冲突：被压住的三格画金色斜线
function fxPinConflict(c, t) {
  const M = FX_PIN.mis, a = win(M.hold[0], M.hold[1], t, .12) * (.6 + .3 * Math.sin((t - M.hold[0]) * 14)); if (a <= .02) return;
  [4, 5, 6].forEach(col => {
    const [x, y] = fxPinG(4, col), pts = rectPts(x - 42, y - 42, 84, 84), path = polyPath(pts);
    hatch(c, path, [x - 42, y - 42, 84, 84], { gap: 11, angle: -.8, color: FX_PIN.col.gold, w: 4, al: a, seed: 7360 + col });
    rline(c, pts, { w: 4, color: FX_PIN.col.gold, close: true, seed: 7370 + col, al: a });
  });
}

// 左边的数字：块数、边数、两条算式、合计、冲突
function fxPinNumbers(c, t) {
  const F = FX_PIN, X = F.side, fade0 = 1 - sm(F.clear, F.clear + .5, t);
  const done = F.land.map(l => t >= l), n = done.filter(Boolean).length;
  let m = 0, lt = -9; F.land.forEach((l, i) => { if (t >= l) { m += fxPinEat[i].length; lt = l; } });
  const conf = win(F.mis.hold[0] - .05, F.mis.land - .05, t, .12);
  if (n > 0) {
    const k = easeOutBack(clamp((t - lt) / .35, 0, 1), 2.4) * .3 + .7;
    c.save(); c.globalAlpha *= fade0;
    pop(c, X + 100, 280, k, () => zh(c, `${n} 块`, X, 300, { size: 120, weight: 700 }));
    pop(c, X + 100, 380, k, () => fade(c, 1 - conf, () => zh(c, `吃了 ${m} 条边`, X, 392, { size: 60 })));
    c.restore();
  }
  fade(c, conf * fade0, () => { zh(c, '冲突 3 格', X, 392, { size: 60 }); });
  const wr = (a, p) => sm(a, a + .6, t, v => v) * fade0;
  const f1 = sm(2.6, 3.2, t, v => v), f2 = sm(4.85, 5.45, t, v => v), f3 = sm(5.2, 5.6, t, v => v);
  c.save(); c.globalAlpha *= fade0;
  zh(c, '4 块 × 4 条 = 16', X, 500, { size: 52, p: f1 });
  zh(c, '8 块 × 2 条 = 16', X, 570, { size: 52, p: f2 });
  zh(c, '合计 32 条边', X, 670, { size: 60, weight: 700, p: f3 });
  rline(c, [[X, 692], [X + 330, 692]], { w: 8, color: F.col.gold, seed: 7380, p: sm(5.4, 5.8, t, v => v) });
  c.restore();
}

function fxPinRan(c, t) {
  const F = FX_PIN, point = t > .6 && t < 4.9, proud = win(4.9, 5.7, t, .2), awk = win(5.9, 7.7, t, .2) > .5;
  let g = .55; F.land.forEach(l => { g += .3 * Math.exp(-6 * Math.max(0, t - l)) * (t >= l ? 1 : 0); });
  const talk = [[.6, 2.4], [3.0, 4.8], [4.9, 5.7], [8.0, 9.0]], sp = talk.some(([a, b]) => t >= a && t < b) ? .15 + .55 * Math.abs(Math.sin(t * 13)) : 0;
  drawRan(c, { ...F.ran, pose: point ? 'point' : 'stand', gesture: clamp(g, 0, 1), mood: awk ? 'awkward' : proud > .3 ? 'proud' : 'normal', tails: .3 + .7 * proud, mouth: sp, blink: blinkAt(t, 2), t });
}

function fxPinDraw(c, t) {
  const F = FX_PIN, shake = 5 * Math.sin((t - F.mis.hold[0]) * 48) * win(F.mis.hold[0], F.mis.hold[1] - .1, t, .2);
  fxPinNumbers(c, t);
  c.save(); c.translate(shake, fxPinBounce(t));
  fxPinBoard(c);
  // 先画远处（行小）的冰，后画近处的；错位那块在最上面
  F.tiles.map((_, i) => i).sort((a, b) => (a === F.mis.tile) - (b === F.mis.tile) || F.tiles[a][0] - F.tiles[b][0]).forEach(i => {
    if (t < F.land[i] - F.fall) return;
    const s = fxPinState(i, t); if (s.al > .005) fxPinTile(c, i, s);
  });
  fxPinEdgeMarks(c, t);
  fxPinConflict(c, t);
  c.restore();
  fxPinRan(c, t);
}

FX.add({ id: 'pinwheel-tiles', title: '冰块按风车形铺满蓝格板', src: '第 5 集 风车段', dur: 10, bg: 'paper', draw: fxPinDraw });
