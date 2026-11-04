extends Node
## 全局单例：设置 / 存档 / 进度 / 输入映射。
## 存档分三块（settings / progress / records），带版本号与迁移、原子写入与备份恢复。

signal settings_changed
signal progress_changed

const SAVE_VERSION := 3
const SAVE_PATH := "user://save.json"
const SAVE_TMP := "user://save.tmp"
const SAVE_BAK := "user://save.bak"

var settings := {
	"fullscreen": false,
	"crt": 1,             # 0 关 / 1 轻 / 2 重
	"shake": 0.7,         # 0..1
	"particles": 1.0,     # 0..1
	"damage_numbers": true,
	"music": 0.45,
	"sfx": 0.80,
	"show_fps": false,
	"echo_assist": true,
	"vsync": true,
}

var progress := {
	"cleared": {},        # level_id -> {"score":int,"time":float,"combo":int}
	"best": {},           # level_id -> best score
	"played_runs": 0,
	"total_bricks": 0,
}

var records := {
	"best_combo": 0,
	"best_score": 0,
}

## 局外进度（存档 v3）。与网页版 meta 字段一一对应，
## 远征 / 解锁 / 成就 / 图鉴都读这里。
var meta := {
	"cleared": {},
	"best": {},
	"bestScore": 0,
	"bestChapter": 0,
	"bestCombo": 0,
	"runs": 0,
	"wins": 0,
	"totalBricks": 0,
	"endlessBest": 0,
	"noHitChapters": 0,
	"unlocks": ["p1"],
	"achievements": [],
	"codex": {"levels": [], "relics": [], "upgrades": [], "bosses": []},
}

var save_status := "ok"
var last_save_error := ""


func _ready() -> void:
	_install_input_actions()
	load_save()
	apply_window_settings()


# ---------------------------------------------------------------- 输入映射
func _install_input_actions() -> void:
	_add_action("paddle_left", [KEY_A, KEY_LEFT])
	_add_action("paddle_right", [KEY_D, KEY_RIGHT])
	_add_action("launch", [KEY_SPACE, KEY_ENTER])
	_add_action("pause", [KEY_ESCAPE, KEY_P])
	_add_action("assist", [KEY_TAB])


func _add_action(name: String, keys: Array) -> void:
	if not InputMap.has_action(name):
		InputMap.add_action(name)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(name, ev)


# ---------------------------------------------------------------- 设置
func set_setting(key: String, value) -> void:
	if not settings.has(key):
		return
	settings[key] = value
	settings_changed.emit()
	save()


func apply_window_settings() -> void:
	if DisplayServer.get_name() == "headless":
		return
	var want_fs: bool = bool(settings.get("fullscreen", false))
	var mode := DisplayServer.window_get_mode()
	var is_fs := mode == DisplayServer.WINDOW_MODE_FULLSCREEN or mode == DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN
	if want_fs != is_fs:
		DisplayServer.window_set_mode(
			DisplayServer.WINDOW_MODE_FULLSCREEN if want_fs else DisplayServer.WINDOW_MODE_WINDOWED
		)
	DisplayServer.window_set_vsync_mode(
		DisplayServer.VSYNC_ENABLED if bool(settings.get("vsync", true)) else DisplayServer.VSYNC_DISABLED
	)


# ---------------------------------------------------------------- 存档
func _default_data() -> Dictionary:
	return {
		"version": SAVE_VERSION,
		"app": "breakout-phosphor-era",
		"stage": "03",
		"settings": settings.duplicate(true),
		"progress": progress.duplicate(true),
		"records": records.duplicate(true),
		"meta": meta.duplicate(true),
	}


func save() -> bool:
	var data := _default_data()
	var txt := JSON.stringify(data, "\t")
	last_save_error = ""
	# 1) 写临时文件
	var f := FileAccess.open(SAVE_TMP, FileAccess.WRITE)
	if f == null:
		last_save_error = "无法打开临时存档: %s" % error_string(FileAccess.get_open_error())
		save_status = "error"
		push_error(last_save_error)
		return false
	f.store_string(txt)
	f.flush()
	f.close()
	# 2) 回读校验
	var chk := FileAccess.open(SAVE_TMP, FileAccess.READ)
	if chk == null or JSON.parse_string(chk.get_as_text()) == null:
		if chk != null:
			chk.close()
		last_save_error = "临时存档校验失败"
		save_status = "error"
		return false
	chk.close()
	# 3) 滚动备份 + 原子替换
	var dir := DirAccess.open("user://")
	if dir == null:
		last_save_error = "无法访问 user://"
		save_status = "error"
		return false
	if dir.file_exists("save.bak"):
		dir.remove("save.bak")
	if dir.file_exists("save.json"):
		dir.rename("save.json", "save.bak")
	var err := dir.rename("save.tmp", "save.json")
	if err != OK:
		last_save_error = "替换存档失败: %s" % error_string(err)
		if dir.file_exists("save.bak"):
			dir.rename("save.bak", "save.json")
		save_status = "error"
		return false
	save_status = "ok"
	return true


func load_save() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		save_status = "new"
		save()
		return
	var data := _read_json(SAVE_PATH)
	if data.is_empty():
		# 主存档损坏 -> 尝试备份
		if FileAccess.file_exists(SAVE_BAK):
			data = _read_json(SAVE_BAK)
			if not data.is_empty():
				save_status = "recovered_bak"
				_absorb(data)
				save()
				return
		save_status = "corrupt_reset"
		save()
		return
	var ver := int(data.get("version", 1))
	if ver > SAVE_VERSION:
		save_status = "future_version"
		_absorb(data)
		return
	if ver < SAVE_VERSION:
		data = _migrate(data, ver)
		save_status = "migrated_%d" % ver
	_absorb(data)
	if save_status == "ok":
		save_status = "loaded"


func _read_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed


func _migrate(data: Dictionary, from_ver: int) -> Dictionary:
	var d := data.duplicate(true)
	# v1 -> v2: 拆分 settings/progress/records，补默认键
	if from_ver < 2:
		var old_settings: Dictionary = d.get("settings", {})
		var merged := settings.duplicate(true)
		for k in old_settings.keys():
			merged[k] = old_settings[k]
		d["settings"] = merged
		if not d.has("progress"):
			d["progress"] = progress.duplicate(true)
		if not d.has("records"):
			d["records"] = records.duplicate(true)
	# v2 -> v3: 把 progress.cleared/best 并入 meta（远征层读 meta）
	if from_ver < 3:
		var old_p: Dictionary = d.get("progress", {})
		var m := meta.duplicate(true)
		var old_meta: Dictionary = d.get("meta", {})
		for k in old_meta.keys():
			m[k] = old_meta[k]
		for k in old_p.get("cleared", {}).keys():
			m["cleared"][k] = old_p["cleared"][k]
		for k in old_p.get("best", {}).keys():
			m["best"][k] = old_p["best"][k]
		m["totalBricks"] = maxi(int(m.get("totalBricks", 0)), int(old_p.get("total_bricks", 0)))
		d["meta"] = m
	d["version"] = SAVE_VERSION
	return d


func _absorb(data: Dictionary) -> void:
	var s: Dictionary = data.get("settings", {})
	for k in settings.keys():
		if s.has(k):
			settings[k] = s[k]
	var p: Dictionary = data.get("progress", {})
	for k in progress.keys():
		if p.has(k):
			progress[k] = p[k]
	var r: Dictionary = data.get("records", {})
	for k in records.keys():
		if r.has(k):
			records[k] = r[k]
	var m: Dictionary = data.get("meta", {})
	for k in meta.keys():
		if m.has(k):
			meta[k] = m[k]
	# codex 的四个子表要逐个合并，避免旧档缺键被整体覆盖
	var codex: Dictionary = meta.get("codex", {})
	for sub in ["levels", "relics", "upgrades", "bosses"]:
		if not codex.has(sub):
			codex[sub] = []
	meta["codex"] = codex


func reset_progress() -> void:
	progress = {"cleared": {}, "best": {}, "played_runs": 0, "total_bricks": 0}
	records = {"best_combo": 0, "best_score": 0}
	meta = {
		"cleared": {}, "best": {}, "bestScore": 0, "bestChapter": 0, "bestCombo": 0,
		"runs": 0, "wins": 0, "totalBricks": 0, "endlessBest": 0, "noHitChapters": 0,
		"unlocks": ["p1"], "achievements": [],
		"codex": {"levels": [], "relics": [], "upgrades": [], "bosses": []},
	}
	progress_changed.emit()
	save()


# ---------------------------------------------------------------- 进度
func mark_cleared(level_id: String, summary: Dictionary) -> void:
	var prev: Dictionary = progress["cleared"].get(level_id, {})
	var score := int(summary.get("score", 0))
	var best_prev := int(prev.get("score", 0))
	if score >= best_prev:
		progress["cleared"][level_id] = {
			"score": score,
			"time": float(summary.get("time", 0.0)),
			"combo": int(summary.get("max_combo", 0)),
		}
	progress["best"][level_id] = maxi(best_prev, score)
	records["best_score"] = maxi(int(records["best_score"]), score)
	records["best_combo"] = maxi(int(records["best_combo"]), int(summary.get("max_combo", 0)))
	# 同步到 meta（远征 / 解锁 / 图鉴都读 meta）
	meta["cleared"][level_id] = progress["cleared"].get(level_id, {"score": score})
	meta["best"][level_id] = maxi(int((meta["best"] as Dictionary).get(level_id, 0)), score)
	meta["bestScore"] = maxi(int(meta.get("bestScore", 0)), score)
	meta["bestCombo"] = maxi(int(meta.get("bestCombo", 0)), int(summary.get("max_combo", 0)))
	var codex: Dictionary = meta.get("codex", {})
	if not codex.has("levels"):
		codex["levels"] = []
	if not (codex["levels"] as Array).has(level_id):
		codex["levels"].append(level_id)
	meta["codex"] = codex
	progress_changed.emit()
	save()


func is_cleared(level_id: String) -> bool:
	return progress["cleared"].has(level_id)


func best_score(level_id: String) -> int:
	return int(progress["best"].get(level_id, 0))


func add_bricks(n: int) -> void:
	progress["total_bricks"] = int(progress["total_bricks"]) + n
	meta["totalBricks"] = int(meta.get("totalBricks", 0)) + n


# ---------------------------------------------------------------- 调试
func save_path_absolute() -> String:
	return ProjectSettings.globalize_path(SAVE_PATH)
