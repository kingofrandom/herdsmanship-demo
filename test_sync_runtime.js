#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const nodeCrypto = require('crypto');

async function testFrontendRuntime() {
  const html = fs.readFileSync('index.html', 'utf8');
  const start = html.indexOf('const LS="hsm_woodbury_v3";');
  const end = html.indexOf('function calc(r)', start);
  assert(start >= 0 && end > start, 'could not isolate frontend state/sync code');
  const appCode = html.slice(start, end);

  const store = new Map([
    ['hsm_woodbury_v2', JSON.stringify({judge:'Old', pass:'d1am', scores:{demo:{}}, schedule:{}})],
    ['hsm_sync_v1', JSON.stringify({url:'https://example.invalid/exec?old=1', queue:[{kind:'snapshot'}]})],
  ]);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {id, value:'', textContent:'', style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false;}}});
    return elements.get(id);
  };
  const context = {
    console, assert,
    setTimeout: fn => { if (typeof fn === 'function') fn(); return 0; }, setInterval: () => 0, clearTimeout: () => {},
    localStorage: {
      getItem:key=>store.has(key)?store.get(key):null,
      setItem:(key,value)=>store.set(key,String(value)),
      removeItem:key=>store.delete(key),
    },
    navigator:{onLine:false},
    window:{addEventListener:()=>{},scrollTo:()=>{}},
    document:{getElementById:element},
    crypto:{randomUUID:(()=>{let n=0;return()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;})()},
    fetch:async()=>{throw new Error('unexpected network request');},
    confirm:()=>true,
    flashSaved:()=>{}, renderSyncPanel:()=>{}, renderScore:()=>{}, syncHeader:()=>{},
    updateModeUi:()=>{}, toast:()=>{}, go:()=>{},
    clubsForSpecies:id=>context.CLUBS.filter(c=>(c.species||[]).includes(id)),
    RUBRIC:[
      {key:'clean',name:'Clean',wt:20},{key:'animals',name:'Animals',wt:20},
      {key:'security',name:'Security',wt:15},{key:'educ',name:'Educ',wt:15},
      {key:'feed',name:'Feed',wt:10},{key:'exhib',name:'Exhib',wt:20},
    ],
    SPECIES:[{id:'beef',name:'Beef',em:'🐄'}],
    CLUBS:[{id:'club',name:'Club',species:['beef']}],
    JUDGES:['Judge'], BARNS:[], STALLS:[], BARN_LAYOUT:[],
  };

  const testCode = `${appCode}\n(async()=>{\n` +
    `assert.strictEqual(S.mode,'live'); assert.strictEqual(Object.keys(S.scores).length,0);\n` +
    `let st=syncState(); assert.strictEqual(st.url,PRODUCTION_SYNC_URL); assert.deepStrictEqual(st.queue,[]);\n` +
    `const score=n=>({r:{clean:n,animals:5,security:5,educ:5,feed:5,exhib:5},note:'offline',judge:'Judge',revision:'rev0'});\n` +
    `S.mode='sample'; const before=syncState().queue.length; queueScoreUpsert('club|beef|d1am',score(3)); assert.strictEqual(syncState().queue.length,before,'sample score leaked to queue');\n` +
    `S.mode='live'; st=syncState(); st.url='https://example.invalid/exec'; st.datasetId=null; st.generation=null; st.queue=[]; st.recovery=[]; saveSyncState(st);\n` +
    `queueScoreUpsert('club|beef|d1am',score(4)); applyRemoteState({datasetId:'data-a',generation:1,scores:{},schedule:{'d1am|beef':'Judge'}});\n` +
    `assert(S.scores['club|beef|d1am']); assert.strictEqual(syncState().queue[0].datasetId,'data-a');\n` +
    `st=syncState(); st.queue.push({opId:'stale0001',kind:'scoreUpsert',key:'club|beef|d1pm',entry:score(2),backendUrl:st.url,datasetId:'data-a',generation:1}); saveSyncState(st);\n` +
    `applyRemoteState({datasetId:'data-a',generation:2,scores:{},schedule:{}}); assert.strictEqual(syncState().queue.length,0); assert(syncState().recovery.some(x=>x.recoveryReason==='stale_generation'));\n` +
    `st=syncState(); st.recovery=[]; st.datasetId='data-a'; st.generation=2; st.queue=[]; saveSyncState(st); navigator.onLine=false; S.mode='live';\n` +
    `queueScheduleUpsert('d1am|beef','Judge'); queueScheduleUpsert('d1pm|beef','Judge'); applyRemoteState({datasetId:'data-a',generation:2,scores:{},schedule:{'d2am|beef':'Judge'}});\n` +
    `assert.strictEqual(S.schedule['d2am|beef'],'Judge'); assert.strictEqual(S.schedule['d1am|beef'],'Judge'); assert.strictEqual(S.schedule['d1pm|beef'],'Judge');\n` +
    `st=syncState(); st.queue=[]; st.recovery=[]; saveSyncState(st); navigator.onLine=false; S.scores={}; const first=score(3); queueScoreUpsert('club|beef|d1am',first);\n` +
    `let resolveFirst, posts=[]; fetch=async(url,opts)=>{const body=JSON.parse(opts.body);posts.push(body);if(posts.length===1)return new Promise(r=>{resolveFirst=()=>r({json:async()=>({ok:true,revision:'rev1'})});});return {json:async()=>({ok:true,revision:'rev2'})};};\n` +
    `navigator.onLine=true; const pushing=pushQueue(); await Promise.resolve(); await Promise.resolve(); const second=score(5); S.scores['club|beef|d1am']=second; queueScoreUpsert('club|beef|d1am',second); resolveFirst(); await pushing;\n` +
    `assert.strictEqual(posts.length,2,'newer edit was deleted by older acknowledgement'); assert.strictEqual(posts[1].expectedRevision,'rev1'); assert.strictEqual(syncState().queue.length,0); assert.strictEqual(S.scores['club|beef|d1am'].revision,'rev2');\n` +
    `S=createSampleState(); const sampleCount=Object.keys(S.scores).length; assert(sampleCount>0); const queued=syncState().queue.length; queueScoreUpsert('club|beef|d1am',score(1)); assert.strictEqual(syncState().queue.length,queued);\n` +
    `assert.strictEqual(isSetupLockEnabled(),false); applySetupProtection({enabled:true,revision:4}); assert.strictEqual(isSetupLockEnabled(),true);\n` +
    `assert.strictEqual(setupProtectionState().revision,4); assert(!localStorage.getItem(SETUP_PROTECTION_LS).includes('password'));\n` +
    `st=syncState(); st.url='https://example.invalid/exec'; saveSyncState(st); fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.strictEqual(body.action,'verifySetupAccess');return {json:async()=>body.password==='correct horse battery staple'?{ok:true,unlocked:true,setupProtection:{enabled:true,revision:4}}:{ok:false,error:'incorrect_setup_password'}};};\n` +
    `assert.strictEqual(await verifySetupAccess('wrong password'),false); assert.strictEqual(await verifySetupAccess('correct horse battery staple'),true);\n` +
    `localStorage.removeItem(SYNC_LS); localStorage.removeItem(LEGACY_SYNC_LS); st=syncState(); assert.strictEqual(st.url,PRODUCTION_SYNC_URL,'fresh device did not receive production endpoint');\n` +
    `st={...defaultSyncState(),url:'https://obsolete.invalid/exec',datasetId:'old-data',generation:1,queue:[{opId:'obsolete001',kind:'scoreUpsert',key:'club|beef|d1am',entry:score(3),backendUrl:'https://obsolete.invalid/exec',datasetId:'old-data',generation:1}],recovery:[]}; saveSyncState(st); st=syncState(); assert.strictEqual(st.url,PRODUCTION_SYNC_URL); assert.strictEqual(st.queue.length,0); assert(st.recovery.some(x=>x.recoveryReason==='production_endpoint_changed'),'wrong-backend operation was not quarantined');\n` +
    `st={...defaultSyncState(),url:'',queue:[{opId:'offline001',kind:'scoreUpsert',key:'club|beef|d1am',entry:score(4),backendUrl:'',datasetId:null,generation:null}],recovery:[]}; saveSyncState(st); st=syncState(); assert.strictEqual(st.url,PRODUCTION_SYNC_URL); assert.strictEqual(st.queue[0].backendUrl,PRODUCTION_SYNC_URL,'unbound offline change was not attached safely');\n` +
    `let attempts=0; fetch=async()=>({ok:true,json:async()=>{attempts++;if(attempts===1)throw new SyntaxError('html response');return {ok:true};}}); assert.strictEqual((await requestJson('https://example.invalid/retry')).ok,true); assert.strictEqual(attempts,2,'transient response was not retried');\n` +
    `st={...defaultSyncState(),url:'https://example.invalid/exec',datasetId:'data-a',generation:2,queue:[],recovery:[]}; saveSyncState(st); S.mode='live'; let calls=[]; const config={setupProtection:{enabled:false,revision:0},species:SPECIES.map(x=>({...x})),clubs:CLUBS.map(x=>({...x,species:[...x.species]})),judges:[...JUDGES],barns:[],stalls:[],barnLayout:[],rubric:RUBRIC.map(x=>({...x}))}; fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('action=config')?{ok:true,config}:{ok:true,state:{datasetId:'data-a',generation:2,scores:{},schedule:{}}}};}; await Promise.all([syncNow(),syncNow()]); assert.strictEqual(calls.filter(x=>x.includes('action=config')).length,1,'concurrent sync duplicated config request'); assert.strictEqual(calls.filter(x=>x.includes('action=state')).length,1,'empty queue caused duplicate state pulls');\n` +
    `return 'ok';\n})()`;
  const result = await vm.runInNewContext(testCode, context, {filename:'frontend-runtime.vm.js'});
  assert.strictEqual(result, 'ok');
}

class Range {
  constructor(sheet,row,col,numRows=1,numCols=1){Object.assign(this,{sheet,row,col,numRows,numCols});}
  setValues(values){for(let r=0;r<values.length;r++)for(let c=0;c<values[r].length;c++)this.sheet.set(this.row+r,this.col+c,values[r][c]);return this;}
  setValue(value){this.sheet.set(this.row,this.col,value);return this;}
  clearContent(){for(let r=0;r<this.numRows;r++)for(let c=0;c<this.numCols;c++)this.sheet.set(this.row+r,this.col+c,'');return this;}
  getValues(){return Array.from({length:this.numRows},(_,r)=>Array.from({length:this.numCols},(_,c)=>this.sheet.get(this.row+r,this.col+c)));}
}
class Sheet {
  constructor(rows){this.data=rows.map(r=>r.slice());}
  get(row,col){return(this.data[row-1]||[])[col-1]??'';}
  set(row,col,value){while(this.data.length<row)this.data.push([]);while(this.data[row-1].length<col)this.data[row-1].push('');this.data[row-1][col-1]=value;}
  getDataRange(){return new Range(this,1,1,Math.max(this.getLastRow(),1),Math.max(this.getLastColumn(),1));}
  getRange(row,col,numRows=1,numCols=1){return new Range(this,row,col,numRows,numCols);}
  getLastRow(){for(let i=this.data.length-1;i>=0;i--)if(this.data[i].some(v=>String(v??'').trim()!==''))return i+1;return 0;}
  getLastColumn(){return this.data.reduce((n,r)=>Math.max(n,r.length),0);}
  appendRow(row){this.data[Math.max(this.getLastRow(),1)]=row.slice();}
  deleteRow(row){this.data.splice(row-1,1);}
}
function makeSpreadsheet(){
  const ratings=[['clean','Clean',20,''],['animals','Animals',20,''],['security','Security',15,''],['educ','Educ',15,''],['feed','Feed',10,''],['exhib','Exhib',20,'']];
  const rows={
    'Clubs':[['ID','Name','Leaders','Species (comma sep)','Notes'],['a','Club A','','llama',''],['b','Club B','','llama','']],
    'Barns':[['Barn ID','Name','Species (comma sep)','Area / Building','Sort Order','Notes']],
    'Stalls':[['Barn ID','Stall ID','Species','Label','Status','Notes']],
    'Barn Layout':[['Club ID','Species','Barn ID','Pen Count','Stalls Used','Location Notes']],
    'Judges':[['Name','Active (Y/N)','Notes'],['Judge','Y','']],
    'Rubric':[['Key','Name','Weight','Hint'],...ratings],
    'Species':[['ID','Name','Emoji'],['llama','Llama and Alpaca','🦙']],
    'Settings':[['Key','Value']],
    'Scores':[['Club','Species','Pass','Judge','Score','Clean','Animals','Security','Educ','Feed','Exhib','Note','LastUpdated','Revision','OpId']],
    'Schedule':[['Pass','Species','Judge','Revision','OpId']],
  };
  const sheets=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,new Sheet(v)]));
  return {sheets,getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=new Sheet([[]]))};
}
function testBackendRuntime(){
  const spreadsheet=makeSpreadsheet(), properties=new Map(); let uuid=0;
  const propApi={
    getProperty:k=>properties.has(k)?properties.get(k):null,
    setProperty:(k,v)=>{properties.set(k,String(v));return propApi;},
    setProperties:o=>{Object.entries(o).forEach(([k,v])=>properties.set(k,String(v)));return propApi;},
    deleteProperty:k=>{properties.delete(k);return propApi;},
  };
  const context={
    console,
    SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,getUi:()=>({createMenu(){return this;},addItem(){return this;},addToUi(){},alert(){return 'YES';},ButtonSet:{YES_NO:'YES_NO'},Button:{YES:'YES'}})},
    LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>{}})},
    PropertiesService:{getScriptProperties:()=>propApi},
    Utilities:{
      getUuid:()=>`uuid-${String(++uuid).padStart(8,'0')}`,
      DigestAlgorithm:{SHA_256:'SHA_256'}, Charset:{UTF_8:'UTF_8'},
      computeDigest:(algorithm,value)=>[...nodeCrypto.createHash('sha256').update(String(value)).digest()].map(n=>n>127?n-256:n),
    },
    ContentService:{MimeType:{JSON:'JSON'},createTextOutput:text=>({text,setMimeType(){return this;}})},
  };
  vm.runInNewContext(fs.readFileSync('Code.gs','utf8'),context,{filename:'Code.gs'});
  const post=body=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).text);
  const get=action=>JSON.parse(context.doGet({parameter:{action}}).text);
  const entry=(note='runtime')=>({r:{clean:5,animals:4,security:3,educ:4,feed:5,exhib:4},note,judge:'Judge'});

  let state=get('state').state;
  assert(state.datasetId); assert.strictEqual(state.generation,1);
  assert.strictEqual(post({action:'snapshot'}).error,'client_upgrade_required');
  assert.strictEqual(post({action:'resetScores'}).error,'unknown_action');

  const base={datasetId:state.datasetId,generation:1,expectedRevision:null};
  const first=post({...base,action:'upsertScore',opId:'operation001',key:'a|llama|d1am',entry:entry()});
  assert(first.ok && first.revision);
  const retry=post({...base,action:'upsertScore',opId:'operation001',key:'a|llama|d1am',entry:entry()});
  assert.strictEqual(retry.revision,first.revision,'idempotent retry changed revision');
  assert.strictEqual(post({...base,action:'upsertScore',opId:'operation002',key:'a|llama|d1am',entry:entry(),expectedRevision:'wrong'}).error,'score_conflict');
  assert.strictEqual(post({...base,action:'upsertScore',opId:'operation003',key:'b|llama|d1am',entry:entry('=IMPORTDATA("x")')}).error,'invalid_note');
  assert.strictEqual(post({...base,action:'upsertScore',opId:'operation004',key:'b|llama|d1am',entry:{...entry(),r:{clean:9}}}).error,'invalid_ratings');

  assert(post({action:'upsertSchedule',opId:'schedule001',key:'d1am|llama',judge:'Judge',datasetId:state.datasetId}).ok);
  assert(post({action:'upsertSchedule',opId:'schedule002',key:'d1pm|llama',judge:'Judge',datasetId:state.datasetId}).ok);
  state=get('state').state;
  assert.strictEqual(Object.keys(state.schedule).length,2,'per-slot schedule write lost another slot');
  assert.strictEqual(post({action:'updateSchedule'}).error,'client_upgrade_required');

  let protection=get('config').config.setupProtection;
  assert.deepStrictEqual(protection,{enabled:false,revision:0});
  const password='correct horse battery staple';
  const configured=context.setSetupPassword_(password);
  assert(configured.ok && configured.setupProtection.enabled);
  assert.strictEqual(post({action:'verifySetupAccess',password:'wrong password'}).error,'incorrect_setup_password');
  assert.strictEqual(post({action:'verifySetupAccess',password}).unlocked,true);
  assert.strictEqual(post({action:'setSetupPassword',password}).error,'unknown_action');
  assert(![...properties.values()].includes(password),'backend stored the readable Setup password');
  protection=get('config').config.setupProtection;
  assert.strictEqual(protection.enabled,true); assert(protection.revision>0);
  context.disableSetupLock_();
  assert.strictEqual(get('config').config.setupProtection.enabled,false);

  const reset=context.resetAllScores_();
  assert.strictEqual(reset.generation,2); assert.strictEqual(reset.cleared,1);
  state=get('state').state;
  assert.strictEqual(Object.keys(state.scores).length,0); assert.strictEqual(Object.keys(state.schedule).length,2);
  assert.strictEqual(post({...base,action:'upsertScore',opId:'operation005',key:'b|llama|d1am',entry:entry()}).error,'stale_generation');
  assert.strictEqual(post({...base,action:'upsertScore',opId:'operation006',key:'b|llama|d1am',entry:entry(),generation:2}).ok,true);
}

(async()=>{
  await testFrontendRuntime();
  testBackendRuntime();
  console.log('Runtime sync tests passed');
})().catch(err=>{console.error(err);process.exit(1);});
