'use strict';
// cyanotype-stars · 蓝晒星图，星点连成星座
// 出处：第 1 集 专注段（1/src/scenes/4-focus.js:40-150，蓝晒底色 S4C、神经元星点 s4Stars、近邻连线 s4Edges、缓慢转动 s4Rot）
// 好在哪：整页只有深蓝、纸白、一颗金色星三种颜色；40 颗纸片星用一个固定随机种子摆进 540×300×420 的椭球，两两间距不小于 125，
//   绕竖轴每 10 秒来回转约 0.5 弧度，近处的星比远处的星移动得多，视差全靠透视，没有任何光晕。星座 46 条线从金星向外逐条画出（4.3 秒），
//   第 5 到 8 秒整张图只放大 4% 来「呼吸」。左下角的帕秋莉半身露出约 750 像素高，给星图一个可比较的尺度。
// 复用：把 FX_CS.n 与 FX_CS.ell 换成自己的节点数与分布范围，边的来源 fxCsEdges 换成真实的关系表（例：论文引用、知识点依赖）；
//   嵌用时 FX.list.find(o => o.id === 'cyanotype-stars').draw(c, tau)，tau 取 0..10，底色由它自己铺满 1920×1080。
// 分叉：① 蓝晒底色 col.bg（例：换成靛红、墨绿的晒图纸）；② 星的纸片造型 fxCsStar（例：圆点、六角雪花、小十字）；
//   ③ 旁边的比例参照人物（例：换琪露诺半身，或去掉人物改放一本翻开的书）。

const FX_CS = {
  n: 40, seed: 4242, ell: [540, 300, 420], minD: 125, maxEdge: 46, edgeD: 300,
  cam: { x: 0, y: 0, z: -1250, yaw: 0, pitch: 0, f: 1250 },
  center: [1250, 520],                    // 星图中心在屏幕上的位置
  yaw0: .35, yawAmp: .5, tilt: .2,        // 转动：基准角、来回摆幅、俯仰
  stars: [.25, 1.5],                      // 星点弹出的起止秒
  lines: [1.9, 6.2],                      // 星座逐条画出的起止秒
  breathe: [5, 8, .04],                   // 呼吸：起、止秒、放大比例
  fade: [.5, 9.4],                        // 整张图淡入、淡出
  inset: 38,                              // 蓝晒纸四周没刷到药水的白边宽度
  col: { bg: mix(P.blue, '#0b2a55', .62), hi: mix(P.blue, '#2a64a0', .5), deep: mix(P.blue, '#061a36', .7), white: '#eef0e6', edge: '#e4e2d6', gold: P.gold },
};

// 固定随机种子摆星，第 0 颗是金星（放在中心附近，所有线从它向外长）
const FX_CS_STARS = (() => {
  const r = rng(FX_CS.seed), [ex, ey, ez] = FX_CS.ell, out = [[0, 0, 0, 1, 0]];
  for (let tries = 0; out.length < FX_CS.n && tries < 4000; tries++) {
    const p = [(r() * 2 - 1) * ex, (r() * 2 - 1) * ey, (r() * 2 - 1) * ez];
    if ((p[0] / ex) ** 2 + (p[1] / ey) ** 2 + (p[2] / ez) ** 2 > 1) continue;
    if (out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < FX_CS.minD)) continue;
    out.push([...p, .4 + r() * .6, r() * TAU]);               // 第 3 项亮度（决定大小），第 4 项自身旋转角
  }
  return out;
})();

// 近邻连线：每颗星最多连两条，按线中点到金星的距离排序，让线从中心向外依次长出
const FX_CS_EDGES = (() => {
  const S = FX_CS_STARS, seen = new Set(), E = [];
  const d = (a, b) => Math.hypot(S[a][0] - S[b][0], S[a][1] - S[b][1], S[a][2] - S[b][2]);
  for (let i = 0; i < S.length; i++) {
    const nb = S.map((_, j) => j).filter(j => j !== i && d(i, j) < FX_CS.edgeD).sort((a, b) => d(i, a) - d(i, b)).slice(0, 2);
    for (const j of nb) { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); E.push([Math.min(i, j), Math.max(i, j)]); } }
  }
  const mid = ([a, b]) => Math.hypot((S[a][0] + S[b][0]) / 2, (S[a][1] + S[b][1]) / 2, (S[a][2] + S[b][2]) / 2);
  return E.sort((p, q) => mid(p) - mid(q)).slice(0, FX_CS.maxEdge);
})();

// 蓝晒纸的毛边（只算一次）：四周留白，药水刷过的区域边缘凹凸不平
const FX_CS_EDGE = (() => {
  const m = FX_CS.inset, pts = [], seg = 28;
  const side = (x0, y0, x1, y1, s) => { for (let i = 0; i < seg; i++) { const u = i / seg; pts.push([lerp(x0, x1, u) + 9 * noise1(i * .3 + s, s), lerp(y0, y1, u) + 9 * noise1(i * .3 + s, s + 5)]); } };
  side(m, m, W - m, m, 1); side(W - m, m, W - m, H - m, 2); side(W - m, H - m, m, H - m, 3); side(m, H - m, m, m, 4);
  return pts;
})();

function fxCsPaperSheet(c) {
  const k = FX_CS.col, path = polyPath(FX_CS_EDGE, true);
    c.fillStyle = k.edge; c.fill(path);                                                      // 白边里压一层稍深的纸色，当作药水渗出的痕迹
  c.save(); c.clip(path);
  c.fillStyle = k.bg; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {                                                           // 刷痕与斑块：平涂椭圆，没有渐变
    const x = W * hash(i, 31), y = H * hash(i, 32), rx = 160 + 260 * hash(i, 33), ry = 40 + 90 * hash(i, 34);
    c.fillStyle = alpha(i % 3 ? k.hi : k.deep, .13); c.fill(polyPath(ellPts(x, y, rx, ry, 28).map((p, j) => [p[0] + 14 * noise1(j * .5, i), p[1] + 8 * noise1(j * .5, i + 9)]), true));
  }
  for (let i = 0; i < 26; i++) rline(c, [[40, 70 + i * 40 + 12 * hash(i, 40)], [W - 40, 70 + i * 40 + 12 * hash(i, 41)]], { w: 5 + 4 * hash(i, 42), color: i % 2 ? k.hi : k.deep, al: .07, seed: 200 + i, amp: 2 });
  grain(c, path, .16);
  c.restore();
  c.strokeStyle = alpha(k.deep, .5); c.lineWidth = 2; c.stroke(path);                      // 蓝色区域的边线
}

// 一颗纸片星：四角菱形，带单层硬投影；金星是八角
function fxCsStar(c, x, y, r, rot, gold, pop) {
  if (pop <= 0) return;
  const pts = starPts(x, y, r * pop, gold ? 8 : 4, gold ? .42 : .26, rot);
  c.save(); c.translate(2.5, 3.5); c.fillStyle = 'rgba(2,10,30,.5)'; c.fill(polyPath(pts, true)); c.restore();
  c.fillStyle = gold ? FX_CS.col.gold : FX_CS.col.white; c.fill(polyPath(pts, true));
  c.strokeStyle = alpha(FX_CS.col.deep, .5); c.lineWidth = 1; c.stroke(polyPath(pts, true));
}

FX.add({
  id: 'cyanotype-stars', title: '蓝晒星图，星点连成星座', src: '第 1 集 专注段', dur: 10, bg: 'none',
  draw(c, t) {
    c.fillStyle = P.paper; c.fillRect(0, 0, W, H);                                          // bg:'none' 不会自动清屏，先铺纸色
    const g = sm(FX_CS.fade[0] - .5, FX_CS.fade[0], t) * (1 - sm(FX_CS.fade[1], FX_CS.fade[1] + .55, t));
    if (g <= 0) return;
    c.save(); c.globalAlpha *= g;
    fxCsPaperSheet(c);
    // 转动与呼吸
    const yaw = FX_CS.yaw0 + FX_CS.yawAmp * Math.sin(TAU * t / 10 - 1.2) , tilt = FX_CS.tilt;
    const [b0, b1, bA] = FX_CS.breathe, bt = clamp((t - b0) / (b1 - b0), 0, 1), br = 1 + bA * Math.sin(bt * Math.PI) ** 2;
    const [cx0, cy0] = FX_CS.center, scr = [];
    FX_CS_STARS.forEach(([x, y, z], i) => {
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      const x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_, y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
      const p = proj([x1, y1, z2], FX_CS.cam);
      scr[i] = p ? [cx0 + (p[0] - CX) * br, cy0 + (p[1] - CY) * br, p[2], z2] : null;
    });
    // 星座线：由内向外，一条接一条，深处的线更细更淡
    const [l0, l1] = FX_CS.lines, nE = FX_CS_EDGES.length, per = .55;
    FX_CS_EDGES.forEach(([a, b], i) => {
      const A = scr[a], B = scr[b]; if (!A || !B) return;
      const st = lerp(l0, l1 - per, i / nE), p = easeIO(clamp((t - st) / per, 0, 1)); if (p <= 0) return;
      const dep = clamp(1 - (A[3] + B[3]) / 2 / 400 * .5 - .25, .3, 1);
      rline(c, [[A[0], A[1]], [B[0], B[1]]], { w: 2.6 * dep + .6, color: FX_CS.col.white, al: .35 + .55 * dep, p, seed: 300 + i, amp: .7 });
    });
    // 星点：远的先画
    const order = scr.map((s, i) => i).filter(i => scr[i]).sort((a, b) => (a === 0) - (b === 0) || scr[b][3] - scr[a][3]);   // 金星最后画，压在最上面
    for (const i of order) {
      const s = scr[i], S = FX_CS_STARS[i], [s0, s1] = FX_CS.stars, st = lerp(s0, s1 - .5, hash(i, 7)), pop = sm(st, st + .5, t, u => easeOutBack(u, 2));
      const r = (i === 0 ? 54 : 16 + 22 * S[3]) * s[2] / .83;
      fxCsStar(c, s[0], s[1], r, S[4] + yaw * .6, i === 0, pop);
    }
    // 比例参照：帕秋莉半身（脚在画外）
    const pin = sm(0.6, 1.3, t, easeOut);
    drawPatchouli(c, { x: 310 - 80 * (1 - pin), y: H + 130, h: 900, pose: 'stand', mood: 'smug', t, blink: blinkAt(t, 3) });
    c.restore();
  },
});
