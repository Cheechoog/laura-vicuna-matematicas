 @echo off
setlocal

cd /d "%~dp0.."

set IP_LOCAL=

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP_LOCAL=%%a
    goto :found
)

:found
set IP_LOCAL=%IP_LOCAL: =%

echo.
echo ==========================================
echo   ACCESOS DE LA PLATAFORMA
echo ==========================================
echo.
echo Este equipo:
echo http://localhost:3000
start "" "http://localhost:3000"

echo.
if not "%IP_LOCAL%"=="" (
    echo Otros dispositivos en la misma red:
    echo http://%IP_LOCAL%:3000
) else (
    echo No se pudo detectar la IP local automaticamente.
)
echo.

endlocal