class_name SettingsPanel
extends Control

signal back_pressed

var _reset_armed := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	UiStyle.dim(self, 0.80)
	var v := UiStyle.panel_box(self, 800, 604)
	_build(v)


func _build(v: VBoxContainer) -> void:
	v.add_child(UiStyle.label("设置", 28, Pal.TEXT))
	v.add_child(UiStyle.label("SETTINGS · 全部选项即时生效并写入存档", 12, Pal.TEXT_DIM))
	var line := ColorRect.new()
	line.color = Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.25)
	line.custom_minimum_size = Vector2(0, 1)
	v.add_child(line)

	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 10)
	v.add_child(grid)

	_cell(grid, "扫描线 / CRT", ["关", "轻", "重"], int(Game.settings.crt), func(i):
		Game.set_setting("crt", i))
	_cell(grid, "屏幕抖动", ["关", "30%", "60%", "100%"], _idx_of([0.0, 0.3, 0.6, 1.0], float(Game.settings.shake)), func(i):
		Game.set_setting("shake", [0.0, 0.3, 0.6, 1.0][i]))
	_cell(grid, "粒子密度", ["关", "50%", "100%"], _idx_of([0.0, 0.5, 1.0], float(Game.settings.particles)), func(i):
		Game.set_setting("particles", [0.0, 0.5, 1.0][i]))
	_cell(grid, "伤害数字", ["关", "开"], 1 if bool(Game.settings.damage_numbers) else 0, func(i):
		Game.set_setting("damage_numbers", i == 1))
	_cell(grid, "残响引导（收尾辅助）", ["关", "开"], 1 if bool(Game.settings.echo_assist) else 0, func(i):
		Game.set_setting("echo_assist", i == 1))
	_cell(grid, "音乐音量", _pct_options(), int(round(float(Game.settings.music) * 10.0)), func(i):
		Game.set_setting("music", float(i) / 10.0))
	_cell(grid, "音效音量", _pct_options(), int(round(float(Game.settings.sfx) * 10.0)), func(i):
		Game.set_setting("sfx", float(i) / 10.0))
	_cell(grid, "垂直同步", ["关", "开"], 1 if bool(Game.settings.vsync) else 0, func(i):
		Game.set_setting("vsync", i == 1))
	_cell(grid, "显示帧率", ["关", "开"], 1 if bool(Game.settings.show_fps) else 0, func(i):
		Game.set_setting("show_fps", i == 1))
	if not OS.has_feature("web"):
		_cell(grid, "全屏", ["窗口", "全屏"], 1 if bool(Game.settings.fullscreen) else 0, func(i):
			Game.set_setting("fullscreen", i == 1)
			Game.apply_window_settings())
	else:
		_cell(grid, "全屏", ["由浏览器控制"], 0, func(_i): pass)

	var line2 := ColorRect.new()
	line2.color = Color(1, 1, 1, 0.06)
	line2.custom_minimum_size = Vector2(0, 1)
	v.add_child(line2)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var lab := UiStyle.label("存档 · 已通关 %d / %d" % [Game.progress["cleared"].size(), LevelDB.levels().size()], 13, Pal.TEXT_DIM)
	lab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(lab)
	var reset := UiStyle.button("重置全部进度", 13, 160)
	reset.pressed.connect(func():
		if not _reset_armed:
			_reset_armed = true
			reset.text = "再点一次确认"
			Audio.play("sfx_ui_move", -8.0)
		else:
			Game.reset_progress()
			reset.text = "已重置"
			_reset_armed = false
			Audio.play("sfx_ui_confirm", -8.0))
	row.add_child(reset)
	v.add_child(row)

	var note := UiStyle.label("存档：" + Game.save_path_absolute(), 10, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.5))
	note.autowrap_mode = TextServer.AUTOWRAP_ARBITRARY
	v.add_child(note)

	var back := UiStyle.button("返回", 16, 200)
	back.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	back.pressed.connect(func():
		Audio.play("sfx_ui_move", -10.0)
		back_pressed.emit())
	v.add_child(back)
	back.grab_focus.call_deferred()


func _pct_options() -> Array:
	var a: Array = []
	for i in range(11):
		a.append("%d%%" % (i * 10))
	return a


func _idx_of(table: Array, v: float) -> int:
	var best := 0
	var bd := 1e9
	for i in range(table.size()):
		var d: float = absf(float(table[i]) - v)
		if d < bd:
			bd = d
			best = i
	return best


func _cell(grid: GridContainer, title: String, options: Array, current: int, cb: Callable) -> void:
	var cell := VBoxContainer.new()
	cell.custom_minimum_size = Vector2(350, 0)
	cell.add_theme_constant_override("separation", 3)
	var l := UiStyle.label(title, 13, Color(Pal.TEXT.r, Pal.TEXT.g, Pal.TEXT.b, 0.8))
	cell.add_child(l)
	var st := {"i": clampi(current, 0, options.size() - 1)}
	var b := UiStyle.button(str(options[int(st["i"])]), 15, 350)
	b.custom_minimum_size = Vector2(350, 34)
	b.pressed.connect(func():
		st["i"] = (int(st["i"]) + 1) % options.size()
		b.text = str(options[int(st["i"])])
		Audio.play("sfx_ui_move", -14.0)
		cb.call(int(st["i"])))
	cell.add_child(b)
	grid.add_child(cell)
