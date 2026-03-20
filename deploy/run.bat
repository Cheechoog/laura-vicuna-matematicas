@echo off
setlocal ENABLEDELAYEDEXPANSION

title Laura Vicuna - Servidor Local

REM Ir a la raiz del proyecto
cd /d "%~dp0.."

echo ==========================================
echo   PLATAFORMA DE MATEMATICAS - LAURA VICUNA
echo ==========================================
echo.

REM Verificar Node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js y vuelve a intentarlo.
  pause
  exit /b 1
)

REM Instalar dependencias si no existen
if exist node_modules (
  echo [1/5] Dependencias OK
) else (
  echo [1/5] Instalando dependencias...
  call npm install
  if errorlevel 1 goto :err
)

REM Importar contenido academico
echo [2/5] Importando contenido...
call node import.js
if errorlevel 1 goto :err

REM Importar estudiantes
echo [3/5] Importando estudiantes...
call node scripts\import_students.js
if errorlevel 1 goto :err

REM Importar estructura de septimo
if exist scripts\import_septimo.js (
  echo [4/5] Importando temas base de septimo...
  call node scripts\import_septimo.js
)

if exist scripts\import_subtemas_septimo.js (
  echo [4/5] Importando subtemas de septimo...
  call node scripts\import_subtemas_septimo.js
)

if exist scripts\import_septimo_periodos_2_y_3.js (
  echo [4/5] Importando periodos 2 y 3 de septimo...
  call node scripts\import_septimo_periodos_2_y_3.js
)

REM Abrir navegador local y en red
echo [5/5] Abriendo navegador...
start "" "%~dp0open.bat"

echo.
echo Iniciando servidor...
echo Mantenga esta ventana abierta mientras use la plataforma.
echo.
call node server.js
goto :eof

:err
echo.
echo [ERROR] Ocurrio un problema durante la preparacion.
pause
exit /b 1