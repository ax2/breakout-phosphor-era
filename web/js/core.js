/* BREAKOUT: 磷光纪元 — 核心模拟 v2（网页版）
 * 与 Godot 版共享同一套基础规则；v2 增加了状态效果、构筑属性与 Boss 部件。
 * 不依赖 DOM，可在 Node 中直接测试。
 */
(function (root) {
  "use strict";

  const C = {
    W: 1280, H: 720,
    WALL_L: 64, WALL_R: 1216, ARENA_W: 1152,
    CEIL: 56, DEATH: 706,
    PADDLE_TOP: 648, PADDLE_H: 14, PADDLE_W: 132,
    BALL_R: 7,
    BASE_SPEED: 535, MAX_SPEED: 940, SPEED_PER_BRICK: 3.4,
    MIN_VY: 0.16, MAX_CONTACTS: 8,
    PADDLE_ANGLE: 62, PADDLE_MAX_ANGLE: 74, PADDLE_INFLUENCE: 0.14,
    KEY_SPEED: 1080, MOUSE_SPEED: 6200, MOUSE_SWITCH: 6,
    COLS: 12, ROWS: 9, GRID_X: 64, GRID_Y: 112, BRICK_W: 96, BRICK_H: 28,
    FIXED: 1 / 120, MAX_FRAME_STEPS: 8, SERVE_DELAY: 0.65, COMBO_WINDOW: 2.4,
    STALL_EPS: 0.10, STALL_TIME: 1.1,
    ASSIST_TIME: 5.0, ECHO_COUNT: 3, ECHO_RATE: 0.55, ECHO_FORCE: 1.5,
    IDLE_RESCUE: 7.0,
    // 收束：只剩最后几块又久攻不下时，残响每 4.5 秒直接打一发，
    // 把"满地图找最后一块砖"的磨损砍掉，但只在收尾阶段生效。
    ENDGAME_COUNT: 4, ENDGAME_TICK: 4.5, ENDGAME_IDLE: 2.2,
    // 兜底：若连续 10 秒一发未中（几何死角 / 球在空腔里空转），残响直接补一发，
    // 保证任何关卡都不会因为"够不到最后几块砖"而永久卡死。
    STALL_RESCUE: 10.0,
    SCORE_BRICK: 10, SCORE_TOUGH: 25, SCORE_ARMORED: 40, SCORE_BLAST: 30,
    COMBO_BONUS: 0.25,
    MAX_PARTICLES: 900, MAX_RINGS: 48, TRAIL: 18, MAX_BALLS: 12,
    SHIELD_Y: 700,
    DROP_FALL: 176, DROP_R: 15, DROP_TTL: 14, DROP_WIDE: 46,
  };
  C.PADDLE_MIN_X = C.WALL_L + C.PADDLE_W / 2;
  C.PADDLE_MAX_X = C.WALL_R - C.PADDLE_W / 2;
  C.PADDLE_MID = (C.WALL_L + C.WALL_R) / 2;

  const PHASE = { IDLE: 0, SERVE: 1, PLAY: 2, RESET: 3, CLEAR: 4, FAIL: 5 };

  const TYPES = {
    normal: { hp: 1, score: C.SCORE_BRICK, solid: false, label: "普通" },
    tough: { hp: 2, score: C.SCORE_TOUGH, solid: false, label: "双层" },
    armored: { hp: 3, score: C.SCORE_ARMORED, solid: false, label: "装甲" },
    blast: { hp: 1, score: C.SCORE_BLAST, solid: false, label: "爆裂" },
    solid: { hp: -1, score: 0, solid: true, label: "障碍" },
    regen: { hp: 2, score: C.SCORE_TOUGH, solid: false, label: "再生" },
    shieldNode: { hp: 2, score: C.SCORE_ARMORED, solid: false, label: "护盾节点" },
    core: { hp: 12, score: 200, solid: false, label: "核心" },
    armorPlate: { hp: 6, score: 60, solid: false, label: "护甲" },
    weakPoint: { hp: 3, score: 80, solid: false, label: "弱点" },
    gold: { hp: 1, score: 45, solid: false, label: "金砖" },
    moving: { hp: 1, score: 25, solid: false, label: "游走" },
  };

  const TYPE_COLOR = {
    normal: "#6be39a", tough: "#7fc8ff", armored: "#ffc46b",
    blast: "#ff6b7e", solid: "#7d8b93", regen: "#8ee6c8",
    shieldNode: "#b39cff", core: "#ff9d5c", armorPlate: "#c9a227", weakPoint: "#ff5f8a",
    gold: "#ffd479", moving: "#7fd8ff",
  };

  // 掉落物：砖块破碎时按概率脱落，接住即生效（临时增益，不写入构筑）
  const DROPS = {
    multi:  { color: "#7cffb2", glyph: "◉", label: "多球",  weight: 12 },
    wide:   { color: "#7fd8ff", glyph: "↔", label: "加宽",  weight: 14 },
    laser:  { color: "#ffc46b", glyph: "↟", label: "激光",  weight: 10 },
    shield: { color: "#b39cff", glyph: "▣", label: "护盾",  weight: 8 },
    magnet: { color: "#8ee6c8", glyph: "⌁", label: "磁吸",  weight: 8 },
    slow:   { color: "#9fb3bd", glyph: "◷", label: "减速",  weight: 9 },
    gold:   { color: "#ffd479", glyph: "◆", label: "碎片",  weight: 16 },
    life:   { color: "#ff6b7e", glyph: "♥", label: "备用球", weight: 3 },
  };
  const DROP_KEYS = Object.keys(DROPS);
  const DROP_TOTAL = DROP_KEYS.reduce((a, k) => a + DROPS[k].weight, 0);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function XRand(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  XRand.prototype.next = function () {
    let t = (this.s += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  XRand.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  XRand.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  XRand.prototype.pick = function (arr) { return arr.length ? arr[this.int(0, arr.length - 1)] : null; };

  function circleRect(p0x, p0y, p1x, p1y, r, rect) {
    const minx = rect.x - r, maxx = rect.x + rect.w + r;
    const miny = rect.y - r, maxy = rect.y + rect.h + r;
    const dx = p1x - p0x, dy = p1y - p0y;
    let tmin = 0, tmax = 1, axis = -1, sx = 0, sy = 0;
    if (Math.abs(dx) < 1e-9) {
      if (p0x < minx || p0x > maxx) return null;
    } else {
      const inv = 1 / dx;
      let t1 = (minx - p0x) * inv, t2 = (maxx - p0x) * inv, s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 0; sx = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (Math.abs(dy) < 1e-9) {
      if (p0y < miny || p0y > maxy) return null;
    } else {
      const inv = 1 / dy;
      let t1 = (miny - p0y) * inv, t2 = (maxy - p0y) * inv, s = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = 1; sx = 0; sy = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (axis === -1) {
      const dl = p0x - minx, dr = maxx - p0x, du = p0y - miny, dd = maxy - p0y;
      const m = Math.min(dl, dr, du, dd);
      if (m === dl) return { t: 0, nx: -1, ny: 0, pen: dl + 0.01 };
      if (m === dr) return { t: 0, nx: 1, ny: 0, pen: dr + 0.01 };
      if (m === du) return { t: 0, nx: 0, ny: -1, pen: du + 0.01 };
      return { t: 0, nx: 0, ny: 1, pen: dd + 0.01 };
    }
    if (tmin > 1) return null;
    return { t: clamp(tmin, 0, 1), nx: sx, ny: sy, pen: 0 };
  }

  function clampV(vx, vy, minVy) {
    const mag = Math.hypot(vx, vy);
    if (mag < 1e-9) return { x: 0, y: 0 };
    const dx = vx / mag, dy = vy / mag;
    if (Math.abs(dy) >= minVy) return { x: vx, y: vy };
    const sgn = dy >= 0 ? 1 : -1;
    const ny = sgn * minVy;
    let nx = Math.sqrt(Math.max(0, 1 - ny * ny));
    nx *= dx >= 0 ? 1 : -1;
    if (Math.abs(dx) < 1e-6) nx = Math.sqrt(Math.max(0, 1 - ny * ny));
    const l = Math.hypot(nx, ny);
    return { x: (nx / l) * mag, y: (ny / l) * mag };
  }

  // 只限制最小垂直分量时，球会在竖井里以 vx=0 永远上下弹、碰不到任何砖。
  // 这里再保底一个最小水平分量，把"完美竖直"这个退化轨形排除掉。
  function clampH(vx, vy, minVx) {
    const mag = Math.hypot(vx, vy);
    if (mag < 1e-9) return { x: 0, y: 0 };
    const dx = vx / mag, dy = vy / mag;
    if (Math.abs(dx) >= minVx) return { x: vx, y: vy };
    // 退化到完全竖直时的兜底方向：用确定性的符号，避免 Math.random 破坏回放/测量可复现性
    const sgn = dx > 1e-9 ? 1 : dx < -1e-9 ? -1 : (dy >= 0 ? 1 : -1);
    const nx = sgn * minVx;
    const ny = (dy >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, 1 - nx * nx));
    return { x: nx * mag, y: ny * mag };
  }

  function reflect(vx, vy, nx, ny) {
    const d = vx * nx + vy * ny;
    return { x: vx - 2 * d * nx, y: vy - 2 * d * ny };
  }

  // ---------------------------------------------------------------- 砖块
  function Brick(col, row, type, rect) {
    const def = TYPES[type] || TYPES.normal;
    this.col = col; this.row = row; this.type = type;
    this.maxHp = def.hp; this.hp = def.hp;
    this.alive = true;
    this.rect = rect || { x: C.GRID_X + col * C.BRICK_W, y: C.GRID_Y + row * C.BRICK_H, w: C.BRICK_W, h: C.BRICK_H };
    this.baseX = this.rect.x;
    this.move = null;
    if (type === "moving") {
      const dir = (row % 2 === 0) ? 1 : -1;
      this.move = { amp: 22, spd: 0.9 + (col % 3) * 0.18, phase: col * 0.8 + row * 1.7, dir };
    }
    // 状态
    this.burn = 0; this.burnDps = 0;
    this.frozen = 0;
    this.charge = 0;
    this.hitFlash = 0;
    // Boss 部件
    this.isPart = false; this.partId = ""; this.invuln = false;
    this.regen = 0; this.regenTimer = 0;
  }
  Brick.prototype.solid = function () { return TYPES[this.type].solid; };
  Brick.prototype.score = function () { return TYPES[this.type].score; };
  Brick.prototype.cx = function () { return this.rect.x + this.rect.w / 2; };
  Brick.prototype.cy = function () { return this.rect.y + this.rect.h / 2; };

  function Grid(rows, legend) {
    this.cols = C.COLS;
    this.rows = rows.length;
    this.cells = new Array(this.cols * this.rows).fill(null);
    this.destructibleTotal = 0;
    this.destructibleAlive = 0;
    this.solidsAlive = 0;
    this.warnings = [];
    for (let r = 0; r < this.rows; r++) {
      const line = String(rows[r]);
      for (let c = 0; c < Math.min(this.cols, line.length); c++) {
        const ch = line[c];
        if (ch === "." || ch === " ") continue;
        const t = legend[ch];
        if (!t || !TYPES[t]) { this.warnings.push("未知符号 " + ch + " @" + c + "," + r); continue; }
        const b = new Brick(c, r, t);
        this.cells[r * this.cols + c] = b;
        if (b.solid()) this.solidsAlive++;
        else { this.destructibleTotal++; this.destructibleAlive++; }
      }
    }
    this._validate();
  }
  Grid.prototype.at = function (c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null;
    return this.cells[r * this.cols + c];
  };
  Grid.prototype.candidates = function (p0x, p0y, p1x, p1y, r) {
    const lox = Math.min(p0x, p1x) - r, hix = Math.max(p0x, p1x) + r;
    const loy = Math.min(p0y, p1y) - r, hiy = Math.max(p0y, p1y) + r;
    let c0 = Math.floor((lox - C.GRID_X) / C.BRICK_W), c1 = Math.floor((hix - C.GRID_X) / C.BRICK_W);
    let r0 = Math.floor((loy - C.GRID_Y) / C.BRICK_H), r1 = Math.floor((hiy - C.GRID_Y) / C.BRICK_H);
    c0 = Math.max(0, c0); r0 = Math.max(0, r0);
    c1 = Math.min(this.cols - 1, c1); r1 = Math.min(this.rows - 1, r1);
    const out = [];
    for (let rr = r0; rr <= r1; rr++)
      for (let cc = c0; cc <= c1; cc++) {
        const b = this.cells[rr * this.cols + cc];
        if (b && b.alive) out.push(b);
      }
    return out;
  };
  Grid.prototype.remove = function (b) {
    if (!b.alive) return;
    b.alive = false;
    this.cells[b.row * this.cols + b.col] = null;
    if (b.solid()) this.solidsAlive--; else this.destructibleAlive--;
  };
  Grid.prototype.tick = function (dt) {
    for (const b of this.cells) {
      if (!b || !b.alive || !b.move) continue;
      b.move.phase += dt * b.move.spd;
      const x = b.baseX + Math.sin(b.move.phase) * b.move.amp * b.move.dir;
      b.rect.x = clamp(x, C.WALL_L, C.WALL_R - b.rect.w);
    }
  };
  Grid.prototype.aliveBricks = function () {
    const out = [];
    for (const b of this.cells) if (b && b.alive) out.push(b);
    return out;
  };
  Grid.prototype.cleared = function () { return this.destructibleAlive <= 0; };
  Grid.prototype._validate = function () {
    const vrows = this.rows + 2;
    const pass = new Array(vrows * this.cols).fill(true);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const b = this.cells[r * this.cols + c];
        pass[(r + 1) * this.cols + c] = !b || !b.solid();
      }
    const seen = new Array(vrows * this.cols).fill(false);
    const q = [];
    for (let c = 0; c < this.cols; c++) {
      seen[c] = true; q.push(c);
      const bid = (vrows - 1) * this.cols + c;
      seen[bid] = true; q.push(bid);
    }
    for (let qi = 0; qi < q.length; qi++) {
      const id = q[qi], rr = (id / this.cols) | 0, cc = id % this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = rr + dr, nc = cc + dc;
        if (nr < 0 || nr >= vrows || nc < 0 || nc >= this.cols) continue;
        const nid = nr * this.cols + nc;
        if (seen[nid] || !pass[nid]) continue;
        seen[nid] = true; q.push(nid);
      }
    }
    let trapped = 0;
    for (const b of this.aliveBricks()) {
      if (b.solid()) continue;
      let ok = false;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = b.col + dc, nr = b.row + dr;
        if (nc < 0 || nc >= this.cols) continue;
        let vid;
        if (nr < 0) vid = nc;
        else if (nr >= this.rows) vid = (vrows - 1) * this.cols + nc;
        else vid = (nr + 1) * this.cols + nc;
        if (seen[vid]) { ok = true; break; }
      }
      if (!ok) trapped++;
    }
    if (trapped > 0) this.warnings.push(trapped + " 块砖被不可破坏结构封死");
  };

  // ---------------------------------------------------------------- 弹球
  function Ball(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = C.BALL_R; this.active = true; this.attached = false;
    this.trail = [];
    this.stall = 0; this.sinceBrick = 0; this.idle = 0;
    this.probeX = x; this.probeY = y; this.probeT = 0;
    this.pierce = 0; this.dmgBonus = 0;
    this.critNext = false;
    this.heat = 0;
  }
  Ball.prototype.speed = function () { return Math.hypot(this.vx, this.vy); };
  Ball.prototype.dir = function () {
    const s = this.speed();
    return s < 1e-9 ? { x: 0, y: -1 } : { x: this.vx / s, y: this.vy / s };
  };
  Ball.prototype.pushTrail = function () {
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > C.TRAIL) this.trail.pop();
  };

  // ---------------------------------------------------------------- 默认属性
  function defaultStats() {
    return {
      damage: 1, critChance: 0, critMult: 2, centerCrit: false,
      pierce: 0, maxSpeed: C.MAX_SPEED, startSpeed: C.BASE_SPEED,
      burn: 0, burnDps: 0, burnSpread: 0,
      explodeChance: 0, explodeRadius: 1,
      freezeChance: 0, freezeDur: 0, shatter: 0,
      charge: 0, chainCount: 0, chainDamage: 1,
      balls: 1, splitChance: 0,
      paddleW: C.PADDLE_W, paddleSpeed: 1,
      magnet: 0, laserCd: 0, laserDamage: 1, drones: 0,
      shieldCharges: 0, shieldMax: 0,
      goldBonus: 0, xpBonus: 0, comboBonus: 1,
      bounceDamage: 0, lastStand: false,
      lifesteal: 0, dropRate: 1,
    };
  }

  // ---------------------------------------------------------------- 模拟
  function Sim() {
    this.grid = null;
    this.balls = [];
    this.phase = PHASE.IDLE;
    this.paddleX = C.W / 2;
    this.paddleTarget = C.W / 2;
    this.paddleW = C.PADDLE_W;
    this.paddleVx = 0;
    this.paddleMaxSpeed = C.MOUSE_SPEED;
    this.lives = 3;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.speed = C.BASE_SPEED;
    this.baseSpeed = C.BASE_SPEED;
    this.levelId = "";
    this.levelName = "";
    this.time = 0; this.levelTime = 0;
    this.paused = false;
    this.assistActive = false; this.assistReason = ""; this.assistTarget = null;
    this.assistEnabled = true;
    this.rng = new XRand(1);
    this.stats = { hits: 0, bricks: 0, maxCombo: 0, assists: 0, bounces: 0, wall: 0, kills: 0, damage: 0 };
    this.mods = defaultStats();
    this.baseMods = null;
    this._resetT = 0; this._lastBreak = -99; this._lastBrickT = 0;
    this._nearestT = 0; this._chain = 0; this._cleared = false; this._endT = C.ENDGAME_TICK;
    this.hooks = {};
    this.boss = null;
    this.shield = 0;
    this.laserT = 0; this.droneT = 0;
    this.hitStop = 0;
    this.bonusBricks = 0;
    this.drops = [];
    this.buffs = { wide: 0, laser: 0, magnet: 0, slow: 0 };
    this.dropsEnabled = true;
    this.picked = 0;
    this.bonusGold = 0;
  }

  Sim.prototype.on = function (name, fn) { this.hooks[name] = fn; };
  Sim.prototype.emit = function (name, ...a) { const f = this.hooks[name]; if (f) f(...a); };

  Sim.prototype.setMods = function (mods) {
    this.mods = Object.assign(defaultStats(), mods || {});
    this.paddleW = this.mods.paddleW;
    this.shield = this.mods.shieldCharges || 0;
    this.speed = Math.min(this.mods.startSpeed, this.mods.maxSpeed);
    if (this.balls.length) {
      for (const b of this.balls) {
        if (b.attached) continue;
        const s = b.speed();
        if (s > 1e-6) {
          const target = Math.min(Math.max(s, this.mods.startSpeed), this.mods.maxSpeed);
          b.vx = (b.vx / s) * target; b.vy = (b.vy / s) * target;
        }
      }
    }
  };

  Sim.prototype.setup = function (def, seed) {
    this.rng = new XRand(seed || 1);
    this.grid = new Grid(def.rows || [], def.legend || LEGEND);
    this.levelId = def.id || "custom";
    this.levelName = def.name || "自定义";
    this.lives = def.lives == null ? 3 : def.lives;
    this.baseSpeed = def.speed || C.BASE_SPEED;
    this.paddleW = this.mods.paddleW;
    this.paddleX = C.PADDLE_MID;
    this.paddleTarget = this.paddleX;
    this.paddleVx = 0;
    this.score = 0; this.combo = 0; this.bestCombo = 0;
    this.time = 0; this.levelTime = 0; this.paused = false;
    this.assistActive = false; this.assistReason = ""; this.assistTarget = null;
    this._cleared = false; this._lastBreak = -99; this._lastBrickT = 0; this._endT = C.ENDGAME_TICK;
    for (const k in this.stats) this.stats[k] = 0;
    this.balls = [];
    this.boss = null;
    this.shield = this.mods.shieldCharges || 0;
    this.laserT = this.mods.laserCd || 0;
    this.droneT = 2.5;
    this.drops.length = 0;
    for (const k in this.buffs) this.buffs[k] = 0;
    this.picked = 0;
    this.bonusGold = 0;
    this.paddleW = this.mods.paddleW;
    this._spawnServe();
    this.phase = PHASE.SERVE;
    this.speed = Math.min(this.mods.startSpeed, this.mods.maxSpeed);
  };

  Sim.prototype._spawnServe = function () {
    const b = new Ball(this.paddleX, C.PADDLE_TOP - C.BALL_R - 1);
    b.attached = true;
    this.balls = [b];
  };

  Sim.prototype.setPaddleTarget = function (x, maxSpeed) {
    this.paddleMaxSpeed = maxSpeed == null ? C.MOUSE_SPEED : maxSpeed;
    const half = this.paddleW / 2;
    this.paddleTarget = clamp(x, C.WALL_L + half, C.WALL_R - half);
  };
  Sim.prototype.nudgePaddle = function (d) {
    this.paddleTarget = clamp(this.paddleTarget + d, C.WALL_L + this.paddleW / 2, C.WALL_R - this.paddleW / 2);
  };
  Sim.prototype.aimOffset = function () {
    return clamp((this.paddleX - C.PADDLE_MID) / (C.ARENA_W / 2), -1, 1);
  };
  Sim.prototype.aimAngle = function () { return this.aimOffset() * (45 * Math.PI / 180); };

  Sim.prototype.launch = function () {
    if (this.phase !== PHASE.SERVE || !this.balls.length) return;
    const b = this.balls[0];
    b.attached = false;
    let ang = this.aimAngle();
    ang = clamp(ang + clamp(this.paddleVx / 1200, -1, 1) * 0.10, -50 * Math.PI / 180, 50 * Math.PI / 180);
    b.x = this.paddleX; b.y = C.PADDLE_TOP - C.BALL_R - 1;
    const spd = Math.min(this.mods.startSpeed, this.mods.maxSpeed);
    b.vx = Math.sin(ang) * spd;
    b.vy = -Math.cos(ang) * spd;
    const lch = clampH(b.vx, b.vy, 0.11);
    b.vx = lch.x; b.vy = lch.y;
    b.trail.length = 0;
    b.sinceBrick = 0;
    this.phase = PHASE.PLAY;
    this.emit("launch", ang);
  };

  Sim.prototype.step = function (dt) {
    dt = dt || C.FIXED;
    if (this.paused || this.phase === PHASE.IDLE || this.phase === PHASE.CLEAR || this.phase === PHASE.FAIL) return;
    this.time += dt; this.levelTime += dt;
    this._movePaddle(dt);

    if (this.phase === PHASE.SERVE) {
      for (const b of this.balls) if (b.attached) {
        b.x = this.paddleX; b.y = C.PADDLE_TOP - C.BALL_R - 1; b.pushTrail();
      }
      this._tickSystems(dt);
      this._tickDropFall(dt);
      return;
    }
    if (this.phase === PHASE.RESET) {
      this._resetT -= dt;
      this._tickSystems(dt);
      this._tickDropFall(dt);
      if (this._resetT <= 0) { this._spawnServe(); this.phase = PHASE.SERVE; }
      return;
    }

    if (this.grid) { this.grid.tick(dt); this._tickDrops(dt); }
    for (const b of this.balls) if (b.active) this._stepBall(b, dt);
    this._tickStatuses(dt);
    this._tickSystems(dt);
    if (this.boss) this.boss.tick(dt, this);

    let any = false;
    for (const b of this.balls) if (b.active) { any = true; break; }
    if (!any && this.phase === PHASE.PLAY) this._allLost();
  };

  Sim.prototype._tickSystems = function (dt) {
    // 激光
    const laserOn = this.mods.laserCd > 0 || this.buffs.laser > 0;
    if (laserOn && this.phase === PHASE.PLAY) {
      this.laserT -= dt;
      if (this.laserT <= 0) {
        this.laserT = this.mods.laserCd > 0 ? this.mods.laserCd : 1.05;
        const target = this._lowestBrickNear(this.paddleX, 260);
        if (target) {
          this._damageBrick(target, this.mods.laserDamage, { x: this.paddleX, y: C.PADDLE_TOP - 10 }, "laser");
          this.emit("laser", this.paddleX, target.cx(), target.cy());
        }
      }
    }
    // 收束打击：最后几块砖久攻不下时，残响直接补一发
    if (this.phase === PHASE.PLAY && this.grid) {
      const alive = this.grid.destructibleAlive;
      if (alive > 0 && alive <= C.ENDGAME_COUNT) {
        this._endT -= dt;
        if (this._endT <= 0 && (this.time - this._lastBrickT) >= C.ENDGAME_IDLE) {
          const t = this._lowestBrickNear(this.paddleX, 1e9) || this.assistTarget;
          if (t && t.alive && !t.solid() && !t.invuln) {
            this._endT = C.ENDGAME_TICK;
            this._damageBrick(t, 1, { x: t.cx(), y: t.cy() }, "laser");
            this.emit("laser", this.paddleX, t.cx(), t.cy());
            this.emit("endgame", alive);
          }
        }
      } else this._endT = C.ENDGAME_TICK;
    }
    // 死角兜底：任何关卡连续 10 秒零命中就补一发，只打可破坏砖，不碰护盾结构
    if (this.phase === PHASE.PLAY && (this.time - this._lastBrickT) >= C.STALL_RESCUE) {
      const t = this._lowestBrickNear(this.paddleX, 1e9);
      if (t && t.alive && !t.solid() && !t.invuln) {
        this._damageBrick(t, 1, { x: t.cx(), y: t.cy() }, "laser");
        this.emit("laser", this.paddleX, t.cx(), t.cy());
        this.emit("assist", "残响补射：长时间未命中");
        this._lastBrickT = this.time;
      }
    }

    // 无人机
    if (this.mods.drones > 0 && this.phase === PHASE.PLAY) {
      this.droneT -= dt;
      if (this.droneT <= 0) {
        this.droneT = 2.6 / this.mods.drones;
        const list = this.grid.aliveBricks().filter((b) => !b.solid());
        if (list.length) {
          const t = list[this.rng.int(0, list.length - 1)];
          this._damageBrick(t, 1, { x: t.cx(), y: t.cy() - 40 }, "drone");
          this.emit("drone", t.cx(), t.cy());
        }
      }
    }
  };

  // ---------------------------------------------------------------- 掉落物
  Sim.prototype._rollDrop = function () {
    let t = this.rng.next() * DROP_TOTAL;
    for (const k of DROP_KEYS) {
      t -= DROPS[k].weight;
      if (t <= 0) return k;
    }
    return "gold";
  };

  Sim.prototype._maybeDrop = function (brick, x, y) {
    if (!this.dropsEnabled || this.drops.length >= 6) return;
    if (brick.isPart) return;
    let chance = 0.055;
    if (brick.type === "tough") chance = 0.085;
    else if (brick.type === "armored") chance = 0.12;
    else if (brick.type === "blast") chance = 0.16;
    else if (brick.type === "regen") chance = 0.10;
    else if (brick.type === "gold") chance = 0.42;
    chance *= (this.mods.dropRate || 1);
    if (this.rng.next() > chance) return;
    const type = this._rollDrop();
    this.drops.push({
      x: clamp(x, C.WALL_L + C.DROP_R, C.WALL_R - C.DROP_R),
      y: y, vy: 0, type: type, age: 0, ph: this.rng.range(0, 6.28), sway: this.rng.range(-22, 22),
    });
    this.emit("dropSpawned", type, x, y);
  };

  Sim.prototype._tickDropFall = function (dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.vy = Math.min(C.DROP_FALL, d.vy + 520 * dt);
      d.y += d.vy * dt;
      d.ph += dt * 3.2;
      // 磁吸：接近底板时朝挡板漂
      const mag = this.mods.magnet + (this.buffs.magnet > 0 ? 1 : 0);
      if (mag > 0 && d.y > C.PADDLE_TOP - 220) {
        d.x += clamp(this.paddleX - d.x, -1, 1) * 78 * dt;
      } else {
        d.x += Math.sin(d.ph) * d.sway * dt;
      }
      if (d.age > C.DROP_TTL || d.y - C.DROP_R > C.DEATH) {
        this.drops.splice(i, 1);
        this.emit("dropMiss", d.type, d.x, d.y);
      }
    }
  };

  Sim.prototype._tickDrops = function (dt) {
    // 临时增益倒计时
    let changed = false;
    for (const k in this.buffs) {
      if (this.buffs[k] > 0) {
        this.buffs[k] = Math.max(0, this.buffs[k] - dt);
        if (this.buffs[k] === 0) changed = true;
      }
    }
    if (changed) this._syncPaddleWidth();
    this._tickDropFall(dt);

    // 接住判定
    const half = this.paddleW / 2;
    const px = this.paddleX - half;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.y + C.DROP_R < C.PADDLE_TOP - 2) continue;
      if (d.y - C.DROP_R > C.PADDLE_TOP + C.PADDLE_H + 8) continue;
      if (d.x < px - C.DROP_R || d.x > px + this.paddleW + C.DROP_R) continue;
      this.drops.splice(i, 1);
      this._applyDrop(d.type, d.x, d.y);
    }
  };

  Sim.prototype._syncPaddleWidth = function () {
    const target = this.mods.paddleW + (this.buffs.wide > 0 ? C.DROP_WIDE : 0);
    if (Math.abs(target - this.paddleW) < 0.5) return;
    this.paddleW = target;
    const half = this.paddleW / 2;
    this.paddleX = clamp(this.paddleX, C.WALL_L + half, C.WALL_R - half);
    this.paddleTarget = clamp(this.paddleTarget, C.WALL_L + half, C.WALL_R - half);
  };

  Sim.prototype._applyDrop = function (type, x, y) {
    this.picked++;
    this.score += 5;
    switch (type) {
      case "multi":
        if (this.balls.length < C.MAX_BALLS) this._spawnExtraBall(x, C.PADDLE_TOP - 20);
        break;
      case "wide":
        this.buffs.wide = 14; this._syncPaddleWidth(); break;
      case "laser":
        this.buffs.laser = 12; this.laserT = Math.min(this.laserT, 0.35); break;
      case "shield":
        this.shield = Math.min(3, this.shield + 1); break;
      case "magnet":
        this.buffs.magnet = 12; break;
      case "slow":
        this.buffs.slow = 9; break;
      case "gold":
        this.bonusGold += 5; break;
      case "life":
        this.lives = Math.min(9, this.lives + 1); break;
      default: break;
    }
    this.emit("pickup", type, x, y, DROPS[type] ? DROPS[type].label : "");
  };

  Sim.prototype._lowestBrickNear = function (x, range) {
    let best = null, bestY = -1e9;
    const all = this._allBricks();
    for (const b of all) {
      if (!b.alive || b.solid() || b.invuln) continue;
      if (Math.abs(b.cx() - x) > range) continue;
      if (b.cy() > bestY) { bestY = b.cy(); best = b; }
    }
    return best;
  };

  Sim.prototype._allBricks = function () {
    const arr = this.grid ? this.grid.aliveBricks() : [];
    if (this.boss) for (const p of this.boss.parts) if (p.alive) arr.push(p);
    return arr;
  };

  Sim.prototype._movePaddle = function (dt) {
    const prev = this.paddleX;
    const maxStep = this.paddleMaxSpeed * this.mods.paddleSpeed * dt;
    const dx = clamp(this.paddleTarget - this.paddleX, -maxStep, maxStep);
    const half = this.paddleW / 2;
    this.paddleX = clamp(this.paddleX + dx, C.WALL_L + half, C.WALL_R - half);
    this.paddleVx = lerp(this.paddleVx, (this.paddleX - prev) / dt, 0.45);
  };

  Sim.prototype._stepBall = function (b, dt) {
    if (this.buffs.slow > 0) dt *= 0.8;
    b.sinceBrick += dt; b.idle += dt;
    let remaining = dt, guard = 0;
    while (remaining > 1e-7 && guard < C.MAX_CONTACTS) {
      guard++;
      const p0x = b.x, p0y = b.y;
      const p1x = b.x + b.vx * remaining, p1y = b.y + b.vy * remaining;
      const hit = this._earliest(b, p0x, p0y, p1x, p1y);
      if (!hit) { b.x = p1x; b.y = p1y; break; }
      const safe = Math.max(0, hit.t - 0.0004);
      b.x = p0x + (p1x - p0x) * safe;
      b.y = p0y + (p1y - p0y) * safe;
      remaining *= (1 - safe);
      if (hit.t <= 1e-5) {
        b.x += hit.nx * ((hit.pen || 0) + 0.03);
        b.y += hit.ny * ((hit.pen || 0) + 0.03);
        remaining -= 0.0005;
      }
      this._resolve(b, hit);
      if (!b.active || this.phase !== PHASE.PLAY) return;
      b.x += hit.nx * 0.02; b.y += hit.ny * 0.02;
    }
    b.pushTrail();

    // 底部护盾：吸收一次掉落
    if (b.y + b.r >= C.SHIELD_Y && this.shield > 0 && b.vy > 0) {
      this.shield--;
      b.y = C.SHIELD_Y - b.r - 1;
      b.vy = -Math.abs(b.vy);
      this.emit("shieldUsed", this.shield);
      this.emit("shieldBroke", b.x, b.y);
    }
    if (b.y - b.r > C.DEATH) { b.active = false; this.emit("ballLost", b.x, b.y); }
    this._antistuck(b, dt);
  };

  Sim.prototype._earliest = function (b, p0x, p0y, p1x, p1y) {
    let best = null;
    const paddle = { x: this.paddleX - this.paddleW / 2, y: C.PADDLE_TOP, w: this.paddleW, h: C.PADDLE_H };
    const ph = circleRect(p0x, p0y, p1x, p1y, b.r, paddle);
    if (ph) best = pick(best, ph, 0, "paddle", null);

    for (const brick of this.grid ? this.grid.candidates(p0x, p0y, p1x, p1y, b.r) : []) {
      const bh = circleRect(p0x, p0y, p1x, p1y, b.r, brick.rect);
      if (bh) best = pick(best, bh, 1, "brick", brick);
    }
    if (this.boss) {
      for (const part of this.boss.parts) {
        if (!part.alive) continue;
        if (part.rect.x > p1x + b.r + 40 && part.rect.x > p0x + b.r + 40) continue;
        if (part.rect.x + part.rect.w < p0x - b.r - 40 && part.rect.x + part.rect.w < p1x - b.r - 40) continue;
        const bh2 = circleRect(p0x, p0y, p1x, p1y, b.r, part.rect);
        if (bh2) best = pick(best, bh2, 1, "brick", part);
      }
    }
    const dx = p1x - p0x, dy = p1y - p0y;
    if (dx < -1e-9) best = pickPt(best, (C.WALL_L + b.r - p0x) / dx, 1, 0, 2, "wall", null);
    else if (dx > 1e-9) best = pickPt(best, (C.WALL_R - b.r - p0x) / dx, -1, 0, 2, "wall", null);
    if (dy < -1e-9) best = pickPt(best, (C.CEIL + b.r - p0y) / dy, 0, 1, 2, "wall", null);
    return best;
  };

  function pick(best, h, prio, kind, obj) { return pickPt(best, h.t, h.nx, h.ny, prio, kind, obj, h.pen); }
  function pickPt(best, t, nx, ny, prio, kind, obj, pen) {
    if (t < -1e-6 || t > 1) return best;
    const cand = { t, nx, ny, prio, kind, obj, pen: pen || 0 };
    if (!best) return cand;
    if (t < best.t - 1e-6 || (Math.abs(t - best.t) <= 1e-6 && prio < best.prio)) return cand;
    return best;
  }

  Sim.prototype._resolve = function (b, hit) {
    if (hit.kind === "paddle") this._paddleBounce(b);
    else if (hit.kind === "wall") {
      const r = reflect(b.vx, b.vy, hit.nx, hit.ny);
      const c = clampV(r.x, r.y, C.MIN_VY);
      const h = clampH(c.x, c.y, 0.10);
      b.vx = h.x; b.vy = h.y;
      this.stats.wall++; this.stats.bounces++;
      this.emit("wallBounce", b.x, b.y, hit.nx, hit.ny);
    } else this._hitBrick(b, hit.obj, hit.nx, hit.ny);
  };

  Sim.prototype._paddleBounce = function (b) {
    const half = this.paddleW / 2;
    const off = clamp((b.x - this.paddleX) / half, -1, 1);
    let ang = off * (C.PADDLE_ANGLE * Math.PI / 180);
    ang += clamp(this.paddleVx / 1200, -1, 1) * (C.PADDLE_INFLUENCE * 30 * Math.PI / 180);
    const lim = C.PADDLE_MAX_ANGLE * Math.PI / 180;
    ang = clamp(ang, -lim, lim);
    let spd = b.speed();
    if (spd < 1) spd = this.speed;
    b.vx = Math.sin(ang) * spd;
    b.vy = -Math.cos(ang) * spd;
    const ch = clampH(b.vx, b.vy, 0.13);
    b.vx = ch.x; b.vy = ch.y;
    b.y = Math.min(b.y, C.PADDLE_TOP - b.r - 0.02);
    b.sinceBrick = 0; b.stall = 0; b.idle = 0;
    this.stats.bounces++;

    // 精准接球：中心 18% 区域触发
    if (this.mods.centerCrit && Math.abs(off) < 0.18) b.critNext = true;
    if (this.mods.bounceDamage > 0) {
      b.dmgBonus = Math.min(3, b.dmgBonus + 0); // 由伤害计算读取
    }
    // 磁吸：接球后轻微回正
    const magnet = this.mods.magnet + (this.buffs.magnet > 0 ? 1 : 0);
    if (magnet > 0) {
      const s = b.speed();
      const d = b.dir();
      const toward = Math.sign(this.paddleX - b.x);
      b.vx = (d.x + toward * 0.06 * magnet) * s;
      b.vy = d.y * s;
      const c = clampV(b.vx, b.vy, C.MIN_VY);
      b.vx = c.x; b.vy = c.y;
    }
    this.emit("paddle", off, spd);
  };

  Sim.prototype._hitBrick = function (b, brick, nx, ny) {
    if (!brick || !brick.alive) return;
    this.stats.hits++;
    this._lastBrickT = this.time;
    b.sinceBrick = 0; b.idle = 0;

    if (brick.solid()) {
      this.emit("brickHit", brick, 0, b.x, b.y);
      const r = reflect(b.vx, b.vy, nx, ny);
      const c = clampV(r.x, r.y, C.MIN_VY);
      b.vx = c.x; b.vy = c.y;
      return;
    }
    if (brick.invuln) {
      this.emit("brickHit", brick, 0, b.x, b.y);
      const r = reflect(b.vx, b.vy, nx, ny);
      const c = clampV(r.x, r.y, C.MIN_VY);
      b.vx = c.x; b.vy = c.y;
      this.emit("invuln", brick.cx(), brick.cy());
      return;
    }

    let dmg = this.mods.damage + b.dmgBonus;
    let crit = false;
    if (b.critNext || this.rng.next() < this.mods.critChance) {
      crit = true; b.critNext = false;
      dmg *= this.mods.critMult;
    }
    if (brick.frozen > 0) dmg *= 1 + this.mods.shatter;

    const dealt = this._damageBrick(brick, dmg, { x: b.x, y: b.y }, "ball", crit);

    // 状态施加
    if (this.mods.burn > 0) {
      brick.burn = Math.min(4, brick.burn + this.mods.burn);
      brick.burnDps = Math.max(brick.burnDps, this.mods.burnDps || 0);
    }
    if (this.mods.freezeChance > 0 && this.rng.next() < this.mods.freezeChance) {
      brick.frozen = Math.max(brick.frozen, this.mods.freezeDur || 2.5);
    }
    if (this.mods.charge > 0) {
      brick.charge = Math.min(4, brick.charge + this.mods.charge);
    }

    // 贯穿：不反弹，剩余次数递减
    if (b.pierce > 0) {
      b.pierce--;
      this.emit("pierce", b.x, b.y);
      return;
    }
    const r = reflect(b.vx, b.vy, nx, ny);
    const c = clampV(r.x, r.y, C.MIN_VY);
    const h = clampH(c.x, c.y, 0.08);
    b.vx = h.x; b.vy = h.y;
    this.stats.bounces++;
  };

  Sim.prototype._damageBrick = function (brick, dmg, at, source, crit) {
    if (!brick || !brick.alive || brick.invuln) return 0;
    const d = Math.max(1, Math.round(dmg));
    brick.hp -= d;
    this.stats.damage += d;
    this.emit("brickHit", brick, d, at.x, at.y, !!crit);
    if (brick.hp <= 0) {
      this._destroy(brick, source || "ball", crit);
      return d;
    }
    return d;
  };

  Sim.prototype._destroy = function (brick, cause, crit) {
    if (!brick.alive) return;
    const atx = brick.cx(), aty = brick.cy();
    let bonus = 1;
    if (cause === "ball" || cause === "laser" || cause === "drone") {
      if (this.time - this._lastBreak <= C.COMBO_WINDOW) this.combo++;
      else this.combo = 1;
      this._lastBreak = this.time;
      bonus = (1 + C.COMBO_BONUS * (this.combo - 1)) * this.mods.comboBonus;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.score += Math.round(brick.score() * bonus);
    this.stats.bricks++;
    if (crit) this.stats.kills++;

    if (brick.isPart && this.boss) this.boss.onPartDestroyed(brick, this);
    else if (this.grid) this.grid.remove(brick);
    else brick.alive = false;
    this.emit("brickDestroyed", brick, cause === "chain" ? "chain" : "ball", atx, aty, !!crit);

    // 导电：向邻近跳跃
    if (this.mods.chainCount > 0 && brick.charge > 0) {
      this._chainFrom(brick, this.mods.chainCount, this.mods.chainDamage);
    }
    // 爆裂
    if (brick.type === "blast" && cause !== "chain") this._explode(atx, aty, 1, 0);
    else if (this.mods.explodeChance > 0 && this.rng.next() < this.mods.explodeChance) {
      this._explode(atx, aty, this.mods.explodeRadius || 1, 1);
    }
    // 分裂
    if (this.mods.splitChance > 0 && this.balls.length < C.MAX_BALLS && this.rng.next() < this.mods.splitChance) {
      this._spawnExtraBall(atx, aty);
    }
    // 灼烧扩散
    if (this.mods.burnSpread > 0 && brick.burn > 0) {
      for (const n of this._neighbors(brick)) {
        if (!n.solid() && !n.invuln) { n.burn = Math.min(4, n.burn + this.mods.burnSpread); n.burnDps = Math.max(n.burnDps, this.mods.burnDps || 0); }
      }
    }

    this._maybeDrop(brick, atx, aty);
    this.speed = Math.min(this.mods.maxSpeed, this.speed + C.SPEED_PER_BRICK);
    for (const b of this.balls) {
      if (b.attached || !b.active) continue;
      const s = b.speed();
      if (s > 1e-6) { b.vx = (b.vx / s) * this.speed; b.vy = (b.vy / s) * this.speed; }
    }
    if (this.boss) this.boss.checkPhase(this);
    this._checkClear();
  };

  Sim.prototype._checkClear = function () {
    const gridDone = !this.grid || this.grid.cleared();
    const bossDone = !this.boss || (this.boss.hp <= 0);
    if (gridDone && bossDone && !this._cleared && this.phase === PHASE.PLAY) {
      this._cleared = true;
      this.phase = PHASE.CLEAR;
      const clearBonus = this.lives * 250 + Math.max(0, Math.round(6000 - this.levelTime * 20));
      this.score += clearBonus;
      this.emit("cleared", this.summary(true, clearBonus));
    }
  };

  Sim.prototype._neighbors = function (brick) {
    const out = [];
    if (!this.grid) return out;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const n = this.grid.at(brick.col + dc, brick.row + dr);
        if (n && n.alive) out.push(n);
      }
    if (this.boss) {
      for (const p of this.boss.parts) {
        if (!p.alive || p === brick) continue;
        if (Math.abs(p.cx() - brick.cx()) < 120 && Math.abs(p.cy() - brick.cy()) < 60) out.push(p);
      }
    }
    return out;
  };

  Sim.prototype._chainFrom = function (src, count, dmg) {
    let from = src;
    const hitSet = new Set([src]);
    for (let i = 0; i < count; i++) {
      let best = null, bd = 1e9;
      for (const b of this._allBricks()) {
        if (hitSet.has(b) || !b.alive || b.solid() || b.invuln) continue;
        const d = (b.cx() - from.cx()) ** 2 + (b.cy() - from.cy()) ** 2;
        if (d < bd && d < 260 * 260) { bd = d; best = b; }
      }
      if (!best) break;
      hitSet.add(best);
      this.emit("chain", from.cx(), from.cy(), best.cx(), best.cy());
      this._damageBrick(best, dmg, { x: best.cx(), y: best.cy() }, "chain");
      from = best;
    }
  };

  Sim.prototype._explode = function (cx, cy, radius, depth) {
    if (depth > 2) return;
    this._chain = 24;
    const cc = Math.floor((cx - C.GRID_X) / C.BRICK_W);
    const cr = Math.floor((cy - C.GRID_Y) / C.BRICK_H);
    const targets = [];
    for (let dr = -radius; dr <= radius; dr++)
      for (let dc = -radius; dc <= radius; dc++) {
        if (!dr && !dc) continue;
        const nb = this.grid.at(cc + dc, cr + dr);
        if (nb && nb.alive && !nb.solid() && !nb.invuln) targets.push(nb);
      }
    if (this.boss) {
      for (const p of this.boss.parts) {
        if (!p.alive || p.invuln) continue;
        if (Math.abs(p.cx() - cx) < 110 && Math.abs(p.cy() - cy) < 80) targets.push(p);
      }
    }
    let destroyed = 0;
    for (const nb of targets) {
      if (this._chain <= 0) break;
      if (!nb.alive) continue;
      this._chain--;
      const blast = nb.type === "blast";
      this._damageBrick(nb, 1, { x: cx, y: cy }, "chain");
      if (!nb.alive) {
        destroyed++;
        if (blast) this._explode(nb.cx(), nb.cy(), 1, depth + 1);
      }
    }
    this.emit("exploded", cx, cy, radius, destroyed);
  };

  Sim.prototype._spawnExtraBall = function (x, y) {
    if (this.balls.length >= C.MAX_BALLS) return;
    const nb = new Ball(x, y);
    const a = this.rng.range(0, Math.PI * 2);
    const spd = Math.max(380, this.speed * 0.9);
    nb.vx = Math.cos(a) * spd; nb.vy = Math.sin(a) * spd;
    nb.trail = [];
    this.balls.push(nb);
    this.emit("ballSpawned", x, y);
  };

  Sim.prototype._tickStatuses = function (dt) {
    if (!this.grid) return;
    const all = this._allBricks();
    for (const b of all) {
      if (!b.alive) continue;
      if (b.burn > 0) {
        b.burn -= dt;
        if (b.burnDps > 0) {
          b.burnAcc = (b.burnAcc || 0) + b.burnDps * dt;
          if (b.burnAcc >= 1) {
            const d = Math.floor(b.burnAcc);
            b.burnAcc -= d;
            this._damageBrick(b, d, { x: b.cx(), y: b.cy() }, "burn");
          }
        }
      }
      if (b.frozen > 0) b.frozen -= dt;
      if (b.charge > 0 && b.chargeTimer === undefined) b.chargeTimer = 6;
      if (b.charge > 0) {
        b.chargeTimer -= dt;
        if (b.chargeTimer <= 0) { b.charge = 0; b.chargeTimer = 6; }
      }
      if (b.regen > 0 && b.alive) {
        b.regenTimer -= dt;
        if (b.regenTimer <= 0 && b.hp < b.maxHp) {
          b.hp = Math.min(b.maxHp, b.hp + b.regen);
          b.regenTimer = 7;
          this.emit("regen", b.cx(), b.cy());
        }
      }
    }
  };

  Sim.prototype._allLost = function () {
    this.balls = [];
    this.combo = 0;
    this.lives--;
    this.speed = Math.min(this.mods.startSpeed, this.mods.maxSpeed);
    if (this.mods.lastStand && this.lives === 0) {
      this.mods.lastStand = false;
      this.lives = 1;
      this.emit("lastStand");
      this.phase = PHASE.RESET; this._resetT = C.SERVE_DELAY;
      return;
    }
    if (this.lives <= 0) {
      this.phase = PHASE.FAIL;
      this.emit("failed", this.summary(false, 0));
    } else {
      this.phase = PHASE.RESET;
      this._resetT = C.SERVE_DELAY;
      this.emit("lifeLost", this.lives);
    }
  };

  Sim.prototype._antistuck = function (b, dt) {
    if (b.attached || !b.active) return;
    const d = b.dir();
    if (Math.abs(d.y) < C.STALL_EPS) {
      b.stall += dt;
      if (b.stall >= C.STALL_TIME) {
        const sgn = d.x >= 0 ? 1 : -1;
        const ang = sgn * (16 * Math.PI / 180);
        const rx = b.vx * Math.cos(ang) - b.vy * Math.sin(ang);
        const ry = b.vx * Math.sin(ang) + b.vy * Math.cos(ang);
        const c = clampV(rx, ry, 0.22);
        b.vx = c.x; b.vy = c.y;
        b.stall = 0;
        this.stats.assists++;
        this.emit("assist", "轨迹修正：近乎水平");
      }
    } else b.stall = Math.max(0, b.stall - dt * 2);

    if (b.probeT <= 0) { b.probeX = b.x; b.probeY = b.y; b.probeT = 1; }
    else {
      b.probeT -= dt;
      if (b.probeT <= 0) {
        if (Math.hypot(b.x - b.probeX, b.y - b.probeY) < 8) {
          let ax = b.x - C.PADDLE_MID, ay = b.y - C.PADDLE_TOP;
          let l = Math.hypot(ax, ay);
          if (l < 0.1) { ax = 0; ay = -1; l = 1; }
          const c = clampV((ax / l) * this.speed, (ay / l) * this.speed, 0.35);
          b.vx = c.x; b.vy = c.y;
          b.x += (ax / l) * 3; b.y += (ay / l) * 3;
          this.stats.assists++;
          this.emit("assist", "救援：脱离卡位");
        }
      }
    }

    this._updateAssist(b);
    if (this.assistActive && this.assistTarget && this.assistTarget.alive) {
      const alive = this.grid ? this.grid.destructibleAlive : 0;
      const rate = alive > C.ECHO_COUNT ? C.ECHO_RATE : C.ECHO_FORCE;
      if (b.y < C.PADDLE_TOP - 70) {
        const tx = this.assistTarget.cx() - b.x, ty = this.assistTarget.cy() - b.y;
        const cur = b.dir();
        const want = Math.atan2(ty, tx), have = Math.atan2(cur.y, cur.x);
        let diff = want - have;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const stepA = clamp(diff, -rate * dt, rate * dt);
        const cs = Math.cos(stepA), sn = Math.sin(stepA);
        const nx = cur.x * cs - cur.y * sn, ny = cur.x * sn + cur.y * cs;
        if (Math.abs(ny) >= C.MIN_VY) {
          const s = b.speed();
          b.vx = nx * s; b.vy = ny * s;
        }
      }
    }
  };

  Sim.prototype._updateAssist = function (b) {
    if (!this.assistEnabled) { this.assistActive = false; this.assistTarget = null; return; }
    this._nearestT -= C.FIXED;
    const idleFor = this.time - this._lastBrickT;
    let want = false, reason = "";
    // Boss 战没有网格砖块，必须把 Boss 部件算进来，否则救援在 Boss 关完全失效
    const alive = this._allBricks().filter((b) => b.alive && !b.solid() && !b.invuln).length;
    if (alive > 0 && alive <= C.ECHO_COUNT) { want = true; reason = "残响引导 · 弱点标记"; }
    else if (idleFor >= C.ASSIST_TIME && alive > 0) { want = true; reason = "残响引导 · 长时间未命中"; }
    if (idleFor >= C.IDLE_RESCUE && alive > 0) reason = "轨迹救援";
    if (!want) { this.assistActive = false; this.assistReason = ""; this.assistTarget = null; return; }
    if (this._nearestT > 0 && this.assistTarget && this.assistTarget.alive) return;
    this._nearestT = 0.25;
    let best = null, bd = Infinity;
    for (const br of this._allBricks()) {
      if (!br.alive || br.solid() || br.invuln) continue;
      const d = (br.cx() - b.x) ** 2 + (br.cy() - b.y) ** 2;
      if (d < bd) { bd = d; best = br; }
    }
    if (best) {
      const was = this.assistActive;
      this.assistActive = true;
      this.assistTarget = best;
      if (reason !== this.assistReason) {
        this.assistReason = reason;
        if (!was) { this.stats.assists++; this.emit("assist", reason); }
      }
    }
  };

  Sim.prototype.buffReport = function () {
    const out = [];
    if (this.buffs.wide > 0) out.push({ k: "wide", t: this.buffs.wide, label: DROPS.wide.label, color: DROPS.wide.color });
    if (this.buffs.laser > 0) out.push({ k: "laser", t: this.buffs.laser, label: DROPS.laser.label, color: DROPS.laser.color });
    if (this.buffs.magnet > 0) out.push({ k: "magnet", t: this.buffs.magnet, label: DROPS.magnet.label, color: DROPS.magnet.color });
    if (this.buffs.slow > 0) out.push({ k: "slow", t: this.buffs.slow, label: DROPS.slow.label, color: DROPS.slow.color });
    return out;
  };

  Sim.prototype.summary = function (win, clearBonus) {
    return {
      win, level_id: this.levelId, level_name: this.levelName,
      score: this.score, lives_left: Math.max(0, this.lives),
      time: this.levelTime, bricks: this.stats.bricks, hits: this.stats.hits,
      max_combo: Math.max(this.stats.maxCombo, this.bestCombo),
      assists: this.stats.assists, clear_bonus: clearBonus,
      damage: this.stats.damage,
      picked: this.picked, pickedGold: this.bonusGold,
    };
  };
  Sim.prototype.ballSpeed = function () {
    for (const b of this.balls) if (b.active && !b.attached) return b.speed();
    return this.speed;
  };

  // ---------------------------------------------------------------- Boss
  // 部件：不进入网格的砖块，按行为移动；核心血量 = Boss 血量。
  function Boss(def, seed) {
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.phase = 0;
    this.parts = [];
    this.t = 0;
    this.telegraph = null;
    this.window = 0;
    this.rng = new XRand(seed || 7);
    this.state = {};
  }

  Boss.prototype.spawn = function (sim) {
    this.parts = [];
    const cx = C.W - C.W / 2; // 640
    const cy = 240;
    for (const p of this.def.parts) {
      const b = new Brick(-1, -1, p.type, { x: cx + p.x, y: cy + p.y, w: p.w || 84, h: p.h || 26 });
      b.isPart = true;
      b.partId = p.id;
      b.maxHp = p.hp; b.hp = p.hp;
      b.invuln = !!p.invuln;
      b.regen = p.regen || 0;
      b.regenTimer = 7;
      b.home = { x: b.rect.x, y: b.rect.y };
      b.role = p.role || "armor";
      this.parts.push(b);
    }
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.phase = 0;
    this.t = 0;
    this.state = {};
    this.syncHp();
    this.applyPhase(0, sim, true);
  };

  Boss.prototype.applyPhase = function (idx, sim, silent) {
    const ph = this.def.phases[idx];
    if (!ph) return;
    this.phase = idx;
    this.window = 0;
    // 护甲再生 / 移速等由行为函数处理
    const armorLeft = this.parts.filter((q) => q.alive && q.role === "armor").length;
    for (const p of this.parts) {
      if (p.role === "core") p.invuln = !!ph.coreInvuln && armorLeft > 0;
      if (ph.armorInvuln && p.role === "armor") p.invuln = true;
      else if (p.role === "armor") p.invuln = false;
    }
    this.telegraph = { text: ph.name, t: 1.6, total: 1.6 };
    if (!silent) sim.emit("bossPhase", idx, ph.name);
  };

  Boss.prototype.onPartDestroyed = function (part, sim) {
    part.alive = false;
    if (this.def.onPart) this.def.onPart(this, part, sim);
    // 必须在 _checkClear 之前把血量算准，否则打掉最后一个核心的同一帧不会判通关
    this.syncHp();
    // 护甲全灭 → 核心暴露
    const armorAlive = this.parts.filter((p) => p.alive && p.role === "armor").length;
    const cores = this.parts.filter((p) => p.alive && p.role === "core");
    if (cores.length && armorAlive === 0) {
      for (const c of cores) c.invuln = false;
      this.window = 6.5;
      sim.emit("bossWindow", "核心暴露");
    }
    // 核心受击掉血
  };

  Boss.prototype.checkPhase = function (sim) {
    const pct = this.hp / this.maxHp;
    const phases = this.def.phases;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (pct <= phases[i].at && this.phase < i) {
        this.applyPhase(i, sim, false);
        break;
      }
    }
  };

  Boss.prototype.syncHp = function () {
    // 多核心 Boss（冰镜双核）血量按所有核心求和，单一核心时等价于 core.hp
    let hp = 0, maxHp = 0, any = false;
    for (const p of this.parts) {
      if (p.role !== "core") continue;
      any = true;
      maxHp += p.maxHp;
      if (p.alive) hp += Math.max(0, p.hp);
    }
    if (!any) return;
    this.maxHp = maxHp;
    this.hp = Math.max(0, hp);
  };

  Boss.prototype.tick = function (dt, sim) {
    this.t += dt;
    if (this.telegraph) {
      this.telegraph.t -= dt;
      if (this.telegraph.t <= 0) this.telegraph = null;
    }
    if (this.window > 0) this.window -= dt;
    if (this.def.tick) this.def.tick(this, sim, dt);
    this.syncHp();
    this.checkPhase(sim);
  };

  const LEGEND = {
    "#": "normal", T: "tough", A: "armored", B: "blast", X: "solid", R: "regen", S: "shieldNode",
    G: "gold", M: "moving",
  };

  const BP = {
    C, PHASE, TYPES, TYPE_COLOR, XRand, Brick, Grid, Ball, Sim, Boss, LEGEND,
    circleRect, clampV, clampH, clamp, reflect, defaultStats,
    DROPS, DROP_KEYS, DROP_TOTAL,
  };
  root.BP = BP;
  if (typeof module !== "undefined" && module.exports) module.exports = BP;
})(typeof globalThis !== "undefined" ? globalThis : this);
