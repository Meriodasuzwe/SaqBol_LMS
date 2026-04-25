import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TiptapLink from '@tiptap/extension-link'; 
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';

// РАСШИРЕНИЯ ДЛЯ ТАБЛИЦ И КОДА
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlock } from '@tiptap/extension-code-block';

import { toast } from 'react-toastify';
import api from '../../api';

// 🔥 ФИКС: Оставили только 100% безопасные базовые иконки
import { 
    Bold, Italic, Code, TerminalSquare, 
    AlignLeft, AlignCenter, AlignJustify, Heading2,
    List, ListOrdered, Image as ImageIcon, Video, Link as LinkIcon,
    Table as TableIcon, Plus, Minus, Trash2
} from 'lucide-react';

const TiptapEditor = ({ content, onChange }) => {
    const { t } = useTranslation();
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
            console.error("Upload error:", error);
            toast.error(t('builder.editor.uploadError'));
            return null;
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ 
                dropcursor: { color: '#2563eb', width: 2 },
                heading: { HTMLAttributes: { class: 'text-2xl font-black text-base-content mt-8 mb-4' } },
                bulletList: { HTMLAttributes: { class: 'list-disc ml-6 my-4 space-y-1' } },
                orderedList: { HTMLAttributes: { class: 'list-decimal ml-6 my-4 space-y-1' } },
                code: { HTMLAttributes: { class: 'bg-base-200/50 text-blue-600 px-1.5 py-0.5 rounded-md font-mono text-sm border border-base-200' } }
            }),
            Image.configure({ HTMLAttributes: { class: 'rounded-2xl shadow-xl max-w-full h-auto mx-auto my-10 border border-base-200' } }),
            Youtube.configure({ HTMLAttributes: { class: 'w-full aspect-video rounded-2xl shadow-xl my-10 border border-base-200' } }),
            TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 font-medium underline underline-offset-4 cursor-pointer' } }),
            TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'justify'] }),
            Placeholder.configure({ placeholder: '...' }),
            CharacterCount.configure({ limit: 20000 }),
            
            
            // ТАБЛИЦЫ
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    // 🔥 Убрали класс .table от DaisyUI, добавили жесткие границы и table-fixed
                    class: 'w-full table-fixed border-collapse border-2 border-base-300 my-6 bg-base-100',
                },
            }),
            TableRow.configure({ 
                HTMLAttributes: { class: 'border-b-2 border-base-300' } 
            }),
            TableHeader.configure({ 
                HTMLAttributes: { class: 'bg-base-200/80 font-bold p-4 border-2 border-base-300 text-left text-base-content min-w-[100px]' } 
            }),
            TableCell.configure({ 
                HTMLAttributes: { class: 'p-4 border-2 border-base-300 text-base-content align-top min-w-[100px]' } 
            }),
            
            // БЛОК КОДА
            CodeBlock.configure({
                HTMLAttributes: {
                    class: 'bg-slate-900 text-slate-50 p-5 rounded-xl font-mono text-sm my-6 overflow-x-auto shadow-inner',
                },
            }),
        ],
        content: content,
        editorProps: {
            attributes: { class: 'focus:outline-none min-h-[400px] p-6 prose prose-sm sm:prose-base max-w-none text-base-content' },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer?.files?.length) {
                    let file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        const uploadAndInsert = async () => {
                            const toastId = toast.loading(t('builder.editor.uploadingImg'));
                            const serverUrl = await uploadFileToServer(file);
                            if (serverUrl) {
                                const node = view.state.schema.nodes.image.create({ src: serverUrl });
                                const transaction = view.state.tr.insert(view.posAtCoords({ left: event.clientX, top: event.clientY }).pos, node);
                                view.dispatch(transaction);
                                toast.update(toastId, { render: t('builder.editor.uploadReady'), type: "success", isLoading: false, autoClose: 2000 });
                            } else {
                                toast.update(toastId, { render: t('builder.editor.uploadError'), type: "error", isLoading: false, autoClose: 3000 });
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
        } catch (error) { toast.error(t('builder.editor.mediaError')); }
        setMediaModal({ isOpen: false, type: 'image', url: '' });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const toastId = toast.loading(t('builder.editor.uploadingFile'));
        const serverUrl = await uploadFileToServer(file);
        if (serverUrl) {
            setMediaModal(prev => ({ ...prev, url: serverUrl }));
            toast.update(toastId, { render: t('builder.editor.fileUploaded'), type: "success", isLoading: false, autoClose: 2000 });
        } else toast.update(toastId, { render: t('builder.editor.uploadError'), type: "error", isLoading: false, autoClose: 3000 });
    };

    if (!editor) return <div className="p-10 text-center opacity-40 font-bold">{t('builder.editor.loading')}</div>;

    const activeBtnClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
    const isTableActive = editor.isActive('table');

    return (
        <div className="w-full flex flex-col bg-base-100 rounded-2xl overflow-hidden relative border-t-0">
            
            {/* ГЛАВНЫЙ ТУЛБАР */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 gap-2 border-b border-base-200 bg-base-200/30 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center flex-wrap gap-1">
                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('bold') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.bold')}><Bold size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('italic') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.italic')}><Italic size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCode().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('code') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.code')}><Code size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('codeBlock') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.codeBlock')}><TerminalSquare size={16} /></button>
                    </div>

                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'left' }) ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.alignLeft')}><AlignLeft size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'center' }) ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.alignCenter')}><AlignCenter size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive({ textAlign: 'justify' }) ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.alignJustify')}><AlignJustify size={16} /></button>
                    </div>

                    <div className="join bg-base-100 border border-base-200 shadow-sm mr-1">
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('heading', { level: 2 }) ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.heading2')}><Heading2 size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('bulletList') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.bulletList')}><List size={16} /></button>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`join-item btn btn-sm btn-ghost px-3 ${editor.isActive('orderedList') ? activeBtnClass : 'text-base-content/70'}`} title={t('builder.editor.orderedList')}><ListOrdered size={16} /></button>
                    </div>

                    
                    <div className="join bg-base-100 border border-base-200 shadow-sm">
                        <button 
                            type="button" 
                            onMouseDown={(e) => e.preventDefault()} 
                            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} 
                            disabled={isTableActive} // 🔥 Блокируем кнопку, если мы уже в таблице!
                            className={`join-item btn btn-sm btn-ghost px-3 ${isTableActive ? 'opacity-30 cursor-not-allowed' : 'text-base-content/70 hover:text-blue-600'}`} 
                            title={t('builder.editor.insertTable')}
                        >
                            <TableIcon size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <button type="button" onClick={() => setMediaModal({ isOpen: true, type: 'image', url: '' })} className="btn btn-sm btn-outline border-base-300 text-base-content/70 gap-2 font-medium normal-case hover:bg-blue-600 hover:text-white hover:border-blue-600">
                        <ImageIcon size={14} /> {t('builder.editor.photo')}
                    </button>
                    <button type="button" onClick={() => setMediaModal({ isOpen: true, type: 'video', url: '' })} className="btn btn-sm btn-outline border-base-300 text-base-content/70 gap-2 font-medium normal-case hover:bg-red-500 hover:text-white hover:border-red-500">
                        <Video size={14} /> {t('builder.editor.video')}
                    </button>
                    <button type="button" onClick={() => setMediaModal({ isOpen: true, type: 'link', url: editor.getAttributes('link').href || '' })} className={`btn btn-sm gap-2 font-medium normal-case ${editor.isActive('link') ? 'bg-blue-600 text-white border-blue-600' : 'btn-outline border-base-300 text-base-content/70 hover:bg-base-200'}`}>
                        <LinkIcon size={14} /> {t('builder.editor.link')}
                    </button>
                </div>
            </div>

            {/* 🔥 ПАНЕЛЬ ТАБЛИЦЫ (показывается только внутри таблицы) */}
            {isTableActive && (
                <div className="flex flex-wrap items-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-base-200 animate-in slide-in-from-top-2">
                    <div className="join bg-base-100 border border-blue-200/50 shadow-sm">
                        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="join-item btn btn-xs btn-ghost text-base-content/70 hover:text-blue-600" title={t('builder.editor.addCol')}><Plus size={14} /></button>
                        <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="join-item btn btn-xs btn-ghost text-base-content/70 hover:text-red-500" title={t('builder.editor.delCol')}><Minus size={14} /></button>
                    </div>
                    <div className="join bg-base-100 border border-blue-200/50 shadow-sm">
                        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="join-item btn btn-xs btn-ghost text-base-content/70 hover:text-blue-600" title={t('builder.editor.addRow')}><Plus size={14} /></button>
                        <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="join-item btn btn-xs btn-ghost text-base-content/70 hover:text-red-500" title={t('builder.editor.delRow')}><Minus size={14} /></button>
                    </div>
                    <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="btn btn-xs bg-red-100 text-red-600 hover:bg-red-200 border-none ml-auto" title={t('builder.editor.delTable')}><Trash2 size={12} /> {t('builder.editor.delTable')}</button>
                </div>
            )}
            
            <div className="bg-base-100 min-h-[400px]">
                <EditorContent editor={editor} />
            </div>

            <div className="p-2 border-t border-base-200 flex justify-between items-center bg-base-200/30 px-4">
                <div className="text-[10px] text-base-content/50 uppercase font-bold tracking-wider">
                    {t('builder.editor.words')}: {editor.storage.characterCount.words()} | {t('builder.editor.chars')}: {editor.storage.characterCount.characters()}
                </div>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="btn btn-xs btn-ghost text-base-content/40 hover:text-red-500">
                    {t('builder.editor.clearFormat')}
                </button>
            </div>

            {mediaModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base-300/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-1 text-base-content">
                                {mediaModal.type === 'image' ? t('builder.editor.modalImage') : mediaModal.type === 'video' ? t('builder.editor.modalVideo') : t('builder.editor.modalLink')}
                            </h3>
                            <p className="text-sm text-base-content/50 mb-6">{t('builder.editor.modalUrlPh')}</p>
                            <div className="space-y-4">
                                <input type="text" className="w-full px-4 py-3 bg-base-200 border border-base-300 rounded-xl text-sm font-medium focus:border-blue-600 outline-none transition-all" placeholder="https://..." value={mediaModal.url} onChange={(e) => setMediaModal({ ...mediaModal, url: e.target.value })} autoFocus />
                                {mediaModal.type === 'image' && (
                                    <>
                                        <div className="divider text-[10px] uppercase tracking-widest opacity-40">{t('builder.editor.modalOrFile')}</div>
                                        <input type="file" accept="image/*" className="file-input file-input-bordered file-input-sm w-full bg-base-200" onChange={handleFileUpload} />
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-base-200/50 flex gap-2 justify-end border-t border-base-200">
                            <button type="button" onClick={() => setMediaModal({ isOpen: false, type: 'image', url: '' })} className="btn btn-ghost btn-sm px-6 text-base-content/60 hover:text-base-content">{t('builder.cancel')}</button>
                            <button type="button" onClick={handleMediaSubmit} className="btn bg-blue-600 text-white hover:bg-blue-700 btn-sm px-8 shadow-md shadow-blue-600/20">{t('builder.addBtn')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TiptapEditor;