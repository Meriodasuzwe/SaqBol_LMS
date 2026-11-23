import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ArrowRight,BookOpen,Check,ChevronDown,RotateCcw} from 'lucide-react';
import {copy} from './copy';
import studyPhoto from './assets/study-editorial.png';
import './landing.css';

function Tree(){return <svg viewBox="0 0 240 124" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".55"><path d="M120 21L62 66M120 21L182 66M62 66L26 106M62 66L98 106"/></g>{[[120,21,'8'],[62,66,'4'],[182,66,'12'],[26,106,'2'],[98,106,'6']].map(([x,y,n])=><g key={n}><circle cx={x} cy={y} r="15" fill="#2635b9" stroke="currentColor"/><text x={x} y={y+4} textAnchor="middle" fill="currentColor" fontSize="11">{n}</text></g>)}</svg>}

export default function LandingConcept({initialLanguage="ru",onLanguageChange,preview=false}){
 const [language,setLanguage]=useState(initialLanguage),[answer,setAnswer]=useState(null),[submitted,setSubmitted]=useState(false);
 const c=copy[language];
 const platformBase=preview?"http://localhost":"";
 useEffect(()=>{setLanguage(initialLanguage)},[initialLanguage]);
 const feedbackRef=useRef(null),firstAnswerRef=useRef(null),focusAfterReset=useRef(false);
 useEffect(()=>{
  if(submitted)feedbackRef.current?.focus();
  else if(focusAfterReset.current){firstAnswerRef.current?.focus();focusAfterReset.current=false}
 },[submitted]);
 function changeLanguage(value){setLanguage(value);setAnswer(null);setSubmitted(false);document.documentElement.lang=value;onLanguageChange?.(value)}
 return <div className="sbl-page" lang={language}>
  <a className="sbl-skip" href="#content">{c.skip}</a>
  <nav className="sbl-nav" aria-label="SAQBol"><a href="#" className="sbl-logo" aria-label="SAQBol"><span className="sbl-logo-symbol"><BookOpen size={20} strokeWidth={2.3}/></span>SAQBol<span className="sbl-logo-dot">.</span></a><div className="sbl-nav-links"><a href="#practice">{c.navProcess}</a><a href="#profile">{c.navProfile}</a><a href="#questions">{c.navQuestions}</a></div><div className="sbl-nav-actions"><div className="sbl-languages" aria-label={language==='kk'?'Тіл':'Язык'}><button type="button" aria-pressed={language==='ru'} onClick={()=>changeLanguage('ru')}>RU</button><span>/</span><button type="button" aria-pressed={language==='kk'} onClick={()=>changeLanguage('kk')}>ҚАЗ</button></div><a className="sbl-login" href={`${platformBase}/login`}>{c.login}<ArrowUpRight size={17}/></a></div></nav>
  <main id="content">
   <section className="sbl-hero" aria-labelledby="hero-title">
    <div className="sbl-hero-copy"><h1 id="hero-title"><span>{c.hero[0]}</span><span>{c.hero[1]}</span></h1><p className="sbl-intro">{c.intro}</p><div className="sbl-hero-actions"><a className="sbl-button sbl-button-blue" href="#practice">{c.try}<ArrowUpRight size={22}/></a><a className="sbl-text-link" href={`${platformBase}/exams`}>{c.openExams}<ArrowRight size={17}/></a></div><div className="sbl-hero-note"><span className="sbl-note-mark" aria-hidden="true"/>{c.heroNote}</div></div>
    <div className="sbl-hero-art"><img className="sbl-photo" src={studyPhoto} alt={c.photoAlt} width="1122" height="1402" fetchPriority="high"/><div className="sbl-photo-label">{c.photoNote}</div><div className="sbl-study-cover"><div className="sbl-cover-top"><span>SAQBol</span><ArrowUpRight size={20}/></div><div className="sbl-cover-title">{c.cover.map(line=><span key={line}>{line}</span>)}</div><Tree/><p>{c.coverFoot}</p></div><a className="sbl-today" href="#practice"><span>{c.today}</span><strong>{c.todayTopic}</strong><ArrowUpRight size={25}/></a><div className="sbl-hero-tab" aria-hidden="true">КТ<br/>M094</div></div>
   </section>
   <div className="sbl-context">{c.strip.map((label,i)=><span key={label}>{i===0&&<span className="sbl-context-dot"/>}{label}{i===2&&<ArrowDown/>}</span>)}</div>
   <section className="sbl-practice" id="practice" aria-labelledby="practice-title">
    <span id="features" aria-hidden="true"/><div className="sbl-practice-wrap"><div className="sbl-process"><h2 id="practice-title">{c.processTitle[0]}<br/><span>{c.processTitle[1]}</span></h2><p>{c.processText}</p><ol className="sbl-steps">{c.steps.map((step,i)=><li key={step}><span>{i+1}</span><div><h3>{step}</h3><p>{c.stepNotes[i]}</p></div></li>)}</ol><p className="sbl-demo-origin">{c.demoLabel}</p></div>
     <div className="sbl-demo"><div className="sbl-demo-top"><span><BookOpen size={16}/>{c.demoTopic}</span><span>SQL</span></div><form onSubmit={e=>{e.preventDefault();if(answer!==null)setSubmitted(true)}}><fieldset disabled={submitted}><legend>{c.demoQuestion}</legend><pre className="sbl-code"><code><span>SELECT</span> title{'\n'}<span>FROM</span> books{'\n'}<span>WHERE</span> price &gt;= <em>5000</em>;</code></pre><div className="sbl-options">{c.options.map((option,index)=><label key={index} className={(answer===index?'is-selected ':'')+(submitted&&index===1?'is-correct':'')}><input type="radio" name="demo-answer" ref={index===0?firstAnswerRef:undefined} value={index} checked={answer===index} onChange={()=>setAnswer(index)}/><span className="sbl-option-letter">{String.fromCharCode(65+index)}</span><span>{option}</span>{submitted&&index===1&&<Check size={18} aria-hidden="true"/>}</label>)}</div></fieldset>{submitted?<div className="sbl-feedback" role="status"><h3 ref={feedbackRef} tabIndex={-1}>{answer===1?c.right:c.wrong}</h3><p>{c.explanation}</p><button type="button" className="sbl-reset" onClick={()=>{focusAfterReset.current=true;setAnswer(null);setSubmitted(false)}}><RotateCcw size={15}/>{c.retry}</button></div>:<button type="submit" className="sbl-button sbl-demo-submit" disabled={answer===null}>{c.check}<ArrowRight size={19}/></button>}</form><p className="sbl-demo-foot">{c.demoNote}</p></div>
    </div>
   </section>
   <section className="sbl-profile" id="profile" aria-labelledby="profile-title"><div className="sbl-profile-intro" id="tracks"><h2 id="profile-title">{c.profileTitle[0]}<br/><span>{c.profileTitle[1]}</span></h2><p>{c.profileText}</p><a className="sbl-text-link" href={`${platformBase}/exams`}>{c.exams}<ArrowUpRight size={20}/></a></div><div className="sbl-profile-sheet"><div className="sbl-sheet-head"><span>{c.program}</span><BookOpen size={21}/></div><ol><li><span className="sbl-subject-number">01</span><div><h3>{c.first}</h3><p>{c.firstDetail}</p></div></li><li><span className="sbl-subject-number">02</span><div><h3>{c.second}</h3><p>{c.secondDetail}</p></div></li></ol><p className="sbl-sheet-note">{c.profileNote}</p><div className="sbl-future"><h3>{c.futureTitle}</h3><p>{c.future}: {c.futureText}</p></div></div></section>
   <section className="sbl-faq" id="questions" aria-labelledby="faq-title"><h2 id="faq-title">{c.faqTitle}</h2><div>{c.faq.map(([question,response])=><details key={question}><summary>{question}<ChevronDown size={20} aria-hidden="true"/></summary><p>{response}</p></details>)}</div></section>
   <section className="sbl-close"><div><h2>{c.closeTitle[0]}<br/>{c.closeTitle[1]}</h2><p>{c.closeText}</p></div><a className="sbl-button" href={`${platformBase}/courses`}>{c.platform}<ArrowUpRight size={24}/></a><span className="sbl-close-word" aria-hidden="true">алға.</span></section>
  </main>
  <footer className="sbl-footer"><a className="sbl-logo" href="#">SAQBol<span className="sbl-logo-dot">.</span></a><p>{c.footer}</p><span>{preview?c.concept:c.siteLabel}</span></footer>
 </div>;
}
function ArrowDown(){return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v14M4 11l6 6 6-6" stroke="currentColor" strokeWidth="1.5"/></svg>}
