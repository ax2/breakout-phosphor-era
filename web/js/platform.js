/* BREAKOUT: 磷光纪元 — 平台适配层
 * 核心（core/content/run）不直接碰宿主 API，全部经这里转发：
 *   - 浏览器：localStorage + DOM 事件
 *   - Electron（Windows/macOS/Linux）：preload 暴露的同步文件存储 + 原生窗口控制
 *   - 移动端（PWA / 微信内嵌浏览器）：localStorage + 触控 + 安全区 + 震动 + 返回键
 * 任何一项能力缺失都必须优雅降级，不能抛错中断游戏。
 */
(function (root) {
  "use strict";

  const native = root.__BP_NATIVE__ || null;

  function detect() {
    if (native && native.kind) return native.kind;
    const ua = (root.navigator && root.navigator.userAgent) || "";
    if (/Electron/i.test(ua)) return "desktop";
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua)) return "mobile";
    // 触屏笔记本：指针粗糙但屏幕够大，仍按桌面处理
    return "web";
  }
  const kind = detect();
  const isTouch = !!(native && native.touch) ||
    (root.matchMedia ? root.matchMedia("(pointer: coarse)").matches : /Mobile/i.test(root.navigator.userAgent));
  const isMobile = kind === "mobile";

  // ---------------------------------------------------------------- 存储
  // 顺序：原生同步存储 → localStorage → 内存（隐私模式兜底）
  const memory = new Map();
  let ls = null;
  try {
    const probe = "__bp_probe__";
    root.localStorage.setItem(probe, "1");
    root.localStorage.removeItem(probe);
    ls = root.localStorage;
  } catch (e) { ls = null; }

  const store = {
    backend: native && native.storage ? "native" : (ls ? "local" : "memory"),
    get(key) {
      try {
        if (native && native.storage) {
          const v = native.storage.get(key);
          if (v !== undefined && v !== null) return v;
        }
        if (ls) {
          const v = ls.getItem(key);
          if (v !== null) return v;
        }
      } catch (e) { /* 降级 */ }
      return memory.has(key) ? memory.get(key) : null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        if (native && native.storage) native.storage.set(key, value);
        else if (ls) ls.setItem(key, value);
        return true;
      } catch (e) { return false; }
    },
    remove(key) {
      memory.delete(key);
      try {
        if (native && native.storage) native.storage.remove(key);
        else if (ls) ls.removeItem(key);
      } catch (e) { /* ignore */ }
    },
    /** 导出整份存档（桌面端「备份存档」用） */
    exportFile(name, text) {
      if (native && native.saveFile) return native.saveFile(name, text);
      try {
        const blob = new Blob([text], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        return true;
      } catch (e) { return false; }
    },
  };

  // ---------------------------------------------------------------- 宿主能力
  const Platform = {
    kind,
    isTouch,
    isMobile,
    isDesktop: kind === "desktop",
    isWeb: kind === "web",
    store,
    version: (native && native.version) || "web",

    /** 触感反馈：移动端震动，桌面端忽略 */
    vibrate(ms) {
      if (!isTouch) return;
      try {
        if (native && native.vibrate) native.vibrate(ms);
        else if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms);
      } catch (e) { /* ignore */ }
    },

    /** 安全区（刘海屏 / 圆角），CSS env() 取值，取不到按 0 */
    safeInsets() {
      const d = root.document && root.document.documentElement;
      if (!d) return { top: 0, right: 0, bottom: 0, left: 0 };
      const s = getComputedStyle(d);
      const px = (v) => parseFloat(v) || 0;
      return {
        top: px(s.getPropertyValue("--sat")),
        right: px(s.getPropertyValue("--sar")),
        bottom: px(s.getPropertyValue("--sab")),
        left: px(s.getPropertyValue("--sal")),
      };
    },

    /** 全屏（移动端进入游戏时调用，失败静默） */
    requestFullscreen() {
      try {
        const el = root.document.documentElement;
        if (native && native.setFullscreen) { native.setFullscreen(true); return; }
        if (!isMobile) return;
        const fn = el.requestFullscreen || el.webkitRequestFullscreen;
        if (fn) fn.call(el).catch(() => {});
      } catch (e) { /* ignore */ }
    },

    exitFullscreen() {
      try {
        if (native && native.setFullscreen) { native.setFullscreen(false); return; }
        if (root.document.fullscreenElement) root.document.exitFullscreen();
      } catch (e) { /* ignore */ }
    },

    /** 安卓返回键：桌面端走窗口关闭确认，移动端走浏览器 history */
    onBack(fn) {
      if (native && native.onBack) { native.onBack(fn); return; }
      if (!isMobile) return;
      root.addEventListener("popstate", () => fn());
      try { history.pushState({ bp: 1 }, ""); } catch (e) { /* ignore */ }
    },

    quit() {
      if (native && native.quit) return native.quit();
      return false;
    },

    /** 桌面端窗口控制：全屏切换 */
    toggleFullscreen() {
      if (native && native.toggleFullscreen) return native.toggleFullscreen();
      const d = root.document;
      try {
        if (!d.fullscreenElement) {
          const el = d.documentElement;
          const fn = el.requestFullscreen || el.webkitRequestFullscreen;
          if (fn) fn.call(el).catch(() => {});
        } else d.exitFullscreen();
        return true;
      } catch (e) { return false; }
    },

    /** 是否首次运行（各端都用同一份存储键判定） */
    flashUnsupported(name) {
      if (root.console && root.console.warn) root.console.warn("[platform] 不支持：" + name);
    },
  };

  root.BP_PLATFORM = Platform;
})(typeof globalThis !== "undefined" ? globalThis : this);
