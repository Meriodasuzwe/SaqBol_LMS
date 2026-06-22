import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Обязательно импортируем стили для формул!

const SmartText = ({ children }) => {
    // Если текста нет, ничего не рендерим
    if (!children) return null;

    return (
        <div className="markdown-math-container prose prose-sm max-w-none text-base-content">
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
};

export default SmartText;