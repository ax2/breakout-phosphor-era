/* 网页版核心模拟的自动化测试（Node 运行，无需浏览器）
 * 与 Godot 版 tests/test_sim.gd 覆盖同一组规则，用于验证两套实现不跑偏。
 * 用法: node tests/web_core_test.js
 */
globalThis.window = globalThis;
require("../web/data/levels.js");
const BP = require("../web/js/core.js");
const { C, PHASE } = BP;

let pass = 0, fail = 0;
const fails = [];
function check(cond, msg) {
  if (cond) pass++;
  else { fail++; fails.push(msg); console.log("  FAIL:", msg); }
}
function section(s) { console.log("·", s); }

function newSim(rows, speed, lives) {
  const s = new BP.Sim();
  s.setup({ id: "t", name: "t", rows, legend: BP.LEGEND, speed: speed || 520, lives: lives == null ? 3 : lives }, 12345);
  return s;
}
function run(s, steps) { for (let i = 0; i < steps; i++) s.step(C.FIXED); }

// 1 高速不穿砖
section("高速球不穿砖");
{
  const s = newSim(["#..........."]);
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 112; b.y = 400; b.vx = 0; b.vy = -6000;
  s.phase = PHASE.PLAY;
  for (let i = 0; i < 30; i++) s.step(1 / 60);
  check(s.grid.destructibleAlive === 0, "6000px/s 单帧位移下砖块应被击中");
  check(b.y > 112, "命中后球应回到砖块下方 y=" + b.y.toFixed(1));
}

// 2 挡板角度
section("挡板角度映射");
{
  const s = newSim(["............"]);
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = s.paddleX + 45; b.y = C.PADDLE_TOP - 60;
  b.vx = 0; b.vy = 600;
  s.phase = PHASE.PLAY;
  let guard = 0;
  while (b.vy > 0 && guard < 80) { s.step(C.FIXED); guard++; }
  check(b.vy < 0, "球应被弹回向上");
  check(b.vx > 0, "击在右侧应向右上反弹 vx=" + b.vx.toFixed(1));
  const ang = Math.atan2(b.vx, -b.vy) * 180 / Math.PI;
  check(ang > 10 && ang < 70, "角度在可预期范围 " + ang.toFixed(1));
  check(Math.abs(Math.hypot(b.vx, b.vy) - 600) < 2, "速度量级保持");
}

// 3 耐久
section("多层砖耐久");
{
  const s = newSim(["T..........."]);
  const br = s.grid.at(0, 0);
  check(br.maxHp === 2, "tough 应为 2 耐久");
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 112; b.y = 300; b.vx = 0; b.vy = -700;
  s.phase = PHASE.PLAY;
  run(s, 90);
  check(br.alive && br.hp === 1, "第一次命中后剩 1");
  b.x = 112; b.y = 300; b.vx = 0; b.vy = -700;
  run(s, 90);
  check(!br.alive, "第二次命中后摧毁");
}

// 4 solid
section("不可破坏砖");
{
  const s = newSim(["X..........."]);
  const br = s.grid.at(0, 0);
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 112; b.y = 300; b.vx = 0; b.vy = -800;
  s.phase = PHASE.PLAY;
  run(s, 60);
  check(br.alive, "solid 不应被摧毁");
  check(b.vy > 0, "solid 应把球弹回");
  check(s.grid.cleared(), "只剩 solid 时判为清空");
}

// 5 连锁
section("爆裂砖连锁");
{
  const s = newSim([".B..........", ".BB.........", "..B........."]);
  check(s.grid.destructibleAlive === 4, "应生成 4 块爆裂砖");
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 208; b.y = 400; b.vx = 0; b.vy = -700;
  s.phase = PHASE.PLAY;
  run(s, 120);
  check(s.grid.destructibleAlive <= 1, "连锁应摧毁大部分相邻爆裂砖，剩余 " + s.grid.destructibleAlive);
}

// 6 清关
section("清关判定");
{
  const s = newSim(["#..........."]);
  let cleared = false;
  s.on("cleared", () => { cleared = true; });
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 112; b.y = 300; b.vx = 0; b.vy = -700;
  s.phase = PHASE.PLAY;
  run(s, 90);
  check(cleared, "应触发 cleared");
  check(s.phase === PHASE.CLEAR, "状态进入 CLEAR");
  check(s.score > 0, "应得分");
}

// 7 多球失球
section("多球失球规则");
{
  const s = newSim(["#..........."], 520, 3);
  s.launch();
  const b0 = s.balls[0];
  b0.attached = false; b0.x = 400; b0.y = 300; b0.vx = 300; b0.vy = -300;
  s.phase = PHASE.PLAY;
  const b1 = new BP.Ball(700, 300); b1.vx = -300; b1.vy = -300;
  s.balls.push(b1);
  b0.y = C.DEATH + 50;
  s.step(C.FIXED);
  check(s.lives === 3, "还有球时不扣命");
  b1.y = C.DEATH + 50;
  s.step(C.FIXED);
  check(s.lives === 2, "最后一颗球掉落才扣命 lives=" + s.lives);
  check(s.phase === PHASE.RESET, "进入恢复状态");
}

// 8 近水平
section("近水平防卡死");
{
  const s = newSim(["#..........."]);
  s.launch();
  const b = s.balls[0];
  b.attached = false; b.x = 600; b.y = 300; b.vx = 520; b.vy = 6;
  s.phase = PHASE.PLAY;
  run(s, 400);
  const d = b.dir();
  check(Math.abs(d.y) >= C.MIN_VY * 0.9, "近水平应被修正 dy=" + d.y.toFixed(3));
  check(b.speed() >= 500 && b.speed() <= C.MAX_SPEED, "速度仍在合理区间 " + b.speed().toFixed(1));
  const c = BP.clampV(520, 3, 0.16);
  check(Math.abs(Math.hypot(c.x, c.y) - Math.hypot(520, 3)) < 0.01, "限幅不改速度量级");
}

// 9 关卡数据
section("关卡数据校验");
{
  const ls = globalThis.LEVELDB.levels;
  check(ls.length >= 5, "至少 5 关，实际 " + ls.length);
  for (const lv of ls) {
    const g = new BP.Grid(lv.rows, globalThis.LEVELDB.legend);
    check(g.destructibleTotal > 0, lv.id + " 有可破坏砖");
    check(g.warnings.length === 0, lv.id + " 无警告 " + g.warnings.join(";"));
    for (const row of lv.rows) check(row.length === C.COLS, lv.id + " 行宽 " + row.length);
  }
}

// 10 自动挡板清关
section("自动驾驶清关（集成）");
{
  let total = 0;
  for (const lv of globalThis.LEVELDB.levels) {
    const s = new BP.Sim();
    s.setup(lv, 20261028);
    let t = 0, escaped = false;
    while (t < 240 && s.phase !== PHASE.CLEAR && s.phase !== PHASE.FAIL) {
      if (s.balls.length) {
        const b = s.balls[0];
        s.setPaddleTarget(b.x + Math.sin(t * 0.9) * 45, 100000);
        if (b.x < C.WALL_L - 40 || b.x > C.WALL_R + 40 || b.y < C.CEIL - 40) escaped = true;
      }
      if (s.phase === PHASE.SERVE) s.launch();
      s.step(C.FIXED);
      t += C.FIXED;
    }
    total += t;
    check(!escaped, lv.id + " 球不得飞出场外");
    check(s.phase === PHASE.CLEAR, lv.id + " 应在 240s 内清空，用时 " + t.toFixed(1) + "s 剩 " + s.grid.destructibleAlive);
    check(s.lives === 3, lv.id + " 完美挡板不掉球");
  }
  console.log("    自动驾驶总用时 " + total.toFixed(1) + "s");
}

// 11 浸泡
section("长时间浸泡（多球+最高速）");
{
  const s = newSim(["############", "############", "############", "############"], 900, 99);
  s.launch();
  s.phase = PHASE.PLAY;
  s.balls[0].attached = false;
  const rng = new BP.XRand(4242);
  for (let i = 0; i < 4; i++) {
    const b = new BP.Ball(rng.range(200, 1000), rng.range(200, 500));
    const a = rng.range(0, Math.PI * 2);
    b.vx = Math.cos(a) * 900; b.vy = Math.sin(a) * 900;
    s.balls.push(b);
  }
  let ok = true, t = 0;
  for (let i = 0; i < 120 * 60; i++) {
    for (const b of s.balls) {
      if (!b.active) continue;
      if (b.x < C.WALL_L - 12 || b.x > C.WALL_R + 12 || b.y < C.CEIL - 12) ok = false;
      if (!isFinite(b.x) || !isFinite(b.y)) ok = false;
    }
    if (s.phase === PHASE.SERVE) s.launch();
    s.step(C.FIXED);
    t += C.FIXED;
    if (s.phase === PHASE.CLEAR) break;
  }
  check(ok, "60 秒高负载后所有球仍在场内");
  console.log("    浸泡结束 t=" + t.toFixed(1) + "s 剩余砖块=" + s.grid.destructibleAlive + " phase=" + s.phase);
}

console.log("\n===================================================");
console.log("通过 " + pass + " 项 / 失败 " + fail + " 项");
for (const f of fails) console.log("  ✗ " + f);
console.log("===================================================");
process.exit(fail > 0 ? 1 : 0);
