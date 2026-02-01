import { forwardRef } from 'react';
import './CodeEditor.css';

export interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: 'json' | 'javascript' | 'python' | 'plain';
    rows?: number;
    placeholder?: string;
    readOnly?: boolean;
    error?: string;
    className?: string;
};

const CodeEditor = forwardRef<HTMLTextAreaElement, CodeEditorProps>(({
    value,
    onChange,
    rows = 10,
    placeholder,
    readOnly = false,
    error,
    className = ''
}, ref) => {
    return (
        <div className={`code-editor ${error ? 'has-error' : ''} ${className}`}>
            <textarea
                ref={ref}
                className='code-editor-textarea'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                placeholder={placeholder}
                readOnly={readOnly}
                spellCheck={false}
            />
            {error && (
                <span className='code-editor-error'>{error}</span>
            )}
        </div>
    );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
