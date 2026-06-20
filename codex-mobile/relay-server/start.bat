@echo off
title CodexMobile Relay Server
cd /d "%~dp0"

echo ============================================
echo   CodexMobile Relay - starting...
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Please install Node.js 20+ first: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [first run] Installing dependencies, please wait...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your network and retry.
    pause
    exit /b 1
  )
)

if not exist "dist\index.js" (
  echo [build] Compiling...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting server. Use the address and pairing code shown below on your phone.
echo Close this window to stop the server.
echo.

node dist\index.js

echo.
echo Server stopped.
pause
