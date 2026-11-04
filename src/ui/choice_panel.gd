class_name ChoicePanel
extends Control
## 通用三选一面板：升级奖励 / 遗物奖励 / 商店 / 事件 都用它。
## 只负责展示与回传索引，不碰任何玩法状态。

signal picked(index: int)
signal cancelled

var title: String = "选择"
var subtitle: String = ""
var footer: String = ""
var can_cancel: bool = false
## 每项：{"title":String, "desc":String, "cost":int(0=免费), "accent":Color, "enabled":bool}
var options: Array = []

var _built := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	_build()


func setup(t: String, sub: String, opts: Array, foot: String = "", cancel: bool = false) -> void:
	title = t
	subtitle = sub
	options = opts
	footer = foot
	can_cancel = cancel
	if is_inside_tree():
		_build()


func _build() -> void:
	for c in get_children():
		c.queue_free()
	_built = true

	var n := options.size()
	var w := 380.0
	var gap := 20.0
	var total := n * w + maxi(0, n - 1) * gap
	var x0 := (1280.0 - total) * 0.5
	var y0 := 258.0
	for i in range(n):
		var opt: Dictionary = options[i]
		var b := Button.new()
		b.position = Vector2(x0 + i * (w + gap), y0)
		b.size = Vector2(w, 250)
		b.custom_minimum_size = Vector2(w, 250)
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var enabled := bool(opt.get("enabled", true))
		b.disabled = not enabled
		var accent: Color = opt.get("accent", Pal.PHOSPHOR)
		var txt := "%s\n\n%s" % [str(opt.get("title", "")), str(opt.get("desc", ""))]
		var cost := int(opt.get("cost", 0))
		if cost > 0:
			txt += "\n\n花费 %d 碎片" % cost
		if not enabled:
			txt += "\n（碎片不足）"
		b.text = txt
		b.add_theme_font_size_override("font_size", 17)
		b.add_theme_color_override("font_color", Pal.TEXT if enabled else Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.5))
		b.add_theme_color_override("font_hover_color", Pal.TEXT)
		b.add_theme_stylebox_override("normal", UiStyle.box(Color(0.03, 0.07, 0.06, 0.94), Color(accent.r, accent.g, accent.b, 0.45), 1, 2, 18))
		b.add_theme_stylebox_override("hover", UiStyle.box(Color(0.05, 0.13, 0.10, 0.96), Color(accent.r, accent.g, accent.b, 0.95), 2, 2, 18))
		b.add_theme_stylebox_override("pressed", UiStyle.box(Color(0.02, 0.05, 0.04, 0.98), Color(accent.r, accent.g, accent.b, 1.0), 2, 2, 18))
		b.add_theme_stylebox_override("disabled", UiStyle.box(Color(0.02, 0.04, 0.04, 0.9), Color(0.3, 0.3, 0.3, 0.3), 1, 2, 18))
		var idx := i
		b.pressed.connect(func():
			Audio.play("sfx_ui_confirm", -8.0)
			picked.emit(idx))
		add_child(b)

	if can_cancel:
		var cb := UiStyle.button("跳过", 16, 140)
		cb.position = Vector2(640 - 70, 540)
		cb.pressed.connect(func():
			Audio.play("sfx_ui_move", -10.0)
			cancelled.emit())
		add_child(cb)


func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color(0.01, 0.02, 0.025, 0.90), true)
	var f := UiStyle.font()
	draw_string(f, Vector2(0, 120), subtitle, HORIZONTAL_ALIGNMENT_CENTER, 1280, 13, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.6))
	draw_string(f, Vector2(0, 182), title, HORIZONTAL_ALIGNMENT_CENTER, 1280, 40, Pal.TEXT)
	draw_line(Vector2(460, 206), Vector2(820, 206), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.22), 1.0)
	if footer != "":
		draw_string(f, Vector2(0, 578), footer, HORIZONTAL_ALIGNMENT_CENTER, 1280, 14, Pal.TEXT_DIM)
