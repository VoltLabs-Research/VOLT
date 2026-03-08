import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './CodeEditor.css';
import { useCallback } from 'react';
import type { ChangeEvent } from 'react';

export interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    height?: string | number;
    placeholder?: string;
    readOnly?: boolean;
    fontSize?: number;
    error?: string;
    description?: string;
    label?: string;
    className?: string;
    rows?: number;
};

const CodeEditor = ({
    value,
    onChange,
    height,
    readOnly = false,
    fontSize = 13,
    error,
    description,
    label,
    className = '',
    placeholder = 'Enter code here...',
    rows
}: CodeEditorProps) => {
    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    // Convert rows to height
    const editorHeight = height 
        ? (typeof height === 'number' ? `${height}px` : height)
        : rows 
            ? `${rows * 20}px`
            : '200px';

    return (
        <Container className={`code-editor-wrapper d-flex column h-max gap-05 ${className} ${error ? 'has-error' : ''}`}>
            {label && <label className='code-editor-label font-size-1 font-weight-5 color-primary'>{label}</label>}
            {description && <Paragraph className='code-editor-description color-secondary'>{description}</Paragraph>}

            <Container className='p-relative overflow-hidden code-editor-container d-flex column' style={{ height: editorHeight }}>
                <textarea
                    value={value}
                    onChange={handleChange}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    style={{
                        height: '100%',
                        width: '100%',
                        resize: 'none',
                        fontFamily: '\'JetBrains Mono\', \'Fira Code\', \'Monaco\', \'Menlo\', \'Ubuntu Mono\', monospace',
                        fontSize: `${fontSize}px`,
                        padding: '12px',
                        backgroundColor: '#1E1E1E',
                        color: '#D4D4D4',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        outline: 'none'
                    }}
                />
            </Container>

            {error && <Paragraph className='code-editor-error'>{error}</Paragraph>}
        </Container>
    );
};

export default CodeEditor;
