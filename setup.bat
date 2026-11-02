@echo off
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║   QuantSight Terminal v2.0  —  Setup      ║
echo  ╚═══════════════════════════════════════════╝
echo.

:: Backend deps
echo [1/2] Installing Python backend dependencies...
pip install fastapi uvicorn yfinance pandas numpy requests 2>nul
if errorlevel 1 (echo    WARNING: Some packages may have failed) else (echo    Backend deps OK)

:: Frontend deps
echo.
echo [2/2] Installing Node.js frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (echo    ERROR: npm install failed) else (echo    Frontend deps OK)

cd /d "%~dp0"
echo.
echo  Setup complete! Run  run_terminal.bat  to start.
echo.
pause
