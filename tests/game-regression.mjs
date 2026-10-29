// 실제 게임 함수를 격리해 시간·입력·종료 회귀를 검사합니다.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../assets/js/game.js',import.meta.url),'utf8');
function load(name, context){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0, name);
  const end=source.indexOf('\n}',start)+2;
  vm.runInContext(source.slice(start,end),context);
}
let judgments=[];
let stopped=0;
const context=vm.createContext({
  gameState:null, audioCtx:{currentTime:10,resume(){this.resumed=true;},suspend(){this.suspended=true;}},
  GOOD_WIN:200, PERFECT_WIN:100, MISS_WINDOW:80, TOGGLES:{showJudge:false}, COLORS:[],
  registerJudgement(type){judgments.push(type);}, playHitSound(){},
  document:{getElementById(){return {classList:{add(){},remove(){}}};}},
  performance:{now:()=>1000}, requestAnimationFrame:()=>1,cancelAnimationFrame(){},animFrame:1,
  gameLoop(){}, stopMusic(){stopped++;},
});
for(const name of ['startFailure','getInputWindow','autoMiss','updateGameTime','checkLongHolds','handleRelease','handlePress','togglePause','endGame']) load(name,context);
function state(extra={}){context.gameState={elapsed:0,activeNotes:[],lanePress:[false,false,false,false],score:0,paused:false,ended:false,counting:false,...extra}; judgments=[];}
state({audioStartTime:2}); context.updateGameTime(); assert.equal(context.gameState.elapsed,8000);
state({paused:true,activeNotes:[{isLong:true,hit:true,held:true,lane:0}]});
context.handleRelease(0); assert.equal(judgments.length,0); assert.equal(context.gameState.activeNotes[0].held,true);
state({ended:true}); context.handlePress(0);context.handleRelease(0);context.endGame();assert.equal(stopped,0);
state(); context.togglePause(); assert.equal(context.audioCtx.suspended,true); assert.equal(stopped,0);
context.togglePause();assert.equal(context.audioCtx.resumed,true);assert.equal(context.gameState.paused,false);
function holdScore(times){
 state({activeNotes:[{isLong:true,hit:true,held:true,released:false,lastTick:0,targetTime:0,holdMs:1000}]});
 for(const time of times){context.gameState.elapsed=time;context.checkLongHolds();}
 return context.gameState.score;
}
assert.equal(holdScore([100,200,300,400,500,600,700,800,900,1000]),50);
assert.equal(holdScore([350,710,1080]),50);
state({elapsed:1000,activeNotes:[{isLong:true,hit:true,held:true,released:false,lastTick:0,targetTime:0,holdMs:1000,lane:0}]});
context.handleRelease(0);context.handleRelease(0);assert.deepEqual(judgments,['PERFECT']);assert.equal(context.gameState.score,50);
state({elapsed:1000,activeNotes:[{targetTime:1000,lane:0,hit:false,isLong:false}]});
context.handlePress(0);context.handlePress(0);assert.deepEqual(judgments,['PERFECT']);
console.log('게임 회귀 검사 통과: 오디오 시간, 정지·재개, 종료 보호, 홀드 점수, 중복 판정');

// 디코딩 지연 중 게임을 바꿔도 이전 음악이 재생되지 않아야 합니다.
let decodeCallback;
let played=0;
let readyCount=0;
Object.assign(context,{
 SONGS:[{audioSrc:'data:audio/mp3;base64,AA=='}],decodedCache:{},initAudio(){},
 atob:()=>String.fromCharCode(0),Uint8Array,
 playDecodedBuffer(){played++;},
});
context.audioCtx.decodeAudioData=(buffer,onSuccess)=>{decodeCallback=onSuccess;};
load('scheduleMusic',context);
state();context.scheduleMusic(0,1000,()=>readyCount++);
state();decodeCallback({duration:1});assert.equal(played,0);assert.equal(readyCount,0);
context.scheduleMusic(0,1000,()=>readyCount++);assert.equal(played,1);assert.equal(readyCount,1);
assert.equal(context.gameState.audioStartTime,11);
// 판정 모드의 기존 허용 범위와 단일 입력 동작을 유지합니다.
for(const [offset,expected] of [[-100,'PERFECT'],[100,'PERFECT'],[-101,'GOOD'],[101,'GOOD'],[-300,'GOOD'],[300,'GOOD']]){
 state({elapsed:1000+offset,activeNotes:[{targetTime:1000,lane:0,hit:false}]});
 context.handlePress(0);assert.deepEqual(judgments,[expected]);
}
state({elapsed:1301,activeNotes:[{targetTime:1000,lane:0,hit:false}]});context.handlePress(0);assert.deepEqual(judgments,['MISS']);
console.log('추가 회귀 검사 통과: 이전 디코딩 콜백 차단, 캐시 재생, 기존 판정 경계');

// 프레임과 입력의 순서에 관계없이 경계값을 포함해 같은 판정인지 확인합니다.
for(const mode of [
  {perfect:150,good:250}, {perfect:100,good:200}, {perfect:60,good:130},
]){
  context.PERFECT_WIN=mode.perfect;
  context.GOOD_WIN=mode.good;
  const inputWindow=mode.good*1.5;
  const offsets=new Set([79,80,81]);
  for(const boundary of [mode.perfect,mode.good,inputWindow]){
    for(const delta of [-1,0,1]){
      offsets.add(boundary+delta); offsets.add(-boundary+delta);
    }
  }
  for(const isLong of [false,true]){
    for(const offset of offsets){
      for(const frameFirst of [false,true]){
        const note={targetTime:1000,lane:0,hit:false,isLong,holdMs:1000};
        state({elapsed:1000+offset,activeNotes:[note]});
        if(frameFirst) context.autoMiss();
        context.handlePress(0);context.autoMiss();
        const accepted=Math.abs(offset)<=inputWindow;
        const expected=offset>inputWindow?['MISS']:accepted&&!isLong?
          [Math.abs(offset)<=mode.perfect?'PERFECT':'GOOD']:[];
        const label=JSON.stringify({mode,isLong,offset,frameFirst});
        assert.deepEqual(judgments,expected,label);
        assert.equal(note.hit,accepted,label);
        assert.equal(Boolean(note.held),accepted&&isLong,label);
        // 같은 노트를 다시 누르거나 프레임을 처리해도 중복 판정하지 않습니다.
        context.handlePress(0);context.autoMiss();
        assert.deepEqual(judgments,expected,label);
      }
    }
  }
  // 입력이 없으면 끝 경계까지 대기하고 1ms 뒤 한 번만 MISS 처리합니다.
  state({elapsed:1000+inputWindow,activeNotes:[{targetTime:1000,lane:0,hit:false}]});
  context.autoMiss();assert.deepEqual(judgments,[]);
  context.gameState.elapsed++;
  context.autoMiss();context.autoMiss();assert.deepEqual(judgments,['MISS']);
}
console.log('판정 회귀 검사 통과: 세 모드 일반·롱 시작, ±경계, +79/80/81ms, 처리 순서와 중복 방지');

// 실제 점수 함수를 사용해 동시 레인 입력과 중복 입력의 점수·콤보를 확인합니다.
Object.assign(context,{
 layout:()=>({startX:0,laneW:100,judgeY:500,noteR:10}),
 spawnEffect(){},playMissSound(){},triggerComboEffects(){},
 document:{getElementById(){return null;}},
});
load('registerJudgement',context);
context.PERFECT_WIN=100;context.GOOD_WIN=200;
state({elapsed:1081,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,hp:100,
 activeNotes:[0,1].map(lane=>({targetTime:1000,lane,hit:false}))});
context.handlePress(0);context.handlePress(1);context.handlePress(0);context.autoMiss();
assert.equal(context.gameState.score,200);assert.equal(context.gameState.combo,2);
assert.equal(context.gameState.perfect,2);assert.equal(context.gameState.miss,0);
state({elapsed:1101,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,hp:100,
 activeNotes:[{targetTime:1000,lane:0,hit:false},{targetTime:1000,lane:1,hit:false}]});
context.handlePress(0);assert.equal(context.gameState.score,50);assert.equal(context.gameState.good,1);
context.gameState.elapsed=1301;context.handlePress(1);context.autoMiss();
assert.equal(context.gameState.score,50);assert.equal(context.gameState.combo,0);
assert.equal(context.gameState.miss,1);
// 공통 자동 처리에 따라 입력 직전에도 기존 80ms 경계의 롱 종료를 반영합니다.
state({elapsed:2081,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,hp:100,
 activeNotes:[{targetTime:1000,holdMs:1000,lane:0,isLong:true,hit:true,held:true}]});
context.handlePress(1);assert.equal(context.gameState.perfect,1);
context.autoMiss();assert.equal(context.gameState.perfect,1);assert.equal(context.gameState.score,100);
console.log('점수 회귀 검사 통과: 동시 입력, 중복 방지, 기존 롱노트 종료 규칙');

// 실제 루프와 점수 함수를 함께 실행해 MISS 직후 HP 소진을 검증합니다.
let failureTimers=[],failureElements=0,failureEnds=0,failureFades=0;
Object.assign(context,{
 spawnNotes(){},updateNotes(){},drawFrame(){},updateHUD(){},
 currentAudioSource:null,
 currentAudioGain:{gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){failureFades++;}}},
 setTimeout(callback,delay){failureTimers.push({callback,delay});},
 document:{
   getElementById(id){return id==='gameScreen'?{appendChild(){failureElements++;}}:null;},
   createElement(){return {style:{},remove(){}};},
 },
 endGame(){if(!context.gameState.ended){failureEnds++;context.gameState.ended=true;}},
});
load('gameLoop',context);
function failureOrder(frameFirst,hp,targetTime){
 failureTimers=[];failureElements=0;failureEnds=0;failureFades=0;
 state({elapsed:1400,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,hp,
   noteIdx:0,map:[{},{}],totalMs:10000,song:{durMs:10000},
   activeNotes:[{targetTime:1000,lane:1,hit:false},{targetTime,lane:0,hit:false}]});
 if(frameFirst) context.gameLoop();
 context.handlePress(0);
 if(!frameFirst) context.gameLoop();
 context.handlePress(0);context.gameLoop();
 const result={score:context.gameState.score,hp:context.gameState.hp,
   combo:context.gameState.combo,miss:context.gameState.miss,good:context.gameState.good,
   perfect:context.gameState.perfect,failing:Boolean(context.gameState.failing)};
 if(hp===12){
   assert.equal(failureElements,2);assert.equal(failureFades,1);
   const endings=failureTimers.filter(timer=>timer.delay===2800);
   assert.equal(endings.length,1);endings[0].callback();
   context.gameLoop();context.handlePress(0);assert.equal(failureEnds,1);
 } else {
   assert.equal(failureElements,0);assert.equal(failureTimers.length,0);
 }
 return result;
}
const failedExpected={score:0,hp:0,combo:0,miss:1,good:0,perfect:0,failing:true};
assert.deepEqual(failureOrder(false,12,1400),failedExpected);
assert.deepEqual(failureOrder(true,12,1400),failedExpected);
const aliveExpected={score:50,hp:13,combo:1,miss:1,good:1,perfect:0,failing:false};
assert.deepEqual(failureOrder(false,24,1200),aliveExpected);
assert.deepEqual(failureOrder(true,24,1200),aliveExpected);
console.log('실패 회귀 검사 통과: 실제 루프 HP0 순서 독립, 생존 MISS+GOOD, 실패 연출·종료 1회');

// 승인 정책: 발생 시각순, 동률은 롱 종료 우선, HP0 즉시 실패와 후속 보상 차단.
const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function chronologicalCase({hp,missTime,endTime=2080,now=2200,lastTick=2000,order,frameFirst,release=false,steps=[]}){
 failureTimers=[];failureElements=0;failureEnds=0;failureFades=0;
 const notes=[
   {targetTime:endTime-1080,holdMs:1000,lastTick,lane:2,isLong:true,hit:true,held:true},
   {targetTime:missTime-300,lane:1,hit:false},
   {targetTime:now,lane:0,hit:false},
 ];
 state({elapsed:now,hp,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,
   noteIdx:3,map:[{},{},{}],song:{durMs:20000},totalMs:20000,
   activeNotes:order.map(index=>notes[index])});
 for(const time of steps){context.gameState.elapsed=time;context.gameLoop();}
 context.gameState.elapsed=now;
 if(frameFirst) context.gameLoop();
 if(release) context.handleRelease(3);else context.handlePress(0);
 if(!frameFirst) context.gameLoop();
 const result={hp:context.gameState.hp,score:context.gameState.score,
   combo:context.gameState.combo,perfect:context.gameState.perfect,
   miss:context.gameState.miss,failing:Boolean(context.gameState.failing)};
 if(result.failing){
   const snapshot=JSON.stringify(result);
   context.gameState.elapsed=15000;context.gameLoop();context.handlePress(0);
   context.handleRelease(2);context.checkLongHolds();context.autoMiss();
   assert.equal(JSON.stringify({hp:context.gameState.hp,score:context.gameState.score,
     combo:context.gameState.combo,perfect:context.gameState.perfect,
     miss:context.gameState.miss,failing:Boolean(context.gameState.failing)}),snapshot);
   assert.equal(failureElements,2);assert.equal(failureFades,1);
   const endings=failureTimers.filter(timer=>timer.delay===2800);
   assert.equal(endings.length,1);endings[0].callback();assert.equal(failureEnds,1);
 }
 return result;
}
for(const order of permutations)for(const frameFirst of [false,true]){
 const base={order,frameFirst};
 // 이전 복합 재현: 2000ms 초과 MISS가 2080ms 롱 종료보다 먼저 실패를 확정합니다.
 assert.deepEqual(chronologicalCase({...base,hp:12,missTime:2000,now:2081}),
   {hp:0,score:0,combo:0,perfect:0,miss:1,failing:true});
 for(const delta of [-1,0,1]){
   const expected=delta<0?
     {hp:0,score:0,combo:0,perfect:0,miss:1,failing:true}:
     {hp:4,score:200,combo:1,perfect:2,miss:1,failing:false};
   assert.deepEqual(chronologicalCase({...base,hp:12,missTime:2080+delta}),expected);
 }
 assert.deepEqual(chronologicalCase({...base,hp:100,missTime:2081}),
   {hp:90,score:200,combo:1,perfect:2,miss:1,failing:false});
 assert.deepEqual(chronologicalCase({...base,hp:5,missTime:2081}),
   {hp:0,score:100,combo:0,perfect:1,miss:1,failing:true});
 assert.deepEqual(chronologicalCase({...base,hp:12,missTime:2000,release:true}),
   {hp:0,score:0,combo:0,perfect:0,miss:1,failing:true});
 // 실패 시각 이후 홀드 점수를 선지급하지 않으며, 여러 프레임으로 나눠도 같습니다.
 for(const steps of [[],[1100,1200,1300]]){
   assert.deepEqual(chronologicalCase({...base,hp:12,missTime:1300,lastTick:1000,now:2000,steps}),
     {hp:0,score:15,combo:0,perfect:0,miss:1,failing:true});
 }
}
console.log('시각순 회귀 검사 통과: 배열 순열·호출 순서, 동률±1ms, HP 상하한, 실패후 보상과 홀드 ticks');

// 롱 해제의 기존 PERFECT/GOOD 경계와 자동 종료 +80ms 포함 규칙을 유지합니다.
for(const mode of [{perfect:150,good:250},{perfect:100,good:200},{perfect:60,good:130}]){
 context.PERFECT_WIN=mode.perfect;context.GOOD_WIN=mode.good;
 for(const earlyBy of [mode.perfect-1,mode.perfect,mode.perfect+1,mode.good-1,mode.good,mode.good+1,-79,-80,-81]){
   const now=2000-earlyBy;
   state({elapsed:now,hp:100,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,totalMs:10000,
     activeNotes:[{targetTime:1000,holdMs:1000,lastTick:now,lane:2,isLong:true,hit:true,held:true}]});
   context.handleRelease(2);context.autoMiss();context.handleRelease(2);
   const expected=earlyBy>mode.good?'MISS':earlyBy>mode.perfect?'GOOD':'PERFECT';
   assert.equal(context.gameState.perfect,expected==='PERFECT'?1:0);
   assert.equal(context.gameState.good,expected==='GOOD'?1:0);
   assert.equal(context.gameState.miss,expected==='MISS'?1:0);
   assert.equal(context.gameState.score,expected==='PERFECT'?100:expected==='GOOD'?50:0);
 }
}
console.log('롱 해제 회귀 검사 통과: 세 모드 경계와 종료 80ms 포함, 중복 해제 방지');
context.PERFECT_WIN=100;context.GOOD_WIN=200;
failureTimers=[];failureElements=0;failureEnds=0;failureFades=0;
state({elapsed:1500,hp:12,score:0,combo:0,maxCombo:0,perfect:0,good:0,miss:0,totalMs:10000,
 activeNotes:[{targetTime:1000,holdMs:1000,lastTick:1500,lane:2,isLong:true,hit:true,held:true}]});
context.handleRelease(2);assert.equal(context.gameState.failing,true);
context.registerJudgement('PERFECT',0);context.checkLongHolds();
assert.equal(context.gameState.hp,0);assert.equal(context.gameState.score,0);
assert.equal(context.gameState.perfect,0);assert.equal(context.gameState.miss,1);
assert.equal(failureElements,2);assert.equal(failureTimers.filter(timer=>timer.delay===2800).length,1);
