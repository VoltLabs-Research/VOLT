import { cn } from '@/shared/utils/cn';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

export interface DividerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'aria-orientation'> {
    orientation?: 'horizontal' | 'vertical';
}

/**
 * Thin divider line. Maps to the existing `.volt-divider` + orientation variant
 * CSS declared in `general.css`.
 */
const Divider = forwardRef<HTMLDivElement, DividerProps>(({
    orientation = 'horizontal',
    className,
    ...rest
}, ref) => {
    const classes = cn(
        'volt-divider',
        `volt-divider--${orientation}`,
        className
    );

    return (
        <div
            ref={ref}
            role='separator'
            aria-orientation={orientation}
            className={classes}
            {...rest}
        />
    );
});

Divider.displayName = 'Divider';

export default Divider;
