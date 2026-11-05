/* BREAKOUT: 磷光纪元 — 界面、音频与主循环（完整流程） */
(function () {
  "use strict";
  const BP = window.BP, C = BP.C, PHASE = BP.PHASE;
  const CT = window.CONTENT;
  const ST = window.STATE;
  const State = ST.State, Meta = ST.Meta, Run = ST.Run, Classic = ST.Classic;
  const BP_PLATFORM = window.BP_PLATFORM || { kind: "web", isTouch: false, isMobile: false, vibrate() {}, toggleFullscreen() { return false; } };

  // ================================================================ 音频
  const Sfx = {
    ctx: null, sfxGain: null, musicGain: null, vol: { sfx: 0.8, music: 0.45 }, recent: {},
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.vol.sfx; this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.vol.music * 0.5; this.musicGain.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    },
    resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
    setVolumes(sfx, music) {
      this.vol.sfx = sfx; this.vol.music = music;
      if (this.sfxGain) this.sfxGain.gain.value = sfx;
      if (this.musicGain) this.musicGain.gain.value = music * 0.5;
    },
    tone(type, f0, f1, dur, gain, when) {
      const ctx = this.ctx, t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, gain, cut0, cut1, when) {
      const ctx = this.ctx, t = ctx.currentTime + (when || 0);
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass";
      f.frequency.setValueAtTime(cut0, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, cut1), t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(Math.max(0.0002, gain), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t); src.stop(t + dur + 0.02);
    },
    play(name, db, pitch) {
      if (!this.ctx) return;
      const now = performance.now();
      const arr = (this.recent[name] || []).filter((t) => now - t < 55);
      if (arr.length >= 4) { this.recent[name] = arr; return; }
      arr.push(now); this.recent[name] = arr;
      const g = Math.pow(10, (db || 0) / 20) * 0.55, p = pitch || 1;
      switch (name) {
        case "serve": this.tone("sine", 420 * p, 1120 * p, 0.18, g * 0.5); break;
        case "paddle": this.tone("sine", 250 * p, 190 * p, 0.09, g * 0.7); this.noise(0.05, g * 0.25, 4200, 900); break;
        case "wall": this.tone("square", 880 * p, 760 * p, 0.05, g * 0.16); break;
        case "brick": this.tone("sine", 1180 * p, 680 * p, 0.08, g * 0.36); this.noise(0.06, g * 0.2, 6000, 1200); break;
        case "break": this.noise(0.17, g * 0.5, 5200, 400); this.tone("sawtooth", 160 * p, 90 * p, 0.16, g * 0.22); break;
        case "tough": this.tone("sine", 1830 * p, 1500 * p, 0.1, g * 0.18); this.tone("sine", 2710 * p, 2400 * p, 0.08, g * 0.1); break;
        case "explode": this.noise(0.45, g * 0.75, 2400, 160); this.tone("sine", 78, 40, 0.4, g * 0.45); break;
        case "lifeLost": this.tone("triangle", 420, 55, 0.7, g * 0.5); break;
        case "clear": [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => this.tone("square", f, f, 0.35, g * 0.2, i * 0.1)); break;
        case "gameOver": [392, 349.23, 293.66, 220].forEach((f, i) => this.tone("triangle", f, f * 0.98, 0.5, g * 0.28, i * 0.16)); break;
        case "uiMove": this.tone("square", 1250, 1250, 0.04, g * 0.12); break;
        case "uiConfirm": this.tone("square", 660, 660, 0.06, g * 0.14); this.tone("square", 990, 990, 0.08, g * 0.12, 0.06); break;
        case "correct": this.tone("sine", 1320, 1300, 0.26, g * 0.14); break;
        case "laser": this.tone("sawtooth", 1400 * p, 300 * p, 0.12, g * 0.2); break;
        case "chain": this.tone("square", 900 * p, 1600 * p, 0.09, g * 0.12); break;
        case "freeze": this.tone("sine", 2200 * p, 900 * p, 0.18, g * 0.14); break;
        case "relic": [523.25, 783.99, 1046.5].forEach((f, i) => this.tone("sine", f, f, 0.4, g * 0.16, i * 0.08)); break;
        case "bossPhase": this.tone("sawtooth", 90, 40, 0.9, g * 0.3); this.noise(0.6, g * 0.3, 1200, 120); break;
      }
    },
  };
  window.Sfx = Sfx;

  const Music = {
    on: false, step: 0, next: 0, timer: null,
    prog: [[220, [440, 523.25, 659.25, 880]], [174.61, [349.23, 440, 523.25, 698.46]], [261.63, [523.25, 659.25, 783.99, 1046.5]], [196, [392, 493.88, 587.33, 783.99]]],
    start() {
      if (!Sfx.ctx || this.on) return;
      this.on = true; this.step = 0; this.next = Sfx.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 120);
    },
    stop() { this.on = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
    tick() {
      if (!this.on || !Sfx.ctx) return;
      const look = Sfx.ctx.currentTime + 0.5;
      while (this.next < look) {
        const bar = Math.floor(this.step / 8) % 4, chord = this.prog[bar];
        const pattern = [0, 2, 1, 3, 2, 0, 3, 1];
        this.note("triangle", chord[1][pattern[this.step % 8]], this.next, 0.55, 0.032);
        if (this.step % 8 === 0) {
          this.note("sine", chord[0] / 2, this.next, 1.6, 0.05);
          this.note("sine", chord[1][0] / 2, this.next, 2.2, 0.016);
        }
        this.next += 0.3; this.step = (this.step + 1) % 32;
      }
    },
    note(type, f, t, dur, gain) {
      const ctx = Sfx.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(Sfx.musicGain); o.start(t); o.stop(t + dur + 0.02);
    },
  };

  // ================================================================ 基础
  const stage = document.getElementById("stage");
  const screenEl = document.getElementById("screen");
  const hud = document.getElementById("hud");
  const toastEl = document.getElementById("toast");
  const crtEl = document.getElementById("crt");
  const view = new window.BPView.View(document.getElementById("game"));

  let state = "menu";
  let sim = null, battleCtx = null, scale = 1, acc = 0, last = 0;
  let settingsReturn = "menu", pendingPicks = [], lastSummary = null, inputMode = "mouse";
  let demoMode = false;

  function resize() {
    // 移动端用 visualViewport：地址栏收起/展开时不会把舞台顶出屏幕
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    const pad = BP_PLATFORM.isTouch ? 0.985 : 1;
    scale = Math.min(vw / C.W, vh / C.H) * pad;
    stage.style.transform = `scale(${scale})`;
    // 移动端画布按实际像素渲染，避免 1280 宽被缩小后发虚
    if (BP_PLATFORM.isTouch) view.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Math.min(1.6, 1 / Math.max(0.35, scale)));
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  resize();

  function applySettings() {
    const st = State.settings;
    view.settings.particles = st.particles;
    view.settings.shake = st.shake;
    view.settings.crt = st.crt;
    view.showDamage = !!st.damage_numbers;
    crtEl.style.opacity = st.crt === 0 ? "0" : st.crt === 1 ? "0.38" : "0.66";
    Sfx.setVolumes(st.sfx, st.music);
  }

  let toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), ms || 1800);
  }
  window.UIHooks = { toast };

  function setScreen(html, cls) {
    screenEl.innerHTML = `<div class="screen fade-in ${cls || ""}">${html}</div>`;
    return screenEl.firstElementChild;
  }

  // ------------------------------------------------ 公众号「字与码」关注卡片
  // 文案与站点 WechatQrCard 的 i18n 保持一致，二维码就是 zicode 站点那张。
  const GZH = {
    qr: "assets/gzh-qrcode.jpg",
    kicker: "微信公众号",
    title: "欢迎关注「字与码」",
    desc: "同步博客长文，也放更适合微信阅读的短评、复盘与工程实践记录。",
  };
  function followCardHTML() {
    return `<div class="follow-card">
      <img class="fc-qr" src="${GZH.qr}" alt="微信公众号「字与码」二维码" width="84" height="84" decoding="async">
      <div class="fc-copy">
        <div class="fc-kicker">${GZH.kicker}</div>
        <div class="fc-title">${GZH.title}</div>
        <div class="fc-desc">${GZH.desc}</div>
      </div>
    </div>`;
  }
  function followInlineHTML() {
    return `<div class="follow-inline">
      <img class="fc-qr" src="${GZH.qr}" alt="微信公众号「字与码」二维码" width="56" height="56" loading="lazy" decoding="async">
      <div class="fc-copy">
        <div class="fc-kicker">${GZH.kicker}</div>
        <div class="fc-title">字与码 · 更多长文与复盘</div>
        <div class="fc-desc">扫码关注，博客与公众号同步更新</div>
      </div>
    </div>`;
  }
  function hideHud() { hud.classList.add("hidden"); }
  function pad(n, w) { return String(n).padStart(w, "0"); }

  // ================================================================ 菜单
  function showMenu() {
    state = "menu"; sim = null; view.attach(null); hideHud();
    const m = State.meta;
    const root = setScreen(`
      <div class="title-wrap">
        <h1 class="game-title">BREAKOUT</h1>
        <div class="game-sub">磷 光 纪 元</div>
        <div class="game-code">PHOSPHOR ERA</div>
        <div class="rule"></div>
      </div>
      <div class="menu-btns">
        <button class="btn" id="b-play">开始游戏</button>
        <button class="btn" id="b-codex">图鉴 / 成就</button>
        <button class="btn" id="b-set">设置</button>
      </div>
      <div class="footer-note">${BP_PLATFORM.isTouch
        ? "拖动挡板　·　点击发球　·　横屏体验更佳"
        : "鼠标 / A D / ← → 　·　空格或左键发球　·　ESC 暂停"}</div>
      ${followCardHTML()}
      <div class="corner-note l">BUILD 0.6.0 · FULL · ${(BP_PLATFORM.kind || "web").toUpperCase()}</div>
      <div class="corner-note r">最高分 ${pad(m.bestScore || 0, 6)} · 击碎 ${m.totalBricks || 0} · 存档 ${State.status}</div>
    `);
    root.querySelector("#b-play").onclick = () => { Sfx.play("uiConfirm", -8); showModes(); };
    root.querySelector("#b-codex").onclick = () => { Sfx.play("uiMove", -8); showCodex(); };
    root.querySelector("#b-set").onclick = () => { Sfx.play("uiMove", -8); openSettings("menu"); };
    root.querySelector("#b-play").focus();
  }

  function showModes() {
    state = "modes";
    const m = State.meta;
    const root = setScreen(`
      <div class="page-head">
        <div class="page-kicker">SELECT MODE</div>
        <h2 class="page-title">选择模式</h2>
        <div class="page-sub">三种玩法共用同一套手感，构筑只在远征与无尽中生效</div>
      </div>
      <div class="page-line"></div>
      <div class="route-grid" style="position:absolute;left:72px;right:72px;top:272px">
        <div class="node-card" data-mode="classic">
          <div class="ntype" style="color:#7cffb2">CLASSIC</div>
          <div class="nname">经典模式</div>
          <div class="ndesc">6 章 48 个手工关卡，固定 3 条命，无局内构筑。<br>适合练习与刷纪录。</div>
          <div class="nfoot">已通关 ${Object.keys(m.cleared).length} / 48</div>
        </div>
        <div class="node-card" data-mode="expedition">
          <div class="ntype" style="color:#ffc46b">EXPEDITION</div>
          <div class="nname">远征模式</div>
          <div class="ndesc">随机 3 章路线，战斗 / 精英 / 商店 / 事件 / Boss。<br>局内三选一构筑，死亡后保留解锁。</div>
          <div class="nfoot">已完成 ${m.wins || 0} 次</div>
        </div>
        <div class="node-card" data-mode="endless">
          <div class="ntype" style="color:#b39cff">ENDLESS</div>
          <div class="nname">无尽挑战</div>
          <div class="ndesc">每层强化同一章，层数递增、规则收紧。<br>记录最高层数，固定种子可复现。</div>
          <div class="nfoot">最高 ${m.endlessBest || 0} 层</div>
        </div>
        <div class="node-card" data-mode="daily" style="border-color:rgba(255,196,107,0.45)">
          <div class="ntype" style="color:#ffc46b">DAILY · ${Run.dailyInfo().key}</div>
          <div class="nname">每日挑战</div>
          <div class="ndesc">${Run.dailyInfo().rule.name}：${Run.dailyInfo().rule.desc}<br>当天固定种子，所有人的牌一样。</div>
          <div class="nfoot">今日最佳 ${(m.daily && m.daily.key === Run.dailyInfo().key && m.daily.best) || 0}</div>
        </div>
      </div>
      <button class="btn ghost" id="b-back" style="position:absolute;left:72px;top:520px;width:140px">返回</button>
    `);
    root.querySelectorAll(".node-card").forEach((el) => {
      el.onclick = () => {
        Sfx.play("uiConfirm", -8);
        if (el.dataset.mode === "classic") showClassicSelect(0);
        else if (el.dataset.mode === "daily") { Run.startDaily(); showRoute(); }
        else showPaddleSelect(el.dataset.mode);
      };
    });
    root.querySelector("#b-back").onclick = () => showMenu();
  }

  // ================================================================ 经典选关
  let classicChapter = 0;
  function showClassicSelect(ch) {
    state = "classic";
    if (ch != null) classicChapter = ch;
    const lvls = CT.LEVELS.filter((l) => l.chapter === CT.CHAPTERS[classicChapter].id);
    const cards = lvls.map((lv) => {
      const cleared = !!State.meta.cleared[lv.id];
      const unlocked = Classic.isUnlocked(lv.id);
      const rows = lv.rows.map((row) =>
        `<div class="pv-row">` + row.split("").map((c) => {
          const t = BP.LEGEND[c];
          return `<span style="background:${t ? BP.TYPE_COLOR[t] : "transparent"};opacity:${t === "solid" ? 0.28 : 0.6}"></span>`;
        }).join("") + `</div>`).join("");
      return `<div class="card ${unlocked ? "" : "locked"} ${cleared ? "cleared" : ""}" data-id="${lv.id}">
        <div class="idx">${pad(lv.index, 2)}</div>
        <div class="status">${unlocked ? (cleared ? "CLEARED" : "可挑战") : "LOCKED"}</div>
        <div class="name">${lv.name}</div>
        <div class="code">${lv.codename}</div>
        <div class="preview">${rows}</div>
        <div class="best">最佳 ${State.meta.best[lv.id] || "—"}</div>
      </div>`;
    }).join("");
    const tabs = CT.CHAPTERS.map((c, i) =>
      `<div class="tab ${i === classicChapter ? "on" : ""}" data-ch="${i}">第${["一", "二", "三", "四", "五", "六"][i]}章 ${c.name}</div>`).join("");
    const root = setScreen(`
      <div class="page-head">
        <div class="page-kicker">CLASSIC · 48 STAGES</div>
        <h2 class="page-title">经典模式</h2>
        <div class="page-sub">${CT.CHAPTERS[classicChapter].name} · ${CT.CHAPTERS[classicChapter].brief}</div>
      </div>
      <div class="page-line"></div>
      <div class="tabs" style="position:absolute;left:72px;top:240px">${tabs}</div>
      <div class="cards four" style="top:292px">${cards}</div>
      <button class="btn ghost" id="b-back" style="position:absolute;left:72px;top:620px;width:140px">返回</button>
      <div style="position:absolute;left:232px;top:634px;font-size:12px;color:#6f8f84">完成前一关后解锁下一关</div>
    `);
    root.querySelectorAll(".tab").forEach((t) => t.onclick = () => showClassicSelect(Number(t.dataset.ch)));
    root.querySelectorAll(".card").forEach((el) => {
      el.onclick = () => {
        if (el.classList.contains("locked")) { Sfx.play("uiMove", -14); return; }
        Sfx.play("uiConfirm", -8);
        const lv = CT.LEVELS.find((l) => l.id === el.dataset.id);
        startBattle(lv, { mode: "classic" });
      };
    });
    root.querySelector("#b-back").onclick = () => showModes();
  }

  // ================================================================ 选挡板
  function showPaddleSelect(mode) {
    state = "paddle";
    const list = CT.PADDLES.map((p) => {
      const ok = Meta.hasPaddle(p.id);
      return `<div class="pick-card ${ok ? "" : "locked"}" data-id="${p.id}" style="${ok ? "" : "opacity:.4;cursor:not-allowed"}">
        <div class="arch" style="color:#7fd8ff">${p.code}</div>
        <div class="pname">${p.name}</div>
        <div class="pdesc">${p.desc}</div>
        <div class="pfoot">${ok ? "可用" : "解锁：" + p.unlock}</div>
      </div>`;
    }).join("");
    const root = setScreen(`
      <div class="page-head">
        <div class="page-kicker">${mode === "endless" ? "ENDLESS" : "EXPEDITION"} · PADDLE</div>
        <h2 class="page-title">选择挡板</h2>
        <div class="page-sub">挡板决定基础手感，优势与代价同时存在</div>
      </div>
      <div class="page-line"></div>
      <div class="pick-grid" style="position:absolute;left:72px;right:72px;top:282px">${list}</div>
      <button class="btn ghost" id="b-back" style="position:absolute;left:72px;top:540px;width:140px">返回</button>
    `);
    root.querySelectorAll(".pick-card").forEach((el) => {
      el.onclick = () => {
        if (el.classList.contains("locked")) { Sfx.play("uiMove", -14); return; }
        Sfx.play("uiConfirm", -8);
        Run.start(mode, el.dataset.id, mode === "endless" ? (Date.now() & 0xffff) : 0);
        State.meta.runs = (State.meta.runs || 0) + 1;
        State.persist();
        showRoute();
      };
    });
    root.querySelector("#b-back").onclick = () => showModes();
  }

  // ================================================================ 路线
  function showRoute() {
    const r = Run.current;
    if (!r) return showModes();
    state = "route"; hideHud(); sim = null; view.attach(null);
    const opts = Run.currentOptions();
    const ch = Run.chapterDef();
    const steps = r.route.map((_, i) =>
      `<div class="step ${i < r.row ? "done" : i === r.row ? "now" : ""}"></div>`).join("");
    const cards = opts.map((t, i) => {
      const nt = CT.NODE_TYPES[t];
      const desc = {
        battle: "清空砖阵。掉落经验与碎片。",
        elite: "强化砖阵，球速更高。通关额外掉落遗物。",
        shop: "用碎片购买升级、遗物或补给。",
        event: "结果未知，收益与代价并存。",
        supply: "恢复生命或补充护盾。",
        boss: "章节 Boss，带有独立阶段与弱点窗口。",
      }[t] || "";
      return `<div class="node-card ${t === "boss" ? "boss" : ""}" data-i="${i}">
        <div class="ntype" style="color:${nt.color}">${nt.code}</div>
        <div class="nname">${nt.name}</div>
        <div class="ndesc">${desc}</div>
        <div class="nfoot">点击进入</div>
      </div>`;
    }).join("");
    const root = setScreen(`
      <div class="route-wrap">
        <div class="route-head">
          <div>
            <div class="page-kicker">${r.mode === "endless"
              ? "ENDLESS · FLOOR " + (r.endlessFloor + 1)
              : r.mode === "daily" ? "DAILY · " + Run.dailyInfo().key : "EXPEDITION"}</div>
            <h2 class="route-title">第${["一", "二", "三", "四", "五", "六"][Run.chapterIdx()]}章 · ${ch.name}</h2>
            <div class="page-sub">${ch.brief}</div>
            ${r.mode === "daily" ? `<div class="page-sub" style="color:#ffc46b;margin-top:4px">今日规则 · ${Run.dailyInfo().rule.name}：${Run.dailyInfo().rule.desc}</div>` : ""}
          </div>
          <div class="route-meta">
            生命 ${r.hp} / ${r.maxHp}　碎片 ${r.gold}<br>
            等级 ${r.level + 1}　经验 ${r.xp} / ${r.xpNext}<br>
            升级 ${r.upgrades.length}　遗物 ${r.relics.length}
          </div>
        </div>
        <div class="route-steps">${steps}</div>
        <div class="route-grid">${cards}</div>
        <div class="route-map">${r.route.map((row, i) => {
          const t = row[0] === "boss" ? "boss" : (i < r.row ? "done" : i === r.row ? "now" : "next");
          const nt = r.route[i][0] === "boss" ? CT.NODE_TYPES.boss : (i < r.row ? { name: "已通过" } : { name: i === r.row ? "当前" : "未知" });
          const label = i === r.row ? "当前选择" : (i < r.row ? "已通过" : "第 " + (i + 1) + " 层");
          return `<div class="rm ${t}"><b>${i + 1}</b><span>${label}</span></div>`;
        }).join("")}</div>
        <div class="route-tip">这一层只能选一个节点 · 第 ${r.row + 1} / ${r.route.length} 层 · 剩余生命 ${r.hp}</div>
        <button class="btn ghost" id="b-build" style="position:absolute;left:72px;bottom:36px;width:150px">查看构筑</button>
        <button class="btn ghost" id="b-quit" style="position:absolute;left:236px;bottom:36px;width:150px">放弃远征</button>
      </div>
    `);
    root.querySelectorAll(".node-card").forEach((el) => {
      el.onclick = () => { Sfx.play("uiConfirm", -8); enterNode(opts[Number(el.dataset.i)]); };
    });
    root.querySelector("#b-build").onclick = showBuild;
    root.querySelector("#b-quit").onclick = () => { Run.current = null; showMenu(); };
  }

  function enterNode(type) {
    if (type === "shop") return showShop();
    if (type === "event") return showEvent();
    if (type === "supply") return showSupply();
    startBattle(Run.buildLevel(type), { mode: Run.current.mode, nodeType: type });
  }

  // ================================================================ 战斗
  function startBattle(def, opts) {
    if (!def) return;
    battleCtx = Object.assign({ mode: "classic", nodeType: "battle" }, opts || {});
    const r = Run.current;
    sim = new BP.Sim();
    sim.setMods(r ? Run.mods() : BP.defaultStats());
    sim.dropsEnabled = State.settings.drops !== false;
    const d = Object.assign({ legend: BP.LEGEND }, def);
    if (battleCtx.mode !== "classic") d.lives = 99;
    sim.setup(d, r ? (r.seed + r.row * 131 + r.chapterPos * 977) : (Date.now() & 0xffff));
    if (r) sim.lives = r.hp;
    if (def.boss) { sim.boss = new BP.Boss(def.boss, (r ? r.seed : 7) + 13); sim.boss.spawn(sim); }
    view.attach(sim);
    sim.on("cleared", (s) => onBattleWin(s));
    sim.on("failed", (s) => onBattleLose(s));
    sim.on("bossPhase", (i, name) => { toast("Boss 阶段：" + name, 2200); Sfx.play("bossPhase", -3); });
    sim.on("bossWindow", (txt) => { toast(txt, 1600); Sfx.play("correct", -6); });
    sim.on("invuln", () => {
      if (!sim._invulnToast || sim.time - sim._invulnToast > 3) { sim._invulnToast = sim.time; toast("护甲保护中：先破坏外围", 1400); }
    });
    sim.on("lifeLost", () => { if (r) r.hp = Math.max(0, r.hp - 1); });
    screenEl.innerHTML = "";
    hud.classList.remove("hidden");
    document.getElementById("bossbar").classList.toggle("hidden", !def.boss);
    if (def.boss) document.getElementById("boss-name").textContent = def.boss.name;
    state = "play"; acc = 0;
    autoPausedBy = null;
    resetMouseAnchor();
    updateHudStatic(def);
    updateHud();
    Sfx.resume(); Music.start();
  }

  function onBattleWin(summary) {
    lastSummary = summary;
    state = "result";
    if (battleCtx.mode === "classic") {
      State.meta.cleared[summary.level_id] = { score: summary.score, time: summary.time, combo: summary.max_combo };
      State.meta.best[summary.level_id] = Math.max(State.meta.best[summary.level_id] || 0, summary.score);
      State.meta.bestScore = Math.max(State.meta.bestScore || 0, summary.score);
      State.meta.bestCombo = Math.max(State.meta.bestCombo || 0, summary.max_combo);
      State.meta.codex.levels = State.meta.codex.levels || [];
      if (!State.meta.codex.levels.includes(summary.level_id)) State.meta.codex.levels.push(summary.level_id);
      Meta.sync();
      setTimeout(() => showClassicResult(true), 1000);
      return;
    }
    const r = Run.current;
    if (!r) { showMenu(); return; }
    r.hp = Math.max(1, sim.lives);
    if (r.mode === "daily") {
      const key = Run.dailyInfo().key;
      if (!State.meta.daily || State.meta.daily.key !== key) State.meta.daily = { key: key, best: 0 };
      State.meta.daily.best = Math.max(State.meta.daily.best || 0, summary.score);
    }
    pendingPicks = [];
    let res;
    if (battleCtx.nodeType === "boss") {
      res = Run.finishBoss(true, summary);
      pendingPicks.push({ kind: "relic" });
    } else {
      res = Run.finishNode(true, summary);
      if (battleCtx.nodeType === "elite") pendingPicks.push({ kind: "relic" });
      for (let i = 0; i < (res.levelUps || 0); i++) pendingPicks.push({ kind: "upgrade" });
    }
    Meta.sync();
    if (res.end) { setTimeout(() => showRunEnd(res.reason === "victory"), 1100); return; }
    setTimeout(() => nextPickOrRoute(), 1000);
  }

  function onBattleLose(summary) {
    lastSummary = summary;
    state = "result";
    if (battleCtx.mode === "classic") setTimeout(() => showClassicResult(false), 900);
    else { if (Run.current) Run.current.hp = 0; setTimeout(() => showRunEnd(false), 900); }
    Sfx.play("gameOver", -3);
  }

  function nextPickOrRoute() {
    if (!pendingPicks.length) { showRoute(); return; }
    const p = pendingPicks.shift();
    if (p.kind === "relic") showRelicPick();
    else showUpgradePick(p.arch);
  }

  // ================================================================ 三选一
  function showUpgradePick(arch) {
    state = "pick";
    const choices = Run.rollChoices(3, arch);
    const cards = choices.map((u, i) => `
      <div class="pick-card" data-i="${i}">
        <div class="arch" style="color:${CT.ARCH[u.arch].color}">${CT.ARCH[u.arch].name}</div>
        <div class="pname">${u.name}</div>
        <div class="pdesc">${u.desc}</div>
        <div class="pfoot">已拥有 ${Run.current.upgrades.length} 项</div>
      </div>`).join("");
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:860px">
        <h2>选择升级</h2>
        <div class="sub">LEVEL UP · 三选一 · 已拥有 ${Run.current.upgrades.length} 项</div>
        <div class="pick-grid">${cards || '<div class="evt-text">升级已全部拿完，转换为 40 碎片。</div>'}</div>
      </div>
    `);
    root.querySelectorAll(".pick-card").forEach((el) => {
      el.onclick = () => {
        const u = choices[Number(el.dataset.i)];
        if (u) { Run.addUpgrade(u.id); toast("获得：" + u.name, 1600); Sfx.play("relic", -8); }
        else Run.current.gold += 40;
        State.persist();
        nextPickOrRoute();
      };
    });
    if (!choices.length) setTimeout(() => { Run.current.gold += 40; nextPickOrRoute(); }, 900);
  }

  function showRelicPick() {
    state = "pick";
    const choices = Run.rollRelicChoices(3);
    const cards = choices.map((u, i) => `
      <div class="pick-card" data-i="${i}">
        <div class="arch" style="color:#ffc46b">RELIC · ${u.rarity}</div>
        <div class="pname">${u.name}</div>
        <div class="pdesc">${u.desc}</div>
        <div class="pfoot">已拥有 ${Run.current.relics.length} 件</div>
      </div>`).join("");
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:860px">
        <h2>选择遗物</h2>
        <div class="sub">RELIC · 永久生效 · 已拥有 ${Run.current.relics.length} 件</div>
        <div class="pick-grid">${cards || '<div class="evt-text">遗物已收集完毕。</div>'}</div>
      </div>
    `);
    root.querySelectorAll(".pick-card").forEach((el) => {
      el.onclick = () => {
        const u = choices[Number(el.dataset.i)];
        if (u) { Run.addRelic(u.id); toast("获得遗物：" + u.name, 1800); Sfx.play("relic", -6); }
        State.persist();
        nextPickOrRoute();
      };
    });
  }

  // ================================================================ 商店 / 补给 / 事件
  function showShop() {
    state = "shop";
    const r = Run.current;
    if (!r._shop || r._shop.row !== r.row) {
      const rng = new BP.XRand((r.seed + r.row * 71) | 0);
      const ups = Run.rollChoices(2, null, rng);
      const rel = Run.rollRelicChoices(1, rng);
      r._shop = { row: r.row, items: [
        ...ups.map((u) => ({ kind: "upgrade", id: u.id, name: u.name, desc: u.desc, price: 70 })),
        ...rel.map((u) => ({ kind: "relic", id: u.id, name: u.name, desc: u.desc, price: 95 })),
        { kind: "heal", name: "应急修复", desc: "恢复 1 点生命", price: 55 },
      ] };
    }
    const items = r._shop.items.map((it, i) => `
      <div class="offer-row">
        <div class="oname">${it.name}<div class="odesc">${it.desc}</div></div>
        <button class="btn ghost" data-i="${i}" ${r.gold < it.price ? "disabled" : ""}>${it.price} 碎片</button>
      </div>`).join("");
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:720px">
        <h2>商店</h2>
        <div class="sub">SHOP · 弹药与零件</div>
        <div class="gold-line">持有碎片：${r.gold}</div>
        ${items || '<div class="evt-text">货架空了。</div>'}
        <div class="btns"><button class="btn" id="b-leave">离开</button></div>
      </div>
    `);
    root.querySelectorAll(".offer-row button").forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.dataset.i);
        const it = r._shop.items[idx];
        if (!it || r.gold < it.price) return;
        r.gold -= it.price;
        if (it.kind === "upgrade") Run.addUpgrade(it.id);
        else if (it.kind === "relic") Run.addRelic(it.id);
        else r.hp = Math.min(r.maxHp, r.hp + 1);
        r._shop.items.splice(idx, 1);
        Sfx.play("relic", -8); State.persist(); showShop();
      };
    });
    root.querySelector("#b-leave").onclick = () => { Run.finishNode(true, lastSummary || { bricks: 0 }); nextPickOrRoute(); };
  }

  function showSupply() {
    state = "supply";
    const r = Run.current;
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:560px">
        <h2>补给站</h2>
        <div class="sub">SUPPLY · 只能选择一项</div>
        <div class="evt-text">自动维修臂还能工作，但能量只够做一件事。</div>
        <button class="evt-opt" id="o1">修复机体：恢复 1 点生命</button>
        <button class="evt-opt" id="o2">加装护板：获得 2 层护盾</button>
      </div>
    `);
    root.querySelector("#o1").onclick = () => { r.hp = Math.min(r.maxHp, r.hp + 1); r.gold += 10; Run.finishNode(true, lastSummary || { bricks: 0 }); nextPickOrRoute(); };
    root.querySelector("#o2").onclick = () => { r.permanent.shieldCharges = (r.permanent.shieldCharges || 0) + 2; r.gold += 10; Run.finishNode(true, lastSummary || { bricks: 0 }); nextPickOrRoute(); };
  }

  function showEvent() {
    state = "event";
    const r = Run.current;
    const ev = CT.EVENTS[new BP.XRand((r.seed + r.row * 37) | 0).int(0, CT.EVENTS.length - 1)];
    const opts = ev.options.map((o, i) => `<button class="evt-opt" data-i="${i}">${o.label}</button>`).join("");
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:680px">
        <h2>${ev.name}</h2>
        <div class="sub">EVENT</div>
        <div class="evt-text">${ev.text}</div>
        ${opts}
      </div>
    `);
    root.querySelectorAll(".evt-opt").forEach((b) => {
      b.onclick = () => {
        applyEvent(r, ev.options[Number(b.dataset.i)].effect);
        Run.finishNode(true, lastSummary || { bricks: 0 });
        nextPickOrRoute();
      };
    });
  }

  function applyEvent(r, effect) {
    for (const part of String(effect).split(",")) {
      const seg = part.split(":");
      const k = seg[0], a = seg[1], b = seg[2];
      if (k === "gold") r.gold += Number(a);
      else if (k === "heal") r.hp = Math.min(r.maxHp, r.hp + Number(a));
      else if (k === "hurt") r.hp = Math.max(0, r.hp - Number(a));
      else if (k === "xp") Run.gainXp(Number(a));
      else if (k === "shield") r.permanent.shieldCharges = (r.permanent.shieldCharges || 0) + Number(a);
      else if (k === "maxlife") { r.maxHp += Number(a); r.hp += Number(a); }
      else if (k === "upgrade") pendingPicks.push({ kind: "upgrade", arch: a });
      else if (k === "upgradex2") { pendingPicks.push({ kind: "upgrade" }); pendingPicks.push({ kind: "upgrade" }); }
      else if (k === "perm") r.permanent[a || "damage"] = (r.permanent[a || "damage"] || 0) + Number(b);
      else if (k === "buyrelic") { if (r.gold >= Number(a)) { r.gold -= Number(a); pendingPicks.push({ kind: "relic" }); } }
      else if (k === "skip") r.row++;
      else if (k === "risk") r.permanent.startSpeed = (r.permanent.startSpeed || 0) + 60;
      else if (k === "healpay") { if (r.gold >= Number(b)) { r.gold -= Number(b); r.hp = Math.min(r.maxHp, r.hp + Number(a)); } }
    }
    State.persist();
  }

  // ================================================================ 构筑
  function showBuild() {
    const r = Run.current;
    if (!r) return;
    const ups = r.upgrades.map((id) => CT.UPGRADES.find((u) => u.id === id)).filter(Boolean);
    const rel = r.relics.map((id) => CT.RELICS.find((u) => u.id === id)).filter(Boolean);
    const syn = Run.activeSynergies();
    const mods = Run.mods();
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:840px">
        <h2>本局构筑</h2>
        <div class="sub">BUILD · 伤害 ${mods.damage}　暴击 ${Math.round(mods.critChance * 100)}%　挡板 ${mods.paddleW}　额外球 ${mods.balls - 1}</div>
        <div class="codex-grid">
          ${ups.length ? ups.map((u) => `<div class="codex-item"><b>${u.name}</b><span>${u.desc}</span></div>`).join("") : "<div class='codex-item locked'>还没有升级</div>"}
          ${rel.map((u) => `<div class="codex-item" style="border-color:#ffc46b"><b>遗物 · ${u.name}</b><span>${u.desc}</span></div>`).join("")}
          ${syn.map((s) => `<div class="codex-item" style="border-color:#b39cff"><b>协同 · ${s.name}</b><span>${s.desc}</span></div>`).join("")}
        </div>
        <div class="btns"><button class="btn" id="b-back">返回</button></div>
      </div>
    `);
    root.querySelector("#b-back").onclick = () => { if (state === "paused") showPause(); else showRoute(); };
  }

  // ================================================================ 结算
  function showClassicResult(win) {
    const s = lastSummary || {};
    const lv = CT.LEVELS.find((l) => l.id === s.level_id) || { name: "", codename: "", chapter: "ch1" };
    const next = win ? Classic.next(s.level_id) : null;
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel ${win ? "win" : "lose"}">
        <h2>${win ? "清关" : "信号丢失"}</h2>
        <div class="sub">${win ? "LEVEL CLEARED" : "RUN TERMINATED"} · ${lv.codename || ""}</div>
        <div class="sep"></div>
        <div class="stat"><span>关卡</span><b>${lv.name}</b></div>
        <div class="stat"><span>得分</span><b>${pad(s.score || 0, 6)}</b></div>
        <div class="stat"><span>用时</span><b>${(s.time || 0).toFixed(1)} s</b></div>
        <div class="stat"><span>击碎 / 命中</span><b>${s.bricks || 0} / ${s.hits || 0}</b></div>
        <div class="stat"><span>最高连锁</span><b>×${s.max_combo || 0}</b></div>
        <div class="btns">
          <button class="btn ghost" id="b-retry">重试</button>
          ${next ? '<button class="btn ghost" id="b-next">下一关</button>' : ""}
          <button class="btn ghost" id="b-levels">返回选关</button>
        </div>
      </div>
    `);
    root.querySelector("#b-retry").onclick = () => startBattle(CT.LEVELS.find((l) => l.id === s.level_id), { mode: "classic" });
    if (next) root.querySelector("#b-next").onclick = () => startBattle(next, { mode: "classic" });
    root.querySelector("#b-levels").onclick = () => showClassicSelect(CT.CHAPTERS.findIndex((c) => c.id === lv.chapter));
  }

  function showRunEnd(win) {
    const r = Run.current;
    const s = lastSummary || {};
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel ${win ? "win" : "lose"}" style="width:640px">
        <h2>${win ? "远征完成" : "远征中断"}</h2>
        <div class="sub">${win ? "RUN COMPLETE" : "RUN FAILED"} · ${r ? (r.mode === "endless" ? "无尽第 " + (r.endlessFloor + 1) + " 层" : "第 " + (r.chapterPos + 1) + " 章") : ""}</div>
        <div class="sep"></div>
        ${r ? `
        <div class="stat"><span>等级 / 经验</span><b>${r.level + 1} · ${r.xp}/${r.xpNext}</b></div>
        <div class="stat"><span>升级 / 遗物</span><b>${r.upgrades.length} / ${r.relics.length}</b></div>
        <div class="stat"><span>碎片</span><b>${r.gold}</b></div>` : ""}
        <div class="stat"><span>本局得分</span><b>${pad(s.score || 0, 6)}</b></div>
        <div class="stat"><span>最高连锁</span><b>×${Math.max(s.max_combo || 0, State.meta.bestCombo || 0)}</b></div>
        <div class="btns">
          <button class="btn ghost" id="b-again">再来一次</button>
          <button class="btn ghost" id="b-menu">返回主菜单</button>
        </div>
        ${followInlineHTML()}
      </div>
    `);
    root.querySelector("#b-again").onclick = () => { Run.current = null; showModes(); };
    root.querySelector("#b-menu").onclick = () => { Run.current = null; showMenu(); };
    Run.current = null;
    Meta.sync();
  }

  // ================================================================ 图鉴
  let codexTab = "levels";
  function showCodex(tab) {
    state = "codex";
    if (tab) codexTab = tab;
    const m = State.meta;
    const tabs = [["levels", "关卡"], ["upgrades", "升级"], ["relics", "遗物"], ["bosses", "Boss"], ["ach", "成就"]]
      .map(([k, n]) => `<div class="tab ${codexTab === k ? "on" : ""}" data-k="${k}">${n}</div>`).join("");
    let items = "";
    if (codexTab === "levels") {
      items = CT.LEVELS.map((l) => {
        const seen = (m.codex.levels || []).includes(l.id) || !!m.cleared[l.id];
        return `<div class="codex-item ${seen ? "" : "locked"}"><b>${l.chapter.slice(2)}-${pad(l.index, 2)} ${seen ? l.name : "???"}</b><span>${seen ? l.teach : "未发现"}</span></div>`;
      }).join("");
    } else if (codexTab === "upgrades") {
      items = CT.UPGRADES.map((u) => {
        const seen = (m.codex.upgrades || []).includes(u.id);
        return `<div class="codex-item ${seen ? "" : "locked"}"><b>${seen ? u.name : "???"}</b><span>${seen ? u.desc : CT.ARCH[u.arch].name}</span></div>`;
      }).join("");
    } else if (codexTab === "relics") {
      items = CT.RELICS.map((u) => {
        const seen = (m.codex.relics || []).includes(u.id);
        return `<div class="codex-item ${seen ? "" : "locked"}"><b>${seen ? u.name : "???"}</b><span>${seen ? u.desc : "未发现"}</span></div>`;
      }).join("");
    } else if (codexTab === "bosses") {
      items = CT.BOSSES.map((b) => {
        const seen = (m.codex.bosses || []).includes(b.id);
        return `<div class="codex-item ${seen ? "" : "locked"}"><b>${seen ? b.name : "???"}</b><span>${seen ? b.brief : "未遭遇"}</span></div>`;
      }).join("");
    } else {
      items = Meta.achievementList().map((a) =>
        `<div class="codex-item ${a.got ? "" : "locked"}"><b>${a.got ? "✔ " : ""}${a.name}</b><span>${a.desc}</span></div>`).join("");
    }
    const total = (m.codex.levels || []).length + (m.codex.upgrades || []).length + (m.codex.relics || []).length;
    const root = setScreen(`
      <div class="page-head">
        <div class="page-kicker">ARCHIVE</div>
        <h2 class="page-title">图鉴 / 成就</h2>
        <div class="page-sub">已收录 ${total} 条 · 成就 ${(m.achievements || []).length} / 8</div>
      </div>
      <div class="page-line"></div>
      <div class="tabs" style="position:absolute;left:72px;top:240px">${tabs}</div>
      <div class="codex-grid" style="position:absolute;left:72px;right:72px;top:290px">${items}</div>
      <button class="btn ghost" id="b-back" style="position:absolute;left:72px;bottom:34px;width:140px">返回</button>
    `);
    root.querySelectorAll(".tab").forEach((t) => t.onclick = () => showCodex(t.dataset.k));
    root.querySelector("#b-back").onclick = () => showMenu();
  }

  // ================================================================ 设置
  function openSettings(from) {
    settingsReturn = from;
    const st = State.settings;
    const spec = [
      ["扫描线 / CRT", ["关", "轻", "重"], () => st.crt, (i) => (st.crt = i)],
      ["屏幕抖动", ["关", "30%", "60%", "100%"], () => [0, 0.3, 0.6, 1].indexOf(nearest([0, 0.3, 0.6, 1], st.shake)), (i) => (st.shake = [0, 0.3, 0.6, 1][i])],
      ["粒子密度", ["关", "50%", "100%"], () => [0, 0.5, 1].indexOf(nearest([0, 0.5, 1], st.particles)), (i) => (st.particles = [0, 0.5, 1][i])],
      ["伤害数字", ["关", "开"], () => (st.damage_numbers ? 1 : 0), (i) => (st.damage_numbers = i === 1)],
      ["残响引导", ["关", "开"], () => (st.echo_assist ? 1 : 0), (i) => (st.echo_assist = i === 1)],
      ["鼠标移出暂停", ["关", "开"], () => (st.pause_on_leave ? 1 : 0), (i) => (st.pause_on_leave = i === 1)],
      ["回来自动继续", ["关", "开"], () => (st.auto_resume ? 1 : 0), (i) => (st.auto_resume = i === 1)],
      ["指针锁定", ["关", "开"], () => (st.pointer_lock ? 1 : 0), (i) => (st.pointer_lock = i === 1)],
      ["砖块掉落", ["关", "开"], () => (st.drops ? 1 : 0), (i) => (st.drops = i === 1)],
      ["音乐音量", [...Array(11)].map((_, i) => i * 10 + "%"), () => Math.round(st.music * 10), (i) => (st.music = i / 10)],
      ["音效音量", [...Array(11)].map((_, i) => i * 10 + "%"), () => Math.round(st.sfx * 10), (i) => (st.sfx = i / 10)],
      ["显示帧率", ["关", "开"], () => (st.show_fps ? 1 : 0), (i) => (st.show_fps = i === 1)],
    ];
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="width:800px">
        <h2>设置</h2>
        <div class="sub">SETTINGS · 即时生效并写入本地存档</div>
        <div class="sep"></div>
        <div class="grid2" id="setgrid"></div>
        <div class="sep"></div>
        <div class="set-row"><label>存档 · 已通关 ${Object.keys(State.meta.cleared).length} / 48</label>
          <button id="b-reset" style="width:170px">重置全部进度</button></div>
        <div style="font-size:10px;color:rgba(111,143,132,.6)">平台 ${BP_PLATFORM.kind.toUpperCase()} · 存档键 ${ST.SAVE_KEY}（${BP_PLATFORM.store.backend === "native" ? "本地文件" : BP_PLATFORM.store.backend === "local" ? "localStorage" : "内存（临时）"}）</div>
        <div class="btns"><button class="btn" id="b-back" style="max-width:200px">返回</button></div>
      </div>
    `);
    const grid = root.querySelector("#setgrid");
    for (const [label, opts, get, set] of spec) {
      const row = document.createElement("div"); row.className = "set-row";
      const l = document.createElement("label"); l.textContent = label;
      const b = document.createElement("button");
      let i = Math.max(0, Math.min(opts.length - 1, get()));
      b.textContent = opts[i];
      b.onclick = () => {
        i = (i + 1) % opts.length; b.textContent = opts[i];
        set(i); State.persist(); applySettings(); Sfx.play("uiMove", -14);
      };
      row.appendChild(l); row.appendChild(b); grid.appendChild(row);
    }
    let armed = false;
    const rb = root.querySelector("#b-reset");
    rb.onclick = () => {
      if (!armed) { armed = true; rb.textContent = "再点一次确认"; return; }
      State.resetProgress(); rb.textContent = "已重置"; armed = false; toast("进度已重置");
    };
    root.querySelector("#b-back").onclick = () => {
      State.persist(); applySettings();
      if (settingsReturn === "pause" && sim) showPause();
      else showMenu();
    };
    root.querySelector("#b-back").focus();
  }
  function nearest(arr, v) { return arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)); }

  // ================================================================ 暂停
  function showPause(reason) {
    if (state !== "play") return;
    state = "paused"; sim.paused = true;
    const autoNote = reason === "leave" ? "鼠标移出画面，已自动暂停 · 回到画面即继续"
      : reason === "blur" ? "窗口失去焦点，已自动暂停" : "";
    const inRun = battleCtx && battleCtx.mode !== "classic";
    const root = setScreen(`
      <div class="dim"></div>
      <div class="panel" style="min-width:420px">
        <h2>暂停</h2>
        <div class="sub">${autoNote || "PAUSED · 模拟已停止"}</div>
        <div class="btns" style="flex-direction:column">
          <button class="btn" id="b-resume">继续</button>
          ${inRun ? '<button class="btn" id="b-build">查看构筑</button>' : ""}
          <button class="btn" id="b-set">设置</button>
          <button class="btn" id="b-quit">${inRun ? "放弃本局" : "返回选关"}</button>
        </div>
      </div>
    `);
    root.querySelector("#b-resume").onclick = resume;
    if (inRun) root.querySelector("#b-build").onclick = showBuild;
    root.querySelector("#b-set").onclick = () => openSettings("pause");
    root.querySelector("#b-quit").onclick = () => {
      sim.paused = true;
      if (inRun) { Run.current = null; showMenu(); } else showClassicSelect();
    };
    root.querySelector("#b-resume").focus();
  }
  function resume() {
    if (state !== "paused") return;
    state = "play"; sim.paused = false; screenEl.innerHTML = ""; hud.classList.remove("hidden"); acc = 0;
    autoPausedBy = null;
    resetMouseAnchor();
  }

  // ================================================================ HUD
  let hudLevel = null;
  function updateHudStatic(def) {
    hudLevel = def;
    const ch = CT.CHAPTERS.find((c) => c.id === def.chapter) || CT.CHAPTERS[0];
    document.getElementById("levelname").textContent = (def.boss ? "BOSS · " : "") + ch.name + " · " + def.name;
    document.getElementById("levelcode").textContent = def.codename || ch.code;
  }

  function updateHud() {
    if (!sim || !hudLevel) return;
    const livesEl = document.getElementById("lives");
    const shown = Math.max(3, Math.min(6, sim.lives));
    if (livesEl.childElementCount !== shown) {
      livesEl.innerHTML = Array.from({ length: shown }, () => "<span class='pip'></span>").join("");
    }
    const pips = livesEl.children;
    for (let i = 0; i < pips.length; i++) pips[i].className = "pip" + (i >= sim.lives ? " off" : sim.lives <= 1 ? " low" : "");
    document.getElementById("score").textContent = pad(sim.score, 6);
    document.getElementById("speed").textContent = sim.boss
      ? "核心 " + Math.round((sim.boss.hp / sim.boss.maxHp) * 100) + "% · 护甲 " + sim.boss.parts.filter((p) => p.alive && p.role === "armor").length
      : "球速 " + Math.round(sim.ballSpeed()) + " · 剩余 " + sim.grid.destructibleAlive;
    document.getElementById("inputmode").textContent = "INPUT " + (inputMode === "mouse" ? "MOUSE" : "KEYBOARD");
    const total = sim.grid.destructibleTotal;
    const ratio = total ? 1 - sim.grid.destructibleAlive / total : (sim.boss ? 1 - sim.boss.hp / sim.boss.maxHp : 0);
    document.querySelector("#progress i").style.width = (ratio * 100).toFixed(1) + "%";

    const r = Run.current;
    const runbar = document.getElementById("runbar");
    if (r && battleCtx && battleCtx.mode !== "classic") {
      runbar.classList.remove("hidden");
      document.getElementById("run-chapter").textContent = (r.mode === "endless" ? "无尽 " : "") + "第" + (r.chapterPos + 1) + "章";
      document.getElementById("run-gold").textContent = "碎片 " + r.gold;
      document.getElementById("run-level").textContent = "等级 " + (r.level + 1);
      document.getElementById("run-build").textContent = "升级 " + r.upgrades.length + " · 遗物 " + r.relics.length;
    } else runbar.classList.add("hidden");

    const bb = document.getElementById("bossbar");
    if (sim.boss) {
      bb.classList.remove("hidden");
      const b = sim.boss;
      document.getElementById("boss-name").textContent = b.def.name;
      document.getElementById("boss-phase").textContent = "阶段 " + (b.phase + 1) + (b.window > 0 ? " · 窗口 " + b.window.toFixed(1) + "s" : "");
      document.getElementById("boss-fill").style.width = Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1) + "%";
      document.getElementById("boss-note").textContent = b.telegraph ? b.telegraph.text : (b.window > 0 ? "弱点暴露：抓住窗口" : "");
    } else bb.classList.add("hidden");
  }

  // ================================================================ 输入
  function logical(e) {
    const r = stage.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * C.W, y: ((e.clientY - r.top) / r.height) * C.H };
  }

  let lastMouse = { x: C.PADDLE_MID, y: 0 };
  let mouseInside = true;
  let leaveTimer = 0;
  let autoPausedBy = null;          // "leave" | "blur" —— 区分自动暂停与手动暂停
  let touchAnchor = null;           // 触屏相对拖动锚点，避免挡板瞬移到手指底下
  let lockX = C.PADDLE_MID;

  function resetMouseAnchor() {
    const x = sim ? sim.paddleX : C.PADDLE_MID;
    lastMouse.x = x; lastMouse.y = C.H * 0.85;
    lockX = x;
  }
  function pauseAuto(by) {
    if (state !== "play") return;
    autoPausedBy = by;
    showPause(by);
  }
  function tryAutoResume() {
    if (state !== "paused" || !autoPausedBy || !State.settings.auto_resume) return;
    autoPausedBy = null;
    resetMouseAnchor();
    resume();
  }

  stage.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === stage) {
      lockX = BP.clamp(lockX + e.movementX / (scale || 1), C.WALL_L, C.WALL_R);
      lastMouse.x = lockX;
      if (state === "play") inputMode = "mouse";
      return;
    }
    const p = logical(e);
    const dx = p.x - lastMouse.x, dy = p.y - lastMouse.y;
    lastMouse = p;
    if (state === "play" && Math.hypot(dx, dy) > C.MOUSE_SWITCH) inputMode = "mouse";
  });

  // 鼠标移出画面：默认自动暂停。这是「球在飞、指针滑出窗口、挡板留在原地必失球」的根治办法。
  stage.addEventListener("mouseleave", () => {
    mouseInside = false;
    if (!State.settings.pause_on_leave) return;
    if (state !== "play" || inputMode !== "mouse") return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { if (!mouseInside && state === "play") pauseAuto("leave"); }, 80);
  });
  stage.addEventListener("mouseenter", () => {
    mouseInside = true;
    clearTimeout(leaveTimer);
    resetMouseAnchor();
    if (autoPausedBy === "leave") tryAutoResume();
  });

  stage.addEventListener("mousedown", (e) => {
    Sfx.init(); Sfx.resume(); Music.start();
    if (State.settings.pointer_lock && document.pointerLockElement !== stage && stage.requestPointerLock) {
      const r = stage.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    }
    if (state === "play" && sim && sim.phase === PHASE.SERVE) sim.launch();
    if (e.button === 2) e.preventDefault();
  });
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // 触屏：按下时记录「挡板 — 手指」偏移，之后按相对位移移动，手指不会挡住挡板
  stage.addEventListener("touchstart", (e) => {
    Sfx.init(); Sfx.resume(); Music.start();
    if (state !== "play" || !sim) return;
    const p = logical(e.touches[0]);
    inputMode = "mouse";
    touchAnchor = sim.paddleX - p.x;
    sim.setPaddleTarget(sim.paddleX, C.MOUSE_SPEED);
    if (sim.phase === PHASE.SERVE) sim.launch();
  }, { passive: true });
  stage.addEventListener("touchmove", (e) => {
    if (state !== "play" || !sim) return;
    const p = logical(e.touches[0]);
    const x = anchorClamp(touchAnchor, p.x);
    lastMouse.x = x;
    sim.setPaddleTarget(x, C.MOUSE_SPEED);
    e.preventDefault();
  }, { passive: false });
  stage.addEventListener("touchend", () => { touchAnchor = null; }, { passive: true });

  function anchorClamp(anchor, x) {
    const v = (anchor == null ? x : x + anchor);
    return Math.max(C.WALL_L, Math.min(C.WALL_R, v));
  }

  const keys = {};
  window.addEventListener("keydown", (e) => {
    Sfx.init(); Sfx.resume();
    keys[e.code] = true;
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(e.code)) e.preventDefault();
    if (state === "play") {
      if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) inputMode = "keyboard";
      if (e.code === "Space" && sim && sim.phase === PHASE.SERVE) sim.launch();
      if (e.code === "Escape" || e.code === "KeyP") { autoPausedBy = null; showPause(); }
      if (e.code === "Tab") { e.preventDefault(); showBuild(); }
      if (e.code === "KeyF") BP_PLATFORM.toggleFullscreen();
    } else if (state === "paused" && (e.code === "Escape" || e.code === "KeyP")) { autoPausedBy = null; resume(); }
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("blur", () => {
    mouseInside = false;
    if (state === "play") pauseAuto("blur");
  });
  window.addEventListener("focus", () => {
    if (autoPausedBy === "blur") tryAutoResume();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "play") pauseAuto("blur");
    else if (!document.hidden && autoPausedBy === "blur") tryAutoResume();
  });

  function syncInput(dt) {
    if (!sim) return;
    if (sim.phase === PHASE.CLEAR || sim.phase === PHASE.FAIL) return;
    if (inputMode === "mouse") {
      const x = Math.max(C.WALL_L, Math.min(C.WALL_R, lastMouse.x));
      sim.setPaddleTarget(x, C.MOUSE_SPEED);
    } else {
      let dir = 0;
      if (keys.KeyA || keys.ArrowLeft) dir -= 1;
      if (keys.KeyD || keys.ArrowRight) dir += 1;
      if (dir) sim.nudgePaddle(dir * C.KEY_SPEED * dt);
      sim.setPaddleTarget(sim.paddleTarget, 4000);
    }
  }

  // ================================================================ 循环
  function frame(ts) {
    const dt = Math.min(0.12, (ts - last) / 1000 || 0);
    last = ts;
    if (state === "play" && sim) {
      syncInput(dt);
      if (demoMode && sim.balls.length) {
        const b = sim.balls[0];
        sim.setPaddleTarget(b.x + Math.sin(sim.time * 0.9) * 45, 100000);
        if (sim.phase === PHASE.SERVE) sim.launch();
      }
      acc += dt;
      let n = 0;
      while (acc >= C.FIXED && n < C.MAX_FRAME_STEPS) { sim.step(C.FIXED); acc -= C.FIXED; n++; }
      if (n >= C.MAX_FRAME_STEPS) acc = 0;
      updateHud();
    }
    view.update(dt);
    view.draw();
    requestAnimationFrame(frame);
  }

  // ================================================================ 启动
  if (BP_PLATFORM.isTouch) document.body.classList.add("touch");
  if (BP_PLATFORM.isMobile) document.body.classList.add("mobile");
  State.load();
  applySettings();
  showMenu();

  BP_PLATFORM.onBack(() => {
    if (state === "play") showPause();
    else if (state === "paused") resume();
    else if (state !== "menu") showMenu();
  });

  document.addEventListener("pointerdown", () => { Sfx.init(); Sfx.resume(); Music.start(); }, { once: true });
  document.addEventListener("keydown", () => { Sfx.init(); Sfx.resume(); Music.start(); }, { once: true });

  view.update(0); view.draw();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  window.BPGame = {
    get state() { return state; }, get sim() { return sim; }, get view() { return view; },
    Run, State, Meta, CT,
    startMode(m) { if (m === "classic") showClassicSelect(0); else showPaddleSelect(m); },
    startLevel(id) { const lv = CT.LEVELS.find((l) => l.id === id); if (lv) startBattle(lv, { mode: "classic" }); },
    startRun(mode, paddle, seed) { Run.start(mode || "expedition", paddle || "p1", seed || 12345); showRoute(); },
    startBoss(ch) {
      const b = CT.BOSSES[ch || 0];
      startBattle({ id: "boss_" + b.id, name: b.name, codename: b.code, rows: [], speed: 520, lives: 99, boss: b, chapter: b.chapter }, { mode: "expedition", nodeType: "boss" });
    },
    emit(n, a) { if (sim && sim.hooks[n]) sim.hooks[n](a); },
    showRoute, showShop, showEvent, showCodex, showBuild, openSettings, showModes, showMenu, showPause,
    setDemo(v) { demoMode = !!v; },
    chooseNode(i) { enterNode(Run.currentOptions()[i || 0]); },
    pickUpgrade(i) { const c = document.querySelectorAll(".pick-card")[i || 0]; if (c) c.click(); },
  };
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("level")) {
      const lv = CT.LEVELS.find((l) => l.id === q.get("level"));
      if (lv) startBattle(lv, { mode: "classic" });
      demoMode = q.get("demo") === "1";
    } else if (q.get("boss") != null) {
      window.BPGame.startBoss(Number(q.get("boss")));
      demoMode = q.get("demo") === "1";
    } else if (q.get("run")) {
      Run.start(q.get("run"), q.get("paddle") || "p1", Number(q.get("seed") || 12345));
      showRoute();
      demoMode = q.get("demo") === "1";
    }
  } catch (e) { /* ignore */ }
})();
