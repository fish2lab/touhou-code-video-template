'use strict';
// sky-dial · 昼夜转盘与纸雕灯箱视差
// 出处：第 1 集 睡眠段（第 1 集 src/scenes/1-sleep.js:1-612，天空转盘 s1Sky、各层 s1Hills/s1Campus/s1Dorm/s1Trees/s1Ground、窗户镂空 s1Dorm 249-271、镜头 parallax）
// 好在哪：屏幕顶边垂下一个半径 360 的半圆转盘，一圈 24 小时刻度，白天半边浅金、夜半边深紫，太阳和月亮各贴在相对的两端；12 秒里转盘走完 24 小时（起头先反拨 0.4 小时蓄一下，末尾回拨 0.3 小时落定）。
//       天色整页只靠 6 个色标分段插值（夜、拂晓、白天、黄昏），不用渐变光；远山、中楼、近树、地面 4 层纸雕各带一圈 2×4 像素的厚边和一层偏移 (6,9) 的硬投影，镜头左右各漂 70 像素，4 层按 0.12/0.4/0.85/1.3 的比例错开，视差一眼可见。
//       楼房的窗是真剪空的：白天透出身后的天空和远山，夜里按 0.35–0.9 的阈值一扇一扇亮起暖黄纸（共 22 扇暗着不亮），不画任何光晕。
// 复用：scene 里 fxPlay('sky-dial', c, t)，或把 fxSkyDraw(c, t, hour, cam) 拆出来：hour 是转盘此刻几点（可以由台词驱动，不必走 FX_SKY.hour 表），cam 是镜头横移像素。
//       改 FX_SKY.hour 的关键帧换转盘节奏，改 FX_SKY.pch 换讲解人的站位。
// 分叉：1) 换题材时改 FX_SKY.sky 色标和 FX_SKY.layers 的日夜色（例如讲季节，把夜色换成冬雪色）；2) 改 FX_SKY.dial.R 与刻度（24 格换 12 格做钟面，或 7 格做星期转盘）；3) 改 fxSkyBuildings 的随机种子与层数（把楼房换成书架、货架或田埂）。

const FX_SKY = {
  dial: { x: CX, y: 0, R: 360, rim: 98 },                  // 转盘圆心在屏幕顶边，只露下半圆
  // 转盘此刻几点：[秒, 钟点]。1.3 秒反拨到 5.6 点（蓄力），9.6 秒转到 30.3（超过一圈 0.3），11.5 秒回落到 30（= 次日 6 点，接回开头）
  hour: [[0, 6], [.9, 6], [1.3, 5.6], [10.9, 30.3], [11.5, 30]],
  cam: [[0, -70], [1.3, -70], [10.9, 70], [11.5, 70]],      // 镜头横移像素：和转盘一起走
  par: { hills: .12, mid: .4, trees: .85, ground: 1.3 },   // 各层跟镜头的比例，越近越大
  shadow: { sx: 6, sy: 9, blur: 0 },                       // 硬投影，单层
  edge: [2, 4],                                            // 纸的厚边（深色副本的偏移）
  pch: { x: 1640, y: 950, h: 470 },
  // 天色色标 [钟点, 颜色]（整页纸色，分段插值）
  sky: [[0, '#413852'], [4.5, '#413852'], [5.6, mix(P.purple, P.paper, .45)], [6.6, mix(P.moon, P.paper, .6)], [8, '#ece5d6'],
    [16, '#ece5d6'], [17.6, mix(P.moon, P.paper, .5)], [18.6, mix(P.red, P.moon, .45)], [19.8, mix(P.purple, P.night, .35)], [21.2, '#413852'], [24, '#413852']],
  // 每层 [白天色, 夜色]
  layers: { hills: [mix(P.g1, P.purple, .22), '#352e46'], mid: [mix(P.g2, P.g1, .5), '#2a2538'], trees: [mix(P.g3, P.ink2, .5), '#1d1a22'], ground: [mix(P.ink2, P.g3, .45), '#15111a'] },
  face: { day: '#f3ead2', night: P.night3, rim: '#ede4cc', sun: P.moon, moon: '#ede6d6', brass: '#b08a45' },
  lamp: P.lamp,
};

// 山脊线：x → y（远山和「透过窗洞看到的远山」共用）
const fxSkyRidge = x => 585 + 42 * Math.sin(x * .004 + 1) + 18 * Math.sin(x * .011);
// 楼房：{ x0, w, top, cols, rows }，固定种子，中间 800–1120 一带不高过 500（给转盘读数留位置）
const fxSkyBuildings = (() => { const r = rng(11), out = []; let x = -260, k = 0;
  while (x < W + 260) { const w = 150 + Math.floor(r() * 60), top = 500 + Math.floor(r() * 170), cols = Math.floor((w - 30) / 62);
    out.push({ x0: x, w, top, cols, rows: Math.floor((880 - top - 40) / 76), k: k++, step: r() < .35 }); x += w + Math.floor(r() * 12); }
  return out; })();
const fxSkyTrees = [[150, 940, 128], [470, 950, 104], [1215, 945, 118]];   // x, 脚底, 冠半径
const fxSkyStars = (() => { const r = rng(5), o = []; while (o.length < 34) { const x = r() * W, y = 60 + r() * 400; if (Math.hypot(x - CX, y) < FX_SKY.dial.R + 40 || (y > 330 && x > 880 && x < 1040)) continue; o.push([x, y, 5 + r() * 7, r() * 3]); } return o; })();
const fxSkyWin = { w: 34, h: 46 };

// 钟点 hh → 天色（整页）
function fxSkyColor(hh) {
  const K = FX_SKY.sky, h = ((hh % 24) + 24) % 24;
  for (let i = 1; i < K.length; i++) if (h < K[i][0]) return mix(K[i - 1][1], K[i][1], easeSine((h - K[i - 1][0]) / (K[i][0] - K[i - 1][0])));
  return K.at(-1)[1];
}
// 夜的程度 0..1：太阳高度 < -0.2 全黑，> 0.2 全白天
const fxSkyNight = hh => 1 - sm(-.2, .2, Math.cos((hh - 12) / 24 * TAU), easeSine);
const fxSkyCol = (name, nk) => mix(FX_SKY.layers[name][0], FX_SKY.layers[name][1], nk);

// 一片带厚边的纸：深色副本偏移 (2,4) 带硬投影，再盖一张同轮廓的正面
function fxSkyPaper(c, pts, col, seed, step = 24) {
  const [ex, ey] = FX_SKY.edge, sh = FX_SKY.shadow;
  cutPaper(c, pts.map(p => [p[0] + ex, p[1] + ey]), mix(col, P.ink, .4), { seed, step, ...sh, grain: .04, edge: false });
  return cutPaper(c, pts, col, { seed, step, shadow: false, grain: .1 });
}

function fxSkyHills(c, nk) {
  const pts = [[-320, 1200]]; for (let x = -320; x <= W + 320; x += 24) pts.push([x, fxSkyRidge(x)]); pts.push([W + 320, 1200]);
  fxSkyPaper(c, pts, fxSkyCol('hills', nk), 470, 40);
}
function fxSkyMid(c, camX, h, nk) {
  const col = fxSkyCol('mid', nk), P_ = FX_SKY.par, hillCol = fxSkyCol('hills', nk), sky = fxSkyColor(h);
  const hills = polyPath([[-1000, 1400], ...Array.from({ length: 140 }, (_, i) => { const x = -1000 + i * 24; return [x, fxSkyRidge(x)]; }), [3000, 1400]]);
  const { w: ww, h: wh } = fxSkyWin, inner = mix(col, P.ink, .4);
  for (const b of fxSkyBuildings) {
    const { x0, w, top } = b, body = [[x0, 1200], [x0, top], [x0 + w, top], [x0 + w, 1200]];
    if (b.step) body.splice(2, 0, [x0 + w * .55, top], [x0 + w * .55, top - 36], [x0 + w * .85, top - 36], [x0 + w * .85, top]);   // 屋顶上一个水箱
    fxSkyPaper(c, body, col, 500 + b.k, 28);
    // 窗：剪空。洞里先填身后的天空，再填身后的远山，夜里亮的那几扇盖一张暖黄纸
    const gx = x0 + (w - (b.cols - 1) * 62 - ww) / 2;
    for (let r = 0; r < b.rows; r++) for (let q = 0; q < b.cols; q++) {
      const x = gx + q * 62, y = top + 40 + r * 76, id = b.k * 31 + r * 5 + q, hs = hash(id, 9);
      const thr = hs < .22 ? 9 : .35 + hs * .55, lit = sm(thr, thr + .04, nk, easeOut);
      c.save(); c.beginPath(); c.rect(x, y, ww, wh); c.clip();
      c.fillStyle = sky; c.fillRect(x, y, ww, wh);
      c.save(); c.translate(camX * (P_.mid - P_.hills), 0); c.fillStyle = hillCol; c.fill(hills); c.restore();
      c.fillStyle = FX_SKY.lamp; c.globalAlpha = lit; c.fillRect(x, y, ww, wh); c.globalAlpha = 1;
      c.fillStyle = alpha(inner, .8); c.fillRect(x, y, ww, 6); c.fillRect(x, y, 5, wh);     // 洞口内侧的纸厚（上、左）
      c.restore();
      c.fillStyle = col; c.fillRect(x + ww / 2 - 1.5, y, 3, wh);                           // 窗棂
    }
  }
}
function fxSkyTree(c, x, y, r, col, seed) {
  fxSkyPaper(c, [[x - 12, y + 40], [x - 8, y - r * 1.6], [x + 8, y - r * 1.6], [x + 12, y + 40]], col, seed, 14);
  for (const [dx, dy, rr] of [[-r * .45, -r * 1.7, r * .72], [r * .5, -r * 1.65, r * .7], [0, -r * 2.15, r * .8]]) fxSkyPaper(c, circPts(x + dx, y + dy, rr, 40), col, seed + 3, 16);
}
function fxSkyGround(c, nk) {
  const pts = [[-500, 1200]]; for (let x = -500; x <= W + 500; x += 30) pts.push([x, 915 + 10 * Math.sin(x * .006) + 5 * Math.sin(x * .021 + 2)]); pts.push([W + 500, 1200]);
  fxSkyPaper(c, pts, fxSkyCol('ground', nk), 540, 30);
}

// 转盘：圆盘本体不转（圆对称，投影方向不变），转的是盘面的半边色块、刻度、太阳、月亮；点都按世界坐标算好再画，投影永远朝右下
function fxSkyDial(c, h, nk, t) {
  const { x, y, R, rim } = FX_SKY.dial, F = FX_SKY.face, rho = -(h - 12) / 24 * TAU;
  const ang = hh => Math.PI / 2 + (hh - 12) / 24 * TAU + rho, at = (hh, r) => [x + Math.cos(ang(hh)) * r, y + Math.sin(ang(hh)) * r];
  fxSkyPaper(c, circPts(x, y, R, 120), F.rim, 600, 20);
  const face = (h0, h1, r) => { const o = [[x, y]]; for (let k = 0; k <= 40; k++) o.push(at(lerp(h0, h1, k / 40), r)); return o; };
  cutPaper(c, face(6, 18, R - rim), F.day, { seed: 601, step: 16, shadow: false, grain: .1 });
  cutPaper(c, face(18, 30, R - rim), F.night, { seed: 602, step: 16, shadow: false, grain: .06 });
  // 夜半边的星（纸剪的四角星）
  for (const [hh, r, s] of [[19.6, 120, 9], [20.8, 215, 12], [22, 90, 8], [22.6, 250, 8], [25.5, 240, 10], [26.6, 110, 9], [27.6, 205, 12], [28.7, 150, 8]])
    { const [sx, sy] = at(hh, r); cutPaper(c, starPts(sx, sy, s * 1.6, 4, .3, ang(hh)), '#e9dfc4', { seed: 603 + (hh * 3 | 0), step: 5, shadow: false, grain: 0, edge: false }); }
  // 太阳（12 点）与月亮（0 点），贴在盘面上
  const [sx, sy] = at(12, 170), [mx, my] = at(24, 170);
  cutPaper(c, starPts(sx, sy, 70, 14, .78, ang(12) + t * .15), F.sun, { seed: 610, step: 8, shadow: false, grain: .08 });
  cutPaper(c, circPts(sx, sy, 46, 36), mix(F.sun, '#ffffff', .35), { seed: 611, step: 8, shadow: false, grain: .05 });
  cutPaper(c, crescentPts(mx, my, 56, ang(24) - .6), F.moon, { seed: 612, step: 8, shadow: false, grain: .08 });
  // 刻度：24 格，每 3 小时一长格，每 6 小时一个字
  rline(c, circPts(x, y, R - rim, 120), { w: 2.4, color: alpha(P.ink2, .6), close: true, seed: 620, amp: .6 });
  for (let hh = 0; hh < 24; hh++) { const L = hh % 6 === 0 ? 22 : hh % 3 === 0 ? 16 : 10;
    rline(c, [at(hh, R - 6), at(hh, R - 6 - L)], { w: hh % 3 === 0 ? 3.4 : 2.4, color: P.ink2, seed: 630 + hh, amp: .35 }); }
  for (const hh of [0, 6, 12, 18]) { const [lx, ly] = at(hh, R - 64); c.save(); c.translate(lx, ly); c.rotate(ang(hh) - Math.PI / 2);
    zh(c, String(hh), 0, 0, { size: 48, align: 'center', base: 'middle', color: P.ink }); c.restore(); }
  // 固定的铜指针（在盘下沿，指着此刻的钟点）和读数
  fxSkyPaper(c, [[x - 20, y + R + 50], [x + 20, y + R + 50], [x, y + R + 2]], F.brass, 640, 6);
  const hh = Math.floor(h + 1e-6) % 24, txt = String(hh).padStart(2, '0') + ':00', k = sm(.35, .65, nk);
  zh(c, txt, x, y + R + 118, { size: 56, align: 'center', color: mix(P.ink, P.paper, k) });
}

function fxSkyDraw(c, t, h, camX) {
  const nk = fxSkyNight(h), P_ = FX_SKY.par, pc = FX_SKY.pch;
  c.fillStyle = fxSkyColor(h); c.fillRect(0, 0, W, H); grain(c, polyPath(rectPts(0, 0, W, H)), .1);
  // 夜里不动的远星
  if (nk > .05) for (const [x, y, s, ph] of fxSkyStars) sparkle(c, x - camX * .03, y, s * (1 + .12 * Math.sin(t * 1.6 + ph * 2)), { color: alpha('#e9dfc4', nk * .85), rot: ph });
  const layer = (f, fn) => { c.save(); c.translate(-camX * f, 0); fn(); c.restore(); };
  layer(P_.hills, () => fxSkyHills(c, nk));
  layer(P_.mid, () => fxSkyMid(c, camX, h, nk));
  layer(P_.trees, () => { const col = fxSkyCol('trees', nk); fxSkyTrees.forEach(([x, y, r], k) => fxSkyTree(c, x, y, r, col, 520 + k * 7)); });
  layer(P_.ground, () => fxSkyGround(c, nk));
  fxSkyDial(c, h, nk, t);
  // 帕秋莉站在右侧，朝左讲：转盘开始转时抬起袖子，夜里犯困
  drawPatchouli(c, { x: pc.x, y: pc.y, h: pc.h, facing: -1, pose: 'lecture', mood: nk > .6 ? 'sleepy' : 'normal',
    gesture: key(t, [[0, .1], [.9, .1], [1.4, .9], [10.9, .9], [11.6, .1]]), t, blink: blinkAt(t, 1) });
}

FX.add({ id: 'sky-dial', title: '昼夜转盘与纸雕灯箱视差', src: '第 1 集 睡眠段', dur: 12, bg: 'none',
  draw(c, t) { fxSkyDraw(c, t, key(t, FX_SKY.hour, easeIO), key(t, FX_SKY.cam, easeIO)); } });
