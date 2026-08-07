import './CodeEditor.css';
import { useCallback, useId } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';

interface CodeEditorProps {
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
        fontFamily: '\'JetBrains Mono Variable\', \'JetBrains Mono\', \'Cascadia Code\', \'Cascadia Mono\', Consolas, monospace',
        fontSize: `${fontSize}px`,
        padding: '12px',
        backgroundColor: 'var(--color-content-bg)',
        color: 'var(--color-text-primary)',
        border: 'none',
        borderRadius: 'var(--radius-sm)'
    };

    return (
        <div className={`code-editor-wrapper flex flex-col h-full gap-2 ${className} ${error ? 'has-error' : ''}`}>
            {label && (
                <label htmlFor={editorId} id={labelId} className='code-editor-label text-md font-medium text-primary'>
                    {label}
                </label>
            )}
            {description && (
                <p id={descriptionId} className='code-editor-description text-sm text-secondary'>
                    {description}
                </p>
            )}

            <div className='relative overflow-hidden code-editor-container flex flex-col' style={{ height: editorHeight }}>
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
                    className='code-editor-textarea text-md'
                />
            </div>

            {error && (
                <p id={errorId} role='status' aria-live='polite' aria-atomic='true' className='code-editor-error text-sm'>
                    {error}
                </p>
            )}
        </div>
    );
};

export default CodeEditor;
