'use strict';
// 八云紫 —— 剪纸人偶的部件表（胡里胡涂的大妖怪：金色长波浪发、洋帽、紫罩衫、白荷叶裙、橙紫太极罩衫、粉阳伞）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
// 结构照 src/character/remilia.js（洋帽、泡泡袖、荷叶裙、红缎带、洋伞），去掉翅膀、趴、够，裙子改成四层荷叶，加罩衫、长发。
//
// drawYukari(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], parasol:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和蕾米莉亚一样，样张里抬高 100）
//   h        全身高（洋帽顶到脚底），默认 500（全员统一身高，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 一手叉腰、一手拢在身前、歪头 | parasol 一手叉腰、一手握阳伞扛在肩后
//            point 一手叉腰、一手指向前方（gesture 伸多远）| cross 双臂抱胸、脸侧开 | sit 坐着、两腿垂下轻晃
//            旧名兼容：lecture→point、proud/cheer/think→cross、hold/lift→parasol、其余（peek/lie/fly/read/walk/slump/reach…）→stand
//   mood     normal 半垂眼、似笑非笑（默认）| smug 闭眼笑、下巴抬 | smile 眯眼笑 | surprised 眼睛睁圆、嘴 o
//            annoyed 眼睑压低、嘴抿成波浪 | sleepy 眼皮半垂、嘴放平
//            旧名兼容：proud→smug、happy→smile、angry/sad/pout→annoyed、confused/panic/flustered/cry→surprised、calm/smirk→normal、yawn→sleepy
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，parasol 伞尖（parasol 姿势）
//
// drawYukariGap(c, o) 道具「缝隙」：o = { x, y, w 长, rot 旋转, t, open 0..1 张开, al 透明度 }
//   一道暗紫色的月牙形裂口，沿边几只会眨的眼睛，两端各系一个红蝴蝶结；open = 0 时是一条细线。纯函数。
//
// 设计坐标：脚底 (0,0)，y 向下；骨架尺寸照抄蕾米莉亚（脖子 -262、肩 ±22、腰 -204、头缩放 1.1），头部件用「头坐标」（原点在脖子关节）。
// 本文件顶层名字都带 yuk / YUK 前缀。

// ===================== 颜色（压暗、低饱和；紫、橙、红、金要看得出来） =====================
const YUK_K = (() => {
  const hair = '#dcc07a', hairBack = '#b8964f', white = '#f7f3ee', red = P.ribbonRed, eye = '#a8661f', purple = '#8265a3', orange = '#d38a46', black = '#2a2230';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3), hairHi: mix(hair, white, .28),
    cloth: '#efe4e6', fold: mix('#efe4e6', '#8f6f93', .3), frill: '#f6eeee', red, redKnot: mix(red, P.ink, .28),
    cap: '#f1e3e5', capFold: mix('#f1e3e5', '#9a7a8e', .25),
    skin: P.skin, blush: P.blush, sock: '#f3eee9', shoe: '#dccfd4',
    eye, iris: mix(eye, '#f4c870', .5), lash: mix('#4a3320', P.ink, .4), brow: mix(hairBack, P.ink, .5),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    shirt: purple, collar: mix(purple, P.ink, .25), sash: mix('#efe4e6', red, .35),
    tabTop: mix(purple, '#ffffff', .22), tabMid: mix(mix(purple, '#ffffff', .15), orange, .5), tabOrg: orange, tabOrgDk: mix(orange, '#6b3a1a', .4),
    taijiA: mix(purple, '#ffffff', .12), taijiB: mix(orange, '#6b3a1a', .38), black,
    parasol: '#f2dadd', parasolRib: mix('#f2dadd', '#9a6f80', .5), pole: '#5a4638', finial: mix(P.gold, P.ink, .2),
    gapA: '#43285a', gapB: '#1d1028', gapEdge: '#7a4f9a', sclera: '#f1ebe4', gapIris: '#d9602f', gapRing: '#eaa13c', white,
  };
})();
const YUK_CUT = rigCutter(4000);
const YUK_NECK = -262, YUK_WAIST = -204, YUK_HEAD = 1.1, YUK_UP = 104;

// ===================== 部件（载入时剪好） =====================
// 小蝴蝶结：放在 (x, y)，缩放 s，旋转 rot（部件坐标里直接剪好）
const yukBowPts = (x, y, s, rot) => RIG_SHAPES.bow.map(([px, py]) => { const a = px * s, b = py * s; return [x + a * Math.cos(rot) - b * Math.sin(rot), y + a * Math.sin(rot) + b * Math.cos(rot)]; });
// 荷叶裙一层：上沿 (±topHw, topY) 沿钟形放宽到 (±botHw, botY)，下沿 n 个鼓包
function yukTierPts(topY, topHw, botY, botHw, n, depth) {
  const side = [.33, .66, 1].map(u => [lerp(topHw, botHw, Math.pow(u, 1.1)) + 1.2 * Math.sin(u * Math.PI), lerp(topY, botY, u)]);
  const R = side.slice(0, 2), L = R.map(([x, y]) => [-x, y]).reverse();
  return [[-topHw, topY], [topHw, topY], ...R, ...rScallop(rLine([botHw, botY], [-botHw, botY]), n, depth), ...L];
}
const YUK_TIERS = [[-152, 50, 7, 4.5], [-124, 66, 8, 5.5], [-96, 83, 9, 6], [-64, 100, 10, 7]];   // 每层：下沿 y、下沿半宽、鼓包数、鼓包深
const YUK_TAB = { top: -250, bot: -78, hw0: 13, hw1: 34 };                                         // 罩衫：上沿 y、下沿 y、上下半宽
const yukTabHw = y => lerp(YUK_TAB.hw0, YUK_TAB.hw1, Math.pow((y - YUK_TAB.top) / (YUK_TAB.bot - YUK_TAB.top), 1.25));
// 罩衫的一段：y0..y1 之间，左右跟着罩衫边，grow 往外扩（做黑滚边用）；上沿 topEdge(x) 可以是锯齿（橙色的火舌）
function yukTabPts(y0, y1, grow = 0, topEdge = null) {
  const ys = []; for (let y = y0; y <= y1 + .01; y += (y1 - y0) / 8) ys.push(y);
  const R = ys.map(y => [yukTabHw(y) + grow, y]), L = ys.map(y => [-yukTabHw(y) - grow, y]).reverse();
  const top = topEdge ? topEdge(yukTabHw(y0)) : [[-yukTabHw(y0) - grow, y0 - grow], [yukTabHw(y0) + grow, y0 - grow]];
  return [...top, ...R, ...L];
}
// 太极（阴阳鱼）：半径 r，左半（含上面的小半圆，去掉下面的小半圆）
function yukTaijiPts(r) {
  const out = [];
  for (let k = 0; k <= 20; k++) { const a = Math.PI / 2 + k / 20 * Math.PI; out.push([r * Math.cos(a), r * Math.sin(a)]); }
  for (let k = 1; k <= 12; k++) { const a = -Math.PI / 2 + k / 12 * Math.PI; out.push([r / 2 * Math.cos(a), -r / 2 + r / 2 * Math.sin(a)]); }
  for (let k = 1; k < 12; k++) { const a = -Math.PI / 2 - k / 12 * Math.PI; out.push([r / 2 * Math.cos(a), r / 2 + r / 2 * Math.sin(a)]); }
  return out;
}
const YUK_G = (() => {
  const cut = YUK_CUT, g = {};
  // ---- 腿（站姿，脚底为原点）：白长靴到裙下 ----
  const legR = [[4.5, -90], [16.5, -90], [16, -62], [14.6, -34], [14, -14], [7, -14], [6.4, -34], [5, -62]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(11.8, -6.5, 10.5, 6.6, 14), 12, 5, .35); g.shoeL = cut(ellPts(-11.8, -6.5, 10.5, 6.6, 14), 13, 5, .35);
  g.strapR = cut([[5.5, -15], [17.5, -15], [17.5, -12.2], [5.5, -12.2]], 14, 4, .1, false); g.strapL = cut(rMirror([[5.5, -15], [17.5, -15], [17.5, -12.2], [5.5, -12.2]]), 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 靴
  g.shin = cut([[-5.8, -4], [5.8, -4], [5.5, 36], [4.8, 76], [-4.8, 76], [-5.5, 36]], 16, 8, .3);
  g.sitShoe = cut(ellPts(2, 80, 9.5, 6.4, 14), 17, 5, .35);
  // ---- 荷叶裙：四层，每层下沿一圈鼓包；层与层之间一道阴影 ----
  g.tier = YUK_TIERS.map(([by, bw, n, d], i) => { const [ty, tw] = i ? [YUK_TIERS[i - 1][0] - 22, YUK_TIERS[i - 1][1] * .6] : [-209, 18]; return cut(yukTierPts(ty, tw, by, bw, n, d), 20 + i, 4, .45, false); });
  g.tierShade = YUK_TIERS.slice(0, 3).map(([by, bw, n, d], i) => { const pts = rScallop(rLine([bw, by], [-bw, by]), n, d).map(([x, y]) => [x, y + 2.6]); return cut(rStroke(pts, 6), 24 + i, 6, .3, false); });
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 19, xb = u * 40; return cut([[xt - .8, -198], [xt + .8, -198], [xb + 1.4, -156], [xb - 1.4, -156]], 28 + i, 12, .4, false); });
  // ---- 上身：紫色中式上衣、腰带、立领、领口红蝴蝶结 ----
  g.shirt = cut([[-13, -268], [13, -268], [22, -261], [25, -246], [23, -226], [20, -204], [-20, -204], [-23, -226], [-25, -246], [-22, -261]], 30, 8, .5);
  g.neck = cut([[-5, -280], [5, -280], [5.5, -262], [-5.5, -262]], 31, 8, .3, false);
  g.sash = cut([[-22.5, -214], [22.5, -214], [23.5, -203], [-23.5, -203]], 32, 6, .3, false);
  g.stand = cut([[-8.8, -277], [8.8, -277], [10, -264], [0, -260], [-10, -264]], 33, 4, .2, false);
  g.ribbon = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * 1.1, y * 1.1]), 35, 3, .25, false);
  g.ribbonKnot = cut(ellPts(0, 0, 2.8, 3.2, 8), 36, 2, .1, false);
  // ---- 罩衫（腰上到裙摆）：黑滚边、紫、紫橙过渡、橙（上沿火舌）、太极、八卦、侧边红系带 ----
  const flame = (y0, amp, seedK) => hw => { const out = [], n = 9; for (let k = 0; k <= n; k++) { const u = k / n, x = lerp(-hw, hw, u), tip = k % 2 ? amp * (.6 + .7 * hash(k, seedK)) : 0; out.push([x, y0 - tip]); } return out; };
  g.tabTrim = cut(yukTabPts(YUK_TAB.top, YUK_TAB.bot, 2.6), 40, 8, .4, false);
  g.tabPurple = cut(yukTabPts(YUK_TAB.top, YUK_TAB.bot), 41, 8, .3, false);
  g.tabMid = cut(yukTabPts(-208, YUK_TAB.bot, 0, hw => flame(-208, 13, 3)(hw)), 42, 6, .3, false);
  g.tabOrg = cut(yukTabPts(-192, YUK_TAB.bot, 0, hw => flame(-192, 12, 7)(hw)), 43, 6, .3, false);
  const TJ = { y: -128, r: 19 };
  g.tjRing = cut(ellPts(0, TJ.y, TJ.r + 2.4, TJ.r + 2.4, 28), 44, 6, .3, false);
  const tj = yukTaijiPts(TJ.r);
  g.tjA = cut(tj.map(([x, y]) => [x, y + TJ.y]), 45, 6, .25, false);
  g.tjB = cut(tj.map(([x, y]) => [-x, TJ.y - y]), 46, 6, .25, false);
  g.tjDotA = cut(ellPts(0, TJ.y + TJ.r / 2, 3, 3, 10), 47, 2, .1, false);   // 在 B 那半里，颜色是 A
  g.tjDotB = cut(ellPts(0, TJ.y - TJ.r / 2, 3, 3, 10), 48, 2, .1, false);
  // 八卦：两组三爻（离 ☲、坎 ☵），实线一整条，断线两截
  const bars = [], tri = (cx, pat, seed) => pat.forEach((solid, i) => { const y = -184 + i * 6.4, w = 8.5, hh = 1.6, gap = 2.2, seg = (x0, x1, k) => bars.push(cut([[x0, y - hh], [x1, y - hh], [x1, y + hh], [x0, y + hh]], seed + k, 5, .25, false));
    if (solid) seg(cx - w, cx + w, i); else { seg(cx - w, cx - gap, i); seg(cx + gap, cx + w, i + 10); } });
  tri(-10.5, [1, 0, 1], 50); tri(10.5, [0, 1, 0], 60);
  g.tabBars = bars;
  // 侧边红系带：左侧三个叉 + 蝴蝶结 + 两条垂尾
  g.lace = [0, 1, 2].flatMap(i => { const y = -230 + i * 8, xl = -yukTabHw(y) + 2.5, xr = xl + 7;
    return [cut(rStroke([[xl, y], [xr, y + 8]], 2.2), 70 + i * 2, 4, .1, false), cut(rStroke([[xr, y], [xl, y + 8]], 2.2), 71 + i * 2, 4, .1, false)]; });
  g.laceBow = cut(yukBowPts(-17.5, -202, .85, .15), 76, 3, .2, false);
  g.laceTails = [-1, 1].map((sd, i) => cut(rStroke(rOpen([[-17.5, -200], [-17.5 + sd * 3, -186], [-17.5 + sd * 1.5, -170]], 4), u => 3 - 1.2 * u), 77 + i, 5, .15, false));
  // ---- 手臂：袖子（肩为原点）、泡泡袖 + 红袖口、前臂长袖口带荷叶边（肘为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-5.4, 8], [5.4, 8], [5.8, 22], [5.4, 38], [0, 40], [-5.4, 38], [-5.8, 22]], 80, 8, .3);
  g.fore = cut([...[[-5, -3], [0, -4.6], [5, -3], [5.6, 12], [7, 24], [9.4, 32]], ...rScallop(rLine([9.4, 32], [-9.4, 32]), 3, 3.4), [-7, 24], [-5.6, 12]], 81, 7, .3, false);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.1, y * 1.08]), 82, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.1, y * 1.05 + .6]), 83, 5, .3, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(H.open, 84, 3, .2, false); g.handFist = cut(ellPts(0, 5.6, 5.8, 6.6, 14), 85, 3, .25);
  g.handPoint = cut(H.point, 86, 3, .2, false); g.handGrip = cut(H.grip, 87, 3, .2, false);
  // ---- 阳伞（握点为原点，伞杆朝 -y）：浅粉伞面、红缎带荷叶边 + 一圈弧形垂挂的红缎带、伞骨、顶上小饰物 ----
  g.pole = cut(rStroke([[0, 16], [0, -176]], 3.4), 90, 10, .15, false);
  g.crook = cut(rStroke([[0, 12], [0, 20], [-3, 25], [-8, 25], [-10, 21]], 3.4), 91, 4, .1, false);
  const rim = u => [lerp(96, -96, u), -150 + 6 * (1 - (2 * u - 1) ** 2)];
  g.canopy = cut([...rOpen([[-96, -150], [-78, -178], [-40, -196], [0, -201], [40, -196], [78, -178], [96, -150]], 6), ...rScallop(rim, 6, -9)], 92, 8, .6, false);
  const rimUp = u => { const [x, y] = rim(u); return [x, y - 7]; };
  g.canopyTrim = cut([...rScallop(rim, 6, -9), ...rScallop(rimUp, 6, -9).reverse()], 93, 5, .3, false);
  g.swags = [0, 1, 2, 3, 4, 5].map(i => { const a = rim(i / 6), b = rim((i + 1) / 6), mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 24, pts = [];
    for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push([0, 1].map(j => (1 - u) ** 2 * [a[0], a[1]][j] + 2 * u * (1 - u) * [mx, my][j] + u * u * [b[0], b[1]][j])); }
    return cut(rStroke(pts, 3), 94 + i, 6, .2, false); });
  g.ribs = [-1, -.66, -.33, 0, .33, .66, 1].map((u, i) => cut(rStroke([[0, -201], [u * 96, -150 + (Math.abs(u) === 1 ? 0 : 4)]], 1.3), 100 + i, 12, .1, false));
  g.finial = cut([[-2.4, -200], [0, -217], [2.4, -200]], 108, 3, .1, false);
  g.finialBall = cut(ellPts(0, -219, 3.8, 3.8, 10), 109, 2, .1, false);
  // ---- 头（头坐标：脖子关节为原点） ----
  g.face = cut([[0, -3], [12, -6], [23, -13], [32, -25], [37, -42], [39, -62], [38, -82], [33, -98], [0, -107], [-33, -98], [-38, -82], [-39, -62], [-37, -42], [-32, -25], [-23, -13], [-12, -6]], 120, 7, .5);
  // 后发：披到臀的金色波浪长发，边上起伏，发梢一绺一绺；绑几个红蝴蝶结
  const wv = (y, k) => 5 * Math.sin(y * .07 + k) * (y > -80 ? 1 : .3);
  const bY = [-128, -114, -92, -66, -40, -14, 12, 38, 62, 84], bX = [32, 50, 60, 64, 62, 66, 64, 68, 66, 66];
  const sideR = bY.map((y, i) => [bX[i] + wv(y, 1), y]), sideL = bY.map((y, i) => [-(bX[i] + wv(y, 4)), y]);
  const tipsR = [[68, 108], [60, 98], [55, 116], [44, 100], [35, 118], [24, 102], [13, 116], [3, 103]], tipsL = [[-6, 114], [-16, 101], [-27, 117], [-37, 100], [-47, 115], [-57, 99], [-65, 112]];
  g.backHair = cut([[0, -132], ...rOpen(sideR, 5), ...tipsR, ...tipsL, ...rOpen(sideL, 5).reverse()], 121, 9, .8, false);
  g.hairStrands = [-42, -22, 0, 20, 42].map((x0, i) => { const pts = []; for (let y = -10; y <= 96; y += 10) pts.push([x0 + 4 * Math.sin(y * .07 + i * 1.7) + y * .08 * Math.sign(x0 || 1), y]); return cut(rStroke(rOpen(pts, 4), u => 2.2 - 1.4 * u), 122 + i, 6, .2, false); });
  g.hairBows = [cut(yukBowPts(-60, 100, 1, -.25), 130, 3, .2, false), cut(yukBowPts(52, 106, 1, .3), 131, 3, .2, false), cut(yukBowPts(-10, 108, .9, .05), 132, 3, .2, false)];
  g.hairKnots = [[-60, 100], [52, 106], [-10, 108]].map(([x, y], i) => cut(ellPts(x, y + 1, 2.8, 3.1, 8), 133 + i, 2, .1, false));
  // 鬓发：太阳穴垂到胸口的长发绺，末端系红蝴蝶结
  const lc = rOpen([[34, -98], [45, -72], [47, -40], [42, -4], [37, 30], [40, 62], [37, 88]], 4);
  const lockR = rStroke(lc, u => 12 + 4 * Math.sin(Math.PI * Math.min(1, u * 1.3)) - 7 * u * u);
  g.lockR = cut(lockR, 140, 6, .5, false); g.lockL = cut(rMirror(lockR), 141, 6, .5, false);
  g.lockBowR = cut(yukBowPts(38, 82, .95, .2), 142, 3, .2, false); g.lockBowL = cut(yukBowPts(-38, 82, .95, -.2), 143, 3, .2, false);
  g.lockKnotR = cut(ellPts(38, 83, 2.8, 3.1, 8), 144, 2, .1, false); g.lockKnotL = cut(ellPts(-38, 83, 2.8, 3.1, 8), 145, 2, .1, false);
  // 刘海：中间略分、左右两绺长一点
  g.bangs = cut([[-47, -114], [-33, -128], [-14, -135], [0, -136], [14, -135], [33, -128], [47, -114], [53, -96], [49, -62], [42, -86], [36, -62], [30, -84], [23, -60], [17, -82], [9, -66], [3, -82], [-2, -70], [-7, -84], [-13, -61], [-20, -83], [-26, -64], [-32, -84], [-40, -64], [-44, -88], [-50, -70], [-53, -96]], 146, 6, .5, false);
  g.bangLines = [[23, -60, 20, -110], [-13, -61, -10, -114], [36, -62, 35, -102], [-40, -64, -37, -104]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 147 + i, 8, .2, false));
  // 洋帽（mob cap）：蓬起的帽顶、红缎带箍、荷叶帽檐、一个红蝴蝶结
  g.capPuff = cut([[-64, -100], [-73, -118], [-69, -140], [-52, -158], [-26, -168], [0, -171], [26, -168], [52, -158], [69, -140], [73, -118], [64, -100], [0, -108]], 160, 9, .7);
  g.capPleats = [[-40, -128, -48, -152], [-12, -132, -14, -162], [18, -132, 22, -160], [44, -126, 52, -148]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1.4, y0], [lerp(x0, x1, .5) - .9, lerp(y0, y1, .5)], [x1, y1], [lerp(x0, x1, .5) + .9, lerp(y0, y1, .5)], [x0 + 1.4, y0]], 161 + i, 9, .2, false));
  const brim = u => { const v = 1 - 2 * u; return [74 * v, -100 + 26 * v * v]; };
  g.capBand = cut(rStroke(rOpen([[-70, -104], [-36, -116], [0, -120], [36, -116], [70, -104]], 4), 9), 165, 8, .3, false);
  g.capFrill = cut([...rOpen([[-76, -96], [-40, -110], [0, -116], [40, -110], [76, -96]], 5), ...rScallop(u => { const [x, y] = brim(u); return [x, y + 2]; }, 11, 5)], 166, 4, .45, false);
  g.capBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 2, y * 1.7]), 167, 3, .3, false);
  g.capKnot = cut(ellPts(0, 0, 4.4, 5, 10), 168, 2, .1, false);
  return g;
})();
// 帽顶到脚底的设计高度（用来把 h 换成缩放）
const YUK_TOP = -(YUK_NECK - 171 * YUK_HEAD);

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」）；lid 眼睑压下的比例，lower 下眼睑托起，chin 下巴抬（负）
const YUK_MOODS = {
  normal: { eye: 'open', lid: .38, es: 1, brow: [1, -.1], mouth: 'faint', blush: .7, chin: -.02 },
  smug: { eye: 'up', brow: [3, -.16], mouth: 'grin', blush: .9, chin: -.16 },
  smile: { eye: 'open', lid: .28, es: 1, lower: 6, brow: [3, -.1], mouth: 'smile', blush: 1.05 },
  surprised: { eye: 'open', es: 1.12, iris: .6, brow: [7, -.12], mouth: 'o', blush: .8 },
  annoyed: { eye: 'open', lid: .52, es: 1, brow: [-1, .38], mouth: 'wave', blush: .7 },
  sleepy: { eye: 'open', lid: .62, es: .98, brow: [-1, -.1], mouth: 'flat', blush: .7, lookY: 1.5 },
};
const YUK_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', confused: 'surprised', panic: 'surprised', sad: 'annoyed', calm: 'normal', cry: 'surprised', pout: 'annoyed', flustered: 'surprised', yawn: 'sleepy', smirk: 'normal', awkward: 'normal' };
const YUK_POSE_ALIAS = { lecture: 'point', proud: 'cross', cheer: 'cross', hold: 'parasol', lift: 'parasol', peek: 'stand', lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', think: 'cross', slump: 'stand', reach: 'stand', doze: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的；faint（似笑非笑）自己画：一道两头上翘的细弯线
const YUK_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
function yukMouthPts(type, open) {
  if (type === 'faint' && open <= .06) {
    const top = [], bot = [];
    for (let k = 0; k <= 10; k++) { const x = -5.6 + k * 11.2 / 10, y = .7 - (x / 5.6) ** 2 * 2.6; top.push([x, y - .5]); bot.unshift([x, y + .5 + .5 * Math.sin(Math.PI * k / 10)]); }
    return [[...top, ...bot], 'mouth'];
  }
  const [pts, col, tg] = (YUK_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type === 'faint' ? 'smirk' : type, open);
  return [pts, col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
// parasol 扛伞，up 上身下移（坐），sink 头往下沉，shrug 耸肩，lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开
function yukPose(pose, g, tt) {
  const hipB = [-.8, 1.55, 'fist', false];
  switch (pose) {
    case 'point': return { back: hipB, front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.15, g), lerp(1, 1.15, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    case 'cross': return { back: [-.15, 2.0, 'fist', false, 1, 1.4], front: [.15, -2.0, 'fist', false, 1, 1.4], hr: -.05, turn: -.35, look: .9, keepTurn: true };
    case 'sit': return { back: [-.25, .5, 'open', false], front: [.25, -.5, 'open', false], up: YUK_UP, turn: .15, look: .2, hr: .06 };
    case 'parasol': return { back: hipB, front: [.35, -2.2, 'grip', false], parasol: true, hr: .07, turn: .2, look: .3 };
    default: return { back: hipB, front: [.1, -.95 + .05 * Math.sin(tt * 1.3), 'open', false, 1, 1.05], hr: .1, turn: .15, look: .3 };
  }
}

// ===================== 部件表 =====================
const yukIs = (...ps) => k => ps.includes(k.pose), yukNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：手先画，长袖口（带荷叶边）盖在手腕上，上臂袖子，泡泡袖、红袖口
const yukArms = [
  { arms: 'all', order: 'arm', items: [['@hand', 'hm', 'skin'], ['fore', 'lD', 'cloth'], ['armU', 'uD', 'cloth']], sh: 'mid' },
  { arms: 'all', items: [['puff', 'u', 'cloth']], sh: 'mid' },
  { arms: 'all', items: [['cuff', 'u', 'red']], gr: false },
];
const YUK_RIG = {
  name: 'yukari', h: 500, height: YUK_TOP, K: YUK_K, G: YUK_G, cut: YUK_CUT,
  moods: YUK_MOODS, moodAlias: YUK_MOOD_ALIAS, poseAlias: YUK_POSE_ALIAS, pose: yukPose, mouth: yukMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.018, .9, 1],
  face: { style: 'round', ex: 16, ey: -44, far: .25, turnX: 8, rx: 7.6, ry: 10, lookX: 2.4, mouthY: -20, mouthTurn: 9,
    blush: { dx: 8, turn: 0, y: -27, bump: 0, rx: 6, ry: 3 }, brow: { x: 16, y: -63, len: 6.5, seed: 198, th: [1.1, 1.1, .2, .9, 1.1] } },
  arm: { parent: 'ug', shoulder: [22, -250], upper: 36, fore: 32, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；头发、帽顶、蝴蝶结有弹簧
  vars(k) {
    const { ps, tt } = k;
    k.sway = .01 * Math.sin(tt * 1.1) + .004 * Math.sin(tt * 2.5);
    k.breath = 1.2 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, YUK_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, YUK_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [YUK_HEAD, YUK_HEAD] },
    { name: 'skirt', parent: 'body', pivot: [0, YUK_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: yukIs('sit'), parent: 'root', at: (k, sd) => [sd * 12, 4], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    { name: 'ribbonM', parent: 'ug', at: [0, -254] },
    { arms: true },
    // 阳伞：伞杆穿过前手的握点，往后上方斜着扛在肩后
    { name: 'parasol', when: k => k.ps.parasol, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), -.8 + .02 * Math.sin(k.tt * 1.3) + rigSpringRot(k, { len: 180, dir: -Math.PI / 2, gain: .3, max: .15 })); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    // 后发：整片绕头顶下面一点转（和头反着转一部分，披在背后），带弹簧
    { name: 'hairB', parent: 'head', pivot: [0, -100], rot: k => -k.hr * .6, sway: [.012, 1.1, .5], spring: { len: 200, gain: .6, f: 1.5, max: .18 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 40, -96], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.4, sd], spring: { len: 150, gain: .7, f: 2, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 2.5, 0] },
    { name: 'cap', parent: 'head', at: k => [-k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -104], sway: [.012, 1.3, .4], spring: { len: 60, dir: -Math.PI / 2, gain: .4, f: 2.6, max: .12 } },
    { name: 'capBow', parent: 'cap', at: [36, -118], rot: .2, sway: [.04, 2.1, 0], spring: { len: 14, gain: .5, f: 3, max: .4 } },
  ],
  layers: [
    // 伞面在最后面（扛在肩后）
    { when: k => k.ps.parasol, items: [['canopy', 'parasol', 'parasol']], sh: 'big' },
    { when: k => k.ps.parasol, items: [['ribs', 'parasol', 'parasolRib', false]], gr: false },
    { when: k => k.ps.parasol, items: [['canopyTrim', 'parasol', 'red'], ['swags', 'parasol', 'red', false], ['finial', 'parasol', 'pole'], ['finialBall', 'parasol', 'finial']], sh: 'tiny' },
    // 后发、红蝴蝶结
    { items: [['backHair', 'hairB', 'hairBack']], sh: 'big' },
    { items: [['hairStrands', 'hairB', 'hairHi', false]], gr: false, al: .55 },
    { items: [['hairBows', 'hairB', 'red'], ['hairKnots', 'hairB', 'redKnot']], sh: 'tiny', gr: false },
    // 腿
    { when: yukNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'mid' },
    { when: yukNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe'], ['strapL', 'root', 'shoe'], ['strapR', 'root', 'shoe']], sh: 'tiny', gr: false },
    { when: yukIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 裙子：四层荷叶，从最下面一层画起，上一层的鼓包压在下一层上，之间一道阴影
    { items: [[k => k.G.tier[3], 'skirt', 'frill']], sh: 'big' },
    { items: [[k => k.G.tierShade[2], 'skirt', 'fold', false]], gr: false },
    { items: [[k => k.G.tier[2], 'skirt', 'frill']], sh: 'mid' },
    { items: [[k => k.G.tierShade[1], 'skirt', 'fold', false]], gr: false },
    { items: [[k => k.G.tier[1], 'skirt', 'frill']], sh: 'mid' },
    { items: [[k => k.G.tierShade[0], 'skirt', 'fold', false]], gr: false },
    { items: [[k => k.G.tier[0], 'skirt', 'cloth']], sh: 'mid' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    // 上身：紫上衣、腰带、立领
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'shirt']], sh: 'mid' },
    { items: [['sash', 'ug', 'sash']], sh: 'tiny', gr: false },
    // 罩衫：黑滚边 → 紫 → 紫橙过渡 → 橙 → 太极、八卦 → 红系带
    { items: [['tabTrim', 'skirt', 'black']], sh: 'mid', gr: false },
    { items: [['tabPurple', 'skirt', 'tabTop']], gr: false },
    { items: [['tabMid', 'skirt', 'tabMid']], gr: false },
    { items: [['tabOrg', 'skirt', 'tabOrg']] },
    { items: [['tjRing', 'skirt', 'black']], gr: false },
    { items: [['tjA', 'skirt', 'taijiA'], ['tjB', 'skirt', 'taijiB']], gr: false },
    { items: [['tjDotA', 'skirt', 'taijiA'], ['tjDotB', 'skirt', 'taijiB']], gr: false },
    { items: [['tabBars', 'skirt', 'black']], gr: false },
    { items: [['stand', 'ug', 'collar']], sh: 'tiny', gr: false },
    { items: [['lace', 'skirt', 'red', false], ['laceTails', 'skirt', 'red', false], ['laceBow', 'skirt', 'red']], sh: 'tiny', gr: false },
    { items: [['ribbon', 'ribbonM', 'red']], sh: 'tiny', gr: false },
    { items: [['ribbonKnot', 'ribbonM', 'redKnot']], gr: false },
    // 伞杆压在身前、手在伞杆外面握住
    { when: k => k.ps.parasol, items: [['pole', 'parasol', 'pole'], ['crook', 'parasol', 'pole']], sh: 'mid', gr: false },
    ...yukArms,
    // 脸、前发（鬓发 + 蝴蝶结）、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { items: [['lockBowL', 'lockL', 'red'], ['lockBowR', 'lockR', 'red'], ['lockKnotL', 'lockL', 'redKnot'], ['lockKnotR', 'lockR', 'redKnot']], sh: 'tiny', gr: false },
    { call: 'brows' },
    // 洋帽
    { items: [['capPuff', 'capTop', 'cap']], sh: 'big' },
    { items: [['capPleats', 'capTop', 'capFold', false]], gr: false },
    { items: [['capBand', 'cap', 'red']], sh: 'tiny', gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    { items: [['capBow', 'capBow', 'red']], sh: 'tiny', gr: false },
    { items: [['capKnot', 'capBow', 'redKnot']], gr: false },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -50]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, parasol: B.parasol ? rApply(B.parasol, [0, -214]) : null };
  },
};

function drawYukari(c, o = {}) { return drawRig(c, YUK_RIG, o); }

// ===================== 道具：缝隙 =====================
// 一道暗紫色的月牙裂口（弯口朝上、两头尖），沿边几只半睁的眼睛（白眼白 + 橙红瞳孔，按 t 眨），两端各系一个红蝴蝶结。
// 轮廓按（w, open）量化后记忆，只是缓存；画面只由参数决定。
const YUK_GAP_EYES = [[.2, -.4, .8], [.37, .5, 1], [.56, -.2, .9], [.76, .4, .75]];   // [沿裂口的位置 u, 上下偏移(0 在中线)、大小]
const YUK_GAP_MEMO = new Map();
const yukGapY = (u, w) => w * .17 * (1 - (2 * u - 1) ** 2);                               // 中线：两头上翘、中间下垂
const yukGapTh = (u, w, open) => (w * .16 * open) * Math.pow(Math.sin(Math.PI * u), .8);   // 裂口宽度
function yukGapShape(w, open, inset) {
  const key = [Math.round(w), Math.round(open * 40), inset].join('|');
  let p = YUK_GAP_MEMO.get(key);
  if (!p) {
    if (YUK_GAP_MEMO.size > 200) YUK_GAP_MEMO.clear();
    const up = [], dn = [], n = 24;
    for (let k = 0; k <= n; k++) { const u = k / n, x = (u - .5) * w, y = yukGapY(u, w), th = Math.max(.9 * Math.sin(Math.PI * u), yukGapTh(u, w, open) * inset);
      up.push([x, y - th * .4]); dn.unshift([x, y + th * .6]); }
    const q = scissor([...up, ...dn], 300 + Math.round(inset * 10), 7, .6); p = polyPath(q, true); YUK_GAP_MEMO.set(key, p);
  }
  return p;
}
function drawYukariGap(c, o = {}) {
  const { x = 0, y = 0, w = 300, rot = 0, t = 0, open = 1, al = 1 } = o, op = clamp(open, 0, 1), K = YUK_K;
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= al;
  // 外圈：淡紫的晕（半透明、放大一圈的同形）
  const body = yukGapShape(w, op, 1);
  c.save(); c.globalAlpha *= .16 * (.4 + .6 * op); c.strokeStyle = K.gapEdge; c.lineJoin = 'round'; for (const lw of [26, 14]) { c.lineWidth = lw; c.stroke(body); } c.restore();
  c.save(); c.shadowColor = 'rgba(20,10,30,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.fillStyle = K.gapA; c.fill(body); c.restore();
  c.strokeStyle = K.gapEdge; c.lineWidth = 1.4; c.stroke(body);
  c.fillStyle = K.gapB; c.fill(yukGapShape(w, op, .55));   // 里面更深
  // 眼睛
  const nEye = op < .25 ? 0 : YUK_GAP_EYES.length;
  for (let i = 0; i < nEye; i++) {
    const [u, off, sz] = YUK_GAP_EYES[i], th = yukGapTh(u, w, op), ew = Math.min(w * .085, th * 1.7) * sz, eh0 = ew * .5;
    if (ew < 5) continue;
    // 眨眼：每只眼各有周期，周期末尾 0.14 秒内闭上又睁开
    const per = 2.6 + 1.3 * hash(i, 3), ph = ((t + hash(i, 5) * per) % per) / per, bl = ph > .94 ? Math.sin((ph - .94) / .06 * Math.PI) : 0;
    const half = (.55 + .3 * Math.sin(t * .8 + i * 2)) * (1 - bl), eh = Math.max(.6, eh0 * half);
    const ex = (u - .5) * w, ey = yukGapY(u, w) + off * th * .25 + th * .12, look = Math.sin(t * .6 + i * 1.7);
    const lens = new Path2D();
    for (let k = 0; k <= 14; k++) { const a = k / 14, px = ex + (a - .5) * 2 * ew, py = ey - eh * Math.sin(Math.PI * a); k ? lens.lineTo(px, py) : lens.moveTo(px, py); }
    for (let k = 14; k >= 0; k--) { const a = k / 14, px = ex + (a - .5) * 2 * ew, py = ey + eh * .8 * Math.sin(Math.PI * a); lens.lineTo(px, py); }
    lens.closePath();
    c.fillStyle = K.sclera; c.fill(lens);
    c.save(); c.clip(lens);
    const ix = ex + look * ew * .22, ir = Math.min(eh * 1.05, ew * .5);
    c.fillStyle = K.gapRing; c.beginPath(); c.ellipse(ix, ey, ir, ir * 1.05, 0, 0, TAU); c.fill();
    c.fillStyle = K.gapIris; c.beginPath(); c.ellipse(ix, ey, ir * .72, ir * .8, 0, 0, TAU); c.fill();
    c.fillStyle = K.gapB; c.beginPath(); c.ellipse(ix, ey, ir * .2, ir * .62, 0, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = K.gapB; c.lineWidth = Math.max(1, ew * .1); c.stroke(lens);
  }
  // 两端的红蝴蝶结（顺着裂口尖端的方向略斜；轻轻晃）
  const sc = clamp(w / 190, .6, 3);
  for (const sd of [-1, 1]) {
    const ex = sd * w / 2, ey = yukGapY(sd < 0 ? 0 : 1, w), tilt = sd * .35 + .06 * Math.sin(t * 1.7 + sd);
    c.save(); c.translate(ex, ey); c.rotate(tilt); c.scale(sc * 1.5, sc * 1.5);
    c.shadowColor = 'rgba(20,10,30,.3)'; c.shadowBlur = 2; c.shadowOffsetY = 1;
    c.fillStyle = K.red; c.fill(YUK_GAP_BOW); c.strokeStyle = alpha(mix(K.red, '#ffffff', .5), .6); c.lineWidth = .7; c.stroke(YUK_GAP_BOW);
    c.shadowColor = 'transparent'; c.fillStyle = K.redKnot; c.beginPath(); c.ellipse(0, -.4, 2.6, 3, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.restore();
}
const YUK_GAP_BOW = polyPath(spline(RIG_SHAPES.bow, 3, true), true);
