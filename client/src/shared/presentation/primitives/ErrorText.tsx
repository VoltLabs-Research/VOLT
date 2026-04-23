import { cn } from '@/shared/utils';
import { AlertCircle } from 'lucide-react';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface ErrorTextProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
    icon?: boolean;
    children?: ReactNode;
}

/**
 * Inline error message with optional alert icon. Mirrors the markup used by
 * `FormFieldRHF` so we keep visual parity when used standalone.
 */
const ErrorText = forwardRef<HTMLDivElement, ErrorTextProps>(({
    icon = true,
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'd-flex',
        'items-center',
        'gap-025',
        'form-field-error',
        'font-size-1',
        className
    );

    return (
        <div
            ref={ref}
            role='status'
            aria-live='polite'
            aria-atomic='true'
            className={classes}
            {...rest}
        >
            {icon && <AlertCircle size={12} />}
            <span>{children}</span>
        </div>
    );
});

ErrorText.displayName = 'ErrorText';

export default ErrorText;
