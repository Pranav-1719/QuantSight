@echo off
title QuantSight Terminal v2
echo.
echo  ██████  ██    ██  █████  ███    ██ ████████
echo  ██    ██ ██    ██ ██   ██ ████   ██    ██
echo  ██    ██ ██    ██ ███████ ██ ██  ██    ██
echo  ██  ████ ██    ██ ██   ██ ██  ██ ██    ██
echo   ██████   ██████  ██   ██ ██   ████    ██
echo.
echo  SIGHT  —  Professional Trading Terminal v2.0
echo  Forex  ·  Indian Stocks  ·  Commodities
echo  ─────────────────────────────────────────────
echo.

:: Start FastAPI backend in new window
echo Starting backend API  (port 8000)...
start "QuantSight Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend
timeout /t 3 /nobreak >nul

:: Start Vite frontend in new window
echo Starting frontend UI  (port 5173)...
start "QuantSight Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Wait then open browser
timeout /t 5 /nobreak >nul
echo Opening terminal in browser...
start http://localhost:5173

echo.
echo  ✓ Backend  →  http://localhost:8000
echo  ✓ Terminal →  http://localhost:5173
echo.
echo  Close this window to stop watching.
echo  Close the Backend and Frontend windows to shut down.
echo.
pause
