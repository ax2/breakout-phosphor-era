class_name LevelDB
extends RefCounted
## 关卡访问层。保留旧的调用接口，实际数据由 ContentDB 提供
## （来源：web/js/content.js → data/content.json，与网页版同一份）。

static func legend() -> Dictionary:
	return ContentDB.legend()


static func levels() -> Array:
	return ContentDB.levels()


static func chapters() -> Array:
	return ContentDB.chapters()


static func level_by_id(id: String) -> Dictionary:
	return ContentDB.level_by_id(id)


static func level_at(idx: int) -> Dictionary:
	return ContentDB.level_at(idx)


static func index_of(id: String) -> int:
	return ContentDB.index_of(id)


static func chapter_of(level: Dictionary) -> Dictionary:
	return ContentDB.chapter_of(level)


static func levels_of_chapter(chapter_id: String) -> Array:
	return ContentDB.levels_of_chapter(chapter_id)
