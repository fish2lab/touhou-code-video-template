'use strict';
// 古明地觉 —— 剪纸人偶的部件表（地灵殿的觉妖怪：淡紫粉蓬松短发、带心形的发带、浅蓝宽袖短上衣、玫粉裙、胸前悬着的第三只眼）。
// 第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉（规格见 docs/rig.md「统一比例（第三版）」「画法规则（第三版）」）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表，外加第三只眼和软管两个自画层。
// 纯 Canvas 代码绘制，不加载任何图片。
//
// drawSatori(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], eye3:[x,y] }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（样张里抬高 100）
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，统一的是头和身子大小。她没有帽子，头顶比戴帽子的人低）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手交叠在身前（默认）| read 一手按在第三只眼上方的胸口、一手自然垂下（读心）
//            point 一手自然垂下、一手指向前方（gesture 伸多远）| think 一手托下巴、另一只手托着肘 | cross 双臂抱胸
//            sit 坐着、两腿垂下轻晃
//            旧名兼容：lecture→point、proud/cheer→cross、hold/lift/peek/lie/fly/walk/run/parasol/slump/reach/tired/doze→stand、present→point
//   mood     normal 半垂眼、看穿一切（默认）| smile 眯眼浅笑 | smug 闭眼、嘴角挑起 | surprised 眼睛睁圆、嘴 o
//            sad 眉尾下垂、嘴角下 | annoyed 眼睑压低、嘴抿成波浪 | flustered 脸红、冒汗
//            旧名兼容：proud→smug、happy→smile、angry/pout→annoyed、confused/panic→surprised、cry→sad、calm/sleepy/awkward→normal、yawn→normal
//   eye3     第三只眼睁开程度 0..1（默认 1；0 闭上，眼睑合成一道弧线）
//   eyeLook  [dx, dy] 第三只眼瞳孔朝向，-1..1（默认 [.3, .1]；dx 正 = 朝 facing 那边）
//   read     0..1 读心：第三只眼后面一圈淡光晕和几道放射短线，随 t 轻微脉动（默认 0；read 姿势默认 .7）
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//            track 给了时，第三只眼挂在一根弹簧上：走路、转身时滞后晃动
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，eye3 第三只眼中心
//
// 设计坐标（h = 520）：脚底 (0,0)，y 向下；脖子 -248、肩 ±33、腰 -192、裙摆 -54。头部件用「头坐标」（原点在脖子关节），
// 和帕秋莉的头坐标一样（下巴 -4、头顶 -150、脸宽 ±64），乘 SAT_HEAD = 1.2 落到规格表的位置。
// 本文件顶层名字都带 sat / SAT 前缀。

// ===================== 颜色（压暗、低饱和，和 P 里帕秋莉那组同一个明度带；只有第三只眼和发带心形带一点饱和色） =====================
const SAT_K = (() => {
  const hair = mix('#c7a6c6', '#8f8496', .18), hairBack = mix(hair, '#5e4a66', .32), top = mix('#b6cbe0', '#8e95a4', .25), skirt = mix('#d295ab', '#8f7f88', .3);
  const eye = '#8e3a62', e3 = '#c93a72', tube = mix('#a8407a', '#6b5470', .25), band = mix('#5a4062', P.ink, .25);
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .35), hairHi: mix(hair, '#fbf3f8', .38),
    top, topFold: mix(top, '#5f6b85', .3), frill: '#eff0ee', button: mix(skirt, P.ink, .25),
    skirt, skirtFold: mix(skirt, '#6e4a5c', .32), flower: mix(skirt, '#f5e6ea', .55), flowerC: mix(skirt, '#8a5368', .45), hem: mix(skirt, '#6e4a5c', .2),
    skin: P.skin, blush: P.blush, sock: '#efe9e2', slipper: mix('#dca6b7', '#9a8a90', .25), slipperHeart: mix('#b0546f', '#7a6670', .3),
    band, bandHi: mix(band, '#c9b3d0', .4), heart: '#cf3d6e', heartDk: mix('#cf3d6e', P.ink, .35),
    // 眼睛分层（第三版）：虹膜、虹膜下半亮色、瞳孔、虹膜上沿阴影、眼白、粗上眼线
    eye, irisLt: mix(eye, '#f0a8c8', .5), pupil: mix(eye, P.ink, .78), irisShade: alpha(mix(eye, P.ink, .8), .45), sclera: '#fbf8f3',
    lid: mix('#4a2238', P.ink, .6), lash: mix('#4a2238', P.ink, .5), brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    // 第三只眼：眼睑（深紫红）、眼球边（玫红）、眼白、虹膜、瞳孔；软管同色系
    lid3: mix('#7a2a56', P.ink, .15), lid3Dk: mix('#7a2a56', P.ink, .55), e3, e3In: '#f4dfe6', e3Iris: mix(e3, '#5a1030', .12), pupil3: '#26121e',
    tube, tubeHi: mix(tube, '#f0c8dc', .35), glow: '#f2a7c6',
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
  };
})();
const SAT_CUT = rigCutter(3600);
const SAT_NECK = -248, SAT_WAIST = -192, SAT_HEAD = 1.2, SAT_UP = 100;
const SAT_SH = [33, -234], SAT_L1 = 42, SAT_L2 = 40, SAT_HAND = 1.35;   // 肩、上臂、前臂（肘到袖口里的腕点）、手的放大
const SAT_E3 = { r: 11.5, hang: [9, -238], len: 22 };   // 第三只眼：半径（连眼睑约 14，比她自己的眼睛小一圈）；挂点（上身坐标）和挂绳长
// 坐着：裙子绕腰压扁一点、放宽一点，裙摆刚盖过座沿
// 按胸口的手：手腕往上折约 58°，手指朝左上搭到第三只眼的右上沿（read 姿势里前臂差不多是水平的）
const SAT_PRESS = 1.02, satRot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const SAT_SIT_SK = [1.08, 0, 0, .72, 0, .28 * SAT_WAIST];
// 发带：贴着头顶的一道椭圆弧（头坐标），两端收进鬓发下面
const SAT_BAND = { cx: 0, cy: -94, rx: 72, ry: 62 };
const satBandY = x => SAT_BAND.cy - SAT_BAND.ry * Math.sqrt(Math.max(0, 1 - (x / SAT_BAND.rx) ** 2));

// ===================== 部件（载入时剪好） =====================
// 心形：中心 (cx, cy)，宽约 2s，旋转 rot
function satHeartPts(cx, cy, s, rot = 0) {
  const out = [], co = Math.cos(rot), si = Math.sin(rot);
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, x = Math.pow(Math.sin(a), 3) * s, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * s;
    out.push([cx + x * co - y * si, cy + x * si + y * co]); }
  return out;
}
// 小花：五瓣（r(θ) = r0 + r1·cos 5θ）
const satFlowerPts = (cx, cy, r, rot) => { const out = []; for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, rr = r * (.62 + .38 * Math.cos(5 * (a + rot))); out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return out; };
// 微乱：轮廓点按 hash 抖一点（载入时一次）
const satJitter = (pts, seed, amp) => pts.map(([x, y], i) => [x + (hash(i, seed) - .5) * amp, y + (hash(i, seed + 1) - .5) * amp]);
// 蓬松：沿开放折线往外鼓 n 个圆包（外侧 = 折线前进方向的左手边，屏幕坐标里朝外），深 depth
const satFluff = (pts, n, depth) => rScallop(u => { const f = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), v = f - i; return [lerp(pts[i][0], pts[i + 1][0], v), lerp(pts[i][1], pts[i + 1][1], v)]; }, n, depth);
const satScale = (pts, k) => pts.map(([x, y]) => [x * k, y * k]);
const SAT_G = (() => {
  const cut = SAT_CUT, g = {};
  // ---- 腿（站姿，脚底为原点）：裙下露一截白袜，粉色圆拖鞋 + 心形 ----
  const legR = [[7.5, -66], [20, -66], [19.6, -40], [19, -12], [9.5, -12], [8.6, -40]];
  g.legR = cut(legR, 10, 8, .3); g.legL = cut(rMirror(legR), 11, 8, .3);
  g.shoeR = cut(ellPts(18, -10, 17.5, 11, 18), 12, 5, .35); g.shoeL = cut(ellPts(-18, -10, 17.5, 11, 18), 13, 5, .35);
  g.slipHeartR = cut(satHeartPts(21, -12, 4.4), 14, 2, .1, false); g.slipHeartL = cut(satHeartPts(-21, -12, 4.4), 15, 2, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 拖鞋
  g.shin = cut([[-6.5, -4], [6.5, -4], [6.2, 18], [5.6, 34], [-5.6, 34], [-6.2, 18]], 16, 8, .3);
  g.sitShoe = cut(ellPts(3, 38, 14.5, 9.5, 16), 17, 5, .35);
  g.sitHeart = cut(satHeartPts(6, 36, 3.8), 18, 2, .1, false);
  // ---- 裙子（腰 -192）：玫粉钟形裙、几道褶、下摆一道深边 + 一圈小花 ----
  g.skirt = cut([[-22, -197], [0, -198], [22, -197], [27, -186], [37, -162], [50, -130], [63, -98], [74, -74], [81, -58], [42, -54], [0, -53], [-42, -54], [-81, -58], [-74, -74], [-63, -98], [-50, -130], [-37, -162], [-27, -186]], 21, 11, .8);
  g.folds = [-.66, -.22, .22, .66].map((u, i) => { const xt = u * 22, xb = u * 70; return cut([[xt - .9, -186], [xt + .9, -186], [xb + 1.8, -66], [xb - 1.8, -66]], 23 + i, 12, .4, false); });
  g.hemBand = cut(rStroke(rOpen([[-79, -61], [-42, -57.5], [0, -56.5], [42, -57.5], [79, -61]], 4), 5), 27, 8, .3, false);
  const hemY = x => -70 + 5 * (x / 66) ** 2, fx = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
  g.flowers = fx.map((x, i) => cut(satFlowerPts(x, hemY(x), 5, i * .4), 28 + i, 2.2, .15, false));
  g.flowerC = fx.map((x, i) => cut(ellPts(x, hemY(x), 1.5, 1.5, 8), 37 + i, 2, .05, false));
  // ---- 上身（脖子 -248）：浅蓝短上衣（下摆荷叶边、略外扩）、荷叶边圆领、三颗心形纽扣 ----
  g.shirt = cut([[-14, -252], [14, -252], [26, -246], [34, -234], [36, -216], [38, -199], ...rScallop(rLine([40, -189], [-40, -189]), 7, 3.5), [-38, -199], [-36, -216], [-34, -234], [-26, -246]], 30, 7, .5, false);
  g.shirtFolds = [-.5, .5].map((u, i) => cut([[u * 14 - .7, -230], [u * 14 + .7, -230], [u * 26 + 1.2, -192], [u * 26 - 1.2, -192]], 48 + i, 10, .3, false));
  g.neck = cut([[-7, -264], [7, -264], [8, -244], [-8, -244]], 31, 8, .3, false);
  const collarR = [[.5, -251], [14, -253], [25, -246]], collarIn = [[7, -236], [2, -243]];
  const collarPts = [...collarR, ...rScallop(rLine([25, -246], [7, -236]), 3, 2.6), ...collarIn];
  g.collarR = cut(collarPts, 33, 3, .2, false); g.collarL = cut(rMirror(collarPts), 34, 3, .2, false);
  g.buttons = [-228, -214, -201].map((y, i) => cut(satHeartPts(0, y, 3.6), 50 + i, 1.6, .08, false));
  // ---- 手臂：上臂袖（肩为原点）、肩头、前臂宽袖口带荷叶边（肘为原点，袖口张到 ±19）、手（腕为原点，左手镜像） ----
  g.armU = cut([[-9.5, -4], [0, -8], [9.5, -4], [11, 20], [10.5, 40], [0, 45], [-10.5, 40], [-11, 20]], 40, 8, .3);
  g.shoulder = cut(ellPts(0, 5, 11.5, 12, 16), 41, 6, .3);
  const cuffEdge = rScallop(rLine([19, 41], [-19, 41]), 4, 3);
  g.fore = cut([[-8.5, -5], [0, -7.5], [8.5, -5], [10.5, 12], [14, 26], [19, 41], ...cuffEdge, [-14, 26], [-10.5, 12]], 42, 7, .3, false);
  g.foreTrim = cut([...cuffEdge, [-18.2, 36], [0, 37.6], [18.2, 36]], 43, 4, .2, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(satScale(H.open, SAT_HAND), 44, 3, .2, false); g.handFist = cut(ellPts(0, 7.2, 7.6, 8.6, 14), 45, 3, .25);
  g.handPoint = cut(satScale(H.point, SAT_HAND), 46, 3, .2, false); g.handGrip = cut(satScale(H.grip, SAT_HAND), 47, 3, .2, false);
  g.handPress = cut(satRot(satScale(H.open, SAT_HAND), SAT_PRESS), 49, 3, .2, false);
  // ---- 第三只眼（眼心为原点）：眼睑一圈（整颗球的底）。开口和眼珠按开合量现剪（见 satEye3） ----
  g.e3Lid = cut(ellPts(0, 0, SAT_E3.r + 2.6, SAT_E3.r + 2.4, 24), 55, 4, .25);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150，和帕秋莉同一张脸型） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 70, 7, .5);
  // 后发：蓬松的短发，比脸宽一圈，刚过下巴，发梢往外翘、长短不齐；外缘一串圆包显得蓬
  const bSide = satFluff([[0, -178], [36, -173], [62, -158], [80, -133], [88, -102], [89, -70], [86, -40], [85, -16]], 6, 3.6);
  const bTipsR = [[94, 2], [79, -5], [76, 9], [63, -2], [57, 11], [45, -3], [28, 3], [0, -5]];
  const bTipsL = [[-29, 3], [-46, -2], [-56, 10], [-65, -1], [-77, 8], [-80, -5], [-93, 2]];
  g.backHair = cut([...satJitter(bSide, 3, 1.4), ...bTipsR, ...bTipsL, ...satJitter(rMirror(bSide), 5, 1.4)], 73, 9, .8, false);
  // 鬓发：太阳穴垂到下巴，压在脸边上，发梢外翘、分叉（根在 (±58,-110)，盖住发带两端）
  const lockR = [...satFluff([[48, -136], [66, -124], [77, -98], [80, -64], [79, -32]], 3, 2.5), [85, -9], [88, 4], [77, -4], [74, 8], [67, -6], [62, 2], [60, -16], ...rOpen([[61, -38], [60, -66], [57, -94], [47, -122]], 4)];
  g.lockR = cut(lockR, 74, 6, .5, false); g.lockL = cut(satJitter(rMirror(lockR), 9, 2), 75, 6, .5, false);
  // 前发：罩住整个头顶（上缘就是头发的顶），下缘参差的刘海刚压到眼睛上沿，中间一绺最短
  const crown = satFluff([[-70, -112], [-66, -140], [-48, -164], [-22, -177], [0, -179], [22, -177], [48, -164], [66, -140], [70, -112]], 8, 3);
  g.bangs = cut([...crown, [66, -96], [60, -110], [54, -84], [46, -104], [38, -76], [30, -100], [22, -79], [14, -98], [6, -72], [0, -93], [-6, -77], [-13, -100], [-20, -75], [-28, -98], [-36, -80], [-44, -104], [-52, -82], [-58, -108], [-66, -94]], 76, 6, .5, false);
  g.bangLines = [[6, -72, 4, -136], [-20, -75, -16, -134], [38, -76, 34, -132], [-36, -80, -32, -136], [54, -84, 52, -126], [-52, -82, -50, -126]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.7, y1], [x1 + 1.7, y1], [x0 + .9, y0]], 77 + i, 8, .2, false));
  // 头发的亮光：发带下面一道断开的弧（天使环），显出头顶是圆的
  g.hairHi = [[-46, -30], [-24, -6], [6, 20], [28, 42]].map(([a0, a1], i) => { const pts = []; for (let j = 0; j <= 6; j++) { const x = lerp(a0, a1, j / 6); pts.push([x, -118 - 22 * Math.sqrt(Math.max(0, 1 - (x / 60) ** 2))]); }
    return cut(rStroke(pts, u => 1 + 3.2 * Math.sin(Math.PI * u)), 83 + i, 4, .15, false); });
  // 头顶一绺弯起来的呆毛
  g.tufts = [cut(rStroke(rOpen([[-2, -176], [-1, -190], [7, -201], [17, -204], [23, -198]], 3), u => 6.5 - 5.5 * u), 81, 3, .2, false)];
  // 发带：沿头顶的椭圆弧从左鬓到右鬓（正中最宽、转到两侧变窄，看得出是绕着头的一圈），上沿一道浅色细边；左边一颗心形
  const bandC = Array.from({ length: 25 }, (_, i) => { const x = (i / 12 - 1) * 70; return [x, satBandY(x)]; });
  g.band = cut(rStroke(bandC, u => 4.5 + 6 * Math.sin(Math.PI * u)), 87, 6, .2, false);
  g.bandHi = cut(rStroke(bandC.slice(3, 22).map(([x, y], i) => [x, y - (2 + 2.6 * Math.sin(Math.PI * (i + 3) / 24)) + .6]), u => .6 + 1.4 * Math.sin(Math.PI * u)), 88, 6, .1, false);
  const hx = -36, hy = satBandY(hx), hr = Math.atan(SAT_BAND.ry * hx / SAT_BAND.rx ** 2 / Math.sqrt(1 - (hx / SAT_BAND.rx) ** 2));
  g.bandHeart = cut(satHeartPts(hx, hy - 1, 8.5, hr), 84, 2.4, .12, false);
  g.bandHeartHi = cut(ellPts(hx - 3.5, hy - 4.5, 1.8, 1.3, 8, hr), 85, 2, .05, false);
  // 表情道具：汗滴
  g.sweat = cut(satScale(RIG_SHAPES.sweat, 1.3), 91, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// 字段同琪露诺（src/character/cirno.js「表情」）；lid 眼睑压下的比例（觉平时半垂眼、看穿一切），lidTilt 眼睑外端下垂，lower 下眼睑托起，chin 下巴抬（负）
const SAT_MOODS = {
  normal: { eye: 'open', lid: .42, lidTilt: .06, es: 1, brow: [0, -.04], mouth: 'flat', blush: .9, lookY: .6 },
  smile: { eye: 'open', lid: .36, lidTilt: .04, es: 1, lower: 3.2, brow: [1, -.08], mouth: 'smile', blush: 1.1 },
  smug: { eye: 'up', brow: [2, -.14], mouth: 'smirk', blush: 1, chin: -.1 },
  surprised: { eye: 'open', lid: 0, es: 1.12, brow: [6, -.1], mouth: 'o', blush: 1 },
  sad: { eye: 'open', lid: .4, lidTilt: -.06, es: .98, brow: [2, -.4], mouth: 'pout', blush: .9, lookY: 1.6, chin: .04 },
  annoyed: { eye: 'open', lid: .56, es: 1, brow: [-1, .34], mouth: 'wave', blush: .9 },
  flustered: { eye: 'open', lid: .04, es: 1.1, brow: [3, -.25], mouth: 'wobble', blush: 1.75, sweat: true },
};
const SAT_MOOD_ALIAS = { proud: 'smug', happy: 'smile', angry: 'annoyed', pout: 'annoyed', confused: 'surprised', panic: 'surprised', cry: 'sad', calm: 'normal', sleepy: 'normal', awkward: 'normal', yawn: 'normal', smirk: 'smug' };
const SAT_POSE_ALIAS = { lecture: 'point', present: 'point', proud: 'cross', cheer: 'cross', hold: 'stand', lift: 'stand', peek: 'stand', lie: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand', slump: 'stand', reach: 'stand', tired: 'stand', doze: 'stand', hide: 'stand', bow: 'stand' };
// 嘴：大笑、露齿笑、o 用琪露诺的，其余用帕秋莉的（颜色换成自己的）；Q 版脸大，嘴和帕秋莉一样放大 1.3 倍
const SAT_CIR_MOUTHS = new Set(['laugh', 'grin', 'o']);
function satMouthPts(type, open) {
  const [pts, col, tg] = (SAT_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [satScale(pts, 1.3), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg ? satScale(tg, 1.3) : tg];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角
//   标记 late：袖子照常画在第三只眼后面，只有手画在第三只眼和脸的外面（按胸口、托下巴的那只手）
// up 上身下移（坐），lean 身子前倾，hr 头额外转角（歪头），turn 脸侧开
// 两节手臂的反解：肩 (sx, sy) 到腕 (tx, ty)，上臂 L1、前臂 L2；bend +1 / -1 选肘弯向哪一边 → [a, b]
function satIK(sx, sy, tx, ty, L1 = SAT_L1, L2 = SAT_L2, bend = 1) {
  const vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) + bend * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
const SAT_E3_REST = [SAT_E3.hang[0], SAT_E3.hang[1] + SAT_E3.len];   // 第三只眼静止时的中心（上身坐标）
function satPose(pose, g, tt) {
  const [sx, sy] = SAT_SH, hang = [-.1, .14 + .03 * Math.sin(tt * 1.1), 'open', false];
  switch (pose) {
    case 'read': {   // 手腕贴在第三只眼右侧，折起的手掌按在眼睛右上方，指尖正好搭在眼睑上沿；肘往外张
      const [a, b] = satIK(sx, sy, SAT_E3_REST[0] + 22, SAT_E3_REST[1] + 4, SAT_L1, SAT_L2, 1);
      return { back: hang, front: [a, b, 'press', 'late'], hr: .07, turn: .2, look: .3, lookY: .5, read: .7 };
    }
    case 'point': return { back: hang, front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.02, turn: .3, look: .6, lean: .03 * g };
    case 'think': {   // 拳头托下巴，另一只手托住这只手的肘
      const [fa, fb] = satIK(sx, sy, 8, -242, SAT_L1, SAT_L2, -1), ex = sx + SAT_L1 * Math.sin(fa), ey = sy + SAT_L1 * Math.cos(fa);
      const [ba, bb] = satIK(-sx, sy, ex - 10, ey + 4, SAT_L1, SAT_L2, -1);
      return { back: [ba, bb, 'open', false], front: [fa, fb, 'fist', 'late'], hr: .1, turn: .2, look: .5, lookY: -1.5 };
    }
    case 'cross': {   // 双臂抱胸：拳头各自塞到对侧肘弯里
      const [ba, bb] = satIK(-sx, sy, 20, -204, SAT_L1, SAT_L2, -1), [fa, fb] = satIK(sx, sy, -20, -208, SAT_L1, SAT_L2, 1);
      return { back: [ba, bb, 'fist', false], front: [fa, fb, 'fist', false], hr: -.04, turn: -.3, look: .8, keepTurn: true };
    }
    case 'sit': return { back: [-.25, .5, 'open', false], front: [.25, -.5, 'open', false], up: SAT_UP, turn: .15, look: .2, hr: .04 };
    default: return { back: [-.12, 1.22, 'open', false], front: [.14, -1.3 + .03 * Math.sin(tt * 1.3), 'open', false], hr: .06, turn: .15, look: .2 };
  }
}

// ===================== 第三只眼和软管（自画层） =====================
// satTubes：从眼球伸出四根软管，分别连到发带右端（藏在鬓发下）、两只手腕、腰侧。端点每帧从骨头里取，曲线是三次贝塞尔：
// 中段往外鼓（每根方向不同）、往下垂一点，再随 t 轻轻摆。在上身坐标里剪好、按上身矩阵画（只做轮廓，不过剪刀，便宜）。
const SAT_TUBES = [[1, 1.1, .2], [1, -.55, 1.7], [-1, .7, 3.1], [1, .9, 4.4]];   // [鼓向（1 外侧）, 鼓的比例, 摆的相位]
function satTubes(k) {
  const { B, AB, AF, S, tt } = k, ug = B.ug, inv = rInv(ug), loc = p => rApply(inv, p);
  const e = loc(rApply(B.eye3, [0, 0]));
  const ends = [loc(rApply(B.head, [64, -112])), loc(rApply(AF.hm, [0, -3])), loc(rApply(AB.hm, [0, -3])), [28, -190]];
  const items = [], his = [];
  ends.forEach((p, i) => {
    const [side, bul, ph] = SAT_TUBES[i], dx = p[0] - e[0], dy = p[1] - e[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    // 鼓向：法线里朝外（+x 那侧）的一边 × side；挂得长的管子更垂
    const sg = Math.sign(nx || 1) * side, b = L * .22 * bul + 2 * Math.sin(tt * 1.3 + ph), sag = Math.min(18, L * .12);
    const c1 = [e[0] + dx * .3 + nx * b * sg, e[1] + dy * .3 + ny * b * sg + sag], c2 = [e[0] + dx * .72 + nx * b * .7 * sg, e[1] + dy * .72 + ny * b * .7 * sg + sag * .6];
    const pts = [];
    for (let j = 0; j <= 18; j++) { const u = j / 18, v = 1 - u; pts.push([0, 1].map(q => v * v * v * e[q] + 3 * v * v * u * c1[q] + 3 * v * u * u * c2[q] + u * u * u * p[q])); }
    const p2 = polyPath(rStroke(pts, u => 3.6 - 1 * u), true); p2.dim = 3;
    const h2 = polyPath(rStroke(pts.slice(2, 15).map(([x, y]) => [x - .5, y - .6]), 1), true); h2.dim = 1;
    items.push({ p: p2, m: ug, col: S.K.tube }); his.push({ p: h2, m: ug, col: S.K.tubeHi, edge: false });
  });
  k.paint(items, RIG_SH.tiny);
  k.paint(his, null, false, .7, true);
}
// satGlow：读心时眼球后面一圈淡光晕 + 几道放射短线（长短随 t 起伏）。直接在眼心坐标里画半透明色，不走剪纸
function satGlow(k) {
  const rd = k.read; if (rd <= .01) return;
  const { c, B, tt, K } = k, m = B.eye3, R = SAT_E3.r, pulse = 1 + .08 * Math.sin(tt * 3.1);
  c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const gr = c.createRadialGradient(0, 0, R * .8, 0, 0, R * 2.7 * pulse);
  gr.addColorStop(0, alpha(K.glow, .5 * rd)); gr.addColorStop(.55, alpha(K.glow, .2 * rd)); gr.addColorStop(1, alpha(K.glow, 0));
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R * 2.7 * pulse, 0, TAU); c.fill();
  c.strokeStyle = alpha(mix(K.glow, '#ffffff', .3), .75 * rd); c.lineCap = 'round'; c.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + .2 + .04 * Math.sin(tt * .7), ln = R * (.5 + .35 * hash(i, 361)) * (.75 + .25 * Math.sin(tt * 2.6 + hash(i, 362) * TAU)), r0 = R * 1.75;
    c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * (r0 + ln), Math.sin(a) * (r0 + ln)); c.stroke();
  }
  c.restore();
}
// satEye3：眼睑一圈打底，开口是横椭圆（高 = 开合量），开口里：玫红眼球边 → 浅色眼白 → 虹膜 → 瞳孔 → 高光，都按开口上下沿裁好；
// 上沿一道深色眼线。闭上时只剩一道向下弯的弧形纸条。轮廓按量化后的开合、朝向记忆。
function satEye3(k) {
  const { S, B, K } = k, m = B.eye3, R = SAT_E3.r, op = rQ(k.e3open), lx = rQ(k.e3look[0], 10), ly = rQ(k.e3look[1], 10);
  const items = [{ p: S.G.e3Lid, m, col: K.lid3 }];
  k.paint(items, RIG_SH.mid);
  if (op < .08) {
    k.paint([{ p: rigMemo(S, 'e3c', () => { const top = [], bot = []; for (let j = 0; j <= 10; j++) { const u = j / 5 - 1, x = u * (R + .5), y = 2.4 * (1 - u * u) - .5; top.push([x, y - 1.2]); bot.unshift([x, y + 1.2 - Math.abs(u) * .6]); } return S.cut([...top, ...bot], 60, 3, .15, false); }), m, col: K.lid3Dk, edge: false }], null, false, 1, true);
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

// ===================== 部件表 =====================
const satIs = (...ps) => k => ps.includes(k.pose), satNot = (...ps) => k => !ps.includes(k.pose);
// 手臂分两层（docs/rig.md「拿东西的手」）：袖子和宽袖口同一层（上臂、前臂、袖口荷叶边、肩头），手在袖子外面另起一层
const SAT_SLEEVES = { arms: 'all', order: 'arm', items: [['armU', 'uD', 'top'], ['fore', 'lD', 'top'], ['foreTrim', 'lD', 'frill'], ['shoulder', 'u', 'top']], sh: 'mid' };
const satHands = f => ({ arms: f, items: [['@hand', 'hm', 'skin']], sh: 'tiny' });
const SAT_RIG = {
  name: 'satori', h: 500, height: 520, K: SAT_K, G: SAT_G, cut: SAT_CUT,
  moods: SAT_MOODS, moodAlias: SAT_MOOD_ALIAS, poseAlias: SAT_POSE_ALIAS, pose: satPose, mouth: satMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, .9, 1],
  // 五官（头坐标，和帕秋莉一样：眼睛 (±28,-54)、rx 13、ry 16，乘 1.2 后落到规格的 ±34 / -313 / 15.6 / 19.2）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 198, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: SAT_SH, upper: SAT_L1, fore: SAT_L2, mirrorHand: true,
    tips: { ...Object.fromEntries(Object.entries(RIG_SHAPES.handTip).map(([n, [x, y]]) => [n, [x * SAT_HAND, y * (n === 'fist' ? 1.6 : SAT_HAND)]])), press: satRot([[0, 13 * SAT_HAND]], SAT_PRESS)[0] },
    hands: { press: 'handPress', open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  // 待机：站得稳，只轻晃、呼吸；第三只眼慢慢浮动
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .007 * Math.sin(tt * 1.1) + .0035 * Math.sin(tt * 2.4);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, SAT_WAIST, k.lean), 0, -k.breath);
    k.e3open = clamp(o.eye3 ?? 1, 0, 1);
    const el = o.eyeLook || [.3, .1]; k.e3look = [clamp(el[0], -1, 1), clamp(el[1], -1, 1)];
    k.read = clamp(o.read ?? ps.read ?? 0, 0, 1);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },                              // 坐：上身和裙子整体下移
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, SAT_NECK], rot: k => k.hr, scale: [SAT_HEAD, SAT_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.pose === 'sit' ? SAT_SIT_SK : null, pivot: [0, SAT_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: satIs('sit'), parent: 'root', at: (k, sd) => [sd * 14, 2], rot: (k, sd) => .15 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .06 * sd },
    // 第三只眼：挂点上一根看不见的摆（待机慢慢晃 + 弹簧滞后），眼球在摆的末端，但不跟着摆转（始终和上身同向）
    { name: 'eye3H', parent: 'ug', pivot: SAT_E3.hang, at: SAT_E3.hang, sway: [.05, 1.2, .3], spring: { len: SAT_E3.len, gain: 1.3, f: 1.5, zeta: .22, max: .7 } },
    { name: 'eye3', m: k => { const ug = k.B.ug, p = rApply(rInv(ug), rApply(k.B.eye3H, [0, SAT_E3.len])); return rTR(ug, p[0], p[1] + 1.2 * Math.sin(k.tt * 1.7), 0); } },
    { arms: true },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 58, -110], rot: k => -k.hr * .5, sway: (k, sd) => [.018, 1.5, sd], spring: { len: 100, gain: .7, f: 2.3, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'band', parent: 'head', at: k => [k.turn * 4, 0] },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [66, -110 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 后发
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 腿
    { when: satNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: satNot('sit'), items: [['shoeL', 'root', 'slipper'], ['shoeR', 'root', 'slipper']], sh: 'mid' },
    { when: satNot('sit'), items: [['slipHeartL', 'root', 'slipperHeart'], ['slipHeartR', 'root', 'slipperHeart']], gr: false },
    { when: satIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'slipper'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'slipper']], sh: 'mid' },
    { when: satIs('sit'), items: [['sitHeart', 'shinL', 'slipperHeart'], ['sitHeart', 'shinR', 'slipperHeart']], gr: false },
    // 裙子：玫粉钟形，褶、下摆深边、一圈小花
    { items: [['skirt', 'skirt', 'skirt']], sh: 'big' },
    { items: [['folds', 'skirt', 'skirtFold', false]], gr: false },
    { items: [['hemBand', 'skirt', 'hem']], gr: false },
    { items: [['flowers', 'skirt', 'flower', false]], gr: false },
    { items: [['flowerC', 'skirt', 'flowerC', false]], gr: false },
    // 上身：浅蓝短上衣、荷叶领、心形纽扣
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'top']], sh: 'mid' },
    { items: [['shirtFolds', 'ug', 'topFold', false]], gr: false },
    { items: [['collarL', 'ug', 'frill'], ['collarR', 'ug', 'frill']], sh: 'tiny' },
    { items: [['buttons', 'ug', 'button']], sh: 'tiny', gr: false },
    // 两只袖子（连袖口）都在第三只眼后面；不按东西的手跟着袖子
    SAT_SLEEVES,
    satHands(A => A.flag !== 'late'),
    // 软管（压在袖口上、头那一头被头发盖住），读心光晕，第三只眼
    { call: satTubes },
    { call: satGlow },
    { call: satEye3 },
    // 脸、前发、发带（绕过头顶，两端压在鬓发下）、鬓发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['tufts', 'head', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { items: [['hairHi', 'bangs', 'hairHi', false]], gr: false, al: .8 },
    { items: [['band', 'band', 'band']], sh: 'tiny' },
    { items: [['bandHi', 'band', 'bandHi', false]], gr: false },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair']], sh: 'mid' },
    { items: [['bandHeart', 'band', 'heart']], sh: 'tiny', gr: false },
    { items: [['bandHeartHi', 'band', 'white', false]], gr: false, al: .7 },
    { call: 'brows' },
    // 按胸口、托下巴的那只手：只有手压在第三只眼和脸外面，袖子留在后面
    satHands(A => A.flag === 'late'),
    // 表情道具
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip, eye3: rApply(B.eye3, [0, 0]) };
  },
};

function drawSatori(c, o = {}) { return drawRig(c, SAT_RIG, o); }
