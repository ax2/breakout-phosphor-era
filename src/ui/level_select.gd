class_name LevelSelectScreen
extends Control
## 关卡选择：6 章 × 8 关。按章节分页，一页 8 张卡（4×2），避免 48 关横向溢出。

signal level_chosen(id: String)
signal back_pressed


class LevelCard:
	extends Control

	signal chosen(id: String)

	var level: Dictionary
	var index: int
	var locked: bool = false
	var cleared: bool = false
	var best: int = 0
	var accent: Color = Pal.PHOSPHOR
	var _hover: bool = false
	var _t: float = 0.0

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		mouse_entered.connect(func():
			_hover = true
			Audio.play("sfx_ui_move", -16.0)
			queue_redraw())
		mouse_exited.connect(func():
			_hover = false
			queue_redraw())
		set_process(true)

	func _process(delta: float) -> void:
		_t += delta
		if _hover or not locked:
			queue_redraw()

	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			if not locked:
				chosen.emit(str(level.get("id", "")))
				accept_event()

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		var a := 1.0 if not locked else 0.38
		var border := Color(accent.r, accent.g, accent.b, (0.85 if _hover else 0.35) * a)
		var fill := Color(0.03, 0.07, 0.06, 0.92)
		if _hover and not locked:
			fill = Color(0.05, 0.13, 0.10, 0.95)
		draw_rect(r, fill, true)
		draw_rect(r, border, false, 1.4 if _hover else 1.0)
		UiStyle.draw_bracket_panel(self, r.grow(-1.0), Color(border.r, border.g, border.b, border.a * 0.7), 1.0, 10.0)

		var f := UiStyle.font()
		var num := "%02d" % index
		draw_string(f, Vector2(12, 34), num, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(accent.r, accent.g, accent.b, 0.9 * a))

		var status := "可挑战"
		var sc := Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, a)
		if locked:
			status = "LOCKED"
		elif cleared:
			status = "CLEARED"
			sc = Color(Pal.AMBER.r, Pal.AMBER.g, Pal.AMBER.b, a)
		draw_string(f, Vector2(0, 30), status, HORIZONTAL_ALIGNMENT_RIGHT, size.x - 10.0, 11, sc)

		draw_string(f, Vector2(12, 66), str(level.get("name", "")), HORIZONTAL_ALIGNMENT_LEFT, size.x - 20.0, 19, Color(Pal.TEXT.r, Pal.TEXT.g, Pal.TEXT.b, a))
		draw_string(f, Vector2(12, 86), str(level.get("codename", "")), HORIZONTAL_ALIGNMENT_LEFT, size.x - 20.0, 11, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, a))

		# 关卡砖阵预览：直接由 rows 生成，和实际关卡一致
		var rows: Array = level.get("rows", [])
		var legend := LevelDB.legend()
		var cw := 7.0
		var chh := 4.6
		var ox := (size.x - 12.0 * cw) * 0.5
		var oy := 100.0
		for rr in range(rows.size()):
			var line: String = str(rows[rr])
			for cc in range(mini(line.length(), GC.GRID_COLS)):
				var ch2 := line.substr(cc, 1)
				if ch2 == ".":
					continue
				var t: String = str(legend.get(ch2, ""))
				var col := Pal.type_color(t)
				var alpha := 0.55 * a
				if t == "solid":
					alpha = 0.28 * a
				draw_rect(Rect2(ox + cc * cw, oy + rr * chh, cw - 1.0, chh - 1.0), Color(col.r, col.g, col.b, alpha), true)

		var bottom := "最佳 %d" % best if best > 0 else "—"
		draw_string(f, Vector2(12, size.y - 10), bottom, HORIZONTAL_ALIGNMENT_LEFT, size.x - 20.0, 12, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, a))
		if not locked:
			var hint := "点击进入" if _hover else "READY"
			draw_string(f, Vector2(0, size.y - 10), hint, HORIZONTAL_ALIGNMENT_RIGHT, size.x - 12.0, 11, Color(accent.r, accent.g, accent.b, (0.95 if _hover else 0.4) * a))


const CARD_W := 254.0
const CARD_H := 176.0
const GAP := 16.0

var _t := 0.0
var _chapter := 0
var _cards: Array = []
var _tab_box: HBoxContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	_build_tabs()
	_build_cards()
	set_process(true)


func _build_tabs() -> void:
	_tab_box = HBoxContainer.new()
	_tab_box.position = Vector2(72, 240)
	_tab_box.add_theme_constant_override("separation", 8)
	add_child(_tab_box)
	var chapters := ContentDB.chapters()
	for i in range(chapters.size()):
		var ch: Dictionary = chapters[i]
		var b := UiStyle.button("第%d章" % (i + 1), 14, 108)
		var idx := i
		b.pressed.connect(func():
			if _chapter != idx:
				_chapter = idx
				Audio.play("sfx_ui_move", -12.0)
				_build_cards())
		_tab_box.add_child(b)


func _build_cards() -> void:
	for c in _cards:
		if is_instance_valid(c):
			c.queue_free()
	_cards.clear()

	var chapters := ContentDB.chapters()
	var chapter_id := str(chapters[clampi(_chapter, 0, chapters.size() - 1)].get("id", "ch1"))
	var levels := ContentDB.levels_of_chapter(chapter_id)
	var x0 := (1280.0 - (4.0 * CARD_W + 3.0 * GAP)) * 0.5
	var y0 := 296.0
	for i in range(levels.size()):
		var lv: Dictionary = levels[i]
		var card := LevelCard.new()
		card.level = lv
		card.index = int(lv.get("index", i + 1))
		var col := i % 4
		var row := i / 4
		card.position = Vector2(x0 + col * (CARD_W + GAP), y0 + row * (CARD_H + GAP))
		card.size = Vector2(CARD_W, CARD_H)
		var lid := str(lv.get("id", ""))
		card.best = Game.best_score(lid)
		card.cleared = Game.is_cleared(lid)
		var gi := LevelDB.index_of(lid)
		var prev_id := str(LevelDB.level_at(gi - 1).get("id", "")) if gi > 0 else ""
		card.locked = prev_id != "" and not Game.is_cleared(prev_id)
		card.accent = Color(str(lv.get("accent", chapters[clampi(_chapter, 0, chapters.size() - 1)].get("accent", "7cffb2"))))
		card.chosen.connect(func(id: String):
			Audio.play("sfx_ui_confirm", -8.0)
			level_chosen.emit(id))
		add_child(card)
		_cards.append(card)

	if get_node_or_null("hint") == null:
		var hint := UiStyle.label("通关前一关解锁下一关 · 关卡为手工设计", 13, Pal.TEXT_DIM)
		hint.name = "hint"
		hint.position = Vector2(660, 676)
		add_child(hint)

	if get_node_or_null("back") == null:
		var back := UiStyle.button("返回", 16, 140)
		back.name = "back"
		back.position = Vector2(72, 664)
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
		var f := float(i) / 11.0
		draw_rect(Rect2(0, i * 60, 1280, 61), Pal.BG.lerp(Pal.BG_2, f * 0.45), true)

	var chapters := ContentDB.chapters()
	var ch: Dictionary = chapters[clampi(_chapter, 0, chapters.size() - 1)]
	var f2 := UiStyle.font()
	draw_string(f2, Vector2(72, 100), "STAGE SELECT", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.55))
	draw_string(f2, Vector2(72, 158), "选择关卡 · %d / %d" % [_chapter + 1, chapters.size()], HORIZONTAL_ALIGNMENT_LEFT, -1, 40, Pal.TEXT)
	draw_string(f2, Vector2(74, 192), "%s / %s" % [str(ch.get("name", "")), str(ch.get("code", ""))], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.75))
	draw_string(f2, Vector2(74, 216), str(ch.get("brief", "")), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(Pal.TEXT_DIM.r, Pal.TEXT_DIM.g, Pal.TEXT_DIM.b, 0.85))

	draw_line(Vector2(72, 230), Vector2(1208, 230), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.16), 1.0)

	var sy := fmod(_t * 18.0, 760.0) - 20.0
	draw_rect(Rect2(0, sy, 1280, 2), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.025), true)
