@echo off
title 视频号下载工具
chcp 65001 >nul

echo ====================================
echo     视频号下载工具
echo ====================================
echo.
echo 即将以管理员权限启动...
echo 首次运行会自动安装证书
echo.
echo 使用步骤:
echo  1. 登录微信 PC 客户端
echo  2. 打开视频号播放视频
echo  3. 视频下方会出现 [下载] 按钮
echo.
pause

powershell -Command "Start-Process '%~dp0视频号下载工具.exe' -Verb RunAs"
