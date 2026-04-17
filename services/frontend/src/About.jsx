import { Github, Linkedin, Send, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

// Красивые бейджи для скиллов, которые адаптируются под тему
const SkillBadge = ({ name }) => (
  <span className="bg-base-200 text-base-content text-xs font-semibold px-3 py-1.5 rounded-full border border-base-300 transition-colors hover:border-primary">
    {name}
  </span>
);

const About = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // Прокрутка наверх при переходе на страницу
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // Данные для стека технологий
  const skills = {
    frontend: ['React', 'JavaScript (ES6+)', 'Tailwind CSS', 'Figma', 'React Router', 'DaisyUI'],
    backend: ['Python', 'Django', 'Django REST Framework', 'PostgreSQL', 'JWT Auth'],
    tools: ['Git', 'GitHub', 'API Testing', 'Vite', 'VS Code', 'Docker']
  };

  return (
    <div className="container mx-auto px-4 py-12 lg:py-20 max-w-7xl">
      
      {/* ── Заголовок ── */}
      <div className="text-center mb-16 lg:mb-24">
        <h1 className="text-sm uppercase tracking-widest font-extrabold text-primary mb-2">
          {t('about.title')}
        </h1>
        <p className="text-4xl lg:text-5xl font-black text-base-content tracking-tighter max-w-3xl mx-auto leading-tight">
          {t('about.subTitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
        
        {/* ── Левая колонка: Профиль ── */}
        <div className="md:col-span-1 space-y-10">
          <div className="bg-base-100 p-8 rounded-3xl border border-base-300 shadow-sm text-center">
            
            {/* АВАТАРКА */}
            <img 
              src="https://github.com/Meriodasuzwe.png" 
              alt="Rakhat Aliyev" 
              className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-base-200 shadow-inner object-cover"
            />

            <h2 className="text-2xl font-extrabold text-base-content tracking-tight">Rakhat Aliyev</h2>
            <p className="text-primary font-semibold text-sm mb-6">{t('about.devTitle')}</p>
            
            <p className="text-base-content opacity-80 text-sm leading-relaxed mb-8">
              {t('about.intro')}
            </p>

            {/* Соцсети */}
            <div className="flex items-center justify-center gap-4">
              {[
                { Icon: Github, href: "https://github.com/Meriodasuzwe" },
                { Icon: Linkedin, href: "https://www.linkedin.com/in/rakhat-aliyev-3a9a2026b/" },
                { Icon: Send, href: "https://t.me/zulficar1" }
              ].map((link, idx) => (
                <a 
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-full bg-base-200 text-base-content hover:bg-primary hover:text-primary-content transition-all duration-300"
                >
                  <link.Icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/*  БЛОК С УНИВЕРСИТЕТОМ  */}
          <div className="bg-base-100 p-8 rounded-3xl border border-base-300 shadow-sm flex items-start gap-4">
            <GraduationCap className="text-primary w-10 h-10 flex-shrink-0 mt-1" />
            <div>
                <h4 className="text-lg font-bold text-base-content">{t('about.university')}</h4>
                <p className="text-sm text-base-content opacity-70">{t('about.faculty')}</p>
            </div>
          </div>
        </div>

        {/* ── Правая колонка: Описание и Стек ── */}
        <div className="md:col-span-2 space-y-12">
          
          <div className="prose prose-lg max-w-none text-base-content opacity-90">
            <p className="text-xl font-medium leading-relaxed">
              {t('about.description')}
            </p>
          </div>

          <div className="border-t border-base-300 pt-12">
            <h3 className="text-2xl font-extrabold text-base-content tracking-tight mb-8">
              {t('about.techStack')}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              
              <div className="bg-base-100 p-7 rounded-2xl border border-base-300 shadow-sm hover:border-primary/40 transition-colors">
                <p className="text-xs uppercase font-bold text-primary tracking-wider mb-4">{t('about.frontend')}</p>
                <div className="flex flex-wrap gap-2.5">
                  {skills.frontend.map(s => <SkillBadge key={s} name={s} />)}
                </div>
              </div>

              <div className="bg-base-100 p-7 rounded-2xl border border-base-300 shadow-sm hover:border-primary/40 transition-colors">
                <p className="text-xs uppercase font-bold text-primary tracking-wider mb-4">{t('about.backend')}</p>
                <div className="flex flex-wrap gap-2.5">
                  {skills.backend.map(s => <SkillBadge key={s} name={s} />)}
                </div>
              </div>

              <div className="bg-base-100 p-7 rounded-2xl border border-base-300 shadow-sm md:col-span-1 sm:col-span-2 hover:border-primary/40 transition-colors">
                <p className="text-xs uppercase font-bold text-primary tracking-wider mb-4">{t('about.tools')}</p>
                <div className="flex flex-wrap gap-2.5">
                  {skills.tools.map(s => <SkillBadge key={s} name={s} />)}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default About;