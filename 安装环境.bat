@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Cyra - Install Environment

where py >nul 2>nul
if errorlevel 1 goto no_python

py -3.12 -c "import sys; assert sys.maxsize > 2**32" >nul 2>nul
if errorlevel 1 goto no_python

py -3.12 setup_cyra_env.py
if errorlevel 1 goto failed

echo.
pause
exit /b 0

:no_python
echo [ERROR] Python 3.12 64-bit was not found.
echo Download: https://www.python.org/downloads/release/python-31210/
echo During installation, select "Add python.exe to PATH".
echo Then run this file again.
echo.
pause
exit /b 1

:failed
echo.
echo [ERROR] Cyra environment installation failed. See the message above.
pause
exit /b 1
