纯代码做一集东方视频 · Touhou, Drawn in Code · コードで描く東方

只用 JavaScript 和 Canvas 2D 做一集有配音、有配乐的东方同人科普视频的模板。没有图片素材，没有 AI 生图。

**附件**

- `touhou-code-video-template.mp4`：97 秒演示片，1920×1080，30fps，带油库里语音和八音盒 BGM，由 CI 用无头 Chromium 逐帧渲染。
- `touhou-code-video-template.html`：同一部片子的单文件网页版，浏览器打开就能实时播放，拖到任意一秒。

**这一版有什么**

- 十四个剪纸 Q 版角色，同一套约 2.4 头身的比例：博丽灵梦、雾雨魔理沙、芙兰朵露、古明地恋、魂魄妖梦、十六夜咲夜、蕾米莉亚、古明地觉、藤原妹红、琪露诺（2024–2026 三届东方人气投票前十），以及帕秋莉、红美铃、八云紫、八云蓝。
- 逐帧引擎：每帧只由时间决定，可以跳到任意一秒，也可以切段并行渲染。
- 十个可复用的亮点特效、AquesTalk 语音工具链、角色曲改编 BGM 工具、抽帧和重叠检查脚本。
- 给 AI agent 读的 `AGENTS.md` 和 `llms.txt`。

**English.** A template for making a voiced Touhou Project fan explainer video in pure JavaScript + Canvas 2D: 14 procedural paper-cut chibi characters, AquesTalk (Yukkuri) voice, music-box BGM, deterministic MP4 renderer. No image assets, no AI art. Attached: the 97-second demo (MP4) and a single-file HTML version that plays live in the browser.

项目页 / Project page: https://fish2lab.github.io/touhou-code-video-template/

东方 Project 角色版权属于上海爱丽丝幻乐团（ZUN），本仓库是同人工具，不是官方内容。
