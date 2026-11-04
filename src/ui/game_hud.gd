class_name GameHud
extends Control
## 战斗内 HUD。刻意只占顶部 56px，不遮挡反弹空间。
## 远征模式下显示 Run 的生命池与碎片，普通关卡显示模拟层的剩余生命。

var sim: BreakoutSim
var level: Dictionary
var input_mode: String = "mouse"
var in_run: bool = false
var _t: float = 0.0
var _toast_text: String = ""
var _toast_t: float = 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)


func toast(text: String) -> void:
	_toast_text = text
	_toast_t = 2.6


func _process(delta: float) -> void:
	_t += delta
	if _toast_t > 0.0:
		_toast_t -= delta
	queue_redraw()


func _draw() -> void:
	if sim == null:
		return
	var f := UiStyle.font()
	var x := GC.WALL_L

	# 左：生命
	draw_string(f, Vector2(x, 22), "生命", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.85))
	var px := x + 34.0
	var cur := Run.hp if in_run else sim.lives
	var cap := Run.max_hp if in_run else 3
	var low := cur <= 1
	for i in range(maxi(cur, 0)):
		var c := Pal.ROSE if low else Pal.PHOSPHOR
		var pulse := (0.55 + 0.45 * sin(_t * 9.0)) if low else 1.0
		draw_rect(Rect2(px, 14, 15, 8), Color(c.r, c.g, c.b, 0.9 * pulse), true)
		draw_rect(Rect2(px + 2, 16, 11, 4), Color(0, 0, 0, 0.6), true)
		px += 20.0
	for i in range(maxi(0, cap - cur)):
		draw_rect(Rect2(px, 14, 15, 8), Color(1, 1, 1, 0.06), true)
		px += 20.0

	# 左：分数
	var sx := x + 132.0
	draw_string(f, Vector2(sx, 22), "SCORE", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.85))
	draw_string(f, Vector2(sx + 40, 23), "%06d" % sim.score, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Pal.TEXT)

	# 中：章节 + 关卡
	var ch := LevelDB.chapter_of(level)
	var title := "%s  ·  %s" % [str(ch.get("name", "")), str(level.get("name", ""))]
	draw_string(f, Vector2(0, 22), title, HORIZONTAL_ALIGNMENT_CENTER, 1280, 15, Color(Pal.TEXT.r, Pal.TEXT.g, Pal.TEXT.b, 0.92))
	draw_string(f, Vector2(0, 35), str(ch.get("code", ch.get("codename", ""))), HORIZONTAL_ALIGNMENT_CENTER, 1280, 9, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.35))

	# 右：球速 / 剩余 / 输入
	var spd := int(round(sim.ball_speed()))
	var right := "球速 %d   ·   剩余 %d" % [spd, sim.grid.destructible_alive if sim.grid != null else 0]
	if in_run:
		right = "球速 %d   ·   碎片 %d   ·   等级 %d" % [spd, Run.gold, Run.level + 1]
	draw_string(f, Vector2(0, 22), right, HORIZONTAL_ALIGNMENT_RIGHT, GC.WALL_R, 13, Color(Pal.TEXT.r, Pal.TEXT.g, Pal.TEXT.b, 0.8))
	draw_string(f, Vector2(0, 34), "INPUT %s" % ("MOUSE" if input_mode == "mouse" else "KEYBOARD"), HORIZONTAL_ALIGNMENT_RIGHT, GC.WALL_R, 9, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.6))

	# 清关进度条（Boss 关改用 Boss 血条）
	var total := 0 if sim.grid == null else sim.grid.destructible_total
	if sim.boss != null:
		var pct := clampf(float(sim.boss.hp) / float(maxi(1, sim.boss.max_hp)), 0.0, 1.0)
		draw_rect(Rect2(GC.WALL_L, 44, GC.ARENA_W, 3), Color(1, 1, 1, 0.06), true)
		draw_rect(Rect2(GC.WALL_L, 44, GC.ARENA_W * pct, 3), Color(Pal.ROSE.r, Pal.ROSE.g, Pal.ROSE.b, 0.75), true)
		draw_string(f, Vector2(GC.WALL_L, 74), "%s · 阶段 %d · %d/%d" % [
			str(sim.boss.def.get("name", "Boss")), sim.boss.phase + 1, sim.boss.hp, sim.boss.max_hp,
		], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(Pal.ROSE.r, Pal.ROSE.g, Pal.ROSE.b, 0.85))
		if sim.boss.window > 0.0:
			draw_string(f, Vector2(0, 74), "核心暴露 %.1fs" % sim.boss.window, HORIZONTAL_ALIGNMENT_RIGHT, GC.WALL_R, 11, Pal.AMBER)
	elif total > 0:
		var alive := sim.grid.destructible_alive
		var ratio := 1.0 - float(alive) / float(total)
		draw_rect(Rect2(GC.WALL_L, 44, GC.ARENA_W, 2), Color(1, 1, 1, 0.05), true)
		draw_rect(Rect2(GC.WALL_L, 44, GC.ARENA_W * ratio, 2), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.65), true)

	# 提示（Boss 窗口 / 阶段 / 掉血等）
	if _toast_t > 0.0 and _toast_text != "":
		var a := clampf(_toast_t / 0.6, 0.0, 1.0)
		draw_string(f, Vector2(0, 108), _toast_text, HORIZONTAL_ALIGNMENT_CENTER, 1280, 16, Color(Pal.AMBER.r, Pal.AMBER.g, Pal.AMBER.b, a))
	if sim.shield > 0:
		draw_string(f, Vector2(GC.WALL_L, 690), "护盾 ×%d" % sim.shield, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(Pal.CYAN.r, Pal.CYAN.g, Pal.CYAN.b, 0.8))

	if Game.settings.show_fps:
		draw_string(f, Vector2(GC.WALL_L, 700), "%d FPS" % Engine.get_frames_per_second(), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Pal.TEXT_DIM)
