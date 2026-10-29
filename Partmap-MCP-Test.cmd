@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Partmap-MCP-Test.ps1" %*
pause
