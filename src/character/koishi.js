'use strict';
// 古明地恋（こいし）—— 剪纸人偶的部件表（觉的妹妹：浅苔绿微卷短发、黑色圆顶礼帽配黄缎带和大蝴蝶结、黄色宽袖上衣、墨绿印花裙、闭着的第三只眼）。
// 第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉（规格见 docs/rig.md「统一比例（第三版）」「画法规则（第三版）」）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表，外加第三只眼、软管、帽子亮面、玫瑰几个自画层。
// 第三只眼和软管的写法照抄姐姐（src/character/satori.js），改名、改色、改成两根缠在手臂上的软管。
// 纯 Canvas 代码绘制，不加载任何图片。
//
// drawKoishi(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], eye3:[x,y], hat:[x,y], rose:[x,y]|null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（样张里抬高 100）；skip：仍是地面上的点，人偶自己跳离地面
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，统一的是头和身子大小，帽顶高出头顶多少各人不同）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 两手松松垂在身侧（默认）| wave 一手举起挥手 | point 一手指向前方（gesture 伸多远）
//            hat 一手压住帽檐、歪头从帽檐下看人 | skip 单脚轻跳（离地 4..32 随 t 起伏，后脚往后踢起）
//            sit 坐着、两腿垂下轻晃 | hide 双手背在身后、歪头
//            旧名兼容：lecture/present→point、cheer/lift→wave、proud→hat、cross/peek/think→hide、walk/run/fly→skip、
//            hold/read/lie/parasol/slump/reach/tired/doze/bow→stand
//   mood     normal 空灵的微笑、眼神有点放空（默认）| smile 眯眼笑 | grin 睁眼露齿笑 | surprised 眼睛睁圆、嘴 o
//            blank 完全放空（虹膜缩小、高光变暗、嘴平）| pout 鼓腮嘟嘴、脸红 | sad 眉尾下垂、嘴角下
//            旧名兼容：happy→smile、laugh/proud/smug/smirk→grin、confused/sleepy/yawn→blank、angry/annoyed→pout、cry→sad、
//            flustered/panic→surprised、calm/awkward→normal
//   eye3     第三只眼睁开程度 0..1（默认 0 = 闭上，眼睑合成一道缝；同 drawSatori）
//   eyeLook  [dx, dy] 第三只眼瞳孔朝向，-1..1（默认 [.3, .1]；dx 正 = 朝 facing 那边；只在 eye3 > 0 时看得见）
//   rose     true 前手拿一朵玫瑰（stand 时手抬到胸前；skip / sit 里手型换成握；wave / point / hat / hide 不拿）
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//            track 给了时，第三只眼挂在一根弹簧上：走路、转身时滞后晃动
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，eye3 第三只眼中心，hat 帽顶，rose 玫瑰花心（没拿时 null）
//
// 设计坐标（h = 520）：脚底 (0,0)，y 向下；脖子 -248、肩 ±33、腰 -192、裙摆 -54。头部件用「头坐标」（原点在脖子关节），
// 和帕秋莉的头坐标一样（下巴 -4、头顶 -150、脸宽 ±64），乘 KOI_HEAD = 1.2 落到规格表的位置。
// 本文件顶层名字都带 koi / KOI 前缀。

// ===================== 颜色（压暗、低饱和；只有第三只眼、缎带、玫瑰带一点饱和色） =====================
const KOI_K = (() => {
  const hair = mix('#bccbb4', '#8d978e', .2), hairBack = mix(hair, '#4c5e50', .32), top = mix('#efd47c', '#a59c86', .22), skirt = mix('#4c7a59', '#55605a', .28);
  const eye = mix('#4f9a62', '#5f7466', .18), e3 = '#6b5cc2', tube = mix('#4e4294', '#5a5670', .2), trim = mix('#bcdcae', '#8f9c8c', .2), ribbon = mix('#e9c957', '#a0977f', .18);
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .35), hairHi: mix(hair, '#f6fbf2', .4),
    top, topFold: mix(top, '#8a7850', .32), trim, trimDk: mix(trim, '#4c6a50', .35), button: mix(trim, '#3f5e45', .45),
    skirt, skirtFold: mix(skirt, '#22382a', .35), hem: mix(skirt, '#22382a', .22), flower: '#eceee4', flowerC: mix(ribbon, skirt, .25), vine: mix(skirt, '#dfe8d6', .42),
    skin: P.skin, blush: P.blush, shoe: '#2f2b35', shoeHi: '#6a6474',
    hat: '#1d2220', hatLt: '#2d3632', brimTop: '#262e2a', brimUnder: '#0f1311', ribbon, ribbonDk: mix(ribbon, '#7a6430', .35),
    // 眼睛分层（第三版）：虹膜、虹膜下半亮色、瞳孔、虹膜上沿阴影、眼白、粗上眼线
    eye, irisLt: mix(eye, '#c6efbe', .5), pupil: mix(eye, P.ink, .78), irisShade: alpha(mix(eye, P.ink, .8), .45), sclera: '#fbf8f3',
    lid: mix('#22382a', P.ink, .55), lash: mix('#22382a', P.ink, .5), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    // 第三只眼：眼睑（深蓝紫）、眼球边、眼白、虹膜、瞳孔；软管同色系，管上挂的心形
    lid3: mix('#4a3f8a', P.ink, .12), lid3Dk: mix('#4a3f8a', P.ink, .6), lid3Hi: mix('#4a3f8a', '#c9c2f0', .35), e3, e3In: '#e6e2f4', e3Iris: mix(e3, '#1c1440', .15), pupil3: '#161028',
    tube, tubeHi: mix(tube, '#cfc8f2', .35), heart: mix('#5b4cae', '#6a6680', .12), heartHi: mix('#5b4cae', '#e0dbff', .5),
    rose: mix('#c4404f', '#8e6a70', .15), roseDk: mix('#c4404f', P.ink, .4), roseLt: mix('#c4404f', '#f4c8cc', .35), stem: mix('#4f7d4a', '#5f6a5c', .2),
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  };
})();
// blank（完全放空）用的颜色：高光压暗成虹膜色、虹膜下半不提亮
const KOI_KD = { ...KOI_K, white: mix(KOI_K.eye, '#f7f3ee', .28), irisLt: KOI_K.eye };
const KOI_CUT = rigCutter(9000);
const KOI_NECK = -248, KOI_WAIST = -192, KOI_HEAD = 1.2, KOI_UP = 100;
const KOI_SH = [33, -234], KOI_L1 = 42, KOI_L2 = 40, KOI_HAND = 1.35;   // 肩、上臂、前臂（肘到袖口里的腕点）、手的放大（照姐姐）
const KOI_E3 = { r: 11.5, hang: [-17, -228], len: 20 };   // 第三只眼：半径；挂点（上身坐标，偏在身子左侧、腰上）和挂绳长
const KOI_SIT_SK = [1.08, 0, 0, .72, 0, .28 * KOI_WAIST];
// 礼帽（头坐标）：帽身底是一个椭圆（中心 (0,-146)、半宽 70），帽檐是绕它一圈的扁椭圆环（半宽 108 ≈ 脸宽 1.7 倍），两端往上翘、边缘微波浪
const KOI_HCY = -146, KOI_DRX = 70, KOI_DRY = 9, KOI_BRX = 108, KOI_BRY = 18, KOI_HAT_TILT = .09, KOI_HAT_SIT = 5;   // 整顶帽子往蝴蝶结那边（-x）歪戴、整体往下压 5 坐稳在头上
const koiBase = x => KOI_HCY + KOI_DRY * Math.sqrt(Math.max(0, 1 - (x / KOI_DRX) ** 2));   // 帽身底沿（正面看的下半弧）
// 帽檐轮廓：角 a 处的点（a=π/2 是正前方最低点）；dy 整体下移（画底面用），wav 波浪幅度
const koiBrimPt = (a, dy = 0, kx = 1, wav = 2.2) => { const x = KOI_BRX * kx * Math.cos(a); return [x, KOI_HCY + KOI_BRY * Math.sin(a) + dy - 13 * (x / KOI_BRX) ** 4 + wav * Math.sin(4 * a + .6)]; };

// ===================== 部件（载入时剪好） =====================
// 心形：中心 (cx, cy)，宽约 2s，旋转 rot（同 satori.js）
function koiHeartPts(cx, cy, s, rot = 0) {
  const out = [], co = Math.cos(rot), si = Math.sin(rot);
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, x = Math.pow(Math.sin(a), 3) * s, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * s;
    out.push([cx + x * co - y * si, cy + x * si + y * co]); }
  return out;
}
const koiFlowerPts = (cx, cy, r, rot) => { const out = []; for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, rr = r * (.6 + .4 * Math.cos(5 * (a + rot))); out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return out; };
const koiJitter = (pts, seed, amp) => pts.map(([x, y], i) => [x + (hash(i, seed) - .5) * amp, y + (hash(i, seed + 1) - .5) * amp]);
const koiScale = (pts, k) => pts.map(([x, y]) => [x * k, y * k]);
const koiRot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
// 卷：沿开放折线往外鼓 n 个圆包（rScallop 的折线版，外侧 = 前进方向的左手边）
const koiCurl = (pts, n, depth) => rScallop(u => { const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), v = f - i; return [lerp(pts[i][0], pts[i + 1][0], v), lerp(pts[i][1], pts[i + 1][1], v)]; }, n, depth);
const KOI_G = (() => {
  const cut = KOI_CUT, g = {};
  // ---- 腿（腿骨坐标 = 站姿脚底坐标，髋 (±13.5,-66) 是转轴）：裙下露一截光腿，黑色圆鞋 ----
  const legR = [[7.5, -70], [20, -70], [19.6, -40], [19, -12], [9.5, -12], [8.6, -40]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(18, -10, 17.5, 11, 18), 12, 5, .35); g.shoeL = cut(ellPts(-18, -10, 17.5, 11, 18), 13, 5, .35);
  g.shoeHiR = cut(ellPts(22, -15, 6, 2.2, 10, -.15), 14, 2, .08, false); g.shoeHiL = cut(ellPts(-14, -15, 6, 2.2, 10, .15), 15, 2, .08, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-6.5, -4], [6.5, -4], [6.2, 18], [5.6, 34], [-5.6, 34], [-6.2, 18]], 16, 8, .3);
  g.sitShoe = cut(ellPts(3, 38, 14.5, 9.5, 16), 17, 5, .35);
  g.sitShoeHi = cut(ellPts(6, 34, 5, 1.8, 10), 18, 2, .08, false);
  // ---- 裙子（腰 -192）：墨绿钟形裙、几道褶、下摆一道深边 + 一圈白花和藤蔓 ----
  g.skirt = cut([[-22, -197], [0, -198], [22, -197], [27, -186], [38, -162], [52, -130], [65, -98], [76, -74], [83, -58], [42, -54], [0, -53], [-42, -54], [-83, -58], [-76, -74], [-65, -98], [-52, -130], [-38, -162], [-27, -186]], 21, 11, .8);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 22, xb = u * 72; return cut([[xt - .9, -186], [xt + .9, -186], [xb + 1.8, -66], [xb - 1.8, -66]], 23 + i, 12, .4, false); });
  g.hemBand = cut(rStroke(rOpen([[-81, -61], [-42, -57.5], [0, -56.5], [42, -57.5], [81, -61]], 4), 5), 27, 8, .3, false);
  const hemY = x => -76 + 6 * (x / 66) ** 2;
  // 藤蔓：一道细波浪线横过下摆，花开在波峰波谷之间
  const vine = []; for (let j = 0; j <= 40; j++) { const x = lerp(-70, 70, j / 40); vine.push([x, hemY(x) + 3.4 * Math.sin(x / 70 * 3 * Math.PI)]); }
  g.vine = cut(rStroke(vine, 1.5), 28, 6, .1, false);
  const fx = [-60, -30, 0, 30, 60], lx = [-45, -15, 15, 45];
  g.flowers = fx.map((x, i) => cut(koiFlowerPts(x, hemY(x), 7, i * .5), 30 + i, 2.2, .15));
  g.flowerC = fx.map((x, i) => cut(ellPts(x, hemY(x), 2, 2, 8), 36 + i, 2, .05, false));
  g.leaves = lx.flatMap((x, i) => { const y = hemY(x) + 3.4 * Math.sin(x / 70 * 3 * Math.PI), s = i % 2 ? 1 : -1;
    return [cut(ellPts(x - 2, y - 3.4 * s, 4.2, 1.8, 10, -.6 * s), 42 + i * 2, 2, .05, false), cut(ellPts(x + 2.5, y + 3 * s, 3.6, 1.6, 10, .6 * s), 43 + i * 2, 2, .05, false)]; });
  // ---- 上身（脖子 -248）：黄色上衣（略外扩、下摆一道浅绿边）、浅绿宽领、两颗菱形扣 ----
  g.shirt = cut([[-14, -252], [14, -252], [26, -246], [34, -234], [37, -216], [40, -194], [41, -186], [0, -184], [-41, -186], [-40, -194], [-37, -216], [-34, -234], [-26, -246]], 30, 7, .5, false);
  g.shirtHem = cut([[-40.5, -192], [0, -190], [40.5, -192], [41.2, -185.5], [0, -183.5], [-41.2, -185.5]], 29, 6, .2, false);
  g.shirtFolds = [-.5, .5].map((u, i) => cut([[u * 14 - .7, -230], [u * 14 + .7, -230], [u * 28 + 1.2, -192], [u * 28 - 1.2, -192]], 48 + i, 10, .3, false));
  g.neck = cut([[-7, -264], [7, -264], [8, -244], [-8, -244]], 31, 8, .3, false);
  // 宽领：两片圆角领片从后颈搭到胸前，下沿压一道深一点的镶边
  const collarR = [[.5, -252], [14, -254], [27, -248], [31, -240], [27, -232], [16, -229], [5, -233], [1.5, -240]];
  g.collarR = cut(collarR, 33, 3, .2); g.collarL = cut(rMirror(collarR), 34, 3, .2);
  const cEdge = rOpen([[30, -239], [26, -231.5], [16, -228.5], [5, -232.5], [1.5, -239]], 3);
  g.collarEdgeR = cut(rStroke(cEdge, 2.2), 35, 4, .1, false); g.collarEdgeL = cut(rStroke(rMirror(cEdge), 2.2), 36, 4, .1, false);
  g.buttons = [-224, -209].map((y, i) => cut([[0, y - 5.2], [4, y], [0, y + 5.2], [-4, y]], 50 + i, 1.6, .06, false));
  // ---- 手臂：上臂袖（肩为原点）、肩头、前臂宽袖口带浅绿镶边（肘为原点，袖口张到 ±21）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-9.5, -4], [0, -8], [9.5, -4], [11.5, 20], [11, 40], [0, 45], [-11, 40], [-11.5, 20]], 40, 8, .3);
  g.shoulder = cut(ellPts(0, 5, 12, 12.5, 16), 41, 6, .3);
  const cuffEdge = rOpen([[21, 41], [10, 44], [0, 45], [-10, 44], [-21, 41]], 3);
  g.fore = cut([[-8.5, -5], [0, -7.5], [8.5, -5], [11, 12], [15, 26], [21, 41], ...cuffEdge, [-15, 26], [-11, 12]], 42, 7, .3, false);
  g.foreTrim = cut([...cuffEdge, [-20, 35.5], [0, 38.6], [20, 35.5]], 43, 4, .2, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(koiScale(H.open, KOI_HAND), 44, 3, .2, false); g.handFist = cut(ellPts(0, 7.2, 7.6, 8.6, 14), 45, 3, .25);
  g.handPoint = cut(koiScale(H.point, KOI_HAND), 46, 3, .2, false); g.handGrip = cut(koiScale(H.grip, KOI_HAND), 47, 3, .2, false);
  // ---- 第三只眼（眼心为原点）：眼睑一圈（整颗球的底）、眼睑上一道浅色亮弧。开口和眼珠按开合量现剪（见 koiEye3） ----
  g.e3Lid = cut(ellPts(0, 0, KOI_E3.r + 2.6, KOI_E3.r + 2.4, 24), 55, 4, .25);
  g.e3LidHi = cut(rStroke(Array.from({ length: 9 }, (_, j) => { const a = Math.PI * (1.18 + j / 8 * .5); return [Math.cos(a) * (KOI_E3.r - 1), Math.sin(a) * (KOI_E3.r - 1.5)]; }), u => .6 + 1.8 * Math.sin(Math.PI * u)), 56, 3, .05, false);
  // 软管上挂的心形（心中心为原点）
  g.tubeHeart = cut(koiHeartPts(0, 0, 6.2), 57, 2.4, .1);
  g.tubeHeartHi = cut(ellPts(-2.6, -2.6, 1.5, 1, 8, -.5), 58, 2, .04, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150，和帕秋莉同一张脸型） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 70, 7, .5);
  // 后发：微卷短发，比脸宽一圈，刚过下巴，发梢一卷一卷往外翘；顶部藏在帽子里
  const bSide = koiCurl([[0, -176], [40, -170], [66, -152], [82, -126], [88, -96], [88, -64], [86, -34], [88, -12]], 6, 4.4);
  const bTips = [[97, 0], [88, 8], [80, -2], [72, 10], [62, 0], [50, 8], [36, -2], [18, 4], [0, -4], [-18, 4], [-36, -2], [-50, 8], [-62, 0], [-72, 10], [-80, -2], [-88, 8], [-97, 0]];
  g.backHair = cut([...koiJitter(bSide, 3, 1.2), ...bTips, ...koiJitter(rMirror(bSide), 5, 1.2)], 73, 9, .6);
  // 鬓发：帽檐下沿着脸颊垂到下巴，发梢往外卷（根在 (±58,-112)，藏在帽檐下）
  const lockR = [...koiCurl([[46, -130], [66, -120], [77, -96], [80, -64], [79, -34]], 3, 3), [86, -14], [93, -2], [84, 4], [76, -6], [72, 4], [64, -6], [61, -20], ...rOpen([[61, -40], [60, -68], [57, -96], [47, -120]], 4)];
  g.lockR = cut(lockR, 74, 6, .4); g.lockL = cut(koiJitter(rMirror(lockR), 9, 1.6), 75, 6, .4);
  // 前发：顶在帽子里，下缘一簇一簇圆头的卷刘海压到眼睛上沿，往右扫一点
  const crown = [[-72, -112], [-70, -146], [-50, -168], [-22, -178], [0, -180], [22, -178], [50, -168], [70, -146], [72, -112]];
  g.bangs = cut([...crown, [68, -98], [62, -106], [56, -84], [48, -100], [40, -76], [31, -96], [22, -74], [13, -94], [4, -72], [-4, -92], [-13, -74], [-22, -96], [-30, -78], [-39, -100], [-47, -82], [-56, -104], [-63, -88], [-68, -104]], 76, 6, .5);
  g.bangLines = [[4, -72, 2, -130], [-13, -74, -11, -128], [22, -74, 22, -128], [40, -76, 38, -126], [-30, -78, -28, -128], [56, -84, 54, -122], [-47, -82, -46, -124]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0 - 1], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0 - 1]], 77 + i, 8, .2, false));
  // 头发亮光：帽檐下面一道断开的弧，显出头是圆的
  g.hairHi = [[-48, -32], [-24, -8], [8, 22], [30, 46]].map(([a0, a1], i) => { const pts = []; for (let j = 0; j <= 6; j++) { const x = lerp(a0, a1, j / 6); pts.push([x, -106 - 14 * Math.sqrt(Math.max(0, 1 - (x / 62) ** 2))]); }
    return cut(rStroke(pts, u => 1 + 3 * Math.sin(Math.PI * u)), 84 + i, 4, .15, false); });
  // 帽子（礼帽）：半球形圆顶罩住头顶和所有头发的顶部；帽檐绕头一整圈、比头宽一截，正面看是一道扁环，两端上翘、边缘微波浪；
  // 帽檐分两层：底面（深）往下错开一点，只在前沿和两端露出一道薄边；顶面（浅一点）被帽身压住后半圈。
  // 帽身底一圈宽黄缎带，左侧（-x）系一个大蝴蝶结、垂两条短飘带。体积：帽身暗面整片 + 左上一块亮面（koiHatLight）。
  const brimRing = (dy, kx, wav) => Array.from({ length: 48 }, (_, i) => koiBrimPt(i / 48 * TAU, dy, kx, wav));
  g.brimUnder = cut(brimRing(6, .985, 2.2), 110, 6, .3);
  g.brim = cut(brimRing(0, 1, 2.2), 112, 6, .3);
  // 帽檐前沿一道亮边：沿正面那半圈、稍往里收
  g.brimHi = cut(rStroke(Array.from({ length: 17 }, (_, j) => { const a = Math.PI * (.12 + .76 * j / 16), [x, y] = koiBrimPt(a, 0, .97, 2.2); return [x, y - 3]; }), u => .6 + 1.8 * Math.sin(Math.PI * u)), 111, 6, .1, false);
  const domeTop = [[KOI_DRX, KOI_HCY], [73, -160], [72, -178], [64, -198], [47, -214], [24, -223], [0, -226], [-24, -223], [-47, -214], [-64, -198], [-72, -178], [-73, -160], [-KOI_DRX, KOI_HCY]];
  const domeBot = []; for (let i = 1; i < 18; i++) { const x = -KOI_DRX + i / 18 * 2 * KOI_DRX; domeBot.push([x, koiBase(x)]); }
  g.dome = cut([...domeTop, ...domeBot], 100, 9, .5);
  g.domeClip = polyPath(spline([...domeTop, ...domeBot], 3, true), true);
  g.domeLight = polyPath(ellPts(-22, -194, 46, 30, 40, -.3), true);
  // 帽身底的一道浅凹：缎带上面一道暗弧，看得出帽身是圆的
  g.creases = [cut(rStroke(Array.from({ length: 15 }, (_, j) => { const x = lerp(-60, 60, j / 14); return [x, koiBase(x) - 21 - 2 * (1 - (x / 70) ** 2)]; }), u => .5 + 1.6 * Math.sin(Math.PI * u)), 101, 6, .1, false)];
  const rib = (lo, hi, n = 20) => { const a = [], b = []; for (let i = 0; i <= n; i++) { const x = lerp(-KOI_DRX + 1, KOI_DRX - 1, i / n); a.push([x, koiBase(x) - hi]); b.unshift([x, koiBase(x) - lo]); } return [...a, ...b]; };
  g.ribbon = cut(rib(1, 17), 106, 6, .25, false);
  g.ribbonHi = cut(rib(14.5, 17), 107, 6, .1, false);
  // 大蝴蝶结（结心 (bx,by)）：两只圆耳朵往外上方张开，两条飘带垂到帽檐下面
  const bx = -58, by = koiBase(-58) - 9;
  const loopL = [[0, -3], [-7, -12], [-19, -19], [-31, -18], [-37, -9], [-36, 2], [-29, 9], [-15, 8], [-2, 4]];
  const tailL = [[-2, 3], [-9, 14], [-15, 28], [-17, 38], [-11, 34], [-6, 39], [-4, 26], [2, 6]];
  const tailR = [[-1, 5], [5, 17], [8, 30], [5, 41], [11, 37], [16, 40], [14, 26], [4, 4]];
  const at = pts => pts.map(([x, y]) => [bx + x, by + y]);
  g.bowTails = [cut(at(tailL), 113, 3, .2), cut(at(tailR), 114, 3, .2)];
  g.ribbonBow = [cut(at(loopL), 108, 3, .25), cut(at(rMirror(loopL)), 115, 3, .25)];
  // 蝴蝶结耳朵里的褶：从结心往外两道暗线
  g.bowFolds = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sd, k], i) => cut(rStroke([[bx + sd * 5, by + (k > 0 ? -1 : 2)], [bx + sd * 16, by + (k > 0 ? -9 : 4)], [bx + sd * 27, by + (k > 0 ? -12 : 4)]], u => .5 + 1.2 * Math.sin(Math.PI * u)), 116 + i, 3, .05, false));
  g.ribbonKnot = cut(ellPts(bx, by, 6.5, 7.5, 12), 109, 2, .05);
  // ---- 玫瑰（握点为原点，花朝上）：细茎、一片叶子、花苞一层层卷起来 ----
  g.roseStem = cut(rStroke(rOpen([[1, 26], [0, 8], [-.5, -10], [0, -30]], 3), 2.6), 120, 5, .1, false);
  g.roseLeaf = cut(ellPts(7, -12, 7, 3, 12, -.5), 121, 3, .1);
  g.roseOuter = cut(koiFlowerPts(0, -38, 13, .3).map(([x, y]) => [x, y + (y > -38 ? (y + 38) * .3 : 0)]), 122, 3, .2);
  g.roseMid = cut(ellPts(0, -40, 8.5, 7, 16), 123, 3, .15);
  g.roseSpiral = cut(rStroke(Array.from({ length: 14 }, (_, j) => { const a = j / 13 * 3.6 * Math.PI, r = 1 + j * .45; return [Math.cos(a) * r, -41 + Math.sin(a) * r * .8]; }), u => .9 + .9 * u), 124, 3, .05, false);
  // 表情道具：汗滴
  g.sweat = cut(koiScale(RIG_SHAPES.sweat, 1.3), 91, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」）；lid 眼睑压下的比例，lidTilt 眼睑外端下垂，lower 下眼睑托起，iris 虹膜大小，chin 下巴抬（负）
// 恋的眼神：眼睑几乎不压、虹膜略小、视线略往下，看着人又像没在看；dull 换一套暗高光（KOI_KD，见 koiFace）
const KOI_MOODS = {
  normal: { eye: 'open', lid: .02, lidTilt: .05, es: 1, iris: .9, brow: [2, -.14], mouth: 'smile', blush: 1, lookY: .9 },
  smile: { eye: 'up', brow: [2, -.1], mouth: 'smile', blush: 1.2, chin: -.03 },
  grin: { eye: 'open', lid: .04, es: 1.03, lower: 3.4, brow: [3, -.08], mouth: 'grin', blush: 1.25 },
  surprised: { eye: 'open', lid: 0, es: 1.12, iris: .94, brow: [6, -.1], mouth: 'o', blush: 1 },
  blank: { eye: 'open', lid: .03, lidTilt: .04, es: 1, iris: .78, dull: true, brow: [0, 0], mouth: 'flat', blush: .6, look: 0, lookY: 1.4 },
  pout: { eye: 'open', lid: .26, lidTilt: -.02, es: 1, iris: .92, brow: [-1, .26], mouth: 'cpout', puff: true, blush: 1.7 },
  sad: { eye: 'open', lid: .3, lidTilt: .12, es: .98, iris: .92, brow: [2, -.4], mouth: 'pout', blush: .9, lookY: 1.6, chin: .04 },
};
const KOI_MOOD_ALIAS = { happy: 'smile', laugh: 'grin', proud: 'grin', smug: 'grin', smirk: 'grin', confused: 'blank', sleepy: 'blank', yawn: 'blank', angry: 'pout', annoyed: 'pout', cry: 'sad', flustered: 'surprised', panic: 'surprised', calm: 'normal', awkward: 'normal' };
const KOI_POSE_ALIAS = { lecture: 'point', present: 'point', cheer: 'wave', lift: 'wave', proud: 'hat', cross: 'hide', peek: 'hide', think: 'hide', walk: 'skip', run: 'skip', fly: 'skip',
  hold: 'stand', read: 'stand', lie: 'stand', parasol: 'stand', slump: 'stand', reach: 'stand', tired: 'stand', doze: 'stand', bow: 'stand' };
// 嘴：露齿笑、o、嘟嘴（cpout）用琪露诺的，其余用帕秋莉的（颜色换成自己的）；Q 版脸大，嘴放大 1.3 倍（同姐姐）
const KOI_CIR_MOUTHS = { grin: 'grin', o: 'o', laugh: 'laugh', cpout: 'pout' };
function koiMouthPts(type, open) {
  const cm = KOI_CIR_MOUTHS[type], [pts, col, tg] = cm ? cirMouthPts(cm, open) : pchMouthPts(type, open);
  return [koiScale(pts, 1.3), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg ? koiScale(tg, 1.3) : tg];
}
// blank：五官换一套暗高光的颜色画（rigFace 读 S.K）。layered 眼睛的颜色记在缓存里，blank 的 iris .78 只有它用，缓存键不和别的表情撞
function koiFace(k) {
  if (!k.md.dull) { rigFace(k); return; }
  const S = k.S, K0 = S.K; S.K = KOI_KD;
  try { rigFace(k); } finally { S.K = K0; }
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
//   标记 behind 背在身后（袖子画在身子后面、手不画）| up 举起来（袖子和手画在鬓发外面、帽子里面）
//        hat 压帽子（袖子同 up，手画在帽子外面）| 其他在身前
// up 上身下移（坐），lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开，hop 离地高度，kick 后腿踢起的角，hatRot 帽子被压歪、hatDown 往下压，shrug 耸肩
function koiIK(sx, sy, tx, ty, L1 = KOI_L1, L2 = KOI_L2, bend = 1) {
  const vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) + bend * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
const KOI_HAT_ARM = 1.7;   // 压帽子的那只手臂拉长（Q 版手臂短，够不到帽檐；帕秋莉 lift 也是拉长 1.5）
function koiPose(pose, g, tt) {
  const [sx, sy] = KOI_SH, hangB = [-.2, .12 + .03 * Math.sin(tt * 1.1), 'open', false], hangF = [.2, -.1 - .03 * Math.sin(tt * 1.1 + 1), 'open', false];
  switch (pose) {
    case 'wave': { const w = Math.sin(tt * 7);
      return { back: hangB, front: [1.95 + .05 * w, .95 + .38 * w, 'open', 'up', 1.12, 1.12], hr: .05, turn: .22, look: .45 }; }
    case 'point': return { back: hangB, front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.02, turn: .3, look: .6, lean: .03 * g };
    case 'hat': {   // 帽檐右端（被手压歪压低后约在头坐标 (109,-110)）按歪头转到上身坐标，手腕停在它下面一点，手指扣到帽檐边上
      const hr = .12, px = 102 * KOI_HEAD, py = -110 * KOI_HEAD, bx = px * Math.cos(hr) - py * Math.sin(hr), by = KOI_NECK + px * Math.sin(hr) + py * Math.cos(hr);
      const L = KOI_HAT_ARM, [a, b] = koiIK(sx, sy - 8, bx - 4, by + 14, KOI_L1 * L, KOI_L2 * L, -1);
      return { back: hangB, front: [a, b, 'open', 'hat', L, L], hr, turn: .18, look: .5, lookY: -.4, hatRot: .19, hatDown: 13, shrug: 8 };
    }
    case 'skip': {   // 离地 4..32 起伏；后腿往后踢起，前腿伸直略往前；两手往外张
      const ph = Math.sin(tt * 5.2);
      return { back: [-.62 - .1 * ph, -.35, 'open', false], front: [.75 + .1 * ph, .45, 'open', false], hop: 18 + 14 * ph, kick: 1.05 + .15 * ph, hr: .07, turn: .25, look: .3, lean: .02 };
    }
    case 'sit': return { back: [-.25, .5, 'open', false], front: [.25, -.5, 'open', false], up: KOI_UP, turn: .15, look: .2, hr: .04 };
    case 'hide': return { back: [.2, .55, 'open', 'behind'], front: [-.2, -.55, 'open', 'behind'], hr: .16, turn: .2, look: .55, lookY: .3 };
    default: return { back: hangB, front: hangF, hr: .05, turn: .15, look: .25 };
  }
}

// ===================== 第三只眼、软管、帽子亮面、玫瑰（自画层） =====================
// koiTubes：从眼球伸出两根软管，一根绕到前手腕、一根绕到后手腕（手背在身后时改连到腰两侧），各挂一颗心形。
// 端点每帧从骨头里取，曲线是三次贝塞尔：中段往外鼓、往下垂一点，再随 t 轻轻摆（同 satori.js 的 satTubes）。
const KOI_TUBES = [[1, 1.25, .4], [-1, 1.1, 2.6]];   // [鼓向（1 外侧）, 鼓的比例, 摆的相位]
function koiTubes(k) {
  const { B, AB, AF, S, tt } = k, ug = B.ug, inv = rInv(ug), loc = p => rApply(inv, p);
  const e = loc(rApply(B.eye3, [0, 0]));
  const end = (A, side) => A.flag === 'behind' ? [side * 38, -198] : loc(rApply(A.hm, [0, -3]));
  const ends = [end(AF, 1), end(AB, -1)];
  const items = [], his = [], hearts = [], hhs = [];
  ends.forEach((p, i) => {
    const [side, bul, ph] = KOI_TUBES[i], dx = p[0] - e[0], dy = p[1] - e[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const sg = Math.sign(nx || 1) * side, b = L * .22 * bul + 2 * Math.sin(tt * 1.3 + ph), sag = Math.min(20, L * .14);
    const c1 = [e[0] + dx * .3 + nx * b * sg, e[1] + dy * .3 + ny * b * sg + sag], c2 = [e[0] + dx * .72 + nx * b * .7 * sg, e[1] + dy * .72 + ny * b * .7 * sg + sag * .6];
    const bz = u => { const v = 1 - u; return [0, 1].map(q => v * v * v * e[q] + 3 * v * v * u * c1[q] + 3 * v * u * u * c2[q] + u * u * u * p[q]); };
    const pts = []; for (let j = 0; j <= 18; j++) pts.push(bz(j / 18));
    const p2 = polyPath(rStroke(pts, u => 3.8 - 1 * u), true); p2.dim = 3;
    const h2 = polyPath(rStroke(pts.slice(2, 15).map(([x, y]) => [x - .5, y - .6]), 1), true); h2.dim = 1;
    items.push({ p: p2, m: ug, col: S.K.tube }); his.push({ p: h2, m: ug, col: S.K.tubeHi, edge: false });
    // 心形挂在管子中段，随管子轻晃
    const hp = bz(.52), hm = rTR(ug, hp[0], hp[1] + 3, .25 * Math.sin(tt * 1.6 + ph));
    hearts.push({ p: S.G.tubeHeart, m: hm, col: S.K.heart }); hhs.push({ p: S.G.tubeHeartHi, m: hm, col: S.K.heartHi, edge: false });
  });
  k.paint(items, RIG_SH.tiny);
  k.paint(his, null, false, .7, true);
  k.paint(hearts, RIG_SH.tiny);
  k.paint(hhs, null, false, .8, true);
}
// koiEye3：眼睑一圈打底；闭上（默认）时合成一道往下弯的缝，缝上下各一点浅色；睁开时同姐姐的分层眼珠（satori.js 的 satEye3）
function koiEye3(k) {
  const { S, B, K } = k, m = B.eye3, R = KOI_E3.r, op = rQ(k.e3open), lx = rQ(k.e3look[0], 10), ly = rQ(k.e3look[1], 10);
  k.paint([{ p: S.G.e3Lid, m, col: K.lid3 }], RIG_SH.mid);
  k.paint([{ p: S.G.e3LidHi, m, col: K.lid3Hi, edge: false }], null, false, .8, true);
  if (op < .08) {
    k.paint([{ p: rigMemo(S, 'e3c', () => { const top = [], bot = []; for (let j = 0; j <= 10; j++) { const u = j / 5 - 1, x = u * (R + .8), y = 3 * (1 - u * u) + .5; top.push([x, y - 1.3]); bot.unshift([x, y + 1.3 - Math.abs(u) * .7]); } return S.cut([...top, ...bot], 60, 3, .15, false); }), m, col: K.lid3Dk, edge: false }], null, false, 1, true);
    return;
  }
  const [ball, sclera, iris, pupil, hi, line] = rigMemo(S, ['e3', op, lx, ly].join('|'), () => {
    const ry = R * op, hl = x => Math.abs(x) >= R ? 0 : ry * Math.sqrt(1 - (x / R) ** 2), cl = ([x, y]) => [x, clamp(y, -hl(x), hl(x))];
    const ix = lx * R * .32, iy = ly * R * .28 + R * .05;
    const top = []; for (let j = 0; j <= 14; j++) { const x = (j / 7 - 1) * R; top.push([x, -hl(x)]); }
    return [S.cut(ellPts(0, 0, R, ry, 24), 61, 3, .15), S.cut(ellPts(ix * .3, iy * .3, R * .86, R * .86, 20).map(cl), 62, 3, .15),
      S.cut(ellPts(ix, iy, R * .52, R * .55, 18).map(cl), 63, 2.6, .12), S.cut(ellPts(ix, iy, R * .17, R * .34, 12).map(cl), 64, 2, .08),
      S.cut(ellPts(ix - R * .2, Math.max(iy - R * .24, -hl(ix - R * .2) + 1.6), R * .12, R * .12, 8), 65, 2, .05),
      S.cut(rStroke(top, u => .8 + 1.4 * Math.sin(Math.PI * u)), 66, 3, .1, false)];
  });
  k.paint([{ p: ball, m, col: K.e3, edge: false }, { p: sclera, m, col: K.e3In, edge: false }, { p: iris, m, col: K.e3Iris, edge: false }, { p: pupil, m, col: K.pupil3, edge: false }], null, false, 1, true);
  k.paint([{ p: hi, m, col: K.white, edge: false }, { p: line, m, col: K.lid3Dk, edge: false }], null, false, 1, true);
}
// 帽身亮面：帽身整片先涂暗面色，再在帽身轮廓里填一块亮面，右下留一圈暗面（同 meiling.js 的 meiHatLight）
function koiHatLight(k) {
  const m = k.B.hat, c = k.c, L = k.env.L;
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); c.clip(k.G.domeClip); c.fillStyle = L ? rigTone(k.K.hatLt, L).lit : k.K.hatLt; c.fill(k.G.domeLight); c.restore();
}

// ===================== 部件表 =====================
const koiIs = (...ps) => k => ps.includes(k.pose), koiNot = (...ps) => k => !ps.includes(k.pose);
const koiUp = A => A.flag === 'up' || A.flag === 'hat';
// 手臂分两层（docs/rig.md「拿东西的手」）：袖子和宽袖口同一层（上臂、前臂、袖口镶边、肩头），手在袖子外面另起一层（玫瑰夹在中间）
const koiSleeves = f => ({ arms: f, order: 'arm', items: [['armU', 'uD', 'top'], ['fore', 'lD', 'top'], ['foreTrim', 'lD', 'trim'], ['shoulder', 'u', 'top']], sh: 'mid' });
const koiHands = f => ({ arms: f, items: [['@hand', 'hm', 'skin']], sh: 'tiny' });
const koiRose = k => k.rose;
const KOI_RIG = {
  name: 'koishi', h: 500, height: 520, K: KOI_K, G: KOI_G, cut: KOI_CUT,
  moods: KOI_MOODS, moodAlias: KOI_MOOD_ALIAS, poseAlias: KOI_POSE_ALIAS, pose: koiPose, mouth: koiMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.016, .8, 2],
  // 五官（头坐标，和帕秋莉一样：眼睛 (±28,-54)、rx 13、ry 16，乘 1.2 后落到规格的 ±34 / -313 / 15.6 / 19.2）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 198, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: KOI_SH, upper: KOI_L1, fore: KOI_L2, mirrorHand: true,
    tips: Object.fromEntries(Object.entries(RIG_SHAPES.handTip).map(([n, [x, y]]) => [n, [x * KOI_HAND, y * (n === 'fist' ? 1.6 : KOI_HAND)]])),
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：轻晃、呼吸；第三只眼慢慢浮动。拿玫瑰时改前手（stand 抬到胸前）
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .008 * Math.sin(tt * 1.0) + .004 * Math.sin(tt * 2.3);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.hop = ps.hop || 0;
    k.ugL = rTR(rPivot(R_I, 0, KOI_WAIST, k.lean), 0, -k.breath);
    k.e3open = clamp(o.eye3 ?? 0, 0, 1);
    const el = o.eyeLook || [.3, .1]; k.e3look = [clamp(el[0], -1, 1), clamp(el[1], -1, 1)];
    k.rose = false;
    if (o.rose) {
      const f = ps.front;
      // drawRig 用的是同一个 ps 对象（koiPose 每次新建），这里原地换掉前手
      if (k.pose === 'stand') { const [a, b] = koiIK(KOI_SH[0], KOI_SH[1], 14, -204, KOI_L1, KOI_L2, 1); ps.front = [a, b, 'grip', false]; k.rose = true; }
      else if (f[2] === 'open' && !f[3]) { ps.front = [f[0], f[1], 'grip', f[3], f[4], f[5]]; k.rose = true; }
    }
  },
  bones: [
    { name: 'root', at: k => [0, -k.hop], rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, KOI_NECK], rot: k => k.hr, scale: [KOI_HEAD, KOI_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.pose === 'sit' ? KOI_SIT_SK : null, pivot: [0, KOI_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    // 腿：绕髋转；skip 时后腿（-x 那条）往后踢起，前腿略往前
    { name: 'leg', sides: true, when: koiNot('sit'), parent: 'root', pivot: (k, sd) => [sd * 13.5, -66], rot: (k, sd) => k.pose === 'skip' ? (sd < 0 ? k.ps.kick : -.12) : 0 },
    { name: 'shin', sides: true, when: koiIs('sit'), parent: 'root', at: (k, sd) => [sd * 14, 2], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    // 第三只眼：挂点上一根看不见的摆（待机慢慢晃 + 弹簧滞后），眼球在摆的末端，但不跟着摆转（始终和上身同向）
    { name: 'eye3H', parent: 'ug', pivot: KOI_E3.hang, at: KOI_E3.hang, sway: [.06, 1.1, .8], spring: { len: KOI_E3.len, gain: 1.3, f: 1.5, zeta: .22, max: .7 } },
    { name: 'eye3', m: k => { const ug = k.B.ug, p = rApply(rInv(ug), rApply(k.B.eye3H, [0, KOI_E3.len])); return rTR(ug, p[0], p[1] + 1.4 * Math.sin(k.tt * 1.5), 0); } },
    { arms: true },
    // 玫瑰：握点在前手里，花始终朝上（跟上身同向，略往外歪）
    { name: 'rose', when: koiRose, m: k => { const ug = k.B.ug, p = rApply(rInv(ug), rApply(k.AF.hm, [0, 7])); return rTR(ug, p[0], p[1], .12 + .03 * Math.sin(k.tt * 1.4)); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -112], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.4, sd], spring: { len: 100, gain: .7, f: 2.3, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'hat', parent: 'head', pivot: [0, -140], at: k => [k.turn * 4, KOI_HAT_SIT + (k.ps.hatDown || 0)], rot: k => KOI_HAT_TILT + (k.ps.hatRot || 0) + .012 * Math.sin(k.tt * 1.2 + .5) },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [66, -104 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 后发
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 背在身后的两只手臂（只露出一点袖子）
    koiSleeves(A => A.flag === 'behind'),
    // 腿
    { when: koiNot('sit'), items: [['legL', 'legL', 'skin'], ['legR', 'legR', 'skin']], sh: 'tiny' },
    { when: koiNot('sit'), items: [['shoeL', 'legL', 'shoe'], ['shoeR', 'legR', 'shoe']], sh: 'mid' },
    { when: koiNot('sit'), items: [['shoeHiL', 'legL', 'shoeHi', false], ['shoeHiR', 'legR', 'shoeHi', false]], gr: false, al: .8 },
    { when: koiIs('sit'), items: [['shin', 'shinL', 'skin'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'skin'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    { when: koiIs('sit'), items: [['sitShoeHi', 'shinL', 'shoeHi', false], ['sitShoeHi', 'shinR', 'shoeHi', false]], gr: false, al: .8 },
    // 裙子：墨绿钟形，褶、下摆深边、藤蔓和白花
    { items: [['skirt', 'skirt', 'skirt']], sh: 'big' },
    { items: [['folds', 'skirt', 'skirtFold', false]], gr: false },
    { items: [['hemBand', 'skirt', 'hem']], gr: false },
    { items: [['vine', 'skirt', 'vine', false], ['leaves', 'skirt', 'vine', false]], gr: false },
    { items: [['flowers', 'skirt', 'flower']], sh: 'tiny', gr: false },
    { items: [['flowerC', 'skirt', 'flowerC', false]], gr: false },
    // 上身：黄色上衣、下摆浅绿边、浅绿宽领、菱形扣
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'top']], sh: 'mid' },
    { items: [['shirtFolds', 'ug', 'topFold', false]], gr: false },
    { items: [['shirtHem', 'ug', 'trim']], gr: false },
    { items: [['collarL', 'ug', 'trim'], ['collarR', 'ug', 'trim']], sh: 'tiny' },
    { items: [['collarEdgeL', 'ug', 'trimDk', false], ['collarEdgeR', 'ug', 'trimDk', false]], gr: false },
    { items: [['buttons', 'ug', 'button']], sh: 'tiny', gr: false },
    // 垂在身前的袖子（连袖口）；软管压在袖口上，第三只眼；玫瑰在袖子前、手指后；手
    koiSleeves(A => !A.flag),
    { call: koiTubes },
    { call: koiEye3 },
    { when: koiRose, items: [['roseStem', 'rose', 'stem'], ['roseLeaf', 'rose', 'stem']], sh: 'tiny' },
    { when: koiRose, items: [['roseOuter', 'rose', 'rose']], sh: 'tiny' },
    { when: koiRose, items: [['roseMid', 'rose', 'roseLt']], gr: false },
    { when: koiRose, items: [['roseSpiral', 'rose', 'roseDk', false]], gr: false },
    koiHands(A => !A.flag),
    // 脸、前发、鬓发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: koiFace },
    { items: [['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { items: [['hairHi', 'bangs', 'hairHi', false]], gr: false, al: .8 },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair']], sh: 'mid' },
    { call: 'brows' },
    // 举起来的手臂：袖子压在鬓发外面、帽子里面；挥手的手也在这里
    koiSleeves(koiUp),
    koiHands(A => A.flag === 'up'),
    // 帽子：帽檐底面（深，往下错开）→ 帽檐顶面 → 亮边 → 帽身（暗面整片 + 亮面）压住帽檐后半圈 → 浅凹 → 黄缎带 → 飘带 → 蝴蝶结
    { items: [['brimUnder', 'hat', 'brimUnder']], sh: 'mid' },
    { items: [['brim', 'hat', 'brimTop']], gr: false },
    { items: [['brimHi', 'hat', 'hatLt', false]], gr: false },
    { items: [['dome', 'hat', 'hat']], sh: 'big' },
    { call: koiHatLight },
    { items: [['creases', 'hat', 'brimUnder', false]], gr: false, al: .7 },
    { items: [['ribbon', 'hat', 'ribbon']], sh: 'tiny' },
    { items: [['ribbonHi', 'hat', 'white', false]], gr: false, al: .35 },
    { items: [['bowTails', 'hat', 'ribbonDk']], sh: 'tiny' },
    { items: [['ribbonBow', 'hat', 'ribbon']], sh: 'tiny' },
    { items: [['bowFolds', 'hat', 'ribbonDk', false]], gr: false, al: .8 },
    { items: [['ribbonKnot', 'hat', 'ribbon']], sh: 'tiny' },
    // 压帽子的那只手：只有手压在帽檐外面
    koiHands(A => A.flag === 'hat'),
    // 表情道具
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, eye3: rApply(B.eye3, [0, 0]),
      hat: rApply(B.hat, [0, -226]), rose: k.rose ? rApply(B.rose, [0, -40]) : null };
  },
};

function drawKoishi(c, o = {}) { return drawRig(c, KOI_RIG, o); }
