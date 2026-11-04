class_name Boss
extends RefCounted
## Boss 框架 + 6 个 Boss 的具体行为。
##
## 移植自网页版 web/js/core.js 的 Boss 与 content.js 里每个 boss 的 tick/onPart。
## 部件（parts）是不进入网格的砖块：核心（role=core）决定血量，
## 护甲/节点（role=armor）决定核心是否无敌。两者都用 Brick 表示，
## 这样碰撞、受伤、爆裂、共享结算全部可以复用同一套逻辑。

const CX := 640.0
const CY := 240.0

var def: Dictionary = {}
var hp: int = 1
var max_hp: int = 1
var phase: int = 0
var parts: Array = []              # Array[Brick]
var t: float = 0.0
var telegraph: Dictionary = {}     # {"text":String, "t":float, "total":float}
var window: float = 0.0            # 核心暴露窗口剩余时间
var state: Dictionary = {}
var behavior: String = ""
var rng := XRand.new(7)


func _init(d: Dictionary, seed_value: int = 7) -> void:
	def = d
	behavior = str(d.get("behavior", d.get("id", "")))
	hp = int(d.get("hp", 1))
	max_hp = hp
	rng = XRand.new(seed_value if seed_value != 0 else 7)


# ---------------------------------------------------------------- 生成
func spawn(sim = null) -> void:
	parts.clear()
	for p in def.get("parts", []):
		var box := Rect2(
			CX + float(p.get("x", 0)) - float(p.get("w", 84)) * 0.5,
			CY + float(p.get("y", 0)) - float(p.get("h", 26)) * 0.5,
			float(p.get("w", 84)),
			float(p.get("h", 26))
		)
		var b := Brick.part(
			str(p.get("id", "")),
			str(p.get("role", "armor")),
			str(p.get("type", "armorPlate")),
			box,
			int(p.get("hp", 1))
		)
		b.invuln = bool(p.get("invuln", false))
		b.regen = int(p.get("regen", 0))
		b.regen_timer = 7.0
		parts.append(b)
	hp = int(def.get("hp", 1))
	max_hp = hp
	phase = 0
	t = 0.0
	state = {}
	apply_phase(0, sim, true)


func alive_parts() -> Array:
	var out: Array = []
	for p in parts:
		if p.alive:
			out.append(p)
	return out


func armor_alive() -> int:
	var n := 0
	for p in parts:
		if p.alive and p.role == "armor":
			n += 1
	return n


func core() -> Brick:
	for p in parts:
		if p.alive and p.role == "core":
			return p
	return null


func part_by_id(id: String) -> Brick:
	for p in parts:
		if p.part_id == id:
			return p
	return null


# ---------------------------------------------------------------- 阶段
func apply_phase(idx: int, sim = null, silent: bool = false) -> void:
	var phases: Array = def.get("phases", [])
	if idx < 0 or idx >= phases.size():
		return
	var ph: Dictionary = phases[idx]
	phase = idx
	window = 0.0
	var armor_left := armor_alive()
	for p in parts:
		if p.role == "core":
			p.invuln = bool(ph.get("coreInvuln", false)) and armor_left > 0
		elif p.role == "armor":
			p.invuln = bool(ph.get("armorInvuln", false))
	telegraph = {"text": str(ph.get("name", "")), "t": 1.6, "total": 1.6}
	if not silent and sim != null:
		sim.emit_boss_phase(idx, str(ph.get("name", "")))


func check_phase(sim = null) -> void:
	var pct := float(hp) / float(maxi(max_hp, 1))
	var phases: Array = def.get("phases", [])
	for i in range(phases.size() - 1, -1, -1):
		if pct <= float(phases[i].get("at", 1.0)) and phase < i:
			apply_phase(i, sim, false)
			return


func on_part_destroyed(part: Brick, sim = null) -> void:
	part.alive = false
	if part.role == "core":
		hp = 0
	_behavior_on_part(part, sim)
	var armor_left := armor_alive()
	var cores := 0
	for p in parts:
		if p.alive and p.role == "core":
			cores += 1
	if cores > 0 and armor_left == 0:
		for p in parts:
			if p.alive and p.role == "core":
				p.invuln = false
		window = 6.5
		if sim != null:
			sim.emit_boss_window("核心暴露")


# ---------------------------------------------------------------- 步进
func tick(dt: float, sim = null) -> void:
	t += dt
	if not telegraph.is_empty():
		telegraph["t"] = float(telegraph["t"]) - dt
		if float(telegraph["t"]) <= 0.0:
			telegraph = {}
	if window > 0.0:
		window = maxf(0.0, window - dt)
	_behavior_tick(dt, sim)
	var c := core()
	if c != null:
		hp = maxi(0, c.hp)
	check_phase(sim)


func is_dead() -> bool:
	return hp <= 0


# ---------------------------------------------------------------- 六种行为
func _behavior_tick(dt: float, sim) -> void:
	match behavior:
		"b1":
			_tick_warden(dt)
		"b2":
			_tick_colossus(dt, sim)
		"b3":
			_tick_twins(dt)
		"b4":
			_tick_weaver(dt, sim)
		"b5":
			_tick_serpent(dt)
		"b6":
			_tick_host(dt)
		_:
			pass


func _behavior_on_part(part: Brick, sim) -> void:
	match behavior:
		"b1":
			if part.role == "core":
				return
			var left := armor_alive()
			if left <= 2:
				var c := core()
				if c != null:
					c.invuln = false
				window = maxf(window, 7.0)
				if sim != null:
					sim.emit_boss_window("护甲缺口：%d 块" % left)
		"b2":
			if part.role == "core":
				return
			state["heat"] = minf(100.0, float(state.get("heat", 0.0)) + 18.0)
		"b3":
			if part.role == "core":
				return
			var c2 := core()
			if c2 != null:
				c2.invuln = false
			window = 6.0
			if sim != null:
				sim.emit_boss_window("镜面破碎：6 秒窗口")
		"b4":
			if part.role == "core":
				return
			var c3 := core()
			if c3 != null:
				c3.invuln = false
			window = 4.5
			if sim != null:
				sim.emit_boss_window("供能切断：4 秒")
		"b5":
			if part.role == "core":
				return
			var head := part_by_id("head")
			if head != null:
				head.hp = mini(head.max_hp, head.hp + 1)
		"b6":
			if part.role == "core":
				return
			if armor_alive() == 0:
				var c4 := core()
				if c4 != null:
					c4.invuln = false
				window = 6.0
				if sim != null:
					sim.emit_boss_window("全部护甲清除：核心暴露")
		_:
			pass


## b1 终端守卫：四块护甲绕核心旋转，转速随阶段提高
func _tick_warden(dt: float) -> void:
	var speed := 0.85 if phase >= 1 else 0.45
	state["ang"] = float(state.get("ang", 0.0)) + dt * speed
	var ang: float = state["ang"]
	for i in range(parts.size()):
		var p: Brick = parts[i]
		if p.role != "armor" or not p.alive:
			continue
		var a: float = ang + float(i - 1) * PI * 0.5
		p.rect.position = Vector2(
			CX + cos(a) * 150.0 - p.rect.size.x * 0.5,
			CY + sin(a) * 95.0 - p.rect.size.y * 0.5
		)


## b2 熔炉巨像：命中共振升温，满热进入过载（窗口内伤害翻倍由模拟层读 window）
func _tick_colossus(dt: float, sim) -> void:
	state["heat"] = maxf(0.0, float(state.get("heat", 0.0)) - dt * 6.0)
	state["over"] = maxf(0.0, float(state.get("over", 0.0)) - dt)
	if float(state.get("heat", 0.0)) >= 100.0 and float(state.get("over", 0.0)) <= 0.0:
		state["heat"] = 0.0
		state["over"] = 5.0
		window = 5.0
		if sim != null:
			sim.emit_boss_window("过载：伤害翻倍")
	var c := core()
	if c != null:
		c.rect.position.y = 200.0 + sin(t * 1.2) * 18.0 - c.rect.size.y * 0.5


## b3 冰镜双核：两块镜子每 9 秒互换无敌
func _tick_twins(dt: float) -> void:
	state["swap"] = float(state.get("swap", 0.0)) - dt
	if float(state.get("swap", 0.0)) <= 0.0:
		state["swap"] = 9.0
		state["side"] = 1 - int(state.get("side", 0))
		var side := int(state.get("side", 0))
		var m1 := part_by_id("m1")
		var m2 := part_by_id("m2")
		if m1 != null and m1.alive:
			m1.invuln = side != 0
		if m2 != null and m2.alive:
			m2.invuln = side != 1
		window = 0.0


## b4 电网织者：节点数 >= 3 时核心无敌，断开节点开 4 秒窗口
func _tick_weaver(dt: float, sim) -> void:
	state["pulse"] = float(state.get("pulse", 0.0)) + dt
	if float(state["pulse"]) > 4.5:
		state["pulse"] = 0.0
		var c := core()
		var nodes := armor_alive()
		if c != null:
			c.invuln = nodes >= 3
		if nodes < 3:
			window = maxf(window, 4.0)


## b5 折跃巨蛇：头 + 八节身体沿正弦路径游动
func _tick_serpent(dt: float) -> void:
	var head := part_by_id("head")
	if head == null or not head.alive:
		return
	var rate := 1.5 if phase >= 2 else (1.05 if phase >= 1 else 0.75)
	state["p"] = float(state.get("p", 0.0)) + dt * rate
	var p: float = state["p"]
	head.rect.position = Vector2(
		CX + sin(p * 0.9) * 300.0 - head.rect.size.x * 0.5,
		210.0 + sin(p * 1.7) * 70.0 - head.rect.size.y * 0.5
	)
	for i in range(8):
		var s := part_by_id("s%d" % i)
		if s == null or not s.alive:
			continue
		var tt := p - float(i + 1) * 0.42
		s.rect.position = Vector2(
			CX + sin(tt * 0.9) * 300.0 - s.rect.size.x * 0.5,
			210.0 + sin(tt * 1.7) * 70.0 - s.rect.size.y * 0.5
		)


## b6 主机之心：护甲公转 + 节点浮动，护甲清空后核心暴露
func _tick_host(dt: float) -> void:
	state["ang"] = float(state.get("ang", 0.0)) + dt * (0.3 + float(phase) * 0.2)
	var ang: float = state["ang"]
	for i in range(parts.size()):
		var p: Brick = parts[i]
		if not p.alive or p.role != "armor":
			continue
		if p.type == "shieldNode":
			p.rect.position.y += sin(t * 2.0 + float(i)) * 0.6
			continue
		var a: float = ang + float(i % 4) * PI * 0.5
		p.rect.position = Vector2(
			CX + cos(a) * 180.0 - p.rect.size.x * 0.5,
			CY + sin(a) * 110.0 - p.rect.size.y * 0.5
		)
	var c := core()
	if c != null and armor_alive() == 0:
		c.invuln = false
