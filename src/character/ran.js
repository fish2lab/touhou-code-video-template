'use strict';
// 八云蓝 —— 剪纸人偶的部件表（八云紫的式神、九尾狐；第三版：Q 版比例、分层眼睛、深色描边，规格见 docs/rig.md「统一比例」）。
// 画法全在 src/rig.js，本文件只有数据：颜色、部件轮廓、表情表、姿势表、骨头表、图层表。纯 Canvas 代码绘制，不加载任何图片。
//
// drawRan(c, o) → { head:[x,y], hands:[[x,y],[x,y]], tip:[x,y], hold:[x,y] }
//   x, y     脚底中心
//   h        缩放基准，默认 500（设计高 520 对应 h=520；全员同一缩放，帽子和狐耳尖高出头顶多少各人不同，见 docs/rig.md）
//   facing   1 朝右 / -1 朝左（整张人偶镜像）
//   pose     stand 双手拢在宽袖里在身前交叉（抱臂揣袖，默认）| read 双手捏着一张打印纸的两边举在胸前看（hold 是纸的中心；袖子在纸后面，只有手指扣在纸边上）
//            point 一手伸向前（gesture 伸多远），另一手揣袖 | present 一手把纸条递出（hold 是纸条中心）
//            think 手指点下巴、另一只袖子托着肘、尾巴垂下 | bow 微微低头拱手（两只袖子在胸前合拢）
//            旧名兼容：lecture/cheer→point、hold/lift→read、give/hand→present、hide/slump/tired→bow、cross/proud/sit/lie/peek/fly/walk/run→stand
//   mood     normal 沉稳：眼睛半垂、嘴小（默认）| happy 眼睛眯成弧线、小笑 | surprised 眼圆、嘴 o
//            awkward 冷汗、眉斜、嘴抿成波浪 | proud 下巴抬、眼更垂、嘴角一挑
//            旧名兼容：smile→happy、flustered/panic/pout/cry/sad→awkward、smug→proud、confused→surprised、calm/annoyed/angry/sleepy→normal
//   look / tilt / mouth / blink / t / gesture / light / track：同 drawPatchouli（src/character/patchouli.js 文件头）
//   tails    0..1 九条尾巴翘起来的程度（默认 0.3；念纸条时翘一下）。think 姿势里尾巴固定垂下，不管 tails
//   返回值：head 脸中心，hands 两只手（袖口；按屏幕 x 从左到右），tip 前手（袖口/指尖），hold 纸或纸条的中心（没拿纸时是两手之间）
//
// 设计坐标：脚底 (0,0)，y 向下。照帕秋莉的做法：身子部件按「身子坐标」（脖子 -212）画，body 骨头整体乘 RAN_BODY = 1.17（脖子落在 -248）；
// 头部件按「头坐标」（原点在脖子关节，下巴 (0,-4)、头顶 -150、脸宽 ±64，和帕秋莉同一套）画，最后合计放大 1.2 倍。
// 衣服：白色宽袖长袍 + 紫色立领内衬（领口一粒扣子）+ 蓝色长罩衫（白滚边、白色太极卷纹和回字纹、下摆两角绿流苏）+ 腰间紫布结 + 白色荷叶边裙摆 + 白靴；
// 帽子：白色道士帽，罩住头顶、帽檐是一道往后仰的弧，顶上两角是尖狐耳（耳内金黄），帽前一块金黄符纸；九条金黄蓬松的尾巴在身后扇形散开、尾尖米白。
// 本文件顶层名字都带 ran / RAN_ 前缀。

// ===================== 颜色（压暗、低饱和；蓝罩衫、紫领、金尾巴要明显） =====================
const RAN_K = (() => {
  const hair = '#e2c06b', hairBack = '#c3a04f', robe = '#e8e4dd', blue = '#5675a6', purple = '#8670b0', tail = '#e0ae4c', green = '#5aa088', cap = '#f0ece5', boot = '#e6e0d9', eye = '#c8952f';
  return {
    hair, hairBack, hairLine: mix(hairBack, hair, .3),
    robe, fold: mix(robe, '#7d86a0', .3), frill: '#f4f0e9', petti: mix(robe, '#9a93a0', .25), robeIn: mix(robe, P.ink, .38),
    blue, blueDeep: mix(blue, P.ink, .3), trim: '#efebe3', pat: '#ebe8e0',
    purple, purpleDeep: mix(purple, P.ink, .28), purpleLite: mix(purple, '#ffffff', .22), button: '#e4d6f0',
    green, greenDeep: mix(green, P.ink, .38),
    tail, tailAlt: mix(tail, '#9b6a28', .2), tailDeep: mix(tail, '#8a5a22', .38), tailLight: mix(tail, '#fff2cf', .4), tailTip: '#f6efdd',
    cap, capShade: mix(cap, '#7d86a0', .2), capFold: mix(cap, '#7d86a0', .38), earIn: '#e6bc5a', patch: '#d9ac4a', patchInk: '#8d6228',
    boot, sock: '#f3efe9', bootSole: mix(boot, '#6c6670', .42),
    skin: P.skin, blush: P.blush, brow: mix(hairBack, P.ink, .45),
    // 眼睛分层（第三版）：琥珀色虹膜、下半亮色、瞳孔、上沿阴影、眼白、眼线
    eye, irisLt: mix(eye, '#fff1c2', .5), pupil: mix(eye, P.ink, .8), irisShade: alpha(mix(eye, P.ink, .75), .45), sclera: '#fbf8f3', lid: '#2e2430',
    mouth: mix(hairBack, P.ink, .62), mouthIn: mix(P.ribbonRed, P.ink, .45), tongue: mix(P.blush, P.ribbonRed, .45),
    sweat: mix(P.ribbonBlue, P.cap, .62), white: '#f7f3ee',
    paper: '#f2ecda', paperEdge: '#d4c6a2', paperInk: '#8d8678', paperFold: '#d9ccab',
  };
})();
const RAN_CUT = rigCutter(5000);
// 身子坐标：脖子 -212、腰 -166、肩 (±28, -200)、罩衫下摆 -52；body 骨头乘 RAN_BODY。头部件乘 RAN_HEAD（合计 1.2）
const RAN_BODY = 1.17, RAN_HEAD = 1.2 / RAN_BODY, RAN_NECK = -212, RAN_WAIST = -166, RAN_SH = [28, -200], RAN_UP = 36, RAN_FORE = 32, RAN_HAND = .95;

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
// 帽檐那道弧（头坐标）：戴得往后仰，前沿高、两端低
const ranBand = x => -152 + 42 * (x / 88) ** 2;
const RAN_G = (() => {
  const cut = RAN_CUT, g = {};
  const quad = (x0, y0, x1, y1, w0, w1 = w0) => [[x0 - w0, y0], [x0 + w0, y0], [x1 + w1, y1], [x1 - w1, y1]];
  // ---- 九尾（身子坐标；一个形状，按骨头缩放、镜像）：外轮廓、浅色内芯、深色毛纹、米白尾尖 ----
  const TL = 100, TW = 50, TB = .1;
  g.tail = cut(ranTailPts(TL, TW, TB, 1, 0, 12, .08), 1, 7, .4);
  g.tailCore = cut(ranTailPts(TL * .84, TW * .5, TB * .9, 2, .05, 10, .05), 2, 7, .3);
  g.tailLines = [-.42, .42].map((f, i) => { const pts = []; for (let u = .1; u <= .7; u += .1) { const hw = TW / 2 * ranTailHw(u); pts.push([TB * TL * u * u + f * hw * .8, -u * TL]); }
    return cut(rStroke(pts, u => 2 * (1 - u) + .5), 3 + i, 6, .2, false); });
  g.tailTip = cut(ranTailPts(TL, TW * 1.06, TB, 1, .84, 6, .08), 6, 6, .35);
  // ---- 腿和靴（身子坐标，脚底为原点）：裙摆下露一截白袜，圆头白短靴，鞋尖略朝前 ----
  g.legL = cut([[-19, -42], [-9, -42], [-9.5, -20], [-18.5, -20]], 9, 6, .3, false); g.legR = cut([[9, -42], [19, -42], [18.5, -20], [9.5, -20]], 8, 6, .3, false);
  const bootR = [[8, -26], [21, -26], [21.5, -15], [27, -12.5], [30, -7], [27.5, -1], [15, 0], [4, -1], [.5, -6], [2.5, -12], [8, -14]];
  g.bootR = cut(bootR, 10, 6, .3); g.bootL = cut(rMirror(bootR), 11, 6, .3);
  const soleR = [[1.5, -3.6], [29, -3.6], [27.5, -.8], [15, 0], [4, -.8]];
  g.soleR = cut(soleR, 12, 5, .15, false); g.soleL = cut(rMirror(soleR), 13, 5, .15, false);
  g.bootTop = [-1, 1].map((sd, i) => cut(sd > 0 ? [[7.5, -27.5], [21.5, -27.5], [21.5, -23.5], [7.5, -23.5]] : rMirror([[7.5, -27.5], [21.5, -27.5], [21.5, -23.5], [7.5, -23.5]]), 14 + i, 5, .15, false));
  // ---- 裙（腰 y=-166）：白色钟形长袍下摆，下摆一圈荷叶边，里面一圈衬裙 ----
  g.skirt = cut([[-26, -170], [0, -171], [26, -170], [31, -158], [36, -138], [43, -112], [52, -86], [62, -64], [69, -52], [0, -48], [-69, -52], [-62, -64], [-52, -86], [-43, -112], [-36, -138], [-31, -158]], 20, 10, .7);
  g.skirtFrill = cut([...rOpen([[-70, -58], [0, -54], [70, -58]], 6), ...rScallop(u => [lerp(73, -73, u), -45 + 3 * (1 - (2 * u - 1) ** 2)], 12, 4.5)], 21, 4, .45, false);
  g.petti = cut([...rOpen([[-66, -50], [0, -46], [66, -50]], 6), ...rScallop(u => [lerp(64, -64, u), -35 + 2.5 * (1 - (2 * u - 1) ** 2)], 12, 4)], 22, 4, .45, false);
  g.folds = [-.75, -.4, .4, .75].map((u, i) => { const xt = u * 16, xb = u * 62; return cut([[xt - .8, -160], [xt + .8, -160], [xb + 1.5, -60], [xb - 1.5, -60]], 23 + i, 11, .4, false); });
  // ---- 上身：白袍、脖子、紫色领和肩、白色小荷叶、蓝罩衫 ----
  g.torso = cut([[-12, -219], [12, -219], [23, -213], [30, -203], [31, -185], [28, -164], [-28, -164], [-31, -185], [-30, -203], [-23, -213]], 30, 8, .5);
  g.neck = cut([[-6, -226], [6, -226], [6.5, -207], [-6.5, -207]], 31, 8, .3, false);
  const tabardOut = (k, y1) => [[-16 * k, -206], [16 * k, -206], [17.5 * k, -186], [18 * k, -160], [19.5 * k, -120], [21 * k, -86], [22 * k, y1 + 2], [0, y1 + 5], [-22 * k, y1 + 2], [-21 * k, -86], [-19.5 * k, -120], [-18 * k, -160], [-17.5 * k, -186]];
  g.tabardTrim = cut(tabardOut(1.13, -50), 32, 9, .45);
  g.tabard = cut(tabardOut(1, -53), 33, 9, .4);
  // 罩衫的白色卷纹：太极圈（一段近乎整圈的粗弧 + S 线）、两个小回旋、回字纹、下摆两道横线
  const arc = (cx, cy, r, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = lerp(a0, a1, i / n); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  g.taiji = [cut(rStroke(arc(0, -140, 9, -1.2, 4.9), 2.3), 34, 4, .12, false),
    cut(rStroke([...arc(0, -144.5, 4.5, -Math.PI / 2, Math.PI / 2, 10), ...arc(0, -135.5, 4.5, -Math.PI / 2, -Math.PI * 1.5, 10)], 2), 35, 4, .12, false),
    cut(ellPts(0, -138.5, 1.6, 1.6, 8), 36, 2, .05, false)];
  g.curl = [-1, 1].map((sd, i) => { const pts = Array.from({ length: 31 }, (_, k) => { const a = (sd > 0 ? Math.PI : 0) + sd * k / 30 * 4 * Math.PI * .85, r = 6.4 * (1 - k / 30) + 1.3; return [sd * 9.5 + r * Math.cos(a), -114 + r * Math.sin(a)]; });
    return cut(rStroke(pts, u => 2 - .8 * u), 37 + i, 4, .12, false); });
  const meander = [[-10, -10], [10, -10], [10, 10], [-7, 10], [-7, -7], [7, -7], [7, 7], [-4, 7], [-4, -4], [4, -4], [4, 3], [-1, 3]].map(([x, y]) => [x * .78, y * .78 - 91]);
  g.meander = cut(rStroke(resample(meander, 2.2, false), 1.9), 40, 4, .12, false);
  g.hemBars = [-72, -66].map((y, i) => cut([[-17, y], [17, y], [17.5, y + 1.8], [-17.5, y + 1.8]], 41 + i, 6, .15, false));
  // 紫色领和肩（V 形）、立领、扣子、领下的白色小荷叶
  g.yoke = cut([[-11, -223], [11, -223], [20, -218], [26, -210], [23, -204], [12, -200], [0, -197], [-12, -200], [-23, -204], [-26, -210], [-20, -218]], 50, 7, .4);
  g.collar = cut([[-11, -226], [11, -226], [13, -214], [6, -211], [0, -209.5], [-6, -211], [-13, -214]], 51, 6, .3);
  g.buttonRim = cut(ellPts(6.5, -213, 2.7, 2.7, 10), 52, 2, .05, false); g.button = cut(ellPts(6.5, -213, 1.7, 1.7, 10), 53, 2, .05, false);
  const yc = spline([[-23, -204], [-12, -200], [0, -197], [12, -200], [23, -204]], 2, false), ycf = u => yc[Math.min(yc.length - 1, Math.round(u * (yc.length - 1)))];
  g.yokeFrill = cut([...yc.map(([x, y]) => [x, y - 1.3]), ...rScallop(u => ycf(1 - u), 7, 2.2)], 54, 3, .2, false);
  // 腰间紫布结（一团布 + 两道褶 + 垂下的一角）
  g.knot = cut([[-15, -175], [-5, -179], [7, -178], [16, -173], [17.5, -164], [10, -158], [-3, -157], [-13, -160], [-17.5, -167]], 55, 6, .45);
  g.knotFolds = [cut([[-10, -173], [-3.5, -171.5], [-2, -160], [-7, -161]], 56, 6, .2, false), cut([[7, -172], [12, -168], [8.5, -160], [4.5, -161]], 57, 6, .2, false)];
  g.knotEnd = cut([[7, -160], [16, -162], [20, -143], [15, -138], [9, -150]], 58, 6, .35, false);
  // 绿流苏（原点在系绳处，朝下）
  g.tassel = cut([[-1.6, 0], [1.6, 0], [2.6, 7], [4.8, 14], [4, 24], [2, 30], [0, 32], [-2, 30], [-4, 24], [-4.8, 14], [-2.6, 7]], 60, 4, .25);
  g.tasselBand = cut([[-3.3, 8], [3.3, 8], [3.6, 11.2], [-3.6, 11.2]], 61, 3, .1, false);
  g.tasselKnot = cut(ellPts(0, 1.6, 2.8, 2.8, 10), 62, 2, .05, false);
  // ---- 手臂（全部穿在宽袖里）：上臂袖（肩为原点）、前臂喇叭袖（肘为原点）、袖口荷叶边（腕为原点）、袖褶、手 ----
  g.sleeveU = cut([[-11, -6], [0, -11], [11, -6], [13, 10], [14, 26], [14, 38], [-14, 38], [-14, 26], [-13, 10]], 70, 8, .4);
  g.sleeveF = cut([[-12, -4], [-8, -9], [0, -11], [8, -9], [12, -4], [15, 10], [19, 22], [23, 32], [-23, 32], [-19, 22], [-15, 10]], 71, 8, .45);
  g.sleeveFolds = [-1, 1].map((sd, i) => cut([[sd * 4 - .7, 2], [sd * 4 + .7, 2], [sd * 15.5 + 1.2, 30], [sd * 15.5 - 1.2, 30]], 72 + i, 9, .3, false));
  g.cuff = cut([...rOpen([[-23.5, -3], [0, -4.2], [23.5, -3]], 4), ...rScallop(u => [lerp(25, -25, u), 4.5 + 1 * (1 - (2 * u - 1) ** 2)], 7, 3)], 74, 4, .35, false);
  const H = RIG_SHAPES.hand, hs = pts => pts.map(([x, y]) => [x * RAN_HAND, y * RAN_HAND]);
  g.handOpen = cut(hs(H.open), 75, 3, .2, false); g.handPoint = cut(hs(H.point), 76, 3, .2, false); g.handGrip = cut(hs(H.grip), 77, 3, .2, false);
  // 纸（中心为原点）：整张打印纸 + 折角 + 几行字线；纸条
  g.sheet = cut([[-21, -26], [21, -26], [21.4, 26], [-21.4, 26]], 80, 8, .3, false);
  g.sheetCorner = cut([[21, -26], [21, -17.5], [12.5, -26]], 81, 4, .1, false);
  g.sheetLines = [[-15, -19, 6, 2.8], ...[30, 27, 30, 24, 29, 16].map((w, i) => [-15, -10 + i * 6.8, w - 15, 1.7])].map(([x0, y0, x1, h], i) => cut([[x0, y0], [x1, y0], [x1, y0 + h], [x0, y0 + h]], 82 + i, 6, .12, false));
  g.strip = cut([[-20, -8], [20, -8.4], [20.4, 8], [-20, 8.4]], 90, 7, .3, false);
  g.stripLines = [[-15, -3.4, 12], [-15, 2.4, 6]].map(([x0, y0, w], i) => cut([[x0, y0], [x0 + w + 15, y0], [x0 + w + 15, y0 + 1.9], [x0, y0 + 1.9]], 91 + i, 6, .12, false));
  // ---- 头（头坐标：脖子关节为原点；下巴 (0,-4)，头顶 -150，和帕秋莉同一套比例） ----
  // 圆脸：两颊鼓、下巴小
  g.face = cut([[0, -4], [13, -6], [29, -13], [45, -27], [57, -46], [63, -70], [64, -98], [59, -124], [42, -142], [0, -150], [-42, -142], [-59, -124], [-64, -98], [-63, -70], [-57, -46], [-45, -27], [-29, -13], [-13, -6]], 100, 7, .5);
  // 后发：齐下巴的 bob，两侧微微外翘；顶部藏在帽子里
  const bSide = rOpen([[0, -172], [44, -167], [66, -148], [76, -114], [79, -76], [78, -42], [80, -18]], 5);
  const bTips = [[86, -3], [72, -10], [64, 1], [52, -10], [38, -2], [22, -10], [0, -6]];
  g.backHair = cut([...bSide, ...bTips, ...rMirror([...bSide, ...bTips.slice(0, -1)])], 101, 8, .7, false);
  // 鬓发（耳侧碎发）：帽檐下垂到下巴，发梢尖，压在脸的两颊外缘
  const lockR = [...rOpen([[46, -134], [63, -124], [71, -98], [73, -66], [71, -38]], 4), [70, -10], [63, -28], [59, -12], [55, -36], ...rOpen([[56, -62], [56, -92], [49, -122]], 4)];
  g.lockR = cut(lockR, 102, 6, .5, false); g.lockL = cut(rMirror(lockR), 103, 6, .5, false);
  // 刘海：盖住额头，下缘一排尖压到眼睛上沿，发尖略往右扫；顶部藏在帽檐下
  g.bangs = cut([[-70, -158], [70, -158], [69, -114], [65, -86], [58, -100], [52, -77], [43, -96], [33, -79], [24, -97], [14, -80], [5, -96], [-5, -79], [-15, -95], [-25, -78], [-35, -94], [-45, -77], [-54, -98], [-62, -84], [-68, -112]], 104, 6, .5, false);
  g.bangLines = [[33, -79, 28, -126], [5, -96, 2, -134], [-25, -78, -28, -128], [52, -77, 50, -120], [-45, -77, -50, -118]].map(([x0, y0, x1, y1], i) => cut([[x0 - .9, y0], [x1 - 1.6, y1], [x1 + 1.6, y1], [x0 + .9, y0]], 105 + i, 8, .2, false));
  // 帽子（第三版，按美术意见）：帽身罩住整个头顶、两侧顺着头往下包到太阳穴，盖住所有头发的顶部；
  // 帽檐是绕头一圈的布带，正面看是一道往后仰的弧（ranBand），帽身下沿贴着这道弧收进去；两角拱起成狐耳。
  // 体积：帽身底色偏灰，左上一片受光的亮面，褶子从帽檐往上往外散。
  const domeTop = [[86, -112], [90, -136], [88, -160], [79, -182], [62, -197], [32, -204], [0, -205], [-32, -204], [-62, -197], [-79, -182], [-88, -160], [-90, -136], [-86, -112]];
  const domeBot = []; for (let k = 0; k <= 16; k++) { const x = -86 + k / 16 * 172; domeBot.push([x, ranBand(x) - 4]); }
  g.dome = cut([...domeTop, ...domeBot], 114, 8, .6);
  const litC = [-20, -176], lit = [...domeTop, ...domeBot].map(([x, y]) => { const f = .9 - .14 * clamp((x + 10) / 96, 0, 1) - .08 * clamp((y + 150) / 40, 0, 1); return [litC[0] + (x - litC[0]) * f, litC[1] + (y - litC[1]) * f - 2]; });
  g.domeLit = cut(lit, 119, 8, .5);
  g.capFolds = [-64, -38, -13, 13, 38, 64].map((x, i) => { const y0 = ranBand(x) - 6, x1 = x * 1.28, y1 = y0 - 34 + Math.abs(x) * .1, xm = lerp(x, x1, .5) + x * .04, ym = lerp(y0, y1, .5);
    return cut([[x - 1.6, y0], [xm - 1, ym], [x1, y1], [xm + 1, ym], [x + 1.6, y0]], 115 + i, 8, .2, false); });
  // 狐耳：从帽身两角拱出来（根部藏在帽身后面），耳内金黄
  const ear = [[28, -194], [46, -232], [58, -250], [71, -224], [84, -172]], earIn = [[44, -196], [52, -224], [58, -238], [66, -218], [74, -188]];
  g.earR = cut(ear, 110, 6, .45, false); g.earL = cut(rMirror(ear), 111, 6, .45, false);
  g.earInR = cut(earIn, 112, 5, .3, false); g.earInL = cut(rMirror(earIn), 113, 5, .3, false);
  // 帽前的金黄符纸
  g.patch = cut([[-12, -160], [12, -160], [11, -191], [0, -195], [-11, -191]], 120, 6, .3, false);
  g.patchRim = cut([[-14, -158.5], [14, -158.5], [13, -192.5], [0, -197.5], [-13, -192.5]], 121, 6, .3, false);
  g.patchMarks = [cut([[-7, -170], [7, -170], [7, -168], [-7, -168]], 122, 4, .1, false), cut([[-4.6, -177], [4.6, -177], [4.6, -175], [-4.6, -175]], 123, 4, .1, false), cut([[-7, -184], [7, -184], [7, -182], [-7, -182]], 124, 4, .1, false), cut([[-1, -170], [1, -170], [1, -184], [-1, -184]], 125, 5, .1, false)];
  // 帽檐：绕头一圈的布带，上缘小荷叶往上翘，下缘大荷叶垂在刘海上
  const bandTop = rScallop(u => { const x = lerp(-92, 92, u), v = x / 92; return [x, ranBand(x) - 8 - 3 * v * v]; }, 15, 2.2);
  const bandBot = rScallop(u => { const x = lerp(93, -93, u); return [x, ranBand(x) + 8]; }, 13, 5);
  g.capFrill = cut([...bandTop, ...bandBot], 126, 4, .45, false);
  // 表情道具：汗滴
  g.sweat = cut(RIG_SHAPES.sweat.map(([x, y]) => [x * 1.3, y * 1.3]), 130, 3, .2);
  return g;
})();

// ===================== 表情 =====================
// 字段同帕秋莉：lid 眼睑盖住眼睛的比例，lidTilt 眼睑外端下垂（负：外端上挑），es 眼睛大小，brow [上移, 内端下压角]，mouth 嘴型，blush 腮红，chin 下巴抬(-)，sweat 冷汗
// 蓝是沉稳的半垂眼：平时眼睑盖住四成、外端略挑；proud 更垂
const RAN_MOODS = {
  normal: { lid: .4, lidTilt: -.03, es: 1, brow: [0, .06], mouth: 'flat', blush: .8 },
  happy: { eye: 'up', brow: [2, -.08], mouth: 'smile', blush: 1.1 },
  surprised: { lid: 0, lidTilt: 0, es: 1.12, brow: [6, -.1], mouth: 'o', blush: .9 },
  awkward: { lid: .24, lidTilt: .07, es: 1.03, brow: [2, -.3], mouth: 'wave', blush: 1.5, sweat: true },
  proud: { lid: .56, lidTilt: -.05, es: 1, brow: [2, .06], mouth: 'smirk', blush: .8, chin: -.12 },
};
const RAN_MOOD_ALIAS = { smile: 'happy', flustered: 'awkward', panic: 'awkward', pout: 'awkward', cry: 'awkward', sad: 'awkward', smug: 'proud', confused: 'surprised', calm: 'normal', annoyed: 'normal', angry: 'normal', sleepy: 'normal' };
const RAN_POSE_ALIAS = { lecture: 'point', cheer: 'point', hold: 'read', lift: 'read', give: 'present', hand: 'present', hide: 'bow', slump: 'bow', tired: 'bow', cross: 'stand', proud: 'stand', sit: 'stand', lie: 'stand', peek: 'stand', fly: 'stand', walk: 'stand', run: 'stand', parasol: 'stand' };
// 嘴：借两位的嘴型（o 用琪露诺的，其余用帕秋莉的），放大 1.3 倍配头坐标（同帕秋莉）。他们返回的颜色是色值，rig 要颜色键（mouth / mouthIn），这里换回来
function ranMouthPts(type, open) {
  const [pts, col, tg] = (type === 'o' ? cirMouthPts : pchMouthPts)(type, open), sc = p => p.map(([x, y]) => [x * 1.3, y * 1.3]);
  return [sc(pts), col === PCH_K.mouthIn || col === CIR_K.mouthIn ? 'mouthIn' : 'mouth', tg ? sc(tg) : tg];
}

// ===================== 姿势 =====================
// 手臂 [a, b, 手型, 标记, 上臂拉长, 前臂拉长]：标记 late 画在脸外面；手型 none 手藏在袖子里
// paper：sheet 一张纸（read）| strip 纸条（present）；tail0：尾巴固定垂下（think）；lean 上身前倾，sink 头下沉
// ranIK：肩 (±28, -200)（上身坐标）到腕 (tx, ty)，上臂 L1、前臂 L2，肘往外、往下弯（up = true：肘在下、前臂往前上方伸）→ [a, b]；sd = -1 是后手（屏幕左边那只，facing=1）
function ranIK(sd, tx, ty, L1 = RAN_UP, L2 = RAN_FORE, up = false) {
  const X = sd * tx - RAN_SH[0], Y = ty - RAN_SH[1], d = clamp(Math.hypot(X, Y), Math.abs(L1 - L2) + .01, L1 + L2 - .01);
  const a = Math.atan2(X, Y) + (up ? -1 : 1) * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), ex = L1 * Math.sin(a), ey = L1 * Math.cos(a);
  return [sd * a, sd * (Math.atan2(X - ex, Y - ey) - a)];
}
// 纸（read）在上身坐标里的中心；两只手腕在纸的左右边外一点，手指扣到纸边上
const RAN_SHEET = [0, -176];
function ranPose(pose, g, tt) {
  switch (pose) {
    case 'read': return { back: [...ranIK(-1, -24, -166), 'grip', false], front: [...ranIK(1, 24, -166), 'grip', false], paper: 'sheet', hr: .1, turn: .1, look: 0, lookY: 2.5 };
    case 'point': return { back: [...ranIK(-1, 9, -170), 'none', false], front: [lerp(1.1, 1.5, g), lerp(.25, .02, g), 'point', false, lerp(1, 1.12, g), lerp(1, 1.12, g)], hr: -.04, turn: .3, look: .6, lean: .03 * g };
    case 'present': return { back: [...ranIK(-1, 9, -170), 'none', false], front: [...ranIK(1, 70, -182, RAN_UP, RAN_FORE, true), 'grip', false], paper: 'strip', hr: .02, turn: .25, look: .5, lean: .02 };
    case 'think': return { back: [...ranIK(-1, 26, -167), 'none', false], front: [.2, -2.87, 'point', 'late', .83, 1], tail0: true, hr: -.06, turn: .22, look: .4, lookY: -2.5 };
    case 'bow': return { back: [...ranIK(-1, -2, -180), 'none', false], front: [...ranIK(1, 2, -180), 'none', false], hr: .16, sink: 4, lean: .05, turn: .08, look: 0, lookY: 3 };
    // 揣袖：两只手交叉，各揣在对面的袖子里；前手压在后手上面
    default: return { back: [...ranIK(-1, 9, -170), 'none', false], front: [...ranIK(1, 9, -172), 'none', false], turn: .12, look: .1 };
  }
}

// ===================== 部件表 =====================
// 手：拿着纸的那只手不跟袖子一层画（另画在纸上，见 ranGrip）
const ranHandPart = (k, A) => { const nm = RAN_RIG.arm.hands[A.hand]; return !nm || (k.ps.paper === 'sheet' || (k.ps.paper === 'strip' && A.sd > 0)) ? null : RAN_G[nm]; };
// 一条手臂从下到上：手、上臂袖、前臂喇叭袖、袖褶、袖口荷叶边（手在袖子里面）
const ranArm = f => ({ arms: f, order: 'arm', sh: 'mid', items: [[ranHandPart, 'hm', 'skin'], ['sleeveU', 'uD', 'robe'], ['sleeveF', 'lD', 'robe'], ['sleeveFolds', 'lD', 'fold', false], ['cuff', 'hm', 'frill']] });
// 拿纸的手：裁在纸的轮廓里画，袖子和手腕在纸后面，只有扣到纸边上的手指露在纸前面
function ranGrip(k) {
  const c = k.c, M = k.B.paper, sheet = k.ps.paper === 'sheet', clip = sheet ? RAN_G.sheet : RAN_G.strip, items = [];
  for (const A of sheet ? [k.AB, k.AF] : [k.AF]) { const nm = RAN_RIG.arm.hands[A.hand]; if (nm) items.push({ p: RAN_G[nm], m: A.hm, col: k.K.skin }); }
  const T = c.getTransform(); c.save(); c.transform(M[0], M[1], M[2], M[3], M[4], M[5]); c.clip(clip); c.setTransform(T);
  k.paint(items, RIG_SH.tiny, false); c.restore();
}
const RAN_TAIL_ORDER = [0, 8, 1, 7, 2, 6, 3, 5, 4];
const ranTailLayer = i => ({ items: [['tail', 'tail' + i, i % 2 ? 'tailAlt' : 'tail'], ['tailCore', 'tail' + i, 'tailLight', false], ['tailLines', 'tail' + i, 'tailDeep', false], ['tailTip', 'tail' + i, 'tailTip', false]], sh: 'wing' });
const RAN_RIG = {
  name: 'ran', h: 500, height: 520, K: RAN_K, G: RAN_G, cut: RAN_CUT,
  moods: RAN_MOODS, moodAlias: RAN_MOOD_ALIAS, poseAlias: RAN_POSE_ALIAS, pose: ranPose, mouth: ranMouthPts,
  idleGesture: tt => .6 + .3 * Math.sin(tt * 1.2),
  headSway: [.012, 1, 1],
  face: { style: 'layered', ex: 28, ey: -54, far: .28, turnX: 12, rx: 13, ry: 16, lookX: 3.4, mouthY: -24, mouthTurn: 13,
    blush: { dx: 14, turn: 1, y: -30, bump: 1, rx: 10, ry: 5, hatch: true }, brow: { x: 28, y: -86, len: 8.5, seed: 98, th: [1.6, 1.4, .2, 1.1, 1.6] } },
  arm: { parent: 'ug', shoulder: RAN_SH, upper: RAN_UP, fore: RAN_FORE, mirrorHand: true, tips: { open: [0, 13 * RAN_HAND], point: [0, 22 * RAN_HAND], grip: [0, 7 * RAN_HAND], none: [0, 4] },
    hands: { open: 'handOpen', point: 'handPoint', grip: 'handGrip', none: null } },
  vars(k) {
    const { ps, tt, o } = k;
    k.sway = .007 * Math.sin(tt * 1.2) + .004 * Math.sin(tt * 2.7);
    k.breath = 1 * Math.sin(tt * TAU / 3);
    k.lean = ps.lean || 0;
    k.ugL = rTR(rPivot(R_I, 0, RAN_WAIST, k.lean), 0, -k.breath);
    k.tl = ps.tail0 ? 0 : clamp(o.tails == null ? .3 : o.tails, 0, 1);
  },
  bones: [
    { name: 'root', rot: k => k.sway },
    { name: 'body', parent: 'root', scale: [RAN_BODY, RAN_BODY] },
    { name: 'ug', parent: 'body', local: k => k.ugL },
    { name: 'head', parent: 'ug', at: k => [0, RAN_NECK + (k.ps.sink || 0)], rot: k => k.hr, scale: [RAN_HEAD, RAN_HEAD] },
    // 九条尾巴：根在腰后，扇形散开；tails 越大越往上翘、越收拢；左边几条形状镜像。中间几条短、藏在头后，外侧几条从身子两边露出来
    ...Array.from({ length: 9 }, (_, i) => {
      const j = i - 4, aj = Math.abs(j) / 4;
      // 转角：中间那条朝上（藏在头后），两侧各四条从 A0 起每条再往外 dA；tails 越大越往上收，think 时垂下
      const sg = j > 0 ? 1 : j < 0 ? -1 : 0, n = Math.abs(j) - 1;
      return { name: 'tail' + i, parent: 'body', at: [j * 1.5, -140],
        rot: k => sg * (k.ps.tail0 ? 1 + .3 * n : lerp(.85, .5, k.tl) + lerp(.24, .2, k.tl) * n),
        sway: k => [.03 + .02 * k.tl, 1.1 + i * .06, i * .9],
        scale: k => { const sg = j < 0 ? -1 : 1, w = [1, .94, 1.04][i % 3] * lerp(1, .92, aj), l = lerp(.9, 1.03, aj) * lerp(1, 1.06, k.tl) * [1, .96, 1.02][(i + 1) % 3]; return [sg * w, l]; },
        spring: { len: 90, dir: -Math.PI / 2, gain: .5, f: 1.6 + i * .05, max: .2 } };
    }),
    { name: 'skirt', parent: 'body', pivot: [0, RAN_WAIST], rot: k => k.lean * .5, spring: { len: 100, gain: .4, f: 1.8, max: .12 } },
    { name: 'tassel', sides: true, parent: 'ug', at: (k, sd) => [sd * 21, -51], rot: (k, sd) => sd * .08, sway: (k, sd) => [.07, 1.7, sd * 1.3], spring: { len: 32, gain: .8, f: 2.4, max: .4 } },
    { arms: true },
    // 纸：read 固定在胸前（两只手腕摆在纸的左右边外），present 接在前手的握点上、顺着前臂往外伸
    { name: 'paper', when: k => k.ps.paper, m: k => k.ps.paper === 'sheet' ? rTR(k.B.ug, RAN_SHEET[0], RAN_SHEET[1], .02 * Math.sin(k.tt * 1.3))
      : rTR(k.AF.hm, 0, 21, Math.PI / 2 + .04 * Math.sin(k.tt * 1.7)) },
    { name: 'faceM', parent: 'head' },
    { name: 'browM', parent: 'head' },
    { name: 'lock', sides: true, parent: 'head', pivot: (k, sd) => [sd * 54, -122], rot: k => -k.hr * .5, sway: (k, sd) => [.02, 1.5, sd], spring: { len: 80, gain: .7, f: 2.3, max: .3 } },
    { name: 'bangs', parent: 'head', at: k => [k.turn * 5, 0] },
    { name: 'cap', parent: 'head', at: k => [k.turn * 4, 0] },
    { name: 'capTop', parent: 'cap', pivot: [0, -152], sway: [.01, 1.3, .4], spring: { len: 60, dir: -Math.PI / 2, gain: .4, f: 2.6, max: .08 } },
    { name: 'ear', sides: true, parent: 'capTop', pivot: (k, sd) => [sd * 56, -194], sway: (k, sd) => [.03, 1.9 + sd * .3, sd * 1.1] },
    { name: 'sweatM', when: k => k.md.sweat, parent: 'head', at: k => [66, -110 + 3 * ((k.tt * 2) % 1)], rot: .15 },
  ],
  layers: [
    // 九尾（最远的最先画，每条自己一层投影）
    ...RAN_TAIL_ORDER.map(ranTailLayer),
    { items: [['backHair', 'head', 'hairBack']], sh: 'big' },
    // 腿、靴、裙、衬裙
    { items: [['legL', 'body', 'sock'], ['legR', 'body', 'sock']], sh: 'tiny' },
    { items: [['bootL', 'body', 'boot'], ['bootR', 'body', 'boot']], sh: 'mid' },
    { items: [['soleL', 'body', 'bootSole', false], ['soleR', 'body', 'bootSole', false], ['bootTop', 'body', 'bootSole', false]], gr: false },
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
    // 手臂：后手先、前手压在上面（think 的前手最后画在脸前面）。袖子和袖口同一层
    { ...ranArm(A => A.sd < 0 && A.flag !== 'late') },
    { ...ranArm(A => A.sd > 0 && A.flag !== 'late') },
    // 纸和纸条压在袖子前面，拿纸的手指再扣到纸边上
    { when: k => k.ps.paper === 'sheet', items: [['sheet', 'paper', 'paper']], sh: 'mid' },
    { when: k => k.ps.paper === 'sheet', items: [['sheetCorner', 'paper', 'paperFold', false], ['sheetLines', 'paper', 'paperInk', false]], gr: false },
    { when: k => k.ps.paper === 'strip', items: [['strip', 'paper', 'paper']], sh: 'mid' },
    { when: k => k.ps.paper === 'strip', items: [['stripLines', 'paper', 'paperInk', false]], gr: false },
    { when: k => k.ps.paper, call: ranGrip },
    // 脸、前发、眉毛
    { items: [['face', 'head', 'skin']], sh: 'mid' },
    { call: 'face' },
    { items: [['lockL', 'lockL', 'hair'], ['lockR', 'lockR', 'hair'], ['bangs', 'bangs', 'hair']], sh: 'mid' },
    { items: [['bangLines', 'bangs', 'hairLine', false]], gr: false },
    { call: 'brows' },
    // 帽子：狐耳（根藏在帽身后）、帽身（底色 + 左上亮面）、褶、符纸、帽檐
    { items: [['earL', 'earL', 'cap'], ['earR', 'earR', 'cap']], sh: 'mid' },
    { items: [['earInL', 'earL', 'earIn', false], ['earInR', 'earR', 'earIn', false]], gr: false },
    { items: [['dome', 'capTop', 'capShade']], sh: 'big' },
    { items: [['domeLit', 'capTop', 'cap', false]], gr: false },
    { items: [['capFolds', 'capTop', 'capFold', false]], gr: false },
    { items: [['patchRim', 'cap', 'patchInk', false], ['patch', 'cap', 'patch', false]], sh: 'tiny', gr: false },
    { items: [['patchMarks', 'cap', 'patchInk', false]], gr: false },
    { items: [['capFrill', 'cap', 'frill']], sh: 'mid' },
    // think 的前手在脸前：手指压在袖口外面点着下巴
    { arms: A => A.flag === 'late', order: 'arm', sh: 'mid', items: [['sleeveU', 'uD', 'robe'], ['sleeveF', 'lD', 'robe'], ['sleeveFolds', 'lD', 'fold', false], ['cuff', 'hm', 'frill'], [ranHandPart, 'hm', 'skin']] },
    { when: k => k.md.sweat, items: [['sweat', 'sweatM', 'sweat']], sh: 'tiny' },
  ],
  anchors(k) {
    const { AB, AF, B } = k, hands = [AB.tip, AF.tip].sort((a, b) => a[0] - b[0]);
    return { head: rApply(B.head, [0, -70]), hands, tip: AF.tip, hold: B.paper ? rApply(B.paper, [0, 0]) : [(AB.tip[0] + AF.tip[0]) / 2, (AB.tip[1] + AF.tip[1]) / 2] };
  },
};

function drawRan(c, o = {}) { return drawRig(c, RAN_RIG, o); }
