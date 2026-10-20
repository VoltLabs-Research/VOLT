import { cn } from '@heroui/react';
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
        fontSize: `${fontSize}px`
    };

    return (
        <div className={cn('group/code-editor flex flex-col h-full gap-2', className)}>
            {label && (
                <label htmlFor={editorId} id={labelId} className='m-0 text-sm font-medium text-foreground'>
                    {label}
                </label>
            )}
            {description && (
                <p id={descriptionId} className='m-0 text-xs leading-[1.4] text-muted'>
                    {description}
                </p>
            )}

            <div
                className={cn(
                    'relative overflow-hidden flex flex-col rounded-lg border bg-surface transition-[border-color,box-shadow] duration-200',
                    'group-focus-within/code-editor:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)]',
                    error
                        ? 'border-danger group-focus-within/code-editor:shadow-[0_0_0_1px_var(--danger),0_0_0_4px_color-mix(in_srgb,var(--danger)_25%,transparent)]'
                        : 'border-border group-focus-within/code-editor:border-focus'
                )}
                style={{ height: editorHeight }}
            >
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
                    className='h-full w-full resize-none rounded-lg border-0 bg-surface p-3 font-mono text-sm leading-normal text-foreground caret-[var(--focus)] outline-none placeholder:text-muted read-only:text-muted disabled:text-muted focus-visible:outline-none'
                />
            </div>

            {error && (
                <p id={errorId} role='status' aria-live='polite' aria-atomic='true' className='m-0 text-xs text-danger'>
                    {error}
                </p>
            )}
        </div>
    );
};

export default CodeEditor;
