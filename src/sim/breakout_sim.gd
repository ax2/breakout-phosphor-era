class_name BreakoutSim
extends RefCounted
## 打砖块的核心模拟。完全独立于渲染：不引用任何 Node / 绘制 API，
## 因此可以在无窗口环境下跑自动化测试与长时间统计。
##
## 这一版与网页版 web/js/core.js 对齐：新增「构筑属性层」（mods）、
## 砖块状态效果（灼烧/冻结/导电/再生）、Boss 部件，以及护盾/激光/无人机等被动系统。
## 基础物理与网页版一致，未做任何改动：
##   碰撞顺序：挡板(0) > 砖块(1) > 墙(2)；同类取 t 更小者；每个固定步最多解析 8 次接触。

signal brick_hit(brick: Brick, damage: int, at: Vector2)
signal brick_destroyed(brick: Brick, cause: String, at: Vector2)
signal exploded(center: Vector2, radius: float, destroyed: int)
signal paddle_struck(offset: float, speed: float)
signal wall_bounced(at: Vector2, normal: Vector2)
signal ball_lost_at(pos: Vector2)
signal life_lost(lives_left: int)
signal level_cleared(summary: Dictionary)
signal run_failed(summary: Dictionary)
signal serve_launched(angle: float)
signal assist(msg: String)
signal speed_changed(speed: float)
# 构筑 / Boss 相关
signal boss_phase(index: int, title: String)
signal boss_window(text: String)
signal shield_used(charges_left: int)
signal laser_fired(from: Vector2, to: Vector2)
signal drone_struck(at: Vector2)
signal chain_zap(from: Vector2, to: Vector2)
signal ball_spawned(at: Vector2)
signal last_stand

enum Phase { IDLE, SERVE, PLAY, RESET, CLEAR, FAIL }

const PRIO_PADDLE := 0
const PRIO_BRICK := 1
const PRIO_WALL := 2

const SHIELD_Y := 700.0
const MAX_BALLS := 12
const LASER_RANGE := 260.0
const CHAIN_RANGE := 260.0
const CHAIN_BUDGET := 24

var grid: BrickGrid
var balls: Array[Ball] = []
var phase: int = Phase.IDLE

var paddle_x: float = 640.0
var paddle_target: float = 640.0
var paddle_w: float = GC.PADDLE_W
var paddle_vx: float = 0.0
var paddle_max_speed: float = GC.MOUSE_PADDLE_SPEED
var last_paddle_offset: float = 0.0

var lives: int = 3
var score: int = 0
var combo: int = 0
var best_combo: int = 0
var speed: float = GC.BALL_BASE_SPEED
var base_speed: float = GC.BALL_BASE_SPEED

var level_id: String = ""
var level_name: String = ""
var level_codename: String = ""
var time: float = 0.0
var level_time: float = 0.0
var paused: bool = false

var assist_active: bool = false
var assist_enabled: bool = true
var assist_reason: String = ""
var assist_target: Brick = null

# ---- 构筑层 ----------------------------------------------------------
var mods: Dictionary = {}
var boss: Boss = null
var shield: int = 0
var laser_t: float = 0.0
var drone_t: float = 2.5

var stats := {
	"hits": 0,
	"bricks": 0,
	"max_combo": 0,
	"assists": 0,
	"bounces": 0,
	"wall_bounces": 0,
	"kills": 0,
	"damage": 0,
}

var rng := XRand.new(1)

var _reset_timer: float = 0.0
var _last_break_time: float = -99.0
var _last_paddle_time: float = -99.0
var _last_brick_time: float = 0.0
var _nearest_timer: float = 0.0
var _chain_budget: int = 0
var _cleared_emitted: bool = false


# ---------------------------------------------------------------- 属性表
## 与网页版 defaultStats() 一一对应
static func default_mods() -> Dictionary:
	return {
		"damage": 1, "critChance": 0.0, "critMult": 2.0, "centerCrit": false,
		"pierce": 0, "maxSpeed": GC.BALL_MAX_SPEED, "startSpeed": GC.BALL_BASE_SPEED,
		"burn": 0.0, "burnDps": 0.0, "burnSpread": 0.0,
		"explodeChance": 0.0, "explodeRadius": 1.0,
		"freezeChance": 0.0, "freezeDur": 0.0, "shatter": 0.0,
		"charge": 0.0, "chainCount": 0.0, "chainDamage": 1.0,
		"balls": 1.0, "splitChance": 0.0,
		"paddleW": GC.PADDLE_W, "paddleSpeed": 1.0,
		"magnet": 0.0, "laserCd": 0.0, "laserDamage": 1.0, "drones": 0.0,
		"shieldCharges": 0.0, "shieldMax": 0.0,
		"goldBonus": 0.0, "xpBonus": 0.0, "comboBonus": 1.0,
		"bounceDamage": 0.0, "lastStand": false,
		"lifesteal": 0.0,
	}


func _init() -> void:
	mods = default_mods()


## 由远征层在开打前注入汇总后的属性
func set_mods(m: Dictionary) -> void:
	mods = default_mods()
	for k in m.keys():
		mods[k] = m[k]
	paddle_w = float(mods.get("paddleW", GC.PADDLE_W))
	shield = int(mods.get("shieldCharges", 0))
	speed = minf(float(mods.get("startSpeed", GC.BALL_BASE_SPEED)), float(mods.get("maxSpeed", GC.BALL_MAX_SPEED)))
	for b in balls:
		if b.attached or not b.active:
			continue
		var s := b.vel.length()
		if s > 1e-6:
			var target := clampf(s, float(mods["startSpeed"]), float(mods["maxSpeed"]))
			b.vel = b.vel / s * target
	paddle_x = clampf(paddle_x, GC.WALL_L + paddle_w * 0.5, GC.WALL_R - paddle_w * 0.5)


# ---------------------------------------------------------------- 构建
func setup_level(def: Dictionary, seed_value: int = 1) -> void:
	rng = XRand.new(seed_value if seed_value != 0 else 1)
	grid = BrickGrid.from_rows(def.get("rows", []), def.get("legend", ContentDB.legend()))
	level_id = str(def.get("id", "custom"))
	level_name = str(def.get("name", "自定义"))
	level_codename = str(def.get("codename", ""))
	lives = int(def.get("lives", 3))
	base_speed = float(def.get("speed", GC.BALL_BASE_SPEED))
	paddle_w = float(mods.get("paddleW", GC.PADDLE_W))
	paddle_x = (GC.WALL_L + GC.WALL_R) * 0.5
	paddle_target = paddle_x
	paddle_vx = 0.0
	score = 0
	combo = 0
	best_combo = 0
	time = 0.0
	level_time = 0.0
	paused = false
	assist_active = false
	assist_reason = ""
	assist_target = null
	_cleared_emitted = false
	_last_break_time = -99.0
	_last_brick_time = 0.0
	for k in stats.keys():
		stats[k] = 0
	balls.clear()
	shield = int(mods.get("shieldCharges", 0))
	laser_t = float(mods.get("laserCd", 0.0))
	drone_t = 2.5
	boss = null
	var bdef: Dictionary = def.get("boss", {})
	if not bdef.is_empty():
		boss = Boss.new(bdef, seed_value)
		boss.spawn(self)
	speed = minf(float(mods.get("startSpeed", GC.BALL_BASE_SPEED)), float(mods.get("maxSpeed", GC.BALL_MAX_SPEED)))
	_spawn_serve_ball()
	phase = Phase.SERVE


func _spawn_serve_ball() -> void:
	var b := Ball.new(Vector2(paddle_x, GC.PADDLE_TOP - GC.BALL_R - 1.0))
	b.attached = true
	b.born_at = time
	b.pierce_left = int(mods.get("pierce", 0))
	balls = [b]


# ---------------------------------------------------------------- 输入
func set_paddle_target(x: float, max_speed: float = GC.MOUSE_PADDLE_SPEED) -> void:
	paddle_max_speed = max_speed
	var half := paddle_w * 0.5
	paddle_target = clampf(x, GC.WALL_L + half, GC.WALL_R - half)


func nudge_paddle_target(delta: float) -> void:
	var half := paddle_w * 0.5
	paddle_target = clampf(paddle_target + delta, GC.WALL_L + half, GC.WALL_R - half)


func aim_offset() -> float:
	return clampf((paddle_x - (GC.WALL_L + GC.WALL_R) * 0.5) / (GC.ARENA_W * 0.5), -1.0, 1.0)


## 发球瞄准角度：挡板中线偏左/偏右 → 向左上/右上，最大 45°。
func aim_angle() -> float:
	return deg_to_rad(aim_offset() * 45.0)


func launch() -> void:
	if phase != Phase.SERVE or balls.is_empty():
		return
	var b := balls[0]
	b.attached = false
	var ang := aim_angle()
	var influence := clampf(paddle_vx / 1200.0, -1.0, 1.0) * 0.10
	ang = clampf(ang + influence, -deg_to_rad(50.0), deg_to_rad(50.0))
	var spd := minf(float(mods.get("startSpeed", GC.BALL_BASE_SPEED)), float(mods.get("maxSpeed", GC.BALL_MAX_SPEED)))
	b.pos = Vector2(paddle_x, GC.PADDLE_TOP - GC.BALL_R - 1.0)
	b.vel = Vector2(sin(ang), -cos(ang)).normalized() * spd
	b.trail.clear()
	b.since_brick = 0.0
	b.pierce_left = int(mods.get("pierce", 0))
	speed = spd
	_last_paddle_time = time
	phase = Phase.PLAY
	serve_launched.emit(ang)


# ---------------------------------------------------------------- 主步进
func step(dt: float = GC.FIXED_DT) -> void:
	if paused or phase == Phase.IDLE or phase == Phase.CLEAR or phase == Phase.FAIL:
		return
	time += dt
	level_time += dt
	_move_paddle(dt)

	match phase:
		Phase.SERVE:
			for b in balls:
				if b.attached:
					b.pos = Vector2(paddle_x, GC.PADDLE_TOP - GC.BALL_R - 1.0)
					b.push_trail()
			_tick_systems(dt)
			return
		Phase.RESET:
			_reset_timer -= dt
			_tick_systems(dt)
			if _reset_timer <= 0.0:
				_spawn_serve_ball()
				phase = Phase.SERVE
			return
		Phase.PLAY:
			pass

	for b in balls:
		if b.active:
			_step_ball(b, dt)
	_tick_statuses(dt)
	_tick_systems(dt)
	if boss != null:
		boss.tick(dt, self)

	var any_alive := false
	for b in balls:
		if b.active:
			any_alive = true
			break
	if not any_alive and phase == Phase.PLAY:
		_on_all_balls_lost()


func _move_paddle(dt: float) -> void:
	var prev := paddle_x
	var max_step := paddle_max_speed * float(mods.get("paddleSpeed", 1.0)) * dt
	var dx := clampf(paddle_target - paddle_x, -max_step, max_step)
	var half := paddle_w * 0.5
	paddle_x = clampf(paddle_x + dx, GC.WALL_L + half, GC.WALL_R - half)
	var raw_v := (paddle_x - prev) / dt
	paddle_vx = lerpf(paddle_vx, raw_v, 0.45)


# ---------------------------------------------------------------- 被动系统
func _tick_systems(dt: float) -> void:
	if float(mods.get("laserCd", 0.0)) > 0.0 and phase == Phase.PLAY:
		laser_t -= dt
		if laser_t <= 0.0:
			laser_t = float(mods["laserCd"])
			var target := _lowest_brick_near(paddle_x, LASER_RANGE)
			if target != null:
				_damage_brick(target, float(mods.get("laserDamage", 1.0)), Vector2(paddle_x, GC.PADDLE_TOP - 10.0), "laser", false)
				laser_fired.emit(Vector2(paddle_x, GC.PADDLE_TOP - 10.0), target.center())
	if float(mods.get("drones", 0.0)) > 0.0 and phase == Phase.PLAY:
		drone_t -= dt
		if drone_t <= 0.0:
			drone_t = 2.6 / maxf(1.0, float(mods["drones"]))
			var list := _destructible_bricks()
			if not list.is_empty():
				var t: Brick = list[rng.range_i(0, list.size() - 1)]
				_damage_brick(t, 1.0, t.center(), "drone", false)
				drone_struck.emit(t.center())


func _lowest_brick_near(x: float, range_px: float) -> Brick:
	var best: Brick = null
	var best_y := -1e9
	for b in _all_bricks():
		if not b.vulnerable():
			continue
		if absf(b.center().x - x) > range_px:
			continue
		if b.center().y > best_y:
			best_y = b.center().y
			best = b
	return best


func _all_bricks() -> Array:
	var arr: Array = []
	if grid != null:
		arr = grid.alive_bricks()
	if boss != null:
		for p in boss.parts:
			if p.alive:
				arr.append(p)
	return arr


func _destructible_bricks() -> Array:
	var out: Array = []
	for b in _all_bricks():
		if b.vulnerable():
			out.append(b)
	return out


# ---------------------------------------------------------------- 球的步进
func _step_ball(b: Ball, dt: float) -> void:
	b.since_brick += dt
	b.idle_time += dt
	var remaining := dt
	var guard := 0
	while remaining > 1e-7 and guard < GC.MAX_CONTACTS_PER_STEP:
		guard += 1
		var p0 := b.pos
		var p1 := b.pos + b.vel * remaining
		var hit := _earliest_hit(b, p0, p1)
		if hit.is_empty():
			b.pos = p1
			break
		var t: float = hit["t"]
		var n: Vector2 = hit["normal"]
		var safe_t := maxf(0.0, t - 0.0004)
		b.pos = p0 + (p1 - p0) * safe_t
		remaining *= (1.0 - safe_t)
		if t <= 1e-5:
			b.pos += n * (float(hit.get("pen", 0.0)) + 0.03)
			remaining -= 0.0005
		_resolve(b, hit, n)
		if not b.active:
			return
		if phase != Phase.PLAY:
			return
		b.pos += n * 0.02

	b.push_trail()

	# 底部护盾：吸收一次掉落
	if b.pos.y + b.radius >= SHIELD_Y and shield > 0 and b.vel.y > 0.0:
		shield -= 1
		b.pos.y = SHIELD_Y - b.radius - 1.0
		b.vel.y = -absf(b.vel.y)
		shield_used.emit(shield)

	if b.pos.y - b.radius > GC.DEATH_Y:
		b.active = false
		ball_lost_at.emit(b.pos)

	_apply_antistuck(b, dt)


# ---------------------------------------------------------------- 接触判定
func _earliest_hit(b: Ball, p0: Vector2, p1: Vector2) -> Dictionary:
	var best := {}
	var d := p1 - p0

	# 挡板（最高优先级：同一时刻同时接触时先解析挡板，保证接球手感优先）
	var pr := Rect2(paddle_x - paddle_w * 0.5, GC.PADDLE_TOP, paddle_w, GC.PADDLE_H)
	var ph := Sweep.circle_rect(p0, p1, b.radius, pr)
	if not ph.is_empty():
		best = _pick(best, ph["t"], ph["normal"], "paddle", PRIO_PADDLE, null, ph.get("pen", 0.0))

	# 砖块
	if grid != null:
		for brick in grid.candidates_for_segment(p0, p1, b.radius):
			var bh := Sweep.circle_rect(p0, p1, b.radius, brick.rect)
			if bh.is_empty():
				continue
			best = _pick(best, bh["t"], bh["normal"], "brick", PRIO_BRICK, brick, bh.get("pen", 0.0))

	# Boss 部件（粗筛：横向完全不重叠的直接跳过）
	if boss != null:
		for part in boss.parts:
			if not part.alive:
				continue
			if part.rect.position.x > p1.x + b.radius + 40.0 and part.rect.position.x > p0.x + b.radius + 40.0:
				continue
			if part.rect.position.x + part.rect.size.x < p0.x - b.radius - 40.0 and part.rect.position.x + part.rect.size.x < p1.x - b.radius - 40.0:
				continue
			var ph2 := Sweep.circle_rect(p0, p1, b.radius, part.rect)
			if not ph2.is_empty():
				best = _pick(best, ph2["t"], ph2["normal"], "brick", PRIO_BRICK, part, ph2.get("pen", 0.0))

	# 墙（左/右/顶）
	if d.x < -1e-9:
		best = _pick(best, (GC.WALL_L + b.radius - p0.x) / d.x, Vector2(1, 0), "wall", PRIO_WALL)
	elif d.x > 1e-9:
		best = _pick(best, (GC.WALL_R - b.radius - p0.x) / d.x, Vector2(-1, 0), "wall", PRIO_WALL)
	if d.y < -1e-9:
		best = _pick(best, (GC.CEIL_Y + b.radius - p0.y) / d.y, Vector2(0, 1), "wall", PRIO_WALL)
	return best


func _pick(best: Dictionary, t: float, n: Vector2, kind: String, prio: int, obj = null, pen: float = 0.0) -> Dictionary:
	if t < -1e-6 or t > 1.0:
		return best
	# 扫掠在角落会返回 (1,1) 这类未归一化法线；Godot 的 bounce() 要求单位向量
	var unit := n.normalized() if n.length_squared() > 1e-12 else n
	var cand := {"kind": kind, "t": t, "normal": unit, "pen": pen, "obj": obj, "prio": prio}
	if best.is_empty():
		return cand
	var bt: float = best["t"]
	var bp: int = best["prio"]
	if t < bt - 1e-6 or (absf(t - bt) <= 1e-6 and prio < bp):
		return cand
	return best


func _resolve(b: Ball, hit: Dictionary, n: Vector2) -> void:
	var kind: String = hit["kind"]
	match kind:
		"paddle":
			_paddle_bounce(b)
		"wall":
			b.vel = Sweep.clamp_to_min_vertical(b.vel.bounce(n), GC.MIN_VERTICAL_RATIO)
			wall_bounced.emit(b.pos, n)
			stats["wall_bounces"] += 1
			stats["bounces"] += 1
		"brick":
			_hit_brick(b, hit["obj"], n)


func _paddle_bounce(b: Ball) -> void:
	var half := paddle_w * 0.5
	var off := clampf((b.pos.x - paddle_x) / half, -1.0, 1.0)
	var ang := deg_to_rad(off * GC.PADDLE_ANGLE_DEG)
	var influence := clampf(paddle_vx / 1200.0, -1.0, 1.0) * deg_to_rad(GC.PADDLE_INFLUENCE * 30.0)
	ang += influence
	var lim := deg_to_rad(GC.PADDLE_MAX_ANGLE_DEG)
	ang = clampf(ang, -lim, lim)
	var spd := b.vel.length()
	if spd < 1.0:
		spd = speed
	b.vel = Vector2(sin(ang), -cos(ang)).normalized() * spd
	b.pos.y = minf(b.pos.y, GC.PADDLE_TOP - b.radius - 0.02)
	b.since_brick = 0.0
	b.stall_time = 0.0
	b.idle_time = 0.0
	last_paddle_offset = off
	_last_paddle_time = time
	stats["bounces"] += 1

	# 精准接球：挡板中心 18% 区域接球后，下一击必暴击
	if bool(mods.get("centerCrit", false)) and absf(off) < 0.18:
		b.crit_next = true
	# 反弹蓄能：每接住一次球，本颗球伤害 +1（上限 +3）
	var bd := int(mods.get("bounceDamage", 0))
	if bd > 0:
		b.damage_bonus = mini(3, b.damage_bonus + bd)
	# 磁吸：接球后轻微回正
	var mag := float(mods.get("magnet", 0.0))
	if mag > 0.0:
		var s2 := b.vel.length()
		var dirv := b.dir()
		var toward := signf(paddle_x - b.pos.x)
		var nv := Vector2(dirv.x + toward * 0.06 * mag, dirv.y) * s2
		b.vel = Sweep.clamp_to_min_vertical(nv, GC.MIN_VERTICAL_RATIO)

	paddle_struck.emit(off, spd)


# ---------------------------------------------------------------- 砖块与伤害
func _hit_brick(b: Ball, brick: Brick, n: Vector2) -> void:
	if brick == null or not brick.alive:
		return
	stats["hits"] += 1
	_last_brick_time = time
	b.since_brick = 0.0
	b.idle_time = 0.0

	if brick.is_solid():
		brick_hit.emit(brick, 0, b.pos)
		b.vel = Sweep.clamp_to_min_vertical(b.vel.bounce(n), GC.MIN_VERTICAL_RATIO)
		stats["bounces"] += 1
		return

	if brick.invuln:
		brick_hit.emit(brick, 0, b.pos)
		b.vel = Sweep.clamp_to_min_vertical(b.vel.bounce(n), GC.MIN_VERTICAL_RATIO)
		stats["bounces"] += 1
		return

	var dmg := float(mods.get("damage", 1)) + float(b.damage_bonus)
	var crit := false
	if b.crit_next or rng.next_float() < float(mods.get("critChance", 0.0)):
		crit = true
		b.crit_next = false
		dmg *= float(mods.get("critMult", 2.0))
	if brick.frozen > 0.0:
		dmg *= 1.0 + float(mods.get("shatter", 0.0))

	_damage_brick(brick, dmg, b.pos, "ball", crit)

	# 状态施加
	var burn := float(mods.get("burn", 0.0))
	if burn > 0.0:
		brick.burn = minf(4.0, brick.burn + burn)
		brick.burn_dps = maxf(brick.burn_dps, float(mods.get("burnDps", 0.0)))
	var fc := float(mods.get("freezeChance", 0.0))
	if fc > 0.0 and rng.next_float() < fc:
		brick.frozen = maxf(brick.frozen, float(mods.get("freezeDur", 2.5)))
	var ch := float(mods.get("charge", 0.0))
	if ch > 0.0:
		brick.charge = minf(4.0, brick.charge + ch)

	# 贯穿：不反弹，剩余次数递减
	if b.pierce_left > 0:
		b.pierce_left -= 1
		return

	b.vel = Sweep.clamp_to_min_vertical(b.vel.bounce(n), GC.MIN_VERTICAL_RATIO)
	stats["bounces"] += 1


## 统一伤害入口（球 / 激光 / 无人机 / 灼烧 / 导电 / 爆裂）
func _damage_brick(brick: Brick, dmg: float, at: Vector2, source: String, crit: bool = false) -> int:
	if brick == null or not brick.alive or brick.invuln:
		return 0
	var d := maxi(1, int(round(dmg)))
	if brick.is_solid():
		return 0
	brick.hp -= d
	stats["damage"] = int(stats["damage"]) + d
	brick_hit.emit(brick, d, at)
	if brick.hp <= 0:
		_destroy_brick(brick, source)
		if crit:
			stats["kills"] = int(stats["kills"]) + 1
		return d
	return d


func _destroy_brick(brick: Brick, cause: String) -> void:
	if brick == null or not brick.alive:
		return
	var at := brick.center()
	var bonus := 1.0
	if cause == "ball" or cause == "laser" or cause == "drone":
		if time - _last_break_time <= GC.COMBO_WINDOW:
			combo += 1
		else:
			combo = 1
		_last_break_time = time
		bonus = (1.0 + GC.COMBO_BONUS * float(combo - 1)) * float(mods.get("comboBonus", 1.0))
		best_combo = maxi(best_combo, combo)
	stats["max_combo"] = maxi(int(stats["max_combo"]), combo)
	score += int(round(float(brick.score_value()) * bonus))
	stats["bricks"] = int(stats["bricks"]) + 1

	if brick.is_part and boss != null:
		boss.on_part_destroyed(brick, self)
	elif grid != null:
		grid.remove(brick)
	else:
		brick.alive = false
	brick_destroyed.emit(brick, cause, at)

	# 导电：命中带电的砖后向邻近跳跃
	var cc := int(mods.get("chainCount", 0))
	if cc > 0 and brick.charge > 0.0:
		_chain_from(brick, cc, float(mods.get("chainDamage", 1.0)))

	# 爆裂砖 / 概率爆炸
	if brick.is_blast() and cause != "chain":
		_explode(at, 1, 0)
	elif float(mods.get("explodeChance", 0.0)) > 0.0 and rng.next_float() < float(mods["explodeChance"]):
		_explode(at, int(mods.get("explodeRadius", 1.0)), 1)

	# 分裂
	if float(mods.get("splitChance", 0.0)) > 0.0 and balls.size() < MAX_BALLS and rng.next_float() < float(mods["splitChance"]):
		_spawn_extra_ball(at)

	# 灼烧扩散
	if float(mods.get("burnSpread", 0.0)) > 0.0 and brick.burn > 0.0:
		for nb in _neighbors(brick):
			if not nb.is_solid() and not nb.invuln:
				nb.burn = minf(4.0, nb.burn + float(mods["burnSpread"]))
				nb.burn_dps = maxf(nb.burn_dps, float(mods.get("burnDps", 0.0)))

	speed = minf(float(mods.get("maxSpeed", GC.BALL_MAX_SPEED)), speed + GC.SPEED_PER_BRICK)
	_apply_speed_to_balls()
	_check_clear()


func _check_clear() -> void:
	if _cleared_emitted or phase != Phase.PLAY:
		return
	var grid_done := grid == null or grid.is_cleared()
	var boss_done := boss == null or boss.is_dead()
	if grid_done and boss_done:
		_cleared_emitted = true
		phase = Phase.CLEAR
		var clear_bonus := lives * 250 + maxi(0, int(6000.0 - level_time * 20.0))
		score += clear_bonus
		level_cleared.emit(build_summary(true, clear_bonus))


func _neighbors(brick: Brick) -> Array:
	var out: Array = []
	if grid != null:
		for dc in range(-1, 2):
			for dr in range(-1, 2):
				if dc == 0 and dr == 0:
					continue
				var n := grid.cell_at(brick.col + dc, brick.row + dr)
				if n != null and n.alive:
					out.append(n)
	if boss != null:
		for p in boss.parts:
			if not p.alive or p == brick:
				continue
			if absf(p.center().x - brick.center().x) < 120.0 and absf(p.center().y - brick.center().y) < 60.0:
				out.append(p)
	return out


func _chain_from(src: Brick, count: int, dmg: float) -> void:
	var from: Brick = src
	var hit_set := {src: true}
	for i in range(count):
		var best: Brick = null
		var bd := 1e9
		for b in _all_bricks():
			if hit_set.has(b) or not b.vulnerable():
				continue
			var d := from.center().distance_squared_to(b.center())
			if d < bd and d < CHAIN_RANGE * CHAIN_RANGE:
				bd = d
				best = b
		if best == null:
			break
		hit_set[best] = true
		chain_zap.emit(from.center(), best.center())
		_damage_brick(best, dmg, best.center(), "chain", false)
		from = best


func _explode(center: Vector2, radius_cells: int, depth: int) -> void:
	if depth > 2 or grid == null:
		return
	_chain_budget = CHAIN_BUDGET
	var cx := int((center.x - GC.GRID_X) / GC.BRICK_W)
	var cy := int((center.y - GC.GRID_Y) / GC.BRICK_H)
	var targets: Array = []
	for dr in range(-radius_cells, radius_cells + 1):
		for dc in range(-radius_cells, radius_cells + 1):
			if dr == 0 and dc == 0:
				continue
			var nb := grid.cell_at(cx + dc, cy + dr)
			if nb != null and nb.vulnerable():
				targets.append(nb)
	if boss != null:
		for p in boss.parts:
			if not p.vulnerable():
				continue
			if absf(p.center().x - center.x) < 110.0 and absf(p.center().y - center.y) < 80.0:
				targets.append(p)

	var destroyed := 0
	for nb in targets:
		if _chain_budget <= 0:
			break
		if not nb.alive:
			continue
		_chain_budget -= 1
		var blast: bool = nb.is_blast()
		_damage_brick(nb, 1.0, center, "chain", false)
		if not nb.alive:
			destroyed += 1
			if blast:
				_explode(nb.center(), 1, depth + 1)
	exploded.emit(center, float(radius_cells), destroyed)


func _spawn_extra_ball(at: Vector2) -> void:
	if balls.size() >= MAX_BALLS:
		return
	var nb := Ball.new(at)
	var a := rng.range_f(0.0, TAU)
	var spd := maxf(380.0, speed * 0.9)
	nb.vel = Vector2(cos(a), sin(a)) * spd
	balls.append(nb)
	ball_spawned.emit(at)


func _apply_speed_to_balls() -> void:
	for b in balls:
		if b.attached or not b.active:
			continue
		var d := b.vel.normalized()
		b.vel = d * speed
	speed_changed.emit(speed)


# ---------------------------------------------------------------- 状态结算
func _tick_statuses(dt: float) -> void:
	for b in _all_bricks():
		if not b.alive:
			continue
		if b.burn > 0.0:
			b.burn = maxf(0.0, b.burn - dt)
			if b.burn_dps > 0.0:
				b.burn_acc += b.burn_dps * dt
				if b.burn_acc >= 1.0:
					var d := int(floor(b.burn_acc))
					b.burn_acc -= float(d)
					_damage_brick(b, float(d), b.center(), "burn", false)
		if b.frozen > 0.0:
			b.frozen = maxf(0.0, b.frozen - dt)
		if b.charge > 0.0:
			b.charge_timer -= dt
			if b.charge_timer <= 0.0:
				b.charge = 0.0
				b.charge_timer = 6.0
		if b.regen > 0 and b.alive:
			b.regen_timer -= dt
			if b.regen_timer <= 0.0 and b.hp < b.max_hp:
				b.hp = mini(b.max_hp, b.hp + b.regen)
				b.regen_timer = 7.0


# ---------------------------------------------------------------- 失球
func _on_all_balls_lost() -> void:
	balls.clear()
	combo = 0
	lives -= 1
	speed = minf(float(mods.get("startSpeed", GC.BALL_BASE_SPEED)), float(mods.get("maxSpeed", GC.BALL_MAX_SPEED)))
	_last_paddle_time = time

	# 背水一战：最后一次机会时保留 1 命
	if bool(mods.get("lastStand", false)) and lives == 0:
		mods["lastStand"] = false
		lives = 1
		last_stand.emit()
		phase = Phase.RESET
		_reset_timer = GC.SERVE_DELAY
		return

	if lives <= 0:
		phase = Phase.FAIL
		run_failed.emit(build_summary(false, 0))
	else:
		phase = Phase.RESET
		_reset_timer = GC.SERVE_DELAY
		life_lost.emit(lives)


# ---------------------------------------------------------------- 防卡死 / 收尾引导
func _apply_antistuck(b: Ball, dt: float) -> void:
	if b.attached or not b.active:
		return
	var d := b.dir()
	# 1) 近水平：持续一段时间后轻微旋转
	if absf(d.y) < GC.STALL_VERTICAL_EPS:
		b.stall_time += dt
		if b.stall_time >= GC.STALL_TIME:
			var sgn := 1.0 if d.x >= 0.0 else -1.0
			var rotated := b.vel.rotated(sgn * deg_to_rad(16.0))
			b.vel = Sweep.clamp_to_min_vertical(rotated, 0.22)
			b.stall_time = 0.0
			stats["assists"] += 1
			assist.emit("轨迹修正：近乎水平")
	else:
		b.stall_time = maxf(0.0, b.stall_time - dt * 2.0)

	# 2) 位置停滞（卡角/卡进几何体）
	if b.probe_timer <= 0.0:
		b.probe_pos = b.pos
		b.probe_timer = 1.0
	else:
		b.probe_timer -= dt
		if b.probe_timer <= 0.0:
			if b.pos.distance_to(b.probe_pos) < 8.0:
				var away := (b.pos - Vector2((GC.WALL_L + GC.WALL_R) * 0.5, GC.PADDLE_TOP)).normalized()
				if away.length_squared() < 0.1:
					away = Vector2.UP
				b.vel = Sweep.clamp_to_min_vertical(away * speed, 0.35)
				b.pos += away * 3.0
				stats["assists"] += 1
				assist.emit("救援：脱离卡位")

	# 3) 残响引导（收尾）
	_update_assist_target(b)
	if assist_active and assist_target != null and assist_target.alive:
		var alive_n := 0 if grid == null else grid.destructible_alive
		var rate := GC.ECHO_STEER_RATE if alive_n > GC.ECHO_BRICK_COUNT else GC.ECHO_FORCE_STEER_RATE
		if b.pos.y < GC.PADDLE_TOP - 70.0:
			var to := (assist_target.center() - b.pos).normalized()
			var cur := b.dir()
			var diff := wrapf(atan2(to.y, to.x) - atan2(cur.y, cur.x), -PI, PI)
			var max_step := rate * dt
			var nd := cur.rotated(clampf(diff, -max_step, max_step))
			# 引导不得把球压成水平
			if absf(nd.y) >= GC.MIN_VERTICAL_RATIO:
				b.vel = nd * b.vel.length()


func _update_assist_target(b: Ball) -> void:
	_nearest_timer -= GC.FIXED_DT
	if not assist_enabled:
		assist_active = false
		assist_reason = ""
		assist_target = null
		return
	var alive_n := 0 if grid == null else grid.destructible_alive
	var idle_for := time - _last_brick_time
	var want := false
	var reason := ""
	if alive_n > 0 and alive_n <= GC.ECHO_BRICK_COUNT:
		want = true
		reason = "残响引导 · 弱点标记"
	elif idle_for >= GC.NO_BRICK_ASSIST_TIME and alive_n > 0:
		want = true
		reason = "残响引导 · 长时间未命中"
	if idle_for >= GC.IDLE_RESCUE_TIME and alive_n > 0:
		reason = "轨迹救援"

	if not want:
		if assist_active:
			assist_active = false
			assist_reason = ""
			assist_target = null
		return
	if _nearest_timer > 0.0 and assist_target != null and assist_target.alive:
		return
	_nearest_timer = 0.25
	var best: Brick = null
	var bd := INF
	for brick in _all_bricks():
		if not brick.vulnerable():
			continue
		var dd: float = brick.center().distance_squared_to(b.pos)
		if dd < bd:
			bd = dd
			best = brick
	if best != null:
		var was := assist_active
		assist_active = true
		assist_target = best
		if reason != assist_reason:
			assist_reason = reason
			if not was:
				stats["assists"] += 1
				assist.emit(reason)


# ---------------------------------------------------------------- Boss 通知
func emit_boss_phase(index: int, title: String) -> void:
	boss_phase.emit(index, title)


func emit_boss_window(text: String) -> void:
	boss_window.emit(text)


# ---------------------------------------------------------------- 结算
func build_summary(win: bool, clear_bonus: int) -> Dictionary:
	return {
		"win": win,
		"level_id": level_id,
		"level_name": level_name,
		"score": score,
		"lives_left": maxi(lives, 0),
		"time": level_time,
		"bricks": int(stats["bricks"]),
		"hits": int(stats["hits"]),
		"max_combo": maxi(int(stats["max_combo"]), best_combo),
		"assists": int(stats["assists"]),
		"clear_bonus": clear_bonus,
		"damage": int(stats["damage"]),
	}


func ball_speed() -> float:
	for b in balls:
		if b.active and not b.attached:
			return b.vel.length()
	return speed


func is_playing() -> bool:
	return phase == Phase.PLAY
