import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import {ToastContainer} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../../src/i18n';
import QuizPage from '../../src/QuizPage.jsx';
import api from '../../src/api';
import '../exam-preview/preview.css';
function Preview(){
    const [ready,setReady]=useState(false),[error,setError]=useState(''),[data,setData]=useState(null);
    useEffect(()=>{let active=true;void(async()=>{
        const response=await fetch('/__exam_preview__/bootstrap');
        const fixture=await response.json();
        if(!response.ok||!fixture.isolated||fixture.quiz_id!==904)throw new Error();
        const login=await api.post(fixture.login.path.replace(/^\//,''),{username:fixture.login.username,password:fixture.login.password});
        localStorage.setItem('access',login.data.access);localStorage.setItem('refresh',login.data.refresh);
        if(active)setReady(true);
    })().catch(()=>{if(active)setError('Не удалось войти в изолированный стенд.')});return()=>{active=false}},[]);
    async function control(command){
        const response=await fetch('/__exam_preview__/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command})});
        if(!response.ok)setError('Не удалось включить искусственный сбой.');
    }
    async function state(){
        const response=await fetch('/__exam_preview__/state');const value=await response.json();
        if(response.ok&&value.isolated)setData(value);
    }
    return <><aside className="exam-preview-notice">ИЗОЛИРОВАННЫЙ СТЕНД · искусственные вопросы и аккаунт. Настоящие QuizPage, API и Django, временная SQLite. Рабочая БД не подключена.</aside>
        {error?<p role="alert">{error}</p>:ready?<BrowserRouter><Routes>
            <Route path="/" element={<Navigate replace to="/quiz/lesson/902?quiz_id=904"/>}/>
            <Route path="/quiz/lesson/:lessonId" element={<main className="container mx-auto p-4 lg:p-8"><QuizPage/></main>}/>
        </Routes></BrowserRouter>:<p>Вход в искусственный стенд…</p>}
        <details className="exam-preview-dev"><summary>Проверка потери ответа · только для разработки</summary>
            <button className="btn btn-sm" onClick={()=>control('fail_next_finish')}>Оборвать следующую отправку до сервера</button>
            <button className="btn btn-sm" onClick={()=>control('lose_next_finish_response')}>Потерять ответ после записи</button>
            <button className="btn btn-sm" onClick={state}>Прочитать временную БД</button>
            {data&&<pre>{JSON.stringify(data,null,2)}</pre>}
        </details><ToastContainer/></>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
