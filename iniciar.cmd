@echo off
rem Instituto Santisima Trinidad: arranca el sistema y abre el navegador. Dejar esta ventana abierta mientras se usa.
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, solo la primera vez...
  call npm install --no-audit --no-fund
)
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5500"
node dev.mjs
pause
