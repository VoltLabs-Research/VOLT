import { cn } from '@/shared/utils/cn';
import './TextInput.css';
import { forwardRef, useRef, useState } from 'react';
import type { FocusEventHandler, InputHTMLAttributes, ReactNode } from 'react';

const MISSING_TEXT_INPUT_NAME_ERROR = 'TextInput requires an accessible name via aria-label, aria-labelledby, or an external label bound to its id.';

type InputSize = 'sm' | 'md' | 'lg';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    /** Vertical rhythm of the control. Surface tokens stay constant across sizes. */
    size?: InputSize;
    /** Renders the danger border treatment; pair with `aria-invalid`. */
    hasError?: boolean;
    /** Leading adornment (e.g. a lucide icon). Decorative — kept out of the a11y tree. */
    leftIcon?: ReactNode;
    /** Trailing adornment (e.g. a lucide icon or action). Decorative. */
    rightIcon?: ReactNode;
    /** Stretch the control to fill its container. */
    fullWidth?: boolean;
    /** Extra class for the outer surface wrapper. */
    containerClassName?: string;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({
    size = 'md',
    hasError = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    containerClassName,
    className,
    disabled,
    type = 'text',
    id,
    title,
    onFocus,
    onBlur,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-invalid': ariaInvalid,
    ...props
}, ref) => {
    const hasWarnedForMissingNameRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);

    const resolvedAriaLabel = ariaLabel?.trim() || undefined;
    const resolvedAriaLabelledBy = ariaLabelledBy?.trim() || undefined;
    const resolvedTitle = title?.trim() || undefined;
    const hasExternalLabelContract = Boolean(id);

    const accessibleName = resolvedAriaLabel ?? resolvedTitle;
    if (!resolvedAriaLabelledBy && !accessibleName && !hasExternalLabelContract) {
        if (!hasWarnedForMissingNameRef.current) {
            console.warn(MISSING_TEXT_INPUT_NAME_ERROR);
            hasWarnedForMissingNameRef.current = true;
        }
    }

    const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
        setIsFocused(true);
        onFocus?.(event);
    };

    const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
        setIsFocused(false);
        onBlur?.(event);
    };

    const containerClasses = cn(
        'volt-text-input',
        `volt-text-input--${size}`,
        fullWidth && 'volt-text-input--full-width',
        hasError && 'volt-text-input--error',
        isFocused && 'volt-text-input--focused',
        disabled && 'volt-text-input--disabled',
        containerClassName
    );

    return (
        <div className={containerClasses}>
            {leftIcon && (
                <span className='volt-text-input__affix volt-text-input__affix--left' aria-hidden='true'>
                    {leftIcon}
                </span>
            )}
            <input
                ref={ref}
                id={id}
                type={type}
                disabled={disabled}
                title={resolvedTitle}
                aria-label={accessibleName}
                aria-labelledby={resolvedAriaLabelledBy}
                aria-invalid={ariaInvalid ?? (hasError || undefined)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={cn('volt-text-input__field', className)}
                {...props}
            />
            {rightIcon && (
                <span className='volt-text-input__affix volt-text-input__affix--right' aria-hidden='true'>
                    {rightIcon}
                </span>
            )}
        </div>
    );
});

TextInput.displayName = 'TextInput';

export default TextInput;
