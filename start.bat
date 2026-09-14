@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Todo Meva - Local Server

where py >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3"
) else (
    where python >nul 2>nul
    if not errorlevel 1 (
        set "PYCMD=python"
    ) else (
        echo [FIX NEEDED] Python is not installed or not in PATH.
        echo Install it from https://www.python.org/downloads/ and run this file again.
        pause
        exit /b 1
    )
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":8400 " ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>nul
timeout /t 1 /nobreak >nul

echo Starting Todo Meva silently on http://localhost:8400 ...
powershell -NoProfile -Command "Start-Process cmd -WindowStyle Hidden -WorkingDirectory '%CD%' -ArgumentList '/c %PYCMD% -m http.server 8400 >> .server.log 2>&1'"

powershell -NoProfile -Command "$u='http://localhost:8400/index.html'; for ($i=0; $i -lt 40; $i++) { try { $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process $u; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; Start-Process $u"

set "SRVPID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":8400 " ^| findstr LISTENING') do set "SRVPID=%%p"

echo.
echo   ================================================
echo    Todo Meva is running:  http://localhost:8400
if not "%SRVPID%"=="" echo    Mode: silent background, PID %SRVPID%
echo    It keeps running after this window is closed.
echo    Stop it with:          stop-server.bat
echo   ================================================
echo.
pause