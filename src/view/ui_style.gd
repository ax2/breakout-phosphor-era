class_name UiStyle
extends RefCounted
## 统一的字体、主题与样式盒。字体使用系统等宽字体（Consolas/Cascadia），
## 中文由系统字体回退补足，不打包任何第三方字体文件。

const FONT_STACK := ["Cascadia Mono", "Consolas", "Courier New", "Microsoft YaHei UI", "Microsoft YaHei"]

static var _font: Font = null


static func font() -> Font:
	if _font != null:
		return _font
	var f := SystemFont.new()
	f.font_names = PackedStringArray(FONT_STACK)
	f.allow_system_fallback = true
	f.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
	f.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	f.hinting = TextServer.HINTING_LIGHT
	_font = f
	return _font


static func box(bg: Color, border: Color, bw: int = 1, radius: int = 2, pad: int = 12) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = pad
	sb.content_margin_right = pad
	sb.content_margin_top = maxi(6, pad - 4)
	sb.content_margin_bottom = maxi(6, pad - 4)
	return sb


static func make_theme() -> Theme:
	var th := Theme.new()
	th.default_font = font()
	th.default_font_size = 18

	th.set_color("font_color", "Label", Pal.TEXT)
	th.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0))

	th.set_stylebox("normal", "Button", box(Color("0a1512"), Color("2c5c4a"), 1, 2, 18))
	th.set_stylebox("hover", "Button", box(Color("10261f"), Pal.PHOSPHOR, 1, 2, 18))
	th.set_stylebox("pressed", "Button", box(Color("16382c"), Pal.PHOSPHOR, 1, 2, 18))
	th.set_stylebox("focus", "Button", box(Color(0, 0, 0, 0), Pal.PHOSPHOR, 2, 2, 18))
	th.set_stylebox("disabled", "Button", box(Color("080d0b"), Color("1b2b25"), 1, 2, 18))
	th.set_color("font_color", "Button", Pal.TEXT)
	th.set_color("font_hover_color", "Button", Color("c8ffe2"))
	th.set_color("font_pressed_color", "Button", Color.WHITE)
	th.set_color("font_disabled_color", "Button", Color("42574e"))
	th.set_font_size("font_size", "Button", 18)

	th.set_stylebox("panel", "Panel", box(Color("07100d"), Color("244a3d"), 1, 2, 20))
	th.set_stylebox("panel", "PanelContainer", box(Color("07100d"), Color("244a3d"), 1, 2, 20))

	th.set_stylebox("background", "ProgressBar", box(Color("0a1512"), Color("1e3a30"), 1, 1, 0))
	th.set_stylebox("fill", "ProgressBar", box(Pal.PHOSPHOR_DIM, Pal.PHOSPHOR, 0, 1, 0))

	th.set_constant("separation", "VBoxContainer", 10)
	th.set_constant("separation", "HBoxContainer", 10)
	return th


static func label(text: String, size: int = 18, color: Color = Pal.TEXT, align: int = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font())
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = align
	return l


static func rich(text: String, size: int = 18, color: Color = Pal.TEXT) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.text = text
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_override("normal_font", font())
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_color_override("default_color", color)
	return r


static func button(text: String, size: int = 18, min_w: int = 220) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, 44)
	b.add_theme_font_override("font", font())
	b.add_theme_font_size_override("font_size", size)
	b.focus_mode = Control.FOCUS_ALL
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	return b


static func spacer(h: int = 8) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(0, h)
	return c


## 画一个带四角标记的面板（终端窗口感）
static func draw_bracket_panel(ci: CanvasItem, rect: Rect2, color: Color, width: float = 1.5, arm: float = 14.0) -> void:
	ci.draw_rect(rect, color, false, width)
	ci.draw_line(rect.position, rect.position + Vector2(arm, 0), color, width + 0.6)
	ci.draw_line(rect.position, rect.position + Vector2(0, arm), color, width + 0.6)
	ci.draw_line(Vector2(rect.end.x, rect.position.y), Vector2(rect.end.x - arm, rect.position.y), color, width + 0.6)
	ci.draw_line(Vector2(rect.end.x, rect.position.y), Vector2(rect.end.x, rect.position.y + arm), color, width + 0.6)
	ci.draw_line(Vector2(rect.position.x, rect.end.y), Vector2(rect.position.x + arm, rect.end.y), color, width + 0.6)
	ci.draw_line(Vector2(rect.position.x, rect.end.y), Vector2(rect.position.x, rect.end.y - arm), color, width + 0.6)
	ci.draw_line(rect.end, rect.end - Vector2(arm, 0), color, width + 0.6)
	ci.draw_line(rect.end, rect.end - Vector2(0, arm), color, width + 0.6)


## 全屏压暗层（用于暂停/结算/设置）
static func dim(parent: Control, alpha: float = 0.72) -> void:
	var d := ColorRect.new()
	d.color = Color(0.01, 0.02, 0.02, alpha)
	d.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	d.mouse_filter = Control.MOUSE_FILTER_STOP
	parent.add_child(d)


## 居中面板，返回可继续填充的 VBox
static func panel_box(parent: Control, w: int, h: int, border: Color = Color(0.30, 0.80, 0.58, 0.55)) -> VBoxContainer:
	var pc := PanelContainer.new()
	pc.custom_minimum_size = Vector2(w, h)
	pc.position = Vector2(640.0 - w * 0.5, 360.0 - h * 0.5)
	pc.add_theme_stylebox_override("panel", box(Color(0.025, 0.055, 0.045, 0.97), border, 1, 2, 26))
	parent.add_child(pc)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	pc.add_child(v)
	return v


static func stat_row(k: String, v: String, vcolor: Color = Pal.TEXT) -> HBoxContainer:
	var h := HBoxContainer.new()
	var a := label(k, 15, Pal.TEXT_DIM)
	a.custom_minimum_size = Vector2(220, 26)
	h.add_child(a)
	var b := label(v, 17, vcolor)
	b.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(b)
	return h
