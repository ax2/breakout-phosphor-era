# BREAKOUT：磷光纪元 / Breakout: Phosphor Era

手工关卡打砖块。固定 120Hz 步长 + 扫掠碰撞，磷光终端美学，原创程序化音效，
外加远征构筑：一局之内靠三选一形成打法，死亡后保留解锁。

**同一套核心，三端共用**：`web/` 就是全部游戏实现，桌面端与移动端只是外壳。

| 端 | 形态 | 说明 |
|---|---|---|
| Web | `web/index.html` | 零依赖原生 HTML5，双击即玩 |
| Windows / macOS / Linux | `shells/desktop/`（Electron 42） | 直接 `loadFile` 同一份 `web/`，存档落 `userData/save.json` |
| 移动端 | PWA（`manifest.webmanifest` + `sw.js`） | 全屏横屏、安全区适配、触屏拖动、离线可玩 |

- 网页版：`0.6.0-full`（6 章 48 关 / 6 Boss / 4 模式）
- Godot 版：`0.3.0-stage03`（内容已与网页版对齐，代码仍在仓库里作为第二实现）
- 两版**共用同一份内容数据**：`web/js/content.js` 是唯一源，`tools/port_content.js` 生成 `data/content.json` 给 Godot 读

**在线试玩（免安装）**：https://ax2.github.io/breakout-phosphor-era/
**源码仓库**：https://github.com/ax2/breakout-phosphor-era

---

## 运行

### 方式一：直接在线玩（最省事）

打开 https://ax2.github.io/breakout-phosphor-era/ ，桌面浏览器即可。
手机浏览器打开同一地址，横屏后会提示「添加到主屏幕」，加完就是全屏 App。

### 方式二：Windows 桌面端

直接从 [Releases](https://github.com/ax2/breakout-phosphor-era/releases) 下载
`BREAKOUT-PhosphorEra-win64-v0.6.0.zip`，解压后双击 `BREAKOUT Phosphor Era.exe`。
未签名，首次运行可能弹 SmartScreen，选「更多信息 → 仍要运行」。

自己构建：

```bash
cd shells/desktop
npm install        # 装 Electron 运行时
npm start          # 开发运行
npm run pack       # 打 NSIS 安装包 / 免安装 exe 到 shells/desktop/dist
```

存档在 `%APPDATA%/breakout-phosphor-era/save.json`，与浏览器存档互不影响。

> 打包时 `electron-builder` 默认会联网拉对应版本的 Electron。
> 离线环境可在 `package.json` 的 `build` 里加 `"electronDist": "node_modules/electron/dist"`，
> 直接复用已安装的运行时（本仓库当前就是这么配置的）。
>
> 也保留了早期 Godot 导出包：`dist/BREAKOUT-PhosphorEra-win64-v0.4.0.zip`，
> 解压后 `BreakoutPhosphorEra.pck` 必须与 exe 同目录。

### 方式三：直接双击 index.html

网页版是纯静态、脚本之间没有模块拆分；只有 Service Worker 需要 http(s)，
纯 `file://` 下会自动跳过注册，游戏本体不受影响。

如果某个浏览器因本地文件策略拦截，起个服务器：

```bash
cd web
python -m http.server 8765 --bind 127.0.0.1
# 打开 http://127.0.0.1:8765/
```

没有 Python 可以用 Node：

```bash
npx serve web -l 8765
```

### 方式四：Godot 编辑器（第二实现，开发用）

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
| F | 全屏 |
| TAB | 查看本局构筑 |
| 触屏 | 手指在屏幕任意位置横向拖动，挡板跟随相对位移 |

发球方向由挡板位置决定：场地中线垂直向上，越靠边角度越大（±62°）。

**鼠标移出画面自动暂停**（默认开）：球在飞、指针滑出窗口时挡板会僵在原地，
这是最容易被误判成「游戏 bug」的失球方式。现在移出即暂停，移回自动继续。

---

## 内容

- 6 章 × 8 关 = 48 个手工关卡，逐关解锁
- 6 个 Boss（2–3 阶段、护甲/弱点窗口、独立行为）
- 6 个构筑方向 × 6 项升级 = 36 项，全部有实际效果
- 18 件遗物、6 种挡板、12 组协同、12 个事件
- **4 种模式**：经典 / 远征 / 无尽 / 每日挑战
  - 每日挑战：日期哈希出固定种子 + 7 套规则变体（窄挡板、加速、少命、无掉落…），所有人当天同一副牌
- **8 种掉落物**：多重球、加宽、激光、护盾、磁吸、减速、金砖、加命
- **2 种新砖型**：金砖（G，高分高掉落率）、游走砖（M，横向漂移）
- 8 个成就、五分类图鉴、存档 v3（含迁移）

---

## 视觉与手感

全部程序绘制，零图片素材。v0.6 在此基础上补了一层"打击感"和一层"屏体质感"：

**打击感**

- **缩放冲击**：命中瞬间画面以中心为支点放大 1.4% 再弹回，配合四周压暗，比单纯抖动更"顶"
- **残影解体**：砖块碎掉的瞬间留下同形状的椭圆光团 + 细轮廓，0.15 秒内散开，而不是直接消失
- **球体挤压**：撞击时沿法线压扁 28%，90ms 回弹；高速时球外有两条旋转能量环和速度拉丝
- **连击里程碑**：每 5 连触发一次全屏冲击环，连击越高背景能量雾越亮、扫描越快
- **墙面记忆**：每次撞墙在墙上留一个会消退的光斑

**屏体质感**（设置里可关）

- 预烘焙噪点瓦片、整屏荧光呼吸、边缘色散、Boss 濒死时四周收紧的红色脉冲
- 所有后处理都画在抖动/缩放变换**之外**，否则噪点和暗角会跟着晃，立刻穿帮

**其他细节**

- 每块砖有一条相位错开的掠过光，整片砖墙看起来在"运行"
- 挡板有移动残影和地面能量投影
- 掉落物带彗尾，磁吸时能看到牵引虚线
- Boss 供能节点到核心之间画能量链路（带流动光点），核心外有旋转虚线环

---

## 目录

```
web/                     网页版（= 三端共用的全部游戏实现）
  js/platform.js         平台适配层：存储/震动/安全区/全屏/返回键，三级降级
  js/core.js             模拟核心：扫掠碰撞、状态效果、掉落物、Boss 框架
  js/content.js          内容数据：关卡/Boss/升级/遗物/挡板/事件/协同（唯一源）
  js/run.js              四种模式、远征流程、局外进度、存档
  js/render.js           Canvas 绘制与特效（预烘焙光晕、多边形拖尾、后处理）
  js/ui.js               界面、音频、主循环、输入仲裁
  manifest.webmanifest   PWA 清单（fullscreen / landscape）
  sw.js                  Service Worker（网络优先，失败回落缓存）
shells/desktop/          Electron 外壳：main.js + preload.js（contextBridge）
src/                     Godot 版（0.3.0-stage03）
data/content.json        由 web/js/content.js 生成，两版共用
tools/port_content.js    内容导出脚本
tools/balance_report.js  自动驾驶测量台：清关时长 / 失球 / 终局球速
docs/balance-v0.5.md     平衡报告（48 关 + 6 Boss 的实测表）
tests/                   Node 测试（网页）与 GDScript 测试（Godot）
```

---

## 测试

```
node tests/web_core_test.js      # 73 项（模拟核心）
node tests/web_full_test.js      # 515 项（模式/构筑/存档/Boss）
node tools/balance_report.js     # 平衡测量台（48 关 + 6 Boss）
```

Godot 版：

```
godot --headless --path . --script res://tests/test_sim.gd   # 500 项
godot --headless --path . -- --selftest                      # 67 项
```

---

## 构建

```
node tools\port_content.js          # 从 content.js 生成 data/content.json（改内容后必跑）
python tools\gen_audio.py           # 重新生成音效（已生成）
godot --headless --path . --export-release "Windows Desktop" dist/windows/BreakoutPhosphorEra.exe
```

发布网页：把 `web/` 全量同步到 `gh-pages` 根目录（`index.html` / `js/` / `data/` / `assets/` / `manifest.webmanifest` / `sw.js`）。

---

## 平衡

详见 [`docs/balance-v0.5.md`](docs/balance-v0.5.md)。核心结论：

| 指标 | v0.4 | v0.5 |
|---|---|---|
| 关卡通过 | 43 / 48 | **48 / 48** |
| 平均清关 | 117.5s | **67.9s** |
| 清关中位 | 86.8s | 62.4s |
| Boss 击杀 | 2 / 6 | **6 / 6** |
| Boss 时长中位 | 360s（超时） | **110.3s** |

测量台用「会瞄准、有 70ms 反应延迟、±12px 落点误差」的自动驾驶，
跑的是零构筑裸属性，即最差情况。

---

## 素材授权

图形全部代码绘制，音效与音乐全部程序合成，字体调用系统字体不随包分发。
未使用任何第三方美术或音频素材。

---

## 已知限制

- **两端行为仍有两处小分歧**（其余已对齐）：
  1. 「反弹蓄能」升级（k5）在网页版里只写了注释、没有实际累加伤害；Godot 版按描述实现（接球 +1 伤害，上限 +3）。
  2. 网页版「经典」模式是一条穿过 6 章的远征线；Godot 版把「经典远征」做成同一套，另外多给了一个「关卡选择」入口用于单关练习。
- **平衡数据全部来自自动驾驶**（反应 70ms、误差 ±12px 是估计值），没有真人试玩数据。
  构筑强度、金币经济、遗物搭配尚未量化。
- 移动端做了触屏拖动、安全区、PWA 全屏与版面适配，并在 844×390 横屏模拟下验收，
  **未做真机验收**（iOS Safari 的地址栏/手势区行为仍需实机确认）。
- 无尽模式难度主要靠球速与血量，规则变体少。
- 详细档案：`C:\Users\ax2\Documents\技术博客\breakout-phosphor-era`
