class_name CodexScreen
extends Control
## 图鉴与成就。数据全部来自 Game.meta 与 ContentDB。

signal back_pressed


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	_build()


func _build() -> void:
	var back := UiStyle.button("返回", 16, 140)
	back.position = Vector2(72, 640)
	back.pressed.connect(func():
		Audio.play("sfx_ui_move", -10.0)
		back_pressed.emit())
	add_child(back)


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Pal.BG, true)
	for i in range(12):
		var f2 := float(i) / 11.0
		draw_rect(Rect2(0, i * 60, 1280, 61), Pal.BG.lerp(Pal.BG_2, f2 * 0.45), true)

	var f := UiStyle.font()
	draw_string(f, Vector2(72, 92), "CODEX", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.55))
	draw_string(f, Vector2(72, 146), "图鉴与成就", HORIZONTAL_ALIGNMENT_LEFT, -1, 40, Pal.TEXT)

	var codex: Dictionary = Game.meta.get("codex", {})
	var c_lv: Array = codex.get("levels", [])
	var c_up: Array = codex.get("upgrades", [])
	var c_re: Array = codex.get("relics", [])
	var c_bo: Array = codex.get("bosses", [])

	# 左列：收集进度
	var x := 72.0
	var y := 210.0
	draw_string(f, Vector2(x, y), "收集", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.PHOSPHOR)
	y += 30.0
	var stats := [
		["关卡", "%d / %d" % [c_lv.size(), LevelDB.levels().size()]],
		["升级", "%d / %d" % [c_up.size(), ContentDB.upgrades().size()]],
		["遗物", "%d / %d" % [c_re.size(), ContentDB.relics().size()]],
		["Boss", "%d / %d" % [c_bo.size(), ContentDB.bosses().size()]],
		["累计击碎", "%d 块" % int(Game.meta.get("totalBricks", 0))],
		["远征完成", "%d 次" % int(Game.meta.get("wins", 0))],
		["无尽最高层", "%d" % int(Game.meta.get("endlessBest", 0))],
	]
	for s in stats:
		draw_string(f, Vector2(x, y), str(s[0]), HORIZONTAL_ALIGNMENT_LEFT, 160, 15, Pal.TEXT_DIM)
		draw_string(f, Vector2(x + 160, y), str(s[1]), HORIZONTAL_ALIGNMENT_LEFT, 200, 15, Pal.TEXT)
		y += 26.0

	y += 16.0
	draw_string(f, Vector2(x, y), "挡板", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.PHOSPHOR)
	y += 28.0
	for p in ContentDB.paddles():
		var pid := str(p.get("id", ""))
		var owned := Run.has_paddle(pid)
		var col := Pal.TEXT if owned else Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.55)
		draw_string(f, Vector2(x, y), "%s %s" % ["●" if owned else "○", str(p.get("name", pid))], HORIZONTAL_ALIGNMENT_LEFT, 300, 15, col)
		draw_string(f, Vector2(x + 200, y), str(p.get("desc", "")), HORIZONTAL_ALIGNMENT_LEFT, 460, 13, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.8))
		y += 24.0

	# 右列：成就
	var rx := 660.0
	var ry := 210.0
	draw_string(f, Vector2(rx, ry), "成就", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.PHOSPHOR)
	ry += 30.0
	for a in Run.achievement_list():
		var got := bool(a.get("got", false))
		var col := Pal.AMBER if got else Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.55)
		draw_string(f, Vector2(rx, ry), "%s %s" % ["✔" if got else "✕", str(a.get("name", ""))], HORIZONTAL_ALIGNMENT_LEFT, 300, 16, col)
		draw_string(f, Vector2(rx, ry + 20), str(a.get("desc", "")), HORIZONTAL_ALIGNMENT_LEFT, 520, 13, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.75))
		ry += 50.0
