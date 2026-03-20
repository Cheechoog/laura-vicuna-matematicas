@echo off
title Detener Plataforma Laura Vicuna

echo Cerrando procesos de Node.js...
taskkill /F /IM node.exe >nul 2>nul

echo.
echo Plataforma detenida.
pause