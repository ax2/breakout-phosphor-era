class_name MainMenuScreen
extends Control
## 主菜单：磷光终端风格。背景是缓慢漂移的砖块剪影，不参与任何模拟。

signal mode_pressed(mode: String)
signal levels_pressed
signal codex_pressed
signal settings_pressed
signal quit_pressed

var _t: float = 0.0
var _btn_box: VBoxContainer
var _first_btn: Button


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	_build()
	set_process(true)


func _build() -> void:
	var sub := UiStyle.label("PHOSPHOR ERA", 15, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.55))
	sub.position = Vector2(0, 352)
	sub.size = Vector2(1280, 20)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_constant_override("letter_spacing", 6)
	add_child(sub)

	_btn_box = VBoxContainer.new()
	_btn_box.position = Vector2(530, 372)
	_btn_box.custom_minimum_size = Vector2(220, 0)
	_btn_box.add_theme_constant_override("separation", 6)
	add_child(_btn_box)

	var b1 := UiStyle.button("经典远征", 17, 220)
	b1.pressed.connect(func():
		Audio.play("sfx_ui_confirm", -8.0)
		mode_pressed.emit("classic"))
	_btn_box.add_child(b1)
	_first_btn = b1

	var b2 := UiStyle.button("随机远征", 17, 220)
	b2.pressed.connect(func():
		Audio.play("sfx_ui_confirm", -8.0)
		mode_pressed.emit("expedition"))
	_btn_box.add_child(b2)

	var b3 := UiStyle.button("无尽回响", 17, 220)
	b3.pressed.connect(func():
		Audio.play("sfx_ui_confirm", -8.0)
		mode_pressed.emit("endless"))
	_btn_box.add_child(b3)

	var b4 := UiStyle.button("关卡选择", 17, 220)
	b4.pressed.connect(func():
		Audio.play("sfx_ui_move", -8.0)
		levels_pressed.emit())
	_btn_box.add_child(b4)

	var b5 := UiStyle.button("图鉴", 17, 220)
	b5.pressed.connect(func():
		Audio.play("sfx_ui_move", -8.0)
		codex_pressed.emit())
	_btn_box.add_child(b5)

	var b6 := UiStyle.button("设置", 17, 220)
	b6.pressed.connect(func():
		Audio.play("sfx_ui_move", -8.0)
		settings_pressed.emit())
	_btn_box.add_child(b6)

	if not OS.has_feature("web"):
		var b7 := UiStyle.button("退出", 17, 220)
		b7.pressed.connect(func(): quit_pressed.emit())
		_btn_box.add_child(b7)

	var hint := UiStyle.label("鼠标 / A D / ← →     空格或左键发球     ESC 暂停", 13, Pal.TEXT_DIM)
	hint.position = Vector2(0, 660)
	hint.size = Vector2(1280, 18)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(hint)

	var ver := UiStyle.label(_version_text(), 12, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.7))
	ver.position = Vector2(24, 690)
	ver.size = Vector2(700, 18)
	add_child(ver)

	var saveinfo := UiStyle.label(_save_text(), 12, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.55))
	saveinfo.position = Vector2(560, 690)
	saveinfo.size = Vector2(696, 18)
	saveinfo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(saveinfo)

	if _first_btn != null:
		_first_btn.grab_focus.call_deferred()


func _version_text() -> String:
	return "BUILD 0.3.0 · STAGE-03 · GODOT %s" % Engine.get_version_info().get("string", "")


func _save_text() -> String:
	var n: int = int(Game.progress["cleared"].size())
	return "存档：已通关 %d / %d · %s" % [n, LevelDB.levels().size(), Game.save_status]


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Pal.BG, true)
	# 竖向渐变
	for i in range(12):
		var f := float(i) / 11.0
		draw_rect(Rect2(0, i * 60, 1280, 61), Pal.BG.lerp(Pal.BG_2, f * 0.5), true)

	# 漂移砖块剪影
	var rows := 4
	for r in range(rows):
		for c in range(14):
			var phase := _t * 0.10 + float(c) * 0.16 + float(r) * 0.5
			var y := 60.0 + r * 46.0 + sin(phase) * 10.0
			var x := 20.0 + c * 92.0 + cos(phase * 0.7) * 14.0
			var a := 0.030 + 0.014 * sin(phase * 1.3)
			draw_rect(Rect2(x, y, 74, 26), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, a), false, 1.0)

	# 中央光环
	var ctr := Vector2(640, 250)
	for i in range(4):
		draw_arc(ctr, 150.0 + i * 16.0, 0.0, TAU, 96, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.05 - i * 0.008), 1.0, true)
	draw_arc(ctr, 150.0, _t * 0.35, _t * 0.35 + 2.2, 64, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.30), 1.6, true)
	draw_arc(ctr, 166.0, -_t * 0.22, -_t * 0.22 + 1.4, 64, Color(Pal.CYAN.r, Pal.CYAN.g, Pal.CYAN.b, 0.18), 1.2, true)

	var f := UiStyle.font()
	# 标题辉光（多层透明叠加，避免后处理开销）
	var title := "BREAKOUT"
	for i in range(3, 0, -1):
		draw_string(f, Vector2(0, 288 + i), title, HORIZONTAL_ALIGNMENT_CENTER, 1280, 86, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.055 * float(4 - i)))
	draw_string(f, Vector2(0, 288), title, HORIZONTAL_ALIGNMENT_CENTER, 1280, 86, Color("d9ffe9"))

	draw_string(f, Vector2(0, 332), "磷 光 纪 元", HORIZONTAL_ALIGNMENT_CENTER, 1280, 30, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.92))

	# 分隔线
	var lw := 240.0
	draw_line(Vector2(640 - lw, 378), Vector2(640 + lw, 378), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.22), 1.0)
	draw_line(Vector2(640 - 6, 378), Vector2(640 + 6, 378), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.9), 2.0)

	# 底部扫描带
	var sy := fmod(_t * 22.0, 760.0) - 20.0
	draw_rect(Rect2(0, sy, 1280, 2), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.03), true)
