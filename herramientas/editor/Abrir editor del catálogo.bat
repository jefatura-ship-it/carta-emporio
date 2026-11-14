@echo off
chcp 65001 >nul
title Editor del Catálogo Sabroso
rem Abre el Editor del Catálogo Sabroso en este PC. El servidor es local (127.0.0.1): nadie más puede verlo.
cd /d "%~dp0..\.."

where python >nul 2>nul
if errorlevel 1 (
  echo Falta Python en este PC. Pide a Claude que lo instale o lo revise.
  pause
  exit /b 1
)

rem Si el servidor local no está encendido, se enciende minimizado (no lo cierres mientras editas)
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('127.0.0.1',8791)).Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 start "Servidor del editor - no cerrar mientras editas" /min python -m http.server 8791 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://localhost:8791/herramientas/editor/"
