/* BREAKOUT: 磷光纪元 — 离线缓存
 * 版本号一变就重建缓存；只缓存静态资源，不碰存档。
 */
const CACHE = "phosphor-era-v3";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/app.css",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "data/levels.js",
  "js/platform.js",
  "js/core.js",
  "js/content.js",
  "js/run.js",
  "js/render.js",
  "js/ui.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 网络优先、失败回落缓存：保证更新能及时生效，断网也能进游戏
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
