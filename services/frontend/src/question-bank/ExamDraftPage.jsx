import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowUp,ArrowDown,X} from 'lucide-react';
import api from '../api';
import BankQuestionPicker from './BankQuestionPicker';
import {ExamText} from '../exams/ExamPrimitives';
import {assemblyCopy} from './assemblyCopy';
import {addQuestions,moveQuestion,grouped,assemblyPayload,restoreAssembly,limits} from './assembly';
import './exam-drafts.css';

export default function ExamDraftPage({apiClient=api}){
 const {i18n}=useTranslation(),c=assemblyCopy(i18n.resolvedLanguage||i18n.language);
 const [title,setTitle]=useState(''),[language,setLanguage]=useState('kk'),[items,setItems]=useState([]),[showPicker,setShowPicker]=useState(false);
 const [saving,setSaving]=useState(false),[pending,setPending]=useState(null),[saved,setSaved]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [key,setKey]=useState(null),[initRetry,setInitRetry]=useState(0),[initError,setInitError]=useState(false);
 const [recent,setRecent]=useState([]),[page,setPage]=useState(1),[hasNext,setHasNext]=useState(false),[listLoading,setListLoading]=useState(true),[listError,setListError]=useState(false),[reload,setReload]=useState(0);
 const busy=useRef(false),locked=saving||!!pending||!!saved||!key;
 useEffect(()=>{let live=true;setInitError(false);apiClient.get('/quizzes/bank/topics/').then(r=>{if(!live)return;const storageKey='saqbol.exam.assembly.'+r.data.author_id;const restored=restoreAssembly(sessionStorage,storageKey);if(restored){setTitle(restored.title);setLanguage(restored.language);setItems(restored.items);setPending(restored.pending||null);setMessage(c.restored)}setKey(storageKey)}).catch(()=>{if(live)setInitError(true)});return()=>{live=false}},[apiClient,initRetry]);
 useEffect(()=>{if(!key)return;try{if(saved||(!title&&!items.length&&!pending))sessionStorage.removeItem(key);else sessionStorage.setItem(key,JSON.stringify({title,language,items,pending}))}catch{}},[key,title,language,items,pending,saved]);
 useEffect(()=>{let live=true;setListLoading(true);setListError(false);apiClient.get('/quizzes/exam-drafts/?page='+page).then(r=>{if(live){setRecent(r.data.results);setHasNext(!!r.data.next)}}).catch(()=>{if(live)setListError(true)}).finally(()=>{if(live)setListLoading(false)});return()=>{live=false}},[apiClient,page,reload]);
 useEffect(()=>{const guard=e=>{if(!saved&&(title||items.length||pending)){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[saved,title,items,pending]);
 const counts=Object.fromEntries(Object.keys(limits).map(s=>[s,items.filter(q=>q.subject===s).length]));
 const complete=counts.first_subject===30&&counts.second_subject===20;
 function fresh(){if(!key||saving||pending)return;if(!saved&&(title||items.length)&&!window.confirm(c.discard))return;setSaved(null);setTitle('');setItems([]);setError('');setMessage('');setShowPicker(false)}
 async function save(e){e.preventDefault();if(busy.current||saved)return;if(!title.trim()||!complete){setError(c.invalid);return}busy.current=true;setSaving(true);setError('');const body=pending||assemblyPayload(title,language,items,crypto.randomUUID());setPending(body);
  try{const result=await apiClient.post('/quizzes/exam-drafts/',body);showSaved(result.data);setReload(n=>n+1);setMessage(c.saved)}
  catch(e){const status=e.response?.status;if(status&&status<500)setPending(null);const data=e.response?.data;setError(data?Object.values(data).map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' · '):c.pending)}
  finally{busy.current=false;setSaving(false)}
 }
 function showSaved(data){setSaved(data);setPending(null);setTitle(data.title);setLanguage(data.language);setItems(data.snapshot.questions.map(q=>({...q,id:q.source_bank_id,revision:q.source_revision,language:data.language,usage:'exam'})));setShowPicker(false);setError('')}
 async function open(id){if(!key||saving||pending)return;if(!saved&&(title||items.length)&&!window.confirm(c.discard))return;setSaving(true);setError('');try{const result=await apiClient.get('/quizzes/exam-drafts/'+id+'/');showSaved(result.data);setMessage('')}catch{setError(c.error)}finally{setSaving(false)}}
 return <section className="exam-drafts" aria-labelledby="assembly-title">
  <Link to="/teacher/question-bank">{c.back}</Link>
  <header><div><h1 id="assembly-title">{c.title}</h1><p>{c.intro}</p></div><button type="button" className="btn btn-outline" disabled={!key||saving||!!pending} onClick={fresh}>{c.new}</button></header>
  <p className="assembly-notice">{c.notice}</p>
  {initError&&<p role="alert">{c.error} <button type="button" className="btn btn-sm" onClick={()=>setInitRetry(n=>n+1)}>{c.retry}</button></p>}
  {!key&&!initError&&<p role="status">{c.loading}</p>}
  <form className="assembly-form" onSubmit={save}>
   <label>{c.name} *<input required maxLength={255} disabled={locked} value={title} onChange={e=>{setTitle(e.target.value);setMessage('')}}/></label>
   <label>{c.language}<select disabled={locked} value={language} onChange={e=>{if(items.length&&!window.confirm(c.changeLanguage))return;setLanguage(e.target.value);setItems([]);setShowPicker(false)}}><option value="kk">Қазақша</option><option value="ru">Русский</option></select></label>
   <button className="btn assembly-primary" disabled={saving||!!saved||!key||!complete}>{saving?c.saving:pending?c.retry:c.save}</button>
  </form>
  {saved&&<p className="assembly-saved" role="status">{c.saved} · #{saved.id}. {c.readonly}</p>}
  {pending&&!saving&&<p role="status">{c.pending}</p>}
  {error&&<p className="assembly-error" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <div className="assembly-counts" aria-live="polite"><strong>{c.first}: {counts.first_subject}/30</strong><strong>{c.second}: {counts.second_subject}/20</strong></div>
  {!saved&&<button type="button" className="btn btn-outline" disabled={locked} aria-expanded={showPicker} onClick={()=>setShowPicker(v=>!v)}>{showPicker?c.close:c.choose}</button>}
  {showPicker&&!locked&&<BankQuestionPicker key={language} purpose="exam" language={language} apiClient={apiClient} existingIds={items.map(q=>q.id)} onClose={()=>setShowPicker(false)} onAdd={chosen=>{try{setItems(grouped(addQuestions(items,chosen,language)));setShowPicker(false);setError('');setMessage('')}catch(e){setError(e.message==='count'?c.limit:c.ineligible)}}}/>}
  <div className="assembly-sections">{Object.keys(limits).map(subject=><section key={subject} aria-label={subject==='first_subject'?c.first:c.second}>
   <h2>{subject==='first_subject'?c.first:c.second} <span>{counts[subject]}/{limits[subject]}</span></h2>
   {!counts[subject]?<p>{c.empty}</p>:<ol>{items.filter(q=>q.subject===subject).map((q,index,section)=><li key={q.id}>
    <div className="assembly-row"><div><small>{q.topic}</small><p>{index+1}. {q.text}</p></div>{!saved&&<div className="assembly-order"><button type="button" className="btn btn-ghost btn-square btn-sm" disabled={locked||index===0} aria-label={c.up+' '+(index+1)+' '+subject} onClick={()=>setItems(moveQuestion(items,q.id,-1))}><ArrowUp size={18}/></button><button type="button" className="btn btn-ghost btn-square btn-sm" disabled={locked||index===section.length-1} aria-label={c.down+' '+(index+1)+' '+subject} onClick={()=>setItems(moveQuestion(items,q.id,1))}><ArrowDown size={18}/></button><button type="button" className="btn btn-ghost btn-square btn-sm" disabled={locked} aria-label={c.remove+' '+(index+1)+' '+subject} onClick={()=>setItems(items.filter(item=>item.id!==q.id))}><X size={18}/></button></div>}</div>
    <details><summary>{c.details}</summary><ExamText text={q.text}/><ol type="A">{q.choices.map(o=><li key={o.id}><ExamText text={o.text}/>{o.is_correct&&<strong>{c.correct}</strong>}</li>)}</ol><ExamText text={q.explanation}/></details>
   </li>)}</ol>}
  </section>)}</div>
  <section className="assembly-recent"><h2>{c.recent}</h2>{listLoading?<p role="status">{c.loading}</p>:listError?<p role="alert">{c.error} <button type="button" className="btn btn-sm" onClick={()=>setReload(n=>n+1)}>{c.retry}</button></p>:!recent.length?<p>{c.noSaved}</p>:<ul>{recent.map(d=><li key={d.id}><button type="button" disabled={!key||saving||!!pending} onClick={()=>open(d.id)}>{d.title} · {d.language.toUpperCase()} · #{d.id}</button></li>)}</ul>}<nav><button type="button" className="btn btn-sm" disabled={page===1||listLoading} onClick={()=>setPage(n=>n-1)}>{c.prev}</button><span>{page}</span><button type="button" className="btn btn-sm" disabled={!hasNext||listLoading} onClick={()=>setPage(n=>n+1)}>{c.next}</button></nav></section>
 </section>;
}
