/* BREAKOUT: 磷光纪元 — Electron 主进程
 * 职责只有三件：开窗、把存档落到用户目录、把全屏/退出等窗口操作转给渲染层。
 * 游戏逻辑一概不在这里，web/ 目录就是全部实现。
 */
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const isDev = !app.isPackaged;
// 开发时直接读仓库里的 web/；打包后读 resources/web
const WEB_DIR = isDev
  ? path.join(__dirname, "..", "..", "web")
  : path.join(process.resourcesPath, "web");

const SAVE_FILE = path.join(app.getPath("userData"), "save.json");
const WIN_STATE = path.join(app.getPath("userData"), "window.json");

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
}
function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), "utf8");
    return true;
  } catch (e) { return false; }
}

// 存档读写走同步 IPC：渲染层的 Store 是同步接口，异步会把持久化时序打乱
ipcMain.on("bp-storage", (e, op, key, value) => {
  const data = readJson(SAVE_FILE, {});
  if (op === "get") { e.returnValue = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; return; }
  if (op === "set") { data[key] = value; e.returnValue = writeJson(SAVE_FILE, data); return; }
  if (op === "remove") { delete data[key]; e.returnValue = writeJson(SAVE_FILE, data); return; }
  if (op === "list") { e.returnValue = Object.keys(data); return; }
  e.returnValue = null;
});

let win = null;

function createWindow() {
  const saved = readJson(WIN_STATE, { width: 1280, height: 720 });
  win = new BrowserWindow({
    width: Math.max(960, saved.width || 1280),
    height: Math.max(540, saved.height || 720),
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#05080a",
    title: "BREAKOUT：磷光纪元",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(WEB_DIR, "index.html"));
  win.once("ready-to-show", () => win.show());

  // 外链走系统浏览器，不在游戏窗口里开网页
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  const persistBounds = () => {
    if (!win || win.isDestroyed() || win.isFullScreen()) return;
    const b = win.getBounds();
    writeJson(WIN_STATE, { width: b.width, height: b.height });
  };
  win.on("resize", persistBounds);
  win.on("close", persistBounds);

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (input.key === "F12" && isDev) { event.preventDefault(); win.webContents.toggleDevTools(); }
  });

  if (process.env.BP_DEBUG_PORT) {
    win.webContents.debugger.attach("1.3");
  }
}

ipcMain.on("bp-window", (e, op, arg) => {
  if (!win) { e.returnValue = false; return; }
  if (op === "fullscreen") { win.setFullScreen(!!arg); e.returnValue = true; return; }
  if (op === "toggle-fullscreen") { win.setFullScreen(!win.isFullScreen()); e.returnValue = true; return; }
  if (op === "is-fullscreen") { e.returnValue = win.isFullScreen(); return; }
  if (op === "minimize") { win.minimize(); e.returnValue = true; return; }
  if (op === "quit") { app.quit(); e.returnValue = true; return; }
  e.returnValue = false;
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
