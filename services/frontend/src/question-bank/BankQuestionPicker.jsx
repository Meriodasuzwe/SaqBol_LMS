import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import api from '../api';
import {ExamText} from '../exams/ExamPrimitives';
import {pickerCopy} from './builderBank';
import './bank-picker.css';

export default function BankQuestionPicker({onAdd,onClose,existingIds=[],apiClient=api,purpose='training',language=''}) {
 const {i18n}=useTranslation(),baseCopy=pickerCopy(i18n.resolvedLanguage||i18n.language);
 const exam=purpose==='exam';
 const c=exam?{...baseCopy,title:baseCopy.examTitle,notice:baseCopy.examNotice,empty:baseCopy.examEmpty}:baseCopy;
 const [filters,setFilters]=useState({search:'',subject:'',topic:''}),[inputs,setInputs]=useState({search:'',subject:'',topic:''});
 const [page,setPage]=useState(1),[reload,setReload]=useState(0),[rows,setRows]=useState([]),[next,setNext]=useState(false),[topics,setTopics]=useState({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(false),[selected,setSelected]=useState(new Map());
 const existing=new Set(existingIds);
 useEffect(()=>{let live=true;apiClient.get('/quizzes/bank/topics/').then(r=>{if(live)setTopics(r.data.topics)}).catch(()=>{});return()=>{live=false}},[apiClient]);
 useEffect(()=>{let live=true;setLoading(true);setError(false);const query=new URLSearchParams({...filters,page:String(page),...(exam?{for_exam:'true',language}:{for_training:'true'})});
  apiClient.get('/quizzes/bank/?'+query).then(r=>{if(live){setRows(r.data.results.filter(q=>(exam?['exam','both']:['training','both']).includes(q.usage)));setNext(!!r.data.next)}}).catch(()=>{if(live)setError(true)}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[filters,page,reload,apiClient,exam,language]);
 const toggle=item=>setSelected(previous=>{const result=new Map(previous);if(result.has(item.id))result.delete(item.id);else result.set(item.id,item);return result});
 return <section className="bank-picker" aria-label={c.title}>
  <div className="bank-picker-heading"><h4>{c.title}</h4><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{c.close}</button></div>
  <p>{c.notice}</p>
  <form className="bank-picker-filters" onSubmit={e=>{e.preventDefault();setFilters({...inputs});setPage(1)}}>
   <label><span>{c.search}</span><input type="search" value={inputs.search} onChange={e=>setInputs({...inputs,search:e.target.value})}/></label>
   <label><span>{c.subject}</span><select value={inputs.subject} onChange={e=>setInputs({...inputs,subject:e.target.value,topic:''})}><option value="">{c.all}</option><option value="first_subject">{c.first}</option><option value="second_subject">{c.second}</option></select></label>
   <label><span>{c.topic}</span><input value={inputs.topic} maxLength={255} list="picker-topics" onChange={e=>setInputs({...inputs,topic:e.target.value})}/><datalist id="picker-topics">{[...new Set(inputs.subject?(topics[inputs.subject]||[]):Object.values(topics).flat())].map(t=><option key={t} value={t}/>)}</datalist></label>
   <div className="bank-picker-actions"><button type="submit" className="btn btn-sm">{c.find}</button><button type="button" className="btn btn-ghost btn-sm" onClick={()=>{const blank={search:'',subject:'',topic:''};setInputs(blank);setFilters(blank);setPage(1)}}>{c.reset}</button></div>
  </form>
  <div className="bank-picker-selection"><span role="status">{c.selected}: {selected.size}</span><button type="button" disabled={!selected.size} className="btn btn-sm bank-picker-add" onClick={()=>onAdd([...selected.values()].filter(q=>!existing.has(q.id)))}>{c.add}</button></div>
  {loading?<p role="status">{c.loading}</p>:error?<div role="alert"><p>{c.error}</p><button type="button" className="btn btn-sm" onClick={()=>setReload(n=>n+1)}>{c.retry}</button></div>:rows.length===0?<p className="bank-picker-empty">{c.empty}</p>:<ul className="bank-picker-rows">{rows.map(item=><li key={item.id}>
   <label className="bank-picker-question"><input type="checkbox" disabled={existing.has(item.id)} checked={existing.has(item.id)||selected.has(item.id)} onChange={()=>toggle(item)} aria-label={c.choose+' '+item.id}/><span><strong>{item.topic}</strong><small>{item.subject==='first_subject'?c.first:c.second} · {item.language.toUpperCase()}</small><ExamText text={item.text}/></span></label>
   <details><summary>{c.details}</summary><ol type="A">{item.choices.map(option=><li key={option.id}><ExamText text={option.text}/>{option.is_correct&&<strong>{c.correct}</strong>}</li>)}</ol><ExamText text={item.explanation}/></details>
  </li>)}</ul>}
  <nav className="bank-picker-pages" aria-label={c.page}><button type="button" className="btn btn-sm" disabled={loading||page===1} onClick={()=>setPage(n=>n-1)}>{c.prev}</button><span>{c.page} {page}</span><button type="button" className="btn btn-sm" disabled={loading||!next} onClick={()=>setPage(n=>n+1)}>{c.next}</button></nav>
 </section>;
}
