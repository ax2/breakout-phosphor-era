class_name BrickGrid
extends RefCounted
## 砖块网格：关卡的唯一数据结构 + 宽相位查询 + 可通关性校验。
## 网格坐标与像素坐标的换算集中在这里，渲染层只读。

var cols: int = GC.GRID_COLS
var rows: int = 0
var cells: Array = []            # size cols*rows, Brick 或 null
var destructible_total: int = 0
var destructible_alive: int = 0
var solids_alive: int = 0
var warnings: PackedStringArray = PackedStringArray()


static func from_rows(rows_data: Array, legend: Dictionary) -> BrickGrid:
	var g := BrickGrid.new()
	g.rows = rows_data.size()
	g.cols = GC.GRID_COLS
	g.cells.resize(g.cols * g.rows)
	g.cells.fill(null)
	for r in range(g.rows):
		var line: String = str(rows_data[r])
		for c in range(mini(g.cols, line.length())):
			var ch := line.substr(c, 1)
			if ch == "." or ch == " ":
				continue
			var t: String = str(legend.get(ch, ""))
			if t == "":
				g.warnings.append("未知砖块符号 '%s' @(%d,%d)，已忽略" % [ch, c, r])
				continue
			if not Brick.TYPE_DEF.has(t):
				g.warnings.append("未知砖块类型 '%s' @(%d,%d)，已忽略" % [t, c, r])
				continue
			var b := Brick.new(c, r, t)
			g.cells[r * g.cols + c] = b
			if b.is_solid():
				g.solids_alive += 1
			else:
				g.destructible_total += 1
				g.destructible_alive += 1
	g._validate_reachable()
	return g


func _idx(c: int, r: int) -> int:
	return r * cols + c


func cell_at(c: int, r: int) -> Brick:
	if c < 0 or r < 0 or c >= cols or r >= rows:
		return null
	return cells[_idx(c, r)]


func brick_rect_at(c: int, r: int) -> Rect2:
	return Rect2(
		GC.GRID_X + c * GC.BRICK_W,
		GC.GRID_Y + r * GC.BRICK_H,
		GC.BRICK_W,
		GC.BRICK_H
	)


## 宽相位：只返回线段包围盒可能触及的存活砖块。
func candidates_for_segment(p0: Vector2, p1: Vector2, r: float) -> Array:
	var lo := Vector2(minf(p0.x, p1.x) - r, minf(p0.y, p1.y) - r)
	var hi := Vector2(maxf(p0.x, p1.x) + r, maxf(p0.y, p1.y) + r)
	var c0 := int(floor((lo.x - GC.GRID_X) / GC.BRICK_W))
	var c1 := int(floor((hi.x - GC.GRID_X) / GC.BRICK_W))
	var r0 := int(floor((lo.y - GC.GRID_Y) / GC.BRICK_H))
	var r1 := int(floor((hi.y - GC.GRID_Y) / GC.BRICK_H))
	c0 = maxi(c0, 0)
	r0 = maxi(r0, 0)
	c1 = mini(c1, cols - 1)
	r1 = mini(r1, rows - 1)
	var out: Array = []
	if c1 < c0 or r1 < r0:
		return out
	for rr in range(r0, r1 + 1):
		for cc in range(c0, c1 + 1):
			var b: Brick = cells[_idx(cc, rr)]
			if b != null and b.alive:
				out.append(b)
	return out


## 8 邻域（用于爆裂砖的连锁）
func neighbors_of(b: Brick) -> Array:
	var out: Array = []
	for dr in range(-1, 2):
		for dc in range(-1, 2):
			if dr == 0 and dc == 0:
				continue
			var n := cell_at(b.col + dc, b.row + dr)
			if n != null and n.alive:
				out.append(n)
	return out


func remove(b: Brick) -> void:
	if not b.alive:
		return
	b.alive = false
	cells[_idx(b.col, b.row)] = null
	if b.is_solid():
		solids_alive -= 1
	else:
		destructible_alive -= 1


func alive_bricks() -> Array:
	var out: Array = []
	for b in cells:
		if b != null and b.alive:
			out.append(b)
	return out


func is_cleared() -> bool:
	return destructible_alive <= 0


## 连通性校验：从网格上方/下方的开放区域做 BFS，只把「不可破坏砖块」当墙。
## 可破坏砖块本身视为可打通，因此只有被 solid 完全包死的目标才算不可通关风险。
func _validate_reachable() -> void:
	var vrows := rows + 2                      # 虚拟行 -1 (网格上方) 与 rows (网格下方)
	var passable := []
	passable.resize(vrows * cols)
	for i in range(vrows * cols):
		passable[i] = true
	for r in range(rows):
		for c in range(cols):
			var b: Brick = cells[_idx(c, r)]
			passable[(r + 1) * cols + c] = (b == null or not b.is_solid())
	var visited := []
	visited.resize(vrows * cols)
	visited.fill(false)
	var queue: Array = []
	# 上方与下方两条开放带整行入队（球可以从挡板两侧绕到砖阵顶部，也可以从底部打上去）
	for c in range(cols):
		visited[c] = true
		queue.append(c)
		var bid := (vrows - 1) * cols + c
		visited[bid] = true
		queue.append(bid)
	var qi := 0
	while qi < queue.size():
		var id: int = queue[qi]
		qi += 1
		var rr := id / cols
		var cc := id % cols
		for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var nr: int = rr + d.y
			var nc: int = cc + d.x
			if nr < 0 or nr >= vrows or nc < 0 or nc >= cols:
				continue
			var nid: int = nr * cols + nc
			if visited[nid] or not passable[nid]:
				continue
			visited[nid] = true
			queue.append(nid)
	var trapped: Array = []
	for b in alive_bricks():
		if b.is_solid():
			continue
		var ok := false
		for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var nc: int = b.col + d.x
			var nr: int = b.row + d.y
			if nc < 0 or nc >= cols:
				continue
			var vid: int = (nr + 1) * cols + nc
			if nr < 0:
				vid = 0 * cols + nc
			elif nr >= rows:
				vid = (vrows - 1) * cols + nc
			if visited[vid]:
				ok = true
				break
		if not ok:
			trapped.append(b)
	if not trapped.is_empty():
		warnings.append("%d 块砖被不可破坏结构完全封死（不可通关风险）" % trapped.size())
