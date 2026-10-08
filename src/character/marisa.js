'use strict';
// 雾雨魔理沙 —— 剪纸人偶的部件表（第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 普通的魔法使：金色略卷的长发（一侧鬓发编成小辫、辫梢系白蝴蝶结）、黑色大尖顶魔女帽（白缎带蝴蝶结）、黑背心裙 + 白衬衫泡泡袖、白围裙（荷叶边）、白袜黑圆鞋、扫帚和八卦炉。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawMarisa(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], broom:[x,y] | null, hakkero:[x,y] | null }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和帕秋莉一样，样张里抬高 100）；ride：扫帚柄那条线上臀部中心（样张里抬高 130）
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，帽尖高出头顶多少各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像；ride 时扫帚柄朝 facing 那边，扫帚头拖在后面）
//   pose     stand 一手叉腰、一手垂在身前 | point 一手叉腰、一手指向前方（gesture 伸多远）
//            broom 一手握扫帚扛在肩后（扫帚头在背后上方）| ride 侧坐在扫帚上飞：前手指向前方、后手搭在腿上、两腿往后飘、头发往后吹
//            hakkero 一手把八卦炉举向前方（Master Spark 的架势）| cross 双臂抱胸 | sit 坐着、两腿垂下轻晃
//            grin 一手叉腰、一手抬起按住帽檐（帽子往一边压低）
//            旧名兼容：lecture→point、proud/cheer/smug→grin、think→cross、hold/lift/carry→broom、fly→ride、spark/throw→hakkero、其余（peek/lie/read/walk/slump/reach…）→stand
//   mood     normal 自信：眼睛睁开、嘴角一挑（默认）| grin 闭眼得意大笑、下巴抬 | smile 眯眼笑 | surprised 眼睛睁圆、嘴 o
//            pout 鼓腮撅嘴、脸红 | annoyed 眼睑压低、眉头压、嘴抿成波浪
//            旧名兼容：proud/smug/laugh/happy→grin（happy→smile）、angry→annoyed、sad/flustered→pout、confused/panic/cry→surprised、calm/smirk/sleepy/yawn/awkward→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，broom 扫帚头中心（broom / ride 姿势，其余 null），hakkero 八卦炉中心（hakkero 姿势，其余 null）
//
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -180），root 骨头整体乘 MAR_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 MAR_HEAD，合起来 1.2 倍：脸宽约 154、下巴到头顶约 180。
// 帽子（按 rig.md 帽子规则）：软塌的大魔女帽。帽檐宽约脸宽的 1.9 倍，前沿是中间最低的下鼓弧，两端往下耷拉、尖端略外翻，整顶帽子略歪；
// 帽檐两层：上面黑、前沿和两端下面露一条深紫里衬。帽身底座 ±70 比头顶宽，下沿贴着帽檐那道弧罩住整个头顶，帽檐前沿那一条压在帽身下沿前面；
// 头发全部画在帽子之前，不会夹在帽子两层之间。帽身两侧内凹往上收，到顶先变窄再软软地往一侧塌下来（和帽身同一张纸，折处一道阴影），帽身三道褶；底部白缎带、正面偏右一个大白蝴蝶结。
// 本文件顶层名字都带 mar / MAR 前缀。

// ===================== 颜色（压暗、低饱和；黑白分明，金发和稻草要暖） =====================
const MAR_K = (() => {
  const hair = '#e6c565', hairBack = '#c49d45', white = '#f6f2eb', black = '#2c2832', eye = '#c08a24', straw = '#d2a453', wood = '#8a5c36';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3), hairHi: mix(hair, white, .3),
    black, blackLite: mix(black, '#8a8098', .22), fold: mix(black, '#9a90a8', .3),
    white, shirt: '#f3efe8', frill: '#f8f5ef', apron: '#f4f1ea', apronFold: mix('#f4f1ea', '#8f8798', .28),
    hat: '#2a2630', hatLit: mix('#2a2630', '#8d84a0', .2), hatBrim: mix('#2a2630', '#7a7090', .14), hatLip: '#24212a', hatFold: mix('#2a2630', P.ink, .4), hatUnder: '#463a66', hatUnderDeep: '#352c50',
    ribbon: '#f4f0e9', ribbonKnot: mix('#f4f0e9', '#8f8798', .3),
    skin: P.skin, blush: P.blush, sock: '#f3eee9', shoe: '#2a2630', shoeHi: mix('#2a2630', '#9a90a8', .3),
    // 眼睛分层（第三版）：金色虹膜、下半亮黄、深棕瞳孔、上沿阴影；粗眼线深棕
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#ffe9a0', .55), pupil: mix(eye, P.ink, .78), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: mix('#4a3320', P.ink, .6), lash: mix('#4a3320', P.ink, .6), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    straw, strawDeep: mix(straw, '#7a4e22', .4), strawLite: mix(straw, '#fff0c8', .3), wood, woodDeep: mix(wood, P.ink, .35), tie: mix('#8a3a2e', P.ink, .2),
    hak: '#3e3238', hakRim: mix(P.gold, P.ink, .15), hakBar: '#e3c66e', hakCore: '#d8563a', hakCoreLt: '#f0c060',
  };
})();
const MAR_CUT = rigCutter(7000);
// 身子坐标：脖子 -212、腰 -180；root 乘 MAR_BODY（脖子落在 -248），头再乘 MAR_HEAD（合起来 1.2）；坐下时上身下移 MAR_UP（×1.17 ≈ 100）
const MAR_BODY = 1.17, MAR_NECK = -212, MAR_WAIST = -180, MAR_HEAD = 1.2 / MAR_BODY, MAR_UP = 86, MAR_SH = [28, -200], MAR_ARM = 36;

// ===================== 部件（载入时剪好） =====================
// 折线 → u(0..1) 按弧长取点（给 rScallop 用）
function marAlong(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = L[L.length - 1];
  return u => { const d = clamp(u, 0, 1) * T; let i = 1; while (i < L.length - 1 && L[i] < d) i++; const f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; };
}
// 两点之间的二次弧：bend 往前进方向左手边鼓多少；marHooks 一串弯尖 [尖, 谷, 弯]，两条边往同一侧弯，尖像小钩
function marArc(a, b, bend, n = 5) { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, cx = (a[0] + b[0]) / 2 - dy / l * bend, cy = (a[1] + b[1]) / 2 + dx / l * bend;
  return Array.from({ length: n }, (_, k) => { const t = (k + 1) / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]; }); }
function marHooks(start, list) { const out = [start]; let p = start; for (const [t, v, bend] of list) { out.push(...marArc(p, t, bend), ...marArc(t, v, -bend * .7)); p = v; } return out; }
// 帽子（头坐标）：帽檐半宽 R（约 1.9 倍脸宽），前沿 marBrimF 是一道中间最低的下鼓弧，两端再往下耷拉、尖端略往外翻；后沿 marBrimT 是扁弧
// 整顶帽子按 tilt 歪一点（y += tilt·x）；帽身下沿是一道半径 MAR_CROWN 的前弧，两端正好落在帽檐后沿上
const MAR_HAT_UP = 24;   // 整顶帽子比头顶再高这么多：帽檐下露出一截头发，头才显得圆
const MAR_BRIM = { y: -122, R: 122, front: 28, back: 22, droop: 20, wave: 2.2, flip: 7, tilt: -.04 }, MAR_CROWN = { y: -139, rx: 72, ry: 15, h: 80 };
const marTilt = pts => pts.map(([x, y]) => [x, y + MAR_BRIM.tilt * x]);
const marCrownBase = x => MAR_CROWN.y + MAR_CROWN.ry * Math.sqrt(Math.max(0, 1 - (x / MAR_CROWN.rx) ** 2)) + MAR_BRIM.tilt * x;
const marBrimS = x => Math.min(1, Math.abs(x) / MAR_BRIM.R);
const marBrimDroop = x => { const B = MAR_BRIM, s = marBrimS(x), u = clamp((s - .62) / .38, 0, 1); return B.droop * u * u * (3 - 2 * u) + B.wave * Math.sin(x * .09 + .9) * s * s + B.tilt * x; };
const marBrimF = x => MAR_BRIM.y + MAR_BRIM.front * Math.cos(Math.PI / 2 * marBrimS(x)) ** 1.5 + marBrimDroop(x);
const marBrimT = x => MAR_BRIM.y - MAR_BRIM.back * Math.sqrt(Math.max(0, 1 - marBrimS(x) ** 2)) + marBrimDroop(x);
// 帽身两侧：t 0（底座 ±70）→ 1（折点 ±14），往上收的内凹软曲线
const marCrownSide = (sd, t) => { const C = MAR_CROWN, x = sd * (14 + (C.rx - 14) * (1 - t) ** 1.4); return [x, marCrownBase(x) - C.h * t + (sd < 0 ? -4 * t : 0)]; };
// 扫帚（扫帚头系绳处为原点，柄朝 +y 长 MAR_BROOM.len，稻草朝 -y 长 MAR_BROOM.straw）
const MAR_BROOM = { len: 200, straw: 78, grip: 140 };
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变
const marHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
const MAR_G = (() => {
  const cut = MAR_CUT, g = {};
  // ---- 腿（站姿，脚底为原点，身子坐标）：一截白袜 + 黑色大圆鞋，鞋尖朝前一点 ----
  g.legL = cut([[-20, -56], [-8, -56], [-8.5, -12], [-19.5, -12]], 10, 6, .3, false); g.legR = cut([[8, -56], [20, -56], [19.5, -12], [8.5, -12]], 11, 6, .3, false);
  g.shoeL = cut(ellPts(-14, -9, 15, 9.5, 18), 12, 5, .4); g.shoeR = cut(ellPts(15, -9, 15, 9.5, 18), 13, 5, .4);
  g.shoeHiL = cut(ellPts(-18, -13.5, 5, 2, 10), 14, 3, .1, false); g.shoeHiR = cut(ellPts(11, -13.5, 5, 2, 10), 15, 3, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.5, 18], [4.8, 30], [-4.8, 30], [-5.5, 18]], 16, 8, .4);
  g.sitShoe = cut(ellPts(3, 33, 12.5, 8, 16), 17, 5, .4);
  // ---- 裙：黑色钟形裙摆（腰 -180 到 -56，下摆微微起伏）+ 下面露一圈白衬裙荷叶边 + 几道褶 ----
  const hem = []; for (let k = 0; k <= 16; k++) { const x = lerp(80, -80, k / 16); hem.push([x, -57 + 2.2 * Math.sin(k / 16 * Math.PI * 5)]); }
  g.skirt = cut([[-25, -184], [25, -184], [33, -164], [45, -130], [60, -94], [74, -68], [80, -58], ...hem, [-74, -68], [-60, -94], [-45, -130], [-33, -164]], 20, 9, .6);
  g.petti = cut([...rOpen([[-76, -66], [0, -63], [76, -66]], 6), ...rScallop(u => [lerp(82, -82, u), -50 + 2 * (1 - (2 * u - 1) ** 2)], 13, 4.2)], 21, 4, .4, false);
  g.folds = [-.7, -.35, .35, .7].map((u, i) => { const xt = u * 26, xb = u * 74; return cut([[xt - .8, -170], [xt + .8, -170], [xb + 1.5, -62], [xb - 1.5, -62]], 22 + i, 11, .4, false); });
  // ---- 白围裙：一圈荷叶边（侧边和下摆）+ 里面平的一片 + 两道褶 + 腰带 ----
  const apR = [[21, -181], [27, -140], [33, -100], [36, -78]], apB = [[36, -78], [18, -75], [0, -74], [-18, -75], [-36, -78]], apL = apR.map(([x, y]) => [-x, y]).reverse();
  const grow = (pts, d) => pts.map(([x, y]) => [x + Math.sign(x) * d, y + (y > -100 ? d * .9 : 0)]);
  g.apronFrill = cut([[-22, -181], [22, -181], ...rScallop(marAlong(grow(apR, 6)), 6, 2.4), ...rScallop(marAlong(grow(apB, 7)), 8, 4), ...rScallop(marAlong(grow(apL, 6)), 6, 2.4)], 30, 4, .4, false);
  g.apron = cut([[-21, -181], [21, -181], ...apR.slice(1), ...apB.slice(1, -1), ...apL.slice(0, -1)], 31, 8, .4);
  g.apronFolds = [-.4, .4].map((u, i) => cut([[u * 20 - .7, -168], [u * 20 + .7, -168], [u * 44 + 1.3, -82], [u * 44 - 1.3, -82]], 32 + i, 10, .3, false));
  g.apronBand = cut([[-26.5, -185], [26.5, -185], [27, -177], [-27, -177]], 34, 6, .3, false);
  // ---- 上身：黑背心（短身子：肩到腰只有 36）、脖子、白衬衫的 V 领口和圆翻领 ----
  g.vest = cut([[-13, -217], [13, -217], [24, -211], [29, -199], [28, -186], [26, -178], [-26, -178], [-28, -186], [-29, -199], [-24, -211]], 40, 8, .5);
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 41, 8, .3, false);
  g.bib = cut([[-12, -219], [12, -219], [6, -205], [0, -197], [-6, -205]], 42, 4, .2, false);
  const flap = [[0, -220], [8, -222.5], [14.5, -219], [15, -212], [9, -208], [2, -211]];
  g.collarR = cut(flap, 43, 3, .2); g.collarL = cut(rMirror(flap), 44, 3, .2);
  g.vestFolds = [-1, 1].map((sd, i) => cut([[sd * 16 - .6, -206], [sd * 16 + .6, -206], [sd * 18 + .9, -186], [sd * 18 - .9, -186]], 45 + i, 6, .2, false));
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：白泡泡袖 + 袖口一圈（肩为原点）、光胳膊（上臂、前臂）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-6.2, 6], [6.2, 6], [6.6, 22], [6, 38], [0, 40.5], [-6, 38], [-6.6, 22]], 50, 8, .3);
  g.fore = cut([[-5.8, -3], [0, -5], [5.8, -3], [6, 12], [5.4, 33], [-5.4, 33], [-6, 12]], 51, 7, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.2, y * 1.12]), 52, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.08, y * 1.1 - .4]), 53, 5, .3, false);
  g.puffFolds = [-5, 0, 5].map((x, i) => cut([[x * 1.2 - .6, -8], [x * 1.2 + .6, -8], [x * 1.5 + .8, 14], [x * 1.5 - .8, 14]], 54 + i, 6, .2, false));
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(marHandPts(H.open), 60, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 61, 3, .25);
  g.handPoint = cut(marHandPts(H.point), 62, 3, .2, false); g.handGrip = cut(marHandPts(H.grip), 63, 3, .2, false);
  // ---- 扫帚（系绳处为原点）：木柄、柄尾、两道系绳、一束稻草（下沿一排参差的草尖）、几道草纹 ----
  const B = MAR_BROOM;
  g.handle = cut(rStroke([[0, -4], [0, B.len]], 5.2), 70, 12, .15, false);
  g.butt = cut(ellPts(0, B.len, 3.6, 3.2, 10), 71, 3, .1, false);
  const tips = []; for (let k = 0; k <= 12; k++) { const u = k / 12, x = lerp(31, -31, u); tips.push([x, -B.straw + (k % 2 ? 9 + 5 * hash(k, 3) : -2 * hash(k, 5)) + 6 * (2 * u - 1) ** 2]); }
  g.straw = cut([[-8, 2], [8, 2], [14, -18], [23, -42], [30, -64], ...tips, [-30, -64], [-23, -42], [-14, -18]], 72, 7, .5, false);
  g.strawLines = [-.62, -.3, 0, .3, .62].map((u, i) => cut(rStroke([[u * 9, -4], [u * 20, -36], [u * 28, -64 + 4 * Math.abs(u)]], 1.6), 73 + i, 6, .15, false));
  g.strawLite = cut([[-6, 0], [2, 0], [4, -20], [2, -50], [-6, -66], [-14, -50], [-11, -22]], 79, 6, .3);
  g.ties = [-1, -12].map((y, i) => cut([[-9.5 - i * 1.5, y - 3], [9.5 + i * 1.5, y - 3], [10 + i * 1.5, y + 3], [-10 - i * 1.5, y + 3]], 80 + i, 5, .2, false));
  // ---- 八卦炉（中心为原点）：深色八角炉身、金边、八组卦爻（每边一根短金条）、中间红亮的炉口 ----
  const oct = r => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return [r * Math.cos(a), r * Math.sin(a)]; });
  g.hakRim = cut(oct(19), 85, 4, .2, false); g.hak = cut(oct(16.5), 86, 4, .2, false);
  g.hakBars = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), r = 12.4, w = 4.2, t = 1.1;
    return cut([[-w, -t], [w, -t], [w, t], [-w, t]].map(([x, y]) => [(r + y) * ca - x * sa, (r + y) * sa + x * ca]), 87 + i, 3, .05, false); });
  g.hakCore = cut(ellPts(0, 0, 7, 7, 14), 96, 3, .1, false); g.hakCoreLt = cut(ellPts(-1.6, -1.6, 3.4, 3.4, 10), 97, 2, .05, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  // 圆脸：两颊鼓、下巴小（和帕秋莉同一张脸型，全员统一）
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 120, 7, .5);
  // 后发：从帽下蓬出来、披到腰下的金色长发；外轮廓一起一伏，下面分成几束带弯尖的发梢
  const backR = [[40, -172], [66, -160], [84, -142], [92, -120], [94, -96], [93, -78], [88, -52], [93, -24], [89, 4], [95, 32], [92, 60], [99, 86]];
  const backL = [[-40, -172], [-66, -160], [-85, -142], [-93, -118], [-93, -94], [-92, -74], [-88, -46], [-94, -18], [-90, 10], [-96, 38], [-92, 62], [-99, 86]];
  const backTips = marHooks([99, 86], [[[106, 118], [88, 100], 4], [[82, 126], [68, 104], 3], [[58, 122], [44, 106], 3], [[30, 118], [14, 104], 2], [[0, 116], [-14, 104], -2],
    [[-30, 120], [-46, 104], -3], [[-60, 124], [-72, 102], -3], [[-84, 126], [-90, 98], -4], [[-106, 116], [-99, 86], -3]]);
  g.backHair = cut([[0, -176], ...rOpen(backR, 5), ...backTips, ...rOpen(backL, 5).reverse()], 121, 9, .8, false);
  g.hairStrands = [-58, -30, 0, 30, 58].map((x0, i) => { const pts = []; for (let y = -40; y <= 96; y += 12) pts.push([x0 + 4 * Math.sin(y * .07 + i * 1.7) + y * .08 * Math.sign(x0 || 1), y]); return cut(rStroke(rOpen(pts, 4), u => 2.4 - 1.5 * u), 122 + i, 6, .2, false); });
  // 两侧鬓发的根：从帽檐下沿往外蓬（外沿 ±84，约脸宽的 1.3 倍），像被帽子压住后鼓出来
  const puffO = [[46, -158], [70, -148], [84, -130], [87, -110], [85, -92]];
  // 左鬓发（屏幕左、sd = -1）：贴着脸颊垂到胸口的一绺波浪侧发，末端分成三个弯尖
  const lockO = rOpen([...puffO, [80, -70], [71, -50], [68, -30], [76, -8], [70, 16], [74, 38]], 4);
  const lockI = rOpen([[40, -150], [52, -132], [57, -106], [60, -84], [56, -62], [50, -42], [49, -22], [55, 0], [54, 24]], 4).reverse();
  const lockTips = marHooks([74, 38], [[[73, 64], [65, 44], -4], [[62, 60], [58, 42], -3], [[52, 54], [54, 24], -2]]);
  const lockR = [...lockO, ...lockTips.slice(1), ...lockI];
  g.lockL = cut(rMirror(lockR), 140, 6, .5, false);
  g.lockLines = [[[67, -84], [62, -56], [58, -34], [64, -8], [62, 18], [64, 46]], [[76, -96], [72, -66], [64, -44], [62, -26]]].map((pts, i) =>
    cut(rMirror(rStroke(rOpen(pts, 4), u => 1.8 - 1.2 * u)), 230 + i, 6, .15, false));
  // 右鬓发（sd = +1）编成一条细麻花辫：根部从帽檐下蓬出来再收进辫子，辫子贴着脸颊外缘垂到胸口，系小白蝴蝶结，下面散一小撮发尾
  g.braidRoot = cut([...rOpen([...puffO, [82, -80], [74, -68], [66, -62]], 4), [60, -64], ...rOpen([[56, -72], [60, -90], [58, -112], [50, -134], [40, -150]], 4)], 141, 5, .4, false);
  const bpts = spline([[66, -70], [62, -50], [57, -30], [53, -10], [51, 10], [51, 28], [52, 44]], 4, false), bp = marAlong(bpts), NB = 7;
  g.braidBack = cut(rStroke(bpts, u => 10 - 2.5 * u), 232, 5, .2, false);
  // 每一节是一瓣斜着的小弧形发束，左右交替、下一节压上一节（三股辫的样子）
  g.braid = Array.from({ length: NB }, (_, i) => { const [bx, by] = bp((i + .5) / NB), sd = i % 2 ? 1 : -1, w = 6 - i * .2, h = 11 - i * .3, a = sd * .5;
    const leaf = []; for (let k = 0; k < 14; k++) { const t = k / 14 * TAU, x = w * Math.sin(t) * (1 - .3 * Math.cos(t)), y = -h * Math.cos(t); leaf.push([bx + sd * 1.6 + x * Math.cos(a) - y * Math.sin(a), by + x * Math.sin(a) + y * Math.cos(a)]); }
    return cut(leaf, 142 + i, 4, .25); });
  g.braidLines = Array.from({ length: NB - 1 }, (_, i) => { const [bx, by] = bp((i + 1) / NB), sd = i % 2 ? -1 : 1;
    return cut(rStroke(rOpen([[bx - 4.5 * sd, by - 3], [bx + .5 * sd, by + .5], [bx + 4 * sd, by + 3.5]], 2), 1.2), 152 + i, 3, .1, false); });
  g.braidTuft = cut([[-4.5, -2], [4.5, -2], [7, 8], [9, 19], [5, 14], [2, 23], [-1, 13], [-5, 20], [-6, 8]], 160, 4, .3, false);
  g.braidBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * .85, y * .85]), 161, 3, .2, false);
  g.braidKnot = cut(ellPts(0, 0, 2.4, 2.8, 8), 162, 2, .1, false);
  // 刘海：从帽檐下出来几缕长短不一的弯尖（眼睛上面的短，眉心和两鬓的长），下缘大致压到眼睛上沿；顶部藏在帽檐下
  const bangSet = [[[72, -64], [62, -96], 4], [[54, -72], [46, -95], 3], [[37, -78], [29, -96], 3], [[21, -75], [12, -97], 2], [[3, -64], [-8, -95], -3],
    [[-20, -76], [-28, -97], -2], [[-36, -79], [-45, -95], -3], [[-54, -70], [-62, -97], -3], [[-72, -64], [-74, -104], -4]];
  g.bangs = cut([[-70, -142], [-56, -160], [-30, -171], [0, -174], [30, -171], [56, -160], [70, -142], ...marHooks([74, -104], bangSet)], 165, 6, .5, false);
  g.bangLines = bangSet.filter((_, i) => i % 2 === 0).map(([[tx, ty]], i) => cut(rStroke([[tx * .97, ty - 5], [tx * 1.02, -100], [tx * 1.04, -128], [tx * .96, -156]], u => 1.8 * (1 - u) + .5), 166 + i, 8, .2, false));
  // ---- 魔女帽（头坐标）----
  // 帽檐：整片（里衬在下、黑面在上，里衬只在前沿和两端下面露一条跟着弧走的细边），帽身罩在它上面，前沿一条（同样两层）再压到帽身下沿前面
  const BR = MAR_BRIM, CR = MAR_CROWN, NX = 40;
  const xs = Array.from({ length: NX + 1 }, (_, k) => lerp(BR.R, -BR.R, k / NX));
  const tip = (sd, under) => [sd * (BR.R + BR.flip), marBrimF(sd * BR.R) - 4 + under * .6];
  const front = under => [tip(1, under), ...xs.map(x => [x, marBrimF(x) + under * (.55 + .45 * marBrimS(x) ** 2)]), tip(-1, under)];
  const top = xs.slice().reverse().map(x => [x, marBrimT(x)]);
  g.brimUnder = cut([...front(7), ...top], 180, 5, .4); g.brim = cut([...front(0), ...top], 181, 5, .4);
  g.brimClip = polyPath([...front(8), ...top], true);
  const base = []; for (let k = 0; k <= 20; k++) { const x = lerp(-CR.rx, CR.rx, k / 20); base.push([x, marCrownBase(x)]); }
  const lip = under => [...front(under), ...top.filter(p => p[0] < -CR.rx - 1), ...base.map(([x, y]) => [x, y - 1]), ...top.filter(p => p[0] > CR.rx + 1)];
  g.brimLipUnder = cut(lip(7), 182, 5, .4, false); g.brimLip = cut(lip(0), 183, 5, .4, false);
  // 帽檐上沿着前沿的亮边和从帽身散开的几道软褶
  g.brimRim = cut(rStroke(xs.slice(5, -5).map(x => [x * .97, marBrimF(x) - 3.2]), u => 1.9 - 1.2 * Math.abs(2 * u - 1)), 184, 8, .1, false);
  g.brimFolds = [-.8, -.4, .32, .7].map((u, i) => { const xb = u * CR.rx * .92, xo = xb * 1.45;
    return cut(rStroke(rOpen([[xb, marCrownBase(xb) + 2], [lerp(xb, xo, .55), lerp(marCrownBase(xb), marBrimF(xo), .55)], [xo, marBrimF(xo) - 3]], 4), u2 => 2 - 1.6 * u2), 185 + i, 6, .15, false); });
  // 帽身 + 折下来的尖是同一张纸：两侧内凹往上收，到折点 ±14 先变窄，再往屏幕右侧塌下来，尖端短而圆钝、微微往里卷
  const crR = Array.from({ length: 9 }, (_, k) => marCrownSide(1, k / 8)), crL = Array.from({ length: 9 }, (_, k) => marCrownSide(-1, 1 - k / 8));
  const fold = marTilt([[22, -212], [31, -208], [39, -201], [44, -193], [46, -186], [50, -181], [55, -182], [58, -189], [57, -200], [51, -213], [40, -225], [24, -233], [6, -234], [-7, -229], [-14, -222]]);
  g.crown = cut([...base, ...crR.slice(1), ...fold, ...crL], 190, 6, .5);
  const litO = Array.from({ length: 9 }, (_, k) => marCrownSide(-1, k / 8 * .92));
  g.crownLit = cut([...litO, ...litO.slice().reverse().map(([x, y], k) => [x * .5, y + (k === litO.length - 1 ? 9 : 0)])], 191, 6, .3);
  g.crownFolds = [[-40, -128, -30, -158, -18, -190], [-4, -123, -2, -160, 2, -196], [30, -126, 26, -154, 19, -180]].map(([x0, y0, x1, y1, x2, y2], i) =>
    cut(rStroke(rOpen(marTilt([[x0, y0], [x1, y1], [x2, y2]]), 4), u => 2.6 - 2.1 * u), 192 + i, 6, .2, false));
  g.crownFoldsLit = [[-35, -128, -25, -158, -14, -188], [2, -123, 4, -160, 7, -194]].map(([x0, y0, x1, y1, x2, y2], i) =>
    cut(rStroke(rOpen(marTilt([[x0, y0], [x1, y1], [x2, y2]]), 4), u => 1.8 - 1.4 * u), 196 + i, 6, .15, false));
  // 折点：一道阴影把塌下来的尖和帽身分开，尖的上沿一道亮边
  g.foldShade = cut(rStroke(rOpen(marTilt([[-14, -219], [-2, -216], [12, -213], [24, -210], [34, -205], [42, -196], [47, -187]]), 4), u => 4.2 - 2.4 * u), 198, 5, .2, false);
  g.foldLit = cut(rStroke(rOpen(marTilt([[-6, -228], [8, -231], [24, -229], [40, -221], [50, -209], [54, -196]]), 4), u => 2.2 - 1.6 * Math.abs(2 * u - 1)), 199, 6, .1, false);
  // 帽身下沿一圈白缎带（宽约 16，两端顺着帽身收窄）
  const bandB = [], bandT = []; for (let k = 0; k <= 20; k++) { const u = k / 20, x = lerp(-CR.rx + 1, CR.rx - 1, u); bandB.push([x, marCrownBase(x) - 2]);
    const xt = lerp(CR.rx - 4, -CR.rx + 4, u); bandT.push([xt, marCrownBase(xt) * 1 - 17 + 2 * (1 - (xt / CR.rx) ** 2)]); }
  g.band = cut([...bandB, ...bandT], 202, 6, .3, false);
  g.bandShade = cut(rStroke(bandB.slice(2, -2).map(([x, y]) => [x, y - 2.5]), 2.4), 203, 6, .1, false);
  // 大白蝴蝶结（结为原点，宽约 70 = 半个脸宽多一点）：后面两条暗一档的飘带 → 两个亮的环 → 环里的暗褶 → 结
  g.bowTails = [cut([[-3, 1], [4, 2], [-6, 16], [-12, 30], [-16, 24], [-20, 28], [-15, 12]], 205, 4, .3), cut([[2, 1], [-3, 3], [7, 15], [14, 28], [17, 21], [22, 24], [16, 10]], 206, 4, .3)];
  const loop = sd => [[0, -2], [sd * 9, -13], [sd * 21, -21], [sd * 32, -19], [sd * 37, -9], [sd * 36, 3], [sd * 29, 11], [sd * 17, 11], [sd * 6, 5]];
  g.bowLoops = [cut(loop(-1), 207, 4, .4), cut(loop(1).map(([x, y]) => [x * 1.06, y * 1.04]), 208, 4, .4)];
  g.bowShade = [-1, 1].map((sd, i) => cut([[sd * 4, -1], [sd * 14, -10], [sd * 25, -11], [sd * 18, -4], [sd * 26, 3], [sd * 13, 4]], 209 + i, 3, .2, false));
  g.bowKnot = cut(ellPts(0, -.5, 7, 9, 14), 211, 3, .2);
  g.bowKnotShade = cut(ellPts(1.6, 2.5, 4, 5, 10), 212, 2, .1, false);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂（负：外端上挑），lower 下眼睑托起，es 眼睛大小，iris 虹膜大小，brow [上移, 内端下压角]，chin 下巴抬（负）
// 魔理沙的眼神：眼睛睁得大、外眼角略挑，嘴角一挑，总是一副「交给我吧」的样子
const MAR_MOODS = {
  normal: { eye: 'open', lid: .12, lidTilt: -.05, es: 1, brow: [2, -.06], mouth: 'smirk', blush: .9 },
  grin: { eye: 'up', brow: [4, -.14], mouth: 'laugh', blush: 1.2, chin: -.1 },
  smile: { eye: 'open', lid: .14, lidTilt: -.02, lower: 5, es: 1, brow: [3, -.08], mouth: 'smile', blush: 1.15 },
  surprised: { eye: 'open', lid: 0, es: 1.1, iris: .78, brow: [7, -.12], mouth: 'o', blush: .9 },
  pout: { eye: 'open', lid: .26, lidTilt: .04, es: 1, brow: [0, .3], mouth: 'pout', blush: 1.6, puff: true },
  annoyed: { eye: 'open', lid: .5, lidTilt: -.02, es: 1, brow: [-1, .36], mouth: 'wave', blush: .8 },
};
const MAR_MOOD_ALIAS = { proud: 'grin', smug: 'grin', laugh: 'grin', happy: 'smile', angry: 'annoyed', sad: 'pout', flustered: 'pout', confused: 'surprised', panic: 'surprised', cry: 'surprised', calm: 'normal', smirk: 'normal', sleepy: 'normal', yawn: 'normal', awkward: 'normal' };
const MAR_POSE_ALIAS = { lecture: 'point', proud: 'grin', cheer: 'grin', smug: 'grin', think: 'cross', hold: 'broom', lift: 'broom', carry: 'broom', parasol: 'broom', fly: 'ride', spark: 'hakkero', throw: 'hakkero',
  peek: 'stand', lie: 'stand', read: 'stand', walk: 'stand', run: 'stand', tired: 'stand', slump: 'stand', reach: 'stand', doze: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的。Q 版脸大，嘴整体放大 1.3 倍
const MAR_CIR_MOUTHS = new Set(['laugh', 'smile', 'wail', 'grin', 'o']);
const marScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
function marMouthPts(type, open) {
  const [pts, col, tg] = (MAR_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [marScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', marScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
// marIK：肩 (±28, -200 - shrug)（上身坐标）到腕 (tx, ty)，上臂、前臂各 36·k，肘往外弯 → [a, b]；sd = -1 是后手
function marIK(sd, tx, ty, k = 1, shrug = 0) {
  const L1 = MAR_ARM * k, L2 = MAR_ARM * k, X = sd * tx - MAR_SH[0], Y = ty - (MAR_SH[1] - shrug), d = clamp(Math.hypot(X, Y), .01, L1 + L2 - .01);
  const a = Math.atan2(X, Y) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), ex = L1 * Math.sin(a), ey = L1 * Math.cos(a);
  return [sd * a, sd * (Math.atan2(X - ex, Y - ey) - a)];
}
// grin：帽子往前侧压低 MAR_TUG 弧度，前手腕到帽檐前沿右侧那一段下面（上身坐标），手指扣在帽檐边上
const MAR_TUG = .18, MAR_TUG_WRIST = [100, -306], MAR_TUG_K = 1.7, MAR_TUG_SHRUG = 6;
function marPose(pose, g, tt) {
  const hipB = [-.95, 1.7, 'fist', false];
  switch (pose) {
    case 'point': return { back: hipB, front: [lerp(1.35, 1.9, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: .04, turn: .3, look: .6, lean: .03 * g };
    case 'cross': return { back: [-.32, 2.15, 'fist', false, 1, 1.15], front: [.3, -2.1, 'fist', false, 1, 1.15], hr: -.05, turn: -.3, look: .8, keepTurn: true };
    case 'sit': return { back: [-.3, .62, 'open', false], front: [.3, -.62, 'open', false], up: MAR_UP, seat: true, turn: .15, look: .2, hr: .06 };
    case 'broom': return { back: hipB, front: [.4, -2.05, 'grip', false], broom: 'shoulder', hr: .06, turn: .2, look: .3 };
    case 'ride': return { back: [-.3, .62, 'open', false], front: [lerp(1.25, 1.6, g), lerp(.2, 0, g), 'point', false, 1.08, 1.08], up: MAR_UP, seat: true, broom: 'ride', wind: 1,
      lean: .05, hr: .03, turn: .3, look: .7 };
    case 'hakkero': return { back: hipB, front: [lerp(1.3, 1.55, g), lerp(.15, 0, g), 'grip', false, 1.1, 1.1], hakkero: true, hr: .02, turn: .32, look: .8, lean: .03 };
    case 'grin': return { back: hipB, front: [...marIK(1, MAR_TUG_WRIST[0], MAR_TUG_WRIST[1], MAR_TUG_K, MAR_TUG_SHRUG), 'grip', false, MAR_TUG_K, MAR_TUG_K], shrug: MAR_TUG_SHRUG, tug: MAR_TUG,
      hr: 0, noChin: true, turn: .22, look: .4 };   // 头不歪（noChin：表情的抬下巴也不算），手才正好够到帽檐
    default: return { back: hipB, front: [.12, -1.05 + .05 * Math.sin(tt * 1.3), 'open', false], hr: .08, turn: .15, look: .3 };
  }
}

// ===================== 部件表 =====================
// 拿东西的手（rig.md「拿东西的手」）：胳膊和手先在手臂层画，都在东西后面；东西画完，再把手指裁在东西的轮廓里压上去（marGrip），
// 这样露在东西外面的手掌照常看得见，压在东西上的只有扣住边的手指。扛扫帚的前手例外：柄太细，整只拳头在柄画完后握上去。
const marHolds = k => k.ps.broom === 'shoulder';
const marHandPart = (k, A) => marHolds(k) && A === k.AF ? null : k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
// 握东西的手：裁在东西的轮廓里画，只有扣在东西边上的手指露在前面
function marGrip(clipBone, clipPart) {
  return k => {
    const c = k.c, M = k.B[clipBone], T = c.getTransform();
    c.save(); c.transform(M[0], M[1], M[2], M[3], M[4], M[5]); c.clip(clipPart); c.setTransform(T);
    k.paint([{ p: k.G.handGrip, m: k.AF.hm, col: k.K.skin }], RIG_SH.tiny, false); c.restore();
  };
}
const marArms = [
  { arms: 'all', order: 'arm', items: [[marHandPart, 'hm', 'skin'], ['fore', 'lD', 'skin'], ['armU', 'uD', 'skin']], sh: 'mid' },
  { arms: 'all', items: [['puff', 'u', 'shirt']], sh: 'mid' },
  { arms: 'all', items: [['puffFolds', 'u', 'apronFold', false], ['cuff', 'u', 'frill']], gr: false },
];
// 坐下时裙子绕腰压扁一点、放宽一点，裙摆刚好盖过座沿
const MAR_SIT_SKIRT = (() => { const sx = 1.08, sy = .8; return [sx, 0, 0, sy, 0, MAR_WAIST * (1 - sy)]; })();
const MAR_BROOM_ITEMS = [['straw', 'broom', 'straw'], ['strawLite', 'broom', 'strawLite', false], ['strawLines', 'broom', 'strawDeep', false]];
const MAR_RIG = {
  name: 'marisa', h: 500, height: 520, K: MAR_K, G: MAR_G, cut: MAR_CUT,
  moods: MAR_MOODS, moodAlias: MAR_MOOD_ALIAS, poseAlias: MAR_POSE_ALIAS, pose: marPose, mouth: marMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.016, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -80, len: 8.5, seed: 198, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: MAR_SH, upper: MAR_ARM, fore: MAR_ARM, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；骑扫帚时整个人上下浮动；头发、帽尖、辫子有弹簧
  vars(k) {
    const { ps, tt } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.wind = ps.wind || 0;
    k.bob = ps.broom === 'ride' ? 3 * Math.sin(tt * 1.6) : 0;
    k.ugL = rTR(rPivot(R_I, 0, MAR_WAIST, k.lean), 0, -k.breath);
  },
  bones: [
    { name: 'root', at: k => [0, k.bob], rot: k => k.sway, scale: [MAR_BODY, MAR_BODY] },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, MAR_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [MAR_HEAD, MAR_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.ps.up ? MAR_SIT_SKIRT : null, pivot: [0, MAR_WAIST], rot: k => k.lean * .5 + k.wind * (.04 + .015 * Math.sin(k.tt * 5)), spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    // 坐 / 骑：小腿从座沿垂下；骑扫帚时往后飘
    { name: 'shin', sides: true, when: k => k.ps.seat, parent: 'root', at: (k, sd) => [sd * 15, 8],
      rot: (k, sd) => k.wind ? .42 + sd * .1 + .08 * Math.sin(k.tt * 2.4 + (sd > 0 ? 0 : 1.3)) : .18 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .07 * sd },
    { arms: true },
    // 扫帚：shoulder 柄穿过前手的握点，往后上方斜着扛在肩后；ride 横在座沿下面，柄朝前、略抬头，扫帚头拖在后面
    { name: 'broom', when: k => k.ps.broom, m: k => {
      if (k.ps.broom === 'ride') return rTR(k.B.root, -96, 6, -Math.PI / 2 - .05 + .02 * Math.sin(k.tt * 1.6));
      const ug = k.B.ug; return rTR(rTR(ug, ...rApply(rInv(ug), k.AF.tip), -.62 + .02 * Math.sin(k.tt * 1.3) + rigSpringRot(k, { len: 160, dir: -Math.PI / 2, gain: .3, max: .15 }), .92, .92), 0, -MAR_BROOM.grip); } },
    // 八卦炉：正对镜头，中心在前手指尖再往外一点（手指扣在炉的下沿）
    { name: 'hak', when: k => k.ps.hakkero, m: k => { const ug = k.B.ug, p = rApply(k.AF.hm, [0, 23]); return rTR(ug, ...rApply(rInv(ug), p), .05 * Math.sin(k.tt * 2)); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    // 后发：垂在背后，只跟一点头的转动（绕脖子把头的转角退回去大半），带弹簧；骑扫帚时往后吹
    { name: 'hairB', parent: 'head', rot: k => -k.hr * .85 + k.wind * (.14 + .03 * Math.sin(k.tt * 4)), sway: [.008, 1.1, .5], spring: { len: 200, gain: .5, f: 1.5, max: .12 } },
    { name: 'lockL', parent: 'head', pivot: [-58, -110], rot: k => -k.hr * .55 + k.wind * .12, sway: [.02, 1.5, -1], spring: { len: 150, gain: .6, f: 2, max: .25 } },
    { name: 'braid', parent: 'head', pivot: [60, -110], rot: k => -k.hr * .55 + k.wind * .16, sway: [.025, 1.4, 1], spring: { len: 150, gain: .6, f: 2, max: .25 } },
    { name: 'braidEnd', parent: 'braid', at: [52, 44], rot: k => .1 + .06 * Math.sin(k.tt * 2.3) + k.wind * .2 },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    // 帽子：grin 时绕帽檐中心往前侧压低（tug）
    { name: 'cap', parent: 'head', at: k => [k.turn * 4, -MAR_HAT_UP], pivot: [0, MAR_BRIM.y], rot: k => (k.ps.tug || 0) + k.wind * -.06 },
    { name: 'capTop', parent: 'cap', pivot: [0, MAR_CROWN.y], sway: [.01, 1.2, .5], rot: k => k.wind * -.05, spring: { len: 150, dir: -Math.PI / 2, gain: .3, f: 2.2, max: .08 } },
    { name: 'hatBow', parent: 'capTop', at: [34, marCrownBase(34) - 10], rot: -.08, sway: [.02, 2.1, 0], spring: { len: 18, gain: .4, f: 3, max: .25 } },
  ],
  layers: [
    // 扛着的扫帚：扫帚头在最后面（背后上方）
    { when: k => k.ps.broom === 'shoulder', items: [['ties', 'broom', 'tie'], ...MAR_BROOM_ITEMS], sh: 'big' },
    // 后发
    { items: [['backHair', 'hairB', 'hairBack']], sh: 'big' },
    { items: [['hairStrands', 'hairB', 'hairHi', false]], gr: false, al: .5 },
    // 骑的扫帚：在后发前、腿和裙子后面
    { when: k => k.ps.broom === 'ride', items: [['handle', 'broom', 'wood'], ['butt', 'broom', 'woodDeep']], sh: 'mid' },
    { when: k => k.ps.broom === 'ride', items: MAR_BROOM_ITEMS, sh: 'mid' },
    { when: k => k.ps.broom === 'ride', items: [['ties', 'broom', 'tie']], sh: 'tiny', gr: false },
    // 腿
    { when: k => !k.ps.seat, items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: k => !k.ps.seat, items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: k => !k.ps.seat, items: [['shoeHiL', 'root', 'shoeHi', false], ['shoeHiR', 'root', 'shoeHi', false]], gr: false },
    { when: k => k.ps.seat, items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 裙子：白衬裙荷叶边 → 黑裙 → 褶 → 白围裙（荷叶边 → 平片 → 褶）
    { items: [['petti', 'skirt', 'frill']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'black']], sh: 'big' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    { items: [['apronFrill', 'skirt', 'frill']], sh: 'mid' },
    { items: [['apron', 'skirt', 'apron']] },
    { items: [['apronFolds', 'skirt', 'apronFold', false]], gr: false },
    // 上身：黑背心、白领口、圆翻领、围裙腰带
    { items: [['neck', 'ug', 'skin', false], ['vest', 'ug', 'black']], sh: 'mid' },
    { items: [['vestFolds', 'ug', 'fold', false]], gr: false },
    { items: [['bib', 'ug', 'shirt']], gr: false },
    { items: [['apronBand', 'ug', 'apron']], sh: 'tiny', gr: false },
    { items: [['collarL', 'ug', 'shirt'], ['collarR', 'ug', 'shirt']], sh: 'tiny' },
    // 手臂（握着东西的前手除外）
    ...marArms,
    // 扛着的扫帚柄压在胳膊前面，握柄的拳头再握在柄上
    { when: k => k.ps.broom === 'shoulder', items: [['handle', 'broom', 'wood'], ['butt', 'broom', 'woodDeep']], sh: 'mid', gr: false },
    { when: k => k.ps.broom === 'shoulder', items: [['handFist', k => k.AF.hm, 'skin']], sh: 'tiny' },
    // 八卦炉：金边 → 炉身 → 卦爻 → 炉口；手指扣在炉的下沿
    { when: k => k.ps.hakkero, items: [['hakRim', 'hak', 'hakRim']], sh: 'mid' },
    { when: k => k.ps.hakkero, items: [['hak', 'hak', 'hak'], ['hakBars', 'hak', 'hakBar', false], ['hakCore', 'hak', 'hakCore', false], ['hakCoreLt', 'hak', 'hakCoreLt', false]], gr: false },
    { when: k => k.ps.hakkero, call: marGrip('hak', MAR_G.hakRim) },
    // 脸、前发（左鬓发、右边的小辫 + 胸口的白蝴蝶结）、刘海、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['braidRoot', 'braid', 'hair']], sh: 'mid' },
    { items: [['lockLines', 'lockL', 'hairLine', false]], gr: false, al: .7 },
    { items: [['braidBack', 'braid', 'hairBack']], sh: 'tiny', gr: false },
    { items: [['braid', 'braid', 'hair']], sh: 'tiny' },
    { items: [['braidLines', 'braid', 'hairLine', false]], gr: false },
    { items: [['braidTuft', 'braidEnd', 'hair']], sh: 'tiny' },
    { items: [['braidBow', 'braidEnd', 'ribbon']], sh: 'tiny', gr: false },
    { items: [['braidKnot', 'braidEnd', 'ribbonKnot']], gr: false },
    { items: [['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 魔女帽：整片帽檐（紫里衬 → 黑面）→ 帽身（底色 + 左侧亮面 + 褶）→ 折痕阴影 → 折下来的尖 → 白缎带 → 帽檐前沿（两层）压在帽身下沿前面 → 蝴蝶结
    { items: [['brimUnder', 'cap', 'hatUnder']], sh: 'big' },
    { items: [['brim', 'cap', 'hatBrim']], gr: false },
    { items: [['crown', 'capTop', 'hat']], sh: 'mid' },
    { items: [['crownLit', 'capTop', 'hatLit', false]], gr: false },
    { items: [['crownFolds', 'capTop', 'hatFold', false]], gr: false },
    { items: [['crownFoldsLit', 'capTop', 'blackLite', false]], gr: false, al: .7 },
    { items: [['foldShade', 'capTop', 'hatFold', false]], gr: false },
    { items: [['foldLit', 'capTop', 'hatLit', false]], gr: false },
    { items: [['band', 'capTop', 'ribbon']], sh: 'tiny' },
    { items: [['bandShade', 'capTop', 'ribbonKnot', false]], gr: false, al: .6 },
    { items: [['brimLipUnder', 'cap', 'hatUnder']], sh: 'mid' },
    { items: [['brimLip', 'cap', 'hatBrim']], gr: false },
    { items: [['brimFolds', 'cap', 'hatFold', false]], gr: false },
    { items: [['brimRim', 'cap', 'hatLit', false]], gr: false },
    { items: [['bowTails', 'hatBow', 'ribbonKnot']], sh: 'tiny' },
    { items: [['bowLoops', 'hatBow', 'ribbon']], sh: 'tiny' },
    { items: [['bowShade', 'hatBow', 'ribbonKnot', false]], gr: false },
    { items: [['bowKnot', 'hatBow', 'ribbon']], sh: 'tiny' },
    { items: [['bowKnotShade', 'hatBow', 'ribbonKnot', false]], gr: false, al: .6 },
    // grin：按帽檐的手指扣在帽檐边上
    { when: k => k.ps.tug, call: marGrip('cap', MAR_G.brimClip) },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip,
      broom: B.broom ? rApply(B.broom, [0, -MAR_BROOM.straw * .5]) : null, hakkero: B.hak ? rApply(B.hak, [0, 0]) : null };
  },
};

function drawMarisa(c, o = {}) { return drawRig(c, MAR_RIG, o); }
