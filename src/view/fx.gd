class_name Fx
extends RefCounted
## 视觉特效池：粒子 / 冲击环 / 漂浮文字。全部预先分配、循环复用，
## 不产生逐帧对象分配；数量受 GC.FX_MAX_PARTICLES 等预算硬约束。
## 视觉随机使用独立 RNG，绝不影响玩法随机。

var density: float = 1.0
var max_particles: int = GC.FX_MAX_PARTICLES
var max_rings: int = GC.FX_MAX_RINGS
var max_texts: int = 24

var _pos: PackedVector2Array
var _vel: PackedVector2Array
var _life: PackedFloat32Array
var _ttl: PackedFloat32Array
var _size: PackedFloat32Array
var _col: Array[Color] = []
var _kind: PackedByteArray
var _count := 0
var _cursor := 0

var _rpos: Array[Vector2] = []
var _rr: Array[float] = []
var _rr_max: Array[float] = []
var _rlife: Array[float] = []
var _rttl: Array[float] = []
var _rcol: Array[Color] = []
var _rw: Array[float] = []

var _tpos: Array[Vector2] = []
var _ttext: Array[String] = []
var _tlife: Array[float] = []
var _tcol: Array[Color] = []
var _tsize: Array[int] = []

var _rng := RandomNumberGenerator.new()


func _init() -> void:
	_pos.resize(max_particles)
	_vel.resize(max_particles)
	_life.resize(max_particles)
	_ttl.resize(max_particles)
	_size.resize(max_particles)
	_kind.resize(max_particles)
	_col.resize(max_particles)
	_col.fill(Color.WHITE)
	_rng.seed = 0x5EED


func clear() -> void:
	_count = 0
	_cursor = 0
	_rpos.clear()
	_rr.clear()
	_rr_max.clear()
	_rlife.clear()
	_rttl.clear()
	_rcol.clear()
	_rw.clear()
	_tpos.clear()
	_ttext.clear()
	_tlife.clear()
	_tcol.clear()
	_tsize.clear()


func _push(p: Vector2, v: Vector2, ttl: float, size: float, c: Color, kind: int) -> void:
	var i: int
	if _count < max_particles:
		i = _count
		_count += 1
	else:
		i = _cursor
		_cursor = (_cursor + 1) % max_particles
	_pos[i] = p
	_vel[i] = v
	_life[i] = ttl
	_ttl[i] = ttl
	_size[i] = size
	_col[i] = c
	_kind[i] = kind


## 命中火花：以法线为轴散开
func burst(p: Vector2, normal: Vector2, color: Color, amount: int = 10, power: float = 220.0, size: float = 2.2) -> void:
	var n := int(round(float(amount) * density))
	if n <= 0:
		return
	for k in range(n):
		var ang := _rng.randf_range(-1.05, 1.05)
		var d := normal.rotated(ang)
		var sp := power * _rng.randf_range(0.35, 1.15)
		var v := d * sp + Vector2(_rng.randf_range(-40, 40), _rng.randf_range(-40, 40))
		_push(p, v, _rng.randf_range(0.22, 0.55), size * _rng.randf_range(0.6, 1.5), color, 0)


## 砖块碎裂：方块碎片带重力
func debris(p: Vector2, rect: Rect2, color: Color, amount: int = 8) -> void:
	var n := int(round(float(amount) * density))
	for k in range(n):
		var sp := Vector2(_rng.randf_range(-190, 190), _rng.randf_range(-230, -40))
		var sz := _rng.randf_range(2.0, 5.0)
		var start := Vector2(
			_rng.randf_range(rect.position.x, rect.end.x),
			_rng.randf_range(rect.position.y, rect.end.y)
		)
		_push(start, sp, _rng.randf_range(0.45, 0.9), sz, color, 1)


func ring(p: Vector2, color: Color, r0: float, r1: float, dur: float = 0.4, width: float = 2.0) -> void:
	if _rpos.size() >= max_rings:
		_rpos.pop_front()
		_rr.pop_front()
		_rr_max.pop_front()
		_rlife.pop_front()
		_rttl.pop_front()
		_rcol.pop_front()
		_rw.pop_front()
	_rpos.append(p)
	_rr.append(r0)
	_rr_max.append(r1)
	_rlife.append(dur)
	_rttl.append(dur)
	_rcol.append(color)
	_rw.append(width)


func text(p: Vector2, txt: String, color: Color = Pal.TEXT, dur: float = 0.8, size: int = 16) -> void:
	if _tpos.size() >= max_texts:
		_tpos.pop_front()
		_ttext.pop_front()
		_tlife.pop_front()
		_tcol.pop_front()
		_tsize.pop_front()
	_tpos.append(p)
	_ttext.append(txt)
	_tlife.append(dur)
	_tcol.append(color)
	_tsize.append(size)


func update(dt: float) -> void:
	var i := 0
	while i < _count:
		_life[i] -= dt
		if _life[i] <= 0.0:
			_count -= 1
			if i != _count:
				_pos[i] = _pos[_count]
				_vel[i] = _vel[_count]
				_life[i] = _life[_count]
				_ttl[i] = _ttl[_count]
				_size[i] = _size[_count]
				_col[i] = _col[_count]
				_kind[i] = _kind[_count]
			continue
		var v := _vel[i]
		if _kind[i] == 1:
			v.y += 900.0 * dt
			v *= 0.985
		else:
			v *= 0.93
		_vel[i] = v
		_pos[i] = _pos[i] + v * dt
		i += 1

	var k := 0
	while k < _rpos.size():
		_rlife[k] -= dt
		if _rlife[k] <= 0.0:
			_rpos.remove_at(k)
			_rr.remove_at(k)
			_rr_max.remove_at(k)
			_rlife.remove_at(k)
			_rttl.remove_at(k)
			_rcol.remove_at(k)
			_rw.remove_at(k)
			continue
		k += 1

	var j := 0
	while j < _tpos.size():
		_tlife[j] -= dt
		if _tlife[j] <= 0.0:
			_tpos.remove_at(j)
			_ttext.remove_at(j)
			_tlife.remove_at(j)
			_tcol.remove_at(j)
			_tsize.remove_at(j)
			continue
		_tpos[j] = _tpos[j] + Vector2(0, -46.0 * dt)
		j += 1


func draw_all(ci: CanvasItem) -> void:
	for i in range(_count):
		var a: float = clampf(_life[i] / maxf(0.0001, _ttl[i]), 0.0, 1.0)
		var c: Color = _col[i]
		c.a *= a
		if _kind[i] == 1:
			var s := _size[i]
			ci.draw_rect(Rect2(_pos[i] - Vector2(s, s) * 0.5, Vector2(s, s)), c, true)
		else:
			var d := _vel[i]
			if d.length_squared() > 1.0:
				d = d.normalized() * (_size[i] + 3.0)
			ci.draw_line(_pos[i], _pos[i] - d, c, maxf(1.0, _size[i] * 0.7))
			ci.draw_circle(_pos[i], maxf(0.8, _size[i] * 0.35), c)

	var f := UiStyle.font()
	for k in range(_rpos.size()):
		var a2: float = clampf(_rlife[k] / maxf(0.0001, _rttl[k]), 0.0, 1.0)
		var t: float = 1.0 - a2
		var r: float = lerpf(_rr[k], _rr_max[k], t)
		var c2: Color = _rcol[k]
		c2.a *= a2 * 0.9
		ci.draw_arc(_rpos[k], r, 0.0, TAU, 40, c2, _rw[k], true)

	for m in range(_tpos.size()):
		var a3: float = clampf(_tlife[m] / 0.8, 0.0, 1.0)
		var c3: Color = _tcol[m]
		c3.a *= a3
		ci.draw_string(f, _tpos[m], _ttext[m], HORIZONTAL_ALIGNMENT_CENTER, -1, _tsize[m], c3)
