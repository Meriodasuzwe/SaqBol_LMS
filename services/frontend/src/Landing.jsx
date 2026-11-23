import {useTranslation} from 'react-i18next';
import LandingPage from './landing/LandingConcept';

export default function Landing(){
 const {i18n}=useTranslation();
 const language=i18n.language?.startsWith('kk')?'kk':'ru';
 function changeLanguage(value){i18n.changeLanguage(value);localStorage.setItem('language',value)}
 return <LandingPage initialLanguage={language} onLanguageChange={changeLanguage}/>;
}
