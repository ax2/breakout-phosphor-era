class_name BuildPanel
extends Control
## 战斗内构筑速览（TAB 打开）。只读 Run 的状态，不改任何东西。

signal closed


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	set_process_unhandled_input(true)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode in [KEY_TAB, KEY_ESCAPE, KEY_P]:
			closed.emit()
			accept_event()
	elif event is InputEventMouseButton and event.pressed:
		closed.emit()
		accept_event()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color(0.01, 0.02, 0.025, 0.88), true)
	var f := UiStyle.font()
	draw_string(f, Vector2(0, 78), "BUILD / 构筑", HORIZONTAL_ALIGNMENT_CENTER, 1280, 30, Pal.TEXT)
	draw_string(f, Vector2(0, 104), "TAB 或 ESC 关闭 · 本局只在这次远征里有效", HORIZONTAL_ALIGNMENT_CENTER, 1280, 13, Pal.TEXT_DIM)

	var y := 160.0
	draw_string(f, Vector2(120, y), "升级 %d" % Run.upgrades.size(), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.CYAN)
	y += 28.0
	if Run.upgrades.is_empty():
		draw_string(f, Vector2(140, y), "还没有升级", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Pal.TEXT_DIM)
		y += 24.0
	for id in Run.upgrades:
		var u := ContentDB.upgrade_by_id(str(id))
		var arch := str(u.get("arch", ""))
		var ad: Dictionary = ContentDB.arch().get(arch, {})
		var col := Color(str(ad.get("color", "#7cffb2")))
		draw_string(f, Vector2(140, y), "· %s" % str(u.get("name", id)), HORIZONTAL_ALIGNMENT_LEFT, 320, 16, col)
		draw_string(f, Vector2(500, y), str(u.get("desc", "")), HORIZONTAL_ALIGNMENT_LEFT, 660, 14, Pal.TEXT_DIM)
		y += 26.0

	y += 18.0
	draw_string(f, Vector2(120, y), "遗物 %d" % Run.relics.size(), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.VIOLET)
	y += 28.0
	if Run.relics.is_empty():
		draw_string(f, Vector2(140, y), "还没有遗物", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Pal.TEXT_DIM)
		y += 24.0
	for id in Run.relics:
		var r := ContentDB.relic_by_id(str(id))
		draw_string(f, Vector2(140, y), "· %s" % str(r.get("name", id)), HORIZONTAL_ALIGNMENT_LEFT, 320, 16, Pal.AMBER)
		draw_string(f, Vector2(500, y), str(r.get("desc", "")), HORIZONTAL_ALIGNMENT_LEFT, 660, 14, Pal.TEXT_DIM)
		y += 26.0

	y += 18.0
	var syn := Run.active_synergies()
	draw_string(f, Vector2(120, y), "协同 %d" % syn.size(), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.PHOSPHOR)
	y += 28.0
	if syn.is_empty():
		draw_string(f, Vector2(140, y), "凑齐两件指定升级/遗物即可触发协同", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Pal.TEXT_DIM)
	else:
		for s in syn:
			draw_string(f, Vector2(140, y), "· %s — %s" % [str(s.get("name", "")), str(s.get("desc", ""))], HORIZONTAL_ALIGNMENT_LEFT, 900, 15, Pal.PHOSPHOR)
			y += 24.0

	# 数值面板
	var m := Run.compute_mods()
	var bx := 900.0
	var by := 160.0
	draw_string(f, Vector2(bx, by), "当前数值", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Pal.TEXT)
	by += 30.0
	var rows := [
		["伤害", "%.1f" % float(m.get("damage", 1))],
		["暴击率", "%d%%" % int(float(m.get("critChance", 0.0)) * 100.0)],
		["暴击倍率", "%.1f" % float(m.get("critMult", 2.0))],
		["贯穿", "%d" % int(m.get("pierce", 0))],
		["球速", "%d" % int(float(m.get("startSpeed", 520.0)))],
		["挡板宽", "%d" % int(float(m.get("paddleW", GC.PADDLE_W)))],
		["护盾", "%d" % int(m.get("shieldCharges", 0))],
		["激光", ("%.1fs" % float(m.get("laserCd", 0.0))) if float(m.get("laserCd", 0.0)) > 0.0 else "—"],
		["无人机", "%d" % int(m.get("drones", 0))],
		["灼烧/冻结", "%d / %d%%" % [int(m.get("burn", 0)), int(float(m.get("freezeChance", 0.0)) * 100.0)]],
	]
	for row in rows:
		draw_string(f, Vector2(bx, by), str(row[0]), HORIZONTAL_ALIGNMENT_LEFT, 120, 14, Pal.TEXT_DIM)
		draw_string(f, Vector2(bx + 120, by), str(row[1]), HORIZONTAL_ALIGNMENT_LEFT, 120, 14, Pal.TEXT)
		by += 22.0
