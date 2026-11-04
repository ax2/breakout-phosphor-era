extends Node
## 与网页版对齐后的「内容 / Boss / 构筑 / 存档」测试。
## 用法：godot --headless --path . -- --selftest
## （走游戏本体启动，才能用上 Game / Run 这两个自动加载单例）

var _pass := 0
var _fail := 0


func run_tests() -> int:
	section("内容完整性（与网页版同一份数据）")
	check(ContentDB.chapters().size() == 6, "应为 6 章（实际 %d）" % ContentDB.chapters().size())
	check(ContentDB.levels().size() == 48, "应为 48 关（实际 %d）" % ContentDB.levels().size())
	check(ContentDB.bosses().size() == 6, "应为 6 个 Boss（实际 %d）" % ContentDB.bosses().size())
	check(ContentDB.upgrades().size() == 36, "应为 36 项升级（实际 %d）" % ContentDB.upgrades().size())
	check(ContentDB.relics().size() == 18, "应为 18 件遗物（实际 %d）" % ContentDB.relics().size())
	check(ContentDB.paddles().size() == 6, "应为 6 种挡板（实际 %d）" % ContentDB.paddles().size())
	check(ContentDB.events().size() == 12, "应为 12 个事件（实际 %d）" % ContentDB.events().size())
	check(ContentDB.synergies().size() == 12, "应为 12 组协同（实际 %d）" % ContentDB.synergies().size())
	for chapter in ContentDB.chapters():
		var cid := str(chapter.get("id", ""))
		check(ContentDB.levels_of_chapter(cid).size() == 8, "%s 应为 8 关" % cid)

	section("七种砖块都能建出来")
	var legend := ContentDB.legend()
	var grid := BrickGrid.from_rows([
		"#TAB..XRS...",
		"............",
	], legend)
	check(grid.warnings.is_empty(), "网格不应有警告: %s" % str(grid.warnings))
	check(grid.destructible_total == 6, "可破坏砖应为 6（#TAB + RS，实际 %d）" % grid.destructible_total)
	check(grid.solids_alive == 1, "障碍砖应为 1（实际 %d）" % grid.solids_alive)
	check(grid.cell_at(7, 0).type == "regen", "R 应映射为 regen")
	check(grid.cell_at(8, 0).type == "shieldNode", "S 应映射为 shieldNode")

	section("六个 Boss 都可被击杀并推进阶段")
	for boss_def in ContentDB.bosses():
		var b := Boss.new(boss_def, 11)
		b.spawn()
		check(b.parts.size() == (boss_def.get("parts", []) as Array).size(), "%s 部件数不对" % str(boss_def.get("id")))
		# 逐个部件打掉（绕过无敌窗口，只验证血量与阶段链路）
		for part in b.parts:
			if part.role == "core":
				continue
			part.invuln = false
			part.hp = 1
			part.hp -= 1
			if part.hp <= 0:
				b.on_part_destroyed(part, null)
		var core := b.core()
		check(core != null, "%s 应有存活的核��" % str(boss_def.get("id")))
		if core != null:
			core.invuln = false
			core.hp = 0
			b.hp = 0
			b.check_phase(null)
			check(b.is_dead(), "%s 核心清零后应判定死亡" % str(boss_def.get("id")))
		check(b.phase >= 0, "%s 阶段索引应有效" % str(boss_def.get("id")))

	section("构筑属性聚合")
	Run.start_run("expedition", "p1", 12345)
	var base := Run.compute_mods()
	check(absf(float(base.get("damage", 0.0)) - 1.0) < 0.001, "初始伤害应为 1")
	Run.add_upgrade("k3")     # 伤害 +1
	Run.add_upgrade("k6")     # 球速上限 +120，初始 +40
	var m2 := Run.compute_mods()
	check(absf(float(m2.get("damage", 0.0)) - 2.0) < 0.001, "k3 后伤害应为 2（实际 %.2f）" % float(m2.get("damage", 0.0)))
	check(float(m2.get("startSpeed", 0.0)) > 520.0, "k6 应提高初始球速")
	Run.add_relic("r11")      # 挡板宽 +20
	check(float(Run.compute_mods().get("paddleW", 0.0)) >= 152.0, "r11 应加宽挡板")
	# 乘算项：paddleSpeed 走乘法
	Run.paddle_id = "p2"
	var m3 := Run.compute_mods()
	check(absf(float(m3.get("paddleSpeed", 0.0)) - 0.92) < 0.02, "p2 的 paddleSpeed 应乘算为 0.92（实际 %.2f）" % float(m3.get("paddleSpeed", 0.0)))

	section("三模式路由")
	for mode in ["classic", "expedition", "endless"]:
		Run.start_run(str(mode), "p1", 777)
		check(Run.chapters.size() == (6 if str(mode) == "classic" else (1 if str(mode) == "endless" else 3)),
			"%s 的章节数不对（实际 %d）" % [str(mode), Run.chapters.size()])
		check(Run.route.size() == 5, "%s 路由应为 5 行（实际 %d）" % [str(mode), Run.route.size()])
		check(str((Run.route[4] as Array)[0]) == "boss", "%s 最后一行应是 Boss" % str(mode))

	section("远征结算与经济")
	Run.start_run("expedition", "p1", 4242)
	var before := Run.gold
	var res := Run.finish_node(true, {"bricks": 12})
	check(Run.gold > before, "打完节点应获得碎片")
	check(int(res.get("level_ups", 0)) >= 0, "等级结算应返回升级次数")
	check(Run.row == 1, "节点结算后行号应 +1")

	section("事件与商店效果")
	Run.start_run("expedition", "p1", 999)
	var g0 := Run.gold
	Run.apply_effect("gold:45")
	check(Run.gold == g0 + 45, "gold:45 应加 45 碎片（实际 %d）" % Run.gold)
	Run.hp = 1
	Run.apply_effect("heal:1")
	check(Run.hp == 2, "heal:1 应回 1 点生命")
	var up0 := Run.upgrades.size()
	Run.apply_effect("upgrade")
	check(Run.upgrades.size() >= up0, "upgrade 效果应能拿到升级")
	check(ContentDB.shop_offers().size() == 5, "商店应有 5 种商品")
	for e in ContentDB.events():
		check(not (e.get("options", []) as Array).is_empty(), "事件 %s 应有选项" % str(e.get("id")))
		for o in e.get("options", []):
			check(str(o.get("effect", "")) != "", "事件 %s 的选项缺 effect" % str(e.get("id")))

	section("存档 v2 → v3 迁移")
	var v2 := {
		"version": 2,
		"settings": {"crt": 2},
		"progress": {"cleared": {"s1_01": {"score": 900}}, "best": {"s1_01": 900}, "total_bricks": 40},
		"records": {"best_combo": 6, "best_score": 900},
	}
	var migrated: Dictionary = Game._migrate(v2, 2)
	check(int(migrated.get("version", 0)) == 3, "迁移后版本应为 3")
	var mm: Dictionary = migrated.get("meta", {})
	check((mm.get("cleared", {}) as Dictionary).has("s1_01"), "旧 cleared 应并入 meta")
	check(int(mm.get("totalBricks", 0)) >= 40, "累计砖块应并入 meta")
	check(int(migrated.get("settings", {}).get("crt", 0)) == 2, "设置应保留")

	section("成就与解锁判定")
	Game.meta["cleared"] = {"c1_01": {"score": 1}}
	Game.meta["bestCombo"] = 12
	Game.meta["bestChapter"] = 1
	Run.sync_meta()
	check((Game.meta.get("achievements", []) as Array).has("a1"), "应解锁成就 a1")
	check((Game.meta.get("achievements", []) as Array).has("a2"), "应解锁成就 a2")
	check(Run.has_paddle("p2"), "通关第一章应解锁 p2 挡板")

	print("")
	print("===================================================")
	print("通过 %d 项 / 失败 %d 项" % [_pass, _fail])
	print("===================================================")
	return 1 if _fail > 0 else 0


func section(name: String) -> void:
	print("· %s" % name)


func check(ok: bool, msg: String) -> void:
	if ok:
		_pass += 1
	else:
		_fail += 1
		print("  FAIL [%s]" % msg)
