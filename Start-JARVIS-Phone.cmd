@echo off
title JARVIS Command Core - Phone mode (HTTPS)
cd /d "%~dp0"
echo.
echo   Booting JARVIS in PHONE mode (HTTPS, needed for voice/mic on mobile)...
echo.
echo   1. Make sure your phone is on the SAME Wi-Fi as this PC.
echo   2. On the phone, open the https://192.168.x.x:5199 "Network" address printed below.
echo   3. The phone will warn about the certificate once - tap Advanced then Proceed.
echo      (It is your own PC serving it; nothing leaves your network.)
echo.
echo   Keep this window open while you use the app. Close it to shut down.
echo.
call npm run mobile
pause
