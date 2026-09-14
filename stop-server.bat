@echo off
setlocal EnableExtensions
title Todo Meva - Stop Server

set STOPPED=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":8400 " ^| findstr LISTENING') do (
    taskkill /F /PID %%p >nul 2>nul
    if not errorlevel 1 (
        echo Stopped server process %%p
        set STOPPED=1
    )
)

if "%STOPPED%"=="0" echo No Todo Meva server is currently running on port 8400.

if exist "%~dp0.server.log" del /q "%~dp0.server.log" >nul 2>nul

echo Done.
timeout /t 3 >nul