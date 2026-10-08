# AGENTS.md

## 这个仓库做什么

「纯代码做一集东方科普视频」的模板：Canvas 2D 剪纸风逐帧引擎 + 七个剪纸角色（帕秋莉、琪露诺、八云蓝、八云紫、红美铃、蕾米莉亚、古明地觉，**全员统一头和身子的大小（Q 版约 2.4 头身，样板是帕秋莉，规格见 docs/rig.md）**；rig.js 是后五位共用的人偶引擎，样张页 character.html，无图形界面时用 `node tools/sheet.mjs --who 名字` 截图）+ 油库里语音 + 角色曲改编的 BGM + 出片工具链。没有外部美术资源，没有 AI 生图，每一笔都是 JavaScript 画的。`src/scenes/` 里现在是五段演示，新开一集就是把它们换成自己的内容。教程见 `docs/教程.md`。

## 开新一集

1. 复制本仓库（GitHub 上 Use this template）。改 `package.json` 的 `name` 和 `description`，改 `index.html` 的 `<title>`，改 `.github/workflows/publish.yml` 里的文件名。
2. 先写文档再写代码：`docs/方案.md`（目的、主线、台词、取舍）→ `docs/分镜.md`（每段画什么）→ `docs/施工.md`（工作包和接口）。模板在 `docs/` 里。
3. 主会话先做一个样板段，把这一集的视觉隐喻和节奏定死；再按文件拆包并行（每段一个文件、一个 git worktree）。
4. 每段写完：`node tools/overlap.mjs --scene 段名` → `node tools/frames.mjs --scene 段名 --grid 24` → 看图。
5. 改了台词：`npm run voice`（要提交生成的 `src/voice-data.js`）。出片：`npm run render`。
6. BGM：换成这一集主讲角色（或首次登场角色）的角色曲，`npm run bgm -- 扒谱.mid`（要提交生成的 `src/bgm-data.js`），步骤见 `docs/教程.md`「背景音乐」。

## 规则（沿用这个系列的做法）

- **画面是时间的纯函数**：每帧只由 tau 决定，不存状态，不用 `Math.random()`（用 `hash`/`rng`），不在逐帧绘制里用 `c.filter`（慢几十倍）。
- **顶层名字带本段前缀**，所有脚本共用一个全局作用域。
- **每集 5 分钟左右**，新概念最多 3 个，每句台词只引入一个新画面元素，关键句说完画面停约 1.2 秒，屏幕上只写正在念的关键词。
- **每段一个主物件**撑到底、逐句变形，不要每句换一张新图。段与段之间用形状接形状。
- **人物不和道具、字重叠**，除非是设计好的接触。
- **不要过度测试**：不搭 E2E，不为覆盖率写测试；验收靠实际看抽帧和成片。CI 只有一条：构建 + 部署。
- 角色全部纯代码绘制，不引入参考图；参考图不进仓库、不进构建产物。
- 知识类内容标出处；不写医疗诊断和药物剂量建议。
- **用亮点特效**：`src/fx/` 里 10 个现成的特效（总览 `docs/亮点.html`，样张 `fx.html?fx=<id>`）。index.html 加 `src/fx/_fx.js` 和要用的模块，整段放映 `fxScene({ id, lines, over })`，当零件画 `fxPlay(id, c, tau, { box, t0, speed })`。用法详见 `src/fx/_fx.js` 头注释。
- **BGM 一律用相关角色的角色曲**：取扒谱的音符，用 `core.js` 的 `score()` 编配成八音盒版，不放原曲录音，不用无关的曲子。MIDI 不进仓库，发布文案写明原曲和扒谱出处。
- **提交即推送**：`git commit` 之后默认接着 `git push` 到当前分支（通常是 main），不再单独问。推送前确认没有 `/Users/`、会话 ID、私人材料；要改写历史的操作（`--force`、`rebase` 已推送的提交）仍先问。
