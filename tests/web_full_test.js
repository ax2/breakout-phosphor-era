/* 完整内容与系统测试（Node，无需浏览器）
 * 覆盖：内容完整性、48 关数据、6 个 Boss 可击败、36 项升级属性、远征流程、商店/事件。
 * 用法: node tests/web_full_test.js
 */
globalThis.window = globalThis;
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
require("../web/data/levels.js");
const BP = require("../web/js/core.js");
require("../web/js/content.js");
const ST = require("../web/js/run.js");
const CT = globalThis.CONTENT;
const { State, Run, Meta } = ST;
const C = BP.C;

let pass = 0, fail = 0;
const fails = [];
function check(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); console.log("  FAIL:", msg); } }
function section(s) { console.log("·", s); }

// 1 内容数量
section("内容完整性");
{
  check(CT.CHAPTERS.length === 6, "6 个章节，实际 " + CT.CHAPTERS.length);
  check(CT.LEVELS.length === 48, "48 个关卡，实际 " + CT.LEVELS.length);
  check(CT.BOSSES.length === 6, "6 个 Boss，实际 " + CT.BOSSES.length);
  check(CT.UPGRADES.length === 36, "36 项升级，实际 " + CT.UPGRADES.length);
  check(CT.RELICS.length === 18, "18 件遗物，实际 " + CT.RELICS.length);
  check(CT.PADDLES.length === 6, "6 种挡板，实际 " + CT.PADDLES.length);
  check(CT.SYNERGIES.length === 12, "12 组协同，实际 " + CT.SYNERGIES.length);
  check(CT.EVENTS.length >= 12, "至少 12 个事件");
  for (const [name, arr] of [["关卡", CT.LEVELS], ["Boss", CT.BOSSES], ["升级", CT.UPGRADES], ["遗物", CT.RELICS], ["挡板", CT.PADDLES], ["协同", CT.SYNERGIES]]) {
    const ids = new Set(arr.map((x) => x.id));
    check(ids.size === arr.length, name + " id 唯一");
  }
  for (const arch of Object.keys(CT.ARCH)) {
    const n = CT.UPGRADES.filter((u) => u.arch === arch).length;
    check(n === 6, "构筑方向 " + arch + " 有 6 项升级，实际 " + n);
  }
  for (const u of CT.UPGRADES) check(!!u.desc && u.desc.length > 6, "升级 " + u.id + " 有说明");
  for (const r of CT.RELICS) check(!!r.mods && Object.keys(r.mods).length > 0, "遗物 " + r.id + " 有实际效果");
}

// 2 关卡数据
section("48 关数据校验");
{
  for (const ch of CT.CHAPTERS) {
    const lv = CT.LEVELS.filter((l) => l.chapter === ch.id);
    check(lv.length === 8, ch.name + " 应有 8 关，实际 " + lv.length);
  }
  for (const lv of CT.LEVELS) {
    const g = new BP.Grid(lv.rows, BP.LEGEND);
    check(g.destructibleTotal > 0, lv.id + " 有可破坏砖");
    check(g.warnings.length === 0, lv.id + " 无警告 " + g.warnings.join(";"));
    for (const row of lv.rows) check(row.length === C.COLS, lv.id + " 行宽 " + row.length);
    check(lv.rows.length <= C.ROWS, lv.id + " 行数 " + lv.rows.length);
  }
}

// 3 升级属性叠加
section("升级与遗物属性");
{
  Run.current = { upgrades: [], relics: [], permanent: {}, paddleId: "p1", mode: "expedition", chapters: [0], chapterPos: 0, row: 0, seed: 1, gold: 0, hp: 4, maxHp: 4, level: 0, xp: 0, xpNext: 5, route: [[]], taken: {} };
  const base = Run.mods();
  check(base.damage === 1, "默认伤害 1");
  Run.addUpgrade("k3");
  Run.addRelic("r1");
  check(Run.mods().damage === 3, "两个 +1 伤害应叠到 3，实际 " + Run.mods().damage);
  Run.addUpgrade("e5");
  check(Run.mods().paddleW === C.PADDLE_W + 28, "挡板加宽生效");
  Run.addUpgrade("k1");
  check(Run.mods().centerCrit === true, "中心暴击标记生效");
  // 协同：f1 + c1
  Run.addUpgrade("f1"); Run.addUpgrade("c1");
  check(Run.activeSynergies().some((s) => s.id === "sy1"), "灼烧+冻结触发协同");
  // 挡板下限
  Run.current.paddleId = "p6";
  Run.addUpgrade("k6");
  check(Run.mods().paddleW >= 70, "挡板宽度有下限");
}

// 4 挡板差异
section("6 种挡板差异");
{
  for (const p of CT.PADDLES) {
    Run.current = { upgrades: [], relics: [], permanent: {}, paddleId: p.id, mode: "expedition", chapters: [0], chapterPos: 0, row: 0, seed: 1, gold: 0, hp: 4, maxHp: 4, level: 0, xp: 0, xpNext: 5, route: [[]], taken: {} };
    const m = Run.mods();
    check(m && typeof m.damage === "number", p.name + " 能算出属性");
  }
  Run.current.paddleId = "p6";
  check(Run.mods().damage === 3, "玻璃炮伤害 +2");
  Run.current.paddleId = "p3";
  check(Math.abs(Run.mods().paddleSpeed - 1.18) < 1e-6, "轻量挡板速度倍率");
}

// 5 Boss 可击败
section("6 个 Boss 可击败");
{
  for (const boss of CT.BOSSES) {
    const sim = new BP.Sim();
    sim.setMods(Object.assign(BP.defaultStats(), { damage: 3 }));
    sim.setup({ id: "b", name: boss.name, rows: [], legend: BP.LEGEND, speed: 520, lives: 99 }, 12345);
    sim.boss = new BP.Boss(boss, 99);
    sim.boss.spawn(sim);
    sim.launch();
    let t = 0;
    let sawInvuln = false;
    let hpMin = boss.hp;
    sim.on("invuln", () => { sawInvuln = true; });
    while (t < 360 && sim.phase !== 4 && sim.phase !== 5) {
      if (sim.balls.length) sim.setPaddleTarget(sim.balls[0].x + Math.sin(t * 1.1) * 60, 100000);
      if (sim.phase === 1) sim.launch();
      sim.step(C.FIXED);
      t += C.FIXED;
      hpMin = Math.min(hpMin, sim.boss.hp);
    }
    check(sim.phase === 4, boss.name + " 应在 360s 内被击败（phase=" + sim.phase + " hp=" + sim.boss.hp + "）");
    check(hpMin < boss.hp, boss.name + " 血量应下降");
    check(sim.boss.parts.some((p) => p.role === "core"), boss.name + " 有核心部件");
    check(sim.boss.def.phases.length >= 2, boss.name + " 至少两个阶段");
    if (boss.id !== "b2") check(sawInvuln || boss.id === "b3" || boss.id === "b5", boss.name + " 有护甲/窗口机制");
  }
}

// 6 状态效果
section("状态效果");
{
  const sim = new BP.Sim();
  sim.setMods(Object.assign(BP.defaultStats(), { burn: 1, burnDps: 6, freezeChance: 1, freezeDur: 3, charge: 1 }));
  sim.setup({ id: "t", name: "t", rows: ["A..........."], legend: BP.LEGEND, speed: 520, lives: 3 }, 7);
  sim.launch();
  const b = sim.balls[0]; b.attached = false; b.x = 112; b.y = 300; b.vx = 0; b.vy = -700;
  sim.phase = BP.PHASE.PLAY;
  for (let i = 0; i < 60; i++) sim.step(C.FIXED);
  const br = sim.grid.at(0, 0);
  check(br.frozen > 0 || !br.alive, "冻结状态已施加或砖块已碎");
  check(br.burn > 0 || !br.alive, "灼烧状态已施加或砖块已碎");
  check(br.charge > 0 || !br.alive, "导电状态已施加或砖块已碎");
}

// 7 远征流程
section("远征流程");
{
  State.load();
  const r = Run.start("expedition", "p1", 424242);
  check(r.chapters.length === 3, "远征包含 3 章");
  check(r.route.length === 5, "每章 5 层路线，实际 " + r.route.length);
  check(r.route[4][0] === "boss", "最后一层是 Boss");
  check(Run.currentOptions().length >= 1, "当前层有可选节点");
  const before = r.row;
  Run.finishNode(true, { bricks: 10 });
  check(r.row === before + 1, "通关后推进一层");
  check(r.gold > 0, "通关给碎片");
  const lv = Run.buildLevel("battle");
  check(!!lv && lv.rows.length > 0, "战斗节点能生成关卡");
  const bl = Run.buildLevel("boss");
  check(!!bl.boss, "Boss 节点带 Boss 定义");
  // 走完三章
  let guard = 0;
  while (r.chapterPos < 3 && guard < 40) {
    guard++;
    const res = Run.finishBoss(true);
    if (res.end) break;
  }
  check(guard <= 4, "三次 Boss 结算后结束远征");
  check(State.meta.bestChapter >= 1, "地图进度已记录");
}

// 8 无尽模式
section("无尽模式");
{
  const r = Run.start("endless", "p1", 777);
  check(r.chapters.length === 1, "无尽只跑一章");
  const res = Run.finishBoss(true);
  check(!res.end && res.floor === 1, "击破后进入下一层，实际 " + JSON.stringify(res));
  check(State.meta.endlessBest >= 1, "记录最高层数");
  const lv = Run.buildLevel("battle");
  check(lv.speed > 520, "层数越高球速越快，实际 " + lv.speed);
}

// 9 存档
section("存档 v3");
{
  State.meta.totalBricks = 123;
  State.meta.cleared["c1_01"] = { score: 100 };
  State.persist();
  State.data = ST.defaults();
  State.load();
  check(State.meta.totalBricks === 123, "进度持久化");
  check(!!State.meta.cleared["c1_01"], "通关记录持久化");
  check(State.data.version === 3, "存档版本为 3");
  // 损坏回退
  store[ST.SAVE_KEY] = "{broken";
  State.load();
  check(State.meta.totalBricks === 123 || State.status === "corrupt_reset", "损坏时回退到备份或重置");
}

console.log("\n===================================================");
console.log("通过 " + pass + " 项 / 失败 " + fail + " 项");
for (const f of fails) console.log("  ✗ " + f);
console.log("===================================================");
process.exit(fail > 0 ? 1 : 0);
