# 纯代码做一集东方视频（模板）

一个能直接开工的模板：**没有外部美术资源，没有 AI 生图**，整集科普视频的每一笔都是 JavaScript 在 Canvas 上画的——剪纸风的魔导书舞台、六个剪纸角色（帕秋莉、琪露诺、八云蓝、八云紫、红美铃、蕾米莉亚，统一身高）、手写字、油库里配音、背景音乐，最后逐帧渲染成 1080p MP4。

出自「帕秋莉讲座」系列（[第 1 集](https://github.com/fish2lab/patchouli-lecture-1)、[第 2 集](https://github.com/fish2lab/patchouli-lecture-2)、[第 3 集](https://github.com/fish2lab/patchouli-lecture-3)）。本仓库把引擎、画具、角色和工具链抽出来，换成一段 80 秒的演示，讲的就是「这套东西怎么做」。

## 快速开始

需要 Node.js 20+、ffmpeg（出片和配音要用）。

```sh
npm install && npm run font     # 装依赖，下载字体
open index.html                 # 浏览器直接看；?scene=time 只放一段；空格暂停，←/→ 跳 5 秒
```

```sh
node tools/frames.mjs --grid 24          # 抽全片联系表 → out/frames/film-grid.jpg
node tools/overlap.mjs --scene time      # 穿模检查
npm run build                            # 单文件网页 → dist/index.html
npm run voice                            # 改了台词后重新合成配音（要提交 src/voice-data.js）
npm run render                           # 出片 → out/*.mp4
```

第一次跑 Playwright 需要浏览器：`npx playwright install --with-deps chromium`（Linux 服务器上），或者设 `CHROMIUM=/usr/bin/chromium` 用系统自带的。

## 读什么

1. [`docs/教程.md`](docs/教程.md)：给「没碰过这条管线」的人。核心思想「画面 = f(t)」、文件地图、一段怎么写、配音、开发循环、出片原理、常见坑。
2. [`docs/经验.md`](docs/经验.md)：什么让一集耐看，以及第 2、3 集为什么显得单调、怎么避免。
3. [`AGENTS.md`](AGENTS.md)：开新一集的流程和规则。让 AI agent 接手时先让它读这个。
4. [`src/scenes/_scene-template.js`](src/scenes/_scene-template.js)：新段的起手文件。
5. `docs/方案.md`、`分镜.md`、`施工.md`、`发布.md`：每一集要先写的文档模板。

## 目录

```
index.html            页面骨架
src/core.js           逐帧引擎、播放器、声音、台词排布
src/kit.js            画具（剪纸、手绘线、手写字、魔导书舞台…）
src/rig.js              剪纸人偶引擎（数据驱动，红美铃、蕾米莉亚、八云蓝、八云紫用，说明见 docs/rig.md）
src/character/        六个剪纸角色：帕秋莉、琪露诺、八云蓝、八云紫、红美铃、蕾米莉亚（八云紫文件里还有缝隙道具 drawYukariGap）
character.html        角色样张页：?who=ran&sheet=poses 看姿势表，sheet=moods 看表情表
tools/sheet.mjs       样张截图（没有图形界面时用）：node tools/sheet.mjs --who yukari → out/sheets/
fx.html               亮点特效画廊：?fx=nap-fall&t=3.5 看某个特效的某一秒
src/fx/               10 个从第 1–5 集提炼的独立特效模块（头注释写了出处、好在哪、复用、分叉），总览见 docs/亮点.html
tools/fxcheck.mjs     特效联系表：node tools/fxcheck.mjs <id> --n 12 → out/fx/<id>.jpg，页面有报错时退出码为 1
src/props.js          共用站位和道具
src/scenes/           每段一个文件（现在是四段演示）
src/film.js           时间线、字幕、翻页转场
tools/                抽帧、穿模检查、打包、配音、出片
docs/                 教程、经验、各类文档模板
```

## 许可

- 代码：MIT。
- 字体：霞鹜文楷（SIL Open Font License，`fonts/LXGWWenKai-OFL.txt`）。`npm run font` 会下载，不进仓库。
- 语音：AquesTalk（© 株式会社アクエスト），经 [aquestalk.js](https://github.com/y52en/aquestalk.js) 合成；仓库里只有合成出的声音，不含 AquesTalk 本体。发布成片请在片尾或简介注明「AquesTalk（株式会社アクエスト）」。拼音→假名表来自 [yukumo-js](https://github.com/yukumo-group/yukumo-js)（MIT）。
- 东方 Project 的角色版权归上海爱丽丝幻乐团（ZUN）。使用本模板做的是同人作品，请遵守东方 Project 官方的二次创作指南。
