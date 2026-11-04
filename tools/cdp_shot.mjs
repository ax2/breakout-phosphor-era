// 用 Chrome DevTools Protocol 打开页面、等待真实时间、取状态与截图
// 用法: node tools/cdp_shot.mjs <url> <out.png> <waitMs> [evalExpr]
const [, , url, out, waitMsArg, evalExpr] = process.argv;
const waitMs = Number(waitMsArg || 6000);
const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 720);

async function listTargets() {
  const r = await fetch("http://127.0.0.1:9222/json/list");
  return r.json();
}

async function newTarget(u) {
  const r = await fetch("http://127.0.0.1:9222/json/new?" + encodeURIComponent(u), { method: "PUT" });
  if (!r.ok) throw new Error("new target failed " + r.status);
  return r.json();
}

const targets = await listTargets();
let page = targets.find((t) => t.type === "page");
if (!page) page = await newTarget(url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });

function send(method, params) {
  return new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
}

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: VW, height: VH, deviceScaleFactor: 1, mobile: VW < 600 });
await send("Runtime.enable");
await send("Page.navigate", { url });
await new Promise((r) => setTimeout(r, waitMs));

if (evalExpr) {
  const res = await send("Runtime.evaluate", { expression: evalExpr, returnByValue: true, awaitPromise: true });
  console.log("EVAL:", JSON.stringify(res.result && res.result.result && res.result.result.value));
  await new Promise((r) => setTimeout(r, 1500));
}

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
if (shot.result && shot.result.data) {
  const fs = await import("node:fs");
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("SAVED", out);
} else {
  console.log("SCREENSHOT FAILED", JSON.stringify(shot).slice(0, 300));
}
ws.close();
process.exit(0);
