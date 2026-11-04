extends Node
## 顶层流程控制：场景/界面切换、固定步长驱动、输入仲裁、截屏模式。
##
## 三种模式都走 Run（远征层）；「关卡选择」是单关直打，不进远征，
## 用来反复练某一关或验证关卡设计。

enum St { MENU, LEVELS, MAP, PLAY, PAUSED, RESULT, SETTINGS, CHOICE, CODEX }

const FIXED := GC.FIXED_DT

var state: int = St.MENU
var prev_state: int = St.MENU

var sim: BreakoutSim = null
var view: PlayView
var world: Node2D
var ui_layer: CanvasLayer
var ui_root: Control
var crt_rect: ColorRect

var current_level_id: String = ""
var current_def: Dictionary = {}
var input_mode: String = "mouse"
var in_run: bool = false

var _acc: float = 0.0
var _mouse_accum: float = 0.0
var _hud: GameHud
var _pending_summary: Dictionary = {}
var _result_timer: float = -1.0
var _run_index: int = 0
var _choice_queue: Array = []
var _choice_panel: ChoicePanel = null
var _build_panel: BuildPanel = null
var _shop_offers: Array = []
var _event_def: Dictionary = {}

# 截屏
var _capture_name: String = ""
var _capture_path: String = ""
var _capture_frames: int = 0
var _auto_pilot: bool = false


func _ready() -> void:
	_build_tree()
	_apply_crt()
	Game.settings_changed.connect(_apply_crt)
	Run.toast.connect(_on_toast)

	var args := OS.get_cmdline_user_args()
	for a in args:
		if a.begins_with("--capture="):
			_capture_name = a.substr(10)
		elif a.begins_with("--capture-path="):
			_capture_path = a.substr(15)
		elif a == "--selftest":
			call_deferred("_run_selftest")
			return

	if _capture_name != "":
		call_deferred("_run_capture")
	else:
		show_menu()


func _build_tree() -> void:
	world = Node2D.new()
	world.name = "World"
	add_child(world)
	view = PlayView.new()
	view.name = "PlayView"
	world.add_child(view)

	ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	ui_root = Control.new()
	ui_root.name = "UIRoot"
	ui_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(ui_root)

	var crt_layer := CanvasLayer.new()
	crt_layer.layer = 20
	add_child(crt_layer)
	crt_rect = ColorRect.new()
	crt_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	crt_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = load("res://src/view/crt.gdshader")
	crt_rect.material = mat
	crt_layer.add_child(crt_rect)


func _apply_crt() -> void:
	if crt_rect == null:
		return
	var mat: ShaderMaterial = crt_rect.material
	var lvl := int(Game.settings.crt)
	var s := 0.0
	var v := 0.30
	if lvl == 1:
		s = 0.42
		v = 0.42
	elif lvl >= 2:
		s = 0.85
		v = 0.70
	mat.set_shader_parameter("strength", s)
	mat.set_shader_parameter("vignette", v)


func _on_toast(text: String) -> void:
	_toast(text)


## 战斗内提示：没有 HUD 时（菜单/地图）直接丢掉，避免报错
func _toast(text: String) -> void:
	if _hud != null and is_instance_valid(_hud):
		_hud.toast(text)


# ---------------------------------------------------------------- 界面切换
func _clear_ui() -> void:
	_choice_panel = null
	_build_panel = null
	for c in ui_root.get_children():
		c.queue_free()


func show_menu() -> void:
	state = St.MENU
	sim = null
	in_run = false
	Run.end_run()
	world.visible = false
	_clear_ui()
	Run.sync_meta()
	var m := MainMenuScreen.new()
	m.mode_pressed.connect(func(mode: String): start_run(mode))
	m.levels_pressed.connect(func(): show_levels())
	m.codex_pressed.connect(func(): show_codex())
	m.settings_pressed.connect(func(): push_settings(St.MENU))
	m.quit_pressed.connect(func(): _quit())
	ui_root.add_child(m)
	Audio.set_music_duck(0.0)


func show_levels() -> void:
	state = St.LEVELS
	world.visible = false
	_clear_ui()
	var ls := LevelSelectScreen.new()
	ls.level_chosen.connect(func(id: String): _play_single(id))
	ls.back_pressed.connect(func(): show_menu())
	ui_root.add_child(ls)


func show_codex() -> void:
	state = St.CODEX
	world.visible = false
	_clear_ui()
	var cs := CodexScreen.new()
	cs.back_pressed.connect(func(): show_menu())
	ui_root.add_child(cs)


# ---------------------------------------------------------------- 远征
func start_run(mode: String) -> void:
	Run.start_run(mode, "p1")
	in_run = true
	show_map()


func show_map() -> void:
	state = St.MAP
	sim = null
	world.visible = false
	_clear_ui()
	if not Run.active:
		show_menu()
		return
	var em := ExpeditionScreen.new()
	em.node_chosen.connect(func(i: int): _enter_node(i))
	em.back_pressed.connect(func():
		Run.end_run()
		show_menu())
	em.build_pressed.connect(func(): _open_build())
	ui_root.add_child(em)


func _enter_node(idx: int) -> void:
	var pick := Run.choose(idx)
	var t := str(pick.get("type", "battle"))
	match t:
		"shop":
			_show_shop()
		"event":
			_show_event()
		"supply":
			var msg := Run.apply_effect("heal:1,gold:25")
			_toast("补给：" + msg)
			show_map()
		_:
			_start_def(pick.get("def", {}), true)


func _play_single(id: String) -> void:
	var lv := LevelDB.level_by_id(id)
	if lv.is_empty():
		return
	in_run = false
	Run.end_run()
	_start_def(lv, false)


func _start_def(def: Dictionary, from_run: bool) -> void:
	if def.is_empty():
		show_map()
		return
	_run_index += 1
	current_def = def
	current_level_id = str(def.get("id", ""))
	sim = BreakoutSim.new()
	if from_run:
		sim.set_mods(Run.compute_mods())
	else:
		sim.set_mods({})
	sim.setup_level(def, _seed_for(current_level_id))
	sim.assist_enabled = bool(Game.settings.echo_assist)
	sim.level_cleared.connect(_on_level_cleared)
	sim.run_failed.connect(_on_run_failed)
	sim.life_lost.connect(_on_life_lost)
	sim.boss_window.connect(func(text: String): _toast(text))
	world.visible = true
	view.attach_sim(sim)
	_clear_ui()
	_hud = GameHud.new()
	_hud.sim = sim
	_hud.level = def
	_hud.in_run = from_run
	ui_root.add_child(_hud)
	state = St.PLAY
	input_mode = "mouse"
	_acc = 0.0
	_result_timer = -1.0
	if sim.phase == BreakoutSim.Phase.SERVE and not from_run:
		pass
	Audio.set_music_duck(0.0)


func _seed_for(id: String) -> int:
	return int(hash(id)) + _run_index * 7919


func _on_life_lost(_lives_left: int) -> void:
	if not in_run:
		return
	# 远征用独立的生命池：掉一颗球扣 1 点 HP，HP 归零即结束
	if Run.damage_hp(1):
		if sim != null:
			sim.phase = BreakoutSim.Phase.FAIL
			sim.run_failed.emit(sim.build_summary(false, 0))
	else:
		_toast("生命 -1（剩余 %d）" % Run.hp)


func _on_level_cleared(summary: Dictionary) -> void:
	_pending_summary = summary
	if in_run:
		_finish_run_node(summary)
		return
	Game.mark_cleared(current_level_id, summary)
	Game.add_bricks(int(summary.get("bricks", 0)))
	Run.sync_meta()
	_result_timer = 1.1
	state = St.RESULT


func _finish_run_node(summary: Dictionary) -> void:
	var is_boss := not (current_def.get("boss", {}) as Dictionary).is_empty()
	if is_boss:
		var res := Run.finish_boss(true)
		Run.see_codex("bosses", str((current_def.get("boss", {}) as Dictionary).get("id", "")))
		Game.add_bricks(int(summary.get("bricks", 0)))
		Run.sync_meta()
		if bool(res.get("end", false)):
			_show_run_end(str(res.get("reason", "")))
			return
		_toast("章节通过 · 生命 +1")
		_choice_queue = ["relic"]
		_show_next_choice()
		return
	var res2 := Run.finish_node(true, summary)
	Run.sync_meta()
	if bool(res2.get("end", false)):
		_show_run_end(str(res2.get("reason", "")))
		return
	var ups := int(res2.get("level_ups", 0))
	_choice_queue = []
	for i in range(maxi(1, ups)):
		_choice_queue.append("upgrade")
	_show_next_choice()


func _show_run_end(reason: String) -> void:
	var title := "远征结束"
	if reason == "victory":
		title = "远征完成"
	elif reason == "defeat":
		title = "远征失败"
	_clear_ui()
	var cp := ChoicePanel.new()
	cp.setup(title, "EXPEDITION REPORT", [{
		"title": "回到主菜单", "desc": "本次远征的构筑不会保留", "accent": Pal.AMBER,
	}], "碎片 %d · 等级 %d · 升级 %d · 遗物 %d" % [Run.gold, Run.level + 1, Run.upgrades.size(), Run.relics.size()])
	cp.picked.connect(func(_i: int):
		Run.end_run()
		show_menu())
	ui_root.add_child(cp)
	state = St.CHOICE


func _on_run_failed(summary: Dictionary) -> void:
	_pending_summary = summary
	_result_timer = 0.9
	state = St.RESULT
	Audio.play("sfx_game_over", -3.0)


func _show_result() -> void:
	_clear_ui()
	var rp := ResultPanel.new()
	rp.summary = _pending_summary
	rp.level = current_def
	var idx := LevelDB.index_of(current_level_id)
	var has_next := idx >= 0 and idx + 1 < LevelDB.levels().size()
	rp.can_next = bool(_pending_summary.get("win", false)) and has_next and not in_run
	rp.retry_pressed.connect(func():
		if in_run:
			Run.end_run()
			show_map()
		else:
			_play_single(current_level_id))
	rp.next_pressed.connect(func(): _play_single(str(LevelDB.level_at(idx + 1).get("id", ""))))
	rp.levels_pressed.connect(func():
		Run.end_run()
		show_menu())
	ui_root.add_child(rp)


# ---------------------------------------------------------------- 选择面板
func _show_next_choice() -> void:
	if _choice_queue.is_empty():
		show_map()
		return
	var kind := str(_choice_queue.pop_front())
	if kind == "relic":
		_show_choice_relic()
	else:
		_show_choice_upgrade()


func _show_choice_upgrade() -> void:
	var choices := Run.roll_choices(3)
	if choices.is_empty():
		_show_next_choice()
		return
	var opts: Array = []
	for u in choices:
		var arch := str(u.get("arch", ""))
		var ad: Dictionary = ContentDB.arch().get(arch, {})
		opts.append({
			"title": str(u.get("name", "")),
			"desc": str(u.get("desc", "")),
			"accent": Color(str(ad.get("color", "#7cffb2"))),
		})
	_clear_ui()
	var cp := ChoicePanel.new()
	cp.setup("选择一个升级", "LEVEL UP · %s" % str(ContentDB.arch().get(str(choices[0].get("arch", "")), {}).get("name", "")), opts,
		"等级 %d · 碎片 %d" % [Run.level + 1, Run.gold])
	cp.picked.connect(func(i: int):
		Run.add_upgrade(str(choices[i].get("id", "")))
		_toast("获得：" + str(choices[i].get("name", "")))
		_show_next_choice())
	ui_root.add_child(cp)
	state = St.CHOICE


func _show_choice_relic() -> void:
	var choices := Run.roll_relic_choices(3)
	if choices.is_empty():
		_show_next_choice()
		return
	var opts: Array = []
	for r in choices:
		opts.append({
			"title": str(r.get("name", "")),
			"desc": str(r.get("desc", "")),
			"accent": Color(str(ContentDB.arch().get("thunder", {}).get("color", "#b39cff"))),
		})
	_clear_ui()
	var cp := ChoicePanel.new()
	cp.setup("Boss 掉落 · 选一件遗物", "RELIC", opts, "遗物永久有效（本次远征内）")
	cp.picked.connect(func(i: int):
		Run.add_relic(str(choices[i].get("id", "")))
		_toast("获得遗物：" + str(choices[i].get("name", "")))
		_show_next_choice())
	ui_root.add_child(cp)
	state = St.CHOICE


func _show_shop() -> void:
	_shop_offers = ContentDB.shop_offers()
	var opts: Array = []
	for o in _shop_offers:
		var price := int(o.get("price", 0))
		opts.append({
			"title": str(o.get("label", "")),
			"desc": "SHOP / %s" % str(o.get("kind", "")),
			"cost": price,
			"enabled": Run.gold >= price,
			"accent": Pal.AMBER,
		})
	_clear_ui()
	var cp := ChoicePanel.new()
	cp.setup("商店", "SHOP · 碎片 %d" % Run.gold, opts, "买完会自动回到路线图", true)
	cp.picked.connect(_on_shop_pick)
	cp.cancelled.connect(func(): show_map())
	ui_root.add_child(cp)
	state = St.CHOICE


func _on_shop_pick(idx: int) -> void:
	if idx < 0 or idx >= _shop_offers.size():
		show_map()
		return
	var o: Dictionary = _shop_offers[idx]
	var price := int(o.get("price", 0))
	if Run.gold < price:
		return
	Run.gold -= price
	match str(o.get("kind", "")):
		"upgrade":
			Run.apply_effect("upgrade")
		"relic":
			var pool := Run.roll_relic_choices(1)
			if not pool.is_empty():
				Run.add_relic(str(pool[0].get("id", "")))
				_toast("获得遗物：" + str(pool[0].get("name", "")))
		"heal":
			Run.apply_effect("heal:1")
		"shield":
			Run.permanent["shieldCharges"] = float(Run.permanent.get("shieldCharges", 0.0)) + 2.0
			_toast("护盾 +2（下一关生效）")
		"reroll":
			_show_shop()
			return
	show_map()


func _show_event() -> void:
	var evs := ContentDB.events()
	if evs.is_empty():
		show_map()
		return
	var pick := int(abs(Run.seed_value + Run.chapter_pos * 31 + Run.row * 17)) % evs.size()
	_event_def = evs[pick]
	var opts: Array = []
	for o in _event_def.get("options", []):
		opts.append({
			"title": str(o.get("label", "")),
			"desc": "选择后立即结算",
			"accent": Pal.VIOLET,
		})
	_clear_ui()
	var cp := ChoicePanel.new()
	cp.setup(str(_event_def.get("name", "事件")), "EVENT", opts, str(_event_def.get("text", "")))
	cp.picked.connect(func(i: int):
		var opt: Dictionary = (_event_def.get("options", []) as Array)[clampi(i, 0, maxi(0, (_event_def.get("options", []) as Array).size() - 1))]
		var msg := Run.apply_effect(str(opt.get("effect", "none")))
		if msg != "":
			_toast(msg)
		show_map())
	ui_root.add_child(cp)
	state = St.CHOICE


# ---------------------------------------------------------------- 构筑面板 / 暂停
func _open_build() -> void:
	if _build_panel != null and is_instance_valid(_build_panel):
		return
	var bp := BuildPanel.new()
	bp.closed.connect(func():
		if is_instance_valid(bp):
			bp.queue_free()
		_build_panel = null)
	_build_panel = bp
	ui_root.add_child(bp)


func _toggle_pause() -> void:
	if state == St.PLAY:
		prev_state = St.PLAY
		state = St.PAUSED
		sim.paused = true
		_clear_ui()
		var p := PausePanel.new()
		p.resume_pressed.connect(func(): _resume())
		p.restart_pressed.connect(func():
			if in_run:
				_start_def(current_def, true)
			else:
				_play_single(current_level_id))
		p.settings_pressed.connect(func(): push_settings(St.PAUSED))
		p.menu_pressed.connect(func():
			Run.end_run()
			show_menu())
		ui_root.add_child(p)
		Audio.play("sfx_ui_confirm", -10.0)
	elif state == St.PAUSED:
		_resume()


func _resume() -> void:
	state = St.PLAY
	sim.paused = false
	_clear_ui()
	_hud = GameHud.new()
	_hud.sim = sim
	_hud.level = current_def
	_hud.in_run = in_run
	ui_root.add_child(_hud)
	_acc = 0.0


func push_settings(from_state: int) -> void:
	prev_state = from_state
	state = St.SETTINGS
	if sim != null:
		sim.paused = true
	_clear_ui()
	var sp := SettingsPanel.new()
	sp.back_pressed.connect(func(): _pop_settings())
	ui_root.add_child(sp)


func _pop_settings() -> void:
	if prev_state == St.PAUSED:
		state = St.PAUSED
		_clear_ui()
		var p := PausePanel.new()
		p.resume_pressed.connect(func(): _resume())
		p.restart_pressed.connect(func():
			if in_run:
				_start_def(current_def, true)
			else:
				_play_single(current_level_id))
		p.settings_pressed.connect(func(): push_settings(St.PAUSED))
		p.menu_pressed.connect(func():
			Run.end_run()
			show_menu())
		ui_root.add_child(p)
	elif prev_state == St.PLAY:
		_resume()
	else:
		show_menu()


func _quit() -> void:
	Game.save()
	get_tree().quit()


# ---------------------------------------------------------------- 输入
func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_mouse_accum += event.relative.length()
		if state == St.PLAY and _mouse_accum > GC.MOSUE_SWITCH_THRESHOLD:
			input_mode = "mouse"
			_mouse_accum = 0.0
		return
	if event is InputEventKey:
		if not event.pressed or event.echo:
			return
		if event.physical_keycode in [KEY_A, KEY_D, KEY_LEFT, KEY_RIGHT]:
			if state == St.PLAY:
				input_mode = "keyboard"
				_mouse_accum = 0.0
		if event.physical_keycode == KEY_TAB:
			if state == St.PLAY and in_run:
				_open_build()
				get_viewport().set_input_as_handled()
				return
		if event.physical_keycode == KEY_ESCAPE or event.physical_keycode == KEY_P:
			if state == St.PLAY or state == St.PAUSED:
				_toggle_pause()
				get_viewport().set_input_as_handled()
		elif event.physical_keycode == KEY_SPACE or event.physical_keycode == KEY_ENTER:
			if state == St.PLAY and sim != null and sim.phase == BreakoutSim.Phase.SERVE:
				sim.launch()
				get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if state != St.PLAY or sim == null:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if sim.phase == BreakoutSim.Phase.SERVE:
			sim.launch()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if state == St.PLAY and sim != null:
			_toggle_pause()
	elif what == NOTIFICATION_WM_CLOSE_REQUEST:
		Game.save()


# ---------------------------------------------------------------- 主循环
func _process(delta: float) -> void:
	if _capture_name != "":
		_capture_frames += 1

	if state == St.PLAY and sim != null:
		_sync_paddle_input(delta)
		_acc += minf(delta, 0.12)
		var n := 0
		while _acc >= FIXED and n < GC.MAX_FRAME_STEPS:
			sim.step(FIXED)
			_acc -= FIXED
			n += 1
		if n >= GC.MAX_FRAME_STEPS:
			_acc = 0.0
		if _hud != null:
			_hud.input_mode = input_mode
	elif _result_timer > 0.0:
		_result_timer -= delta
		if _result_timer <= 0.0 and state == St.RESULT:
			_show_result()


func _sync_paddle_input(delta: float) -> void:
	if sim == null or sim.phase == BreakoutSim.Phase.CLEAR or sim.phase == BreakoutSim.Phase.FAIL:
		return
	if input_mode == "mouse":
		var mp := get_viewport().get_mouse_position()
		sim.set_paddle_target(mp.x, GC.MOUSE_PADDLE_SPEED)
	else:
		var dir := 0.0
		if Input.is_action_pressed("paddle_left"):
			dir -= 1.0
		if Input.is_action_pressed("paddle_right"):
			dir += 1.0
		if dir != 0.0:
			sim.nudge_paddle_target(dir * GC.KEY_PADDLE_SPEED * delta)
		sim.set_paddle_target(sim.paddle_target, 4000.0)


# ---------------------------------------------------------------- 自检
func _run_selftest() -> void:
	var t = load("res://tests/test_parity.gd").new()
	add_child(t)
	var code: int = t.run_tests()
	t.queue_free()
	get_tree().quit(code)


# ---------------------------------------------------------------- 截屏（文档用）
func _run_capture() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	match _capture_name:
		"menu":
			show_menu()
		"levels":
			show_levels()
		"settings":
			Game.settings["crt"] = 1
			push_settings(St.MENU)
		"codex":
			show_codex()
		"map":
			start_run("expedition")
		"boss":
			in_run = true
			var bdef := ContentDB.boss_of_chapter_index(0)
			_start_def({
				"id": "boss_" + str(bdef.get("id", "b1")),
				"name": str(bdef.get("name", "Boss")),
				"codename": str(bdef.get("code", "")),
				"rows": [], "lives": 99, "speed": 520.0,
				"chapter": "ch1", "boss": bdef,
			}, true)
			_auto_pilot = true
			sim.launch()
			for i in range(120):
				await get_tree().process_frame
				if sim != null and not sim.balls.is_empty():
					sim.set_paddle_target(sim.balls[0].pos.x, 100000.0)
				sim.step(FIXED)
		"choice":
			in_run = true
			Run.start_run("expedition", "p1")
			_choice_queue = ["upgrade"]
			_show_choice_upgrade()
		"build":
			in_run = true
			Run.start_run("expedition", "p1")
			for i in range(4):
				Run.apply_effect("upgrade")
			Run.add_relic("r3")
			Run.add_relic("r5")
			_open_build()
		"pause":
			_play_single("c1_03")
			await get_tree().process_frame
			_toggle_pause()
		"result":
			_play_single("c1_01")
			sim.grid.destructible_alive = 0
			sim.phase = BreakoutSim.Phase.CLEAR
			_pending_summary = {
				"win": true, "level_id": "c1_01", "level_name": "冷启动",
				"score": 4820, "lives_left": 2, "time": 63.4, "bricks": 28,
				"hits": 34, "max_combo": 7, "assists": 1, "clear_bonus": 500,
			}
			_show_result()
		_:
			var idx := 0
			if _capture_name.begins_with("level"):
				idx = maxi(0, int(_capture_name.substr(5)) - 1)
			_play_single(str(LevelDB.level_at(idx).get("id", "c1_01")))
			_auto_pilot = true
			sim.launch()
			for i in range(150):  # 约 2.5s，让粒子/球进入运动
				await get_tree().process_frame
				if sim != null and not sim.balls.is_empty():
					sim.set_paddle_target(sim.balls[0].pos.x + 60.0, 100000.0)
					if sim.phase == BreakoutSim.Phase.SERVE:
						sim.launch()
				sim.step(FIXED)
	# 等待渲染稳定（几帧）
	for i in range(8):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := _capture_path
	if path == "":
		path = "user://shot_%s.png" % _capture_name
	img.save_png(path)
	print("SHOT_SAVED ", path)
	await get_tree().process_frame
	get_tree().quit(0)
