'use strict';
// fold-bits · 一张写着 8 个字的纸对折 3 次，折完再变成填字概率条
// 出处：第 3 集 比特段与猜字段（第 3 集 src/scenes/2-bits.js:35-100 s2Proj/s2Flap 透视对折、S2FOLD 折叠节拍；3/src/scenes/1-guess.js:101-113 s1Panel 概率条）
// 好在哪：一张 1000×500 的纸分 8 格，3 次折叠各用 0.4 秒蓄一下（先微微翘起 0.2 弧度、停 0.2 秒，再甩过去），透视焦距 1500，翻起的半张随角度缩进消失点；
//   折叠时纸堆厚度按 2.2×2^(折数) 像素累加，折 3 次叠成 8 层、17.6 像素厚，侧面每层一道墨线，落定时纸堆下沉 8 像素再弹回；每次折完候选数 8→4→2→1，手写「1/2/3 比特」随之弹出。
//   后半段 8 张字卡飞出来排成一行，8 根概率条随两条提示一次次改高：无提示各 12.5%，加「前半句」后霜升到 30%，加「押 ang 韵」后霜升到 78%、其余缩到 1% 至 12%，条带过冲弹性。
// 复用：改 FX_FOLD.cells 的 8 个字和 FX_FOLD.ans（答案下标，必须在第二行第二格才对得上折叠顺序）；改 FX_FOLD.hints 两条提示的出场时刻、文字和概率；折叠节拍改 FX_FOLD.folds 里的 c0/s0/u0 等秒数。
//   整体用 FX.list.find(o => o.id === 'fold-bits').draw(c, t) 嵌进别的场景，帕秋莉的站位改 FX_FOLD.pch。
// 分叉：1) 换题材：8 个候选字换成别的 8 个选项（例如 8 种食物），提示换成对应的线索；2) 纸的尺寸与格数：cell 与 FX_FOLD.sheet 改成 16 格四次对折（要再加一条 fold 与一块 flap）；
//   3) 强调色 P.purple 换成别的单色，就能把「答案」从紫换成红或蓝。

const FX_FOLD = {
  sheet: [730, 280], F: 1500, V: [1230, 530], cell: 250,
  cells: ['光', '雪', '月', '水', '灯', '霜', '影', '冰'], ans: 5,
  pile: [[730, 280], [980, 280], [855, 280], [855, 155]],        // 每折完一次，纸堆在屏幕上的左上角
  stage: [[0, 0, 1000, 500], [0, 0, 500, 500], [250, 0, 250, 500], [250, 250, 250, 250]],   // 折 k 次后还留在原地的那块
  flap: [{ rect: [500, 0, 500, 500], ax: 'x', h: 500, sg: 1 }, { rect: [0, 0, 250, 500], ax: 'x', h: 250, sg: -1 }, { rect: [250, 0, 250, 250], ax: 'y', h: 250, sg: -1 }],
  crease: [[[500, 0], [500, 500]], [[250, 0], [250, 500]], [[250, 250], [500, 250]]],
  // c0/c1 折痕画出；lift 翘起；s0/s1 甩过去；sh0/sh1 纸堆挪到中央；u0/u1 展开退回（t=0 的样子）
  folds: [
    { c0: .7, c1: 1.15, lift: 1.15, s0: 1.4, s1: 1.8, sh0: 1.95, sh1: 2.4, u0: 6.0, u1: 6.5 },
    { c0: 2.45, c1: 2.85, lift: 2.9, s0: 3.1, s1: 3.45, sh0: 3.6, sh1: 4.0, u0: 5.9, u1: 6.4 },
    { c0: 4.05, c1: 4.4, lift: 4.45, s0: 4.65, s1: 5.0, sh0: 5.15, sh1: 5.55, u0: 5.8, u1: 6.3 }],
  count: [{ t: 1.95, text: '1 比特' }, { t: 3.6, text: '2 比特' }, { t: 5.1, text: '3 比特' }], countEnd: 6.5,
  left: [{ t: .5, text: '共 8 个候选字' }, { t: 2.0, text: '还剩 4 个' }, { t: 3.65, text: '还剩 2 个' }, { t: 5.15, text: '还剩 1 个' }, { t: 6.0, text: '共 8 个候选字' }], leftEnd: 6.7,
  morph: [6.55, 11.15],                                         // 字卡飞出、飞回的起点
  card: { y: 860, gap: 150, w: 130, h: 120 },
  bar: { base: 790, w: 76, max: 520, grow: 7.4 },
  sentence: { x: 1230, y: 270, size: 84, prefix: '床前明月光，', body: '疑是地上', t0: 7.0, prefixT: 8.2, ansT: 10.5 },
  hints: [
    { t: 7.2, text: '没有提示，8 个字机会均等', p: [.125, .125, .125, .125, .125, .125, .125, .125] },
    { t: 8.2, text: '提示一：前半句是「床前明月光」', p: [.16, .10, .22, .05, .05, .30, .08, .04], r0: 8.5 },
    { t: 9.4, text: '提示二：这一句的字要押 ang 韵', p: [.12, .02, .01, .02, .02, .78, .01, .02], r0: 9.7 }],
  hintEnd: 11.2,
  pch: { x: 300, y: 1010, h: 540 },
  col: { sheet: '#f8f3e6', card: '#f4efe2' },
};

// ---------- 缓存的剪刀轮廓（局部坐标，只剪一次，之后每帧只变换，边缘不抖）----------
const fxFoldCut = {
  stage: FX_FOLD.stage.map((r, i) => scissor(rectPts(r[0], r[1], r[2], r[3], 3), 7100 + i, 30, .7)),
  flap: FX_FOLD.flap.map((f, i) => scissor(rectPts(f.rect[0], f.rect[1], f.rect[2], f.rect[3], 3), 7110 + i, 30, .7)),
  card: FX_FOLD.cells.map((_, i) => scissor(rectPts(-65, -60, 130, 120, 3), 7120 + i, 20, .9)),
  bar: FX_FOLD.cells.map((_, i) => [0, 1, 2, 3, 4, 5, 6, 7].map(k => (hash(k + i * 9, 7130) - .5) * 2.4)),
};

// 一片剪纸：点已经是剪好的；硬偏移投影（不模糊）+ 纸纹 + 亮边
function fxPaper(c, pts, color, o = {}) {
  const { sx = 4, sy = 5, al = 1, gr = .1, sa = .26 } = o, path = polyPath(pts);
  c.save(); c.globalAlpha *= al;
  if (sa > 0) { c.fillStyle = `rgba(30,20,35,${sa})`; c.fill(polyPath(pts.map(p => [p[0] + sx, p[1] + sy]))); }
  c.fillStyle = color; c.fill(path); if (gr) grain(c, path, gr);
  c.strokeStyle = alpha(mix(color, '#ffffff', .45), .55); c.lineWidth = 1; c.stroke(path);
  c.restore(); return path;
}

// ---------- 时间轴 ----------
// 第 k 折此刻的角度：翘起 0.2 弧度 → 蓄一下 → 二次加速甩到 π/2 → 0.12 秒翻到 π；展开时按 u0..u1 退回 0
function fxFoldTheta(k, t) {
  const f = FX_FOLD.folds[k];
  const th = .2 * sm(f.lift, f.lift + .25, t, easeOut) + (Math.PI / 2 - .2) * sm(f.s0, f.s1, t, u => u * u) + Math.PI / 2 * sm(f.s1, f.s1 + .12, t, u => u);
  return th * (1 - sm(f.u0, f.u1, t));
}
function fxFoldPile(t) {   // 纸堆左上角（含落定时的下沉回弹）
  const F = FX_FOLD, d = F.pile; let x = d[0][0], y = d[0][1];
  F.folds.forEach((f, k) => {
    const s = sm(f.sh0, f.sh1, t) - sm(f.u0, f.u1, t);
    x += s * (d[k + 1][0] - d[k][0]); y += s * (d[k + 1][1] - d[k][1]);
    const b = t - (f.s1 + .1); if (b > 0) y += 8 * Math.exp(-6 * b) * Math.sin(18 * b) * (1 - sm(f.u0 - .1, f.u0 + .1, t));
  });
  return [x, y];
}
const fxMorph = (i, t) => sm(FX_FOLD.morph[0] + .04 * i, FX_FOLD.morph[0] + .04 * i + .55, t) * (1 - sm(FX_FOLD.morph[1] + .03 * i, FX_FOLD.morph[1] + .03 * i + .5, t));
const fxSheetAl = t => 1 - sm(6.75, 7.2, t) + sm(11.5, 11.9, t);
const fxCardsOn = t => t >= 6.5 && t < 11.95;

// 翻起的半张：点 (lx,ly) 绕折线转 th（向纸后面折），再按透视投到屏幕
function fxFlapMap(k, th, D, lx, ly) {
  const F = FX_FOLD, f = F.flap[k], d = (f.ax === 'x' ? lx - f.h : ly - f.h) * f.sg, m = d * Math.cos(th), z = d * Math.sin(th);
  const x = f.ax === 'x' ? f.h + f.sg * m : lx, y = f.ax === 'y' ? f.h + f.sg * m : ly, sx = D[0] + x, sy = D[1] + y, kk = F.F / (F.F + z);
  return [F.V[0] + (sx - F.V[0]) * kk, F.V[1] + (sy - F.V[1]) * kk];
}

// 一块纸（平放或翻起）：map 把局部坐标送到屏幕
function fxFoldPiece(c, rect, cut, map, o) {
  const [rx, ry, rw, rh] = rect, pts = cut.map(p => map(p[0], p[1]));
  fxPaper(c, pts, FX_FOLD.col.sheet, { sx: o.sx ?? 4, sy: o.sy ?? 5, sa: o.sa ?? .26 });
  const path = polyPath(pts);
  // 格线
  c.save(); c.strokeStyle = alpha(P.ink2, .22); c.lineWidth = 1.5; c.setLineDash([]);
  for (let x = rx + 250; x < rx + rw - 1; x += 250) { const a = map(x, ry + 6), b = map(x, ry + rh - 6); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  for (let y = ry + 250; y < ry + rh - 1; y += 250) { const a = map(rx + 6, y), b = map(rx + rw - 6, y); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  c.restore();
  if (o.chars) FX_FOLD.cells.forEach((ch, i) => {
    const lx = (i % 4) * 250 + 125, ly = Math.floor(i / 4) * 250 + 125;
    if (lx < rx || lx > rx + rw || ly < ry || ly > ry + rh) return;
    const p0 = map(lx, ly), px = map(lx + 1, ly), py = map(lx, ly + 1);
    c.save(); c.transform(px[0] - p0[0], px[1] - p0[1], py[0] - p0[0], py[1] - p0[1], p0[0], p0[1]);
    zh(c, ch, 0, 0, { size: 130, align: 'center', base: 'middle', color: o.col(i) }); c.restore();
  });
  if (o.shade > 0) { c.save(); c.fillStyle = alpha(P.ink, o.shade); c.fill(path); c.restore(); }
}

// 纸堆侧面：n 折叠出 2^n 层，每层一道墨线
function fxFoldSlab(c, pts, T, n) {
  const L = Math.max(1, Math.round(Math.pow(2, n))), A = mix(P.paperEdge, P.paper, .35), B = mix(P.paperEdge, P.ink, .1);
  c.save(); c.fillStyle = 'rgba(30,20,35,.24)'; c.fill(polyPath(pts.map(p => [p[0] + T * .4 + 5, p[1] + T + 7])));
  for (let j = L; j >= 1; j--) {
    const o = T * j / L, poly = polyPath(pts.map(p => [p[0] + o * .4, p[1] + o]));
    c.fillStyle = j % 2 ? B : A; c.fill(poly); c.strokeStyle = alpha(P.ink, .24); c.lineWidth = 1.2; c.stroke(poly);
  }
  c.restore();
}

// 折叠的整张纸
function fxFoldSheet(c, t) {
  const F = FX_FOLD, D = fxFoldPile(t), th = [0, 1, 2].map(k => fxFoldTheta(k, t)), n = (th[0] + th[1] + th[2]) / Math.PI;
  let stage = 0; th.forEach((v, k) => { if (v > 0) stage = k + 1; });
  const wanChars = !fxCardsOn(t), colOf = i => mix(P.ink, P.purple, i === F.ans ? sm(5.2, 5.5, t) * (1 - sm(5.95, 6.4, t)) : 0);
  // 翻起的半张（在纸堆后面）
  for (let k = 2; k >= 0; k--) {
    if (!(th[k] > 0 && th[k] < Math.PI / 2 - .02)) continue;
    const f = F.flap[k], map = (x, y) => fxFlapMap(k, th[k], D, x, y);
    fxFoldPiece(c, f.rect, fxFoldCut.flap[k], map, { chars: wanChars, col: colOf, shade: .14 * Math.sin(th[k]), sx: 3, sy: 4, sa: .18 * (1 - th[k] / (Math.PI / 2)) });
  }
  // 留在原地的那块：先画厚边，再画面
  const R = F.stage[stage], flat = (x, y) => [D[0] + x, D[1] + y], T = 2.2 * Math.pow(2, n);
  fxFoldSlab(c, fxFoldCut.stage[stage].map(p => flat(p[0], p[1])), T, n);
  fxFoldPiece(c, R, fxFoldCut.stage[stage], flat, { chars: wanChars, col: colOf, sx: 0, sy: 0, sa: 0 });
  // 折痕：画出来、翘起时隐去、展开后留淡淡一道、字卡飞出时消失
  F.folds.forEach((f, k) => {
    const p = sm(f.c0, f.c1, t, u => u), a = (1 - sm(.03, .25, th[k])) * (1 - .62 * sm(f.u0 + .2, f.u1, t)) * (1 - sm(6.55, 6.95, t));
    if (p <= 0 || a <= .01) return;
    const [A, B] = F.crease[k];
    rline(c, [flat(A[0], A[1]), flat(B[0], B[1])], { w: 3.5, color: P.ink2, dash: [16, 11], p, amp: .7, seed: 7140 + k, al: a });
  });
}

// ---------- 字与标签 ----------
// 一组依次顶替的文字：每条从 t 起出现、被下一条顶替时淡出
function fxFoldTexts(c, list, end, t, x, y, o) {
  list.forEach((it, i) => {
    const e = i + 1 < list.length ? list[i + 1].t : end, a = sm(it.t, it.t + .3, t) * (1 - sm(e - .3, e, t)); if (a <= .01) return;
    if (o.pop) { const k = easeOutBack(sm(it.t, it.t + .4, t, u => u), 2.2); pop(c, x, y - o.size * .3, k, () => fade(c, a, () => zh(c, it.text, x, y, { size: o.size, align: 'center', weight: o.weight, color: o.color || P.ink }))); }
    else fade(c, a, () => zh(c, it.text, x, y + (1 - a) * 14, { size: o.size, align: 'center', p: o.write ? sm(it.t, it.t + .55, t, u => u) : 1, color: o.color || P.ink, weight: o.weight }));
  });
}

function fxFoldProb(i, t) {
  const H = FX_FOLD.hints, e = u => easeOutBack(u, 1.1);
  let v = H[0].p[i];
  for (let k = 1; k < H.length; k++) v += (H[k].p[i] - H[k - 1].p[i]) * sm(H[k].r0 + .03 * i, H[k].r0 + .03 * i + .6, t, e);
  return Math.max(.004, v);
}

function fxFoldBars(c, t) {
  const F = FX_FOLD, B = F.bar, cx = i => F.V[0] + (i - 3.5) * F.card.gap;
  const gl = 1 - sm(F.morph[1] + .0, F.morph[1] + .5, t), lineAl = sm(7.2, 7.6, t) * gl;
  if (lineAl > .01) rline(c, [[cx(0) - 80, B.base + 4], [cx(7) + 80, B.base + 4]], { w: 4, color: P.ink2, seed: 7150, al: lineAl });
  F.cells.forEach((ch, i) => {
    const g = sm(B.grow + .05 * i, B.grow + .05 * i + .55, t, u => easeOutBack(u, 1.5)) * (1 - sm(F.morph[1] + .03 * i + .05, F.morph[1] + .03 * i + .55, t));
    const p = fxFoldProb(i, t), h = p * B.max * g; if (h < 2) return;
    const top = B.base - h, x = cx(i), j = fxFoldCut.bar[i], hot = i === F.ans ? clamp((p - .25) / .2, 0, 1) : 0, w = B.w / 2;
    const pts = [[x - w + j[0], top + j[1]], [x - w * .3 + j[2], top + j[3] * .6], [x + w * .35 + j[4], top + j[5] * .6], [x + w + j[6], top + j[7]], [x + w + j[3], B.base], [x - w + j[5], B.base]];
    fxPaper(c, pts, mix(P.g2, P.purple, hot), { sx: 4, sy: 5, gr: .08 });
    if (i === F.ans && t > F.hints[1].r0 + .2) fade(c, sm(F.hints[1].r0 + .2, F.hints[1].r0 + .5, t) * gl, () => zh(c, Math.round(p * 100) + '%', x, top - 16, { size: 56, align: 'center', weight: 700, color: P.purple }));
  });
}

function fxFoldCards(c, t) {
  const F = FX_FOLD, K = F.card;
  F.cells.forEach((ch, i) => {
    const m = fxMorph(i, t), e = easeIO(m), x0 = F.sheet[0] + (i % 4) * 250 + 125, y0 = F.sheet[1] + Math.floor(i / 4) * 250 + 125;
    const x = lerp(x0, F.V[0] + (i - 3.5) * K.gap, e), y = lerp(y0, K.y, e) - 70 * Math.sin(Math.PI * e), rot = (hash(i, 7160) - .5) * .09 * Math.sin(Math.PI * e) * 2;
    const hot = i === F.ans ? clamp((fxFoldProb(i, t) - .25) / .2, 0, 1) * (m > .5 ? 1 : 0) : 0;
    const tint = i === F.ans ? Math.max(hot, sm(5.2, 5.5, t) * (1 - sm(5.95, 6.4, t))) : 0;
    c.save(); c.translate(x, y); c.rotate(rot);
    if (m > .01) {
      fxPaper(c, fxFoldCut.card[i], F.col.card, { al: clamp(m * 2.5, 0, 1), sx: 3, sy: 4 });
      if (hot > .05) rline(c, rectPts(-72, -67, 144, 134, 4), { w: 5, color: P.purple, close: true, seed: 7170, al: hot });
    }
    zh(c, ch, 0, 0, { size: lerp(130, 92, e), align: 'center', base: 'middle', color: mix(P.ink, P.purple, i === F.ans ? Math.max(hot, tint) : 0) });
    c.restore();
  });
}

function fxFoldSentence(c, t, c0) {
  const S = FX_FOLD.sentence, k = sm(S.t0, S.t0 + .5, t, u => u) * (1 - sm(11.2, 11.7, t)); if (k <= 0) return;
  const wp = zhWidth(c, S.prefix, S.size), wb = zhWidth(c, S.body, S.size), wBlank = 110, pw = sm(S.prefixT, S.prefixT + .6, t) * (1 - sm(11.2, 11.7, t));
  const W = wp * pw + wb + wBlank, L = S.x - W / 2, xb = L + wp * pw;
  c.save(); c.globalAlpha *= clamp((1 - sm(11.2, 11.7, t)) + 0, 0, 1);
  if (pw > .02) zh(c, S.prefix, L, S.y, { size: S.size, p: Math.min(1, pw * 1.0), color: P.ink });
  zh(c, S.body, xb, S.y, { size: S.size, p: sm(S.t0, S.t0 + .5, t, u => u), color: P.ink });
  const bx = xb + wb + 14;
  rline(c, [[bx, S.y + 12], [bx + 92, S.y + 12]], { w: 4, color: P.ink2, seed: 7180, p: sm(S.t0 + .4, S.t0 + .7, t, u => u) });
  const wr = sm(S.ansT, S.ansT + .3, t, easeOutBack);
  if (wr > 0) pop(c, bx + 46, S.y - 20, wr, () => zh(c, FX_FOLD.cells[FX_FOLD.ans], bx + 46, S.y, { size: S.size, align: 'center', color: P.purple, weight: 700 }));
  c.restore();
}

function fxFoldPch(c, t) {
  const F = FX_FOLD, talk = [[.7, 1.4], [1.9, 2.6], [3.55, 4.3], [5.1, 6.0], [7.1, 7.9], [8.1, 9.0], [9.3, 10.2], [10.4, 11.1]];
  const sp = talk.some(([a, b]) => t >= a && t < b) ? .15 + .55 * Math.abs(Math.sin(t * 13)) : 0;
  const g = .15 + .7 * Math.max(win(.6, 1.7, t), win(2.4, 3.5, t), win(4.0, 5.2, t), win(7.1, 7.9, t), win(8.0, 9.0, t), win(9.3, 10.3, t), win(10.4, 11.2, t));
  const smug = win(10.4, 11.5, t, .25) > .5;
  drawPatchouli(c, { ...F.pch, pose: 'lecture', gesture: g, mood: smug ? 'smug' : 'normal', mouth: sp, blink: blinkAt(t), t });
}

function fxFoldDraw(c, t) {
  const F = FX_FOLD;
  fxFoldPch(c, t);
  // 上方：第几比特（手写弹出）、下方：还剩几个
  fxFoldTexts(c, F.count, F.countEnd, t, 1230, 195, { size: 100, weight: 700, pop: true });
  fxFoldTexts(c, F.left, F.leftEnd, t, 1230, 890, { size: 56 });
  const al = fxSheetAl(t); if (al > .01) fade(c, al, () => fxFoldSheet(c, t));
  if (t > 6.4) {
    fxFoldTexts(c, F.hints, F.hintEnd, t, 1230, 160, { size: 60, write: true });
    fxFoldSentence(c, t);
    fxFoldBars(c, t);
  }
  if (fxCardsOn(t)) fxFoldCards(c, t);
}

FX.add({ id: 'fold-bits', title: '对折纸与填字概率条', src: '第 3 集 比特段 + 猜字段', dur: 12, bg: 'paper', draw: fxFoldDraw });
