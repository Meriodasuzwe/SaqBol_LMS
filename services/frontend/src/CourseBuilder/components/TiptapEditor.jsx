import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TiptapLink from '@tiptap/extension-link'; 
import TextAlign from '@tiptap/extension-text-align';
import Dropcursor from '@tiptap/extension-dropcursor';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { toast } from 'react-toastify';
import api from '../../api';

const TiptapEditor = ({ content, onChange }) => {
    const [mediaModal, setMediaModal] = useState({ isOpen: false, type: 'image', url: '' });

    const uploadFileToServer = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await api.post('courses/upload-image/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data.url; 
        } catch (error) {
            console.error("Ошибка загрузки:", error);
            toast.error("Не удалось сохранить картинку на сервере");
            return null;
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ dropcursor: { color: '#570df8', width: 2 } }),
            Image.configure({ HTMLAttributes: { class: 'rounded-2xl shadow-xl max-w-full h-auto mx-auto my-10 border border-base-200' } }),
            Youtube.configure({ HTMLAttributes: { class: 'w-full aspect-video rounded-2xl shadow-xl my-10 border border-base-200' } }),
            TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary font-medium underline underline-offset-4 cursor-pointer' } }),
            TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'justify'] }),
            Placeholder.configure({ placeholder: 'Начните писать...' }),
            CharacterCount.configure({ limit: 20000 }),
        ],
        content: content,
        editorProps: {
            attributes: { class: 'focus:outline-none min-h-[400px] p-6 prose prose-sm sm:prose-base max-w-none' },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer?.files?.length) {
                    let file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        const uploadAndInsert = async () => {
                            const toastId = toast.loading("Загрузка картинки...");
                            const serverUrl = await uploadFileToServer(file);
                            if (serverUrl) {
                                const node = view.state.schema.nodes.image.create({ src: serverUrl });
                                const transaction = view.state.tr.insert(view.posAtCoords({ left: event.clientX, top: event.clientY }).pos, node);
                                view.dispatch(transaction);
                                toast.update(toastId, { render: "Готово!", type: "success", isLoading: false, autoClose: 2000 });
                            } else {
                                toast.update(toastId, { render: "Ошибка загрузки", type: "error", isLoading: false, autoClose: 3000 });
                            }
                        };
                        uploadAndInsert();
                        return true; 
                    }
                }
                return false;
            }
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    const handleMediaSubmit = () => {
        if (!editor || !mediaModal.url.trim()) return;
        try {
            const chain = editor.chain().focus();
            if (mediaModal.type === 'image') chain.setImage({ src: mediaModal.url }).run();
            else if (mediaModal.type === 'video') chain.setYoutubeVideo({ src: mediaModal.url }).run();
            else if (mediaModal.type === 'link') chain.extendMarkRange('link').setLink({ href: mediaModal.url }).run();
        } catch (error) { toast.error("Ошибка при вставке медиа"); }
        setMediaModal({ isOpen: false, type: 'image', url: '' });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const toastId = toast.loading("Загрузка файла на сервер...");
        const serverUrl = await uploadFileToServer(file);
        if (serverUrl) {
            setMediaModal(prev => ({ ...prev, url: serverUrl }));
            toast.update(toastId, { render: "Файл загружен! Нажмите 'Добавить'", type: "success", isLoading: false, autoClose: 2000 });
        } else toast.update(toastId, { render: "Ошибка загрузки", type: "error", isLoading: false, autoClose: 3000 });
    };

    if (!editor) return <div className="p-10 text-center opacity-20">Загрузка редактора...</div>;

    return (
        <div className="w-full flex flex-col bg-base-100 rounded-3xl border border-base-200 overflow-hidden shadow-sm hover:shadow-md transition-all relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 gap-2 border-b border-base-200 bg-base-50/30 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center flex-wrap gap-1">
                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('bold') ? 'bg-primary/10 text-primary' : ''}`} title="Жирный"><b>B</b></button>
                        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('italic') ? 'bg-primary/10 text-primary' : ''}`} title="Курсив"><i>I</i></button>
                        <button onClick={() => editor.chain().focus().toggleCode().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('code') ? 'bg-primary/10 text-primary' : ''}`} title="Код">{`<>`}</button>
                    </div>
                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary/10 text-primary' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" /></svg>
                        </button>
                        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary/10 text-primary' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M7 12h10M4 18h16" /></svg>
                        </button>
                        <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-primary/10 text-primary' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                    <div className="join bg-base-100 border border-base-200 shadow-sm">
                        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/10 text-primary' : ''}`}>H2</button>
                        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <button onClick={() => setMediaModal({ isOpen: true, type: 'image', url: '' })} className="btn btn-sm btn-outline border-base-300 gap-2 font-medium normal-case hover:bg-primary hover:border-primary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Фото
                    </button>
                    <button onClick={() => setMediaModal({ isOpen: true, type: 'video', url: '' })} className="btn btn-sm btn-outline border-base-300 gap-2 font-medium normal-case hover:bg-error hover:border-error">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Видео
                    </button>
                    <button onClick={() => setMediaModal({ isOpen: true, type: 'link', url: editor.getAttributes('link').href || '' })} className={`btn btn-sm gap-2 font-medium normal-case ${editor.isActive('link') ? 'btn-primary' : 'btn-outline border-base-300'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> Ссылка
                    </button>
                </div>
            </div>
            
            <div className="bg-white min-h-[400px]">
                <EditorContent editor={editor} />
            </div>

            <div className="p-2 border-t border-base-100 flex justify-between items-center bg-base-50/20 px-4">
                <div className="text-[10px] text-base-content/40 uppercase font-bold tracking-wider">
                    Слов: {editor.storage.characterCount.words()} | Символов: {editor.storage.characterCount.characters()}
                </div>
                <button onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="btn btn-xs btn-ghost text-base-content/40 hover:text-error">
                    Сбросить форматирование
                </button>
            </div>

            {mediaModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-900/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 w-full max-w-sm overflow-hidden animate-slide-up">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-1">
                                {mediaModal.type === 'image' ? 'Изображение' : mediaModal.type === 'video' ? 'YouTube видео' : 'Ссылка'}
                            </h3>
                            <p className="text-sm text-base-content/50 mb-6">Введите URL адрес контента</p>
                            <div className="space-y-4">
                                <input type="text" className="input input-bordered w-full bg-base-50 focus:bg-white" placeholder="https://..." value={mediaModal.url} onChange={(e) => setMediaModal({ ...mediaModal, url: e.target.value })} autoFocus />
                                {mediaModal.type === 'image' && (
                                    <>
                                        <div className="divider text-[10px] uppercase tracking-widest opacity-40">Или файл</div>
                                        <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm w-full" onChange={handleFileUpload} />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-base-50 flex gap-2 justify-end">
                            <button onClick={() => setMediaModal({ isOpen: false, type: 'image', url: '' })} className="btn btn-ghost btn-sm px-6">Отмена</button>
                            <button onClick={handleMediaSubmit} className="btn btn-primary btn-sm px-8 shadow-lg shadow-primary/20">Добавить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TiptapEditor;