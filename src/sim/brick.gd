class_name Brick
extends RefCounted
## 单块砖的数据（纯逻辑，不含任何绘制）。
## 与网页版 web/js/core.js 的 TYPES 表逐项对齐：7 种网格砖 + 3 种 Boss 部件。

const TYPE_DEF := {
	"normal": {"hp": 1, "score": GC.SCORE_BRICK, "solid": false, "label": "普通"},
	"tough": {"hp": 2, "score": GC.SCORE_TOUGH, "solid": false, "label": "双层"},
	"armored": {"hp": 3, "score": GC.SCORE_ARMORED, "solid": false, "label": "装甲"},
	"blast": {"hp": 1, "score": GC.SCORE_BLAST, "solid": false, "label": "爆裂"},
	"solid": {"hp": -1, "score": 0, "solid": true, "label": "障碍"},
	"regen": {"hp": 2, "score": GC.SCORE_TOUGH, "solid": false, "label": "再生"},
	"shieldNode": {"hp": 2, "score": GC.SCORE_ARMORED, "solid": false, "label": "护盾节点"},
	# Boss 部件
	"core": {"hp": 12, "score": 200, "solid": false, "label": "核心"},
	"armorPlate": {"hp": 6, "score": 60, "solid": false, "label": "护甲"},
	"weakPoint": {"hp": 3, "score": 80, "solid": false, "label": "弱点"},
}

var col: int
var row: int
var type: String
var hp: int
var max_hp: int
var rect: Rect2
var alive: bool = true

# ---- 状态效果（由模拟层读写）----------------------------------------
var burn: float = 0.0          # 剩余灼烧时间
var burn_dps: float = 0.0
var burn_acc: float = 0.0      # 灼烧伤害的整数累加器
var frozen: float = 0.0        # 剩余冻结时间
var charge: float = 0.0        # 导电层数
var charge_timer: float = 6.0
var regen: int = 0             # 每次回复的血量
var regen_timer: float = 7.0

# ---- Boss 部件 -------------------------------------------------------
var is_part: bool = false
var part_id: String = ""
var role: String = "armor"     # core / armor
var invuln: bool = false
var home: Vector2 = Vector2.ZERO


func _init(c: int = -1, r: int = -1, t: String = "normal") -> void:
	col = c
	row = r
	type = t
	var def: Dictionary = TYPE_DEF.get(t, TYPE_DEF["normal"])
	max_hp = int(def["hp"])
	hp = max_hp
	alive = true
	rect = Rect2(
		GC.GRID_X + c * GC.BRICK_W,
		GC.GRID_Y + r * GC.BRICK_H,
		GC.BRICK_W,
		GC.BRICK_H
	)
	home = rect.position


## 供 Boss 部件用：直接指定矩形
static func part(id: String, role_name: String, t: String, box: Rect2, part_hp: int) -> Brick:
	var b := Brick.new(-1, -1, t)
	b.is_part = true
	b.part_id = id
	b.role = role_name
	b.rect = box
	b.home = box.position
	b.max_hp = part_hp
	b.hp = part_hp
	return b


func is_solid() -> bool:
	return bool(TYPE_DEF.get(type, TYPE_DEF["normal"])["solid"])


func score_value() -> int:
	return int(TYPE_DEF.get(type, TYPE_DEF["normal"])["score"])


func is_blast() -> bool:
	return type == "blast"


func is_core() -> bool:
	return role == "core"


## 0.0 - 1.0，用于裂纹/装甲层显示
func damage_ratio() -> float:
	if is_solid():
		return 0.0
	return 1.0 - float(maxi(hp, 0)) / float(maxi(max_hp, 1))


func center() -> Vector2:
	return rect.get_center()


## 状态是否处于「可受伤」状态（Boss 无敌窗口 / 障碍砖都不吃伤害）
func vulnerable() -> bool:
	return alive and not is_solid() and not invuln
