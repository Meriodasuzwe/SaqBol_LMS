import test from 'node:test';
import assert from 'node:assert/strict';
import {page,memory} from './quizSubmissionHarness.mjs';
const plain=value=>JSON.parse(JSON.stringify(value));

test('QuizPage draft: selections before Finish survive page recreation without sending a submission',async()=>{
    const storage=memory(),first=page(storage,async()=>assert.fail('No POST before Finish'));
    await first.load();first.answer(811,821);first.answer(812,831);first.answer(812,832);
    const second=page(storage,async()=>assert.fail('Restore must not POST'));await second.load();
    assert.deepEqual(plain(second.bindings.selectedAnswers),{811:[821],812:[831,832]});
    assert.equal(second.bindings.submissionRef.current,null);
    assert.equal(second.bindings.submissionStatus,'idle');
    assert.equal(second.requests.length,0);
    assert.equal(second.bindings.startTimeRef.current,first.bindings.startTimeRef.current);
    assert.equal(second.bindings.cheatWarningsRef.current,2);
});

test('QuizPage draft: navigation and two warnings survive reload; the third still forces the frozen submission',async()=>{
    const storage=memory(),first=page(storage,async()=>{throw new Error('Artificial lost response')});
    await first.load();first.bindings.cheatWarningsRef.current=0;
    first.answer(811,821);first.navigate(1);first.visibility();first.visibility();
    const second=page(storage,async()=>{throw new Error('Artificial lost response')});await second.load();
    assert.equal(second.bindings.currentIndex,1);assert.equal(second.bindings.cheatWarningsRef.current,2);
    second.visibility();
    assert.equal(second.requests.length,1);
    assert.equal(second.bindings.cheatWarningsRef.current,3);
    const third=page(storage,async()=>{throw new Error('Artificial lost response')});await third.load();
    assert.equal(third.bindings.submissionStatus,'retry');
    assert.equal(third.bindings.cheatWarningsRef.current,3);
    third.answer(811,822);third.submit();
    assert.deepEqual(third.requests[0],second.requests[0]);
});
test('QuizPage draft: another account, lesson or quiz cannot receive selections',async()=>{
    const storage=memory(),first=page(storage,async()=>assert.fail('No POST'));
    await first.load();first.answer(811,821);
    for(const scope of [{ownerId:992},{lessonId:'903'},{quizId:802}]){
        const other=page(storage,async()=>assert.fail('No POST'),scope);await other.load();
        assert.deepEqual(plain(other.bindings.selectedAnswers),{});
    }
});
test('QuizPage draft: changed visible content blocks restoration until explicit reset',async()=>{
    const storage=memory(),first=page(storage,async()=>assert.fail('No POST'));
    await first.load();first.answer(811,821);
    const original=structuredClone(first.bindings.quiz);original.questions[0].text='Changed artificial question';
    const changed=page(storage,async()=>assert.fail('Must not submit old selections'),{get:async path=>({data:path==='users/me/'?{id:991}:[original]})});
    await changed.load();assert.equal(changed.bindings.recoveryStatus,'draft-blocked');
    changed.answer(811,822);changed.submit();assert.equal(changed.requests.length,0);
    assert.deepEqual(plain(changed.bindings.selectedAnswers),{});
    changed.restart();assert.equal(changed.bindings.recoveryStatus,'none');
    changed.answer(811,822);
    const restored=page(storage,async()=>assert.fail('No automatic POST'),{get:async path=>({data:path==='users/me/'?{id:991}:[original]})});
    await restored.load();assert.deepEqual(plain(restored.bindings.selectedAnswers),{811:[822]});
});
test('QuizPage draft: same IDs with changed options or question order are not silently restored',async()=>{
    for(const change of [
        quiz=>{quiz.questions[0].choices[0].text='Changed option'},
        quiz=>{quiz.questions.reverse()},
        quiz=>{quiz.questions[0].choices.pop()},
    ]){
        const storage=memory(),first=page(storage,async()=>assert.fail('No POST'));await first.load();first.answer(811,821);
        const quiz=structuredClone(first.bindings.quiz);change(quiz);
        const second=page(storage,async()=>assert.fail('No POST'),{get:async path=>({data:path==='users/me/'?{id:991}:[quiz]})});
        await second.load();assert.equal(second.bindings.recoveryStatus,'draft-blocked');
    }
});
test('QuizPage draft: frozen request takes precedence over an older editable copy',async()=>{
    const storage=memory(),first=page(storage,async()=>{throw new Error('Artificial lost response')});
    await first.load();first.answer(811,821);
    const key='saqbol.quiz.draft.v1.991.902.801',old=storage.getItem(key);
    first.submit();assert.equal(storage.getItem(key),null);
    storage.setItem(key,old);
    const second=page(storage,async()=>{throw new Error('Artificial lost response')});await second.load();
    assert.equal(second.bindings.submissionStatus,'retry');second.answer(811,822);second.submit();
    assert.deepEqual(second.requests[0],first.requests[0]);
});
test('QuizPage draft: confirmed result and explicit restart clear both copies; restart changes identity',async()=>{
    const storage=memory(),first=page(storage,async()=>({data:{id:9906,score:100}}));
    await first.load();first.answer(811,821);
    const key='saqbol.quiz.draft.v1.991.902.801',old=JSON.parse(storage.getItem(key));
    first.restart();assert.equal(storage.getItem(key),null);
    first.answer(811,821);const fresh=JSON.parse(storage.getItem(key));assert.notEqual(old.draftId,fresh.draftId);
    first.submit();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(first.requests[0].payload.submission_id,fresh.draftId);
    assert.equal(storage.getItem(key),null);assert.equal(storage.getItem('saqbol.quiz.submit.v1.991.902.801'),null);
});
test('QuizPage draft: blocked writes show an error without pretending to have a browser backup',async()=>{
    const storage={getItem:()=>null,setItem:()=>{throw new Error('Artificial quota')},removeItem:()=>{}};
    const first=page(storage,async()=>assert.fail('No POST'));await first.load();first.answer(811,821);
    assert.equal(first.bindings.recoveryStatus,'error');assert.deepEqual(plain(first.bindings.selectedAnswers),{811:[821]});
});
test('QuizPage draft: corrupt copy blocks new writes and failed GET does not remove the old copy',async()=>{
    const storage=memory(),first=page(storage,async()=>assert.fail('No POST'));await first.load();first.answer(811,821);
    const key='saqbol.quiz.draft.v1.991.902.801',saved=storage.getItem(key);
    const failed=page(storage,async()=>assert.fail('No POST'),{get:async()=>{throw new Error('Artificial offline')}});
    await failed.load();assert.equal(storage.getItem(key),saved);
    storage.setItem(key,'{corrupt');const second=page(storage,async()=>assert.fail('No POST'));await second.load();
    assert.equal(second.bindings.recoveryStatus,'draft-blocked');
});
