const BP = require("../web/js/core.js");
const rows = ["GGGGGGGGGGGG", "MMMMMMMMMMMM", "############"];
const sim = new BP.Sim();
sim.setMods(Object.assign(BP.defaultStats(), { damage: 1, dropRate: 30 }));
sim.setup({ id: "t", name: "t", rows, legend: BP.LEGEND, speed: 520, lives: 3 }, 42);
sim.launch();
const m0 = sim.grid.cells.find(b => b && b.move);
const x0 = m0.rect.x;
let picked = [], spawned = 0;
sim.on("dropSpawned", () => spawned++);
sim.on("pickup", (t) => picked.push(t));
// 直接打掉所有砖，触发掉落
for (const b of sim.grid.aliveBricks().slice()) sim._damageBrick(b, 99, { x: b.cx(), y: b.cy() }, "ball");
console.log("drops on field:", sim.drops.length, "spawned:", spawned);
// 让掉落物落到挡板
sim.paddleX = sim.drops.length ? sim.drops[0].x : sim.paddleX;
sim.paddleTarget = sim.paddleX;
for (let i = 0; i < 400 && sim.drops.length; i++) {
  sim.paddleX = sim.drops[0].x; sim.paddleTarget = sim.paddleX;
  sim._tickDrops(BP.C.FIXED);
}
console.log("picked:", picked.join(",") || "(none)", "gold:", sim.bonusGold, "shield:", sim.shield);
// 移动砖位移
const m1 = new BP.Grid(["M.M.M.M.M.M."], BP.LEGEND);
const b0 = m1.cells.find(b => b && b.move).rect.x;
for (let i = 0; i < 120; i++) m1.tick(BP.C.FIXED);
const b1 = m1.cells.find(b => b && b.move).rect.x;
console.log("moving brick:", b0, "->", b1, "moved:", Math.abs(b1 - b0) > 1);
console.log("buffReport:", JSON.stringify(sim.buffReport()));
