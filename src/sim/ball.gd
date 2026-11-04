class_name Ball
extends RefCounted
## 弹球状态。拖尾只是位置历史，不参与物理判定。

var pos: Vector2
var vel: Vector2
var radius: float = GC.BALL_R
var active: bool = true
var attached: bool = false

var trail: Array[Vector2] = []
var stall_time: float = 0.0
var since_brick: float = 0.0
var idle_time: float = 0.0
var born_at: float = 0.0
var probe_pos: Vector2 = Vector2.ZERO
var probe_timer: float = 0.0

# 为后续阶段预留：贯穿剩余次数（结束必须恢复普通反弹）
var pierce_left: int = 0
var damage_bonus: int = 0
var crit_next: bool = false   # 精准接球后下一击必暴击


func _init(p: Vector2, v: Vector2 = Vector2.ZERO) -> void:
	pos = p
	vel = v
	probe_pos = p


func speed() -> float:
	return vel.length()


func dir() -> Vector2:
	if vel.length_squared() < 1e-9:
		return Vector2.UP
	return vel.normalized()


func push_trail() -> void:
	trail.push_front(pos)
	if trail.size() > GC.BALL_TRAIL_LEN:
		trail.resize(GC.BALL_TRAIL_LEN)
