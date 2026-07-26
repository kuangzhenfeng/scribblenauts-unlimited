#!/usr/bin/env bash
# process-all-sprites.sh — 对 tmp/imagegen/ 下所有源图自动跑 prepare→process→gen-atlas 全流水线。
#
# 用法：./scripts/process-all-sprites.sh [atlasKey...]
#   无参数时遍历 tmp/imagegen/ 下所有 png
#   指定 atlasKey 时只处理指定的（源图路径为 tmp/imagegen/<key>.png）
#
# 依赖：ImageMagick 7（magick）、scripts/sprite-specs.js 中已定义帧规格。
# 注意：prepare-sprite 需要源图路径，本脚本约定 tmp/imagegen/<atlasKey>.png。
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p tmp/imagegen

if [ $# -gt 0 ]; then
  KEYS=("$@")
else
  mapfile -t KEYS < <(for f in tmp/imagegen/*.png; do [ -f "$f" ] || continue; b=$(basename "$f" .png); echo "$b"; done)
fi

if [ ${#KEYS[@]} -eq 0 ]; then
  echo "tmp/imagegen/ 下无源图，也无指定 atlasKey"
  exit 0
fi

success=0
failed=0
for key in "${KEYS[@]}"; do
  src="tmp/imagegen/${key}.png"
  if [ ! -f "$src" ]; then
    echo "  ✗ $key 源图缺失: $src"
    failed=$((failed + 1))
    continue
  fi

  # 检查 sprite-specs 是否有该 key（prepare 等脚本会拒绝未定义的 key）
  has_spec=$(node -e "const {SPRITE_SPECS}=require('./scripts/sprite-specs.js');console.log(key in SPRITE_SPECS?'yes':'no')" 2>/dev/null <<< "$key" 2>/dev/null)
  # 上面 heredoc 方式不可靠，改用 -e 内联
  has_spec=$(node -e "const {SPRITE_SPECS}=require('./scripts/sprite-specs.js');process.stdout.write('${key}' in SPRITE_SPECS?'yes':'no')" 2>/dev/null || echo "err")
  if [ "$has_spec" != "yes" ]; then
    echo "  ⚠ $key 未在 sprite-specs.js 中定义帧规格，跳过（需先在 SPRITE_SPECS 加条目）"
    failed=$((failed + 1))
    continue
  fi

  echo "=== 处理 $key ==="
  if node scripts/prepare-sprite.js "$key" "$src" 2>&1 | tail -1 | grep -q "✓"; then
    if node scripts/process-sprite.js "$key" 2>&1 | tail -1 | grep -q "✓"; then
      if node scripts/gen-atlas.js "$key" 2>&1 | tail -1 | grep -q "✓"; then
        echo "  ✓ $key 完成"
        success=$((success + 1))
        continue
      fi
    fi
  fi
  echo "  ✗ $key 流水线失败"
  failed=$((failed + 1))
done

echo "=== 完成：成功 $success / 失败 $failed ==="
