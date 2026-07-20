@echo off
title 微信多开助手(强力版)
chcp 65001 >nul
setlocal enabledelayedexpansion

set WEIXIN="C:\Program Files\Tencent\Weixin\Weixin.exe"
set COUNT=5

echo ====================================
echo  微信多开助手 - 强力模式
echo  启动 %COUNT% 个微信实例
echo  策略：分层目录启动法
echo ====================================
echo.

for /l %%i in (1,1,%COUNT%) do (
    echo [%%i/%COUNT%] 启动第 %%i 个微信...
    if %%i equ 1 (
        start "" %WEIXIN%
    ) else (
        set "TMPDIR=%TEMP%\WeChat_%%i"
        if not exist "!TMPDIR!" mkdir "!TMPDIR!"
        pushd "!TMPDIR!"
        start "" %WEIXIN%
        popd
    )
    timeout /t 4 /nobreak >nul
)

echo.
echo ✅ 全部启动完成！
echo 每个窗口登录不同账号即可。
echo 如果还有没弹出来的，再手动双击运行一次。
echo.
pause
