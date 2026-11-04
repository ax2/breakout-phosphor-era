/* BREAKOUT: 磷光纪元 — 数值测量台
 * 用"会预判落点、但反应有误差"的自动驾驶跑一遍全部关卡与 Boss，
 * 输出清关时长 / 失球 / 终局球速，用来判断难度曲线是否连续。
 *
 * 用法: node tools/balance_report.js [--json out.json] [--chapter 3] [--quiet]
 */
"use strict";
globalThis.window = globalThis;
require("../web/data/levels.js");
const BP = require("../web/js/core.js");
require("../web/js/content.js");
const CT = globalThis.CONTENT;

const FIXED = BP.C.FIXED;
const PADDLE_Y = BP.C.PADDLE_TOP;

function predictX(b, targetY, padX) {
  if (b.vy <= 0) return null;
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
  const L = BP.C.WALL_L + b.r, R = BP.C.WALL_R - b.r;
  let guard = 0;
  while (y < targetY && guard < 400) {
    const tEnd = (targetY - y) / vy;
    let tWall = Infinity;
    if (vx > 1e-6) tWall = (R - x) / vx;
    else if (vx < -1e-6) tWall = (L - x) / vx;
    if (tWall < tEnd) {
      x = vx > 0 ? R : L;
      y += vy * tWall;
      vx = -vx;
      guard++;
    } else {
      x += vx * tEnd;
      y = targetY;
      break;
    }
  }
  return x;
}

/** Boss 战的目标选择：核心可打就打核心，否则先拆一块护甲开洞 */
function pickBossTarget(boss) {
  if (!boss) return null;
  const cores = boss.parts.filter((p) => p.alive && p.role === "core" && !p.invuln);
  if (cores.length) {
    return cores.sort((a, b) => a.hp - b.hp)[0];
  }
  const armor = boss.parts.filter((p) => p.alive && p.role === "armor");
  if (!armor.length) return null;
  return armor.sort((a, b) =>
    (a.hp - b.hp) || (Math.abs(a.cx() - BP.C.PADDLE_MID) - Math.abs(b.cx() - BP.C.PADDLE_MID))
  )[0];
}

/** 残局时玩家会主动去够最后几块砖，这里按"最低的可破坏砖"模拟该行为 */
function pickLooseBrick(sim) {
  const list = sim.grid ? sim.grid.aliveBricks().filter((b) => !b.solid() && !b.invuln) : [];
  if (!list.length) return null;
  return list.sort((a, b) => (b.cy() - a.cy()) || (Math.abs(a.cx() - sim.paddleX) - Math.abs(b.cx() - sim.paddleX)))[0];
}

const ANG_STEP = BP.C.PADDLE_ANGLE * Math.PI / 180;
const ANG_LIM = BP.C.PADDLE_MAX_ANGLE * Math.PI / 180;

/** 自动驾驶：预判最紧急的球、带落点误差与反应延迟；Boss 战会主动调角度瞄弱点 */
function makePilot(seed, err, reaction, aim) {
  const rng = new BP.XRand(seed);
  let target = null, timer = 0, bias = 0;
  return function (sim, dt) {
    timer -= dt;
    if (timer <= 0 || target == null) {
      timer = reaction;
      bias = rng.range(-err, err);
      let best = null, bestT = 1e9;
      for (const b of sim.balls) {
        if (!b.active || b.attached) continue;
        const px = predictX(b, PADDLE_Y, sim.paddleX);
        if (px == null) continue;
        const t = (PADDLE_Y - b.y) / Math.max(1, b.vy);
        if (t < bestT) { bestT = t; best = px; }
      }
      if (best == null) {
        // 球在上行：回中，避免挡板贴边
        target = BP.C.PADDLE_MID;
      } else {
        const catchX = best + bias;
        // Boss 战瞄准弱点；普通关瞄准最低的可破坏砖（真人就是这么打的，不是把球垂直接回去）
        const goal = aim === false ? null : (pickBossTarget(sim.boss) || pickLooseBrick(sim));
        if (goal && goal.cy() < PADDLE_Y - 60) {
          // 用挡板接触点偏移把出射角指向弱点
          const dx = goal.cx() - catchX;
          const dy = PADDLE_Y - goal.cy();
          let ang = Math.atan2(dx, dy);
          ang = Math.max(-ANG_LIM, Math.min(ANG_LIM, ang));
          const off = Math.max(-0.94, Math.min(0.94, ang / ANG_STEP));
          target = catchX - off * (sim.paddleW / 2);
        } else {
          target = catchX;
        }
      }
    }
    sim.setPaddleTarget(target, 4200);
  };
}

function runLevel(level, opts) {
  const o = opts || {};
  const sim = new BP.Sim();
  sim.setMods(o.mods || BP.defaultStats());
  sim.setup(level, o.seed || 20261104);
  if (level.boss) { sim.boss = new BP.Boss(level.boss, 7); sim.boss.spawn(sim); }
  const pilot = makePilot((o.seed || 1) + 17, o.err == null ? 12 : o.err, o.reaction == null ? 0.07 : o.reaction);
  sim.launch();
  let t = 0, lives0 = sim.lives;
  while (t < (o.limit || 300)) {
    pilot(sim, FIXED);
    if (sim.phase === BP.PHASE.SERVE) sim.launch();
    sim.step(FIXED);
    t += FIXED;
    const alive = sim.balls.some((b) => b.active);
    if (sim.phase === BP.PHASE.CLEAR || sim.phase === BP.PHASE.FAIL) break;
    if (!alive && sim.phase === BP.PHASE.PLAY) break;
  }
  const win = sim.phase === BP.PHASE.CLEAR;
  return {
    id: level.id, name: level.name,
    win,
    time: Math.round(t * 10) / 10,
    left: sim.grid ? sim.grid.destructibleAlive : 0,
    lost: lives0 - sim.lives,
    balls: sim.stats.bricks,
    speed: Math.round(sim.ballSpeed()),
    maxSpeed: Math.round(sim.speed),
    score: sim.score,
    drops: sim.picked,
  };
}

function runBoss(idx, opts) {
  const boss = CT.BOSSES[idx];
  const level = {
    id: "boss_" + boss.id, name: boss.name, rows: [], legend: BP.LEGEND,
    speed: 520 + idx * 10, lives: 3, boss,
  };
  return runLevel(level, Object.assign({ limit: 360 }, opts || {}));
}

const args = process.argv.slice(2);
const jsonIdx = args.indexOf("--json");
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const chapterFilter = args.includes("--chapter") ? Number(args[args.indexOf("--chapter") + 1]) : null;
const quiet = args.includes("--quiet");

const levels = CT.LEVELS.filter((l) => (chapterFilter ? l.chapter === "ch" + chapterFilter : true));
const results = [];
for (const lv of levels) {
  const r = runLevel(lv);
  results.push(r);
  if (!quiet) {
    const flag = !r.win ? "FAIL" : r.time > 110 ? "SLOW" : r.time < 18 ? "FAST" : "ok";
    console.log(
      [r.id.padEnd(6), (r.name || "").padEnd(8), String(r.time).padStart(6) + "s",
       ("剩" + r.left).padStart(5), ("失" + r.lost).padStart(4),
       ("球速" + r.speed).padStart(9), flag.padStart(5)].join(" ")
    );
  }
}

const bosses = [];
if (!chapterFilter) {
  for (let i = 0; i < CT.BOSSES.length; i++) {
    const r = runBoss(i);
    bosses.push(r);
    if (!quiet) {
      console.log(
        ["BOSS".padEnd(6), (r.name || "").padEnd(8), String(r.time).padStart(6) + "s",
         ("失" + r.lost).padStart(4), r.win ? "KILL" : "FAIL"].join(" ")
      );
    }
  }
}

function stats(arr, key) {
  const v = arr.map((x) => x[key]).filter((n) => typeof n === "number");
  if (!v.length) return null;
  v.sort((a, b) => a - b);
  const sum = v.reduce((a, b) => a + b, 0);
  return {
    n: v.length, min: v[0], max: v[v.length - 1],
    avg: Math.round((sum / v.length) * 10) / 10,
    med: v[Math.floor(v.length / 2)],
    p90: v[Math.floor(v.length * 0.9)],
  };
}

const summary = {
  levels: {
    total: results.length,
    cleared: results.filter((r) => r.win).length,
    time: stats(results, "time"),
    lost: stats(results, "lost"),
  },
  bosses: { total: bosses.length, killed: bosses.filter((r) => r.win).length, time: stats(bosses, "time") },
  worst: results.slice().sort((a, b) => (b.time - a.time)).slice(0, 5).map((r) => r.id + ":" + r.time + "s"),
  fastest: results.slice().sort((a, b) => (a.time - b.time)).slice(0, 5).map((r) => r.id + ":" + r.time + "s"),
};

console.log("\n=== 汇总 ===");
console.log("关卡", summary.levels.cleared + "/" + summary.levels.total, "通过");
console.log("清关时长", JSON.stringify(summary.levels.time));
console.log("失球", JSON.stringify(summary.levels.lost));
console.log("Boss", summary.bosses.killed + "/" + summary.bosses.total, "击杀, 时长", JSON.stringify(summary.bosses.time));
console.log("最慢:", summary.worst.join(", "));
console.log("最快:", summary.fastest.join(", "));

if (jsonOut) {
  const fs = require("node:fs");
  fs.writeFileSync(jsonOut, JSON.stringify({ results, bosses, summary }, null, 2), "utf8");
  console.log("写入", jsonOut);
}
