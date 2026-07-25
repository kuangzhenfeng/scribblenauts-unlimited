#!/usr/bin/env bash
# 启动开发服务：未安装依赖时自动安装，随后启动 Vite 开发服务
set -e
cd "$(dirname "$0")"

# 依赖缺失则先安装
if [ ! -d node_modules ]; then
  echo "[start.sh] 未检测到 node_modules，开始安装依赖..."
  npm install
fi

echo "[start.sh] 启动开发服务 → http://localhost:5173"
npm run dev
