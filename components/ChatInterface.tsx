/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import Spinner from './Spinner';
import SendIcon from './icons/SendIcon';
import RefreshIcon from './icons/RefreshIcon';

interface ChatInterfaceProps {
    documentName: string;
    history: ChatMessage[];
    isQueryLoading: boolean;
    onSendMessage: (message: string) => void;
    onNewChat: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ documentName, history, isQueryLoading, onSendMessage, onNewChat }) => {
    const [query, setQuery] = useState('');
    const [modalContent, setModalContent] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const renderMarkdown = (text: string) => {
        if (!text) return { __html: '' };

        const lines = text.split('\n');
        let html = '';
        let listType: 'ul' | 'ol' | null = null;
        let paraBuffer = '';

        function flushPara() {
            if (paraBuffer) {
                html += `<p class="my-2">${paraBuffer}</p>`;
                paraBuffer = '';
            }
        }

        function flushList() {
            if (listType) {
                html += `</${listType}>`;
                listType = null;
            }
        }

        for (const rawLine of lines) {
            const line = rawLine
                .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
                .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>')
                .replace(/`([^`]+)`/g, '<code class="bg-gem-mist/50 px-1 py-0.5 rounded-sm font-mono text-sm text-gem-offwhite">$1</code>');

            const isOl = line.match(/^\s*\d+\.\s(.*)/);
            const isUl = line.match(/^\s*[\*\-]\s(.*)/);

            if (isOl) {
                flushPara();
                if (listType !== 'ol') {
                    flushList();
                    html += '<ol class="list-decimal list-inside my-2 pl-5 space-y-1">';
                    listType = 'ol';
                }
                html += `<li>${isOl[1]}</li>`;
            } else if (isUl) {
                flushPara();
                if (listType !== 'ul') {
                    flushList();
                    html += '<ul class="list-disc list-inside my-2 pl-5 space-y-1">';
                    listType = 'ul';
                }
                html += `<li>${isUl[1]}</li>`;
            } else {
                flushList();
                if (line.trim() === '') {
                    flushPara();
                } else {
                    paraBuffer += (paraBuffer ? '<br/>' : '') + line;
                }
            }
        }

        flushPara();
        flushList();

        return { __html: html };
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSendMessage(query);
            setQuery('');
        }
    };

    const handleSourceClick = (text: string) => {
        setModalContent(text);
    };

    const closeModal = () => {
        setModalContent(null);
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isQueryLoading]);

    return (
        <div className="flex flex-col h-full relative bg-gem-onyx">
            <header className="absolute top-0 left-0 right-0 p-4 bg-gem-slate/90 backdrop-blur-md z-10 flex justify-between items-center border-b border-gem-mist shadow-sm">
                <div className="w-full max-w-4xl mx-auto flex justify-between items-center px-4">
                    <h1 className="text-xl font-bold text-gem-offwhite truncate flex items-center gap-2" title={`Chat with ${documentName}`}>
                        <div className="w-2 h-2 rounded-full bg-gem-blue"></div>
                        {documentName}
                    </h1>
                    <button
                        onClick={onNewChat}
                        className="flex items-center px-4 py-2 bg-gem-mist/50 hover:bg-gem-blue hover:text-white rounded-full text-gem-offwhite transition-all duration-200 text-sm font-medium"
                        title="End current chat and start a new one"
                    >
                        <RefreshIcon />
                        <span className="ml-2 hidden sm:inline">New Chat</span>
                    </button>
                </div>
            </header>

            <div className="flex-grow pt-24 pb-32 overflow-y-auto px-4">
                <div className="w-full max-w-4xl mx-auto space-y-8">
                    {history.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl lg:max-w-2xl px-6 py-4 rounded-2xl shadow-sm ${
                                message.role === 'user' 
                                ? 'bg-gem-blue text-white rounded-br-none' 
                                : 'bg-gem-slate text-gem-offwhite rounded-bl-none border border-gem-mist'
                            }`}>
                                <div dangerouslySetInnerHTML={renderMarkdown(message.parts[0].text)} />
                                {message.role === 'model' && message.groundingChunks && message.groundingChunks.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-gem-mist">
                                        <h4 className="text-xs font-bold text-gem-teal mb-2 uppercase tracking-wider">Reference Sources:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {message.groundingChunks.map((chunk, chunkIndex) => (
                                                chunk.retrievedContext?.text && (
                                                    <button
                                                        key={chunkIndex}
                                                        onClick={() => handleSourceClick(chunk.retrievedContext!.text!)}
                                                        className="bg-gem-mist hover:bg-gem-teal hover:text-white text-gem-offwhite text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                                                        aria-label={`View source ${chunkIndex + 1}`}
                                                        title="View source document chunk"
                                                    >
                                                        Source {chunkIndex + 1}
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isQueryLoading && (
                        <div className="flex justify-start">
                            <div className="px-6 py-4 rounded-2xl bg-gem-slate border border-gem-mist rounded-bl-none flex items-center space-x-3 shadow-sm">
                                <Spinner />
                                <span className="text-gem-teal animate-pulse font-medium">Analyzing documents...</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gem-slate/90 backdrop-blur-md border-t border-gem-mist">
                 <div className="max-w-4xl mx-auto">
                     <form onSubmit={handleSubmit} className="flex items-center space-x-3 relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask a question about your files..."
                            className="flex-grow bg-white border border-gem-mist focus:border-gem-blue rounded-2xl py-4 px-6 focus:outline-none transition-all placeholder-gem-teal/50 text-gem-offwhite shadow-sm"
                            disabled={isQueryLoading}
                        />
                        <button type="submit" disabled={isQueryLoading || !query.trim()} className="absolute right-2 p-3 bg-gem-blue hover:bg-gem-teal rounded-xl text-white disabled:bg-gem-mist disabled:cursor-not-allowed transition-all shadow-md transform active:scale-95" title="Send message">
                            <SendIcon />
                        </button>
                    </form>
                </div>
            </div>

            {modalContent !== null && (
                <div 
                    className="fixed inset-0 bg-gem-offwhite/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
                    onClick={closeModal} 
                    role="dialog" 
                    aria-modal="true"
                    aria-labelledby="source-modal-title"
                >
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gem-mist" onClick={e => e.stopPropagation()}>
                        <h3 id="source-modal-title" className="text-2xl font-bold mb-6 text-gem-offwhite border-b border-gem-mist pb-4">Source Context</h3>
                        <div 
                            className="flex-grow overflow-y-auto pr-2 text-gem-offwhite leading-relaxed font-serif text-lg"
                            dangerouslySetInnerHTML={renderMarkdown(modalContent || '')}
                        >
                        </div>
                        <div className="flex justify-end mt-8 pt-4 border-t border-gem-mist">
                            <button onClick={closeModal} className="px-8 py-3 rounded-xl bg-gem-blue hover:bg-gem-teal text-white font-bold transition-all shadow-md" title="Close source view">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInterface;