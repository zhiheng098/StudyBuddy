"""生成皮卡丘主题背景素材。
- 裁掉底部日文文字
- 背景黄色整体提亮（更舒适）
- 角色做透明化 + 淡化处理，只留淡淡的水印感
输出：
  public/pika-bg.png   角色淡化 + 透明背景（叠在主题色上用）
  public/pika-wall.jpg 浅黄纯色背景 + 淡化角色（整墙背景用）
"""
import os
from PIL import Image, ImageFilter
import numpy as np

SRC = r'C:\Users\gzh\.workbuddy\clipboard-images\clipboard-2026-10-28T08-44-55-717Z-39e61186.jpg'
OUT = r'D:\WorkBuddy工作\2026-10-28-14-21-38\studybuddy\public'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
BG = np.array([255, 211, 62], dtype=np.float32)  # 原图纯黄底

# 1) 裁掉底部文字区域（原图文字位于 y≈700~790）
CROP_BOTTOM = 700
im = im.crop((0, 0, W, CROP_BOTTOM))
W, H = im.size
a = np.array(im).astype(np.float32)

# 2) 角色掩膜：与底色的差异
dist = np.abs(a - BG.reshape(1, 1, 3)).sum(axis=2)
mask = (dist > 14).astype(np.float32)          # 描边/红脸/阴影都能捕捉
mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
mask = np.array(mask_img).astype(np.float32) / 255.0
# 轻微收边，避免主体轮廓过硬
mask = np.clip((mask - 0.06) / 0.94, 0, 1) ** 1.15

# 3) 整体提亮：向白色混合 13%（背景更浅更舒适）
LIFT = 0.13
light = a * (1 - LIFT) + 255.0 * LIFT
bg_light = np.array([255, 211, 62], dtype=np.float32) * (1 - LIFT) + 255.0 * LIFT

# 4) 淡化角色：只保留一小部分对比度，避免被一眼认出
KEEP = 0.20
alpha = (mask * KEEP)[..., None]
out = bg_light.reshape(1, 1, 3) * (1 - alpha) + light * alpha

# 5) 轻微整体柔化，去掉硬边
out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))

# 6) 输出一：透明背景版（角色 + 淡黄半透明底）
rgba = out_img.convert('RGBA')
alpha_ch = Image.fromarray((alpha[..., 0] * 255).astype(np.uint8))
rgba.putalpha(alpha_ch)
rgba.save(os.path.join(OUT, 'pika-bg.png'), optimize=True)

# 7) 输出二：整墙版（纯浅黄底 + 淡化角色）
wall = Image.new('RGB', (W, H), tuple(int(v) for v in bg_light))
wall.paste(out_img, (0, 0))
wall.save(os.path.join(OUT, 'pika-wall.jpg'), quality=88, optimize=True)

print('bg color  ->', [int(v) for v in bg_light])
print('size      ->', (W, H))
print('pika-bg.png   ', os.path.getsize(os.path.join(OUT, 'pika-bg.png')) // 1024, 'KB')
print('pika-wall.jpg ', os.path.getsize(os.path.join(OUT, 'pika-wall.jpg')) // 1024, 'KB')
