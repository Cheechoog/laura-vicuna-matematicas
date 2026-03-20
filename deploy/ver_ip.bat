@echo off
setlocal

set IP_LOCAL=

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP_LOCAL=%%a
    goto :found
)

:found
set IP_LOCAL=%IP_LOCAL: =%

echo ==========================================
echo   DIRECCION DE ACCESO EN RED
echo ==========================================
echo.

if not "%IP_LOCAL%"=="" (
    echo Usa esta direccion en celulares o en otros PCs:
    echo.
    echo     http://%IP_LOCAL%:3000
    echo.
) else (
    echo No se pudo detectar la IP local.
)

pause
endlocal