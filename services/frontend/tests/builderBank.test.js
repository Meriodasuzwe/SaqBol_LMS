import test from 'node:test';
import assert from 'node:assert/strict';
import {bankToBuilder,appendBankQuestions,pickerCopy} from '../src/question-bank/builderBank.js';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {parse} from '@babel/parser';
const item={id:123,usage:'both',subject:'second_subject',topic:'SQL',text:'  SELECT 1;\n',explanation:'  Explain\n',choices:Array.from({length:8},(_,i)=>({id:'choice-'+i,text:'  Option '+i+'\n',is_correct:[0,2,7].includes(i)}))};
test('bank conversion preserves all eight options, key order, topic and code whitespace',()=>{
 const copy=bankToBuilder(item);assert.equal(copy.question,item.text);assert.deepEqual(copy.options,item.choices.map(c=>c.text));assert.deepEqual(copy.correct_option_index,[0,2,7]);assert.equal(copy.explanation,item.explanation);assert.equal(copy.topic,'SQL');
 copy.options[0]='local edit';assert.equal(item.choices[0].text,'  Option 0\n');
 assert.throws(()=>bankToBuilder({...item,usage:'exam'}));
});
test('adding selected items appends to manual questions without duplicates in the draft',()=>{
 const original=[{question:'Manual'}];const copied=appendBankQuestions(original,[item,item]);assert.equal(copied.length,2);assert.equal(appendBankQuestions(copied,[item]).length,2);assert.equal(original.length,1);
});
const source=readFileSync(new URL('../src/CourseBuilder/CourseBuilder.jsx',import.meta.url),'utf8');
let callback;
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='payloadQuestions')callback=n.init.arguments[0];for(const [k,v] of Object.entries(n)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}}
visit(parse(source,{sourceType:'module',plugins:['jsx']}));
test('real builder save mapping preserves copied metadata, whitespace and all selected positions',()=>{
 assert.ok(callback);const fn=new Script('('+source.slice(callback.start,callback.end)+')').runInNewContext({t:key=>key});
 const value=JSON.parse(JSON.stringify(fn(bankToBuilder(item),0)));
 assert.equal(value.question,item.text);assert.deepEqual(value.options,item.choices.map(c=>c.text));assert.deepEqual(value.correct_index,[0,2,7]);assert.equal(value.topic,'SQL');assert.equal(value.kt_subject,'second_subject');assert.equal(value.explanation,item.explanation);
});
test('picker interface has matching localised keys',()=>{for(const lang of ['kk','en'])assert.deepEqual(Object.keys(pickerCopy(lang)).sort(),Object.keys(pickerCopy('ru')).sort())});
