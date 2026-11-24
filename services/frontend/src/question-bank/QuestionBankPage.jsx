import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {Plus,Search,ArrowLeft,Trash2} from 'lucide-react';
import api from '../api';
import {ExamText} from '../exams/ExamPrimitives';
import {bankCopy} from './copy';
import {newDraft,newChoice,selectCorrect,payload,validDraft,restoreDraft,storeDraft,creationRequest,browserDraftStorage,browserSessionStorage} from './draft';
import './question-bank.css';

export default function QuestionBankPage({apiClient=api}) {
 const {i18n}=useTranslation(), c=bankCopy(i18n.resolvedLanguage||i18n.language);
 const [draft,setDraft]=useState(newDraft),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false);
 const [rows,setRows]=useState([]),[count,setCount]=useState(0),[hasNext,setHasNext]=useState(false);
 const [filters,setFilters]=useState({search:'',subject:'',usage:'',language:''}),[page,setPage]=useState(1),[reload,setReload]=useState(0);
 const [topics,setTopics]=useState({}),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const heading=useRef(null),inflight=useRef(false);
 const [pendingCreate,setPendingCreate]=useState(null);
 const [storageKey,setStorageKey]=useState(null);
 const [metadataAttempt,setMetadataAttempt]=useState(0),[metadataError,setMetadataError]=useState(false),[storageProblem,setStorageProblem]=useState(false);
 useEffect(()=>{
  let active=true;
  setMetadataError(false);
  apiClient.get('/quizzes/bank/topics/').then(r=>{
   if(!active)return;
   if(!Number.isInteger(r.data.author_id)||r.data.author_id<=0)throw new Error('Missing author identity');
   const key='saqbol.bank.draft.'+r.data.author_id;
   const restored=restoreDraft(browserDraftStorage,key)||restoreDraft(browserSessionStorage,key);
   setTopics(r.data.topics);
   if(restored){setDraft(restored);setPendingCreate(restored._pendingCreate||null);setDirty(true);setMessage(c.restored)}
   setStorageKey(key);
  }).catch(()=>{if(active)setMetadataError(true)});
  return()=>{active=false};
 },[apiClient,metadataAttempt]);
 useEffect(()=>{
  let active=true;setLoading(true);setLoadError(false);
  const query=new URLSearchParams({...filters,page:String(page)});
  apiClient.get('/quizzes/bank/?'+query).then(r=>{if(active){setRows(r.data.results);setCount(r.data.count);setHasNext(!!r.data.next)}}).catch(()=>{if(active)setLoadError(true)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[filters,page,reload,apiClient]);
 useEffect(()=>{const guard=e=>{if(dirty||saving){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty,saving]);
 useEffect(()=>{
  if(!storageKey)return;
  const stored=storeDraft(browserDraftStorage,storageKey,{...draft,_pendingCreate:pendingCreate},dirty||!!pendingCreate);
  setStorageProblem(!stored);
  // Remove the legacy tab copy only after the durable write (or removal) succeeds.
  if(stored)storeDraft(browserSessionStorage,storageKey,null,false);
 },[storageKey,draft,dirty,pendingCreate]);
 const change=updates=>{setDraft(d=>({...d,...updates}));setDirty(true);setMessage('');setError('')};
 const open=item=>{if(!storageKey||saving||pendingCreate||(dirty&&!window.confirm(c.discard)))return;setDraft(item?structuredClone(item):newDraft());setDirty(false);setError('');setMessage('');heading.current?.focus()};
 const save=async e=>{
  e.preventDefault();if(!storageKey||inflight.current)return;setMessage('');setError('');
  if(!pendingCreate&&!validDraft(draft)){setError(c.invalid);return;}
  inflight.current=true;setSaving(true);
  const operation=draft.id?null:creationRequest(draft,pendingCreate);
  if(operation){
   // Persist the retry identity before dispatch, rather than waiting for a React effect.
   const stored=storeDraft(browserDraftStorage,storageKey,{...draft,_pendingCreate:operation},true);
   setStorageProblem(!stored);setPendingCreate(operation);
  }
  try {
   const response=draft.id?await apiClient.put('/quizzes/bank/'+draft.id+'/',payload(draft)):await apiClient.post('/quizzes/bank/',operation.body,{headers:{'Idempotency-Key':operation.key}});
   setDraft(response.data);setPendingCreate(null);setDirty(false);setMessage(c.saved);setReload(n=>n+1);
  } catch(e){
   if(e.response?.status===400)setPendingCreate(null);
   const detail=e.response?.data;setError(detail?Object.entries(detail).map(([field,value])=>(c[field]||field)+': '+(Array.isArray(value)?value.join(' '):String(value))).join(' · '):operation?c.pendingCreate:c.saveError);
  } finally{inflight.current=false;setSaving(false)}
 };
 const subjectName=value=>value==='first_subject'?c.first:c.second;
 return <section className="qb" aria-labelledby="bank-title">
  <Link className="qb-back" to="/profile" onClick={e=>{if(saving||(dirty&&!window.confirm(c.discard)))e.preventDefault()}}><ArrowLeft size={16}/>{c.back}</Link>
  <header className="qb-heading"><div><h1 id="bank-title">{c.title}</h1><p>{c.intro}</p></div><button className="btn btn-primary" onClick={()=>open()} disabled={!storageKey||saving||!!pendingCreate}><Plus size={18}/>{c.new}</button></header>
  <Link className="btn btn-outline mb-4" to="/teacher/exam-drafts">{i18n.language?.startsWith('kk')?'Сынақ жинағын құрастыру':i18n.language?.startsWith('en')?'Assemble mock exam':'Собрать пробник'}</Link>
  <p className="qb-notice">{c.notice}</p>
  <div className="qb-workspace">
   <aside className="qb-library" aria-label={c.library}>
    <h2>{c.library}</h2>
    <form className="qb-filters" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setFilters(Object.fromEntries(form));setPage(1)}}>
     <label className="qb-search"><span>{c.search}</span><div><input name="search" type="search" defaultValue={filters.search}/><button className="btn btn-square" aria-label={c.find}><Search size={19}/></button></div></label>
     <label><span>{c.subject}</span><select name="subject" defaultValue=""><option value="">{c.all}</option><option value="first_subject">{c.first}</option><option value="second_subject">{c.second}</option></select></label>
     <div className="qb-filter-pair"><label><span>{c.usage}</span><select name="usage" defaultValue=""><option value="">{c.allUsage}</option>{['exam','training','both'].map(v=><option key={v} value={v}>{c[v]}</option>)}</select></label>
     <label><span>{c.language}</span><select name="language" defaultValue=""><option value="">{c.allLanguages}</option><option value="kk">Қазақша</option><option value="ru">Русский</option></select></label></div>
     <div className="qb-filter-actions"><button className="btn btn-sm" type="submit">{c.find}</button><button className="btn btn-ghost btn-sm" type="reset" onClick={()=>{setFilters({search:'',subject:'',usage:'',language:''});setPage(1)}}>{c.reset}</button></div>
    </form>
    {loading?<p role="status">{c.loading}</p>:loadError?<div role="alert"><p>{c.error}</p><button className="btn btn-sm" onClick={()=>setReload(n=>n+1)}>{c.retry}</button></div>:<>
     <p className="qb-count">{c.total}: {count}</p>
     {!rows.length?<div className="qb-empty"><h3>{c.empty}</h3><p>{c.emptyHint}</p></div>:<ul className="qb-rows">{rows.map(item=><li key={item.id}><button disabled={!storageKey||saving||!!pendingCreate} type="button" className={draft.id===item.id?'is-current':''} aria-current={draft.id===item.id?'true':undefined} onClick={()=>open(item)}><span className="qb-row-meta">{subjectName(item.subject)} · {item.language.toUpperCase()}</span><strong>{item.text}</strong><span>{item.topic}</span><small>{c[item.usage]} · {c.draft}</small></button></li>)}</ul>}
     <nav className="qb-pages" aria-label={c.page}><button className="btn btn-sm" disabled={page===1} onClick={()=>setPage(n=>n-1)}>{c.prev}</button><span>{c.page} {page}</span><button className="btn btn-sm" disabled={!hasNext} onClick={()=>setPage(n=>n+1)}>{c.next}</button></nav>
    </>}
   </aside>
   <div className="qb-editor">
    {!storageKey&&(metadataError?<div role="alert"><p>{c.recoveryError}</p><button type="button" className="btn btn-sm" onClick={()=>setMetadataAttempt(n=>n+1)}>{c.retry}</button></div>:<p role="status">{c.recovering}</p>)}
    <h2 ref={heading} tabIndex={-1}>{draft.id?c.edit:c.new}</h2><p className="qb-help">{c.required}</p>
    <form onSubmit={save}>
     <fieldset disabled={!storageKey||saving||!!pendingCreate} className="qb-fields">
      <div className="qb-pair"><label><span>{c.subject} *</span><select value={draft.subject} onChange={e=>change({subject:e.target.value,topic:'',choices:draft.choices.map(o=>({...o,is_correct:false}))})}><option value="first_subject">{c.first}</option><option value="second_subject">{c.second}</option></select></label>
      <label><span>{c.language} *</span><select value={draft.language} onChange={e=>change({language:e.target.value})}><option value="kk">Қазақша</option><option value="ru">Русский</option></select></label></div>
      <label><span>{c.topic} *</span><input required maxLength={255} value={draft.topic} list="bank-topics" onChange={e=>change({topic:e.target.value})} placeholder={c.selectTopic} aria-describedby="topic-help"/><small id="topic-help">{c.topicHint}</small></label>
      <datalist id="bank-topics">{(topics[draft.subject]||[]).map(t=><option key={t} value={t}/>)}</datalist>
      <label><span>{c.usage} *</span><select value={draft.usage} onChange={e=>change({usage:e.target.value})}>{['exam','training','both'].map(v=><option key={v} value={v}>{c[v]}</option>)}</select></label>
      <label><span>{c.text} *</span><textarea required rows={7} maxLength={50000} value={draft.text} onChange={e=>change({text:e.target.value})}/></label>
      <fieldset className="qb-options"><legend>{c.options} *</legend><p className="qb-help">{draft.subject==='first_subject'?c.single:c.multiple}</p>
      {draft.choices.map((option,index)=><div key={option.id} className={'qb-option'+(option.is_correct?' is-correct':'')}>
       <label className="qb-correct"><input type={draft.subject==='first_subject'?'radio':'checkbox'} name="correct" checked={option.is_correct} onChange={e=>{setDraft(selectCorrect(draft,option.id,e.target.checked));setDirty(true);setMessage('');setError('')}} aria-label={c.correct+' '+String.fromCharCode(65+index)}/><span aria-hidden="true">{String.fromCharCode(65+index)}</span></label>
       <label className="qb-option-input"><span className="sr-only">{c.option} {String.fromCharCode(65+index)}</span><textarea required maxLength={255} rows={2} value={option.text} onChange={e=>change({choices:draft.choices.map(o=>o.id===option.id?{...o,text:e.target.value}:o)})}/></label>
       <button type="button" className="btn btn-ghost btn-square btn-sm" disabled={draft.choices.length<=2} aria-label={c.remove+' '+String.fromCharCode(65+index)} onClick={()=>change({choices:draft.choices.filter(o=>o.id!==option.id)})}><Trash2 size={17}/></button>
      </div>)}
      <button type="button" className="btn btn-ghost btn-sm" disabled={draft.choices.length>=8} onClick={()=>change({choices:[...draft.choices,newChoice()]})}><Plus size={16}/>{c.add}</button></fieldset>
      <label><span>{c.explanation}</span><textarea rows={4} maxLength={50000} value={draft.explanation} onChange={e=>change({explanation:e.target.value})}/><small>{c.explainHint}</small></label>
     </fieldset>
     {storageKey&&<p className="qb-help" role={storageProblem?'alert':'status'}>{storageProblem?c.localError:pendingCreate?c.localPending:dirty?c.localSaved:c.localHint}</p>}
     {pendingCreate&&!saving&&<p role="status">{c.pendingCreate}</p>}
     {error&&<p className="qb-error" role="alert">{error}</p>}
     <div className="qb-save"><button className="btn btn-primary" disabled={!storageKey||saving||(!dirty&&!!draft.id&&!pendingCreate)}>{saving?c.saving:pendingCreate?c.retry:c.save}</button><span role="status">{message||(dirty?c.dirty:'')}</span></div>
    </form>
    <details className="qb-preview"><summary>{c.preview}</summary><ExamText text={draft.text||c.noPreview}/><ol type="A">{draft.choices.map(o=><li key={o.id}><ExamText text={o.text}/>{o.is_correct&&<small>{c.correct}</small>}</li>)}</ol><h3>{c.explanation}</h3><ExamText text={draft.explanation}/></details>
   </div>
  </div>
 </section>;
}
