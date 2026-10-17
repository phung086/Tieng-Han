@echo off
cd /d "%~dp0"
call pnpm local
if errorlevel 1 pause
