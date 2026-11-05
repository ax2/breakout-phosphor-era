/* BREAKOUT: 磷光纪元 — 模式、远征、局外进度与存档（v3） */
(function (root) {
  "use strict";
  const BP = root.BP, C = BP.C, CT = root.CONTENT;

  const SAVE_KEY = "breakout-phosphor-era/save";
  const SAVE_VER = 3;

  const STORE = (root.BP_PLATFORM && root.BP_PLATFORM.store) || {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  const DEFAULT_SETTINGS = {
    crt: 1, shake: 0.7, particles: 1, damage_numbers: true,
    echo_assist: true, music: 0.45, sfx: 0.8, show_fps: false, vsync: true,
    // 输入容错：鼠标移出画面自动暂停 / 回来后自动继续（默认开，解决"移出窗口必失球"）
    pause_on_leave: true, auto_resume: true, pointer_lock: false,
    // 掉落物开关：关掉后回到纯构筑体验
    drops: true,
    // 减弱动效：关掉缩放冲击、色散与强闪，震动沿用「屏幕抖动」档位
    reduce_motion: false,
  };

  function defaults() {
    return {
      version: SAVE_VER,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      meta: {
        cleared: {}, best: {}, bestScore: 0, bestChapter: 0,
        runs: 0, wins: 0, totalBricks: 0, endlessBest: 0,
        // 档案统计
        deaths: 0, playTime: 0, noHitChapters: 0, flawless: {},
        history: [], dailyStreak: 0, dailyLast: 0,
        unlocks: ["p1"], achievements: [], codex: { levels: [], relics: [], upgrades: [], bosses: [] },
      },
      records: { best_combo: 0, best_score: 0 },
    };
  }

  const State = {
    data: defaults(),
    status: "new",
    load() {
      let raw = null;
      try { raw = STORE.get(SAVE_KEY); } catch (e) { /* 隐私模式 */ }
      let d = null;
      if (raw) { try { d = JSON.parse(raw); } catch (e) { d = null; } }
      if (!d) {
        try { const bak = STORE.get(SAVE_KEY + ".bak"); if (bak) d = JSON.parse(bak); } catch (e) { d = null; }
      }
      if (!d || typeof d !== "object") { this.data = defaults(); this.status = raw ? "corrupt_reset" : "new"; this.persist(); return; }
      const ver = d.version || 1;
      const base = defaults();
      d.settings = Object.assign(base.settings, d.settings || {});
      d.meta = Object.assign(base.meta, d.meta || {});
      d.meta.codex = Object.assign(base.meta.codex, (d.meta && d.meta.codex) || {});
      d.records = Object.assign(base.records, d.records || {});
      // v1/v2 → v3：把旧的 progress.cleared 并入 meta
      if (ver < 3) {
        const old = d.progress || {};
        if (old.cleared) d.meta.cleared = Object.assign({}, old.cleared, d.meta.cleared);
        if (old.best) d.meta.best = Object.assign({}, old.best, d.meta.best);
        delete d.progress;
        d.version = SAVE_VER;
        this.status = "migrated_" + ver;
      } else this.status = "loaded";
      this.data = d;
      this.persist();
    },
    persist() {
      try {
        const txt = JSON.stringify(this.data);
        STORE.set(SAVE_KEY, txt);
        STORE.set(SAVE_KEY + ".bak", txt);
      } catch (e) { this.status = "error"; }
    },
    get settings() { return this.data.settings; },
    get meta() { return this.data.meta; },
    get records() { return this.data.records; },
    resetProgress() {
      const s = this.data.settings;
      this.data = defaults();
      this.data.settings = s;
      this.persist();
    },
  };

  // ---------------------------------------------------------------- 成就 / 解锁
  const ACHIEVEMENTS = [
    { id: "a1", name: "第一次清关", desc: "完成任意关卡", check: (m) => Object.keys(m.cleared).length > 0 },
    { id: "a2", name: "连锁反应", desc: "单局连锁达到 10", check: (m) => (m.bestCombo || 0) >= 10 },
    { id: "a3", name: "章节通行", desc: "击败任意章节 Boss", check: (m) => (m.bestChapter || 0) >= 1 },
    { id: "a4", name: "破甲者", desc: "击败第二章 Boss", check: (m) => (m.bestChapter || 0) >= 2 },
    { id: "a5", name: "拆解专家", desc: "累计击碎 800 块砖", check: (m) => (m.totalBricks || 0) >= 800 },
    { id: "a6", name: "远征者", desc: "完成一次完整远征", check: (m) => (m.wins || 0) >= 1 },
    { id: "a7", name: "收藏家", desc: "图鉴收录 12 件遗物", check: (m) => (m.codex.relics || []).length >= 12 },
    { id: "a8", name: "无尽回响", desc: "无尽模式到达第 10 层", check: (m) => (m.endlessBest || 0) >= 10 },
    { id: "a9", name: "毫发无伤", desc: "整章不掉命通关", check: (m) => (m.noHitChapters || 0) >= 1 },
    { id: "a10", name: "拆墙工", desc: "累计击碎 3000 块砖", check: (m) => (m.totalBricks || 0) >= 3000 },
  ];

  const UNLOCKS = [
    { id: "p2", when: (m) => (m.bestChapter || 0) >= 1, label: "挡板：宽幅" },
    { id: "p3", when: (m) => (m.bestCombo || 0) >= 10, label: "挡板：轻量" },
    { id: "p4", when: (m) => (m.bestChapter || 0) >= 3, label: "挡板：磁轨" },
    { id: "p5", when: (m) => (m.totalBricks || 0) >= 800, label: "挡板：工程台" },
    { id: "p6", when: (m) => (m.noHitChapters || 0) >= 1, label: "挡板：玻璃炮" },
  ];

  const Meta = {
    sync() {
      const m = State.meta;
      m.achievements = m.achievements || [];
      for (const a of ACHIEVEMENTS) {
        if (!m.achievements.includes(a.id) && a.check(m)) {
          m.achievements.push(a.id);
          if (root.UIHooks) root.UIHooks.toast("成就达成：" + a.name);
        }
      }
      m.unlocks = m.unlocks || ["p1"];
      for (const u of UNLOCKS) {
        if (!m.unlocks.includes(u.id) && u.when(m)) {
          m.unlocks.push(u.id);
          if (root.UIHooks) root.UIHooks.toast("解锁 " + u.label);
        }
      }
      State.persist();
    },
    hasPaddle(id) { return (State.meta.unlocks || []).includes(id); },
    seeCodex(kind, id) {
      const c = State.meta.codex;
      if (!c[kind]) c[kind] = [];
      if (!c[kind].includes(id)) { c[kind].push(id); State.persist(); }
    },
    achievementList() {
      return ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, got: (State.meta.achievements || []).includes(a.id) }));
    },
  };

  // ---------------------------------------------------------------- 属性聚合
  const MULT_KEYS = { paddleSpeed: true };

  function addMods(target, mods) {
    if (!mods) return target;
    for (const k in mods) {
      const v = mods[k];
      if (typeof v === "boolean") { target[k] = target[k] || v; continue; }
      if (typeof v !== "number") continue;
      if (MULT_KEYS[k]) target[k] = (target[k] == null ? 1 : target[k]) * v;
      else target[k] = (target[k] || 0) + v;
    }
    return target;
  }

  // ---------------------------------------------------------------- 远征
  function nodeTypeFor(row, rng, chapterIdx) {
    const pool = row === 0 ? ["battle"] : ["battle", "battle", "elite", "shop", "event", "supply"];
    return rng.pick(pool);
  }

  // 每日挑战：同一天所有人同一份种子与规则；跨天自动刷新。
  const DAILY_RULES = [
    { id: "d0", name: "标准协议", desc: "无额外修正", mods: {} },
    { id: "d1", name: "高压球场", desc: "初始球速 +80，伤害 +0", mods: { startSpeed: 80, maxSpeed: 80 } },
    { id: "d2", name: "易碎结构", desc: "伤害 +1，但失去护盾", mods: { damage: 1, shieldCharges: -9 } },
    { id: "d3", name: "短手", desc: "挡板宽 -26，横移 +12%", mods: { paddleW: -26, paddleSpeed: 0.12 } },
    { id: "d4", name: "丰收", desc: "掉落率 +60%，初始 2 颗球", mods: { dropRate: 1.6, balls: 1 } },
    { id: "d5", name: "低重力", desc: "球速 -70，生命 -1", mods: { startSpeed: -70, maxSpeed: -70 } },
    { id: "d6", name: "暴走", desc: "暴击率 +20%，暴击伤害 +1", mods: { critChance: 0.2, critMult: 1 } },
  ];

  // 无尽模式：每层换一条场地规则。第 0 层固定标准场，
  // 之后按 seed 轮换，保证同一种子可复现、不同局又不会老是同一副牌。
  const ENDLESS_RULES = [
    { id: "n0", name: "标准场", desc: "无额外修正", mods: {} },
    { id: "n1", name: "超频", desc: "初始球速 +60，球速上限 +80", mods: { startSpeed: 60, maxSpeed: 80 } },
    { id: "n2", name: "窄带", desc: "挡板 -22，作为补偿伤害 +1", mods: { paddleW: -22, damage: 1 } },
    { id: "n3", name: "断援", desc: "本层不掉落物，碎片收益 +50%", mods: { goldBonus: 0.5 }, noDrops: true },
    { id: "n4", name: "静电场", desc: "每 5 秒自动放电，暴击率 -5%", mods: { storm: 5, critChance: -0.05 } },
  ];

  const Run = {
    current: null,


    dailyKey(d) {
      const dt = d || new Date();
      return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
    },

    dailyInfo(d) {
      const key = this.dailyKey(d);
      const seed = ((key * 2654435761) % 2147483647) >>> 0;
      const rule = DAILY_RULES[key % DAILY_RULES.length];
      const chapter = (Math.floor(key / 100) + key) % CT.CHAPTERS.length;
      return { key, seed, rule, chapter };
    },

    startDaily() {
      const info = this.dailyInfo();
      const r = this.start("daily", "p1", info.seed);
      r.chapters = [info.chapter];
      r.hp = 3; r.maxHp = 3;
      r.daily = { key: info.key, rule: info.rule.id };
      this.current = r;
      this.rollRoute(new BP.XRand(info.seed));
      return r;
    },

    start(mode, paddleId, seed) {
      const rng = new BP.XRand(seed || (Date.now() & 0x7fffffff));
      const chapters = [];
      if (mode === "classic") {
        for (let i = 0; i < CT.CHAPTERS.length; i++) chapters.push(i);
      } else if (mode === "endless") {
        chapters.push(0);
      } else if (mode === "daily") {
        chapters.push((seed || 0) % CT.CHAPTERS.length);
      } else {
        const pool = [0, 1, 2, 3, 4, 5];
        for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
        chapters.push(pool[0], pool[1], pool[2]);
        chapters.sort((a, b) => a - b);
      }
      const run = {
        mode, seed: seed || 0,
        paddleId: paddleId || "p1",
        chapters,
        chapterPos: 0,
        row: 0,
        hp: mode === "classic" ? 3 : 4,
        maxHp: mode === "classic" ? 3 : 4,
        gold: 0, xp: 0, level: 0,
        upgrades: [], relics: [], route: [],
        permanent: {},          // 事件给的永久属性
        clearedNodes: 0,
        startTime: Date.now(),
        endlessFloor: 0,
        tookDamage: false,
        xpNext: 5,
        taken: {},              // 本章已用关卡，避免重复
      };
      this.current = run;
      this.rollRoute(rng);
      return run;
    },

    chapterIdx() { return this.current ? this.current.chapters[this.current.chapterPos] : 0; },
    chapterDef() { return CT.CHAPTERS[this.chapterIdx()] || CT.CHAPTERS[0]; },

    // 当前层规则（只有无尽模式有；第 0 层固定标准场）
    endlessRule(floor) {
      const r = this.current;
      const f = floor == null ? (r ? r.endlessFloor : 0) : floor;
      if (f <= 0) return ENDLESS_RULES[0];
      const seed = r ? (r.seed || 0) : 0;
      const rest = ENDLESS_RULES.length - 1;
      return ENDLESS_RULES[1 + ((f + (seed % rest)) % rest)];
    },

    rollRoute(rng) {
      const r = this.current;
      r.route = [];
      r.row = 0;
      r.taken = {};
      const rows = r.mode === "endless" ? 4 : 4;
      for (let i = 0; i < rows; i++) {
        const opts = [];
        const n = i === rows - 1 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const rr = new BP.XRand(r.seed + i * 17 + k);
          let t = nodeTypeFor(i, rr, this.chapterIdx());
          if (k > 0 && t === opts[0]) t = opts[0] === "battle" ? "event" : "battle";
          opts.push(t);
        }
        r.route.push(opts);
      }
      r.route.push(["boss"]);
    },

    currentOptions() {
      const r = this.current;
      if (!r) return [];
      return r.route[r.row] || ["boss"];
    },

    choose(idx) {
      const r = this.current;
      const opts = this.currentOptions();
      const type = opts[Math.max(0, Math.min(opts.length - 1, idx))] || "battle";
      return { type, def: this.buildLevel(type), nodeIndex: r.row };
    },

    buildLevel(type) {
      const r = this.current;
      if (!r) return null;
      const ch = this.chapterIdx();
      const rng = new BP.XRand((r.seed + r.chapterPos * 977 + r.row * 131 + 7) | 0);
      if (type === "boss") {
        const boss = CT.BOSSES[ch] || CT.BOSSES[0];
        return {
          id: "boss_" + boss.id, name: boss.name, codename: boss.code,
          rows: [], speed: 500 + ch * 20, lives: 99, boss,
          chapter: "ch" + (ch + 1),
        };
      }
      const picks = CT.LEVELS.filter((l) => l.chapter === "ch" + (ch + 1));
      let idx = 0;
      if (type === "elite") idx = Math.min(picks.length - 1, 6 + (rng.int(0, 1)));
      else {
        idx = rng.int(0, Math.max(0, picks.length - 2));
        const key = ch + ":" + idx;
        if (r.taken[key]) idx = (idx + 1) % Math.max(1, picks.length - 1);
        r.taken[ch + ":" + idx] = true;
      }
      const base = picks[idx] || picks[0] || CT.LEVELS[0];
      const def = Object.assign({}, base);
      if (type === "elite") {
        def.id = "elite_" + base.id;
        def.name = "精英 · " + base.name;
        def.speed = base.speed + 55;
        def.lives = 99;
        def.elite = true;
      } else {
        def.lives = 99; // 生命由 run.hp 统一管理
      }
      if (r.mode === "endless") {
        const f = r.endlessFloor;
        def.speed = base.speed + f * 18;
        def.lives = 99;
      }
      return def;
    },

    // 属性：挡板 + 升级 + 遗物 + 协同 + 事件永久
    mods() {
      const r = this.current;
      const out = BP.defaultStats();
      if (!r) return out;
      const paddle = CT.PADDLES.find((p) => p.id === r.paddleId);
      if (paddle) addMods(out, paddle.mods);
      for (const id of r.upgrades) {
        const u = CT.UPGRADES.find((x) => x.id === id);
        if (u) addMods(out, u.mods);
      }
      for (const id of r.relics) {
        const it = CT.RELICS.find((x) => x.id === id);
        if (it) addMods(out, it.mods);
      }
      for (const s of this.activeSynergies()) addMods(out, s.mods);
      addMods(out, r.permanent);
      if (r.mode === "daily" && r.daily) {
        const rule = DAILY_RULES.find((x) => x.id === r.daily.rule);
        if (rule) addMods(out, rule.mods);
      }
      if (r.mode === "endless") addMods(out, this.endlessRule().mods);
      out.paddleW = Math.max(70, out.paddleW);
      out.maxSpeed = Math.min(1400, out.maxSpeed);
      return out;
    },

    activeSynergies() {
      const r = this.current;
      if (!r) return [];
      const owned = new Set(r.upgrades.concat(r.relics));
      return CT.SYNERGIES.filter((s) => s.need.every((n) => owned.has(n)));
    },

    hasFlag(flag) {
      const r = this.current;
      if (!r) return false;
      const ids = r.upgrades.concat(r.relics);
      return ids.some((id) => {
        const u = CT.UPGRADES.find((x) => x.id === id) || CT.RELICS.find((x) => x.id === id);
        return u && u.flag === flag;
      });
    },

    addUpgrade(id) {
      const r = this.current;
      if (!r || r.upgrades.includes(id)) return;
      r.upgrades.push(id);
      Meta.seeCodex("upgrades", id);
    },

    addRelic(id) {
      const r = this.current;
      if (!r || r.relics.includes(id)) return;
      r.relics.push(id);
      Meta.seeCodex("relics", id);
    },

    gainXp(n) {
      const r = this.current;
      if (!r) return 0;
      const mult = 1 + (this.mods().xpBonus || 0);
      r.xp += Math.round(n * mult);
      let ups = 0;
      while (r.xp >= r.xpNext) {
        r.xp -= r.xpNext;
        r.level++;
        r.xpNext = Math.round(r.xpNext * 1.26 + 3);
        ups++;
      }
      return ups;
    },

    rewardPool(arch) {
      const r = this.current;
      const owned = new Set(r.upgrades);
      let pool = CT.UPGRADES.filter((u) => !owned.has(u.id));
      if (arch) { const f = pool.filter((u) => u.arch === arch); if (f.length >= 3) pool = f; }
      return pool;
    },

    rollChoices(n, arch, rng) {
      const pool = this.rewardPool(arch).slice();
      const out = [];
      const r = rng || new BP.XRand(Date.now() & 0x7fffffff);
      while (out.length < n && pool.length) {
        const i = r.int(0, pool.length - 1);
        out.push(pool[i]);
        pool.splice(i, 1);
      }
      return out;
    },

    rollRelicChoices(n, rng) {
      const owned = new Set(this.current.relics);
      const pool = CT.RELICS.filter((x) => !owned.has(x.id));
      const out = [];
      const r = rng || new BP.XRand(Date.now() & 0x7fffffff);
      while (out.length < n && pool.length) {
        const i = r.int(0, pool.length - 1);
        out.push(pool[i]);
        pool.splice(i, 1);
      }
      return out;
    },

    // 结算一个普通/精英节点
    finishNode(win, summary) {
      const r = this.current;
      if (!r) return null;
      if (!win) return { end: true, reason: "defeat" };
      r.clearedNodes++;
      let gold = Math.round((18 + r.row * 6 + (r.route[r.row] && r.route[r.row][0] === "elite" ? 30 : 0)) * (1 + (this.mods().goldBonus || 0)));
      if (summary && summary.pickedGold) gold += summary.pickedGold;
      r.gold += gold;
      const ups = this.gainXp(6 + r.row * 3);
      State.meta.totalBricks += summary ? summary.bricks : 0;
      r.row++;
      if (r.row >= r.route.length) return { end: true, reason: "chapter" };
      return { end: false, gold, levelUps: ups };
    },

    // Boss 结算
    finishBoss(win, summary) {
      const r = this.current;
      if (!r) return null;
      if (!win) return { end: true, reason: "defeat" };
      Meta.seeCodex("bosses", (CT.BOSSES[this.chapterIdx()] || {}).id);
      State.meta.bestChapter = Math.max(State.meta.bestChapter || 0, r.chapterPos + 1);
      // 无伤章：整章没掉过命，才计入解锁「玻璃炮」的进度
      if (!r.tookDamage) State.meta.noHitChapters = (State.meta.noHitChapters || 0) + 1;
      r.tookDamage = false;
      r.gold += 60 + ((summary && summary.pickedGold) || 0);
      this.gainXp(20);
      if (r.mode === "endless") {
        r.endlessFloor++;
        State.meta.endlessBest = Math.max(State.meta.endlessBest || 0, r.endlessFloor);
        r.row = 0;
        r.route = [];
        this.rollRoute(new BP.XRand(r.seed + r.endlessFloor * 7919));
        r.hp = Math.min(r.maxHp, r.hp + 1);
        return { end: false, chapterClear: true, floor: r.endlessFloor };
      }
      r.chapterPos++;
      r.row = 0;
      if (r.chapterPos >= r.chapters.length) {
        State.meta.wins = (State.meta.wins || 0) + 1;
        return { end: true, reason: "victory" };
      }
      this.rollRoute(new BP.XRand(r.seed + r.chapterPos * 31));
      r.hp = Math.min(r.maxHp, r.hp + 1);
      return { end: false, chapterClear: true };
    },

    levelOfRun() {
      const r = this.current;
      return r ? r.chapters[r.chapterPos] : 0;
    },
  };

  // ---------------------------------------------------------------- 经典关卡链
  const Classic = {
    list() { return CT.LEVELS.slice(); },
    indexOf(id) { return CT.LEVELS.findIndex((l) => l.id === id); },
    next(id) { const i = this.indexOf(id); return i >= 0 && i + 1 < CT.LEVELS.length ? CT.LEVELS[i + 1] : null; },
    isUnlocked(id) {
      const i = this.indexOf(id);
      if (i <= 0) return true;
      const prev = CT.LEVELS[i - 1];
      return !!State.meta.cleared[prev.id];
    },
  };

  root.STATE = { State, Meta, Run, Classic, ACHIEVEMENTS, UNLOCKS, SAVE_KEY, SAVE_VER, addMods, defaults, DAILY_RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = root.STATE;
})(typeof globalThis !== "undefined" ? globalThis : this);
