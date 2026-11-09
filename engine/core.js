/* v0.6 본편 상태 전이 엔진: 공식 대본은 별도 데이터로 탑재 */
(function(root){
'use strict';
const allowedEffects=new Set(['hpDelta','noiseDelta','moveTo']);
function createState(){return {hp:100,infectionStage:0,noise:0,positionId:null,processedEventIds:{},pendingAction:null};}
function check(state,requirements=[]){
 return requirements.every(r=>{
  if(r.type==='minHp')return state.hp>=r.value;
  if(r.type==='maxInfection')return state.infectionStage<=r.value;
  if(r.type==='position')return state.positionId===r.value;
  return false;
 });
}
function transition(state,event){
 if(!event||typeof event.id!=='string'||!event.id||!Array.isArray(event.effects))throw Error('유효하지 않은 사건');
 if(state.processedEventIds[event.id])return {state,applied:false};
 if(!check(state,event.requires||[]))return {state,applied:false,blocked:true};
 const next=JSON.parse(JSON.stringify(state));
 for(const e of event.effects){
  if(!allowedEffects.has(e.type))throw Error('허용되지 않은 상태 효과');
  if(e.type==='hpDelta'){if(!Number.isInteger(e.value)||Math.abs(e.value)>100)throw Error('HP 범위 오류');next.hp=Math.max(0,Math.min(100,next.hp+e.value));}
  if(e.type==='noiseDelta'){if(!Number.isInteger(e.value)||Math.abs(e.value)>100)throw Error('소음 범위 오류');next.noise=Math.max(0,next.noise+e.value);}
  if(e.type==='moveTo'){if(typeof e.value!=='string'||!e.value||e.value.length>80)throw Error('위치 오류');next.positionId=e.value;}
 }
 next.processedEventIds[event.id]=true;
 return {state:next,applied:true};
}
function requestRisk(state,id,description){if(state.pendingAction)throw Error('이미 확인 대기 중');return {...state,pendingAction:{id,description}};}
function cancelRisk(state){return {...state,pendingAction:null};}
function confirmRisk(state,event){if(!state.pendingAction||state.pendingAction.id!==event.id)throw Error('확인되지 않은 위험 행동');const result=transition(state,event);return {...result,state:{...result.state,pendingAction:null}};}
function selfTest(){
 const s=createState(), e={id:'bite-free-damage',effects:[{type:'hpDelta',value:-20}]};
 const a=transition(s,e),b=transition(a.state,e);
 const pending=requestRisk(s,'risk-1','위험 통로'),cancelled=cancelRisk(pending);
 return {passed:[s.hp===100,a.state.hp===80,b.state.hp===80&&!b.applied,cancelled.hp===100&&!cancelled.pendingAction,check(s,[{type:'minHp',value:90}]),!check(s,[{type:'position',value:'SAFE'}])].filter(Boolean).length,total:6};
}
root.ZombieCore={createState,check,transition,requestRisk,cancelRisk,confirmRisk,selfTest};
})(window);
