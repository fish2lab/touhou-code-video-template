'use strict';
// 八云蓝 —— 剪纸人偶的部件表（八云紫的式神、九尾狐）。画法全在 src/rig.js，本文件只有数据：
// 颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawRan(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], hold:[x,y] }
//   x, y     脚底中心
//   h        全身高（狐耳尖到脚底），默认 500（全员统一身高，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手拢在宽袖里在身前交叉（抱臂揣袖，默认）| read 双手把一张打印纸举到胸前看（hold 是纸的中心，纸画在手前面）
//            point 一手伸向前（gesture 伸多远），另一手揣袖 | present 一手把纸条递出（hold 是纸条中心）
//            think 手指点下巴、另一只袖子托着肘、尾巴垂下 | bow 微微低头拱手（两只袖子在胸前合拢）
//            旧名兼容：lecture/cheer→point、hold/lift→read、give/hand→present、hide/slump/tired→bow、cross/proud/sit/lie/peek/fly/walk/run→stand
//   mood     normal 冷静：眼睛半睁、嘴小（默认）| happy 眼睛眯成弧线、小笑 | surprised 眼圆、嘴 o
//            awkward 冷汗、眉斜、嘴抿成波浪 | proud 下巴抬、眼半闭、嘴角一挑
//            旧名兼容：smile→happy、flustered/panic/pout/cry/sad→awkward、smug→proud、confused→surprised、calm/annoyed/angry/sleepy→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   tails    0..1 九条尾巴翘起来的程度（默认 0.3；念纸条时翘一下）。think 姿势里尾巴固定垂下，不管 tails
//   返回值：head 脸中心，hands 两只手（袖口；按屏幕 x 从左到右），tip 前手（袖口/指尖），hold 纸或纸条的中心（没拿纸时是两手之间）
//
// 设计坐标：脚底 (0,0)，y 向下；骨架尺寸照抄蕾米莉亚（脖子 -262、腰 -204、肩 ±22 / -250、头 1.1 倍）；头部件用「头坐标」（原点在脖子关节）。
// 衣服：白色宽袖长袍 + 紫色立领内衬（领口一粒扣子）+ 蓝色长罩衫（白滚边、白色太极卷纹和回字纹、下摆两角绿流苏）+ 腰间紫布结 + 白色荷叶边裙摆 + 白靴；
// 帽子：白色方形软帽、顶上两只尖狐耳（耳内金黄）、帽前一块金黄纹样小布片、帽檐一圈荷叶褶；九条金黄蓬松的尾巴在身后扇形散开、尾尖米白。
// 本文件顶层名字都带 ran / RAN_ 前缀。

// ===================== 颜色（压暗、低饱和；蓝罩衫、紫领、金尾巴要明显） =====================
const RAN_K = (() => {
  const hair = '#e2c06b', hairBack = '#c3a04f', robe = '#e8e4dd', blue = '#5675a6', purple = '#8670b0', tail = '#e0ae4c', green = '#5aa088', cap = '#f0ece5', boot = '#e6e0d9';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    robe, fold: mix(robe, '#7d86a0', .3), frill: '#f4f0e9', petti: mix(robe, '#9a93a0', .25), robeIn: mix(robe, P.ink, .38),
    blue, blueDeep: mix(blue, P.ink, .3), trim: '#efebe3', pat: '#ebe8e0',
    purple, purpleDeep: mix(purple, P.ink, .28), purpleLite: mix(purple, '#ffffff', .22), button: '#e4d6f0',
    green, greenDeep: mix(green, P.ink, .38),
    tail, tailAlt: mix(tail, '#9b6a28', .2), tailDeep: mix(tail, '#8a5a22', .38), tailLight: mix(tail, '#fff2cf', .4), tailTip: '#f6efdd',
    cap, capFold: mix(cap, '#7d86a0', .24), earIn: '#e6bc5a', patch: '#d9ac4a', patchInk: '#8d6228',
    boot, bootSole: mix(boot, '#6c6670', .42),
    skin: P.skin, blush: P.blush, eye: '#c8952f', lid: '#2e2430', brow: mix(hairBack, P.ink, .45),
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
    paper: '#f2ecda', paperEdge: '#d4c6a2', paperInk: '#8d8678', paperFold: '#d9ccab',
  };
})();
const RAN_CUT = rigCutter(5000);
const RAN_HAND = 1.3, RAN_NECK = -262, RAN_WAIST = -204, RAN_HEAD = 1.1, RAN_EAR = 197, RAN_HEM = -44;

// ===================== 部件（载入时剪好） =====================
// 尾巴：根在原点、朝 -y 伸，长 L、最宽 W，往 +x 弯 bend；两侧是一排锯齿状的毛尖（ph 换一种排法）。u0 > 0 时是尾尖那一段（底边也是锯齿）
// 尾巴半宽（0..1）：根部窄、约 55% 处最胖、尾端圆圆的
const ranTailHw = u => u < .55 ? .32 + .68 * Math.sin(Math.PI / 2 * u / .55) : Math.pow(Math.max(0, 1 - Math.pow((u - .55) / .45, 1.7)), .72);
function ranTailPts(L, W, bend, ph, u0 = 0, N = 14, amp = .1) {
  const hw = u => W / 2 * ranTailHw(u), cx = u => bend * L * u * u, Lp = [], Rp = [];
  for (let k = 0; k <= N; k++) {
    for (const sd of [-1, 1]) {
      const r = hash(k + (sd > 0 ? 40 : 0), ph), odd = k % 2 === 1 && k < N, u = Math.min(1, lerp(u0, 1, k / N) + (odd ? .3 / N : 0)), m = odd ? 1 + amp * (.7 + .8 * r) : 1 - amp * .45 * r;
      (sd < 0 ? Lp : Rp).push([cx(u) + sd * hw(u) * m, -u * L]);
    }
  }
  const out = [...Lp, ...Rp.reverse()];
  if (u0 > 0) { const y = -u0 * L, c = cx(u0), w = hw(u0); out.push([c + w * .45, y + 2.5], [c, y + 7], [c - w * .45, y + 2.5]); }
  return out;
}
const RAN_G = (() => {
  const cut = RAN_CUT, g = {};
  const quad = (x0, y0, x1, y1, w0, w1 = w0) => [[x0 - w0, y0], [x0 + w0, y0], [x1 + w1, y1], [x1 - w1, y1]];
  // ---- 九尾（一个形状，按骨头缩放、镜像）：外轮廓、浅色内芯、深色毛纹、米白尾尖 ----
  const TL = 150, TW = 74, TB = .1;
  g.tail = cut(ranTailPts(TL, TW, TB, 1, 0, 12, .08), 1, 8, .45);
  g.tailCore = cut(ranTailPts(TL * .84, TW * .5, TB * .9, 2, .05, 10, .05), 2, 8, .35);
  g.tailLines = [-.42, .42].map((f, i) => { const pts = []; for (let u = .1; u <= .7; u += .1) { const hw = TW / 2 * ranTailHw(u); pts.push([TB * TL * u * u + f * hw * .8, -u * TL]); }
    return cut(rStroke(pts, u => 2.4 * (1 - u) + .5), 3 + i, 7, .2, false); });
  g.tailTip = cut(ranTailPts(TL, TW * 1.06, TB, 1, .84, 6, .08), 6, 7, .4);
  // ---- 靴（站姿，脚底为原点）：白色短靴，鞋底一条深边 ----
  const bootR = [[5, -40], [19, -40], [19.5, -22], [22, -12], [27, -6.5], [28, 0], [3, 0], [3.2, -16]];
  g.bootR = cut(bootR, 10, 7, .3); g.bootL = cut(rMirror(bootR), 11, 7, .3);
  g.soleR = cut([[3, -3.4], [28, -3.4], [28, 0], [3, 0]], 12, 5, .15, false); g.soleL = cut(rMirror([[3, -3.4], [28, -3.4], [28, 0], [3, 0]]), 13, 5, .15, false);
  // ---- 裙（腰 y=-204）：白色钟形长裙，下摆一圈荷叶边，里面一圈衬裙 ----
  g.skirt = cut([[-20, -208], [0, -209], [20, -208], [24, -190], [32, -160], [43, -124], [55, -92], [66, -64], [72, -50], [0, -46], [-72, -50], [-66, -64], [-55, -92], [-43, -124], [-32, -160], [-24, -190]], 20, 11, .7);
  g.skirtFrill = cut([...rOpen([[-73, -60], [0, -56], [73, -60]], 6), ...rScallop(u => [lerp(75, -75, u), -48 + 3 * (1 - (2 * u - 1) ** 2)], 13, 4.5)], 21, 4, .45, false);
  g.petti = cut([...rOpen([[-70, -52], [0, -48], [70, -52]], 6), ...rScallop(u => [lerp(68, -68, u), -36 + 3 * (1 - (2 * u - 1) ** 2)], 14, 4)], 22, 4, .45, false);
  g.folds = [-.7, -.35, .35, .7].map((u, i) => { const xt = u * 17, xb = u * 66; return cut([[xt - .8, -196], [xt + .8, -196], [xb + 1.6, -62], [xb - 1.6, -62]], 23 + i, 12, .4, false); });
  // ---- 上身：白袍、脖子、紫色领和肩、白色小荷叶、蓝罩衫 ----
  g.torso = cut([[-13, -268], [13, -268], [24, -262], [26, -250], [23, -226], [21, -204], [-21, -204], [-23, -226], [-26, -250], [-24, -262]], 30, 8, .5);
  g.neck = cut([[-5.5, -282], [5.5, -282], [6, -258], [-6, -258]], 31, 8, .3, false);
  const tabardOut = (k, y1) => [[-21 * k, -256], [21 * k, -256], [23 * k, -230], [23.5 * k, -190], [25.5 * k, -130], [27.5 * k, -80], [28.5 * k, y1 + 2], [0, y1 + 5], [-28.5 * k, y1 + 2], [-27.5 * k, -80], [-25.5 * k, -130], [-23.5 * k, -190], [-23 * k, -230]];
  g.tabardTrim = cut(tabardOut(1.12, -48), 32, 10, .5);
  g.tabard = cut(tabardOut(1, -51), 33, 10, .4);
  // 罩衫的白色卷纹：太极圈（一段近乎整圈的粗弧 + S 线）、小回旋、回字纹、下摆两道横线
  const arc = (cx, cy, r, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  g.taiji = [cut(rStroke(arc(0, -168, 12, -1.2, 4.9), 2.8), 34, 5, .15, false),
    cut(rStroke([...arc(0, -174, 6, -Math.PI / 2, Math.PI / 2, 10), ...arc(0, -162, 6, -Math.PI / 2, -Math.PI * 1.5, 10)], 2.4), 35, 4, .15, false),
    cut(ellPts(0, -166, 2, 2, 8), 36, 2, .05, false)];
  g.curl = [-1, 1].map((sd, i) => { const pts = Array.from({ length: 31 }, (_, k) => { const a = (sd > 0 ? Math.PI : 0) + sd * k / 30 * 4 * Math.PI * .85, r = 8.5 * (1 - k / 30) + 1.6; return [sd * 13 + r * Math.cos(a), -132 + r * Math.sin(a)]; });
    return cut(rStroke(pts, u => 2.4 - 1 * u), 37 + i, 4, .12, false); });
  const meander = [[-10, -10], [10, -10], [10, 10], [-7, 10], [-7, -7], [7, -7], [7, 7], [-4, 7], [-4, -4], [4, -4], [4, 3], [-1, 3]].map(([x, y]) => [x, y - 94]);
  g.meander = cut(rStroke(resample(meander, 2.5, false), 2.2), 40, 4, .12, false);
  g.hemBars = [-76, -69].map((y, i) => cut([[-21, y], [21, y], [21.5, y + 2], [-21.5, y + 2]], 41 + i, 6, .15, false));
  // 紫色领和肩（V 形）、立领、扣子、领下的白色小荷叶
  g.yoke = cut([[-13, -272], [13, -272], [23, -266], [28, -258], [25, -252], [13, -247], [0, -243], [-13, -247], [-25, -252], [-28, -258], [-23, -266]], 50, 8, .45);
  g.collar = cut([[-14, -277], [14, -277], [16, -263], [8, -260], [0, -258], [-8, -260], [-16, -263]], 51, 6, .3);
  g.buttonRim = cut(ellPts(8.5, -262, 3.3, 3.3, 10), 52, 2, .05, false); g.button = cut(ellPts(8.5, -262, 2.1, 2.1, 10), 53, 2, .05, false);
  const yc = spline([[-25, -252], [-13, -247], [0, -243], [13, -247], [25, -252]], 2, false), ycf = u => yc[Math.min(yc.length - 1, Math.round(u * (yc.length - 1)))];
  g.yokeFrill = cut([...yc.map(([x, y]) => [x, y - 1.5]), ...rScallop(u => ycf(1 - u), 7, 2.6)], 54, 3, .2, false);
  // 腰间紫布结（一团布 + 两道褶 + 垂下的一角）
  g.knot = cut([[-18, -216], [-6, -221], [8, -220], [19, -214], [21, -203], [12, -195], [-4, -194], [-16, -198], [-21, -207]], 55, 6, .5);
  g.knotFolds = [cut([[-12, -214], [-4, -212], [-2, -199], [-8, -200]], 56, 7, .2, false), cut([[8, -213], [14, -208], [10, -198], [5, -200]], 57, 7, .2, false)];
  g.knotEnd = cut([[8, -198], [19, -200], [24, -178], [18, -172], [11, -186]], 58, 7, .4, false);
  // 绿流苏（原点在系绳处，朝下）
  g.tassel = cut([[-2, 0], [2, 0], [3.2, 9], [6, 17], [5, 30], [2.5, 38], [0, 40], [-2.5, 38], [-5, 30], [-6, 17], [-3.2, 9]], 60, 5, .3);
  g.tasselBand = cut([[-4, 10], [4, 10], [4.4, 14], [-4.4, 14]], 61, 3, .1, false);
  g.tasselKnot = cut(ellPts(0, 2, 3.4, 3.4, 10), 62, 2, .05, false);
  // ---- 手臂（全部穿在宽袖里）：上臂袖（肩为原点）、前臂喇叭袖（肘为原点）、袖口荷叶边（腕为原点）、袖褶、手 ----
  g.sleeveU = cut([[-13, -8], [0, -13], [13, -8], [15, 10], [16, 28], [16, 40], [-16, 40], [-16, 28], [-15, 10]], 70, 8, .4);
  g.sleeveF = cut([[-16, -3], [-11, -10], [0, -13], [11, -10], [16, -3], [19, 12], [23, 25], [27, 33], [-27, 33], [-23, 25], [-19, 12]], 71, 8, .45);
  g.sleeveFolds = [-1, 1].map((sd, i) => cut([[sd * 5 - .8, 2], [sd * 5 + .8, 2], [sd * 18 + 1.4, 31], [sd * 18 - 1.4, 31]], 72 + i, 10, .3, false));
  g.cuff = cut([...rOpen([[-27.5, -3], [0, -4.5], [27.5, -3]], 4), ...rScallop(u => [lerp(29, -29, u), 5 + 1.2 * (1 - (2 * u - 1) ** 2)], 7, 3.4)], 74, 4, .35, false);
  const H = RIG_SHAPES.hand, hs = pts => pts.map(([x, y]) => [x * RAN_HAND, y * RAN_HAND]);   // 手放大一点，和宽袖配
  g.handOpen = cut(hs(H.open), 75, 3, .2, false); g.handPoint = cut(hs(H.point), 76, 3, .2, false); g.handGrip = cut(hs(H.grip), 77, 3, .2, false);
  // 纸（中心为原点）：整张打印纸 + 折角 + 几行字线；纸条
  g.sheet = cut([[-25, -31], [25, -31], [25.5, 31], [-25.5, 31]], 80, 9, .35, false);
  g.sheetCorner = cut([[25, -31], [25, -21], [15, -31]], 81, 4, .1, false);
  g.sheetLines = [[-19, -23, 8, 3.2], ...[38, 34, 38, 30, 36, 20].map((w, i) => [-19, -12 + i * 8.2, w - 19, 2])].map(([x0, y0, x1, h], i) => cut([[x0, y0], [x1, y0], [x1, y0 + h], [x0, y0 + h]], 82 + i, 6, .12, false));
  g.strip = cut([[-24, -10], [24, -10.5], [24.5, 10], [-24, 10.5]], 90, 8, .35, false);
  g.stripLines = [[-18, -4, 14], [-18, 3, 8]].map(([x0, y0, w], i) => cut([[x0, y0], [x0 + w + 18, y0], [x0 + w + 18, y0 + 2.2], [x0, y0 + 2.2]], 91 + i, 6, .12, false));
  // ---- 头（头坐标：脖子关节为原点；下巴比蕾米莉亚尖一点） ----
  g.face = cut([[0, -3], [9, -5], [19, -11], [29, -23], [35, -41], [38, -62], [38, -82], [33, -98], [0, -107], [-33, -98], [-38, -82], [-38, -62], [-35, -41], [-29, -23], [-19, -11], [-9, -5]], 100, 7, .5);
  // 后发：齐下巴的 bob，两侧微微外翘
  const bSide = rOpen([[0, -140], [34, -134], [52, -116], [59, -90], [60, -60], [58, -36], [57, -20]], 5);
  const bTips = [[60, -9], [52, -13], [42, -6], [30, -13], [16, -8], [0, -11]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 101, 9, .8, false);
  // 鬓发（耳侧碎发）：太阳穴垂到下巴，发梢尖
  const lockR = [...rOpen([[27, -102], [42, -98], [49, -78], [49, -50], [47, -30]], 4), [45, -13], [40, -30], ...rOpen([[37, -50], [34, -72], [29, -92]], 4)];
  g.lockR = cut(lockR, 102, 6, .5, false); g.lockL = cut(rMirror(lockR), 103, 6, .5, false);
  // 刘海：从中间偏左的旋涡处往右下斜扫，右边的发绺长、盖到眉梢，左边短而碎
  g.bangs = cut([[-48, -112], [-30, -126], [0, -133], [30, -126], [48, -112], [54, -92], [51, -64], [44, -78], [38, -58], [30, -78], [22, -60], [14, -80], [4, -64], [-4, -82], [-14, -72], [-22, -90], [-32, -80], [-40, -96], [-50, -88], [-54, -98]], 104, 6, .5, false);
  g.bangLines = [[-20, -118, 32, -66], [-6, -120, 18, -66], [8, -120, 46, -72], [-30, -114, -8, -80]].map(([x0, y0, x1, y1], i) => cut([[x0 - 1, y0], [x1 - 1.4, y1], [x1 + 1.4, y1], [x0 + 1, y0]], 105 + i, 8, .2, false));
  // 帽子：两只狐耳（白色、耳内金黄）、方形软帽身、帽身褶线、帽前的金黄纹样布片、帽檐荷叶边
  g.earR = cut([[18, -146], [28, -172], [48, -197], [57, -170], [62, -136]], 110, 6, .5, false); g.earL = cut(rMirror([[18, -146], [28, -172], [48, -197], [57, -170], [62, -136]]), 111, 6, .5, false);
  g.earInR = cut([[30, -150], [37, -172], [48, -190], [53, -168], [55, -146]], 112, 5, .3, false); g.earInL = cut(rMirror([[30, -150], [37, -172], [48, -190], [53, -168], [55, -146]]), 113, 5, .3, false);
  g.capBody = cut([[-70, -98], [-72, -112], [-67, -130], [-57, -144], [-40, -150], [-22, -153], [0, -150], [22, -153], [40, -150], [57, -144], [67, -130], [72, -112], [70, -98], [0, -104]], 114, 9, .7);
  g.capFolds = [[-46, -102, -42, -143], [-26, -104, -23, -148], [24, -104, 22, -148], [46, -102, 42, -143]].map(([x0, y0, x1, y1], i) => cut(quad(x0, y0, x1, y1, 1.3, .8), 115 + i, 9, .2, false));
  g.patch = cut([[-16, -108], [16, -108], [14.5, -142], [0, -146], [-14.5, -142]], 120, 6, .3, false);
  g.patchRim = cut([[-18.4, -106], [18.4, -106], [17, -144], [0, -148.4], [-17, -144]], 121, 6, .3, false);
  g.patchMarks = [cut([[-9, -120], [9, -120], [9, -117.4], [-9, -117.4]], 122, 4, .1, false), cut([[-6, -128], [6, -128], [6, -125.4], [-6, -125.4]], 123, 4, .1, false), cut([[-9, -136], [9, -136], [9, -133.4], [-9, -133.4]], 124, 4, .1, false), cut([[-1.2, -120], [1.2, -120], [1.2, -135], [-1.2, -135]], 125, 5, .1, false)];
  const brim = u => { const v = 1 - 2 * u; return [74 * v, -100 + 20 * v * v]; };
  g.capFrill = cut([...rOpen([[-77, -92], [-40, -108], [0, -114], [40, -108], [77, -92]], 5), ...rScallop(u => { const [x, y] = brim(u); return [x, y + 2]; }, 17, 3.6)], 126, 4, .45, false);
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat, 130, 3, .2);
  return g;
})();
// 耳尖到脚底的设计高度（用来把 h 换成缩放）
const RAN_TOP = -(RAN_NECK - RAN_EAR * RAN_HEAD);

// ===================== 表情 =====================
// 字段同蕾米莉亚 / 帕秋莉：lid 眼睑盖住眼睛的比例，lidTilt 眼睑外端下垂（负：吊眼），es 眼睛大小，brow [上移, 内端下压角]，mouth 嘴型，blush 腮红，chin 下巴抬(-)，sweat 冷汗
const RAN_MOODS = {
  normal: { lid: .4, lidTilt: -.04, es: 1, brow: [0, .1], mouth: 'flat', blush: .6 },
  happy: { eye: 'up', brow: [2, -.08], mouth: 'smile', blush: 1.1 },
  surprised: { lid: 0, lidTilt: 0, es: 1.22, brow: [6, -.1], mouth: 'o', blush: .8 },
  awkward: { lid: .24, lidTilt: .06, es: 1.04, brow: [2, -.32], mouth: 'wave', blush: 1.5, sweat: true },
  proud: { lid: .62, lidTilt: -.05, es: 1, brow: [2, .06], mouth: 'smirk', blush: .6, chin: -.14 },
};
const RAN_MOOD_ALIAS = { smile: 'happy', flustered: 'awkward', panic: 'awkward', pout: 'awkward', cry: 'awkward', sad: 'awkward', smug: 'proud', confused: 'surprised', calm: 'normal', annoyed: 'normal', angry: 'normal', sleepy: 'normal' };
const RAN_POSE_ALIAS = { lecture: 'point', cheer: 'point', hold: 'read', lift: 'read', give: 'present', hand: 'present', hide: 'bow', slump: 'bow', tired: 'bow', cross: 'stand', proud: 'stand', sit: 'stand', lie: 'stand', peek: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand' };
// 嘴：借两位的嘴型（o 用琪露诺的，其余用帕秋莉的）。他们返回的颜色是色值，rig 要颜色键（mouth / mouthIn），这里换回来
function ranMouthPts(type, open) {
  const [pts, col, tg] = (type === 'o' ? cirMouthPts : pchMouthPts)(type, open);
  return [pts, col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：标记 late 画在帽子外面；手型 none 手藏在袖子里
// paper：sheet 一张纸（read）| strip 纸条（present）；tail0：尾巴固定垂下（think）；lean 上身前倾，sink 头下沉
// ranIK：肩 (±22, -250) 到腕 (tx, ty)（上身坐标），上臂 L1、前臂 L2，肘往外、往下弯 → [a, b]；sd = -1 是后手（屏幕左边那只，facing=1）
function ranIK(sd, tx, ty, L1 = 36, L2 = 32) {
  const X = sd * tx - 22, Y = ty + 250, d = clamp(Math.hypot(X, Y), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(X, Y) + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), ex = L1 * Math.sin(a), ey = L1 * Math.cos(a);
  return [sd * a, sd * (Math.atan2(X - ex, Y - ey) - a)];
}
// 揣袖：两只手交叉，各揣在对面的袖子里；front 压在 back 上面
const ranTuck = (kb = 1, kf = 1) => ({ back: [-.2, 1.95, 'none', false, 1, 1.2], front: [.2, -1.95, 'none', false, 1, 1.2] });
function ranPose(pose, g, tt) {
  const tk = ranTuck();
  switch (pose) {
    // 双手举着纸在胸前，头微微低下去看
    case 'read': return { back: [...ranIK(-1, -23, -204), 'grip', false], front: [...ranIK(1, 23, -204), 'grip', false], paper: 'sheet', hr: .12, turn: .1, look: 0, lookY: 2.5 };
    case 'point': return { back: tk.back, front: [lerp(1.1, 1.5, g), lerp(.25, .02, g), 'point', false, lerp(1, 1.15, g), lerp(1, 1.15, g)], hr: -.04, turn: .3, look: .6, lean: .03 * g };
    case 'present': return { back: tk.back, front: [...ranIK(1, 80, -226), 'open', false], paper: 'strip', hr: .02, turn: .25, look: .5, lean: .02 };
    case 'think': return { back: [...ranIK(-1, 24, -208), 'none', false], front: [.51, -3.08, 'point', 'late'], tail0: true, hr: -.06, turn: .22, look: .4, lookY: -2.5 };
    case 'bow': return { back: [...ranIK(-1, -3, -232), 'none', false], front: [...ranIK(1, 3, -232), 'none', false], hr: .17, sink: 5, lean: .06, turn: .08, look: 0, lookY: 3, bow: true };
    default: return { back: tk.back, front: tk.front, turn: .12, look: .1 };
  }
}

// ===================== 部件表 =====================
const ranIs = (...ps) => k => ps.includes(k.pose);
// 一条手臂从下到上：手、上臂袖、前臂喇叭袖、袖褶、袖口荷叶边（手在袖子里面）
const ranArm = f => ({ arms: f, order: 'arm', sh: 'mid', items: [['@hand', 'hm', 'skin'], ['sleeveU', 'uD', 'robe'], ['sleeveF', 'lD', 'robe'], ['sleeveFolds', 'lD', 'fold', false], ['cuff', 'hm', 'frill']] });
const RAN_TAIL_ORDER = [0, 8, 1, 7, 2, 6, 3, 5, 4];
const ranTailLayer = i => ({ items: [['tail', 'tail' + i, i % 2 ? 'tailAlt' : 'tail'], ['tailCore', 'tail' + i, 'tailLight', false], ['tailLines', 'tail' + i, 'tailDeep', false], ['tailTip', 'tail' + i, 'tailTip', false]], sh: 'wing' });
const RAN_RIG = {
  name: 'ran', h: 500, height: RAN_TOP, K: RAN_K, G: RAN_G, cut: RAN_CUT,
  moods: RAN_MOODS, moodAlias: RAN_MOOD_ALIAS, poseAlias: RAN_POSE_ALIAS, pose: ranPose, mouth: ranMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, 1, 1],
  face: { style: 'lid', ex: 15.5, ey: -44, far: .25, turnX: 8, rx: 7.2, ry: 8.2, lookX: 2.2, mouthY: -20, mouthTurn: 8,
    blush: { dx: 8, turn: 0, y: -27, bump: 0, rx: 5.5, ry: 2.6 }, brow: { x: 15.5, y: -62, len: 7, seed: 98, th: [1, 1, .2, .8, 1] } },
  arm: { parent: 'ug', shoulder: [22, -250], upper: 36, fore: 32, mirrorHand: true, tips: { open: [0, 13 * RAN_HAND], point: [0, 22 * RAN_HAND], grip: [0, 7 * RAN_HAND], none: [0, 4] },
    hands: { open: 'handOpen', point: 'handPoint', grip: 'handGrip', none: null } },
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .008 * Math.sin(tt * 1.2) + .004 * Math.sin(tt * 2.7);
    k.breath = 1.1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, RAN_WAIST, k.lean), 0, -k.breath);
    k.tl = ps.tail0 ? 0 : clamp(o.tails == null ? .3 : o.tails, 0, 1);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root' },
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, RAN_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [RAN_HEAD, RAN_HEAD] },
    // 九条尾巴：根在腰后，扇形散开；tails 越大越往上翘、越收拢；左边几条形状镜像
    ...Array.from({ length: 9 }, (_, i) => {
      const j = i - 4, aj = Math.abs(j) / 4;
      return { name: 'tail' + i, parent: 'body', at: [j * 2.4, -172],
        rot: k => j / 4 * (k.ps.tail0 ? 1.6 : lerp(1.38, .8, k.tl)) + .05 * (j > 0 ? 1 : j < 0 ? -1 : 0) * k.tl,
        sway: k => [.03 + .02 * k.tl, 1.1 + i * .06, i * .9],
        scale: k => { const sg = j < 0 ? -1 : 1, w = [1, .94, 1.04][i % 3] * lerp(1, .92, aj), l = lerp(.82, 1.12, aj) * lerp(1, 1.08, k.tl) * [1, .96, 1.02][(i + 1) % 3]; return [sg * w, l]; },
        spring: { len: 150, dir: -Math.PI / 2, gain: .5, f: 1.6 + i * .05, max: .2 } };
    }),
    { name: 'skirt', parent: 'body', pivot: [0, RAN_WAIST], rot: k => k.lean * .5, spring: { len: 110, gain: .4, f: 1.8, max: .12 } },
    { name: 'tassel', sides: true, parent: 'skirt', at: (k, sd) => [sd * 27, RAN_HEM - 5], rot: (k, sd) => sd * .08, sway: (k, sd) => [.07, 1.7, sd * 1.3], spring: { len: 40, gain: .8, f: 2.4, max: .4 } },
    { arms: true },
    // 纸：read 在两手之间偏上，present 在前手指尖
    { name: 'paper', when: k => k.ps.paper, m: k => { const ug = k.B.ug, A = rApply(rInv(ug), k.AB.tip), F = rApply(rInv(ug), k.AF.tip);
      return k.ps.paper === 'sheet' ? rTR(ug, (A[0] + F[0]) / 2, (A[1] + F[1]) / 2 - 27, .03 * Math.sin(k.tt * 1.3)) : rTR(ug, F[0] + 2, F[1] - 6, -.14 + .03 * Math.sin(k.tt * 1.7)); } },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 40, -96], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 90, gain: .7, f: 2.3, max: .35 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 2.5, 0] },
    { name: 'cap', parent: 'head', at: k => [-k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -104], sway: [.01, 1.3, .4], spring: { len: 60, dir: -Math.PI / 2, gain: .4, f: 2.6, max: .1 } },
    { name: 'ear', sides: true, parent: 'capTop', pivot: (k, sd) => [sd * 38, -146], sway: (k, sd) => [.035, 1.9 + sd * .3, sd * 1.1] },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [50, -90 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 九尾（最远的最先画，每条自己一层投影）
    ...RAN_TAIL_ORDER.map(ranTailLayer),
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 靴、裙、衬裙
    { items: [['bootL', 'root', 'boot'], ['bootR', 'root', 'boot']], sh: 'mid' },
    { items: [['soleL', 'root', 'bootSole', false], ['soleR', 'root', 'bootSole', false]], gr: false },
    { items: [['petti', 'skirt', 'petti']], sh: 'mid' },
    { items: [['skirt', 'skirt', 'robe']], sh: 'big' },
    { items: [['folds', 'skirt', 'fold', false]], gr: false },
    { items: [['skirtFrill', 'skirt', 'frill']], sh: 'mid' },
    // 上身：白袍、蓝罩衫（白滚边、纹样）、腰间紫布结、绿流苏
    { items: [['neck', 'ug', 'skin', false], ['torso', 'ug', 'robe']], sh: 'mid' },
    { items: [['tabardTrim', 'ug', 'trim']], sh: 'mid' },
    { items: [['tabard', 'ug', 'blue']], gr: true },
    { items: [['taiji', 'ug', 'pat', false], ['curl', 'ug', 'pat', false], ['meander', 'ug', 'pat', false], ['hemBars', 'ug', 'pat', false]], gr: false },
    { items: [['knotEnd', 'ug', 'purpleDeep'], ['knot', 'ug', 'purple']], sh: 'mid' },
    { items: [['knotFolds', 'ug', 'purpleDeep', false]], gr: false },
    { items: [['tassel', 'tasselL', 'green'], ['tassel', 'tasselR', 'green']], sh: 'tiny' },
    { items: [['tasselBand', 'tasselL', 'greenDeep', false], ['tasselBand', 'tasselR', 'greenDeep', false], ['tasselKnot', 'tasselL', 'greenDeep', false], ['tasselKnot', 'tasselR', 'greenDeep', false]], gr: false },
    { items: [['yoke', 'ug', 'purple']], sh: 'mid' },
    { items: [['yokeFrill', 'ug', 'frill']], sh: 'tiny' },
    { items: [['collar', 'ug', 'purpleLite']], sh: 'tiny' },
    { items: [['buttonRim', 'ug', 'purpleDeep', false], ['button', 'ug', 'button', false]], gr: false },
    // 手臂：后手先、前手压在上面（think 的前手最后画在脸前面）
    { ...ranArm(A => A.sd < 0 && A.flag !== 'late') },
    { ...ranArm(A => A.sd > 0 && A.flag !== 'late') },
    // 纸画在手前面
    { when: k => k.ps.paper === 'sheet', items: [['sheet', 'paper', 'paper']], sh: 'mid' },
    { when: k => k.ps.paper === 'sheet', items: [['sheetCorner', 'paper', 'paperFold', false], ['sheetLines', 'paper', 'paperInk', false]], gr: false },
    // 脸、前发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 帽子：狐耳、帽身、褶、布片、荷叶边
    { items: [['earL', 'earL', 'cap'], ['earR', 'earR', 'cap']], sh: 'mid' },
    { items: [['earInL', 'earL', 'earIn', false], ['earInR', 'earR', 'earIn', false]], gr: false },
    { items: [['capBody', 'capTop', 'cap']], sh: 'big' },
    { items: [['capFolds', 'capTop', 'capFold', false]], gr: false },
    { items: [['patchRim', 'cap', 'patchInk', false], ['patch', 'cap', 'patch', false]], sh: 'tiny', gr: false },
    { items: [['patchMarks', 'cap', 'patchInk', false]], gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    // 纸条在手上，think 的前手在脸前
    { when: k => k.ps.paper === 'strip', items: [['strip', 'paper', 'paper']], sh: 'mid' },
    { when: k => k.ps.paper === 'strip', items: [['stripLines', 'paper', 'paperInk', false]], gr: false },
    { ...ranArm(A => A.flag === 'late') },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k, hands = [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]);
    return { head: rApply(B.head, [0, -50]), hands, tip: AF.tip, hold: B.paper ? rApply(B.paper, [0, 0]) : [(AB.tip[0] + AF.tip[0]) / 2, (AB.tip[1] + AF.tip[1]) / 2] };
  },
};

function drawRan(c, o = {}) { return drawRig(c, RAN_RIG, o); }
