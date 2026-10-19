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
  GOOD_WIN:200, PERFECT_WIN:100, TOGGLES:{showJudge:false}, COLORS:[],
  registerJudgement(type){judgments.push(type);}, playHitSound(){},
  document:{getElementById(){return {classList:{add(){},remove(){}}};}},
  performance:{now:()=>1000}, requestAnimationFrame:()=>1,cancelAnimationFrame(){},animFrame:1,
  gameLoop(){}, stopMusic(){stopped++;},
});
for(const name of ['updateGameTime','checkLongHolds','handleRelease','handlePress','togglePause','endGame']) load(name,context);
function state(extra={}){context.gameState={elapsed:0,activeNotes:[],lanePress:[false,false,false,false],score:0,paused:false,ended:false,counting:false,...extra}; judgments=[];}
state({audioStartTime:2}); context.updateGameTime(); assert.equal(context.gameState.elapsed,8000);
state({paused:true,activeNotes:[{isLong:true,held:true,lane:0}]});
context.handleRelease(0); assert.equal(judgments.length,0); assert.equal(context.gameState.activeNotes[0].held,true);
state({ended:true}); context.handlePress(0);context.handleRelease(0);context.endGame();assert.equal(stopped,0);
state(); context.togglePause(); assert.equal(context.audioCtx.suspended,true); assert.equal(stopped,0);
context.togglePause();assert.equal(context.audioCtx.resumed,true);assert.equal(context.gameState.paused,false);
function holdScore(times){
 state({activeNotes:[{isLong:true,held:true,released:false,lastTick:0,targetTime:0,holdMs:1000}]});
 for(const time of times){context.gameState.elapsed=time;context.checkLongHolds();}
 return context.gameState.score;
}
assert.equal(holdScore([100,200,300,400,500,600,700,800,900,1000]),50);
assert.equal(holdScore([350,710,1080]),50);
state({elapsed:1000,activeNotes:[{isLong:true,held:true,released:false,lastTick:0,targetTime:0,holdMs:1000,lane:0}]});
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
state({elapsed:1301,activeNotes:[{targetTime:1000,lane:0,hit:false}]});context.handlePress(0);assert.deepEqual(judgments,[]);
console.log('추가 회귀 검사 통과: 이전 디코딩 콜백 차단, 캐시 재생, 기존 판정 경계');

// 현재 규칙의 비대칭을 기록합니다. 바람직한 판정 정책을 보증하는 검사가 아닙니다.
context.MISS_WINDOW=80;
load('autoMiss',context);
for(const mode of [
  {perfect:150,good:250}, {perfect:100,good:200}, {perfect:60,good:130},
]){
  context.PERFECT_WIN=mode.perfect;
  context.GOOD_WIN=mode.good;
  for(const elapsed of [1079,1080]){
    state({elapsed,activeNotes:[{targetTime:1000,lane:0,hit:false}]});
    context.autoMiss(); assert.equal(judgments.length,0);
  }
  state({elapsed:1081,activeNotes:[{targetTime:1000,lane:0,hit:false}]});
  context.autoMiss();context.handlePress(0);assert.deepEqual(judgments,['MISS']);
  state({elapsed:1081,activeNotes:[{targetTime:1000,lane:0,hit:false}]});
  context.handlePress(0);context.autoMiss();
  assert.deepEqual(judgments,[mode.perfect>=81?'PERFECT':'GOOD']);
}
console.log('현재 정책 재현: 세 판정 모드 모두 +81ms에서 처리 순서에 따라 결과가 달라짐');
