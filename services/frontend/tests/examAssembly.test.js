import test from 'node:test';
import assert from 'node:assert/strict';
import {addQuestions,moveQuestion,grouped,assemblyPayload,restoreAssembly} from '../src/question-bank/assembly.js';
import {assemblyCopy} from '../src/question-bank/assemblyCopy.js';
const q=(id,subject='first_subject')=>({id,revision:1,subject,usage:'exam',language:'kk',text:'Artificial',choices:[]});
test('assembly admits exam/shared questions only and refuses overfilled sections',()=>{
 const current=Array.from({length:30},(_,i)=>q(i+1));assert.throws(()=>addQuestions(current,[q(31)],'kk'),/count/);
 assert.equal(addQuestions(current,[q(1)],'kk').length,30);
 assert.throws(()=>addQuestions([],[{...q(1),usage:'training'}],'kk'),/ineligible/);
 assert.throws(()=>addQuestions([],[{...q(1),language:'ru'}],'kk'),/ineligible/);
 assert.equal(addQuestions([],[{...q(1),usage:'both'}],'kk').length,1);
});
test('order changes inside subject only; payload groups exactly and sends references without client keys',()=>{
 const current=[q(1),q(2),q(3,'second_subject')];const moved=moveQuestion(current,2,-1);assert.deepEqual(moved.map(x=>x.id),[2,1,3]);assert.equal(moveQuestion(current,2,1),current);
 const body=assemblyPayload('Artificial','kk',[q(3,'second_subject'),q(2),q(1)],'request');assert.deepEqual(body.questions,[{id:2,revision:1},{id:1,revision:1},{id:3,revision:1}]);assert.equal('choices' in body.questions[0],false);assert.deepEqual(current.map(x=>x.id),[1,2,3]);
});
test('session recovery is author scoped and retains a pending request identity',()=>{
 const state={title:'Artificial',language:'kk',items:[q(1)],pending:{request_id:'same-retry-id'}};const map=new Map([['author-1',JSON.stringify(state)]]);const storage={getItem:key=>map.get(key)||null};assert.deepEqual(restoreAssembly(storage,'author-1'),state);assert.equal(restoreAssembly(storage,'author-2'),null);
});
test('assembly copy has complete translations',()=>{for(const language of ['kk','en'])assert.deepEqual(Object.keys(assemblyCopy(language)).sort(),Object.keys(assemblyCopy('ru')).sort())});

test('actual open/new handlers cannot run before session restoration has completed',async()=>{
 const {readFileSync}=await import('node:fs');const {parse}=await import('@babel/parser');const {Script}=await import('node:vm');
 const source=readFileSync(new URL('../src/question-bank/ExamDraftPage.jsx',import.meta.url),'utf8');const functions={};
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&['fresh','open'].includes(n.id?.name))functions[n.id.name]=n;for(const [k,v] of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}}
 walk(parse(source,{sourceType:'module',plugins:['jsx']}));
 for(const name of ['fresh','open']){const n=functions[name];assert.ok(n);const fn=new Script('('+source.slice(n.start,n.end)+')').runInNewContext({key:null,saving:false,pending:null});await fn(1)}
});
