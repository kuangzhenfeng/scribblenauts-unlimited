@echo off
REM 启动开发服务：未安装依赖时自动安装，随后启动 Vite 开发服务
cd /d "%~dp0"

REM 依赖缺失则先安装
if not exist "node_modules" (
  echo [start.bat] 未检测到 node_modules，开始安装依赖...
  call npm install
)

echo [start.bat] 启动开发服务 → http://localhost:5173
call npm run dev
