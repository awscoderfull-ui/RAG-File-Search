/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import UploadCloudIcon from './icons/UploadCloudIcon';
import TrashIcon from './icons/TrashIcon';

interface WelcomeScreenProps {
    onUpload: () => Promise<void>;
    apiKeyError: string | null;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isApiKeySelected: boolean;
    onSelectKey: () => Promise<void>;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onUpload, apiKeyError, files, setFiles, isApiKeySelected, onSelectKey }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            setFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]);
        }
    }, [setFiles]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);
    
    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleConfirmUpload = async () => {
        try {
            await onUpload();
        } catch (error) {
            console.error("Upload process failed:", error);
        }
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSelectKeyClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        await onSelectKey();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gem-onyx text-gem-offwhite">
            <div className="w-full max-w-3xl text-center space-y-12">
                <div className="space-y-4">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase text-gem-offwhite">
                        Search Your Files Using Gemini RAG System
                    </h1>
                    <p className="text-gem-teal text-lg font-medium">
                        Simple, fast, and secure document analysis.
                    </p>
                </div>

                <div className="max-w-md mx-auto">
                     {!isApiKeySelected ? (
                        <button
                            onClick={handleSelectKeyClick}
                            className="w-full bg-gem-blue hover:bg-gem-teal text-white font-bold rounded-xl py-3 px-6 transition-all shadow-md"
                        >
                            Connect API Key
                        </button>
                    ) : (
                        <div className="w-full bg-white border border-gem-mist rounded-xl py-2 px-4 text-gem-blue font-semibold flex items-center justify-center gap-2 shadow-sm">
                             <div className="w-2 h-2 rounded-full bg-gem-blue animate-pulse"/>
                             API Connected
                        </div>
                    )}
                     {apiKeyError && <p className="mt-2 text-red-600 font-medium text-sm">{apiKeyError}</p>}
                </div>

                <div 
                    className={`relative border-2 rounded-2xl p-10 transition-all duration-200 ${
                        isDragging 
                            ? 'border-gem-blue bg-gem-mist/20' 
                            : 'border-gem-mist bg-white hover:border-gem-blue'
                    }`}
                    onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                >
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className={`p-4 rounded-full bg-gem-onyx ${isDragging ? 'text-gem-blue' : 'text-gem-teal'}`}>
                           <UploadCloudIcon /> 
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-lg font-bold">
                                Drop files to analyze
                            </p>
                            <p className="text-gem-teal/70 text-sm">
                                PDF, TXT, MD supported
                            </p>
                        </div>
                        
                        <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md"/>
                         <label 
                            htmlFor="file-upload" 
                            className="cursor-pointer px-6 py-2 bg-gem-blue text-white rounded-lg font-bold hover:bg-gem-teal transition-all shadow-sm inline-block mt-2" 
                         >
                            Select Files
                        </label>
                    </div>
                </div>

                {files.length > 0 && (
                    <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gem-mist overflow-hidden text-left">
                        <div className="p-3 border-b border-gem-mist bg-gem-onyx flex justify-between items-center">
                            <h4 className="font-bold text-sm">Selected Files ({files.length})</h4>
                            <button onClick={() => setFiles([])} className="text-xs text-gem-blue hover:text-gem-teal font-bold uppercase">Clear</button>
                        </div>
                        <ul className="divide-y divide-gem-mist max-h-48 overflow-y-auto">
                            {files.map((file, index) => (
                                <li key={`${file.name}-${index}`} className="p-3 flex justify-between items-center">
                                    <span className="truncate text-sm font-medium pr-4" title={file.name}>{file.name}</span>
                                    <button 
                                        onClick={() => handleRemoveFile(index)}
                                        className="text-gem-mist hover:text-red-500 transition-colors"
                                    >
                                        <TrashIcon />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="p-3 bg-gem-onyx">
                             <button 
                                onClick={handleConfirmUpload}
                                disabled={!isApiKeySelected}
                                className="w-full py-3 rounded-lg bg-gem-blue hover:bg-gem-teal text-white font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Start Chat
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomeScreen;