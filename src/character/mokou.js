'use strict';
// 藤原妹红 —— 剪纸人偶的部件表（第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 不死的蓬莱人：银白长直发垂到小腿，头上一个白底红边的大蝴蝶结，鬓发和发梢系着红白符纸小蝴蝶结；红眼；白长袖衬衫、红色宽腿背带裤（贴着白符纸）、棕鞋；
// 平时双手插兜，会在掌心托火、展开火焰凤凰翅膀。她穿裤子没有裙子：腿和裤脚自己画，脚底和鞋的位置照规格表。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表；火焰和翅膀是本文件的自画层。纯 Canvas 代码绘制，不加载任何图片。
//
// drawMokou(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], flame:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和帕秋莉一样，样张里抬高 100）
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，蝴蝶结高出头顶多少各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手插在裤兜里、站得松松垮垮（默认）| fire 一手插兜、一手掌心向上托着一团火
//            wings 背后展开两片火焰羽翼、双臂张开、两只手心各一小团火 | point 一手插兜、一手指向前方（gesture 伸多远）
//            cross 双臂抱胸、脸侧开 | sit 坐着、两腿垂下轻晃、手搭在膝上 | slouch 驼背、低头歪头、双手插兜（懒散）
//            旧名兼容：lecture→point、proud/cheer→cross、hold/lift/give/present→fire、fly/cast→wings、tired/doze/slump/lie/hide→slouch、think/angry→cross、其余（peek/read/walk/run/reach/parasol…）→stand
//   mood     normal 半垂眼、嘴平，淡漠（默认）| smile 眼睛托起、小笑 | grin 眼睑压低、嘴角一挑露虎牙（不羁的笑）
//            annoyed 眉头压下、嘴抿成波浪 | surprised 眼睛睁圆、嘴 o | sleepy 眼皮快合上、嘴放平 | sad 眉梢下垂、嘴抖
//            旧名兼容：smug/proud/smirk→grin、happy/laugh→smile、angry/pout→annoyed、cry→sad、confused/panic/flustered→surprised、calm/awkward→normal、yawn/tired→sleepy
//   wings    0..1 强制展开火焰羽翼的程度（wings 姿势总是 1；别的姿势默认 0）
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（插兜时是兜口；按屏幕 x 从左到右），tip 前手，flame 前手掌心火焰的中心（fire、wings；没有火时 null）
//
// 火焰和翅膀：形状随 t 用 hash 插值变化（纯函数，不存状态），每帧现算轮廓，不用 c.filter。
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -184），root 骨头整体乘 MOK_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 MOK_HEAD，合起来 1.2 倍：脸宽约 154、下巴到头顶约 180。
// 本文件顶层名字都带 mok / MOK 前缀。

// ===================== 颜色（压暗、低饱和；银白发、红裤、红眼、橙火要看得出来） =====================
const MOK_K = (() => {
  const hair = '#ebe8ed', hairBack = '#c9c4d0', shirt = '#f5f2ec', red = '#b23d3d', eye = '#c2343c', shoe = '#7a5238', paper = '#f6f1e4';
  return {
    hair, hairBack, hairLine: mix(hairBack, '#7d7488', .35), hairHi: mix(hair, '#ffffff', .4),
    shirt, shirtFold: mix(shirt, '#8a8496', .3), collar: '#fbf9f5',
    red, redDeep: mix(red, P.ink, .32), redFold: mix(red, P.ink, .2), button: mix('#3a2a2a', red, .2),
    bow: '#faf7f2', bowRed: '#c23b40', bowKnot: mix('#c23b40', P.ink, .25),
    paper, paperInk: '#b8343a', paperEdge: mix(paper, '#9a8a6a', .35),
    shoe, shoeDeep: mix(shoe, P.ink, .35),
    skin: P.skin, blush: P.blush, white: '#f7f3ee',
    // 眼睛分层（第三版）：红虹膜、下半亮橙红、深瞳孔、上沿阴影；粗眼线深色
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#ffb48a', .5), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: '#2e2430', lash: '#2e2430', brow: mix(hairBack, P.ink, .5),
    mouth: mix('#7a5a5a', P.ink, .55), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    // 火：外层深橙红、中层橙、里层黄、芯淡黄
    flameOut: '#d2482c', flameMid: '#ec8a34', flameIn: '#f7cf62', flameCore: '#fff0bf',
  };
})();
const MOK_CUT = rigCutter(12000);
// 身子坐标：脖子 -212、腰 -184；root 乘 MOK_BODY（脖子落在 -248），头再乘 MOK_HEAD（合起来 1.2）；坐下时上身下移 MOK_UP（×1.17 ≈ 100）
const MOK_BODY = 1.17, MOK_NECK = -212, MOK_WAIST = -184, MOK_HEAD = 1.2 / MOK_BODY, MOK_UP = 86;
const MOK_SH = [28, -200], MOK_ARM_U = 36, MOK_ARM_F = 36;
// 兜口（身子坐标）：插兜时手腕落在这里；兜口那道斜线从 (21,-150) 到 (37,-143)，在裤子侧缝上
const MOK_POCKET = [30, -136];

// ===================== 部件（载入时剪好） =====================
// 符纸小蝴蝶结：红底整片 + 缩小的白片压在上面（白底红边），中心一个红结
const mokBowPts = s => RIG_SHAPES.bow.map(([x, y]) => [x * s, y * s]);
// 符纸（贴在裤子上）：(x, y) 中心、rot 斜一点；一张白纸 + 红色的符文（中间一竖、上面一个框、两道横）
function mokTalisman(cut, x, y, rot, seed) {
  const T = ([px, py]) => [x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)];
  const paper = cut([[-4.4, -9.5], [4.4, -9.5], [4.6, 9.5], [-4.6, 9.5]].map(T), seed, 5, .25, false);
  const marks = [cut(rStroke([[0, -4], [0, 7.5]].map(T), 1.3), seed + 1, 4, .1, false),
    cut([[-2.6, -7.6], [2.6, -7.6], [2.6, -3.6], [-2.6, -3.6], [-2.6, -4.8], [1.4, -4.8], [1.4, -6.4], [-2.6, -6.4]].map(T), seed + 2, 3, .08, false),
    cut(rStroke([[-2.8, -.5], [2.8, -.5]].map(T), 1.1), seed + 3, 4, .08, false), cut(rStroke([[-2.4, 3.2], [2.4, 3.2]].map(T), 1.1), seed + 4, 4, .08, false)];
  return [paper, marks];
}
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变
const mokHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
const MOK_G = (() => {
  const cut = MOK_CUT, g = {};
  // ---- 鞋（站姿，脚底为原点，身子坐标）：棕色圆头鞋，鞋尖朝前一点，从裤脚下面露出来 ----
  g.shoeL = cut(ellPts(-15, -8.5, 15.5, 9.5, 18), 10, 5, .4); g.shoeR = cut(ellPts(16, -8.5, 15.5, 9.5, 18), 11, 5, .4);
  g.soleL = cut([[-30, -3.4], [0, -3.4], [-2, -.4], [-15, .8], [-28, -.4]], 12, 5, .15, false); g.soleR = cut(rMirror([[-30, -3.4], [0, -3.4], [-2, -.4], [-15, .8], [-28, -.4]]).map(([x, y]) => [x + 1, y]), 13, 5, .15, false);
  // ---- 红色宽腿背带裤（站姿）：高腰，从腰 -186 一直到脚面 -14，两条腿一片剪出来，中间开叉 ----
  const outR = [[27, -187], [32, -174], [36, -152], [38, -128], [38.5, -90], [39, -42], [39.5, -16]];
  const hemR = [[31, -13.5], [21, -13], [12, -13.5], [4, -15]];
  const inR = [[3.6, -50], [2.6, -80], [0, -97]];
  const half = [...outR, ...hemR, ...inR];
  g.pants = cut([...half, ...rMirror(half).slice(1)], 20, 9, .55, false);
  // 裤脚：深一点的收口布带
  const cuffR = [[4.4, -25], [38.9, -26], [39.5, -16], [31, -13.5], [21, -13], [12, -13.5], [4, -15]];
  g.pantCuffR = cut(cuffR, 21, 6, .3, false); g.pantCuffL = cut(rMirror(cuffR), 22, 6, .3, false);
  g.pantFolds = [[12, -150, 14, -34], [27, -134, 31, -34], [-12, -150, -14, -34], [-27, -134, -31, -34], [6, -112, 9, -60], [-6, -112, -9, -60]]
    .map(([x0, y0, x1, y1], i) => cut([[x0 - .7, y0], [x0 + .7, y0], [x1 + 1.2, y1], [x1 - 1.2, y1]], 23 + i, 10, .3, false));
  g.waist = cut([[-27.5, -189], [27.5, -189], [28.6, -180], [-28.6, -180]], 30, 6, .25, false);
  // 兜口（插兜时盖住手腕的那块裤布）和兜口的那道斜缝
  const pocketR = [[21, -150.5], [37.6, -143], [38.2, -116], [22, -120]];
  g.pocketR = cut(pocketR, 31, 5, .2, false); g.pocketL = cut(rMirror(pocketR), 32, 5, .2, false);
  g.pocketSlitR = cut(rStroke([[21, -150], [37.4, -142.6]], 1.6), 33, 4, .1, false); g.pocketSlitL = cut(rStroke([[-21, -150], [-37.4, -142.6]], 1.6), 34, 4, .1, false);
  // 裤子上的白符纸（站姿）
  g.talStand = [[17, -118, .18, 40], [-24, -72, -.14, 46], [26, -47, .08, 52]].map(([x, y, r, s]) => mokTalisman(cut, x, y, r, s));
  // ---- 坐姿：裤子只到膝盖（大腿朝前，正面看是一块），小腿另画（膝盖为原点，垂下） ----
  const lapR = [[27, -187], [32, -174], [36, -150], [39, -120], [40.5, -96], [39, -82], [31, -77], [20, -76], [8, -78.5], [0, -81]];
  g.lap = cut([...lapR, ...rMirror(lapR).slice(1)], 60, 9, .55, false);
  g.lapFolds = [[10, -148, 18, -86], [-10, -148, -18, -86], [28, -130, 32, -90], [-28, -130, -32, -90], [0, -140, 0, -82]].map(([x0, y0, x1, y1], i) => cut([[x0 - .7, y0], [x0 + .7, y0], [x1 + 1.2, y1], [x1 - 1.2, y1]], 61 + i, 10, .3, false));
  g.talSit = [[-20, -116, -.12, 70]].map(([x, y, r, s]) => mokTalisman(cut, x, y, r, s));
  g.shin = cut([[-15, -8], [15, -8], [16, 12], [17, 30], [8, 32.5], [0, 32], [-8, 32.5], [-17, 30], [-16, 12]], 64, 8, .4, false);
  g.shinCuff = cut([[-16.4, 21], [16.4, 21], [17, 30], [8, 32.5], [0, 32], [-8, 32.5], [-17, 30]], 65, 5, .25, false);
  g.talShin = mokTalisman(cut, 4, 6, .1, 66);
  g.sitShoe = cut(ellPts(3, 36, 14, 8.5, 16), 75, 5, .4);
  // ---- 上身：白衬衫（塞在裤腰里）、脖子、尖领、门襟、红背带（过肩） ----
  g.shirt = cut([[-13, -217], [13, -217], [24, -211], [29, -199], [29.5, -186], [28, -176], [-28, -176], [-29.5, -186], [-29, -199], [-24, -211]], 80, 8, .5);
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 81, 8, .3, false);
  g.placket = cut(rStroke([[0, -207], [0, -189]], 1.3), 82, 6, .1, false);
  g.shirtBtn = [-201, -194].map((y, i) => cut(ellPts(1.8, y, 1.3, 1.3, 8), 83 + i, 2, .05, false));
  const collarR = [[.5, -209], [1.5, -217.5], [11, -220], [15.5, -213], [11, -204.5], [5, -203.5]];
  g.collarR = cut(collarR, 85, 4, .2, false); g.collarL = cut(rMirror(collarR), 86, 4, .2, false);
  const strapR = [[11.5, -184], [12.6, -196], [14.2, -207], [16.4, -216.5]];
  g.strapR = cut(rStroke(strapR, 5.4), 87, 6, .2, false); g.strapL = cut(rStroke(rMirror(strapR).reverse(), 5.4), 88, 6, .2, false);
  g.strapBtn = [-1, 1].map((sd, i) => cut(ellPts(sd * 11.5, -184, 2.2, 2.2, 10), 89 + i, 2, .05, false));
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：肩头、白长袖（上臂、前臂）、袖口布带、手（腕为原点，左手镜像） ----
  g.armU = cut([[-7.4, 4], [7.4, 4], [7.8, 22], [7.4, 38], [0, 41], [-7.4, 38], [-7.8, 22]], 100, 8, .3);
  g.fore = cut([[-6.8, -3], [0, -5], [6.8, -3], [7.4, 12], [8.4, 24], [9, 30], [-9, 30], [-8.4, 24], [-7.4, 12]], 101, 7, .3, false);
  g.sleeveCuff = cut([[-9.2, 27], [0, 28.2], [9.2, 27], [9.4, 36], [0, 37.4], [-9.4, 36]], 102, 5, .25, false);
  g.shoulder = cut(RIG_SHAPES.puff.map(([x, y]) => [x * .95, y * .82 - 1]), 103, 7, .4);
  g.sleeveFold = cut([[-1, 10], [1, 10], [2.4, 24], [.4, 24]], 104, 8, .2, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(mokHandPts(H.open), 105, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 106, 3, .25);
  g.handPoint = cut(mokHandPts(H.point), 107, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  // 圆脸：两颊鼓、下巴小（和帕秋莉同一张脸型，全员统一）
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 120, 7, .5);
  // 后发：银白长直发，比脸宽一圈，笔直垂到小腿（头坐标 +172 ≈ 身子坐标 -36），发尾参差
  const sY = [-150, -120, -90, -50, -10, 30, 70, 110, 150], sX = [66, 77, 81, 82, 83, 84, 85, 86, 87];
  const sideR = sY.map((y, i) => [sX[i], y]), sideL = sY.map((y, i) => [-sX[i], y]);
  const tipsR = [[88, 174], [76, 164], [66, 178], [52, 166], [38, 179], [24, 167], [10, 177], [0, 168]], tipsL = [[-11, 177], [-25, 166], [-38, 178], [-52, 167], [-65, 179], [-76, 165], [-88, 175]];
  g.backHair = cut([[0, -178], [42, -174], ...rOpen(sideR, 6), ...tipsR, ...tipsL, ...rOpen(sideL, 6).reverse(), [-42, -174]], 121, 9, .8, false);
  g.hairStrands = [-62, -36, -10, 14, 40, 64].map((x0, i) => { const pts = []; for (let y = -30; y <= 160; y += 14) pts.push([x0 + 1.5 * Math.sin(y * .03 + i * 1.7) + y * .025 * Math.sign(x0), y]); return cut(rStroke(rOpen(pts, 4), u => 2.2 - 1.3 * u), 122 + i, 6, .2, false); });
  // 鬓发：从太阳穴垂下来的直发绺，比脸还靠外；胸口高度系符纸小蝴蝶结，下面再垂一截发尾（根在 (±56,-114)）
  const lockR = [...rOpen([[50, -130], [66, -120], [74, -88], [77, -50], [77, -12], [76, 30], [75, 60]], 4), [76, 76], [71, 90], [67, 76], [63, 88], [60, 66],
    ...rOpen([[61, 30], [61, -12], [60, -50], [57, -86], [48, -116]], 4)];
  g.lockR = cut(lockR, 140, 6, .5, false); g.lockL = cut(rMirror(lockR).map(([x, y]) => [x, y + (y > 60 ? 3 : 0)]), 141, 6, .5, false);
  [g.lockLineL, g.lockLineR] = [-1, 1].map((sd, i) => cut(rStroke([[sd * 67, -96], [sd * 69, -20], [sd * 68, 60]], 1.4), 142 + i, 8, .15, false));
  // 头顶和刘海一片：盖住整个头顶（头顶这块弧压住大蝴蝶结的下半），两侧顺着头包下来，下缘一排参差的尖刚好压到眼睛上沿
  const crown = rOpen([[-73, -112], [-73, -138], [-63, -160], [-40, -175], [0, -181], [40, -175], [63, -160], [73, -138], [73, -112]], 5);
  g.bangs = cut([...crown, [69, -84], [61, -100], [53, -74], [43, -97], [33, -77], [22, -99], [12, -79], [4, -101], [-4, -80], [-15, -99], [-25, -76], [-36, -97], [-46, -74], [-56, -98], [-66, -82]], 146, 6, .5, false);
  g.bangLines = [[33, -77, 30, -128], [12, -79, 10, -134], [-25, -76, -27, -130], [53, -74, 56, -122], [-46, -74, -50, -122], [0, -150, -4, -176]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 150 + i, 8, .2, false));
  // 大蝴蝶结（头坐标，结在头顶后面 (0,-180)）：两只大耳朵从头顶后面往两边上方翘出来，红边白心；下半被头顶的头发压住，看起来是系在头发上
  const loopR = [[3, -176], [16, -194], [36, -213], [57, -219], [72, -208], [74, -188], [64, -172], [40, -168], [6, -172]];
  g.bigBowRed = cut([...loopR, ...rMirror(loopR)], 170, 6, .5);
  const sc = (pts, cx, cy, f) => pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
  g.bigBowWhite = [cut(sc(loopR, 44, -192, .74), 171, 6, .4), cut(sc(rMirror(loopR), -44, -192, .74), 172, 6, .4)];
  g.bigBowLines = [-1, 1].map((sd, i) => cut(rStroke([[sd * 14, -184], [sd * 36, -194], [sd * 58, -200]], 1.4), 173 + i, 6, .1, false));
  g.bigKnot = cut(ellPts(0, -181, 10, 9, 14), 175, 3, .2);
  // 符纸小蝴蝶结
  g.miniBowRed = cut(mokBowPts(1.2), 176, 3, .2, false); g.miniBowWhite = cut(mokBowPts(.78), 177, 3, .15, false); g.miniKnot = cut(ellPts(0, 0, 2.8, 3.2, 8), 178, 2, .1, false);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂，lower 下眼睑托起，es 眼睛大小，iris 虹膜大小，chin 下巴抬（负），fang 露虎牙
// 妹红的眼神：平时半垂眼皮、外端略挑，懒得理人
const MOK_MOODS = {
  normal: { eye: 'open', lid: .42, lidTilt: -.03, es: 1, brow: [0, .04], mouth: 'flat', blush: .6 },
  smile: { eye: 'open', lid: .22, lidTilt: .02, lower: 4.5, es: 1, brow: [2, -.08], mouth: 'smile', blush: 1.05 },
  grin: { eye: 'open', lid: .4, lidTilt: -.08, lower: 3, es: 1, brow: [1, .22], mouth: 'grin', blush: .75, fang: true, chin: -.08 },
  annoyed: { eye: 'open', lid: .5, lidTilt: 0, es: 1, brow: [-1, .36], mouth: 'wave', blush: .7 },
  surprised: { eye: 'open', lid: 0, es: 1.1, iris: .78, brow: [7, -.12], mouth: 'o', blush: .85 },
  sleepy: { eye: 'open', lid: .7, lidTilt: .08, es: 1, brow: [-1, -.1], mouth: 'flat', blush: .7, lookY: 1.5 },
  sad: { eye: 'open', lid: .3, lidTilt: .14, es: 1, brow: [2, -.34], mouth: 'wobble', blush: .8, lookY: 1.5 },
};
const MOK_MOOD_ALIAS = { smug: 'grin', proud: 'grin', smirk: 'grin', happy: 'smile', laugh: 'smile', angry: 'annoyed', pout: 'annoyed', cry: 'sad', confused: 'surprised', panic: 'surprised', flustered: 'surprised', calm: 'normal', awkward: 'normal', yawn: 'sleepy', tired: 'sleepy' };
const MOK_POSE_ALIAS = { lecture: 'point', proud: 'cross', cheer: 'cross', think: 'cross', angry: 'cross', hold: 'fire', lift: 'fire', give: 'fire', present: 'fire', fly: 'wings', cast: 'wings',
  tired: 'slouch', doze: 'slouch', slump: 'slouch', lie: 'slouch', hide: 'slouch', peek: 'stand', read: 'stand', walk: 'stand', run: 'stand', reach: 'stand', parasol: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的。Q 版脸大，嘴整体放大 1.3 倍
const MOK_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const mokScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
function mokMouthPts(type, open) {
  const [pts, col, tg] = (MOK_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [mokScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', mokScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角；标记 pocket = 手插在兜里（手不画，兜口盖住手腕）
// up 上身下移（坐），sink 头往下沉，shrug 耸肩，lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开，flame 掌心托火（F 前手 / both 两手，值是火的大小），wings 火焰羽翼
// mokIK：肩 (±28, -200)（上身坐标）到腕 (tx, ty)，肘往外弯（up = true：肘在下、前臂往上伸）→ [a, b]；sd = -1 是后手
function mokIK(sd, tx, ty, up = false) {
  const L1 = MOK_ARM_U, L2 = MOK_ARM_F, X = sd * tx - MOK_SH[0], Y = ty - MOK_SH[1], d = clamp(Math.hypot(X, Y), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(X, Y) + (up ? -1 : 1) * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), ex = L1 * Math.sin(a), ey = L1 * Math.cos(a);
  return [sd * a, sd * (Math.atan2(X - ex, Y - ey) - a)];
}
// 插兜：兜口在裤子上（不跟上身前倾），换到上身坐标里再解 IK（上身绕腰转了 lean）
function mokPocket(sd, lean = 0) {
  const dx = sd * MOK_POCKET[0], dy = MOK_POCKET[1] - MOK_WAIST, co = Math.cos(lean), si = Math.sin(lean);
  return [...mokIK(sd, co * dx + si * dy, MOK_WAIST - si * dx + co * dy), 'none', 'pocket'];
}
function mokPose(pose, g, tt) {
  switch (pose) {
    case 'fire': return { back: mokPocket(-1), front: [...mokIK(1, 60, -174 + .8 * Math.sin(tt * 1.4), true), 'open', false], flame: 'F', fs: 1, hr: -.04, turn: .3, look: .8, lookY: -1 };
    case 'wings': return { back: [-1.62, -.6, 'open', false], front: [1.62, .6, 'open', false], wings: true, flame: 'both', fs: .55, hr: .02, turn: .05, look: 0, chin: -.04 };
    case 'point': return { back: mokPocket(-1), front: [lerp(1.35, 1.9, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    case 'cross': return { back: [-.32, 2.15, 'fist', false, 1, 1.15], front: [.3, -2.1, 'fist', false, 1, 1.15], hr: -.05, turn: -.35, look: .9, keepTurn: true };
    case 'sit': return { back: [-.3, .62, 'open', false], front: [.3, -.62, 'open', false], up: MOK_UP, turn: .15, look: .2, hr: .06 };
    case 'slouch': { const lean = .07; return { back: mokPocket(-1, lean), front: mokPocket(1, lean), lean, sink: 5, hr: .15, turn: .3, look: .55, lookY: 1.5 }; }
    default: return { back: mokPocket(-1, -.015), front: mokPocket(1, -.015), lean: -.015, hr: .06, turn: .15, look: .25 };
  }
}

// ===================== 火（自画层，纯函数） =====================
// mokNoise：第 i 条火舌在时间 f 处的随机量（相邻两个整数时刻的 hash 平滑插值）
function mokNoise(i, f, seed) { const n = Math.floor(f), u = f - n, e = u * u * (3 - 2 * u); return lerp(hash(i * 97 + n, seed), hash(i * 97 + n + 1, seed), e); }
// 一团火的轮廓：底在 (0,0)、朝 -y 烧；宽 w、高 hh，n 条火舌，中间的最高；底下一个浅碗
function mokFlamePts(w, hh, tt, seed, n = 5) {
  const pts = [[-w / 2, -hh * .12]];
  for (let i = 0; i < n; i++) {
    const u = (i + .5) / n, bell = 1 - (2 * u - 1) ** 2, v = mokNoise(i, tt * 3.2, seed), sway = hh * .1 * Math.sin(tt * 4.3 + i * 1.9) * (.4 + bell);
    const tipY = -hh * (.38 + .62 * bell) * (.78 + .34 * v), tipX = (u - .5) * w * .78 + sway;
    pts.push([(u - .5) * w * .95 - w * .08, tipY * .45], [tipX, tipY]);
    if (i < n - 1) { const um = (i + 1) / n, bm = 1 - (2 * um - 1) ** 2; pts.push([(um - .5) * w * .9, -hh * (.2 + .28 * bm) * (.85 + .3 * mokNoise(i + 9, tt * 2.6, seed))]); }
  }
  pts.push([w / 2, -hh * .12]);
  for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; pts.push([w / 2 * Math.cos(a), -hh * .1 + w * .28 * Math.sin(a)]); }
  return pts;
}
// 一片火焰羽翼（翼根为原点，往 +x 展开）：N 根宽火舌状的长羽，上面几根最长，往上往外散，羽尖往上卷，末端随 t 抖动
function mokWingPts(R, tt, seed) {
  const N = 6, pts = [[-6, -12]], cs = Math.cos, sn = Math.sin, at = (a, r) => [cs(a) * r, sn(a) * r];
  for (let j = 0; j < N; j++) {
    const u = j / (N - 1), th = lerp(-1.02, .62, u) + .05 * Math.sin(tt * 2.8 + j * 1.3), len = R * (1 - .4 * u) * (.88 + .2 * mokNoise(j, tt * 2.4, seed)), curl = -.07 - .05 * mokNoise(j + 20, tt * 3, seed);
    pts.push(at(th - .15, len * .6), at(th - .1, len * .86), at(th + curl, len), at(th + .1, len * .8), at(th + .16, len * .62));
  }
  pts.push([R * .3, 22], [0, 12]);
  return pts;
}
const mokPath = pts => polyPath(spline(pts, 3, true), true);
// 掌心的火：先一圈淡淡的光晕，再三层火舌（深橙红 → 橙 → 黄）和一点芯
function mokFlameAt(k, M, s, seed) {
  const c = k.c, tt = k.tt, w = 30 * s, hh = 48 * s;
  c.save(); c.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  const gr = c.createRadialGradient(0, -hh * .35, 0, 0, -hh * .35, hh * .95);
  gr.addColorStop(0, alpha(k.K.flameIn, .45)); gr.addColorStop(1, alpha(k.K.flameOut, 0));
  c.fillStyle = gr; c.beginPath(); c.arc(0, -hh * .35, hh * .95, 0, TAU); c.fill(); c.restore();
  k.paint([{ p: mokPath(mokFlamePts(w, hh, tt, seed)), m: M, col: k.K.flameOut }], RIG_SH.tiny, false, 1, true);
  k.paint([{ p: mokPath(mokFlamePts(w * .68, hh * .7, tt + .3, seed + 1, 4)), m: M, col: k.K.flameMid, edge: false },
    { p: mokPath(mokFlamePts(w * .4, hh * .42, tt + .6, seed + 2, 3)), m: M, col: k.K.flameIn, edge: false },
    { p: polyPath(ellPts(0, -hh * .06, w * .12, hh * .08, 10), true), m: M, col: k.K.flameCore, edge: false }], null, false, 1, true);
}
function mokFlames(k) {
  const fl = k.ps.flame, s = k.ps.fs || 1;
  if (fl === 'both') mokFlameAt(k, k.B.flameB, s, 7);
  mokFlameAt(k, k.B.flameF, s, 3);
}
// 火焰羽翼：两片（左边那片是镜像），三层（外深橙红、中橙、里黄），里层从翼根往外缩
function mokWings(k) {
  const tt = k.tt, R = 150, outer = [], inner = [];
  for (const sd of [-1, 1]) {
    const M = k.B['wing' + (sd < 0 ? 'L' : 'R')], sdS = sd < 0 ? 11 : 21;
    outer.push({ p: mokPath(mokWingPts(R, tt, sdS)), m: M, col: k.K.flameOut });
    inner.push({ p: mokPath(mokWingPts(R * .86, tt + .4, sdS + 1)), m: M, col: k.K.flameMid, edge: false },
      { p: mokPath(mokWingPts(R * .7, tt + .8, sdS + 2)), m: M, col: k.K.flameIn, edge: false });
  }
  k.paint(outer, RIG_SH.wing, false, .96, true);
  k.paint(inner, null, false, .96, true);
}

// ===================== 部件表 =====================
const mokIs = (...ps) => k => ps.includes(k.pose), mokNot = (...ps) => k => !ps.includes(k.pose);
const mokHandPart = (k, A) => k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
// 插兜那只手：兜口那块裤布压在手腕上（按手臂在哪边选左右兜）
const mokPocketItems = k => [k.AB, k.AF].filter(A => A.flag === 'pocket').flatMap(A => A.sd < 0 ? [['pocketL', 'body', 'red', false], ['pocketSlitL', 'body', 'redDeep', false]] : [['pocketR', 'body', 'red', false], ['pocketSlitR', 'body', 'redDeep', false]]);
const mokTalItems = (key, bone) => k => (Array.isArray(k.G[key][0]) ? k.G[key] : [k.G[key]]).flatMap(([pp, mk]) => [[() => pp, bone, 'paper'], ...mk.map(m => [() => m, bone, 'paperInk', false])]);
const MOK_RIG = {
  name: 'mokou', h: 500, height: 520, K: MOK_K, G: MOK_G, cut: MOK_CUT,
  moods: MOK_MOODS, moodAlias: MOK_MOOD_ALIAS, poseAlias: MOK_POSE_ALIAS, pose: mokPose, mouth: mokMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.016, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13, fang: [5.4, .9],
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 198, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: MOK_SH, upper: MOK_ARM_U, fore: MOK_ARM_F, mirrorHand: true, tips: { ...RIG_SHAPES.handTip, none: [0, 4] },
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', none: null } },
  // 待机：站得松，只轻晃、呼吸；头发、大蝴蝶结有弹簧
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, MOK_WAIST, k.lean), 0, -k.breath);
    k.wing = ps.wings ? 1 : clamp(o.wings || 0, 0, 1);
    if (ps.chin) k.hr += ps.chin;
  },
  bones: [
    { name: 'root', rot: k => k.sway, scale: [MOK_BODY, MOK_BODY] },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裤子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, MOK_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [MOK_HEAD, MOK_HEAD] },
    { name: 'shin', sides: true, when: mokIs('sit'), parent: 'root', at: (k, sd) => [sd * 19, 2], rot: (k, sd) => .18 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    // 火焰羽翼：翼根在肩胛 (±22,-210)，左边那片镜像；轻轻扇动，wings 越小越收拢
    { name: 'wing', sides: true, when: k => k.wing > 0, parent: 'ug', at: (k, sd) => [sd * 22, -210],
      rot: (k, sd) => sd * (.06 * Math.sin(k.tt * 2.1) - .5 * (1 - k.wing)), scale: (k, sd) => { const w = .35 + .65 * k.wing; return [sd * w, w]; } },
    { arms: true },
    // 掌心的火：立在指尖上方，跟上身一起转（不跟手腕转，火苗总是朝上）
    { name: 'flameF', when: k => k.ps.flame, m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), rApply(k.AF.hm, [0, 12]))); } },
    { name: 'flameB', when: k => k.ps.flame === 'both', m: k => { const ug = k.B.ug; return rTR(ug, ...rApply(rInv(ug), rApply(k.AB.hm, [0, 12]))); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    // 后发：垂在背后，只跟一点头的转动（绕脖子把头的转角退回去大半），带弹簧
    { name: 'hairB', parent: 'head', rot: k => -k.hr * .85, sway: [.006, 1.1, .5], spring: { len: 220, gain: .5, f: 1.4, max: .1 } },
    { name: 'hairBow', sides: true, parent: 'hairB', at: (k, sd) => [sd * 64, 146], rot: (k, sd) => sd * .25 },
    { name: 'bigBow', parent: 'head', pivot: [0, -180], sway: [.03, 1.6, .3], spring: { len: 50, dir: -Math.PI / 2, gain: .5, f: 2.6, max: .15 } },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 56, -114], rot: k => -k.hr * .55, sway: (k, sd) => [.015, 1.5, sd], spring: { len: 150, gain: .6, f: 2, max: .25 } },
    { name: 'lockBow', sides: true, parent: (k, sd) => 'lock' + (sd < 0 ? 'L' : 'R'), at: (k, sd) => [sd * 68, 24], rot: (k, sd) => sd * .2, scale: (k, sd) => sd < 0 ? [.92, .92] : null },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
  ],
  layers: [
    // 火焰羽翼在最后面
    { when: k => k.wing > 0, call: mokWings },
    // 后发、发尾的符纸小蝴蝶结
    { items: [['backHair', 'hairB', 'hairBack']], sh: 'big' },
    { items: [['hairStrands', 'hairB', 'hairHi', false]], gr: false, al: .5 },
    { items: [['miniBowRed', 'hairBowL', 'bowRed'], ['miniBowRed', 'hairBowR', 'bowRed']], sh: 'tiny', gr: false },
    { items: [['miniBowWhite', 'hairBowL', 'bow', false], ['miniBowWhite', 'hairBowR', 'bow', false], ['miniKnot', 'hairBowL', 'bowKnot', false], ['miniKnot', 'hairBowR', 'bowKnot', false]], gr: false },
    // 大蝴蝶结（下半会被头顶的头发压住）
    { items: [['bigBowRed', 'bigBow', 'bowRed']], sh: 'mid' },
    { items: [['bigBowWhite', 'bigBow', 'bow', false]] },
    { items: [['bigBowLines', 'bigBow', 'bowRed', false], ['bigKnot', 'bigBow', 'bowKnot']], gr: false },
    // 腿：站着是鞋 + 整条裤子；坐着是小腿（裤管 + 裤脚 + 鞋），裤子只到膝盖
    { when: mokNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: mokNot('sit'), items: [['soleL', 'root', 'shoeDeep', false], ['soleR', 'root', 'shoeDeep', false]], gr: false },
    { when: mokIs('sit'), items: [['sitShoe', 'shinL', 'shoe'], ['sitShoe', 'shinR', 'shoe'], ['shin', 'shinL', 'red'], ['shin', 'shinR', 'red']], sh: 'mid' },
    { when: mokIs('sit'), items: [['shinCuff', 'shinL', 'redDeep', false], ['shinCuff', 'shinR', 'redDeep', false]], gr: false },
    { when: mokIs('sit'), items: mokTalItems('talShin', 'shinR'), sh: 'tiny', gr: false },
    // 上身：脖子、白衬衫（下摆塞在裤腰里，所以先画）
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'shirt']], sh: 'mid' },
    { items: [['placket', 'ug', 'shirtFold', false], ['shirtBtn', 'ug', 'shirtFold', false]], gr: false },
    // 裤子
    { when: mokNot('sit'), items: [['pants', 'body', 'red']], sh: 'big' },
    { when: mokNot('sit'), items: [['pantFolds', 'body', 'redFold', false], ['pantCuffL', 'body', 'redDeep', false], ['pantCuffR', 'body', 'redDeep', false]], gr: false },
    { when: mokNot('sit'), items: mokTalItems('talStand', 'body'), sh: 'tiny', gr: false },
    { when: mokIs('sit'), items: [['lap', 'body', 'red']], sh: 'big' },
    { when: mokIs('sit'), items: [['lapFolds', 'body', 'redFold', false]], gr: false },
    { when: mokIs('sit'), items: mokTalItems('talSit', 'body'), sh: 'tiny', gr: false },
    { items: [['waist', 'body', 'redDeep', false]], gr: false },
    // 背带（过肩）、扣子、尖领
    { items: [['strapL', 'ug', 'red'], ['strapR', 'ug', 'red']], sh: 'tiny' },
    { items: [['strapBtn', 'ug', 'button', false]], gr: false },
    { items: [['collarL', 'ug', 'collar'], ['collarR', 'ug', 'collar']], sh: 'tiny', gr: false },
    // 手臂：一条一条画（后手先），每条从手、前臂、袖口、上臂到肩头
    { arms: 'all', order: 'arm', items: [[mokHandPart, 'hm', 'skin'], ['fore', 'lD', 'shirt'], ['sleeveFold', 'lD', 'shirtFold', false], ['sleeveCuff', 'lD', 'shirt'], ['armU', 'uD', 'shirt'], ['shoulder', 'u', 'shirt']], sh: 'mid' },
    // 插兜的手：兜口那块裤布压在手腕上
    { items: mokPocketItems, gr: false },
    // 脸、前发（鬓发 + 胸口的符纸蝴蝶结）、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false], ['lockLineL', 'lockL', 'hairLine', false], ['lockLineR', 'lockR', 'hairLine', false]], gr: false },
    { items: [['miniBowRed', 'lockBowL', 'bowRed'], ['miniBowRed', 'lockBowR', 'bowRed']], sh: 'tiny', gr: false },
    { items: [['miniBowWhite', 'lockBowL', 'bow', false], ['miniBowWhite', 'lockBowR', 'bow', false], ['miniKnot', 'lockBowL', 'bowKnot', false], ['miniKnot', 'lockBowR', 'bowKnot', false]], gr: false },
    { call: 'brows' },
    // 掌心的火压在手指上
    { when: k => k.ps.flame, call: mokFlames },
  ],
  anchors(k) {
    const { AB, AF, B } = k, hand = A => A.flag === 'pocket' ? rApply(B.body, [A.sd * MOK_POCKET[0], MOK_POCKET[1] - 8]) : A.tip;
    return { head: rApply(B.head, [0, -70]), hands: [hand(AB), hand(AF)].sort((a, b) => a[0] - b[0]), tip: hand(AF), flame: B.flameF ? rApply(B.flameF, [0, -20 * (k.ps.fs || 1)]) : null };
  },
};

function drawMokou(c, o = {}) { return drawRig(c, MOK_RIG, o); }
