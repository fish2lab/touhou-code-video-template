'use strict';
// nap-fall · 打盹掉进深睡：地面裂开，穿过一层层地层纸沉到最底，再被钓线拉回来
// 出处：第 4 集 小睡段（第 4 集 src/scenes/4-nap.js:157-193 裂缝与两半草地，:276-296 白色剪影，:304-318 掉落与弹回的时间表，:119-131 地层纸）
// 好在哪：站着打盹的美铃脚下先被手抖的锯齿线划出一道缝（0.9 秒写完、0.9 秒内整块草地轻颤），然后两半草地各滑开 140 像素，她只在缝里可见地掉下去（先上提 14 像素再落，0.8 秒加速）。
//        镜头竖着跟 2.2 秒穿过 10 张层距 172 像素的靛蓝波浪纸（浅天蓝一路压到靛黑，上沿一道浅亮边），两侧是黑色锯齿岩壁，四边再压一圈暗角；她从彩色人偶渐变成一张纯白纸剪影，身后一团冷白光晕，侧躺着往下沉；最深处安静 1 秒，写出「深睡」，
//        一根线从上面垂下来拴住她，拉紧后 1.1 秒加速往上抽，冲出地面 120 像素再落回草地、压扁 8%，缝以 -6 像素的过冲合拢。结尾沙漏翻转，画面回到开头的打盹。
// 复用：在 scene 里 fxPlay('nap-fall', c, t) 直接嵌用，或把 fxNapDraw(c, u) 拷出去；整段 dur 10 秒，时间点都在 FX_NAP.t 里，
//      换位置只改 FX_NAP.mx / feet / gt；换掉的角色改 fxNapBody 里 drawMeiling 的调用（姿势 doze → startle 两套）。
// 分叉：① 题材：把「沙漏」换成别的计时物（闹钟、蜡烛），表示「睡太久」的原因；② 地层：FX_NAP.strata 的颜色和层数（层数多、层距窄才有「一路下沉」的速度感，别合并成几大块）换成另一种深度隐喻（海水、云层、书架）；
//      ③ 主角：换成别的角色，只要有一个站着垂头的姿势（doze）和一个惊醒姿势（startle），剪影和缝的宽度（gw）按身宽调整。

const FX_NAP = {
  mx: 900, feet: 860, h: 540, gt: 700, gb: 1100, soilB: 1175, gw: 140,        // 美铃横坐标、脚底、身高、草地远沿、草地近沿、土层底、缝的半宽
  hg: { x: 1480, y: 905 },                                                   // 沙漏底座中心
  c: { sky: '#d9d3c0', wall: '#a9756a', wallCap: '#8c5a52', grass: '#7f9c5a', grassDk: '#5f7c44', soil: '#6b5236', void: '#1f2650', abyss: '#0b0f27', rock: '#0b0f27', sil: '#f6ecd0', thread: '#6b4f55',
       glass: '#e9f2ec', sand: '#e3b24a', wood: '#7b4b2a' },
  strata: ['#d5e9ed', '#b3d1e4', '#90b4d8', '#7093c6', '#5576b0', '#405a98', '#30437e', '#243064', '#19214b', '#111637'],   // 10 张地层纸，浅天蓝一路压到靛黑，和第 4 集同一组颜色
  top0: 1175, step: 172,                                                      // 第一张纸的纸顶、层距（层距窄，镜头下沉时一层层密密地掠过）
  t: { crack0: 0.9, crack1: 1.8, shake0: 1.4, shake1: 2.3, open0: 2.0, open1: 2.55, lift: 2.45, fall0: 2.65, fall1: 3.45, sink1: 5.0, hold1: 5.9,
       pull0: 6.25, pop: 7.35, land: 7.75, close0: 7.7, close1: 8.4, swap0: 9.0, swap1: 9.5, flip0: 8.7, flip1: 9.6 },
};

// 分段缓动表：[[t0,v0],[t1,v1,ease],…]，每段用终点那一行的缓动（缺省 easeIO）
function fxNapKey(t, K) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b, e = easeIO] = K[i]; return lerp(a, b, e((t - t0) / (t1 - t0))); }
  return K.at(-1)[1];
}
const fxNapAccel = x => Math.pow(x, 2.2);

// 锯齿缝：竖着一串左右交替的折点
const fxNapCrack = (() => { const p = []; for (let y = FX_NAP.gt - 10, k = 0; y <= FX_NAP.soilB + 20; y += 34, k++) p.push([FX_NAP.mx + (k % 2 ? 13 : -11) + 6 * Math.sin(k * 1.3), y]); return p; })();
function fxNapHalf(side, gw, yTop, yBot) {
  const e = fxNapCrack.map(([x, y]) => [x + side * gw, clamp(y, yTop, yBot)]);
  return side < 0 ? [[-300, yTop], ...e, [-300, yBot]] : [[2300, yTop], ...e, [2300, yBot]];
}
// 地层纸：每张一条波浪边的整幅纸，上沿一条浅色亮边当纸厚（不画深色底边，层与层靠色差分开）
const fxNapBands = FX_NAP.strata.map((col, i) => {
  const top = FX_NAP.top0 + i * FX_NAP.step, wave = x => top + 15 * Math.sin(x / 170 + i * 1.7) + 7 * Math.sin(x / 57 + i * 2.3), bot = 4300, tp = [];
  for (let x = -100; x <= 2100; x += 36) tp.push([x, wave(x)]);
  return { col, top, tp, polys: [[...tp, [2100, bot], [-100, bot]]], rim: `rgba(235,245,255,${.5 - i * .03})`, seed: 4500 + i * 3 };
});
// 两侧岩壁：深靛色的锯齿竖条，从地面下方一直通到最底，镜头下沉时贴着画面左右两边
const fxNapWalls = [-1, 1].map(side => {
  const ox = side < 0 ? 260 : 1660, pts = [[side < 0 ? -300 : 2300, 1640]];
  for (let y = 1720; y <= 5000; y += 46) pts.push([ox - side * (55 * noise1(y / 230, 11 + side) + 30 * noise1(y / 70, 13 + side) + (Math.sin(y / 330 + side) > .7 ? 70 : 0)), y]);
  pts.push([side < 0 ? -300 : 2300, 5000]);
  return pts;
});

// 纯白纸剪影：把人偶画进小画布，整片涂成纸白
const fxNapSilCv = document.createElement('canvas');
function fxNapSil(c, x, y, rot, al, t) {
  if (al <= .01) return; const R = FX_NAP.h * .75, n = Math.ceil(2 * R), g = fxNapSilCv.getContext('2d');
  if (fxNapSilCv.width !== n) fxNapSilCv.width = fxNapSilCv.height = n;
  g.reset(); g.setTransform(1, 0, 0, 1, R, R);
  drawMeiling(g, { x: 0, y: FX_NAP.h * .5, h: FX_NAP.h, facing: -1, pose: 'doze', mood: 'sleepy', t });
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = FX_NAP.c.sil; g.fillRect(0, 0, n, n);
  c.save(); c.globalAlpha *= al; c.translate(x, y); c.rotate(rot);
  c.drawImage(fxNapSilCv, -R, -R, 2 * R, 2 * R); c.restore();
}

// 沙漏：局部坐标，底座中心为原点，向上为负；A = 上半还剩多少沙（1 满 → 0 空）
function fxNapGlass(c, A, rot) {
  const C = FX_NAP.c, glass = [[-58, -286], [58, -286], [8, -157], [58, -14], [-58, -14], [-8, -157]];
  c.save(); c.translate(0, -150); c.rotate(rot); c.translate(0, 150);
  const gp = cutPaper(c, glass, C.glass, { seed: 4601, step: 14, blur: 4, sx: 3, sy: 4, al: .92 });
  c.save(); c.clip(gp);
  const yTop = lerp(-157, -276, A), yBot = -14 - 118 * (1 - A);
  cutPaper(c, [[-70, yTop], [70, yTop], [70, -150], [-70, -150]], C.sand, { seed: 4602, step: 30, shadow: false, edge: false, grain: .12 });
  cutPaper(c, [[-70, -14], [-70, yBot + 12], [0, yBot], [70, yBot + 12], [70, -14]], C.sand, { seed: 4603, step: 30, shadow: false, edge: false, grain: .12 });
  c.restore();
  if (A > .02 && A < .98) rline(c, [[0, -160], [0, yBot + 4]], { w: 3, color: C.sand, amp: .3, seed: 4604 });
  for (const y of [-300, -14]) cutPaper(c, rectPts(-72, y, 144, 14, 3), C.wood, { seed: 4605 + y, step: 24, blur: 4, sx: 2, sy: 3 });
  rline(c, [[-66, -286], [-66, -14]], { w: 4, color: C.wood, amp: .5, seed: 4606 }); rline(c, [[66, -286], [66, -14]], { w: 4, color: C.wood, amp: .5, seed: 4607 });
  c.restore();
}

// 一帧里美铃的状态：脚底世界纵坐标 Yf（分段缓动表）、镜头 camY、缝宽 gw
function fxNapState(u) {
  const T = FX_NAP.t, F = FX_NAP.feet;
  let Yf = fxNapKey(u, [[0, F], [T.lift, F], [T.fall0, F - 14, easeOut], [T.fall1, 1560, fxNapAccel], [T.sink1, 2650, easeOut], [T.hold1 - .1, 2675, easeSine],
    [T.pull0, 2705, easeOut], [T.pop, 740, x => Math.pow(x, 2.2)], [T.land, F, fxNapAccel], [T.land + .15, F - 15, easeOut], [T.land + .3, F, fxNapAccel]]);
  if (u > T.sink1 && u < T.pull0) Yf += 10 * Math.sin((u - T.sink1) * 2.4);                       // 沉底后随水轻轻晃
  const cam = u < T.sink1 ? fxNapKey(u, [[0, 0], [T.fall0 + .05, 0], [T.fall1, 700], [T.sink1, 1890, easeOut]])
    : u < T.pull0 ? fxNapKey(u, [[T.sink1, 1890], [T.pull0, 1940, easeSine]]) : Math.max(0, Yf - 760);
  const gw = fxNapKey(u, [[0, 0], [T.open0, 0], [T.open1, 152, easeOut], [T.open1 + .25, FX_NAP.gw, easeIO], [T.close0, FX_NAP.gw], [T.close1 - .2, -6, fxNapAccel], [T.close1, 0, easeOut]]);
  return { Yf, cam, gw };
}

function fxNapDraw(c, u) {
  const T = FX_NAP.t, C = FX_NAP.c, MX = FX_NAP.mx, GT = FX_NAP.gt, GB = FX_NAP.gb, FEET = FX_NAP.feet, H = FX_NAP.h;
  const { Yf, cam, gw } = fxNapState(u), Yc = Yf - H / 2, deep = sm(1300, 2300, Yf), rising = u > T.hold1 - .5;
  const shakeY = u > T.land ? 6 * Math.exp(-(u - T.land) * 9) * Math.sin((u - T.land) * 55) : 0;
  const crackP = sm(T.crack0, T.crack1, u), sliced = u >= T.open0 - .05 && u < T.close1 + .1;
  const tremor = u > T.shake0 && u < T.shake1 ? 2.6 * Math.sin(u * 85) * Math.sin(Math.PI * (u - T.shake0) / (T.shake1 - T.shake0)) : 0;
  c.save(); c.translate(0, -cam + shakeY);

  // 墙（背景）
  cutPaper(c, rectPts(-40, 340, W + 80, GT - 330), C.wall, { seed: 4411, step: 40, blur: 8 });
  cutPaper(c, rectPts(-40, 340, W + 80, 44), C.wallCap, { seed: 4412, step: 40, shadow: false });
  for (let r = 0; r < 3; r++) for (let x = 40 + (r % 2) * 60; x < W; x += 120) rline(c, [[x, 420 + r * 84], [x, 480 + r * 84]], { w: 2.5, color: alpha(C.wallCap, .45), amp: .6, seed: x + r });
  // 缝里的暗处
  if (gw > 1) { const L = fxNapCrack.map(([x, y]) => [x - gw, clamp(y, GT, FX_NAP.soilB)]), R = fxNapCrack.map(([x, y]) => [x + gw, clamp(y, GT, FX_NAP.soilB)]).reverse();
    c.fillStyle = C.void; c.fill(polyPath([...L, ...R])); }
  c.fillStyle = C.abyss; c.fillRect(-100, FX_NAP.soilB + 4, W + 200, 5000);                         // 地层纸后面最深的靛色

  // 草地：缝开之前是一整块，之后两半各自滑开；土层、草丛、沙漏（在右半）跟着草地走
  const tufts = side => { for (let k = 0; k < 9; k++) { const x = side < 0 ? 80 + k * 80 + hash(k, 7) * 30 : MX + 260 + k * 110 + hash(k, 8) * 40, y = GT + 40 + hash(k, 9 + side) * 300;
    if (x > MX - 170 && x < MX + 170) continue;
    for (const d of [-9, 0, 9]) rline(c, [[x + d * .6, y], [x + d, y - 22 - 6 * hash(k + d, 3)]], { w: 3, color: C.grassDk, amp: .4, seed: k * 3 + d + 9 }); } };
  const hourglass = () => { c.save(); c.translate(FX_NAP.hg.x, FX_NAP.hg.y); fxNapGlass(c, (1 - sm(.3, T.sink1 - .4, u, x => x)) * (u < T.flip0 ? 1 : 0) + (u < T.flip0 ? 0 : 0), Math.PI * sm(T.flip0, T.flip1, u)); c.restore(); };
  c.save(); c.translate(tremor, 0);
  if (!sliced) {
    cutPaper(c, rectPts(-40, GB - 10, W + 80, FX_NAP.soilB - GB + 10), C.soil, { seed: 4421, step: 40, shadow: false });
    cutPaper(c, rectPts(-40, GT, W + 80, GB - GT), C.grass, { seed: 4423, step: 40, blur: 8 });
    tufts(-1); tufts(1); hourglass();
  } else {
    if (gw < 4) cutPaper(c, rectPts(-40, GT, W + 80, GB - GT), C.grass, { seed: 4423, step: 40, shadow: false, edge: false });   // 合拢时垫一层，不留缝隙
    for (const side of [-1, 1]) { c.save(); c.translate(side * gw, 0);
      cutPaper(c, fxNapHalf(side, 0, GB - 10, FX_NAP.soilB), C.soil, { seed: 4421 + side, step: 40, shadow: false });
      cutPaper(c, fxNapHalf(side, 0, GT, GB), C.grass, { seed: 4423 + side, step: 40, blur: 8 });
      tufts(side); if (side > 0) hourglass(); c.restore(); }
  }
  c.restore();
  // 手抖的锯齿线：从脚下往上下两头爬
  const cr = crackP * (1 - sm(T.close1 + .1, T.close1 + .6, u));
  if (cr > 0 && gw < 40) { const mid = fxNapCrack.length >> 1;
    const half = k => fxNapCrack.slice(mid - Math.round(mid * k), mid + Math.round((fxNapCrack.length - mid) * k) + 1);
    c.save(); c.translate(tremor, 0); rline(c, half(cr), { w: 5, color: '#141a3c', amp: 1.3, seed: 4430, t: u }); c.restore(); }

  // 地层纸：整幅纸，上沿一条浅亮边
  for (const b of fxNapBands) { if (b.top - 40 > cam + 1080 + 40) continue;
    for (const [k, poly] of b.polys.entries()) cutPaper(c, poly, b.col, { seed: b.seed + k, step: 26, blur: 12, sx: 0, sy: 6 });
    rline(c, b.tp, { w: 3, color: b.rim, amp: .8, seed: b.seed + 1, t: 0 }); }
  // 两侧黑色岩壁：锯齿边，边上一道冷色亮边
  if (cam + 1080 > 1640) fxNapWalls.forEach((w, i) => { cutPaper(c, w, C.rock, { seed: 4780 + i, step: 20, blur: 22, sx: i ? -10 : 10, sy: 0, grain: .1 });
    rline(c, w.slice(1, -1), { w: 3, color: 'rgba(150,175,255,.4)', amp: .8, seed: 4790 + i, t: 0 }); });

  // 美铃：人偶（只在缝里 / 地面上方可见）→ 纯白剪影（沉到地层里）
  const aSp = 1 - sm(1150, 1450, Yf), aSil = 1 - aSp, df = deep, x = MX + 22 * Math.sin(u * 1.3 + .5) * df, rot = -.5 * deep + .07 * Math.sin(u * 1.1) * df;
  if (aSp > .01) {
    const body = (pose, mood, gesture, al) => { c.save(); c.globalAlpha *= al;
      const p = new Path2D(); p.rect(-5000, -5000, 12000, 12000); for (const s of [-1, 1]) p.addPath(polyPath(fxNapHalf(s, gw, FEET + 3, FX_NAP.soilB))); if (sliced) c.clip(p, 'evenodd');
      c.translate(x, Yc); c.rotate(rot); c.translate(0, H / 2);
      const land = u - T.land, sy = land > 0 && land < .3 ? 1 - .08 * Math.sin(land / .3 * Math.PI) : 1; c.scale(1, sy);
      drawMeiling(c, { x: 0, y: 0, h: H, facing: -1, pose, mood, gesture, t: u, blink: mood === 'sleepy' ? 0 : blinkAt(u, 7) });
      c.restore(); };
    const sh = (1 - sm(0, 60, gw)) * (1 - sm(0, 60, FEET - Yf)) * aSp;                              // 脚下的贴地阴影
    if (sh > .02) { c.save(); c.globalAlpha *= .22 * sh; c.fillStyle = '#24361c'; c.beginPath(); c.ellipse(x, FEET - 4, 120, 20, 0, 0, TAU); c.fill(); c.restore(); }
    if (!rising && u < T.pop) body('doze', 'sleepy', undefined, aSp);
    else if (u < T.swap0) body('startle', 'flustered', fxNapKey(u, [[0, 0], [T.land, 0], [T.land + .2, .16], [T.land + .45, .55], [T.land + .65, .7], [T.land + 1.1, .85]], x => x), aSp);
    else { const k = sm(T.swap0, T.swap1, u); body('startle', 'flustered', .85, aSp * (1 - k)); body('doze', 'sleepy', undefined, aSp * k); }
  }
  // 剪影身后的光晕和上浮的气泡：高反差靠这一团亮在深靛背景上
  if (aSil > .01 && deep > .01) { const R = 300, gl = c.createRadialGradient(x, Yc, 0, x, Yc, R);
    gl.addColorStop(0, 'rgba(232,238,255,.5)'); gl.addColorStop(.5, 'rgba(192,208,255,.18)'); gl.addColorStop(1, 'rgba(192,208,255,0)');
    c.save(); c.globalAlpha *= aSil * deep; c.globalCompositeOperation = 'lighter'; c.fillStyle = gl; c.fillRect(x - R, Yc - R, 2 * R, 2 * R); c.restore();
    c.save(); c.lineWidth = 3; for (let i = 0; i < 16; i++) { const bx = 300 + hash(i, 61) * 1320, per = 6 + hash(i, 62) * 4, ph = (u / per + hash(i, 63)) % 1, by = cam + 1180 - ph * 1400, r = 6 + hash(i, 64) * 10;
      c.strokeStyle = alpha(C.sil, .45 * deep * aSil * Math.sin(ph * Math.PI)); c.beginPath(); c.arc(bx + 12 * Math.sin(u * 1.3 + i), by, r, 0, TAU); c.stroke(); }
    c.restore(); }
  fxNapSil(c, x, Yc, rot, aSil, u);

  // 钓线：从画面上沿垂下来拴住她，拉紧后抽走
  const tA = sm(5.1, T.hold1, u) * (1 - sm(T.pop, T.pop + .35, u));
  if (tA > .01) { const hx = x + 230 * Math.sin(rot) * .9, hy = Yc - 230 * Math.cos(rot) * .9, taut = sm(T.hold1, T.pull0, u);
    c.save(); c.globalAlpha *= clamp(tA * 1.5, 0, 1); thread(c, [MX + 40, cam - 30], [hx, hy], { color: C.thread, w: 3.5, p: sm(5.1, 5.8, u), sag: 70, taut, seed: 4440 }); c.restore(); }
  // 「深睡」：沉到底之后写出来，被拉起前淡去
  const lA = sm(4.5, 5.3, u, x => x) * (1 - sm(T.hold1 + .05, T.pull0 + .15, u));
  if (lA > .01) zh(c, '深睡', MX + 330, Yc + 20 - 24 * (1 - lA), { size: 100, color: C.sil, p: sm(4.5, 5.3, u, x => x), al: clamp(lA * 2, 0, 1) });
  c.restore();
  // 暗角：沉得越深，四边压得越黑
  const vg = deep * (1 - sm(T.pull0, T.pop, u));
  if (vg > .01) { const g = c.createRadialGradient(W / 2, 540, 300, W / 2, 540, 1150); g.addColorStop(0, 'rgba(5,8,28,0)'); g.addColorStop(1, `rgba(5,8,28,${.55 * vg})`); c.fillStyle = g; c.fillRect(0, 0, W, 1080); }
}

FX.add({ id: 'nap-fall', title: '打盹掉进深睡', src: '第 4 集 小睡段', dur: 10, bg: 'paper', draw: (c, t) => fxNapDraw(c, t) });
