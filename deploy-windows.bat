@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  ============================================
echo   USG Studio — Windows plug-and-play deploy
echo  ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker was not found on PATH.
  echo Install Docker Desktop for Windows, then re-run this file.
  echo https://docs.docker.com/desktop/setup/install/windows-install/
  echo.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop is not running.
  echo Start Docker Desktop from the Start menu, wait until it says
  echo "Docker Desktop is running", then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "usg-data" (
  echo Creating persistent data folder: usg-data
  mkdir "usg-data"
)

echo Building and starting USG Studio (first run can take several minutes)...
docker compose -f docker-compose.windows.yml up -d --build
if errorlevel 1 (
  echo.
  echo [ERROR] Docker Compose failed. Scroll up for details.
  pause
  exit /b 1
)

echo.
echo Waiting for the studio to become healthy...
timeout /t 8 /nobreak >nul

echo Opening http://localhost:3000 in your browser...
start "" "http://localhost:3000"

echo.
echo Done. Keep Docker Desktop running while you use the studio.
echo Data is saved in the usg-data folder next to this file.
echo.
pause
endlocal
