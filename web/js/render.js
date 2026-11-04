/* BREAKOUT: 磷光纪元 — 画面渲染 v3
 * 只读取 Sim 状态；所有抖动/色散/后处理只作用于绘制变换，不影响碰撞坐标。
 * 设计约束：1280×720 逻辑分辨率，全程序绘制，不依赖任何图片素材。
 */
(function (root) {
  "use strict";
  const BP = root.BP, C = BP.C;
  const PAL = {
    bg: "#05080a", bg2: "#08120f", grid: "#0d2a22",
    accent: "#7cffb2", cyan: "#7fd8ff", amber: "#ffc46b",
    rose: "#ff6b7e", steel: "#9fb3bd", text: "#d8fff0", dim: "#6f8f84",
    violet: "#b39cff",
  };
  const FONT = '"Cascadia Mono", Consolas, "Courier New", "Microsoft YaHei", monospace';

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function typeColor(t) { return BP.TYPE_COLOR[t] || PAL.accent; }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- 预渲染光晕
  // 每帧 shadowBlur 太贵；预先烘焙成贴图，用 lighter 混合叠上去。
  const glowCache = new Map();
  function glowSprite(color, size) {
    const key = color + "|" + size;
    let cv = glowCache.get(key);
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.width = cv.height = size * 2;
    const g = cv.getContext("2d");
    const grad = g.createRadialGradient(size, size, 0, size, size, size);
    grad.addColorStop(0, rgba(color, 0.85));
    grad.addColorStop(0.35, rgba(color, 0.28));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size * 2, size * 2);
    glowCache.set(key, cv);
    return cv;
  }
  function blitGlow(ctx, color, x, y, radius, alpha) {
    const spr = glowSprite(color, 64);
    ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- FX
  function Fx() {
    this.parts = [];
    this.rings = [];
    this.texts = [];
    this.waves = [];
    this.density = 1;
    this.rng = new BP.XRand(0x5eed);
  }
  Fx.prototype.clear = function () {
    this.parts.length = 0; this.rings.length = 0; this.texts.length = 0; this.waves.length = 0;
  };
  /** kind: 0 火花 / 1 碎片 / 2 余烬 */
  Fx.prototype.burst = function (x, y, nx, ny, color, amount, power, size, kind) {
    const n = Math.round(amount * this.density);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > C.MAX_PARTICLES) break;
      const a = this.rng.range(-1.15, 1.15);
      const cs = Math.cos(a), sn = Math.sin(a);
      const dx = nx * cs - ny * sn, dy = nx * sn + ny * cs;
      const sp = power * this.rng.range(0.3, 1.2);
      const life = this.rng.range(0.2, 0.5);
      this.parts.push({
        x, y, vx: dx * sp + this.rng.range(-46, 46), vy: dy * sp + this.rng.range(-46, 46),
        life, ttl: life, size: size * this.rng.range(0.6, 1.6),
        color, kind: kind || 0, rot: this.rng.range(0, 6.28), spin: this.rng.range(-9, 9),
      });
    }
  };
  Fx.prototype.debris = function (x, y, rect, color, amount) {
    const n = Math.round(amount * this.density);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > C.MAX_PARTICLES) break;
      const life = this.rng.range(0.5, 1.0);
      this.parts.push({
        x: rect.x + this.rng.range(2, rect.w - 2), y: rect.y + this.rng.range(2, rect.h - 2),
        vx: this.rng.range(-210, 210), vy: this.rng.range(-260, -30),
        life, ttl: life, size: this.rng.range(2.4, 6), color, kind: 1,
        rot: this.rng.range(0, 6.28), spin: this.rng.range(-12, 12),
        w: this.rng.range(3, 9), h: this.rng.range(1.6, 3.4),
      });
    }
  };
  Fx.prototype.ring = function (x, y, color, r0, r1, dur, width) {
    if (this.rings.length > C.MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, color, r0, r1, life: dur, ttl: dur, w: width });
  };
  Fx.prototype.wave = function (x, y, color, r, dur) {
    if (this.waves.length > 10) this.waves.shift();
    this.waves.push({ x, y, color, r, life: dur, ttl: dur });
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
      if (p.kind === 1) { p.vy += 980 * dt; p.vx *= 0.988; p.vy *= 0.988; }
      else if (p.kind === 2) { p.vy -= 40 * dt; p.vx *= 0.97; }
      else { p.vx *= 0.925; p.vy *= 0.925; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      this.waves[i].life -= dt;
      if (this.waves[i].life <= 0) this.waves.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].life -= dt;
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
      else { this.texts[i].y -= 52 * dt; }
    }
  };
  Fx.prototype.draw = function (ctx) {
    // 冲击波
    ctx.globalCompositeOperation = "lighter";
    for (const w of this.waves) {
      const a = Math.max(0, w.life / w.ttl);
      const t = 1 - a;
      const r = w.r * (0.25 + 0.85 * t);
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 3 + 9 * a;
      ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, 6.2832); ctx.stroke();
    }
    // 粒子
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.ttl);
      if (p.kind === 1) {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.kind === 2) {
        ctx.globalAlpha = a * 0.7;
        blitGlow(ctx, p.color, p.x, p.y, p.size * 3.4, a * 0.5);
      } else {
        const s = Math.hypot(p.vx, p.vy);
        const dx = s > 1 ? (p.vx / s) * (p.size + 7) : 0;
        const dy = s > 1 ? (p.vy / s) * (p.size + 7) : 0;
        ctx.globalAlpha = a * 0.95;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.55);
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - dx, p.y - dy); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // 光环
    for (const r of this.rings) {
      const a = Math.max(0, r.life / r.ttl);
      const t = 1 - a;
      ctx.globalAlpha = a * a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (0.4 + a * 0.8);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * t, 0, 6.2832);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 浮动文字：先描边再填，深色砖面上也读得清
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.ttl * 0.45));
      ctx.globalAlpha = a;
      ctx.font = `600 ${t.size}px ${FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.color;
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
    this.shakeX = 0; this.shakeY = 0;
    this.comboPop = 0;
    this.lastCombo = 0;
    this.levelFlash = 0;
    this.hitFlash = 0;
    this.paddleFlash = 0;
    this.paddleXPrev = null;
    this.showDamage = true;
    this.beams = [];
    this.bolts = [];
    this.motes = [];
    this.settings = { particles: 1, shake: 0.7, crt: 1 };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this._bgCache = null;
    this._rng = new BP.XRand(0xbeef);
    for (let i = 0; i < 46; i++) {
      this.motes.push({
        x: this._rng.range(C.WALL_L, C.WALL_R),
        y: this._rng.range(C.CEIL, C.DEATH),
        r: this._rng.range(0.6, 1.9),
        v: this._rng.range(4, 16),
        ph: this._rng.range(0, 6.28),
      });
    }
    this._resize();
  }

  View.prototype.setPixelRatio = function (pr) {
    const next = Math.max(1, Math.min(3, pr || 1));
    if (Math.abs(next - this.pixelRatio) < 0.01) return;
    this.pixelRatio = next;
    this._resize();
  };

  View.prototype._resize = function () {
    const dpr = this.pixelRatio;
    this.canvas.width = Math.round(C.W * dpr);
    this.canvas.height = Math.round(C.H * dpr);
    this.canvas.style.width = C.W + "px";
    this.canvas.style.height = C.H + "px";
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this._bgCache = null;
  };

  View.prototype.attach = function (sim) {
    this.sim = sim;
    this.fx.clear();
    this.flash.clear();
    this.shake = 0; this.comboPop = 0; this.lastCombo = 0; this.levelFlash = 0;
    this.hitFlash = 0; this.paddleFlash = 0; this.paddleXPrev = null;
    this.beams.length = 0; this.bolts.length = 0;
    if (!sim) return;
    const f = this.fx;
    const self = this;

    sim.on("brickHit", (brick, dmg, x, y, crit) => {
      let nx = x - brick.cx(), ny = y - brick.cy();
      let l = Math.hypot(nx, ny);
      if (l < 0.01) { nx = 0; ny = -1; l = 1; }
      nx /= l; ny /= l;
      const col = typeColor(brick.type);
      this.flash.set(brick, crit ? 0.2 : 0.13);
      if (brick.solid()) {
        f.burst(x, y, nx, ny, PAL.steel, 7, 170, 1.6);
        f.ring(x, y, PAL.steel, 2, 18, 0.26, 1.2);
        Sfx.play("tough", -6, 0.75);
      } else {
        f.burst(x, y, nx, ny, col, crit ? 16 : 8, crit ? 320 : 215, crit ? 2.6 : 1.9);
        if (crit) {
          f.ring(x, y, PAL.amber, 4, 30, 0.32, 2.2);
          f.text(x, y - 18, "暴击", PAL.amber, 0.6, 15);
          this.addShake(0.12);
        }
        if (brick.hp > 0) Sfx.play("tough", -5, 1.05);
      }
    });

    sim.on("brickDestroyed", (brick, cause, x, y, crit) => {
      this.flash.delete(brick);
      const col = typeColor(brick.type);
      f.debris(x, y, brick.rect, col, crit ? 14 : 9);
      f.ring(x, y, col, 4, 38, 0.34, 1.5);
      f.wave(x, y, rgba(col, 0.9), 54, 0.42);
      this.addShake(cause === "ball" ? 0.15 : 0.06);
      if (this.showDamage && cause === "ball") f.text(x, y - 14, "+" + brick.score(), col, 0.62, 14);
      if (brick.type === "gold") {
        f.burst(x, y, 0, -1, PAL.amber, 10, 200, 2, 2);
        f.text(x, y - 32, "+5 碎片", PAL.amber, 0.9, 14);
      }
      Sfx.play(cause === "ball" ? "break" : "brick", cause === "ball" ? -3 : -8, 1);
    });

    sim.on("exploded", (x, y, radius, destroyed) => {
      f.wave(x, y, PAL.rose, 118, 0.55);
      f.ring(x, y, PAL.rose, 8, 104, 0.5, 3);
      f.ring(x, y, PAL.amber, 4, 70, 0.36, 1.5);
      f.burst(x, y, 0, -1, PAL.rose, 28, 400, 2.8);
      this.addShake(0.5);
      this.hitFlash = Math.min(1, this.hitFlash + 0.22);
      Sfx.play("explode", -2, 1);
      if (destroyed > 1) f.text(x, y - 26, "连锁 ×" + destroyed, PAL.amber, 0.9, 17);
    });

    sim.on("paddle", (off, spd) => {
      const px = sim.paddleX + off * sim.paddleW / 2;
      this.paddleFlash = 1;
      f.burst(px, C.PADDLE_TOP, 0, -1, sim.buffs.laser > 0 ? PAL.amber : PAL.accent, 6, 160, 1.5);
      f.ring(px, C.PADDLE_TOP, PAL.accent, 2, 22, 0.24, 1.4);
      Sfx.play("paddle", -4, 1 + off * 0.06);
    });

    sim.on("wallBounce", (x, y, nx, ny) => {
      f.burst(x, y, nx, ny, PAL.accent, 3, 110, 1.2);
      Sfx.play("wall", -12, 1);
    });

    sim.on("ballLost", (x, y) => {
      f.wave(x, y, PAL.rose, 86, 0.6);
      f.ring(x, y, PAL.rose, 6, 78, 0.55, 2.4);
      f.burst(x, y, 0, -1, PAL.rose, 16, 260, 2.1);
      this.addShake(0.35);
      this.hitFlash = 0.5;
      Sfx.play("lifeLost", -3, 1);
      if (root.BP_PLATFORM) root.BP_PLATFORM.vibrate(30);
    });

    sim.on("launch", () => {
      f.burst(sim.paddleX, C.PADDLE_TOP - 8, 0, -1, PAL.accent, 12, 220, 1.8);
      f.ring(sim.paddleX, C.PADDLE_TOP - 8, PAL.accent, 3, 34, 0.3, 2);
      Sfx.play("serve", -4, 1);
    });

    sim.on("cleared", () => { this.levelFlash = 1; this.addShake(0.4); Sfx.play("clear", -2, 1); });
    sim.on("assist", (msg) => { f.text(640, 470, msg, PAL.amber, 1.4, 16); Sfx.play("correct", -14, 1); });

    sim.on("laser", (x, tx, ty) => {
      this.beams.push({ x, y: ty, t: 0.18 });
      f.ring(tx, ty, PAL.cyan, 2, 24, 0.26, 1.5);
      f.burst(tx, ty, 0, -1, PAL.cyan, 6, 190, 1.5);
      Sfx.play("laser", -9, 1);
    });
    sim.on("drone", (x, y) => {
      f.ring(x, y, "#9fd3a8", 2, 26, 0.3, 1.2);
      f.burst(x, y, 0, 1, "#9fd3a8", 4, 130, 1.2);
    });
    sim.on("chain", (x1, y1, x2, y2) => {
      this.bolts.push({ x1, y1, x2, y2, t: 0.2 });
      Sfx.play("chain", -12, 1);
    });
    sim.on("pierce", (x, y) => f.burst(x, y, 0, -1, "#ffd479", 7, 200, 1.6));
    sim.on("shieldBroke", (x, y) => { f.ring(x, y, PAL.cyan, 10, 48, 0.5, 3); Sfx.play("correct", -6); });
    sim.on("shieldUsed", (n) => { if (n > 0) toastShield(n); });
    sim.on("ballSpawned", (x, y) => { f.ring(x, y, PAL.accent, 4, 32, 0.4, 2); f.wave(x, y, PAL.accent, 40, 0.4); });
    sim.on("invuln", (x, y) => f.ring(x, y, "#c9a227", 6, 24, 0.22, 1.2));
    sim.on("regen", (x, y) => f.ring(x, y, "#8ee6c8", 2, 20, 0.3, 1.2));
    sim.on("bossPhase", () => { this.addShake(0.6); this.hitFlash = 0.7; });

    // 掉落物：出现 / 接住 / 漏掉
    sim.on("dropSpawned", (type, x, y) => {
      const d = BP.DROPS[type];
      f.ring(x, y, d.color, 2, 26, 0.35, 1.4);
    });
    sim.on("pickup", (type, x, y, label) => {
      const d = BP.DROPS[type] || { color: PAL.accent };
      f.ring(x, C.PADDLE_TOP, d.color, 6, 54, 0.44, 2.6);
      f.burst(x, C.PADDLE_TOP, 0, -1, d.color, 12, 240, 1.8);
      f.text(sim.paddleX, C.PADDLE_TOP - 34, label || "", d.color, 0.9, 16);
      this.paddleFlash = 1;
      Sfx.play("pickup", -5, 1.1);
      if (root.BP_PLATFORM) root.BP_PLATFORM.vibrate(12);
    });
    sim.on("dropMiss", (type, x, y) => {
      const d = BP.DROPS[type] || { color: PAL.dim };
      f.ring(x, y, d.color, 2, 18, 0.3, 1);
    });
  };

  function toastShield(n) { /* 由 UI 层负责提示，这里留空避免重复 */ }

  View.prototype.addShake = function (v) {
    this.shake = Math.min(1, this.shake + v);
  };

  View.prototype.update = function (dt) {
    this.t += dt;
    this.fx.density = Math.max(0, Math.min(1, this.settings.particles));
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    const amp = 11 * this.shake * (this.settings.shake || 0);
    this.shakeX = (Math.random() - 0.5) * amp;
    this.shakeY = (Math.random() - 0.5) * amp;
    this.levelFlash = Math.max(0, this.levelFlash - dt * 1.6);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3.4);
    this.paddleFlash = Math.max(0, this.paddleFlash - dt * 4.5);
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
    // 环境浮尘
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.x += Math.sin(this.t * 0.6 + m.ph) * 5 * dt;
      if (m.y < C.CEIL) { m.y = C.DEATH; m.x = C.WALL_L + Math.random() * C.ARENA_W; }
    }
  };

  View.prototype.draw = function () {
    const ctx = this.ctx, s = this.sim;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this._bg(ctx);
    this._walls(ctx);
    if (s) {
      this._bricks(ctx, s);
      this._drops(ctx, s);
      this._beams(ctx);
      this.fx.draw(ctx);
      this._assist(ctx, s);
      this._serve(ctx, s);
      this._paddle(ctx, s);
      this._balls(ctx, s);
      this._inline(ctx, s);
      this._post(ctx, s);
    }
    ctx.restore();
  };

  View.prototype._bg = function (ctx) {
    if (!this._bgCache) {
      const cv = document.createElement("canvas");
      cv.width = C.W; cv.height = C.H;
      const g = cv.getContext("2d");
      g.fillStyle = PAL.bg;
      g.fillRect(0, 0, C.W, C.H);
      const bands = 14, h = C.H / bands;
      for (let i = 0; i < bands; i++) {
        const f = i / (bands - 1);
        g.fillStyle = mix(PAL.bg, PAL.bg2, f * 0.9);
        g.fillRect(0, i * h, C.W, h + 0.7);
      }
      // 顶部主机舱氛围光
      const top = g.createLinearGradient(0, C.CEIL, 0, C.CEIL + 220);
      top.addColorStop(0, "rgba(20,60,46,0.30)");
      top.addColorStop(1, "rgba(20,60,46,0)");
      g.fillStyle = top;
      g.fillRect(C.WALL_L, C.CEIL, C.ARENA_W, 220);
      // 场地网格
      g.strokeStyle = "rgba(124,255,178,0.055)";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 96; x < C.W; x += 96) { g.moveTo(x, C.CEIL); g.lineTo(x, C.DEATH); }
      for (let y = C.CEIL; y < C.DEATH; y += 96) { g.moveTo(C.WALL_L, y); g.lineTo(C.WALL_R, y); }
      g.stroke();
      // 暗角
      const vg = g.createRadialGradient(C.W / 2, C.H * 0.45, C.H * 0.2, C.W / 2, C.H * 0.45, C.H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = vg;
      g.fillRect(0, 0, C.W, C.H);
      this._bgCache = cv;
    }
    ctx.drawImage(this._bgCache, 0, 0);

    // 网格随连击变亮：给"打得顺"一个体感反馈
    const s = this.sim;
    const heat = s ? Math.min(1, s.combo / 12) : 0;
    if (heat > 0.02) {
      ctx.strokeStyle = `rgba(124,255,178,${0.02 + heat * 0.075})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = C.WALL_L; x <= C.WALL_R; x += 96) { ctx.moveTo(x, C.CEIL); ctx.lineTo(x, C.DEATH); }
      for (let y = C.CEIL; y <= C.DEATH; y += 96) { ctx.moveTo(C.WALL_L, y); ctx.lineTo(C.WALL_R, y); }
      ctx.stroke();
    }

    // 浮尘
    ctx.fillStyle = "rgba(160,255,205,0.30)";
    for (const m of this.motes) {
      ctx.globalAlpha = 0.16 + 0.12 * Math.sin(this.t * 2 + m.ph);
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 扫描光带
    const sy = (this.t * 26) % (C.H + 200) - 100;
    const grad = ctx.createLinearGradient(0, sy - 40, 0, sy + 6);
    grad.addColorStop(0, "rgba(124,255,178,0)");
    grad.addColorStop(1, "rgba(124,255,178,0.05)");
    ctx.fillStyle = grad;
    ctx.fillRect(C.WALL_L, sy - 40, C.ARENA_W, 46);
  };

  View.prototype._walls = function (ctx) {
    ctx.lineCap = "butt";
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(PAL.accent, 0.085);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(C.WALL_L, C.CEIL); ctx.lineTo(C.WALL_L, C.DEATH);
    ctx.moveTo(C.WALL_R, C.CEIL); ctx.lineTo(C.WALL_R, C.DEATH);
    ctx.moveTo(C.WALL_L, C.CEIL); ctx.lineTo(C.WALL_R, C.CEIL);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = rgba(PAL.accent, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 死亡线：呼吸式警示
    const pulse = 0.13 + 0.06 * Math.sin(this.t * 3);
    ctx.strokeStyle = rgba(PAL.rose, pulse);
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(C.WALL_L, C.DEATH); ctx.lineTo(C.WALL_R, C.DEATH); ctx.stroke();
    ctx.setLineDash([]);

    // 侧墙刻度
    ctx.strokeStyle = rgba(PAL.accent, 0.16);
    ctx.lineWidth = 1;
    for (let y = C.CEIL + 24; y < C.DEATH; y += 48) {
      ctx.beginPath(); ctx.moveTo(C.WALL_L, y); ctx.lineTo(C.WALL_L + (y % 96 === 0 ? 8 : 4), y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(C.WALL_R, y); ctx.lineTo(C.WALL_R - (y % 96 === 0 ? 8 : 4), y); ctx.stroke();
    }

    // 四角括号
    const arm = 24;
    ctx.strokeStyle = rgba(PAL.accent, 0.55);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const [x, y, sx, sy] of [
      [C.WALL_L, C.CEIL, 1, 1], [C.WALL_R, C.CEIL, -1, 1],
      [C.WALL_L, C.DEATH, 1, -1], [C.WALL_R, C.DEATH, -1, -1],
    ]) {
      ctx.moveTo(x, y); ctx.lineTo(x + arm * sx, y);
      ctx.moveTo(x, y); ctx.lineTo(x, y + arm * sy);
    }
    ctx.stroke();
  };

  // ---------------------------------------------------------------- 砖块
  View.prototype._bricks = function (ctx, s) {
    const list = (s.grid ? s.grid.cells : []).concat(s.boss ? s.boss.parts : []);
    list.sort((a, b) => (a && a.type === "core" ? 1 : 0) - (b && b.type === "core" ? 1 : 0));
    for (const b of list) {
      if (!b || !b.alive) continue;
      const r = { x: b.rect.x + 2, y: b.rect.y + 2, w: b.rect.w - 4, h: b.rect.h - 4 };
      const c = typeColor(b.type);
      const isPart = !!b.isPart;

      // 背光：特殊砖有更明显的辉光
      ctx.globalCompositeOperation = "lighter";
      const glowA = b.type === "core" ? 0.34
        : (b.type === "weakPoint" || b.type === "gold" || b.type === "blast") ? 0.20
        : b.type === "solid" ? 0.04 : 0.085;
      blitGlow(ctx, c, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.60, glowA);
      ctx.globalCompositeOperation = "source-over";

      // 主体：竖直渐变 + 圆角
      const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (b.type === "solid") {
        grad.addColorStop(0, "#111a1e"); grad.addColorStop(1, "#070c0e");
      } else {
        grad.addColorStop(0, shade(c, isPart ? -0.34 : -0.46));
        grad.addColorStop(0.42, shade(c, isPart ? -0.58 : -0.66));
        grad.addColorStop(1, shade(c, -0.84));
      }
      ctx.fillStyle = grad;
      roundRect(ctx, r.x, r.y, r.w, r.h, 3);
      ctx.fill();

      // 顶部内高光 + 底部内阴影：营造亚克力质感
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 3);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, 1.5);
      ctx.fillStyle = "rgba(0,0,0,0.40)";
      ctx.fillRect(r.x + 1, r.y + r.h - 2, r.w - 2, 2);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
      this._brickGlyph(ctx, b, r, c);
      this._brickDamage(ctx, b, r);
      ctx.restore();

      // 外描边
      ctx.strokeStyle = b.type === "solid" ? "rgba(140,158,166,0.5)" : rgba(c, 0.92);
      ctx.lineWidth = b.type === "solid" ? 1.8 : 1.35;
      roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 3);
      ctx.stroke();

      // 命中闪白
      const fl = this.flash.get(b) || 0;
      if (fl > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255,255,255,${0.68 * Math.min(1, fl / 0.13)})`;
        roundRect(ctx, r.x, r.y, r.w, r.h, 3);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      this._brickStatus(ctx, b, r, c);
    }
  };

  View.prototype._brickGlyph = function (ctx, b, r, c) {
    if (b.type === "normal") {
      ctx.fillStyle = rgba(c, 0.55);
      ctx.fillRect(r.x + r.w - 18, r.y + 3, 14, 2);
    } else if (b.type === "tough") {
      for (let i = 0; i < b.maxHp; i++) {
        const y = r.y + r.h * (0.34 + 0.32 * i);
        ctx.strokeStyle = rgba(c, i < b.hp ? 0.7 : 0.16);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(r.x + 9, y); ctx.lineTo(r.x + r.w - 9, y); ctx.stroke();
      }
    } else if (b.type === "armored") {
      ctx.strokeStyle = rgba(c, 0.16);
      ctx.lineWidth = 1;
      for (let x = r.x - r.h; x < r.x + r.w; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke();
      }
      ctx.fillStyle = rgba(c, 0.9);
      for (const [dx, dy] of [[6, 7], [r.w - 6, 7], [6, r.h - 7], [r.w - 6, r.h - 7]]) {
        ctx.beginPath(); ctx.arc(r.x + dx, r.y + dy, 1.7, 0, 6.2832); ctx.fill();
      }
      for (let i = 0; i < b.hp; i++) {
        ctx.fillStyle = rgba(c, 0.95);
        ctx.fillRect(r.x + 3, r.y + r.h / 2 - 4 + i * 5, 3, 3);
      }
    } else if (b.type === "blast") {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const p = 0.6 + 0.4 * Math.sin(this.t * 6 + b.col);
      ctx.strokeStyle = rgba(c, 0.95 * p);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 9, cy);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = rgba(c, 0.9 * p);
      ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, 6.2832); ctx.fill();
    } else if (b.type === "solid") {
      ctx.strokeStyle = "rgba(140,158,166,0.16)";
      ctx.lineWidth = 1;
      for (let x = r.x - r.h; x < r.x + r.w; x += 9) {
        ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x + r.h, r.y + r.h); ctx.stroke();
      }
    } else if (b.type === "regen") {
      ctx.strokeStyle = rgba(c, 0.8);
      ctx.lineWidth = 1.8;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = 7;
      ctx.beginPath(); ctx.arc(cx, cy, rad, -1.1, 2.2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy - 6); ctx.lineTo(cx + 8, cy - 1); ctx.lineTo(cx + 3, cy - 1);
      ctx.stroke();
    } else if (b.type === "gold") {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const p = 0.7 + 0.3 * Math.sin(this.t * 4 + b.col * 0.7);
      ctx.fillStyle = rgba(c, 0.95 * p);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 8, cy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(cx - 2, cy - 10, 1.5, 20);
    } else if (b.type === "moving") {
      ctx.strokeStyle = rgba(c, 0.8);
      ctx.lineWidth = 1.6;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const o = Math.sin(this.t * 3 + b.col) * 3;
      ctx.beginPath();
      ctx.moveTo(cx - 12 + o, cy); ctx.lineTo(cx - 4 + o, cy);
      ctx.moveTo(cx + 12 + o, cy); ctx.lineTo(cx + 4 + o, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 12 + o, cy); ctx.lineTo(cx - 8 + o, cy - 3); ctx.moveTo(cx - 12 + o, cy); ctx.lineTo(cx - 8 + o, cy + 3);
      ctx.moveTo(cx + 12 + o, cy); ctx.lineTo(cx + 8 + o, cy - 3); ctx.moveTo(cx + 12 + o, cy); ctx.lineTo(cx + 8 + o, cy + 3);
      ctx.stroke();
    } else if (b.type === "shieldNode") {
      ctx.strokeStyle = rgba(c, 0.85);
      ctx.lineWidth = 1.6;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 8, cy - 3); ctx.lineTo(cx + 8, cy + 4);
      ctx.lineTo(cx, cy + 9); ctx.lineTo(cx - 8, cy + 4); ctx.lineTo(cx - 8, cy - 3);
      ctx.closePath(); ctx.stroke();
    } else if (b.type === "core") {
      const p = 0.6 + 0.4 * Math.sin(this.t * 3);
      ctx.fillStyle = rgba(c, 0.10 * p);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = rgba(c, 0.9);
      ctx.lineWidth = 1.4;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(r.w, r.h) * 0.24, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(r.w, r.h) * 0.10, 0, 6.2832); ctx.fillStyle = rgba(c, 0.85); ctx.fill();
    } else if (b.type === "armorPlate") {
      ctx.strokeStyle = rgba(c, 0.35);
      ctx.lineWidth = 1;
      for (let x = r.x - r.h; x < r.x + r.w; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x + r.h, r.y); ctx.stroke();
      }
    } else if (b.type === "weakPoint") {
      const p = 0.5 + 0.5 * Math.sin(this.t * 7);
      ctx.strokeStyle = rgba(c, 0.5 + 0.45 * p);
      ctx.lineWidth = 1.8;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 7, cy);
      ctx.closePath(); ctx.stroke();
    }
  };

  View.prototype._brickDamage = function (ctx, b, r) {
    if (b.type === "solid" || b.hp >= b.maxHp) return;
    const seed = b.col * 73 + b.row * 151;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.2;
    const n = Math.min(3, b.maxHp - b.hp);
    for (let i = 0; i < n; i++) {
      const sx = r.x + 14 + ((seed + i * 37) % Math.max(20, r.w - 40));
      const sy = r.y + 4 + ((seed + i * 53) % 8);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 5, sy + 6);
      ctx.lineTo(sx + 1, sy + 12);
      ctx.lineTo(sx + 9, sy + 18);
      ctx.stroke();
    }
    // 血量条：比裂纹更易读
    if (b.maxHp > 1 && b.hp > 0) {
      const p = b.hp / b.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(r.x + 6, r.y + r.h - 5, r.w - 12, 2);
      ctx.fillStyle = p > 0.6 ? "rgba(124,255,178,0.9)" : p > 0.3 ? "rgba(255,196,107,0.9)" : "rgba(255,107,126,0.95)";
      ctx.fillRect(r.x + 6, r.y + r.h - 5, (r.w - 12) * p, 2);
    }
  };

  View.prototype._brickStatus = function (ctx, b, r, c) {
    if (b.frozen > 0) {
      ctx.fillStyle = "rgba(127,216,255,0.20)";
      roundRect(ctx, r.x, r.y, r.w, r.h, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(160,232,255,0.95)";
      ctx.lineWidth = 1.6;
      roundRect(ctx, r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1, 3);
      ctx.stroke();
      // 霜花角标
      ctx.strokeStyle = "rgba(220,245,255,0.65)";
      ctx.lineWidth = 1;
      for (const [dx, dy, sx, sy] of [[3, 3, 1, 1], [r.w - 3, 3, -1, 1], [3, r.h - 3, 1, -1], [r.w - 3, r.h - 3, -1, -1]]) {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(r.x + dx, r.y + dy);
          ctx.lineTo(r.x + dx + Math.cos(a) * 6 * sx, r.y + dy + Math.sin(a) * 6 * sy);
          ctx.stroke();
        }
      }
    }
    if (b.burn > 0) {
      for (let i = 0; i < b.burn; i++) {
        const t = this.t * 9 + b.col + i * 1.7;
        const x = r.x + 10 + (i % 2) * (r.w - 20);
        const y = r.y + r.h - 4 - (Math.sin(t) * 0.5 + 0.5) * 8;
        ctx.fillStyle = `rgba(255,${130 + 40 * Math.sin(t)},70,${0.55 + 0.35 * Math.sin(t * 1.7)})`;
        ctx.beginPath(); ctx.arc(x, y, 1.8 + Math.sin(t) * 0.6, 0, 6.2832); ctx.fill();
      }
    }
    if (b.charge > 0) {
      ctx.strokeStyle = `rgba(179,156,255,${0.35 + 0.4 * Math.sin(this.t * 10 + b.col)})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < b.charge; i++) {
        const x = r.x + r.w - 8 - i * 5;
        ctx.beginPath();
        ctx.moveTo(x, r.y + 3);
        ctx.lineTo(x - 2, r.y + 7);
        ctx.lineTo(x + 1, r.y + 8);
        ctx.lineTo(x - 1, r.y + 12);
        ctx.stroke();
      }
    }
  };

  // ---------------------------------------------------------------- 掉落物
  View.prototype._drops = function (ctx, s) {
    if (!s.drops || !s.drops.length) return;
    for (const d of s.drops) {
      const def = BP.DROPS[d.type] || { color: PAL.accent, glyph: "?" };
      const size = C.DROP_R * 2;
      const half = size / 2;
      const bob = Math.sin(d.ph) * 2;
      const x = d.x, y = d.y + bob;
      const life = Math.max(0, 1 - d.age / C.DROP_TTL);
      const nearEnd = life < 0.28;

      ctx.globalCompositeOperation = "lighter";
      blitGlow(ctx, def.color, x, y, size * 1.5, 0.34 * (nearEnd ? 0.4 + 0.6 * Math.abs(Math.sin(this.t * 14)) : 1));
      ctx.globalCompositeOperation = "source-over";

      // 胶囊
      ctx.save();
      roundRect(ctx, x - half, y - half, size, size, 7);
      const g = ctx.createLinearGradient(0, y - half, 0, y + half);
      g.addColorStop(0, shade(def.color, -0.55));
      g.addColorStop(1, shade(def.color, -0.85));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(def.color, nearEnd ? 0.5 + 0.5 * Math.abs(Math.sin(this.t * 14)) : 0.95);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 内部扫描条
      ctx.clip();
      const sy = y - half + ((this.t * 60 + d.ph * 20) % size);
      ctx.fillStyle = rgba(def.color, 0.22);
      ctx.fillRect(x - half, sy, size, 2.5);
      ctx.restore();

      // 字形
      ctx.fillStyle = rgba(def.color, 1);
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.glyph, x, y + 1);
      ctx.textBaseline = "alphabetic";

      // 落地提示线
      if (d.y > C.PADDLE_TOP - 210) {
        ctx.strokeStyle = rgba(def.color, 0.20);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(x, y + half); ctx.lineTo(x, C.PADDLE_TOP); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  View.prototype._beams = function (ctx) {
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.beams) {
      const a = Math.max(0, b.t / 0.18);
      ctx.strokeStyle = `rgba(127,216,255,${a * 0.85})`;
      ctx.lineWidth = 2.5 + a * 2;
      ctx.beginPath(); ctx.moveTo(b.x, C.PADDLE_TOP - 8); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const b of this.bolts) {
      const a = Math.max(0, b.t / 0.2);
      ctx.strokeStyle = `rgba(179,156,255,${a * 0.95})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // 折线闪电
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = b.x1 + (b.x2 - b.x1) * t + (i > 0 && i < steps ? Math.sin(i * 7.7 + this.t * 40) * 6 : 0);
        const y = b.y1 + (b.y2 - b.y1) * t + (i > 0 && i < steps ? Math.cos(i * 5.1 + this.t * 40) * 5 : 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  // ---------------------------------------------------------------- 挡板
  View.prototype._paddle = function (ctx, s) {
    const w = s.paddleW, x = s.paddleX - w / 2, y = C.PADDLE_TOP;
    const wide = s.buffs && s.buffs.wide > 0;
    const laser = s.buffs && s.buffs.laser > 0;
    const tint = laser ? PAL.amber : wide ? PAL.cyan : PAL.accent;

    // 能量场
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createLinearGradient(0, y - 26, 0, y + 22);
    halo.addColorStop(0, rgba(tint, 0));
    halo.addColorStop(0.55, rgba(tint, 0.10 + 0.06 * this.paddleFlash));
    halo.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(x - 16, y - 26, w + 32, 48);
    ctx.globalCompositeOperation = "source-over";

    // 底座
    roundRect(ctx, x, y, w, C.PADDLE_H, 4);
    const g = ctx.createLinearGradient(0, y, 0, y + C.PADDLE_H);
    g.addColorStop(0, shade(tint, -0.55));
    g.addColorStop(1, shade(tint, -0.88));
    ctx.fillStyle = g;
    ctx.fill();

    // 能量槽
    ctx.save();
    roundRect(ctx, x, y, w, C.PADDLE_H, 4);
    ctx.clip();
    const core = ctx.createLinearGradient(x, 0, x + w, 0);
    const shift = (this.t * 0.6) % 1;
    core.addColorStop(0, rgba(tint, 0.10));
    core.addColorStop(Math.max(0.02, shift * 0.8), rgba(tint, 0.32));
    core.addColorStop(Math.min(0.98, shift * 0.8 + 0.18), rgba("#ffffff", 0.22));
    core.addColorStop(1, rgba(tint, 0.10));
    ctx.fillStyle = core;
    ctx.fillRect(x + 6, y + 3, w - 12, C.PADDLE_H - 6);
    // 命中闪光
    if (this.paddleFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * this.paddleFlash})`;
      ctx.fillRect(x, y, w, C.PADDLE_H);
    }
    ctx.restore();

    // 外框
    ctx.strokeStyle = rgba(tint, 0.95);
    ctx.lineWidth = 1.6;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, C.PADDLE_H - 1, 4);
    ctx.stroke();

    // 两端推进器
    for (const side of [0, 1]) {
      const px = side === 0 ? x + 3 : x + w - 9;
      ctx.fillStyle = rgba(tint, 0.85);
      ctx.fillRect(px, y + 2, 6, C.PADDLE_H - 4);
      const flick = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 22 + side * 2));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(tint, 0.20 * flick);
      ctx.fillRect(px - 2, y + 4, 10, C.PADDLE_H - 8);
      ctx.globalCompositeOperation = "source-over";
    }

    // 中心准星
    ctx.fillStyle = rgba(tint, 0.75);
    ctx.fillRect(s.paddleX - 0.75, y + 3, 1.5, C.PADDLE_H - 6);
    ctx.fillStyle = rgba(tint, 0.35);
    ctx.fillRect(s.paddleX - 5, y + C.PADDLE_H - 2, 10, 1);

    // 激光发射器
    if (laser) {
      ctx.fillStyle = rgba(PAL.amber, 0.95);
      for (const dx of [-w / 2 + 8, 0, w / 2 - 8]) {
        ctx.fillRect(s.paddleX + dx - 1.5, y - 5, 3, 4);
      }
    }
    // 磁吸力场
    if (s.mods && (s.mods.magnet > 0 || (s.buffs && s.buffs.magnet > 0))) {
      const p = 0.18 + 0.12 * Math.sin(this.t * 5);
      ctx.strokeStyle = rgba(PAL.accent, p);
      ctx.lineWidth = 1.2;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(s.paddleX, y + 2, w * (0.28 + i * 0.12), 12 + i * 9, 0, Math.PI, 0);
        ctx.stroke();
      }
    }
    // 护盾
    if (s.shield > 0) {
      ctx.strokeStyle = rgba(PAL.violet, 0.35 + 0.15 * Math.sin(this.t * 4));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(C.WALL_L + 4, C.SHIELD_Y); ctx.lineTo(C.WALL_R - 4, C.SHIELD_Y);
      ctx.stroke();
      for (let i = 0; i < s.shield; i++) {
        ctx.fillStyle = rgba(PAL.violet, 0.8);
        ctx.fillRect(C.WALL_R - 12 - i * 12, C.SHIELD_Y - 5, 7, 3);
      }
    }
  };

  // ---------------------------------------------------------------- 球
  View.prototype._balls = function (ctx, s) {
    for (const b of s.balls) {
      if (!b.active) continue;
      const c = b.attached ? PAL.cyan : (b.pierce > 0 ? PAL.amber : PAL.accent);
      const n = b.trail.length;

      // 拖尾：整条多边形填充（逐段描边会有明显台阶）
      if (n >= 2 && !(root.__dbg && root.__dbg.noTrail)) {
        const pts = b.trail.slice(0, 13);
        const n2 = pts.length;
        const wmax = b.r * 1.25;
        const left = [], right = [];
        for (let i = 0; i < n2; i++) {
          const p = pts[i];
          const q = pts[Math.min(n2 - 1, i + 1)];
          let dx = p.x - q.x, dy = p.y - q.y;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len; dy /= len;
          const w = wmax * (1 - i / n2);
          left.push([p.x - dy * w, p.y + dx * w]);
          right.push([p.x + dy * w, p.y - dx * w]);
        }
        const tail = pts[n2 - 1];
        const g2 = ctx.createLinearGradient(b.x, b.y, tail.x, tail.y);
        g2.addColorStop(0, rgba(c, 0.34));
        g2.addColorStop(0.5, rgba(c, 0.12));
        g2.addColorStop(1, rgba(c, 0));
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(left[0][0], left[0][1]);
        for (let i = 1; i < n2; i++) ctx.lineTo(left[i][0], left[i][1]);
        for (let i = n2 - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      // 辉光
      ctx.globalCompositeOperation = "lighter";
      blitGlow(ctx, c, b.x, b.y, b.r * 4.0, 0.22);
      ctx.globalCompositeOperation = "source-over";

      // 球体
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 0.5, b.x, b.y, b.r + 2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#eafff4");
      g.addColorStop(1, rgba(c, 0.85));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.2, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1.6, 0, 6.2832); ctx.stroke();

      // 方向指示（短箭头，不抢主体）
      const d = b.dir();
      const tipx = b.x + d.x * (b.r + 11), tipy = b.y + d.y * (b.r + 11);
      const bx0 = tipx - d.x * 5, by0 = tipy - d.y * 5;
      ctx.fillStyle = rgba(c, 0.55);
      ctx.beginPath();
      ctx.moveTo(tipx, tipy);
      ctx.lineTo(bx0 - d.y * 3, by0 + d.x * 3);
      ctx.lineTo(bx0 + d.y * 3, by0 - d.x * 3);
      ctx.closePath(); ctx.fill();

      // 穿透状态：外圈脉冲
      if (b.pierce > 0) {
        ctx.strokeStyle = rgba(PAL.amber, 0.5 + 0.4 * Math.sin(this.t * 12));
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6, 0, 6.2832); ctx.stroke();
      }
      // 暴击待发
      if (b.critNext) {
        ctx.strokeStyle = rgba(PAL.amber, 0.9);
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  // ---------------------------------------------------------------- 发球引导
  View.prototype._serve = function (ctx, s) {
    if (root.__dbg && root.__dbg.noServe) return;
    if (s.phase !== BP.PHASE.SERVE || !s.balls.length) return;
    const b = s.balls[0];
    const ang = s.aimAngle();
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    const ox = b.x, oy = b.y - 4;
    const len = 270, pulse = 0.5 + 0.35 * Math.sin(this.t * 5);

    // 虚线改成渐隐的锥形光束
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createLinearGradient(ox, oy, ox + dx * len, oy + dy * len);
    grad.addColorStop(0, rgba(PAL.accent, 0.42 * pulse));
    grad.addColorStop(1, rgba(PAL.accent, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * len, oy + dy * len); ctx.stroke();
    ctx.restore();

    const tipx = ox + dx * len, tipy = oy + dy * len;
    const bx = tipx - dx * 13, by = tipy - dy * 13;
    ctx.fillStyle = rgba(PAL.accent, 0.8 * pulse);
    ctx.beginPath();
    ctx.moveTo(tipx, tipy);
    ctx.lineTo(bx - dy * 6, by + dx * 6);
    ctx.lineTo(bx + dy * 6, by - dx * 6);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = rgba(PAL.accent, 0.6 * pulse);
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = "center";
    const deg = Math.round(ang * 180 / Math.PI);
    ctx.fillText("发球角度 " + (deg >= 0 ? "+" : "") + deg + "°", ox, oy - 26 + Math.sin(this.t * 4) * 2);
  };

  // ---------------------------------------------------------------- 收尾引导
  View.prototype._assist = function (ctx, s) {
    if (!s.assistActive || !s.assistTarget || !s.assistTarget.alive) return;
    const b = s.assistTarget, r = { x: b.rect.x - 3, y: b.rect.y - 3, w: b.rect.w + 6, h: b.rect.h + 6 };
    const a = 0.4 + 0.35 * Math.sin(this.t * 6);
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

  // ---------------------------------------------------------------- 画布内信息
  View.prototype._inline = function (ctx, s) {
    ctx.textAlign = "right";
    if (s.combo >= 2) {
      const size = 20 + Math.round(this.comboPop * 10);
      ctx.font = `700 ${size}px ${FONT}`;
      const hot = s.combo >= 8;
      ctx.fillStyle = hot ? PAL.rose : s.combo >= 5 ? PAL.amber : PAL.text;
      const jitter = this.comboPop > 0 ? (Math.random() - 0.5) * 2 : 0;
      ctx.fillText("×" + s.combo + " 连锁", C.WALL_R - 20 + jitter, C.CEIL + 34 + jitter);
      // 连锁进度条
      const t = 1 - Math.min(1, (s.time - s._lastBreak) / C.COMBO_WINDOW);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(C.WALL_R - 120, C.CEIL + 43, 100, 3);
      ctx.fillStyle = rgba(hot ? PAL.rose : PAL.amber, 0.85);
      ctx.fillRect(C.WALL_R - 120, C.CEIL + 43, 100 * t, 3);
    }

    // 临时增益胶囊
    const buffs = s.buffReport ? s.buffReport() : [];
    if (buffs.length) {
      ctx.textAlign = "left";
      let bx = C.WALL_L + 12;
      const by = C.CEIL + 22;
      for (const b of buffs) {
        const w = 74;
        ctx.fillStyle = rgba(b.color, 0.10);
        roundRect(ctx, bx, by, w, 18, 4); ctx.fill();
        ctx.strokeStyle = rgba(b.color, 0.55);
        ctx.lineWidth = 1;
        roundRect(ctx, bx + 0.5, by + 0.5, w - 1, 17, 4); ctx.stroke();
        // 剩余时间条
        ctx.fillStyle = rgba(b.color, 0.75);
        ctx.fillRect(bx + 1, by + 16, (w - 2) * Math.min(1, b.t / 14), 1.6);
        ctx.fillStyle = rgba(b.color, 0.95);
        ctx.font = `11px ${FONT}`;
        ctx.fillText(b.label + " " + Math.ceil(b.t) + "s", bx + 7, by + 12);
        bx += w + 6;
      }
    }

    if (s.boss && s.boss.telegraph) {
      const a = Math.min(1, s.boss.telegraph.t / 1.6);
      ctx.font = `600 22px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,196,107,${0.55 + 0.4 * a})`;
      ctx.fillText(s.boss.telegraph.text, 640, 172);
    }
    if (s.assistActive) {
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillStyle = rgba(PAL.amber, 0.6 + 0.25 * Math.sin(this.t * 4));
      ctx.fillText(s.assistReason, C.WALL_L + 12, C.DEATH - 14);
    }
  };

  // ---------------------------------------------------------------- 后处理
  View.prototype._post = function (ctx, s) {
    // 命中泛光
    if (this.hitFlash > 0) {
      ctx.fillStyle = rgba(PAL.rose, 0.05 * this.hitFlash);
      ctx.fillRect(0, 0, C.W, C.H);
    }
    if (this.levelFlash > 0) {
      ctx.fillStyle = rgba(PAL.accent, 0.16 * this.levelFlash);
      ctx.fillRect(0, 0, C.W, C.H);
    }
    // 低生命脉冲红边
    if (s.lives <= 1 && s.lives > 0) {
      const p = 0.05 + 0.05 * Math.sin(this.t * 5);
      const vg = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.35, C.W / 2, C.H / 2, C.H * 0.85);
      vg.addColorStop(0, "rgba(255,60,80,0)");
      vg.addColorStop(1, `rgba(255,60,80,${p})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, C.W, C.H);
    }
  };

  root.BPView = { View, Fx, PAL, rgba, FONT, typeColor, mix, shade };
})(typeof globalThis !== "undefined" ? globalThis : this);
