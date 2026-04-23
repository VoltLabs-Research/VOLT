import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface HelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
    children?: ReactNode;
}

const HelperText = forwardRef<HTMLParagraphElement, HelperTextProps>(({
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'font-size-1',
        'color-muted',
        className
    );

    return (
        <p ref={ref} className={classes} {...rest}>
            {children}
        </p>
    );
});

HelperText.displayName = 'HelperText';

export default HelperText;
