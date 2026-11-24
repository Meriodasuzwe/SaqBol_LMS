import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {parse} from '@babel/parser';
import {newDraft,restoreDraft,storeDraft,payload,creationRequest,validDraft} from '../src/question-bank/draft.js';

const source=readFileSync(new URL('../src/question-bank/QuestionBankPage.jsx',import.meta.url),'utf8');
const nodes=[];
function walk(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const [k,v] of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}
walk(parse(source,{sourceType:'module',plugins:['jsx']}));
function actualEffect(marker,scope){const node=nodes.find(n=>n.type==='CallExpression'&&n.callee?.name==='useEffect'&&(marker==='storeDraft('? /\bstoreDraft\(/.test(source.slice(n.arguments[0].start,n.arguments[0].end)):source.slice(n.arguments[0].start,n.arguments[0].end).includes(marker)));assert.ok(node,marker);return new Script('('+source.slice(node.arguments[0].start,node.arguments[0].end)+')').runInNewContext(scope)()}
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
function scopeFor(local=memory(),session=memory()){
 const scope={apiClient:{get:async()=>({data:{topics:{},author_id:123456}})},localStorage:local,sessionStorage:session,browserDraftStorage:local,browserSessionStorage:session,restoreDraft,storeDraft,newDraft,payload,creationRequest,validDraft,inflight:{current:false},draft:newDraft(),storageKey:null,dirty:false,pendingCreate:null,saving:false,c:{restored:'Restored'},heading:{current:null},window:{confirm:()=>true},structuredClone};
 for(const [setter,key] of Object.entries({setSaving:'saving',setReload:'reload',setError:'error',setDraft:'draft',setStorageKey:'storageKey',setDirty:'dirty',setPendingCreate:'pendingCreate',setMessage:'message',setTopics:'topics',setMetadataError:'metadataError',setStorageProblem:'storageProblem'}))scope[setter]=value=>{scope[key]=value};
 return scope;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('actual mount restores the author draft after the previous tab session has ended',async()=>{
 const local=memory(),original={...newDraft(),topic:'Artificial SQL',text:'  SELECT title\nFROM demo_books;\n',explanation:'Artificial explanation'};
 original.choices[0].text='Original A';original.choices[1].text='Original B';original.choices[0].is_correct=true;
 storeDraft(local,'saqbol.bank.draft.123456',original,true);
 const scope=scopeFor(local,memory());actualEffect('/quizzes/bank/topics/',scope);await flush();
 assert.equal(scope.draft.text,original.text,'The real mount must read the durable browser draft, not only the now-empty tab session');
 assert.deepEqual(scope.draft.choices,original.choices);assert.equal(scope.dirty,true);assert.equal(scope.storageKey,'saqbol.bank.draft.123456');
});

test('actual open handler cannot replace the form before author recovery finishes',()=>{
 const node=nodes.find(n=>n.type==='VariableDeclarator'&&n.id?.name==='open');const scope=scopeFor();scope.draft.text='Artificial unfinished input';
 new Script('('+source.slice(node.init.start,node.init.end)+')').runInNewContext(scope)();
 assert.equal(scope.draft.text,'Artificial unfinished input','Wait for the author key before opening or starting another draft');
});

test('actual persistence reports unavailable storage instead of claiming the draft is safe',()=>{
 const scope=scopeFor({getItem:()=>null,setItem:()=>{throw new Error('Artificial quota failure')},removeItem:()=>{throw new Error('Artificial blocked storage')}});
 scope.storageKey='saqbol.bank.draft.123456';scope.dirty=true;scope.draft.text='Artificial unsaved input';actualEffect('storeDraft(',scope);
 assert.equal(scope.storageProblem,true,'The form must show that local recovery is unavailable');
});

test('actual mount migrates an old tab draft to durable storage before clearing the old copy',async()=>{
 const local=memory(),session=memory(),d={...newDraft(),text:'Artificial old tab draft'};storeDraft(session,'saqbol.bank.draft.123456',d,true);
 const scope=scopeFor(local,session);actualEffect('/quizzes/bank/topics/',scope);await flush();actualEffect('storeDraft(',scope);
 assert.equal(restoreDraft(local,scope.storageKey)?.text,d.text);assert.equal(restoreDraft(session,scope.storageKey),null);
});

test('actual mount does not recover another author, and successful save removes only this author draft',async()=>{
 const local=memory();storeDraft(local,'saqbol.bank.draft.999999',{...newDraft(),text:'Other artificial author'},true);
 const scope=scopeFor(local);actualEffect('/quizzes/bank/topics/',scope);await flush();assert.equal(scope.draft.text,'');
 storeDraft(local,'saqbol.bank.draft.123456',{...newDraft(),text:'Current artificial author'},true);
 scope.dirty=false;actualEffect('storeDraft(',scope);assert.equal(restoreDraft(local,scope.storageKey),null);assert.equal(restoreDraft(local,'saqbol.bank.draft.999999').text,'Other artificial author');
});

test('draft storage returns a failure signal when a browser refuses writes',()=>{
 const blocked={setItem(){throw new Error('Artificial quota')},removeItem(){throw new Error('Artificial quota')}};
 assert.equal(storeDraft(blocked,'author',newDraft(),true),false);assert.equal(storeDraft(memory(),'author',newDraft(),true),true);
});


test('lost-response operation survives a closed tab and reuses the exact request on recovery',async()=>{
 const local=memory(),first=scopeFor(local);
 first.storageKey='saqbol.bank.draft.123456';first.dirty=true;
 Object.assign(first.draft,{topic:'Artificial SQL',text:'Original before network loss'});
 first.draft.choices.forEach((option,i)=>{option.text='Artificial '+i;option.is_correct=i===0});
 const requests=[];
 first.apiClient.post=async(path,body,config)=>{requests.push(structuredClone({path,body,config}));throw new Error('Artificial response lost after server commit')};
 const node=nodes.find(n=>n.type==='VariableDeclarator'&&n.id?.name==='save');
 await new Script('('+source.slice(node.init.start,node.init.end)+')').runInNewContext(first)({preventDefault(){}});
 actualEffect('storeDraft(',first);
 const second=scopeFor(local,memory());actualEffect('/quizzes/bank/topics/',second);await flush();
 assert.equal(second.pendingCreate.key,first.pendingCreate.key);
 second.apiClient.post=async(path,body,config)=>{requests.push(structuredClone({path,body,config}));return {data:{...body,id:88,revision:1}}};
 await new Script('('+source.slice(node.init.start,node.init.end)+')').runInNewContext(second)({preventDefault(){}});
 assert.deepEqual(requests[0],requests[1]);assert.equal(second.draft.id,88);assert.equal(second.dirty,false);
 actualEffect('storeDraft(',second);assert.equal(restoreDraft(local,second.storageKey),null);
});

test('unavailable durable storage keeps the old tab copy during migration',async()=>{
 const session=memory(),key='saqbol.bank.draft.123456';storeDraft(session,key,{...newDraft(),text:'Artificial old tab'},true);
 const local={getItem:()=>null,setItem(){throw new Error('Artificial quota')},removeItem(){throw new Error('Artificial quota')}};
 const scope=scopeFor(local,session);actualEffect('/quizzes/bank/topics/',scope);await flush();actualEffect('storeDraft(',scope);
 assert.equal(scope.storageProblem,true);assert.equal(restoreDraft(session,key).text,'Artificial old tab');
});

test('failed author lookup does not erase a local question and can be retried',async()=>{
 const local=memory(),key='saqbol.bank.draft.123456';storeDraft(local,key,{...newDraft(),text:'Artificial offline draft'},true);
 const scope=scopeFor(local);scope.apiClient.get=async()=>{throw new Error('Artificial disconnected network')};
 actualEffect('/quizzes/bank/topics/',scope);await flush();actualEffect('storeDraft(',scope);
 assert.equal(scope.metadataError,true);assert.equal(scope.storageKey,null);assert.equal(restoreDraft(local,key).text,'Artificial offline draft');
 scope.apiClient.get=async()=>({data:{topics:{},author_id:123456}});actualEffect('/quizzes/bank/topics/',scope);await flush();
 assert.equal(scope.draft.text,'Artificial offline draft');assert.equal(scope.metadataError,false);
});


for(const status of [401,403,429,500])test('uncertain create stays frozen across HTTP '+status,async()=>{
 const scope=scopeFor();scope.storageKey='saqbol.bank.draft.123456';scope.dirty=true;
 Object.assign(scope.draft,{topic:'Artificial SQL',text:'Artificial valid question'});scope.draft.choices.forEach((o,i)=>{o.text='Artificial '+i;o.is_correct=i===0});
 scope.apiClient.post=async()=>{throw new Error('Artificial lost response')};
 const n=nodes.find(n=>n.type==='VariableDeclarator'&&n.id?.name==='save');const save=new Script('('+source.slice(n.init.start,n.init.end)+')').runInNewContext(scope);
 await save({preventDefault(){}});const key=scope.pendingCreate.key;
 scope.apiClient.post=async()=>{throw {response:{status}}};await save({preventDefault(){}});
 assert.equal(scope.pendingCreate?.key,key,'A rate limit or auth failure must not turn an unknown completed operation into a new create');
});


test('real save writes the operation identity locally before dispatching the POST',async()=>{
 const scope=scopeFor();scope.storageKey='saqbol.bank.draft.123456';scope.dirty=true;
 Object.assign(scope.draft,{topic:'Artificial SQL',text:'Artificial before-dispatch check'});scope.draft.choices.forEach((o,i)=>{o.text='Artificial '+i;o.is_correct=i===0});
 let dispatched=false;scope.apiClient.post=async(path,body,config)=>{
  const stored=restoreDraft(scope.browserDraftStorage,scope.storageKey);
  assert.equal(stored._pendingCreate.key,config.headers['Idempotency-Key']);assert.deepEqual(stored._pendingCreate.body,body);dispatched=true;
  return {data:{...body,id:95,revision:1}};
 };
 const n=nodes.find(n=>n.type==='VariableDeclarator'&&n.id?.name==='save');await new Script('('+source.slice(n.init.start,n.init.end)+')').runInNewContext(scope)({preventDefault(){}});
 assert.equal(dispatched,true);assert.equal(scope.draft.id,95);
});
