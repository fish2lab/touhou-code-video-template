'use strict';
// 十六夜咲夜 —— 剪纸人偶的部件表（红魔馆的女仆长；第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 银白短发、两鬓各一条细麻花辫（辫梢绿蝴蝶结）、白色荷叶边女仆头饰、蓝色短袖女仆裙 + 白围裙、领口绿领结、白长袜黑圆鞋、腰间银怀表。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawSakuya(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], watch:[x,y], knives:[x,y] | null, tray:[x,y] | null }
//   x, y     脚底中心
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，头饰高出头顶多少各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手交叠在身前（端庄，默认）| bow 女仆礼：上身前倾、低头、双手交叠在裙前
//            knives 一手举到头侧、指间夹三把飞刀扇形张开，另一手叉腰 | throw 掷刀：前手往前甩出，三把飞刀横着飞出去（gesture 0..1 是飞出的距离）
//            watch 一手举起怀表在胸前看时间（表链连到腰间）| tray 一手在肩侧托着托盘（茶杯 + 茶壶），另一手叉腰
//            point 一手叉腰、一手指向前方（gesture 伸多远）
//            旧名兼容：lecture→point、cheer/proud/fight→knives、attack→throw、hold/lift/give/hand/present→tray、read/think→watch、hide/slump/tired→bow、其余（cross/sit/lie/peek/fly/walk/run/parasol/reach…）→stand
//   mood     normal 冷静：眼睑压下三成、嘴平（默认）| smile 营业微笑：眯眼弧线、小笑 | smug 半垂眼、嘴角一挑、下巴抬
//            surprised 眼睛睁圆、嘴 o | annoyed 眼睑压低、眉内端下压、嘴抿成波浪 | sleepy 眼皮半垂、嘴放平
//            flustered 脸红冒汗、眉斜、嘴发抖
//            旧名兼容：happy→smile、proud/smirk→smug、confused→surprised、panic/cry/awkward→flustered、pout/angry/sad→annoyed、tired/yawn→sleepy、calm→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，watch 怀表中心（挂在腰间或举在手里），
//           knives 飞刀（knives：三把刀尖的中心；throw：飞出去的三把刀的中心；其他姿势 null），tray 托盘中心（tray 姿势，其他 null）
//
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -180），root 骨头整体乘 SAK_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 SAK_HEAD，合起来 1.2 倍：脸宽约 154、下巴到头顶约 180。
// 拿东西的手（飞刀、怀表）：手臂先画、被拿的东西压在前臂上，最后只把握着的手指压上去扣在刀柄 / 表边上；托盘压在托着它的手上面。
// 本文件顶层名字都带 sak / SAK 前缀。

// ===================== 颜色（压暗、低饱和；蓝裙、白围裙、绿领结、银发要分得开） =====================
const SAK_K = (() => {
  // 银发分四层，从后往前一层比一层亮（返修三）：后发最暗、偏蓝灰 → 鬓发和辫子 → 头顶 → 刘海最亮；高光近白、发丝线压暗
  const hair = '#e7e9ef', hairCrown = '#cbcfdc', hairSide = '#b7bccd', hairBack = '#959bb2', blue = '#4f6595', white = '#f5f2ee', green = '#4f9670', eye = '#5a76a6', silver = '#c8ccd5';
  return {
    hair, hairCrown, hairSide, hairBack, hairLine: mix(hairBack, hairSide, .3), hairShade: mix(hair, hairBack, .3), hairHi: '#fbfcfe', white,
    dress: blue, dressDeep: mix(blue, P.ink, .3), fold: mix(blue, P.ink, .22),
    apron: white, frill: '#f8f5f1', apronFold: mix(white, '#8790a8', .3),
    green, greenDeep: mix(green, P.ink, .35),
    skin: P.skin, blush: P.blush, sock: '#f3efea', sockLine: mix('#f3efea', '#8a8696', .35), shoe: '#2b2731', shoeHi: '#4a4452',
    // 眼睛分层（第三版）：灰蓝虹膜、下半亮蓝、深瞳孔、上沿阴影；粗眼线深灰
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#c3d8ee', .55), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: mix('#3a3440', P.ink, .55), lash: mix('#3a3440', P.ink, .55), brow: mix('#a7aab8', P.ink, .5),
    mouth: mix('#7a5a5a', P.ink, .5), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    sweat: mix(P.ribbonBlue, P.cap, .62),
    // 道具：银怀表、飞刀、托盘和茶具
    silver, silverDeep: mix(silver, P.ink, .4), watchFace: '#f4efe0', watchInk: '#4a4350',
    blade: '#e2e5ec', bladeEdge: mix('#e2e5ec', '#7d8396', .45), handle: '#3c3642', guard: mix(silver, P.ink, .25), streak: '#c9d4e8',
    tray: mix(silver, '#ffffff', .15), trayRim: mix(silver, P.ink, .3), cup: '#f7f4ef', tea: '#a8643a', potBand: green,
  };
})();
const SAK_CUT = rigCutter(11000);
// 身子坐标：脖子 -212、腰 -180；root 乘 SAK_BODY（脖子落在 -248），头再乘 SAK_HEAD（合起来 1.2）
const SAK_BODY = 1.17, SAK_NECK = -212, SAK_WAIST = -180, SAK_HEAD = 1.2 / SAK_BODY, SAK_SH = [28, -200], SAK_UP = 36, SAK_FORE = 36;
// 头饰那道弧（头坐标）：戴在头顶偏前的荷叶边发箍，正面看是一道拱：正中 -160，两端（x = ±68）低到 -140（比头顶的圆弧平，正中立出头发、两端收进头发），藏进鬓发
const sakBand = x => -160 + 20 * (x / 68) ** 2;
// 二次曲线取点（不含起点）：刘海每一绺是弯的尖叶，两条边都用它画
const sakQ = (p0, q, p1, n = 5) => Array.from({ length: n }, (_, i) => { const u = (i + 1) / n, v = 1 - u; return [v * v * p0[0] + 2 * u * v * q[0] + u * u * p1[0], v * v * p0[1] + 2 * u * v * q[1] + u * u * p1[1]]; });
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变（同八云紫）
const sakHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
const SAK_FAN = [-.56, 0, .56];   // 指间三把刀的张角
const SAK_KNIFE = 1.45, SAK_TRAY = 1.45;   // 飞刀、托盘按骨头放大（部件按小尺寸剪）

// ===================== 部件（载入时剪好） =====================
const SAK_G = (() => {
  const cut = SAK_CUT, g = {};
  // ---- 腿（身子坐标，脚底为原点）：白长袜（袜口藏在裙下）+ 黑色圆鞋、鞋带 ----
  g.legL = cut([[-20, -70], [-8, -70], [-8.5, -12], [-19.5, -12]], 10, 6, .3, false); g.legR = cut([[8, -70], [20, -70], [19.5, -12], [8.5, -12]], 11, 6, .3, false);
  g.sockLines = [-1, 1].map((sd, i) => cut([[sd * 13.6 - .6, -50], [sd * 13.6 + .6, -50], [sd * 13.9 + .6, -18], [sd * 13.9 - .6, -18]], 12 + i, 8, .15, false));
  g.shoeL = cut(ellPts(-14, -9, 15, 9.5, 18), 14, 5, .4); g.shoeR = cut(ellPts(15, -9, 15, 9.5, 18), 15, 5, .4);
  g.shoeHi = [-1, 1].map((sd, i) => cut(ellPts(sd * 14.5 - 4, -13, 5, 2, 10), 16 + i, 3, .1, false));
  g.strapL = cut([[-25, -16.5], [-5, -16.5], [-5, -13.6], [-25, -13.6]], 18, 4, .1, false); g.strapR = cut([[6, -16.5], [26, -16.5], [26, -13.6], [6, -13.6]], 19, 4, .1, false);
  // ---- 裙：蓝色钟形短裙（腰 -180 到裙摆 -62），下面露一圈白衬裙荷叶边 ----
  g.petti = cut([...rOpen([[-62, -72], [0, -68], [62, -72]], 6), ...rScallop(u => [lerp(66, -66, u), -55 + 2.5 * (1 - (2 * u - 1) ** 2)], 11, 4)], 20, 4, .45, false);
  g.skirt = cut([[-25, -183], [0, -184], [25, -183], [30, -164], [37, -138], [46, -108], [56, -82], [63, -64], [32, -59], [0, -58], [-32, -59], [-63, -64], [-56, -82], [-46, -108], [-37, -138], [-30, -164]], 21, 10, .7);
  g.folds = [-.8, -.45, .45, .8].map((u, i) => { const xt = u * 24, xb = u * 58; return cut([[xt - .8, -170], [xt + .8, -170], [xb + 1.4, -66], [xb - 1.4, -66]], 22 + i, 11, .4, false); });
  // ---- 白围裙：腰下一片（下摆荷叶边、两道褶）、胸前护片（上沿荷叶边）、腰带 ----
  g.apron = cut([[-18, -182], [18, -182], [22, -150], [28, -118], [34, -88], [0, -84], [-34, -88], [-28, -118], [-22, -150]], 30, 8, .5);
  g.apronFrill = cut([...rOpen([[-34, -92], [0, -88], [34, -92]], 6), ...rScallop(u => [lerp(38, -38, u), -78 + 2 * (1 - (2 * u - 1) ** 2)], 7, 3.6)], 31, 4, .4, false);
  g.apronFolds = [-1, 1].map((sd, i) => cut([[sd * 8 - .7, -170], [sd * 8 + .7, -170], [sd * 16 + 1.2, -92], [sd * 16 - 1.2, -92]], 32 + i, 10, .3, false));
  g.bib = cut([[-13, -207], [13, -207], [15, -195], [17, -182], [-17, -182], [-15, -195]], 34, 6, .3);
  g.bibFrill = cut([...rOpen([[-15, -205], [0, -206], [15, -205]], 4), ...rScallop(u => [lerp(16, -16, u), -209.5], 6, 2.2)].map(([x, y]) => [x, y]), 35, 3, .2, false);
  g.straps = [-1, 1].map((sd, i) => cut(rScallop(u => [sd * lerp(14, 24, u), lerp(-206, -212, u)], 3, 2).concat([[sd * 25, -208], [sd * 15, -202]]), 36 + i, 3, .2, false));
  g.waistband = cut([[-26.5, -186], [26.5, -186], [27, -178], [-27, -178]], 38, 6, .3, false);
  // ---- 上身：蓝色上衣、脖子、白衬衫圆领、绿领结 ----
  g.bodice = cut([[-13, -217], [13, -217], [24, -211], [29, -199], [28, -186], [26, -177], [-26, -177], [-28, -186], [-29, -199], [-24, -211]], 40, 8, .5);
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 41, 8, .3, false);
  const collarR = [[1, -217.5], [11, -219], [15, -213], [12, -207.5], [5, -206.5], [1, -210]];
  g.collarR = cut(collarR, 42, 3, .2, false); g.collarL = cut(rMirror(collarR), 43, 3, .2, false);
  g.ribbon = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * .85, y * .85]), 44, 3, .25, false);
  g.ribbonKnot = cut(ellPts(0, 0, 2.4, 2.8, 8), 45, 2, .1, false);
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：光着的胳膊（上臂、前臂）、蓝泡泡短袖 + 白袖口（肩为原点）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-6, 6], [6, 6], [6.3, 22], [5.8, 38], [0, 40.5], [-5.8, 38], [-6.3, 22]], 50, 8, .3);
  g.fore = cut([[-5.4, -3], [0, -5], [5.4, -3], [5, 14], [4.4, 37], [-4.4, 37], [-5, 14]], 51, 8, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.18, y * 1.1]), 52, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.18, y * 1.07 + .6]), 53, 5, .3, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(sakHandPts(H.open), 54, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 55, 3, .25);
  g.handPoint = cut(sakHandPts(H.point), 56, 3, .2, false); g.handGrip = cut(sakHandPts(H.grip), 57, 3, .2, false);
  // ---- 飞刀（握点为原点，刀尖朝 +y）：黑刀柄、银护手、细长银刃（中间一道刃线）、飞出去时身后一道风痕 ----
  g.knifeHandle = cut([[-2.2, -5], [2.2, -5], [2.4, 6], [-2.4, 6]], 60, 3, .1, false);
  g.knifeGuard = cut([[-5.2, 6], [5.2, 6], [4.6, 8.6], [-4.6, 8.6]], 61, 3, .1, false);
  g.knifeBlade = cut([[-2.9, 8.4], [2.9, 8.4], [3.1, 22], [2.2, 32], [0, 40], [-1.2, 32], [-2.6, 22]], 62, 3, .12, false);
  g.knifeLine = cut([[.2, 11], [1, 11], [.9, 32], [.4, 32]], 63, 4, .05, false);
  g.streak = cut(rStroke([[0, -42], [0, -8]], u => .4 + 1.6 * u), 64, 6, .1, false);
  // ---- 怀表（中心为原点，表冠朝 -y）：银色表壳、表盘、四个刻度、两根指针、表冠和挂环 ----
  g.watchCase = cut(ellPts(0, 0, 9.5, 9.5, 24), 70, 3, .15);
  g.watchFace = cut(ellPts(0, 0, 7.2, 7.2, 20), 71, 3, .1, false);
  g.watchTicks = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2, x = 5.6 * Math.sin(a), y = -5.6 * Math.cos(a); return cut(ellPts(x, y, .9, .9, 6), 72 + i, 2, .02, false); });
  g.watchHands = [cut(rStroke([[0, .6], [0, -5.4]], .9), 76, 3, .02, false), cut(rStroke([[0, 0], [3.6, 1.8]], 1.1), 77, 3, .02, false)];
  g.watchCrown = cut([[-2, -12.6], [2, -12.6], [2.2, -9], [-2.2, -9]], 78, 2, .05, false);
  g.watchRing = cut(rStroke(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (.15 + .7 * i / 12) + Math.PI; return [2.8 * Math.cos(a), -14.4 + 2.8 * Math.sin(a) + 1.4]; }), 1.1), 79, 2, .02, false);
  // ---- 托盘和茶具（托盘中心为原点，盘面朝上）：银托盘（侧看一道扁椭圆 + 盘沿）、茶杯 + 碟子、小茶壶（绿色腰带） ----
  g.tray = cut(ellPts(0, 0, 27, 4.6, 24), 80, 4, .15);
  g.trayRim = cut([[-27, 0], [27, 0], [25, 3.6], [-25, 3.6]], 81, 4, .1, false);
  g.saucer = cut(ellPts(-9, -3, 9.5, 2.2, 14), 82, 3, .08, false);
  g.cup = cut([[-15.5, -13.5], [-2.5, -13.5], [-3.6, -8], [-6, -4.6], [-12, -4.6], [-14.4, -8]], 83, 3, .1);
  g.cupHandle = cut(rStroke(Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + Math.PI * i / 10; return [-2.8 + 3 * Math.cos(a), -9.8 + 2.8 * Math.sin(a)]; }), 1.3), 84, 2, .03, false);
  g.tea = cut(ellPts(-9, -13.2, 6.3, 1.3, 10), 85, 2, .03, false);
  g.pot = cut([[6, -5], [6.5, -11], [9, -15.5], [14, -17], [19, -15.5], [21.5, -11], [22, -5], [18, -2.6], [10, -2.6]], 86, 3, .12);
  g.potSpout = cut([[6.6, -9], [2.4, -14], [.6, -15.6], [1.8, -16.6], [4.2, -14.6], [7.2, -12]], 87, 2, .05, false);
  g.potHandle = cut(rStroke(Array.from({ length: 9 }, (_, i) => { const a = -Math.PI / 2 + Math.PI * i / 8; return [21.4 + 3.4 * Math.cos(a), -10 + 3.6 * Math.sin(a)]; }), 1.4), 88, 2, .03, false);
  g.potBand = cut([[6.4, -9.4], [21.8, -9.4], [21.9, -7.6], [6.3, -7.6]], 89, 3, .05, false);
  g.potLid = cut([[9.4, -15.6], [18.6, -15.6], [16, -18.4], [12, -18.4]], 90, 2, .05, false);
  g.potKnob = cut(ellPts(14, -19.6, 1.8, 1.6, 8), 91, 2, .03, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  // 圆脸：两颊鼓、下巴小（和帕秋莉同一张脸型，全员统一）
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 100, 7, .5);
  // 头发四层（返修三），从后往前：后发（最暗）→ 鬓发 + 辫子 → 头顶发（亮面 + 发丝线）→ 刘海（最亮，一束一片纸，各自投影）。
  // 第 1 层 后发：蓬松短 bob 的外沿，比鬓发宽出一圈，在脸两侧和下巴下面露出来，下沿三束内卷的弯尖；
  // 右边短、左边长一点（dy），不对称。sd = 1 画右半边（从头顶往下到后颈正中），左半边镜像后反向接上。
  const bobSide = (sd, dy) => {
    const arc = Array.from({ length: 9 }, (_, i) => { const a = Math.PI / 2 - i / 8 * Math.PI * .62; return [sd * 84 * Math.cos(a), -110 - 64 * Math.sin(a)]; });
    return [...rOpen([...arc.slice(0, -1), [sd * 84, -84], [sd * 83, -62], [sd * 80, -40 + dy * .5]], 4),
      ...sakQ([sd * 80, -40 + dy * .5], [sd * 83, -12 + dy], [sd * 72, -5 + dy], 4), ...sakQ([sd * 72, -5 + dy], [sd * 75, -18 + dy], [sd * 70, -28 + dy * .5], 3),
      ...sakQ([sd * 70, -28 + dy * .5], [sd * 68, -6 + dy], [sd * 55, -2 + dy], 4), ...sakQ([sd * 55, -2 + dy], [sd * 58, -14 + dy], [sd * 50, -22 + dy * .5], 3),
      ...sakQ([sd * 50, -22 + dy * .5], [sd * 44, -6 + dy], [sd * 32, -8 + dy], 4), [sd * 16, -22], [0, -22]];
  };
  g.backHair = cut([...bobSide(1, 0), ...bobSide(-1, 7).reverse().slice(1, -1)], 101, 8, .7, false);
  // 第 2 层 鬓发：从耳朵前面垂到下巴，外缘比后发收进一圈（露出后发的暗边），内缘盖住脸颊外缘一点；下端内卷成两束弯尖；左边长一点
  const lockPts = (sd, dy) => [[sd * 48, -128], ...rOpen([[sd * 48, -128], [sd * 67, -119], [sd * 76, -96], [sd * 75, -72], [sd * 68, -46 + dy * .5]], 4).slice(1),
    ...sakQ([sd * 68, -46 + dy * .5], [sd * 67, -24 + dy], [sd * 56, -17 + dy], 4), ...sakQ([sd * 56, -17 + dy], [sd * 62, -28 + dy], [sd * 61, -38 + dy], 3),
    ...sakQ([sd * 61, -38 + dy], [sd * 58, -28 + dy], [sd * 50, -26 + dy], 4), ...sakQ([sd * 50, -26 + dy], [sd * 55, -44 + dy * .5], [sd * 56, -62], 4),
    ...rOpen([[sd * 56, -62], [sd * 57, -92], [sd * 52, -118]], 4).slice(1)];
  g.lockR = cut(lockPts(1, 0), 102, 6, .5, false); g.lockL = cut(lockPts(-1, 6), 103, 6, .5, false);
  // 发丝线（粗细变化的细纸条）：中段最粗、两头尖
  const strand = (pts, w, i) => cut(rStroke(pts, u => w * (.35 + .65 * Math.sin(Math.PI * Math.min(1, u * 1.15)))), 117 + i, 6, .1, false);
  g.lockLines = [-1, 1].map((sd, i) => strand(sakQ([sd * 62, -122], [sd * 71, -88], sd > 0 ? [64, -36] : [-64, -32], 6), 1.8, i));
  // 细麻花辫（辫根为原点，朝 +y 垂下）：一节一节的锯齿 + 斜纹，辫梢在胸口高度系绿色小蝴蝶结，下面再垂一撮发尾
  const bl = [], br = []; for (let i = 0; i <= 7; i++) { const y = i * 7.4, w = 3.9 - i * .08; bl.push([-w - (i % 2) * 1.3, y]); br.unshift([w + ((i + 1) % 2) * 1.3, y]); }
  g.braid = cut([...bl, [0, 55], ...br], 104, 4, .2, false);
  g.braidLines = Array.from({ length: 7 }, (_, i) => cut([[-3.2, i * 7.4 + 2.6], [3.2, i * 7.4 + 6.4], [3.2, i * 7.4 + 7.8], [-3.2, i * 7.4 + 4]], 105 + i, 4, .08, false));
  g.tuft = cut([[-3.6, 52], [3.6, 52], [5.2, 62], [6.6, 72], [2.4, 67], [0, 77], [-2.4, 67], [-6.6, 72], [-5.2, 62]], 113, 3, .2, false);
  g.braidBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * .78, y * .72 + 53]), 114, 3, .2, false);
  g.braidKnot = cut(ellPts(0, 52.6, 2.2, 2.4, 8), 115, 2, .05, false);
  // 第 3 层 头顶发：贴头的圆顶（右侧翘出一小撮），下沿在额头上方一道浅弧；刘海每两束之间的缝里露出它（比刘海暗一档）
  const crownTop = Array.from({ length: 17 }, (_, i) => { const a = Math.PI - i / 16 * Math.PI; return [77 * Math.cos(a), -112 - 60 * Math.sin(a)]; });
  g.crown = cut([...crownTop.slice(0, -1), [78, -121], [83, -116], [74, -110], ...sakQ([74, -110], [40, -124], [0, -118], 5), ...sakQ([0, -118], [-42, -122], [-77, -110], 5).slice(0, -1)], 116, 6, .5, false);
  // 头顶两侧露出来的发丝线：从发旋（藏在头饰下）往两边放射
  g.crownLines = [strand(sakQ([-40, -150], [-62, -140], [-72, -114], 5), 2, 3), strand(sakQ([44, -150], [64, -140], [73, -114], 5), 1.8, 4)];
  // 第 4 层 刘海：每束一片饱满的弯叶（根部宽、尖端细），根藏在发箍下面；斜分在 x = 24，左边几束长、斜跨额头，右边两束短、往外撇。
  // sakLeaf(根, 根半宽, 尖, 弯)：A 边朝光（左上），B 边背光；shade 是贴着 B 边的一条暗面，line 是顺着发束的一道发丝线
  const sakLeaf = (R, w, T, bend, n = 6) => {
    const dx = T[0] - R[0], dy = T[1] - R[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const at = (s, o) => [R[0] + dx * s + nx * o, R[1] + dy * s + ny * o];
    const leaf = (o, ww) => { const A = at(0, o + ww), B = at(0, o - ww);
      return [A, ...sakQ(A, at(.5, o * .5 + ww * 1.15 + bend * L), T, n), ...sakQ(T, at(.5, o * .5 - ww * 1.15 + bend * L), B, n), at(-.12, o)]; };
    return { leaf: leaf(0, w), shade: leaf(-w * .55, w * .42).slice(1, -1), line: sakQ(at(.08, w * .25), at(.5, w * .3 + bend * L), at(.86, w * .05 + bend * L * .3), 6) };
  };
  const rootY = x => sakBand(x) + 6;
  // 画的顺序从后往前：右二、左三、右一、左二、分缝边的短束、左一（最长，压在最前面，尖落在左眼内角）
  const TUFTS = [
    [[58, rootY(58)], 12, [72, -80], -.1],
    [[-48, rootY(-48)], 13, [-68, -73], .1],
    [[37, rootY(37)], 13, [48, -77], -.09],
    [[-14, rootY(-14)], 15, [-45, -65], .15],
    [[24, rootY(24)], 9, [29, -95], -.07],
    [[16, rootY(16)], 17, [-20, -57], .17],
  ].map(([R, w, T, b]) => sakLeaf(R, w, T, b));
  g.tufts = TUFTS.map((t, i) => cut(t.leaf, 160 + i, 5, .4, false));
  g.tuftShade = TUFTS.map((t, i) => cut(t.shade, 170 + i, 4, .2, false));
  g.tuftLines = TUFTS.map((t, i) => i === 4 ? null : strand(t.line, 2.2, 8 + i)).filter(Boolean);
  // 亮面：头顶偏左上（光源一侧）一道断开的弧形高光带，跨过刘海和缝里的头顶发，显出头是圆的
  g.hairHi = [[-62, -42], [-34, -16], [-8, 8], [14, 26]].map(([a0, a1], i) => { const pts = []; for (let j = 0; j <= 6; j++) { const x = lerp(a0, a1, j / 6); pts.push([x, -126 - 14 * Math.sqrt(Math.max(0, 1 - (x / 74) ** 2))]); }
    return cut(rStroke(pts, u => .8 + (3.6 - i * .5) * Math.sin(Math.PI * u)), 180 + i, 4, .15, false); });
  // 女仆头饰（返修）：头顶偏前的一道细发箍（sakBand），上面立着一圈白色荷叶边，像褶边王冠竖在头发上，两端变矮、藏进鬓发。
  const frTop = rScallop(u => { const x = lerp(-66, 66, u); return [x, sakBand(x) - 19 + 17 * (x / 66) ** 2]; }, 13, 4);
  const frBot = []; for (let k = 0; k <= 16; k++) { const x = lerp(68, -68, k / 16); frBot.push([x, sakBand(x) + 2]); }
  g.frill = cut([...frTop, ...frBot], 130, 4, .4, false);
  const bandL = []; for (let k = 0; k <= 16; k++) { const x = lerp(-72, 72, k / 16); bandL.push([x, sakBand(x) + 2.5]); }
  g.hairband = cut(rStroke(bandL, 3.4), 131, 6, .15, false);
  g.frillPleats = Array.from({ length: 12 }, (_, i) => { const x = -60 + i * (120 / 11) + 5, hgt = 16 - 14 * (x / 66) ** 2;
    return cut([[x - .8, sakBand(x) - 1], [x + .8, sakBand(x) - 1], [x * 1.04 + .4, sakBand(x) - hgt], [x * 1.04 - .4, sakBand(x) - hgt]], 150 + i, 4, .05, false); });
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat.map(([x, y]) => [x * 1.3, y * 1.3]), 140, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂（负：外端上挑），lower 下眼睑托起，es 眼睛大小，iris 虹膜大小，brow [上移, 内端下压角]，chin 下巴抬（负），sweat 冷汗
// 咲夜的眼神（返修）：眼睛偏细长（face.ry 比别人小一点）、外眼角上挑（lidTilt 负）、下眼睑略抬；normal 是冷静里带一点自信的浅笑，头微歪
const SAK_MOODS = {
  normal: { eye: 'open', lid: .2, lidTilt: -.2, lower: 2.2, es: 1, brow: [1, .1], mouth: 'poise', blush: .75, tilt: .07 },
  smile: { eye: 'open', lid: .16, lidTilt: -.14, lower: 6.5, es: 1, brow: [3, -.04], mouth: 'smile', blush: 1.1, chin: -.03, tilt: .09 },
  smug: { eye: 'open', lid: .42, lidTilt: -.22, lower: 3.5, es: 1, brow: [2, .14], mouth: 'smirk', blush: .8, chin: -.1 },
  surprised: { eye: 'open', lid: 0, es: 1.12, iris: .74, brow: [7, -.12], mouth: 'o', blush: .9 },
  annoyed: { eye: 'open', lid: .44, lidTilt: -.1, lower: 2, es: 1, brow: [-1, .36], mouth: 'wave', blush: .8, tilt: -.04 },
  sleepy: { eye: 'open', lid: .62, lidTilt: .06, es: 1, brow: [-1, -.1], mouth: 'flat', blush: .9, lookY: 1.5, tilt: .1 },
  flustered: { eye: 'open', lid: .04, lidTilt: .04, es: 1.08, iris: .8, brow: [4, -.3], mouth: 'wobble', blush: 1.75, sweat: true },
};
const SAK_MOOD_ALIAS = { happy: 'smile', proud: 'smug', smirk: 'smug', confused: 'surprised', panic: 'flustered', cry: 'flustered', awkward: 'flustered', pout: 'annoyed', angry: 'annoyed', sad: 'annoyed', tired: 'sleepy', yawn: 'sleepy', calm: 'normal' };
const SAK_POSE_ALIAS = { lecture: 'point', cheer: 'knives', proud: 'knives', fight: 'knives', attack: 'throw', hold: 'tray', lift: 'tray', give: 'tray', hand: 'tray', present: 'tray', read: 'watch', think: 'watch',
  hide: 'bow', slump: 'bow', tired: 'bow', cross: 'stand', sit: 'stand', lie: 'stand', peek: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand', reach: 'stand', doze: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的；Q 版脸大，整体放大 1.3 倍（同八云紫）
const SAK_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const sakScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
// 咲夜自己的嘴：poise 冷静浅笑（一条细线，右嘴角略挑）
const SAK_MOUTHS = { poise: [[-4.6, -.6], [-1.5, .5], [1.8, .4], [4.4, -1], [5.4, -2.6], [5.2, -.4], [2.2, 1.6], [-1.6, 1.7], [-4.4, .4]] };
function sakMouthPts(type, open) {
  if (SAK_MOUTHS[type]) return [sakScale(SAK_MOUTHS[type]), 'mouth', null];
  const [pts, col, tg] = (SAK_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [sakScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', sakScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角；标记 late 画在头发外面
// grip 前手拿着东西（knives 飞刀 / watch 怀表），手指最后压上去；tray 托盘；fly 飞刀飞出去；lean 上身前倾，sink 头下沉，hr 头额外转角
// sakIK：肩 (±28, -200)（上身坐标）到腕 (tx, ty)，肘往外、往下弯（up = true：肘在下、前臂往上伸）→ [a, b]；sd = -1 是后手（同 ran.js 的 ranIK）
function sakIK(sd, tx, ty, up = false, L1 = SAK_UP, L2 = SAK_FORE) {
  const X = sd * tx - SAK_SH[0], Y = ty - SAK_SH[1], d = clamp(Math.hypot(X, Y), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(X, Y) + (up ? -1 : 1) * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), ex = L1 * Math.sin(a), ey = L1 * Math.cos(a);
  return [sd * a, sd * (Math.atan2(X - ex, Y - ey) - a)];
}
function sakPose(pose, g, tt) {
  const hipB = [-.95, 1.7, 'fist', false];
  switch (pose) {
    case 'bow': return { back: [...sakIK(-1, 3, -150), 'open', false], front: [...sakIK(1, -1, -152), 'open', false], lean: .13, hr: .2, sink: 3, turn: .1, look: 0, lookY: 3 };
    case 'knives': return { back: hipB, front: [...sakIK(1, 74, -236, true), 'grip', 'late'], grip: 'knives', hr: -.04, turn: .22, look: .5 };
    case 'throw': return { back: [-.55, .35, 'open', false], front: [lerp(1.3, 1.6, g), lerp(.35, .05, g), 'open', false, 1.05, 1.05], fly: true, lean: .05, hr: .03, turn: .32, look: .8 };
    case 'watch': return { back: hipB, front: [...sakIK(1, 44, -196, true), 'grip', 'late'], grip: 'watch', hr: .08, turn: .18, look: .35, lookY: 3.5 };
    case 'tray': return { back: hipB, front: [...sakIK(1, 66, -214, true), 'open', 'late'], tray: true, hr: -.03, turn: .2, look: .3 };
    case 'point': return { back: hipB, front: [lerp(1.35, 1.9, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    // 端庄（返修：不再立正）：后手垂在腰前，前手抬到胸前（领结下面），上身略往后手那边斜
    default: return { back: [...sakIK(-1, 6, -166), 'open', false], front: [...sakIK(1, 8, -186, true), 'fist', false], lean: -.035, hr: .05, turn: .14, look: .15 };
  }
}

// ===================== 部件表 =====================
// 拿东西的那只手不跟手臂一层画（被拿的东西画完再只压手指上去）
const sakHandPart = (k, A) => k.ps.grip && A === k.AF ? null : k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
const sakArms = f => [
  { arms: f, order: 'arm', items: [[sakHandPart, 'hm', 'skin'], ['fore', 'lD', 'skin'], ['armU', 'uD', 'skin']], sh: 'mid' },
  { arms: f, items: [['puff', 'u', 'dress']], sh: 'mid' },
  { arms: f, items: [['cuff', 'u', 'white']], gr: false },
];
const sakKnifeItems = bones => bones.flatMap(b => [['knifeBlade', b, 'blade'], ['knifeHandle', b, 'handle'], ['knifeGuard', b, 'guard']]);
const SAK_FAN_B = SAK_FAN.map((_, i) => 'fan' + i), SAK_FLY_B = [0, 1, 2].map(i => 'fly' + i);
// 表链：从腰带垂到怀表的挂环，中间往下坠一点（虚线画成链节）
function sakChain(k) {
  const { B, c, K } = k, s = k.s * SAK_BODY, p0 = rApply(B.ug, [14, -181]), p1 = rApply(B.watch, [0, -14.5]);
  const held = k.ps.grip === 'watch', mx = (p0[0] + p1[0]) / 2, my = Math.max(p0[1], p1[1]) + (held ? 26 : 4) * s;
  c.save(); c.lineCap = 'round';
  c.beginPath(); c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(mx, my, p1[0], p1[1]);
  c.strokeStyle = alpha(K.silverDeep, .9); c.lineWidth = 2.2 * s; c.stroke();
  c.setLineDash([2.2 * s, 1.6 * s]); c.strokeStyle = K.silver; c.lineWidth = 1.3 * s; c.stroke();
  c.restore();
}
const sakWatchLayers = when => [
  { when, call: sakChain },
  { when, items: [['watchCase', 'watch', 'silver'], ['watchCrown', 'watch', 'silverDeep', false], ['watchRing', 'watch', 'silverDeep', false]], sh: 'tiny' },
  { when, items: [['watchFace', 'watch', 'watchFace'], ['watchTicks', 'watch', 'watchInk'], ['watchHands', 'watch', 'watchInk']], gr: false, flat: true },
];
const sakIs = f => k => f(k.ps);
const SAK_RIG = {
  name: 'sakuya', h: 500, height: 520, K: SAK_K, G: SAK_G, cut: SAK_CUT,
  moods: SAK_MOODS, moodAlias: SAK_MOOD_ALIAS, poseAlias: SAK_POSE_ALIAS, pose: sakPose, mouth: sakMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13.6, ry: 14.2, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 298, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: SAK_SH, upper: SAK_UP, fore: SAK_FORE, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得笔直，只轻晃、呼吸；辫子、鬓发、怀表有弹簧
  vars(k) {
    const { ps, tt } = k;
    k.sway = .006 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1 * Math.sin(tt * TAU / 3.2);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, SAK_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', rot: k => k.sway, scale: [SAK_BODY, SAK_BODY] },
    { name: 'body', parent: 'root' },
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, SAK_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [SAK_HEAD, SAK_HEAD] },
    { name: 'skirt', parent: 'body', pivot: [0, SAK_WAIST], rot: k => k.lean * .4, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'ribbonM', parent: 'ug', at: [0, -210] },
    { arms: true },
    // 指间三把飞刀：接在前手的握点上，顺着手指方向扇形张开
    ...SAK_FAN.map((a, i) => ({ name: 'fan' + i, when: k => k.ps.grip === 'knives', m: k => rTR(k.AF.hm, 0, 5, a + .03 * Math.sin(k.tt * 1.6 + i), SAK_KNIFE, SAK_KNIFE) })),
    // 飞出去的三把刀：从前手往前横着飞，gesture 越大飞得越远，三把错开一点
    ...[0, 1, 2].map(i => ({ name: 'fly' + i, when: k => k.ps.fly, m: k => { const ug = k.B.ug, p = rApply(rInv(ug), k.AF.tip), d = 18 + 56 * k.g - i * 10;
      return rTR(ug, p[0] + d, p[1] + (i - 1) * 15 - 4 + i * 2, -Math.PI / 2 + (i - 1) * .05, SAK_KNIFE, SAK_KNIFE); } })),
    // 怀表：平时挂在腰侧（随身子轻晃），watch 姿势举在前手里（表冠朝上，表边落在手指上）
    { name: 'watch', m: k => k.ps.grip === 'watch' ? rTR(k.AF.hm, 0, 20, Math.PI, 1.6, 1.6)
      : rTR(rTR(k.B.ug, 22, -162, 0, 1.15, 1.15), 0, 0, .06 * Math.sin(k.tt * 1.4) + rigSpringRot(k, { len: 18, gain: .8, f: 2.4, max: .4 })) },
    { name: 'gripHand', when: k => k.ps.grip, m: k => k.AF.hm },
    // 托盘：放在前手指尖上，盘面保持水平
    { name: 'tray', when: k => k.ps.tray, m: k => { const ug = k.B.ug, p = rApply(rInv(ug), k.AF.tip); return rTR(ug, p[0] + 8, p[1] - 3, .03 * Math.sin(k.tt * 1.3), SAK_TRAY, SAK_TRAY); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'braid', sides: true, parent: 'head', at: (k, sd) => [sd * 62, -46], rot: (k, sd) => -k.hr * .8 + sd * .03, sway: (k, sd) => [.03, 1.4, sd], spring: { len: 70, gain: .8, f: 2.2, max: .45 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 56, -122], rot: k => -k.hr * .5, sway: (k, sd) => [.015, 1.5, sd], spring: { len: 90, gain: .6, f: 2.3, max: .25 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'band', parent: 'head', at: k => [k.turn * 4.5, 0] },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [70, -108 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 后发
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 腿：白长袜、黑圆鞋
    { items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { items: [['sockLines', 'root', 'sockLine', false]], gr: false },
    { items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { items: [['strapL', 'root', 'shoe'], ['strapR', 'root', 'shoe'], ['shoeHi', 'root', 'shoeHi', false]], gr: false },
    // 裙：白衬裙 → 蓝裙 → 褶
    { items: [['petti', 'skirt', 'frill']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'dress']], sh: 'big' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    // 上身：蓝上衣、白围裙（下摆荷叶边）、胸前护片、腰带
    { items: [['neck', 'ug', 'skin', false], ['bodice', 'ug', 'dress']], sh: 'mid' },
    { items: [['apron', 'skirt', 'apron']], sh: 'mid' },
    { items: [['apronFolds', 'skirt', 'apronFold', false]], gr: false },
    { items: [['apronFrill', 'skirt', 'frill']], sh: 'tiny' },
    { items: [['bib', 'ug', 'apron']], sh: 'tiny' },
    { items: [['straps', 'ug', 'frill'], ['bibFrill', 'ug', 'frill']], sh: 'tiny' },
    { items: [['waistband', 'ug', 'apron']], sh: 'tiny' },
    // 白衬衫圆领、绿领结
    { items: [['collarL', 'ug', 'white'], ['collarR', 'ug', 'white']], sh: 'tiny' },
    { items: [['ribbon', 'ribbonM', 'green']], sh: 'tiny', gr: false },
    { items: [['ribbonKnot', 'ribbonM', 'greenDeep']], gr: false },
    // 挂在腰侧的怀表
    ...sakWatchLayers(k => k.ps.grip !== 'watch'),
    // 手臂（拿东西的那只手除外；knives 的前手画在头发外面）
    ...sakArms(A => A.flag !== 'late'),
    // 飞出去的刀：身后一道风痕
    { when: sakIs(p => p.fly), items: SAK_FLY_B.map(b => ['streak', b, 'streak', false]), gr: false, al: .55 },
    { when: sakIs(p => p.fly), items: sakKnifeItems(SAK_FLY_B), sh: 'tiny' },
    { when: sakIs(p => p.fly), items: SAK_FLY_B.map(b => ['knifeLine', b, 'bladeEdge', false]), gr: false },
    // 脸 → 辫子（辫根藏在鬓发下，从鬓发下端编出来）→ 第 2 层鬓发 → 眉毛 → 第 3 层头顶发 → 第 4 层刘海（一束一层，前一束在后一束上投细影）→ 高光 → 头饰
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['braid', 'braidL', 'hairSide'], ['braid', 'braidR', 'hairSide'], ['tuft', 'braidL', 'hairSide'], ['tuft', 'braidR', 'hairSide']], sh: 'tiny' },
    { items: [['braidLines', 'braidL', 'hairLine', false], ['braidLines', 'braidR', 'hairLine', false]], gr: false },
    { items: [['braidBow', 'braidL', 'green'], ['braidBow', 'braidR', 'green']], sh: 'tiny', gr: false },
    { items: [['braidKnot', 'braidL', 'greenDeep'], ['braidKnot', 'braidR', 'greenDeep']], gr: false },
    { items: [['lockL', 'lockL', 'hairSide'], ['lockR', 'lockR', 'hairSide']], sh: 'mid' },
    { items: [[k => k.G.lockLines[0], 'lockL', 'hairLine', false], [k => k.G.lockLines[1], 'lockR', 'hairLine', false]], gr: false, al: .7 },
    // 眉毛压在刘海下面（左眉被斜刘海遮住一半，右眉从露出的额头上看得见）
    { call: 'brows' },
    { items: [['crown', 'bangs', 'hairCrown']], sh: 'mid' },
    { items: [['crownLines', 'bangs', 'hairLine', false]], gr: false, al: .8 },
    ...[0, 1, 2, 3, 4, 5].flatMap(i => [
      { items: [[k => k.G.tufts[i], 'bangs', 'hair']], sh: 'tiny' },
      { items: [[k => k.G.tuftShade[i], 'bangs', 'hairShade', false]], gr: false, al: .75 },
    ]),
    { items: [['tuftLines', 'bangs', 'hairLine', false]], gr: false, al: .75 },
    { items: [['hairHi', 'bangs', 'hairHi', false]], gr: false, al: .9 },
    { items: [['hairband', 'band', 'hairBack']], gr: false },
    { items: [['frill', 'band', 'frill']], sh: 'tiny' },
    { items: [['frillPleats', 'band', 'apronFold', false]], gr: false },
    // 前手画在头发外面的姿势（knives、watch、tray）：手臂 → 拿着的东西 → 握着的手指
    ...sakArms(A => A.flag === 'late'),
    // 举起来的怀表压在前臂前面，握着的手指再扣到表边上
    ...sakWatchLayers(k => k.ps.grip === 'watch'),
    { when: k => k.ps.grip === 'watch', items: [['handGrip', 'gripHand', 'skin']], sh: 'tiny' },
    // 托盘压在托着它的手上：盘子、盘沿、碟子、茶杯、茶壶
    { when: sakIs(p => p.tray), items: [['trayRim', 'tray', 'trayRim'], ['tray', 'tray', 'tray']], sh: 'mid' },
    { when: sakIs(p => p.tray), items: [['saucer', 'tray', 'cup'], ['potSpout', 'tray', 'cup'], ['potHandle', 'tray', 'cup'], ['pot', 'tray', 'cup'], ['cupHandle', 'tray', 'cup'], ['cup', 'tray', 'cup']], sh: 'tiny' },
    { when: sakIs(p => p.tray), items: [['tea', 'tray', 'tea', false], ['potBand', 'tray', 'potBand', false], ['potLid', 'tray', 'trayRim', false], ['potKnob', 'tray', 'trayRim', false]], gr: false },
    { when: k => k.ps.grip === 'knives', items: sakKnifeItems(SAK_FAN_B), sh: 'tiny' },
    { when: k => k.ps.grip === 'knives', items: SAK_FAN_B.map(b => ['knifeLine', b, 'bladeEdge', false]), gr: false },
    { when: k => k.ps.grip === 'knives', items: [['handGrip', 'gripHand', 'skin']], sh: 'tiny' },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B, ps } = k, avg = (bs, p) => { const q = bs.map(b => rApply(B[b], p)); return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length]; };
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, watch: rApply(B.watch, [0, 0]),
      knives: ps.grip === 'knives' ? avg(SAK_FAN_B, [0, 40]) : ps.fly ? avg(SAK_FLY_B, [0, 20]) : null, tray: ps.tray ? rApply(B.tray, [0, 0]) : null };
  },
};

function drawSakuya(c, o = {}) { return drawRig(c, SAK_RIG, o); }
