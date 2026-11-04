class_name Sweep
extends RefCounted
## 连续碰撞检测：用「膨胀矩形 + 线段 slab 测试」求圆与 AABB 的最早接触时刻。
## 该方案在单步位移远大于砖块厚度时也不会穿透，是弹球可靠性的基础。

const EPS := 1e-6


## 返回 {} 或 {"t": 0..1, "normal": Vector2, "pen": float}
static func circle_rect(p0: Vector2, p1: Vector2, r: float, rect: Rect2) -> Dictionary:
	var minp := Vector2(rect.position.x - r, rect.position.y - r)
	var maxp := Vector2(rect.end.x + r, rect.end.y + r)
	var d := p1 - p0
	var tmin := 0.0
	var tmax := 1.0
	var axis := -1
	var sign_x := 0.0
	var sign_y := 0.0

	if absf(d.x) < EPS:
		if p0.x < minp.x or p0.x > maxp.x:
			return {}
	else:
		var inv := 1.0 / d.x
		var t1 := (minp.x - p0.x) * inv
		var t2 := (maxp.x - p0.x) * inv
		var s := -1.0
		if t1 > t2:
			var tmp := t1
			t1 = t2
			t2 = tmp
			s = 1.0
		if t1 > tmin:
			tmin = t1
			axis = 0
			sign_x = s
		if t2 < tmax:
			tmax = t2
		if tmin > tmax:
			return {}

	if absf(d.y) < EPS:
		if p0.y < minp.y or p0.y > maxp.y:
			return {}
	else:
		var inv := 1.0 / d.y
		var t1 := (minp.y - p0.y) * inv
		var t2 := (maxp.y - p0.y) * inv
		var s := -1.0
		if t1 > t2:
			var tmp := t1
			t1 = t2
			t2 = tmp
			s = 1.0
		if t1 > tmin:
			tmin = t1
			axis = 1
			sign_y = s
		if t2 < tmax:
			tmax = t2
		if tmin > tmax:
			return {}

	if axis == -1:
		# 起点已经在膨胀矩形内部：沿最短方向推出（正常流程不应出现，兜底用）
		return _push_out(p0, minp, maxp)

	if tmin > 1.0:
		return {}
	return {"t": clampf(tmin, 0.0, 1.0), "normal": Vector2(sign_x, sign_y), "pen": 0.0}


static func _push_out(p: Vector2, minp: Vector2, maxp: Vector2) -> Dictionary:
	var dl := p.x - minp.x
	var dr := maxp.x - p.x
	var du := p.y - minp.y
	var dd := maxp.y - p.y
	var m: float = min(min(dl, dr), min(du, dd))
	if m == dl:
		return {"t": 0.0, "normal": Vector2(-1, 0), "pen": dl + 0.01}
	if m == dr:
		return {"t": 0.0, "normal": Vector2(1, 0), "pen": dr + 0.01}
	if m == du:
		return {"t": 0.0, "normal": Vector2(0, -1), "pen": du + 0.01}
	return {"t": 0.0, "normal": Vector2(0, 1), "pen": dd + 0.01}


## 球是否与矩形相交（用于调试与边界判定）
static func circle_overlaps_rect(p: Vector2, r: float, rect: Rect2) -> bool:
	var closest := Vector2(
		clampf(p.x, rect.position.x, rect.end.x),
		clampf(p.y, rect.position.y, rect.end.y)
	)
	return p.distance_squared_to(closest) <= r * r


## 把方向向量限制在「不与水平线过于接近」的锥形内，**保持原速度量级**。
static func clamp_to_min_vertical(dir: Vector2, min_vy_ratio: float = GC.MIN_VERTICAL_RATIO) -> Vector2:
	var mag := dir.length()
	if mag < 1e-9:
		return Vector2.UP * mag
	var d := dir / mag
	if absf(d.y) >= min_vy_ratio:
		return dir
	var sgn := 1.0 if d.y >= 0.0 else -1.0
	var ny := sgn * min_vy_ratio
	var nx_sq := maxf(0.0, 1.0 - ny * ny)
	var nx := sqrt(nx_sq) * (1.0 if d.x >= 0.0 else -1.0)
	# 保持原来的水平分量方向；若水平分量为 0 则取右
	if absf(d.x) < EPS:
		nx = sqrt(nx_sq)
	return Vector2(nx, ny).normalized() * mag
