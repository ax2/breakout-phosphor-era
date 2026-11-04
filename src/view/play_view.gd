class_name PlayView
extends Node2D
## 全部游戏画面的绘制层。只读取 BreakoutSim 的状态，不修改它。
## 屏幕抖动只作用于本节点的 position，绝不改变模拟坐标。

var sim: BreakoutSim = null
var fx := Fx.new()
var accent: Color = Pal.PHOSPHOR
var show_damage_numbers: bool = true
var show_trails: bool = true

var _t: float = 0.0
var _flash: Dictionary = {}
var _shake: float = 0.0
var _combo_pop: float = 0.0
var _last_combo: int = 0
var _level_flash: float = 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 991
	set_process(true)


func attach_sim(s: BreakoutSim) -> void:
	if sim != null and sim.brick_hit.is_connected(_on_brick_hit):
		_disconnect_sim()
	sim = s
	fx.clear()
	_flash.clear()
	_shake = 0.0
	_combo_pop = 0.0
	_last_combo = 0
	_level_flash = 0.0
	position = Vector2.ZERO
	if sim == null:
		return
	sim.brick_hit.connect(_on_brick_hit)
	sim.brick_destroyed.connect(_on_brick_destroyed)
	sim.exploded.connect(_on_exploded)
	sim.paddle_struck.connect(_on_paddle_struck)
	sim.wall_bounced.connect(_on_wall_bounced)
	sim.ball_lost_at.connect(_on_ball_lost)
	sim.serve_launched.connect(_on_serve_launched)
	sim.level_cleared.connect(_on_level_cleared)
	sim.assist.connect(_on_assist)


func _disconnect_sim() -> void:
	sim.brick_hit.disconnect(_on_brick_hit)
	sim.brick_destroyed.disconnect(_on_brick_destroyed)
	sim.exploded.disconnect(_on_exploded)
	sim.paddle_struck.disconnect(_on_paddle_struck)
	sim.wall_bounced.disconnect(_on_wall_bounced)
	sim.ball_lost_at.disconnect(_on_ball_lost)
	sim.serve_launched.disconnect(_on_serve_launched)
	sim.level_cleared.disconnect(_on_level_cleared)
	sim.assist.disconnect(_on_assist)


# ---------------------------------------------------------------- 事件 → 反馈
func _on_brick_hit(brick: Brick, damage: int, at: Vector2) -> void:
	var n := (at - brick.center())
	if n.length_squared() < 0.01:
		n = Vector2.UP
	n = n.normalized()
	var c := Pal.type_color(brick.type)
	_flash[brick] = 0.13
	if damage > 0 and brick.is_solid():
		fx.burst(at, n, Pal.STEEL, 6, 150.0, 1.8)
		fx.ring(at, Pal.STEEL, 2.0, 16.0, 0.28, 1.2)
		Audio.play("sfx_tough", -6.0, 0.75, 0.05)
	else:
		fx.burst(at, n, c, 7, 210.0, 2.0)
		if brick.hp > 0:
			Audio.play("sfx_tough", -5.0, 1.05, 0.06)
	if damage == 0:
		return


func _on_brick_destroyed(brick: Brick, cause: String, at: Vector2) -> void:
	_flash.erase(brick)
	var c := Pal.type_color(brick.type)
	fx.debris(at, brick.rect, c, 9)
	fx.ring(at, c, 4.0, 34.0, 0.36, 1.6)
	_add_shake(0.16 if cause == "ball" else 0.07)
	if show_damage_numbers and cause == "ball":
		var txt := "+%d" % _score_of(brick)
		fx.text(at + Vector2(0, -14), txt, c, 0.65, 15)
	if cause == "ball":
		Audio.play("sfx_brick_break", -3.0, 1.0, 0.08)
	elif cause == "chain":
		Audio.play("sfx_brick", -8.0, 0.9, 0.12)


func _score_of(b: Brick) -> int:
	var base := b.score_value()
	return base


func _on_exploded(center: Vector2, _radius: float, destroyed: int) -> void:
	fx.ring(center, Pal.ROSE, 8.0, 96.0, 0.5, 3.0)
	fx.ring(center, Pal.AMBER, 4.0, 64.0, 0.38, 1.5)
	fx.burst(center, Vector2.UP, Pal.ROSE, 26, 380.0, 3.0)
	_add_shake(0.5)
	Audio.play("sfx_explode", -2.0, 1.0, 0.06)
	if destroyed > 1:
		fx.text(center + Vector2(0, -26), "连锁 ×%d" % destroyed, Pal.AMBER, 0.9, 17)


func _on_paddle_struck(offset: float, speed: float) -> void:
	var p := Vector2(sim.paddle_x + offset * sim.paddle_w * 0.5, GC.PADDLE_TOP)
	fx.burst(p, Vector2(0, -1), accent, 5, 150.0, 1.6)
	fx.ring(p, accent, 2.0, 20.0, 0.26, 1.4)
	Audio.play("sfx_paddle", -4.0, 1.0 + offset * 0.06, 0.04)


func _on_wall_bounced(at: Vector2, normal: Vector2) -> void:
	fx.burst(at, normal, accent.darkened(0.15), 3, 110.0, 1.3)
	Audio.play("sfx_wall", -12.0, 1.0, 0.10)


func _on_ball_lost(at: Vector2) -> void:
	fx.ring(at, Pal.ROSE, 6.0, 70.0, 0.55, 2.4)
	fx.burst(at, Vector2.UP, Pal.ROSE, 14, 240.0, 2.2)
	_add_shake(0.35)
	Audio.play("sfx_life_lost", -3.0)


func _on_serve_launched(_angle: float) -> void:
	fx.burst(Vector2(sim.paddle_x, GC.PADDLE_TOP - 8), Vector2(0, -1), accent, 10, 200.0, 1.8)
	Audio.play("sfx_serve", -4.0)


func _on_level_cleared(_s: Dictionary) -> void:
	_level_flash = 1.0
	_add_shake(0.4)
	Audio.play("sfx_level_clear", -2.0)


func _on_assist(msg: String) -> void:
	fx.text(Vector2(GC.CANVAS.x * 0.5, 470), msg, Pal.AMBER, 1.4, 16)
	Audio.play("sfx_correct", -14.0)


func _add_shake(v: float) -> void:
	_shake = minf(1.0, _shake + v)


# ---------------------------------------------------------------- 帧更新
func _process(delta: float) -> void:
	_t += delta
	fx.density = clampf(float(Game.settings.particles), 0.0, 1.0) * 1.0
	fx.update(delta)
	_shake = maxf(0.0, _shake - delta * 2.4)
	_level_flash = maxf(0.0, _level_flash - delta * 1.6)

	var dead: Array = []
	for k in _flash.keys():
		var v: float = float(_flash[k]) - delta
		if v <= 0.0:
			dead.append(k)
		else:
			_flash[k] = v
	for k in dead:
		_flash.erase(k)

	if sim != null:
		if sim.combo > _last_combo and sim.combo >= 2:
			_combo_pop = 1.0
		_last_combo = sim.combo
	_combo_pop = maxf(0.0, _combo_pop - delta * 3.2)

	var amp := 9.0 * _shake * float(Game.settings.shake)
	position = Vector2(sin(_t * 97.0), cos(_t * 131.0)) * amp
	queue_redraw()


# ---------------------------------------------------------------- 绘制
func _draw() -> void:
	_draw_bg()
	_draw_walls()
	if sim == null:
		return
	_draw_bricks()
	fx.draw_all(self)
	_draw_assist_marker()
	_draw_serve_guide()
	_draw_paddle()
	_draw_balls()
	_draw_inline_status()
	if _level_flash > 0.0:
		draw_rect(Rect2(0, 0, GC.CANVAS.x, GC.CANVAS.y), Color(accent.r, accent.g, accent.b, 0.16 * _level_flash), true)


func _draw_bg() -> void:
	draw_rect(Rect2(0, 0, GC.CANVAS.x, GC.CANVAS.y), Pal.BG, true)
	var bands := 10
	var h := GC.CANVAS.y / float(bands)
	for i in range(bands):
		var f := float(i) / float(bands - 1)
		var c := Pal.BG.lerp(Pal.BG_2, f * 0.85)
		draw_rect(Rect2(0, i * h, GC.CANVAS.x, h + 0.6), c, true)

	# 极淡网格：给几何一个参考系，不抢主体
	var gx := 96.0
	while gx < GC.CANVAS.x:
		draw_line(Vector2(gx, GC.CEIL_Y), Vector2(gx, GC.DEATH_Y), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.028), 1.0)
		gx += 96.0
	var gy := GC.CEIL_Y
	while gy < GC.DEATH_Y:
		draw_line(Vector2(GC.WALL_L, gy), Vector2(GC.WALL_R, gy), Color(Pal.PHOSPHOR.r, Pal.PHOSPHOR.g, Pal.PHOSPHOR.b, 0.022), 1.0)
		gy += 96.0

	# 缓慢扫过的一条亮带
	var sy := fmod(_t * 26.0, GC.CANVAS.y + 200.0) - 100.0
	draw_rect(Rect2(GC.WALL_L, sy, GC.ARENA_W, 2.0), Color(accent.r, accent.g, accent.b, 0.035), true)


func _draw_walls() -> void:
	var c := accent
	var dim := Color(c.r, c.g, c.b, 0.10)
	# 左右墙
	draw_line(Vector2(GC.WALL_L, GC.CEIL_Y), Vector2(GC.WALL_L, GC.DEATH_Y), dim, 7.0)
	draw_line(Vector2(GC.WALL_R, GC.CEIL_Y), Vector2(GC.WALL_R, GC.DEATH_Y), dim, 7.0)
	draw_line(Vector2(GC.WALL_L, GC.CEIL_Y), Vector2(GC.WALL_L, GC.DEATH_Y), Color(c.r, c.g, c.b, 0.55), 1.6)
	draw_line(Vector2(GC.WALL_R, GC.CEIL_Y), Vector2(GC.WALL_R, GC.DEATH_Y), Color(c.r, c.g, c.b, 0.55), 1.6)
	# 顶部
	draw_line(Vector2(GC.WALL_L, GC.CEIL_Y), Vector2(GC.WALL_R, GC.CEIL_Y), dim, 7.0)
	draw_line(Vector2(GC.WALL_L, GC.CEIL_Y), Vector2(GC.WALL_R, GC.CEIL_Y), Color(c.r, c.g, c.b, 0.55), 1.6)

	# 底部危险线：虚线 + 提示色，但保持低对比，避免抢球
	var x := GC.WALL_L
	var dash := 14.0
	var gap := 12.0
	while x < GC.WALL_R:
		draw_line(Vector2(x, GC.DEATH_Y), Vector2(minf(x + dash, GC.WALL_R), GC.DEATH_Y), Color(Pal.ROSE.r, Pal.ROSE.g, Pal.ROSE.b, 0.18), 1.0)
		x += dash + gap

	# 四角括号
	UiStyle.draw_bracket_panel(self, Rect2(GC.WALL_L, GC.CEIL_Y, GC.ARENA_W, GC.DEATH_Y - GC.CEIL_Y), Color(c.r, c.g, c.b, 0.16), 1.0, 22.0)


func _draw_bricks() -> void:
	if sim.grid != null:
		for b in sim.grid.cells:
			if b == null or not b.alive:
				continue
			_draw_brick(b)
	# Boss 部件不在网格里，单独画
	if sim.boss != null:
		for p in sim.boss.parts:
			if p.alive:
				_draw_brick(p)


func _draw_brick(b: Brick) -> void:
	var r := b.rect.grow(-2.0)
	var c := Pal.type_color(b.type)
	var flash: float = clampf(float(_flash.get(b, 0.0)) / 0.13, 0.0, 1.0)
	var fill := c.darkened(0.80)
	if b.is_solid():
		fill = Color("0b1013")
	draw_rect(r, fill, true)

	match b.type:
		"normal":
			draw_rect(r, c, false, 1.4)
			# 右上缺角标识
			draw_rect(Rect2(r.end.x - 16.0, r.position.y + 1.0, 15.0, 3.0), Color(c.r, c.g, c.b, 0.75), true)
			draw_line(r.position + Vector2(3, 3), r.position + Vector2(16, 3), Color(1, 1, 1, 0.16), 1.0)
		"tough":
			draw_rect(r, c, false, 1.4)
			# 双层横条：剩余耐久决定可见条数
			for i in range(b.max_hp):
				var y := r.position.y + r.size.y * (0.34 + 0.32 * float(i))
				var a := 0.65 if i < b.hp else 0.14
				draw_line(Vector2(r.position.x + 8.0, y), Vector2(r.end.x - 8.0, y), Color(c.r, c.g, c.b, a), 1.6)
		"armored":
			draw_rect(r, c, false, 1.8)
			# 斜向装甲纹
			var step := 13.0
			var x := r.position.x - r.size.y
			while x < r.end.x:
				var a0 := Vector2(maxf(x, r.position.x), r.position.y + maxf(0.0, r.position.x - x))
				var x2 := x + r.size.y
				draw_line(a0, Vector2(minf(x2, r.end.x), r.position.y + (minf(x2, r.end.x) - x)), Color(c.r, c.g, c.b, 0.20), 1.0)
				x += step
			# 四角铆钉
			for corner in [Vector2(7, 7), Vector2(r.size.x - 7, 7), Vector2(7, r.size.y - 7), Vector2(r.size.x - 7, r.size.y - 7)]:
				draw_circle(r.position + corner, 1.8, Color(c.r, c.g, c.b, 0.85))
			# 剩余层数：左侧短刻度
			for i in range(b.hp):
				draw_rect(Rect2(r.position.x + 3.0, r.position.y + 4.0 + i * 5.0, 3.0, 3.0), Color(c.r, c.g, c.b, 0.9), true)
		"blast":
			draw_rect(r, c, false, 1.6)
			var ctr := r.get_center()
			var pts := PackedVector2Array([
				ctr + Vector2(0, -9), ctr + Vector2(9, 0), ctr + Vector2(0, 9), ctr + Vector2(-9, 0)
			])
			draw_polyline(pts + PackedVector2Array([pts[0]]), Color(c.r, c.g, c.b, 0.95), 1.4)
			draw_circle(ctr, 3.0, Color(c.r, c.g, c.b, 0.85))
		"solid":
			draw_rect(r, Color("39464d"), false, 2.2)
			var xx := r.position.x - r.size.y
			while xx < r.end.x:
				var p1 := Vector2(maxf(xx, r.position.x), r.position.y + maxf(0.0, r.position.x - xx))
				var xx2 := xx + r.size.y
				draw_line(p1, Vector2(minf(xx2, r.end.x), r.position.y + (minf(xx2, r.end.x) - xx)), Color(0.55, 0.62, 0.66, 0.18), 1.0)
				draw_line(Vector2(minf(xx2, r.end.x), r.position.y + r.size.y - (minf(xx2, r.end.x) - xx)), p1 + Vector2(0, r.size.y), Color(0.55, 0.62, 0.66, 0.10), 1.0)
				xx += 10.0
		"regen":
			# 再生：虚线内框 + 中心回声点，暗示「会自己长回来」
			draw_rect(r, c, false, 1.4)
			var seg := 7.0
			var qx := r.position.x
			while qx < r.end.x - seg:
				draw_line(Vector2(qx, r.position.y + 2.0), Vector2(qx + seg, r.position.y + 2.0), Color(c.r, c.g, c.b, 0.55), 1.2)
				draw_line(Vector2(qx, r.end.y - 2.0), Vector2(qx + seg, r.end.y - 2.0), Color(c.r, c.g, c.b, 0.55), 1.2)
				qx += seg * 2.0
			draw_arc(r.get_center(), 5.0, 0.0, TAU * 0.75, 16, Color(c.r, c.g, c.b, 0.8), 1.2, true)
		"shieldNode":
			# 护盾节点：六边形轮廓
			var ctr2 := r.get_center()
			var hex := PackedVector2Array()
			for i in range(6):
				var a := float(i) / 6.0 * TAU - PI * 0.5
				hex.append(ctr2 + Vector2(cos(a), sin(a)) * minf(r.size.x, r.size.y) * 0.42)
			hex.append(hex[0])
			draw_polyline(hex, Color(c.r, c.g, c.b, 0.9), 1.4)
			draw_circle(ctr2, 2.6, Color(c.r, c.g, c.b, 0.85))
		"core":
			# 核心：脉冲填充 + 十字准星
			var pulse := 0.16 + 0.10 * sin(_t * 4.0)
			draw_rect(r, Color(c.r, c.g, c.b, pulse), true)
			draw_rect(r, c, false, 2.0)
			var ctr3 := r.get_center()
			draw_line(Vector2(ctr3.x - 10.0, ctr3.y), Vector2(ctr3.x + 10.0, ctr3.y), Color(c.r, c.g, c.b, 0.5), 1.0)
			draw_line(Vector2(ctr3.x, ctr3.y - 10.0), Vector2(ctr3.x, ctr3.y + 10.0), Color(c.r, c.g, c.b, 0.5), 1.0)
		"armorPlate":
			# 护甲片：粗边框 + 四角铆钉
			draw_rect(r, Color(c.r, c.g, c.b, 0.10), true)
			draw_rect(r, c, false, 2.0)
			for corner in [Vector2(6, 6), Vector2(r.size.x - 6, 6), Vector2(6, r.size.y - 6), Vector2(r.size.x - 6, r.size.y - 6)]:
				draw_circle(r.position + corner, 2.0, Color(c.r, c.g, c.b, 0.8))
		"weakPoint":
			# 弱点：同心环
			var ctr4 := r.get_center()
			draw_rect(r, Color(c.r, c.g, c.b, 0.10), true)
			draw_arc(ctr4, minf(r.size.x, r.size.y) * 0.40, 0.0, TAU, 24, Color(c.r, c.g, c.b, 0.95), 1.6, true)
			draw_arc(ctr4, minf(r.size.x, r.size.y) * 0.24, 0.0, TAU, 20, Color(c.r, c.g, c.b, 0.7), 1.2, true)
			draw_circle(ctr4, 2.4, Color(c.r, c.g, c.b, 0.9))

	# 状态：冻结 / 灼烧 / 带电 / 无敌
	if b.frozen > 0.0:
		draw_rect(r.grow(1.0), Color(Pal.CYAN.r, Pal.CYAN.g, Pal.CYAN.b, 0.20), true)
		draw_rect(r, Color(Pal.CYAN.r, Pal.CYAN.g, Pal.CYAN.b, 0.85), false, 1.6)
	if b.burn > 0.0:
		var fk := 0.10 + 0.08 * sin(_t * 12.0 + float(b.col))
		draw_rect(r, Color(Pal.ROSE.r, Pal.ROSE.g * 0.6, 0.2, fk), true)
	if b.charge > 0.0:
		var dots := int(minf(b.charge, 4.0))
		for i in range(dots):
			draw_circle(Vector2(r.position.x + 5.0 + i * 7.0, r.end.y - 5.0), 1.8, Color(Pal.VIOLET.r, Pal.VIOLET.g, Pal.VIOLET.b, 0.95))
	if b.invuln:
		draw_rect(r.grow(2.0), Color(0.75, 0.85, 0.95, 0.55), false, 1.2)
		draw_line(r.position, r.end, Color(0.75, 0.85, 0.95, 0.18), 1.0)

	# 受损裂纹（确定性，不逐帧抖动）
	if not b.is_solid() and b.hp < b.max_hp:
		var seedv := b.col * 73 + b.row * 151
		var n := b.max_hp - b.hp
		for i in range(n):
			var sx := r.position.x + 12.0 + float((seedv + i * 37) % 60)
			var sy := r.position.y + 4.0 + float((seedv + i * 53) % 16)
			var pts := PackedVector2Array([
				Vector2(sx, sy),
				Vector2(sx + 6.0, sy + 7.0),
				Vector2(sx + 2.0, sy + 14.0),
				Vector2(sx + 10.0, sy + 19.0),
			])
			draw_polyline(pts, Color(0, 0, 0, 0.45), 1.2)

	if flash > 0.0:
		draw_rect(r, Color(1, 1, 1, 0.55 * flash), true)
		draw_rect(r.grow(2.0), Color(c.r, c.g, c.b, 0.55 * flash), false, 2.0)


func _draw_paddle() -> void:
	var w := sim.paddle_w
	var rect := Rect2(sim.paddle_x - w * 0.5, GC.PADDLE_TOP, w, GC.PADDLE_H)
	var c := accent
	# 底部光晕
	draw_rect(Rect2(rect.position.x + 6.0, rect.end.y + 2.0, rect.size.x - 12.0, 7.0), Color(c.r, c.g, c.b, 0.06), true)
	draw_rect(rect.grow(5.0), Color(c.r, c.g, c.b, 0.05), true)
	# 主体 + 圆角端帽
	draw_rect(rect, Color("0c211a"), true)
	draw_circle(Vector2(rect.position.x + 3.0, rect.get_center().y), 3.0, Color("0c211a"))
	draw_circle(Vector2(rect.end.x - 3.0, rect.get_center().y), 3.0, Color("0c211a"))
	draw_rect(rect, c, false, 1.6)
	draw_line(Vector2(rect.position.x + 4, rect.position.y + 2), Vector2(rect.end.x - 4, rect.position.y + 2), Color(1, 1, 1, 0.35), 1.0)
	# 中心刻度
	var cx := sim.paddle_x
	draw_line(Vector2(cx, rect.position.y + 3), Vector2(cx, rect.end.y - 3), Color(c.r, c.g, c.b, 0.55), 1.0)
	# 两端高亮
	draw_rect(Rect2(rect.position.x, rect.position.y, 7.0, rect.size.y), Color(c.r, c.g, c.b, 0.85), true)
	draw_rect(Rect2(rect.end.x - 7.0, rect.position.y, 7.0, rect.size.y), Color(c.r, c.g, c.b, 0.85), true)


func _draw_balls() -> void:
	for b in sim.balls:
		if not b.active:
			continue
		var c := accent
		if b.attached:
			c = Pal.CYAN
		if show_trails:
			var n := b.trail.size()
			for i in range(n - 1, 0, -1):
				var f := 1.0 - float(i) / float(n)
				var col := Color(c.r, c.g, c.b, 0.20 * f * f)
				draw_circle(b.trail[i], b.radius * (0.25 + 0.6 * f), col)
		draw_circle(b.pos, b.radius * 2.8, Color(c.r, c.g, c.b, 0.06))
		draw_circle(b.pos, b.radius * 1.8, Color(c.r, c.g, c.b, 0.12))
		draw_arc(b.pos, b.radius + 1.4, 0.0, TAU, 22, Color(c.r, c.g, c.b, 0.95), 1.6, true)
		draw_circle(b.pos, b.radius - 1.6, Color(0.94, 1.0, 0.97, 1.0))
		# 方向箭头：让高速时的运动方向一眼可读
		var d := b.dir()
		var tip := b.pos + d * (b.radius + 9.0)
		var l := tip - d * 6.0 + Vector2(-d.y, d.x) * 4.0
		var r2 := tip - d * 6.0 - Vector2(-d.y, d.x) * 4.0
		draw_colored_polygon(PackedVector2Array([tip, l, r2]), Color(c.r, c.g, c.b, 0.9))


func _draw_serve_guide() -> void:
	if sim.phase != BreakoutSim.Phase.SERVE or sim.balls.is_empty():
		return
	var b: Ball = sim.balls[0]
	var ang := sim.aim_angle()
	var d := Vector2(sin(ang), -cos(ang))
	var origin := b.pos + Vector2(0, -4)
	var length := 250.0
	var steps := 16
	var pulse := 0.55 + 0.35 * sin(_t * 5.0)
	for i in range(steps):
		if i % 2 == 1:
			continue
		var t0 := float(i) / float(steps)
		var t1 := float(i + 1) / float(steps)
		var a := Color(accent.r, accent.g, accent.b, (1.0 - t0) * 0.55 * pulse)
		draw_line(origin + d * (t0 * length), origin + d * (t1 * length), a, 1.6)
	var tip := origin + d * length
	var back := tip - d * 12.0
	draw_colored_polygon(PackedVector2Array([
		tip, back + Vector2(-d.y, d.x) * 6.0, back - Vector2(-d.y, d.x) * 6.0
	]), Color(accent.r, accent.g, accent.b, 0.75 * pulse))
	# 角度刻度：理解「挡板位置决定角度」
	var lbl := "发球角度 %+d°" % int(round(rad_to_deg(ang)))
	draw_string(UiStyle.font(), Vector2(origin.x - 70.0, origin.y - 22.0), lbl, HORIZONTAL_ALIGNMENT_CENTER, 140.0, 14, Color(accent.r, accent.g, accent.b, 0.55))


func _draw_assist_marker() -> void:
	if not sim.assist_active or sim.assist_target == null or not sim.assist_target.alive:
		return
	var r := sim.assist_target.rect.grow(3.0)
	var a := 0.45 + 0.35 * sin(_t * 6.0)
	var c := Color(Pal.AMBER.r, Pal.AMBER.g, Pal.AMBER.b, a)
	var arm := 8.0
	# 虚线框
	var x := r.position.x
	while x < r.end.x:
		draw_line(Vector2(x, r.position.y), Vector2(minf(x + 6.0, r.end.x), r.position.y), c, 1.4)
		draw_line(Vector2(x, r.end.y), Vector2(minf(x + 6.0, r.end.x), r.end.y), c, 1.4)
		x += 11.0
	draw_line(r.position, r.position + Vector2(arm, 0), c, 2.0)
	draw_line(r.position, r.position + Vector2(0, arm), c, 2.0)
	draw_line(r.end, r.end - Vector2(arm, 0), c, 2.0)
	draw_line(r.end, r.end - Vector2(0, arm), c, 2.0)


func _draw_inline_status() -> void:
	# 连锁计数：仅在有意义时出现，避免遮挡
	if sim.combo >= 2:
		var sz := 20 + int(_combo_pop * 8.0)
		var c := Pal.AMBER if sim.combo >= 5 else Pal.TEXT
		draw_string(UiStyle.font(), Vector2(GC.WALL_R - 200.0, GC.CEIL_Y + 34.0), "×%d 连锁" % sim.combo, HORIZONTAL_ALIGNMENT_RIGHT, 180.0, sz, c)

	if sim.assist_active:
		var c2 := Color(Pal.AMBER.r, Pal.AMBER.g, Pal.AMBER.b, 0.65 + 0.25 * sin(_t * 4.0))
		draw_string(UiStyle.font(), Vector2(GC.WALL_L + 12.0, GC.DEATH_Y - 14.0), sim.assist_reason, HORIZONTAL_ALIGNMENT_LEFT, 320.0, 14, c2)
