import { cn } from '@/shared/utils/cn';
import './Textarea.css';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { ChangeEventHandler, TextareaHTMLAttributes } from 'react';

const MISSING_TEXTAREA_NAME_ERROR = 'Textarea requires an accessible name via aria-label, aria-labelledby, or an external label bound to its id.';

type TextareaSize = 'sm' | 'md' | 'lg';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
    /** Vertical rhythm of the control. Surface tokens stay constant across sizes. */
    size?: TextareaSize;
    /** Renders the danger border treatment; pair with `aria-invalid`. */
    hasError?: boolean;
    /** Grow the field with its content (up to `maxRows`) instead of scrolling. */
    autosize?: boolean;
    /** Minimum visible rows (and the floor for autosize). */
    minRows?: number;
    /** Ceiling for autosize growth; beyond this the field scrolls. */
    maxRows?: number;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    size = 'md',
    hasError = false,
    autosize = false,
    minRows = 2,
    maxRows = 8,
    className,
    disabled,
    id,
    title,
    value,
    onChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-invalid': ariaInvalid,
    ...props
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    // Expose the underlying node to the forwarded ref while keeping a local
    // handle for autosize measurements.
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const resolvedTitle = title?.trim() || undefined;
    const hasExternalLabelContract = Boolean(id);

    const accessibleName = resolvedAriaLabel ?? resolvedTitle;
    if (!resolvedAriaLabelledBy && !accessibleName && !hasExternalLabelContract) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_TEXTAREA_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    const resize = useCallback(() => {
        const node = innerRef.current;
        if (!node || !autosize) return;

        const computed = window.getComputedStyle(node);
        const lineHeight = parseFloat(computed.lineHeight) || 20;
        const paddingY = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
        const borderY = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
        const verticalChrome = paddingY + borderY;

        // Reset so scrollHeight reflects the true content height, then clamp
        // between the min/max row bounds.
        node.style.height = 'auto';
        const minHeight = minRows * lineHeight + verticalChrome;
        const maxHeight = maxRows * lineHeight + verticalChrome;
        const next = Math.min(Math.max(node.scrollHeight, minHeight), maxHeight);
        node.style.height = `${next}px`;
    }, [autosize, minRows, maxRows]);

    useLayoutEffect(() => {
        resize();
    }, [resize, value]);

    useEffect(() => {
        if (!autosize) return;
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [autosize, resize]);

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
        onChange?.(event);
        if (autosize) resize();
    };

    const classes = cn(
        'volt-textarea',
        `volt-textarea--${size}`,
        autosize && 'volt-textarea--autosize',
        hasError && 'volt-textarea--error',
        className
    );

    return (
        <textarea
            ref={innerRef}
            id={id}
            rows={minRows}
            disabled={disabled}
            title={resolvedTitle}
            aria-label={accessibleName}
            aria-labelledby={resolvedAriaLabelledBy}
            aria-invalid={ariaInvalid ?? (hasError || undefined)}
            value={value}
            onChange={handleChange}
            className={classes}
            {...props}
        />
    );
});

Textarea.displayName = 'Textarea';

export default Textarea;
