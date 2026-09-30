@echo off
rem Gera o pacote portatil do SMARsvd em dist\SMARsvd.zip (veja scripts\empacotar.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\empacotar.ps1" %*
if errorlevel 1 (
    echo.
    echo Falha ao gerar o pacote.
)
pause
