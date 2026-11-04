class_name ExpeditionScreen
extends Control
## 远征路线图。每次只显示「当前这一行」的可选节点，上方是整条路线的进度。
## 节点类型来自 ContentDB.nodes()，与网页版同一份数据。

signal node_chosen(index: int)
signal back_pressed
signal build_pressed

const NODE_DESC := {
	"battle": "普通战斗：清空砖阵，按进度给碎片与经验",
	"elite": "精英关：球速更高，碎片更多",
	"shop": "商店：用碎片换升级或遗物",
	"event": "事件：二选一，代价与收益都写清楚了",
	"supply": "补给：直接回血或拿碎片",
	"boss": "Boss：章节终点，打完进下一章",
}

var _t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	_build()
	set_process(true)


func _build() -> void:
	for c in get_children():
		c.queue_free()

	var opts := Run.current_options()
	var n := opts.size()
	var w := 320.0
	var gap := 24.0
	var total := n * w + maxi(0, n - 1) * gap
	var x0 := (1280.0 - total) * 0.5
	for i in range(n):
		var t := str(opts[i])
		var info: Dictionary = ContentDB.nodes().get(t, {})
		var accent := Color(str(info.get("color", "#7cffb2")))
		var b := Button.new()
		b.position = Vector2(x0 + i * (w + gap), 330)
		b.size = Vector2(w, 190)
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.text = "%s\n%s\n\n%s" % [str(info.get("name", t)), str(info.get("code", "")), str(NODE_DESC.get(t, ""))]
		b.add_theme_font_size_override("font_size", 16)
		b.add_theme_color_override("font_color", Pal.TEXT)
		b.add_theme_stylebox_override("normal", UiStyle.box(Color(0.03, 0.07, 0.06, 0.94), Color(accent.r, accent.g, accent.b, 0.5), 1, 2, 18))
		b.add_theme_stylebox_override("hover", UiStyle.box(Color(0.05, 0.13, 0.10, 0.96), Color(accent.r, accent.g, accent.b, 0.95), 2, 2, 18))
		b.add_theme_stylebox_override("pressed", UiStyle.box(Color(0.02, 0.05, 0.04, 0.98), Color(accent.r, accent.g, accent.b, 1.0), 2, 2, 18))
		var idx := i
		b.pressed.connect(func():
			Audio.play("sfx_ui_confirm", -8.0)
			node_chosen.emit(idx))
		add_child(b)

	var bb := UiStyle.button("查看构筑", 16, 160)
	bb.position = Vector2(560, 560)
	bb.pressed.connect(func(): build_pressed.emit())
	add_child(bb)

	var back := UiStyle.button("放弃远征", 15, 160)
	back.position = Vector2(72, 660)
	back.pressed.connect(func():
		Audio.play("sfx_ui_move", -10.0)
		back_pressed.emit())
	add_child(back)


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Pal.BG, true)
	for i in range(12):
		var f2 := float(i) / 11.0
		draw_rect(Rect2(0, i * 60, 1280, 61), Pal.BG.lerp(Pal.BG_2, f2 * 0.45), true)

	var f := UiStyle.font()
	var ch := Run.chapter_def()
	draw_string(f, Vector2(72, 96), "EXPEDITION · %s" % str(ch.get("code", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.55))
	draw_string(f, Vector2(72, 148), "第 %d 章 · %s" % [Run.chapter_pos + 1, str(ch.get("name", ""))], HORIZONTAL_ALIGNMENT_LEFT, -1, 36, Pal.TEXT)
	draw_string(f, Vector2(74, 178), str(ch.get("brief", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.9))

	# 状态条
	var x := 72.0
	draw_string(f, Vector2(x, 232), "生命 %d/%d" % [Run.hp, Run.max_hp], HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Pal.ROSE)
	draw_string(f, Vector2(x + 150, 232), "碎片 %d" % Run.gold, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Pal.AMBER)
	draw_string(f, Vector2(x + 300, 232), "等级 %d" % (Run.level + 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Pal.CYAN)
	draw_string(f, Vector2(x + 440, 232), "构筑 %d 项 · 遗物 %d 件" % [Run.upgrades.size(), Run.relics.size()], HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Pal.VIOLET)

	# 路线进度
	var rx := 72.0
	var ry := 268.0
	draw_string(f, Vector2(rx, ry + 12), "路线", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Pal.TEXT_DIM)
	rx += 60
	for r in range(Run.route.size()):
		var opts: Array = Run.route[r]
		var label := ""
		for o in opts:
			label += str(o).substr(0, 3).to_upper() + " "
		var done := r < Run.row
		var cur := r == Run.row
		var col := Pal.TEXT_DIM
		if done:
			col = Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.45)
		elif cur:
			col = Pal.PHOSPHOR
		draw_string(f, Vector2(rx + r * 150, ry + 12), label, HORIZONTAL_ALIGNMENT_LEFT, 140, 14, col)
		if cur:
			draw_line(Vector2(rx + r * 150, ry + 22), Vector2(rx + r * 150 + 44, ry + 22), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.9), 2.0)

	var sy := fmod(_t * 20.0, 760.0) - 20.0
	draw_rect(Rect2(0, sy, 1280, 2), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.025), true)
