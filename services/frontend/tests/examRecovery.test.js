import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamSession} from '../src/exams/examSession.js';
const clock=Date.parse('2026-11-25T10:00:00Z');
const clone=v=>structuredClone(v);
const memory=()=>{const records=new Map();return {getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)}};
function fixture(){return {id:'artificial-attempt',status:'active',revision:0,server_time:new Date(clock).toISOString(),deadline:new Date(clock+600000).toISOString(),sections:[{id:'first_subject',response_type:'single',questions:[{id:101,choices:[{id:11},{id:12}]}]},{id:'second_subject',response_type:'multiple',questions:[{id:201,choices:[{id:31},{id:32},{id:33}]}]}],answers:[{question_id:101,choice_ids:[]},{question_id:201,choice_ids:[]}],flagged_question_ids:[],last_question_by_section:{first_subject:101,second_subject:201}}}
function backend(){let data=fixture(),receipt=null;const calls=[],mode={};return {calls,mode,get data(){return data},set data(v){data=v},api:{get:async()=>{if(mode.offline)throw new Error('Artificial offline');return {data:clone(data)}},patch:async(path,body)=>{calls.push(clone(body));if(mode.offline)throw new Error('Artificial offline');if(receipt?.body.request_id===body.request_id)return {data:clone(receipt.data)};if(body.revision!==data.revision)throw {response:{status:409,data:{code:'revision_conflict'}}};data={...data,revision:data.revision+1,answers:clone(body.answers),flagged_question_ids:clone(body.flagged_question_ids),last_question_by_section:clone(body.last_question_by_section)};receipt={body:clone(body),data:clone(data)};if(mode.loseResponse)throw new Error('Artificial response lost after commit');return {data:clone(data)}}}}
}
const client=(server,storage,owner=123456,id=server.data.id)=>createExamSession({api:server.api,attemptId:id,now:()=>clock,recovery:{storage,getOwnerId:async()=>owner}});

test('exam recovery: last unsent multi-selection and flags survive page recreation before autosave',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(201,[31,33]);first.toggleFlag(201);await first.dispose();
 const second=client(server,storage);await second.load();assert.deepEqual(second.getSnapshot().answers[201],[31,33]);assert.deepEqual(second.getSnapshot().flaggedQuestionIds,[201]);assert.equal(second.getSnapshot().hasUnsentChanges,true);assert.equal(second.getSnapshot().saveStatus,'unsaved');assert.equal(server.calls.length,0);
 await second.flush();assert.deepEqual(server.data.answers[1].choice_ids,[31,33]);assert.equal(second.getSnapshot().hasUnsentChanges,false);
});

test('exam recovery: lost save acknowledgement replays the original UUID before newer selections',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(201,[31]);server.mode.loseResponse=true;await first.save();first.setAnswer(201,[31,33]);await first.dispose();
 const original=clone(server.calls[0]);server.mode.loseResponse=false;const second=client(server,storage);await second.load();assert.deepEqual(second.getSnapshot().answers[201],[31,33]);await second.flush();
 assert.deepEqual(server.calls[1],original);assert.notEqual(server.calls[2].request_id,original.request_id);assert.equal(server.calls[2].revision,1);assert.deepEqual(server.data.answers[1].choice_ids,[31,33]);
});

test('exam recovery: newer server revision freezes the local copy instead of silently overwriting',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();server.data={...server.data,revision:1,answers:[{question_id:101,choice_ids:[12]},{question_id:201,choice_ids:[]}]};
 const second=client(server,storage);await second.load();assert.equal(second.getSnapshot().saveStatus,'conflict');assert.deepEqual(second.getSnapshot().answers[101],[11]);assert.equal(await second.flush(),false);assert.equal(server.calls.length,0);
});

test('exam recovery: another account never receives the old local selection',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();const other=client(server,storage,987654);await other.load();assert.deepEqual(other.getSnapshot().answers[101],[]);assert.equal(other.getSnapshot().hasUnsentChanges,false);
});

test('exam recovery: a failed load keeps the browser copy until an authorized retry succeeds',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();
 server.mode.offline=true;const second=client(server,storage);assert.equal(await second.load(),false);assert.equal(second.getSnapshot().attempt,null);
 server.mode.offline=false;await second.load();assert.deepEqual(second.getSnapshot().answers[101],[11]);
});
test('exam recovery: completed server attempt wins and removes stale local answers',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();
 server.data={...server.data,status:'completed',completion_reason:'deadline'};const second=client(server,storage);await second.load();
 assert.deepEqual(second.getSnapshot().answers[101],[]);assert.equal(second.getSnapshot().editable,false);assert.equal(await second.flush(),false);assert.equal(server.calls.length,0);
 server.data=fixture();const third=client(server,storage);await third.load();assert.equal(third.getSnapshot().hasUnsentChanges,false);
});
test('exam recovery: expired active response cannot restore or send local selections',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();
 server.data={...server.data,deadline:new Date(clock-1000).toISOString()};const second=client(server,storage);await second.load();
 assert.equal(second.getSnapshot().deadlineReached,true);assert.deepEqual(second.getSnapshot().answers[101],[]);assert.equal(await second.flush(),false);assert.equal(server.calls.length,0);
});
test('exam recovery: blocked browser storage is visible without claiming server save',async()=>{
 const server=backend(),storage={getItem:()=>null,setItem:()=>{throw new Error('Artificial quota')},removeItem:()=>{}};const first=client(server,storage);await first.load();first.setAnswer(101,[11]);
 assert.equal(first.getSnapshot().localBackup,'error');assert.equal(first.getSnapshot().saveStatus,'unsaved');assert.deepEqual(first.getSnapshot().answers[101],[11]);await first.flush();assert.equal(first.getSnapshot().saveStatus,'saved');
});
test('exam recovery: corrupted or foreign option IDs are never replayed',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();
 const key='saqbol.exam.answers.v1.123456.artificial-attempt';const value=JSON.parse(storage.getItem(key));value.answers[101]=[999999];storage.setItem(key,JSON.stringify(value));
 const second=client(server,storage);await second.load();assert.equal(second.getSnapshot().localBackup,'error');assert.deepEqual(second.getSnapshot().answers[101],[]);await second.flush();assert.equal(server.calls.length,0);
});
test('exam recovery: explicit server reload discards local copy only after successful read',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);server.data={...server.data,revision:1};await first.dispose();
 const second=client(server,storage);await second.load();server.mode.offline=true;assert.equal(await second.reload(),false);assert.deepEqual(second.getSnapshot().answers[101],[11]);
 server.mode.offline=false;assert.equal(await second.reload(),true);assert.deepEqual(second.getSnapshot().answers[101],[]);assert.equal(second.getSnapshot().hasUnsentChanges,false);
});
test('exam recovery: uncertain finish survives reload without automatic submission or editable answers',async()=>{
 const server=backend(),storage=memory();const posts=[];server.api.post=async(path,body)=>{posts.push(clone(body));throw new Error('Artificial lost finish')};
 const first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.finish();await first.dispose();
 const second=client(server,storage);await second.load();assert.equal(second.getSnapshot().finishUncertain,true);assert.equal(second.getSnapshot().editable,false);assert.equal(await second.flush(),false);assert.equal(posts.length,1);
 await second.retryFinish();assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);
});
test('exam recovery: same browser copy is persisted before the PATCH is dispatched',async()=>{
 const server=backend(),storage=memory(),patch=server.api.patch;server.api.patch=async(path,body)=>{
 const value=JSON.parse(storage.getItem('saqbol.exam.answers.v1.123456.artificial-attempt'));assert.deepEqual(value.pendingWrite.payload,body);return patch(path,body);
 };const first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.flush();assert.equal(first.getSnapshot().saveStatus,'saved');
});

test('exam recovery: a different attempt does not inherit a browser draft',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(101,[11]);await first.dispose();
 server.data={...fixture(),id:'another-artificial-attempt'};
 const second=client(server,storage);await second.load();assert.deepEqual(second.getSnapshot().answers[101],[]);assert.equal(second.getSnapshot().hasUnsentChanges,false);
});
test('exam recovery: failed account verification never reads a local answer copy',async()=>{
 const server=backend();let reads=0;const storage={getItem:()=>{reads++;return null}};
 const session=createExamSession({api:server.api,attemptId:server.data.id,now:()=>clock,recovery:{storage,getOwnerId:async()=>{throw new Error('Artificial unauthorized account')}}});
 assert.equal(await session.load(),false);assert.equal(reads,0);assert.equal(session.getSnapshot().attempt,null);
});
test('exam recovery: an earlier acknowledgement never deletes newer local edits',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();
 let resolve;const patch=server.api.patch;server.api.patch=(path,body)=>new Promise(done=>{resolve=async()=>done(await patch(path,body))});
 first.setAnswer(201,[31]);const flight=first.save();first.setAnswer(201,[31,33]);await resolve();await flight;await first.dispose();
 server.api.patch=patch;const second=client(server,storage);await second.load();assert.deepEqual(second.getSnapshot().answers[201],[31,33]);await second.flush();assert.deepEqual(server.data.answers[1].choice_ids,[31,33]);
});
test('exam recovery: local copy contains identifiers and requests, never question text or timing authority',async()=>{
 const server=backend(),storage=memory(),first=client(server,storage);await first.load();first.setAnswer(201,[31,33]);
 const value=JSON.parse(storage.getItem('saqbol.exam.answers.v1.123456.artificial-attempt'));
 assert.deepEqual(Object.keys(value).sort(),['schema','attemptId','revision','answers','flags','positions','localVersion','acknowledgedVersion','pendingWrite','pendingFinish'].sort());
 assert.equal('deadline' in value,false);assert.equal('sections' in value,false);await first.flush();
 assert.equal(storage.getItem('saqbol.exam.answers.v1.123456.artificial-attempt'),null);
});
