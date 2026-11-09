/* 397: integration regression tests. Run with: node tests/integration.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../engine/core.js'),'utf8'),context);
const core=context.window.ZombieCore;
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const serialize=s=>JSON.parse(JSON.stringify(s));
function memorySave(){let slot=null;return {write:(packId,sceneId,state,visitIndex)=>{slot=JSON.stringify({packId,sceneId,state,visitIndex})},read:()=>JSON.parse(slot)};}
function resume(storage,packId,ids){const saved=storage.read();const state=core.restoreState(saved.state);if(!state||saved.packId!==packId||!ids.includes(saved.sceneId))throw Error('invalid save');return {state,sceneId:saved.sceneId,visitIndex:saved.visitIndex};}
function advance(state,sceneId,visitIndex,choice,effects,confirmed=false){const id='story:'+sceneId+':visit:'+visitIndex+':'+choice;return core.applyStoryEvent(state,{id,effects},confirmed);}
test('scene choice -> HP and next scene save -> restore',()=>{
 const store=memorySave();const state=core.createState();const result=advance(state,'COM-01-S001',0,0,[{type:'hpDelta',value:-15},{type:'noiseDelta',value:2}]);
 assert.equal(result.state.hp,85);assert.equal(result.state.noise,2);
 store.write('pack','COM-01-S002',result.state,1);
 const restored=resume(store,'pack',['COM-01-S001','COM-01-S002']);
 assert.equal(restored.sceneId,'COM-01-S002');assert.equal(restored.visitIndex,1);assert.equal(restored.state.hp,85);
});
test('risk request and cancellation leaves world unchanged',()=>{
 const initial=core.createState();const pending=core.requestRisk(initial,'risk:1','danger');
 assert.equal(pending.hp,100);assert.equal(pending.noise,0);
 const cancelled=core.cancelRisk(pending);
 assert.equal(cancelled.hp,100);assert.equal(cancelled.noise,0);assert.equal(cancelled.pendingAction,null);
});
test('risk confirmation applies once, never on first tap',()=>{
 const initial=core.createState();const id='story:COM-01-S001:visit:0:0';
 const pending=core.requestRisk(initial,id,'danger');
 assert.equal(pending.hp,100);
 const first=core.applyStoryEvent(pending,{id,effects:[{type:'hpDelta',value:-20}]},true);
 assert.equal(first.state.hp,80);
 assert.equal(core.applyStoryEvent(first.state,{id,effects:[{type:'hpDelta',value:-20}]}).applied,false);
});
test('pending risk after app restart is cancelled without damage',()=>{
 const store=memorySave();const initial=core.createState();
 const pending=core.requestRisk(initial,'risk:restart','danger');
 store.write('pack','COM-01-S001',pending,0);
 const restored=resume(store,'pack',['COM-01-S001']);
 assert.equal(restored.state.pendingAction,null);assert.equal(restored.state.hp,100);
});
test('revisiting a scene uses a fresh event ID',()=>{
 let state=core.createState();
 const a=advance(state,'COM-01-S001',0,0,[{type:'noiseDelta',value:1}]);state=a.state;
 const b=advance(state,'COM-01-S002',1,0,[]);state=b.state;
 const c=advance(state,'COM-01-S001',2,0,[{type:'noiseDelta',value:1}]);state=c.state;
 assert.equal(state.noise,2);assert.equal(c.applied,true);
});
test('invalid narrative effect rolls back combined HP damage',()=>{
 const initial=core.createState();
 assert.throws(()=>advance(initial,'COM-01-S001',0,0,[{type:'hpDelta',value:-10},{type:'consent',heroineId:'HYJ',actionId:'help',granted:true}]));
 assert.equal(initial.hp,100);assert.equal(Object.keys(initial.processedEventIds).length,0);
});
test('blocked condition does not change HP, location or scene',()=>{
 const initial=core.createState();const result=core.applyStoryEvent(initial,{id:'blocked',requires:[{type:'position',value:'SAFE'}],effects:[{type:'hpDelta',value:-5}]});
 assert.equal(result.blocked,true);assert.equal(result.state,initial);
});
test('death persists and remains death after restore',()=>{
 const store=memorySave();const initial=core.createState();
 const dead=advance(initial,'COM-01-S001',0,0,[{type:'hpDelta',value:-100}]).state;
 store.write('pack','COM-01-S002',dead,1);
 const restored=resume(store,'pack',['COM-01-S002']);
 assert.equal(restored.state.hp,0);
});
test('legacy state restores with default character and route data',()=>{
 const legacy={hp:70,infectionStage:0,noise:0,positionId:null,processedEventIds:{},pendingAction:null};
 const state=core.restoreState(legacy);
 assert.equal(state.hp,70);assert.equal(state.route.locked,false);assert.equal(state.characters.HYJ.met,false);
});
test('pack mismatch prevents wrong story restore',()=>{
 const store=memorySave();store.write('old','COM-01-S001',core.createState(),0);
 assert.throws(()=>resume(store,'new',['COM-01-S001']));
});
console.log('Integration checks: '+passed+'/10 passed');
