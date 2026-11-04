# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SRC = "docs/shots-web/art-play.png"
OUT = os.path.join("C:/Users/ax2/Documents/技术博客/20261029-breakout-phosphor-era/images/cover.png")
W, H = 1080, 459
os.makedirs(os.path.dirname(OUT), exist_ok=True)

im = Image.open(SRC).convert("RGB")
# 裁成 2.35:1，保留上半场砖阵与球
crop_h = int(im.width / (W / H))
if crop_h > im.height:
    crop_h = im.height
top = max(0, int(im.height * 0.16))
im = im.crop((0, top, im.width, min(im.height, top + crop_h))).resize((W, H), Image.LANCZOS)

# 压暗 + 轻微模糊，保证文字可读
dark = Image.new("RGB", (W, H), (3, 8, 6))
im = Image.blend(im, dark, 0.62)
im = im.filter(ImageFilter.GaussianBlur(0.6))
d = ImageDraw.Draw(im, "RGBA")

# 上下渐深，中心留亮
for i in range(H):
    t = abs(i - H / 2) / (H / 2)
    d.line([(0, i), (W, i)], fill=(2, 6, 5, int(150 * t ** 1.5)))

# 中央正方形安全区辅助框（不可见，仅用于自检）
SAFE = min(W, H)

FONT_B = "C:/Windows/Fonts/msyhbd.ttc"
FONT_R = "C:/Windows/Fonts/msyh.ttc"
def f(path, size):
    return ImageFont.truetype(path, size)

eyebrow = f(FONT_R, 17)
sub = f(FONT_R, 20)
main_cn = f(FONT_B, 56)
main_en = f(FONT_B, 44)

def center(text, font, y, fill, shadow=True):
    bbox = d.textbbox((0, 0), text, font=font)
    wpx = bbox[2] - bbox[0]
    x = (W - wpx) // 2
    if shadow:
        d.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 190))
    d.text((x, y), text, font=font, fill=fill)
    return wpx

# 角标
d.text((28, 22), "字与码 · 独立游戏", font=f(FONT_R, 15), fill=(124, 255, 178, 170))

y0 = 74
center("BREAKOUT", main_en, y0, (168, 255, 205, 255))
center("磷 光 纪 元", main_cn, y0 + 56, (236, 255, 244, 255))
center("48 关 · 6 个砖块 Boss · 远征构筑", sub, y0 + 146, (168, 205, 188, 235))

# 分隔线
ly = y0 + 134
d.line([(W // 2 - 150, ly), (W // 2 + 150, ly)], fill=(124, 255, 178, 90), width=1)
d.line([(W // 2 - 6, ly), (W // 2 + 6, ly)], fill=(124, 255, 178, 230), width=2)

# 底部说明
_t = "单机 · 中文 · 离线可玩"
_f = f(FONT_R, 14)
_w = d.textbbox((0, 0), _t, font=_f)[2]
d.text((W - 28 - _w, H - 34), _t, font=_f, fill=(140, 170, 158, 190))

im.save(OUT, "PNG")
print("saved", OUT, im.size)

# 自检：主标题宽度必须落在 1:1 安全区内
for label, text, font in [("EN", "BREAKOUT", main_en), ("CN", "磷 光 纪 元", main_cn), ("SUB", "48 关 · 6 个砖块 Boss · 远征构筑", sub)]:
    bbox = d.textbbox((0, 0), text, font=font)
    wpx = bbox[2] - bbox[0]
    print(label, wpx, "limit", SAFE - 60)
    assert wpx <= SAFE - 60, label + " 超出安全区"
