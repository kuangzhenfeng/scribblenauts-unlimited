#!/usr/bin/env bash
# gen-sprites-grid.sh — 批量生成小物件 sprite 源图（一张图含多个小物件）。
#
# 对单帧、尺寸 ≤48px 的静态道具，GPT 一次生成一张含 N 个物件的网格图，
# 再用 scripts/split-grid.js 切割成独立源图，最后走 prepare→process→gen-atlas 三步。
# 运行时加载逻辑零改动（每对象仍独立 png+json）。
#
# 用法：
#   ./scripts/gen-sprites-grid.sh           # 生成默认网格（见下方 GRID_SPECS）
#   GRID_COLS=4 GRID_ROWS=4 ./scripts/gen-sprites-grid.sh  # 自定义网格
#
# 依赖：codex CLI（imagegen 技能）、ImageMagick 7（magick）。
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp/imagegen tmp/grids

# ---- 网格规格：一批小物件用一张网格图 ----
# 格式 "atlasKey:帧W:帧H:描述"（按 GRID_COLS × GRID_ROWS 排列）
# 当批物件帧尺寸应尽量接近，便于统一网格
GRID_COLS="${GRID_COLS:-4}"
GRID_ROWS="${GRID_ROWS:-4}"
CELL_W="${CELL_W:-40}"
CELL_H="${CELL_H:-40}"

# 示例批次：一组 40×40 左右的小物件（16 个一张网格图）
# 实际使用时按需替换为真实批次
GRID_SPECS=(
  "grape:40:40:紫色成串的小浆果"
  "cherry:40:40:红色带梗的小核果"
  "strawberry:40:40:红色籽面三角浆果"
  "blueberry:40:40:蓝色圆球小浆果"
  "lemon:40:40:黄色椭圆柑果"
  "lime:40:40:绿色小圆柑果"
  "plum:40:40:紫色圆核果"
  "coconut:40:40:棕色硬壳毛绒核果"
  "pear:40:40:黄绿葫芦形果"
  "peach:40:40:粉绒甜核果"
  "apricot:40:40:橙黄小圆核果"
  "fig:40:40:紫红倒卵形果"
  "kiwi-fruit:40:40:绿瓤黑籽椭圆浆果"
  "pomegranate:40:40:红色满籽圆果"
  "mango:40:40:金黄椭圆甜核果"
  "tomato:40:40:红色圆扁浆果"
)

# 生成 prefix 映射 JSON（格子序号 → atlasKey）
PREFIX_FILE="tmp/grids/prefix-$(date +%s).json"
echo "{" > "$PREFIX_FILE"
for i in "${!GRID_SPECS[@]}"; do
  IFS=':' read -r id _ _ _ <<< "${GRID_SPECS[$i]}"
  comma=","
  [[ $i -eq $(( ${#GRID_SPECS[@]} - 1 )) ]] && comma=""
  echo "  \"$i\": \"$id\"$comma" >> "$PREFIX_FILE"
done
echo "}" >> "$PREFIX_FILE"

# 拼接网格提示词
OBJECTS_DESC=""
for spec in "${GRID_SPECS[@]}"; do
  IFS=':' read -r id w h desc <<< "$spec"
  OBJECTS_DESC="${OBJECTS_DESC}- ${id}: ${desc}\n"
done

GRID_TOTAL=$(( GRID_COLS * GRID_ROWS ))
if [ ${#GRID_SPECS[@]} -gt $GRID_TOTAL ]; then
  echo "错误：GRID_SPECS (${#GRID_SPECS[@]}) 多于网格容量 ($GRID_TOTAL)"
  exit 1
fi

# 检查是否所有目标都已存在（跳过）
ALL_EXIST=true
for spec in "${GRID_SPECS[@]}"; do
  IFS=':' read -r id _ _ _ <<< "$spec"
  [ -f "tmp/imagegen/${id}.png" ] || ALL_EXIST=false
done
if $ALL_EXIST; then
  echo "所有目标源图已存在，跳过生图"
  exit 0
fi

# 生成网格图
GRID_W=$(( GRID_COLS * CELL_W ))
GRID_H=$(( GRID_ROWS * CELL_H ))
echo "=== 生成网格图 ${GRID_COLS}x${GRID_ROWS} (单格 ${CELL_W}x${CELL_H}px, 共 ${GRID_W}x${GRID_H}) ==="

codex exec --sandbox workspace-write --skip-git-repo-check -C "$(pwd)" \
  "使用 imagegen 技能的 built-in image_gen 工具（默认路径，不要用 CLI fallback）生成一张图片。提示词：

《涂鸦冒险家无限》2D卡通游戏精灵图集，3像素粗黑色轮廓，平涂阴影，鲜艳高饱和度颜色，白色背景，无投影，严格 ${GRID_COLS}x${GRID_ROWS} 网格布局，每格精确 ${CELL_W}x${CELL_H}px，格之间有清晰白色间隔线，共 ${GRID_TOTAL} 格，每格一个独立物品，居中绘制。

按从左到右、从上到下顺序，物品依次为：
$(echo -e "$OBJECTS_DESC")

生成后把最终图片复制到 $(pwd)/tmp/grids/grid-$(date +%s).png（用 cp 而非 mv，因跨文件系统），然后用 sips -z ${GRID_H} ${GRID_W} 校正尺寸。完成后回复最终保存路径。" \
  2>&1 | tail -5

# 找最新生成的网格图
LATEST_GRID=$(ls -t tmp/grids/grid-*.png 2>/dev/null | head -1)
if [ -z "$LATEST_GRID" ]; then
  echo "✗ 网格图生成失败"
  exit 1
fi
echo "✓ 网格图: $LATEST_GRID"

# 切割
echo "=== 切割网格 ==="
node scripts/split-grid.js "$LATEST_GRID" "$GRID_COLS" "$GRID_ROWS" "$CELL_W" "$CELL_H" "tmp/imagegen" "$PREFIX_FILE"

# 对每个 atlasKey 跑三步流水线
echo "=== 处理每个 atlasKey ==="
for spec in "${GRID_SPECS[@]}"; do
  IFS=':' read -r id w h _ <<< "$spec"
  src="tmp/imagegen/${id}.png"
  [ -f "$src" ] || { echo "  跳过 $id (源图缺失)"; continue; }

  # 补 sprite-specs 条目（若缺）
  node scripts/prepare-sprite.js "$id" "$src" 2>&1 | tail -1
  node scripts/process-sprite.js "$id" 2>&1 | tail -1
  node scripts/gen-atlas.js "$id" 2>&1 | tail -1
  echo "  ✓ $id 完成"
done

echo "=== 批量网格生图完成 ==="
