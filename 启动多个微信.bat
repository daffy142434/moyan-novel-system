@echo off
title 多开微信
echo ==============================
echo    正在启动多个微信...
echo    每个窗口登录不同账号
echo ==============================

set WEIXIN="C:\Program Files\Tencent\Weixin\Weixin.exe"

echo [1/5] 启动第 1 个微信...
start "" %WEIXIN%
timeout /t 3 /nobreak >nul

echo [2/5] 启动第 2 个微信...
start "" %WEIXIN%
timeout /t 3 /nobreak >nul

echo [3/5] 启动第 3 个微信...
start "" %WEIXIN%
timeout /t 3 /nobreak >nul

echo [4/5] 启动第 4 个微信...
start "" %WEIXIN%
timeout /t 3 /nobreak >nul

echo [5/5] 启动第 5 个微信...
start "" %WEIXIN%

echo.
echo 全部启动完成！每个窗口登录不同账号即可。
echo 如果有的没弹出来，再手动运行一次。
pause
