// Real QuizPage handlers -> real submit endpoint -> temporary SQLite.
import assert from 'node:assert/strict';
import {page,memory,settle} from '../quizSubmissionHarness.mjs';
const port=Number(process.argv[2]||4188);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
const origin='http://127.0.0.1:'+port;
let token;
async function call(path,method='GET',body){
    const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();if(!response.ok)throw {response:{status:response.status,data}};
    return {data};
}
const fixture=(await call('/__exam_preview__/bootstrap')).data;
assert.equal(fixture.isolated,true);assert.equal(fixture.quiz_id,904);
const before=(await call('/__exam_preview__/state')).data;assert.equal(before.database,'SQLite :memory:');
token=(await call('/api/users/login/','POST',{username:fixture.login.username,password:fixture.login.password})).data.access;
const get=path=>call('/api/'+path),transport=(path,payload)=>call('/api/'+path,'POST',payload);
const options={lessonId:'902',quizId:904,get}, storage=memory();
async function drain(run){for(let n=0;n<100&&run.bindings.submissionStatus==='sending';n++)await new Promise(resolve=>setTimeout(resolve,20));assert.notEqual(run.bindings.submissionStatus,'sending');await settle();}
let first=page(storage,transport,options);await first.load();
for(const question of first.bindings.quiz.questions)first.answer(question.id,question.choices[0].id);
const selections=JSON.parse(JSON.stringify(first.bindings.selectedAnswers));
const startedAt=first.bindings.startTimeRef.current;
const unsubmitted=(await call('/__exam_preview__/state')).data.counts;
first=page(storage,transport,options);await first.load();
assert.deepEqual(JSON.parse(JSON.stringify(first.bindings.selectedAnswers)),selections);
assert.equal(first.bindings.startTimeRef.current,startedAt);
assert.deepEqual((await call('/__exam_preview__/state')).data.counts,unsubmitted);
console.log('PASS: editable choices before Finish restore without any server result or POST');
await call('/__exam_preview__/control','POST',{command:'lose_next_finish_response'});
first.submit();await drain(first);assert.equal(first.results.length,0);
const saved=(await call('/__exam_preview__/state')).data;
assert.equal(saved.counts.results,before.counts.results+1);
let second=page(storage,transport,options);await second.load();
assert.equal(second.bindings.submissionStatus,'retry');second.submit();await drain(second);
assert.deepEqual(second.requests[0],first.requests[0]);assert.equal(second.results[0].id,saved.results.at(-1).id);
const after=(await call('/__exam_preview__/state')).data;
assert.deepEqual(after.counts,saved.counts);
assert.equal(storage.getItem('saqbol.quiz.submit.v1.'+(await get('users/me/')).data.id+'.902.904'),null);
console.log('PASS: real QuizPage submit lost response -> page recreation -> same UUID, payload and Result');
console.log('PASS: Result, QuizAttemptDetail and QuestionAnswer counts are unchanged by replay');

first=page(storage,transport,options);await first.load();
first.answer(first.bindings.quiz.questions[0].id,first.bindings.quiz.questions[0].choices[0].id);
await call('/__exam_preview__/control','POST',{command:'fail_next_finish'});
first.submit(true);await drain(first);
assert.deepEqual((await call('/__exam_preview__/state')).data.counts,after.counts);
second=page(storage,transport,options);await second.load();second.submit();await drain(second);
assert.deepEqual(second.requests[0],first.requests[0]);
assert.equal((await call('/__exam_preview__/state')).data.counts.results,after.counts.results+1);
console.log('PASS: forced incomplete submission blocked before Django survives recreation and is saved once');

const beforeWarnings=(await call('/__exam_preview__/state')).data.counts;
first=page(storage,transport,options);await first.load();first.bindings.cheatWarningsRef.current=0;
first.answer(first.bindings.quiz.questions[0].id,first.bindings.quiz.questions[0].choices[0].id);
first.navigate(1);first.visibility();first.visibility();
second=page(storage,transport,options);await second.load();
assert.equal(second.bindings.currentIndex,1);
assert.equal(second.bindings.cheatWarningsRef.current,2);
assert.equal(second.requests.length,0);
second.visibility();await drain(second);
assert.equal(second.requests.length,1);
assert.equal(second.bindings.cheatWarningsRef.current,3);
assert.equal((await call('/__exam_preview__/state')).data.counts.results,beforeWarnings.results+1);
console.log('PASS: warning count and position restore; third warning still forces real Django submission once');
