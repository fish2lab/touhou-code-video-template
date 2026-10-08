'use strict';
// 魂魄妖梦 —— 剪纸人偶的部件表（第三版：Q 版约 2.4 头身、分层眼睛、深色描边，比例照帕秋莉，规格见 docs/rig.md「统一比例」）。
// 白玉楼的庭师兼剑术指导：银白齐下巴短发、黑发带（头顶左侧一个小黑蝴蝶结）、白衬衫 + 绿背心 + 黑领结、绿裙、白袜黑圆鞋；
// 背上斜背长刀「楼观剑」（绿鞘），左腰挂短刀「白楼剑」（黑鞘），身边飘着半灵（白色半透明的大蝌蚪）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawYoumu(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], sword:[x,y], phantom:[x,y] }
//   x, y     脚底中心；sit：坐着的那条线上臀部中心（和帕秋莉一样，样张里抬高 100）
//   h        缩放基准，默认 500（设计高 520；全员同一缩放，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像，半灵和刀一起翻）
//   pose     stand 后手按着腰间白楼剑的刀柄、前手垂下（默认）| draw 前手拔出楼观剑、刀身朝前上方举起，后手仍按短刀柄
//            guard 双手握楼观剑斜举在身前（前手靠刀镡、后手握柄尾）| bow 鞠躬：上身压低、低头，双手垂在身侧
//            point 一手指向前方（gesture 伸多远）| sit 坐着、两腿垂下轻晃、双手放在膝上 | flustered 双手举起乱挥
//            旧名兼容：lecture/present/reach→point、hold/lift/cheer/kungfu→guard、hide/startle/panic→flustered、slump/tired→bow、
//            其余（cross/proud/think/read/peek/lie/fly/walk/run/parasol/doze…）→stand
//   mood     normal 认真：眼睛睁开、眉略压、嘴抿平（默认）| smile 眯眼微笑 | determined 皱眉、眼睑压低、嘴抿紧
//            surprised 眼圆、嘴 o | flustered 脸红冒汗、嘴抖 | sad 眉梢下垂、眼往下看、嘴角向下 | pout 鼓脸、侧脸、嘴撅
//            旧名兼容：happy/smug/smirk→smile、proud/angry→determined、annoyed→pout、confused→surprised、panic/awkward→flustered、cry→sad、calm/sleepy/yawn→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   返回值：head 脸中心，hands 两只手（按屏幕 x 从左到右），tip 前手，sword 楼观剑的刀尖（入鞘时是背上刀鞘的鞘尾），phantom 半灵的头（圆团中心）
//
// 设计坐标：照帕秋莉的做法，身子部件按「身子坐标」画（脖子 -212、肩 ±28、腰 -180），root 骨头整体乘 YMU_BODY = 1.17，脖子落在 -248；
// 头部件用「头坐标」（原点在脖子关节，下巴 (0,-4)，头顶 -150），头骨头再乘 YMU_HEAD，合起来 1.2 倍。
// 刀用「刀坐标」：原点在刀镡中心，刀身（刀鞘）朝 -y，刀柄朝 +y；拿刀的手按 docs/rig.md：手臂在刀柄后面，握刀的手最后压上去。
// 本文件顶层名字都带 ymu / YMU 前缀。

// ===================== 颜色（压暗、低饱和；银发、绿衣、黑发带要看得出来） =====================
const YMU_K = (() => {
  const hair = '#e4e5ea', hairBack = '#b4b8c6', eye = '#5d7ea6', green = '#4f8152', black = '#27242c', white = '#f7f3ee';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .35),
    skin: P.skin, blush: P.blush, sock: '#f3eff0', shoe: '#2f2b35', shoeHi: '#4a4552',
    // 眼睛分层（第三版）：蓝灰虹膜、下半亮色、深瞳孔、上沿阴影；粗眼线深灰
    eye, sclera: '#fbf8f3', irisLt: mix(eye, '#d9ecfa', .55), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .8), .45),
    lid: '#2c2733', lash: '#2c2733', brow: mix(hairBack, P.ink, .68),
    mouth: mix(hairBack, P.ink, .7), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    shirt: '#f4f1ee', shirtFold: mix('#f4f1ee', '#7f8a96', .3),
    vest: green, vestDeep: mix(green, P.ink, .35), skirt: mix(green, '#9cc890', .3), skirtFold: mix(green, P.ink, .28), skirtHem: mix(green, P.ink, .45),
    band: black, bandHi: '#4a4553', bowTie: black,
    // 刀：银刀身、刀刃亮线、刀背暗线、金色刀铐（habaki）、铁色刀镡、黑柄配白菱纹；楼观剑绿鞘、白楼剑黑鞘
    blade: '#cdd5de', bladeHi: '#f6f9fc', bladeBack: '#98a3b0', habaki: mix(P.gold, '#b9892f', .3),
    tsuba: '#3a3742', tsubaHi: '#77727f', hilt: '#2a2730', hiltDia: '#d6dae0', kashira: '#4b4655',
    sayaL: mix(green, P.ink, .2), sayaS: '#2c2932', sayaBand: black, sayaBandS: mix(green, P.ink, .1),
    // 半灵：带一点蓝的白
    ghost: '#e6edf4', white, sweat: mix(P.ribbonBlue, P.cap, .62),
  };
})();
const YMU_CUT = rigCutter(10000);
// 身子坐标：脖子 -212、腰 -180；root 乘 YMU_BODY（脖子落在 -248），头再乘 YMU_HEAD（合起来 1.2）；坐下时上身下移 YMU_UP（×1.17 ≈ 100）
const YMU_BODY = 1.17, YMU_NECK = -212, YMU_WAIST = -180, YMU_HEAD = 1.2 / YMU_BODY, YMU_UP = 86, YMU_SH = [28, -200], YMU_L1 = 36, YMU_L2 = 36;
// 刀的尺寸（刀坐标）：楼观剑刀身 122、鞘 126、柄 30；白楼剑鞘 62、柄 18
const YMU_LONG = { blade: 122, saya: 126, hilt: 30 }, YMU_SHORT_LEN = { saya: 62, hilt: 18 };
// 白楼剑挂在左腰（屏幕左侧、后手那边）：刀镡位置、转角（刀柄朝左上、刀鞘朝右下横过裙前）
const YMU_SHORT = { at: [-24, -150], rot: 2.5 };
// 楼观剑入鞘时斜背在背上：刀镡在右肩外（前手那边），刀柄朝右上伸出，刀鞘朝左下藏在身后
const YMU_BACK = { at: [74, -204], rot: -2.24 };

// ===================== 部件（载入时剪好） =====================
// 手：Q 版手比 RIG_SHAPES 的胖一圈（宽 ×1.4），指尖点不变（同八云紫）
const ymuHandPts = pts => pts.map(([x, y]) => [x * 1.4, y]);
// 刀的部件（刀坐标）：w 宽度倍数。刀身和刀鞘略带弧（朝刀背 -x 弯）
function ymuSwordParts(cut, seed, L, Ls, H, w) {
  const out = {}, curve = u => -4 * w * u * u;
  if (L) {
    const N = 12, left = [], right = [], y0 = -8, y1 = -L + 12 * w, hw = 3 * w;
    for (let i = 0; i <= N; i++) { const u = i / N, y = lerp(y0, y1, u), cx = curve(u * (y1 - y0) / (-L - y0)); left.push([cx - hw, y]); right.unshift([cx + hw, y]); }
    const cE = curve(1);
    out.blade = cut([...left, [cE - hw * .9, -L], [cE + hw * .2, -L + 4 * w], [cE + hw, -L + 12 * w], ...right], seed, 6, .12, false);
    const hi = [], hiB = [], bk = [], bkB = [];
    for (let i = 0; i <= N; i++) { const u = i / N, y = lerp(y0 - 2, y1, u), cx = curve(u * (y1 - y0) / (-L - y0)); hi.push([cx + hw * .25, y]); hiB.unshift([cx + hw * .85, y]); bk.push([cx - hw, y]); bkB.unshift([cx - hw * .55, y]); }
    out.bladeHi = cut([...hi, [cE + hw * .3, -L + 6 * w], ...hiB], seed + 1, 6, .08, false);
    out.bladeBack = cut([...bk, [cE - hw * .85, -L + 3], ...bkB], seed + 2, 6, .08, false);
    out.habaki = cut([[-3.8 * w, -2], [3.8 * w, -2], [3.5 * w, -9], [-3.5 * w, -9]], seed + 3, 4, .1, false);
  }
  // 刀鞘：上口一道黑箍（鲤口），鞘尾一截黑头（鐺）
  const N = 12, sl = [], sr = [], sw = u => (4.6 - .6 * u) * w;
  for (let i = 0; i <= N; i++) { const u = i / N, y = lerp(-3, -Ls + 4, u), cx = curve(u); sl.push([cx - sw(u), y]); sr.unshift([cx + sw(u), y]); }
  const cS = curve(1);
  out.saya = cut([...sl, [cS - sw(1) * .7, -Ls + 1], [cS, -Ls], [cS + sw(1) * .7, -Ls + 1], ...sr], seed + 4, 6, .2, false);
  out.sayaMouth = cut([[-4.9 * w, -3], [4.9 * w, -3], [4.8 * w, -10], [-4.8 * w, -10]], seed + 5, 4, .1, false);
  const ty = -Ls + 10, c1 = curve(1);
  out.sayaEnd = cut([[c1 - 4.2 * w, ty], [c1 + 4.2 * w, ty], [c1 + 4 * w, -Ls + 2], [c1, -Ls - .6], [c1 - 4 * w, -Ls + 2]], seed + 6, 4, .1, false);
  // 刀镡：圆形（略压扁，看得出是一片圆铁），中间一圈亮环
  out.tsuba = cut(ellPts(0, 0, 9.5 * w, 4.6 * w, 18), seed + 7, 4, .15, false);
  out.tsubaHi = cut(ellPts(0, -.6 * w, 6 * w, 2.4 * w, 14), seed + 8, 3, .1, false);
  // 刀柄：黑色缠绳 + 一列白菱纹，柄头（头金）
  out.hilt = cut([[-3.4 * w, 3], [3.4 * w, 3], [3.1 * w, H], [-3.1 * w, H]], seed + 9, 5, .12, false);
  out.dia = []; for (let y = 7; y < H - 2; y += 5.6) out.dia.push(cut([[0, y - 2.3], [2.1 * w, y], [0, y + 2.3], [-2.1 * w, y]], seed + 10 + out.dia.length, 2, .05, false));
  out.kashira = cut([[-3.7 * w, H - .5], [3.7 * w, H - .5], [3.3 * w, H + 3.5], [-3.3 * w, H + 3.5]], seed + 30, 3, .1, false);
  return out;
}
// 半灵：圆头 + 往上飘起、末端往外卷的尾巴（原点在圆头中心，半径 R，尾长 L）
function ymuPhantomPts(R, L) {
  const N = 16, th = u => -.15 - .8 * u - .7 * u * u * u, c = [[0, 0]];
  for (let i = 1; i <= N; i++) { const u = (i - .5) / N, a = th(u), [px, py] = c[i - 1]; c.push([px + Math.sin(a) * L / N, py - Math.cos(a) * L / N]); }
  const hw = u => R * Math.pow(1 - u, 1.25) * (1 + .12 * Math.sin(u * Math.PI)), left = [], right = [];
  for (let i = 0; i <= N; i++) { const u = i / N, a = th(u), n = [Math.cos(a), Math.sin(a)], w = hw(u); left.push([c[i][0] + n[0] * w, c[i][1] + n[1] * w]); right.unshift([c[i][0] - n[0] * w, c[i][1] - n[1] * w]); }
  const a0 = th(0), arc = []; for (let k = 1; k < 14; k++) { const a = a0 + Math.PI - k / 14 * Math.PI; arc.push([R * Math.cos(a), R * Math.sin(a)]); }
  return [...left, ...right.slice(1), ...arc];
}
const YMU_G = (() => {
  const cut = YMU_CUT, g = {};
  // ---- 半灵 ----
  g.phantom = cut(ymuPhantomPts(24, 70), 1, 6, .5);
  g.phantomHi = cut(ellPts(-6, -7, 10.5, 8.5, 16), 2, 4, .3);
  // ---- 刀：楼观剑（长）、白楼剑（短，窄一点） ----
  g.lng = ymuSwordParts(cut, 400, YMU_LONG.blade, YMU_LONG.saya, YMU_LONG.hilt, 1);
  g.sht = ymuSwordParts(cut, 450, 0, YMU_SHORT_LEN.saya, YMU_SHORT_LEN.hilt, .85);
  // ---- 腿（站姿，脚底为原点，身子坐标）：一截白袜 + 黑圆鞋（同八云紫的脚） ----
  g.legL = cut([[-20, -56], [-8, -56], [-8.5, -12], [-19.5, -12]], 10, 6, .3, false); g.legR = cut([[8, -56], [20, -56], [19.5, -12], [8.5, -12]], 11, 6, .3, false);
  g.shoeL = cut(ellPts(-14, -9, 15, 9.5, 18), 12, 5, .4); g.shoeR = cut(ellPts(15, -9, 15, 9.5, 18), 13, 5, .4);
  g.shoeHiL = cut(ellPts(-18, -13, 6, 2.6, 10), 14, 3, .1, false); g.shoeHiR = cut(ellPts(11, -13, 6, 2.6, 10), 15, 3, .1, false);
  // 坐姿的小腿（膝盖为原点，垂下）+ 鞋
  g.shin = cut([[-5.5, -4], [5.5, -4], [5.5, 18], [4.8, 30], [-4.8, 30], [-5.5, 18]], 16, 8, .4);
  g.sitShoe = cut(ellPts(3, 33, 12.5, 8, 16), 17, 5, .4);
  // ---- 绿裙（腰 -182 到裙摆 -50）：钟形，下摆一排浅褶，底边一道深绿 ----
  const skR = rOpen([[27, -183], [32, -165], [39, -140], [49, -110], [60, -78], [68, -52]], 4);
  g.skirt = cut([...rMirror(skR), ...skR, ...rScallop(rLine([69, -50], [-69, -50]), 9, 2.6)], 20, 8, .5, false);
  g.skirtHem = cut([...rOpen([[-66, -60], [0, -58.5], [66, -60]], 6), [68, -54], ...rScallop(rLine([68.6, -51], [-68.6, -51]), 9, 2.4), [-68, -54]], 21, 5, .3, false);
  g.folds = [-.72, -.36, 0, .36, .72].map((u, i) => { const xt = u * 22, xb = u * 62; return cut([[xt - .8, -176], [xt + .8, -176], [xb + 1.4, -54], [xb - 1.4, -54]], 22 + i, 12, .4, false); });
  // ---- 上身：白衬衫、绿背心（前面 V 口露出衬衫）、白领尖、黑领结 ----
  g.shirt = cut([[-13, -217], [13, -217], [24, -211], [29, -199], [28, -186], [26, -177], [-26, -177], [-28, -186], [-29, -199], [-24, -211]], 30, 8, .5);
  g.neck = cut([[-7, -224], [7, -224], [8, -207], [-8, -207]], 31, 8, .3, false);
  g.vest = cut([[-21, -212], [-8, -214], [0, -190], [8, -214], [21, -212], [27, -204], [29.5, -194], [28.5, -184], [27.5, -173], [12, -171], [0, -166], [-12, -171], [-27.5, -173], [-28.5, -184], [-29.5, -194], [-27, -204]], 32, 7, .4);
  g.vestLine = cut([[-.7, -190], [.7, -190], [.6, -167], [-.6, -167]], 33, 6, .1, false);
  g.buttons = [-184, -176].map((y, i) => cut(ellPts(-3.6, y, 1.7, 1.7, 8), 34 + i, 2, .05, false));
  const col = [[1, -216], [11, -218.5], [8.5, -207], [2, -210]];
  g.collar = [cut(col, 36, 4, .15, false), cut(rMirror(col), 37, 4, .15, false)];
  g.bowTie = cut(RIG_SHAPES.ribbon.map(([x, y]) => [x * .78, y * .78]), 38, 3, .2, false);
  g.bowKnot = cut(ellPts(0, 0, 2.2, 2.5, 8), 39, 2, .1, false);
  // ---- 手臂（身子坐标，上臂 36、前臂 36）：光着的胳膊（上臂、前臂，肩/肘为原点）+ 白泡泡短袖 + 袖口一道浅灰边 + 手（腕为原点，左手镜像） ----
  g.armU = cut([[-7, 6], [7, 6], [7.3, 22], [6.9, 37], [0, 41], [-6.9, 37], [-7.3, 22]], 80, 8, .3);
  g.fore = cut([[-6.6, -2], [-4.6, -6], [0, -7], [4.6, -6], [6.6, -2], [6.6, 14], [5.8, 30], [5.2, 37], [-5.2, 37], [-5.8, 30], [-6.6, 14]], 81, 7, .3);
  g.puff = cut(RIG_SHAPES.puff.map(([x, y]) => [x * 1.18, y * 1.1]), 82, 7, .5);
  g.cuff = cut(RIG_SHAPES.cuff.map(([x, y]) => [x * 1.18, y * 1.07 + .6]), 83, 5, .3, false);
  const H = RIG_SHAPES.hand;
  g.handOpen = cut(ymuHandPts(H.open), 84, 3, .2, false); g.handFist = cut(ellPts(0, 5.8, 7.6, 7.4, 14), 85, 3, .25);
  g.handPoint = cut(ymuHandPts(H.point), 86, 3, .2, false); g.handGrip = cut(ymuHandPts(H.grip), 87, 3, .2, false);
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150） ----
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 120, 7, .5);
  // 后发：齐下巴的 bob，两侧比脸宽一圈、到下巴处略往里收，发梢一排小尖
  const bSide = rOpen([[0, -160], [44, -155], [68, -138], [81, -112], [86, -86], [84, -54], [79, -28], [72, -10]], 5);
  const bTips = [[66, 2], [58, -7], [50, 3], [40, -6], [28, 2], [14, -6], [0, 0]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 121, 8, .7, false);
  // 鬓发：从太阳穴垂到下巴，发梢尖，压在两颊外缘
  const lockR = [...rOpen([[46, -134], [63, -124], [72, -98], [74, -66], [72, -36]], 4), [71, -6], [64, -26], [59, -10], [55, -34], ...rOpen([[56, -62], [56, -92], [49, -122]], 4)];
  g.lockR = cut(lockR, 122, 6, .5, false); g.lockL = cut(rMirror(lockR), 123, 6, .5, false);
  // 刘海连头顶：上沿是头发的圆顶（盖住整个头顶），两侧顺着头往下，下缘一排尖刚好压到眼睛上沿
  const domeR = rOpen([[0, -171], [34, -167], [60, -153], [76, -131], [82, -108]], 4);
  const fringe = [[78, -94], [67, -86], [60, -100], [53, -77], [44, -96], [34, -79], [24, -97], [14, -80], [5, -96], [-5, -79], [-15, -95], [-25, -78], [-35, -94], [-45, -77], [-54, -98], [-62, -84], [-70, -100], [-78, -94]];
  g.bangs = cut([...rMirror(domeR), ...domeR.slice(1), ...fringe], 124, 6, .5, false);
  g.bangLines = [[34, -79, 32, -112], [5, -96, 4, -124], [-25, -78, -27, -114], [53, -77, 53, -106], [-45, -77, -48, -106]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 125 + i, 8, .2, false));
  // 黑发带：贴着头顶绕一圈的带子，正面看是一道拱（两端顺着头往下，裁在头发轮廓里，看起来绕到了头后面）
  const bandC = []; for (let k = 0; k <= 24; k++) { const a = Math.PI * (1.03 + .94 * k / 24); bandC.push([86 * Math.cos(a), -98 + 64 * Math.sin(a)]); }
  g.band = cut(rStroke(bandC, u => 8.6 - 1.2 * Math.abs(2 * u - 1)), 130, 6, .2, false);
  const bandHi = bandC.slice(5, 20).map(([x, y]) => [x * .985, y - 2.2]);
  g.bandHi = cut(rStroke(bandHi, 1.4), 131, 6, .1, false);
  // 发带上的小黑蝴蝶结（头顶左侧）
  g.hbBow = cut(RIG_SHAPES.bow.map(([x, y]) => [x * 1.75, y * 1.6]), 132, 3, .3, false);
  g.hbKnot = cut(ellPts(0, 0, 3.8, 4.4, 10), 133, 2, .1, false);
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat.map(([x, y]) => [x * 1.3, y * 1.3]), 140, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// lid 眼睑压下的比例，lidTilt 眼睑外端下垂（负：外端上挑），lower 下眼睑托起，es 眼睛大小，iris 虹膜大小，brow [上移, 内端下压角]，chin 下巴抬（负）
// 妖梦的眼神：认真、直视，眼睑外端略上挑
const YMU_MOODS = {
  normal: { eye: 'open', lid: .14, lidTilt: -.05, es: 1, brow: [1, .1], mouth: 'flat', blush: .9 },
  smile: { eye: 'open', lid: .12, lidTilt: -.02, lower: 5, es: 1, brow: [3, -.1], mouth: 'smile', blush: 1.2 },
  determined: { eye: 'open', lid: .32, lidTilt: -.12, es: 1, iris: .92, brow: [-2, .4], mouth: 'pout', blush: .9, chin: -.03 },
  surprised: { eye: 'open', lid: 0, es: 1.12, iris: .8, brow: [7, -.12], mouth: 'o', blush: 1 },
  flustered: { eye: 'open', lid: .04, es: 1.08, iris: .88, brow: [3, -.28], mouth: 'wobble', blush: 1.75, sweat: true },
  sad: { eye: 'open', lid: .4, lidTilt: .1, es: .98, brow: [2, -.4], mouth: 'pout', blush: .9, lookY: 1.6, chin: .04 },
  pout: { eye: 'open', lid: .28, lidTilt: -.06, es: .98, brow: [-1, .32], mouth: 'pout', blush: 1.45, puff: true, turn: -.45, look: 1 },
};
const YMU_MOOD_ALIAS = { happy: 'smile', smug: 'smile', smirk: 'smile', proud: 'determined', angry: 'determined', annoyed: 'pout', confused: 'surprised', panic: 'flustered', awkward: 'flustered', cry: 'sad', calm: 'normal', sleepy: 'normal', yawn: 'normal' };
const YMU_POSE_ALIAS = { lecture: 'point', present: 'point', reach: 'point', hold: 'guard', lift: 'guard', cheer: 'guard', kungfu: 'guard', hide: 'flustered', startle: 'flustered', panic: 'flustered', slump: 'bow', tired: 'bow',
  cross: 'stand', proud: 'stand', think: 'stand', read: 'stand', peek: 'stand', lie: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand', doze: 'stand' };
// 嘴：o 用琪露诺的，其余用帕秋莉的（颜色换成自己的）；Q 版脸大，嘴放大 1.3 倍
const YMU_CIR_MOUTHS = new Set(['laugh', 'grin', 'o']);
const ymuScale = pts => pts && pts.map(([x, y]) => [x * 1.3, y * 1.3]);
function ymuMouthPts(type, open) {
  const [pts, col, tg] = (YMU_CIR_MOUTHS.has(type) ? cirMouthPts : pchMouthPts)(type, open);
  return [ymuScale(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', ymuScale(tg)];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：a 上臂从下垂往 +x（屏幕上朝 facing 那边）摆的角，b 前臂再摆的角；标记 grip：这只手握着刀柄（手最后画在刀柄上）
// long：楼观剑拿在手里 { at 刀镡位置, rot 转角 }（上身坐标；rot 0 刀尖朝上、正值朝前倾）；不给就是入鞘背在背上
// up 上身下移（坐），sink 头往下沉，bend 上身压扁（鞠躬），lean 身子前倾，hr 头额外转角，turn 脸侧开
// 两节手臂的反解：肩到腕 (tx, ty)，bend +1 / -1 选肘弯向哪一边 → [a, b]
function ymuIK(sd, tx, ty, bend = sd) {
  const sx = sd * YMU_SH[0], sy = YMU_SH[1], L1 = YMU_L1, L2 = YMU_L2, vx = tx - sx, vy = ty - sy, d = clamp(Math.hypot(vx, vy), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(vx, vy) + bend * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ex = sx + L1 * Math.sin(a), ey = sy + L1 * Math.cos(a);
  return [a, Math.atan2(tx - ex, ty - ey) - a];
}
// 握刀：刀柄上 gy 处（刀坐标）是手心，手腕再往前臂方向退 6
const ymuSwordPt = (S, gy) => [S.at[0] - gy * Math.sin(S.rot), S.at[1] + gy * Math.cos(S.rot)];
function ymuGrip(sd, S, gy, bend = sd) {
  const [gx, gyy] = ymuSwordPt(S, gy); let tx = gx, ty = gyy, ab = [0, 0];
  for (let i = 0; i < 3; i++) { ab = ymuIK(sd, tx, ty, bend); const f = ab[0] + ab[1]; tx = gx - 6 * Math.sin(f); ty = gyy - 6 * Math.cos(f); }
  return ab;
}
function ymuPose(pose, g, tt) {
  const hilt = [...ymuGrip(-1, YMU_SHORT, 10), 'grip', 'grip'], hangF = [.12, -.06 + .03 * Math.sin(tt * 1.3), 'open', false];
  switch (pose) {
    case 'draw': { const S = { at: [86, -200], rot: .35 + .02 * Math.sin(tt * 1.4) };
      return { back: hilt, front: [...ymuGrip(1, S, 9, -1), 'grip', 'grip'], long: S, hr: .03, turn: .3, look: .7, lean: .02 }; }
    case 'guard': { const S = { at: [30, -168], rot: .95 + .015 * Math.sin(tt * 1.6) };
      return { back: [...ymuGrip(-1, S, 24, -1), 'grip', 'grip'], front: [...ymuGrip(1, S, 8, 1), 'grip', 'grip'], long: S, hr: .02, turn: .25, look: .7, lean: .01 }; }
    case 'bow': return { back: [-.16, .05, 'open', false], front: [.16, -.05, 'open', false], bend: .88, sink: 18, hr: 0, turn: 0, look: 0, lookY: 3 };
    case 'point': return { back: [-.22, .1, 'open', false], front: [lerp(1.3, 1.85, g), lerp(.25, -.05, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.03, turn: .3, look: .6, lean: .03 * g };
    case 'sit': return { back: [-.3, .62, 'open', false], front: [.3, -.62, 'open', false], up: YMU_UP, turn: .15, look: .2, hr: .05 };
    case 'flustered': { const w = tt * 11;
      return { back: [-1.95 - .22 * Math.sin(w), -.35 - .4 * Math.sin(w + 1.2), 'open', false], front: [1.95 + .22 * Math.sin(w + 2.1), .35 + .4 * Math.sin(w + 3.3), 'open', false], shrug: 3, hr: .05 * Math.sin(tt * 6), turn: 0, look: 0 }; }
    default: return { back: hilt, front: hangF, hr: .03, turn: .14, look: .25 };
  }
}

// ===================== 部件表 =====================
const ymuIs = (...ps) => k => ps.includes(k.pose), ymuNot = (...ps) => k => !ps.includes(k.pose);
// 手臂：握刀的手不跟胳膊一层（刀柄画完再压上去）
const ymuHandPart = (k, A) => A.flag === 'grip' ? null : k.S.arm.hands[A.hand] ? k.G[k.S.arm.hands[A.hand]] : null;
// 一把刀的图层：parts 部件组，bone 骨头，withBlade 画刀身，sheathed 画刀鞘，withHilt 画刀镡和刀柄
function ymuSwordLayers(set, bone, sayaCol, bandCol, opt) {
  const p = k => k.G[set], L = [];
  if (opt.saya) L.push({ when: opt.saya, items: [[k => p(k).saya, bone, sayaCol]], sh: 'mid' },
    { when: opt.saya, items: [[k => p(k).sayaMouth, bone, bandCol, false], [k => p(k).sayaEnd, bone, bandCol, false]], gr: false });
  if (opt.blade) L.push({ when: opt.blade, items: [[k => p(k).blade, bone, 'blade']], sh: 'mid', gr: false },
    { when: opt.blade, items: [[k => p(k).bladeBack, bone, 'bladeBack', false], [k => p(k).bladeHi, bone, 'bladeHi', false], [k => p(k).habaki, bone, 'habaki']], gr: false });
  if (opt.hilt) L.push({ when: opt.hilt, items: [[k => p(k).hilt, bone, 'hilt'], [k => p(k).kashira, bone, 'kashira']], sh: 'tiny', gr: false },
    { when: opt.hilt, items: [[k => p(k).dia, bone, 'hiltDia', false]], gr: false },
    { when: opt.hilt, items: [[k => p(k).tsuba, bone, 'tsuba']], sh: 'tiny', gr: false },
    { when: opt.hilt, items: [[k => p(k).tsubaHi, bone, 'tsubaHi', false]], gr: false });
  return L;
}
// 发带：裁在刘海（连头顶）的轮廓里画，两端顺着头的轮廓收掉
function ymuBand(k) {
  const c = k.c, M = k.B.bangs, T = c.getTransform();
  c.save(); c.transform(M[0], M[1], M[2], M[3], M[4], M[5]); c.clip(YMU_G.bangs); c.setTransform(T);
  k.paint([{ p: YMU_G.band, m: M, col: k.K.band }], RIG_SH.tiny, false);
  k.paint([{ p: YMU_G.bandHi, m: M, col: k.K.bandHi, edge: false }], null, false);
  c.restore();
}
const ymuLong = k => !!k.ps.long, ymuSheathed = k => !k.ps.long, ymuAlways = () => true;
// 坐下时裙子绕腰压扁一点、放宽一点
const YMU_SIT_SKIRT = (() => { const sx = 1.08, sy = .8; return [sx, 0, 0, sy, 0, YMU_WAIST * (1 - sy)]; })();
const YMU_RIG = {
  name: 'youmu', h: 500, height: 520, K: YMU_K, G: YMU_G, cut: YMU_CUT,
  moods: YMU_MOODS, moodAlias: YMU_MOOD_ALIAS, poseAlias: YMU_POSE_ALIAS, pose: ymuPose, mouth: ymuMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, .9, 1],
  // 五官（头坐标，和帕秋莉同一套：眼睛 (±28,-54)、rx 13 ry 16，乘 1.2 后落到规格的位置）
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 150, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: YMU_SH, upper: YMU_L1, fore: YMU_L2, mirrorHand: true, tips: RIG_SHAPES.handTip,
    hands: { open: 'handOpen', fist: 'handFist', point: 'handPoint', grip: 'handGrip' } },
  vars(k) {
    const { ps, tt } = k;
    k.sway = .008 * Math.sin(tt * 1.1) + .003 * Math.sin(tt * 2.5);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, YMU_WAIST, k.lean), 0, -k.breath);
    if (ps.bend) k.ugL = rMul(k.ugL, [1, 0, 0, ps.bend, 0, YMU_WAIST * (1 - ps.bend)]);   // 鞠躬：上身绕腰压扁
  },
  bones: [
    { name: 'root', rot: k => k.sway, scale: [YMU_BODY, YMU_BODY] },
    { name: 'body', parent: 'root', at: k => [0, k.ps.up || 0] },
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, YMU_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [YMU_HEAD, YMU_HEAD] },
    { name: 'skirt', parent: 'body', local: k => k.ps.up ? YMU_SIT_SKIRT : null, pivot: [0, YMU_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'shin', sides: true, when: ymuIs('sit'), parent: 'root', at: (k, sd) => [sd * 15, 8], rot: (k, sd) => .18 * Math.sin(k.tt * 2.2 + (sd > 0 ? 0 : 1.9)) + .07 * sd },
    // 半灵：飘在左上方（头的外侧），上下浮动、尾巴慢慢摆；挂弹簧（o.track）时跟着身子的移动甩一下
    { name: 'phantom', parent: 'body', at: k => [-106, -270 + 7 * Math.sin(k.tt * 1.3)], rot: k => .08 * Math.sin(k.tt * .9 + .6), spring: { len: 70, gain: .7, f: 1.1, zeta: .25, max: .35 } },
    { name: 'phantomGlow', parent: 'phantom', scale: [1.16, 1.16] },
    // 楼观剑的鞘（背上）、白楼剑（左腰）
    { name: 'backSaya', parent: 'ug', at: YMU_BACK.at, rot: YMU_BACK.rot },
    { name: 'shortSword', parent: 'ug', at: YMU_SHORT.at, rot: YMU_SHORT.rot },
    { name: 'bowTieM', parent: 'ug', at: [0, -210] },
    { arms: true },
    // 拔出来的楼观剑：刀镡位置和转角由姿势给（上身坐标），握刀的手腕是照着刀柄反解出来的
    { name: 'longSword', when: ymuLong, parent: 'ug', at: k => k.ps.long.at, rot: k => k.ps.long.rot },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 54, -122], rot: k => -k.hr * .5, sway: (k, sd) => [.015, 1.5, sd], spring: { len: 80, gain: .6, f: 2.3, max: .25 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'hbBow', parent: 'bangs', at: [-47, -152], rot: -.5, sway: [.04, 2, .3], spring: { len: 14, gain: .5, f: 3, max: .4 } },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [66, -110 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 半灵（最后面）：外圈一层淡淡的光晕，再是半透明的本体和左上一块亮斑
    { items: [['phantom', 'phantomGlow', 'white', false]], gr: false, al: .3 },
    { items: [['phantom', 'phantom', 'ghost']], sh: 'mid', gr: false, al: .86 },
    { items: [['phantomHi', 'phantom', 'white', false]], gr: false, al: .75 },
    // 楼观剑：鞘一直背在背上；入鞘时刀柄从左肩外伸出来
    ...ymuSwordLayers('lng', 'backSaya', 'sayaL', 'sayaBand', { saya: ymuAlways, hilt: ymuSheathed }),
    // 后发
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 腿
    { when: ymuNot('sit'), items: [['legL', 'root', 'sock'], ['legR', 'root', 'sock']], sh: 'tiny' },
    { when: ymuNot('sit'), items: [['shoeL', 'root', 'shoe'], ['shoeR', 'root', 'shoe']], sh: 'mid' },
    { when: ymuNot('sit'), items: [['shoeHiL', 'root', 'shoeHi', false], ['shoeHiR', 'root', 'shoeHi', false]], gr: false },
    { when: ymuIs('sit'), items: [['shin', 'shinL', 'sock'], ['sitShoe', 'shinL', 'shoe'], ['shin', 'shinR', 'sock'], ['sitShoe', 'shinR', 'shoe']], sh: 'mid' },
    // 绿裙
    { items: [['skirt', 'skirt', 'skirt']], sh: 'big' },
    { items: [['skirtHem', 'skirt', 'skirtHem', false], ['folds', 'skirt', 'skirtFold', false]], gr: false },
    // 上身：衬衫、背心、领尖、领结
    { items: [['neck', 'ug', 'skin', false], ['shirt', 'ug', 'shirt']], sh: 'mid' },
    { items: [['vest', 'ug', 'vest']], sh: 'mid' },
    { items: [['vestLine', 'ug', 'vestDeep', false], ['buttons', 'ug', 'vestDeep', false]], gr: false },
    { items: [['collar', 'ug', 'shirt']], sh: 'tiny', gr: false },
    { items: [['bowTie', 'bowTieM', 'bowTie']], sh: 'tiny', gr: false },
    { items: [['bowKnot', 'bowTieM', 'bandHi', false]], gr: false },
    // 手臂（握刀的手除外）：手、前臂、上臂，再盖泡泡袖和袖口
    { arms: 'all', order: 'arm', items: [[ymuHandPart, 'hm', 'skin'], ['armU', 'uD', 'skin', false], ['fore', 'lD', 'skin', false]], sh: 'mid' },
    { arms: 'all', items: [['puff', 'u', 'shirt']], sh: 'mid' },
    { arms: 'all', items: [['cuff', 'u', 'shirtFold']], gr: false },
    // 白楼剑（压在胳膊前面：后手的前臂在刀柄后面）
    ...ymuSwordLayers('sht', 'shortSword', 'sayaS', 'sayaBandS', { saya: ymuAlways, hilt: ymuAlways }),
    // 拔出来的楼观剑
    ...ymuSwordLayers('lng', 'longSword', 'sayaL', 'sayaBand', { blade: ymuLong, hilt: ymuLong }),
    // 握刀的手指最后压在刀柄上
    { arms: A => A.flag === 'grip', items: [['handGrip', 'hm', 'skin']], sh: 'tiny' },
    // 脸、前发（鬓发、刘海连头顶）、眉毛、发带和蝴蝶结
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    { call: ymuBand },
    { items: [['hbBow', 'hbBow', 'band']], sh: 'tiny', gr: false },
    { items: [['hbKnot', 'hbBow', 'bandHi']], gr: false },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k;
    return { head: rApply(B.head, [0, -70]), hands: [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]), tip: AF.tip,
      sword: B.longSword ? rApply(B.longSword, [0, -YMU_LONG.blade]) : rApply(B.backSaya, [0, -YMU_LONG.saya]), phantom: rApply(B.phantom, [0, 0]) };
  },
};

function drawYoumu(c, o = {}) { return drawRig(c, YMU_RIG, o); }
