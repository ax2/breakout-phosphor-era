/* BREAKOUT: 磷光纪元 — Electron preload
 * 只暴露最小面：同步存储、窗口操作、版本号。渲染层拿到的 __BP_NATIVE__
 * 与移动端/PWA 的接口形状一致，核心代码不需要区分平台。
 */
const { contextBridge, ipcRenderer } = require("electron");

const storage = {
  get(key) {
    try { return ipcRenderer.sendSync("bp-storage", "get", key); } catch (e) { return null; }
  },
  set(key, value) {
    try { return ipcRenderer.sendSync("bp-storage", "set", key, value); } catch (e) { return false; }
  },
  remove(key) {
    try { return ipcRenderer.sendSync("bp-storage", "remove", key); } catch (e) { return false; }
  },
};

contextBridge.exposeInMainWorld("__BP_NATIVE__", {
  kind: "desktop",
  version: "0.5.0",
  touch: false,
  storage,
  setFullscreen(v) { ipcRenderer.sendSync("bp-window", "fullscreen", v); },
  toggleFullscreen() { ipcRenderer.sendSync("bp-window", "toggle-fullscreen"); },
  quit() { ipcRenderer.sendSync("bp-window", "quit"); },
});
