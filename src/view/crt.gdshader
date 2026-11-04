shader_type canvas_item;
render_mode blend_mul;

uniform float strength = 0.42;
uniform float vignette = 0.42;

void fragment() {
	vec2 uv = SCREEN_UV;
	// 扫描线：以逻辑 720 行为基准，避免不同分辨率下摩尔纹变化过大
	float line = 0.5 + 0.5 * sin(uv.y * 720.0 * 3.14159265);
	float dark = strength * (0.25 + 0.75 * line) * 0.14;
	// 轻微暗角
	float d = length((uv - vec2(0.5)) * vec2(1.05, 1.0));
	float vig = smoothstep(0.34, 0.92, d) * vignette * 0.45;
	float m = 1.0 - clamp(dark + vig, 0.0, 0.72);
	COLOR = vec4(vec3(m), 1.0);
}
