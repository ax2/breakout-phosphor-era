extends Node
## 远征 / 构筑 / 三种模式 / 局外进度。移植自网页版 web/js/run.js。
##
## 与网页版一致的部分：路由生成规则、奖励池、属性聚合（mods）、
## 协同判定、经验曲线、经济算法、成就与解锁条件。
## Windows 版额外做的一件事：把局外进度并入 Game 存档（v3），
## 不再单独开一个文件，避免两处写入互相覆盖。

signal run_changed
signal toast(text: String)

const MODES := ["classic", "expedition", "endless"]

## 只有这几项是「乘算」，其余 mods 都是加算（与网页版 MULT_KEYS 一致）
const MULT_KEYS := {"paddleSpeed": true}

const ACHIEVEMENTS := [
	{"id": "a1", "name": "第一次清关", "desc": "完成任意关卡"},
	{"id": "a2", "name": "连锁反应", "desc": "单局连锁达到 10"},
	{"id": "a3", "name": "章节通行", "desc": "击败任意章节 Boss"},
	{"id": "a4", "name": "破甲者", "desc": "击败第二章 Boss"},
	{"id": "a5", "name": "拆解专家", "desc": "累计击碎 800 块砖"},
	{"id": "a6", "name": "远征者", "desc": "完成一次完整远征"},
	{"id": "a7", "name": "收藏家", "desc": "图鉴收录 12 件遗物"},
	{"id": "a8", "name": "无尽回响", "desc": "无尽模式到达第 10 层"},
]

const UNLOCKS := [
	{"id": "p2", "label": "挡板：宽幅"},
	{"id": "p3", "label": "挡板：轻量"},
	{"id": "p4", "label": "挡板：磁轨"},
	{"id": "p5", "label": "挡板：工程台"},
	{"id": "p6", "label": "挡板：玻璃炮"},
]

# ---- 当前远征 ---------------------------------------------------------
var mode: String = "classic"
var active: bool = false
var paddle_id: String = "p1"
var seed_value: int = 0
var chapters: Array = []
var chapter_pos: int = 0
var row: int = 0
var hp: int = 3
var max_hp: int = 3
var gold: int = 0
var xp: int = 0
var level: int = 0
var xp_next: int = 5
var upgrades: Array = []
var relics: Array = []
var route: Array = []
var permanent: Dictionary = {}
var taken: Dictionary = {}
var cleared_nodes: int = 0
var endless_floor: int = 0
var rng := XRand.new(1)


# ---------------------------------------------------------------- 开局
func start_run(m: String = "classic", paddle: String = "p1", seed_in: int = 0) -> void:
	mode = m if m in MODES else "classic"
	paddle_id = paddle
	seed_value = seed_in if seed_in != 0 else int(Time.get_unix_time_from_system())
	rng = XRand.new(seed_value)
	chapters.clear()
	if mode == "classic":
		for i in range(ContentDB.chapters().size()):
			chapters.append(i)
	elif mode == "endless":
		chapters.append(0)
	else:
		var pool := [0, 1, 2, 3, 4, 5]
		for i in range(pool.size() - 1, 0, -1):
			var j := rng.range_i(0, i)
			var t = pool[i]
			pool[i] = pool[j]
			pool[j] = t
		chapters = [pool[0], pool[1], pool[2]]
		chapters.sort()
	chapter_pos = 0
	row = 0
	hp = 3 if mode == "classic" else 4
	max_hp = hp
	gold = 0
	xp = 0
	level = 0
	xp_next = 5
	upgrades = []
	relics = []
	permanent = {}
	taken = {}
	cleared_nodes = 0
	endless_floor = 0
	active = true
	roll_route()
	run_changed.emit()


func end_run() -> void:
	active = false
	run_changed.emit()


func chapter_idx() -> int:
	if chapters.is_empty():
		return 0
	return int(chapters[clampi(chapter_pos, 0, chapters.size() - 1)])


func chapter_def() -> Dictionary:
	var cs := ContentDB.chapters()
	var i := chapter_idx()
	if cs.is_empty():
		return {}
	return cs[clampi(i, 0, cs.size() - 1)]


# ---------------------------------------------------------------- 路由
func roll_route() -> void:
	route.clear()
	row = 0
	taken.clear()
	for i in range(4):
		var opts: Array = []
		var n := 1 if i == 3 else 2
		for k in range(n):
			var rr := XRand.new(seed_value + i * 17 + k)
			var t := _node_type_for(i, rr)
			if k > 0 and not opts.is_empty() and t == str(opts[0]):
				t = "battle" if str(opts[0]) != "battle" else "event"
			opts.append(t)
		route.append(opts)
	route.append(["boss"])


func _node_type_for(r: int, rng_local: XRand) -> String:
	if r == 0:
		return "battle"
	var pool := ["battle", "battle", "elite", "shop", "event", "supply"]
	return str(rng_local.pick(pool))


func current_options() -> Array:
	if row < route.size():
		return route[row]
	return ["boss"]


## 返回 {"type":String, "def":Dictionary}
func choose(idx: int) -> Dictionary:
	var opts := current_options()
	var t := "battle"
	if not opts.is_empty():
		t = str(opts[clampi(idx, 0, opts.size() - 1)])
	return {"type": t, "def": build_level(t)}


func build_level(type: String) -> Dictionary:
	var ch := chapter_idx()
	var rng_l := XRand.new(seed_value + chapter_pos * 977 + row * 131 + 7)
	var base_def := {}
	if type == "boss":
		var boss := ContentDB.boss_of_chapter_index(ch)
		return {
			"id": "boss_" + str(boss.get("id", "?")),
			"name": str(boss.get("name", "Boss")),
			"codename": str(boss.get("code", "")),
			"rows": [],
			"speed": 500.0 + float(ch) * 20.0,
			"lives": 99,
			"chapter": "ch%d" % (ch + 1),
			"boss": boss,
		}
	var picks: Array = ContentDB.levels_of_chapter("ch%d" % (ch + 1))
	if picks.is_empty():
		return {}
	var idx := 0
	if type == "elite":
		idx = mini(picks.size() - 1, 6 + rng_l.range_i(0, 1))
	else:
		idx = rng_l.range_i(0, maxi(0, picks.size() - 2))
		var key := "%d:%d" % [ch, idx]
		if taken.has(key):
			idx = (idx + 1) % maxi(1, picks.size() - 1)
		taken["%d:%d" % [ch, idx]] = true
	base_def = picks[idx].duplicate(true)
	if type == "elite":
		base_def["id"] = "elite_" + str(base_def.get("id", ""))
		base_def["name"] = "精英 · " + str(base_def.get("name", ""))
		base_def["speed"] = float(base_def.get("speed", 520.0)) + 55.0
		base_def["elite"] = true
	base_def["lives"] = 99   # 生命由远征统一管理
	if mode == "endless":
		base_def["speed"] = float(base_def.get("speed", 520.0)) + float(endless_floor) * 18.0
	return base_def


# ---------------------------------------------------------------- 属性聚合
static func add_mods(target: Dictionary, mods: Dictionary) -> Dictionary:
	for k in mods.keys():
		var v = mods[k]
		if typeof(v) == TYPE_BOOL:
			target[k] = bool(target.get(k, false)) or bool(v)
			continue
		if typeof(v) != TYPE_INT and typeof(v) != TYPE_FLOAT:
			continue
		if MULT_KEYS.has(k):
			target[k] = float(target.get(k, 1.0)) * float(v)
		else:
			target[k] = float(target.get(k, 0.0)) + float(v)
	return target


## 挡板 + 升级 + 遗物 + 协同 + 事件永久属性
func compute_mods() -> Dictionary:
	var out := BreakoutSim.default_mods()
	var paddle := ContentDB.paddle_by_id(paddle_id)
	if not paddle.is_empty():
		add_mods(out, paddle.get("mods", {}))
	for id in upgrades:
		var u := ContentDB.upgrade_by_id(str(id))
		if not u.is_empty():
			add_mods(out, u.get("mods", {}))
	for id in relics:
		var r := ContentDB.relic_by_id(str(id))
		if not r.is_empty():
			add_mods(out, r.get("mods", {}))
	for s in active_synergies():
		add_mods(out, s.get("mods", {}))
	add_mods(out, permanent)
	out["paddleW"] = maxf(70.0, float(out.get("paddleW", GC.PADDLE_W)))
	out["maxSpeed"] = minf(1400.0, float(out.get("maxSpeed", GC.BALL_MAX_SPEED)))
	return out


func active_synergies() -> Array:
	var owned := {}
	for id in upgrades:
		owned[str(id)] = true
	for id in relics:
		owned[str(id)] = true
	var out: Array = []
	for s in ContentDB.synergies():
		var need: Array = s.get("need", [])
		var ok := not need.is_empty()
		for n in need:
			if not owned.has(str(n)):
				ok = false
				break
		if ok:
			out.append(s)
	return out


func has_flag(flag: String) -> bool:
	for id in upgrades:
		var u := ContentDB.upgrade_by_id(str(id))
		if str(u.get("flag", "")) == flag:
			return true
	for id in relics:
		var r := ContentDB.relic_by_id(str(id))
		if str(r.get("flag", "")) == flag:
			return true
	return false


func add_upgrade(id: String) -> void:
	if id == "" or upgrades.has(id):
		return
	upgrades.append(id)
	see_codex("upgrades", id)
	run_changed.emit()


func add_relic(id: String) -> void:
	if id == "" or relics.has(id):
		return
	relics.append(id)
	see_codex("relics", id)
	run_changed.emit()


func gain_xp(n: int) -> int:
	var mult := 1.0 + float(BreakoutSim.default_mods().get("xpBonus", 0.0))
	# 用聚合属性里的经验加成
	var m := compute_mods()
	mult = 1.0 + float(m.get("xpBonus", 0.0))
	xp += int(round(float(n) * mult))
	var ups := 0
	while xp >= xp_next:
		xp -= xp_next
		level += 1
		xp_next = int(round(float(xp_next) * 1.26 + 3.0))
		ups += 1
	if ups > 0:
		run_changed.emit()
	return ups


# ---------------------------------------------------------------- 奖励池
func reward_pool(arch: String = "") -> Array:
	var owned := {}
	for id in upgrades:
		owned[str(id)] = true
	var pool: Array = []
	for u in ContentDB.upgrades():
		if not owned.has(str(u.get("id", ""))):
			pool.append(u)
	if arch != "":
		var f: Array = []
		for u in pool:
			if str(u.get("arch", "")) == arch:
				f.append(u)
		if f.size() >= 3:
			pool = f
	return pool


func roll_choices(n: int, arch: String = "", rng_in: XRand = null) -> Array:
	var pool := reward_pool(arch).duplicate()
	var out: Array = []
	var r := rng_in if rng_in != null else rng
	while out.size() < n and not pool.is_empty():
		var i := r.range_i(0, pool.size() - 1)
		out.append(pool[i])
		pool.remove_at(i)
	return out


func roll_relic_choices(n: int, rng_in: XRand = null) -> Array:
	var owned := {}
	for id in relics:
		owned[str(id)] = true
	var pool: Array = []
	for it in ContentDB.relics():
		if not owned.has(str(it.get("id", ""))):
			pool.append(it)
	var out: Array = []
	var r := rng_in if rng_in != null else rng
	while out.size() < n and not pool.is_empty():
		var i := r.range_i(0, pool.size() - 1)
		out.append(pool[i])
		pool.remove_at(i)
	return out


# ---------------------------------------------------------------- 结算
## 返回 {"end":bool, "reason":String, "gold":int, "level_ups":int}
func finish_node(win: bool, summary: Dictionary) -> Dictionary:
	if not win:
		return {"end": true, "reason": "defeat", "gold": 0, "level_ups": 0}
	cleared_nodes += 1
	var base_gold := 18 + row * 6
	var opts := current_options()
	if not opts.is_empty() and str(opts[0]) == "elite":
		base_gold += 30
	var m := compute_mods()
	gold += int(round(float(base_gold) * (1.0 + float(m.get("goldBonus", 0.0)))))
	var ups := gain_xp(6 + row * 3)
	Game.add_bricks(int(summary.get("bricks", 0)))
	row += 1
	if row >= route.size():
		return {"end": true, "reason": "chapter", "gold": 0, "level_ups": ups}
	run_changed.emit()
	return {"end": false, "reason": "", "gold": int(round(float(base_gold))), "level_ups": ups}


## 返回 {"end":bool, "reason":String, "chapter_clear":bool, "floor":int}
func finish_boss(win: bool) -> Dictionary:
	if not win:
		return {"end": true, "reason": "defeat", "chapter_clear": false, "floor": 0}
	var boss := ContentDB.boss_of_chapter_index(chapter_idx())
	see_codex("bosses", str(boss.get("id", "")))
	Game.meta["bestChapter"] = maxi(int(Game.meta.get("bestChapter", 0)), chapter_pos + 1)
	gold += 60
	gain_xp(20)
	if mode == "endless":
		endless_floor += 1
		Game.meta["endlessBest"] = maxi(int(Game.meta.get("endlessBest", 0)), endless_floor)
		row = 0
		route = []
		roll_route()
		hp = mini(max_hp, hp + 1)
		Game.save()
		return {"end": false, "reason": "", "chapter_clear": true, "floor": endless_floor}
	chapter_pos += 1
	row = 0
	if chapter_pos >= chapters.size():
		Game.meta["wins"] = int(Game.meta.get("wins", 0)) + 1
		Game.save()
		return {"end": true, "reason": "victory", "chapter_clear": true, "floor": 0}
	roll_route()
	hp = mini(max_hp, hp + 1)
	Game.save()
	return {"end": false, "reason": "", "chapter_clear": true, "floor": 0}


func damage_hp(n: int = 1) -> bool:
	hp -= n
	run_changed.emit()
	return hp <= 0


## 事件/商店的效果字符串，语法与网页版 content.js 的 effect 字段一致：
##   "upgrade" / "upgrade:frost" / "upgradex2" / "gold:45" / "xp:60" /
##   "heal:1" / "hurt:1" / "buyrelic:70" / "none"，可用逗号串联。
## 返回一句给人看的结果描述。
func apply_effect(eff: String) -> String:
	var msgs: Array = []
	for raw in eff.split(","):
		var p := raw.strip_edges()
		if p == "" or p == "none":
			continue
		var kv := p.split(":")
		var key := kv[0]
		var arg := kv[1] if kv.size() > 1 else ""
		match key:
			"gold":
				var g := int(arg)
				gold = maxi(0, gold + g)
				msgs.append("碎片 %+d" % g)
			"xp":
				var u := gain_xp(int(arg))
				msgs.append("经验 %+d" % int(arg))
				if u > 0:
					msgs.append("升 %d 级" % u)
			"heal":
				hp = mini(max_hp, hp + int(arg))
				msgs.append("生命 +%d" % int(arg))
			"hurt":
				damage_hp(int(arg))
				msgs.append("生命 -%d" % int(arg))
			"upgrade":
				var got := _grant_upgrade(arg)
				if got != "":
					msgs.append("获得升级：%s" % got)
			"upgradex2":
				var n := 0
				for i in range(2):
					if _grant_upgrade("") != "":
						n += 1
				msgs.append("获得 %d 次升级" % n)
			"buyrelic":
				var price := int(arg)
				if gold >= price:
					gold -= price
					var pool := roll_relic_choices(1)
					if not pool.is_empty():
						add_relic(str(pool[0].get("id", "")))
						msgs.append("用 %d 碎片换到 %s" % [price, str(pool[0].get("name", ""))])
					else:
						msgs.append("遗物已收集完")
				else:
					msgs.append("碎片不足，什么都没买到")
			_:
				pass
	run_changed.emit()
	return " · ".join(msgs)


func _grant_upgrade(arch: String) -> String:
	var pool := roll_choices(1, arch)
	if pool.is_empty():
		pool = roll_choices(1, "")
	if pool.is_empty():
		return ""
	add_upgrade(str(pool[0].get("id", "")))
	return str(pool[0].get("name", ""))


# ---------------------------------------------------------------- 局外
func see_codex(kind: String, id: String) -> void:
	if id == "":
		return
	var codex: Dictionary = Game.meta.get("codex", {})
	if not codex.has(kind):
		codex[kind] = []
	var arr: Array = codex[kind]
	if not arr.has(id):
		arr.append(id)
		Game.meta["codex"] = codex
		Game.save()


func sync_meta() -> void:
	var m := Game.meta
	var achs: Array = m.get("achievements", [])
	for a in ACHIEVEMENTS:
		if not achs.has(a["id"]) and _achievement_ok(str(a["id"])):
			achs.append(a["id"])
			toast.emit("成就达成：" + str(a["name"]))
	m["achievements"] = achs
	var unlocks: Array = m.get("unlocks", ["p1"])
	if not unlocks.has("p1"):
		unlocks.append("p1")
	for u in UNLOCKS:
		if not unlocks.has(u["id"]) and _unlock_ok(str(u["id"])):
			unlocks.append(u["id"])
			toast.emit("解锁 " + str(u["label"]))
	m["unlocks"] = unlocks
	Game.save()


func _achievement_ok(id: String) -> bool:
	var m := Game.meta
	var cleared: Dictionary = m.get("cleared", {})
	match id:
		"a1":
			return cleared.size() > 0
		"a2":
			return int(m.get("bestCombo", 0)) >= 10
		"a3":
			return int(m.get("bestChapter", 0)) >= 1
		"a4":
			return int(m.get("bestChapter", 0)) >= 2
		"a5":
			return int(m.get("totalBricks", 0)) >= 800
		"a6":
			return int(m.get("wins", 0)) >= 1
		"a7":
			var codex: Dictionary = m.get("codex", {})
			return (codex.get("relics", []) as Array).size() >= 12
		"a8":
			return int(m.get("endlessBest", 0)) >= 10
	return false


func _unlock_ok(id: String) -> bool:
	var m := Game.meta
	match id:
		"p2":
			return int(m.get("bestChapter", 0)) >= 1
		"p3":
			return int(m.get("bestCombo", 0)) >= 10
		"p4":
			return int(m.get("bestChapter", 0)) >= 3
		"p5":
			return int(m.get("totalBricks", 0)) >= 800
		"p6":
			return int(m.get("noHitChapters", 0)) >= 1
	return false


func has_paddle(id: String) -> bool:
	return (Game.meta.get("unlocks", ["p1"]) as Array).has(id)


func achievement_list() -> Array:
	var got: Array = Game.meta.get("achievements", [])
	var out: Array = []
	for a in ACHIEVEMENTS:
		out.append({
			"id": a["id"], "name": a["name"], "desc": a["desc"],
			"got": got.has(a["id"]),
		})
	return out


func mode_label(m: String) -> String:
	match m:
		"classic":
			return "经典"
		"expedition":
			return "远征"
		"endless":
			return "无尽"
	return m
