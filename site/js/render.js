/* BREAKOUT: 磷光纪元 — 画面渲染（网页版）
 * 只读取 Sim 的状态；抖动只作用于绘制变换，不影响碰撞坐标。
 */
(function (root) {
  "use strict";
  const BP = root.BP, C = BP.C;
  const PAL = {
    bg: "#05080a", bg2: "#08120f", grid: "#0d2a22",
    accent: "#7cffb2", cyan: "#7fd8ff", amber: "#ffc46b",
    rose: "#ff6b7e", steel: "#9fb3bd", text: "#d8fff0", dim: "#6f8f84",
  };
  const FONT = '"Cascadia Mono", Consolas, "Courier New", "Microsoft YaHei", monospace';

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function typeColor(t) { return BP.TYPE_COLOR[t] || PAL.accent; }

  // ---------------------------------------------------------------- FX
  function Fx() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.density = 1;
    this.rng = new BP.XRand(0x5eed);
  }
  Fx.prototype.clear = function () { this.parts.length = 0; this.rings.length = 0; this.texts.length = 0; };
  Fx.prototype.burst = function (x, y, nx, ny, color, amount, power, size) {
    const n = Math.round(amount * this.density);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > C.MAX_PARTICLES) break;
      const a = this.rng.range(-1.05, 1.05);
      const cs = Math.cos(a), sn = Math.sin(a);
      const dx = nx * cs - ny * sn, dy = nx * sn + ny * cs;
      const sp = power * this.rng.range(0.35, 1.15);
      this.parts.push({
        x, y, vx: dx * sp + this.rng.range(-40, 40), vy: dy * sp + this.rng.range(-40, 40),
        life: this.rng.range(0.22, 0.55), ttl: 0.55, size: size * this.rng.range(0.6, 1.5),
        color, kind: 0,
      });
      this.parts[this.parts.length - 1].ttl = this.parts[this.parts.length - 1].life;
    }
  };
  Fx.prototype.debris = function (x, y, rect, color, amount) {
    const n = Math.round(amount * this.density);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > C.MAX_PARTICLES) break;
      const life = this.rng.range(0.45, 0.9);
      this.parts.push({
        x: rect.x + this.rng.range(0, rect.w), y: rect.y + this.rng.range(0, rect.h),
        vx: this.rng.range(-190, 190), vy: this.rng.range(-230, -40),
        life, ttl: life, size: this.rng.range(2, 5), color, kind: 1,
      });
    }
  };
  Fx.prototype.ring = function (x, y, color, r0, r1, dur, width) {
    if (this.rings.length > C.MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, color, r0, r1, life: dur, ttl: dur, w: width });
  };
  Fx.prototype.text = function (x, y, txt, color, dur, size) {
    if (this.texts.length > 24) this.texts.shift();
    this.texts.push({ x, y, txt, color, life: dur, ttl: dur, size });
  };
  Fx.prototype.update = function (dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (p.kind === 1) { p.vy += 900 * dt; p.vx *= 0.985; p.vy *= 0.985; }
      else { p.vx *= 0.93; p.vy *= 0.93; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].life -= dt;
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
      else this.texts[i].y -= 46 * dt;
    }
  };
  Fx.prototype.draw = function (ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.ttl);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 1) {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        const s = Math.hypot(p.vx, p.vy);
        const dx = s > 1 ? (p.vx / s) * (p.size + 3) : 0;
        const dy = s > 1 ? (p.vy / s) * (p.size + 3) : 0;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.7);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - dy); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.8, p.size * 0.35), 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.ttl);
      const t = 1 - a;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * t, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, t.life / 0.8);
      ctx.fillStyle = t.color;
      ctx.font = `${t.size}px ${FONT}`;
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  };

  // ---------------------------------------------------------------- View
  function View(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sim = null;
    this.fx = new Fx();
    this.flash = new Map();
    this.t = 0;
    this.shake = 0;
    this.comboPop = 0;
    this.lastCombo = 0;
    this.levelFlash = 0;
    this.showDamage = true;
    this.beams = [];
    this.bolts = [];
    this.settings = { particles: 1, shake: 0.7, crt: 1 };
    this._resize();
  }
  View.prototype._resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = C.W * dpr;
    this.canvas.height = C.H * dpr;
    this.canvas.style.width = C.W + "px";
    this.canvas.style.height = C.H + "px";
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
  };

  View.prototype.attach = function (sim) {
    this.sim = sim;
    this.fx.clear();
    this.flash.clear();
    this.shake = 0; this.comboPop = 0; this.lastCombo = 0; this.levelFlash = 0;
    if (!sim) return;
    const f = this.fx;
    sim.on("brickHit", (brick, dmg, x, y) => {
      let nx = x - brick.cx(), ny = y - brick.cy();
      let l = Math.hypot(nx, ny);
      if (l < 0.01) { nx = 0; ny = -1; l = 1; }
      nx /= l; ny /= l;
      const col = typeColor(brick.type);
      this.flash.set(brick, 0.13);
      if (brick.solid()) {
        f.burst(x, y, nx, ny, PAL.steel, 6, 150, 1.8);
        f.ring(x, y, PAL.steel, 2, 16, 0.28, 1.2);
        Sfx.play("tough", -6, 0.75);
      } else {
        f.burst(x, y, nx, ny, col, 7, 210, 2.0);
        if (brick.hp > 0) Sfx.play("tough", -5, 1.05);
      }
    });
    sim.on("brickDestroyed", (brick, cause, x, y) => {
      this.flash.delete(brick);
      const col = typeColor(brick.type);
      f.debris(x, y, brick.rect, col, 9);
      f.ring(x, y, col, 4, 34, 0.36, 1.6);
      this.addShake(cause === "ball" ? 0.16 : 0.07);
      if (this.showDamage && cause === "ball") f.text(x, y - 14, "+" + brick.score(), col, 0.65, 15);
      Sfx.play(cause === "ball" ? "break" : "brick", cause === "ball" ? -3 : -8, 1);
    });
    sim.on("exploded", (x, y, radius, destroyed) => {
      f.ring(x, y, PAL.rose, 8, 96, 0.5, 3);
      f.ring(x, y, PAL.amber, 4, 64, 0.38, 1.5);
      f.burst(x, y, 0, -1, PAL.rose, 26, 380, 3);
      this.addShake(0.5);
      Sfx.play("explode", -2, 1);
      if (destroyed > 1) f.text(x, y - 26, "连锁 ×" + destroyed, PAL.amber, 0.9, 17);
    });
    sim.on("paddle", (off) => {
      const px = sim.paddleX + off * sim.paddleW / 2;
      f.burst(px, C.PADDLE_TOP, 0, -1, PAL.accent, 5, 150, 1.6);
      f.ring(px, C.PADDLE_TOP, PAL.accent, 2, 20, 0.26, 1.4);
      Sfx.play("paddle", -4, 1 + off * 0.06);
    });
    sim.on("wallBounce", (x, y, nx, ny) => {
      f.burst(x, y, nx, ny, PAL.accent, 3, 110, 1.3);
      Sfx.play("wall", -12, 1);
    });
    sim.on("ballLost", (x, y) => {
      f.ring(x, y, PAL.rose, 6, 70, 0.55, 2.4);
      f.burst(x, y, 0, -1, PAL.rose, 14, 240, 2.2);
      this.addShake(0.35);
      Sfx.play("lifeLost", -3, 1);
    });
    sim.on("launch", () => {
      f.burst(sim.paddleX, C.PADDLE_TOP - 8, 0, -1, PAL.accent, 10, 200, 1.8);
      Sfx.play("serve", -4, 1);
    });
    sim.on("cleared", () => { this.levelFlash = 1; this.addShake(0.4); Sfx.play("clear", -2, 1); });
    sim.on("assist", (msg) => { f.text(640, 470, msg, PAL.amber, 1.4, 16); Sfx.play("correct", -14, 1); });
  };

  View.prototype.addShake = function (v) { this.shake = Math.min(1, this.shake + v); };

  View.prototype.update = function (dt) {
    this.t += dt;
    this.fx.density = Math.max(0, Math.min(1, this.settings.particles));
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.6);
    for (const [k, v] of this.flash) {
      if (v - dt <= 0) this.flash.delete(k); else this.flash.set(k, v - dt);
    }
    if (this.sim) {
      if (this.sim.combo > this.lastCombo && this.sim.combo >= 2) this.comboPop = 1;
      this.lastCombo = this.sim.combo;
    }
    this.comboPop = Math.max(0, this.comboPop - dt * 3.2);
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].t -= dt; if (this.beams[i].t <= 0) this.beams.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].t -= dt; if (this.bolts[i].t <= 0) this.bolts.splice(i, 1); }
  };

  View.prototype.draw = function () {
    const ctx = this.ctx, s = this.sim;
    const amp = 9 * this.shake * (this.settings.shake || 0);
    ctx.save();
    ctx.translate(Math.sin(this.t * 97) * amp, Math.cos(this.t * 131) * amp);

    this._bg(ctx);
    this._walls(ctx);
    if (s) {
      this._bricks(ctx, s);
      for (const b of this.beams) {
        ctx.strokeStyle = "rgba(127,216,255," + Math.max(0, b.t / 0.16) * 0.8 + ")";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(b.x, C.PADDLE_TOP - 8); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const b of this.bolts) {
        ctx.strokeStyle = "rgba(179,156,255," + Math.max(0, b.t / 0.18) * 0.9 + ")";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      this.fx.draw(ctx);
      this._assist(ctx, s);
      this._serve(ctx, s);
      this._paddle(ctx, s);
      this._balls(ctx, s);
      this._inline(ctx, s);
      if (this.levelFlash > 0) {
        ctx.fillStyle = rgba(PAL.accent, 0.16 * this.levelFlash);
        ctx.fillRect(0, 0, C.W, C.H);
      }
    }
    ctx.restore();
  };

  View.prototype._bg = function (ctx) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, C.W, C.H);
    const bands = 10, h = C.H / bands;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);
      ctx.fillStyle = mix(PAL.bg, PAL.bg2, f * 0.85);
      ctx.fillRect(0, i * h, C.W, h + 0.6);
    }
    ctx.strokeStyle = rgba(PAL.accent, 0.028);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 96; x < C.W; x += 96) { ctx.moveTo(x, C.CEIL); ctx.lineTo(x, C.DEATH); }
    for (let y = C.CEIL; y < C.DEATH; y += 96) { ctx.moveTo(C.WALL_L, y); ctx.lineTo(C.WALL_R, y); }
    ctx.stroke();
    const sy = (this.t * 26) % (C.H + 200) - 100;
    ctx.fillStyle = rgba(PAL.accent, 0.035);
    ctx.fillRect(C.WALL_L, sy, C.ARENA_W, 2);
  };

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }

  View.prototype._walls = function (ctx) {
    ctx.lineCap = "butt";
    // 光晕
    ctx.strokeStyle = rgba(PAL.accent, 0.10);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(C.WALL_L, C.CEIL); ctx.lineTo(C.WALL_L, C.DEATH);
    ctx.moveTo(C.WALL_R, C.CEIL); ctx.lineTo(C.WALL_R, C.DEATH);
    ctx.moveTo(C.WALL_L, C.CEIL); ctx.lineTo(C.WALL_R, C.CEIL);
    ctx.stroke();
    // 实线
    ctx.strokeStyle = rgba(PAL.accent, 0.55);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // 死亡线
    ctx.strokeStyle = rgba(PAL.rose, 0.18);
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(C.WALL_L, C.DEATH); ctx.lineTo(C.WALL_R, C.DEATH); ctx.stroke();
    ctx.setLineDash([]);
    // 四角
    ctx.strokeStyle = rgba(PAL.accent, 0.16);
    ctx.lineWidth = 1;
    ctx.strokeRect(C.WALL_L, C.CEIL, C.ARENA_W, C.DEATH - C.CEIL);
    const arm = 22;
    ctx.strokeStyle = rgba(PAL.accent, 0.5);
    ctx.lineWidth = 1.6;
    const corners = [
      [C.WALL_L, C.CEIL, 1, 1], [C.WALL_R, C.CEIL, -1, 1],
      [C.WALL_L, C.DEATH, 1, -1], [C.WALL_R, C.DEATH, -1, -1],
    ];
    ctx.beginPath();
    for (const [x, y, sx, sy] of corners) {
      ctx.moveTo(x, y); ctx.lineTo(x + arm * sx, y);
      ctx.moveTo(x, y); ctx.lineTo(x, y + arm * sy);
    }
    ctx.stroke();
  };

  View.prototype._bricks = function (ctx, s) {
    const list = (s.grid ? s.grid.cells : []).concat(s.boss ? s.boss.parts : []);
    // 核心最后画，避免被护甲/镜面完全盖住
    list.sort((a, b) => (a && a.type === "core" ? 1 : 0) - (b && b.type === "core" ? 1 : 0));
    for (const b of list) {
      if (!b || !b.alive) continue;
      const r = { x: b.rect.x + 2, y: b.rect.y + 2, w: b.rect.w - 4, h: b.rect.h - 4 };
      const c = typeColor(b.type);
      ctx.fillStyle = b.type === "solid" ? "#0b1013" : shade(c, b.isPart ? -0.58 : -0.80);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = c;
      ctx.lineWidth = b.type === "solid" ? 2.2 : 1.4;
      if (b.type === "armored") ctx.lineWidth = 1.8;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      if (b.type === "normal") {
        ctx.fillStyle = rgba(c, 0.75);
        ctx.fillRect(r.x + r.w - 16, r.y + 1, 15, 3);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r.x + 3, r.y + 3); ctx.lineTo(r.x + 16, r.y + 3); ctx.stroke();
      } else if (b.type === "tough") {
        for (let i = 0; i < b.maxHp; i++) {
          const y = r.y + r.h * (0.34 + 0.32 * i);
          ctx.strokeStyle = rgba(c, i < b.hp ? 0.65 : 0.14);
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(r.x + 8, y); ctx.lineTo(r.x + r.w - 8, y); ctx.stroke();
        }
      } else if (b.type === "armored") {
        ctx.strokeStyle = rgba(c, 0.20);
        ctx.lineWidth = 1;
        for (let x = r.x - r.h; x < r.x + r.w; x += 13) {
          ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke();
        }
        ctx.fillStyle = rgba(c, 0.85);
        for (const [dx, dy] of [[7, 8], [r.w - 7, 8], [7, r.h - 8], [r.w - 7, r.h - 8]]) {
          ctx.beginPath(); ctx.arc(r.x + dx, r.y + dy, 1.8, 0, 6.2832); ctx.fill();
        }
        for (let i = 0; i < b.hp; i++) {
          ctx.fillStyle = rgba(c, 0.9);
          ctx.fillRect(r.x + 3, r.y + 5 + i * 5, 3, 3);
        }
      } else if (b.type === "blast") {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.strokeStyle = rgba(c, 0.95);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 9, cy); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = rgba(c, 0.85);
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.2832); ctx.fill();
      } else if (b.type === "solid") {
        ctx.strokeStyle = "rgba(140,158,166,0.18)";
        ctx.lineWidth = 1;
        for (let x = r.x - r.h; x < r.x + r.w; x += 10) {
          ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x + r.h, r.y + r.h); ctx.stroke();
        }
      }
      // 裂纹
      if (b.type !== "solid" && b.hp < b.maxHp) {
        const seed = b.col * 73 + b.row * 151;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < b.maxHp - b.hp; i++) {
          const sx = r.x + 12 + ((seed + i * 37) % 60);
          const sy = r.y + 4 + ((seed + i * 53) % 16);
          ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo(sx + 6, sy + 7); ctx.lineTo(sx + 2, sy + 14); ctx.lineTo(sx + 10, sy + 19);
          ctx.stroke();
        }
      }
      ctx.restore();

      const fl = this.flash.get(b) || 0;
      if (fl > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.min(1, fl / 0.13)})`;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      // 状态标记：冻结描边 / 灼烧火点 / 导电火花
      if (b.frozen > 0) {
        ctx.strokeStyle = "rgba(127,216,255,0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        ctx.fillStyle = "rgba(127,216,255,0.18)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      if (b.burn > 0) {
        ctx.fillStyle = "rgba(255,140,80," + (0.5 + 0.4 * Math.sin(this.t * 12 + b.col)) + ")";
        ctx.beginPath(); ctx.arc(r.x + 8, r.y + 8, 2.6, 0, 6.2832); ctx.fill();
      }
      if (b.charge > 0) {
        ctx.fillStyle = "rgba(179,156,255,0.95)";
        ctx.beginPath(); ctx.arc(r.x + r.w - 8, r.y + 8, 2.4, 0, 6.2832); ctx.fill();
      }
      if (b.type === "core") {
        const pulse = 0.25 + 0.2 * Math.sin(this.t * 3);
        ctx.strokeStyle = "rgba(255,157,92," + pulse + ")";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
        ctx.fillStyle = "rgba(255,120,60,0.10)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      if (b.invuln && b.isPart) {
        ctx.strokeStyle = "rgba(201,162,39,0.55)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(b.rect.x, b.rect.y, b.rect.w, b.rect.h);
        ctx.setLineDash([]);
      }
    }
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  View.prototype._paddle = function (ctx, s) {
    const w = s.paddleW, x = s.paddleX - w / 2, y = C.PADDLE_TOP;
    ctx.fillStyle = rgba(PAL.accent, 0.05);
    ctx.fillRect(x - 5, y - 5, w + 10, C.PADDLE_H + 10);
    ctx.fillStyle = "#17493a";
    ctx.fillRect(x, y, w, C.PADDLE_H);
    ctx.fillStyle = "rgba(124,255,178,0.18)";
    ctx.fillRect(x + 7, y + 2, w - 14, C.PADDLE_H - 4);
    ctx.strokeStyle = PAL.accent;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, C.PADDLE_H - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 2); ctx.lineTo(x + w - 4, y + 2); ctx.stroke();
    ctx.fillStyle = rgba(PAL.accent, 0.85);
    ctx.fillRect(x, y, 7, C.PADDLE_H);
    ctx.fillRect(x + w - 7, y, 7, C.PADDLE_H);
    ctx.fillStyle = rgba(PAL.accent, 0.55);
    ctx.fillRect(s.paddleX - 0.5, y + 3, 1, C.PADDLE_H - 6);
  };

  View.prototype._balls = function (ctx, s) {
    for (const b of s.balls) {
      if (!b.active) continue;
      const c = b.attached ? PAL.cyan : PAL.accent;
      const n = b.trail.length;
      for (let i = n - 1; i > 0; i--) {
        const f = 1 - i / n;
        ctx.fillStyle = rgba(c, 0.20 * f * f);
        ctx.beginPath(); ctx.arc(b.trail[i].x, b.trail[i].y, b.r * (0.25 + 0.6 * f), 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = rgba(c, 0.06);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.8, 0, 6.2832); ctx.fill();
      ctx.fillStyle = rgba(c, 0.12);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.4, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = "rgba(240,255,248,1)";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1.6, 0, 6.2832); ctx.fill();

      const d = b.dir();
      const tipx = b.x + d.x * (b.r + 9), tipy = b.y + d.y * (b.r + 9);
      const bx = tipx - d.x * 6, by = tipy - d.y * 6;
      ctx.fillStyle = rgba(c, 0.9);
      ctx.beginPath();
      ctx.moveTo(tipx, tipy);
      ctx.lineTo(bx - d.y * 4, by + d.x * 4);
      ctx.lineTo(bx + d.y * 4, by - d.x * 4);
      ctx.closePath(); ctx.fill();
    }
  };

  View.prototype._serve = function (ctx, s) {
    if (s.phase !== BP.PHASE.SERVE || !s.balls.length) return;
    const b = s.balls[0];
    const ang = s.aimAngle();
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const ox = b.x, oy = b.y - 4;
    const len = 250, steps = 16, pulse = 0.55 + 0.35 * Math.sin(this.t * 5);
    ctx.strokeStyle = rgba(PAL.accent, 0.55 * pulse);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * len, oy + dy * len); ctx.stroke();
    ctx.setLineDash([]);
    const tipx = ox + dx * len, tipy = oy + dy * len;
    const bx = tipx - dx * 12, by = tipy - dy * 12;
    ctx.fillStyle = rgba(PAL.accent, 0.75 * pulse);
    ctx.beginPath();
    ctx.moveTo(tipx, tipy);
    ctx.lineTo(bx - dy * 6, by + dx * 6);
    ctx.lineTo(bx + dy * 6, by - dx * 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(PAL.accent, 0.55 * pulse);
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("发球角度 " + (ang >= 0 ? "+" : "") + Math.round(ang * 180 / Math.PI) + "°", ox, oy - 22);
  };

  View.prototype._assist = function (ctx, s) {
    if (!s.assistActive || !s.assistTarget || !s.assistTarget.alive) return;
    const b = s.assistTarget, r = { x: b.rect.x - 3, y: b.rect.y - 3, w: b.rect.w + 6, h: b.rect.h + 6 };
    const a = 0.45 + 0.35 * Math.sin(this.t * 6);
    ctx.strokeStyle = rgba(PAL.amber, a);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    const arm = 8;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + arm); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + arm, r.y);
    ctx.moveTo(r.x + r.w - arm, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w, r.y + arm);
    ctx.moveTo(r.x + r.w, r.y + r.h - arm); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w - arm, r.y + r.h);
    ctx.moveTo(r.x + arm, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x, r.y + r.h - arm);
    ctx.stroke();
  };

  View.prototype._inline = function (ctx, s) {
    if (s.combo >= 2) {
      const size = 20 + Math.round(this.comboPop * 8);
      ctx.font = `${size}px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillStyle = s.combo >= 5 ? PAL.amber : PAL.text;
      ctx.fillText("×" + s.combo + " 连锁", C.WALL_R - 20, C.CEIL + 34);
    }
    if (s.boss && s.boss.telegraph) {
      const a = Math.min(1, s.boss.telegraph.t / 1.6);
      ctx.font = `22px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,196,107,${0.55 + 0.4 * a})`;
      ctx.fillText(s.boss.telegraph.text, 640, 168);
    }
    if (s.assistActive) {
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(PAL.amber, 0.65 + 0.25 * Math.sin(this.t * 4));
      ctx.fillText(s.assistReason, C.WALL_L + 12, C.DEATH - 14);
    }
  };

  root.BPView = { View, Fx, PAL, rgba, FONT, typeColor, mix };
})(typeof globalThis !== "undefined" ? globalThis : this);
