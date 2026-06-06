@echo off
setlocal
set ROOT=%~dp0
cd /d "%ROOT%desktop"

if not exist "%ROOT%desktop\node_modules\electron\dist\electron.exe" (
  echo Installing desktop runtime...
  call npm.cmd install
  if errorlevel 1 (
    echo Failed to install desktop runtime. Please check Node.js and network.
    pause
    exit /b 1
  )
)

call npm.cmd start
endlocal
