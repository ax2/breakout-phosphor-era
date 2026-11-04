# BREAKOUT：磷光纪元 / Breakout: Phosphor Era

手工关卡打砖块。固定 120Hz 步长 + 扫掠碰撞，磷光终端美学，原创程序化音效，
外加远征构筑：一局之内靠三选一形成打法，死亡后保留解锁。

- 网页版：`0.4.0-full`（6 章 48 关 / 6 Boss / 3 模式）
- Windows 版：`0.3.0-stage03`（Godot 4.7.1，**内容已与网页版对齐**：48 关 / 6 Boss / 3 模式 / 构筑）
- 网页版：原生 HTML5，零依赖
- 两版**共用同一份内容数据**：`web/js/content.js` 是唯一源，`tools/port_content.js` 生成 `data/content.json` 给 Godot 读

**在线试玩（免安装）**：https://ax2.github.io/breakout-phosphor-era/
**源码仓库**：https://github.com/ax2/breakout-phosphor-era

---

## 运行

### 方式一：直接在线玩（最省事）

打开 https://ax2.github.io/breakout-phosphor-era/ ，桌面浏览器即可。

### 方式二：Windows 可执行包

从 [Releases](https://github.com/ax2/breakout-phosphor-era/releases) 下载
`BREAKOUT-PhosphorEra-win64-v0.4.0.zip`，解压后双击 `BreakoutPhosphorEra.exe`。

> **`BreakoutPhosphorEra.pck` 必须与 exe 放在同一目录**，只拷 exe 会启动失败。
> 首次运行 Windows 可能弹 SmartScreen（未签名），选择「更多信息 → 仍要运行」。

### 方式三：直接双击 index.html

网页版是纯静态、脚本之间没有模块拆分、也不发 `fetch`，所以在 Chrome / Edge 下
**直接双击 `web/index.html` 就能玩**（实测进入关卡正常、存档可读写）。

如果某个浏览器因本地文件策略拦截，再用下面这条起服务器：

```bash
cd web
python -m http.server 8765 --bind 127.0.0.1
# 打开 http://127.0.0.1:8765/
```

没有 Python 可以用 Node：

```bash
npx serve web -l 8765
```

### 方式四：Godot 编辑器（开发用）

```
godot --path .        # 需要 Godot 4.7.1
```

---

## 操作

| 输入 | 行为 |
|---|---|
| 鼠标移动 / A D / ← → | 移动挡板（两种输入自动仲裁，不会互抢） |
| 空格 / Enter / 鼠标左键 | 发球 |
| ESC / P | 暂停 |
| TAB | 查看本局构筑 |

发球方向由挡板位置决定：场地中线垂直向上，越靠边角度越大（±45°）。

---

## 内容

- 6 章 × 8 关 = 48 个手工关卡，逐关解锁
- 6 个 Boss（2–3 阶段、护甲/弱点窗口）
- 6 个构筑方向 × 6 项升级 = 36 项，全部有实际效果
- 18 件遗物、6 种挡板、12 组协同、12 个事件
- 3 种模式：经典 / 远征 / 无尽
- 8 个成就、五分类图鉴、存档 v3（含迁移）

---

## 目录

```
web/                     网页版（内容源 + 主交付）
  js/core.js             模拟核心：扫掠碰撞、状态效果、构筑属性、Boss 框架
  js/content.js          内容数据：关卡/Boss/升级/遗物/挡板/事件/协同（唯一源）
  js/run.js              三种模式、远征流程、局外进度、存档
  js/render.js           Canvas 绘制与特效
  js/ui.js               界面、音频、主循环
src/                     Godot 版（0.3.0-stage03，内容与网页版对齐）
  core/content_db.gd     读 data/content.json；level_db.gd 转发保持旧接口
  sim/breakout_sim.gd    模拟层：物理 + mods 属性层 + 状态效果 + 被动系统
  sim/boss.gd            Boss 框架与 6 个 Boss 的行为
  game/run_state.gd      远征/三模式/构筑/局外进度（对应 run.js）
  ui/expedition_map.gd   远征路线图；choice_panel.gd 三选一/商店/事件共用
  ui/build_panel.gd      TAB 构筑速览；codex_panel.gd 图鉴
data/content.json        由 web/js/content.js 生成，两版共用
data/levels.json         旧关卡数据源（已废弃，仅作回退）
tools/port_content.js    内容导出脚本
dist/windows/            Windows 导出产物
tests/                   Node 测试（网页）与 GDScript 测试（Godot）
```

---

## 测试

```
godot --headless --path . --script res://tests/test_sim.gd   # 500 项（模拟层）
godot --headless --path . -- --selftest                      # 67 项（内容/Boss/构筑/存档）
node tests/web_core_test.js                                   # 73 项
node tests/web_full_test.js                                   # 515 项
```

---

## 构建

```
node tools\port_content.js          # 从 content.js 生成 data/content.json（改内容后必跑）
python tools\gen_audio.py           # 重新生成音效（已生成）
godot --headless --path . --export-release "Windows Desktop" dist/windows/BreakoutPhosphorEra.exe
```

---

## 素材授权

图形全部代码绘制，音效与音乐全部程序合成，字体调用系统字体不随包分发。
未使用任何第三方美术或音频素材。

---

## 已知限制

- **两端行为仍有两处小分歧**（其余已对齐）：
  1. 「反弹蓄能」升级（k5）在网页版里只写了注释、没有实际累加伤害；Godot 版按描述实现（接球 +1 伤害，上限 +3）。
  2. 网页版「经典」模式是一条穿过 6 章的远征线；Godot 版把「经典远征」做成同一套，另外多给了一个「关卡选择」入口用于单关练习。
- 自动驾驶测试只能跑到「清空 / 击碎 ≥50%」：迷宫里最后一两块需要人为瞄准，测试 AI 不会钻一列宽的竖井。
- 未做真人试玩：Boss 时长、构筑强度、经济曲线没有玩家数据。
- 无尽模式难度主要靠球速与血量，规则变体少。
- 移动端只做了横屏提示与触屏拖动，未真机验收。
- 详细档案：`C:\Users\ax2\Documents\技术博客\breakout-phosphor-era`
