class_name Pal
extends RefCounted
## 调色板。深色底 + 磷光绿为主色，按砖块类型区分色相；
## 但类型识别同时依赖轮廓/纹样（见 PlayView._draw_brick），不单靠颜色。

const BG := Color("05080a")
const BG_2 := Color("08120f")
const GRID_LINE := Color("0d2a22")
const PHOSPHOR := Color("7cffb2")
const PHOSPHOR_DIM := Color("3f8f66")
const CYAN := Color("7fd8ff")
const AMBER := Color("ffc46b")
const ROSE := Color("ff6b7e")
const VIOLET := Color("b39cff")
const STEEL := Color("9fb3bd")
const INK := Color("0a0f12")
const TEXT := Color("d8fff0")
const TEXT_DIM := Color("6f8f84")

const TYPE_COLOR := {
	"normal": Color("6be39a"),
	"tough": Color("7fc8ff"),
	"armored": Color("ffc46b"),
	"blast": Color("ff6b7e"),
	"solid": Color("7d8b93"),
	"regen": Color("8ee6c8"),
	"shieldNode": Color("b39cff"),
	"core": Color("ff9d5c"),
	"armorPlate": Color("c9a227"),
	"weakPoint": Color("ff5f8a"),
}

static func type_color(t: String) -> Color:
	return TYPE_COLOR.get(t, PHOSPHOR)
