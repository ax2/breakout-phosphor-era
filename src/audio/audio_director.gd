extends Node
## 音频总控：程序生成的原创素材，带并发限流、音高微变与音量分轨。
## 高频碰撞（多球同时撞砖）不会叠成爆音。

const SFX_DIR := "res://assets/audio/"
const SFX_NAMES := [
	"sfx_serve", "sfx_paddle", "sfx_wall", "sfx_brick", "sfx_brick_break",
	"sfx_tough", "sfx_explode", "sfx_life_lost", "sfx_level_clear", "sfx_game_over",
	"sfx_ui_move", "sfx_ui_confirm", "sfx_correct", "sfx_pickup",
]
const MAX_SAME_KEY_PER_WINDOW := 4
const WINDOW_SEC := 0.055

var _streams := {}
var _pool: Array[AudioStreamPlayer] = []
var _pool_size := 20
var _next := 0
var _music: AudioStreamPlayer
var _recent := {}
var _rng := RandomNumberGenerator.new()
var _music_tween: Tween


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_rng.randomize()
	for nm in SFX_NAMES:
		var p := SFX_DIR + str(nm) + ".wav"
		if ResourceLoader.exists(p):
			_streams[nm] = load(p)
	for i in range(_pool_size):
		var pl := AudioStreamPlayer.new()
		pl.bus = "Master"
		add_child(pl)
		_pool.append(pl)
	_music = AudioStreamPlayer.new()
	add_child(_music)
	_music.finished.connect(_on_music_finished)
	_apply_settings()
	if Game.has_signal("settings_changed"):
		Game.settings_changed.connect(_apply_settings)
	call_deferred("_start_music")


func _apply_settings() -> void:
	if _music != null and _music.playing:
		_music.volume_db = linear_to_db(maxf(0.0001, float(Game.settings.music) * 0.55))
	for pl in _pool:
		pl.volume_db = linear_to_db(maxf(0.0001, float(Game.settings.sfx)))


func _start_music() -> void:
	var path := SFX_DIR + "music_loop.wav"
	if not ResourceLoader.exists(path):
		return
	var st = load(path)
	if st is AudioStreamWAV:
		st.loop_mode = AudioStreamWAV.LOOP_FORWARD
		st.loop_begin = 0
		st.loop_end = st.data.size() / 2  # 16-bit mono
	_music.stream = st
	_music.volume_db = linear_to_db(maxf(0.0001, float(Game.settings.music) * 0.55))
	_music.play()


func _on_music_finished() -> void:
	if _music.stream != null:
		_music.play()


## name: 不带扩展名的音效名；pitch_jitter: 半音抖动幅度（0 表示不抖动）
func play(name: String, volume_db: float = 0.0, pitch: float = 1.0, pitch_jitter: float = 0.0) -> void:
	if not _streams.has(name):
		return
	var now := Time.get_ticks_msec() / 1000.0
	var arr: Array = _recent.get(name, [])
	var kept: Array = []
	for t in arr:
		if now - float(t) < WINDOW_SEC:
			kept.append(t)
	if kept.size() >= MAX_SAME_KEY_PER_WINDOW:
		_recent[name] = kept
		return
	kept.append(now)
	_recent[name] = kept

	var pl := _free_player()
	if pl == null:
		return
	pl.stream = _streams[name]
	pl.volume_db = volume_db + linear_to_db(maxf(0.0001, float(Game.settings.sfx)))
	var p := pitch
	if pitch_jitter > 0.0:
		p *= 1.0 + _rng.randf_range(-pitch_jitter, pitch_jitter)
	pl.pitch_scale = clampf(p, 0.5, 2.0)
	pl.play()


func _free_player() -> AudioStreamPlayer:
	for i in range(_pool.size()):
		var idx := (_next + i) % _pool.size()
		if not _pool[idx].playing:
			_next = (idx + 1) % _pool.size()
			return _pool[idx]
	var fallback := _pool[_next]
	_next = (_next + 1) % _pool.size()
	return fallback


func set_music_duck(amount: float) -> void:
	if _music == null:
		return
	var base := linear_to_db(maxf(0.0001, float(Game.settings.music) * 0.55))
	_music.volume_db = base - amount


func stop_all() -> void:
	for pl in _pool:
		pl.stop()
