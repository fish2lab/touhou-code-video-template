// puppet-stage · 纸剧场：舞台从书页升起，追光点一根线，提线木偶
// 出处：第 2 集 支柱段（2/src/scenes/2-pillars.js:228-380 红幕布舞台、网络图、追光、提线琪露诺）
// 好在哪：舞台折在书页上，用 1.4 秒立起并过冲 6%；追光是一张挖了圆孔的深色纸罩（硬边投影、无渐变），圆孔 4 次移动（0.7–1.0 秒）依次点亮粗线中段、左结、右结、回中段；
//   琪露诺被 4 根线吊着，横杆升高 90 像素把她拉起，手一动线端跟着动，松手时线垂下 70 像素。金色只出现在被照亮的线和台口一条细边。
// 复用：把 FX_PUP.net 里两个结和一根线换成任何「要指出其中一条」的图（流程、依赖、攻击路径）；FX_PUP.hole 的时间表改成台词里的先后；
//   提线部分单独拿走即可做「被操纵的角色」（提示注入里被外部指令牵着走的 agent）。
// 分叉：1) 舞台 + 追光（点哪条边）；2) 提线木偶（谁在被拉）；3) 只留折叠舞台升起做章节转场。

const FX_PUP = {
  ox0: 300, ox1: 1620, oy0: 110, fold: 890,          // 台口外框、折线
  ix0: 380, ix1: 1540, iy0: 190, iy1: 850, wall: 730, // 台口内口、背景墙到地板的分界
  shieldR: 1200,                                      // 纸罩右缘
  A: [640, 360], B: [1010, 360], C: [700, 610], D: [960, 610],
  hole0: [830, 620, 90],                              // 纸罩落下时圆孔的位置和半径
  hole: [[3.0, 3.9, 825, 360, 130, 0], [4.3, 5.0, 640, 360, 100, 1], [5.3, 6.3, 1010, 360, 100, 1], [6.6, 7.2, 825, 360, 130, 0]],
  cirno: { x: 1300, y: 810, h: 330 },
  bar: { y0: 380, y1: 290, half: 55 },                // 横杆：松 → 紧
  col: { curtain: mix(P.red, P.ink, .38), frame: mix(P.ink, P.purple, .3), wall: mix(BOOK.page, P.night, .42), wood: '#8a6a4a', woodLite: '#b38d62', line: '#cfc7b4', node: '#e6dfcd' },
};

const fxPupK = t => Math.max(0, sm(.6, 2.0, t, easeOutBack) * (1 - sm(9.0, 9.9, t, easeIn)));   // 舞台立起程度

// 逐段累积：每段从上一段终点出发
function fxPupHoleAt(t) {
  const F = FX_PUP; let px = F.hole0[0], py = F.hole0[1], pr = F.hole0[2], out = [px, py, pr];
  for (const [t0, t1, tx, ty, tr, back] of F.hole) { const e = sm(t0, t1, t, back ? easeOutBack : easeIO); out = [lerp(px, tx, e), lerp(py, ty, e), lerp(pr, tr, e)]; if (t < t1) break; px = tx; py = ty; pr = tr; }
  return out;
}

function fxPupBase(c, t, lit) {
  const F = FX_PUP, K = F.col, [A, B, C, D] = [F.A, F.B, F.C, F.D];
  cutPaper(c, rectPts(F.ix0, F.iy0, F.ix1 - F.ix0, F.wall - F.iy0, 0), lit ? mix(BOOK.page, P.paper, .3) : K.wall, { seed: 910, step: 60, blur: 0, sx: 0, sy: 0, grain: .1 });
  cutPaper(c, rectPts(F.ix0, F.wall, F.ix1 - F.ix0, F.iy1 - F.wall, 0), K.woodLite, { seed: 911, step: 60, blur: 0, sx: 0, sy: 0, grain: .1 });
  for (let i = 0; i < 6; i++) { const x = lerp(F.ix0, F.ix1, (i + .5) / 6); rline(c, [[lerp(x, CX, .45), F.wall], [x, F.iy1]], { w: 2, color: alpha(K.wood, .55), seed: 912 + i, amp: .6 }); }
  rline(c, [[F.ix0, F.wall], [F.ix1, F.wall]], { w: 3, color: alpha(P.ink, .5), seed: 920, amp: .6 });
  // 细线网络（C、D 两个暗结）
  for (const [a, b] of [[A, C], [B, D], [C, D], [A, D]]) rline(c, [a, b], { w: 4, color: K.line, seed: 930, amp: .8, t });
  for (const p of [C, D]) { cutPaper(c, ellPts(p[0], p[1], 34, 34, 28), K.node, { seed: 940, step: 10, blur: 0, sx: 4, sy: 5 }); rline(c, ellPts(p[0], p[1], 34, 34, 28), { w: 3, color: P.ink2, close: true, seed: 941, amp: .6 }); }
  // 粗线 A—B 和两个大结
  cutPaper(c, [[A[0], A[1] - 12], [B[0], B[1] - 12], [B[0], B[1] + 12], [A[0], A[1] + 12]], K.line, { seed: 950, step: 24, blur: 0, sx: 4, sy: 6 });
  for (const p of [A, B]) { cutPaper(c, ellPts(p[0], p[1], 48, 48, 32), K.node, { seed: 951, step: 10, blur: 0, sx: 5, sy: 6 }); rline(c, ellPts(p[0], p[1], 48, 48, 32), { w: 3.5, color: P.ink2, close: true, seed: 952, amp: .6 }); }
}

function fxPupGold(c, t) {
  const F = FX_PUP, [A, B] = [F.A, F.B], gold = P.moon;
  cutPaper(c, [[A[0], A[1] - 12], [B[0], B[1] - 12], [B[0], B[1] + 12], [A[0], A[1] + 12]], gold, { seed: 960, step: 24, blur: 0, sx: 0, sy: 0, shadow: false });
  for (const p of [A, B]) { cutPaper(c, ellPts(p[0], p[1], 48, 48, 32), mix(gold, '#fff4d0', .55), { seed: 961, step: 10, shadow: false }); rline(c, ellPts(p[0], p[1], 48, 48, 32), { w: 3.5, color: mix(gold, P.ink, .35), close: true, seed: 962, amp: .6 }); }
}

function fxPupShield(c, t) {
  const F = FX_PUP, w = F.shieldR - F.ix0, h = F.iy1 - F.iy0;
  const drop = sm(2.0, 2.8, t, easeOutBack), lift = sm(8.2, 8.9, t, easeIn);
  const dy = -(h + 80) * (1 - drop) - (h + 80) * lift;
  if (dy < -h - 60) return;
  const [hx, hy, hr] = fxPupHoleAt(t);
  c.save(); c.beginPath(); c.rect(F.ix0, F.iy0, F.ix1 - F.ix0, h); c.clip();
  c.translate(0, dy);
  const path = new Path2D(); path.addPath(polyPath(rectPts(F.ix0 - 30, F.iy0 - 40, w + 30, h + 40, 0), true)); path.addPath(polyPath(ellPts(hx, hy, hr, hr, 48), true));
  c.save(); c.shadowColor = 'rgba(20,12,20,.4)'; c.shadowOffsetX = 12; c.shadowOffsetY = 14; c.shadowBlur = 0; c.globalAlpha *= .74;
  c.fillStyle = mix(P.night, P.paper, .06); c.fill(path, 'evenodd'); c.restore();
  rline(c, ellPts(hx, hy, hr, hr, 48), { w: 3, color: alpha(P.ink, .8), close: true, seed: 970, amp: 1.2, t });
  c.save(); c.beginPath(); c.arc(hx, hy, hr - 1, 0, TAU); c.clip(); c.translate(0, -dy); fxPupBase(c, t, true); fxPupGold(c, t); c.restore();
  c.restore();
}

// 幕布：边缘折线的剪纸，宽下摆
function fxPupCurtain(c, x0, dir, seed) {
  const F = FX_PUP, b = F.iy1 + 4;
  const pts = [[x0, F.iy0], [x0 + dir * 170, F.iy0], [x0 + dir * 95, 420], [x0 + dir * 62, 520], [x0 + dir * 92, 650], [x0 + dir * 140, b], [x0, b]];
  cutPaper(c, pts, F.col.curtain, { seed, step: 18, blur: 0, sx: 7 * dir * -1, sy: 8, grain: .1, smooth: true });
  for (let i = 1; i <= 3; i++) rline(c, [[x0 + dir * 30 * i, F.iy0 + 60], [x0 + dir * (24 + 26 * i), 440], [x0 + dir * (28 + 34 * i), b - 20]], { w: 2.4, color: alpha(P.ink, .4), seed: seed + i, amp: 1.5 });
}

function fxPupFront(c, t) {
  const F = FX_PUP, K = F.col;
  // 台口外框（外矩形减去圆角内口）
  const fr = new Path2D(); fr.addPath(polyPath(rectPts(F.ox0, F.oy0, F.ox1 - F.ox0, F.fold - F.oy0, 0), true)); fr.addPath(polyPath(rectPts(F.ix0, F.iy0, F.ix1 - F.ix0, F.iy1 - F.iy0, 60), true));
  fxPupCurtain(c, F.ix0, 1, 980); fxPupCurtain(c, F.ix1, -1, 990);
  // 帷幔：下沿波浪
  const top = [[F.ix0, F.iy0 - 8], [F.ix1, F.iy0 - 8]], wave = []; for (let i = 0; i <= 40; i++) { const u = i / 40; wave.push([lerp(F.ix1, F.ix0, u), F.iy0 + 54 + Math.sin(u * TAU * 7) * 14]); }
  cutPaper(c, [...top, ...wave], mix(K.curtain, P.ink, .1), { seed: 1000, step: 14, blur: 0, sx: 0, sy: 8, grain: .1 });
  c.save(); c.shadowColor = 'rgba(20,12,20,.35)'; c.shadowOffsetX = 6; c.shadowOffsetY = 8; c.shadowBlur = 0; c.fillStyle = K.frame; c.fill(fr, 'evenodd'); c.restore();
  rline(c, rectPts(F.ix0, F.iy0, F.ix1 - F.ix0, F.iy1 - F.iy0, 60), { w: 3.5, color: alpha(P.moon, .85), close: true, seed: 1001, amp: .8 });
  rline(c, rectPts(F.ox0 + 18, F.oy0 + 18, F.ox1 - F.ox0 - 36, F.fold - F.oy0 - 36, 6), { w: 2.4, color: alpha(P.paper, .35), close: true, seed: 1002, amp: 1 });
  // 台板：向前凸出一条木板
  cutPaper(c, rectPts(F.ox0 - 24, F.iy1, F.ox1 - F.ox0 + 48, F.fold - F.iy1, 0), K.wood, { seed: 1003, step: 40, blur: 0, sx: 0, sy: 8, grain: .12 });
  rline(c, [[F.ox0 - 24, F.iy1 + 6], [F.ox1 + 24, F.iy1 + 6]], { w: 3, color: alpha(P.paper, .4), seed: 1004, amp: .8 });
}

function fxPupCirno(c, t) {
  const F = FX_PUP, C0 = F.cirno, B = F.bar;
  const pull = sm(3.2, 3.8, t, easeOutBack) - sm(8.4, 9.0, t), taut = clamp(pull, 0, 1);
  let pose = 'slump', mood = 'pout', g = 0;
  if (t >= 3.5 && t < 5.4) { pose = 'stand'; mood = t > 4.4 ? 'happy' : 'surprised'; }
  else if (t >= 5.4 && t < 7.0) { pose = 'proud'; mood = 'proud'; g = sm(5.4, 6.0, t, easeOutBack); }
  else if (t >= 7.0 && t < 8.2) { pose = 'point'; mood = 'happy'; g = sm(7.0, 7.5, t, easeOutBack) * .8; }
  else if (t >= 8.2 && t < 8.8) { pose = 'stand'; mood = 'normal'; }
  const lift = 12 * pull, y = C0.y - lift;
  c.save(); c.globalAlpha *= .22; c.fillStyle = '#2a1c16'; c.beginPath(); c.ellipse(C0.x + 6, C0.y + 4, 62, 12, 0, 0, TAU); c.fill(); c.restore();
  const R = drawCirno(c, { x: C0.x, y, h: C0.h, facing: -1, pose, mood, gesture: g, t });
  // 横杆：松时低，拉紧时升高；动作时微微晃
  const act = win(5.4, 8.2, t, .3), by = lerp(B.y0, B.y1, pull) + 5 * Math.sin((t - 3.8) * 2.2) * taut, tilt = .07 * Math.sin((t - 5.4) * 3.2) * act;
  const bp = dx => [C0.x + dx * Math.cos(tilt), by + dx * Math.sin(tilt)];
  const head = [R.head[0], R.head[1] - C0.h * .2], knee = [C0.x + 14, y - C0.h * .26];
  const ends = [[R.hands[0], bp(-B.half)], [R.hands[1], bp(B.half)], [head, bp(-14)], [knee, bp(16)]];
  rline(c, [bp(0), [C0.x, F.iy0 + 20]], { w: 3, color: P.ink2, seed: 1010, amp: .5, t });                       // 吊绳穿过帷幔
  cutPaper(c, [bp(-B.half - 10), bp(B.half + 10), [bp(B.half + 10)[0], bp(B.half + 10)[1] + 14], [bp(-B.half - 10)[0], bp(-B.half - 10)[1] + 14]], F.col.woodLite, { seed: 1011, step: 14, blur: 0, sx: 3, sy: 5 });
  ends.forEach(([a, b], i) => { thread(c, b, a, { w: 2.6, color: P.ink2, sag: 70, taut: .15 + taut * .8, seed: 1020 + i }); cutPaper(c, circPts(a[0], a[1], 5, 12), P.ink, { seed: 1030 + i, step: 5, shadow: false }); });
}

function fxPupDraw(c, t) {
  const F = FX_PUP, k = fxPupK(t);
  // 平躺在书页上的台板底座（始终在，起止画面不空）
  cutPaper(c, rectPts(F.ox0 - 24, F.fold, F.ox1 - F.ox0 + 48, 76, 8), F.col.wood, { seed: 900, step: 40, blur: 0, sx: 0, sy: 7, grain: .12 });
  if (k < .5) rline(c, [[F.ox0 - 24, F.fold], [F.ox1 + 24, F.fold]], { w: 2.5, color: alpha(P.ink, .6), dash: [18, 12], seed: 901, amp: .5 });
  zh(c, '纸剧场', CX, F.fold + 56, { size: 52, color: P.paper, align: 'center', weight: 600 });
  popup(c, F.fold, k, () => {
    fxPupBase(c, t); fxPupShield(c, t); fxPupCirno(c, t); fxPupFront(c, t);
  }, [F.ox0, F.ox1]);
}

FX.add({ id: 'puppet-stage', title: '纸剧场', src: '第 2 集 支柱段', dur: 10, bg: 'paper', draw: fxPupDraw });
