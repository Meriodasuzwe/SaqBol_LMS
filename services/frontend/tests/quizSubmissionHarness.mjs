import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {parse} from '@babel/parser';
import {createQuizSubmissionRecovery} from '../src/quizSubmissionRecovery.js';

const source = readFileSync(new URL('../src/QuizPage.jsx', import.meta.url), 'utf8');
const ast = parse(source, {sourceType:'module',plugins:['jsx']});
function find(name, node=ast) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'VariableDeclarator' && node.id?.name === name) return node.init;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (!child || typeof child !== 'object') continue;
            const result = find(name,child); if(result) return result;
        }
    }
    return null;
}
const clone = value => JSON.parse(JSON.stringify(value));
export const memory = () => {const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
const quiz = {id:801,mode:'training',questions:[{id:811,choices:[{id:821},{id:822}]},{id:812,choices:[{id:831},{id:832}]}]};
export const settle = () => new Promise(resolve=>setImmediate(resolve));

export function page(storage, transport, {ownerId=991, quizId=801, lessonId='902', get}={}) {
    const requests=[],results=[];
    const bindings = {
        quiz:null, lessonId, targetQuizId:String(quizId), active:true,
        selectedAnswers:{}, selectedAnswersRef:{current:{}}, submissionRef:{current:null},
        submissionRecoveryRef:{current:null}, startTimeRef:{current:Date.now()-10000}, cheatWarningsRef:{current:2},
        recoveryStatus:'none', submissionStatus:'idle', currentResult:null, currentIndex:0, attempts:0,
        document:{hidden:true}, isKtProfile:false,
        localStorage:storage, quizSubmissionStorage:storage, createQuizSubmissionRecovery,
        crypto:{randomUUID}, Date, ktCopy:{}, console:{error(){}}, confetti(){},
        toast:{error(){},success(){},warning(){}},
        setLoading(){},setSubmissionStatus(value){bindings.submissionStatus=value},
        setQuiz(value){bindings.quiz=value},setCurrentIndex(value){bindings.currentIndex=value},
        setRecoveryStatus(value){bindings.recoveryStatus=value},setCheatWarnings(value){bindings.cheatWarningsRef.current=value},
        setSelectedAnswers(value){bindings.selectedAnswers=typeof value==='function'?value(bindings.selectedAnswers):value;bindings.selectedAnswersRef.current=bindings.selectedAnswers},
        setCurrentResult(value){bindings.currentResult=value;if(value)results.push(clone(value))},
        setAttempts(value){bindings.attempts=value},
        api:{
            get: get || (async path=>({data:path==='users/me/'?{id:ownerId}:[{...quiz,id:quizId}]})),
            post:async(path,payload)=>{requests.push({path,payload:clone(payload)});return transport(path,payload)},
        },
    };
    function handler(name){const node=find(name);assert.ok(node,name);return new Script('('+source.slice(node.start,node.end)+')').runInNewContext(bindings)}
    bindings.saveQuizDraft=handler('saveQuizDraft');
    bindings.submitQuiz=handler('submitQuiz');
    return {bindings,requests,results,visibility:handler('handleVisibilityChange'),navigate:handler('navigateQuestion'),load:handler('fetchData'),submit:handler('submitQuiz'),restart:handler('restartQuiz'),answer:handler('handleAnswer')};
}
