/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, ChatMessage } from './types';
import * as geminiService from './services/geminiService';
import Spinner from './components/Spinner';
import WelcomeScreen from './components/WelcomeScreen';
import ProgressBar from './components/ProgressBar';
import ChatInterface from './components/ChatInterface';

// DO: Define the AIStudio interface to resolve a type conflict where `window.aistudio` was being redeclared with an anonymous type.
// FIX: Moved the AIStudio interface definition inside the `declare global` block to resolve a TypeScript type conflict.
declare global {
    interface AIStudio {
        openSelectKey: () => Promise<void>;
        hasSelectedApiKey: () => Promise<boolean>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [isApiKeySelected, setIsApiKeySelected] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, message?: string, fileName?: string } | null>(null);
    const [activeRagStoreName, setActiveRagStoreName] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [documentName, setDocumentName] = useState<string>('');
    const [files, setFiles] = useState<File[]>([]);
    const ragStoreNameRef = useRef(activeRagStoreName);

    useEffect(() => {
        ragStoreNameRef.current = activeRagStoreName;
    }, [activeRagStoreName]);
    
    const checkApiKey = useCallback(async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsApiKeySelected(hasKey);
            } catch (e) {
                console.error("Error checking for API key:", e);
                setIsApiKeySelected(false); // Assume no key on error
            }
        }
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            // This event fires when the user switches to or from the tab.
            if (document.visibilityState === 'visible') {
                checkApiKey();
            }
        };
        
        checkApiKey(); // Initial check when the component mounts.

        // Listen for visibility changes and window focus. This ensures that if the user
        // changes the API key in another tab (like the AI Studio settings),
        // the app's state will update automatically when they return to this tab.
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', checkApiKey);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', checkApiKey);
        };
    }, [checkApiKey]);

    useEffect(() => {
        const handleUnload = () => {
            if (ragStoreNameRef.current) {
                geminiService.deleteRagStore(ragStoreNameRef.current)
                    .catch(err => console.error("Error deleting RAG store on unload:", err));
            }
        };

        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, []);


    const handleError = (message: string, err: any) => {
        console.error(message, err);
        setError(`${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`);
        setStatus(AppStatus.Error);
    };

    const clearError = () => {
        setError(null);
        setStatus(AppStatus.Welcome);
    }

    useEffect(() => {
        setStatus(AppStatus.Welcome);
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio?.openSelectKey) {
            try {
                await window.aistudio.openSelectKey();
                await checkApiKey(); // Check right after the dialog promise resolves
            } catch (err) {
                console.error("Failed to open API key selection dialog", err);
            }
        } else {
            console.log('window.aistudio.openSelectKey() not available.');
            alert('API key selection is not available in this environment.');
        }
    };

    const handleUploadAndStartChat = async () => {
        if (!isApiKeySelected) {
            setApiKeyError("Please select your Gemini API Key first.");
            throw new Error("API Key is required.");
        }
        if (files.length === 0) return;
        
        setApiKeyError(null);

        try {
            geminiService.initialize();
        } catch (err) {
            handleError("Initialization failed. Please select a valid API Key.", err);
            throw err;
        }
        
        setStatus(AppStatus.Uploading);
        const totalSteps = files.length + 1;
        setUploadProgress({ current: 0, total: totalSteps, message: "Creating index..." });

        try {
            const storeName = `chat-session-${Date.now()}`;
            const ragStoreName = await geminiService.createRagStore(storeName);
            
            setUploadProgress({ current: 1, total: totalSteps, message: "Processing..." });

            for (let i = 0; i < files.length; i++) {
                setUploadProgress(prev => ({ 
                    ...(prev!),
                    current: i + 1,
                    message: "Reading document...",
                    fileName: `(${i + 1}/${files.length}) ${files[i].name}`
                }));
                await geminiService.uploadToRagStore(ragStoreName, files[i]);
            }
            
            setUploadProgress({ current: totalSteps, total: totalSteps, message: "Ready!", fileName: "" });
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Short delay to show "Ready!"

            let docName = '';
            if (files.length === 1) {
                docName = files[0].name;
            } else if (files.length === 2) {
                docName = `${files[0].name} & ${files[1].name}`;
            } else {
                docName = `${files.length} documents`;
            }
            setDocumentName(docName);

            setActiveRagStoreName(ragStoreName);
            setChatHistory([]);
            setStatus(AppStatus.Chatting);
            setFiles([]); // Clear files on success
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                setApiKeyError("The selected API key is invalid. Please select a different one and try again.");
                setIsApiKeySelected(false);
                setStatus(AppStatus.Welcome);
            } else {
                handleError("Failed to start chat session", err);
            }
            throw err;
        } finally {
            setUploadProgress(null);
        }
    };

    const handleEndChat = () => {
        if (activeRagStoreName) {
            geminiService.deleteRagStore(activeRagStoreName).catch(err => {
                console.error("Failed to delete RAG store in background", err);
            });
        }
        setActiveRagStoreName(null);
        setChatHistory([]);
        setDocumentName('');
        setFiles([]);
        setStatus(AppStatus.Welcome);
    };

    const handleSendMessage = async (message: string) => {
        if (!activeRagStoreName) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsQueryLoading(true);

        try {
            const result = await geminiService.fileSearch(activeRagStoreName, message);
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.text }],
                groundingChunks: result.groundingChunks
            };
            setChatHistory(prev => [...prev, modelMessage]);
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            handleError("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };
    
    const renderContent = () => {
        switch(status) {
            case AppStatus.Initializing:
                return (
                    <div className="flex items-center justify-center h-screen bg-gem-onyx text-gem-blue">
                        <Spinner /> <span className="ml-4 text-xl font-bold text-gem-offwhite">Initializing...</span>
                    </div>
                );
            case AppStatus.Welcome:
                 return <WelcomeScreen onUpload={handleUploadAndStartChat} apiKeyError={apiKeyError} files={files} setFiles={setFiles} isApiKeySelected={isApiKeySelected} onSelectKey={handleSelectKey} />;
            case AppStatus.Uploading:
                // Simple Loading Icon
                const icon = (
                    <div className="flex justify-center items-center h-40 w-40 rounded-full bg-white shadow-sm border border-gem-mist mb-6">
                        <Spinner />
                    </div>
                );

                return <ProgressBar 
                    progress={uploadProgress?.current || 0} 
                    total={uploadProgress?.total || 1} 
                    message={uploadProgress?.message || "Preparing..."} 
                    fileName={uploadProgress?.fileName}
                    icon={icon}
                />;
            case AppStatus.Chatting:
                return <ChatInterface 
                    documentName={documentName}
                    history={chatHistory}
                    isQueryLoading={isQueryLoading}
                    onSendMessage={handleSendMessage}
                    onNewChat={handleEndChat}
                />;
            case AppStatus.Error:
                 return (
                    <div className="flex flex-col items-center justify-center h-screen bg-gem-onyx text-gem-offwhite p-8">
                        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg text-center border border-gem-mist">
                            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold mb-4 text-gem-offwhite">Something went wrong</h1>
                            <p className="mb-8 text-gem-teal/80">{error}</p>
                            <button onClick={clearError} className="px-8 py-3 rounded-xl bg-gem-blue hover:bg-gem-teal text-white font-bold transition-all shadow-md">
                               Try Again
                            </button>
                        </div>
                    </div>
                );
            default:
                 return <WelcomeScreen onUpload={handleUploadAndStartChat} apiKeyError={apiKeyError} files={files} setFiles={setFiles} isApiKeySelected={isApiKeySelected} onSelectKey={handleSelectKey} />;
        }
    }

    return (
        <main className="h-screen bg-gem-onyx text-gem-offwhite font-sans">
            {renderContent()}
        </main>
    );
};

export default App;