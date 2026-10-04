'use strict';
// 全片时间线：scenes/*.js 各自 scene({...}) 登记，这里按 order 排好，并在每帧最后画字幕。
// ?scene=sleep 或 ?scene=sleep,diet 只放这几段（开发用）；?nosub 不画字幕。
{
  const only = Q.get('scene'), noSub = Q.has('nosub');
  defineFilm(SCENES.slice().sort((a, b) => a.order - b.order).filter(s => !only || only.split(',').includes(s.key)));
  OVERLAY = (c, s, tau, cur) => { if (s.start > 0 && !s.noFlip) turnPage(c, tau / .8); if (!noSub && cur && !s.noSub) drawSubtitle(c, cur, tau); };
  mountPlayer();
}
// 字幕（第二版）：书页底部一条剪下来的纸条，上面一行手写字。说话人不是帕秋莉时前面加名字。
const WHO_NAME = { cirno: '琪露诺' };
function drawSubtitle(c, cur, tau) {
  const a = Math.min(sm(cur.t0, cur.t0 + .12, tau), 1 - sm(cur.t1 - .1, cur.t1, tau));
  if (a <= 0) return;
  const size = 44, who = cur.o.who && cur.o.who !== 'patchouli' ? (WHO_NAME[cur.o.who] || cur.o.who) + '：' : '', text = who + cur.text;
  const tw = zhWidth(c, text, size), bw = Math.min(W - 160, tw + 70), bx = CX - bw / 2, by = STAGE.sub.y - size - 8, bh = size + 36;
  c.save(); c.globalAlpha = a;
  cutPaper(c, [[bx, by + 3], [bx + bw, by], [bx + bw - 6, by + bh], [bx + 5, by + bh - 2]], '#f7f3ea', { seed: 7 + Math.floor(cur.t0 * 10), step: 40, blur: 6 });
  zh(c, text, CX, STAGE.sub.y + 4, { size, color: P.ink, align: 'center' });
  c.restore();
}
// pageFlip：每段开头 0.6 秒，魔导书页像翻书一样从右往左翻过去（段与段之间的转场）。
// 段首本来就是空白讲台画面，翻过去的那张纸画的也是空白页，所以翻完无缝。
function pageFlip(c, tau) {
  const D = .6; if (tau >= D) return;
  const u = easeIO(tau / D), { x, y, w, h } = STAGE.board, cw = w * Math.cos(u * Math.PI), lift = Math.sin(u * Math.PI) * 40;
  const X = cw >= 0 ? x : x + cw, ww = Math.abs(cw);
  if (ww < 2) return;
  c.save();
  c.fillStyle = alpha('#000', .25 * Math.sin(u * Math.PI)); c.fill(polyPath([[x, y], [x + cw, y - lift], [x + cw, y + h + lift], [x, y + h]]));
  const pts = [[x, y], [x + cw, y - lift], [x + cw, y + h + lift], [x, y + h]];
  c.fillStyle = cw >= 0 ? P.paper : mix(P.paper, P.paperEdge, .5); c.strokeStyle = P.paperEdge; c.lineWidth = 5;
  c.fill(polyPath(pts)); c.stroke(polyPath(pts));
  const g = c.createLinearGradient(X, 0, X + ww, 0); g.addColorStop(0, alpha(P.paperEdge, cw >= 0 ? 0 : .5)); g.addColorStop(1, alpha(P.paperEdge, cw >= 0 ? .5 : 0));
  c.fillStyle = g; c.fill(polyPath(pts));
  c.restore();
}
// 穿模检查（开发用）：?bbox 在两人身上画红框；?nochar 不画人物、只记包围框（tools/overlap.mjs 用）。
// 包围框按锚点和身高估：帕秋莉宽 0.5h，琪露诺连翅膀宽 0.7h；在当前变换下换算成屏幕坐标，记进 __boxes。
if (Q.has('bbox') || Q.has('nochar')) {
  const noChar = Q.has('nochar'), W0 = { patchouli: .5, cirno: .7 };
  window.__boxes = [];
  const wrap = (fn, who) => (c, o = {}) => {
    const h = o.h || (who === 'cirno' ? 460 : 520), w = h * W0[who], x = o.x || 0, y = o.y || 0, m = c.getTransform(), al = c.globalAlpha;
    const pts = [[x - w / 2, y - h], [x + w / 2, y - h], [x - w / 2, y], [x + w / 2, y]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    if (al > .3) __boxes.push({ who, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    let r; if (noChar) { c.save(); c.globalAlpha = 0; r = fn(c, o); c.restore(); } else r = fn(c, o);   // 场景会用返回的锚点，照样调用、只是不画
    if (Q.has('bbox')) { c.save(); c.setTransform(m); c.strokeStyle = '#e00'; c.lineWidth = 3; c.strokeRect(x - w / 2, y - h, w, h); c.restore(); }
    return r;
  };
  drawPatchouli = wrap(drawPatchouli, 'patchouli'); drawCirno = wrap(drawCirno, 'cirno');
}
