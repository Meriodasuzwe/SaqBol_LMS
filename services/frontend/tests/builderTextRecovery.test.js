import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextStepRecovery} from '../src/CourseBuilder/textStepRecovery.js';
const step={id:905,lesson:902,step_type:'text',title:'Artificial title',content:'<p>Artificial server text</p>',scenario_data:{},edit_version:'1'.repeat(64)};
const memory=()=>{const records=new Map();return {getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)}};
function fixture(storage=memory(),author=999998,courseId=901,original=step){
 let server=structuredClone(original),writes=0,current=null;
 const api={get:async path=>({data:structuredClone(path==='users/me/'?{id:author}:server)})};
 const session=createTextStepRecovery({api,storage,courseId,stepId:original.id,onStep:value=>{current=value},onState(){},onSave:async()=>{writes++;server=structuredClone(current);return structuredClone(server)}});
 return {session,api,storage,get current(){return current},get writes(){return writes},get server(){return server},setServer:value=>{server=structuredClone(value)}};
}

test('text step: changed title and rich text survive component disposal and page recreation',async()=>{
 const first=fixture();await first.session.open();const changed={...step,title:'Artificial unsaved title',content:'<h2>Искусственный текст</h2><pre><code>SELECT title\nFROM demo_books;</code></pre>'};
 first.session.edit(changed);assert.equal(first.session.getState().dirty,true);assert.equal(first.writes,0);first.session.dispose();
 const next=fixture(first.storage);await next.session.open();assert.equal(next.session.getState().phase,'recover');assert.equal(next.current.content,step.content);
 next.session.restore();assert.deepEqual(next.current,changed);assert.equal(next.writes,0);
});

test('text step: another author, course or step never receives the local draft',async()=>{
 const first=fixture();await first.session.open();first.session.edit({...step,content:'<p>Artificial private draft</p>'});
 for(const other of [fixture(first.storage,777777),fixture(first.storage,999998,902),fixture(first.storage,999998,901,{...step,id:906})]){await other.session.open();assert.equal(other.session.getState().phase,'ready');assert.equal(other.current.content,step.content)}
 const original=fixture(first.storage);await original.session.open();assert.equal(original.session.getState().phase,'recover');
});

test('text step: load failure does not erase the existing draft or enable a blank editor',async()=>{
 const first=fixture();await first.session.open();first.session.edit({...step,content:'<p>Artificial offline draft</p>'});
 const next=fixture(first.storage);next.api.get=async()=>{throw new Error('Artificial offline')};await next.session.open();assert.equal(next.current,null);assert.equal(next.session.getState().phase,'error');
 const recovered=fixture(first.storage);await recovered.session.open();assert.equal(recovered.session.getState().draft.content,'<p>Artificial offline draft</p>');
});

test('text step: failed save retains draft and retry clears it only after confirmed save',async()=>{
 const f=fixture();await f.session.open();f.session.edit({...step,content:'<p>Artificial retained draft</p>'});f.session.restore();
 const originalGet=f.api.get;f.api.get=async()=>{throw new Error('Artificial disconnected')};await f.session.save();assert.equal(f.writes,0);assert.equal(f.session.getState().dirty,true);
 f.api.get=originalGet;await f.session.save();assert.equal(f.writes,1);assert.equal(f.server.content,'<p>Artificial retained draft</p>');assert.equal(f.session.getState().dirty,false);
 const reopened=fixture(f.storage,999998,901,f.server);await reopened.session.open();assert.equal(reopened.session.getState().phase,'ready');
});

test('text step: changed server content blocks restore and no save callback runs',async()=>{
 const f=fixture();await f.session.open();f.session.edit({...step,content:'<p>Artificial local</p>'});
 const next=fixture(f.storage,999998,901,{...step,content:'<p>Artificial newer server</p>'});await next.session.open();assert.equal(next.session.getState().phase,'conflict');
 next.session.restore();await next.session.save();assert.equal(next.writes,0);assert.equal(next.current.content,'<p>Artificial newer server</p>');assert.equal(next.session.getState().draft.content,'<p>Artificial local</p>');
});

test('text step: preflight detects a server edit made while the editor was open',async()=>{
 const f=fixture();await f.session.open();f.session.edit({...step,content:'<p>Artificial local</p>'});f.setServer({...step,content:'<p>Artificial external edit</p>'});await f.session.save();
 assert.equal(f.session.getState().phase,'conflict');assert.equal(f.writes,0);assert.equal(f.server.content,'<p>Artificial external edit</p>');
});

test('text step: confirmed read after lost save acknowledgement clears the stale copy without another write',async()=>{
 const f=fixture();await f.session.open();const changed={...step,content:'<p>Artificial committed request</p>'};f.session.edit(changed);
 const next=fixture(f.storage,999998,901,changed);await next.session.open();assert.equal(next.session.getState().phase,'ready');assert.equal(next.session.getState().dirty,false);assert.equal(next.writes,0);
});

test('text step: blocked storage warns but preserves edits in memory and allows explicit server save',async()=>{
 const f=fixture({getItem:()=>null,setItem(){throw new Error('Artificial quota')},removeItem(){throw new Error('Artificial blocked storage')}});await f.session.open();f.session.edit({...step,content:'<p>Artificial memory text</p>'});
 assert.equal(f.session.getState().storageError,true);assert.equal(f.current.content,'<p>Artificial memory text</p>');await f.session.save();assert.equal(f.writes,1);
});

test('text step: late load response cannot replace a different selected step',async()=>{
 const f=fixture();let resolve;f.api.get=path=>path==='users/me/'?Promise.resolve({data:{id:999998}}):new Promise(r=>{resolve=r});const pending=f.session.open();f.session.dispose();resolve({data:step});await pending;assert.equal(f.current,null);
});

test('text step: explicit keep-server action clears only the selected local draft',async()=>{
 const f=fixture();await f.session.open();f.session.edit({...step,content:'<p>Artificial unwanted draft</p>'});
 const next=fixture(f.storage);await next.session.open();next.session.discard();assert.equal(next.current.content,step.content);const reopened=fixture(f.storage);await reopened.session.open();assert.equal(reopened.session.getState().phase,'ready');
});


test('text step: server whitespace normalization confirms a save without trimming code inside HTML',async()=>{
 const f=fixture();await f.session.open();f.session.edit({...step,title:'  Artificial title  ',content:'  <pre>  SELECT 1;\n  </pre>  '});
 f.setServer({...step,title:'Artificial title',content:'<pre>  SELECT 1;\n  </pre>'});await f.session.save();
 assert.equal(f.session.getState().dirty,false);assert.equal(f.writes,0);assert.equal(f.current.content,'<pre>  SELECT 1;\n  </pre>');
});

test('text step: repeated clicks dispatch a single save and lock edits until confirmation',async()=>{
 const storage=memory();let current,resolveWrite,writes=0;
 const session=createTextStepRecovery({api:{get:async path=>({data:path==='users/me/'?{id:999998}:step})},storage,courseId:901,stepId:905,onStep:s=>{current=s},onState(){},onSave:()=>{writes++;return new Promise(r=>{resolveWrite=r})}});
 await session.open();session.edit({...step,content:'<p>Artificial once</p>'});const saving=session.save();await new Promise(r=>setImmediate(r));await session.save();session.edit({...step,content:'Must not replace an inflight draft'});
 assert.equal(writes,1);assert.equal(current.content,'<p>Artificial once</p>');resolveWrite(current);await saving;assert.equal(session.getState().dirty,false);
});


test('text step: compare-and-set version reaches the save callback and atomic conflict keeps the local text',async()=>{
 const storage=memory();let current,received;
 const session=createTextStepRecovery({api:{get:async path=>({data:path==='users/me/'?{id:999998}:step})},storage,courseId:901,stepId:905,onStep:s=>{current=s},onState(){},onSave:async options=>{received=options;throw {response:{status:409}}}});
 await session.open();session.edit({...step,content:'<p>Artificial losing edit</p>'});await session.save();
 assert.deepEqual(received,{expectedVersion:step.edit_version});assert.equal(session.getState().phase,'conflict');assert.equal(session.getState().draft.content,'<p>Artificial losing edit</p>');
 const next=fixture(storage,999998,901,{...step,content:'<p>Artificial winning edit</p>',edit_version:'2'.repeat(64)});await next.session.open();assert.equal(next.session.getState().phase,'conflict');
});

test('text step: missing server support blocks an unguarded write without deleting the local copy',async()=>{
 const old={...step};delete old.edit_version;const f=fixture(memory(),999998,901,old);await f.session.open();f.session.edit({...old,content:'<p>Artificial old backend</p>'});await f.session.save();
 assert.equal(f.writes,0);assert.equal(f.session.getState().dirty,true);assert.equal(f.session.getState().error,'save');
});
