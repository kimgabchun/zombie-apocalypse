/* v0.6 본편 상태 전이 엔진: 공식 대본은 별도 데이터로 탑재 */
(function(root){
'use strict';
const allowedEffects=new Set(['hpDelta','noiseDelta','moveTo']);
function createState(){return {hp:100,infectionStage:0,noise:0,positionId:null,processedEventIds:{},pendingAction:null};}
function restoreState(saved){
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return null;
 if(!Number.isInteger(saved.hp)||saved.hp<0||saved.hp>100||!Number.isInteger(saved.infectionStage)||saved.infectionStage<0||saved.infectionStage>4||!Number.isSafeInteger(saved.noise)||saved.noise<0||!(saved.positionId===null||(typeof saved.positionId==='string'&&saved.positionId.length<=80)))return null;
 if(!saved.processedEventIds||typeof saved.processedEventIds!=='object'||Array.isArray(saved.processedEventIds))return null;
 const ids=Object.create(null);
 const keys=Object.keys(saved.processedEventIds);
 if(keys.length>10000||keys.some(k=>k.length>160||saved.processedEventIds[k]!==true))return null;
 for(const k of keys)Object.defineProperty(ids,k,{value:true,enumerable:true,writable:true,configurable:true});
 return {...createState(),hp:saved.hp,infectionStage:saved.infectionStage,noise:saved.noise,positionId:saved.positionId,processedEventIds:ids,pendingAction:null};
}
function check(state,requirements=[]){
 return requirements.every(r=>{
  if(r.type==='minHp')return state.hp>=r.value;
  if(r.type==='maxInfection')return state.infectionStage<=r.value;
  if(r.type==='position')return state.positionId===r.value;
  return false;
 });
}
function transition(state,event){
 if(!event||typeof event.id!=='string'||!event.id||event.id.length>160||!Array.isArray(event.effects))throw Error('유효하지 않은 사건');
 if(Object.prototype.hasOwnProperty.call(state.processedEventIds,event.id))return {state,applied:false};
 if(!check(state,event.requires||[]))return {state,applied:false,blocked:true};
 const next=JSON.parse(JSON.stringify(state));
 for(const e of event.effects){
  if(!allowedEffects.has(e.type))throw Error('허용되지 않은 상태 효과');
  if(e.type==='hpDelta'){if(!Number.isInteger(e.value)||Math.abs(e.value)>100)throw Error('HP 범위 오류');next.hp=Math.max(0,Math.min(100,next.hp+e.value));}
  if(e.type==='noiseDelta'){if(!Number.isInteger(e.value)||Math.abs(e.value)>100)throw Error('소음 범위 오류');next.noise=Math.max(0,next.noise+e.value);}
  if(e.type==='moveTo'){if(typeof e.value!=='string'||!e.value||e.value.length>80)throw Error('위치 오류');next.positionId=e.value;}
 }
 Object.defineProperty(next.processedEventIds,event.id,{value:true,enumerable:true,writable:true,configurable:true});
 return {state:next,applied:true};
}
function requestRisk(state,id,description){if(state.pendingAction)throw Error('이미 확인 대기 중');return {...state,pendingAction:{id,description}};}
function cancelRisk(state){return {...state,pendingAction:null};}
function confirmRisk(state,event){if(!state.pendingAction||state.pendingAction.id!==event.id)throw Error('확인되지 않은 위험 행동');const result=transition(state,event);return {...result,state:{...result.state,pendingAction:null}};}
function selfTest(){
 const checks=[];
 const test=(name,fn)=>{try{checks.push({name,pass:!!fn()})}catch(e){checks.push({name,pass:false,error:String(e.message)})}};
 const initial=createState();
 const event={id:'test:damage',effects:[{type:'hpDelta',value:-20}]};
 const applied=transition(initial,event);
 test('HP damage',()=>applied.state.hp===80&&initial.hp===100);
 test('idempotent event',()=>!transition(applied.state,event).applied&&transition(applied.state,event).state.hp===80);
 test('prototype key event id',()=>transition(initial,{id:'__proto__',effects:[{type:'noiseDelta',value:1}]}).state.noise===1);
 test('blocked requirements',()=>transition(initial,{id:'blocked',requires:[{type:'position',value:'X'}],effects:[{type:'hpDelta',value:-10}]}).blocked===true);
 test('risk cancel unchanged',()=>{const p=requestRisk(initial,'risk','test');const c=cancelRisk(p);return c.hp===100&&c.pendingAction===null});
 test('risk requires confirmation',()=>{try{confirmRisk(initial,{id:'risk',effects:[]});return false}catch{return true}});
 test('risk executes once',()=>{const p=requestRisk(initial,'risk','test');const a=confirmRisk(p,{id:'risk',effects:[{type:'hpDelta',value:-5}]});return a.state.hp===95&&a.state.pendingAction===null&&!transition(a.state,{id:'risk',effects:[{type:'hpDelta',value:-5}]}).applied});
 test('valid save restores',()=>{const x=restoreState(JSON.parse(JSON.stringify(applied.state)));return x.hp===80&&x.pendingAction===null});
 test('pending risk cancelled on restore',()=>restoreState(requestRisk(initial,'risk','test')).pendingAction===null);
 test('corrupt save rejected',()=>restoreState({...initial,hp:-1})===null);
 test('polluted event map rejected',()=>restoreState({...initial,processedEventIds:{x:false}})===null);
 test('invalid effect rejected',()=>{try{transition(initial,{id:'invalid',effects:[{type:'infectionDelta',value:1}]});return false}catch{return true}});
 return {passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
}

root.ZombieCore={createState,restoreState,check,transition,requestRisk,cancelRisk,confirmRisk,selfTest};
})(window);
