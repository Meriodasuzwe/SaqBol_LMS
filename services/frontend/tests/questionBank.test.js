import test from 'node:test';
import assert from 'node:assert/strict';
import {newDraft,newChoice,selectCorrect,payload,validDraft,restoreDraft,storeDraft,creationRequest} from '../src/question-bank/draft.js';
import {bankCopy} from '../src/question-bank/copy.js';
test('single choice replaces the old key while multiple choice keeps selected keys',()=>{
 let d=newDraft(); d=selectCorrect(d,d.choices[0].id,true);d=selectCorrect(d,d.choices[1].id,true);
 assert.deepEqual(d.choices.map(c=>c.is_correct),[false,true]);
 d.subject='second_subject';d=selectCorrect(d,d.choices[0].id,true);assert.deepEqual(d.choices.map(c=>c.is_correct),[true,true]);
});
test('draft validation requires content and key and follows subject cardinality',()=>{
 const d=newDraft();assert.equal(validDraft(d),false);d.topic='SQL';d.text='Question';d.choices.forEach(c=>c.text='Answer');d.choices[0].is_correct=true;assert.equal(validDraft(d),true);
 d.choices[1].is_correct=true;assert.equal(validDraft(d),false);d.subject='second_subject';assert.equal(validDraft(d),true);
 d.choices.push({...newChoice(),text:'Third',is_correct:true},{...newChoice(),text:'Fourth',is_correct:true});assert.equal(validDraft(d),false);
});
test('request preserves exact text and revision but never copies response-only fields',()=>{
 const d={...newDraft(),id:9,revision:2,updated_at:'ignored',owner:5,text:'  SELECT 1;\n'};
 assert.equal(payload(d).text,d.text);assert.equal(payload(d).revision,2);assert.equal('owner' in payload(d),false);assert.equal('id' in payload(d),false);assert.equal('revision' in payload(newDraft()),false);
});
test('all interface keys are localised for the existing three languages',()=>{
 for(const lang of ['ru','kk','en'])assert.deepEqual(Object.keys(bankCopy(lang)).sort(),Object.keys(bankCopy('ru')).sort());
 assert.notEqual(bankCopy('ru').title,bankCopy('kk').title);
});

test('unfinished draft recovers only under its author key and clears after save',()=>{
 const records=new Map();const storage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 const d=newDraft();d.text='Unfinished question';storeDraft(storage,'author-1',d,true);
 assert.deepEqual(restoreDraft(storage,'author-1'),d);assert.equal(restoreDraft(storage,'author-2'),null);
 storeDraft(storage,'author-1',d,false);assert.equal(restoreDraft(storage,'author-1'),null);
 storage.setItem('bad','{"choices":null}');assert.equal(restoreDraft(storage,'bad'),null);
});

test('new question retry reuses the frozen body and key while a new action gets a new key',()=>{
 const draft=newDraft();draft.text='Original';const request=creationRequest(draft);draft.text='Changed';
 assert.equal(creationRequest(draft,request),request);assert.equal(request.body.text,'Original');
 assert.notEqual(creationRequest(draft).key,request.key);
});

test('real bank save handler retries the original request after a lost response',async()=>{
 const {readFileSync}=await import('node:fs');const {parse}=await import('@babel/parser');const {Script}=await import('node:vm');
 const source=readFileSync(new URL('../src/question-bank/QuestionBankPage.jsx',import.meta.url),'utf8');let node;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='save')node=n.init;for(const [k,v] of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}walk(parse(source,{sourceType:'module',plugins:['jsx']}));assert.ok(node);
 const d=newDraft();d.topic='SQL';d.text='Original question';d.choices.forEach(c=>c.text='Option');d.choices[0].is_correct=true;
 const calls=[];const scope={draft:d,storageKey:"saqbol.bank.draft.123456",pendingCreate:null,inflight:{current:false},storeDraft,browserDraftStorage:{setItem(){},removeItem(){}},setStorageProblem:()=>{},validDraft,creationRequest,payload,c:{saved:'Saved',pendingCreate:'Retry',saveError:'Error'},setMessage:()=>{},setError:()=>{},setSaving:()=>{},setDirty:()=>{},setReload:()=>{}};
 scope.setPendingCreate=value=>{scope.pendingCreate=value};scope.setDraft=value=>{scope.draft=value};
 scope.apiClient={post:async(path,body,config)=>{calls.push(structuredClone({path,body,config}));if(calls.length===1)throw new Error('Artificial lost response');return {data:{...body,id:42,revision:1}}}};
 const save=new Script('('+source.slice(node.start,node.end)+')').runInNewContext(scope);
 await save({preventDefault(){}});assert.ok(scope.pendingCreate);assert.equal(scope.draft.id,undefined);
 scope.draft.text='Changed local text';await save({preventDefault(){}});
 assert.deepEqual(calls[0],calls[1]);assert.ok(calls[0].config.headers['Idempotency-Key']);assert.equal(calls[1].body.text,'Original question');assert.equal(scope.pendingCreate,null);assert.equal(scope.draft.id,42);
});
