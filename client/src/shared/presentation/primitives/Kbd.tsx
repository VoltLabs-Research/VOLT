import { cn } from '@/shared/utils';
import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
    children?: ReactNode;
}

const Kbd = forwardRef<HTMLElement, KbdProps>(({
    className,
    children,
    ...rest
}, ref) => {
    const classes = cn(
        'font-size-05',
        'font-weight-5',
        'color-secondary',
        'radius-xs',
        'b-soft',
        'px-1',
        className
    );

    return (
        <kbd ref={ref} className={classes} {...rest}>
            {children}
        </kbd>
    );
});

Kbd.displayName = 'Kbd';

export default Kbd;
