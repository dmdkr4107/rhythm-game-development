// 기존 대용량 game.js와 음악 원본을 수정하지 않는 안전한 버그 수정 레이어.
// 정식 게임 스크립트 뒤에 로드한다.
(function () {
  'use strict';

  // AudioContext의 시계를 멈추면 음악 소스와 게임 시간의 위치가 함께 유지된다.
  // stopMusic()은 다시 시작할 수 없는 AudioBufferSourceNode를 종료하므로
  // 일시정지에서는 사용하지 않는다.
  togglePause = function () {
    if (!gameState || gameState.counting || gameState.ended || gameState.failing) return;
    const overlay = document.getElementById('pauseOverlay');
    if (gameState.paused) {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.error('음악 재개 실패:', err));
      }
      gameState.startTime += performance.now() - gameState.pauseTime;
      gameState.paused = false;
      overlay.classList.remove('visible');
      animFrame = requestAnimationFrame(gameLoop);
    } else {
      gameState.paused = true;
      gameState.pauseTime = performance.now();
      overlay.classList.add('visible');
      cancelAnimationFrame(animFrame);
      if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(err => console.error('음악 일시정지 실패:', err));
      }
    }
  };

  // MISS 판정이 끝난 노트가 다음 프레임 전 입력으로 GOOD이 되는 현상 방지.
  const originalHandlePress = handlePress;
  handlePress = function (lane) {
    if (!gameState || gameState.counting || gameState.paused ||
        gameState.ended || gameState.failing) return;
    const now = gameState.elapsed;
    let closest = Infinity;
    gameState.activeNotes.forEach(note => {
      if (!note.hit && note.lane === lane) {
        closest = Math.min(closest, Math.abs(note.targetTime - now));
      }
    });
    if (closest > MISS_WINDOW) return;
    originalHandlePress(lane);
  };
})();
