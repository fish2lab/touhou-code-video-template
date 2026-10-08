'use strict';
// 八云紫 —— 剪纸人偶的部件表（第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 胡里胡涂的大妖怪：金色长波浪发、红缎带睡帽、紫上衣、白荷叶裙、橙紫阴阳道服挂片、粉阳伞。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawYukari(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], parasol:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和帕秋莉一样，样张里抬高 100）
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，帽顶高度各人不同，见 docs/rig.md）
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
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -180），root 骨头整体乘 YUK_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 YUK_HEAD，合起来 1.2 倍：脸宽约 154、下巴到头顶约 180。
// 本文件顶层名字都带 yuk / YUK 前缀。

// ===================== 颜色（压暗、低饱和；紫、橙、红、金要看得出来） =====================
const YUK_K = (() => {
  const hair = '#dcc07a', hairBack = '#b8964f', white = '#f7f3ee', red = P.ribbonRed, eye = '#a8661f', purple = '#8265a3', orange = '#d38a46', black = '#2a2230';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3), hairHi: mix(hair, white, .28),
    cloth: '#efe4e6', fold: mix('#efe4e6', '#8f6f93', .3), frill: '#f6eeee', red, redKnot: mix(red, P.ink, .28),
    cap: '#f4e9ea', capFold: mix('#f1e3e5', '#9a7a8e', .25), pleat: mix('#f1e3e5', '#9a7a8e', .45),
    skin: P.skin, blush: P.blush, sock: '#f3eee9', shoe: mix(purple, P.ink, .35),
    // 眼睛分层（第三版）：琥珀色虹膜、下半亮金、深瞳孔、上沿阴影；粗眼线深棕
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#f4d27a', .55), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: mix('#4a3320', P.ink, .6), lash: mix('#4a3320', P.ink, .6), brow: mix(hairBack, P.ink, .5),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    shirt: purple, collar: mix(purple, P.ink, .25), sash: mix('#efe4e6', red, .35),
    tabTop: mix(purple, '#ffffff', .22), tabMid: mix(mix(purple, '#ffffff', .15), orange, .5), tabOrg: orange, tabOrgDk: mix(orange, '#6b3a1a', .4),
    taijiA: mix(purple, '#ffffff', .12), taijiB: mix(orange, '#6b3a1a', .38), black,
    parasol: '#f2dadd', parasolRib: mix('#f2dadd', '#9a6f80', .5), pole: '#5a4638', finial: mix(P.gold, P.ink, .2),
    gapA: '#43285a', gapB: '#1d1028', gapEdge: '#7a4f9a', gapIris: '#d9602f', gapRing: '#eaa13c', white,
  };
})();
const YUK_CUT = rigCutter(4000);
// 身子坐标：脖子 -212、腰 -180；root 乘 YUK_BODY（脖子落在 -248），头再乘 YUK_HEAD（合起来 1.2）；坐下时上身下移 YUK_UP（×1.17 ≈ 100）
const YUK_BODY = 1.17, YUK_NECK = -212, YUK_WAIST = -180, YUK_HEAD = 1.2 / YUK_BODY, YUK_UP = 86;

// ===================== 部件（载入时剪好） =====================
// 小蝴蝶结：放在 (x, y)，缩放 s，旋转 rot（部件坐标里直接剪好）
const yukBowPts = (x, y, s, rot) => RIG_SHAPES.bow.map(([px, py]) => { const a = px * s, b = py * s; return [x + a * Math.cos(rot) - b * Math.sin(rot), y + a * Math.sin(rot) + b * Math.cos(rot)]; });
// 荷叶裙一层：上沿 (±topHw, topY) 沿钟形放宽到 (±botHw, botY)，下沿 n 个鼓包
function yukTierPts(topY, topHw, botY, botHw, n, depth) {
  const side = [.33, .66, 1].map(u => [lerp(topHw, botHw, Math.pow(u, 1.1)) + 1.2 * Math.sin(u * Math.PI), lerp(topY, botY, u)]);
  const R = side.slice(0, 2), L = R.map(([x, y]) => [-x, y]).reverse();
  return [[-topHw, topY], [topHw, topY], ...R, ...rScallop(rLine([botHw, botY], [-botHw, botY]), n, depth), ...L];
}
// 短身子的四层荷叶裙：腰 -180 到裙摆 -52（×1.17 ≈ -61，下面露一截袜子）
const YUK_TIERS = [[-151, 40, 6, 4], [-122, 52, 7, 4.6], [-91, 63, 8, 5.2], [-54, 75, 9, 5.8]];   // 每层：下沿 y、下沿半宽、鼓包数、鼓包深
const YUK_TAB = { top: -204, bot: -64, hw0: 10, hw1: 27 };                                          // 挂片：上沿 y、下沿 y、上下半宽
const yukTabHw = y => lerp(YUK_TAB.hw0, YUK_TAB.hw1, Math.pow((y - YUK_TAB.top) / (YUK_TAB.bot - YUK_TAB.top), 1.25));
// 挂片的一段：y0..y1 之间，左右跟着挂片边，grow 往外扩（做黑滚边用）；上沿 topEdge(x) 可以是锯齿（橙色的火舌）
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
// 帽檐（头坐标）：绕头一圈的带子，戴得往后仰，正面看是一道拱：正中 -150，两端（x = ±86）低到 -106
const yukBand = x => -150 + 44 * (x / 86) ** 2;
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变
const yukHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
const YUK_G = (() => {
  const cut = YUK_CUT, g = {};
  // ---- 腿（站姿，脚底为原点，身子坐标）：一截白袜 + 大圆鞋，鞋尖朝前一点 ----
  g.legL = cut([[-20, -56], [-8, -56], [-8.5, -12], [-19.5, -12]], 10, 6, .3, false); g.legR = cut([[8, -56], [20, -56], [19.5, -12], [8.5, -12]], 11, 6, .3, false);
  g.shoeL = cut(ellPts(-14, -9, 15, 9.5, 18), 12, 5, .4); g.shoeR = cut(ellPts(15, -9, 15, 9.5, 18), 13, 5, .4);
  g.strapL = cut([[-25, -16.5], [-5, -16.5], [-5, -13.6], [-25, -13.6]], 14, 4, .1, false); g.strapR = cut([[6, -16.5], [26, -16.5], [26, -13.6], [6, -13.6]], 15, 4, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.5, 18], [4.8, 30], [-4.8, 30], [-5.5, 18]], 16, 8, .4);
  g.sitShoe = cut(ellPts(3, 33, 12.5, 8, 16), 17, 5, .4);
  // ---- 荷叶裙：四层，每层下沿一圈鼓包；层与层之间一道阴影 ----
  g.tier = YUK_TIERS.map(([by, bw, n, d], i) => { const [ty, tw] = i ? [YUK_TIERS[i - 1][0] - 18, YUK_TIERS[i - 1][1] * .62] : [YUK_WAIST - 2, 25]; return cut(yukTierPts(ty, tw, by, bw, n, d), 20 + i, 4, .45, false); });
  g.tierShade = YUK_TIERS.slice(0, 3).map(([by, bw, n, d], i) => { const pts = rScallop(rLine([bw, by], [-bw, by]), n, d).map(([x, y]) => [x, y + 2.4]); return cut(rStroke(pts, 5), 24 + i, 6, .3, false); });
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 23, xb = u * 36; return cut([[xt - .8, -176], [xt + .8, -176], [xb + 1.3, -154], [xb - 1.3, -154]], 28 + i, 12, .4, false); });
  // ---- 上身：紫色上衣（短身子：肩到腰只有 36）、腰带、立领、领口红蝴蝶结 ----
  g.shirt = cut([[-13, -217], [13, -217], [24, -211], [29, -199], [28, -186], [26, -177], [-26, -177], [-28, -186], [-29, -199], [-24, -211]], 30, 8, .5);
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 31, 8, .3, false);
  g.sash = cut([[-26.5, -184], [26.5, -184], [27, -175], [-27, -175]], 32, 6, .3, false);
  g.stand = cut([[-11, -220], [11, -220], [12.5, -210], [0, -206.5], [-12.5, -210]], 33, 4, .2, false);
  g.ribbon = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * 1.05, y * 1.05]), 35, 3, .25, false);
  g.ribbonKnot = cut(ellPts(0, 0, 2.6, 3, 8), 36, 2, .1, false);
  // ---- 阴阳道服的胸前挂片（胸口到裙摆上一层）：黑滚边、紫、紫橙过渡、橙（上沿火舌）、太极、八卦、侧边红系带 ----
  const flame = (y0, amp, seedK) => hw => { const out = [], n = 9; for (let k = 0; k <= n; k++) { const u = k / n, x = lerp(-hw, hw, u), tip = k % 2 ? amp * (.6 + .7 * hash(k, seedK)) : 0; out.push([x, y0 - tip]); } return out; };
  g.tabTrim = cut(yukTabPts(YUK_TAB.top, YUK_TAB.bot, 2.2), 40, 8, .4, false);
  g.tabPurple = cut(yukTabPts(YUK_TAB.top, YUK_TAB.bot), 41, 8, .3, false);
  g.tabMid = cut(yukTabPts(-170, YUK_TAB.bot, 0, hw => flame(-170, 10, 3)(hw)), 42, 6, .3, false);
  g.tabOrg = cut(yukTabPts(-157, YUK_TAB.bot, 0, hw => flame(-157, 9, 7)(hw)), 43, 6, .3, false);
  const TJ = { y: -104, r: 14.5 };
  g.tjRing = cut(ellPts(0, TJ.y, TJ.r + 2, TJ.r + 2, 28), 44, 6, .3, false);
  const tj = yukTaijiPts(TJ.r);
  g.tjA = cut(tj.map(([x, y]) => [x, y + TJ.y]), 45, 6, .25, false);
  g.tjB = cut(tj.map(([x, y]) => [-x, TJ.y - y]), 46, 6, .25, false);
  g.tjDotA = cut(ellPts(0, TJ.y + TJ.r / 2, 2.4, 2.4, 10), 47, 2, .1, false);   // 在 B 那半里，颜色是 A
  g.tjDotB = cut(ellPts(0, TJ.y - TJ.r / 2, 2.4, 2.4, 10), 48, 2, .1, false);
  // 八卦：两组三爻（离 ☲、坎 ☵），实线一整条，断线两截
  const bars = [], tri = (cx, pat, seed) => pat.forEach((solid, i) => { const y = -143 + i * 5.2, w = 6.6, hh = 1.35, gap = 1.8, seg = (x0, x1, k) => bars.push(cut([[x0, y - hh], [x1, y - hh], [x1, y + hh], [x0, y + hh]], seed + k, 5, .25, false));
    if (solid) seg(cx - w, cx + w, i); else { seg(cx - w, cx - gap, i); seg(cx + gap, cx + w, i + 10); } });
  tri(-8.6, [1, 0, 1], 50); tri(8.6, [0, 1, 0], 60);
  g.tabBars = bars;
  // 侧边红系带：左侧三个叉 + 蝴蝶结 + 两条垂尾
  g.lace = [0, 1, 2].flatMap(i => { const y = -198 + i * 6, xl = -yukTabHw(y) + 1.5, xr = xl + 5.5;
    return [cut(rStroke([[xl, y], [xr, y + 6]], 1.9), 70 + i * 2, 4, .1, false), cut(rStroke([[xr, y], [xl, y + 6]], 1.9), 71 + i * 2, 4, .1, false)]; });
  g.laceBow = cut(yukBowPts(-12.5, -177, .7, .15), 76, 3, .2, false);
  g.laceTails = [-1, 1].map((sd, i) => cut(rStroke(rOpen([[-12.5, -175], [-12.5 + sd * 2.5, -164], [-12.5 + sd * 1.2, -152]], 4), u => 2.6 - 1 * u), 77 + i, 5, .15, false));
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：泡泡袖 + 红袖口（肩为原点）、白长袖（上臂、前臂，前臂末端荷叶袖口）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-7.4, 6], [7.4, 6], [7.8, 22], [7.4, 38], [0, 41], [-7.4, 38], [-7.8, 22]], 80, 8, .3);
  g.fore = cut([...[[-6.8, -3], [0, -5], [6.8, -3], [7.4, 12], [9, 24], [11.2, 32]], ...rScallop(rLine([11.2, 32], [-11.2, 32]), 3, 3.6), [-9, 24], [-7.4, 12]], 81, 7, .3, false);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.18, y * 1.1]), 82, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.18, y * 1.07 + .6]), 83, 5, .3, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(yukHandPts(H.open), 84, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 85, 3, .25);
  g.handPoint = cut(yukHandPts(H.point), 86, 3, .2, false); g.handGrip = cut(yukHandPts(H.grip), 87, 3, .2, false);
  // ---- 阳伞（握点为原点，伞杆朝 -y；整把伞由 parasol 骨头再缩小）：浅粉伞面、红缎带荷叶边 + 一圈弧形垂挂的红缎带、伞骨、顶上小饰物 ----
  g.pole = cut(rStroke([[0, 16], [0, -176]], 3.6), 90, 10, .15, false);
  g.crook = cut(rStroke([[0, 12], [0, 20], [-3, 25], [-8, 25], [-10, 21]], 3.6), 91, 4, .1, false);
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
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  // 圆脸：两颊鼓、下巴小（和帕秋莉同一张脸型，全员统一）
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 120, 7, .5);
  // 后发：从帽下披到大腿的金色波浪长发，比脸宽一圈，两边一起一伏，发梢卷成一绺一绺
  const wv = (y, k) => 6 * Math.sin(y * .05 + k);
  const sY = [-150, -122, -92, -60, -28, 4, 36, 68, 98, 122], sX = [64, 75, 81, 82, 80, 83, 85, 85, 84, 80];
  const sideR = sY.map((y, i) => [sX[i] + (i ? wv(y, 1) : 0), y]), sideL = sY.map((y, i) => [-(sX[i] + (i ? wv(y, 4) : 0)), y]);
  const tipsR = [[82, 146], [70, 128], [62, 150], [50, 130], [38, 148], [24, 128], [10, 142], [0, 130]], tipsL = [[-10, 144], [-24, 128], [-37, 149], [-50, 130], [-62, 148], [-71, 128], [-81, 144]];
  g.backHair = cut([[0, -176], [40, -172], ...rOpen(sideR, 5), ...tipsR, ...tipsL, ...rOpen(sideL, 5).reverse(), [-40, -172]], 121, 9, .8, false);
  g.hairStrands = [-56, -30, 0, 30, 56].map((x0, i) => { const pts = []; for (let y = -40; y <= 130; y += 12) pts.push([x0 + 4 * Math.sin(y * .06 + i * 1.7) + y * .06 * Math.sign(x0 || 1), y]); return cut(rStroke(rOpen(pts, 4), u => 2.4 - 1.5 * u), 122 + i, 6, .2, false); });
  // 鬓发：从太阳穴（帽檐下）垂下来的波浪长发绺，比脸还靠外；胸口高度系红蝴蝶结，下面再垂一截发尾（根在 (±58,-110)）
  const lockR = [...rOpen([[50, -128], [66, -118], [75, -86], [79, -50], [74, -16], [80, 18], [76, 46], [80, 74], [74, 96]], 4), [76, 108], [70, 122], [67, 106], [62, 116], [61, 94],
    ...rOpen([[63, 74], [60, 46], [64, 18], [58, -16], [62, -50], [58, -84], [48, -112]], 4)];
  g.lockR = cut(lockR, 140, 6, .5, false); g.lockL = cut(rMirror(lockR).map(([x, y]) => [x, y + (y > 80 ? 3 : 0)]), 141, 6, .5, false);
  g.lockBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 1.15, y * 1.15]), 142, 3, .2, false);
  g.lockKnot = cut(ellPts(0, 0, 3, 3.4, 8), 144, 2, .1, false);
  // 刘海：中间分开、左右两大绺，下缘一排尖刚好压到眼睛上沿
  g.bangs = cut([[-68, -156], [68, -156], [67, -108], [63, -80], [55, -97], [47, -74], [37, -93], [27, -76], [17, -95], [8, -79], [2, -100], [-4, -82], [-12, -97], [-22, -76], [-33, -94], [-44, -74], [-54, -97], [-63, -80], [-67, -108]], 146, 6, .5, false);
  g.bangLines = [[27, -76, 30, -126], [8, -79, 6, -130], [-22, -76, -25, -126], [47, -74, 52, -118], [-44, -74, -50, -116]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 147 + i, 8, .2, false));
  // 睡帽（照帕秋莉的画法）：帽子罩住整个头顶，两侧顺着头往下包到太阳穴；帽顶下沿贴着帽檐那道拱收进去；
  // 帽檐是一圈白荷叶边，上面绕一道红缎带，右前方打一个红蝴蝶结；褶子从帽檐往上往外散。
  const domeTop = [[86, -110], [96, -134], [99, -162], [90, -188], [66, -207], [30, -217], [-8, -219], [-46, -213], [-77, -196], [-96, -168], [-98, -138], [-88, -110]];
  const domeBot = []; for (let k = 0; k <= 16; k++) { const x = -86 + k / 16 * 172; domeBot.push([x, yukBand(x) - 4]); }
  g.capPuff = cut([...domeTop, ...domeBot], 160, 9, .8);
  g.capPuffClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.capLight = polyPath(ellPts(-20, -190, 102, 90, 40), true);   // 帽顶亮面：留出右下一圈浅影
  g.capPleats = [-64, -38, -12, 14, 40, 64].map((x, i) => { const y0 = yukBand(x) - 7, x1 = x * 1.3, y1 = y0 - 42 + Math.abs(x) * .12, xm = lerp(x, x1, .5) + x * .05, ym = lerp(y0, y1, .5);
    return cut([[x - 1.9, y0], [xm - 1.1, ym], [x1, y1], [xm + 1.1, ym], [x + 1.9, y0]], 161 + i, 9, .25, false); });
  const frTop = rScallop(u => { const x = lerp(-92, 92, u), v = x / 92; return [x, yukBand(x) - 9 - 4 * v * v]; }, 15, 2.6);
  const frBot = rScallop(u => { const x = lerp(94, -94, u); return [x, yukBand(x) + 10]; }, 13, 6.2);
  g.capFrill = cut([...frTop, ...frBot], 166, 4, .5, false);
  const bandL = []; for (let k = 0; k <= 18; k++) { const x = -90 + k * 10; bandL.push([x, yukBand(x) - 3]); }
  g.capBand = cut(rStroke(bandL, u => 9.5 - 1.5 * Math.abs(2 * u - 1)), 165, 8, .3, false);
  g.capBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 1.9, y * 1.65]), 167, 3, .3, false);
  g.capKnot = cut(ellPts(0, 0, 4.2, 4.8, 10), 168, 2, .1, false);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂，lower 下眼睑托起（眼睛下半被笑意托住），es 眼睛大小，iris 虹膜大小，chin 下巴抬（负）
// 八云紫的眼神：总是半垂着眼皮、下眼睑微微托起，看人像在看笑话
const YUK_MOODS = {
  normal: { eye: 'open', lid: .36, lidTilt: .05, lower: 2.6, es: 1, brow: [1, -.1], mouth: 'faint', blush: .9, chin: -.02 },
  smug: { eye: 'up', brow: [3, -.16], mouth: 'grin', blush: 1, chin: -.14 },
  smile: { eye: 'open', lid: .3, lidTilt: .03, lower: 5, es: 1, brow: [3, -.1], mouth: 'smile', blush: 1.15 },
  surprised: { eye: 'open', lid: 0, es: 1.1, iris: .78, brow: [7, -.12], mouth: 'o', blush: .9 },
  annoyed: { eye: 'open', lid: .54, lidTilt: 0, es: 1, brow: [-1, .34], mouth: 'wave', blush: .8 },
  sleepy: { eye: 'open', lid: .64, lidTilt: .1, es: 1, brow: [-1, -.1], mouth: 'flat', blush: .9, lookY: 1.5 },
};
const YUK_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', confused: 'surprised', panic: 'surprised', sad: 'annoyed', calm: 'normal', cry: 'surprised', pout: 'annoyed', flustered: 'surprised', yawn: 'sleepy', smirk: 'normal', awkward: 'normal' };
const YUK_POSE_ALIAS = { lecture: 'point', proud: 'cross', cheer: 'cross', hold: 'parasol', lift: 'parasol', peek: 'stand', lie: 'stand', fly: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', think: 'cross', slump: 'stand', reach: 'stand', doze: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的；faint（似笑非笑）自己画：一道两头上翘的细弯线。Q 版脸大，嘴整体放大 1.3 倍
const YUK_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const yukScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
function yukMouthPts(type, open) {
  if (type === 'faint' && open <= .06) {
    const top = [], bot = [];
    for (let k = 0; k <= 10; k++) { const x = -5.6 + k * 11.2 / 10, y = .7 - (x / 5.6) ** 2 * 2.6; top.push([x, y - .5]); bot.unshift([x, y + .5 + .5 * Math.sin(Math.PI * k / 10)]); }
    return [yukScale([...top, ...bot]), 'mouth'];
  }
  const [pts, col, tg] = (YUK_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type === 'faint' ? 'smirk' : type, open);
  return [yukScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', yukScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
// parasol 扛伞，up 上身下移（坐），sink 头往下沉，shrug 耸肩，lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开
function yukPose(pose, g, tt) {
  const hipB = [-.95, 1.7, 'fist', false];
  switch (pose) {
    case 'point': return { back: hipB, front: [lerp(1.35, 1.9, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    case 'cross': return { back: [-.32, 2.15, 'fist', false, 1, 1.15], front: [.3, -2.1, 'fist', false, 1, 1.15], hr: -.05, turn: -.35, look: .9, keepTurn: true };
    case 'sit': return { back: [-.3, .62, 'open', false], front: [.3, -.62, 'open', false], up: YUK_UP, turn: .15, look: .2, hr: .06 };
    case 'parasol': return { back: hipB, front: [.4, -2.05, 'grip', false], parasol: true, hr: .07, turn: .2, look: .3 };
    default: return { back: hipB, front: [.12, -1.05 + .05 * Math.sin(tt * 1.3), 'open', false], hr: .1, turn: .15, look: .3 };
  }
}

// ===================== 部件表 =====================
const yukIs = (...ps) => k => ps.includes(k.pose), yukNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：手先画，长袖口（带荷叶边）盖在手腕上，上臂袖子，泡泡袖、红袖口。
// parasol：握伞的那只手不在这里画——袖子整条在伞柄后面，伞柄画完再只压手指上去（见图层表）
const yukHandPart = (k, A) => k.ps.parasol && A === k.AF ? null : k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
const yukArms = [
  { arms: 'all', order: 'arm', items: [[yukHandPart, 'hm', 'skin'], ['fore', 'lD', 'cloth'], ['armU', 'uD', 'cloth']], sh: 'mid' },
  { arms: 'all', items: [['puff', 'u', 'cloth']], sh: 'mid' },
  { arms: 'all', items: [['cuff', 'u', 'red']], gr: false },
];
// 坐下时裙子绕腰压扁一点、放宽一点，裙摆刚好盖过座沿
const YUK_SIT_SKIRT = (() => { const sx = 1.08, sy = .8; return [sx, 0, 0, sy, 0, YUK_WAIST * (1 - sy)]; })();
const YUK_RIG = {
  name: 'yukari', h: 500, height: 520, K: YUK_K, G: YUK_G, cut: YUK_CUT,
  moods: YUK_MOODS, moodAlias: YUK_MOOD_ALIAS, poseAlias: YUK_POSE_ALIAS, pose: yukPose, mouth: yukMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.016, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 198, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: [28, -200], upper: 36, fore: 36, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；头发、帽顶、蝴蝶结有弹簧
  vars(k) {
    const { ps, tt } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, YUK_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway, scale: [YUK_BODY, YUK_BODY] },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, YUK_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [YUK_HEAD, YUK_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.ps.up ? YUK_SIT_SKIRT : null, pivot: [0, YUK_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: yukIs('sit'), parent: 'root', at: (k, sd) => [sd * 15, 8], rot: (k, sd) => .18 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .07 * sd },
    { name: 'ribbonM', parent: 'ug', at: [0, -209], scale: [.95, .95] },
    { arms: true },
    // 阳伞：伞杆穿过前手的握点，往后上方斜着扛在肩后（整把伞缩到 0.82，和 Q 版身子相称）
    { name: 'parasol', when: k => k.ps.parasol, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), k.AF.tip), -.65 + .02 * Math.sin(k.tt * 1.3) + rigSpringRot(k, { len: 160, dir: -Math.PI / 2, gain: .3, max: .15 }), .9, .9); } },
    { name: 'gripHand', when: k => k.ps.parasol, m: k => k.AF.hm },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    // 后发：垂在背后，只跟一点头的转动（绕脖子把头的转角退回去大半），带弹簧
    { name: 'hairB', parent: 'head', rot: k => -k.hr * .85, sway: [.008, 1.1, .5], spring: { len: 200, gain: .5, f: 1.5, max: .12 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -110], rot: k => -k.hr * .55, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 150, gain: .6, f: 2, max: .25 } },
    { name: 'lockBow', sides: true, parent: (k, sd) => 'lock' + (sd < 0 ? 'L' : 'R'), at: (k, sd) => [sd * 70, 50], rot: (k, sd) => sd * .2, scale: (k, sd) => sd < 0 ? [.92, .92] : null },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'cap', parent: 'head', at: k => [k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -150], sway: [.008, 1.2, .5], spring: { len: 60, dir: -Math.PI / 2, gain: .3, f: 2.6, max: .05 } },
    { name: 'capBow', parent: 'cap', at: [50, yukBand(50) - 4], rot: .25, sway: [.04, 2.1, 0], spring: { len: 14, gain: .5, f: 3, max: .4 } },
  ],
  layers: [
    // 伞面在最后面（扛在肩后）
    { when: k => k.ps.parasol, items: [['canopy', 'parasol', 'parasol']], sh: 'big' },
    { when: k => k.ps.parasol, items: [['ribs', 'parasol', 'parasolRib', false]], gr: false },
    { when: k => k.ps.parasol, items: [['canopyTrim', 'parasol', 'red'], ['swags', 'parasol', 'red', false], ['finial', 'parasol', 'pole'], ['finialBall', 'parasol', 'finial']], sh: 'tiny' },
    // 后发
    { items: [['backHair', 'hairB', 'hairBack']], sh: 'big' },
    { items: [['hairStrands', 'hairB', 'hairHi', false]], gr: false, al: .5 },
    // 腿
    { when: yukNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: yukNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: yukNot('sit'), items: [['strapL', 'root', 'shoe'], ['strapR', 'root', 'shoe']], gr: false },
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
    // 挂片：黑滚边 → 紫 → 紫橙过渡 → 橙 → 太极、八卦 → 红系带
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
    // 手臂（parasol：握伞的手除外）
    ...yukArms,
    // 伞杆压在袖子前面，握伞的手指再压在伞杆上
    { when: k => k.ps.parasol, items: [['pole', 'parasol', 'pole'], ['crook', 'parasol', 'pole']], sh: 'mid', gr: false },
    { when: k => k.ps.parasol, items: [['handGrip', 'gripHand', 'skin']], sh: 'tiny' },
    // 脸、前发（鬓发 + 胸口的蝴蝶结）、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { items: [['lockBow', 'lockBowL', 'red'], ['lockBow', 'lockBowR', 'red']], sh: 'tiny', gr: false },
    { items: [['lockKnot', 'lockBowL', 'redKnot'], ['lockKnot', 'lockBowR', 'redKnot']], gr: false },
    { call: 'brows' },
    // 睡帽：帽顶（褶色打底 + 亮面）→ 褶子 → 荷叶帽檐 → 红缎带 → 蝴蝶结
    { items: [['capPuff', 'capTop', 'capFold']], sh: 'big' },
    { call: k => { const m = k.B.capTop, c = k.c; c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.capPuffClip); c.fillStyle = k.K.cap; c.fill(k.G.capLight); c.restore(); } },
    { items: [['capPleats', 'capTop', 'pleat', false]], gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    { items: [['capBand', 'cap', 'red']], sh: 'tiny', gr: false },
    { items: [['capBow', 'capBow', 'red']], sh: 'tiny', gr: false },
    { items: [['capKnot', 'capBow', 'redKnot']], gr: false },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, parasol: B.parasol ? rApply(B.parasol, [0, -214]) : null };
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
