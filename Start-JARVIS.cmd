@echo off
title JARVIS Command Core
cd /d "%~dp0"
echo.
echo   Booting JARVIS Command Core (production engine)...
echo   Keep this window open while you use the app. Close it to shut down.
echo.
if not exist dist\index.html (
  echo   First run: building the app once, ~30 seconds...
  call npm run build
)
start "" "http://localhost:5199"
echo   Desktop:  http://localhost:5199
echo   Phone (same Wi-Fi): use the "Network" address printed below.
echo.
call npm run serve
pause
