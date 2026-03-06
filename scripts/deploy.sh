#!/bin/bash
# 远程服务器部署脚本
# 在服务器 ~/cargo-capacity-forecast 目录下执行

set -e
cd ~/cargo-capacity-forecast

echo "==> 拉取最新代码..."
git pull origin main || git clone https://github.com/lyt123/cargo-capacity-forecast.git . 2>/dev/null

echo "==> 安装依赖..."
npm install --production=false

echo "==> 构建..."
npm run build

echo "==> 使用 pm2 启动（若未安装: npm i -g pm2）..."
pm2 delete cargo-capacity-forecast 2>/dev/null || true
pm2 start npm --name cargo-capacity-forecast -- start
pm2 save

echo "==> 部署完成，访问 http://服务器IP/cargo"
