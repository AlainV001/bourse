@echo off
title Bourse - Démarrage
echo.
echo  ================================================
echo   Démarrage de l'application Bourse
echo  ================================================
echo.
echo  Backend  : http://localhost:3000
echo  Frontend : http://localhost:5173
echo.

start "Bourse - Backend (port 3000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Bourse - Frontend (port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo  Les deux serveurs sont en cours de démarrage...
echo  Vous pouvez fermer cette fenêtre.
echo.
pause
