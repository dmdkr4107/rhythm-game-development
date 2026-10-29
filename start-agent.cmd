@echo off
setlocal
cd /d "%~dp0"
if not exist "AGENTS.md" (
  echo ERROR: Put this file in the rhythm-game-development root folder.
  pause
  exit /b 1
)
if not exist ".codex\agents\game_developer.toml" (
  echo ERROR: game_developer agent configuration is missing.
  pause
  exit /b 1
)
if not exist ".codex\agents\game_tester.toml" (
  echo ERROR: game_tester agent configuration is missing.
  pause
  exit /b 1
)
where codex.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: Codex CLI was not found on PATH.
  echo Open a terminal and check: codex --version
  pause
  exit /b 1
)
echo Starting Codex with the rhythm game project...
call codex.cmd -C "%~dp0." "Read AGENTS.md and docs/HARNESS.md first. Respond in Korean. Use game_developer and game_tester agents for implementation and independent verification when requested. Preserve existing game files and uncommitted changes. Perform at most 3 independent validation rounds including the first; stop early on success. Do not commit or push without explicit permission. First explain which agent roles are available and ask for the next game-development task. Do not change files yet."
set "rc=%errorlevel%"
if not "%rc%"=="0" (
  echo Codex exited with error code %rc%.
  pause
)
exit /b %rc%
