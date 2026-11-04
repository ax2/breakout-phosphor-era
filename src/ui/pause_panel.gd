class_name PausePanel
extends Control

signal resume_pressed
signal restart_pressed
signal settings_pressed
signal menu_pressed


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UiStyle.make_theme()
	UiStyle.dim(self, 0.66)
	var v := UiStyle.panel_box(self, 420, 372)
	v.add_child(UiStyle.label("暂停", 30, Pal.TEXT))
	v.add_child(UiStyle.label("PAUSED · 模拟已停止", 12, Pal.TEXT_DIM))
	var sp := Control.new()
	sp.custom_minimum_size = Vector2(0, 10)
	v.add_child(sp)
	var b1 := UiStyle.button("继续", 18, 340)
	b1.pressed.connect(func():
		Audio.play("sfx_ui_confirm", -8.0)
		resume_pressed.emit())
	v.add_child(b1)
	var b2 := UiStyle.button("重新开始本关", 18, 340)
	b2.pressed.connect(func(): restart_pressed.emit())
	v.add_child(b2)
	var b3 := UiStyle.button("设置", 18, 340)
	b3.pressed.connect(func(): settings_pressed.emit())
	v.add_child(b3)
	var b4 := UiStyle.button("返回主菜单", 18, 340)
	b4.pressed.connect(func(): menu_pressed.emit())
	v.add_child(b4)
	b1.grab_focus.call_deferred()
