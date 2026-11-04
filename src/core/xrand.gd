class_name XRand
extends RefCounted
## 确定性伪随机（PCG 风格 LCG + xorshift 输出）。
## 玩法随机与视觉随机使用两个独立实例，互不干扰。

var _state: int


func _init(seed_value: int = 0) -> void:
	_state = seed_value if seed_value != 0 else 0x2545F4914F6CDD1D


func next_u32() -> int:
	_state = (_state * 6364136223846793005 + 1442695040888963407) & 0x7FFFFFFFFFFFFFFF
	var x: int = ((_state >> 18) ^ _state) >> 27
	return x & 0xFFFFFFFF


func next_float() -> float:
	return float(next_u32()) / 4294967296.0


func range_f(a: float, b: float) -> float:
	return a + (b - a) * next_float()


func range_i(a: int, b: int) -> int:
	if b <= a:
		return a
	return a + (next_u32() % (b - a + 1))


func pick(arr: Array):
	if arr.is_empty():
		return null
	return arr[next_u32() % arr.size()]


func state() -> int:
	return _state


func set_state(s: int) -> void:
	_state = s if s != 0 else 0x2545F4914F6CDD1D
