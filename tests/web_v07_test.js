/* v0.7.0 新增机制测试（Node，无需浏览器）
 * 覆盖：反弹蓄能 / 余烬 / 寒流 / 雷暴 / 召回协议 / 无伤章 / 无尽层规则
 * 用法: node tests/web_v07_test.js
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
const { State, Run, Meta } = ST;
const C = BP.C;

let pass = 0, fail = 0;
const fails = [];
function check(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); console.log("  FAIL:", msg); } }
function section(s) { console.log("·", s); }

function makeSim(mods, rows) {
  const sim = new BP.Sim();
  sim.setMods(Object.assign(BP.defaultStats(), mods || {}));
  sim.setup({ id: "t", name: "t", rows: rows || ["##..........", "##.........."], legend: BP.LEGEND, speed: 535, lives: 3 }, 11);
  return sim;
}

section("反弹蓄能");
{
  const sim = makeSim({ bounceDamage: 1 });
  sim.launch();
  const b = sim.balls[0];
  for (let i = 0; i < 5; i++) sim._paddleBounce(b);
  check(b.dmgBonus === 3, "接球 5 次后蓄能封顶 +3，实际 " + b.dmgBonus);

  const fresh = makeSim({});
  fresh.launch();
  fresh._paddleBounce(fresh.balls[0]);
  check(fresh.balls[0].dmgBonus === 0, "没有该升级时不蓄能");
}

section("余烬 / 寒流");
{
  const sim = makeSim({ ember: 1 }, ["##.........."]);
  const a = sim.grid.at(0, 0), nb = sim.grid.at(1, 0);
  a.burn = 2;
  sim._destroy(a, "ball");
  check(!nb.alive, "带灼烧的砖块碎掉后，余烬炸掉相邻砖");
}
{
  const sim = makeSim({ coldSnap: 1 }, ["##.........."]);
  const a = sim.grid.at(0, 0), nb = sim.grid.at(1, 0);
  a.frozen = 2;
  sim._destroy(a, "ball");
  check(nb.frozen > 0, "冻结砖碎掉后把冰冻传给相邻砖，实际 " + nb.frozen);
}
{
  const sim = makeSim({}, ["##.........."]);
  const a = sim.grid.at(0, 0), nb = sim.grid.at(1, 0);
  a.frozen = 2;
  sim._destroy(a, "ball");
  check(nb.frozen === 0, "没有寒流时不传染");
}

section("雷暴 / 召回");
{
  const sim = makeSim({ storm: 0.01 });
  sim.phase = BP.PHASE.PLAY;
  sim._tickSystems(0.02);
  check(sim.stats.damage > 0, "雷暴定时放电造成伤害，实际 " + sim.stats.damage);
}
{
  const sim = makeSim({ recall: 1 });
  sim.phase = BP.PHASE.PLAY;
  sim.balls = [];
  const lives = sim.lives;
  sim.step(C.FIXED);
  check(sim.lives === lives, "召回触发时不扣命");
  check(sim.phase === BP.PHASE.SERVE, "召回后回到发球状态，实际 phase=" + sim.phase);
  check(sim.balls.length === 1 && sim.balls[0].attached, "召回后有一颗待发球");
}
{
  const sim = makeSim({ recall: 0 });
  sim.phase = BP.PHASE.PLAY;
  sim.balls = [];
  const lives = sim.lives;
  sim.step(C.FIXED);
  check(sim.lives === lives - 1, "没有该升级时正常扣命");
}

section("无伤章与玻璃炮解锁");
{
  State.load();
  const before = State.meta.noHitChapters || 0;
  Run.start("endless", "p1", 777);
  Run.finishBoss(true);
  check(State.meta.noHitChapters === before + 1, "整章不掉命会计入无伤章");
  Run.current.tookDamage = true;
  Run.finishBoss(true);
  check(State.meta.noHitChapters === before + 1, "掉过命的一章不计入");
  Meta.sync();
  check((State.meta.unlocks || []).includes("p6"), "无伤章解锁玻璃炮挡板");
}

section("无尽层规则");
{
  State.load();
  const r = Run.start("endless", "p1", 777);
  check(Run.endlessRule().id === "n0", "第 1 层是标准场");
  const ids = new Set([Run.endlessRule(0).id]);
  for (let f = 1; f <= 8; f++) ids.add(Run.endlessRule(f).id);
  check(ids.size >= 4, "不同层轮换出多种规则，实际 " + ids.size + " 种");
  const rule = Run.endlessRule(1);
  r.endlessFloor = 1;
  const mods = Run.mods();
  if (rule.id === "n1") check(mods.startSpeed === C.BASE_SPEED + 60, "超频层提高初始球速");
  if (rule.id === "n2") check(mods.paddleW === C.PADDLE_W - 22, "窄带层收窄挡板");
  if (rule.id === "n3") check(Math.abs(mods.goldBonus - 0.5) < 1e-6, "断援层提高碎片收益");
  if (rule.id === "n4") check(mods.storm === 5, "静电场层带定时放电");
  check(r.route.length === 5, "每层路线仍是 5 个节点");
}

section("统计字段");
{
  const m = State.meta;
  check(typeof m.playTime === "number", "有累计游玩时长");
  check(Array.isArray(m.history), "有战绩历史数组");
  check(typeof m.deaths === "number", "有失球计数");
  check(typeof m.dailyStreak === "number", "有每日连续天数");
  State.persist();
  State.data = ST.defaults();
  State.load();
  check(Array.isArray(State.meta.history), "旧存档迁移后统计字段存在");
}

console.log("\n===================================================");
console.log("通过 " + pass + " 项 / 失败 " + fail + " 项");
for (const f of fails) console.log("  ✗ " + f);
console.log("===================================================");
process.exit(fail > 0 ? 1 : 0);
