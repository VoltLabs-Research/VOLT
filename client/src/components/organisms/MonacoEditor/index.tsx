import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import EditorWidget from '../EditorWidget';
import './MonacoEditor.css'

interface MonacoEditorProps {
    language: string;
    value: string;
    onChange: (value: string | undefined) => void;
    theme?: 'vs-dark' | 'light';
    defaultVisible?: boolean; 
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
    language,
    value,
    onChange,
    theme = 'vs-dark',
    defaultVisible = false, 
}) => {
    const [isVisible, setIsVisible] = useState(defaultVisible);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'j') {
                event.preventDefault();
                setIsVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const editorOptions = {
        selectOnLineNumbers: true,
        minimap: {
            enabled: false,
        },
        fontSize: 14,
        scrollBeyondLastLine: false,
    };

    if(!isVisible){
        return null;
    }

    return (
        <EditorWidget className='monaco-editor-container'>
            <Editor
                className='monaco-editor'
                height='calc(100vh - 40px)'
                width="100%"
                language={language}
                theme={theme}
                value={value}
                options={editorOptions}
                onChange={onChange}
            />
        </EditorWidget>
    );
};

export default MonacoEditor;