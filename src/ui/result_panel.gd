class_name ResultPanel
extends Control

signal retry_pressed
signal next_pressed
signal levels_pressed

var summary: Dictionary = {}
var level: Dictionary = {}
var can_next := false
var _t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	UiStyle.dim(self, 0.74)
	var win := bool(summary.get("win", false))
	var v := UiStyle.panel_box(self, 600, 452, Color(0.95, 0.75, 0.42, 0.6) if win else Color(0.9, 0.35, 0.42, 0.55))
	v.add_child(UiStyle.label("清关" if win else "信号丢失", 34, Pal.AMBER if win else Pal.ROSE))
	var sub := "LEVEL CLEARED" if win else "RUN TERMINATED"
	v.add_child(UiStyle.label("%s · %s" % [sub, str(level.get("codename", ""))], 12, Pal.TEXT_DIM))
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 6)
	v.add_child(sp)

	v.add_child(UiStyle.stat_row("章节", str(LevelDB.chapter_of(level).get("name", ""))))
	v.add_child(UiStyle.stat_row("得分", "%06d" % int(summary.get("score", 0)), Pal.AMBER))
	v.add_child(UiStyle.stat_row("用时", "%.1f s" % float(summary.get("time", 0.0))))
	v.add_child(UiStyle.stat_row("击碎砖块 / 命中", "%d / %d" % [int(summary.get("bricks", 0)), int(summary.get("hits", 0))]))
	v.add_child(UiStyle.stat_row("最高连锁", "×%d" % int(summary.get("max_combo", 0)), Pal.PHOSPHOR))
	v.add_child(UiStyle.stat_row("辅助触发", "%d 次" % int(summary.get("assists", 0))))
	if win:
		v.add_child(UiStyle.stat_row("剩余生命奖励", "+%d" % int(summary.get("clear_bonus", 0)), Pal.PHOSPHOR))
	if int(summary.get("best", 0)) > 0:
		v.add_child(UiStyle.stat_row("历史最佳", "%06d" % int(summary.get("best", 0))))

	var sp2 := Control.new()
	sp2.custom_minimum_size = Vector2(0, 6)
	v.add_child(sp2)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var b1 := UiStyle.button("重试", 16, 150)
	b1.pressed.connect(func(): retry_pressed.emit())
	row.add_child(b1)
	if can_next:
		var b2 := UiStyle.button("下一关", 16, 150)
		b2.pressed.connect(func(): next_pressed.emit())
		row.add_child(b2)
	var b3 := UiStyle.button("返回关卡", 16, 150)
	b3.pressed.connect(func(): levels_pressed.emit())
	row.add_child(b3)
	v.add_child(row)
	(b1 if can_next == false else row.get_child(1)).grab_focus.call_deferred()


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	# 结算面板背后的一层轻微扫描，增强「终端报告」感
	for i in range(3):
		var y := 120.0 + i * 200.0 + fmod(_t * 12.0 + i * 70.0, 40.0)
		draw_line(Vector2(280, y), Vector2(1000, y), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.02), 1.0)
