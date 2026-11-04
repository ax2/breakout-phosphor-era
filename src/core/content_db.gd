class_name ContentDB
extends RefCounted
## 网页版内容的镜像层。
##
## data/content.json 由 tools/port_content.js 从 web/js/content.js 生成，
## 是「网页版 / Windows 版」共用的唯一内容源：6 章 48 关、6 Boss、36 升级、
## 18 遗物、6 挡板、12 事件、12 协同、商店与节点类型。
##
## 约定：只读。任何玩法侧的计算都不允许改写这里返回的字典（会被复用），
## 需要改字段时自己 duplicate(true)。

const PATH := "res://data/content.json"
const LEGACY_PATH := "res://data/levels.json"

static var _data: Dictionary = {}
static var _loaded: bool = false


# ---------------------------------------------------------------- 载入
static func _ensure() -> void:
	if _loaded:
		return
	_loaded = true
	_data = _read(PATH)
	if _data.is_empty():
		push_warning("content.json 缺失，回退到旧关卡表 levels.json")
		var legacy := _read(LEGACY_PATH)
		_data = {
			"chapters": legacy.get("chapters", []),
			"levels": legacy.get("levels", []),
			"legend": legacy.get("legend", {}),
			"bosses": [], "upgrades": [], "relics": [], "paddles": [],
			"events": [], "synergies": [], "shop": [], "nodes": {}, "arch": {},
		}


static func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("无法打开内容文件: %s" % path)
		return {}
	var txt := f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("内容文件解析失败: %s" % path)
		return {}
	return parsed


static func reload() -> void:
	_loaded = false
	_data = {}
	_ensure()


# ---------------------------------------------------------------- 关卡
static func legend() -> Dictionary:
	_ensure()
	var lg: Dictionary = _data.get("legend", {})
	if lg.is_empty():
		return {"#": "normal", "T": "tough", "A": "armored", "B": "blast", "X": "solid", "R": "regen", "S": "shieldNode"}
	return lg


static func levels() -> Array:
	_ensure()
	return _data.get("levels", [])


static func chapters() -> Array:
	_ensure()
	return _data.get("chapters", [])


static func level_by_id(id: String) -> Dictionary:
	for lv in levels():
		if str(lv.get("id", "")) == id:
			return lv
	return {}


static func level_at(idx: int) -> Dictionary:
	var ls := levels()
	if idx < 0 or idx >= ls.size():
		return {}
	return ls[idx]


static func index_of(id: String) -> int:
	var ls := levels()
	for i in range(ls.size()):
		if str(ls[i].get("id", "")) == id:
			return i
	return -1


static func levels_of_chapter(chapter_id: String) -> Array:
	var out: Array = []
	for lv in levels():
		if str(lv.get("chapter", "")) == chapter_id:
			out.append(lv)
	return out


static func chapter_of(level: Dictionary) -> Dictionary:
	var cid := str(level.get("chapter", ""))
	for ch in chapters():
		if str(ch.get("id", "")) == cid:
			return ch
	return {"name": "未分类", "code": "", "accent": "#7cffb2"}


static func chapter_index(chapter_id: String) -> int:
	var cs := chapters()
	for i in range(cs.size()):
		if str(cs[i].get("id", "")) == chapter_id:
			return i
	return 0


# ---------------------------------------------------------------- Boss / 构筑
static func bosses() -> Array:
	_ensure()
	return _data.get("bosses", [])


static func boss_by_id(id: String) -> Dictionary:
	for b in bosses():
		if str(b.get("id", "")) == id:
			return b
	return {}


## 章节索引（0 起）对应的 Boss；与网页版 Run.buildLevel 的取法一致
static func boss_of_chapter_index(idx: int) -> Dictionary:
	var bs := bosses()
	if bs.is_empty():
		return {}
	return bs[clampi(idx, 0, bs.size() - 1)]


static func upgrades() -> Array:
	_ensure()
	return _data.get("upgrades", [])


static func relics() -> Array:
	_ensure()
	return _data.get("relics", [])


static func paddles() -> Array:
	_ensure()
	return _data.get("paddles", [])


static func events() -> Array:
	_ensure()
	return _data.get("events", [])


static func synergies() -> Array:
	_ensure()
	return _data.get("synergies", [])


static func shop_offers() -> Array:
	_ensure()
	return _data.get("shop", [])


static func nodes() -> Dictionary:
	_ensure()
	return _data.get("nodes", {})


static func arch() -> Dictionary:
	_ensure()
	return _data.get("arch", {})


static func upgrade_by_id(id: String) -> Dictionary:
	for u in upgrades():
		if str(u.get("id", "")) == id:
			return u
	return {}


static func relic_by_id(id: String) -> Dictionary:
	for r in relics():
		if str(r.get("id", "")) == id:
			return r
	return {}


static func paddle_by_id(id: String) -> Dictionary:
	for p in paddles():
		if str(p.get("id", "")) == id:
			return p
	return {}


static func event_by_id(id: String) -> Dictionary:
	for e in events():
		if str(e.get("id", "")) == id:
			return e
	return {}


# ---------------------------------------------------------------- 统计
static func summary() -> String:
	return "chapters=%d levels=%d bosses=%d upgrades=%d relics=%d paddles=%d events=%d synergies=%d" % [
		chapters().size(), levels().size(), bosses().size(), upgrades().size(),
		relics().size(), paddles().size(), events().size(), synergies().size(),
	]
