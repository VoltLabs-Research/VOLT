import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    hasError?: boolean;
    hasIcon?: boolean;
}

/**
 * Low-level text input atom. Reuses `form-field-input` styles already declared
 * in `FormField.css` so it visually matches RHF form fields.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(({
    hasError,
    hasIcon,
    className,
    type = 'text',
    ...rest
}, ref) => {
    const classes = cn(
        'form-field-input',
        'radius-sm',
        'w-max',
        hasError && 'has-error',
        hasIcon && 'has-icon',
        className
    );

    return (
        <input
            ref={ref}
            type={type}
            className={classes}
            aria-invalid={hasError || undefined}
            {...rest}
        />
    );
});

Input.displayName = 'Input';

export default Input;
