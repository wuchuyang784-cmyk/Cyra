@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Cyra - AI Digital Guide

echo ========================================
echo Cyra AI Digital Guide
echo ========================================
echo.

if not exist ".venv\Scripts\python.exe" goto no_env
".venv\Scripts\python.exe" -c "import sys; assert sys.version_info[:2] == (3, 12)" >nul 2>nul
if errorlevel 1 goto no_env

echo Starting backend and frontend...
echo The tourist and admin pages will open automatically.
echo Keep this window open while using Cyra.
echo.
".venv\Scripts\python.exe" run_cyra_demo.py
if errorlevel 1 goto failed
exit /b 0

:no_env
echo [ERROR] A healthy Python 3.12 project environment was not found.
echo Run install environment first: 安装环境.bat
echo.
pause
exit /b 1

:failed
echo.
echo [ERROR] Cyra failed to start. Check the message above and runtime logs.
pause
exit /b 1
