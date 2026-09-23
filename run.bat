@echo off
title QuizBoard - Classroom Quiz Player
cd /d "%~dp0"

echo ============================================
echo   QuizBoard - Classroom Quiz Player
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo Node.js version: %NODE_VER%
echo.

:: Install dependencies if node_modules not found
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully.
    echo.
)

:: A build in dist\ is served when it exists: no hot reload, no dev overlay, and it is the
:: same code that gets copied to a classroom PC.
if exist "dist\index.html" (
    echo Mode: build hasil npm run build
    echo.
    echo ============================================
    echo   Server running!
    echo.
    echo   Buka di browser:  http://localhost:4173
    echo.
    echo   Perlu akses dari ponsel di jaringan yang sama?
    echo   Tutup jendela ini, lalu jalankan:  npm run preview -- --host
    echo.
    echo   Press Ctrl+C to stop
    echo ============================================
    echo.
    call npm run preview
    pause
    exit /b 0
)

echo Mode: dev server, karena folder dist belum ada
echo.
echo ============================================
echo   Server running!
echo.
echo   Buka di browser:  http://localhost:5173
echo.
echo   Ingin versi build yang dipakai di kelas?  Jalankan:  npm run build
echo.
echo   Press Ctrl+C to stop
echo ============================================
echo.
call npm run dev

pause
