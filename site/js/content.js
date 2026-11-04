/* BREAKOUT: 磷光纪元 — 内容数据
 * 章节 / 48 个手工关卡 / 6 个 Boss / 36 项升级 / 18 件遗物 / 6 种挡板 / 事件 / 协同
 * 只放数据与 Boss 行为函数，不含界面逻辑。
 */
(function (root) {
  "use strict";
  const BP = root.BP, C = BP.C;

  const CHAPTERS = [
    { id: "ch1", index: 1, name: "旧式终端", code: "LEGACY TERMINAL", accent: "#7cffb2", brief: "磷光屏上的第一课：规则简单，反弹诚实。" },
    { id: "ch2", index: 2, name: "熔炉工厂", code: "FORGE WORKS", accent: "#ffa35c", brief: "高温、爆裂与厚甲，节奏开始变紧。" },
    { id: "ch3", index: 3, name: "冰晶回廊", code: "CRYO GALLERY", accent: "#7fd8ff", brief: "冻结会放大伤害，也会冻住你的节奏。" },
    { id: "ch4", index: 4, name: "电磁网络", code: "GRID NETWORK", accent: "#b39cff", brief: "导电与节点，让一次命中传成一串。" },
    { id: "ch5", index: 5, name: "折跃空间", code: "WARP SPACE", accent: "#8ab4ff", brief: "错位与缺口，反弹路线不再笔直。" },
    { id: "ch6", index: 6, name: "核心主机", code: "CORE HOST", accent: "#ff6b7e", brief: "所有机制的合流，主机在看着你。" },
  ];

  // ---------------------------------------------------------------- 关卡
  // rows 为 12 列字符图；图例 # 普通 T 双层 A 装甲 B 爆裂 X 障碍 R 再生 S 护盾节点
  const LEVELS = [];
  function L(ch, idx, name, code, teach, rows, opt) {
    LEVELS.push(Object.assign({
      id: "c" + ch + "_" + String(idx).padStart(2, "0"),
      chapter: "ch" + ch, index: idx, name, codename: code, teach,
      rows, speed: 520 + (ch - 1) * 18 + idx * 4, lives: 3,
    }, opt || {}));
  }

  // 第一章 · 旧式终端
  L(1, 1, "冷启动", "COLD BOOT", "接球与边缘角度", [
    "..########..", "..########..", "............", "..##....##..", "..########.."]);
  L(1, 2, "斜角", "OBLIQUE", "用挡板位置控制反射角", [
    "#..##..##..#", ".##..##..##.", "#..##..##..#", ".##..##..##."]);
  L(1, 3, "双塔", "TWIN TOWERS", "竖直通道与侧向切入", [
    "###......###", "###......###", "###......###", "...##..##...", "...##..##..."]);
  L(1, 4, "阶梯", "STAIRCASE", "逐层抬高的落点", [
    "..........##", "........##..", "......##....", "....##......", "..##........"]);
  L(1, 5, "装甲层", "ARMOR PLATE", "耐久差异：先拆壳再打核心", [
    "XX........XX", "..TTTTTTTT..", "..TAAAAAAT..", "..TTTTTTTT.."]);
  L(1, 6, "回廊", "CORRIDOR", "狭窄通道里的连续反弹", [
    "X..........X", "X.##....##.X", "X.##....##.X", "X..........X", "X.########.X"]);
  L(1, 7, "熔渣区", "SLAG FIELD", "爆裂连锁与不可破坏柱", [
    "............", ".BB......BB.", ".TT..XX..TT.", ".BB..XX..BB.", "....####...."]);
  L(1, 8, "窄门", "NARROW GATE", "穿窗口精确击打残余目标", [
    "X.#..##..#.X", "X..X....X..X", "X.#..##..#.X", "X..X....X..X", "X.#..##..#.X"]);

  // 第二章 · 熔炉工厂
  L(2, 1, "预热", "PREHEAT", "厚甲与爆裂的第一次组合", [
    "...TTTTTT...", "..TBBBBBBT..", "..TAAAAAAT..", "...TTTTTT..."]);
  L(2, 2, "炉膛", "FURNACE", "被爆裂砖夹住的核心", [
    "....BBBB....", "..AA....AA..", "..AA.BB.AA..", "..AA....AA..", "....BBBB...."]);
  L(2, 3, "烟道", "FLUES", "三条竖井，落点受限", [
    "##..##..##..", "##..##..##..", "##..##..##..", "....##..##..", "....##..##.."]);
  L(2, 4, "坩埚", "CRUCIBLE", "中心高耐久，四周易爆", [
    ".BB......BB.", ".B.TTTTTT.B.", "...TXXXXT...", ".B.TTTTTT.B.", ".BB......BB."]);
  L(2, 5, "传送带", "CONVEYOR", "斜向排列的装甲带", [
    "AAA.........", ".AAA........", "..AAA.......", "...AAA......", "....AAA....."]);
  L(2, 6, "过热", "OVERHEAT", "密集爆裂，注意连锁顺序", [
    "BB.BB.BB.BB.", "............", "BB.BB.BB.BB.", "...TTTTTT...", "....TTTT...."]);
  L(2, 7, "钢梁", "GIRDERS", "不可破坏梁切断路线", [
    "XXXXXXXXXXXX", "....TTTT....", "....TTTT....", "XX........XX", "....TTTT...."]);
  L(2, 8, "出炉", "TAPPING", "综合考验", [
    "..AA....AA..", "..AABBBBAA..", "..AA....AA..", ".TT..XX..TT.", ".BB......BB."]);

  // 第三章 · 冰晶回廊
  L(3, 1, "霜降", "FIRST FROST", "再生砖：必须在再生前打穿", [
    "..RRRRRRRR..", "..R##..##R..", "..RRRRRRRR.."]);
  L(3, 2, "棱镜", "PRISM", "斜向晶体阵列", [
    "..R.........", "...R........", "....RRRR....", "........R...", ".........R.."]);
  L(3, 3, "冰墙", "ICE WALL", "不可破坏墙后的目标", [
    "XX........XX", "..RRRRRRRR..", "..X......X..", "..R.RRRR.R..", "..X......X.."]);
  L(3, 4, "双面", "TWO FACES", "两侧对称，中央脆弱", [
    "RRR......RRR", "R.R......R.R", "RRR..##..RRR", ".....TT.....", "....AAAA...."]);
  L(3, 5, "冻湖", "FROZEN LAKE", "大片再生砖，考验持续输出", [
    "RRRRRRRRRRRR", "RRRRRRRRRRRR", "..RRRRRRRR.."]);
  L(3, 6, "冰锥", "ICICLES", "向下的尖刺结构", [
    "A..A..A..A..", ".A..A..A..A.", "..A..A..A..A", "...A..A..A..", "....A..A...."]);
  L(3, 7, "雾区", "WHITEOUT", "低密度目标，容易空转", [
    "R..........R", "............", "..R......R..", "............", "....R..R...."]);
  L(3, 8, "冰核", "ICE CORE", "再生核心 + 厚壳", [
    "..TTTTTTTT..", ".TRRRRRRRRT.", ".TRAAAAAART.", "..TTTTTTTT.."]);

  // 第四章 · 电磁网络
  L(4, 1, "接线", "WIRING", "护盾节点：打掉才开窗", [
    "..S......S..", "..##########", "............", "..##########", "..S......S.."]);
  L(4, 2, "并联", "PARALLEL", "两条回路", [
    "S..........S", ".##########.", "............", ".##########.", "S..........S"]);
  L(4, 3, "电阻", "RESISTOR", "高耐久节点", [
    "....SSSS....", "..AAAAAAAA..", "..A......A..", "..AAAAAAAA..", "....SSSS...."]);
  L(4, 4, "短路", "SHORT CIRCUIT", "爆裂 + 节点", [
    "..BB....BB..", "..S......S..", "....AAAA....", "..BB....BB.."]);
  L(4, 5, "矩阵", "MATRIX", "网格状节点", [
    "S..S..S..S..", ".##########.", "S..S..S..S..", ".##########.", "S..S..S..S.."]);
  L(4, 6, "中继", "RELAY", "中央核心被节点保护", [
    "..S......S..", "..S.TTTT.S..", "..S.TAAT.S..", "..S.TTTT.S..", "..S......S.."]);
  L(4, 7, "过载", "OVERLOAD", "密集导电体", [
    "############", "BBBBBBBBBBBB", "############", "BBBBBBBBBBBB"]);
  L(4, 8, "电网", "THE GRID", "综合", [
    "S.BB.BB.BB.S", "..AAAAAAAA..", "S.BB.BB.BB.S", "..TTTTTTTT.."]);

  // 第五章 · 折跃空间
  L(5, 1, "错位", "DISPLACED", "缺口迫使改变反弹角度", [
    "###..###..##", "###..###..##", "..##..###..#", "..##..###..#"]);
  L(5, 2, "门框", "DOORFRAME", "穿越中央窗口", [
    "XXXX....XXXX", "..##....##..", "..##....##..", "XX.X....X.XX", "..##....##.."]);
  L(5, 3, "折跃点", "WARP POINT", "密集小方块", [
    ".#.#.#.#.#.#", "#.#.#.#.#.#.", ".#.#.#.#.#.#", "#.#.#.#.#.#."]);
  L(5, 4, "断层", "FAULT LINE", "斜向断层", [
    "A...........", "AA..........", ".AA.........", "..AA........", "...AA.......", "....AA......"]);
  L(5, 5, "回环", "LOOP", "环形结构", [
    "..###..###..", ".#........#.", ".#..XXXX..#.", ".#........#.", "..###..###.."]);
  L(5, 6, "相位", "PHASE SHIFT", "交错双层", [
    "##..##..##..", "..##..##..##", "##..##..##..", "..##..##..##", "##..##..##.."]);
  L(5, 7, "迷宫", "MAZE", "通道考验控球", [
    "X..XX..XX..X", "X.T....T...X", "XX.XX.XX.X.X", "X.T....T...X", "X..XX..XX..X"]);
  L(5, 8, "跃迁", "JUMP", "综合", [
    "....AAAA....", "..XX....XX..", "..BB.AA.BB..", "..XX....XX..", "....AAAA...."]);

  // 第六章 · 核心主机
  L(6, 1, "防火墙", "FIREWALL", "厚甲与节点", [
    "S..AAAAAA..S", "S..AAAAAA..S", "...TTTTTT...", "............", "..BB....BB.."]);
  L(6, 2, "内核", "KERNEL", "保护核心", [
    "..TTTTTTTT..", "..TSSSSSST..", "..TSAAAAST..", "..TSSSSSST..", "..TTTTTTTT.."]);
  L(6, 3, "缓存", "CACHE", "再生 + 装甲", [
    "############", "#TTTTTTTTTT#", "#T#RRRRRR#T#", "#TTTTTTTTTT#", "############"]);
  L(6, 4, "中断", "INTERRUPT", "缝隙中的目标", [
    "XX.XX.XX.XX.", "..BB....BB..", "XX.XX.XX.XX.", "..AA....AA..", "XX.XX.XX.XX."]);
  L(6, 5, "守护进程", "DAEMON", "节点网络", [
    "S.S.S.S.S.S.", ".AAAAAAAAAA.", "S.S.S.S.S.S.", ".BB.BB.BB.BB"]);
  L(6, 6, "堆栈", "STACK", "层层堆叠", [
    "############", "TTTTTTTTTTTT", "BBBBBBBBBBBB", "AAAAAAAAAAAA", "RRRRRRRRRRRR"]);
  L(6, 7, "死锁", "DEADLOCK", "不可破坏结构", [
    "XX.XXXXXX.XX", "X.AAAAAAAA.X", "X.AAAAAAAA.X", "............", "............"]);
  L(6, 8, "主机", "THE HOST", "最终考验", [
    "AAAA....AAAA", "A.SS....SS.A", "..BB.AA.BB..", "A.SS....SS.A", "AAAA....AAAA"]);

  // ---------------------------------------------------------------- Boss
  function part(id, role, type, x, y, w, h, hp, extra) {
    return Object.assign({ id, role, type, x, y, w, h, hp }, extra || {});
  }

  const BOSSES = [
    {
      id: "b1", chapter: "ch1", name: "终端守卫", code: "TERMINAL WARDEN", hp: 14,
      brief: "旋转护甲把核心围住。打掉任意两块护甲，核心才会暴露。",
      parts: [
        part("core", "core", "core", -60, -30, 120, 60, 14, { invuln: true }),
        part("a1", "armor", "armorPlate", -150, -80, 70, 24, 3),
        part("a2", "armor", "armorPlate", 80, -80, 70, 24, 3),
        part("a3", "armor", "armorPlate", -150, 56, 70, 24, 3),
        part("a4", "armor", "armorPlate", 80, 56, 70, 24, 3),
      ],
      phases: [
        { at: 1.0, name: "护甲展开", coreInvuln: true },
        { at: 0.5, name: "过载：转速提升", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        const cx = 640, cy = 240;
        const speed = b.phase >= 1 ? 0.85 : 0.45;
        b.state.ang = (b.state.ang || 0) + dt * speed;
        b.parts.forEach((p, i) => {
          if (p.role !== "armor" || !p.alive) return;
          const a = b.state.ang + (i - 1) * Math.PI / 2;
          p.rect.x = cx + Math.cos(a) * 150 - p.rect.w / 2;
          p.rect.y = cy + Math.sin(a) * 95 - p.rect.h / 2;
        });
      },
      onPart(b, p, sim) {
        if (p.role !== "armor") return;
        const alive = b.parts.filter((q) => q.alive && q.role === "armor").length;
        if (alive <= 2) {
          const core = b.parts.find((q) => q.role === "core");
          if (core) core.invuln = false;
          b.window = Math.max(b.window, 7);
          sim.emit("bossWindow", "护甲缺口：" + alive + " 块");
        }
      },
    },
    {
      id: "b2", chapter: "ch2", name: "熔炉巨像", code: "FORGE COLOSSUS", hp: 18,
      brief: "每次命中共振都会升温。热量满时进入过载，受到的伤害翻倍。",
      parts: [
        part("core", "core", "core", -70, -40, 140, 80, 18),
        part("h1", "armor", "armorPlate", -190, -20, 60, 60, 5),
        part("h2", "armor", "armorPlate", 130, -20, 60, 60, 5),
        part("h3", "armor", "armorPlate", -40, 70, 80, 22, 4),
      ],
      phases: [
        { at: 1.0, name: "点火", coreInvuln: false },
        { at: 0.6, name: "炉压升高", coreInvuln: false },
        { at: 0.25, name: "临界：场地升温", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        b.state.heat = b.state.heat || 0;
        b.state.heat = Math.max(0, b.state.heat - dt * 6);
        b.state.over = b.state.over || 0;
        if (b.state.over > 0) b.state.over -= dt;
        if (b.state.heat >= 100 && b.state.over <= 0) {
          b.state.heat = 0;
          b.state.over = 5;
          b.window = 5;
          sim.emit("bossWindow", "过载：伤害翻倍");
        }
        const core = b.parts.find((p) => p.role === "core");
        if (core && core.alive) {
          core.rect.y = 200 + Math.sin(b.t * 1.2) * 18;
        }
      },
      onPart(b, p, sim) {
        if (p.role === "core") return;
        b.state.heat = Math.min(100, (b.state.heat || 0) + 18);
      },
    },
    {
      id: "b3", chapter: "ch3", name: "冰镜双核", code: "MIRROR TWINS", hp: 16,
      brief: "两个核心轮流被冰镜保护。打碎当前镜子，窗口只开 6 秒。",
      parts: [
        part("c1", "core", "core", -150, -30, 110, 60, 8),
        part("c2", "core", "core", 40, -30, 110, 60, 8),
        part("m1", "armor", "armorPlate", -160, -34, 130, 68, 4, { invuln: true }),
        part("m2", "armor", "armorPlate", 30, -34, 130, 68, 4, { invuln: true }),
      ],
      phases: [
        { at: 1.0, name: "双镜闭合", coreInvuln: true },
        { at: 0.5, name: "镜面碎裂", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        b.state.side = b.state.side || 0;
        b.state.swap = (b.state.swap || 0) - dt;
        const m1 = b.parts.find((p) => p.partId === "m1");
        const m2 = b.parts.find((p) => p.partId === "m2");
        if (b.state.swap <= 0) {
          b.state.swap = 9;
          b.state.side = 1 - b.state.side;
          if (m1 && m1.alive) m1.invuln = b.state.side !== 0;
          if (m2 && m2.alive) m2.invuln = b.state.side !== 1;
          b.window = 0;
        }
      },
      onPart(b, p, sim) {
        if (p.role !== "armor") return;
        const core = b.parts.find((c) => c.role === "core" && c.alive);
        if (core) { core.invuln = false; b.window = 6; sim.emit("bossWindow", "镜面破碎：6 秒窗口"); }
      },
    },
    {
      id: "b4", chapter: "ch4", name: "电网织者", code: "GRID WEAVER", hp: 24,
      brief: "四个供能节点维持护盾。每切断一个节点，核心暴露 4 秒。",
      parts: [
        part("core", "core", "core", -60, -30, 120, 60, 24, { invuln: true }),
        part("n1", "armor", "shieldNode", -220, -76, 70, 52, 3),
        part("n2", "armor", "shieldNode", 150, -76, 70, 52, 3),
        part("n3", "armor", "shieldNode", -220, 24, 70, 52, 3),
        part("n4", "armor", "shieldNode", 150, 24, 70, 52, 3),
      ],
      phases: [
        { at: 1.0, name: "电网闭合", coreInvuln: true },
        { at: 0.55, name: "电压不稳", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        b.state.pulse = (b.state.pulse || 0) + dt;
        if (b.state.pulse > 4.5) {
          b.state.pulse = 0;
          const core = b.parts.find((p) => p.role === "core");
          const nodes = b.parts.filter((p) => p.role === "armor" && p.alive).length;
          if (core) core.invuln = nodes >= 3;
          if (nodes < 3) b.window = Math.max(b.window, 4);
        }
      },
      onPart(b, p, sim) {
        if (p.role !== "armor") return;
        const core = b.parts.find((c) => c.role === "core");
        if (core) { core.invuln = false; b.window = 4.5; sim.emit("bossWindow", "供能切断：4 秒"); }
      },
    },
    {
      id: "b5", chapter: "ch5", name: "折跃巨蛇", code: "WARP SERPENT", hp: 10,
      brief: "由九节组成的蛇身沿正弦路径游动。只有头部是弱点，身体会缓慢再生。",
      parts: [
        part("head", "core", "weakPoint", 0, -110, 92, 64, 10),
        ...Array.from({ length: 8 }, (_, i) => part("s" + i, "armor", "armorPlate", 0, 0, 56, 28, 3, { regen: 1 })),
      ],
      phases: [
        { at: 1.0, name: "苏醒", coreInvuln: false },
        { at: 0.55, name: "加速游动", coreInvuln: false },
        { at: 0.22, name: "折跃：路径紊乱", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        const head = b.parts.find((p) => p.partId === "head");
        if (!head || !head.alive) return;
        // 速度压低：头部是唯一弱点，轨迹必须跟得上，否则玩家只能靠运气命中
        b.state.p = (b.state.p || 0) + dt * (b.phase >= 2 ? 1.12 : b.phase >= 1 ? 0.84 : 0.64);
        const cx = 640 + Math.sin(b.state.p * 0.9) * 300;
        const cy = 210 + Math.sin(b.state.p * 1.7) * 70;
        head.rect.x = cx - head.rect.w / 2;
        head.rect.y = cy - head.rect.h / 2;
        for (let i = 0; i < 8; i++) {
          const s = b.parts.find((p) => p.partId === "s" + i);
          if (!s || !s.alive) continue;
          // 相位步长要和身宽匹配：按路径最大速度 ~296px/p 计算，0.19 大约 56px 一节
          const t = b.state.p - (i + 1) * 0.19;
          const sx = 640 + Math.sin(t * 0.9) * 300;
          const sy = 210 + Math.sin(t * 1.7) * 70;
          s.rect.x = sx - s.rect.w / 2;
          s.rect.y = sy - s.rect.h / 2;
        }
        // 躯干缓慢再生（此前只递减计时器、从未真正回血）
        for (const p of b.parts) {
          if (p.role !== "armor" || !p.alive || p.hp >= p.maxHp) continue;
          p.regenTimer -= dt;
          if (p.regenTimer <= 0) {
            p.hp = Math.min(p.maxHp, p.hp + 1);
            p.regenTimer = 9;
          }
        }
      },
      // 打躯干不再给头部回血：旧逻辑等于"打偏反而帮 Boss 加血"，是反玩家设计
      onPart(b, p, sim) {
        if (p.role === "core") return;
      },
    },
    {
      id: "b6", chapter: "ch6", name: "主机之心", code: "HEART OF THE HOST", hp: 30,
      brief: "组合所有机制：旋转护甲、节点窗口、阶段转换。它会针对你的构筑改变护甲类型，但总有预告。",
      parts: [
        part("core", "core", "core", -70, -35, 140, 70, 30, { invuln: true }),
        part("a1", "armor", "armorPlate", -170, -100, 90, 26, 3),
        part("a2", "armor", "armorPlate", 80, -100, 90, 26, 3),
        part("a3", "armor", "armorPlate", -170, 74, 90, 26, 3),
        part("a4", "armor", "armorPlate", 80, 74, 90, 26, 3),
        part("n1", "armor", "shieldNode", -40, -110, 58, 44, 2),
        part("n2", "armor", "shieldNode", -10, 80, 58, 44, 2),
      ],
      phases: [
        { at: 1.0, name: "主机启动", coreInvuln: true },
        { at: 0.66, name: "第二阶段：装甲重排", coreInvuln: true },
        { at: 0.33, name: "第三阶段：核心过载", coreInvuln: false },
      ],
      tick(b, sim, dt) {
        b.state.ang = (b.state.ang || 0) + dt * (0.3 + b.phase * 0.2);
        b.parts.forEach((p, i) => {
          if (!p.alive || p.role !== "armor") return;
          if (p.type === "shieldNode") {
            p.rect.y += Math.sin(b.t * 2 + i) * 0.6;
            return;
          }
          const a = b.state.ang + (i % 4) * Math.PI / 2;
          p.rect.x = 640 + Math.cos(a) * 180 - p.rect.w / 2;
          p.rect.y = 240 + Math.sin(a) * 110 - p.rect.h / 2;
        });
        const armorAlive = b.parts.filter((p) => p.role === "armor" && p.alive).length;
        const core = b.parts.find((p) => p.role === "core");
        if (core && armorAlive === 0) core.invuln = false;
      },
      onPart(b, p, sim) {
        if (p.role === "core") return;
        const armorAlive = b.parts.filter((q) => q.role === "armor" && q.alive).length;
        if (armorAlive === 0) {
          const core = b.parts.find((c) => c.role === "core");
          if (core) core.invuln = false;
          b.window = 6;
          sim.emit("bossWindow", "全部护甲清除：核心暴露");
        }
      },
    },
  ];

  // ---------------------------------------------------------------- 升级
  // mods 直接叠加到 Sim.mods；flag 由引擎/界面读取
  const ARCH = {
    kinetic: { name: "动能暴击", color: "#ffd479", brief: "速度、精准与贯穿" },
    flame: { name: "烈焰爆破", color: "#ff7a5c", brief: "灼烧、爆炸与扩散" },
    frost: { name: "冰霜控制", color: "#7fd8ff", brief: "冻结、碎裂与护盾" },
    thunder: { name: "雷电传导", color: "#b39cff", brief: "导电、跳跃与连锁" },
    split: { name: "分裂多球", color: "#6be39a", brief: "分裂、复制与球数" },
    engineer: { name: "工程辅助", color: "#c9b28a", brief: "激光、无人机与磁吸" },
  };

  const UPGRADES = [
    { id: "k1", arch: "kinetic", name: "精准校准", desc: "挡板中心 18% 区域接球后，下一次碰撞必定暴击", mods: { centerCrit: true } },
    { id: "k2", arch: "kinetic", name: "贯穿弹芯", desc: "每次发球可贯穿 1 块砖，贯穿结束恢复正常反弹", mods: { pierce: 1 } },
    { id: "k3", arch: "kinetic", name: "高速切割", desc: "基础伤害 +1", mods: { damage: 1 } },
    { id: "k4", arch: "kinetic", name: "暴击聚焦", desc: "暴击率 +15%，暴击倍率 +0.5", mods: { critChance: 0.15, critMult: 0.5 } },
    { id: "k5", arch: "kinetic", name: "反弹蓄能", desc: "每接住一次球，本颗球伤害 +1（上限 +3）", mods: { bounceDamage: 1 } },
    { id: "k6", arch: "kinetic", name: "极限速度", desc: "球速上限 +120，初始速度 +40", mods: { maxSpeed: 120, startSpeed: 40 } },

    { id: "f1", arch: "flame", name: "引燃", desc: "命中附加 1 层灼烧，每秒 2 点伤害", mods: { burn: 1, burnDps: 2 } },
    { id: "f2", arch: "flame", name: "爆裂涂层", desc: "18% 概率在破砖时引爆", mods: { explodeChance: 0.18 } },
    { id: "f3", arch: "flame", name: "火势蔓延", desc: "灼烧会传染给相邻砖块", mods: { burnSpread: 1 } },
    { id: "f4", arch: "flame", name: "高温核心", desc: "灼烧伤害 +4/秒", mods: { burnDps: 4 } },
    { id: "f5", arch: "flame", name: "余烬", desc: "伤害 +1；灼烧中的砖块被摧毁时额外爆炸", mods: { damage: 1 }, flag: "ember" },
    { id: "f6", arch: "flame", name: "熔穿", desc: "爆炸范围 +1 格", mods: { explodeRadius: 1 } },

    { id: "c1", arch: "frost", name: "霜冻附着", desc: "20% 概率冻结目标 2.5 秒", mods: { freezeChance: 0.2, freezeDur: 2.5 } },
    { id: "c2", arch: "frost", name: "碎冰", desc: "对冻结目标伤害 +80%", mods: { shatter: 0.8 } },
    { id: "c3", arch: "frost", name: "绝对零度", desc: "冻结概率 +15%，持续时间 +1.5 秒", mods: { freezeChance: 0.15, freezeDur: 1.5 } },
    { id: "c4", arch: "frost", name: "冰墙", desc: "获得 2 层底部护盾", mods: { shieldCharges: 2 } },
    { id: "c5", arch: "frost", name: "寒流", desc: "冻结的砖块被摧毁时，冰冻周围 1 格", mods: {}, flag: "coldSnap" },
    { id: "c6", arch: "frost", name: "慢速掌控", desc: "挡板宽度 +24", mods: { paddleW: 24 } },

    { id: "l1", arch: "thunder", name: "导电涂层", desc: "命中附加 1 层导电", mods: { charge: 1 } },
    { id: "l2", arch: "thunder", name: "电弧", desc: "摧毁带电砖块时跳跃 2 次", mods: { chainCount: 2 } },
    { id: "l3", arch: "thunder", name: "高压", desc: "连锁伤害 +1", mods: { chainDamage: 1 } },
    { id: "l4", arch: "thunder", name: "节点跳跃", desc: "连锁次数 +3", mods: { chainCount: 3 } },
    { id: "l5", arch: "thunder", name: "静电积累", desc: "暴击率 +10%，导电 +1", mods: { critChance: 0.1, charge: 1 } },
    { id: "l6", arch: "thunder", name: "雷暴", desc: "每 6 秒自动对随机砖块放电", mods: {}, flag: "storm" },

    { id: "m1", arch: "split", name: "分裂", desc: "破砖时 15% 概率分裂出一颗球", mods: { splitChance: 0.15 } },
    { id: "m2", arch: "split", name: "复制", desc: "每关开始额外获得 1 颗球", mods: { balls: 1 } },
    { id: "m3", arch: "split", name: "球海", desc: "额外 2 颗球，但单球伤害 -0", mods: { balls: 2 } },
    { id: "m4", arch: "split", name: "球数管理", desc: "分裂概率 +10%，球速上限 +40", mods: { splitChance: 0.1, maxSpeed: 40 } },
    { id: "m5", arch: "split", name: "召回协议", desc: "失球时有 25% 概率补回一颗球", mods: {}, flag: "recall" },
    { id: "m6", arch: "split", name: "球海战术", desc: "分裂概率 +20%，伤害 +1", mods: { splitChance: 0.2, damage: 1 } },

    { id: "e1", arch: "engineer", name: "激光阵列", desc: "每 3.2 秒向挡板上方最近的砖块发射激光", mods: { laserCd: 3.2, laserDamage: 1 } },
    { id: "e2", arch: "engineer", name: "无人机", desc: "每 2.6 秒自动攻击一块砖", mods: { drones: 1 } },
    { id: "e3", arch: "engineer", name: "磁吸挡板", desc: "接球后球会轻微回正", mods: { magnet: 1 } },
    { id: "e4", arch: "engineer", name: "护盾发生器", desc: "获得 2 层底部护盾", mods: { shieldCharges: 2 } },
    { id: "e5", arch: "engineer", name: "加宽挡板", desc: "挡板宽度 +28", mods: { paddleW: 28 } },
    { id: "e6", arch: "engineer", name: "过载协议", desc: "激光冷却 -1.2 秒，无人机 +1", mods: { laserCd: -1.2, drones: 1 } },
  ];

  // ---------------------------------------------------------------- 遗物
  const RELICS = [
    { id: "r1", name: "磷光核心", desc: "伤害 +1", rarity: "common", mods: { damage: 1 } },
    { id: "r2", name: "回声棱镜", desc: "暴击率 +8%", rarity: "common", mods: { critChance: 0.08 } },
    { id: "r3", name: "熔炉之心", desc: "命中附加灼烧", rarity: "rare", mods: { burn: 1, burnDps: 2 } },
    { id: "r4", name: "霜核", desc: "冻结概率 +10%", rarity: "rare", mods: { freezeChance: 0.1, freezeDur: 2 } },
    { id: "r5", name: "电枢", desc: "导电 +1，连锁 +1", rarity: "rare", mods: { charge: 1, chainCount: 1 } },
    { id: "r6", name: "双生球", desc: "每关额外 1 颗球", rarity: "epic", mods: { balls: 1 } },
    { id: "r7", name: "工程师手册", desc: "每 4 秒发射激光", rarity: "rare", mods: { laserCd: 4, laserDamage: 1 } },
    { id: "r8", name: "磁石", desc: "磁吸 +1", rarity: "common", mods: { magnet: 1 } },
    { id: "r9", name: "备用挡板", desc: "护盾 +1", rarity: "common", mods: { shieldCharges: 1 } },
    { id: "r10", name: "加速齿轮", desc: "初始球速 +40", rarity: "common", mods: { startSpeed: 40 } },
    { id: "r11", name: "宽幅挡板", desc: "挡板宽度 +20", rarity: "common", mods: { paddleW: 20 } },
    { id: "r12", name: "碎金者", desc: "金币获取 +30%", rarity: "common", mods: { goldBonus: 0.3 } },
    { id: "r13", name: "学者芯片", desc: "经验获取 +25%", rarity: "common", mods: { xpBonus: 0.25 } },
    { id: "r14", name: "连击稳定器", desc: "连锁加成 +15%", rarity: "rare", mods: { comboBonus: 0.15 } },
    { id: "r15", name: "余烬瓶", desc: "灼烧会扩散", rarity: "rare", mods: { burnSpread: 1 } },
    { id: "r16", name: "穿刺针", desc: "贯穿 +1", rarity: "epic", mods: { pierce: 1 } },
    { id: "r17", name: "暴击透镜", desc: "暴击倍率 +0.6", rarity: "rare", mods: { critMult: 0.6 } },
    { id: "r18", name: "逃生舱", desc: "生命归零时保留 1 点（每局一次）", rarity: "epic", mods: { lastStand: true } },
  ];

  // ---------------------------------------------------------------- 特殊砖布置
  // 金砖（G，必掉碎片）与游走砖（M，横向往复）不是全关铺开，
  // 只挑部分关卡布点，保证它们是"值得绕路去打"的目标而不是背景噪声。
  const SPECIAL_PLAN = {
    c1_03: { gold: 1, moving: 3 }, c1_06: { gold: 1, moving: 3 }, c1_08: { gold: 1, moving: 2 },
    c2_03: { gold: 1, moving: 3 },
    c3_01: { gold: 1, moving: 1 }, c3_04: { gold: 1, moving: 0 },
    c4_01: { gold: 1, moving: 3 }, c4_02: { gold: 1, moving: 3 },
    c4_05: { gold: 2, moving: 3 }, c4_07: { gold: 2, moving: 4 },
    c5_03: { gold: 2, moving: 3 }, c5_05: { gold: 2, moving: 4 }, c5_06: { gold: 2, moving: 4 },
    c6_06: { gold: 2, moving: 4 },
  };

  (function placeSpecials() {
    for (const lv of LEVELS) {
      const plan = SPECIAL_PLAN[lv.id];
      if (!plan) continue;
      const rows = lv.rows.map((r) => r.split(""));
      const pickable = [];
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) if (rows[r][c] === "#") pickable.push([r, c]);
      }
      // 金砖优先放在最下排：诱惑最大，风险也最大
      const sorted = pickable.slice().sort((a, b) => b[0] - a[0]);
      let placed = 0;
      for (const [r, c] of sorted) {
        if (placed >= (plan.gold || 0)) break;
        rows[r][c] = "G"; placed++;
      }
      const rest = pickable.filter(([r, c]) => rows[r][c] === "#").sort((a, b) => a[0] - b[0]);
      placed = 0;
      for (const [r, c] of rest) {
        if (placed >= (plan.moving || 0)) break;
        rows[r][c] = "M"; placed++;
      }
      lv.rows = rows.map((r) => r.join(""));
    }
  })();

  // ---------------------------------------------------------------- 挡板
  const PADDLES = [
    { id: "p1", name: "标准挡板", code: "STOCK", desc: "无加成，也无代价", mods: {}, unlock: "初始可用" },
    { id: "p2", name: "宽幅挡板", code: "WIDE", desc: "宽 +30，横移速度 -8%", mods: { paddleW: 30, paddleSpeed: 0.92 }, unlock: "通关第一章" },
    { id: "p3", name: "轻量挡板", code: "LIGHT", desc: "横移速度 +18%，宽 -16", mods: { paddleSpeed: 1.18, paddleW: -16 }, unlock: "单局连锁 ≥10" },
    { id: "p4", name: "磁轨挡板", code: "MAGNET", desc: "接球后回正，宽 -8", mods: { magnet: 1, paddleW: -8 }, unlock: "通关第三章" },
    { id: "p5", name: "工程台", code: "ENGINEER", desc: "每 4 秒激光，宽 -6", mods: { laserCd: 4, laserDamage: 1, paddleW: -6 }, unlock: "累计击碎 800 块" },
    { id: "p6", name: "玻璃炮", code: "GLASS", desc: "伤害 +2，宽 -12，无护盾", mods: { damage: 2, paddleW: -12 }, unlock: "无伤通关任意章节" },
  ];

  // ---------------------------------------------------------------- 事件
  const EVENTS = [
    { id: "ev1", name: "废弃终端", text: "一台仍在闪烁的旧终端。屏幕上有半行没写完的代码。", options: [
      { label: "读取残码（获得 1 次升级）", effect: "upgrade" },
      { label: "拆走零件（+45 碎片）", effect: "gold:45" },
    ]},
    { id: "ev2", name: "冷却池", text: "池水泛着冷光。碰一下，指尖会结霜。", options: [
      { label: "浸泡（恢复 1 点生命）", effect: "heal:1" },
      { label: "取样（获得冻结类强化）", effect: "upgrade:frost" },
    ]},
    { id: "ev3", name: "熔渣裂缝", text: "裂缝里透出橙红的光，热浪让空气变形。", options: [
      { label: "伸手（-1 生命，获得 2 次升级）", effect: "hurt:1,upgradex2" },
      { label: "绕开（+25 碎片）", effect: "gold:25" },
    ]},
    { id: "ev4", name: "信号塔", text: "塔顶在重复一段电码，像是在数砖块。", options: [
      { label: "解析（+60 经验）", effect: "xp:60" },
      { label: "干扰（+35 碎片，-10 经验）", effect: "gold:35,xp:-10" },
    ]},
    { id: "ev5", name: "遗物商", text: "一个裹着斗篷的影子，摊位上只有三件东西。", options: [
      { label: "用 70 碎片换 1 件遗物", effect: "buyrelic:70" },
      { label: "离开", effect: "none" },
    ]},
    { id: "ev6", name: "破损的挡板", text: "上一任主人留下的挡板，边缘已经磨圆。", options: [
      { label: "换上（挡板宽度 +18）", effect: "perm:paddleW:18" },
      { label: "熔掉（+40 碎片）", effect: "gold:40" },
    ]},
    { id: "ev7", name: "静电云", text: "细小的电弧在砖缝之间跳。", options: [
      { label: "引雷（获得导电强化）", effect: "upgrade:thunder" },
      { label: "等它散去（+30 碎片）", effect: "gold:30" },
    ]},
    { id: "ev8", name: "维修站", text: "还能用的自动维修臂，只是校准很差。", options: [
      { label: "修复（+1 生命，-30 碎片）", effect: "healpay:1:30" },
      { label: "拆解（+2 护盾）", effect: "shield:2" },
    ]},
    { id: "ev9", name: "记忆碎片", text: "一段不属于你的记忆：有人在屏幕前反复练习接球。", options: [
      { label: "看完（+80 经验）", effect: "xp:80" },
      { label: "跳过（+20 碎片）", effect: "gold:20" },
    ]},
    { id: "ev10", name: "过载电容", text: "电容鼓包，但仍然可用。", options: [
      { label: "接入（伤害 +1，下关球速 +60）", effect: "perm:damage:1,risk:speed" },
      { label: "丢弃", effect: "none" },
    ]},
    { id: "ev11", name: "无名墓碑", text: "碑上刻着一串关卡编号，最后一位被磨掉了。", options: [
      { label: "默哀（+1 生命上限）", effect: "maxlife:1" },
      { label: "拓印（+50 碎片）", effect: "gold:50" },
    ]},
    { id: "ev12", name: "主机后门", text: "一个没有权限校验的入口。", options: [
      { label: "进入（直接跳到下一章，跳过 1 场战斗）", effect: "skip" },
      { label: "留作退路（+2 护盾）", effect: "shield:2" },
    ]},
  ];

  // ---------------------------------------------------------------- 协同
  const SYNERGIES = [
    { id: "sy1", name: "热震", need: ["f1", "c1"], desc: "灼烧 + 冻结：冻结破碎时额外造成 2 点范围伤害", mods: { shatter: 0.4 } },
    { id: "sy2", name: "导电爆裂", need: ["l1", "f2"], desc: "导电 + 爆裂：爆炸会传导到带电砖块", mods: { chainCount: 1 } },
    { id: "sy3", name: "冰电共振", need: ["c1", "l1"], desc: "冻结目标的导电跳跃伤害翻倍", mods: { chainDamage: 1 } },
    { id: "sy4", name: "精准贯穿", need: ["k1", "k2"], desc: "精准接球后的贯穿必定暴击", mods: { critMult: 0.5 } },
    { id: "sy5", name: "球海激光", need: ["m1", "e1"], desc: "每多一颗球，激光冷却 -8%", mods: { laserCd: -0.8 } },
    { id: "sy6", name: "磁吸分裂", need: ["e3", "m1"], desc: "分裂出的球也会被磁吸回正", mods: { magnet: 1 } },
    { id: "sy7", name: "熔炉护盾", need: ["f4", "c4"], desc: "护盾破碎时对全场造成 3 点灼烧伤害", mods: { burn: 1 } },
    { id: "sy8", name: "无人机阵列", need: ["e2", "e6"], desc: "无人机数量 +1", mods: { drones: 1 } },
    { id: "sy9", name: "极限球速", need: ["k6", "m4"], desc: "球速上限再 +80", mods: { maxSpeed: 80 } },
    { id: "sy10", name: "暴击雷暴", need: ["k4", "l5"], desc: "暴击时额外触发一次导电", mods: { charge: 1 } },
    { id: "sy11", name: "多重余烬", need: ["f3", "f5"], desc: "灼烧扩散范围 +1 格", mods: { burnSpread: 1 } },
    { id: "sy12", name: "绝对贯穿", need: ["k2", "r16"], desc: "贯穿次数 +1", mods: { pierce: 1 } },
  ];

  // ---------------------------------------------------------------- 商店
  const SHOP_OFFERS = [
    { kind: "upgrade", price: 70, label: "随机升级" },
    { kind: "relic", price: 95, label: "随机遗物" },
    { kind: "heal", price: 55, label: "恢复 1 点生命" },
    { kind: "shield", price: 40, label: "获得 2 层护盾" },
    { kind: "reroll", price: 25, label: "刷新本店" },
  ];

  const NODE_TYPES = {
    battle: { name: "战斗", code: "BATTLE", color: "#7cffb2" },
    elite: { name: "精英", code: "ELITE", color: "#ffc46b" },
    shop: { name: "商店", code: "SHOP", color: "#7fd8ff" },
    event: { name: "事件", code: "EVENT", color: "#b39cff" },
    supply: { name: "补给", code: "SUPPLY", color: "#9fd3a8" },
    boss: { name: "Boss", code: "BOSS", color: "#ff6b7e" },
  };

  const CONTENT = {
    CHAPTERS, LEVELS, BOSSES, UPGRADES, RELICS, PADDLES, EVENTS, SYNERGIES,
    SHOP_OFFERS, NODE_TYPES, ARCH,
  };
  root.CONTENT = CONTENT;
  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
})(typeof globalThis !== "undefined" ? globalThis : this);
