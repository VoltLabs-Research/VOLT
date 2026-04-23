import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    hasError?: boolean;
}

/**
 * Low-level textarea atom. Reuses `form-field-input` styles for parity with
 * RHF form fields.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    hasError,
    className,
    rows = 3,
    style,
    ...rest
}, ref) => {
    const classes = cn(
        'form-field-input',
        'radius-sm',
        'w-max',
        hasError && 'has-error',
        className
    );

    return (
        <textarea
            ref={ref}
            rows={rows}
            className={classes}
            style={{ resize: 'vertical', minHeight: 80, ...style }}
            aria-invalid={hasError || undefined}
            {...rest}
        />
    );
});

Textarea.displayName = 'Textarea';

export default Textarea;
