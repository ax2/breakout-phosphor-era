class_name GC
extends RefCounted
## 全局数值常量（唯一事实来源）。所有长度单位为逻辑像素，逻辑画布 1280x720。

# ---- 逻辑画布与可玩区域 -------------------------------------------------
const CANVAS := Vector2(1280.0, 720.0)
const WALL_L := 64.0
const WALL_R := 1216.0
const CEIL_Y := 56.0
const ARENA_W := WALL_R - WALL_L           # 1152
const DEATH_Y := 706.0                     # 球心超过此值判定掉落

# ---- 挡板 ---------------------------------------------------------------
const PADDLE_TOP := 648.0
const PADDLE_H := 14.0
const PADDLE_W := 132.0
const PADDLE_Y_CENTER := PADDLE_TOP + PADDLE_H * 0.5
const PADDLE_MIN_X := WALL_L + PADDLE_W * 0.5
const PADDLE_MAX_X := WALL_R - PADDLE_W * 0.5

# ---- 球 -----------------------------------------------------------------
const BALL_R := 7.0
const BALL_BASE_SPEED := 520.0
const BALL_MAX_SPEED := 940.0
const SPEED_PER_BRICK := 2.6
const MIN_VERTICAL_RATIO := 0.16           # 防止近水平（cos 限幅）
const MAX_CONTACTS_PER_STEP := 8

# ---- 反射 ---------------------------------------------------------------
const PADDLE_ANGLE_DEG := 62.0             # 挡板边缘的最大反射角
const PADDLE_MAX_ANGLE_DEG := 74.0         # 叠加挡板速度后的硬上限
const PADDLE_INFLUENCE := 0.14             # 挡板横向速度对出球方向的影响
const PADDLE_VEL_SAMPLE := 0.10            # 挡板速度采样窗口（秒）

# ---- 输入 ---------------------------------------------------------------
const KEY_PADDLE_SPEED := 1080.0
const MOUSE_PADDLE_SPEED := 6200.0
const MOSUE_SWITCH_THRESHOLD := 6.0        # 鼠标移动超过该值才夺回控制权

# ---- 砖块网格 -----------------------------------------------------------
const GRID_COLS := 12
const GRID_ROWS := 9
const GRID_X := 64.0
const GRID_Y := 112.0
const BRICK_W := 96.0
const BRICK_H := 28.0

# ---- 时序 ---------------------------------------------------------------
const FIXED_DT := 1.0 / 120.0
const MAX_FRAME_STEPS := 8
const SERVE_DELAY := 0.65                  # 失球后到重新发球的间隔
const COMBO_WINDOW := 2.4

# ---- 防卡死 / 收尾 -----------------------------------------------------
const STALL_VERTICAL_EPS := 0.10           # |dir.y| 低于此值视为近水平
const STALL_TIME := 1.1                    # 近水平持续多久后修正
const NO_BRICK_ASSIST_TIME := 5.0          # 多久没碰到砖开始轻度引导
const ECHO_BRICK_COUNT := 3                # 剩余砖数 <= 该值启用残响引导
const ECHO_STEER_RATE := 0.55              # 残响引导最大角速度(rad/s)
const ECHO_FORCE_STEER_RATE := 1.5
const IDLE_RESCUE_TIME := 7.0              # 完全无碰撞多久后救援

# ---- 计分 ---------------------------------------------------------------
const SCORE_BRICK := 10
const SCORE_TOUGH := 25
const SCORE_ARMORED := 40
const SCORE_BLAST := 30
const SCORE_HIT := 2
const COMBO_BONUS := 0.25

# ---- 视觉预算 -----------------------------------------------------------
const FX_MAX_PARTICLES := 900
const FX_MAX_RINGS := 48
const BALL_TRAIL_LEN := 16
const MAX_BALLS := 12
