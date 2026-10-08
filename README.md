# 纯代码做一集东方视频

**touhou-code-video-template 是一个开源模板：只用 JavaScript 和 Canvas 2D，不用任何外部美术素材、不用 AI 生图，做出一集带配音和背景音乐的东方 Project 同人科普视频（1080p MP4）。** 里面有逐帧渲染引擎、十四个 Q 版剪纸角色（2024–2026 年东方人气投票前十全员在内）、油库里（AquesTalk）配音、角色曲改编的八音盒 BGM，以及抽帧、穿模检查、出片的命令行工具。

**[介绍网页](https://fish2lab.github.io/touhou-code-video-template/)** · **[92 秒演示片](https://fish2lab.github.io/touhou-code-video-template/film/)** · **[十个特效](https://fish2lab.github.io/touhou-code-video-template/highlights/)** · [教程](docs/教程.md) · [经验](docs/经验.md) · [角色名单](docs/角色名单.md)

![十四位 Q 版剪纸角色并排站立，头和身子一样大](site/media/lineup.jpg)

出自「帕秋莉讲座」系列（[第 1 集](https://github.com/fish2lab/patchouli-lecture-1)、[第 2 集](https://github.com/fish2lab/patchouli-lecture-2)、[第 3 集](https://github.com/fish2lab/patchouli-lecture-3)）。本仓库把引擎、画具、角色和工具链抽出来，换成一段 80 秒的演示，讲的就是「这套东西怎么做」。

> **English.** A template for making a Touhou Project fan explainer video entirely in code: a deterministic Canvas 2D frame engine (every frame is a pure function of time), 14 procedurally drawn paper-cut chibi characters (Reimu, Marisa, Flandre, Koishi, Youmu, Sakuya, Remilia, Satori, Mokou, Cirno, Patchouli, Meiling, Yukari, Ran), Yukkuri-style AquesTalk voice-over, a music-box BGM arranged from character themes, and a headless renderer that pipes frames to ffmpeg. No image assets, no AI-generated art. MIT licensed.
>
> **日本語.** 東方Projectの解説動画を「コードだけ」で作るテンプレートです。Canvas 2D の切り絵風エンジン、14人のSDキャラ（霊夢・魔理沙・フラン・こいし・妖夢・咲夜・レミリア・さとり・妹紅・チルノ・パチュリー・美鈴・紫・藍）、ゆっくりボイス（AquesTalk）、キャラテーマのオルゴールBGM、MP4 書き出しツール付き。画像素材も AI 生成画像も使っていません。

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
npm run bgm -- 角色曲.mid                 # 换 BGM：从扒谱取音符（要提交 src/bgm-data.js），见教程「背景音乐」
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
src/rig.js            剪纸人偶引擎（数据驱动，除帕秋莉、琪露诺外的十二位都用它，说明见 docs/rig.md）
src/character/        十四个剪纸角色：帕秋莉、琪露诺、八云蓝、八云紫、红美铃、蕾米莉亚、古明地觉，以及按人气投票补的灵梦、魔理沙、芙兰朵露、古明地恋、妖梦、咲夜、妹红（名单和依据见 docs/角色名单.md；八云紫文件里还有缝隙道具 drawYukariGap）
character.html        角色样张页：?who=ran&sheet=poses 看姿势表，sheet=moods 看表情表
tools/sheet.mjs       样张截图（没有图形界面时用）：node tools/sheet.mjs --who yukari → out/sheets/
fx.html               亮点特效画廊：?fx=nap-fall&t=3.5 看某个特效的某一秒
src/fx/               10 个从第 1–5 集提炼的独立特效模块（头注释写了出处、好在哪、复用、分叉），总览见 docs/亮点.html；挂进一集：index.html 加 _fx.js 和模块，fxScene / fxPlay 一行调用（见 _fx.js 头注释）
tools/fxcheck.mjs     特效联系表：node tools/fxcheck.mjs <id> --n 12 → out/fx/<id>.jpg，页面有报错时退出码为 1
tools/fxrender.mjs    把一个特效渲染成无声短视频：node tools/fxrender.mjs nap-fall → out/fx/nap-fall.mp4
site/                 介绍网页（单栏极简）和它用的短视频、帧条，Pages 部署时和 film/、highlights/ 拼成站点
src/props.js          共用站位和道具
src/scenes/           每段一个文件（现在是五段演示）
src/film.js           时间线、字幕、翻页转场
src/bgm-data.js       背景音乐的音符（tools/bgm.mjs 从角色曲扒谱里取，core.js 的 score() 编配；现在是帕秋莉的「ラクトガール ～ 少女密室」）
tools/                抽帧、穿模检查、打包、配音、出片
docs/                 教程、经验、各类文档模板
```

## 常见问题

**完全不用图片吗？** 是。角色、背景、字、特效都是 `src/` 里的 Canvas 代码画的；仓库里的位图只有介绍网页和特效总览用的截图、短视频。

**为什么选这十四个角色？** 帕秋莉、琪露诺、红美铃、蕾米莉亚、八云紫、八云蓝、古明地觉来自「帕秋莉讲座」前几集；其余七位是 2024、2025、2026 年三届「東方Project人気投票」人妖部门前十的并集里还没有的角色。名次和出处见 [`docs/角色名单.md`](docs/角色名单.md)。

**能做什么题材？** 任何几分钟的讲解视频。演示片讲的是这套工具本身；系列前三集讲的是大学生的身体调理、学习的预测误差模型、信息论和记忆。换 `src/scenes/` 里的几段文件就是一集新的。

**要会画画吗？** 不用。要会一点 JavaScript。新角色照 `docs/rig.md` 复制一个部件表改颜色和轮廓；新画面照 `src/scenes/_scene-template.js` 写。

**能交给 AI agent 写吗？** 能，这个仓库本身就是这样做的。让 agent 先读 [`AGENTS.md`](AGENTS.md)；给 AI 读的项目摘要在 [`site/llms.txt`](site/llms.txt)。

**渲染要多久？** 92 秒的演示片在 4 核云端机器上开 3 个并行页面约 135 秒。

**可以拿去发 B 站 / YouTube / ニコニコ吗？** 代码是 MIT。成片是东方 Project 二次创作，请遵守官方二次创作指南，并在简介注明 AquesTalk 和原曲出处（见下面「许可」）。

## 许可

- 代码：MIT。
- 字体：霞鹜文楷（SIL Open Font License，`fonts/LXGWWenKai-OFL.txt`）。`npm run font` 会下载，不进仓库。
- 语音：AquesTalk（© 株式会社アクエスト），经 [aquestalk.js](https://github.com/y52en/aquestalk.js) 合成；仓库里只有合成出的声音，不含 AquesTalk 本体。发布成片请在片尾或简介注明「AquesTalk（株式会社アクエスト）」。拼音→假名表来自 [yukumo-js](https://github.com/yukumo-group/yukumo-js)（MIT）。
- 背景音乐：东方红魔乡「ラクトガール ～ 少女密室」（ZUN）的代码改编，音符取自 [touhou-midi-collection](https://github.com/AyHa1810/touhou-midi-collection) 里的 ZUN 原版 MIDI；仓库里只有挑出的音符和我们的编配，不含 MIDI 文件。
- 东方 Project 的角色版权归上海爱丽丝幻乐团（ZUN）。使用本模板做的是同人作品，请遵守东方 Project 官方的二次创作指南。
