#!/usr/bin/env node
/**
 * 把网页版内容（web/js/content.js）导出成 Godot 侧可读的 data/content.json。
 *
 * 为什么要有这一步：网页版和 Godot 版是两套代码，内容却必须同一份。
 * 与其在 GDScript 里手抄 48 个关卡（必然抄错），不如把网页版的数据当唯一源，
 * 生成 JSON 让两边共同读取。Boss 的行为函数无法序列化，改存 behavior 标记，
 * 由 src/sim/boss.gd 按 id 实现同样的逻辑。
 *
 * 用法：node tools/port_content.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "web", "js", "content.js");
const OUT = path.join(ROOT, "data", "content.json");

// content.js 依赖 core.js 暴露的 BP（常量表），必须先加载
require(path.join(ROOT, "web", "js", "core.js"));
const CT = require(SRC);

const LEVEL_FIELDS = ["id", "chapter", "index", "name", "codename", "teach", "speed", "lives", "rows"];

function pickLevel(lv) {
  const out = {};
  for (const k of LEVEL_FIELDS) {
    if (lv[k] !== undefined) out[k] = lv[k];
  }
  // 关卡上可能还有 elite 之类的标记，一并带上（只保留基础类型）
  for (const k of Object.keys(lv)) {
    if (out[k] === undefined) {
      const v = lv[k];
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    }
  }
  return out;
}

function pickBoss(b) {
  return {
    id: b.id,
    chapter: b.chapter,
    name: b.name,
    code: b.code,
    hp: b.hp,
    brief: b.brief,
    behavior: b.id,
    parts: b.parts.map((p) => ({
      id: p.id,
      role: p.role,
      type: p.type,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      hp: p.hp,
      invuln: !!p.invuln,
      regen: p.regen || 0,
    })),
    phases: b.phases.map((ph) => ({
      at: ph.at,
      name: ph.name,
      coreInvuln: !!ph.coreInvuln,
      armorInvuln: !!ph.armorInvuln,
    })),
  };
}

const payload = {
  schema: 1,
  source: "web/js/content.js",
  legend: CT.LEGEND || { "#": "normal", T: "tough", A: "armored", B: "blast", X: "solid", R: "regen", S: "shieldNode" },
  chapters: CT.CHAPTERS,
  levels: CT.LEVELS.map(pickLevel),
  bosses: CT.BOSSES.map(pickBoss),
  upgrades: CT.UPGRADES,
  relics: CT.RELICS,
  paddles: CT.PADDLES,
  events: CT.EVENTS,
  synergies: CT.SYNERGIES,
  shop: CT.SHOP_OFFERS,
  nodes: CT.NODE_TYPES,
  arch: CT.ARCH,
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

const bytes = fs.statSync(OUT).size;
console.log(`content.json -> ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(1)} KB)`);
console.log(
  [
    `chapters=${payload.chapters.length}`,
    `levels=${payload.levels.length}`,
    `bosses=${payload.bosses.length}`,
    `upgrades=${payload.upgrades.length}`,
    `relics=${payload.relics.length}`,
    `paddles=${payload.paddles.length}`,
    `events=${payload.events.length}`,
    `synergies=${payload.synergies.length}`,
  ].join(" ")
);

// 自检：每一关的砖块符号都必须在 legend 里，否则 Godot 侧会报未知符号
const legend = payload.legend;
let bad = 0;
for (const lv of payload.levels) {
  for (const row of lv.rows) {
    for (const ch of String(row)) {
      if (ch === "." || ch === " ") continue;
      if (!legend[ch]) {
        console.error(`关卡 ${lv.id} 含未知符号 ${ch}`);
        bad++;
      }
    }
  }
}
if (bad > 0) process.exitCode = 1;
else console.log("符号校验通过");
