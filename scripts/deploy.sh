#!/bin/bash
# 远程服务器部署脚本
# 在服务器 ~/cargo-capacity-forecast 目录下执行
# 用法: ssh admin@112.124.68.82 "cd ~/cargo-capacity-forecast && ./scripts/deploy.sh"

set -e
cd ~/cargo-capacity-forecast

echo "==> 拉取最新代码..."
git pull origin main || git clone https://github.com/lyt123/cargo-capacity-forecast.git .

echo "==> 安装依赖..."
npm install

echo "==> 构建（在服务器执行）..."
npm run build

echo "==> 使用 pm2 启动（PORT=3001 与 nginx 一致）..."
pm2 delete cargo-capacity-forecast 2>/dev/null || true
PORT=3001 pm2 start npm --name cargo-capacity-forecast -- start
pm2 save

echo "==> 部署完成，访问 http://112.124.68.82/cargo"
