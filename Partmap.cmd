@echo off
title Partmap Server
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Partmap-server.ps1" %*
if errorlevel 1 pause
