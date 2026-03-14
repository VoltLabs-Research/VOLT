import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './CodeEditor.css';
import { useCallback, useId } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';

export interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    id?: string;
    name?: string;
    height?: string | number;
    placeholder?: string;
    readOnly?: boolean;
    fontSize?: number;
    error?: string;
    description?: string;
    label?: string;
    className?: string;
    rows?: number;
    'aria-describedby'?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
};

const mergeAccessibilityIds = (...ids: Array<string | undefined>) => {
    const filteredIds = ids.filter((id): id is string => Boolean(id));

    if (filteredIds.length === 0) {
        return undefined;
    }

    return filteredIds.join(' ');
};

const CodeEditor = ({
    value,
    onChange,
    id,
    name,
    height,
    readOnly = false,
    fontSize = 14,
    error,
    description,
    label,
    className = '',
    placeholder = 'Enter code here...',
    rows,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy
}: CodeEditorProps) => {
    const reactId = useId();
    const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    }, [onChange]);
    const editorId = id ?? `code-editor-${reactId}`;
    const labelId = label ? `${editorId}-label` : undefined;
    const descriptionId = description ? `${editorId}-description` : undefined;
    const errorId = error ? `${editorId}-error` : undefined;
    const describedBy = mergeAccessibilityIds(ariaDescribedBy, descriptionId, errorId);
    const labelledBy = mergeAccessibilityIds(ariaLabelledBy, labelId);

    let editorHeight = '200px';

    if (height) {
        editorHeight = typeof height === 'number' ? `${height}px` : height;
    } else if (rows) {
        editorHeight = `${rows * 24}px`;
    }

    const textareaStyle: CSSProperties = {
        height: '100%',
        width: '100%',
        resize: 'none',
        fontFamily: '\'JetBrains Mono\', \'Fira Code\', \'Monaco\', \'Menlo\', \'Ubuntu Mono\', monospace',
        fontSize: `${fontSize}px`,
        padding: '12px',
        backgroundColor: 'var(--color-content-bg)',
        color: 'var(--color-text-primary)',
        border: 'none',
        borderRadius: 'var(--radius-sm)'
    };

    return (
        <Container className={`code-editor-wrapper d-flex column h-max gap-05 ${className} ${error ? 'has-error' : ''}`}>
            {label && (
                <label htmlFor={editorId} id={labelId} className='code-editor-label font-size-2 font-weight-5 color-primary'>
                    {label}
                </label>
            )}
            {description && (
                <Paragraph id={descriptionId} className='code-editor-description font-size-1 color-secondary'>
                    {description}
                </Paragraph>
            )}

            <Container className='p-relative overflow-hidden code-editor-container d-flex column' style={{ height: editorHeight }}>
                <textarea
                    id={editorId}
                    name={name}
                    value={value}
                    onChange={handleChange}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    aria-describedby={describedBy}
                    aria-errormessage={errorId}
                    aria-invalid={error ? true : undefined}
                    aria-label={ariaLabel ?? (label ? undefined : 'Code editor')}
                    aria-labelledby={ariaLabel ? undefined : labelledBy}
                    style={textareaStyle}
                    className='code-editor-textarea font-size-2'
                />
            </Container>

            {error && (
                <Paragraph
                    id={errorId}
                    role='status'
                    aria-live='polite'
                    aria-atomic='true'
                    className='code-editor-error font-size-1'
                >
                    {error}
                </Paragraph>
            )}
        </Container>
    );
};

export default CodeEditor;
