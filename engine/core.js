/* v0.6 본편 상태 전이 엔진: 공식 대본은 별도 데이터로 탑재 */
(function(root){
'use strict';
const allowedEffects=new Set(['hpDelta','noiseDelta','moveTo']);
function createState(){return {hp:100,infectionStage:0,noise:0,positionId:null,processedEventIds:{},pendingAction:null,...newNarrativeState()};}
function restoreState(saved){
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return null;
 if(!Number.isInteger(saved.hp)||saved.hp<0||saved.hp>100||!Number.isInteger(saved.infectionStage)||saved.infectionStage<0||saved.infectionStage>4||!Number.isSafeInteger(saved.noise)||saved.noise<0||!(saved.positionId===null||(typeof saved.positionId==='string'&&saved.positionId.length<=80)))return null;
 if(!saved.processedEventIds||typeof saved.processedEventIds!=='object'||Array.isArray(saved.processedEventIds))return null;
 const ids=Object.create(null);
 const keys=Object.keys(saved.processedEventIds);
 if(keys.length>10000||keys.some(k=>k.length>160||saved.processedEventIds[k]!==true))return null;
 for(const k of keys)Object.defineProperty(ids,k,{value:true,enumerable:true,writable:true,configurable:true});
 const narrative=normalizeNarrative(saved);if(!narrative)return null;
 return {...createState(),hp:saved.hp,infectionStage:saved.infectionStage,noise:saved.noise,positionId:saved.positionId,processedEventIds:ids,pendingAction:null,...narrative};
}

const HERO_IDS=["HYJ","CSY","LCR","SHR","JSA"];
const isHero=id=>HERO_IDS.includes(id);
function newCharacters(){return Object.fromEntries(HERO_IDS.map(id=>[id,{met:false,alive:null,positionId:null,consents:{}}]));}
function newNarrativeState(){return {characters:newCharacters(),route:{locked:false,heroineId:null,lockEventId:null},officialCompanionId:null};}
function normalizeNarrative(saved){
 const base=newNarrativeState();
 if(saved===undefined)return base;
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return null;
 if(saved.characters!==undefined){
  if(!saved.characters||typeof saved.characters!=='object'||Array.isArray(saved.characters))return null;
  for(const id of HERO_IDS){
   const c=saved.characters[id];if(c===undefined)continue;
   if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.met!=='boolean'||!(c.alive===null||typeof c.alive==='boolean')||!(c.positionId===null||(typeof c.positionId==='string'&&c.positionId.length<=80))||!c.consents||typeof c.consents!=='object'||Array.isArray(c.consents))return null;
   const keys=Object.keys(c.consents);
   if(keys.length>50||keys.some(k=>k.length<1||k.length>80||typeof c.consents[k]!=='boolean'))return null;
   base.characters[id]={met:c.met,alive:c.alive,positionId:c.positionId,consents:Object.fromEntries(keys.map(k=>[k,c.consents[k]]))};
  }
 }
 if(saved.route!==undefined){
  const v=saved.route;
  if(!v||typeof v!=='object'||typeof v.locked!=='boolean'||!(v.heroineId===null||isHero(v.heroineId))||!(v.lockEventId===null||(typeof v.lockEventId==='string'&&v.lockEventId.length<=160))||(!v.locked&&v.heroineId!==null)||(v.locked&&!v.heroineId))return null;
  base.route={locked:v.locked,heroineId:v.heroineId,lockEventId:v.lockEventId};
 }
 if(saved.officialCompanionId!==undefined){
  if(!(saved.officialCompanionId===null||isHero(saved.officialCompanionId)))return null;
  base.officialCompanionId=saved.officialCompanionId;
 }
 return base;
}
function narrativeEvent(state,event){
 if(!event||typeof event.id!=='string'||!event.id||event.id.length>160||!Array.isArray(event.effects))throw Error('유효하지 않은 서사 사건');
 if(Object.prototype.hasOwnProperty.call(state.processedEventIds,event.id))return {state,applied:false};
 if(state.pendingAction)throw Error('위험 행동 확인 대기 중');
 const next=JSON.parse(JSON.stringify(state));
 const n=normalizeNarrative(next);if(!n)throw Error('인물 상태 오류');
 Object.assign(next,n);
 for(const e of event.effects){
  if(!e||typeof e!=='object')throw Error('잘못된 서사 효과');
  if(e.type==='zombieBite'){
   if(e.confirmedBite!==true||!Number.isInteger(e.stage)||e.stage<1||e.stage>4)throw Error('실제 물림 확인 필요');
   next.infectionStage=Math.max(next.infectionStage,e.stage);
  }else if(e.type==='characterEncounter'){
   if(!isHero(e.heroineId))throw Error('인물 ID 오류');
   next.characters[e.heroineId].met=true;
  }else if(e.type==='characterStatus'){
   if(!isHero(e.heroineId)||!next.characters[e.heroineId].met||typeof e.alive!=='boolean')throw Error('인물 생존 상태 오류');
   if(next.characters[e.heroineId].alive===false&&e.alive===true)throw Error('사망 인물 부활 금지');
   next.characters[e.heroineId].alive=e.alive;
  }else if(e.type==='consent'){
   if(!isHero(e.heroineId)||!next.characters[e.heroineId].met||next.characters[e.heroineId].alive===false||typeof e.actionId!=='string'||!e.actionId||e.actionId.length>80||typeof e.granted!=='boolean')throw Error('동의 기록 오류');
   next.characters[e.heroineId].consents[e.actionId]=e.granted;
  }else if(e.type==='routeLock'){
   if(!isHero(e.heroineId)||e.sceneId!=='COM-10-S011'||next.route.locked||!next.characters[e.heroineId].met||next.characters[e.heroineId].alive===false)throw Error('루트 잠금 조건 오류');
   next.route={locked:true,heroineId:e.heroineId,lockEventId:event.id};
  }else if(e.type==='companionMove'){
   if(e.sceneId!=='COM-10-S012'||!next.route.locked||e.heroineId!==next.route.heroineId||next.characters[e.heroineId].alive===false||next.officialCompanionId!==null)throw Error('동행 이동 조건 오류');
   next.officialCompanionId=e.heroineId;
  }else throw Error('지원하지 않는 서사 효과');
 }
 Object.defineProperty(next.processedEventIds,event.id,{value:true,enumerable:true,writable:true,configurable:true});
 return {state:next,applied:true};
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
 test('no infection without bite',()=>{try{narrativeEvent(initial,{id:'infection',effects:[{type:'zombieBite',stage:1}]});return false}catch{return initial.infectionStage===0}});
 test('confirmed bite increases infection',()=>narrativeEvent(initial,{id:'bite',effects:[{type:'zombieBite',confirmedBite:true,stage:2}]}).state.infectionStage===2);
 test('stage 4 irreversible',()=>narrativeEvent(narrativeEvent(initial,{id:'bite4',effects:[{type:'zombieBite',confirmedBite:true,stage:4}]}).state,{id:'bite1',effects:[{type:'zombieBite',confirmedBite:true,stage:1}]}).state.infectionStage===4);
 test('consent requires encounter',()=>{try{narrativeEvent(initial,{id:'consent',effects:[{type:'consent',heroineId:'HYJ',actionId:'help',granted:true}]});return false}catch{return true}});
 test('consent scoped to action',()=>{const met=narrativeEvent(initial,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]}).state;const consent=narrativeEvent(met,{id:'yes',effects:[{type:'consent',heroineId:'HYJ',actionId:'help',granted:true}]}).state;return consent.characters.HYJ.consents.help===true&&consent.characters.HYJ.consents.travel===undefined});
 test('route cannot lock early',()=>{const met=narrativeEvent(initial,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]}).state;try{narrativeEvent(met,{id:'lock',effects:[{type:'routeLock',heroineId:'HYJ',sceneId:'COM-09-S011'}]});return false}catch{return true}});
 test('route lock at chapter 10 scene 11',()=>{const met=narrativeEvent(initial,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]}).state;const locked=narrativeEvent(met,{id:'lock',effects:[{type:'routeLock',heroineId:'HYJ',sceneId:'COM-10-S011'}]}).state;return locked.route.locked&&locked.officialCompanionId===null});
 test('companion movement only chapter 10 scene 12',()=>{const met=narrativeEvent(initial,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]}).state;const locked=narrativeEvent(met,{id:'lock',effects:[{type:'routeLock',heroineId:'HYJ',sceneId:'COM-10-S011'}]}).state;const moved=narrativeEvent(locked,{id:'move',effects:[{type:'companionMove',heroineId:'HYJ',sceneId:'COM-10-S012'}]}).state;return moved.officialCompanionId==='HYJ'});
 test('narrative event idempotency',()=>{const a=narrativeEvent(initial,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]});return !narrativeEvent(a.state,{id:'meet',effects:[{type:'characterEncounter',heroineId:'HYJ'}]}).applied});
 test('legacy save compatibility',()=>{const legacy={hp:100,infectionStage:0,noise:0,positionId:null,processedEventIds:{},pendingAction:null};const restored=restoreState(legacy);return !!restored&&restored.characters.HYJ.met===false&&!restored.route.locked});
 return {passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
}

root.ZombieCore={createState,restoreState,check,transition,narrativeEvent,requestRisk,cancelRisk,confirmRisk,selfTest};
})(window);
