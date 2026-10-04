# 人偶引擎 rig

`src/rig.js` 画所有角色，角色文件只放部件表，`drawXxx(c, o) = drawRig(c, 表, o)`。

## 部件表字段

- `K` 颜色，`G` 载入时剪好的部件（`rigCutter(种子偏移)`）
- `moods` 表情，`pose(姿势, g, tt)` 姿势，`mouth` 嘴型，`face` 五官尺寸（`lid` 或 `round` 两种眼睛）
- `arm` 肩位、臂长、手型
- `vars` 呼吸、晃动
- `bones` 骨头：`parent`、`at`、`rot`、`pivot`、`scale`、`sway`、`spring`、`sides`，字段可写成 `(k, sd) =>`
- `layers` 从后往前：`[部件, 骨头, 颜色键]`，`sh` 投影，`arms` 按手臂展开
- `anchors` 返回锚点

## 加一个角色

1. 复制 `remilia.js`，改前缀和种子偏移
2. 改颜色和部件轮廓，骨架尺寸先照抄
3. 从现有角色借嘴型、手型
4. `character.html` 的 `CH` 表加一项（fn、poses、moods），打开 `character.html?who=名字` 看样张

## 弹簧和光照

- 弹簧：`o.track = t => [x, y]` 给出锚点轨迹，挂件滞后 = 过去 0.5 秒加速度的阻尼加权和，纯函数。`spring = { len, dir, gain, f, zeta, max }`，不传 `track` 就没有弹簧。
- 光照：`o.light = { dir, warm, level }`。每片纸涂受光色，背光一侧剪一条背光带（短边 20%），投影落在光的对面，不传时和原来一样。

## 耗时

单个人偶约 5 ms/帧，开光照约 7 ms/帧（2026-09-30 实测）。
