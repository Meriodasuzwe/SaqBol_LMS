import test from 'node:test';
import assert from 'node:assert/strict';
import {page, memory, settle} from './quizSubmissionHarness.mjs';
const clone = value => JSON.parse(JSON.stringify(value));

test('QuizPage: lost response and page recreation retain exact submission UUID, answer sets and elapsed time',async()=>{
    const storage=memory();
    const first=page(storage,async()=>{throw new Error('Artificial lost response')});
    await first.load();first.answer(811,821);first.answer(812,831);first.answer(812,832);first.submit();await settle();
    const original=first.requests[0];
    const second=page(storage,async()=>({data:{id:9901,score:20}}));await second.load();
    second.submit();await settle();
    assert.deepEqual(second.requests[0],original);
    assert.deepEqual(second.results,[{id:9901,score:20}]);
});

test('QuizPage: pending payload is persisted before dispatch and cleared only after confirmation',async()=>{
    const storage=memory();
    const run=page(storage,async(path,payload)=>{
        const saved=JSON.parse(storage.getItem('saqbol.quiz.submit.v1.991.902.801'));
        assert.deepEqual(saved.payload,clone(payload));
        return {data:{id:9902,score:100}};
    });
    await run.load();run.answer(811,821);run.submit();await settle();
    assert.equal(run.results.length,1);
    assert.equal(storage.getItem('saqbol.quiz.submit.v1.991.902.801'),null);
});
test('QuizPage: restored request freezes choices and preserves the original elapsed time through repeated failures',async()=>{
    const storage=memory(),lost=async()=>{throw new Error('Artificial offline')};
    const first=page(storage,lost);await first.load();first.answer(811,821);first.submit(true);await settle();
    const original=first.requests[0];
    const second=page(storage,lost);await second.load();second.answer(811,822);second.submit();await settle();second.submit(true);await settle();
    assert.deepEqual(second.requests,[original,original]);
    assert.equal(second.bindings.cheatWarningsRef.current,2);
});
test('QuizPage: another owner, lesson or quiz cannot restore the pending submission',async()=>{
    const storage=memory(),lost=async()=>{throw new Error('Artificial offline')};
    const first=page(storage,lost);await first.load();first.answer(811,821);first.submit();await settle();
    for(const scope of [{ownerId:992},{lessonId:'903'},{quizId:802}]){
        const other=page(storage,lost,scope);await other.load();
        assert.equal(other.bindings.submissionRef.current,null);
        assert.deepEqual(clone(other.bindings.selectedAnswers),{});
    }
});
test('QuizPage: definite validation rejection removes the pending copy and allows correction with a new UUID',async()=>{
    const storage=memory();
    const first=page(storage,async()=>{throw new Error('Artificial offline')});await first.load();first.answer(811,821);first.submit();await settle();
    const original=first.requests[0];
    const second=page(storage,async()=>{throw {response:{status:400,data:{error:'Artificial invalid answer'}}}});
    await second.load();second.submit();await settle();
    assert.equal(storage.getItem('saqbol.quiz.submit.v1.991.902.801'),null);
    assert.equal(second.bindings.submissionRef.current,null);
    second.answer(811,822);second.submit();await settle();
    assert.notEqual(second.requests[1].payload.submission_id,original.payload.submission_id);
});
test('QuizPage: unreadable stored submission blocks a fresh POST instead of silently duplicating it',async()=>{
    const storage=memory();storage.setItem('saqbol.quiz.submit.v1.991.902.801','{broken');
    const run=page(storage,async()=>{assert.fail('Unreadable pending copy must not create another result')});
    await run.load();assert.equal(run.bindings.recoveryStatus,'blocked');
    run.submit();await settle();assert.equal(run.requests.length,0);
});
test('QuizPage: browser write failure is visible and same-page retry retains the UUID',async()=>{
    const storage={getItem:()=>null,setItem:()=>{throw new Error('Artificial quota')},removeItem:()=>{}};
    const run=page(storage,async()=>{throw new Error('Artificial offline')});
    await run.load();run.answer(811,821);run.submit();await settle();assert.equal(run.bindings.recoveryStatus,'error');
    run.submit();await settle();assert.deepEqual(run.requests[1],run.requests[0]);
});
test('QuizPage: explicit restart clears pending request and assigns a new UUID',async()=>{
    const storage=memory(),run=page(storage,async()=>{throw new Error('Artificial offline')});
    await run.load();run.answer(811,821);run.submit();await settle();const original=run.requests[0];
    run.restart();assert.equal(storage.getItem('saqbol.quiz.submit.v1.991.902.801'),null);
    run.answer(811,821);run.submit();await settle();assert.notEqual(run.requests[1].payload.submission_id,original.payload.submission_id);
});
for(const status of [401,409,429,500]){
    test('QuizPage: HTTP '+status+' retains pending request across page recreation',async()=>{
        const storage=memory(),first=page(storage,async()=>{throw {response:{status,data:{}}}});
        await first.load();first.answer(811,821);first.submit();await settle();
        const second=page(storage,async()=>({data:{id:9903,score:20}}));await second.load();second.submit();await settle();
        assert.deepEqual(second.requests[0],first.requests[0]);
    });
}

test('QuizPage: failed reload cannot delete the existing pending submission',async()=>{
    const storage=memory(),first=page(storage,async()=>{throw new Error('Artificial offline')});
    await first.load();first.answer(811,821);first.submit();await settle();
    const pending=storage.getItem('saqbol.quiz.submit.v1.991.902.801');
    const failed=page(storage,async()=>{assert.fail('Load failed')},{get:async()=>{throw new Error('Artificial failed GET')}});
    await failed.load();assert.equal(failed.bindings.quiz,null);
    assert.equal(storage.getItem('saqbol.quiz.submit.v1.991.902.801'),pending);
    const restored=page(storage,async()=>({data:{id:9904,score:20}}));await restored.load();restored.submit();await settle();
    assert.deepEqual(restored.requests[0],first.requests[0]);
});
