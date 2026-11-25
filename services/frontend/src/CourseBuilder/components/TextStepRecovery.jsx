import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import api from '../../api';
import {createTextStepRecovery} from '../textStepRecovery';

const messages={
 ru:{loading:'Проверяем автора и восстанавливаем текст шага…',loadError:'Не удалось загрузить шаг. Локальная копия не удалена. Проверьте соединение и повторите.',retry:'Повторить',recover:'Найден несохранённый текст этого шага в этом браузере.',restore:'Восстановить текст',discard:'Оставить серверную версию',conflict:'Серверная версия шага изменилась. Перезапись остановлена. Скопируйте нужный локальный текст перед выбором серверной версии.',local:'Текст и название сохранены только в этом браузере. На сервере они ещё не подтверждены.',storage:'Браузер не смог обновить локальную копию. Не закрывайте страницу: скопируйте текст или сохраните шаг на сервер.',clean:'Редактируется текстовый шаг. Локальная копия защищает несохранённые название и текст в этом браузере.',saveError:'Нет подтверждения сохранения. Локальная копия остаётся; проверьте соединение и повторите.',copyTitle:'Название из локальной копии',copyText:'Локальный текст (HTML)',saving:'Проверяем и сохраняем шаг…'},
 kk:{loading:'Авторды тексеріп, қадам мәтінін қалпына келтірудеміз…',loadError:'Қадам жүктелмеді. Жергілікті көшірме жойылған жоқ. Желіні тексеріп, қайталаңыз.',retry:'Қайталау',recover:'Осы браузерде бұл қадамның сақталмаған мәтіні табылды.',restore:'Мәтінді қалпына келтіру',discard:'Сервер нұсқасын қалдыру',conflict:'Сервердегі қадам өзгерген. Қайта жазу тоқтатылды. Сервер нұсқасын таңдаудан бұрын қажетті жергілікті мәтінді көшіріңіз.',local:'Мәтін мен атау тек осы браузерде сақталды. Серверде әлі расталған жоқ.',storage:'Браузер жергілікті көшірмені жаңарта алмады. Бетті жаппаңыз: мәтінді көшіріңіз немесе қадамды серверге сақтаңыз.',clean:'Мәтіндік қадам өңделуде. Жергілікті көшірме сақталмаған атау мен мәтінді осы браузерде қорғайды.',saveError:'Сақтау расталмады. Жергілікті көшірме сақталды; желіні тексеріп, қайталаңыз.',copyTitle:'Жергілікті көшірмедегі атау',copyText:'Жергілікті мәтін (HTML)',saving:'Қадамды тексеріп, сақтаудамыз…'},
 en:{loading:'Checking the author and restoring this text step…',loadError:'Could not load the step. The local copy has not been deleted. Check your connection and retry.',retry:'Retry',recover:'An unfinished draft of this step was found in this browser.',restore:'Restore text',discard:'Keep server version',conflict:'The server version has changed. The overwrite was blocked. Copy anything you need before keeping the server version.',local:'Title and text are saved only in this browser, without server confirmation.',storage:'The browser could not update the local copy. Keep this page open: copy the text or save the step to the server.',clean:'Editing a text step. A local copy protects its unfinished title and text in this browser.',saveError:'Save not confirmed. The local copy remains; check your connection and retry.',copyTitle:'Local draft title',copyText:'Local text (HTML)',saving:'Checking and saving the step…'},
};
export default function TextStepRecovery({courseId,activeStep,setActiveStep,handleSaveStep,renderEditor}){
 const {i18n}=useTranslation(),c=messages[i18n.language?.startsWith('kk')?'kk':i18n.language?.startsWith('en')?'en':'ru'];
 const [state,setState]=useState({phase:'loading'}),session=useRef(null),latest=useRef(null);
 latest.current={setActiveStep,handleSaveStep};
 useEffect(()=>{
  const current=createTextStepRecovery({api,courseId,stepId:activeStep.id,onStep:s=>latest.current.setActiveStep(s),onState:setState,onSave:options=>latest.current.handleSaveStep(options)});
  session.current=current;current.open();return()=>current.dispose();
 },[courseId,activeStep.id]);
 if(state.phase==='loading')return <p role="status">{c.loading}</p>;
 if(state.phase==='error')return <div role="alert"><p>{c.loadError}</p><button className="btn btn-sm" onClick={()=>session.current.open()}>{c.retry}</button></div>;
 if(['recover','conflict'].includes(state.phase))return <section className="space-y-4 max-w-4xl mx-auto" aria-label={state.phase==='conflict'?c.conflict:c.recover}>
  <p role="status">{state.phase==='conflict'?c.conflict:c.recover}</p>
  <label className="block">{c.copyTitle}<input className="input w-full" readOnly value={state.draft.title}/></label>
  <label className="block">{c.copyText}<textarea className="textarea w-full" rows={10} readOnly value={state.draft.content}/></label>
  <div className="flex gap-3 flex-wrap">{state.phase==='recover'&&<button className="btn btn-primary" onClick={()=>session.current.restore()}>{c.restore}</button>}<button className="btn btn-outline" onClick={()=>session.current.discard()}>{c.discard}</button></div>
 </section>;
 return <div className="space-y-4">
  <p role={state.storageError||state.error?'alert':'status'}>{state.storageError?c.storage:state.error?c.saveError:state.phase==='saving'?c.saving:state.dirty?c.local:c.clean}</p>
  <div inert={state.phase==='saving'?true:undefined}>{renderEditor({setActiveStep:next=>session.current.edit(next),handleSaveStep:()=>session.current.save()})}</div>
 </div>;
}
