// Judgment timing fixes. The original large game.js is preserved unchanged.
// This script is loaded immediately after game.js and replaces only these two functions.
function handlePress(lane){
  if(gameState.failing) return;
  const now=gameState.elapsed;
  if(now < 0) return; // 노트가 아직 위에서 내려오는 중
  let best=null,bestDiff=Infinity;
  gameState.activeNotes.forEach(n=>{
    if(n.hit||n.lane!==lane) return;
    const diff=Math.abs(n.targetTime-now);
    if(diff<bestDiff){bestDiff=diff;best=n;}
  });
  // GOOD_WIN 넘어도 activeNotes에 있는 노트면 GOOD으로 처리 (키 눌렀는데 MISS 방지)
  if(!best) return;
  if(bestDiff>GOOD_WIN) return; // GOOD 범위를 벗어나면 판정하지 않음
  const earlyLate=best.targetTime>gameState.elapsed?'EARLY':'LATE';
  best.hit=true;
  if(bestDiff<=PERFECT_WIN){
    if(best.isLong){best.held=true;if(TOGGLES.showJudge)showJudge('HOLD!',COLORS[lane]);playHitSound(lane,'PERFECT');}
    else registerJudgement('PERFECT',lane);
  } else {
    if(best.isLong){best.held=true;if(TOGGLES.showJudge)showJudge('HOLD!',COLORS[lane]);playHitSound(lane,'GOOD');}
    else{ registerJudgement('GOOD',lane); if(TOGGLES.showJudge) setTimeout(()=>showJudge(earlyLate,'#888888'),300); }
  }
}

function autoMiss(){
  gameState.activeNotes=gameState.activeNotes.filter(n=>{
    if(n.hit){
      if(n.isLong){
        if(n.held){
          if(gameState.elapsed>=n.targetTime+n.holdMs+MISS_WINDOW){
            registerJudgement('PERFECT',n.lane,true); n.released=true; return false;
          }
          return true;
        }
        if(!n.released){ if(gameState.elapsed>n.targetTime+n.holdMs+MISS_WINDOW) return false; return true; }
        return false;
      }
      return false;
    }
    if(gameState.elapsed>n.targetTime+GOOD_WIN){ registerJudgement('MISS',n.lane); return false; }
    // 안전망: 이미 음악이 한참 지났으면 조용히 제거
    if(gameState.elapsed>gameState.totalMs+500) return false;
    return true;
  });
}
