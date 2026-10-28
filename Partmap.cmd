@echo off
title Partmap Server
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0Partmap-server.ps1" %*
if errorlevel 1 pause
