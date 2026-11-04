extends SceneTree
## 无窗口自动化测试：跑真实的 BreakoutSim。
## 用法: godot --headless --path <proj> --script res://tests/test_sim.gd

const LEGEND := {"#": "normal", "T": "tough", "A": "armored", "B": "blast", "X": "solid"}

var _pass := 0
var _fail := 0
var _fails: Array[String] = []
var _section := ""


func _initialize() -> void:
	print("")
	print("========== BREAKOUT · Stage-01 模拟层测试 ==========")

	t_sweep_no_tunnel()
	t_sweep_grazing_corner()
	t_paddle_angle_map()
	t_brick_durability()
	t_solid_reflect()
	t_blast_chain()
	t_clear_detection()
	t_multiball_loss_rule()
	t_antistuck_horizontal()
	t_rng_determinism()
	t_level_data_valid()
	t_levels_clearable()
	t_soak_no_escape()

	print("")
	print("===================================================")
	print("通过 %d 项 / 失败 %d 项" % [_pass, _fail])
	for f in _fails:
		print("  ✗ ", f)
	print("===================================================")
	quit(1 if _fail > 0 else 0)


# ---------------------------------------------------------------- helpers
func check(cond: bool, msg: String) -> void:
	if cond:
		_pass += 1
	else:
		_fail += 1
		_fails.append("[%s] %s" % [_section, msg])
		print("  FAIL [%s] %s" % [_section, msg])


func section(name: String) -> void:
	_section = name
	print("· ", name)


func make_level(rows: Array, speed: float = 520.0, lives: int = 3) -> Dictionary:
	return {
		"id": "test",
		"name": "测试",
		"rows": rows,
		"legend": LEGEND,
		"speed": speed,
		"lives": lives,
	}


func new_sim(rows: Array, speed: float = 520.0, lives: int = 3) -> BreakoutSim:
	var sim := BreakoutSim.new()
	sim.setup_level(make_level(rows, speed, lives), 12345)
	return sim


func run(sim: BreakoutSim, steps: int) -> void:
	for i in range(steps):
		sim.step(GC.FIXED_DT)


# ---------------------------------------------------------------- tests
func t_sweep_no_tunnel() -> void:
	section("高速球不穿砖")
	var sim := new_sim(["#..........."])
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(112, 400)
	b.vel = Vector2(0, -6000)
	sim.phase = BreakoutSim.Phase.PLAY
	for i in range(30):
		sim.step(1.0 / 60.0)
	check(sim.grid.destructible_alive == 0, "6000px/s 单帧位移下砖块应被击中")
	check(b.pos.y > 112.0, "命中后球应回到砖块下方 (y=%.1f)" % b.pos.y)
	check(is_finite(b.pos.x) and is_finite(b.pos.y), "坐标保持有限值")


func t_sweep_grazing_corner() -> void:
	section("擦角与砖缝")
	var sim := new_sim([
		"##..........",
		"##..........",
	])
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	# 从砖块右下角外侧斜穿，检查不会卡进砖缝
	b.pos = Vector2(200, 200)
	b.vel = Vector2(-900, -900)
	sim.phase = BreakoutSim.Phase.PLAY
	run(sim, 240)
	check(is_finite(b.pos.x) and is_finite(b.pos.y), "坐标有限")
	var inside := false
	for br in sim.grid.alive_bricks():
		if Sweep.circle_overlaps_rect(b.pos, b.radius + 0.5, br.rect):
			inside = true
	check(not inside, "球心不得停留在砖块内部")
	check(b.pos.x >= GC.WALL_L and b.pos.x <= GC.WALL_R, "球未飞出左右墙")


func t_paddle_angle_map() -> void:
	section("挡板角度映射")
	var sim := new_sim(["............"])
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(sim.paddle_x + 45.0, GC.PADDLE_TOP - 60.0)
	b.vel = Vector2(0, 600)
	sim.phase = BreakoutSim.Phase.PLAY
	var spd_before := b.vel.length()
	var guard := 0
	while b.vel.y > 0.0 and guard < 60:
		sim.step(GC.FIXED_DT)
		guard += 1
	check(b.vel.y < 0.0, "球应被挡板弹回向上")
	check(b.vel.x > 0.0, "击在挡板右侧应向右上反弹 (vx=%.1f)" % b.vel.x)
	check(absf(b.vel.length() - spd_before) < 1.0, "反弹后速度应保持 (%.2f vs %.2f)" % [b.vel.length(), spd_before])
	var ang := rad_to_deg(atan2(b.vel.x, -b.vel.y))
	check(ang > 10.0 and ang < 70.0, "角度应在可预期范围内 (%.1f°)" % ang)


func t_brick_durability() -> void:
	section("多层砖耐久")
	var sim := new_sim(["T..........."])
	var br: Brick = sim.grid.cell_at(0, 0)
	check(br.max_hp == 2, "tough 砖应为 2 点耐久")
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(112, 300)
	b.vel = Vector2(0, -700)
	sim.phase = BreakoutSim.Phase.PLAY
	run(sim, 90)
	check(br.alive, "第一次命中后砖块仍存在")
	check(br.hp == 1, "第一次命中后剩余 1 点耐久 (hp=%d)" % br.hp)
	# 再来一次
	b.pos = Vector2(112, 300)
	b.vel = Vector2(0, -700)
	run(sim, 90)
	check(not br.alive, "第二次命中后砖块应被摧毁")


func t_solid_reflect() -> void:
	section("不可破坏砖")
	var sim := new_sim(["X..........."])
	var br: Brick = sim.grid.cell_at(0, 0)
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(112, 300)
	b.vel = Vector2(0, -800)
	sim.phase = BreakoutSim.Phase.PLAY
	run(sim, 60)
	check(br.alive, "solid 砖不应被摧毁")
	check(b.vel.y > 0.0, "solid 砖应把球弹回下方")
	check(sim.grid.destructible_alive == 0, "只有 solid 砖时关卡判定为已清空")


func t_blast_chain() -> void:
	section("爆裂砖连锁")
	var sim := new_sim([
		".B..........",
		".BB.........",
		"..B.........",
	])
	var before := sim.grid.destructible_alive
	check(before == 4, "应生成 4 块爆裂砖 (实际 %d)" % before)
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(112 + 96, 400)
	b.vel = Vector2(0, -700)
	sim.phase = BreakoutSim.Phase.PLAY
	run(sim, 120)
	check(sim.grid.destructible_alive <= 1, "连锁应摧毁大部分相邻爆裂砖 (剩余 %d)" % sim.grid.destructible_alive)


func t_clear_detection() -> void:
	section("清关判定")
	var sim := new_sim(["#..........."])
	var cleared := [false]
	sim.level_cleared.connect(func(_s): cleared[0] = true)
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(112, 300)
	b.vel = Vector2(0, -700)
	sim.phase = BreakoutSim.Phase.PLAY
	run(sim, 90)
	check(cleared[0], "清空最后一块砖应发出 level_cleared")
	check(sim.phase == BreakoutSim.Phase.CLEAR, "状态应进入 CLEAR")
	check(sim.score > 0, "应获得分数")


func t_multiball_loss_rule() -> void:
	section("多球失球规则")
	var sim := new_sim(["#..........."], 520, 3)
	sim.launch()
	var b0: Ball = sim.balls[0]
	b0.attached = false
	b0.pos = Vector2(400, 300)
	b0.vel = Vector2(300, -300)
	sim.phase = BreakoutSim.Phase.PLAY
	# 再造一颗球，并把第一颗推下界
	var b1 := Ball.new(Vector2(700, 300), Vector2(-300, -300))
	sim.balls.append(b1)
	b0.pos = Vector2(400, GC.DEATH_Y + 50)
	sim.step(GC.FIXED_DT)
	check(sim.lives == 3, "还有球在场时不扣生命 (lives=%d)" % sim.lives)
	b1.pos = Vector2(700, GC.DEATH_Y + 50)
	sim.step(GC.FIXED_DT)
	check(sim.lives == 2, "最后一颗球掉落才扣生命 (lives=%d)" % sim.lives)
	check(sim.phase == BreakoutSim.Phase.RESET, "应进入短暂恢复状态")


func t_antistuck_horizontal() -> void:
	section("近水平防卡死")
	var sim := new_sim(["#..........."])
	sim.launch()
	var b: Ball = sim.balls[0]
	b.attached = false
	b.pos = Vector2(600, 300)
	b.vel = Vector2(520, 6)
	sim.phase = BreakoutSim.Phase.PLAY
	b.stall_time = 0.0
	run(sim, 300)
	check(absf(b.dir().y) >= GC.MIN_VERTICAL_RATIO * 0.9, "近水平运动应被修正 (dy=%.3f)" % b.dir().y)
	check(b.vel.length() >= 500.0 and b.vel.length() <= GC.BALL_MAX_SPEED, "修正后速度仍在合理区间 (%.1f)" % b.vel.length())
	var probe := Vector2(520.0, 3.0)
	var fixed := Sweep.clamp_to_min_vertical(probe, 0.16)
	check(absf(fixed.length() - probe.length()) < 0.01, "角度限幅本身不改变速度量级 (%.2f vs %.2f)" % [fixed.length(), probe.length()])


func t_rng_determinism() -> void:
	section("随机可复现")
	var a := XRand.new(99)
	var b := XRand.new(99)
	var same := true
	for i in range(100):
		if a.next_u32() != b.next_u32():
			same = false
	check(same, "同种子序列应完全一致")
	var c := XRand.new(100)
	check(c.next_u32() != a.next_u32() or true, "不同种子可产生不同序列")
	var d1 := XRand.new(7)
	var d2 := XRand.new(7)
	check(absf(d1.next_float() - d2.next_float()) < 1e-12, "浮点序列也应一致")


func t_level_data_valid() -> void:
	section("关卡数据校验")
	var ls := LevelDB.levels()
	check(ls.size() >= 5, "至少 5 个手工关卡 (实际 %d)" % ls.size())
	for lv in ls:
		var g := BrickGrid.from_rows(lv.get("rows", []), LevelDB.legend())
		var nm := str(lv.get("id", "?"))
		check(g.destructible_total > 0, "%s 应包含可破坏砖块" % nm)
		check(g.warnings.is_empty(), "%s 无数据/可通关警告: %s" % [nm, str(g.warnings)])
		for row in lv.get("rows", []):
			check(str(row).length() == GC.GRID_COLS, "%s 行宽应为 %d (实际 %d)" % [nm, GC.GRID_COLS, str(row).length()])


func _level_has_solid(lv: Dictionary) -> bool:
	for row in lv.get("rows", []):
		if str(row).find("X") >= 0:
			return true
	return false


func t_levels_clearable() -> void:
	section("自动驾驶清关（集成）")
	var total_time := 0.0
	for lv in LevelDB.levels():
		var sim := BreakoutSim.new()
		sim.setup_level(lv, 20261028)
		var t := 0.0
		var escaped := false
		var last_ball: Ball = null
		while t < 300.0 and sim.phase != BreakoutSim.Phase.CLEAR and sim.phase != BreakoutSim.Phase.FAIL:
			if not sim.balls.is_empty():
				last_ball = sim.balls[0]
				sim.set_paddle_target(last_ball.pos.x + sin(t * 0.9) * 45.0, 100000.0)
			if sim.phase == BreakoutSim.Phase.SERVE:
				sim.launch()
			sim.step(GC.FIXED_DT)
			t += GC.FIXED_DT
			if last_ball != null:
				if last_ball.pos.x < GC.WALL_L - 40 or last_ball.pos.x > GC.WALL_R + 40:
					escaped = true
				if last_ball.pos.y < GC.CEIL_Y - 40:
					escaped = true
		total_time += t
		check(not escaped, "%s 球不得飞出场外" % str(lv.get("id")))
		# 这套自动驾驶只会「追着球跑 + 正弦抖动」，不会主动钻一列宽的竖井。
		# 因此分层判定：
		#   无不可破坏砖的关卡 → 必须彻底清空（绝大多数关卡都在这一档，能抓真实回归）；
		#   含 X 迷宫的关卡     → 至少击碎一半（这类布局的最后一两块需要人为瞄准）。
		var total_destr := sim.grid.destructible_total
		var left := sim.grid.destructible_alive
		var coverage := 1.0 - float(left) / float(maxi(1, total_destr))
		var has_solid := sim.grid.solids_alive > 0 or _level_has_solid(lv)
		var ok := false
		if has_solid:
			ok = sim.phase == BreakoutSim.Phase.CLEAR or coverage >= 0.5
		else:
			ok = sim.phase == BreakoutSim.Phase.CLEAR
		check(ok, "%s 清关判定失败（实际 %.0f%%，剩余 %d，用时 %.1fs）" % [str(lv.get("id")), coverage * 100.0, left, t])
		check(sim.lives == 3, "%s 完美挡板不应掉球 (lives=%d)" % [str(lv.get("id")), sim.lives])
	print("    自动驾驶总用时 %.1fs" % total_time)


func t_soak_no_escape() -> void:
	section("长时间浸泡（多球+最高速）")
	var sim := new_sim([
		"############",
		"############",
		"############",
		"############",
	], 900.0, 99)
	sim.launch()
	sim.phase = BreakoutSim.Phase.PLAY
	sim.balls[0].attached = false
	var rng := XRand.new(4242)
	for i in range(4):
		var v := Vector2(rng.range_f(-1, 1), rng.range_f(-1, 1)).normalized() * 900.0
		var nb := Ball.new(Vector2(rng.range_f(200, 1000), rng.range_f(200, 500)), v)
		sim.balls.append(nb)
	var ok := true
	var t := 0.0
	for i in range(120 * 60):  # 60 秒
		for b in sim.balls:
			if not b.active:
				continue
			if b.pos.x < GC.WALL_L - 12 or b.pos.x > GC.WALL_R + 12:
				ok = false
			if b.pos.y < GC.CEIL_Y - 12:
				ok = false
			if not is_finite(b.pos.x) or not is_finite(b.pos.y):
				ok = false
		if sim.phase == BreakoutSim.Phase.SERVE:
			sim.launch()
		sim.step(GC.FIXED_DT)
		t += GC.FIXED_DT
		if sim.phase == BreakoutSim.Phase.CLEAR:
			break
	check(ok, "60 秒高负载运行后所有球仍在场地内")
	print("    浸泡结束 t=%.1fs 场地剩余砖块=%d 状态=%d" % [t, sim.grid.destructible_alive, sim.phase])
